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
 * - **What touches is one thing.** A stroke laid over or against what is
 *   already there is more of it, however long the hand stopped first. This
 *   is the rule, and it is first.
 * - **What merely sits nearby is one thing if it was drawn in the same
 *   sitting.** Near but not touching — a leg under a body, a dot over an i
 *   — joins while you are still at it, and stops joining once you have been
 *   away (`SITTING_MS`). Nearness grows transitively, so a chain of small
 *   strokes across a bird stays one bird.
 * - **A stroke somewhere else is somewhere else.** Distance separates
 *   whatever the clock says: that is how a person starts a second drawing.
 *
 * Time used to come *first* — a pause of a second and a half closed the
 * group and space could only work inside it — and that was the whole bug. A
 * person drawing a careful bird stops to look at it before adding the head,
 * and the head arrived in a new run where it could never reach the body it
 * was drawn on top of. Fifteen strokes came out as several drawings and
 * loose ink. Pausing is what a person does while drawing one thing; going
 * somewhere else is what they do to start another.
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
 * How long a hand may rest before *nearby* strokes stop joining.
 *
 * Half a minute: long enough to look at what you have drawn, think, change
 * colour and carry on — all of which a person does in the middle of one
 * drawing — and short enough that leaving the board and coming back to it
 * starts a new one.
 *
 * It does not apply to a stroke that touches what is already there. Nothing
 * closes a drawing you are still drawing on.
 */
export const SITTING_MS = 30_000;

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

/** Near enough to be the same drawing, if it was drawn in the same sitting. */
export function near(a: InkBounds, b: InkBounds): boolean {
  const span = Math.max(a.w, a.h, b.w, b.h);
  return gap(a, b) <= Math.max(NEAR_FLOOR, span * NEAR);
}

/**
 * Touching: one drawing whatever the clock says.
 *
 * Judged on the boxes rather than the ink, which is deliberately generous —
 * a diagonal's box covers a lot of nothing. Generous is the right way to be
 * wrong here: a stroke put down on top of a drawing is part of it far more
 * often than it is a new drawing that happens to land there, and Split is
 * one press away when it is not.
 */
export function touching(a: InkBounds, b: InkBounds): boolean {
  return gap(a, b) <= 0;
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

  /*
   * Built in the order the strokes were drawn, because that is the order the
   * question is actually asked in: does this one belong to anything already
   * on the board? One stroke can answer yes to several — a wing bridging a
   * body and a tail — and then those were always one drawing and are merged.
   */
  interface Growing {
    ids: string[];
    /** Everything it covers so far, so a chain of small strokes stays one. */
    reach: InkBounds;
    /** When it was last drawn on, which is what a pause is measured from. */
    lastAt: number | null;
  }
  const open: Growing[] = [];
  for (const s of inTime) {
    const b = box.get(s.id)!;
    const at = s.at ?? null;
    const joins = open.filter((g) => {
      // Touching is one drawing whatever the clock says.
      if (touching(g.reach, b)) return true;
      if (!near(g.reach, b)) return false;
      // Near, but not touching: only while the hand is still on this one.
      // Ink with no time on it never opens a gap; it falls through to space.
      if (at === null || g.lastAt === null) return true;
      return at - g.lastAt <= SITTING_MS;
    });
    if (!joins.length) {
      open.push({ ids: [s.id], reach: b, lastAt: at });
      continue;
    }
    const keep = joins[0]!;
    keep.ids.push(s.id);
    keep.reach = union(keep.reach, b);
    if (at !== null) keep.lastAt = at;
    for (const g of joins.slice(1)) {
      keep.ids.push(...g.ids);
      keep.reach = union(keep.reach, g.reach);
      if (g.lastAt !== null) keep.lastAt = Math.max(keep.lastAt ?? g.lastAt, g.lastAt);
      open.splice(open.indexOf(g), 1);
    }
  }

  /* The key is the stroke that started it, so it does not move as the
     drawing grows and a merge does not rename anything. */
  const when = new Map(strokes.map((s) => [s.id, s.at ?? 0]));
  const earlier = (a: string, b: string) => when.get(a)! - when.get(b)! || order.get(a)! - order.get(b)!;
  const guessed = new Map<string, string>();
  for (const g of open) {
    const first = g.ids.reduce((a, b) => (earlier(b, a) < 0 ? b : a));
    for (const id of g.ids) guessed.set(id, first);
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
