const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

async function getOperatorId(name) {
  const { rows } = await query(
    'SELECT id FROM operators WHERE name = $1',
    [name]
  );
  return rows[0]?.id;
}

async function upsertDraw(operatorId, drawDate, drawLabel) {
  const { rows } = await query(
    `INSERT INTO draws (operator_id, draw_date, draw_label)
     VALUES ($1, $2, $3)
     ON CONFLICT (operator_id, draw_label)
     DO UPDATE SET draw_date = EXCLUDED.draw_date, scraped_at = NOW()
     RETURNING id`,
    [operatorId, drawDate, drawLabel]
  );
  return rows[0].id;
}

async function upsertGame(operatorId, name) {
  const { rows } = await query(
    `INSERT INTO games (operator_id, name)
     VALUES ($1, $2)
     ON CONFLICT (operator_id, name) DO NOTHING
     RETURNING id`,
    [operatorId, name]
  );
  if (rows[0]) return rows[0].id;
  const { rows: existing } = await query(
    'SELECT id FROM games WHERE operator_id = $1 AND name = $2',
    [operatorId, name]
  );
  return existing[0].id;
}

async function insertDrawResult(drawId, gameId, prizeTier, numbers, prizeAmount) {
  await query(
    `INSERT INTO draw_results (draw_id, game_id, prize_tier, numbers, prize_amount)
     VALUES ($1, $2, $3, $4, $5)`,
    [drawId, gameId, prizeTier, numbers, prizeAmount || null]
  );
}

async function close() {
  await pool.end();
}

module.exports = {
  query,
  getOperatorId,
  upsertDraw,
  upsertGame,
  insertDrawResult,
  close,
};
