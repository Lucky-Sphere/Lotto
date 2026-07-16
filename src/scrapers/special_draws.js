const https = require('https');
const { query } = require('../db');

const logoToOperator = {
  magnum: 'Magnum 4D',
  damacai: 'Da Ma Cai',
  toto: 'Sports Toto',
};

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function scrapeSpecialDraws() {
  const html = await fetchPage('https://gd4d.co/en/special-draws');
  const results = [];
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const blockRe = /<h4>(\d{1,2})\s+(\w+)\s+(\d{4})\s*\(Tue\)<\/h4>([\s\S]*?)(?=<div style="margin-bottom|$)/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const day = parseInt(m[1]);
    const mon = months[m[2]];
    const year = parseInt(m[3]);
    const imgs = m[4];
    if (mon === undefined) continue;
    const dateStr = `${year}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const operators = [];
    for (const [logo, name] of Object.entries(logoToOperator)) {
      if (new RegExp(`alt=["']${logo}["']`, 'i').test(imgs)) {
        operators.push(name);
      }
    }
    results.push({ date: dateStr, operators });
  }
  return results;
}

async function syncSpecialDraws() {
  const draws = await scrapeSpecialDraws();
  let saved = 0;
  for (const { date, operators } of draws) {
    for (const opName of operators) {
      const { rows } = await query('SELECT id FROM operators WHERE name = $1', [opName]);
      if (!rows.length) continue;
      const { rowCount } = await query(
        'INSERT INTO special_draws (draw_date, operator_id) VALUES ($1, $2) ON CONFLICT (draw_date, operator_id) DO NOTHING',
        [date, rows[0].id]
      );
      if (rowCount) saved++;
    }
  }
  return { total: draws.length, saved };
}

module.exports = { scrapeSpecialDraws, syncSpecialDraws };
