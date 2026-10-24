/**
 * A PART'S HOVER, READ AND SET: ITS FILL, ITS WORDS' COLOUR AND ITS LIFT.
 *
 * A captured hover is the page's own `:hover` rule on the part
 * (`node.motion.hover[n].style`, `shelf/parts/capturedMotion.ts`), drawn by
 * the same stylesheet on the board and on the published page. J (2026-10-23)
 * asked for it in the side panel: its colour and its lift, edited in place
 * (`panels/inspector/hoverField.tsx`). Only the part's own rules are read and
 * written (`self`, no pseudo-element): a hover keyed on an ancestor belongs
 * to that ancestor's look.
 *
 * A captured rule often says its colour twice, a plain colour and then a
 * `color-mix()` the browser prefers (Tailwind's `hover:bg-white/5`), so a
 * colour set here is written to every own rule that carries it. A colour
 * picked by hand is drawn as picked, solid (a 4% white veil given red stays
 * the red J picked, not a red no one can see), and the rule remembers it was
 * set by hand (`hand`).
 *
 * Pure.
 */
import type { MotionState, NodeMotion } from "./shelf/parts/capturedMotion";
import { oklchToRgb, parseColor, rgbToOklch } from "./look/lookparts/colour";

export interface Rgba { r: number; g: number; b: number; a: number }

const FILL = ["background-color", "background"] as const;
const WORDS = "color";

/** A colour as a page writes one: hex (3, 4, 6, 8), rgb()/rgba(), or `color-mix(in …, <hex|rgb> N%, transparent)`. */
export function readColour(v: string | null | undefined): Rgba | null {
  const s = (v ?? "").trim().replace(/\s*!important$/i, "");
  if (!s) return null;
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    let h = hex[1]!;
    if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(s);
  if (rgb) return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a: rgb[4] === undefined ? 1 : rgb[5] ? +rgb[4] / 100 : +rgb[4] };
  const mix = /^color-mix\(\s*in\s+[\w-]+\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|white|black)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i.exec(s);
  if (mix) {
    const base = mix[1] === "white" ? "#fff" : mix[1] === "black" ? "#000" : mix[1]!;
    const c = readColour(base);
    return c ? { ...c, a: c.a * (+mix[2]! / 100) } : null;
  }
  if (/^white$/i.test(s)) return { r: 255, g: 255, b: 255, a: 1 };
  if (/^black$/i.test(s)) return { r: 0, g: 0, b: 0, a: 1 };
  /* The app's own form (a palette role resolves to `oklch(l c h)`). */
  const ok = /^oklch\(/i.test(s) ? parseColor(s) : null;
  if (ok) {
    const [r, g, b] = oklchToRgb(ok);
    const alpha = /\/\s*([\d.]+)(%?)\s*\)$/.exec(s);
    return { r: r * 255, g: g * 255, b: b * 255, a: alpha ? (alpha[2] ? +alpha[1]! / 100 : +alpha[1]!) : 1 };
  }
  return null;
}

const hx = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
/** `#rrggbb`, or `#rrggbbaa` when it is see-through. */
export const hexOf = (c: Rgba): string => `#${hx(c.r)}${hx(c.g)}${hx(c.b)}${c.a < 0.999 ? hx(c.a * 255) : ""}`;
/** The six-digit hex a colour picker shows. */
export const pickerHex = (c: Rgba | null): string => (c ? `#${hx(c.r)}${hx(c.g)}${hx(c.b)}` : "#000000");

/** The part's own hover rules: on itself, not a pseudo-element's. */
const own = (r: MotionState) => r.self !== false && !r.pseudo;

/** Does the part have a hover of its own to edit? */
export function hasOwnHover(m: NodeMotion | null | undefined): boolean {
  return !!m?.hover?.some((r) => own(r) && Object.keys(r.style ?? {}).length);
}

/** The value a list of rules ends on for a property (the last own rule that says it, as the cascade reads them). */
function lastSaid(m: NodeMotion | null | undefined, keys: readonly string[]): string | null {
  let got: string | null = null;
  for (const r of m?.hover ?? []) {
    if (!own(r)) continue;
    for (const k of keys) {
      const v = r.style?.[k];
      if (v && readColour(v)) got = v;
    }
  }
  return got;
}

