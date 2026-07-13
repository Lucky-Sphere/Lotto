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

    const recentSection = text.match(/RECENT RESULTS[\s\S]*?(?=Toto Lotto Games|$)/i);
    if (recentSection) {
      const sec = recentSection[0];
      const dd = sec.match(/Draw Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
      const dn = sec.match(/Draw No\.?\s*:?\s*([\d\/A-Z]+)/i);
      if (dd) data.drawDate = dd[1];
      if (dn) data.drawLabel = dn[1];
    }

    const sections = text.split(/\n{2,}/);
    let i = 0;

    while (i < sections.length) {
      const sec = sections[i];
      const header = sec.split('\n')[0].trim();

      if (header === 'First Prize\tSecond Prize\tThird Prize') {
        const game = { name: 'Toto 4D', tiers: [] };
        const lines = sec.split('\n').filter(Boolean);
        let specialNums = [];
        let consolNums = [];
        let row = 1;

        while (row < lines.length) {
          const line = lines[row].trim();
          if (/^Special\s+Prize$/i.test(line)) {
            row++;
            while (row < lines.length && !/^Consolation\s+Prize$/i.test(lines[row].trim()) && !/^Toto\s+4D\s+Jackpot/i.test(lines[row].trim())) {
              const nums = lines[row].trim().split(/[\s\t]+/).filter(p => /^\d{4}$/.test(p));
              specialNums.push(...nums);
              row++;
            }
            continue;
          }
          if (/^Consolation\s+Prize$/i.test(line)) {
            row++;
            while (row < lines.length && !/^Toto\s+4D\s+Jackpot/i.test(lines[row].trim())) {
              const nums = lines[row].trim().split(/[\s\t]+/).filter(p => /^\d{4}$/.test(p));
              consolNums.push(...nums);
              row++;
            }
            continue;
          }
          if (/^Toto\s+4D\s+Jackpot/i.test(line)) break;
          row++;
        }

        const tiers = [];
        const topLine = lines[0];
        const topParts = topLine.split('\t').map(s => s.trim()).filter(Boolean);
        const prizeNames = ['1st Prize', '2nd Prize', '3rd Prize'];
        if (lines.length > 1 && lines[1].trim()) {
          const numParts = lines[1].trim().split('\t').filter(p => /^\d{4}$/.test(p));
          numParts.forEach((n, idx) => {
            if (idx < 3) tiers.push({ tier: prizeNames[idx], numbers: [n] });
          });
        }
        if (specialNums.length) tiers.push({ tier: 'Special Prize', numbers: specialNums });
        if (consolNums.length) tiers.push({ tier: 'Consolation Prize', numbers: consolNums });
        if (tiers.length) {
          game.tiers = tiers;
          data.games.push(game);
        }
      }

      if (/^Jackpot\s+1\s+RM/i.test(header)) {
        const jp1Match = header.match(/RM\s+([\d,]+\.\d{2})/);
        if (jp1Match) {
          const amt = jp1Match[1].replace(/,/g, '');
          data.games.push({
            name: 'Toto 4D Jackpot 1',
            tiers: [{ tier: 'Jackpot 1', amount: amt }]
          });
        }
        const jp2InSection = sec.match(/Jackpot\s+2\s+RM\s+([\d,]+\.\d{2})/i);
        if (jp2InSection) {
          const amt = jp2InSection[1].replace(/,/g, '');
          data.games.push({
            name: 'Toto 4D Jackpot 2',
            tiers: [{ tier: 'Jackpot 2', amount: amt }]
          });
        }
      }

      i++;
    }

    return data;
  });

  console.log(`[Sports Toto] Found ${result.games.length} game(s), draw: ${result.drawDate || '?'} #${result.drawLabel || '?'}`);
  return result;
}

module.exports = { scrape: scrapeSportstoto };
