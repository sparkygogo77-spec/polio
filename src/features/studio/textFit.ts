"use client";
/**
 * A box that holds words is never shorter than its words.
 *
 * HIS FAULT, found by driving an imported board: a text part carries the
 * width and height the capture measured on the page it came from, and every
 * renderer treated that as a ceiling. "PnL Over Time" came in at 143 by 41,
 * the words needed more than 41, and they were simply gone — not deleted,
 * pushed into a scroll region on a board nobody can scroll. He dragged the
 * box one increment taller and it was fine, which is the whole diagnosis:
 * the geometry was a clamp when it should have been a starting size.
 *
 * SO THIS IS THE GUARANTEE, AND IT IS A RUNTIME ONE. A height written onto
 * a node at import is computed against whatever face resolved that day; a
 * face that resolves wider later, or words edited longer, makes that number
 * a lie. The floor measured here is taken from the part as it is actually
 * drawn, every time it is drawn, so it cannot go stale. Any height stored on
 * the node is a convenience — it keeps the board tidy and travels into the
 * export — and is never the thing that keeps the words visible.
 *
 * MEASURED, NOT MODELLED. The height of a run of words depends on the face
 * that resolved, the fallback if it did not, the letter spacing and where
 * the browser chose to break the line. A table of glyph metrics gets that
 * wrong on exactly the machine that does not have the font. Nothing here
 * models any of it: the floor itself is CSS (`parts/primitives.tsx` and the
 * two boxes that set `min-height` rather than `height`), so the part draws
 * itself at the size its words need and this reads the answer back.
 *
 * What lives here is the second half of his rule — "the texts should follow
 * each other based on full size" — the tidy that takes those drawn heights
 * and moves what sits below down by the growth, so a page reads without him
 * dragging every box taller by hand.
 */
import { toRows } from "./live/reflow";
import type { StudioNode } from "./store";

/** A box as it stands, and the height it actually drew at. */
export interface Drawn {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** What the box came out as on screen, once its words had the room. */
  drew: number;
}

/** A box that has to move, grow, or both. */
export interface Fitted {
  id: string;
  h: number;
  y: number;
}

/**
 * Grow every box to the height it drew at, and move what is under it down
 * by the growth.
 *
 * Rows, not single boxes, because a page is not a column: three cards
 * side by side are one band, and pushing the page down by each of them in
 * turn would open three gaps where one is wanted. A row grows by its
 * tallest member and everything below it follows by that much. The rows
 * are the live reflow's own (`toRows`), so "what counts as side by side"
 * has one definition in the app rather than two that drift.
 *
 * Pure, and returns only what changed: a page where every box already fits
 * its words comes back empty, which is what makes it safe to run after any
 * import rather than only after a bad one.
 */
export function fitRows(boxes: readonly Drawn[]): Fitted[] {
  /* `toRows` reads x, y, w and h and nothing else; these carry all four. */
  const rows = toRows(boxes.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h })) as unknown as StudioNode[]);
  const by = new Map(boxes.map((b) => [b.id, b]));
  const out: Fitted[] = [];
  let shift = 0;
  for (const row of rows) {
    let grew = 0;
    for (const r of row) {
      const b = by.get(r.id);
      if (!b) continue;
      const h = Math.max(b.h, Math.round(b.drew));
      grew = Math.max(grew, h - b.h);
      if (h !== b.h || shift !== 0) out.push({ id: b.id, h, y: Math.round(b.y + shift) });
    }
    shift += grew;
  }
  return out;
}

/**
 * Read back what a run of boxes actually drew at, once the page has laid
 * out, and tidy the page around it.
 *
 * Waited for rather than assumed: a part is mounted the moment `addNode`
 * returns, but it has not been laid out, and a face still loading changes
 * every line in it. So this waits for a frame and for the document's fonts
 * before it measures, which is also why the answer is trustworthy on the
 * machine that does not have the page's font.
 *
 * It measures the node's own box on the board — the box grew because the
 * part inside it did — so nothing here knows anything about words, faces or
 * metrics. It reads a height off the screen.
 */
export async function tidyToWords(ids: readonly string[], read: (id: string) => Drawn | null, apply: (f: Fitted[]) => void): Promise<void> {
  if (ids.length < 1 || typeof document === "undefined") return;
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
  await Promise.race([
    fonts?.ready ?? Promise.resolve(),
    new Promise((go) => setTimeout(go, 1500)),
  ]);
  await new Promise((go) => requestAnimationFrame(() => requestAnimationFrame(go)));
  const boxes: Drawn[] = [];
  for (const id of ids) {
    const b = read(id);
    if (b) boxes.push(b);
  }
  const fitted = fitRows(boxes);
  if (fitted.length) apply(fitted);
}

/** What a node's box drew at on the board, or null if it is not on screen. */
export function drawnOnBoard(node: { id: string; x: number; y: number; w: number; h: number }): Drawn | null {
  const el = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!(el instanceof HTMLElement)) return null;
  return { id: node.id, x: node.x, y: node.y, w: node.w, h: node.h, drew: el.offsetHeight };
}
