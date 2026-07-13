const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');

async function migrate() {
  const pool = new Pool(config.db);

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrate.sql'),
      'utf8'
    );
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
