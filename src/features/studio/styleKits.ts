/**
 * Style kits: a site's own way of dressing a thing, lifted off its real parts.
 *
 * THE OWNER'S WORDS. "If I have this theme of buttons on the Trump & Morty
 * site, I should be able to select the theme or another for the button I'm
 * drawing, so a cone would come out with the same shadow behind it, a
 * lighting bar on it maybe, and then decide after it's drawn what colour and
 * how it behaves."
 *
 * So a kit is everything about a part's look that is not its box: its fill
 * or gradient, its border, every shadow outside it (offset, blur, spread,
 * colour, hard or soft), the lighting bar inside it (an inset band of light,
 * its angle and opacity) and the shade opposite, its corners, how its words
 * are set, and what it does under the hand (hover and press). All of it is
 * read from what the capture measured on the page (`edge`, `art`, `colour`,
 * `font`, `motion`), never invented; a value the page did not give is left
 * out rather than guessed.
 *
 * Kits are grouped: parts that differ only in their fill colour (trumpmorty's
 * green, pink and yellow buttons) are one kit with those colours kept as its
 * swatches, because the colour is decided after drawing and the kit is the
 * rest. Parts whose shadows sit within a couple of pixels of each other, and
 * whose corners are within a quarter of their half-height, are the same kit.
 *
 * Also here: the motions a board holds (`motionsFromDoc`), each a keyframe
 * list a drawn shape can wear, and the site's short name (`siteShortName`).
 *
 * Pure: no React, no store, no browser. Every colour stays in the form the
 * capture wrote (rgb()), so what a kit draws is what the page drew.
 */

/* ------------------------------------------------------------------ */
/* Records                                                              */
/* ------------------------------------------------------------------ */

export type KitRole = "button" | "card" | "panel" | "badge";
export const KIT_ROLES: readonly KitRole[] = ["button", "card", "panel", "badge"];

/** One shadow outside the part. `hard` when the page gave it no blur. */
export interface KitShadow { dx: number; dy: number; blur: number; spread: number; colour: string; hard: boolean }

/**
 * A band of light (or shade) inside the part, the way an inset box-shadow
 * paints one: the part's own shape, less itself moved by `dx, dy`. `angle`
 * is where the band sits, in degrees, 90 meaning along the top edge (the
 * offset points down, so the lit rim is at the top). `opacity` is the
 * colour's own alpha; `colour` is the colour without it.
 */
export interface KitBand {
  dx: number; dy: number; blur: number; size: number; angle: number; colour: string; opacity: number;
  /**
   * `inset` (absent means inset): an inset shadow's band, the outline less
   * itself moved. `gloss`: a separate strip of light laid inside the part
   * (a `::before` of translucent white, trumpmorty's remote keys): `edge`
   * px in from the lit edge, `ends` px in from the other edges, `share` of
   * the part's depth thick, corners rounded by `radius`.
   */
  kind?: "inset" | "gloss";
  edge?: number;
  ends?: number;
  share?: number;
  radius?: number;
}

export interface KitFill {
  kind: "solid" | "linear" | "radial" | "none";
  /** The flat colour, or the gradient's middle for a swatch. */
  colour: string;
  stops?: { colour: string; at: number | null }[];
  /** CSS gradient angle in degrees (0 = toward the top). */
  angle?: number;
  /** A radial gradient's centre, 0..1 of the box. */
  at?: [number, number];
}

export interface KitText {
  face?: string;
  stack?: string;
  weight?: number;
  px?: number;
  colour?: string;
  transform?: string;
  /** Outlined type (`-webkit-text-stroke`), when the page drew its words that way. */
  stroke?: { w: number; colour: string } | null;
  shadow?: string | null;
}

/** What the part does under the hand: moved, turned, scaled, and its shadows then. */
export interface KitState { dx: number; dy: number; rotate: number; scale: number; shadows: KitShadow[] | null }

export interface StyleKit {
  id: string;
  /** In plain words: "Trorty button", "Trorty card, shadow below". */
  name: string;
  /** The site's short name, and where it was captured from. */
  site: string;
  host: string | null;
  role: KitRole;
  fill: KitFill;
  /** Every fill colour the kit was seen wearing, most used first. */
  swatches: string[];
  border: { width: number; colour: string; style: string } | null;
  shadows: KitShadow[];
  bar: KitBand | null;
  /** The lighting bar the kit's own site uses elsewhere, for a kit with none of its own to borrow. */
  siteBar?: KitBand | null;
  shade: KitBand | null;
  /** A thin inner rim of light all the way round (an inset spread). */
  rim: { width: number; colour: string; opacity: number } | null;
  /** Corner radius in px as measured, and as a share of the half short side (1 = a pill). */
  radius: number;
  radiusShare: number;
  text: KitText | null;
  hover: KitState | null;
  press: KitState | null;
  /** The parts it was read from (ids), the first being the one its values are. */
  from: string[];
  count: number;
  /** The first part's size, so a motion or a bar can be scaled to a new shape. */
  size: { w: number; h: number };
}

