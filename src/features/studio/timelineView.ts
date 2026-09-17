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
/**
 * How far in it will push, at the very most.
 *
 * It used to be 1, on the reasoning that fitting is for pulling out. That is
 * true of a board covered in work and wrong of the case a person actually
 * opens on: measured with three updates in a 1272x615 board, the fit stopped
 * at 1 and the chain covered 26% of it — three cards adrift in the middle of
 * an empty floor. Fitting is for filling the window with what there is,
 * whichever direction that means moving.
 */
export const SETTLE_MAX_ZOOM = 1.8;

/**
 * The most one card may take of the window, across.
 *
 * This is what stops a single update becoming a poster, and it is why the
 * ceiling is not a number that depends on the count. A count rule guesses;
 * this measures — the fewer the updates the more room each has, which is the
 * same thing arrived at from the card rather than from a table of counts,
 * and it follows the card's own size, so cards drawn two and a half times
 * wider are held to the same share of the screen without this changing.
 */
export const CARD_SHARE = 0.42;

/** The ceiling for a board this wide showing cards this wide. */
export function zoomCeiling(viewW: number, cardW: number): number {
  if (!(viewW > 1) || !(cardW > 1)) return SETTLE_MAX_ZOOM;
  return Math.max(SETTLE_MIN_ZOOM, Math.min(SETTLE_MAX_ZOOM, (CARD_SHARE * viewW) / cardW));
}
/** How long the move takes. Long enough to follow, short enough not to wait on. */
export const SETTLE_MS = 420;

/**
 * How far apart two boxes start arriving, in milliseconds. His number.
 *
 * "everything not seen yet is all loaded in sequentially but each box
 * starts maybe .2 seconds apart, not once the previous is finished". The
 * second clause is the one this number is for: a formation takes a couple
 * of seconds, so starting a fifth of a second apart means several are
 * arriving at once and the run reads as a sequence rather than a queue.
 */
export const STAGGER_MS = 200;

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
  opts: { margin?: number; min?: number; max?: number; weigh?: ViewBox[] } = {},
): View | null {
  if (!boxes.length || !(view.w > 1) || !(view.h > 1)) return null;
  const margin = opts.margin ?? SETTLE_MARGIN;
  const min = opts.min ?? SETTLE_MIN_ZOOM;
  const max = opts.max ?? SETTLE_MAX_ZOOM;

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const b of boxes) {
    left = Math.min(left, b.x);
    top = Math.min(top, b.y);
    right = Math.max(right, b.x + Math.max(1, b.w));
    bottom = Math.max(bottom, b.y + Math.max(1, b.h));
  }

  /*
   * WHAT GETS CENTRED, AND WHAT MAY HANG OFF THE SIDE.
   *
   * His ruling, after measuring the set 281px left of the middle in a
   * 1318px frame: "the set of boxes is what gets centred, and the fan is
   * furniture that hangs off it. Furniture may overhang, and 'nothing sits
   * on an edge' does not outrank 'the thing you are reading is in the
   * middle'. If the fan then runs off the right edge at a narrow size, the
   * fan is what gives, not the column."
   *
   * So `weigh`, when it is given, is the column: it decides the middle,
   * and it is what the pan is held on ACROSS. Everything — the fan
   * included — still decides the zoom and is still held DOWN the page,
   * because a fan that overhangs to the right is furniture you can see and
   * a fan under the opaque band along the foot is furniture that is gone.
   */
  const middle = opts.weigh?.length ? opts.weigh : boxes;
  let mass = 0;
  let mx = 0;
  let my = 0;
  let wide0 = Infinity;
  let wide1 = -Infinity;
  for (const b of middle) {
    const w = Math.max(1, b.w);
    const h = Math.max(1, b.h);
    const weight = w * h;
    mass += weight;
    mx += (b.x + w / 2) * weight;
    my += (b.y + h / 2) * weight;
    wide0 = Math.min(wide0, b.x);
    wide1 = Math.max(wide1, b.x + w);
  }
  if (!Number.isFinite(left) || !mass) return null;

  const com = { x: mx / mass, y: my / mass };
  const span = { w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
  const room = { w: Math.max(1, view.w - margin * 2), h: Math.max(1, view.h - margin * 2) };
  /*
   * The whole set decides the zoom — and then the floor gives if the column
   * still will not fit at it.
   *
   * `min` is a floor on how far out the fit will pull, so that a long chain
   * does not become unreadable. It is not allowed to cost him the column:
   * "if the honest answer is that at some sizes the column and the fan
   * cannot both fit and the fan must be clipped or dropped, that is fine and
   * expected, and it is the fan that gives." The fan gives by the set being
   * drawn smaller than the floor would like, which is one more thing off the
   * edge; the column being off the edge is the thing that outranks it.
   */
  const wanted = Math.min(room.w / span.w, room.h / span.h);
  /*
   * …and only when there IS a column to protect. With no `weigh` the set is
   * the whole of what there is, and the floor is what stops a chain twenty
   * thousand pixels long from being fitted to nothing: `tests/timeline-view`
   * asks for two boxes 20000 apart and expects the floor, and lowering it
   * there gave 0.066. There is no fan in that case for the column to be
   * protected from.
   */
  const colW = Math.max(1, wide1 - wide0);
  const floor = opts.weigh?.length ? Math.min(min, room.w / colW) : min;
  const zoom = Math.min(max, Math.max(floor, wanted));

  return {
    zoom,
    pan: {
      x: hold(view.w / 2 - com.x * zoom, wide0 * zoom, wide1 * zoom, view.w, margin),
      y: hold(view.h / 2 - com.y * zoom, top * zoom, bottom * zoom, view.h, margin),
    },
  };
}

