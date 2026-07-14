async function scrapeMagnum4dHistory(page, targetDate) {
  const url = `https://www.magnum4d.my/results/past/between-dates/null/${targetDate}/1`;

  await page.setExtraHTTPHeaders({ 'Accept': 'application/json' });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));

  const raw = await page.evaluate(() => document.body.innerText);
  let draws;
  try { draws = JSON.parse(raw); } catch { return null; }
  if (!draws || !draws.length) return null;

  const d = draws[0];
  const data = {
    operator: 'Magnum 4D',
    drawDate: d.DrawDate,
    drawLabel: d.DrawID,
    games: [
      {
        name: '4D Classic',
        tiers: [
          { tier: '1st Prize', numbers: [d.FirstPrize] },
          { tier: '2nd Prize', numbers: [d.SecondPrize] },
          { tier: '3rd Prize', numbers: [d.ThirdPrize] },
          {
            tier: 'Special Prize',
            numbers: [d.Special1, d.Special2, d.Special3, d.Special4, d.Special5,
                      d.Special6, d.Special7, d.Special8, d.Special9, d.Special10]
              .filter(Boolean)
          },
          {
            tier: 'Consolation Prize',
            numbers: [d.Console1, d.Console2, d.Console3, d.Console4, d.Console5,
                      d.Console6, d.Console7, d.Console8, d.Console9, d.Console10]
              .filter(Boolean)
          },
        ]
      },
      {
        name: '4D Jackpot 1',
        tiers: [{ tier: 'Jackpot 1', amount: d.Jackpot1Amount }]
      },
      {
        name: '4D Jackpot 2',
        tiers: [{ tier: 'Jackpot 2', amount: d.Jackpot2Amount }]
      },
    ]
  };

  return data;
}

module.exports = { scrape: scrapeMagnum4dHistory };
