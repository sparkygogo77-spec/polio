/**
 * The selection follows the shape, not the box round it.
 *
 * A part cut to a drawn line already renders as that line — the clip is on
 * the node and has been for a while — but picking it up drew a square with a
 * lot of empty corners, which is the difference between a made real part
 * feeling like a part and feeling like a picture pasted in. A diagonal should
 * show a selection that hugs the diagonal.
 *
 * The same path the clip uses is walked here, so the mark and the crop can
 * never disagree: `M`, `C`, `L` and `Z` are all `outlinePath` ever writes, in
 * the part's own 0..1 box, and the handles are put on that path's extremes
 * rather than on the box's corners.
 *
 * Pure: no DOM, no `getPointAtLength`, so it is the same answer on the board,
 * in a test and on a server.
 */

export type Corner = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type Point = [number, number];

/** How finely a curve is sampled. Twelve is smooth enough to find an end of a line. */
const PER_CURVE = 12;

/** Every number in a path, in order, with the letters kept beside them. */
const STEP = /([MCLZmclz])([^MCLZmclz]*)/g;

/**
 * The path as points, in the order it is drawn.
 *
 * Absolute commands only, because that is all `outlinePath` writes; a
 * relative one is walked from the pen anyway rather than dropped, so a hand
 * written path does not silently come out as a straight line.
 */
export function walkPath(d: string, per = PER_CURVE): Point[] {
  const out: Point[] = [];
  let pen: Point = [0, 0];
  let start: Point = [0, 0];
  for (const [, letter, rest] of d.matchAll(STEP)) {
    const rel = letter! === letter!.toLowerCase() && letter!.toLowerCase() !== "z";
    const n = (rest!.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const at = (i: number): Point => (rel ? [pen[0] + (n[i] ?? 0), pen[1] + (n[i + 1] ?? 0)] : [n[i] ?? 0, n[i + 1] ?? 0]);
    switch (letter!.toUpperCase()) {
      case "M": {
        for (let i = 0; i + 1 < n.length; i += 2) {
          pen = at(i);
          if (i === 0) { start = pen; out.push(pen); }
          else out.push(pen);
        }
        break;
      }
      case "L": {
        for (let i = 0; i + 1 < n.length; i += 2) { pen = at(i); out.push(pen); }
        break;
      }
      case "C": {
        for (let i = 0; i + 5 < n.length; i += 6) {
          const p0 = pen;
          const c1 = at(i), c2 = at(i + 2), p3 = at(i + 4);
          for (let s = 1; s <= per; s++) {
            const t = s / per, u = 1 - t;
            out.push([
              u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
              u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
            ]);
          }
          pen = p3;
        }
        break;
      }
      case "Z": {
        out.push(start);
        pen = start;
        break;
      }
    }
  }
  return out;
}

/**
 * Which way each handle looks, as a direction to be extreme in.
 *
 * A corner is the far point along its diagonal and an edge is the far point
 * along its axis, so on a diagonal band the two corner handles land on the
 * two ends of the line and the others sit on its sides — which is what
 * hugging the shape means.
 */
const LOOKS: Record<Corner, Point> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

export const CORNERS: Corner[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * Where each handle sits on this path, in the part's own 0..1 box.
 *
 * Nothing when the path says too little to place them on — a couple of
 * points is not a shape — and then the box's own corners are right after all.
 */
export function handlePoints(d: string): Record<Corner, Point> | null {
  const pts = walkPath(d);
  if (pts.length < 4) return null;
  const out = {} as Record<Corner, Point>;
  for (const c of CORNERS) {
    const [lx, ly] = LOOKS[c];
    let best = pts[0]!;
    let bestScore = -Infinity;
    for (const p of pts) {
      // Furthest in the direction the handle looks; ties broken towards the
      // middle of the other axis, so an edge handle sits on the middle of an
      // edge rather than at whichever end came first.
      const score = p[0] * lx + p[1] * ly - (lx === 0 ? Math.abs(p[0] - 0.5) : 0) * 1e-3 - (ly === 0 ? Math.abs(p[1] - 0.5) : 0) * 1e-3;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    out[c] = best;
  }
  return out;
}
