// Player pictures (owner decision): each player's trades on the chart show their picture in a ring,
// blue for you and yellow for the opponent. The picture is the player's uploaded profile picture,
// else the preset avatar they picked, else an avatar generated from their wallet address; the
// practice bot gets a bot icon. All avatars here are small SVG drawings made in the page (no
// downloads). Plain functions (a server test imports this file).

import { TOKENS } from './tokens.js';

/** Preset avatars a player can pick on their profile (the server accepts exactly these ids). */
export const AVATAR_PRESETS = ['sun', 'moon', 'star', 'bolt', 'leaf', 'wave', 'gem', 'rocket'];

const T = (name) => TOKENS[`--pons-avatar-${name}`];
const ART = T('art');

/** Each preset: its background and its drawing (colours from web/tokens.css, via web/tokens.js). */
const PRESET_ART = {
  sun: [T('sun'), `<circle cx="32" cy="32" r="12" fill="${ART}"/><g stroke="${ART}" stroke-width="4" stroke-linecap="round"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M15 49l6-6M43 21l6-6"/></g>`],
  moon: [T('moon'), `<path d="M40 14a18 18 0 1 0 10 28A15 15 0 0 1 40 14z" fill="${ART}"/>`],
  star: [T('star'), `<path d="M32 10l6.5 14 15 1.5-11.3 10 3.3 15L32 43l-13.5 7.5 3.3-15-11.3-10 15-1.5z" fill="${ART}"/>`],
  bolt: [T('bolt'), `<path d="M36 8L18 36h12l-4 20 20-30H34z" fill="${ART}"/>`],
  leaf: [T('leaf'), `<path d="M14 48C14 24 30 12 52 12c0 24-14 38-36 38z" fill="${ART}"/><path d="M18 46L42 22" stroke="${T('leaf')}" stroke-width="3"/>`],
  wave: [T('wave'), `<path d="M8 38c8-10 16-10 24 0s16 10 24 0" stroke="${ART}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M8 26c8-10 16-10 24 0s16 10 24 0" stroke="${ART}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>`],
  gem: [T('gem'), `<path d="M20 14h24l10 12-22 26-22-26z" fill="${ART}"/><path d="M10 26h44M32 52L24 26l8-12 8 12z" stroke="${T('gem')}" stroke-width="2" fill="none"/>`],
  rocket: [T('rocket'), `<path d="M32 8c10 8 12 22 8 34H24c-4-12-2-26 8-34z" fill="${ART}"/><circle cx="32" cy="26" r="5" fill="${T('rocket')}"/><path d="M24 42l-8 10 10-4M40 42l8 10-10-4" fill="${ART}"/>`],
};

const svgUrl = (inner, bg) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>${inner}</svg>`)}`;

/** A preset avatar as an image address, or null for an unknown id. */
export function presetAvatar(id) {
  const art = PRESET_ART[id];
  return art ? svgUrl(art[1], art[0]) : null;
}

/** The practice bot's icon: a simple robot head. */
export function botAvatar() {
  const bot = T('bot');
  return svgUrl(
    `<rect x="14" y="18" width="36" height="30" rx="6" fill="${ART}"/><circle cx="25" cy="31" r="4" fill="${bot}"/><circle cx="39" cy="31" r="4" fill="${bot}"/>` +
      `<rect x="24" y="40" width="16" height="3" rx="1.5" fill="${bot}"/><path d="M32 18v-7" stroke="${ART}" stroke-width="3"/><circle cx="32" cy="9" r="3" fill="${ART}"/>`,
    bot,
  );
}

/** A small whole-number hash of text (FNV-1a), for drawing avatars; not for security. */
function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * An avatar generated from a wallet address: a symmetric 5 by 5 pattern in a colour of its own,
 * always the same for the same address.
 */
export function generatedAvatar(address) {
  const text = String(address ?? '');
  const h = hashText(text);
  const hue = h % 360;
  let cells = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if ((hashText(`${text}:${row}:${col}`) & 1) === 0) continue;
      for (const c of col === 2 ? [2] : [col, 4 - col]) cells += `<rect x="${7 + c * 10}" y="${7 + row * 10}" width="10" height="10"/>`;
    }
  }
  return svgUrl(`<g fill="hsl(${hue} ${T('generated-ink')})">${cells}</g>`, `hsl(${hue} ${T('generated-paper')})`);
}

