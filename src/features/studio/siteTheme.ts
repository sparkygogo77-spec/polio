/**
 * A new site's design, as one piece of data: the theme.
 *
 * THE OWNER: he has an idea and does not want to build it on another
 * site's theme, unless he gives a design philosophy. So a new site starts
 * from a theme rolled here, and one object drives everything the sample
 * page wears (`starterPage.ts`): its colours, its two fonts, its type scale,
 * its spacing, its corners, borders and shadows (with one light direction
 * for the whole site), its buttons, its density, how its header, first
 * screen and footer are laid out, and how it moves.
 *
 * Five groups, each lockable so a roll keeps what he likes:
 *
 *   · colours: a base hue, a harmony rule (analogous, complementary,
 *     triadic, split complementary, or a single colour), light, dark or mid,
 *     and how strong the colour is. The roles are made in OKLCH (the OKLab
 *     Lightness-Chroma-Hue colour space), where lightness is what the eye
 *     reads, so a text colour is moved in lightness until it reads at 4.5
 *     to 1 against what it sits on, never guessed;
 *   · fonts: one of a list of pairings, at most two faces;
 *   · shapes: corners, border, shadow style, where the light comes from,
 *     button size and shape;
 *   · layout: type scale ratio, spacing step, density, and the header, first
 *     screen and footer variants, and how many cards in a row;
 *   · motion: calm, bouncy or snappy.
 *
 * The coherence rules always hold (`coherence`): words against what they
 * sit on at least 4.5 to 1, one accent family, one radius family, one shadow
 * direction, every space on one scale.
 *
 * FAMILIAR TO ORIGINAL. One slider. At Familiar a roll starts from a style
 * kit already captured (`styleKits.ts`) and the pairings people already know;
 * towards Original it measures its distance from every captured kit in theme
 * space (`kitDistance`) and keeps only rolls past a minimum distance.
 *
 * A DESIGN PHILOSOPHY in his words ("brutalist newspaper, hard shadows, one
 * loud colour") narrows each group's ranges (`readPhilosophy`), and rolls
 * stay inside them. Rule-based: words he types that no rule knows are said
 * back to him as not understood rather than guessed at.
 *
 * Pure: no React, no store, no browser. Seeded, so a roll can be made again.
 */
import type { StyleKit } from "./look/index.ts";

/* ------------------------------------------------------------------ */
/* The record                                                           */
/* ------------------------------------------------------------------ */

export type Harmony = "analogous" | "complementary" | "triadic" | "split" | "mono";
export type Mode = "light" | "dark" | "mid";
export type ShadowStyle = "none" | "soft" | "hard" | "glow";
export type Corner = "square" | "soft" | "round" | "pill";
export type Border = "none" | "hairline" | "bold";
export type Density = "airy" | "balanced" | "dense";
export type MotionStyle = "calm" | "bouncy" | "snappy";
export type HeaderLayout = "split" | "centred" | "reversed";
export type HeroLayout = "left" | "centred" | "split";
export type FooterLayout = "columns" | "line" | "stacked";
export type ButtonSize = "small" | "medium" | "large";
export type ButtonShape = "match" | "pill" | "square";

export const HARMONIES: readonly Harmony[] = ["analogous", "complementary", "triadic", "split", "mono"];
export const MODES: readonly Mode[] = ["light", "dark", "mid"];
export const SHADOWS: readonly ShadowStyle[] = ["none", "soft", "hard", "glow"];
export const CORNERS: readonly Corner[] = ["square", "soft", "round", "pill"];
export const BORDERS: readonly Border[] = ["none", "hairline", "bold"];
export const DENSITIES: readonly Density[] = ["airy", "balanced", "dense"];
export const MOTIONS: readonly MotionStyle[] = ["calm", "bouncy", "snappy"];
export const HEADERS: readonly HeaderLayout[] = ["split", "centred", "reversed"];
export const HEROES: readonly HeroLayout[] = ["left", "centred", "split"];
export const FOOTERS: readonly FooterLayout[] = ["columns", "line", "stacked"];
export const BUTTON_SIZES: readonly ButtonSize[] = ["small", "medium", "large"];
export const BUTTON_SHAPES: readonly ButtonShape[] = ["match", "pill", "square"];
/** Type scale ratios: minor third, major third, perfect fourth, augmented fourth, perfect fifth. */
export const SCALES: readonly number[] = [1.2, 1.25, 1.333, 1.414, 1.5];
/** Spacing steps in px: every gap and padding is a whole number of these. */
export const STEPS: readonly number[] = [4, 6, 8];
/** Where the light comes from, in degrees: 0 from above, 90 from the right, clockwise. Shadows fall the other way. */
export const LIGHTS: readonly number[] = [0, 45, 90, 135, 180, 225, 270, 315];
/** How strong the colour is: OKLCH chroma of the accent. */
export const CHROMAS: readonly number[] = [0.07, 0.11, 0.15, 0.19];
/** Base hues are rolled on a 5° step. */
export const HUE_STEP = 5;

export type Group = "colours" | "fonts" | "shapes" | "layout" | "motion";
export const GROUPS: readonly Group[] = ["colours", "fonts", "shapes", "layout", "motion"];
export const GROUP_LABEL: Record<Group, string> = { colours: "Colours", fonts: "Fonts", shapes: "Shapes", layout: "Spacing and arrangement", motion: "Motion" };

