// Optional reference panel: DexScreener's own chart of the same pool (embed=1). It is shown for
// reference only: it is not the price trades fill at (that is our chart, from the server's ticks).
// It stays empty and hidden until the coin is revealed, so it can never leak the coin early.
// Not embedded on purpose: Axiom, Photon, BullX, Padre and pump.fun (they need sign-in and refuse
// to be framed).

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** The embed address for a revealed coin's pool, or null (not revealed yet, or no real pool). */
export function referenceEmbedUrl({ revealed, coin }) {
  if (!revealed || !coin) return null;
  const pool = coin.poolAddress;
  if (typeof pool !== 'string' || !BASE58_ADDRESS.test(pool)) return null;
  const q = new URLSearchParams({ embed: '1', theme: 'dark', trades: '0', info: '0', chartLeftToolbar: '0' });
  return `https://dexscreener.com/solana/${pool}?${q}`;
}

/** What the label above the panel says. */
export function referenceLabel({ practice }) {
  return practice
    ? 'Reference only: DexScreener shows this pool on the live market today. Your practice match replays recorded prices, and trades fill at the prices on the chart above, not these.'
    : 'Reference only: DexScreener\'s chart of the same pool. Trades fill at the prices on the chart above (the server\'s ticks), not these.';
}
