const puppeteer = require('puppeteer');
const config = require('./config');
const db = require('./db');
const { saveScrapedResult } = require('./storage');

const scrapers = {
  sportstoto: require('./scrapers/sportstoto'),
  magnum4d: require('./scrapers/magnum4d'),
  damacai: require('./scrapers/damacai'),
};

async function run() {
  console.log('=== Malaysia Lottery Scraper ===\n');

  let browser;
  try {
    browser = await puppeteer.launch(config.puppeteer);
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    const siteKeys = Object.keys(config.sites).filter(
      k => config.sites[k].enabled
    );

    for (const key of siteKeys) {
      const site = config.sites[key];
      const scraper = scrapers[key];
      console.log(`\n--- Scraping: ${scraper.name || key} ---`);

      try {
        const result = await scraper.scrape(page);
        console.log(`Result: ${JSON.stringify(result, null, 2)}`);
        await saveScrapedResult(result);
      } catch (err) {
        console.error(`[${key}] Error: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    if (browser) await browser.close();
    await db.close();
  }

  console.log('\n=== Done ===');
}

run();
