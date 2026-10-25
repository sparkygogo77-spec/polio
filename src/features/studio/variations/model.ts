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
import { CORNERS, HARMONIES, MOTIONS, PAIRINGS, SCALES, STEPS, rng, type Corner, type Harmony, type MotionStyle } from "../siteTheme.ts";

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
export interface SpaceChoice { step: number; density: number; corner: Corner }
export interface SectionLayout { align: "keep" | "start" | "center"; flip: boolean }
export interface LayoutChoice { sections: SectionLayout[] }
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

/** The density a space choice may take: how many steps a gap becomes, per step it was. */
export const DENSITIES = [0.75, 1, 1.25, 1.5] as const;
/** Base sizes a type scale may start from. */
export const BASES = [15, 16, 17, 18] as const;
const CHROMA_LEVELS = [0.06, 0.1, 0.14, 0.18] as const;

/** One layer rolled from its seed, inside what the aims allow. */
export function rollLayer<L extends Layer>(layer: L, seed: number, aims: readonly Aim[], shape: SiteShape): NonNullable<Spec[L]> {
  const r = rng(seed);
  const cleaner = aims.includes("cleaner"), modern = aims.includes("modern"), clearer = aims.includes("clearer");
  switch (layer) {
    case "colours": {
      /* Cleaner keeps the site's own hue family and calms it; otherwise anywhere on the wheel. */
      const hue = cleaner && shape.hue != null ? (Math.round(shape.hue / 5) * 5 + pick(r, [-15, -10, 0, 10, 15]) + 360) % 360 : Math.floor(r() * 72) * 5;
      const harmony = pick(r, cleaner ? (["mono", "analogous"] as Harmony[]) : HARMONIES);
      const chroma = pick(r, cleaner ? CHROMA_LEVELS.slice(0, 2) : modern ? CHROMA_LEVELS.slice(1) : CHROMA_LEVELS);
      return { hue, harmony, chroma } as unknown as NonNullable<Spec[L]>;
    }
    case "type": {
      const pairs = modern ? PAIRINGS.filter((p) => /sans|grotesk|humanist|rounded|condensed/.test(p.id)) : PAIRINGS;
      const pairing = pick(r, pairs).id;
      /* Cleaner: a gentle scale, so many sizes become few. Modern: a bigger base and more contrast. */
      const ratio = pick(r, cleaner ? SCALES.slice(0, 2) : modern ? SCALES.slice(2) : SCALES);
      const base = pick(r, modern ? BASES.slice(2) : cleaner ? BASES.slice(1, 3) : BASES);
      return { pairing, ratio, base } as unknown as NonNullable<Spec[L]>;
    }
    case "space": {
      const step = pick(r, cleaner ? [8] : STEPS);
      const density = pick(r, modern ? DENSITIES.slice(2) : cleaner ? DENSITIES.slice(1, 3) : DENSITIES);
      const corner = pick(r, modern ? (["soft", "round"] as Corner[]) : CORNERS);
      return { step, density, corner } as unknown as NonNullable<Spec[L]>;
    }
    case "layout": {
      const sections = Array.from({ length: Math.max(1, shape.sections) }, (_, i): SectionLayout => {
        /* Clearer: the first screen centred on its one message. */
        if (clearer && i === 0) return { align: "center", flip: false };
        return { align: pick(r, cleaner ? (["start", "keep"] as const) : (["keep", "start", "center"] as const)), flip: r() < 0.3 };
      });
      return { sections } as unknown as NonNullable<Spec[L]>;
    }
    case "order": {
      const n = Math.max(0, shape.sections);
      const order = Array.from({ length: n }, (_, i) => i);
      /* The first screen and the foot stay; the middle is shuffled (Fisher–Yates). */
      const mid = order.slice(1, Math.max(1, n - 1));
      for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [mid[i], mid[j]] = [mid[j]!, mid[i]!]; }
      return { order: n <= 2 ? order : [0, ...mid, n - 1] } as unknown as NonNullable<Spec[L]>;
    }
    case "motion":
      return { style: pick(r, modern ? (["snappy", "calm"] as MotionStyle[]) : MOTIONS) } as unknown as NonNullable<Spec[L]>;
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
    if (locks.has(l) && o.prev) { (spec as unknown as Record<Layer, unknown>)[l] = o.prev.spec[l]; seeds[l] = o.prev.seeds[l] ?? null; continue; }
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
  if (s.space) out.push(`Spacing: ${s.space.step}px steps ×${s.space.density}, ${s.space.corner} corners`);
  if (s.layout) { const n = s.layout.sections.filter((x) => x.align !== "keep" || x.flip).length; out.push(`Layout: ${n} section${n === 1 ? "" : "s"} laid out again`); }
  if (s.order) out.push(`Order: ${s.order.order.map((i) => i + 1).join(" ")}`);
  if (s.motion) out.push(`Motion: ${s.motion.style}`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Reading a spec from somewhere else (Claude, storage)                 */
/* ------------------------------------------------------------------ */

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const one = <T,>(v: unknown, list: readonly T[]): T | null => (list.includes(v as T) ? (v as T) : null);

/**
 * A spec read strictly: a choice that is not one the rules allow is
 * dropped (that layer stays as the original), never guessed at. `sections`
 * is how many sections the page has, so an order is a real order.
 */
export function readSpec(v: unknown, sections: number): Spec {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, Record<string, unknown> | null | undefined>;
  const spec = emptySpec();
  const c = o.colours;
  if (c && num(c.hue) && one(c.harmony, HARMONIES) && num(c.chroma)) spec.colours = { hue: ((Math.round(c.hue) % 360) + 360) % 360, harmony: c.harmony as Harmony, chroma: Math.max(0.02, Math.min(0.22, c.chroma)) };
  const t = o.type;
  if (t && PAIRINGS.some((p) => p.id === t.pairing) && num(t.ratio) && num(t.base)) spec.type = { pairing: t.pairing as string, ratio: Math.max(1.1, Math.min(1.62, t.ratio)), base: Math.max(13, Math.min(22, Math.round(t.base))) };
  const s = o.space;
  if (s && num(s.step) && num(s.density) && one(s.corner, CORNERS)) spec.space = { step: Math.max(2, Math.min(12, Math.round(s.step))), density: Math.max(0.5, Math.min(2, s.density)), corner: s.corner as Corner };
  const l = o.layout;
  if (l && Array.isArray(l.sections)) {
    const list = (l.sections as unknown[]).slice(0, sections).map((x): SectionLayout => {
      const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return { align: one(e.align, ["keep", "start", "center"] as const) ?? "keep", flip: e.flip === true };
    });
    if (list.length) spec.layout = { sections: list };
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
