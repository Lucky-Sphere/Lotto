const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/operators', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*, COUNT(DISTINCT d.id) AS draw_count, COUNT(dr.id) AS result_count
      FROM operators o
      LEFT JOIN draws d ON d.operator_id = o.id
      LEFT JOIN draw_results dr ON dr.draw_id = d.id
      GROUP BY o.id
      ORDER BY CASE o.name
        WHEN 'Magnum 4D' THEN 1
        WHEN 'Sports Toto' THEN 2
        WHEN 'Da Ma Cai' THEN 3
      END
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/operators/:id/draws', async (req, res) => {
  try {
    const { rows: draws } = await db.query(`
      SELECT * FROM draws WHERE operator_id = $1 ORDER BY draw_date DESC, scraped_at DESC
    `, [req.params.id]);
    for (const draw of draws) {
      const { rows: games } = await db.query(`
        SELECT g.id, g.name AS game_name, json_agg(json_build_object(
          'prize_tier', dr.prize_tier, 'numbers', dr.numbers, 'prize_amount', dr.prize_amount
        ) ORDER BY dr.id) AS results
        FROM games g
        JOIN draw_results dr ON dr.game_id = g.id
        WHERE dr.draw_id = $1
        GROUP BY g.id
      `, [draw.id]);
      draw.games = games;
    }
    res.json(draws);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/draws/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, o.name AS operator_name
      FROM draws d
      JOIN operators o ON o.id = d.operator_id
      WHERE d.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Draw not found' });
    const draw = rows[0];
    const { rows: games } = await db.query(`
      SELECT g.*, json_agg(json_build_object(
        'id', dr.id, 'prize_tier', dr.prize_tier, 'numbers', dr.numbers, 'prize_amount', dr.prize_amount
      ) ORDER BY dr.id) AS results
      FROM games g
      JOIN draw_results dr ON dr.game_id = g.id
      WHERE dr.draw_id = $1
      GROUP BY g.id
    `, [req.params.id]);
    draw.games = games;
    res.json(draw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
