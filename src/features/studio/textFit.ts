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
import * as React from "react";

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
export function fitRows(boxes: readonly Drawn[], grows?: (id: string) => boolean): Fitted[] {
  /*
   * WHAT A BOX STANDS UNDER, NOT WHAT COMES AFTER IT IN THE LIST.
   *
   * This carried one running total. Rows were taken in order down the page
   * and every growth, and every overlap prised apart, was added to a single
   * `shift` that every later row then took — whatever column it was in. The
   * floor already asked the right question when it looked for what a row
   * stood under; the answer was then applied to everything below it on the
   * page.
   *
   * On his three-column Documentation page that was catastrophic and the
   * numbers say it plainly: 2403px tall became 5323px, sixteen gaps over
   * 60px totalling 2876px — almost exactly the height gained — and of the
   * twelve widest gaps, twelve had NO horizontal span in common between the
   * pair above and below. A 45px flame at x603-633 was pushing "Seamless
   * Token Swapping" at x1309-1457 down by 493px. Sidebar entries at x303-451
   * were pushing body paragraphs at x603-1158 down by up to 238. Zero
   * crossings was true and it was not the result: his standing rule is that
   * a capture stays true to its size and its ratios, and doubling the height
   * of the page breaks that more visibly than the overlap it fixed.
   *
   * So there is no running total at all. Every box is placed against the
   * boxes it actually STANDS UNDER — the ones above it that share some of
   * its width — and against nothing else. Two boxes side by side in
   * different columns share no span, so neither can ever displace the other,
   * which is the whole of what was wrong.
   *
   * One relation does both jobs. For each box above this one that it stands
   * under, the gap the capture recorded between them is kept — and clamped
   * at zero, so a pair that was saved INTO each other is laid apart instead.
   * Growth propagates because the box above is placed before this one and
   * its new height is what the gap is measured from. That is why this
   * replaces the row banding rather than restoring it: rows were never the
   * right unit, they were a cheap stand-in for "what is above me", and they
   * are the reason a stored overlap was invisible in the first place.
   *
   * Three cards side by side still push the page down once rather than three
   * times, and now for a reason rather than by grouping: what sits under all
   * three takes the LOWEST of the three, because it is placed against each
   * of them and keeps the largest answer.
   */
  const order = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const put = new Map<string, { y: number; h: number }>();
  const out: Fitted[] = [];
  for (let i = 0; i < order.length; i++) {
    const b = order[i]!;
    const mayMove = !grows || grows(b.id);
    /* A box that is his is not touched — not grown, not shifted. It still
       stands on the page, so what comes under it is still laid under it: he
       put it there and his placement is a decision, where the capture's was
       an accident of measurement. */
    const h = mayMove ? Math.max(b.h, Math.round(b.drew)) : b.h;
    let y = b.y;
    if (mayMove) {
      for (let j = 0; j < i; j++) {
        const p = order[j]!;
        /* Above it, standing over it, and neither one holding the other —
           a captured page is wrappers round wrappers, and prising a child
           out of its parent is far worse than any overlap. */
        if (p.y >= b.y || !across(b, p) || holds(b, p) || holds(p, b)) continue;
        const was = put.get(p.id) ?? { y: p.y, h: p.h };
        const gap = Math.max(0, b.y - (p.y + p.h));
        y = Math.max(y, was.y + was.h + gap);
      }
    }
    put.set(b.id, { y, h });
    if (h !== b.h || y !== b.y) out.push({ id: b.id, h, y });
  }
  return out;
}

/** Do these two stand over each other at all, left to right? */
function across(a: Drawn, b: Drawn): boolean {
  return a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1;
}

