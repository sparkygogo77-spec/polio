/**
 * VARIATIONS OF A SITE: WHAT ONE IS, AND HOW ONE IS ROLLED.
 *
 * J (2026-10-24): a better version of a site comes as many variations,
 * aimed at any mix of four things — cleaner, more modern, like a site he
 * names, clearer for visitors. He locks what he likes and keeps
 * randomizing the rest. Words stay his.
 *
 * A variation is the original site with six LAYERS each either left as the
 * original has it (null) or given a choice:
 *
 *   · colours   a base hue, a harmony rule and how strong the colour is;
 *               every colour token is moved onto them, keeping its lightness
 *               (so what read still reads), text held at 4.5 to 1;
 *   · type      a font pairing (`siteTheme.ts#PAIRINGS`) and a type scale:
 *               every size token snaps to base × ratio^n;
 *   · space     a spacing step, a density and a corner family: every space
 *               and corner token, and every gap in the layout tree;
 *   · layout    per section: its column centred or set left, its rows
 *               turned round (the layout tree, `layout/read.ts`);
 *   · order     the middle sections in another order (the first screen and
 *               the foot stay where they are);
 *   · motion    calm, bouncy or snappy: every duration and easing token.
 *
 * Colours, type, space and motion are System tokens (`system/*`), so every
 * part linked to a token follows. Layout and order are laid back out onto
 * the board (`relayout.ts`).
 *
 * LOCKS. A locked layer keeps the choice it has; Randomize rolls only the
 * unlocked ones. Each layer has its own seed, so a variation is made again
 * exactly from the original and its seeds (`seeds`), and locking one layer
 * can never disturb another.
 *
 * Pure: no React, no store, no browser. Every import ends in .ts, so node
 * tests load it.
 */
import { CORNERS, HARMONIES, MOTIONS, PAIRINGS, rng, type Corner, type Harmony, type MotionStyle } from "../siteTheme.ts";

export type Layer = "colours" | "type" | "space" | "layout" | "order" | "motion";
export const LAYERS: readonly Layer[] = ["colours", "type", "space", "layout", "order", "motion"];
export const LAYER_LABEL: Record<Layer, string> = {
  colours: "Colours",
  type: "Type",
  space: "Spacing and corners",
  layout: "Section layout",
  order: "Section order",
  motion: "Motion",
};

/** What J aims a batch of variations at (any mix). */
export type Aim = "cleaner" | "modern" | "like" | "clearer";
export const AIMS: readonly Aim[] = ["cleaner", "modern", "like", "clearer"];
export const AIM_LABEL: Record<Aim, string> = {
  cleaner: "Cleaner: grid, spacing, fewer one-off sizes",
  modern: "More modern: bigger type, more room",
  like: "Like a site I name",
  clearer: "Clearer for visitors: first screen, main button, order",
};

export interface ColourChoice { hue: number; harmony: Harmony; chroma: number }
export interface TypeChoice { pairing: string; ratio: number; base: number }
/** How far things stand off the page: flat (no shadow), soft, or lifted. Picked to agree with the corners. */
export type Depth = "flat" | "soft" | "lifted";
export const DEPTHS: readonly Depth[] = ["flat", "soft", "lifted"];
export interface SpaceChoice { step: number; density: number; corner: Corner; depth: Depth }
export interface SectionLayout { align: "keep" | "start" | "center"; flip: boolean }
/** Per section, and `air`: px added above every section after the first (on the grid). */
export interface LayoutChoice { sections: SectionLayout[]; air: number }
/** Indexes of the page's sections, top to bottom, as the original has them. */
export interface OrderChoice { order: number[] }
export interface MotionChoice { style: MotionStyle }

/** Each layer's choice, or null: as the original has it. */
export interface Spec {
  colours: ColourChoice | null;
  type: TypeChoice | null;
  space: SpaceChoice | null;
  layout: LayoutChoice | null;
  order: OrderChoice | null;
  motion: MotionChoice | null;
}

export const emptySpec = (): Spec => ({ colours: null, type: null, space: null, layout: null, order: null, motion: null });

/** A word change Claude suggests: shown, never applied until J accepts it, one at a time. */
export interface WordSuggestion { id: string; part: string; now: string; to: string; why: string }

