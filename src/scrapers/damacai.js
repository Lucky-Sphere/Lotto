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

    const dateMatch = text.match(/draw date:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch) data.drawDate = dateMatch[1];

    const jackpots = [];
    const jpPattern = /(1\+3D Jackpot \d|3D Jackpot|DMC Jackpot \d|3\+3D \d+(?:st|nd|rd) Prize Bonus)\s*RM\s*([\d,]+\.\d{2})/gi;
    let m;
    while ((m = jpPattern.exec(text)) !== null) {
      jackpots.push({ label: m[1].trim(), amount: m[2].replace(/,/g, '') });
    }
    if (jackpots.length) data.jackpots = jackpots;

    const sections = text.split(/\n{3,}/);

    function extractNumbers(str) {
      return str.split(/[\s,;]+/).filter(n => /^\d{3,4}$/.test(n));
    }

    const knownGames = ['1+3D', 'SUPER 1+3D', '3D', '3+3D Bonus'];

    for (const section of sections) {
      const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;
      const header = lines[0].toUpperCase();
      const matched = knownGames.find(g => header.includes(g.toUpperCase()));
      if (!matched) continue;

      const game = { name: matched, tiers: [] };

      if (matched === '1+3D' || matched === 'SUPER 1+3D') {
        let foundTiers = [];
        let currentTier = null;
        let currentNums = [];

        for (const line of lines) {
          if (/^(Starter|Consolation)\s*Prizes?$/i.test(line.trim())) {
            if (currentTier && currentNums.length) {
              foundTiers.push({ tier: currentTier, numbers: [...currentNums] });
            }
            currentTier = line.trim();
            currentNums = [];
          } else {
            const nums = extractNumbers(line);
            currentNums.push(...nums);
          }
        }
        if (currentTier && currentNums.length) {
          foundTiers.push({ tier: currentTier, numbers: [...currentNums] });
        }
        if (!foundTiers.length) {
          const allNums = extractNumbers(section);
          if (allNums.length) {
            foundTiers.push({ tier: 'Winning Numbers', numbers: allNums });
          }
        }
        game.tiers = foundTiers;
      } else if (matched === '3D') {
        const allNums = extractNumbers(section);
        if (allNums.length) {
          game.tiers.push({ tier: 'Winning Numbers', numbers: allNums });
        }
      } else if (matched === '3+3D Bonus') {
        for (let i = 0; i < lines.length; i++) {
          if (/(\d+)(?:st|nd|rd)\s*Prize/i.test(lines[i])) {
            const nums = extractNumbers(lines[i]);
            if (nums.length) {
              game.tiers.push({ tier: lines[i].trim(), numbers: nums });
            }
            if (i + 1 < lines.length && /Bonus/i.test(lines[i + 1])) {
              const bonusNums = extractNumbers(lines[i + 1]);
              if (bonusNums.length) {
                game.tiers.push({ tier: `${lines[i].trim()} Bonus`, numbers: bonusNums });
              }
              i++;
            }
          }
        }
      }

      if (game.tiers.length) data.games.push(game);
    }

    return data;
  });

  console.log(`[Da Ma Cai] Found ${result.games.length} game(s), ${(result.jackpots || []).length} jackpot(s)`);
  return result;
}

module.exports = { scrapeDamacai };
