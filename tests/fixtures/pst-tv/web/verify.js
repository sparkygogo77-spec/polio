// Verify a published PonsStars match in the browser (or in Node), with no help from the server:
// - the record's SHA-256 hash and the server's signature over it (the "attestation");
// - each round's 173-byte result message (rebuilt from the record) and the server's signature;
// - every price tick's robust median, every order fill, every score, and the final payout.
// Plain JavaScript, Web Crypto only. Kept in step with server/src/verify.ts by a server test.

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const PRICE_SCALE = 10n ** 18n;
const enc = new TextEncoder();

import { verifyGeneratedRound } from './generated-chart.js';

export function base58Decode(text) {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;
  let n = 0n;
  for (const ch of text) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error('not base58');
    n = n * 58n + BigInt(i);
  }
  const body = [];
  while (n > 0n) {
    body.unshift(Number(n % 256n));
    n /= 256n;
  }
  return Uint8Array.from([...new Array(zeros).fill(0), ...body]);
}

const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => Uint8Array.from((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const u64 = (v) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
  return b;
};
const u16 = (v) => Uint8Array.from([v & 0xff, (v >> 8) & 0xff]);
const pubkey = (s) => {
  const b = base58Decode(s);
  if (b.length !== 32) throw new Error('address must be 32 bytes');
  return b;
};
const big = (v) => BigInt(v);
const bigOrNull = (v) => (v === null || v === undefined ? null : BigInt(v));

/** JSON with keys sorted at every level, no spaces, bigints as strings (same as the server). */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return JSON.stringify(value.toString());
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number');
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

export async function sha256Hex(text) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}

export async function verifySignature(publicKeyBase58, message, signatureBase58) {
  try {
    const key = await crypto.subtle.importKey('raw', pubkey(publicKeyBase58), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, base58Decode(signatureBase58), message);
  } catch {
    return false;
  }
}

/** PS2's 173-byte result message (docs/INTERFACES.md). */
export function resultMessage(f) {
  return concat(
    enc.encode('PONSSTARS_ESCROW_RESULT_V1'),
    pubkey(f.programId),
    pubkey(f.matchAccount),
    u64(f.matchId),
    u16(f.round),
    pubkey(f.playerA),
    pubkey(f.playerB),
    u64(f.stake),
    Uint8Array.from([f.outcome]),
  );
}

/** The 115-byte record attestation message. */
export function attestationMessage(programId, matchAccount, recordHashHex) {
  return concat(enc.encode('PONSSTARS_RECORD_V1'), pubkey(programId), pubkey(matchAccount), fromHex(recordHashHex));
}

// ---------- price median (same as server/src/prices/median.ts) ----------

function medianBig(values) {
  const s = [...values].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2n;
}

/** Robust median and the readings it was made from ({ price, used }); price is null when there is none. */
export function aggregateUsed(quotes, now, opts) {
  const fresh = quotes.filter((q) => !(now - q.observedAt > opts.maxAgeMs || q.priceE18 <= 0n));
  if (fresh.length < opts.minSources) return { price: null, used: [] };
  const first = medianBig(fresh.map((q) => q.priceE18));
  const used = fresh.filter((q) => {
    const diff = q.priceE18 > first ? q.priceE18 - first : first - q.priceE18;
    return !(diff * 10_000n > first * BigInt(opts.maxDeviationBps));
  });
  if (used.length < opts.minSources) return { price: null, used: [] };
  return { price: medianBig(used.map((q) => q.priceE18)), used };
}

export function aggregate(quotes, now, opts) {
  return aggregateUsed(quotes, now, opts).price;
}

const quotesOf = (t) => t.sources.map((s) => ({ source: s[0], priceE18: BigInt(s[1]), observedAt: s[2] }));

// ---------- scoring and order replay (same as server/src/scoring.ts and match/round.ts) ----------

