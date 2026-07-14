const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/settings', (req, res) => {
  try {
    const state = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'backfill_state.json'), 'utf8'
    ));
    res.json(state);
  } catch {
    res.json({});
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const { rows: operators } = await db.query(`
      SELECT o.id, o.name, o.website_url,
        COUNT(DISTINCT d.id) AS draw_count,
        COUNT(dr.id) AS result_count
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
    for (const op of operators) {
      const { rows: draws } = await db.query(`
        SELECT d.draw_date, d.draw_label FROM draws d
        WHERE d.operator_id = $1
        ORDER BY d.draw_date DESC LIMIT 1
      `, [op.id]);
      op.latestDraw = draws[0] || null;
      if (op.latestDraw) {
        const { rows: draws2 } = await db.query(`
          SELECT d.id FROM draws d
          WHERE d.operator_id = $1 AND d.draw_date = $2::date AND d.draw_label = $3
          LIMIT 1
        `, [op.id, op.latestDraw.draw_date, op.latestDraw.draw_label]);
        if (draws2.length) {
          const { rows: games } = await db.query(`
            SELECT g.id, g.name AS game_name, json_agg(json_build_object(
              'prize_tier', dr.prize_tier, 'numbers', dr.numbers, 'prize_amount', dr.prize_amount
            ) ORDER BY dr.id) AS results
            FROM games g
            JOIN draw_results dr ON dr.draw_id = $1 AND dr.game_id = g.id
            GROUP BY g.id, g.name
          `, [draws2[0].id]);
          op.latestDraw.games = games;
        }
      }
    }
    const { rows: [{ total }] } = await db.query(`SELECT COUNT(*) AS total FROM draws`);
    res.json({ totalDraws: parseInt(total), operators });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const nums = (req.query.numbers || '').split(',').map(s => s.trim()).filter(s => /^\d{4}$/.test(s));
    if (!nums.length) return res.json([]);
    const { rows } = await db.query(`
      SELECT d.draw_date, d.draw_label, o.name AS operator_name,
             g.name AS game_name, dr.prize_tier, dr.numbers, dr.prize_amount
      FROM draw_results dr
      JOIN draws d ON d.id = dr.draw_id
      JOIN operators o ON o.id = d.operator_id
      JOIN games g ON g.id = dr.game_id
      WHERE dr.numbers && $1::text[]
      ORDER BY d.draw_date DESC, o.name, g.name
    `, [nums]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const { from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { rows: [{ total }] } = await db.query(`
      SELECT COUNT(*) AS total FROM draws WHERE operator_id = $1
        AND ($2::date IS NULL OR draw_date >= $2::date)
        AND ($3::date IS NULL OR draw_date <= $3::date)
    `, [req.params.id, from || null, to || null]);

    const { rows: draws } = await db.query(`
      SELECT * FROM draws WHERE operator_id = $1
        AND ($2::date IS NULL OR draw_date >= $2::date)
        AND ($3::date IS NULL OR draw_date <= $3::date)
      ORDER BY draw_date DESC, scraped_at DESC
      LIMIT $4 OFFSET $5
    `, [req.params.id, from || null, to || null, limit, offset]);
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
    const totalPages = Math.ceil(parseInt(total) / limit);
    res.json({ draws, page, totalPages, total: parseInt(total) });
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
