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

/** The part of a part these rules read: a box with an id. */
export interface Box { id: string; x: number; y: number; w: number; h: number }
/** One change to make: a part's new place or size. */
export interface Move { id: string; x?: number; y?: number; w?: number; h?: number }

const byTop = (a: Box, b: Box) => a.y - b.y || a.x - b.x;
const round = (v: number) => Math.round(v);

/** The parts on the page, from the top down: what every rule starts from. */
export const stacked = (boxes: readonly Box[]): Box[] => [...boxes].sort(byTop);

/** The commonest value in a list (the smallest of a tie), rounded to `step`. */
export function commonest(values: readonly number[], step = 4): number | null {
  if (!values.length) return null;
  const tally = new Map<number, number>();
  for (const v of values) { const k = Math.round(v / step) * step; tally.set(k, (tally.get(k) ?? 0) + 1); }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
}

/* ------------------------------------------------------------ 1. Rhythm */

/** One gap between a part and the next one down (negative when they overlap). */
export interface Gap { above: string; below: string; gap: number }

/**
 * The gaps between stacked parts, top to bottom. Parts that sit beside each
 * other (sharing rows) are measured against the part whose bottom is
 * nearest above them, so a two-column row makes no false gap of zero.
 */
export function gapsOf(boxes: readonly Box[]): Gap[] {
  const rows = stacked(boxes);
  const out: Gap[] = [];
  for (let i = 1; i < rows.length; i++) {
    const b = rows[i]!;
    let best: Box | null = null;
    for (let j = 0; j < i; j++) {
      const a = rows[j]!;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (overlapX <= 0) continue;
      if (!best || a.y + a.h > best.y + best.h) best = a;
    }
    if (best) out.push({ above: best.id, below: b.id, gap: round(b.y - (best.y + best.h)) });
  }
  return out;
}

/** What the page's rhythm is: the usual gap, and the gaps that break it. */
export function rhythmOf(boxes: readonly Box[], tolerance = 4): { usual: number | null; gaps: Gap[]; off: Gap[] } {
  const gaps = gapsOf(boxes);
  const usual = commonest(gaps.filter((g) => g.gap >= 0).map((g) => g.gap));
  const off = usual === null ? [] : gaps.filter((g) => Math.abs(g.gap - usual) > tolerance);
  return { usual, gaps, off };
}

/**
 * Even out: every gap becomes `gap`, parts move only up or down, and a part
 * carries everything below it with it (so a row stays a row).
 */
export function evenOut(boxes: readonly Box[], gap: number): Move[] {
  const rows = stacked(boxes);
  const shift = new Map<string, number>();
  const placed: Box[] = [];
  for (const b of rows) {
    let under: Box | null = null;
    for (const a of placed) {
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (overlapX > 0 && (!under || a.y + a.h > under.y + under.h)) under = a;
    }
    const y = under ? under.y + under.h + gap : b.y;
    placed.push({ ...b, y });
    if (round(y) !== round(b.y)) shift.set(b.id, round(y));
  }
  return [...shift.entries()].map(([id, y]) => ({ id, y }));
}

/* ------------------------------------------------------------ 2. Density */

/**
 * Spread or tighten: every gap is scaled by `factor` (1 = as is, 0.8
 * tighter, 1.3 airier); sizes stay, only the distances between parts move.
 */
export function scaleRhythm(boxes: readonly Box[], factor: number): Move[] {
  const rows = stacked(boxes);
  const placed: Box[] = [];
  const out: Move[] = [];
  for (const b of rows) {
    let under: Box | null = null; let was: Box | null = null;
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]!; const orig = rows[i]!;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (overlapX > 0 && (!under || orig.y + orig.h > was!.y + was!.h)) { under = a; was = orig; }
    }
    const y = under && was ? under.y + under.h + Math.max(0, b.y - (was.y + was.h)) * factor : b.y;
    placed.push({ ...b, y });
    if (round(y) !== round(b.y)) out.push({ id: b.id, y: round(y) });
  }
  return out;
}

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
