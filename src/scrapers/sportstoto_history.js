async function scrapeSportstotoHistory(page, targetDate) {
  const [y, m, d] = targetDate.split('-');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  console.log(`[Sports Toto History] Target date: ${targetDate}`);

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );

  const monthUrl = `https://www.sportstoto.com.my/results_past.asp?date=${parseInt(m)}/${parseInt(d)}/${y}`;
  console.log(`[Sports Toto History] Loading month: ${monthUrl}`);
  await page.goto(monthUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

  const drawNo = await page.evaluate((day) => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const a of links) {
      const t = a.innerText || '';
      const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length === 2 && lines[0] === day && /^\d+\/\d{2}$/.test(lines[1])) {
        return lines[1];
      }
    }
    return null;
  }, String(parseInt(d)));

  if (!drawNo) {
    console.log(`[Sports Toto History] No draw found for ${targetDate}`);
    return null;
  }

  console.log(`[Sports Toto History] Found draw: ${drawNo}`);

  const printUrl = `https://www.sportstoto.com.my/results_past_print.asp?drawNo=${drawNo}`;
  await page.goto(printUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

  const result = await page.evaluate((drawNo) => {
    const data = { operator: 'Sports Toto', games: [], drawLabel: drawNo };
    const text = document.body.innerText || '';

    const dateMatch = text.match(/Date:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch) data.drawDate = dateMatch[1];

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

        const topLine = lines[0];
        const prizeNames = ['1st Prize', '2nd Prize', '3rd Prize'];
        if (lines.length > 1 && lines[1].trim()) {
          const numParts = lines[1].trim().split('\t').filter(p => /^\d{4}$/.test(p));
          numParts.forEach((n, idx) => {
            if (idx < 3) game.tiers.push({ tier: prizeNames[idx], numbers: [n] });
          });
        }
        if (specialNums.length) game.tiers.push({ tier: 'Special Prize', numbers: specialNums });
        if (consolNums.length) game.tiers.push({ tier: 'Consolation Prize', numbers: consolNums });
        if (game.tiers.length) data.games.push(game);
      }

      const jp1Match = header.match(/^Jackpot\s+1\s+RM\s+([\d,]+\.\d{2})/i);
      if (jp1Match) {
        data.games.push({
          name: 'Toto 4D Jackpot 1',
          tiers: [{ tier: 'Jackpot 1', amount: jp1Match[1].replace(/,/g, '') }]
        });
      }
      const jp2Match = header.match(/^Jackpot\s+2\s+RM\s+([\d,]+\.\d{2})/i);
      if (jp2Match) {
        data.games.push({
          name: 'Toto 4D Jackpot 2',
          tiers: [{ tier: 'Jackpot 2', amount: jp2Match[1].replace(/,/g, '') }]
        });
      }

      i++;
    }

    return data;
  }, drawNo);

  console.log(`[Sports Toto History] Got draw: ${result.drawDate || '?'} #${result.drawLabel || '?'}, ${result.games.length} game(s)`);
  return result;
}

module.exports = { scrape: scrapeSportstotoHistory };
