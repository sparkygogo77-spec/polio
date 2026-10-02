// The match screen's chart overlay and duel view, computed only from what the server sent (the page
// does no trading arithmetic of its own): candle and marker colours, trade markers, the duel circles,
// the countdown, time left and trades left. Pure functions, so they are tested in Node and used
// unchanged by the page.

import { TOKENS } from './tokens.js';

/** Candles: green when the price rose over the candle, red when it fell (owner decision). */
export const CANDLE_COLORS = { up: TOKENS['--pons-candle-up'], down: TOKENS['--pons-candle-down'] };

/** Whose it is: you in blue, the opponent in yellow (picture rings and duel circles; owner decision). */
export const PLAYER_COLORS = { me: TOKENS['--pons-ring-me'], opponent: TOKENS['--pons-ring-opponent'] };

/** Trade markers: buys green, sells red (owner decision); whose trade it is shows in the picture's ring. */
export const TRADE_COLORS = { buy: TOKENS['--pons-buy'], sell: TOKENS['--pons-sell'] };

/** Colours for gains, losses and the lead: green ahead, red behind, grey level. */
export const LEAD_COLORS = { winning: TOKENS['--pons-gain'], losing: TOKENS['--pons-loss'], level: TOKENS['--pons-level'] };

/** How much the duel circles exaggerate profit and loss (radius = base x (1 + this x profit-or-loss)). */
export const DUEL_EXAGGERATION = 10;

/**
 * The page's settings from CSS variables (web/base.css sets them; a designer may change them in the
 * style layer; web/HOOKS.md lists them), falling back to the defaults above. `read(name)` returns a
 * variable's value or '' (the page passes its cssVar, getComputedStyle on the root element).
 */
const reader = (read) => (name, fallback) => (String(read(name) ?? '').trim() || fallback);

/** Candle colours, read when the chart is made and at each round start. */
export function candleColorsFrom(read = () => '') {
  const v = reader(read);
  return { up: v('--pons-candle-up', CANDLE_COLORS.up), down: v('--pons-candle-down', CANDLE_COLORS.down) };
}

/** Trade arrow colours on the chart: buys and sells. */
export function tradeColorsFrom(read = () => '') {
  const v = reader(read);
  return { buy: v('--pons-buy', TRADE_COLORS.buy), sell: v('--pons-sell', TRADE_COLORS.sell) };
}

/** Whose picture ring: you and the opponent (the page styles the rings in CSS; kept for scripts). */
export function ringColorsFrom(read = () => '') {
  const v = reader(read);
  return { me: v('--pons-ring-me', PLAYER_COLORS.me), opponent: v('--pons-ring-opponent', PLAYER_COLORS.opponent) };
}

/** The duel circles: exaggeration and radii (in units of the 200 x 200 duel picture). */
export function duelSettingsFrom(read = () => '') {
  const v = reader(read);
  const num = (name, fallback, ok) => {
    const n = Number(v(name, String(fallback)));
    return Number.isFinite(n) && ok(n) ? n : fallback;
  };
  const minRadius = num('--pons-duel-min-radius', 10, (n) => n >= 0 && n <= 100);
  const maxRadius = num('--pons-duel-max-radius', 96, (n) => n >= minRadius && n <= 100);
  return {
    exaggeration: num('--pons-duel-exaggeration', DUEL_EXAGGERATION, (n) => n >= 0),
    base: num('--pons-duel-base-radius', 50, (n) => n >= minRadius && n <= maxRadius),
    minRadius,
    maxRadius,
  };
}

/**
 * The match chart's own look (background, text, grid and scale borders) as chart options. A
 * variable left empty keeps the chart library's default for that part.
 */
export function chartLayoutFrom(read = () => '') {
  const v = reader(read);
  const background = v('--pons-chart-background', '');
  const text = v('--pons-chart-text', '');
  const font = v('--pons-chart-font', '');
  const grid = v('--pons-chart-grid', '');
  const border = v('--pons-chart-border', '');
  const opts = { layout: {}, grid: {}, rightPriceScale: {}, timeScale: {} };
  if (background) opts.layout.background = { type: 'solid', color: background };
  if (text) opts.layout.textColor = text;
  if (font) opts.layout.fontFamily = font;
  if (grid) opts.grid = { vertLines: { color: grid }, horzLines: { color: grid } };
  if (border) {
    opts.rightPriceScale.borderColor = border;
    opts.timeScale.borderColor = border;
  }
  return opts;
}

