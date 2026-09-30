/**
 * The colours the shelf draws its previews in, and a guarantee that every
 * word on them can be read.
 *
 * HIS REPORT (Lane I, 7): on a pink and yellow site, the Text category's
 * previews were dark boxes with near-invisible dark words. Two causes:
 *
 *   · THE PALETTE WAS DECLARED, NOT PAINTED. A captured site's page colour
 *     is its body's declared background, and its text is the colour the
 *     most parts name. On a site whose body is navy under yellow and peach
 *     sections, the page came out navy and the words near-black: dark on
 *     dark, a pair that never meets on the real page. `paintedPalette` reads
 *     what the page actually paints most, by area: it samples the page and
 *     asks, at each point, which fill is on top; words are weighed by how
 *     many letters wear each colour; accents are the coloured fills and
 *     words that cover the most.
 *   · NOTHING CHECKED THE PAIRS. `readableTheme` holds every pair a preview
 *     draws words with (words, quiet words, accent words on the page and on
 *     its cards, and words on the accent) to at least 4.5 to 1, the Web
 *     Content Accessibility Guidelines (WCAG) floor for body text. When the
 *     site's own pair fails it takes the closest readable pair from the
 *     site's own colours; when none reads, plain light on dark.
 *
 * `paintedPalette` is the same question the Format panel's "This site"
 * asks of a captured page (which colour is behind most of it), so it is
 * written to be shared: one function, pure, off the board's own parts.
 *
 * Pure: no store, no React. `tests/shelf-readable.mjs` renders every card
 * preview on captured sites and fails on any word under 4.5 to 1.
 */
import { contrast, css, parseColor, rgbToOklch, type Oklch } from "./look.ts";

/** WCAG's floor for body text. */
export const READABLE = 4.5;

export interface PaintedPart {
  id: string;
  pageId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  colour?: Partial<Record<string, unknown>> | null;
  content?: unknown;
}

type Roles = { bg: string; surface: string; text: string; muted: string; accent: string; highlight: string };

export interface Painted extends Roles {
  /** Every fill by the share of the page it covers, most first. */
  fills: { colour: string; share: number }[];
  /** Every word colour by the share of the letters it sets, most first. */
  words: { colour: string; share: number }[];
}

/** A colour and whether it paints at all: `transparent` and a zero alpha paint nothing. */
export function opaque(v: unknown): Oklch | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s === "transparent" || s === "none") return null;
  const a = /^rgba\([^)]*,\s*([\d.]+)\s*\)$/i.exec(s) ?? /\/\s*([\d.]+%?)\s*\)$/.exec(s);
  if (a) {
    const alpha = a[1]!.endsWith("%") ? Number(a[1]!.slice(0, -1)) / 100 : Number(a[1]);
    if (alpha < 0.5) return null;
  }
  return parseColor(s);
}

const key = (c: Oklch) => css({ l: Math.round(c.l * 200) / 200, c: Math.round(c.c * 100) / 100, h: c.c < 0.02 ? 0 : Math.round(c.h / 4) * 4 });

/** The letters a part sets, and in which colour each run sets them. */
function lettersOf(p: PaintedPart, roles: Partial<Roles>): { colour: Oklch; n: number }[] {
  const own = resolve(p.colour?.text, roles);
  const c = p.content;
  if (typeof c === "string") return own && c.trim() ? [{ colour: own, n: c.trim().length }] : [];
  if (Array.isArray(c)) {
    return c.flatMap((r) => {
      if (!r || typeof r !== "object") return [];
      const run = r as { text?: unknown; colour?: unknown };
      const n = typeof run.text === "string" ? run.text.trim().length : 0;
      const col = resolve(run.colour, roles) ?? own;
      return n && col ? [{ colour: col, n }] : [];
    });
  }
  return [];
}

/** A part's colour, which may name a role of the site's palette rather than a colour. */
function resolve(v: unknown, roles: Partial<Roles>): Oklch | null {
  if (typeof v === "string" && v in roles) return opaque(roles[v as keyof Roles]);
  return opaque(v);
}

/**
 * What a page actually paints most. `declared` is the site's palette as it
 * stands (role colours a part may name), `pageColour` the fill under
 * everything. Samples at most `budget` points over the page.
 */
