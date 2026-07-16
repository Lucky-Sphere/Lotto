const https = require('https');
const { query } = require('../db');

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
  const dates = [];
  const re = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s*\(Tue\)/gi;
  let m;
  const months = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
  while ((m = re.exec(html)) !== null) {
    const day = parseInt(m[1]);
    const mon = months[m[2]];
    const year = parseInt(m[3]);
    const d = new Date(year, mon - 1, day);
    dates.push(d.toISOString().split('T')[0]);
  }
  return [...new Set(dates)];
}

async function syncSpecialDraws() {
  const dates = await scrapeSpecialDraws();
  let saved = 0;
  for (const d of dates) {
    const { rowCount } = await query(
      'INSERT INTO special_draws (draw_date) VALUES ($1) ON CONFLICT (draw_date) DO NOTHING',
      [d]
    );
    if (rowCount) saved++;
  }
  return { total: dates.length, saved };
}

module.exports = { scrapeSpecialDraws, syncSpecialDraws };