/** The parts of a node this reads. Every field optional: a landed board and a raw capture both fit. */
export interface KitNode {
  id: string;
  pageId?: string;
  featureId: string;
  label?: string;
  content?: unknown;
  x: number;
  y: number;
  w: number;
  h: number;
  colour?: Record<string, string | undefined> | null;
  font?: { face?: string; stack?: string; weight?: number; px?: number; family?: string } | null;
  edge?: { width?: number; style?: string; colour?: string; shadow?: string } | null;
  radius?: number | null;
  radii?: number[] | null;
  art?: { background?: string; textStroke?: { w: number; color: string }; textShadow?: string; clipPath?: string } | null;
  text?: { transform?: string } | null;
  motion?: { hover?: { self?: boolean; selector?: string; style?: Record<string, string>; pseudo?: string }[]; active?: { self?: boolean; selector?: string; style?: Record<string, string>; pseudo?: string }[]; animation?: { name: string; duration?: string; timing?: string; delay?: string; iterations?: string; direction?: string }[] } | null;
  picture?: unknown;
  state?: unknown;
}

export interface KitDoc {
  nodes: readonly KitNode[];
  /** The site's roles, so a colour a landed board ties to a role ("accent") reads as the colour. */
  palette?: Record<string, string | undefined> | null;
  name?: string | null;
  host?: string | null;
  keyframes?: readonly { name: string; frames: { key: string; style: Record<string, string> }[] }[] | null;
  behaviours?: { loops?: { part?: string; kind?: string; speed?: number; direction?: string }[] } | null;
}

/* ------------------------------------------------------------------ */
/* Colours                                                              */
/* ------------------------------------------------------------------ */

export interface Rgba { r: number; g: number; b: number; a: number }

const NAMED: Record<string, Rgba> = {
  black: { r: 0, g: 0, b: 0, a: 1 }, white: { r: 255, g: 255, b: 255, a: 1 }, transparent: { r: 0, g: 0, b: 0, a: 0 },
};

export function parseRgba(v: string | null | undefined): Rgba | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (NAMED[s]) return { ...NAMED[s]! };
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number.isFinite(a) ? a : 1 };
  }
  const h = /^#([0-9a-f]{3,8})$/.exec(s);
  if (h) {
    let x = h[1]!;
    if (x.length === 3 || x.length === 4) x = x.split("").map((c) => c + c).join("");
    if (x.length !== 6 && x.length !== 8) return null;
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1 };
  }
  return null;
}