export function paintedPalette(parts: readonly PaintedPart[], declared: Partial<Roles> = {}, pageColour?: string | null, budget = 2400): Painted | null {
  const boxes = parts
    .map((p) => ({ p, fill: resolve(p.colour?.bg ?? p.colour?.surface, declared), area: Math.max(0, p.w) * Math.max(0, p.h) }))
    .filter((b) => b.area > 0);
  if (!boxes.length) return null;
  const right = Math.max(...boxes.map((b) => b.p.x + b.p.w));
  const bottom = Math.max(...boxes.map((b) => b.p.y + b.p.h));
  const left = Math.min(0, ...boxes.map((b) => b.p.x));
  const top = Math.min(0, ...boxes.map((b) => b.p.y));
  const W = right - left;
  const H = bottom - top;
  if (W <= 0 || H <= 0) return null;
  const step = Math.max(4, Math.sqrt((W * H) / budget));
  /* The fill on top at a point is the smallest filled box that holds it: a card over its section, a button over its card. */
  const filled = boxes.filter((b) => b.fill).sort((a, b) => a.area - b.area);
  const page = opaque(pageColour ?? declared.bg);
  const fillCount = new Map<string, { c: Oklch; n: number }>();
  let points = 0;
  for (let y = top + step / 2; y < bottom; y += step) {
    for (let x = left + step / 2; x < right; x += step) {
      points++;
      const hit = filled.find((b) => x >= b.p.x && x < b.p.x + b.p.w && y >= b.p.y && y < b.p.y + b.p.h);
      const c = hit?.fill ?? page;
      if (!c) continue;
      const k = key(c);
      const e = fillCount.get(k) ?? { c, n: 0 };
      e.n++;
      fillCount.set(k, e);
    }
  }
  const letterCount = new Map<string, { c: Oklch; n: number }>();
  let letters = 0;
  for (const b of boxes) {
    for (const r of lettersOf(b.p, declared)) {
      const k = key(r.colour);
      const e = letterCount.get(k) ?? { c: r.colour, n: 0 };
      e.n += r.n;
      letters += r.n;
      letterCount.set(k, e);
    }
  }
  const fills = [...fillCount.values()].sort((a, b) => b.n - a.n).map((e) => ({ c: e.c, share: e.n / Math.max(1, points) }));
  const words = [...letterCount.values()].sort((a, b) => b.n - a.n).map((e) => ({ c: e.c, share: e.n / Math.max(1, letters) }));
  if (!fills.length) return null;

  const bg = fills[0]!.c;
  const surface = fills.slice(1).find((f) => Math.abs(f.c.l - bg.l) >= 0.02 && f.c.c < 0.08)?.c ?? bg;
  /* The words: the colour most letters wear that reads on the page; the most worn at all when none does, for `readableTheme` to mend. */
  const onBg = words.filter((w) => contrast(w.c, bg) >= READABLE);
  const text = (onBg[0] ?? words[0])?.c ?? opaque(declared.text) ?? bg;
  const muted = onBg.find((w) => key(w.c) !== key(text) && w.c.c < 0.08)?.c ?? text;
  /* Accents: the coloured fills and words that cover most, weighed together. */
  const colourful = new Map<string, { c: Oklch; w: number }>();
  for (const f of fills) if (f.c.c >= 0.06 && key(f.c) !== key(bg)) colourful.set(key(f.c), { c: f.c, w: (colourful.get(key(f.c))?.w ?? 0) + f.share });
  for (const w of words) if (w.c.c >= 0.06) colourful.set(key(w.c), { c: w.c, w: (colourful.get(key(w.c))?.w ?? 0) + w.share * 0.5 });
  const accents = [...colourful.values()].sort((a, b) => b.w - a.w).map((x) => x.c);
  const accent = accents[0] ?? opaque(declared.accent) ?? text;
  const highlight = accents[1] ?? opaque(declared.highlight) ?? accent;
  return {
    bg: css(bg), surface: css(surface), text: css(text), muted: css(muted), accent: css(accent), highlight: css(highlight),
    fills: fills.map((f) => ({ colour: css(f.c), share: f.share })),
    words: words.map((w) => ({ colour: css(w.c), share: w.share })),
  };
}

/* ------------------------------------------------------------------ */
/* Every word readable                                                 */
/* ------------------------------------------------------------------ */

const WHITE = rgbToOklch(1, 1, 1);
const BLACK = rgbToOklch(0, 0, 0);
/** Plain light on dark, when the site has no readable pair of its own. */
export const PLAIN = { bg: rgbToOklch(0.07, 0.075, 0.09), text: rgbToOklch(0.96, 0.96, 0.97) };

