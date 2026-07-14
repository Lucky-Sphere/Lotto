const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const config = require('./config');
const db = require('./db');
const { saveScrapedResult } = require('./storage');

const STATE_FILE = path.join(__dirname, '..', 'backfill_state.json');
const TARGET_YEAR = 1960;

const scrapers = {
  sportstoto: require('./scrapers/sportstoto'),
  magnum4d: require('./scrapers/magnum4d'),
  damacai: require('./scrapers/damacai'),
};

const historyScrapers = {
  sportstoto: require('./scrapers/sportstoto_history'),
  magnum4d: require('./scrapers/magnum4d_history'),
  damacai: require('./scrapers/damacai_history'),
};

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prevDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return formatDate(d);
}

async function scrapeHistorical(page, siteKey, targetDate) {
  console.log(`  [Backfill ${siteKey}] Attempting date: ${targetDate}`);

  const site = config.sites[siteKey];
  if (!site) { console.log(`  [Backfill ${siteKey}] Unknown site`); return null; }

  if (historyScrapers[siteKey]) {
    const result = await historyScrapers[siteKey].scrape(page, targetDate);
    return result && result.drawDate ? result : null;
  }

  const patterns = historicalUrlPatterns(siteKey, targetDate);
  for (const url of patterns) {
    try {
      console.log(`  [Backfill ${siteKey}] Trying URL: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
      break;
    } catch {
      console.log(`  [Backfill ${siteKey}] URL failed: ${url}`);
    }
  }

  const result = await scrapers[siteKey].scrape(page);
  if (result && result.drawDate) {
    console.log(`  [Backfill ${siteKey}] Got draw: ${result.drawDate} #${result.drawLabel}`);
    return result;
  }
  console.log(`  [Backfill ${siteKey}] No valid results for ${targetDate}`);
  return null;
}

function historicalUrlPatterns(siteKey, targetDate) {
  const d = targetDate.split('-');
  const ddmy = `${d[2]}/${d[1]}/${d[0]}`;
  const dmy = `${parseInt(d[2])}/${parseInt(d[1])}/${d[0]}`;
  const ymd = targetDate;

  const base = {
    sportstoto: [
      `https://www.sportstoto.com.my/past_results_4d.asp?date=${ddmy}`,
      `https://www.sportstoto.com.my/past_results.asp?date=${ddmy}`,
      `https://www.sportstoto.com.my/`,
    ],
    magnum4d: [
      `https://www.magnum4d.my/result?date=${ymd}`,
      `https://www.magnum4d.my/past-results?date=${ymd}`,
      `https://www.magnum4d.my/`,
    ],
    damacai: [
      `https://www.damacai.com.my/home?date=${ddmy}`,
      `https://www.damacai.com.my/result/${ymd}`,
      `https://www.damacai.com.my/home`,
    ],
  };
  return base[siteKey] || [config.sites[siteKey]?.url || ''];
}

async function run() {
  console.log('=== Backfill Scraper ===\n');

  const state = readState();
  const siteKeys = Object.keys(config.sites).filter(k => config.sites[k].enabled);

  for (const key of siteKeys) {
    if (!state[key]) {
      state[key] = { nextDate: '', complete: false };
    }
    if (state[key].complete) {
      console.log(`[${key}] Backfill complete.`);
      continue;
    }

    if (!state[key].nextDate) {
      const opId = await db.getOperatorId(
        key === 'sportstoto' ? 'Sports Toto' :
        key === 'magnum4d' ? 'Magnum 4D' :
        key === 'damacai' ? 'Da Ma Cai' : key
      );
      if (opId) {
        const { rows } = await db.query(
          'SELECT draw_date FROM draws WHERE operator_id = $1 ORDER BY draw_date ASC LIMIT 1',
          [opId]
        );
        if (rows.length) {
          const oldest = new Date(rows[0].draw_date);
          oldest.setUTCDate(oldest.getUTCDate() - 1);
          state[key].nextDate = formatDate(oldest);
        } else {
          const today = new Date();
          state[key].nextDate = formatDate(today);
        }
      } else {
        const today = new Date();
        state[key].nextDate = formatDate(today);
      }
      writeState(state);
    }

    let browser;
    try {
      browser = await puppeteer.launch(config.puppeteer);
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });

      let current = state[key].nextDate;
      while (parseInt(current.split('-')[0]) >= TARGET_YEAR) {
        console.log(`\n[${key}] Scraping: ${current}`);
        const result = await scrapeHistorical(page, key, current);

        if (result && result.drawDate) {
          await saveScrapedResult(result);
          state[key].nextDate = prevDay(current);
          writeState(state);
          console.log(`[${key}] Saved. Next target: ${state[key].nextDate}`);
          break;
        } else {
          current = prevDay(current);
          state[key].nextDate = current;
          writeState(state);
          console.log(`[${key}] No data, skipping to ${current}`);
        }
      }

      if (parseInt(current.split('-')[0]) < TARGET_YEAR) {
        console.log(`[${key}] Reached year ${TARGET_YEAR}, marking complete.`);
        state[key].complete = true;
        writeState(state);
      }
    } catch (err) {
      console.error(`[${key}] Error: ${err.message}`);
      state[key].nextDate = prevDay(state[key].nextDate);
      writeState(state);
    } finally {
      if (browser) await browser.close();
    }
  }

  await db.close();
  console.log('\n=== Backfill Done ===');
}

run();
