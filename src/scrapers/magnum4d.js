async function scrapeMagnum4d(page) {
  console.log('[Magnum 4D] Navigating...');

  await page.goto('https://www.magnum4d.my', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await page.waitForSelector('body', { timeout: 15000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

  console.log(`[Magnum 4D] Title: ${await page.title()}`);

  const result = await page.evaluate(() => {
    const data = { operator: 'Magnum 4D', games: [] };
    const text = document.body.innerText || '';

    const nextMatch = text.match(/Next draw.*?(\d{1,2}\s+\w+\s+\d{4})/i);
    if (nextMatch) data.drawDate = nextMatch[1];

    const sections = text.split(/\n{3,}/);

    function extractNumbersFromText(str) {
      return str.split(/[\s,;]+/).filter(n => /^\d{1,2}$/.test(n) || /^\d{4}$/.test(n) || /^\d{6}$/.test(n));
    }

    for (const section of sections) {
      const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      const header = lines[0];

      const gamePatterns = [
        /4D\s*Classic/i, /4D\s*Jackpot/i, /mgold/i,
        /4D\s*Jackpot\s*Gold/i, /Magnum\s*Life/i
      ];

      const matched = gamePatterns.some(p => p.test(header));
      if (!matched) continue;

      const game = { name: header, tiers: [] };

      if (/4D\s*Classic/i.test(header)) {
        const tierNames = ['1st Prize', '2nd Prize', '3rd Prize', 'Special', 'Consolation'];
        let tierIdx = 0;
        for (let i = 1; i < lines.length && tierIdx < tierNames.length; i++) {
          if (/Prize/i.test(lines[i]) || /Special/i.test(lines[i]) || /Consolation/i.test(lines[i])) {
            const nums = extractNumbersFromText(lines[i]);
            game.tiers.push({ tier: tierNames[tierIdx], numbers: nums });
            tierIdx++;
          }
        }
      } else if (/4D\s*Jackpot\s*Gold/i.test(header)) {
        const jpMatch = section.match(/Jackpot \d prize\s*RM\s*([\d,]+\.\d{2})/gi);
        if (jpMatch) {
          jpMatch.forEach((m, idx) => {
            const amt = m.replace(/[^0-9.]/g, '');
            const nums = extractNumbersFromText(section);
            game.tiers.push({ tier: `Jackpot ${idx + 1}`, numbers: nums, amount: amt });
          });
        }
      } else if (/Magnum\s*Life/i.test(header)) {
        const allNums = extractNumbersFromText(section);
        if (allNums.length >= 10) {
          game.tiers.push({ tier: 'Winning Numbers', numbers: allNums.slice(0, 8) });
          game.tiers.push({ tier: 'Bonus Numbers', numbers: allNums.slice(8, 10) });
        }
      } else if (/mgold/i.test(header)) {
        const allNums = extractNumbersFromText(section);
        if (allNums.length) {
          game.tiers.push({ tier: '1st Prize', numbers: allNums.slice(0, 6) });
        }
      } else if (/4D\s*Jackpot/i.test(header) && !/Gold/i.test(header)) {
        const pairs = section.match(/\d{4}\s*\+\s*\d{4}/g);
        if (pairs) {
          game.tiers.push({
            tier: 'Jackpot 1',
            numbers: pairs.map(p => p.replace(/\s+/g, '')),
          });
        }
      }

      if (game.tiers.length) data.games.push(game);
    }

    return data;
  });

  console.log(`[Magnum 4D] Found ${result.games.length} game(s)`);
  return result;
}

module.exports = { scrapeMagnum4d };