export interface Variation {
  /** The site it is a variation of. */
  of: string;
  /** The seed each layer was rolled from; null where the layer was not rolled (left as the original, or chosen by Claude). */
  seeds: Record<Layer, number | null>;
  spec: Spec;
  aims: Aim[];
  locks: Layer[];
  by: "local" | "claude";
  /** Claude's one line on what this variation is for. */
  note?: string | null;
  /** Its direction in plain words: "Calm editorial", "Bold product". */
  name?: string | null;
  /** The reference site, when one was named. */
  like?: string | null;
  words?: WordSuggestion[];
  /** Word suggestions J accepted, by id. */
  accepted?: string[];
  made: number;
}

/** What a roll knows about the site, so it rolls inside it. */
export interface SiteShape {
  /** How many sections each page has, the first page first. */
  sections: number;
  /** The site's accent hue in degrees, when it has one. */
  hue: number | null;
}

/* ------------------------------------------------------------------ */
/* Rolling                                                              */
/* ------------------------------------------------------------------ */

const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]!;
/** A layer's own seed out of the batch seed: the same seed and layer always give the same choice. */
export function layerSeed(seed: number, layer: Layer): number {
  let h = seed >>> 0;
  for (const c of layer) h = Math.imul(h ^ c.charCodeAt(0), 0x9e3779b1) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/*
 * TASTE. A roll is not uniform: each choice is drawn from what a designer
 * would pick, and each aim leans the odds (`RULES`).
 *
 *   · type scales are real ratios only (minor third, major third, perfect
 *     fourth), on a 16–18px body, with pairings whose heading and body suit
 *     each other (no novelty faces in a local roll);
 *   · spacing is on the 4/8 grid, never tighter than the original;
 *   · colours stay in the site's own hue family (a small turn, never a jump
 *     across the wheel) by analogous, complementary or tinted-neutral
 *     harmony; words are held at AA by `tokens.ts` and `make.ts`;
 *   · corners and shadows agree: square is flat, soft lifts a little, round
 *     may lift more, pills stay low;
 *   · layout moves from the layout tree: one alignment for the whole body
 *     (an aligned grid, not a different one per section), an alternating
 *     rhythm or none, more air above sections, a first screen centred on its
 *     one message for "clearer";
 *   · order moves one pair of middle sections at most: a small, readable
 *     change, never a shuffle.
 */

/** Type scale ratios a variation may take: minor third, major third, perfect fourth. */
export const RATIOS: readonly number[] = [1.2, 1.25, 1.333];
/** The spacing grid: every step is 4 or 8, so every gap is a whole number of 4. */
export const GRID: readonly number[] = [4, 8];
/** How many steps a gap becomes, per step it was: never tighter than the original. */
export const DENSITIES = [1, 1.25, 1.5] as const;
/** Body sizes a type scale may start from. */
export const BASES = [16, 17, 18] as const;
const CHROMA_LEVELS = [0.06, 0.1, 0.14, 0.18] as const;
/** Harmonies a local roll uses: tinted neutrals (mono), analogous, complementary. */
export const TASTE_HARMONIES: readonly Harmony[] = ["mono", "analogous", "complementary"];
/** Pairings whose heading and body suit each other. */
export const TASTE_PAIRINGS: readonly string[] = ["sans-sans", "serif-sans", "humanist", "elegant-serif", "grotesk-serif", "verdana-georgia", "rounded"];
/** Hues for a site with no colour of its own: blue, indigo, teal, green, warm red, violet. */
const GOOD_HUES = [250, 265, 200, 155, 25, 300] as const;
/** Air above each section, px. */
export const AIRS = [0, 16, 32, 48] as const;

type Odds = Record<string, number>;
type Rule = { base: Odds } & Partial<Record<Aim, Odds>>;
/**
 * What each aim leans toward. A choice's weight is its base plus every
 * ticked aim's; a choice no row names never comes up.
 */
export const RULES: Record<string, Rule> = {
  harmony: { base: { mono: 2, analogous: 2, complementary: 1 }, cleaner: { mono: 3, analogous: 1 }, modern: { analogous: 1, complementary: 2 }, like: { analogous: 1, complementary: 1 }, clearer: { complementary: 2, mono: 1 } },
  hueTurn: { base: { "0": 3, "10": 1, "-10": 1, "20": 1, "-20": 1 }, cleaner: { "0": 4 }, modern: { "10": 1, "-10": 1, "20": 1, "-20": 1 }, like: { "30": 1, "-30": 1 }, clearer: { "0": 2 } },
  chroma: { base: { "0.06": 1, "0.1": 2, "0.14": 2, "0.18": 1 }, cleaner: { "0.06": 2, "0.1": 2 }, modern: { "0.14": 2, "0.18": 2 }, like: { "0.1": 1, "0.14": 1 }, clearer: { "0.14": 3 } },
  pairing: { base: { "sans-sans": 3, "serif-sans": 2, humanist: 2, "elegant-serif": 1, "grotesk-serif": 1 }, cleaner: { "sans-sans": 4, humanist: 1 }, modern: { "sans-sans": 3, "grotesk-serif": 2, rounded: 1 }, like: { "serif-sans": 2, "elegant-serif": 1, "grotesk-serif": 1, "verdana-georgia": 1 }, clearer: { humanist: 3, "sans-sans": 2, "verdana-georgia": 1 } },
  ratio: { base: { "1.2": 1, "1.25": 2, "1.333": 1 }, cleaner: { "1.2": 3, "1.25": 2 }, modern: { "1.25": 1, "1.333": 3 }, like: { "1.25": 1, "1.333": 1 }, clearer: { "1.2": 1, "1.25": 3 } },
  base: { base: { "16": 2, "17": 1, "18": 1 }, cleaner: { "16": 2, "17": 1 }, modern: { "17": 2, "18": 2 }, clearer: { "17": 2, "18": 3 } },
  step: { base: { "4": 1, "8": 2 }, cleaner: { "8": 4 }, modern: { "8": 3 }, clearer: { "8": 2 } },
  density: { base: { "1": 2, "1.25": 2, "1.5": 1 }, cleaner: { "1": 1, "1.25": 2 }, modern: { "1.25": 2, "1.5": 3 }, clearer: { "1.25": 2, "1.5": 1 } },
  corner: { base: { square: 1, soft: 3, round: 2, pill: 1 }, cleaner: { square: 1, soft: 3 }, modern: { soft: 2, round: 2, pill: 1 }, like: { square: 1, round: 1 }, clearer: { soft: 2, round: 2 } },
  air: { base: { "0": 1, "16": 2, "32": 2, "48": 1 }, cleaner: { "16": 1, "32": 3 }, modern: { "32": 2, "48": 3 }, clearer: { "16": 2, "32": 2 } },
  hero: { base: { keep: 3, start: 1, center: 1 }, cleaner: { keep: 2, start: 1 }, modern: { start: 1, center: 1 }, clearer: { center: 99 } },
  body: { base: { keep: 3, start: 2, center: 1 }, cleaner: { start: 3, keep: 1 }, modern: { start: 2, center: 1 }, clearer: { keep: 1, start: 1 } },
  rhythm: { base: { none: 4, alternate: 1 }, cleaner: { none: 3 }, modern: { alternate: 1 }, like: { alternate: 1 } },
  motion: { base: { calm: 2, snappy: 2, bouncy: 1 }, cleaner: { calm: 3 }, modern: { snappy: 3 }, like: { bouncy: 1 }, clearer: { calm: 2, snappy: 1 } },
};
/** Shadows each corner family allows, and how likely: so corners and shadows agree. */
export const DEPTH_FOR: Record<Corner, Partial<Record<Depth, number>>> = {
  square: { flat: 1 },
  soft: { soft: 3, flat: 1 },
  round: { soft: 2, lifted: 2 },
  pill: { soft: 2, flat: 1 },
};
/** The depth a corner family has when nothing chose one: its likeliest. */
export const depthOf = (c: Corner): Depth => (Object.entries(DEPTH_FOR[c]).sort((a, b) => b[1]! - a[1]!)[0]![0] as Depth);

/** The weight of each choice for these aims. */
export function oddsFor(rule: Rule, aims: readonly Aim[]): Odds {
  const out: Odds = { ...rule.base };
  for (const a of aims) for (const [k, w] of Object.entries(rule[a] ?? {})) out[k] = (out[k] ?? 0) + w;
  return out;
}
/** One choice drawn by weight. */
function draw(r: () => number, odds: Odds): string {
  const list = Object.entries(odds).filter(([, w]) => w > 0);
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [k, w] of list) { if ((x -= w) < 0) return k; }
  return list[list.length - 1]![0];
}
const drawFrom = (r: () => number, name: keyof typeof RULES, aims: readonly Aim[]) => draw(r, oddsFor(RULES[name]!, aims));

