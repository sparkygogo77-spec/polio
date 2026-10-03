// Design preview data (web/preview.html): which recorded sample messages rebuild each screen of the
// play page, and what the other pages read instead of the game server. The messages are real ones,
// recorded by server/scripts/preview-data.mts from two practice matches (web/preview/sample.json),
// and they go through the page's own handlers, so the preview never drifts from the real page.

let loaded = null;

/** The sample data (fetched once, from this site's own static files). */
export function sample() {
  loaded ??= fetch(new URL('./preview/sample.json', import.meta.url)).then((r) => r.json());
  return loaded;
}

/**
 * The play page's screens, in the order the preview shows them: [name, plain label, the parts that
 * change in that state (hooks; the first one is where the preview's window scrolls to)].
 */
export const PLAY_SCREENS = [
  ['connecting', 'Loading: connecting to the game server', ['connection-panel']],
  ['server-offline', 'Error: the game server is offline', ['server-offline', 'connection-panel']],
  ['first-visit', 'First visit: connect a wallet', ['wallet-panel']],
  ['lobby', 'Signed in: play money and Find a match', ['balance-panel', 'queue-panel']],
  ['devnet-banner', 'Devnet banner: test SOL only', ['network-banner']],
  ['new-wallet', 'Pop-up: create a new wallet', ['newwallet-panel']],
  ['before-queue', 'Pop-up: the rules to confirm before you queue', ['no-trade-warning']],
  ['queue-waiting', 'Waiting in the queue', ['queue-status']],
  ['mid-match', 'Match in progress: you are ahead', ['chart-area', 'scoreboard']],
  ['last-seconds', 'The last seconds of a match', ['score-time-left', 'scoreboard']],
  ['result-win', 'Result: you won', ['result-headline', 'result-panel']],
  ['result-loss', 'Result: you lost', ['result-headline', 'result-panel']],
  ['tie-rematch', 'Result: a draw (tie), rematch offered', ['rematch-panel']],
  ['tour', 'Intro tour: one step', ['tour-card']],
  ['phone-menu', 'Phone menu, open (at desktop width the links show in a row)', ['nav-links']],
  ['tv-connecting', 'Chart TV: waking the game server (static and the loading bar)', ['chart-tv', 'chart-tv-loading']],
  ['tv-offline', 'Chart TV: the game server is offline', ['chart-tv', 'chart-tv-loading']],
  ['tv-idle', 'Chart TV: between matches, a sample chart plays', ['chart-tv', 'chart-tv-idle']],
  ['tv-match', 'Chart TV: a match on screen, with the trade markers and duel circles', ['chart-tv', 'duel']],
  ['tv-result', 'Chart TV: the result on screen', ['chart-tv', 'chart-tv-result']],
];

/**
 * The other pages' screens: [name, label, page address, the parts that change] (`you` and `match` stand for the sample's player
 * and match, filled in by web/preview.js). `?preview=<variant>`
 * makes the page read sample answers (1), empty ones (empty), none because the game server is
 * offline (offline) or none because the match does not exist (missing).
 */
export const PAGE_SCREENS = [
  ['leaderboard', 'Leaderboard', 'leaderboard.html?preview=1', ['leaderboard-table']],
  ['leaderboard-empty', 'Leaderboard: no matches yet', 'leaderboard.html?preview=empty', ['leaderboard-empty']],
  ['leaderboard-error', 'Leaderboard: the game server is offline', 'leaderboard.html?preview=offline', ['server-offline', 'leaderboard-error']],
  ['profile', 'Player profile', 'profile.html?preview=1&address=you', ['profile-card', 'history-table']],
  ['profile-empty', 'Player profile: no matches yet', 'profile.html?preview=empty&address=you', ['profile-card', 'history-empty']],
  ['public-result', 'Public result page (checked in the browser)', 'match.html?preview=1&id=match', ['mr-verdict']],
  ['public-result-error', 'Public result page: match not found', 'match.html?preview=missing&id=match', ['mr-error']],
  ['library', 'Chart library (owner only)', 'library.html?preview=1', ['lib-view']],
];

/** Every screen of the preview, in order: { name, label, focus (the hooks of the parts that change) }. */
export const PREVIEW_SCREENS = [
  ...PLAY_SCREENS.map(([name, label, focus]) => ({ name, label, focus })),
  ...PAGE_SCREENS.map(([name, label, , focus]) => ({ name, label, focus })),
];

// Browser wallets the preview lists as installed (buttons only: the preview never connects).
const SAMPLE_WALLETS = ['Phantom', 'Solflare', 'Backpack'];

// Wallet approvals are transport details: the preview has no wallet to ask.
const SKIP = new Set(['sign_request', 'tx_result']);
const steps = (msgs) => msgs.filter((m) => !SKIP.has(m.type)).map((msg) => ({ msg }));

/** The recorded messages up to the first tick after server time `cut` (everything before it). */
function until(msgs, cut) {
  const out = [];
  for (const m of msgs) {
    if (m.type === 'tick' && m.t > cut) break;
    out.push(m);
  }
  return out;
}

/** Hello, then the sample wallet, then the rest: the page signs in only once it has a wallet. */
function withWallet(msgs, address) {
  const [hello, ...rest] = steps(msgs);
  return [hello, { wallet: address }, ...rest];
}

