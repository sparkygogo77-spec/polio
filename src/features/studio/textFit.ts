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
import { under } from "./owns";

/** A box as it stands, and the height it actually drew at. */
export interface Drawn {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** What the box came out as on screen, once its words had the room. */
  drew: number;
  /** The DOM path the capture recorded for it (`node.from.selector`), when it was captured. */
  path?: string;
  /** Whether it holds words of its own: only words reflow, so only they can grow a captured part. */
  words?: boolean;
  /** Its padding either side, as captured: its inside is what a row of its children fills. */
  pad?: { left?: number; right?: number };
  /** Its captured `layout` declares a stretching row — a grid, or a flex row not told to align otherwise — so its children in one line share one height. */
  row?: boolean;
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
export function fitRows(boxes: readonly Drawn[], grows?: (id: string) => boolean, frame?: number): Fitted[] {
  return boxes.some((b) => b.path) ? fitTree(boxes, grows, frame) : fitFlat(boxes, grows);
}

/**
 * A captured page: a box and what it holds move together, and an offset
 * inside a box changes only by the growth above it there.
 *
 * MEASURED on sink's home page through the real door: the placement below
 * (`fitFlat`) gave every part a top of its own and skipped the pair where one
 * box holds another, so a container neither pushed nor carried its contents.
 * The sidebar went down 72 and its eight buttons 12, the first button's icon
 * 0; the footer and its parts by four different amounts. A box whose contents
 * have fallen out of it is what the owner saw.
 *
 * The capture recorded who holds whom — the DOM path, as `owns.ts` reads it —
 * so this places the page as that tree, by two rules (the coordinator's):
 *
 *   1. GROWTH IS ABSORBED BY THE CONTAINER. A part's growth is its words
 *      needing more height than it had, or what it holds growing inside it.
 *      ONLY WORDS: a picture, an icon or a box drawn taller than the capture
 *      recorded is the board drawing it wrong, not the page growing (sink's
 *      "Solana" picture drew 220 against a captured 24 and made the header
 *      308), so it keeps its captured height and moves nothing.
 *      Its container grows by that much, and the container's own contents
 *      below it — the siblings standing under it — move down by it.
 *   2. DISPLACEMENT IS INHERITED. Whatever moves a part moves everything it
 *      holds by exactly that much, so they keep their offsets.
 *
 * Rule 2 is the invariant; rule 1 is the only thing that changes an offset
 * inside a box, and only by the growth above it there. So a sibling moves by
 * the most that any sibling standing over it moved and grew, gap kept as the
 * capture had it — INCLUDING a gap below zero: the page's own overlaps (a
 * fixed header over the top of the sidebar) are the page's, and prising them
 * apart moved the sidebar and not its buttons. A part with no recorded path
 * is a sibling at the top of the page, and against another like it the old
 * rule stands: what was saved into it is laid apart.
 *
 * Measured before it was written: carrying creates no overlap the contents
 * did not already have — on sink's home page, none with no text growth, and
 * with text grown only the ones rule 1 then pushes apart.
 *
 * AND A ROW GROWS AS ONE. His sidebar and his main area are one row that
 * fills together — his own unswept document and his live site both show the
 * column running header to footer — so when the main area's words grow, the
 * rail grows with it; it has no contents that grew, it has a row-mate that
 * did. Siblings are a row only where the capture STATES it, never by a size:
 *   · wordless boxes sharing a top and a height that tile their container's
 *     whole width edge to edge (the container's inside, or the page frame
 *     for a top-level part) — the main-and-rail pair on each section page,
 *     and the documentation page's three columns; or
 *   · siblings sharing a top and a height under a box whose captured `layout`
 *     declares a stretching row (a grid, or a flex row not aligned otherwise).
 * When the last of a row is placed, its members line up on the row's lowest
 * top — carrying what they hold, by rule 2 — and all grow to its lowest bottom.
 */
function fitTree(boxes: readonly Drawn[], grows?: (id: string) => boolean, frame?: number): Fitted[] {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const ownerOf = new Map<string, string | null>();
  for (const b of boxes) {
    let best: Drawn | null = null;
    if (b.path) for (const o of boxes) if (o !== b && o.path && under(o.path, b.path) && (!best || o.path!.length > best.path!.length)) best = o;
    ownerOf.set(b.id, best?.id ?? null);
  }
  const kidsOf = new Map<string | null, Drawn[]>();
  for (const b of boxes) {
    const o = ownerOf.get(b.id) ?? null;
    kidsOf.set(o, [...(kidsOf.get(o) ?? []), b]);
  }
  /** Where each part ended, how far it moved in all, and how much it grew. */
  const put = new Map<string, { y: number; h: number; moved: number; grew: number }>();

  /* The rows the capture states, by sibling set. */
  const rowOf = new Map<string, string[]>();
  for (const [owner, sibs] of kidsOf) {
    const box = owner ? byId.get(owner) : null;
    const left = box ? box.x + (box.pad?.left ?? 0) : 0;
    const right = box ? box.x + box.w - (box.pad?.right ?? 0) : frame;
    const seen = new Set<string>();
    for (const a of sibs) {
      if (seen.has(a.id) || !a.path) continue;
      const line = sibs.filter((b) => b.path && Math.abs(b.y - a.y) <= 1 && Math.abs(b.h - a.h) <= 1);
      line.forEach((b) => seen.add(b.id));
      if (line.length < 2) continue;
      const xs = [...line].sort((p, q) => p.x - q.x);
      const tiles = right !== undefined && line.every((b) => !b.words)
        && Math.abs(xs[0]!.x - left) <= 1 && Math.abs(xs[xs.length - 1]!.x + xs[xs.length - 1]!.w - right) <= 1
        && xs.every((b, i) => i === 0 || Math.abs(b.x - (xs[i - 1]!.x + xs[i - 1]!.w)) <= 1);
      if (tiles || box?.row) { const ids = line.map((b) => b.id); for (const id of ids) rowOf.set(id, ids); }
    }
  }
  /** Move a placed part and everything it holds by `d`: rule 2, applied after the fact. */
  const shift = (id: string, d: number) => {
    const p = put.get(id);
    if (p) put.set(id, { ...p, y: p.y + d, moved: p.moved + d });
    for (const k of kidsOf.get(id) ?? []) shift(k.id, d);
  };

  /** Lay out one box's contents, the box itself having moved `base`. Returns the growth inside it. */
  const place = (owner: string | null, base: number): number => {
    const sibs = [...(kidsOf.get(owner) ?? [])].sort((a, b) => a.y - b.y || a.x - b.x);
    let inside = 0;
    for (const b of sibs) {
      const mayMove = !grows || grows(b.id);
      let rel = 0;
      if (mayMove) {
        for (const p of sibs) {
          if (p === b) break;
          if (p.y >= b.y || !across(b, p)) continue;
          const was = put.get(p.id)!;
          if (b.path && p.path) {
            /* The sibling's own shift inside this box, and its growth: the gap the capture recorded is kept exactly. */
            rel = Math.max(rel, was.moved - base + was.grew);
          } else if (!holds(b, p) && !holds(p, b)) {
            /* Not captured: the old rule, and a pair saved into each other is laid apart. */
            const gap = Math.max(0, b.y - (p.y + p.h));
            rel = Math.max(rel, was.y + was.h + gap - (b.y + base));
          }
        }
      }
      const moved = mayMove ? base + rel : 0;
      const own = mayMove && b.words ? Math.max(0, Math.round(b.drew) - b.h) : 0;
      const held = place(b.id, moved);
      const grew = mayMove ? Math.max(own, held) : 0;
      put.set(b.id, { y: b.y + moved, h: b.h + grew, moved, grew });
      /* The last of a row placed: the row lines up and grows as one. */
      const row = rowOf.get(b.id);
      if (row && row.every((id) => put.has(id))) {
        const top = Math.max(...row.map((id) => put.get(id)!.moved));
        for (const id of row) { const d = top - put.get(id)!.moved; if (d) shift(id, d); }
        const bottom = Math.max(...row.map((id) => put.get(id)!.y + put.get(id)!.h));
        for (const id of row) {
          const p = put.get(id)!, was = byId.get(id)!;
          put.set(id, { ...p, h: bottom - p.y, grew: bottom - p.y - was.h });
        }
      }
    }
    for (const b of sibs) { const p = put.get(b.id)!; inside = Math.max(inside, p.moved - base + p.grew); }
    return inside;
  };
  place(null, 0);

  const out: Fitted[] = [];
  for (const [id, p] of put) {
    const b = byId.get(id)!;
    if (p.h !== b.h || p.y !== b.y) out.push({ id, h: p.h, y: p.y });
  }
  return out;
}

/** A page with nothing captured on it: every box placed against what it stands under. */
function fitFlat(boxes: readonly Drawn[], grows?: (id: string) => boolean): Fitted[] {
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
  atFullSize(() => {
    for (const id of ids) {
      const b = read(id);
      if (b) boxes.push(b);
    }
  });
  const fitted = fitRows(boxes);
  if (fitted.length) apply(fitted);
}

/**
 * Read the board at one to one.
 *
 * The board draws its page with CSS `zoom` (Canvas.tsx), so words are laid
 * out at the zoomed size and a paragraph's height, read back, carries up to
 * a pixel of that size's rounding: 2px of growth that was never there, which
 * the settle below then wrote down and moved everything under it by
 * (`tests/captured-words.mjs`). So a run of readings is taken with the board
 * set to 1:1 and put back in the same task, before anything is painted:
 * what is read is the page as it is, whatever the zoom.
 */
export function atFullSize<T>(read: () => T): T {
  const board = typeof document === "undefined" ? null : document.querySelector<HTMLElement>("[data-board-zoom]");
  const was = board?.style.zoom ?? "";
  if (!board || !was || was === "1") return read();
  board.style.zoom = "1";
  try { return read(); } finally { board.style.zoom = was; }
}

/** What a node's box drew at on the board, or null if it is not on screen. */
export function drawnOnBoard(node: { id: string; x: number; y: number; w: number; h: number; from?: { selector?: string } | null; content?: unknown; layout?: { display?: string; direction?: string; align?: string } | null; pad?: { left?: number; right?: number } | null }): Drawn | null {
  const el = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!(el instanceof HTMLElement)) return null;
  const path = (node.from?.selector ?? "").trim();
  const c = node.content;
  const words = !!(typeof c === "string" ? c.trim() : Array.isArray(c) ? c.map((r) => (r as { text?: string }).text ?? "").join("").trim() : "");
  const l = node.layout;
  const row = !!l && (l.display === "grid" || (l.display === "flex" && (!l.direction || l.direction === "row"))) && (!l.align || l.align === "stretch" || l.align === "normal");
  const pad = node.pad ? { left: node.pad.left ?? 0, right: node.pad.right ?? 0 } : undefined;
  return { id: node.id, x: node.x, y: node.y, w: node.w, h: node.h, drew: el.offsetHeight, ...(path ? { path, words, row, ...(pad ? { pad } : {}) } : {}) };
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
  nodes: readonly { id: string; x: number; y: number; w: number; h: number; byHand?: boolean; from?: { selector?: string } | null; content?: unknown; layout?: { display?: string; direction?: string; align?: string } | null; pad?: { left?: number; right?: number } | null }[],
  apply: (f: Fitted[]) => void,
  /** The page frame's width: a top-level row fills it edge to edge. */
  frame?: number,
): void {
  const latest = React.useRef({ nodes, apply, frame });
  latest.current = { nodes, apply, frame };
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
    /* The page as it opens: a part a press shows is not drawn until then, and moves nothing (`StudioNode.state`). */
    const ns = latest.current.nodes.filter((n) => !(n as { state?: unknown }).state);
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
    atFullSize(() => {
      for (const n of ns) {
        const d = drawnOnBoard(n);
        if (d) boxes.push(d);
      }
    });
    if (!boxes.length) return;
    const fitted = fitRows(boxes, (id) => machines.has(id), latest.current.frame);
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