/** One layer rolled from its seed, by the rules the aims lean. */
export function rollLayer<L extends Layer>(layer: L, seed: number, aims: readonly Aim[], shape: SiteShape): NonNullable<Spec[L]> {
  const r = rng(seed);
  const pick = (name: keyof typeof RULES) => drawFrom(r, name, aims);
  switch (layer) {
    case "colours": {
      /* The site's own hue, turned a little; a grey site gets one good accent. */
      const turn = Number(pick("hueTurn"));
      const from = shape.hue != null ? Math.round(shape.hue / 5) * 5 : GOOD_HUES[Math.floor(r() * GOOD_HUES.length) % GOOD_HUES.length]!;
      const hue = (from + turn + 360) % 360;
      return { hue, harmony: pick("harmony") as Harmony, chroma: Number(pick("chroma")) } as unknown as NonNullable<Spec[L]>;
    }
    case "type":
      return { pairing: pick("pairing"), ratio: Number(pick("ratio")), base: Number(pick("base")) } as unknown as NonNullable<Spec[L]>;
    case "space": {
      const corner = pick("corner") as Corner;
      const step = Number(pick("step")), density = Number(pick("density"));
      /* Flat sits well with "cleaner"; only where the corner allows it. */
      const allowed = { ...DEPTH_FOR[corner] };
      if (aims.includes("cleaner") && allowed.flat) allowed.flat += 1;
      if (aims.includes("modern") && allowed.lifted) allowed.lifted += 1;
      return { step, density, corner, depth: draw(r, allowed as Odds) as Depth } as unknown as NonNullable<Spec[L]>;
    }
    case "layout": {
      const hero = pick("hero") as SectionLayout["align"], body = pick("body") as SectionLayout["align"], rhythm = pick("rhythm");
      const air = Number(pick("air"));
      const n = Math.max(1, shape.sections);
      /* One alignment for the whole body, so the columns line up down the page; the foot as it is. */
      const sections = Array.from({ length: n }, (_, i): SectionLayout =>
        i === 0 ? { align: hero, flip: false } : i === n - 1 && n > 2 ? { align: "keep", flip: false } : { align: body, flip: rhythm === "alternate" && i % 2 === 0 });
      return { sections, air } as unknown as NonNullable<Spec[L]>;
    }
    case "order": {
      const n = Math.max(0, shape.sections);
      const order = Array.from({ length: n }, (_, i) => i);
      /* One pair of neighbouring middle sections changes places; the first screen and the foot stay. */
      if (n > 3) { const i = 1 + Math.floor(r() * (n - 3)); [order[i], order[i + 1]] = [order[i + 1]!, order[i]!]; }
      return { order } as unknown as NonNullable<Spec[L]>;
    }
    case "motion":
      return { style: pick("motion") as MotionStyle } as unknown as NonNullable<Spec[L]>;
  }
  throw new Error(`no such layer: ${String(layer)}`);
}

