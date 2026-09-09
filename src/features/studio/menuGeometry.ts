/**
 * The part menu's geometry, shared by every level of it.
 *
 * Everything here works in the wheel's own local coordinates — the pointer is
 * the origin, turns are clockwise from straight up — and is spun into place
 * at the end. The levels stack on the same rings: level one is the blue set,
 * level two the green set, and the editor that opens off a green choice
 * takes the three green quadrants that level two is not using, cut with the
 * same `piece()` as everything else so it reads as more of the same object.
 */

export type Pt = [number, number];
export type Shape = "square" | "round";

/**
 * The three radii, and a second set for the level below.
 *
 * The hole is wide enough for the lock to sit in it with room to spare and for
 * the pull-line to leave it cleanly; the bands are thick enough to hold an
 * icon over a word without either touching an edge; and the seam between the
 * inner band and the outer block is cut wider than the seams beside it,
 * because that is the one gap you read the ring's two rings by.
 *
 * Level two gets its own, larger set: it holds more choices than level one and
 * it is the only thing on screen when it is up, so it can afford the room.
 */
export interface Rings { hole: number; mid: number; reach: number }
export const BLUE_RINGS: Rings = { hole: 40, mid: 82, reach: 124 };
export const GREEN_RINGS: Rings = { hole: 46, mid: 96, reach: 150 };

/**
 * Corner radius. Every piece is drawn inset by this and grown back out with a
 * round-joined stroke of its own colour, which is what curves every corner —
 * including the one where a wedge narrows to a point at the pointer, which is
 * exactly where a wedge otherwise looks sharpest and worst.
 */
export const ROUND = 5;
/** Clear space along every seam, in px. No two pieces ever touch. */
export const SEAM = 7;
/** The seam between the inner band and the outer block, cut wider than the rest. */
export const RING_SEAM = 12;
/** How much of that seam a piece takes back when you reach for it. */
export const SWELL = 2;
/** The dark line round a face, in px. */
export const EDGE = 1.25;

/** Quadrants as turn ranges, clockwise from straight up. */
export const QUADS: [number, number][] = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]];

/**
 * The layout never changes, and that is the point.
 *
 * It used to swing round so the empty quadrant faced the middle of the screen,
 * which meant the menu was a different shape depending on where you clicked
 * and your hand could never learn it. Delete is bottom-left. Looks is
 * bottom-right. Always. The one thing that moves it is `menuSpin`.
 */
export const Q_TOP = 0;
export const Q_BOTTOM = 1;
export const Q_DELETE = 2;
export const Q_EMPTY = 3;

export const TURN = (t: number) => t * Math.PI * 2 - Math.PI / 2;

export const onCircle = (t: number, r: number): Pt => {
  const a = TURN(t);
  return [Math.cos(a) * r, Math.sin(a) * r];
};

/** How far a square of half-width `half` reaches in the direction `t`. */
export const squareR = (t: number, half: number): number => {
  const a = TURN(t);
  return half / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
};

export const onSquare = (t: number, half: number): Pt => onCircle(t, squareR(t, half));

