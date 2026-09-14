/**
 * Where the timeline looks when it settles.
 *
 * Two rules that can disagree: the middle is the centre of mass weighted by
 * size, and nothing sits on an edge. The interesting cases are the ones
 * where honouring the first would break the second — a lopsided set, one box
 * carried a long way out — so those are what is checked here, along with the
 * arithmetic that is easy to get subtly wrong: the weighting, the fit, and
 * the zoom that must never push in past life size.
 *
 *   node tests/timeline-view.mjs
 */
import { acrossFor, CARD_SHARE, sameView, settleEase, settleView, zoomCeiling, SETTLE_MARGIN, SETTLE_MAX_ZOOM, SETTLE_MIN_ZOOM } from "../src/features/studio/timelineView.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const near = (a, b, slack = 0.51) => Math.abs(a - b) <= slack;
/** Where a box lands on the screen under a view. */
const onScreen = (b, v) => ({
  left: v.pan.x + b.x * v.zoom,
  top: v.pan.y + b.y * v.zoom,
  right: v.pan.x + (b.x + b.w) * v.zoom,
  bottom: v.pan.y + (b.y + b.h) * v.zoom,
});
const BOX = { w: 248, h: 104 };
const PIECE = { w: 150, h: 44 };
const at = (x, y, size = BOX) => ({ x, y, w: size.w, h: size.h });
const VIEW = { w: 1440, h: 600 };

/* 1. Nothing to look at. */
{
  check("no boxes, no view", settleView([], VIEW) === null);
  check("no window, no view", settleView([at(0, 0)], { w: 0, h: 0 }) === null);
}

/* 2. One box lands in the middle of the window. */
{
  const b = at(4000, -900);
  const v = settleView([b], VIEW);
  const r = onScreen(b, v);
  check("one box is put in the middle", near((r.left + r.right) / 2, VIEW.w / 2) && near((r.top + r.bottom) / 2, VIEW.h / 2),
    `centre ${((r.left + r.right) / 2).toFixed(1)},${((r.top + r.bottom) / 2).toFixed(1)} of ${VIEW.w}×${VIEW.h}`);
  check("and the fit stops at the ceiling it is given", v.zoom === SETTLE_MAX_ZOOM, `zoom ${v.zoom}`);
}

/* 2b. The ceiling itself: a reading of the card against the board.
 *
 * This is what actually keeps one update from becoming a poster, and the
 * check `SETTLE_MAX_ZOOM` used to make on its own. It was a flat 1, which
 * held a chain of three to a quarter of the floor; it is the card's share of
 * the window now, so a wider card is held to the same share without anything
 * here changing — which is the point, because the cards are about to get two
 * and a half times wider. */
{
  const wide = 1272;
  const small = zoomCeiling(wide, 248);
  const big = zoomCeiling(wide, 620);
  check("a narrow card may be pushed in further than a wide one", small > big, `${small.toFixed(2)} against ${big.toFixed(2)}`);
  check("and neither takes more than its share of the window across",
    248 * small <= wide * CARD_SHARE + 0.5 && 620 * big <= wide * CARD_SHARE + 0.5,
    `${Math.round(248 * small)}px and ${Math.round(620 * big)}px of ${wide}`);
  check("a very narrow card still stops somewhere", zoomCeiling(wide, 20) === SETTLE_MAX_ZOOM, `${zoomCeiling(wide, 20)}`);
  check("and a board with no size falls back rather than dividing by it",
    zoomCeiling(0, 248) === SETTLE_MAX_ZOOM && zoomCeiling(wide, 0) === SETTLE_MAX_ZOOM);
}

/* 2c. The chain wraps to the board rather than running off the bottom.
 *
 * Eight updates used to stand 1214 tall and 563 across in a 1272x615 board:
 * a column, fitted to its height at 41%, covering 15% of the floor with the
 * width unused. `acrossFor` is how many go across before it wraps. */
{
  const step = { x: 268, y: 158 };
  const oneUp = acrossFor(1, 2, step);
  check("one update does not wrap", oneUp === 1, `${oneUp} across`);
  const eight = acrossFor(8, 1272 / 615, step);
  check("eight go across rather than down", eight > 1 && eight < 8, `${eight} across, ${Math.ceil(8 / eight)} down`);
  /* The set it makes should come out roughly as wide as the board is, which
     is the whole reason to wrap at all. */
  const shape = (n, aspect) => {
    const a = acrossFor(n, aspect, step);
    return (Math.min(n, a) * step.x) / (Math.ceil(n / a) * step.y);
  };
  for (const n of [3, 8, 20]) {
    const got = shape(n, 1272 / 615);
    check(`${n} updates come out roughly as wide as the board`, got > 0.8 && got < 4.5, `set is ${got.toFixed(2)}:1 against a board 2.07:1`);
  }
  check("a tall board stacks them rather than spreading them",
    acrossFor(12, 0.5, step) < acrossFor(12, 3, step),
    `${acrossFor(12, 0.5, step)} across when tall, ${acrossFor(12, 3, step)} when wide`);
}

