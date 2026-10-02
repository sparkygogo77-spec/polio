// Trade buttons (owner decision): a Buy row and a Sell row, each with 10%, 25%, 50% and 100%.
// Buy spends that share of your remaining (scored) cash; Sell sells that share of your current coin
// position. Each press is one trade and counts toward the 10-trade limit. The page only sends which
// button was pressed; the server works out the amounts. Shared by the page and the server (a server
// test imports this file), so both agree on the buttons and on when a button can do anything.

export const TRADE_PERCENTS = [10, 25, 50, 100];
export const TRADE_SIDES = ['buy', 'sell'];

/** Button id as sent to the server and used in hooks: "buy-10" ... "sell-100". */
export function buttonId(side, percent) {
  return `${side}-${percent}`;
}

export const TRADE_BUTTONS = TRADE_SIDES.flatMap((side) => TRADE_PERCENTS.map((p) => buttonId(side, p)));

/** "buy-25" -> { side: 'buy', percent: 25 }, or null for anything that is not one of the 8 buttons. */
export function parseButton(id) {
  if (typeof id !== 'string' || !TRADE_BUTTONS.includes(id)) return null;
  const [side, pct] = id.split('-');
  return { side, percent: Number(pct) };
}

/**
 * Which buttons can do something now, and why not. Inputs come from the server's messages:
 * `phase` ('waiting' | 'countdown' | 'trading' | 'ended'), `secondsToStart` during the countdown,
 * `tradesUsed` and `maxTrades`, and `canBuy` / `canSell`: the percentages that would buy or sell
 * a non-zero amount right now (the server works these out from the position, so the page never
 * needs the coin amounts).
 * Returns { tradesLeft, buttons: { 'buy-10': { enabled, reason }, ... } }.
 */
export function buttonStates({ phase, secondsToStart, tradesUsed = 0, maxTrades = 10, canBuy = [], canSell = [] }) {
  const tradesLeft = Math.max(0, maxTrades - tradesUsed);
  const rowReason = (side) => {
    if (phase === 'countdown') return `Trading starts in ${Math.max(1, secondsToStart ?? 1)} s`;
    if (phase === 'ended') return 'The match is over';
    if (phase !== 'trading') return 'No match running';
    if (tradesLeft === 0) return `All ${maxTrades} trades used`;
    if (side === 'buy' && canBuy.length === 0) return 'No cash left to buy with';
    if (side === 'sell' && canSell.length === 0) return 'No coins to sell';
    return null;
  };
  const buttons = {};
  for (const side of TRADE_SIDES) {
    const row = rowReason(side);
    const can = side === 'buy' ? canBuy : canSell;
    for (const p of TRADE_PERCENTS) {
      const reason = row ?? (can.includes(p) ? null : side === 'buy' ? 'Too little cash for this share' : 'Too few coins for this share');
      buttons[buttonId(side, p)] = { enabled: reason === null, reason };
    }
  }
  return { tradesLeft, buttons };
}