/** Turning the whole wheel: the geometry is drawn straight and spun at the end. */
export const spun = (p: Pt, turns: number): Pt => {
  const a = turns * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

/** Where a piece's outer edge sits in the direction `t`, and how far out. */
export function outerAt(t: number, rOut: number | "edge", shape: Shape, inset: number, rg: Rings): { p: Pt; r: number } {
  if (rOut !== "edge") {
    const r = rOut - inset;
    return { p: onCircle(t, r), r };
  }
  if (shape === "round") {
    const r = rg.reach - inset;
    return { p: onCircle(t, r), r };
  }
  const r = squareR(t, rg.reach - inset);
  return { p: onCircle(t, r), r };
}

export const fmt = (v: Pt) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;

/** The four corners of the square, as turns. */
const CORNERS = [0.125, 0.375, 0.625, 0.875];

/**
 * One piece of the ring, drawn inset by `ROUND` and half a seam.
 *
 * The angular inset is worked out per radius rather than fixed, so the seam is
 * the same number of pixels wide against the pointer as it is at the outer
 * edge. A fixed angle is wrong at both ends — a hairline inside and a canyon
 * outside — and it is the reason a ring like this reads as one shape with
 * lines drawn on it instead of as separate slabs.
 */
export function piece(from: number, to: number, rIn: number, rOut: number | "edge", shape: Shape, rg: Rings): string {
  // Turns are periodic, but the corner walk below is not: it looks for corners
  // by value. The console's quadrants start where the green stops, at a full
  // turn, and without this they missed every corner and came out as triangles.
  const base = Math.floor(from);
  const rawFrom = from - base;
  const rawTo = to - base;
  // The seam runs round the ring as well as along it: where an inner band
  // meets the outer block above it, both have to give half of it up. That one
  // is cut wider than the seams beside it, because it is the gap you read the
  // ring's two rings by. The two edges with no neighbour — the hole at the
  // pointer and the outside — keep their full reach.
  const inSeam = rIn > rg.hole ? RING_SEAM / 2 : 0;
  const outSeam = rOut === "edge" ? 0 : RING_SEAM / 2;
  const rA = rIn + ROUND + inSeam;
  const pad = SEAM / 2 + ROUND;
  const turnPad = (r: number) => pad / (Math.PI * 2 * Math.max(12, r));

  const gA = turnPad(rA);
  const aFrom = rawFrom + gA;
  const aTo = rawTo - gA;
  // The outer end has its own inset, taken at the radius it actually reaches —
  // which on a square is much further out toward a corner.
  const gFrom = turnPad(outerAt(rawFrom, rOut, shape, ROUND + outSeam, rg).r);
  const gTo = turnPad(outerAt(rawTo, rOut, shape, ROUND + outSeam, rg).r);
  const bFrom = rawFrom + gFrom;
  const bTo = rawTo - gTo;
  // A piece too narrow to draw would fold inside out; collapse it to a sliver
  // at its own middle instead, where it is simply invisible.
  const mid = (rawFrom + rawTo) / 2;
  const [iFrom, iTo] = aTo > aFrom ? [aFrom, aTo] : [mid - 0.0005, mid + 0.0005];
  const [oFrom, oTo] = bTo > bFrom ? [bFrom, bTo] : [mid - 0.0005, mid + 0.0005];

  let d = `M ${fmt(onCircle(iFrom, rA))}`;
  d += ` A ${rA} ${rA} 0 0 1 ${fmt(onCircle(iTo, rA))}`;
  d += ` L ${fmt(outerAt(oTo, rOut, shape, ROUND + outSeam, rg).p)}`;
  if (rOut === "edge" && shape === "square") {
    // Walk the square backwards, landing on every corner between the two ends,
    // so a piece that turns a corner turns it at a right angle instead of
    // cutting it off with a chord.
    const half = rg.reach - ROUND;
    // A piece can straddle the top of the turn, so the corners past it count too.
    const corners = [...CORNERS, ...CORNERS.map((c) => c + 1)];
    for (const c of corners.reverse()) if (c > oFrom && c < oTo) d += ` L ${fmt(onSquare(c, half))}`;
    d += ` L ${fmt(outerAt(oFrom, rOut, shape, ROUND, rg).p)}`;
  } else {
    const r = outerAt(oFrom, rOut, shape, ROUND + outSeam, rg).r;
    d += ` A ${r} ${r} 0 0 0 ${fmt(outerAt(oFrom, rOut, shape, ROUND + outSeam, rg).p)}`;
  }
  return `${d} Z`;
}

/**
 * The middle of a piece, where its icon and word sit.
 *
 * Not quite the middle by default: a band is wider the further out you go,
 * and a word pushed a little outward stops hanging over its neighbours. A
 * whole quadrant with a long word on it wants `bias` back at 0.5, or the word
 * runs out past the square's edge where the corner is.
 */
export function middleOf(from: number, to: number, rIn: number, rOut: number | "edge", shape: Shape, rg: Rings, bias = 0.6): Pt {
  const mid = (from + to) / 2;
  const a = onCircle(mid, rIn + ROUND + (rIn > rg.hole ? RING_SEAM / 2 : 0));
  const b = outerAt(mid, rOut, shape, ROUND + (rOut === "edge" ? 0 : RING_SEAM / 2), rg).p;
  return [a[0] * (1 - bias) + b[0] * bias, a[1] * (1 - bias) + b[1] * bias];
}

/**
 * A plain annulus sector, for the arcs drawn *on* a piece — a spectrum, a
 * slider track. Split at the halfway point and both halves are under half a
 * turn, so the large-arc flag is always 0; passing 1 because the whole span is
 * over half a turn sends each half the long way round and the shape comes out
 * inside out.
 */
export function arcPath(from: number, to: number, rIn: number, rOut: number): string {
  const mid = from + (to - from) / 2;
  let d = `M ${fmt(onCircle(from, rIn))}`;
  d += ` L ${fmt(onCircle(from, rOut))}`;
  d += ` A ${rOut} ${rOut} 0 0 1 ${fmt(onCircle(mid, rOut))}`;
  d += ` A ${rOut} ${rOut} 0 0 1 ${fmt(onCircle(to, rOut))}`;
  d += ` L ${fmt(onCircle(to, rIn))}`;
  d += ` A ${rIn} ${rIn} 0 0 0 ${fmt(onCircle(mid, rIn))}`;
  d += ` A ${rIn} ${rIn} 0 0 0 ${fmt(onCircle(from, rIn))}`;
  return `${d} Z`;
}
