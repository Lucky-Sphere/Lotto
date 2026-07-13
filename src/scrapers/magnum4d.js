async function scrapeMagnum4d(page) {
  console.log('[Magnum 4D] Navigating...');

  await page.goto('https://www.magnum4d.my', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

  console.log(`[Magnum 4D] Title: ${await page.title()}`);

  const result = await page.evaluate(() => {
    const data = { operator: 'Magnum 4D', games: [] };
    const text = document.body.innerText || '';

    const drawMatch = text.match(/Draw Results[\s\S]*?([\d]+\/[\d]+):\s*([\d]+\/[\d]+\/[\d]+)/);
    if (drawMatch) {
      data.drawLabel = drawMatch[1];
      data.drawDate = drawMatch[2];
    }

    const classicMatch = text.match(/Draw Results[\s\S]*?4D Classic[\s\S]*?(?=4D Jackpot|$)/i);
    if (classicMatch) {
      const block = classicMatch[0];
      const lines = block.split('\n').map(l => l.trim());
      let specialNums = [];
      let consolNums = [];
      let top3 = [];
      let pendingTier = null;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        if (/^1st\s+prize$/i.test(l)) { pendingTier = '1st Prize'; continue; }
        if (/^2nd\s+Prize$/i.test(l)) { pendingTier = '2nd Prize'; continue; }
        if (/^3rd\s+Prize$/i.test(l)) { pendingTier = '3rd Prize'; continue; }
        if (/^Special$/i.test(l)) { pendingTier = 'Special'; continue; }
        if (/^Consolation$/i.test(l)) { pendingTier = 'Consolation'; continue; }

        if (pendingTier && /^\d{4}$/.test(l)) {
          if (['1st Prize', '2nd Prize', '3rd Prize'].includes(pendingTier)) {
            top3.push({ tier: pendingTier, numbers: [l] });
            pendingTier = null;
          } else if (pendingTier === 'Special') {
            specialNums.push(l);
          } else if (pendingTier === 'Consolation') {
            consolNums.push(l);
          }
        } else if (!pendingTier && /^\d{4}$/.test(l)) {
          if (specialNums.length && specialNums.length < 10) specialNums.push(l);
          else if (consolNums.length && consolNums.length < 10) consolNums.push(l);
        }
      }

      if (top3.length || specialNums.length || consolNums.length) {
        const game = { name: '4D Classic', tiers: [...top3] };
        if (specialNums.length) game.tiers.push({ tier: 'Special Prize', numbers: specialNums });
        if (consolNums.length) game.tiers.push({ tier: 'Consolation Prize', numbers: consolNums });
        data.games.push(game);
      }
    }

    const jp1 = text.match(/Jackpot\s+1\s+prize\s+RM\s+([\d,]+\.\d{2})/i);
    const jp2 = text.match(/Jackpot\s+2\s+prize\s+RM\s+([\d,]+\.\d{2})/i);
    if (jp1) {
      data.games.push({
        name: '4D Jackpot 1',
        tiers: [{ tier: 'Jackpot 1', amount: jp1[1].replace(/,/g, '') }]
      });
    }
    if (jp2) {
      data.games.push({
        name: '4D Jackpot 2',
        tiers: [{ tier: 'Jackpot 2', amount: jp2[1].replace(/,/g, '') }]
      });
    }

    return data;
  });

  console.log(`[Magnum 4D] Found ${result.games.length} game(s), draw: ${result.drawDate || '?'} #${result.drawLabel || '?'}`);
  return result;
}

module.exports = { scrape: scrapeMagnum4d };