/**
 * What one play-page screen replays: { now (the stopped clock, server milliseconds), steps
 * ({ msg } or { wallet }), then ('warning', 'tour' or nothing), tourStep, wallets (names) }.
 */
export async function previewScreen(name) {
  return { wallets: SAMPLE_WALLETS, ...(await screenPlan(name)) };
}

async function screenPlan(name) {
  const d = await sample();
  const win = d.sessions.win;
  const hello = win[0];
  const lobby = win.slice(0, d.lobby);
  const start = win.find((m) => m.type === 'round_start');
  const end = start.endAt;
  const signedIn = (msgs) => withWallet(msgs, d.players.you);
  switch (name) {
    case 'connecting':
      return { now: hello.serverTime, steps: [] };
    case 'server-offline':
    case 'tv-offline':
      return { now: hello.serverTime, steps: [], then: 'offline' };
    case 'tv-connecting':
      // 23 seconds into waking the free game server.
      return { now: hello.serverTime, steps: [], then: 'waking', wakingFor: 23_000 };
    case 'tv-idle':
      return { now: hello.serverTime + 5_000, steps: signedIn(lobby) };
    case 'devnet-banner':
      return { now: hello.serverTime + 5_000, steps: signedIn([{ ...hello, network: 'devnet' }, ...lobby.slice(1)]) };
    case 'new-wallet':
      return { now: hello.serverTime + 5_000, steps: signedIn(lobby), then: 'new-wallet' };
    case 'phone-menu':
      return { now: hello.serverTime + 5_000, steps: signedIn(lobby), then: 'menu' };
    case 'first-visit':
      return { now: hello.serverTime + 2_000, steps: steps([hello]) };
    case 'lobby':
      return { now: hello.serverTime + 5_000, steps: signedIn(lobby) };
    case 'before-queue':
      return { now: hello.serverTime + 8_000, steps: signedIn(lobby), then: 'warning' };
    case 'queue-waiting': {
      const at = win.findIndex((m) => m.type === 'queue_status' && m.status === 'waiting');
      const waiting = win[at];
      return { now: waiting.joinDeadlineUnix * 1000 - 52_000, steps: signedIn(win.slice(0, at + 1)) };
    }
    case 'mid-match':
    case 'tv-match': {
      // A little after the last of the four trades: both players' markers are on the chart.
      const trades = win.filter((m) => m.type === 'trade');
      const cut = Math.min(trades.at(-1).trade.t + 3_000, end - 15_000);
      return { now: cut + 300, steps: signedIn(until(win, cut)) };
    }
    case 'last-seconds':
      return { now: end - 4_200, steps: signedIn(until(win, end - 4_500)) };
    case 'result-win':
    case 'tv-result':
      return { now: end + 8_000, steps: signedIn(win) };
    case 'result-loss':
      return { now: end + 8_000, steps: withWallet(d.sessions.loss, d.players.opponent) };
    case 'tie-rematch': {
      const offer = d.sessions.tie.find((m) => m.type === 'rematch_offer');
      return { now: offer.deadlineUnix * 1000 - 14_000, steps: signedIn([...lobby, ...d.sessions.tie]) };
    }
    case 'tour':
      return { now: hello.serverTime + 5_000, steps: signedIn(lobby), then: 'tour', tourStep: 'queue' };
    default:
      throw new Error(`no preview screen called ${name}`);
  }
}

/** What the leaderboard, profile and result pages read in the preview instead of the game server. */
export async function sampleJson(path, variant = '1') {
  const d = await sample();
  if (!(path in d.http)) throw new Error(`${path} is not in the sample data`);
  const data = structuredClone(d.http[path]);
  if (variant !== 'empty') return data;
  const none = { matches: 0, wins: 0, losses: 0, ties: 0, noContest: 0, bestPpm: null, bestPercent: null, profit: '0' };
  if ('rows' in data) data.rows = [];
  if ('matches' in data) data.matches = [];
  if ('practiceStats' in data) Object.assign(data, { stats: none, liveStats: none, practiceStats: none });
  return data;
}

/** The chart library's sample (library.html?preview=1): two recordings and a saved window, made up, the same every time. */
export function sampleLibrary() {
  const start = Date.UTC(2026, 0, 15, 14, 0, 0);
  const prices = (n, seed) => {
    let x = seed;
    let p = 0.0021;
    return Array.from({ length: n }, (_, i) => {
      x = (x * 1103515245 + 12345) % 2147483648;
      p *= 1 + ((x / 2147483648) - 0.495) * 0.004;
      return [start + i * 1000, p.toFixed(8)];
    });
  };
  const samples = prices(600, 7);
  const recordings = [
    { id: 'rec-sample-1', label: 'Sample coin, 10 minutes', mint: 'So11111111111111111111111111111111111111112', status: 'done', sampleCount: samples.length, endsAt: start + 600_000 },
    { id: 'rec-sample-2', label: 'Sample coin, still recording', mint: 'So11111111111111111111111111111111111111112', status: 'recording', sampleCount: 42, endsAt: start + 900_000 },
  ];
  const windows = [
    { id: 'win-sample-1', label: 'Calm then a jump', lengthMs: 60_000, startMs: start + 120_000, mint: recordings[0].mint, prices: samples.slice(120, 181).map(([, p]) => p) },
  ];
  return { library: { recordings, windows }, recording: { ...recordings[0], samples } };
}
