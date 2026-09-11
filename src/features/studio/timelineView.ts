/**
 * Where the timeline should be looking.
 *
 * Boxes on the timeline are dragged wherever a person wants them, so
 * "centre" cannot mean the origin — the origin is where the scatter happened
 * to start, and after five minutes of moving things it is nowhere in
 * particular. Centre means the middle of the boxes themselves.
 *
 * Two things decide the view, and they can pull against each other:
 *
 *  · **The middle is the centre of mass, weighted by size.** A box counts
 *    for its area, so a wall of iterations pulls the eye more than one small
 *    piece parked off on its own. That is the point the view wants at the
 *    middle of the window.
 *  · **Nothing sits on an edge.** The bounds of the whole set are fitted
 *    inside the window with a margin all round, and the pan is then held so
 *    both edges stay inside it. Where the two disagree — a lopsided set
 *    whose weighted middle would push a corner off — the holding wins,
 *    because a box you cannot see is worse than a middle that is a little
 *    off.
 *
 * The zoom never goes above 1: fitting is for pulling *out* to take
 * everything in, and blowing two boxes up to fill a window is not centring,
 * it is a magnifier. When even the floor is not enough to hold the set —
 * somebody has dragged a box a long way — the bounds are centred instead,
 * which is the fair answer when no pan can keep both edges in.
 *
 * Pure, and tested by `tests/timeline-view.mjs`. The positions come from the
 * store; nothing here measures the DOM.
 */

export interface Point {
  x: number;
  y: number;
}

/** One box, in the plot's own coordinates: where the store says it is, and how big it stands. */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface View {
  pan: Point;
  zoom: number;
}

/** How much clear space is left round the set, in screen pixels. */
export const SETTLE_MARGIN = 56;
/** How far out it will pull to take everything in. */
export const SETTLE_MIN_ZOOM = 0.4;
/** And it will not push in past life size: fitting is for pulling out. */
export const SETTLE_MAX_ZOOM = 1;
/** How long the move takes. Long enough to follow, short enough not to wait on. */
export const SETTLE_MS = 420;

/** Ease out: quick away, slow into place, so it reads as settling rather than sliding. */
export const settleEase = (u: number): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3);

/**
 * Hold one axis so the set's near and far edges both stay a margin inside
 * the window — or, when it is too big for that, put it in the middle.
 */
function hold(pan: number, lo: number, hi: number, view: number, margin: number): number {
  const size = hi - lo;
  if (size > view - margin * 2) return (view - size) / 2 - lo;
  return Math.max(margin - lo, Math.min(view - margin - hi, pan));
}

/**
 * The view that puts this set of boxes where it should be, or null when
 * there is nothing to look at or nowhere to look from.
 */
export function settleView(
  boxes: ViewBox[],
  view: { w: number; h: number },
  opts: { margin?: number; min?: number; max?: number } = {},
): View | null {
  if (!boxes.length || !(view.w > 1) || !(view.h > 1)) return null;
  const margin = opts.margin ?? SETTLE_MARGIN;
  const min = opts.min ?? SETTLE_MIN_ZOOM;
  const max = opts.max ?? SETTLE_MAX_ZOOM;

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let mass = 0;
  let mx = 0;
  let my = 0;
  for (const b of boxes) {
    const w = Math.max(1, b.w);
    const h = Math.max(1, b.h);
    left = Math.min(left, b.x);
    top = Math.min(top, b.y);
    right = Math.max(right, b.x + w);
    bottom = Math.max(bottom, b.y + h);
    const weight = w * h;
    mass += weight;
    mx += (b.x + w / 2) * weight;
    my += (b.y + h / 2) * weight;
  }
  if (!Number.isFinite(left) || !mass) return null;

  const com = { x: mx / mass, y: my / mass };
  const span = { w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
  const room = { w: Math.max(1, view.w - margin * 2), h: Math.max(1, view.h - margin * 2) };
  const zoom = Math.max(min, Math.min(max, Math.min(room.w / span.w, room.h / span.h)));

  return {
    zoom,
    pan: {
      x: hold(view.w / 2 - com.x * zoom, left * zoom, right * zoom, view.w, margin),
      y: hold(view.h / 2 - com.y * zoom, top * zoom, bottom * zoom, view.h, margin),
    },
  };
}

/** Is this view near enough to that one that moving would be fidgeting? */
export function sameView(a: View, b: View): boolean {
  return Math.hypot(a.pan.x - b.pan.x, a.pan.y - b.pan.y) < 1 && Math.abs(a.zoom - b.zoom) < 0.004;
}
