const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
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
      const { rows: jpRows } = await db.query(`
        SELECT dr.prize_amount, d.draw_date, d.draw_label, g.name AS game_name
        FROM draw_results dr
        JOIN draws d ON d.id = dr.draw_id
        JOIN games g ON g.id = dr.game_id
        WHERE d.operator_id = $1 AND dr.prize_amount IS NOT NULL AND g.name ~* 'jackpot'
        ORDER BY dr.prize_amount DESC LIMIT 1
      `, [op.id]);
      op.highestJp = jpRows[0] || null;
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

app.get('/api/favorites', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM favorites ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/favorites', async (req, res) => {
  try {
    const { numbers } = req.body;
    if (!numbers || !numbers.length) return res.status(400).json({ error: 'numbers required' });
    const { rows } = await db.query(
      'INSERT INTO favorites (numbers) VALUES ($1) RETURNING *',
      [numbers]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/favorites/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM favorites WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/csv', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.name AS operator, d.draw_date, d.draw_label,
             g.name AS game, dr.prize_tier, dr.numbers, dr.prize_amount
      FROM draw_results dr
      JOIN draws d ON d.id = dr.draw_id
      JOIN operators o ON o.id = d.operator_id
      JOIN games g ON g.id = dr.game_id
      ORDER BY o.name, d.draw_date DESC, g.name, dr.id
    `);
    const header = 'operator,draw_date,draw_label,game,prize_tier,numbers,prize_amount\n';
    const csv = rows.map(r => {
      const nums = (r.numbers || []).join(';');
      const amt = r.prize_amount || '';
      return `${r.operator},${r.draw_date.toISOString().split('T')[0]},${r.draw_label},${r.game},${r.prize_tier},"${nums}",${amt}`;
    }).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=lotto_export.csv');
    res.send(header + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/csv', express.text({ type: 'text/csv', limit: '10mb' }), async (req, res) => {
  try {
    const lines = req.body.trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: 'No data rows' });
    const header = lines[0].split(',');
    const opIdx = header.indexOf('operator');
    const dateIdx = header.indexOf('draw_date');
    const labelIdx = header.indexOf('draw_label');
    const gameIdx = header.indexOf('game');
    const tierIdx = header.indexOf('prize_tier');
    const numsIdx = header.indexOf('numbers');
    const amtIdx = header.indexOf('prize_amount');
    if (opIdx < 0) return res.status(400).json({ error: 'Missing operator column' });

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const match = line.match(/^([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),"([^"]*)",([^\n]*)$/);
      if (!match) continue;
      const [, op, dateStr, label, game, tier, nums, amt] = match;
      const operatorId = await db.getOperatorId(op.trim());
      if (!operatorId) continue;
      const drawDate = new Date(dateStr.trim());
      if (isNaN(drawDate.getTime())) continue;
      const drawId = await db.upsertDraw(operatorId, drawDate, label.trim() || null);
      const gameId = await db.upsertGame(operatorId, game.trim());
      const numbers = nums.split(';').filter(Boolean);
      const prizeAmount = amt ? parseFloat(amt) : null;
      await db.query(
        'DELETE FROM draw_results WHERE draw_id = $1 AND game_id = $2 AND prize_tier = $3',
        [drawId, gameId, tier.trim()]
      );
      await db.insertDrawResult(drawId, gameId, tier.trim(), numbers, prizeAmount);
      imported++;
    }
    res.json({ ok: true, imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const historyScrapers = {
  sportstoto: require('./scrapers/sportstoto_history'),
  magnum4d: require('./scrapers/magnum4d_history'),
  damacai: require('./scrapers/damacai_history'),
};
const puppeteer = require('puppeteer');
const config = require('./config');
const { saveScrapedResult } = require('./storage');

app.get('/api/sync', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const siteKeys = Object.keys(config.sites).filter(k => config.sites[k].enabled && historyScrapers[k]);
  const startDate = new Date(from + 'T00:00:00Z');
  const endDate = new Date(to + 'T00:00:00Z');
  let totalSaved = 0;
  let totalSkipped = 0;

  for (const key of siteKeys) {
    let browser;
    try {
      browser = await puppeteer.launch(config.puppeteer);
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

      const d = new Date(startDate);
      while (d <= endDate) {
        const dateStr = d.toISOString().split('T')[0];
        send('progress', { operator: key, date: dateStr });
        try {
          const result = await historyScrapers[key].scrape(page, dateStr);
          if (result && result.drawDate) {
            await saveScrapedResult(result);
            totalSaved++;
            send('saved', { operator: key, date: dateStr, label: result.drawLabel });
          } else {
            totalSkipped++;
          }
        } catch (e) {
          totalSkipped++;
          send('error', { operator: key, date: dateStr, error: e.message });
        }
        d.setUTCDate(d.getUTCDate() + 1);
      }
    } catch (e) {
      send('error', { operator: key, error: e.message });
    } finally {
      if (browser) await browser.close();
    }
  }

  send('done', { saved: totalSaved, skipped: totalSkipped });
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