/** Everything above in one object (colours, ring colours and the duel exaggeration). */
export function themeFrom(read = () => '') {
  return {
    candle: candleColorsFrom(read),
    trade: tradeColorsFrom(read),
    ring: ringColorsFrom(read),
    exaggeration: duelSettingsFrom(read).exaggeration,
  };
}

/** Server candles (times in milliseconds, index values as decimal text) to chart bars (times in seconds). */
export function toChartBar(b) {
  return { time: Math.floor(b.t / 1000), open: Number(b.o), high: Number(b.h), low: Number(b.l), close: Number(b.c) };
}

/**
 * The chart both players start with: the short history (one-minute bars) followed by the live
 * candles. History bars at or after the first live candle are dropped so times keep rising.
 */
export function startBars(history, liveBars, origin) {
  const hist = (history ?? [])
    .filter((c) => c.t < origin)
    .map((c) => ({ time: Math.floor(c.t / 1000), open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c) }));
  const out = [];
  for (const b of [...hist, ...(liveBars ?? []).map(toChartBar)]) {
    if (out.length && b.time <= out[out.length - 1].time) continue;
    out.push(b);
  }
  return out;
}

/**
 * One marker per filled trade (both players' trades, as the server sent them), at the candle it
 * filled in: buys below the candle, sells above. Your trades are blue, the opponent's yellow.
 */
export function tradeMarkers(trades, mySeat, colors = TRADE_COLORS) {
  return (trades ?? [])
    .filter((t) => t.barTime !== undefined && t.barTime !== null)
    .sort((a, b) => a.barTime - b.barTime || a.orderId - b.orderId)
    .map((t) => {
      const mine = t.seat === mySeat;
      return {
        time: Math.floor(t.barTime / 1000),
        position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
        shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
        color: t.side === 'buy' ? colors.buy : colors.sell,
        // No text on the chart canvas, where a nearby candle could cover it: each marker's label is
        // drawn with its player's picture, in the layer above the chart (markerLabel).
        text: '',
        id: `trade-${t.seat}-${t.orderId}`,
      };
    });
}

/** A trade marker's label, shown next to the player's picture above the chart: "You buy", "Opponent sell". */
export function markerLabel(t, mySeat) {
  return `${t.seat === mySeat ? 'You' : 'Opponent'} ${t.side === 'buy' ? 'buy' : 'sell'}`;
}

/** Percentage points with a sign and two decimals: "+0.10", "−0.50" (true minus sign) or "0.00". */
export function formatPoints(points) {
  const r = Math.round(points * 100) / 100;
  if (r === 0) return '0.00';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}`;
}

/** A percentage with a sign and two decimals: "+1.45%", "−0.30%" (true minus sign) or "0.00%". */
export function formatSignedPercent(p) {
  const r = Math.round(p * 100) / 100;
  if (r === 0) return '0.00%';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}%`;
}

/**
 * The duel view (owner decision): two circles with the same centre, the same size at the start. Each
 * circle's radius follows its player's profit or loss, exaggerated so a small move is easy to see:
 * radius = base x (1 + exaggeration x profit-or-loss as a fraction), kept between minRadius and
 * maxRadius. The bigger circle is drawn behind, so it visibly swallows the smaller one.
 * Labels: "You +1.45%", "Them +2.93%", and the lead: "Ahead by 1.48 points", "Behind by 1.48 points"
 * or "Level". Input: the server's live scores in parts per million (score = value / budget - 1).
 */
