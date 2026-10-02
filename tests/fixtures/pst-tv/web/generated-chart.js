// Generated practice charts (owner decision). For each practice match the server makes the chart
// itself, one price per second, from a trade-by-trade simulation (model "trades", generator v2):
// trades arrive all the time at a rate that drifts and bursts, each buys or sells some SOL through a
// constant-product pool, and the price is the pool's price after each trade. The numbers are in
// generated-chart-config.js. Charts made before v2 (generator v1) stitched runs of real recorded
// one-second moves (a "move pool") or used a simple random model; that code stays so their records
// can still be checked.
//
// Provably fair: the server picks a random seed, shows its SHA-256 hash when the chart appears and
// reveals the seed with the result. Anyone can then run this same file to regenerate the chart from
// the seed and check every price the players saw. All draws come from SHA-256 of the seed and a
// counter (v2: a small random-number generator seeded by that hash), and the arithmetic uses only
// operations every browser does exactly alike (v2: + - x / on ordinary numbers, with exp and log
// written out here instead of Math.exp and Math.log, which can differ in the last digit between
// browsers), so a browser and the server get exactly the same chart. Shared by the server
// (server/src/market/generated.ts), the result page and the sample page (chart-lab.html).
import { CHART_PARAMS } from './generated-chart-config.js';

export { CHART_PARAMS };
export const GENERATOR = 'ponsstars-generated-v2';
export const GENERATOR_V1 = 'ponsstars-generated-v1';
export const POOL_FORMAT = 'ponsstars-move-pool-v1';
/** Moves are stitched in runs of this many seconds, so the chart keeps the texture of real trading. */
export const BLOCK_SECS = 10;
/** Starting price in SOL per coin times 10^18 (players only ever see the index, 100 at the start). */
export const START_PRICE_E18 = 1_000_000_000_000n;
const PPB = 1_000_000_000n;
/** No single second moves the price by more than this, in parts per billion (20%). */
export const MAX_MOVE_PPB = 200_000_000;

const encoder = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^([0-9a-f]{2})*$/.test(hex)) throw new Error('not lowercase hex');
  return Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));
}

/** SHA-256 of text or bytes, as lowercase hex. */
export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  return bytesToHex(new Uint8Array(await subtle().digest('SHA-256', bytes)));
}

/** The hash shown at the start of the match: SHA-256 of the seed's bytes. */
export function seedCommit(seedHex) {
  return sha256Hex(hexToBytes(seedHex));
}

/** A move pool's exact text, for its id (the id is its SHA-256). */
export function canonicalPool(pool) {
  return JSON.stringify({ format: pool.format, blockSecs: pool.blockSecs, segments: pool.segments });
}

export function poolIdOf(pool) {
  return sha256Hex(canonicalPool(pool));
}

/** Draw number `i` for a purpose: the first 8 bytes of SHA-256(seed, purpose, i), as a whole number. */
async function draw(seed, purpose, i) {
  const label = encoder.encode(`:${purpose}:${i}`);
  const buf = new Uint8Array(seed.length + label.length);
  buf.set(seed);
  buf.set(label, seed.length);
  const d = new Uint8Array(await subtle().digest('SHA-256', buf));
  let v = 0n;
  for (let k = 0; k < 8; k++) v = (v << 8n) | BigInt(d[k]);
  return { v, bytes: d };
}

/** True when a pool has at least one run long enough to stitch from. */
export function poolUsable(pool) {
  return !!pool && pool.format === POOL_FORMAT && Array.isArray(pool.segments) && pool.segments.some((s) => s.length >= pool.blockSecs);
}

/**
 * The one-second moves of a chart (parts per billion each), `steps` long.
 * Stitched: each block of BLOCK_SECS moves is a run copied from a pool segment, chosen by a draw.
 * Random (no usable pool): each move is the sum of four bytes of a draw, centred, times 15000 ppb (about 0.2% a second).
 */