export const rgbCss = (c: Rgba): string => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
export const rgbaCss = (c: Rgba): string => (c.a >= 1 ? rgbCss(c) : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+c.a.toFixed(3)})`);

const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
/** Relative luminance, 0..1 (the one the readable-contrast rule is written in). */
export const luminanceOf = (c: Rgba): number => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
/** The contrast ratio between two colours, 1..21. */
export function contrastOf(a: string, b: string): number {
  const x = parseRgba(a), y = parseRgba(b);
  if (!x || !y) return 21;
  const la = luminanceOf(x), lb = luminanceOf(y);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Two colours mixed, `t` of the second. */
export function mix(a: string, b: string, t: number): string {
  const x = parseRgba(a), y = parseRgba(b);
  if (!x || !y) return a;
  return rgbCss({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t, a: 1 });
}

/** A colour's name in plain words, for a kit told apart by one. */
export function colourWord(v: string): string {
  const c = parseRgba(v);
  if (!c) return "";
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (l < 0.14) return "black";
  if (l > 0.93) return "white";
  if (s < 0.18) return "grey";
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 340) return l > 0.7 ? "pink" : "red";
  if (h < 40) return l < 0.35 ? "brown" : "orange";
  if (h < 68) return "yellow";
  if (h < 160) return "green";
  if (h < 195) return "teal";
  if (h < 255) return "blue";
  if (h < 295) return "purple";
  return "pink";
}

/** A colour a landed board may have tied to a role: the role's colour, else as written. */
function colourIn(v: string | undefined | null, palette: KitDoc["palette"]): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  const role = palette?.[s];
  return typeof role === "string" && role.trim() ? role.trim() : s;
}

/* ------------------------------------------------------------------ */
/* Reading CSS the capture wrote                                        */
/* ------------------------------------------------------------------ */

/** Split on commas that are not inside brackets. */
export function splitTop(s: string, by = ","): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === by && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A length: `8px`, `0`, `-3px`, or a `calc()` of sums of px (`calc(6px + 3px)`). */
function lengthOf(tok: string): number | null {
  const t = tok.trim();
  if (/^-?[\d.]+(px)?$/.test(t)) return Number(t.replace("px", ""));
  const c = /^calc\((.*)\)$/.exec(t);
  if (c) {
    const parts = c[1]!.replace(/\s+/g, " ").split(/\s(?=[+-]\s)/);
    let sum = 0;
    for (const p of parts) {
      const m = /^([+-])?\s*(-?[\d.]+)px$/.exec(p.trim());
      if (!m) return null;
      sum += (m[1] === "-" ? -1 : 1) * Number(m[2]);
    }
    return sum;
  }
  return null;
}

/** Tokens of one shadow, keeping a function's brackets together. */
function tokens(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export interface ParsedShadow { inset: boolean; dx: number; dy: number; blur: number; spread: number; colour: Rgba }

/** A `box-shadow` value, one entry per shadow, in the page's order (first on top). */
export function parseShadows(css: string | null | undefined): ParsedShadow[] {
  if (typeof css !== "string" || !css.trim() || css.trim() === "none") return [];
  const out: ParsedShadow[] = [];
  for (const one of splitTop(css)) {
    let inset = false;
    let colour: Rgba | null = null;
    const lens: number[] = [];
    for (const t of tokens(one)) {
      if (t === "inset") { inset = true; continue; }
      const len = lengthOf(t);
      if (len !== null) { lens.push(len); continue; }
      const c = parseRgba(t);
      if (c) colour = c;
    }
    if (lens.length < 2) continue;
    out.push({ inset, dx: lens[0]!, dy: lens[1]!, blur: Math.max(0, lens[2] ?? 0), spread: lens[3] ?? 0, colour: colour ?? { r: 0, g: 0, b: 0, a: 1 } });
  }
  return out;
}

/** A `linear-gradient` or `radial-gradient`, or null. */
export function parseGradient(css: string | null | undefined): KitFill | null {
  if (typeof css !== "string") return null;
  const m = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/.exec(css.trim());
  if (!m || m[1]) return null;
  const args = splitTop(m[3]!);
  if (!args.length) return null;
  let angle = 180;
  let at: [number, number] = [0.5, 0.5];
  let first = 0;
  const head = args[0]!;
  if (m[2] === "linear") {
    const deg = /^(-?[\d.]+)deg$/.exec(head);
    const to = /^to\s+(.*)$/.exec(head);
    if (deg) { angle = Number(deg[1]); first = 1; }
    else if (to) {
      const w = to[1]!;
      angle = w === "top" ? 0 : w === "right" ? 90 : w === "bottom" ? 180 : w === "left" ? 270 : w.includes("top") ? (w.includes("right") ? 45 : 315) : w.includes("right") ? 135 : 225;
      first = 1;
    }
  } else if (!parseRgba(head.split(/\s+/)[0] ?? "")) {
    const a = /at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/.exec(head);
    if (a) at = [Number(a[1]) / 100, Number(a[2]) / 100];
    first = 1;
  }
  const stops: { colour: string; at: number | null }[] = [];
  for (const s of args.slice(first)) {
    const t = tokens(s);
    const c = parseRgba(t[0] ?? "");
    if (!c) continue;
    const p = t[1] && /%$/.test(t[1]) ? Number(t[1].slice(0, -1)) / 100 : null;
    stops.push({ colour: rgbaCss(c), at: p });
  }
  if (stops.length < 2) return null;
  const mid = stops[Math.floor(stops.length / 2)]!.colour;
  return m[2] === "linear" ? { kind: "linear", colour: mid, stops, angle } : { kind: "radial", colour: mid, stops, at };
}

/** `translate(-3px, -3px) rotate(-2deg)`, `translateY(-3px)`, `scale(1.05)` as numbers. */
export function parseTransform(css: string | null | undefined): { dx: number; dy: number; rotate: number; scale: number } | null {
  if (typeof css !== "string" || !css.trim() || css.trim() === "none") return null;
  let dx = 0, dy = 0, rotate = 0, scale = 1, any = false;
  const re = /(translate[XY]?|rotate|scale[XY]?)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const args = splitTop(m[2]!);
    any = true;
    if (m[1] === "translate") { dx += lengthOf(args[0] ?? "0") ?? 0; dy += lengthOf(args[1] ?? "0") ?? 0; }
    else if (m[1] === "translateX") dx += lengthOf(args[0] ?? "0") ?? 0;
    else if (m[1] === "translateY") dy += lengthOf(args[0] ?? "0") ?? 0;
    else if (m[1] === "rotate") { const d = /^(-?[\d.]+)(deg|turn|rad)?$/.exec((args[0] ?? "").trim()); if (d) rotate += d[2] === "turn" ? Number(d[1]) * 360 : d[2] === "rad" ? (Number(d[1]) * 180) / Math.PI : Number(d[1]); }
    else if (m[1] === "scale") scale *= Number(args[0]) || 1;
  }
  return any ? { dx, dy, rotate, scale } : null;
}

/* ------------------------------------------------------------------ */
/* One part's look                                                      */
/* ------------------------------------------------------------------ */

const LIGHT = 0.62;
const DARK = 0.12;

/** The band a one-sided inset shadow paints, as a kit band. */
function bandOf(s: ParsedShadow): KitBand {
  const size = Math.hypot(s.dx, s.dy);
  return {
    dx: s.dx, dy: s.dy, blur: s.blur, size: +size.toFixed(2),
    angle: Math.round(((Math.atan2(s.dy, s.dx) * 180) / Math.PI + 360) % 360),
    colour: rgbCss({ ...s.colour, a: 1 }), opacity: +s.colour.a.toFixed(3),
  };
}

interface Look {
  fill: KitFill;
  border: StyleKit["border"];
  shadows: KitShadow[];
  bar: KitBand | null;
  shade: KitBand | null;
  rim: StyleKit["rim"];
  radius: number;
  radiusShare: number;
}

const toShadow = (s: ParsedShadow): KitShadow => ({ dx: s.dx, dy: s.dy, blur: s.blur, spread: s.spread, colour: rgbaCss(s.colour), hard: s.blur === 0 });

/** What one part wears, read off its record. Null when it wears nothing a kit could carry. */
export function lookOf(n: KitNode, palette?: KitDoc["palette"]): Look | null {
  const bgRaw = colourIn(n.colour?.bg ?? n.colour?.surface, palette);
  const bg = parseRgba(bgRaw);
  const grad = parseGradient(n.art?.background);
  const fill: KitFill = grad ?? (bg && bg.a > 0.05 ? { kind: "solid", colour: rgbaCss(bg) } : { kind: "none", colour: "rgba(0, 0, 0, 0)" });
  const e = n.edge ?? null;
  const bw = e && e.style !== "none" && (e.width ?? 0) > 0 ? e.width! : 0;
  const bc = parseRgba(colourIn(e?.colour, palette));
  let border: StyleKit["border"] = bw > 0 && bc && bc.a > 0.05 ? { width: bw, colour: rgbaCss(bc), style: e?.style ?? "solid" } : null;
  const shadows: KitShadow[] = [];
  let bar: KitBand | null = null, shade: KitBand | null = null, rim: StyleKit["rim"] = null;
  for (const s of parseShadows(e?.shadow)) {
    if (s.colour.a <= 0.02) continue;
    if (!s.inset) { shadows.push(toShadow(s)); continue; }
    const lum = luminanceOf(s.colour);
    const offset = Math.hypot(s.dx, s.dy);
    if (offset === 0 && s.spread > 0) {
      // A ring inside the edge: a border drawn as a shadow when opaque and dark enough, else a rim of light.
      if (lum > LIGHT && s.colour.a < 0.95) { if (!rim) rim = { width: s.spread, colour: rgbCss({ ...s.colour, a: 1 }), opacity: +s.colour.a.toFixed(3) }; }
      else if (!border && s.colour.a > 0.6) border = { width: s.spread, colour: rgbaCss(s.colour), style: "solid" };
      continue;
    }
    if (offset === 0) continue;
    /* One edge drawn with an opaque inset (`inset 4px 0 0 0`): a divider, not light. */
    if (s.colour.a > 0.95 && lum < LIGHT) continue;
    if (lum > LIGHT) { if (!bar) bar = bandOf(s); }
    else if (lum < DARK || s.colour.a < 0.5) { if (!shade) shade = bandOf(s); }
  }
  const half = Math.max(1, Math.min(n.w, n.h) / 2);
  const r = typeof n.radius === "number" && n.radius > 0 ? Math.min(n.radius, half) : Array.isArray(n.radii) && n.radii.length ? Math.min(half, Math.max(...n.radii)) : 0;
  const worth = fill.kind !== "none" || !!border;
  if (!worth) return null;
  return { fill, border, shadows, bar, shade, rim, radius: +r.toFixed(1), radiusShare: +(r / half).toFixed(3) };
}

/** Is there anything here beyond a flat box of colour? */
function dressed(l: Look, role: KitRole): boolean {
  if (l.border || l.shadows.length || l.bar || l.shade || l.rim || l.fill.kind === "linear" || l.fill.kind === "radial") return true;
  // A button of flat colour with rounded corners is still a button's look.
  return role === "button" && l.fill.kind === "solid" && l.radius > 0;
}

/** What a part is, for a kit: a button, a card, a panel, a badge, or none. */
export function roleOf(n: KitNode): KitRole | null {
  const label = (n.label ?? "").trim();
  if (label.startsWith("::") || n.picture || n.state) return null;
  if (n.w < 16 || n.h < 12 || n.w >= 1200) return null;
  if (n.featureId === "picture" || n.featureId === "drawn-icon") return null;
  const pressable = n.featureId === "cta-primary" || /^(button|link)\b/.test(label);
  if (pressable && n.h >= 20 && n.h <= 140 && n.w <= 640) return "button";
  if (n.h <= 52 && n.w <= 360) return "badge";
  if (n.w * n.h >= 300 * 300 && (n.w >= 600 || n.h >= 380)) return "panel";
  if (n.w >= 120 && n.h >= 90) return "card";
  return null;
}

/** The hover or press a part answers with, when it answers itself. */
function stateOf(list: NonNullable<KitNode["motion"]>["hover"], palette: KitDoc["palette"]): KitState | null {
  const own = (list ?? []).filter((s) => s && !s.pseudo && (s.self || !s.selector) && s.style);
  if (!own.length) return null;
  let t: ReturnType<typeof parseTransform> = null;
  let shadows: KitShadow[] | null = null;
  for (const s of own) {
    t = parseTransform(s.style?.transform) ?? t;
    const bs = s.style?.["box-shadow"];
    if (bs) shadows = parseShadows(bs.replace(/#[0-9a-f]{3,8}\b/gi, (h) => rgbaCss(parseRgba(h)!))).filter((x) => !x.inset && x.colour.a > 0.02).map(toShadow);
  }
  void palette;
  if (!t && !shadows) return null;
  return { dx: t?.dx ?? 0, dy: t?.dy ?? 0, rotate: t?.rotate ?? 0, scale: t?.scale ?? 1, shadows };
}

/**
 * A strip of light laid inside a part: a piece wholly inside it, in its
 * upper part, most of its width, less than half its height, filled with a
 * translucent light colour (the `::before` a page draws a gloss with).
 */
function glossOf(n: KitNode, lights: readonly KitNode[], palette: KitDoc["palette"]): KitBand | null {
  for (const m of lights) {
    if (m === n || (m.pageId && n.pageId && m.pageId !== n.pageId)) continue;
    if (m.x < n.x - 1 || m.y < n.y - 1 || m.x + m.w > n.x + n.w + 1 || m.y + m.h > n.y + n.h + 1) continue;
    if (m.w < n.w * 0.5 || m.h > n.h * 0.45 || m.y - n.y > n.h * 0.4) continue;
    const c = parseRgba(colourIn(m.colour?.bg ?? m.colour?.surface, palette));
    if (!c) continue;
    const top = m.y - n.y, side = Math.min(m.x - n.x, n.x + n.w - m.x - m.w);
    return {
      kind: "gloss", dx: 0, dy: m.h, blur: 0, size: m.h, angle: 90, colour: rgbCss({ ...c, a: 1 }), opacity: +c.a.toFixed(3),
      edge: Math.max(0, +top.toFixed(1)), ends: Math.max(0, +side.toFixed(1)), share: +(m.h / Math.max(1, n.h)).toFixed(3),
      radius: typeof m.radius === "number" ? m.radius : 0,
    };
  }
  return null;
}

/** The pieces that could be a gloss: translucent light fills. */
function lightPieces(nodes: readonly KitNode[], palette: KitDoc["palette"]): KitNode[] {
  return nodes.filter((m) => {
    const c = parseRgba(colourIn(m.colour?.bg ?? m.colour?.surface, palette));
    return !!c && c.a > 0.05 && c.a < 0.8 && luminanceOf(c) > LIGHT && m.w > 8 && m.h > 3;
  });
}

/* ------------------------------------------------------------------ */
/* Grouping                                                             */
/* ------------------------------------------------------------------ */

const q = (v: number, step: number) => Math.round(v / step) * step;
const colourKey = (v: string) => { const c = parseRgba(v); return c ? `${q(c.r, 24)},${q(c.g, 24)},${q(c.b, 24)},${q(c.a, 0.25)}` : v; };
const sign = (v: number) => (v > 0.5 ? 1 : v < -0.5 ? -1 : 0);

/** Two parts are the same kit when these agree: everything about the look but its fill colour. */
function signature(role: KitRole, l: Look, hover: KitState | null, press: KitState | null): string {
  return [
    role,
    l.fill.kind === "solid" || l.fill.kind === "none" ? l.fill.kind : `${l.fill.kind}:${(l.fill.stops ?? []).map((s) => colourKey(s.colour)).join("/")}`,
    l.border ? `${q(l.border.width, 2)}:${colourKey(l.border.colour)}:${l.border.style}` : "-",
    l.shadows.map((s) => `${q(s.dx, 2)},${q(s.dy, 2)},${q(s.blur, 4)},${q(s.spread, 2)},${colourKey(s.colour)}`).join("|") || "-",
    l.bar ? `${l.bar.kind ?? "inset"}:${q(l.bar.dx, 2)},${q(l.bar.dy, l.bar.kind === "gloss" ? 8 : 2)},${q(l.bar.opacity, 0.1)}` : "-",
    l.shade ? `${q(l.shade.dx, 2)},${q(l.shade.dy, 2)}` : "-",
    l.rim ? "rim" : "-",
    l.radiusShare >= 0.9 ? "pill" : String(Math.round(l.radiusShare * 4)),
    hover ? `${sign(hover.dx)}${sign(hover.dy)}${sign(hover.rotate)}${hover.scale > 1.01 ? "+" : hover.scale < 0.99 ? "-" : ""}` : "-",
    press ? `${sign(press.dx)}${sign(press.dy)}${press.scale > 1.01 ? "+" : press.scale < 0.99 ? "-" : ""}` : "-",
  ].join("#");
}

/** Plain text of a node's words, whatever form they are in. */
function wordsOf(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((r) => (r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : "")).join("");
  return "";
}

/** How a part's words are set: its own, else the largest words inside its box. */
function textFor(n: KitNode, inside: readonly KitNode[], palette: KitDoc["palette"]): KitText | null {
  const own = n.font && wordsOf(n.content).trim() ? n : null;
  let best = own;
  if (!best) {
    for (const m of inside) {
      if (m === n || !m.font || !wordsOf(m.content).trim()) continue;
      if (m.pageId && n.pageId && m.pageId !== n.pageId) continue;
      if (m.x < n.x - 1 || m.y < n.y - 1 || m.x + m.w > n.x + n.w + 1 || m.y + m.h > n.y + n.h + 1) continue;
      if (!best || (m.font.px ?? 0) > (best.font?.px ?? 0)) best = m;
    }
  }
  if (!best?.font) return null;
  const f = best.font;
  const colour = colourIn(best.colour?.text, palette) ?? colourIn(n.colour?.text, palette) ?? undefined;
  const out: KitText = {};
  if (f.face) out.face = f.face;
  if (f.stack) out.stack = f.stack;
  if (typeof f.weight === "number") out.weight = f.weight;
  if (typeof f.px === "number") out.px = f.px;
  if (colour) out.colour = colour;
  if (best.text?.transform && best.text.transform !== "none") out.transform = best.text.transform;
  if (best.art?.textStroke) out.stroke = { w: best.art.textStroke.w, colour: best.art.textStroke.color };
  if (best.art?.textShadow) out.shadow = best.art.textShadow;
  return out;
}

/**
 * A site's name, short enough to put in front of "button".
 *
 * A token's ticker when the name carries one (`Trump & Morty — $TRORTY` is
 * "Trorty"), else the name up to its first separator (`Share | The Best
 * Odds…` is "Share"), else the host's first word.
 */
export function siteShortName(name: string | null | undefined, host?: string | null): string {
  const s = (name ?? "").trim();
  const ticker = /\$([A-Za-z][A-Za-z0-9]{1,14})\b/.exec(s);
  if (ticker) { const t = ticker[1]!; return t[0]!.toUpperCase() + t.slice(1).toLowerCase(); }
  const head = s.split(/\s+[|·—–-]\s+|\s*[|·—–]\s*/)[0]?.trim() ?? "";
  if (head && head.length <= 24) return head;
  if (head) return head.split(/\s+/).slice(0, 2).join(" ");
  const h = (host ?? "").replace(/^www\./, "").split(".")[0] ?? "";
  return h ? h[0]!.toUpperCase() + h.slice(1) : "This site";
}

/** What tells a kit apart from the first of its role, in plain words, the plainest first. */
function differences(k: Look & { hover: KitState | null; face?: string }, first: Look & { hover: KitState | null; face?: string }): string[] {
  const out: string[] = [];
  const a = k.shadows[0], b = first.shadows[0];
  if (!a && b) out.push("no shadow");
  if (a && (!b || sign(a.dx) !== sign(b.dx) || sign(a.dy) !== sign(b.dy) || (a.blur > 0) !== (b.blur > 0))) {
    if (!a.hard && a.dx === 0 && a.dy === 0) out.push("glow");
    else if (!a.hard) out.push("soft shadow");
    else if (Math.abs(a.dx) < 1 && a.dy > 0) out.push("shadow below");
    else if (Math.abs(a.dx) < 1 && Math.abs(a.dy) < 1) out.push("outer ring");
    else out.push("shadow to the corner");
  }
  if (a && b && colourKey(a.colour) !== colourKey(b.colour)) out.push(`${colourWord(a.colour)} shadow`);
  if (a && b && Math.abs(Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy)) >= 3) out.push(Math.hypot(a.dx, a.dy) > Math.hypot(b.dx, b.dy) ? "deeper shadow" : "shallower shadow");
  if ((k.radiusShare >= 0.9) !== (first.radiusShare >= 0.9)) out.push(k.radiusShare >= 0.9 ? "pill" : "square corners");
  if (k.fill.kind !== first.fill.kind) out.push(k.fill.kind === "none" ? "outline only" : k.fill.kind === "solid" ? "flat colour" : "gradient");
  if (!!k.bar !== !!first.bar) out.push(k.bar ? "with lighting bar" : "no lighting bar");
  if (!!k.border !== !!first.border) out.push(k.border ? "with border" : "no border");
  if (k.border && first.border && colourKey(k.border.colour) !== colourKey(first.border.colour)) out.push(`${colourWord(k.border.colour)} border`);
  if (k.border && first.border && k.border.width !== first.border.width) out.push(k.border.width > first.border.width ? "thicker border" : "thinner border");
  if (!!k.hover !== !!first.hover) out.push(k.hover ? "lifts under the hand" : "stays still");
  if (Math.abs(k.radiusShare - first.radiusShare) >= 0.2) out.push(k.radiusShare > first.radiusShare ? "rounder corners" : "sharper corners");
  if (k.face && k.face !== first.face) out.push(`in ${k.face}`);
  if (!!k.rim !== !!first.rim) out.push(k.rim ? "lit rim" : "no rim");
  return out;
}

const ROLE_WORD: Record<KitRole, string> = { button: "button", card: "card", panel: "panel", badge: "badge" };
/** The most kits kept per role per site: a picker is a short list, not an inventory. */
export const KITS_PER_ROLE = 4;

/**
 * Every kit on one board: grouped, named, the most used first in each role.
 */
export function kitsFromDoc(doc: KitDoc): StyleKit[] {
  const site = siteShortName(doc.name, doc.host);
  const host = doc.host ?? null;
  const groups = new Map<string, { role: KitRole; look: Look; hover: KitState | null; press: KitState | null; nodes: KitNode[]; fills: Map<string, number> }>();
  const order: string[] = [];
  const lights = lightPieces(doc.nodes, doc.palette);
  for (const n of doc.nodes) {
    const role = roleOf(n);
    if (!role) continue;
    const read = lookOf(n, doc.palette);
    if (!read) continue;
    const gloss = read.bar ? null : glossOf(n, lights, doc.palette);
    const look = gloss ? { ...read, bar: gloss } : read;
    if (!dressed(look, role)) continue;
    const hover = stateOf(n.motion?.hover, doc.palette);
    const press = stateOf(n.motion?.active, doc.palette);
    const key = signature(role, look, hover, press);
    let g = groups.get(key);
    if (!g) { g = { role, look, hover, press, nodes: [], fills: new Map() }; groups.set(key, g); order.push(key); }
    g.nodes.push(n);
    if (look.fill.kind === "solid") g.fills.set(look.fill.colour, (g.fills.get(look.fill.colour) ?? 0) + 1);
  }
  const byRole = new Map<KitRole, { key: string; g: NonNullable<ReturnType<typeof groups.get>> }[]>();
  for (const key of order) {
    const g = groups.get(key)!;
    const list = byRole.get(g.role) ?? [];
    list.push({ key, g });
    byRole.set(g.role, list);
  }
  const kits: StyleKit[] = [];
  for (const role of KIT_ROLES) {
    const list = (byRole.get(role) ?? []).sort((a, b) => b.g.nodes.length - a.g.nodes.length).slice(0, KITS_PER_ROLE);
    const first = list[0];
    const used = new Set<string>();
    const faceOf = (x: typeof first) => (x ? textFor(x.g.nodes[0]!, doc.nodes, doc.palette)?.face : undefined);
    const firstFace = faceOf(first);
    list.forEach((item, i) => {
      const { g } = item;
      const base = `${site} ${ROLE_WORD[role]}`;
      const words = i === 0 ? [] : differences({ ...g.look, hover: g.hover, face: faceOf(item) }, { ...first!.g.look, hover: first!.g.hover, face: firstFace });
      let name = i === 0 ? base : `${base}, ${words.find((w) => !used.has(`${base}, ${w}`)) ?? (seenOn(g.nodes[0]!).replace(/^, /, "") || words[0] || "another")}`;
      for (let k = 2; used.has(name); k++) name = `${name.replace(/ \d+$/, "")} ${k}`;
      used.add(name);
      const rep = g.nodes[0]!;
      const swatches = [...g.fills.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 8);
      kits.push({
        id: `kit:${(host ?? site).toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${role}:${i}`,
        name, site, host, role,
        fill: g.look.fill, swatches: swatches.length ? swatches : g.look.fill.kind !== "none" ? [g.look.fill.colour] : [],
        border: g.look.border, shadows: g.look.shadows, bar: g.look.bar, shade: g.look.shade, rim: g.look.rim,
        radius: g.look.radius, radiusShare: g.look.radiusShare,
        text: textFor(rep, doc.nodes, doc.palette),
        hover: g.hover, press: g.press,
        from: g.nodes.slice(0, 12).map((n) => n.id), count: g.nodes.length,
        size: { w: rep.w, h: rep.h },
      });
    });
  }
  const lit = siteBar(kits);
  return kits.map((k) => ({ ...k, siteBar: k.bar ? null : lit }));
}

/**
 * The lighting bar a site uses anywhere, for a kit that has none of its own
 * (trumpmorty's buttons are flat; its television is lit). The most used.
 */
export function siteBar(kits: readonly StyleKit[]): KitBand | null {
  const bars = kits.filter((k) => k.bar).sort((a, b) => b.count - a.count);
  return bars[0]?.bar ?? null;
}

/** A band the Builder offers when no kit on any board has one: a soft top light. */
export const PLAIN_BAR: KitBand = { dx: 0, dy: 6, blur: 0, size: 6, angle: 90, colour: "rgb(255, 255, 255)", opacity: 0.35 };

/** A kit with nothing on it: the drawing as drawn, in the site's surface colour. */
export function plainKit(colour = "rgb(240, 240, 240)"): StyleKit {
  return {
    id: "kit:plain", name: "Plain", site: "", host: null, role: "button",
    fill: { kind: "solid", colour }, swatches: [colour], border: null, shadows: [], bar: null, shade: null, rim: null,
    radius: 0, radiusShare: 0, text: null, hover: null, press: null, from: [], count: 0, size: { w: 160, h: 60 },
  };
}

/* ------------------------------------------------------------------ */
/* Motions a board holds                                                */
/* ------------------------------------------------------------------ */

export interface BoardMotion {
  id: string;
  /** Plain: "Blink, like the LIVE light". */
  name: string;
  site: string;
  frames: { key: string; style: Record<string, string> }[];
  /** ms, as the page ran it. */
  duration: number;
  timing: string;
  /** The part it was seen on, so its distances can be scaled to a new shape. */
  size: { w: number; h: number };
}

/** Properties a drawn shape can take over from another part without breaking. */
const MOVES = new Set(["transform", "translate", "rotate", "scale", "opacity", "filter", "transform-origin"]);

const MOTION_WORDS: [RegExp, string][] = [
  [/blink|flash|flicker/i, "Blink"], [/wob|wiggle|wag/i, "Wobble"], [/bob|float|hover/i, "Float"], [/spin|rotat|turn/i, "Spin"],
  [/pulse|beat|breath/i, "Pulse"], [/drip/i, "Drip"], [/jit|shake|glitch/i, "Jitter"], [/bounce/i, "Bounce"], [/sway|swing|ant/i, "Sway"],
  [/slide|marquee|scroll/i, "Slide"], [/zoom|grow/i, "Grow"], [/fade/i, "Fade"],
];

/** A page's name for an animation, in plain words. */
export function motionWord(name: string): string {
  for (const [re, w] of MOTION_WORDS) if (re.test(name)) return w;
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").trim().toLowerCase();
  return spaced ? spaced[0]!.toUpperCase() + spaced.slice(1) : "Motion";
}

function msOf(v: string | undefined): number {
  const m = /^([\d.]+)(ms|s)$/.exec((v ?? "").trim());
  return m ? Number(m[1]) * (m[2] === "s" ? 1000 : 1) : 0;
}

/** A short "like …" from the part a motion was seen on. */
function seenOn(n: KitNode): string {
  const quoted = /“([^”]+)”/.exec(n.label ?? "")?.[1];
  const w = (quoted ?? wordsOf(n.content)).trim();
  const clipped = w.length > 22 ? `${w.slice(0, 20)}…` : w;
  return clipped ? `, like “${clipped}”` : "";
}

/**
 * Every motion on a board a drawn shape can wear: each captured animation
 * that moves, turns, scales or fades a part (not one that scrolls a
 * background or wipes a clip, which mean nothing on another shape), once
 * per keyframes, named for what it does and the part it was seen on; and
 * each marquee the page's script ran, as a slide.
 */
export function motionsFromDoc(doc: KitDoc): BoardMotion[] {
  const site = siteShortName(doc.name, doc.host);
  const frames = new Map((doc.keyframes ?? []).map((k) => [k.name, k.frames]));
  const out: BoardMotion[] = [];
  const seen = new Set<string>();
  for (const n of doc.nodes) {
    for (const a of n.motion?.animation ?? []) {
      if (!a?.name || seen.has(a.name)) continue;
      const f = frames.get(a.name);
      if (!f?.length) continue;
      const kept = f.map((x) => ({ key: x.key, style: Object.fromEntries(Object.entries(x.style ?? {}).filter(([p]) => MOVES.has(p))) })).filter((x) => Object.keys(x.style).length);
      if (!kept.length || kept.every((x) => Object.keys(x.style).every((p) => p === "transform-origin"))) continue;
      const duration = msOf(a.duration);
      if (duration <= 0 || duration > 60000) continue;
      seen.add(a.name);
      out.push({ id: `${site.toLowerCase()}:${a.name}`, name: `${motionWord(a.name)}${seenOn(n)}`, site, frames: kept, duration, timing: a.timing ?? "ease-in-out", size: { w: n.w, h: n.h } });
    }
  }
  for (const l of doc.behaviours?.loops ?? []) {
    if (l.kind !== "marquee" || seen.has("marquee")) continue;
    seen.add("marquee");
    const n = doc.nodes.find((x) => x.id === l.part);
    const dir = l.direction === "right" ? 1 : -1;
    // The page's own speed (px a second) over a slide of 40px each way.
    const speed = Math.max(8, Number(l.speed) || 30);
    out.push({
      id: `${site.toLowerCase()}:marquee`, name: n && seenOn(n) ? `Slide${seenOn(n)}` : "Slide, like the ribbon", site,
      frames: [
        { key: "0%", style: { transform: "translateX(0px)", opacity: "1" } },
        { key: "45%", style: { transform: `translateX(${dir * 40}px)`, opacity: "1" } },
        { key: "50%", style: { transform: `translateX(${dir * 48}px)`, opacity: "0" } },
        { key: "55%", style: { transform: `translateX(${-dir * 48}px)`, opacity: "0" } },
        { key: "60%", style: { transform: `translateX(${-dir * 40}px)`, opacity: "1" } },
        { key: "100%", style: { transform: "translateX(0px)", opacity: "1" } },
      ],
      duration: Math.round((160 / speed) * 1000), timing: "linear", size: { w: 80, h: 80 },
    });
  }
  return out;
}

/** The motions every drawn shape has, whatever board it is on: from the kit's own hover and press. */
export const HAND_MOTIONS = ["hover", "press"] as const;