/** Does the first hold the second whole? A wrapper and its child, not a clash. */
function holds(a: Drawn, b: Drawn): boolean {
  return a.x <= b.x + 1 && a.y <= b.y + 1 && a.x + a.w >= b.x + b.w - 1 && a.y + a.h >= b.y + b.h - 1;
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

/* ------------------------------------------------------------------ */
/* The push, kept up rather than done once                             */
/* ------------------------------------------------------------------ */

/**
 * A box that grew moves what follows it — every time it grows, not once.
 *
 * HIS MEASUREMENT, off the imported Documentation page rather than a
 * fixture: twenty-one pairs of parts crossing each other where neither
 * contains the other, all of them the same shape — a 684-wide paragraph
 * sitting on top of the bullets beneath it by 20 to 40 pixels. The bullets
 * are at the y the capture recorded; the paragraph above them grew because
 * its words wrapped, and nothing below moved.
 *
 * THE TIDY WAS ALREADY RIGHT AND WIRED TO ONE DOOR. `fitRows` does exactly
 * the right arithmetic and `tidyToWords` ran it — from `FromASite` and
 * nowhere else, once, at the end of that one import. So a page that came in
 * by any other door never had it run at all, and even where it did run the
 * result was a SNAPSHOT: the heights were written down against whatever
 * face resolved that day, and the moment words were edited, the frame
 * changed width, or a face resolved wider, the box grew again and nothing
 * moved. The guarantee underneath is a runtime one — the CSS floor in
 * `parts/primitives.tsx` — and a runtime guarantee with a one-shot tidy
 * over it is the gap he found.
 *
 * So the rule is not "tidy after an import". It is: **a box that grew
 * displaces what follows it, whenever it grows.** His own words for why the
 * older fix did not cover this: "a box grows as a flex child", and the
 * paragraphs that overlap are not flex children of anything, so the push
 * never happened for them. Growth is growth however the box is laid out.
 *
 * WHAT IS NOT TOUCHED. A part he placed by hand has no `from` — that field
 * is the live element a part was recreated from, and it is absent on
 * everything drawn or placed. Only a captured part GROWS here. And a page
 * holding no captured part at all never settles: a board he built by hand
 * cannot move, which is the same guarantee the button work gives, in the
 * same shape.
 *
 * A hand-placed part standing below a captured one that grew DOES travel
 * with it, and that is a decision rather than an oversight: half a page
 * moving and half of it staying is worse than either, and a part below a
 * box belongs below that box whoever put it there. It is one predicate to
 * flip if that is wrong.
 *
 * IT CONVERGES, and that is worth saying because an automatic writer that
 * does not is a page that never settles. `fitRows` gives every box the
 * height it DREW at, so the moment it is applied the drawn height and the
 * written height agree and the next measurement has nothing to say. A shift
 * moves boxes without resizing them, which no `ResizeObserver` reports, so
 * moving cannot feed itself. The fingerprint below is the belt to that
 * brace: the same answer is never applied twice.
 */
export function useSettleToWords(
  nodes: readonly { id: string; x: number; y: number; w: number; h: number; byHand?: boolean }[],
  apply: (f: Fitted[]) => void,
): void {
  const latest = React.useRef({ nodes, apply });
  latest.current = { nodes, apply };
  /** The last answer applied, so an unchanged one is never applied again. */
  const said = React.useRef("");
  /** A pointer on the board is a hand mid-gesture; nothing moves under it. */
  const held = React.useRef(false);

  /* Which parts are on this page, and where. The observer is rebuilt when
     the set changes; a settle is scheduled when any of the geometry does. */
  const ids = nodes.map((n) => n.id).join(",");
  const where = nodes.map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`).join("|");

  const settle = React.useCallback(() => {
    if (held.current || typeof document === "undefined") return;
    const ns = latest.current.nodes;
    /*
     * WHOSE BOARD IS THIS.
     *
     * The gate was `from` — the live element a part was recreated from —
     * and it was wrong in the way that mattered: `from` is written on one
     * import door only, so every board that came in by another one looked
     * hand-placed and was never healed at all. His nine captured pages were
     * that board. The question is asked the other way round now: a part is
     * the machine's unless somebody moved it (`StudioNode.byHand`), which is
     * set when a part is added from the library, dragged, resized or typed
     * into, and settled once on hydration for a document older than the
     * field. A page where every part is his is not this rule's business.
     */
    if (!ns.some((n) => !n.byHand)) return;
    const machines = new Set(ns.filter((n) => !n.byHand).map((n) => n.id));
    const boxes: Drawn[] = [];
    for (const n of ns) {
      const d = drawnOnBoard(n);
      if (d) boxes.push(d);
    }
    if (!boxes.length) return;
    const fitted = fitRows(boxes, (id) => machines.has(id));
    if (!fitted.length) { said.current = ""; return; }
    const print = fitted.map((f) => `${f.id}:${f.h},${f.y}`).join("|");
    if (print === said.current) return;
    said.current = print;
    latest.current.apply(fitted);
  }, []);

  /* Debounced, and never before the faces have had their chance: a run of
     words measured while its face is still loading is measured in the
     fallback, which is the very mistake this is here to repair. */
  const timer = React.useRef<number | null>(null);
  const soon = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      requestAnimationFrame(() => requestAnimationFrame(settle));
    }, 160);
  }, [settle]);

  React.useEffect(() => {
    const down = () => { held.current = true; };
    const up = () => { held.current = false; soon(); };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, [soon]);

  React.useEffect(() => {
    if (typeof document === "undefined" || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(soon);
    for (const n of latest.current.nodes) {
      const el = document.querySelector(`[data-node-id="${n.id}"]`);
      if (el instanceof HTMLElement) ro.observe(el);
    }
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    let alive = true;
    void Promise.race([fonts?.ready ?? Promise.resolve(), new Promise((go) => setTimeout(go, 1500))]).then(() => { if (alive) soon(); });
    soon();
    return () => { alive = false; ro.disconnect(); if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [ids, soon]);

  React.useEffect(() => { soon(); }, [where, soon]);
}
