/**
 * "Nothing moved": two readings of the board, part by part.
 *
 * A reading is each drawn part's box at 1440. A part moved when any side is
 * more than `tolerance` px off, or when it is in one reading and not the
 * other. Pure: the tests import it straight.
 */

export type Box = { x: number; y: number; w: number; h: number };
export type Reading = Record<string, Box>;
export type Moved = { id: string; was: Box | null; now: Box | null; by: number };

export function movedParts(before: Reading, after: Reading, tolerance = 1): Moved[] {
  const out: Moved[] = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = before[id] ?? null, now = after[id] ?? null;
    if (!was || !now) { out.push({ id, was, now, by: Infinity }); continue; }
    const by = Math.max(Math.abs(was.x - now.x), Math.abs(was.y - now.y), Math.abs(was.w - now.w), Math.abs(was.h - now.h));
    if (by > tolerance) out.push({ id, was, now, by });
  }
  return out.sort((a, b) => b.by - a.by);
}

/** The board holds still once two readings in a row agree. */
export const holdsStill = (a: Reading, b: Reading) => movedParts(a, b, 0.5).length === 0;