export async function generateMoves(seedHex, pool, steps) {
  const seed = hexToBytes(seedHex);
  const moves = [];
  if (poolUsable(pool)) {
    const block = pool.blockSecs;
    const starts = pool.segments.map((s) => Math.max(0, s.length - block + 1));
    const total = BigInt(starts.reduce((a, b) => a + b, 0));
    for (let k = 0; moves.length < steps; k++) {
      let r = Number((await draw(seed, 'block', k)).v % total);
      let seg = 0;
      while (r >= starts[seg]) r -= starts[seg++];
      moves.push(...pool.segments[seg].slice(r, r + block));
    }
    return { model: 'stitched', moves: moves.slice(0, steps) };
  }
  for (let i = 0; i < steps; i++) {
    const b = (await draw(seed, 'step', i)).bytes;
    moves.push((b[0] + b[1] + b[2] + b[3] - 510) * 15000);
  }
  return { model: 'random', moves };
}

/** Prices from moves: each second the price is multiplied by (1 + move), rounded down. */
export function pricesFromMoves(moves, start = START_PRICE_E18) {
  const prices = [start];
  let p = start;
  for (const m of moves) {
    const move = Math.max(-MAX_MOVE_PPB, Math.min(MAX_MOVE_PPB, Math.trunc(m)));
    p = (p * (PPB + BigInt(move))) / PPB;
    if (p < 1n) p = 1n;
    prices.push(p);
  }
  return prices;
}

/** A v1 chart for a seed: { model, prices } with steps + 1 prices, one per second. */
export async function generateChartV1(seedHex, pool, steps) {
  const { model, moves } = await generateMoves(seedHex, pool, steps);
  return { model, prices: pricesFromMoves(moves) };
}

/** The chart's price at server time `t` (milliseconds), or null outside the chart. */
export function priceAt(prices, anchorMs, t) {
  const i = Math.floor((t - anchorMs) / 1000);
  return i >= 0 && i < prices.length ? prices[i] : null;
}

/**
 * Check a generated round of a published record: the revealed seed matches the hash shown at the
 * start, and regenerating the chart from it gives every price reading the players saw.
 * `pool` is the move pool named by a v1 record (null for the random model, v2, or when unavailable);
 * a v2 record carries the chart numbers it was made with (`params`).
 * Returns { seedMatches, poolMatches, pricesMatch, compared }.
 */
export async function verifyGeneratedRound(round, pool) {
  const g = round.coin?.generated;
  if (!g) return null;
  const seedMatches = typeof g.seed === 'string' && (await seedCommit(g.seed).catch(() => '')) === g.commit;
  const v1 = g.generator === GENERATOR_V1;
  const poolMatches = !v1 || g.model === 'random' ? true : !!pool && (await poolIdOf(pool)) === g.poolId;
  let pricesMatch = false;
  let compared = 0;
  if (seedMatches && poolMatches) {
    const { model, prices } = v1
      ? await generateChartV1(g.seed, g.model === 'random' ? null : pool, g.steps)
      : await generateChart(g.seed, null, g.steps, g.params ?? CHART_PARAMS).catch(() => ({ model: null, prices: [] }));
    pricesMatch = model === g.model;
    for (const t of round.ticks) {
      for (const [source, price, observedAt] of t.sources) {
        if (source !== 'generated') continue;
        compared++;
        const want = priceAt(prices, g.anchorMs, observedAt);
        if (want === null || want !== BigInt(price)) pricesMatch = false;
      }
    }
    if (compared === 0) pricesMatch = false;
  }
  return { seedMatches, poolMatches, pricesMatch, compared };
}

// ------------------------------------------------------------------ v2: trade-by-trade simulation

const LN2 = 0.6931471805599453;
const SQRT2 = 1.4142135623730951;

/** e^x with + - x / only (the same last digit in every browser). */
export function detExp(x) {
  if (!(x > -700)) return 0;
  if (x > 700) return Infinity;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let term = 1;
  let sum = 1;
  for (let n = 1; n < 22; n++) {
    term = (term * r) / n;
    sum += term;
  }
  for (let i = 0; i < k; i++) sum *= 2;
  for (let i = 0; i > k; i--) sum /= 2;
  return sum;
}

