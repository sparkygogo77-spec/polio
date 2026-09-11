/**
 * Which strokes are one drawing.
 *
 * A person drawing a bird puts down fifteen strokes and means one bird. The
 * board only ever knew about strokes, so every one of them grew its own
 * **Make real** button and would have become its own unrelated part: a gull
 * drawn as four strokes came back as a row of buttons. Nothing downstream was
 * wrong; nothing upstream had ever said what a drawing *is*.
 *
 * So it is said here, the way a person would say it.
 *
 * - **Close in time.** Strokes laid down one after another belong together,
 *   and a pause closes the group: stop for `PAUSE_MS` and the next stroke
 *   starts a new drawing. That is the rule a person already follows without
 *   being told, and it is the one that needs no cleverness.
 * - **Close in space.** Within a run, strokes that overlap or sit near each
 *   other are one thing, transitively — the bird's wing joins the body
 *   because it touches it, and the body joins the head. A stroke on the far
 *   side of the page during the same run is its own drawing.
 * - **A person's word beats the guess.** This will get it wrong sometimes, so
 *   `group` on a stroke is a decision, and a decision is never overruled:
 *   join by giving strokes one key, split by giving each its own.
 *
 * Pure: no store, no React. The board renders what it says and `tests/ink.mjs`
 * holds it to these rules.
 */

/** A stroke, as this needs to see it. */
export interface InkStroke {
  id: string;
  points: [number, number][];
  /** When it was drawn. Missing on ink from before this existed. */
  at?: number;
  /** A person's decision about which drawing it is in. */
  group?: string | null;
}

export interface InkBounds { x: number; y: number; w: number; h: number }

export interface InkGroup {
  /** The group's key: a person's, when they set one, else the first stroke's id. */
  id: string;
  strokeIds: string[];
  bounds: InkBounds;
  /** A person said so, rather than this having guessed it. */
  decided: boolean;
  /** When the first stroke in it went down. */
  at: number;
}

/**
 * A pause this long closes a drawing.
 *
 * A second and a half: long enough that lifting the pen to reposition does
 * not split a bird in two, short enough that going to look at something and
 * coming back starts a new one.
 */
export const PAUSE_MS = 1500;

/** How far apart two strokes may sit and still be one drawing, as a fraction of the bigger one. */
export const NEAR = 0.4;

/** …and never less than this, so two small strokes side by side still join. */
export const NEAR_FLOOR = 28;

export function boundsOf(points: [number, number][]): InkBounds {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** The union of two boxes. */
export function union(a: InkBounds, b: InkBounds): InkBounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** The shortest distance between two boxes; zero when they touch or overlap. */
export function gap(a: InkBounds, b: InkBounds): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}

/** Near enough to be the same drawing. */
export function near(a: InkBounds, b: InkBounds): boolean {
  const span = Math.max(a.w, a.h, b.w, b.h);
  return gap(a, b) <= Math.max(NEAR_FLOOR, span * NEAR);
}

/**
 * The strokes on a page, as the drawings they are.
 *
 * Guessed first, then overruled by whatever a person has decided.
 */
export function inkGroups(strokes: InkStroke[]): InkGroup[] {
  if (!strokes.length) return [];

  // Board order is the tiebreak, so ink drawn before this existed — with no
  // time on it at all — groups by space alone rather than shuffling.
  const order = new Map(strokes.map((s, i) => [s.id, i]));
  const inTime = [...strokes].sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || order.get(a.id)! - order.get(b.id)!);

  const box = new Map(strokes.map((s) => [s.id, boundsOf(s.points)]));

  /* 1. A pause closes a run. */
  const runs: InkStroke[][] = [];
  let run: InkStroke[] = [];
  let last: number | null = null;
  for (const s of inTime) {
    const at = s.at ?? null;
    // Ink with no time on it never opens a gap: it falls through to space.
    const paused = at !== null && last !== null && at - last > PAUSE_MS;
    if (paused && run.length) { runs.push(run); run = []; }
    run.push(s);
    if (at !== null) last = at;
  }
  if (run.length) runs.push(run);

  /* 2. Within a run, near strokes are one drawing, transitively. */
  const guessed = new Map<string, string>();
  for (const r of runs) {
    const parent = new Map(r.map((s) => [s.id, s.id]));
    const find = (id: string): string => {
      let at = id;
      while (parent.get(at) !== at) at = parent.get(at)!;
      return at;
    };
    // The box of a whole set grows as strokes join it, so a chain of small
    // strokes across a bird stays one bird rather than falling apart at the
    // pair that happens to sit furthest apart.
    const reach = new Map(r.map((s) => [s.id, box.get(s.id)!]));
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const a = find(r[i]!.id), b = find(r[j]!.id);
        if (a === b) continue;
        if (!near(reach.get(a)!, reach.get(b)!)) continue;
        parent.set(b, a);
        reach.set(a, union(reach.get(a)!, reach.get(b)!));
      }
    }
    for (const s of r) guessed.set(s.id, find(s.id));
  }

  /* 3. A person's word beats the guess. */
  const byKey = new Map<string, { strokes: InkStroke[]; decided: boolean }>();
  for (const s of strokes) {
    const key = s.group || guessed.get(s.id) || s.id;
    const bucket = byKey.get(key) ?? { strokes: [], decided: false };
    bucket.strokes.push(s);
    if (s.group) bucket.decided = true;
    byKey.set(key, bucket);
  }

  const out: InkGroup[] = [];
  for (const [id, bucket] of byKey) {
    const members = [...bucket.strokes].sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || order.get(a.id)! - order.get(b.id)!);
    let bounds = box.get(members[0]!.id)!;
    for (const m of members.slice(1)) bounds = union(bounds, box.get(m.id)!);
    out.push({
      id,
      strokeIds: members.map((m) => m.id),
      bounds,
      decided: bucket.decided,
      at: members[0]!.at ?? 0,
    });
  }
  return out.sort((a, b) => a.at - b.at || order.get(a.strokeIds[0]!)! - order.get(b.strokeIds[0]!)!);
}

/** Which group a stroke ended up in, or nothing when it is not on the page. */
export function groupOf(groups: InkGroup[], strokeId: string): InkGroup | null {
  return groups.find((g) => g.strokeIds.includes(strokeId)) ?? null;
}

/**
 * The group nearest this one, for "these belong together".
 *
 * Nearest by the gap between what they cover, because that is what a person
 * means when they point at two drawings and say those are one thing.
 */
export function nearestTo(groups: InkGroup[], id: string): InkGroup | null {
  const mine = groups.find((g) => g.id === id);
  if (!mine) return null;
  let best: InkGroup | null = null;
  let bestGap = Infinity;
  for (const g of groups) {
    if (g.id === id) continue;
    const d = gap(mine.bounds, g.bounds);
    if (d < bestGap) { bestGap = d; best = g; }
  }
  return best;
}