function applyFill(p, side, percent, price) {
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return { ok: false, reason: 'percent must be a whole number from 1 to 100' };
  if (price <= 0n) return { ok: false, reason: 'no price' };
  const pct = BigInt(percent);
  if (side === 'buy') {
    const lamports = (p.cash * pct) / 100n;
    const atoms = (lamports * PRICE_SCALE) / price;
    if (lamports === 0n || atoms === 0n) return { ok: false, reason: 'no cash left to buy with' };
    return { ok: true, lamports, atoms, after: { cash: p.cash - lamports, atoms: p.atoms + atoms } };
  }
  const atoms = (p.atoms * pct) / 100n;
  if (atoms === 0n) return { ok: false, reason: 'no coins to sell' };
  const lamports = (atoms * price) / PRICE_SCALE;
  return { ok: true, lamports, atoms, after: { cash: p.cash + lamports, atoms: p.atoms - atoms } };
}

const valueAt = (p, price) => p.cash + (p.atoms * price) / PRICE_SCALE;
const scorePpm = (final, budget) => ((final - budget) * 1_000_000n) / budget;

export function formatScorePercent(ppm) {
  const neg = ppm < 0n;
  const abs = neg ? -ppm : ppm;
  return `${neg ? '-' : ''}${abs / 10_000n}.${(abs % 10_000n).toString().padStart(4, '0')}`;
}

function decideRound(a, b) {
  if (a.filledTrades === 0 && b.filledTrades === 0) return { kind: 'both_no_trades' };
  if (a.filledTrades === 0) return { kind: 'win', winner: 'B', reason: 'opponent_no_trades' };
  if (b.filledTrades === 0) return { kind: 'win', winner: 'A', reason: 'opponent_no_trades' };
  if (a.finalValue === b.finalValue) return { kind: 'tie' };
  return { kind: 'win', winner: a.finalValue > b.finalValue ? 'A' : 'B', reason: 'higher_score' };
}

/** The owner's limit: an instant fill never uses a price reading older than this (milliseconds). */
export const FILL_MAX_AGE_MS = 1000;

/**
 * Replay one round from its orders and ticks. Returns the replayed orders and outcome.
 * Record format v4 rule (owner decision, instant fills): an order fills the moment it arrives at
 * the latest tick, if that tick is fresh and at most fillMaxAgeMs older than the order; otherwise
 * it fills at the next fresh tick within fillMaxAgeMs of its arrival, or expires unfilled.
 */
export function replayRound(r) {
  const budget = big(r.budget) > 0n ? big(r.budget) : 1n; // a bad budget is reported by verifyMatch
  const maxAge = r.fillMaxAgeMs;
  const port = { A: { cash: budget, atoms: 0n }, B: { cash: budget, atoms: 0n } };
  const orders = [];
  const ticks = [];
  const used = (seat) => orders.filter((o) => o.seat === seat && (o.status === 'filled' || o.status === 'pending')).length;
  const fill = (o, t) => {
    const f = applyFill(port[o.seat], o.side, o.percent, t.price);
    o.fillTick = t.i;
    if (!f.ok) o.status = 'failed';
    else {
      o.status = 'filled';
      o.lamports = f.lamports;
      o.atoms = f.atoms;
      port[o.seat] = f.after;
    }
  };
  const submit = (o) => {
    const e = { id: o.id, seat: o.seat, side: o.side, percent: o.percent, receivedAt: o.receivedAt, status: 'pending' };
    const refuse = () => ((e.status = 'refused'), orders.push(e));
    if ((o.side !== 'buy' && o.side !== 'sell') || !Number.isInteger(o.percent) || o.percent < 1 || o.percent > 100) return refuse();
    if (o.receivedAt < r.startAt || o.receivedAt >= r.endAt) return refuse();
    if (used(o.seat) >= r.maxTrades) return refuse();
    orders.push(e);
    const last = ticks[ticks.length - 1];
    if (last && last.price !== null && e.receivedAt >= last.t && e.receivedAt - last.t <= maxAge) fill(e, last);
  };
  const recOrders = [...r.orders].sort((x, y) => x.id - y.id);
  const submitAfter = (k) => recOrders.filter((o) => o.afterTick === k).forEach(submit);
  for (const rt of r.ticks) {
    submitAfter(rt.i - 1);
    const t = { i: rt.i, t: rt.t, price: bigOrNull(rt.priceE18) };
    ticks.push(t);
    for (const o of orders) {
      if (o.status !== 'pending' || o.receivedAt > t.t) continue;
      if (t.t - o.receivedAt > maxAge) o.status = 'expired';
      else if (t.price !== null) fill(o, t);
    }
  }
  submitAfter(r.ticks.length - 1);
  for (const o of orders) if (o.status === 'pending') o.status = 'expired';
  const closing = [...ticks].reverse().find((t) => t.price !== null);
  if (!closing) return { orders, outcome: null };
  const side = (seat) => {
    const finalValue = valueAt(port[seat], closing.price);
    return {
      filledTrades: orders.filter((o) => o.seat === seat && o.status === 'filled').length,
      closingPortfolio: { ...port[seat] },
      finalValue,
      scorePpm: scorePpm(finalValue, budget),
    };
  };
  const A = side('A');
  const B = side('B');
  return { orders, outcome: { closingTick: closing.i, closingPriceE18: closing.price, A, B, decision: decideRound(A, B) } };
}