/** Natural logarithm of x > 0 with + - x / only. */
export function detLog(x) {
  if (!(x > 0)) return -Infinity;
  let e = 0;
  while (x >= 2) { x /= 2; e++; }
  while (x < 1) { x *= 2; e--; }
  if (x > SQRT2) { x /= 2; e++; }
  const s = (x - 1) / (x + 1);
  const s2 = s * s;
  let term = s;
  let sum = 0;
  for (let n = 1; n < 60; n += 2) {
    sum += term / n;
    term *= s2;
  }
  return e * LN2 + 2 * sum;
}

/** A small, fast random-number generator (sfc32) on 32-bit whole numbers, the same everywhere. */
function rng(bytes) {
  const w = (i) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
  let a = w(0), b = w(4), c = w(8), d = w(12);
  const next = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 16; i++) next();
  /** A number in (0, 1), never exactly 0 or 1. */
  const uniform = () => ((next() >>> 5) * 67108864 + (next() >>> 6) + 0.5) / 9007199254740992;
  /** A standard normal draw: the sum of 12 uniforms minus 6. */
  const normal = () => {
    let s = -6;
    for (let i = 0; i < 12; i++) s += uniform();
    return s;
  };
  return { uniform, normal };
}

/** The log-centre of the size lognormal that gives the wanted average once cut to [minSol, maxSol]. */
export function sizeCentre(params) {
  const { meanSol, minSol, maxSol, sizeSpread: sd } = params;
  const lo = detLog(minSol);
  const hi = detLog(maxSol);
  const cutMean = (mu) => {
    const a = (lo - mu) / sd;
    const b = (hi - mu) / sd;
    const n = 2000;
    const h = (b - a) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i <= n; i++) {
      const z = a + i * h;
      const w = (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * detExp((-z * z) / 2);
      num += w * detExp(mu + sd * z);
      den += w;
    }
    return num / den;
  };
  let a = lo - 3 * sd;
  let b = hi;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (cutMean(m) < meanSol) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/**
 * Simulate `steps` seconds of trading for a seed. Returns { prices, seconds }: steps + 1 prices
 * (SOL per coin x 10^18, one per second, the first is START_PRICE_E18) and, for each second, the
 * trades in it: { trades, buySol, sellSol, minSol, maxSol, high, low } (high and low relative to
 * the start, 1 = start).
 */
export async function simulateTrades(seedHex, steps, params = CHART_PARAMS) {
  const seed = hexToBytes(seedHex);
  const label = encoder.encode(':trades');
  const buf = new Uint8Array(seed.length + label.length);
  buf.set(seed);
  buf.set(label, seed.length);
  const r = rng(new Uint8Array(await subtle().digest('SHA-256', buf)));
  const P = params;
  const mu = sizeCentre(P);
  const regimeNames = Object.keys(P.regimes);
  const totalWeight = regimeNames.reduce((s, k) => s + P.regimes[k].weight, 0);
  const pickRegime = () => {
    let u = r.uniform() * totalWeight;
    for (const k of regimeNames) if ((u -= P.regimes[k].weight) < 0) return k;
    return regimeNames[regimeNames.length - 1];
  };
  const size = (boost) => {
    for (let i = 0; i < 50; i++) {
      const s = detExp(mu + P.sizeSpread * r.normal()) * boost;
      if (s >= P.minSol && s <= P.maxSol) return s;
    }
    return P.meanSol;
  };

  let R = (P.marketCapUsd / P.solUsd) * P.liquidityRatio; // pool SOL reserve
  let rel = 1; // price relative to the start
  let regime = 'chop';
  let drift = 0;
  let burst = 0;
  let lastMovePct = 0;
  const closes = [1];
  const prices = [START_PRICE_E18];
  const seconds = [];
  for (let s = 0; s < steps; s++) {
    const g = P.regimes[regime];
    if (r.uniform() < 1 / g.meanSecs) regime = pickRegime();
    const mood = P.regimes[regime];
    drift = drift * P.rateDriftKeep + P.rateDriftStep * r.normal();
    let rate = P.baseRate * detExp(drift) * mood.rateBoost + burst;
    rate = Math.min(P.maxRate, Math.max(P.minRate, rate));
    const back = closes[Math.max(0, closes.length - 1 - P.momentumSecs)];
    const momentum = Math.min(P.maxMomentum, Math.max(-P.maxMomentum, P.momentumGain * (rel / back - 1)));
    const buyShare = Math.min(P.maxBuyShare, Math.max(P.minBuyShare, mood.buyShare + momentum - P.anchorGain * detLog(rel)));

    // Trade arrival times in this second: gaps of -ln(u) / rate, at least minTradesPerSecond trades.
    let n = 0;
    for (let t = -detLog(r.uniform()) / rate; t < 1; t += -detLog(r.uniform()) / rate) n++;
    n = Math.max(n, P.minTradesPerSecond);
    const open = rel;
    const sec = { trades: n, buySol: 0, sellSol: 0, minSol: Infinity, maxSol: 0, high: rel, low: rel };
    let big = 0;
    for (let k = 0; k < n; k++) {
      const buy = r.uniform() < buyShare;
      const d = size(buy ? mood.buySizeBoost : mood.sellSizeBoost);
      const R2 = buy ? R + d : Math.max(R / 2, R - d);
      const f = R2 / R;
      rel *= f * f;
      R = R2;
      if (buy) sec.buySol += d;
      else sec.sellSol += d;
      if (d < sec.minSol) sec.minSol = d;
      if (d > sec.maxSol) sec.maxSol = d;
      if (d > 1) big += d - 1;
      if (rel > sec.high) sec.high = rel;
      if (rel < sec.low) sec.low = rel;
    }
    lastMovePct = (rel / open - 1) * 100;
    burst = burst * P.burstKeep + P.burstPerPercentMove * (lastMovePct < 0 ? -lastMovePct : lastMovePct) + P.burstPerBigTradeSol * big;
    closes.push(rel);
    let p = BigInt(Math.round(Number(START_PRICE_E18) * rel));
    if (p < 1n) p = 1n;
    prices.push(p);
    seconds.push(sec);
  }
  return { prices, seconds };
}

/** The whole chart for a seed: { model: 'trades', prices, seconds }, steps + 1 prices, one per second. */
export async function generateChart(seedHex, _pool, steps, params = CHART_PARAMS) {
  const { prices, seconds } = await simulateTrades(seedHex, steps, params);
  return { model: 'trades', prices, seconds };
}

/**
 * Stats of a simulated chart, for the sample page and the tests: trades, average / smallest /
 * biggest trade size, share of seconds with no trade, the longest run of seconds with the same price.
 */
export function chartStats({ prices, seconds }) {
  let trades = 0, volume = 0, buy = 0, sell = 0, empty = 0, min = Infinity, max = 0;
  for (const s of seconds) {
    trades += s.trades;
    buy += s.buySol;
    sell += s.sellSol;
    if (s.trades === 0) empty++;
    if (s.trades && s.minSol < min) min = s.minSol;
    if (s.maxSol > max) max = s.maxSol;
  }
  volume = buy + sell;
  let longestFlat = 1;
  let run = 1;
  for (let i = 1; i < prices.length; i++) {
    run = prices[i] === prices[i - 1] ? run + 1 : 1;
    if (run > longestFlat) longestFlat = run;
  }
  return {
    seconds: seconds.length,
    trades,
    tradesPerSecond: trades / seconds.length,
    meanSol: volume / trades,
    minSol: min,
    maxSol: max,
    buySol: buy,
    sellSol: sell,
    emptyShare: empty / seconds.length,
    longestFlatSecs: longestFlat,
  };
}
