async function scrapeDamacai(page) {
  console.log('[Da Ma Cai] Navigating...');

  await page.goto('https://www.damacai.com.my/home', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await page.waitForSelector('body', { timeout: 15000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

  console.log(`[Da Ma Cai] Title: ${await page.title()}`);

  const result = await page.evaluate(() => {
    const data = { operator: 'Da Ma Cai', games: [] };
    const text = document.body.innerText || '';

    const drawMatch = text.match(/winning numbers[\s\S]*?draw date\s*:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]*?draw no\.?\s*:?\s*([\d\/A-Z]+)/i);
    if (drawMatch) {
      data.drawDate = drawMatch[1];
      data.drawLabel = drawMatch[2];
    }

    const resultsOnly = text.match(/winning numbers[\s\S]*/i);
    const targetText = resultsOnly ? resultsOnly[0] : text;
    const jpPattern = /(1\+3D Jackpot \d|3D Jackpot)\s*RM\s*([\d,]+\.\d{2})/gi;
    const jackpots = [];
    let m;
    while ((m = jpPattern.exec(targetText)) !== null) {
      const label = m[1].trim();
      const existing = jackpots.find(j => j.label === label);
      if (!existing) jackpots.push({ label, amount: m[2].replace(/,/g, '') });
    }
    if (jackpots.length) data.jackpots = jackpots;

    const section = text.match(/winning numbers[\s\S]*?1st Prize[\s\S]*?(?=\n\s*1st Prize|\n\s*1\+3D Jackpot|$)/i);
    if (section) {
      const block = section[0];
      const lines = block.split('\n').map(l => l.trim());
      const game = { name: '1+3D', tiers: [] };
      let starterNums = [];
      let consolNums = [];
      let pendingTier = null;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        if (/^1st\s+Prize$/i.test(l)) { pendingTier = '1st Prize'; continue; }
        if (/^2nd\s+Prize$/i.test(l)) { pendingTier = '2nd Prize'; continue; }
        if (/^3rd\s+Prize$/i.test(l)) { pendingTier = '3rd Prize'; continue; }
        if (/^Starter\s+Prizes?$/i.test(l)) { pendingTier = 'Starter'; continue; }
        if (/^Consolation\s+Prizes?$/i.test(l)) { pendingTier = 'Consolation'; continue; }

        if (pendingTier && /^\d{4}$/.test(l)) {
          if (['1st Prize', '2nd Prize', '3rd Prize'].includes(pendingTier)) {
            game.tiers.push({ tier: pendingTier, numbers: [l] });
            pendingTier = null;
          } else if (pendingTier === 'Starter') {
            starterNums.push(l);
          } else if (pendingTier === 'Consolation') {
            consolNums.push(l);
          }
        } else if (!pendingTier && /^\d{4}$/.test(l)) {
          if (starterNums.length && starterNums.length < 10) starterNums.push(l);
          else if (consolNums.length && consolNums.length < 10) consolNums.push(l);
        }
      }

      if (starterNums.length) game.tiers.push({ tier: 'Starter Prizes', numbers: starterNums });
      if (consolNums.length) game.tiers.push({ tier: 'Consolation Prizes', numbers: consolNums });
      if (game.tiers.length) data.games.push(game);
    }

    return data;
  });

  console.log(`[Da Ma Cai] Found ${result.games.length} game(s), ${(result.jackpots || []).length} jackpot(s)`);
  return result;
}

module.exports = { scrape: scrapeDamacai };