export interface RollOptions {
  seed: number;
  aims: readonly Aim[];
  shape: SiteShape;
  /** The variation rolled from: its locked layers are kept as it has them. */
  prev?: Pick<Variation, "spec" | "seeds"> | null;
  locks?: readonly Layer[];
  /** Layers to leave as the original has them (not rolled, not kept). */
  skip?: readonly Layer[];
}

/**
 * A new spec: locked layers kept from `prev`, skipped ones left as the
 * original, every other layer rolled from its own seed out of `seed`.
 */
export function rollSpec(o: RollOptions): { spec: Spec; seeds: Record<Layer, number | null> } {
  const locks = new Set(o.locks ?? []);
  const skip = new Set(o.skip ?? []);
  const spec = emptySpec();
  const seeds = {} as Record<Layer, number | null>;
  for (const l of LAYERS) {
    /* Locked: as the variation it was locked on has it; with none, as the original has it. */
    if (locks.has(l)) { (spec as unknown as Record<Layer, unknown>)[l] = o.prev?.spec[l] ?? null; seeds[l] = o.prev?.seeds[l] ?? null; continue; }
    if (skip.has(l)) { seeds[l] = null; continue; }
    /* Randomize again changes what it rolls: a roll that lands on the choice it had is rolled again (a few tries; a layer with one choice keeps it). */
    let s = layerSeed(o.seed, l), choice = rollLayer(l, s, o.aims, o.shape);
    const had = o.prev?.spec[l] ?? null;
    for (let k = 1; k < 24 && had != null && sameChoice(l, choice, had); k++) { s = layerSeed(o.seed + k * 7919, l); choice = rollLayer(l, s, o.aims, o.shape); }
    (spec as unknown as Record<Layer, unknown>)[l] = choice;
    seeds[l] = s;
  }
  return { spec, seeds };
}