const outcomeCode = (d) => (d.kind === 'win' ? (d.winner === 'A' ? 1 : 2) : d.kind === 'both_no_trades' ? 3 : 4);

function finalFromRounds(outcomes, voidReason) {
  const last = outcomes[outcomes.length - 1];
  if (voidReason || !last) return { kind: 'void', winner: null, reason: 'void' };
  const d = last.decision;
  if (d.kind === 'win') return { kind: 'win', winner: d.winner, reason: d.reason };
  if (d.kind === 'both_no_trades') return { kind: 'refund_minus_cut', winner: null, reason: 'both_no_trades' };
  return { kind: 'refund_minus_cut', winner: null, reason: 'tie_rematch_declined' };
}

/** PS2's payout arithmetic (contracts/client/escrow-client.ts expectedPayout). */
export function contractPayout(stake, f) {
  const pot = stake * 2n;
  const keep = 10_000n - 250n;
  if (f.kind === 'win') {
    const w = (pot * keep) / 10_000n;
    return f.winner === 'A' ? { toA: w, toB: 0n, toTreasury: pot - w } : { toA: 0n, toB: w, toTreasury: pot - w };
  }
  if (f.kind === 'refund_minus_cut') {
    const each = (stake * keep) / 10_000n;
    return { toA: each, toB: each, toTreasury: pot - 2n * each };
  }
  return { toA: stake, toB: stake, toTreasury: 0n };
}

/**
 * Check a published match. Returns { ok, problems, checks, kind, winner }.
 * `checks` lists each thing that was checked and whether it passed, for display.
 * `opts.fetchPool(poolId)` returns the move pool a generated chart was stitched from (or null).
 */
