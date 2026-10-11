/**
 * THE LAB: five experiments on a page's layout, as pure rules.
 *
 * J (2026-10-10): "develop ... new test features in the builder that i can
 * access through one new temporary side panel option". Each rule here reads
 * the parts of one page and says what to change; the panel (`ui.ts`) applies
 * it as one undo through `patchNodes`. The board and the Preview both draw
 * the same parts, so a change shows in both at once. The tab is temporary:
 * delete this folder and its line in `page/side.tsx` and nothing else moves.
 *
 * No React, no store; every import ends in .ts so node tests load it.
 */

/**
 * The part of a part these rules read: a box with an id.
 *
 * `flow` says how it sits on the page it came from. "still": a fixed part,
 * or a layer the Builder drew for itself (a canvas the page repaints); it
 * never moves and is never measured. "loose": placed out of the flow
 * (absolute); it rides with whatever holds it but makes no gap of its own.
 * Left out, the part is in the flow.
 */
export interface Box { id: string; x: number; y: number; w: number; h: number; flow?: "still" | "loose" }
/** One change to make: a part's new place or size. */
export interface Move { id: string; x?: number; y?: number; w?: number; h?: number }

const byTop = (a: Box, b: Box) => a.y - b.y || a.x - b.x;
const round = (v: number) => Math.round(v);

/** The parts on the page, from the top down: what every rule starts from. */
export const stacked = (boxes: readonly Box[]): Box[] => [...boxes].sort(byTop);

/** The flow a part sits in, from a Builder part: fixed parts and the Builder's own layers stay still, absolute ones are loose. */
export function flowOf(n: { inert?: boolean; from?: { position?: string } | null }): Box["flow"] {
  if (n.inert || n.from?.position === "fixed") return "still";
  if (n.from?.position === "absolute") return "loose";
  return undefined;
}

/** The commonest value in a list (the smallest of a tie), rounded to `step`. */
export function commonest(values: readonly number[], step = 4): number | null {
  if (!values.length) return null;
  const tally = new Map<number, number>();
  for (const v of values) { const k = Math.round(v / step) * step; tally.set(k, (tally.get(k) ?? 0) + 1); }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
}

/* ------------------------------------------------------------ the page as boxes in boxes */

/**
 * Which part holds which. A brought-in page is nested: a panel holds its
 * heading and its button, a band holds the panel. Measured flat, every part
 * inside a panel sat "-900px" under the panel's bottom, and evening that out
 * dropped every part below the box that held it (J, 2026-10-11: the
 * sunkcoin page came apart and grew far longer). So a part's holder is the
 * smallest other part whose box takes it in whole, and gaps are only ever
 * measured between parts that share a holder. Still parts hold nothing.
 */
function nest(boxes: readonly Box[]): Map<string | null, Box[]> {
  const live = boxes.filter((b) => b.flow !== "still");
  const at = new Map(live.map((b, i) => [b.id, i]));
  const holds = (a: Box, b: Box) => a.x <= b.x + 1 && a.y <= b.y + 1 && a.x + a.w >= b.x + b.w - 1 && a.y + a.h >= b.y + b.h - 1;
  const kids = new Map<string | null, Box[]>();
  for (const b of live) {
    let holder: Box | null = null;
    for (const a of live) {
      if (a === b || !holds(a, b)) continue;
      /* Two parts with one box: the first one listed holds the other, never both ways round. */
      if (holds(b, a) && at.get(a.id)! > at.get(b.id)!) continue;
      if (!holder || a.w * a.h < holder.w * holder.h) holder = a;
    }
    const key = holder?.id ?? null;
    const list = kids.get(key);
    if (list) list.push(b); else kids.set(key, [b]);
  }
  for (const list of kids.values()) list.sort(byTop);
  return kids;
}

const besideX = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0;

/**
 * For one part among its fellows (in the flow, sharing its holder, above it
 * and beside it in x): the part it sits on, if it overlaps one (it is laid
 * over it, so it is no gap), else the one whose bottom is nearest above it.
 */
function restsOn<T extends Box>(b: Box, above: readonly T[]): { on: T | null; over: boolean } {
  let on: T | null = null;
  for (const a of above) {
    if (!besideX(a, b)) continue;
    if (a.y + a.h > b.y + 1) return { on: a, over: true };
    if (!on || a.y + a.h > on.y + on.h) on = a;
  }
  return { on, over: false };
}

/**
 * Restack the page: each gap between fellows becomes `place(gap)`. A part
 * carries what it holds and everything below it (so a row stays a row and a
 * panel's contents stay in the panel), a part laid over another moves with
 * it, loose parts ride with their holder, still parts never move. A holder
 * grows or shrinks with its contents, keeping the room under its last one.
 */
function restack(boxes: readonly Box[], place: (gap: number) => number): Move[] {
  const kids = nest(boxes);
  const out: Move[] = [];
  /* Lays out what `holder` holds, moved down by `shift`; gives back how far the lowest part's bottom moved, relative to the holder. */
  const lay = (holder: string | null, shift: number): number => {
    const list = kids.get(holder) ?? [];
    const placed: { box: Box; by: number; grew: number }[] = [];
    let wasLow = -Infinity; let nowLow = -Infinity;
    for (const b of list) {
      let by = shift;
      if (b.flow !== "loose") {
        const { on, over } = restsOn(b, placed.map((p) => p.box));
        const p = on ? placed.find((q) => q.box === on)! : null;
        if (p && over) by = p.by;
        else if (p) by = p.box.y + p.box.h + p.by + p.grew + place(b.y - (p.box.y + p.box.h)) - b.y;
      }
      const grew = lay(b.id, by);
      if (b.flow !== "loose") placed.push({ box: b, by, grew });
      if (round(b.y + by) !== round(b.y) || round(grew) !== 0) out.push({ id: b.id, y: round(b.y + by), ...(round(grew) !== 0 ? { h: round(b.h + grew) } : {}) });
      wasLow = Math.max(wasLow, b.y + b.h); nowLow = Math.max(nowLow, b.y + b.h + by + grew - shift);
    }
    return list.length ? nowLow - wasLow : 0;
  };
  lay(null, 0);
  return out;
}

