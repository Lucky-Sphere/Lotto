async function scrapeDamacaiHistory(page, targetDate) {
  const dateCompact = targetDate.replace(/-/g, '');

  console.log(`  [Da Ma Cai History] Navigating to past-draw-result page...`);

  await page.goto('https://www.damacai.com.my/past-draw-result/', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

  console.log(`  [Da Ma Cai History] Fetching callpassresult for ${dateCompact}...`);

  const jsonUrl = await page.evaluate(async (dateStr) => {
    const resp = await fetch(`/callpassresult?pastdate=${dateStr}`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'cookiesession': '509' }
    });
    const text = await resp.text();
    if (text.startsWith('{')) {
      const data = JSON.parse(text);
      return data.link || null;
    }
    return null;
  }, dateCompact);

  if (!jsonUrl) {
    console.log(`  [Da Ma Cai History] No data returned for ${dateCompact}`);
    return null;
  }

  console.log(`  [Da Ma Cai History] Fetching draw data from blob...`);

  const raw = await page.evaluate(async (url) => {
    const resp = await fetch(url);
    return await resp.text();
  }, jsonUrl);

  let d;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!d || !d.drawNo) return null;

  const games = [
    {
      name: '1+3D',
      tiers: [
        { tier: '1st Prize', numbers: [d.p1] },
        { tier: '2nd Prize', numbers: [d.p2] },
        { tier: '3rd Prize', numbers: [d.p3] },
        { tier: 'Starter Prizes', numbers: d.starterList || [] },
        { tier: 'Consolation Prizes', numbers: d.consolidateList || [] },
      ]
    }
  ];

  const jackpots = [];
  if (d['1+3DJackpot1']) jackpots.push({ label: '1+3D Jackpot 1', amount: d['1+3DJackpot1'].replace(/,/g, '') });
  if (d['1+3DJackpot2']) jackpots.push({ label: '1+3D Jackpot 2', amount: d['1+3DJackpot2'].replace(/,/g, '') });
  if (d['3DJackpot']) jackpots.push({ label: '3D Jackpot', amount: d['3DJackpot'].replace(/,/g, '') });

  const result = {
    operator: 'Da Ma Cai',
    drawDate: d.drawDate,
    drawLabel: d.drawNo,
    games,
  };
  if (jackpots.length) result.jackpots = jackpots;

  console.log(`  [Da Ma Cai History] Got draw: ${d.drawDate} #${d.drawNo}`);
  return result;
}

module.exports = { scrape: scrapeDamacaiHistory };