export interface SiteTheme {
  version: 1;
  /** Plain words for it: "warm triadic, hard shadows". */
  name: string;
  seed: number;
  colours: { hue: number; harmony: Harmony; mode: Mode; chroma: number };
  fonts: { pairing: string };
  shapes: { corner: Corner; border: Border; shadow: ShadowStyle; light: number; buttonSize: ButtonSize; buttonShape: ButtonShape };
  layout: { scale: number; step: number; density: Density; header: HeaderLayout; hero: HeroLayout; footer: FooterLayout; cards: 3 | 4 };
  motion: { style: MotionStyle };
  /** How it was made, so the panel can say so. */
  made?: { originality: number; from?: string | null; philosophy?: string | null; distance?: number | null };
}

/* ------------------------------------------------------------------ */
/* Fonts                                                                */
/* ------------------------------------------------------------------ */

export interface Pairing {
  id: string;
  /** Plain: "A bookish serif over a clean sans". */
  name: string;
  heading: string;
  body: string;
  headingWeight: number;
  /** Headings in capitals. */
  caps?: boolean;
  /** Words a philosophy can ask for it by. */
  tags: string[];
  /** A pairing people already know well (Familiar). */
  known: boolean;
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace";

/**
 * At most two faces per site, each a stack every computer has, so the
 * published page shows what the board shows with nothing to fetch.
 */
export const PAIRINGS: readonly Pairing[] = [
  { id: "serif-sans", name: "A bookish serif over a clean sans", heading: SERIF, body: SANS, headingWeight: 700, tags: ["editorial", "newspaper", "classic", "serif", "magazine", "bookish"], known: true },
  { id: "sans-sans", name: "One clean sans for everything", heading: SANS, body: SANS, headingWeight: 800, tags: ["clean", "modern", "minimal", "simple", "swiss"], known: true },
  { id: "grotesk-serif", name: "A heavy grotesque over a reading serif", heading: "'Arial Black', 'Helvetica Neue', Arial, sans-serif", body: SERIF, headingWeight: 900, tags: ["bold", "loud", "poster", "newspaper", "brutalist"], known: true },
  { id: "mono-sans", name: "A typewriter face over a clean sans", heading: MONO, body: SANS, headingWeight: 700, tags: ["technical", "code", "terminal", "brutalist", "retro", "developer"], known: false },
  { id: "mono-mono", name: "Typewriter all the way down", heading: MONO, body: MONO, headingWeight: 700, caps: true, tags: ["terminal", "brutalist", "raw", "code", "zine"], known: false },
  { id: "condensed-sans", name: "Tall condensed capitals over a sans", heading: "Impact, 'Arial Narrow', 'Franklin Gothic Medium', sans-serif", body: SANS, headingWeight: 700, caps: true, tags: ["poster", "loud", "sport", "bold", "newspaper"], known: false },
  { id: "elegant-serif", name: "A fine serif for both", heading: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", body: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif", headingWeight: 400, tags: ["elegant", "luxury", "calm", "classic", "wedding", "gentle"], known: true },
  { id: "humanist", name: "A friendly humanist sans", heading: "'Trebuchet MS', 'Gill Sans', 'Segoe UI', sans-serif", body: "'Segoe UI', 'Trebuchet MS', Verdana, sans-serif", headingWeight: 700, tags: ["friendly", "warm", "playful", "soft", "community"], known: true },
  { id: "rounded", name: "A rounded sans, soft at the edges", heading: "ui-rounded, 'Arial Rounded MT Bold', 'Nunito', 'Varela Round', system-ui, sans-serif", body: SANS, headingWeight: 800, tags: ["playful", "soft", "bouncy", "cute", "toy", "friendly"], known: false },
  { id: "verdana-georgia", name: "A wide screen sans over Georgia", heading: "Verdana, Geneva, Tahoma, sans-serif", body: SERIF, headingWeight: 700, tags: ["web", "retro", "readable", "editorial"], known: true },
  { id: "didone-mono", name: "A high-contrast serif over a typewriter face", heading: "Didot, 'Bodoni MT', 'Bodoni 72', Georgia, serif", body: MONO, headingWeight: 700, tags: ["fashion", "editorial", "luxury", "magazine", "art"], known: false },
  { id: "tahoma-tight", name: "A tight utility sans", heading: "Tahoma, Verdana, 'Segoe UI', sans-serif", body: "Tahoma, Verdana, 'Segoe UI', sans-serif", headingWeight: 700, caps: true, tags: ["utility", "dense", "dashboard", "technical", "swiss"], known: false },
];

export const pairingOf = (id: string): Pairing => PAIRINGS.find((p) => p.id === id) ?? PAIRINGS[0]!;

/* ------------------------------------------------------------------ */
/* Colour, in OKLCH                                                     */
/* ------------------------------------------------------------------ */

export interface Oklch { l: number; c: number; h: number }
type Rgb = [number, number, number];

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
}
const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
/** The colour, its chroma lowered until a screen can show it. */
export function fit(col: Oklch): Oklch {
  let c = col.c;
  while (c > 0 && !inGamut(oklchToLinear({ ...col, c }))) c = Math.max(0, c - 0.004);
  return { l: col.l, c: +c.toFixed(4), h: col.h };
}
const enc = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
/** As `rgb()`, the form every part and every check reads. */
export function rgbOf(col: Oklch): string {
  const [r, g, b] = oklchToLinear(fit(col)).map(enc) as Rgb;
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}
/** Relative luminance (WCAG), 0..1. */
export function lumOf(col: Oklch): number {
  const lin = oklchToLinear(fit(col)).map((v) => { const e = enc(v); return e <= 0.03928 ? e / 12.92 : ((e + 0.055) / 1.055) ** 2.4; }) as Rgb;
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
export const contrast = (a: Oklch, b: Oklch): number => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Contrast of two `rgb()` strings. */
export function contrastRgb(a: string, b: string): number {
  const p = (s: string) => (/(\d+)\D+(\d+)\D+(\d+)/.exec(s) ?? []).slice(1).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const L = (v: number[]) => 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
  const x = L(p(a)), y = L(p(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Words need this, and a little over it so rounding to `rgb()` never drops below. */
export const READABLE = 4.5;
const TARGET = 4.7;

/** A colour moved in lightness, toward `dark` or light, until it reads against `on`. */
export function readableOn(col: Oklch, on: Oklch, dark: boolean): Oklch {
  let c = { ...col };
  for (let i = 0; i < 200 && contrast(c, on) < TARGET; i++) c = { ...c, l: Math.max(0, Math.min(1, c.l + (dark ? -0.01 : 0.01))) };
  if (contrast(c, on) < TARGET) c = { ...c, l: dark ? 0 : 1, c: 0 };
  return fit(c);
}

/** The hues a harmony rule gives, the base first. */
export function harmonyHues(hue: number, h: Harmony): number[] {
  const at = (d: number) => (hue + d + 360) % 360;
  switch (h) {
    case "analogous": return [hue, at(30), at(-30)];
    case "complementary": return [hue, at(180)];
    case "triadic": return [hue, at(120), at(240)];
    case "split": return [hue, at(150), at(210)];
    case "mono": return [hue];
  }
}

/** Everything the theme's colours come to: the six roles a site has, the ink on the accent, and a tint per card. */
export interface ThemeColours {
  bg: string; surface: string; text: string; muted: string; accent: string; highlight: string;
  /** Words on the accent. */
  onAccent: string;
  /** The line a border draws. */
  line: string;
  /** Hard shadows are drawn in this. */
  ink: string;
  /** One fill per card, from the harmony, each with the words that read on it. */
  cards: { fill: string; text: string }[];
  /** The harmony's hues, the accent family every chromatic colour is drawn from. */
  hues: number[];
}

export function themeColours(t: SiteTheme): ThemeColours {
  const { hue, harmony, mode, chroma } = t.colours;
  const hues = harmonyHues(hue, harmony);
  const second = hues[1] ?? hue;
  const bgL = mode === "light" ? 0.975 : mode === "dark" ? 0.18 : 0.62;
  const bg: Oklch = fit({ l: bgL, c: mode === "mid" ? Math.min(0.09, chroma * 0.6) : 0.012, h: hue });
  const surface: Oklch = fit({ l: mode === "light" ? 0.995 : mode === "dark" ? 0.245 : 0.72, c: mode === "mid" ? Math.min(0.06, chroma * 0.4) : 0.01, h: hue });
  const darkWords = mode !== "dark";
  const text = readableOn(readableOn({ l: darkWords ? 0.22 : 0.96, c: 0.025, h: hue }, bg, darkWords), surface, darkWords);
  const muted = readableOn(readableOn({ l: darkWords ? 0.42 : 0.78, c: 0.03, h: hue }, bg, darkWords), surface, darkWords);
  // The accent, and the words on it: whichever of near-white or near-black reads, the accent moved until one does.
  let accent: Oklch = fit({ l: mode === "dark" ? 0.74 : mode === "mid" ? 0.42 : 0.58, c: chroma, h: hue });
  const light: Oklch = { l: 0.99, c: 0.005, h: hue }, deep: Oklch = { l: 0.16, c: 0.02, h: hue };
  for (let i = 0; i < 60 && Math.max(contrast(light, accent), contrast(deep, accent)) < TARGET; i++) accent = fit({ ...accent, l: accent.l + (contrast(light, accent) >= contrast(deep, accent) ? -0.01 : 0.01) });
  const onAccent = contrast(light, accent) >= contrast(deep, accent) ? light : deep;
  const highlight = fit({ l: mode === "dark" ? 0.78 : mode === "mid" ? 0.82 : 0.62, c: chroma * 0.9, h: second });
  const line: Oklch = fit({ l: darkWords ? 0.2 : 0.9, c: 0.02, h: hue });
  const ink: Oklch = mode === "dark" ? fit({ l: 0.06, c: 0.01, h: hue }) : fit({ l: 0.16, c: 0.03, h: hue });
  // Cards take the harmony's hues in turn, as soft fills the words still read on.
  const cards = [0, 1, 2, 3].map((i) => {
    const h = hues[i % hues.length]!;
    const fill = harmony === "mono"
      ? fit({ l: mode === "dark" ? 0.27 + i * 0.02 : mode === "mid" ? 0.74 + i * 0.03 : 0.93 - i * 0.015, c: chroma * 0.35, h })
      : fit({ l: mode === "dark" ? 0.3 : mode === "mid" ? 0.8 : 0.92, c: chroma * (mode === "dark" ? 0.5 : 0.4), h });
    const dark = lumOf(fill) > 0.18;
    const words = readableOn({ l: dark ? 0.25 : 0.95, c: 0.025, h: hue }, fill, dark);
    return { fill: rgbOf(fill), text: rgbOf(words) };
  });
  return {
    bg: rgbOf(bg), surface: rgbOf(surface), text: rgbOf(text), muted: rgbOf(muted), accent: rgbOf(accent), highlight: rgbOf(highlight),
    onAccent: rgbOf(onAccent), line: rgbOf(line), ink: rgbOf(ink), cards, hues,
  };
}

/* ------------------------------------------------------------------ */
/* Shapes, spacing, type, motion                                        */
/* ------------------------------------------------------------------ */

/** The one radius family: the radius for a box, and the smaller one for things inside it. */
export function radii(t: SiteTheme): { box: number; small: number; button: number } {
  const box = { square: 0, soft: 6, round: 16, pill: 28 }[t.shapes.corner];
  const small = { square: 0, soft: 4, round: 10, pill: 999 }[t.shapes.corner];
  const button = t.shapes.buttonShape === "pill" || t.shapes.corner === "pill" ? 999 : t.shapes.buttonShape === "square" ? 0 : small;
  return { box, small, button };
}
/** Every radius a starter page may use: its family. */
export const radiusFamily = (t: SiteTheme): number[] => { const r = radii(t); return [...new Set([0, r.box, r.small, r.button])]; };

export const borderWidth = (t: SiteTheme): number => ({ none: 0, hairline: 1, bold: 3 }[t.shapes.border]);

/** Shadows fall away from the light: a unit vector pointing where the shadow goes. */
export function shadowDir(t: SiteTheme): [number, number] {
  const a = (t.shapes.light * Math.PI) / 180;
  return [+(-Math.sin(a)).toFixed(3), +Math.cos(a).toFixed(3)];
}

/** The shadow a thing `depth` deep casts, as CSS, or "" for none. One direction for the whole site. */
export function shadowCss(t: SiteTheme, c: ThemeColours, depth: 1 | 2 | 3): string {
  const [x, y] = shadowDir(t);
  const k = { 1: 3, 2: 6, 3: 10 }[depth];
  const px = (v: number) => `${Math.round(v)}px`;
  switch (t.shapes.shadow) {
    case "none": return "";
    case "hard": return `${c.ink} ${px(x * k)} ${px(y * k)} 0px 0px`;
    case "soft": return `rgba(0, 0, 0, ${t.colours.mode === "dark" ? 0.45 : 0.16}) ${px(x * k)} ${px(y * k)} ${px(k * 3)} 0px`;
    case "glow": return `${c.accent.replace("rgb(", "rgba(").replace(")", ", 0.55)")} 0px 0px ${px(k * 2.5)} 0px`;
  }
}

/** Type sizes on the scale: step 0 is the body, each step up multiplies by the ratio. */
export function typeSize(t: SiteTheme, step: number): number {
  const base = t.layout.density === "dense" ? 15 : t.layout.density === "airy" ? 18 : 16;
  return Math.round(base * t.layout.scale ** step);
}

/** A space of `n` steps, density folded into how many steps a gap is. */
export function space(t: SiteTheme, n: number): number {
  const k = t.layout.density === "airy" ? 1.5 : t.layout.density === "dense" ? 0.75 : 1;
  return Math.max(1, Math.round(n * k)) * t.layout.step;
}

/** How the site moves under the hand: a transition, a hover and a press. */
export function motionOf(t: SiteTheme): { duration: string; timing: string; lift: string; press: string } {
  switch (t.motion.style) {
    case "calm": return { duration: "0.4s", timing: "ease", lift: "translateY(-2px)", press: "translateY(0px)" };
    case "bouncy": return { duration: "0.35s", timing: "cubic-bezier(0.34, 1.56, 0.64, 1)", lift: "translateY(-4px) scale(1.03)", press: "scale(0.95)" };
    case "snappy": return { duration: "0.12s", timing: "ease-out", lift: "translate(-2px, -2px)", press: "translate(1px, 1px)" };
  }
}

/* ------------------------------------------------------------------ */
/* Rolling                                                              */
/* ------------------------------------------------------------------ */

/** A small seeded generator (mulberry32): the same seed rolls the same theme. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]!;

/**
 * The ranges a roll stays inside: each a list of what may be picked. A
 * philosophy narrows them; nothing narrows them by default.
 */
export interface Ranges {
  hues?: number[];
  harmony?: Harmony[];
  mode?: Mode[];
  chroma?: number[];
  pairing?: string[];
  corner?: Corner[];
  border?: Border[];
  shadow?: ShadowStyle[];
  light?: number[];
  buttonSize?: ButtonSize[];
  buttonShape?: ButtonShape[];
  scale?: number[];
  step?: number[];
  density?: Density[];
  header?: HeaderLayout[];
  hero?: HeroLayout[];
  footer?: FooterLayout[];
  motion?: MotionStyle[];
}

const ALL_HUES = Array.from({ length: 360 / HUE_STEP }, (_, i) => i * HUE_STEP);

/** One group rolled, inside its ranges. */
function rollGroup(g: Group, r: () => number, R: Ranges): Partial<SiteTheme> {
  switch (g) {
    case "colours": return { colours: { hue: pick(r, R.hues?.length ? R.hues : ALL_HUES), harmony: pick(r, R.harmony ?? HARMONIES), mode: pick(r, R.mode ?? MODES), chroma: pick(r, R.chroma ?? CHROMAS) } };
    case "fonts": return { fonts: { pairing: pick(r, R.pairing?.length ? R.pairing : PAIRINGS.map((p) => p.id)) } };
    case "shapes": return { shapes: { corner: pick(r, R.corner ?? CORNERS), border: pick(r, R.border ?? BORDERS), shadow: pick(r, R.shadow ?? SHADOWS), light: pick(r, R.light ?? LIGHTS), buttonSize: pick(r, R.buttonSize ?? BUTTON_SIZES), buttonShape: pick(r, R.buttonShape ?? BUTTON_SHAPES) } };
    case "layout": return { layout: { scale: pick(r, R.scale ?? SCALES), step: pick(r, R.step ?? STEPS), density: pick(r, R.density ?? DENSITIES), header: pick(r, R.header ?? HEADERS), hero: pick(r, R.hero ?? HEROES), footer: pick(r, R.footer ?? FOOTERS), cards: r() < 0.5 ? 3 : 4 } };
    case "motion": return { motion: { style: pick(r, R.motion ?? MOTIONS) } };
  }
}

/* ------------------------------------------------------------------ */
/* Theme space: distance from what has been captured                    */
/* ------------------------------------------------------------------ */

/**
 * A look as a point: where its accent sits in colour (OKLab's a and b, so
 * hue and strength together), how round its corners are, how heavy its
 * border, and its shadow (kind and depth). The same point is read off a
 * theme and off a captured kit, so the two can be measured against each
 * other.
 */
export type Point = number[];
const SHADOW_AT: Record<ShadowStyle, number[]> = { none: [0, 0, 0], soft: [1, 0, 0], hard: [0, 1, 0], glow: [0, 0, 1] };

function labOf(rgb: string): [number, number, number] {
  const v = (/(\d+)\D+(\d+)\D+(\d+)/.exec(rgb) ?? []).slice(1).map((x) => { const c = Number(x) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  if (v.length < 3) return [0, 0, 0];
  const [r, g, b] = v as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363337705 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function point(accent: string, radiusShare: number, border: number, shadow: ShadowStyle, depth: number): Point {
  const [L, a, b] = labOf(accent);
  return [a * 3, b * 3, L * 0.5, Math.min(1, radiusShare), Math.min(4, border) / 4, ...SHADOW_AT[shadow].map((v) => v * 0.6), Math.min(14, depth) / 14];
}

export function themePoint(t: SiteTheme): Point {
  const c = themeColours(t);
  const share = t.shapes.buttonShape === "pill" ? 1 : t.shapes.buttonShape === "square" ? 0 : ({ square: 0, soft: 0.2, round: 0.5, pill: 1 } as const)[t.shapes.corner];
  return point(c.accent, share, borderWidth(t), t.shapes.shadow, t.shapes.shadow === "none" ? 0 : 6);
}

export function kitPoint(k: StyleKit): Point {
  const s = k.shadows[0];
  const shadow: ShadowStyle = !s ? "none" : s.hard ? "hard" : s.dx === 0 && s.dy === 0 ? "glow" : "soft";
  const colour = k.fill.kind === "none" ? (k.border?.colour ?? "rgb(128, 128, 128)") : k.fill.colour;
  return point(/rgb/.test(colour) ? colour : "rgb(128, 128, 128)", k.radiusShare, k.border?.width ?? 0, shadow, s ? Math.hypot(s.dx, s.dy) : 0);
}

const dist = (a: Point, b: Point) => Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0));

/** How far a theme is from the nearest captured kit, and which. */
export function kitDistance(t: SiteTheme, kits: readonly StyleKit[]): { distance: number; nearest: string | null } {
  if (!kits.length) return { distance: Infinity, nearest: null };
  const p = themePoint(t);
  let best = Infinity, name: string | null = null;
  for (const k of kits) { const d = dist(p, kitPoint(k)); if (d < best) { best = d; name = k.name; } }
  return { distance: +best.toFixed(3), nearest: name };
}

/** How far an Original roll must be from every captured kit. */
export const ORIGINAL_DISTANCE = 0.32;
/** The minimum distance a roll must keep at a point on the slider (0 Familiar, 1 Original). */
export const minDistanceAt = (originality: number): number => (originality <= 0.5 ? 0 : +((originality - 0.5) * 2 * ORIGINAL_DISTANCE).toFixed(3));

/** A theme's groups read off a captured kit: its colour, corners, border and shadow, for a Familiar roll. */
function fromKit(k: StyleKit, r: () => number): { colours: Partial<SiteTheme["colours"]>; shapes: Partial<SiteTheme["shapes"]> } {
  const [L, a, b] = labOf(k.fill.kind === "none" ? (k.border?.colour ?? "rgb(128,128,128)") : k.fill.colour);
  void L;
  const hue = Math.round((((Math.atan2(b, a) * 180) / Math.PI + 360) % 360) / HUE_STEP) * HUE_STEP % 360;
  const chroma = CHROMAS.reduce((best, c) => (Math.abs(c - Math.hypot(a, b)) < Math.abs(best - Math.hypot(a, b)) ? c : best), CHROMAS[1]!);
  const s = k.shadows[0];
  const shadow: ShadowStyle = !s ? "none" : s.hard ? "hard" : s.dx === 0 && s.dy === 0 ? "glow" : "soft";
  const corner: Corner = k.radiusShare >= 0.9 ? "pill" : k.radiusShare >= 0.35 ? "round" : k.radiusShare > 0.05 ? "soft" : "square";
  const border: Border = !k.border ? "none" : k.border.width >= 2 ? "bold" : "hairline";
  // The kit's light: its shadow falls one way, so the light comes from the other.
  const light = s && (s.dx || s.dy) ? (Math.round(((Math.atan2(-s.dx, s.dy) * 180) / Math.PI + 360) % 360 / 45) * 45) % 360 : pick(r, LIGHTS);
  return { colours: { hue, chroma }, shapes: { shadow, corner, border, light, buttonShape: "match" } };
}

export interface RollOptions {
  seed: number;
  /** The theme before, for locked groups. */
  prev?: SiteTheme | null;
  locks?: readonly Group[];
  /** 0 Familiar … 1 Original. */
  originality?: number;
  /** Captured kits from every board, for Familiar to start from and Original to keep away from. */
  kits?: readonly StyleKit[];
  ranges?: Ranges;
  philosophy?: string | null;
}

/**
 * A new theme. Locked groups are kept from `prev`; the rest are rolled inside
 * the ranges. Towards Familiar a roll starts from a captured kit and a known
 * pairing; towards Original it is rolled again until it is far enough from
 * every captured kit (up to a few hundred tries, then the farthest one).
 */
export function rollTheme(o: RollOptions): SiteTheme {
  const originality = Math.max(0, Math.min(1, o.originality ?? 0.5));
  const kits = o.kits ?? [];
  const locks = new Set(o.locks ?? []);
  const R = o.ranges ?? {};
  const need = minDistanceAt(originality);
  const r = rng(o.seed);
  let best: SiteTheme | null = null, bestD = -1;
  for (let tries = 0; tries < 400; tries++) {
    let t = baseTheme(o.seed);
    for (const g of GROUPS) t = { ...t, ...(locks.has(g) && o.prev ? { [g]: o.prev[g] } : rollGroup(g, r, R)) } as SiteTheme;
    let from: string | null = null;
    // Familiar: start from a captured kit, with a known pairing.
    if (kits.length && r() < 1 - originality * 2) {
      const k = pick(r, kits);
      const f = fromKit(k, r);
      from = k.name;
      if (!locks.has("colours") && !R.hues?.length) t = { ...t, colours: { ...t.colours, ...f.colours } };
      if (!locks.has("shapes")) t = { ...t, shapes: { ...t.shapes, ...keepIn(f.shapes, R) } };
      if (!locks.has("fonts") && !R.pairing?.length) t = { ...t, fonts: { pairing: pick(r, PAIRINGS.filter((p) => p.known).map((p) => p.id)) } };
    }
    t = settle(t);
    const d = kits.length ? kitDistance(t, kits).distance : Infinity;
    const done = { ...t, name: themeName(t), made: { originality, from, philosophy: o.philosophy ?? null, distance: Number.isFinite(d) ? d : null } };
    if (d >= need) return done;
    if (d > bestD) { bestD = d; best = done; }
  }
  return best!;
}

/** A Familiar kit's shapes, kept only where the ranges allow them. */
function keepIn(s: Partial<SiteTheme["shapes"]>, R: Ranges): Partial<SiteTheme["shapes"]> {
  const out: Partial<SiteTheme["shapes"]> = {};
  if (s.shadow && (!R.shadow || R.shadow.includes(s.shadow))) out.shadow = s.shadow;
  if (s.corner && (!R.corner || R.corner.includes(s.corner))) out.corner = s.corner;
  if (s.border && (!R.border || R.border.includes(s.border))) out.border = s.border;
  if (s.light != null && (!R.light || R.light.includes(s.light))) out.light = s.light;
  if (s.buttonShape && (!R.buttonShape || R.buttonShape.includes(s.buttonShape))) out.buttonShape = s.buttonShape;
  return out;
}

/**
 * The few combinations that cannot be coherent, put right: a glow needs a
 * page dark enough to glow on, so on a light page it is a soft shadow.
 */
function settle(t: SiteTheme): SiteTheme {
  if (t.shapes.shadow === "glow" && t.colours.mode === "light") return { ...t, shapes: { ...t.shapes, shadow: "soft" } };
  return t;
}

/** The theme a new site opens with before any roll: calm, light, readable. */
export function baseTheme(seed = 1): SiteTheme {
  const t: SiteTheme = {
    version: 1, name: "", seed,
    colours: { hue: 250, harmony: "analogous", mode: "light", chroma: 0.15 },
    fonts: { pairing: "serif-sans" },
    shapes: { corner: "round", border: "hairline", shadow: "soft", light: 0, buttonSize: "medium", buttonShape: "match" },
    layout: { scale: 1.25, step: 8, density: "balanced", header: "split", hero: "left", footer: "columns", cards: 3 },
    motion: { style: "calm" },
  };
  return { ...t, name: themeName(t) };
}

/* ------------------------------------------------------------------ */
/* Names                                                                */
/* ------------------------------------------------------------------ */

export function hueWord(h: number): string {
  if (h < 20 || h >= 340) return "red";
  if (h < 50) return "orange";
  if (h < 75) return "amber";
  if (h < 105) return "yellow";
  if (h < 160) return "green";
  if (h < 200) return "teal";
  if (h < 250) return "blue";
  if (h < 290) return "violet";
  return "pink";
}
const warmth = (h: number) => (h < 90 || h >= 330 ? "warm" : h >= 160 && h < 290 ? "cool" : hueWord(h));
const HARMONY_WORD: Record<Harmony, string> = { analogous: "analogous", complementary: "complementary", triadic: "triadic", split: "split complementary", mono: "single-colour" };
const SHADOW_WORD: Record<ShadowStyle, string> = { none: "no shadows", soft: "soft shadows", hard: "hard shadows", glow: "glowing edges" };

/** "warm triadic, hard shadows"; "dark cool analogous, soft shadows". */
export function themeName(t: SiteTheme): string {
  const mode = t.colours.mode === "light" ? "" : `${t.colours.mode} `;
  return `${mode}${warmth(t.colours.hue)} ${HARMONY_WORD[t.colours.harmony]}, ${SHADOW_WORD[t.shapes.shadow]}`;
}

/** What a roll is called in the undo list. */
export const rollName = (t: SiteTheme): string => `Randomize theme: ${t.name}`;

/* ------------------------------------------------------------------ */
/* A design philosophy, in his words                                    */
/* ------------------------------------------------------------------ */

const hueRange = (from: number, to: number) => ALL_HUES.filter((h) => (from <= to ? h >= from && h <= to : h >= from || h <= to));

/** Each rule: the words that call it, and what it narrows. Read in order; later words narrow further. */
const RULES: { words: RegExp; says: string; ranges: Ranges }[] = [
  { words: /\bbrutal(ist|ism)?\b/, says: "brutalist: square corners, bold borders, hard shadows, typewriter or heavy faces, snappy", ranges: { corner: ["square"], border: ["bold"], shadow: ["hard"], pairing: ["mono-sans", "mono-mono", "grotesk-serif", "condensed-sans"], motion: ["snappy"], buttonShape: ["square"] } },
  { words: /\b(newspaper|editorial|magazine|journal|press)\b/, says: "editorial: a serif or heavy face, a type scale with contrast, dense", ranges: { pairing: ["serif-sans", "grotesk-serif", "condensed-sans", "didone-mono", "verdana-georgia"], scale: [1.333, 1.414, 1.5], density: ["dense", "balanced"] } },
  { words: /\bhard[- ]?shadows?\b/, says: "hard shadows", ranges: { shadow: ["hard"] } },
  { words: /\bsoft[- ]?shadows?\b|\bsoft\b/, says: "soft shadows", ranges: { shadow: ["soft"] } },
  { words: /\bno shadows?\b|\bflat\b/, says: "no shadows", ranges: { shadow: ["none"] } },
  { words: /\b(glow|neon|cyber)\w*\b/, says: "glowing edges on a dark page", ranges: { shadow: ["glow"], mode: ["dark"], chroma: [0.19] } },
  { words: /\bone (loud|bold|bright|strong) colou?r\b|\bsingle colou?r\b|\bmonochrom\w*\b/, says: "one colour, loud", ranges: { harmony: ["mono"], chroma: [0.19] } },
  { words: /\b(loud|bold|vivid|bright|vibrant)\b/, says: "strong colour", ranges: { chroma: [0.15, 0.19] } },
  { words: /\b(muted|quiet|subtle|pastel|dusty)\b/, says: "quiet colour", ranges: { chroma: [0.07, 0.11] } },
  { words: /\b(dark|night|moody|noir)\b/, says: "a dark page", ranges: { mode: ["dark"] } },
  { words: /\b(light|bright page|airy|paper|white)\b/, says: "a light page", ranges: { mode: ["light"] } },
  { words: /\b(minimal|minimalist|clean|simple|swiss)\b/, says: "minimal: no shadows, hairlines, airy, calm", ranges: { shadow: ["none"], border: ["hairline", "none"], density: ["airy"], motion: ["calm"] } },
  { words: /\b(playful|fun|toy|cute|bouncy|cartoon)\b/, says: "playful: round corners, bouncy", ranges: { corner: ["round", "pill"], motion: ["bouncy"], pairing: ["rounded", "humanist", "condensed-sans"] } },
  { words: /\b(calm|gentle|serene|slow)\b/, says: "calm motion", ranges: { motion: ["calm"] } },
  { words: /\b(snappy|fast|quick|sharp)\b/, says: "snappy motion", ranges: { motion: ["snappy"] } },
  { words: /\b(luxury|luxurious|elegant|premium|fashion)\b/, says: "elegant: a fine serif, thin lines, airy", ranges: { pairing: ["elegant-serif", "didone-mono"], border: ["hairline"], density: ["airy"], corner: ["square", "soft"] } },
  { words: /\b(retro|pixel|arcade|terminal|code|hacker)\b/, says: "retro: a typewriter face, hard edges", ranges: { pairing: ["mono-sans", "mono-mono", "tahoma-tight"], corner: ["square", "soft"], shadow: ["hard", "none"] } },
  { words: /\b(round|rounded|pill|bubbly)\b/, says: "round corners", ranges: { corner: ["round", "pill"] } },
  { words: /\b(square|boxy|angular)\b/, says: "square corners", ranges: { corner: ["square"] } },
  { words: /\b(dense|compact|packed)\b/, says: "dense", ranges: { density: ["dense"] } },
  { words: /\b(spacious|roomy|breathing)\b/, says: "airy", ranges: { density: ["airy"] } },
  { words: /\bwarm\b/, says: "warm hues", ranges: { hues: hueRange(330, 85) } },
  { words: /\bcool\b|\bcold\b/, says: "cool hues", ranges: { hues: hueRange(160, 290) } },
  { words: /\bred\b/, says: "red", ranges: { hues: hueRange(350, 20) } },
  { words: /\borange\b/, says: "orange", ranges: { hues: hueRange(25, 50) } },
  { words: /\b(yellow|gold|golden)\b/, says: "yellow", ranges: { hues: hueRange(70, 100) } },
  { words: /\bgreen\b/, says: "green", ranges: { hues: hueRange(120, 155) } },
  { words: /\b(teal|cyan|turquoise)\b/, says: "teal", ranges: { hues: hueRange(170, 200) } },
  { words: /\bblue\b/, says: "blue", ranges: { hues: hueRange(220, 260) } },
  { words: /\b(purple|violet)\b/, says: "violet", ranges: { hues: hueRange(270, 300) } },
  { words: /\bpink\b/, says: "pink", ranges: { hues: hueRange(320, 350) } },
];

/** Words that carry no direction: never reported as not understood. */
const FILLER = new Set(["a", "an", "the", "and", "with", "of", "in", "on", "but", "very", "some", "like", "feel", "feels", "style", "look", "site", "page", "colour", "color", "colours", "colors", "shadows", "shadow", "one", "loud", "bold", "hard", "soft", "no", "it", "my", "to", "for", "kind", "sort", "more", "less", "lots", "bit", "little"]);

export interface Philosophy {
  ranges: Ranges;
  /** What was understood, in plain words. */
  understood: string[];
  /** Words no rule knew. */
  unknown: string[];
}

/** A design philosophy read into ranges: each rule whose words appear narrows its groups; two rules on one group keep what both allow. */
export function readPhilosophy(text: string | null | undefined): Philosophy {
  const s = ` ${(text ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ")} `;
  const ranges: Ranges = {};
  const understood: string[] = [];
  const used = new Set<string>();
  for (const rule of RULES) {
    const m = s.match(new RegExp(rule.words.source, "g"));
    if (!m) continue;
    m.forEach((w) => w.split(/[\s-]+/).forEach((x) => used.add(x)));
    understood.push(rule.says);
    for (const [k, v] of Object.entries(rule.ranges) as [keyof Ranges, unknown[]][]) {
      const had = ranges[k] as unknown[] | undefined;
      const both = had ? had.filter((x) => v.includes(x)) : v;
      // Two rules that disagree: the later one wins rather than leaving nothing to pick.
      (ranges as Record<string, unknown[]>)[k] = both.length ? both : v;
    }
  }
  const unknown = s.trim().split(/\s+/).filter((w) => w && !used.has(w) && !FILLER.has(w) && !/^\d+$/.test(w));
  return { ranges, understood, unknown: [...new Set(unknown)] };
}

/** How many choices a group has when nothing narrows it: the generator's reach, by group. */
export function themeCounts(): Record<Group, number> & { total: number } {
  const colours = (360 / HUE_STEP) * HARMONIES.length * MODES.length * CHROMAS.length;
  const fonts = PAIRINGS.length;
  // A glow on a light page is settled to a soft shadow, so it is not a theme of its own.
  const shapes = CORNERS.length * BORDERS.length * SHADOWS.length * LIGHTS.length * BUTTON_SIZES.length * BUTTON_SHAPES.length;
  const layout = SCALES.length * STEPS.length * DENSITIES.length * HEADERS.length * HEROES.length * FOOTERS.length * 2;
  const motion = MOTIONS.length;
  const glowLight = (360 / HUE_STEP) * HARMONIES.length * CHROMAS.length * fonts * (CORNERS.length * BORDERS.length * LIGHTS.length * BUTTON_SIZES.length * BUTTON_SHAPES.length) * layout * motion;
  return { colours, fonts, shapes, layout, motion, total: colours * fonts * shapes * layout * motion - glowLight };
}

/* ------------------------------------------------------------------ */
/* Coherence                                                            */
/* ------------------------------------------------------------------ */

/** A part on the starter page, as far as coherence reads it. */
export interface CoherentPart {
  id: string;
  /** The colour its words are drawn in, and what they sit on. */
  words?: { colour: string; on: string } | null;
  radius?: number | null;
  shadow?: string | null;
  /** Every space it uses: its padding and the gaps it leaves. */
  spaces?: number[];
  /** Chromatic fills it uses, for the accent family. */
  fills?: string[];
}

function hueOfRgb(rgb: string): { h: number; c: number } {
  const [, a, b] = labOf(rgb);
  return { h: (((Math.atan2(b, a) * 180) / Math.PI) + 360) % 360, c: Math.hypot(a, b) };
}

/**
 * Every rule a starter page lives by, checked: the words read (4.5 to 1),
 * one accent family (every strong colour within 35° of a harmony hue), one
 * radius family, one shadow direction, every space a whole number of steps.
 * Returns what failed, in plain words; empty when it all holds.
 */
export function coherence(t: SiteTheme, parts: readonly CoherentPart[]): string[] {
  const out: string[] = [];
  const family = radiusFamily(t);
  const hues = harmonyHues(t.colours.hue, t.colours.harmony);
  const dirs = new Set<string>();
  for (const p of parts) {
    if (p.words) {
      const c = contrastRgb(p.words.colour, p.words.on);
      if (c < READABLE) out.push(`${p.id}: words at ${c.toFixed(2)} to 1`);
    }
    if (p.radius != null && !family.includes(p.radius)) out.push(`${p.id}: radius ${p.radius} is not in the family ${family.join(", ")}`);
    for (const s of p.spaces ?? []) if (s % t.layout.step !== 0) out.push(`${p.id}: space ${s} is not on the ${t.layout.step}px scale`);
    for (const f of p.fills ?? []) {
      const { h, c } = hueOfRgb(f);
      if (c < 0.04) continue;
      const off = Math.min(...hues.map((x) => Math.min(Math.abs(x - h), 360 - Math.abs(x - h))));
      if (off > 35) out.push(`${p.id}: fill ${f} is ${Math.round(off)}° from the accent family`);
    }
    for (const one of (p.shadow ?? "").split(/,(?![^(]*\))/)) {
      const m = /(-?\d+)px\s+(-?\d+)px/.exec(one.replace(/rgba?\([^)]*\)/g, ""));
      if (!m) continue;
      const dx = Number(m[1]), dy = Number(m[2]);
      if (dx === 0 && dy === 0) continue;
      dirs.add(String(Math.round((Math.atan2(dy, dx) * 180) / Math.PI)));
    }
  }
  if (dirs.size > 1) out.push(`shadows fall ${dirs.size} ways: ${[...dirs].join("°, ")}°`);
  return out;
}