/**
 * THE FLOOR UNDER EVERY VIEW: is the whole column inside the room?
 *
 * HIS RULING, restated after he measured three cards jammed against the right
 * edge of the frame with 215px of them off it: "NO PART OF THE COLUMN IS
 * EVER OUTSIDE THE FRAME. Clipping the thing he is reading is worse than any
 * amount of the fan hanging off. This outranks everything else."
 *
 * The fit already keeps it — `settleView` holds the pan on `weigh`, and at
 * four sizes it lands the column's centre within 10px of the room's with
 * nothing off any edge. What had no floor under it was the way back in. A
 * view somebody moves is theirs and survives the mount that Finish tears
 * down, and it was handed back without anyone asking whether the column was
 * still on the screen: wheel the board sideways, press Finish twice, and it
 * came back 1887px off the left edge, in silence.
 *
 * So the question is asked, in board coordinates rather than of the DOM,
 * because at the moment it has to be asked the boxes have not arrived yet.
 * A view that fails it is not a view; the caller fits instead, which is
 * also the answer to the second half of the ruling — as near the room's
 * centre as it can be.
 *
 * `margin` is deliberately not the settle's: a view of his own that sits a
 * few pixels inside the edge is a view, and tidying it up to a 56px margin
 * would be a floor that fights the hand rather than one that catches it.
 */
export function columnHolds(
  view: View,
  column: ViewBox[],
  room: { w: number; h: number },
  margin = 0,
): boolean {
  if (!column.length || !(room.w > 1) || !(room.h > 1)) return true;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const b of column) {
    left = Math.min(left, b.x);
    top = Math.min(top, b.y);
    right = Math.max(right, b.x + Math.max(1, b.w));
    bottom = Math.max(bottom, b.y + Math.max(1, b.h));
  }
  if (!Number.isFinite(left)) return true;
  const x0 = view.pan.x + left * view.zoom;
  const x1 = view.pan.x + right * view.zoom;
  const y0 = view.pan.y + top * view.zoom;
  const y1 = view.pan.y + bottom * view.zoom;
  return x0 >= margin && y0 >= margin && x1 <= room.w - margin && y1 <= room.h - margin;
}

/** Is this view near enough to that one that moving would be fidgeting? */
export function sameView(a: View, b: View): boolean {
  return Math.hypot(a.pan.x - b.pan.x, a.pan.y - b.pan.y) < 1 && Math.abs(a.zoom - b.zoom) < 0.004;
}

/**
 * How many updates go across before the chain wraps.
 *
 * The old scatter stepped every update *down* and cycled sideways through
 * three offsets, so the chain was a column however wide the board was:
 * measured with eight updates in a 1272x615 board, the set stood 1214 tall
 * and 563 across, the fit was pinned to the height at 41%, and the chain
 * covered 15% of the floor with the width unused. A board is landscape and a
 * column cannot fill one.
 *
 * So the run wraps, and where it wraps is a reading of the board rather than
 * a number: enough across that the set comes out roughly as wide as the
 * board is, given how tall the rows are. `√(n · aspect)` is the count that
 * makes a grid match an aspect, rounded to a whole run and never fewer than
 * one.
 */
export function acrossFor(n: number, aspect: number, step: { x: number; y: number }): number {
  if (n <= 1) return 1;
  // In steps, not pixels: a row is `x` wide a card and a column `y` tall, so
  // the shape of the grid is the shape of the set only after that is in.
  const shape = Math.max(0.1, (aspect * step.y) / step.x);
  return Math.max(1, Math.min(n, Math.round(Math.sqrt(n * shape))));
}