/** Two choices for a layer that would look the same: spacing is its step and density (a new corner alone leaves every gap where it was). */
function sameChoice(l: Layer, a: unknown, b: unknown): boolean {
  if (l === "space" && a && b) { const x = a as SpaceChoice, y = b as SpaceChoice; return x.step === y.step && x.density === y.density; }
  /* Type: its scale (a new pairing on the same scale leaves every size where it was). */
  if (l === "type" && a && b) { const x = a as TypeChoice, y = b as TypeChoice; return x.ratio === y.ratio && x.base === y.base; }
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The same spec again, from the seeds alone: what "a variation can be re-made" means. */
export function specFromSeeds(seeds: Record<Layer, number | null>, aims: readonly Aim[], shape: SiteShape, given: Partial<Spec> = {}): Spec {
  const spec = emptySpec();
  for (const l of LAYERS) {
    const s = seeds[l];
    (spec as unknown as Record<Layer, unknown>)[l] = s != null ? rollLayer(l, s, aims, shape) : (given[l] ?? null);
  }
  return spec;
}

/** Layers whose choices differ between two specs. */
export function differs(a: Spec, b: Spec): Layer[] {
  return LAYERS.filter((l) => JSON.stringify(a[l]) !== JSON.stringify(b[l]));
}

/** "Colours: blue triadic · Type: ×1.25 from 17px …", for a card. */
export function specWords(s: Spec): string[] {
  const out: string[] = [];
  if (s.colours) out.push(`Colours: ${s.colours.harmony === "mono" ? "one colour" : s.colours.harmony} from ${s.colours.hue}°`);
  if (s.type) out.push(`Type: ${PAIRINGS.find((p) => p.id === s.type!.pairing)?.name ?? s.type.pairing}, ×${s.type.ratio} from ${s.type.base}px`);
  if (s.space) out.push(`Spacing: ${s.space.step}px steps ×${s.space.density}, ${s.space.corner} corners, ${s.space.depth}`);
  if (s.layout) { const n = s.layout.sections.filter((x) => x.align !== "keep" || x.flip).length; out.push(`Layout: ${n} section${n === 1 ? "" : "s"} laid out again${s.layout.air ? `, ${s.layout.air}px more air` : ""}`); }
  if (s.order) out.push(`Order: ${s.order.order.map((i) => i + 1).join(" ")}`);
  if (s.motion) out.push(`Motion: ${s.motion.style}`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Directions: how far apart two specs are, and a name for one          */
/* ------------------------------------------------------------------ */

/** Two directions closer than this are the same direction (`specDistance`). */
export const DIRECTION_GAP = 1;

const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
/**
 * How far apart two specs look, 0 upward: each layer's difference, weighted
 * by how much a visitor sees it. The same spec is 0; a new pairing alone is
 * 1; a new hue family and a new scale are well over 2.
 */
export function specDistance(a: Spec, b: Spec): number {
  let d = 0;
  const ca = a.colours, cb = b.colours;
  if (!!ca !== !!cb) d += 1.5;
  else if (ca && cb) d += Math.min(1.5, hueGap(ca.hue, cb.hue) / 40) + (ca.harmony === cb.harmony ? 0 : 0.6) + Math.abs(ca.chroma - cb.chroma) * 8;
  const ta = a.type, tb = b.type;
  if (!!ta !== !!tb) d += 1.5;
  else if (ta && tb) d += (ta.pairing === tb.pairing ? 0 : 1) + Math.abs(ta.ratio - tb.ratio) * 8 + Math.abs(ta.base - tb.base) * 0.2;
  const sa = a.space, sb = b.space;
  if (!!sa !== !!sb) d += 1;
  else if (sa && sb) d += (sa.corner === sb.corner ? 0 : 0.6) + (sa.depth === sb.depth ? 0 : 0.4) + Math.abs(sa.density - sb.density) * 1.6 + (sa.step === sb.step ? 0 : 0.2);
  const la = a.layout, lb = b.layout;
  if (!!la !== !!lb) d += 0.8;
  else if (la && lb) { const n = Math.max(la.sections.length, lb.sections.length, 1); let k = 0; for (let i = 0; i < n; i++) { const x = la.sections[i], y = lb.sections[i]; if (!x || !y || x.align !== y.align || x.flip !== y.flip) k++; } d += (k / n) * 0.8 + (Math.abs(la.air - lb.air) / 48) * 0.4; }
  if (JSON.stringify(a.order) !== JSON.stringify(b.order)) d += 0.5;
  if ((a.motion?.style ?? null) !== (b.motion?.style ?? null)) d += 0.3;
  return d;
}

const WORD: Record<string, string> = { "sans-sans": "clean", "serif-sans": "editorial", humanist: "friendly", "elegant-serif": "fine", "grotesk-serif": "bold", "verdana-georgia": "readable", rounded: "soft", "mono-sans": "technical", "mono-mono": "raw", "condensed-sans": "poster", "didone-mono": "fashion", "tahoma-tight": "utility" };
/** A direction in plain words from what it does: "Calm editorial", "Bold product", "As the original". */
export function directionName(s: Spec): string {
  const tone = s.colours ? (s.colours.chroma >= 0.14 ? "Bold" : s.colours.harmony === "mono" ? "Quiet" : "Warm") : s.space ? (s.space.density >= 1.5 ? "Airy" : s.space.depth === "flat" ? "Flat" : "Calm") : s.motion ? (s.motion.style === "snappy" ? "Quick" : "Calm") : "Plain";
  const what = s.type ? WORD[s.type.pairing] ?? "typed" : s.space ? `${s.space.corner} product` : s.layout ? "layout" : s.order ? "order" : s.colours ? "colour" : null;
  return what ? `${tone} ${what}` : "As the original";
}

/* ------------------------------------------------------------------ */
/* Reading a spec from somewhere else (Claude, storage)                 */
/* ------------------------------------------------------------------ */

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const one = <T,>(v: unknown, list: readonly T[]): T | null => (list.includes(v as T) ? (v as T) : null);
/** The nearest of a list. */
const nearest = (v: number, list: readonly number[]) => list.reduce((b, x) => (Math.abs(x - v) <= Math.abs(b - v) ? x : b), list[0]!);

/**
 * A spec read strictly: a choice that is not one the rules allow is
 * dropped (that layer stays as the original), never guessed at. A number
 * near the rules (a 1.5 scale, a 6px step, 50px of air) lands on them: the
 * nearest real ratio, the grid, a depth the corner allows. `sections` is how
 * many sections the page has, so an order is a real order.
 */
export function readSpec(v: unknown, sections: number): Spec {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Record<string, unknown> | null | undefined>;
  const spec = emptySpec();
  const c = o.colours;
  if (c && num(c.hue) && one(c.harmony, HARMONIES) && num(c.chroma)) spec.colours = { hue: ((Math.round(c.hue) % 360) + 360) % 360, harmony: c.harmony as Harmony, chroma: Math.max(0.02, Math.min(0.22, c.chroma)) };
  const t = o.type;
  if (t && PAIRINGS.some((p) => p.id === t.pairing) && num(t.ratio) && num(t.base)) spec.type = { pairing: t.pairing as string, ratio: nearest(t.ratio, RATIOS), base: Math.max(14, Math.min(20, Math.round(t.base))) };
  const s = o.space;
  if (s && num(s.step) && num(s.density) && one(s.corner, CORNERS)) {
    const corner = s.corner as Corner;
    const depth = one(s.depth, DEPTHS);
    spec.space = { step: nearest(s.step, GRID), density: nearest(s.density, DENSITIES), corner, depth: depth && DEPTH_FOR[corner][depth] ? depth : depthOf(corner) };
  }
  const l = o.layout;
  if (l && Array.isArray(l.sections)) {
    const list = (l.sections as unknown[]).slice(0, sections).map((x): SectionLayout => {
      const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return { align: one(e.align, ["keep", "start", "center"] as const) ?? "keep", flip: e.flip === true };
    });
    if (list.length) spec.layout = { sections: list, air: num(l.air) ? nearest(l.air, AIRS) : 0 };
  }
  const r = o.order;
  if (r && Array.isArray(r.order)) {
    const ord = (r.order as unknown[]).filter(num).map((x) => Math.round(x));
    const whole = ord.length === sections && new Set(ord).size === sections && ord.every((x) => x >= 0 && x < sections);
    if (whole && sections > 2) spec.order = { order: ord };
  }
  const m = o.motion;
  if (m && one(m.style, MOTIONS)) spec.motion = { style: m.style as MotionStyle };
  return spec;
}