/* 3. The middle is weighted by size, not by count. */
{
  // Four small pieces on the left, one full box on the right. Counting heads
  // would put the middle among the pieces; weighting by area does not.
  const pieces = [at(0, 0, PIECE), at(0, 60, PIECE), at(0, 120, PIECE), at(0, 180, PIECE)];
  const big = at(900, 60);
  const v = settleView([...pieces, big], VIEW);
  const heads = (pieces.reduce((n, p) => n + p.x + p.w / 2, 0) + big.x + big.w / 2) / 5;
  const area = PIECE.w * PIECE.h;
  const mass = 4 * area + BOX.w * BOX.h;
  const weighted = (pieces.reduce((n, p) => n + (p.x + p.w / 2) * area, 0) + (big.x + big.w / 2) * BOX.w * BOX.h) / mass;
  // Where the view actually put the middle, back in the plot's own numbers.
  const middle = (VIEW.w / 2 - v.pan.x) / v.zoom;
  check("the middle is weighted by size", Math.abs(middle - weighted) < Math.abs(middle - heads),
    `middle ${middle.toFixed(0)} · weighted ${weighted.toFixed(0)} · by head count ${heads.toFixed(0)}`);
}

/* 4. Nothing sits on an edge, even when the weighted middle would push it there. */
{
  // A dense knot on the left and one box carried far right: the weighted
  // middle sits in the knot, and honouring it alone would leave the carried
  // box off the window.
  const knot = Array.from({ length: 6 }, (_, i) => at(0, i * 130));
  const far = at(2200, 300);
  const boxes = [...knot, far];
  const v = settleView(boxes, VIEW);
  const edges = boxes.map((b) => onScreen(b, v));
  const worst = {
    left: Math.min(...edges.map((r) => r.left)),
    top: Math.min(...edges.map((r) => r.top)),
    right: Math.max(...edges.map((r) => r.right)),
    bottom: Math.max(...edges.map((r) => r.bottom)),
  };
  check("every box is inside the window",
    worst.left >= -0.5 && worst.top >= -0.5 && worst.right <= VIEW.w + 0.5 && worst.bottom <= VIEW.h + 0.5,
    `x ${worst.left.toFixed(0)}..${worst.right.toFixed(0)} of ${VIEW.w} · y ${worst.top.toFixed(0)}..${worst.bottom.toFixed(0)} of ${VIEW.h}`);
  check("and none of them is on an edge",
    worst.left >= SETTLE_MARGIN - 0.5 && worst.right <= VIEW.w - SETTLE_MARGIN + 0.5,
    `nearest edge ${Math.min(worst.left, VIEW.w - worst.right).toFixed(1)}px, margin ${SETTLE_MARGIN}`);
}

/* 5. Too big to fit even pulled all the way out: centred rather than clipped to one side. */
{
  const boxes = [at(0, 0), at(20000, 0)];
  const v = settleView(boxes, VIEW);
  check("it pulls out as far as it goes", v.zoom === SETTLE_MIN_ZOOM, `zoom ${v.zoom}`);
  const a = onScreen(boxes[0], v);
  const b = onScreen(boxes[1], v);
  const spill = { left: -a.left, right: b.right - VIEW.w };
  check("and what will not fit spills evenly rather than to one side", near(spill.left, spill.right, 1),
    `${spill.left.toFixed(0)}px off the left, ${spill.right.toFixed(0)}px off the right`);
}

/* 6. A set that already fits is not shoved about. */
{
  const boxes = [at(200, 100), at(600, 300)];
  const v = settleView(boxes, VIEW);
  const again = settleView(boxes, VIEW);
  check("settling twice settles in the same place", sameView(v, again));
  check("a view is the same as itself", sameView(v, { pan: { x: v.pan.x + 0.5, y: v.pan.y }, zoom: v.zoom }));
  check("and half a window away is not", !sameView(v, { pan: { x: v.pan.x + 700, y: v.pan.y }, zoom: v.zoom }));
}

/* 7. The easing starts and ends where it should. */
{
  check("the ease begins at the start and ends at the end", settleEase(0) === 0 && settleEase(1) === 1);
  check("it is out, not in: most of the way there by the middle", settleEase(0.5) > 0.7, `${settleEase(0.5).toFixed(2)} at half way`);
  check("and it is clamped either side", settleEase(-1) === 0 && settleEase(2) === 1);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