/** The part's hover fill, as written (null when it has none that is a plain colour). */
export const hoverFill = (m: NodeMotion | null | undefined): string | null => lastSaid(m, FILL);
/** The colour of its words under the hover. */
export const hoverWords = (m: NodeMotion | null | undefined): string | null => lastSaid(m, [WORDS]);
/** Was its hover fill set by hand (the Hover section)? */
export const fillByHand = (m: NodeMotion | null | undefined): boolean => !!m?.hover?.some((r) => own(r) && r.hand);

/** How far up the hover lifts the part, in px (a translate's y, read off translateY, translate, translate3d or matrix). */
export function liftOf(transform: string | null | undefined): number {
  const t = transform ?? "";
  let m = /translateY\(\s*(-?[\d.]+)px\s*\)/i.exec(t);
  if (m) return -Number(m[1]);
  m = /translate(?:3d)?\(\s*-?[\d.]+(?:px)?\s*,\s*(-?[\d.]+)px/i.exec(t);
  if (m) return -Number(m[1]);
  m = /matrix\(\s*[-\d.e]+\s*,\s*[-\d.e]+\s*,\s*[-\d.e]+\s*,\s*[-\d.e]+\s*,\s*[-\d.e]+\s*,\s*(-?[\d.e]+)\s*\)/i.exec(t);
  if (m) return -Number(m[1]);
  return 0;
}

/** The transform with its lift set to `px`, everything else it does kept. Empty when nothing is left. */
export function withLiftIn(transform: string | null | undefined, px: number): string {
  const t = (transform ?? "").trim();
  const y = `${Math.round(-px * 10) / 10 || 0}px`;
  if (/translateY\(/i.test(t)) return t.replace(/translateY\(\s*-?[\d.]+px\s*\)/i, px ? `translateY(${y})` : "").replace(/\s+/g, " ").trim();
  if (/translate(?:3d)?\(\s*-?[\d.]+(?:px)?\s*,\s*-?[\d.]+px/i.test(t)) return t.replace(/(translate(?:3d)?\(\s*-?[\d.]+(?:px)?\s*,\s*)-?[\d.]+px/i, `$1${y}`);
  if (/^matrix\(/i.test(t)) return t.replace(/(matrix\((?:\s*[-\d.e]+\s*,){5}\s*)-?[\d.e]+/i, `$1${-px}`);
  if (/^none$/i.test(t) || !t) return px ? `translateY(${y})` : "";
  return px ? `translateY(${y}) ${t}` : t;
}

/** The lift the part's hover ends on. */
export function hoverLift(m: NodeMotion | null | undefined): number {
  let got = 0;
  for (const r of m?.hover ?? []) if (own(r) && r.style?.transform) got = liftOf(r.style.transform);
  return got;
}

/** Each own rule, rewritten; a part with no own rule gets one. */
function eachOwn(m: NodeMotion | null | undefined, write: (style: Record<string, string>, r: MotionState, last: boolean) => Record<string, string> | null, mark?: Partial<MotionState>): NodeMotion {
  const list = [...(m?.hover ?? [])];
  let idx = list.map((r, i) => (own(r) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) { list.push({ self: true, style: {} }); idx = [list.length - 1]; }
  const lastIdx = idx[idx.length - 1]!;
  const out = list.map((r, i) => {
    if (!idx.includes(i)) return r;
    const style = write({ ...(r.style ?? {}) }, r, i === lastIdx);
    return style ? { ...r, style, ...(mark ?? {}) } : r;
  });
  return { ...(m ?? {}), hover: out };
}

/**
 * The hover fill set to a colour (`#rrggbb`), on every own rule that has a
 * fill, or on the last own rule when none has, as given (`#rrggbbaa` keeps its alpha).
 * `hand`: set in the Hover section, so a later fill change leaves it alone.
 */
export function withHoverFill(m: NodeMotion | null | undefined, hex: string, hand = true): NodeMotion {
  const any = (m?.hover ?? []).some((r) => own(r) && FILL.some((k) => readColour(r.style?.[k])));
  const next = readColour(hex);
  if (!next) return { ...(m ?? {}) };
  return eachOwn(m, (st, _r, last) => {
    let did = false;
    for (const k of FILL) {
      if (!readColour(st[k])) continue;
      st[k] = hexOf(next);
      did = true;
    }
    if (!did && !any && last) { st["background-color"] = hexOf(next); did = true; }
    return did ? st : null;
  }, hand ? { hand: true } : undefined);
}

/** The colour of the words under the hover, on every own rule that sets one (or the last own rule). */
export function withHoverWords(m: NodeMotion | null | undefined, hex: string): NodeMotion {
  const any = (m?.hover ?? []).some((r) => own(r) && readColour(r.style?.[WORDS]));
  const next = readColour(hex);
  if (!next) return { ...(m ?? {}) };
  return eachOwn(m, (st, _r, last) => {
    if (readColour(st[WORDS])) { st[WORDS] = hexOf(next); return st; }
    if (!any && last) { st[WORDS] = hexOf(next); return st; }
    return null;
  });
}

/** The hover's lift set to `px` (0: none), every other move it makes kept. */
export function withHoverLift(m: NodeMotion | null | undefined, px: number): NodeMotion {
  const any = (m?.hover ?? []).some((r) => own(r) && r.style?.transform);
  return eachOwn(m, (st, _r, last) => {
    if (!st.transform && (any || !last)) return null;
    const t = withLiftIn(st.transform, px);
    if (t) st.transform = t;
    else delete st.transform;
    return st;
  });
}

/* ------------------------------------------------------------------ */
/* Hover follows fill                                                  */
/* ------------------------------------------------------------------ */

/**
 * J (2026-10-23): when a part's fill changes, its hover colour follows: a
 * lighter or darker version of the new fill, in the same relation the
 * captured hover had to the old one. The relation is read in OKLCH, where a
 * step of lightness looks the same at every hue: the hover's lightness and
 * chroma against the old fill's, put on the new fill's, the new fill's hue,
 * the hover's own alpha. A hover fill set by hand (`hand`) is kept, and so
 * is one whose old fill is unknown or see-through (nothing to relate to).
 */
const toOk = (c: Rgba) => rgbToOklch(c.r / 255, c.g / 255, c.b / 255);

/** The hover colour `hover` had against `was`, put on `now`. */
export function followFill(hover: Rgba, was: Rgba, now: Rgba): Rgba {
  const h = toOk(hover), w = toOk(was), n = toOk(now);
  const l = Math.max(0, Math.min(1, n.l + (h.l - w.l)));
  const c = Math.max(0, w.c > 0.02 ? n.c * (h.c / w.c) : n.c + (h.c - w.c));
  const [r, g, b] = oklchToRgb({ l, c: Math.min(c, 0.37), h: n.h });
  return { r: r * 255, g: g * 255, b: b * 255, a: hover.a };
}

/**
 * The motion after the part's fill went from `wasFill` to `nowFill` (CSS
 * colours, roles already resolved), or null when the hover stays as it is.
 */
export function hoverAfterFill(m: NodeMotion | null | undefined, wasFill: string | null | undefined, nowFill: string | null | undefined): NodeMotion | null {
  const was = readColour(wasFill), now = readColour(nowFill);
  if (!m?.hover?.length || !was || !now || was.a < 0.05 || now.a < 0.05) return null;
  if (Math.round(was.r) === Math.round(now.r) && Math.round(was.g) === Math.round(now.g) && Math.round(was.b) === Math.round(now.b)) return null;
  let moved = false;
  const hover = m.hover.map((r) => {
    if (!own(r) || r.hand) return r;
    const st = { ...(r.style ?? {}) };
    let did = false;
    for (const k of FILL) {
      const h = readColour(st[k]);
      if (!h) continue;
      st[k] = hexOf(followFill(h, was, now));
      did = true;
    }
    if (!did) return r;
    moved = true;
    return { ...r, style: st };
  });
  return moved ? { ...m, hover } : null;
}
