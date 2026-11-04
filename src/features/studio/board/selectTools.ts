/**
 * SELECTION AS THE DESIGN CANVAS DOES IT: levels in and out of what holds what.
 *
 * J (2026-11-03): "we need the same control select tech that is in the
 * artifacts". The parts of a page are a flat list; what holds what is read
 * the way the rest of the Builder reads it (`owner.ts#holds`: the recorded
 * page path, else the box). Here are the three walks the selection takes on
 * that tree: up from a part to the page (the outlines under the pointer),
 * one step down from a picked part toward the point pressed (a second click
 * goes in), and one step up (Escape, and the toolbar's step out). Nothing
 * here moves or writes anything; it only answers.
 */
import { holds, isWrapper, parentOf } from "../owner";

type Part = Parameters<typeof parentOf>[1];

/** How far up the outlines go: past this the parents are the page's sections, a wall of lines. */
export const HOLDER_DEPTH = 6;

/** The parts that hold `part`, nearest first, up to the site's own wrapper (never included). */
export function holdersOf<N extends Part>(nodes: readonly N[], part: Part, max = HOLDER_DEPTH): N[] {
  const out: N[] = [];
  let at: Part = part;
  for (let i = 0; i < max; i++) {
    const up = parentOf(nodes, at);
    if (!up || isWrapper(nodes, up)) break;
    out.push(up);
    at = up;
  }
  return out;
}

/** One level in: the part `picked` holds directly on the way down to `inner`, or null when `inner` is not inside it. */
export function oneLevelIn<N extends Part>(nodes: readonly N[], picked: Part, inner: N | null): N | null {
  if (!inner || inner.id === picked.id || !holds(picked, inner)) return null;
  let at: N = inner;
  /* Bounded: a tree read off boxes and paths has no loops, but a guard costs nothing. */
  for (let i = 0; i < 64; i++) {
    const up = parentOf(nodes, at);
    if (!up || up.id === picked.id || !holds(picked, up)) return at;
    at = up;
  }
  return at;
}

/** One level out: the part that holds `picked`, or null when the next one up is the page (nothing picked). */
export function stepOutOf<N extends Part>(nodes: readonly N[], picked: Part): N | null {
  const up = parentOf(nodes, picked);
  /* Climbing out stops below the site's own wrapper: it is the code's, not a part to pick. */
  return up && !isWrapper(nodes, up) ? up : null;
}

/*
 * THE SPOT. The last click that picked one part, and where, in page space. A slow second click on the same spot,
 * with that part still the one picked, goes one level in (`DesktopCanvas.tsx`); a step out (Escape, the toolbar)
 * carries the spot up with it, so Escape and a click on the spot climb the same ladder out and back in.
 */
let spot: { id: string; x: number; y: number } | null = null;
export const clickSpot = () => spot;
export function setClickSpot(next: { id: string; x: number; y: number } | null) { spot = next; }
/** A step out moved the pick to `id` (null: nothing picked): the spot stays where it was and names the new pick. */
export function climbSpot(id: string | null) { spot = spot && id ? { ...spot, id } : null; }
