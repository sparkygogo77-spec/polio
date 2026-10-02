// The chart TV on the Play page (web/index.html, chart-tv): which state its screen is in, how far the
// loading bar has got while the game server wakes, and the sample chart it plays between matches.
// Plain functions, no page access, so the server tests can check them (server/test/web-tv.test.ts).
import { generateChart } from './generated-chart.js';

/** Up to this long the bar says "Contacting server"; after it, "Server waking". */
export const CONTACT_MS = 3_000;
/** How long the free game server (Render) usually takes to wake from sleep. */
export const WAKE_MS = 50_000;
/** After this long without a connection the screen says the server is offline (it keeps trying). */
export const GIVE_UP_MS = 120_000;
/** How long "Connected" stays on screen before the sample chart takes over. */
export const CONNECTED_HOLD_MS = 900;

/**
 * The screen's state: 'offline' (static and the loading bar), 'idle' (the sample chart), 'match'
 * or 'result'. A match on screen stays on screen through a dropped connection.
 */
export function tvState({ connected, connectedAt = null, now = 0, match = false, result = false }) {
  if (result) return 'result';
  if (match) return 'match';
  if (!connected) return 'offline';
  if (connectedAt !== null && now - connectedAt < CONNECTED_HOLD_MS) return 'offline';
  return 'idle';
}

/**
 * The loading bar while there is no connection: { step ('contacting', 'waking', 'connected' or
 * 'offline'), progress (0 to 1), text }. `startedAt` is when this run of attempts began; `unusable`
 * means the game server address set for the site cannot be used at all.
 */
export function loadingView({ connected = false, startedAt = null, now = 0, unusable = false }) {
  if (connected) return { step: 'connected', progress: 1, text: 'Connected. Tuning in…' };
  if (unusable) return { step: 'offline', progress: 0, text: 'Game server offline: the address set for this site is not usable.' };
  const elapsed = startedAt === null ? 0 : Math.max(0, now - startedAt);
  if (elapsed >= GIVE_UP_MS) return { step: 'offline', progress: 0, text: 'Game server offline. Trying again…' };
  if (elapsed < CONTACT_MS) return { step: 'contacting', progress: 0.05 + 0.1 * (elapsed / CONTACT_MS), text: 'Contacting the game server…' };
  const woke = Math.min(1, (elapsed - CONTACT_MS) / WAKE_MS);
  const secs = Math.floor(elapsed / 1000);
  return {
    step: 'waking',
    progress: 0.15 + 0.8 * woke,
    text: `Waking the game server: it sleeps when nobody plays and takes about ${Math.round(WAKE_MS / 1000)} seconds. ${secs}\u00a0s so far.`,
  };
}

/** The steps the loading bar lists, in order. */
export const LOADING_STEPS = ['contacting', 'waking', 'connected'];

/** Each listed step: done (before the current one), current, or still to come. */
export function stepMarks(step) {
  const at = LOADING_STEPS.indexOf(step);
  return Object.fromEntries(LOADING_STEPS.map((s, i) => [s, { done: at >= 0 && (i < at || (s === 'connected' && step === 'connected')), current: i === at }]));
}

/** The channel label's state word. */
export function channelText(state) {
  return { offline: 'OFF AIR', idle: 'SAMPLE', match: '● LIVE', result: 'FINAL' }[state] ?? '';
}

/** The sample chart's fixed seed: the same sample every time, made in the browser (no request). */
export const ATTRACT_SEED = '5a6d706c652d636861727400000000000000000000000000000000000000ab01';
/** Seconds per candle, candles in the whole loop, and candles on screen when the loop starts. */
export const ATTRACT_BAR_SECS = 5;
export const ATTRACT_BARS = 120;
export const ATTRACT_FIRST = 40;
/** The sample chart's made-up start time (seconds), so its time scale reads like a match. */
export const ATTRACT_T0 = 1_767_225_600;

/** Candles (chart bars, index 100 = start) from one-second simulated prices. */
export function attractCandles(prices, seconds, barSecs = ATTRACT_BAR_SECS, t0 = ATTRACT_T0) {
  const base = Number(prices[0]);
  const out = [];
  for (let i = 0; i + barSecs <= seconds.length; i += barSecs) {
    const open = (Number(prices[i]) / base) * 100;
    let high = open;
    let low = open;
    for (let k = i; k < i + barSecs; k++) {
      high = Math.max(high, seconds[k].high * 100);
      low = Math.min(low, seconds[k].low * 100);
    }
    const close = (Number(prices[i + barSecs]) / base) * 100;
    out.push({ time: t0 + i, open, high: Math.max(high, open, close), low: Math.min(low, open, close), close });
  }
  return out;
}

/** How long the channel-change static shows between one sample chart and the next. */
export const CHANNEL_CHANGE_MS = 600;

/**
 * The seed of the `loop`-th sample chart. With a fixed seed (the page's ?tv-seed=<64 hex digits>,
 * for tests and captures) the charts are the same series every time, each loop still different;
 * without one each loop draws a new random seed (`random` gives 32 random bytes).
 */
export function attractSeed(loop, fixed = null, random = () => crypto.getRandomValues(new Uint8Array(32))) {
  if (typeof fixed === 'string' && /^[0-9a-f]{64}$/.test(fixed)) {
    const tail = ((parseInt(fixed.slice(56), 16) + loop) >>> 0).toString(16).padStart(8, '0');
    return fixed.slice(0, 56) + tail;
  }
  return [...random()].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** One sample chart: ATTRACT_BARS candles, generated from `seed` by the practice-match generator. */
export async function attractBars(seed = ATTRACT_SEED) {
  const { prices, seconds } = await generateChart(seed, null, ATTRACT_BARS * ATTRACT_BAR_SECS);
  return attractCandles(prices, seconds);
}
