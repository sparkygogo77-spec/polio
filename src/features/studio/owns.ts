/**
 * Who owns what, read off the path the capture recorded.
 *
 * EVERY RULE IN THIS APP ASKS GEOMETRY. Is this box inside that box —
 * `pageBlocks`, `slimWrappers`, `twins`, the healing, `repaint`. That is true
 * of most elements and false of any whose children overflow it, are
 * positioned, are sticky, or sit further from it than the reader's reach. For
 * those, the wrapper arrives as an empty box wherever its own collapsed rect
 * happened to be, and its contents arrive as loose parts somewhere else.
 *
 * AND THE DOCUMENT ALREADY KNOWS. Every candidate carries the DOM path it was
 * read from and a recreation keeps it — `node.from.selector`, on all 126
 * nodes of the committed capture-derived document. A wrapper's true children
 * are the nodes whose path CONTINUES its own. No geometry, no reach, no
 * positioning to trip over.
 *
 * This file only ANSWERS THE QUESTION. It moves nothing and decides nothing.
 * Repositioning a box is categorically different from what the sweep does
 * today — heights and proven duplicates — and is not authorised.
 */
import type { Frag } from "./reassemble.ts";

/** What a part remembers about the element it was read from. */
export interface Read { from?: { selector?: string } | null }

/** The DOM path a part was read from, or nothing for one that was drawn or placed. */
export const pathOf = (f: Frag & Read): string => (f.from?.selector ?? "").trim();

/**
 * Is `kid`'s path inside `parent`'s?
 *
 * A path continues another when it starts with it and the next character
 * begins a new step. The separator is checked rather than the prefix alone,
 * or `div:nth-of-type(1)` would be read as the parent of
 * `div:nth-of-type(11)`.
 */
export function under(parent: string, kid: string): boolean {
  return !!parent && !!kid && kid !== parent && kid.startsWith(`${parent} > `);
}

/** The parts a wrapper owns by the recorded path, nearest descendants and all. */
export function owned(all: readonly (Frag & Read)[], w: Frag & Read): (Frag & Read)[] {
  const p = pathOf(w);
  if (!p) return [];
  return all.filter((f) => f.pageId === w.pageId && under(p, pathOf(f)));
}

/** The box that would hold everything a wrapper owns. */
export interface Hold {
  x: number; y: number; w: number; h: number;
  /** How many parts it owns by the path. */
  holds: number;
}

export function holdOf(kids: readonly Frag[]): Hold | null {
  if (!kids.length) return null;
  const x = Math.min(...kids.map((k) => k.x));
  const y = Math.min(...kids.map((k) => k.y));
  const r = Math.max(...kids.map((k) => k.x + k.w));
  const b = Math.max(...kids.map((k) => k.y + k.h));
  return { x, y, w: r - x, h: b - y, holds: kids.length };
}

/**
 * The parts a wrapper owns that lie OUTSIDE its box.
 *
 * This is the fault itself, and it is a much narrower thing than "does not
 * sit exactly where its contents are". Measured on the committed
 * capture-derived document, 31 of 126 wrappers fail the wide test and only
 * TWO have a child escaping — the other 29 differ only by their own padding,
 * which the wide test reads as drift and would strip.
 */
export function escaping(all: readonly (Frag & Read)[], w: Frag & Read): (Frag & Read)[] {
  return owned(all, w).filter((k) =>
    k.y < w.y || k.y + k.h > w.y + w.h || k.x < w.x || k.x + k.w > w.x + w.w);
}

/**
 * The box a wrapper would need to hold everything it owns, KEEPING ITS OWN.
 *
 * Grow to include, never shrink to fit. Its own box survives, so its padding
 * survives; the escaped content is taken in; and the move is only ever upward
 * or taller — one direction, which is what makes it checkable. Null when it
 * already holds what it owns.
 */
export function grown(all: readonly (Frag & Read)[], w: Frag & Read): { x: number; y: number; w: number; h: number } | null {
  const kids = owned(all, w);
  if (!kids.length) return null;
  const y = Math.min(w.y, ...kids.map((k) => k.y));
  const b = Math.max(w.y + w.h, ...kids.map((k) => k.y + k.h));
  const x = Math.min(w.x, ...kids.map((k) => k.x));
  const r = Math.max(w.x + w.w, ...kids.map((k) => k.x + k.w));
  if (y === w.y && x === w.x && b - y === w.h && r - x === w.w) return null;
  return { x, y, w: r - x, h: b - y };
}

/** A wrapper measured against what it owns. */
export interface Adrift {
  id: string;
  pageId: string;
  /** Where it is now. */
  at: { x: number; y: number; w: number; h: number };
  /** Where its own contents are. */
  hold: Hold;
  /** How far its top would move, negative for up. */
  dy: number;
  /** How far its left would move, negative for left. */
  dx: number;
  /** How its height would change, negative for shorter. */
  dh: number;
  /** Does it hold any of them geometrically today? */
  geo: number;
  /** Does the box it is in now overlap the box its contents are in at all? */
  touches: boolean;
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: Hold): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const inside = (o: Frag, i: Frag): boolean =>
  o.id !== i.id && o.pageId === i.pageId
  && i.x >= o.x - 1 && i.y >= o.y - 1
  && i.x + i.w <= o.x + o.w + 1 && i.y + i.h <= o.y + o.h + 1;

/**
 * Every wrapper that does not sit where the parts it owns are.
 *
 * Reported, not corrected. `dy` is what a repositioning would move it by and
 * is the number a decision should be taken on: how many move, how far, and
 * which way.
 */
export function adrift(all: readonly (Frag & Read)[], gap = 2): Adrift[] {
  const out: Adrift[] = [];
  for (const w of all) {
    const kids = owned(all, w);
    if (!kids.length) continue;
    const hold = holdOf(kids)!;
    const dy = hold.y - w.y;
    const dx = hold.x - w.x;
    const dh = hold.h - w.h;
    if (Math.abs(dy) <= gap && Math.abs(dx) <= gap && Math.abs(dh) <= gap) continue;
    out.push({
      id: w.id, pageId: w.pageId,
      at: { x: w.x, y: w.y, w: w.w, h: w.h },
      hold, dy, dx, dh,
      geo: all.filter((f) => inside(w, f)).length,
      touches: overlaps(w, hold),
    });
  }
  return out;
}
