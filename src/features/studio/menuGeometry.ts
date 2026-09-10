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
 * The drawing board's radius: one disc over the whole menu, with no hole.
 *
 * Out past the green level's reach, so it covers every piece that could be
 * under it, and inside the margin `keepOnScreen` leaves, so a board opened
 * near an edge is whole. There is no hole in it — the middle is drawing
 * space like everywhere else on it — which is why the way back is on its
 * rim and not at the pointer.
 */
export const BOARD_R = 160;

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
export function piece(from: number, to: number, rIn: number, rOut: number | "edge", shape: Shape, rg: Rings, shrink = 0): string {
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
  // pointer and the outside — keep their full reach. `shrink` pulls every
  // edge in by that many more pixels: the console's slabs wear an aura, and
  // an aura needs a gap to be seen in.
  const inSeam = rIn > rg.hole ? RING_SEAM / 2 : 0;
  const outSeam = rOut === "edge" ? 0 : RING_SEAM / 2;
  const rA = rIn + ROUND + inSeam + shrink;
  const pad = SEAM / 2 + ROUND + shrink;
  const turnPad = (r: number) => pad / (Math.PI * 2 * Math.max(12, r));

  const gA = turnPad(rA);
  const aFrom = rawFrom + gA;
  const aTo = rawTo - gA;
  // The outer end has its own inset, taken at the radius it actually reaches —
  // which on a square is much further out toward a corner.
  const gFrom = turnPad(outerAt(rawFrom, rOut, shape, ROUND + outSeam + shrink, rg).r);
  const gTo = turnPad(outerAt(rawTo, rOut, shape, ROUND + outSeam + shrink, rg).r);
  const bFrom = rawFrom + gFrom;
  const bTo = rawTo - gTo;
  // A piece too narrow to draw would fold inside out; collapse it to a sliver
  // at its own middle instead, where it is simply invisible.
  const mid = (rawFrom + rawTo) / 2;
  const [iFrom, iTo] = aTo > aFrom ? [aFrom, aTo] : [mid - 0.0005, mid + 0.0005];
  const [oFrom, oTo] = bTo > bFrom ? [bFrom, bTo] : [mid - 0.0005, mid + 0.0005];

  let d = `M ${fmt(onCircle(iFrom, rA))}`;
  d += ` A ${rA} ${rA} 0 0 1 ${fmt(onCircle(iTo, rA))}`;
  d += ` L ${fmt(outerAt(oTo, rOut, shape, ROUND + outSeam + shrink, rg).p)}`;
  if (rOut === "edge" && shape === "square") {
    // Walk the square backwards, landing on every corner between the two ends,
    // so a piece that turns a corner turns it at a right angle instead of
    // cutting it off with a chord.
    const half = rg.reach - ROUND - shrink;
    // A piece can straddle the top of the turn, so the corners past it count too.
    const corners = [...CORNERS, ...CORNERS.map((c) => c + 1)];
    for (const c of corners.reverse()) if (c > oFrom && c < oTo) d += ` L ${fmt(onSquare(c, half))}`;
    d += ` L ${fmt(outerAt(oFrom, rOut, shape, ROUND + shrink, rg).p)}`;
  } else {
    const r = outerAt(oFrom, rOut, shape, ROUND + outSeam + shrink, rg).r;
    d += ` A ${r} ${r} 0 0 0 ${fmt(outerAt(oFrom, rOut, shape, ROUND + outSeam + shrink, rg).p)}`;
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

/**
 * A piece of a band whose two ends run parallel to the ring's own seams.
 *
 * `arcPath` cuts its ends along a radius, and a radius converges on the
 * pointer: at the inner edge the end sits closer to the slab's seam than at
 * the outer edge, by however much the radius has changed. So a spectrum drawn
 * across a whole quadrant hangs over the slab's edge at one radius and leaves
 * a gap at the other, and the gap is a wedge — which is exactly what reads as
 * the thing being crooked inside a straight-sided box.
 *
 * Here the ends are given as a distance in *pixels*, turned into an angle at
 * whatever radius is being drawn, so each end is the same distance from the
 * slab's seam all the way along it. `ang(u, r)` is that mapping: how far round
 * the turn a point sits, given how far across the run it is and at what
 * radius. Steps tile exactly, because neighbours share their `u`.
 */
export function bandPath(u0: number, u1: number, rIn: number, rOut: number, ang: (u: number, r: number) => number): string {
  // Split at the halfway point for the same reason `arcPath` does: both halves
  // stay under half a turn, so the large-arc flag is always 0.
  const mid = (u0 + u1) / 2;
  let d = `M ${fmt(onCircle(ang(u0, rIn), rIn))}`;
  d += ` L ${fmt(onCircle(ang(u0, rOut), rOut))}`;
  d += ` A ${rOut} ${rOut} 0 0 1 ${fmt(onCircle(ang(mid, rOut), rOut))}`;
  d += ` A ${rOut} ${rOut} 0 0 1 ${fmt(onCircle(ang(u1, rOut), rOut))}`;
  d += ` L ${fmt(onCircle(ang(u1, rIn), rIn))}`;
  d += ` A ${rIn} ${rIn} 0 0 0 ${fmt(onCircle(ang(mid, rIn), rIn))}`;
  d += ` A ${rIn} ${rIn} 0 0 0 ${fmt(onCircle(ang(u0, rIn), rIn))}`;
  return `${d} Z`;
}

/* ------------------------------------------------------------------ */
/* Square mode: a slab is a box, not a bent ring                       */
/* ------------------------------------------------------------------ */

/**
 * When the wheel is square, nothing on it should pretend to be round.
 *
 * A square quadrant is a box: the corner nearest the pointer is bitten out by
 * the hole, the two straight sides run along the axes, and the outer edge is
 * two sides of the square. Laying an arc across that box wastes the corner and
 * leaves the strips beside the axes empty, which is what made a square menu
 * look like a round one someone had squashed.
 *
 * So the same call sites keep speaking in radii and turns — a slider still
 * asks for a band between two radii, chips still ask for a row — and these
 * translate that into the box. A radius becomes a *depth*: how far from the
 * pointer, with the whole ring band stretched over the whole box so the
 * innermost row sits against the near edge rather than a hole's width above
 * it. A turn becomes a fraction *across*.
 *
 * Across always runs the wheel's own left to right, in all four quadrants.
 * Turning each quadrant's frame with it — the obvious thing, and the first
 * thing tried — makes the four read as a pinwheel: rows across in two of them
 * and down the other two, which is exactly the "not aligned in their frames"
 * the square was meant to fix. Depth is the one thing that mirrors, running
 * away from the pointer, so the four boxes meet at the middle the way they
 * are drawn to. The whole lot still sits inside the wheel's rotated group, so
 * a spun wheel carries its rows round with it.
 */

/**
 * How a piece's stroke turns a corner.
 *
 * The rounded corners of this menu *are* the stroke: every path is drawn inset
 * and grown back with a wide stroke of its own colour, so a round join is what
 * curves them. A square menu wants the corners where a piece meets the square's
 * own edge to be sharp — that edge is a straight line and a bead of radius on
 * the end of it reads as a smudge — so it mitres instead, which lands the
 * corner exactly where the geometry put it.
 *
 * With a low miter limit, because a piece narrowing toward the pointer makes an
 * acute angle and a mitre there would shoot out a spike several times the width
 * of the stroke. The limit turns exactly those joins back into a bevel and
 * leaves the right angles alone.
 */
export const joinFor = (shape: Shape): "miter" | "round" => (shape === "square" ? "miter" : "round");

/** Clear space between what is drawn on a slab and the slab's own edge. */
export const SLAB_PAD = 11;

/**
 * Which of the four boxes a quadrant is, as the two facts a layout needs:
 * whether the box is left of the pointer (so the hole bites the far end of
 * every row rather than the near one) and whether rows stack up or down.
 */
export function slabFrame(from: number): { flip: boolean; sy: number } {
  const q = ((Math.round(from * 4) % 4) + 4) % 4;
  return { flip: q === 2 || q === 3, sy: q === 1 || q === 2 ? 1 : -1 };
}

/** How far from the pointer a radius sits, once the band is stretched over the box. */
export function slabDepth(r: number | "edge", rg: Rings, pad = SLAB_PAD): number {
  const v = r === "edge" ? rg.reach : r;
  const f = Math.max(0, Math.min(1, (v - rg.hole) / (rg.reach - rg.hole)));
  return pad + f * (rg.reach - 2 * pad);
}

/** The radius a depth came from: `slabDepth` read backwards. */
export function slabRadius(depth: number, rg: Rings, pad = SLAB_PAD): number {
  return rg.hole + ((depth - pad) / (rg.reach - 2 * pad)) * (rg.reach - rg.hole);
}

/** The far edge of the box, as a depth. */
export const slabFar = (rg: Rings, pad = SLAB_PAD): number => rg.reach - pad;

/**
 * Where a row at this depth begins and ends.
 *
 * Deep rows run the full width. The shallow ones — the strip along the near
 * edge, which a round layout throws away — have the hole's quarter circle
 * taken out of one end, whichever end the pointer is at.
 */
export function slabRun(from: number, depth: number, rg: Rings, pad = SLAB_PAD): { a0: number; a1: number } {
  const d = Math.max(0, Math.min(rg.hole, depth));
  const cut = pad + Math.sqrt(Math.max(0, rg.hole * rg.hole - d * d));
  return slabFrame(from).flip ? { a0: pad, a1: rg.reach - cut } : { a0: cut, a1: rg.reach - pad };
}

/** A point on a square slab, in the wheel's own coordinates. */
export function onSlab(from: number, across: number, depth: number, rg: Rings): Pt {
  const { flip, sy } = slabFrame(from);
  return [flip ? across - rg.reach : across, sy * depth];
}

/** A rectangle on a square slab, as a path. Corners are left to the stroke, as everywhere else. */
export function slabRect(from: number, a0: number, a1: number, dNear: number, dFar: number, rg: Rings): string {
  const pts: Pt[] = [
    onSlab(from, a0, dNear, rg),
    onSlab(from, a1, dNear, rg),
    onSlab(from, a1, dFar, rg),
    onSlab(from, a0, dFar, rg),
  ];
  return `M ${pts.map(fmt).join(" L ")} Z`;
}
