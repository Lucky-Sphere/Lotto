async function scrapeSportstoto(page) {
  console.log('[Sports Toto] Navigating...');

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );

  try {
    await page.goto('https://www.sportstoto.com.my', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
  } catch (err) {
    console.log('[Sports Toto] Timeout/blocked, trying fallback...');
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  }

  const pageTitle = await page.title();
  console.log(`[Sports Toto] Title: ${pageTitle}`);

  const result = await page.evaluate(() => {
    const data = { operator: 'Sports Toto', games: [] };
    const text = document.body.innerText || '';

    const dateMatch = text.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i);
    if (dateMatch) data.drawDate = dateMatch[1];

    const gameSections = text.split(/\n{2,}/);
    const knownGames = ['4D', '5D', '6D', 'SUPREME', 'POWER', 'STAR', 'JACKPOT', 'LOTTO'];

    for (const section of gameSections) {
      const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      const header = lines[0];
      const matchedGame = knownGames.find(g => header.toUpperCase().includes(g));
      if (!matchedGame) continue;

      const game = { name: header, tiers: [] };
      let currentTier = null;
      let currentNumbers = [];

      for (const line of lines.slice(1)) {
        const tierMatch = line.match(/^(1st|2nd|3rd|\d+[th])\s+(Prize|Special|Consolation)/i);
        if (tierMatch) {
          if (currentTier && currentNumbers.length) {
            game.tiers.push({ tier: currentTier, numbers: [...currentNumbers] });
          }
          currentTier = line;
          currentNumbers = [];
        } else {
          const nums = line.split(/[\s,]+/).filter(n => /^\d{4,6}$/.test(n));
          currentNumbers.push(...nums);
        }
      }
      if (currentTier && currentNumbers.length) {
        game.tiers.push({ tier: currentTier, numbers: [...currentNumbers] });
      }

      if (game.tiers.length) data.games.push(game);
    }

    return data;
  });

  console.log(`[Sports Toto] Found ${result.games.length} game(s)`);
  return result;
}

module.exports = { scrape: scrapeSportstoto };