export function duelView(scoresPpm, seat, { base = 50, exaggeration = DUEL_EXAGGERATION, minRadius = 10, maxRadius = 96 } = {}) {
  const other = seat === 'A' ? 'B' : 'A';
  const ppm = (s) => (scoresPpm && scoresPpm[s] !== undefined && scoresPpm[s] !== null ? Number(scoresPpm[s]) : 0);
  const radius = (pnl) => Math.min(maxRadius, Math.max(minRadius, base * (1 + exaggeration * pnl)));
  const mePnl = ppm(seat) / 1e6;
  const oppPnl = ppm(other) / 1e6;
  const points = (ppm(seat) - ppm(other)) / 1e4;
  const lead = Math.round(Math.abs(points) * 100) / 100;
  const state = lead === 0 ? 'level' : points > 0 ? 'winning' : 'losing';
  const sign = (pnl) => (Math.round(pnl * 1e4) === 0 ? 'flat' : pnl > 0 ? 'gain' : 'loss');
  const me = { pnl: mePnl, r: radius(mePnl), label: `You ${formatSignedPercent(mePnl * 100)}`, sign: sign(mePnl) };
  const opponent = { pnl: oppPnl, r: radius(oppPnl), label: `Them ${formatSignedPercent(oppPnl * 100)}`, sign: sign(oppPnl) };
  return {
    me,
    opponent,
    // Draw the bigger circle first (behind), so the smaller one stays visible inside it.
    drawOrder: me.r > opponent.r || (me.r === opponent.r && mePnl >= oppPnl) ? ['me', 'opponent'] : ['opponent', 'me'],
    points,
    leadText: state === 'level' ? 'Level' : `${state === 'winning' ? 'Ahead' : 'Behind'} by ${lead.toFixed(2)} point${lead === 1 ? '' : 's'}`,
    // Kept for the animation hooks: the lead in points with a sign.
    text: formatPoints(points),
    state,
    color: LEAD_COLORS[state],
  };
}

export function formatPercent(p) {
  if (p === null || p === undefined) return '-';
  const n = Number(p);
  return `${n > 0 ? '+' : ''}${p}%`;
}

export function formatTimeLeft(ms) {
  const left = Math.max(0, ms);
  return `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`;
}

/** Phase of the round at `now`: the countdown before trading, trading, or over. */
export function roundPhase({ startAt, endAt, now }) {
  if (startAt === undefined || startAt === null) return 'waiting';
  if (now < startAt) return 'countdown';
  if (endAt !== undefined && endAt !== null && now >= endAt) return 'ended';
  return 'trading';
}

/** "Trading starts in 5" during the countdown (whole seconds, rounded up), else null. */
export function countdownText({ startAt, now }) {
  if (startAt === undefined || startAt === null || now >= startAt) return null;
  return `Trading starts in ${Math.ceil((startAt - now) / 1000)}`;
}

/** The text in the overlay boxes. */
export function overlayText({ scores, seat, tradesUsed, maxTrades, startAt, endAt, now }) {
  const other = seat === 'A' ? 'B' : 'A';
  const phase = roundPhase({ startAt, endAt, now });
  return {
    mine: formatPercent(scores?.[seat]),
    opponent: formatPercent(scores?.[other]),
    tradesLeft: String(Math.max(0, (maxTrades ?? 0) - (tradesUsed ?? 0))),
    // Before trading opens the timer shows the full trading time.
    timeLeft: formatTimeLeft(phase === 'countdown' ? (endAt ?? now) - startAt : (endAt ?? now) - now),
    phase,
  };
}

/** Lamports (as text) to SOL text with up to 9 decimals; signed when asked. */
export function solText(lamports, signed = false) {
  if (lamports === null || lamports === undefined) return '-';
  const v = BigInt(lamports);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const frac = (abs % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  const body = `${abs / 1_000_000_000n}${frac ? '.' + frac : ''}`;
  return `${neg ? '−' : signed && v > 0n ? '+' : ''}${body}`;
}

/** Your own position, as the server worked it out: size (value of coins held), cash, value, profit or loss. */
export function positionText(p) {
  if (!p) return { size: '-', cash: '-', value: '-', pnl: '-', pnlPercent: '-' };
  return {
    size: p.positionValue === null || p.positionValue === undefined ? '-' : solText(p.positionValue),
    cash: solText(p.cash),
    value: solText(p.value),
    pnl: solText(p.pnl, true),
    pnlPercent: formatPercent(p.pnlPercent),
  };
}