/* ------------------------------------------------------------ 1. Rhythm */

/** One gap between a part and the next one down. */
export interface Gap { above: string; below: string; gap: number }

/**
 * The gaps between stacked parts, top to bottom, only ever between parts
 * that share a holder. Parts that sit beside each other (sharing rows) are
 * measured against the part whose bottom is nearest above them, so a
 * two-column row makes no false gap of zero; a part laid over another
 * (overlapping it) makes no gap at all, and still and loose parts none.
 */
export function gapsOf(boxes: readonly Box[]): Gap[] {
  const out: Gap[] = [];
  for (const list of nest(boxes).values()) {
    const flow = list.filter((b) => b.flow !== "loose");
    for (let i = 1; i < flow.length; i++) {
      const b = flow[i]!;
      const { on, over } = restsOn(b, flow.slice(0, i));
      if (on && !over) out.push({ above: on.id, below: b.id, gap: round(b.y - (on.y + on.h)) });
    }
  }
  const top = new Map(boxes.map((b) => [b.id, b]));
  return out.sort((a, b) => byTop(top.get(a.below)!, top.get(b.below)!));
}

/** What the page's rhythm is: the usual gap, and the gaps that break it. */
export function rhythmOf(boxes: readonly Box[], tolerance = 4): { usual: number | null; gaps: Gap[]; off: Gap[] } {
  const gaps = gapsOf(boxes);
  const usual = commonest(gaps.map((g) => g.gap));
  const off = usual === null ? [] : gaps.filter((g) => Math.abs(g.gap - usual) > tolerance);
  return { usual, gaps, off };
}

/**
 * Even out: every gap becomes `gap`, parts move only up or down, a part
 * carries everything below it and everything it holds (so a row stays a row
 * and a panel keeps its contents), and a holder grows or shrinks to fit.
 */
export const evenOut = (boxes: readonly Box[], gap: number): Move[] => restack(boxes, () => gap);

/* ------------------------------------------------------------ 2. Density */

/**
 * Spread or tighten: every gap is scaled by `factor` (1 = as is, 0.8
 * tighter, 1.3 airier); sizes stay, only the distances between parts move
 * (a holder grows or shrinks with what it holds).
 */
export const scaleRhythm = (boxes: readonly Box[], factor: number): Move[] => restack(boxes, (g) => g * factor);

/* ------------------------------------------------------------ 3. Mirror */

/** Flip the page left to right inside a frame `width` wide: sizes stay, x is mirrored. */
export const mirror = (boxes: readonly Box[], width: number): Move[] =>
  boxes.map((b) => ({ id: b.id, x: round(width - b.x - b.w) })).filter((m, i) => m.x !== round(boxes[i]!.x));

/* ------------------------------------------------------------ 4. Columns */

/** The left edges the page uses most: its columns, strongest first, at most `max`. Edges within `step` of each other are one column, at the x most of them share. */
export function columnsOf(boxes: readonly Box[], max = 4, step = 8): number[] {
  const buckets = new Map<number, number[]>();
  for (const b of boxes) { const k = Math.round(b.x / step); buckets.set(k, [...(buckets.get(k) ?? []), round(b.x)]); }
  return [...buckets.values()].filter((xs) => xs.length > 1).sort((a, b) => b.length - a.length || a[0]! - b[0]!).slice(0, max).map((xs) => commonest(xs, 1)!);
}

/** Snap each part's left edge to the nearest column within `reach`; parts already on one stay. */
export function snapToColumns(boxes: readonly Box[], columns: readonly number[], reach = 40): Move[] {
  if (!columns.length) return [];
  const out: Move[] = [];
  for (const b of boxes) {
    const near = columns.reduce((best, c) => (Math.abs(c - b.x) < Math.abs(best - b.x) ? c : best), columns[0]!);
    if (near !== round(b.x) && Math.abs(near - b.x) <= reach) out.push({ id: b.id, x: near });
  }
  return out;
}

/* ------------------------------------------------------------ 5. Reading order */

/**
 * The order a person reads the page in: by row (parts whose tops are within
 * half a line of each other share a row), then left to right.
 */
export function readingOrder(boxes: readonly Box[], line = 24): string[] {
  const rows = stacked(boxes);
  const out: Box[][] = [];
  for (const b of rows) {
    const row = out[out.length - 1];
    if (row && Math.abs(row[0]!.y - b.y) <= line) row.push(b); else out.push([b]);
  }
  return out.flatMap((row) => row.sort((a, b) => a.x - b.x || a.y - b.y).map((b) => b.id));
}

/** Which parts the drawing order (what a screen reader and the tab key follow) puts out of reading order. */
export function outOfOrder(drawn: readonly string[], read: readonly string[]): string[] {
  const at = new Map(read.map((id, i) => [id, i]));
  const out: string[] = [];
  let high = -1;
  for (const id of drawn) {
    const i = at.get(id) ?? -1;
    if (i < high) out.push(id); else high = i;
  }
  return out;
}
