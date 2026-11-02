/**
 * WHERE A WHEEL POP-UP STANDS. Pure, so the checks can hold it without a page.
 *
 * A pop-up leaves the wheel along the angle of the slab that opened it, just
 * past the wheel's own edge. If that side has no room it flips to the other
 * side of the wheel, and only then is it pushed back inside the window. Its
 * smaller pop-up stands beside it, on the first side with room.
 */
export interface Box { x: number; y: number; w: number; h: number }
export interface Placed { x: number; y: number; flipX: boolean; flipY: boolean }

const MARGIN = 8;
const GAP = 10;
/** Past this share of the angle a side is "the" side; nearer the axis the pop-up centres on it. */
const LEANS = 0.38;

const along = (at: number, dir: number, size: number) => (dir > LEANS ? at : dir < -LEANS ? at - size : at - size / 2);
const inside = (v: number, size: number, win: number) => Math.max(MARGIN, Math.min(win - size - MARGIN, v));

/**
 * The pop-up's corner. `cx, cy` is the wheel's middle, `angle` the slab's in
 * radians, `reach` how far the wheel runs out at that angle.
 */
export function placePopup(cx: number, cy: number, angle: number, reach: number, w: number, h: number, winW: number, winH: number): Placed {
  const r = reach + GAP;
  const c = Math.cos(angle), s = Math.sin(angle);
  const at = (dc: number, ds: number) => ({ x: along(cx + dc * r, dc, w), y: along(cy + ds * r, ds, h) });
  const first = at(c, s);
  const flipX = first.x < MARGIN || first.x + w > winW - MARGIN;
  const flipY = first.y < MARGIN || first.y + h > winH - MARGIN;
  const p = at(flipX ? -c : c, flipY ? -s : s);
  return { x: inside(p.x, w, winW), y: inside(p.y, h, winH), flipX, flipY };
}

/** The smaller pop-up beside `parent`: the side the wheel opened toward, then the rest. */
export function placeBeside(parent: Box, cx: number, cy: number, w: number, h: number, winW: number, winH: number): Placed & { side: number } {
  const midX = parent.x + parent.w / 2, midY = parent.y + parent.h / 2;
  const away = { x: midX < cx ? -1 : 1, y: midY < cy ? -1 : 1 };
  const sides = [
    { x: parent.x, y: away.y < 0 ? parent.y - h - GAP : parent.y + parent.h + GAP },
    { x: away.x < 0 ? parent.x - w - GAP : parent.x + parent.w + GAP, y: parent.y },
    { x: parent.x, y: away.y < 0 ? parent.y + parent.h + GAP : parent.y - h - GAP },
    { x: away.x < 0 ? parent.x + parent.w + GAP : parent.x - w - GAP, y: parent.y },
  ];
  const fits = (p: { x: number; y: number }) => p.x >= MARGIN && p.y >= MARGIN && p.x + w <= winW - MARGIN && p.y + h <= winH - MARGIN;
  const side = Math.max(0, sides.findIndex(fits));
  const p = sides[side]!;
  return { x: inside(p.x, w, winW), y: inside(p.y, h, winH), flipX: side === 3, flipY: side === 2, side };
}
