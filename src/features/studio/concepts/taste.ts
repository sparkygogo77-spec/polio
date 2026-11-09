/**
 * TASTE FOR A FREE CONCEPT: each direction has a look of its own, and the
 * three are far apart by the variations' own measure.
 *
 * Two layers, both from what already exists:
 *
 *   1. THE THEME. Each direction's philosophy words (`copy.ts#DIRECTIONS`)
 *      are read by `siteTheme.ts#readPhilosophy`, narrowed further here
 *      (its hue family, its pairing, its scale, light or dark), and a theme
 *      is rolled inside those ranges (`rollTheme`) and made a System
 *      (`houseStyle.ts#systemFromTheme`). That is the System the page is
 *      drawn in: its faces, its type steps, its space, its corners.
 *
 *   2. THE SPEC. The same direction as a variations `Spec` (`variations/
 *      model.ts`): colours on its hue and harmony, type on a real ratio and
 *      a pairing the taste rules allow, spacing on the 4/8 grid with its
 *      density and corners, a layout (first screen centred or set left,
 *      air above sections) and motion. `variations/tokens.ts#systemFor`
 *      moves the direction's System onto it before the page is drawn, so
 *      every box is measured at its real size (a pass after drawing left
 *      words clipped and pictures squashed). The first screen's alignment
 *      is `draft.ts#alignFirstScreen`: a drafted page has no layout tree
 *      for `relayout` to read. `specDistance` between any two directions
 *      is over DIRECTION_GAP, and the test measures it.
 *
 * The theme's pairing and the spec's are the same face on purpose: the
 * taste pass gives each face token its job by size, and a theme with one
 * face would have had its heading moved onto the body face.
 *
 * Pure: no React, no store, no browser.
 */
import { readPhilosophy, rollTheme, type Ranges, type SiteTheme } from "../siteTheme.ts";
import { systemFromTheme } from "../idea/houseStyle.ts";
import type { System } from "../system/model.ts";
import { DIRECTION_GAP, specDistance, type Spec } from "../variations/model.ts";
import type { Voice } from "./copy.ts";

/** What each direction holds to, beyond its philosophy words. */
interface Taste {
  ranges: Ranges;
  spec: (sections: number) => Spec;
}

const layout = (sections: number, hero: "start" | "center", body: "start" | "center", air: number, rhythm = false): Spec["layout"] => ({
  sections: Array.from({ length: Math.max(1, sections) }, (_, i) => ({ align: i === 1 ? hero : body, flip: rhythm && i > 1 && i % 2 === 0 })),
  air,
});

export const TASTES: Record<Voice, Taste> = {
  calm: {
    ranges: { hues: [60, 70, 80], harmony: ["mono"], chroma: [0.06, 0.07], mode: ["light"], pairing: ["serif-sans"], scale: [1.333], density: ["airy"], corner: ["square", "soft"], shadow: ["none"] },
    spec: (n) => ({
      colours: { hue: 70, harmony: "mono", chroma: 0.06 },
      type: { pairing: "serif-sans", ratio: 1.333, base: 18 },
      space: { step: 8, density: 1.5, corner: "square", depth: "flat" },
      layout: layout(n, "start", "start", 48),
      order: null,
      motion: { style: "calm" },
    }),
  },
  bold: {
    ranges: { hues: [240, 250, 260], harmony: ["complementary"], chroma: [0.15, 0.18], mode: ["light"], pairing: ["grotesk-serif"], scale: [1.25], density: ["balanced"], corner: ["soft"], shadow: ["soft"] },
    spec: (n) => ({
      colours: { hue: 250, harmony: "complementary", chroma: 0.18 },
      type: { pairing: "grotesk-serif", ratio: 1.25, base: 17 },
      space: { step: 8, density: 1.25, corner: "soft", depth: "soft" },
      layout: layout(n, "center", "start", 16),
      order: null,
      motion: { style: "snappy" },
    }),
  },
  warm: {
    ranges: { hues: [20, 30, 40], harmony: ["analogous"], chroma: [0.11, 0.14], mode: ["light"], pairing: ["humanist"], scale: [1.2], density: ["balanced"], corner: ["round", "pill"], shadow: ["soft"] },
    spec: (n) => ({
      colours: { hue: 30, harmony: "analogous", chroma: 0.14 },
      type: { pairing: "humanist", ratio: 1.2, base: 17 },
      space: { step: 8, density: 1.25, corner: "round", depth: "lifted" },
      layout: layout(n, "center", "center", 32),
      order: null,
      motion: { style: "bouncy" },
    }),
  },
  night: {
    ranges: { hues: [300, 310, 320], harmony: ["complementary"], chroma: [0.19], mode: ["dark"], pairing: ["mono-sans"], scale: [1.333], density: ["dense"], corner: ["square"], shadow: ["glow"] },
    spec: (n) => ({
      colours: { hue: 310, harmony: "complementary", chroma: 0.18 },
      type: { pairing: "mono-sans", ratio: 1.333, base: 16 },
      space: { step: 4, density: 1, corner: "square", depth: "flat" },
      layout: layout(n, "start", "start", 0, true),
      order: null,
      motion: { style: "snappy" },
    }),
  },
};

/** The philosophy's ranges, narrowed by the direction's own. Where both name a group, what both allow; else the direction's. */
export function rangesFor(voice: Voice, philosophy: string): Ranges {
  const read = readPhilosophy(philosophy).ranges as Record<string, unknown[]>;
  const own = TASTES[voice].ranges as Record<string, unknown[]>;
  const out: Record<string, unknown[]> = { ...read };
  for (const [k, v] of Object.entries(own)) {
    const had = read[k];
    const both = had ? had.filter((x) => v.includes(x)) : v;
    out[k] = both.length ? both : v;
  }
  return out as Ranges;
}

/** The theme a direction is drawn in, and the System made of it. */
export function themeFor(voice: Voice, philosophy: string, seed: number, name: string): { theme: SiteTheme; system: System } {
  const theme = rollTheme({ seed, ranges: rangesFor(voice, philosophy), philosophy, originality: 1 });
  return { theme, system: systemFromTheme(theme, name) };
}

/** The direction as a variations spec, for a page of `sections` sections. */
export const specFor = (voice: Voice, sections: number): Spec => TASTES[voice].spec(sections);

/** How far apart every pair of directions is; the least of them. */
export function leastGap(voices: readonly Voice[], sections = 6): number {
  let least = Infinity;
  for (let i = 0; i < voices.length; i++) for (let j = i + 1; j < voices.length; j++) least = Math.min(least, specDistance(specFor(voices[i]!, sections), specFor(voices[j]!, sections)));
  return least;
}

/** True when every pair of directions stands further apart than the variations' own gap. */
export const farApart = (voices: readonly Voice[]): boolean => leastGap(voices) >= DIRECTION_GAP;
