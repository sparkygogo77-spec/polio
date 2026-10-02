// The game's rules settings as the server ships them (server/src/config.ts, publicRules). The page
// uses the live ones from the server's hello message; these are only for when no game server can be
// reached, so the intro tour still explains the game. A server test checks they are the same.
export const DEFAULT_RULES = {
  stakes: ['250000000', '500000000', '1000000000'],
  lengthsMs: [60_000, 150_000, 300_000],
  maxTrades: 10,
  tradePercents: [10, 25, 50, 100],
  cutBps: 250,
  startCountdownMs: 5_000,
  fillMaxAgeMs: 1_000,
  budget: '1000000000',
  maxFeedGapMs: 15_000,
};