/**
 * The picture for a player: { pictureUrl, avatarPreset, address, bot } as the server sends it.
 * `toServerUrl` turns the server's picture path into a full address (the page may be hosted apart).
 */
export function avatarUrl(a, toServerUrl = (p) => p) {
  if (a?.bot) return botAvatar();
  if (a?.pictureUrl) return toServerUrl(a.pictureUrl);
  return presetAvatar(a?.avatarPreset) ?? generatedAvatar(a?.address);
}

/** Ring colours: you blue, the opponent yellow (as the arrows and the duel circles). */
export const RING = { me: TOKENS['--pons-ring-me'], opponent: TOKENS['--pons-ring-opponent'] };

/**
 * Where each trade's picture goes on the chart: at the trade's candle, past the arrow marker (below
 * the candle's low for a buy, above its high for a sell; several trades on one candle stack further
 * out). `x(timeSecs)` and `y(index)` are the chart's own coordinate functions (null when off screen);
 * `edge(timeSecs, side)` gives the candle's low or high in pixels (without it, the trade's price is
 * used). `bounds` ({ width, height }, the chart's drawing area) keeps every picture inside it: one
 * that would stick out at the top, bottom or a side is moved in. Returns
 * [{ id, seat, mine, side, left, top, labelSide }] in pixels for a picture of `size`; trades off screen
 * are left out. `labelSide` says where the marker's label goes: 'right' of the picture, or 'left'
 * when there is no room for `labelWidth` pixels on the right inside the bounds.
 */
export function pictureMarkers(trades, mySeat, x, y, size = 24, edge = () => null, bounds = null, labelWidth = 90) {
  const out = [];
  const stacked = new Map();
  const sorted = [...(trades ?? [])].sort((a, b) => (a.barTime ?? 0) - (b.barTime ?? 0) || (a.orderId ?? 0) - (b.orderId ?? 0));
  for (const t of sorted) {
    if (t.barTime === undefined || t.barTime === null) continue;
    const time = Math.floor(t.barTime / 1000);
    const px = x(time);
    const py = edge(time, t.side) ?? y(Number(t.index));
    if (px === null || px === undefined || py === null || py === undefined) continue;
    const key = `${time}:${t.side}`;
    const n = stacked.get(key) ?? 0;
    stacked.set(key, n + 1);
    const gap = 30 + n * (size + 2); // room for the arrow and its label, then one picture after another
    const below = t.side === 'buy';
    let left = Math.round(px - size / 2);
    let top = Math.round(below ? py + gap : py - gap - size);
    if (bounds && bounds.width > size && bounds.height > size) {
      left = Math.min(Math.max(0, left), Math.floor(bounds.width - size));
      top = Math.min(Math.max(0, top), Math.floor(bounds.height - size));
    }
    const labelSide = bounds && left + size + 4 + labelWidth > bounds.width ? 'left' : 'right';
    // A marker (picture and label) never covers another: move it further out until it is clear
    // (down for a buy, up for a sell), staying inside the bounds when there are any; when the edge
    // stops it there, move it back in (towards the candle) instead.
    const box = (tp) => ({
      l: labelSide === 'left' ? left - 4 - labelWidth : left,
      r: labelSide === 'left' ? left + size : left + size + 4 + labelWidth,
      t: tp,
      b: tp + size,
    });
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const start = top;
    for (const outward of [true, false]) {
      top = start;
      const step = (below === outward ? 1 : -1) * (size + 2);
      for (let k = 0; k < 20 && out.some((o) => hit(box(top), o.box)); k++) {
        const next = top + step;
        if (bounds && (next < 0 || next > bounds.height - size)) break;
        top = next;
      }
      if (!out.some((o) => hit(box(top), o.box))) break;
    }
    out.push({ id: `pic-${t.seat}-${t.orderId}`, seat: t.seat, mine: t.seat === mySeat, side: t.side, left, top, labelSide, box: box(top) });
  }
  return out.map(({ box: _box, ...p }) => p);
}