const dist = (a: Oklch, b: Oklch) => {
  const ab = (c: Oklch) => [c.l, c.c * Math.cos((c.h * Math.PI) / 180), c.c * Math.sin((c.h * Math.PI) / 180)];
  const [x, y] = [ab(a), ab(b)];
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
};

/** The colour nearest `want` that reads on `ground`, moving only its lightness; null when none of its hue does. */
export function readableOn(want: Oklch, ground: Oklch, floor = READABLE): Oklch | null {
  if (contrast(want, ground) >= floor) return want;
  const dir = ground.l > 0.6 ? -1 : 1;
  for (let l = want.l; l >= 0 && l <= 1; l += dir * 0.01) {
    const c = { ...want, l, c: Math.min(want.c, 0.2) };
    if (contrast(c, ground) >= floor) return c;
  }
  return null;
}

/**
 * The page and words pair to draw with: the site's own when it reads, else
 * the closest readable pair among its colours, else plain light on dark.
 */
export function readablePair(bg: Oklch, text: Oklch, colours: readonly Oklch[]): { bg: Oklch; text: Oklch; from: "site" | "palette" | "plain" } {
  if (contrast(bg, text) >= READABLE) return { bg, text, from: "site" };
  let best: { bg: Oklch; text: Oklch; d: number } | null = null;
  for (const b of colours) for (const t of colours) {
    if (contrast(b, t) < READABLE) continue;
    const d = dist(b, bg) + dist(t, text);
    if (!best || d < best.d) best = { bg: b, text: t, d };
  }
  if (best) return { bg: best.bg, text: best.text, from: "palette" };
  return { bg: PLAIN.bg, text: PLAIN.text, from: "plain" };
}

/** The pieces of a theme a preview draws words with. */
export interface WordTheme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  highlight: string;
  accentText: string;
  line: string;
  light: boolean;
}

/**
 * Every pair a preview draws words with, held to 4.5 to 1: words and quiet
 * words on the page and on a card, accent words on the page, and words on
 * the accent. `colours` are the site's own, tried first.
 */
export function readableTheme<T extends WordTheme>(t: T, colours: readonly string[] = []): T & { mended: string[] } {
  const own = [t.bg, t.surface, t.text, t.muted, t.accent, t.highlight, ...colours].map(opaque).filter((c): c is Oklch => !!c);
  const bg0 = opaque(t.bg) ?? PLAIN.bg;
  const text0 = opaque(t.text) ?? PLAIN.text;
  const mended: string[] = [];
  const pair = readablePair(bg0, text0, own);
  if (pair.from !== "site") mended.push(`page and words from ${pair.from}`);
  const bg = pair.bg;
  const text = pair.text;
  /* A card sits on the page: it keeps its colour only when the words read on it too. */
  let surface = opaque(t.surface) ?? bg;
  if (contrast(surface, text) < READABLE) { surface = bg; mended.push("cards take the page's colour"); }
  const fix = (name: string, v: string, grounds: Oklch[]): Oklch => {
    const want = opaque(v) ?? text;
    if (grounds.every((g) => contrast(want, g) >= READABLE)) return want;
    mended.push(name);
    let c: Oklch | null = want;
    for (const g of grounds) c = c ? readableOn(c, g) : null;
    if (c && grounds.every((g) => contrast(c!, g) >= READABLE)) return c;
    return text;
  };
  const muted = fix("quiet words", t.muted, [bg, surface]);
  const accent = fix("accent words", t.accent, [bg, surface]);
  const highlight = fix("highlight", t.highlight, [bg]);
  /* Words on the accent: white or black, whichever reads better; the accent's own when it already reads. */
  const at0 = opaque(t.accentText);
  const accentText = at0 && contrast(at0, accent) >= READABLE ? at0 : contrast(WHITE, accent) >= contrast(BLACK, accent) ? WHITE : BLACK;
  if (!at0 || contrast(at0, accent) < READABLE) mended.push("words on the accent");
  const light = bg.l >= 0.6;
  return {
    ...t,
    bg: css(bg), surface: css(surface), text: css(text), muted: css(muted), accent: css(accent), highlight: css(highlight),
    accentText: css(accentText),
    light,
    line: light ? css({ l: Math.max(0, bg.l - 0.12), c: 0.01, h: bg.h }) : css({ l: Math.min(1, bg.l + 0.16), c: 0.014, h: bg.h }),
    mended,
  };
}
