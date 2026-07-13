const db = require('./db');

async function saveScrapedResult(result) {
  const operatorId = await db.getOperatorId(result.operator);
  if (!operatorId) {
    console.log(`  [Storage] Unknown operator: ${result.operator}`);
    return;
  }

  let drawDate;
  if (result.drawDate) {
    const parsed = new Date(result.drawDate);
    if (!isNaN(parsed.getTime())) {
      drawDate = parsed;
    }
  }
  if (!drawDate) drawDate = new Date();

  const drawLabel = result.drawDate || null;
  const drawId = await db.upsertDraw(operatorId, drawDate, drawLabel);

  for (const game of (result.games || [])) {
    const gameId = await db.upsertGame(operatorId, game.name);
    for (const tier of (game.tiers || [])) {
      const numbers = tier.numbers || [];
      const prizeAmount = tier.amount ? parseFloat(tier.amount) : null;
      await db.insertDrawResult(drawId, gameId, tier.tier, numbers, prizeAmount);
      console.log(
        `  [Storage] ${game.name} / ${tier.tier}: ${numbers.length} number(s)` +
        (prizeAmount ? ` (RM ${prizeAmount})` : '')
      );
    }
  }

  for (const jp of (result.jackpots || [])) {
    const gameId = await db.upsertGame(operatorId, jp.label);
    await db.insertDrawResult(
      drawId, gameId, 'Jackpot', [],
      parseFloat(jp.amount)
    );
    console.log(`  [Storage] Jackpot ${jp.label}: RM ${jp.amount}`);
  }
}

module.exports = { saveScrapedResult };