export async function verifyMatch(pub, expectedKey, opts = {}) {
  const problems = [];
  const checks = [];
  const check = (label, pass) => {
    checks.push({ label, pass });
    if (!pass) problems.push(label);
  };
  const rec = pub.record;
  check('record format is ponsstars-match-v4', rec?.format === 'ponsstars-match-v4');
  const key = expectedKey ?? rec.resultKey;
  if (expectedKey) check('record names the expected result key', rec.resultKey === expectedKey);

  const hash = await sha256Hex(canonicalJson(rec));
  check('record hash matches', hash === pub.attestation?.recordHash);
  const att = attestationMessage(rec.programId, rec.matchAccount, hash);
  check('attestation message matches', hex(att) === pub.attestation?.messageHex);
  check('server signature over the record is valid', await verifySignature(key, att, pub.attestation?.signature ?? '1'));

  const stake = big(rec.stake);
  const outcomes = [];
  for (let idx = 0; idx < rec.rounds.length; idx++) {
    const r = rec.rounds[idx];
    const name = `round ${r.chainRound}`;
    let mediansOk = true;
    for (const t of r.ticks) {
      const quotes = t.sources.map((s) => ({ source: s[0], priceE18: big(s[1]), observedAt: s[2] }));
      if (aggregate(quotes, t.t, rec.aggregation) !== bigOrNull(t.priceE18)) mediansOk = false;
    }
    check(`${name}: every price is the robust median of its sources`, mediansOk);
    if (r.coin?.generated) {
      // A generated practice chart: regenerate it from the revealed seed and compare every price.
      const g = r.coin.generated;
      const pool = !g.poolId || !opts.fetchPool ? null : await opts.fetchPool(g.poolId).catch(() => null);
      const v = await verifyGeneratedRound(r, pool);
      check(`${name}: generated chart: the revealed seed matches the hash shown at the start`, v.seedMatches);
      if (g.poolId) check(`${name}: generated chart: the move pool is the one named at the start (${String(g.poolId).slice(0, 12)}...)`, v.poolMatches);
      check(`${name}: generated chart: regenerated from the seed, all ${v.compared} prices match`, v.pricesMatch);
    }
    check(
      `${name}: the scored budget is positive and the same in every round`,
      bigOrNull(r.budget) !== null && big(r.budget) > 0n && big(r.budget) === big(rec.rounds[0].budget),
    );
    check(
      `${name}: fills never use a price reading older than ${FILL_MAX_AGE_MS} ms`,
      Number.isInteger(r.fillMaxAgeMs) && r.fillMaxAgeMs > 0 && r.fillMaxAgeMs <= FILL_MAX_AGE_MS,
    );
    check(`${name}: chart, start and end times are in order`, r.chartAt <= r.startAt && r.startAt < r.endAt);
    check(
      `${name}: the index shown to players started at 100 (the first price)`,
      bigOrNull(r.indexBase) !== null && big(r.indexBase) > 0n && (bigOrNull(r.ticks[0]?.priceE18) === null || big(r.ticks[0].priceE18) === big(r.indexBase)),
    );
    const { orders, outcome } = replayRound(r);
    const recOrders = [...r.orders].sort((x, y) => x.id - y.id);
    const ordersOk =
      orders.length === recOrders.length &&
      orders.every((o, k) => {
        const p = recOrders[k];
        return p.status === o.status && (p.fillTick ?? null) === (o.fillTick ?? null) && bigOrNull(p.lamports) === (o.lamports ?? null) && bigOrNull(p.atoms) === (o.atoms ?? null);
      });
    check(`${name}: every order fills exactly as recorded`, ordersOk);
    check(`${name}: scores and decision match on replay`, canonicalJson(outcome) === canonicalJson(r.outcome));
    outcomes.push(outcome);
    if (r.result && outcome) {
      const code = outcomeCode(outcome.decision);
      const msg = resultMessage({
        programId: rec.programId,
        matchAccount: rec.matchAccount,
        matchId: big(rec.matchId),
        round: r.chainRound,
        playerA: rec.players.A,
        playerB: rec.players.B,
        stake,
        outcome: code,
      });
      check(`${name}: signed outcome ${r.result.outcome} matches the replay`, r.result.outcome === code);
      check(`${name}: signed 173-byte result matches the record`, hex(msg) === r.result.messageHex);
      check(`${name}: server signature over the result is valid`, await verifySignature(key, msg, r.result.signature));
    } else if (!rec.voidReason) {
      check(`${name}: has a signed result`, false);
    }
    if (idx < rec.rounds.length - 1) {
      check(`${name}: tie with both players accepting the rematch`, outcome?.decision.kind === 'tie' && r.rematch?.A === true && r.rematch?.B === true);
    }
  }
  if (rec.voidResult) {
    const v = rec.voidResult;
    const msg = resultMessage({
      programId: rec.programId,
      matchAccount: rec.matchAccount,
      matchId: big(rec.matchId),
      round: v.round,
      playerA: rec.players.A,
      playerB: rec.players.B,
      stake,
      outcome: 5,
    });
    check('signed void result (full refund) is for a void match, outcome 5', !!rec.voidReason && v.outcome === 5);
    check('no round has two signed results', !rec.rounds.some((r) => r.result && r.chainRound === v.round));
    check('signed void result matches the record', hex(msg) === v.messageHex);
    check('server signature over the void result is valid', await verifySignature(key, msg, v.signature));
  }
  const f = finalFromRounds(outcomes, rec.voidReason);
  const pay = contractPayout(stake, f);
  check('final outcome matches the replay', f.kind === rec.final.kind && f.winner === rec.final.winner);
  check(
    'payout matches the contract arithmetic',
    big(rec.final.payout.toA) === pay.toA && big(rec.final.payout.toB) === pay.toB && big(rec.final.payout.toTreasury) === pay.toTreasury,
  );
  return { ok: problems.length === 0, problems, checks, kind: f.kind, winner: f.winner ? rec.players[f.winner] : null };
}
