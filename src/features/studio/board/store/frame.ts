"use client";
import type { Space } from "../../space";
import { StudioNode, StudioShape } from "./model";

/**
 * Height of the frame: at least a screen, and always past the lowest thing
 * on the page — whatever kind of thing that is.
 *
 * It counted parts and nothing else, and that is a clip with a person's
 * name on it. The window the page stands in is sized from this, so a
 * stroke of ink, an arrow, or a drawn space below the last part is drawn
 * inside a window that does not know it is there: the window's
 * `scrollHeight` runs past its `clientHeight` and the difference is
 * unreachable by any gesture. Measured with one pen stroke a hundred
 * pixels under a stock page: 138px of it hidden, and no bar, no wheel and
 * no drag could bring it back.
 *
 * It is the first thing a person does — pick up the pencil and draw on the
 * ground below the page — so it is the first thing that has to be counted.
 * Anything the page renders is passed here; `reach` is what each kind
 * reaches down to.
 */
export function frameHeight(
  nodes: StudioNode[],
  min = 900,
  also: { shapes?: StudioShape[]; spaces?: Space[] } = {},
): number {
  /*
   * A PART'S FOOT IS THE FOOT OF THE PAGE. INK BELOW IT IS NOT.
   *
   * This used to add 160px under whatever was lowest, of any kind, which
   * meant the end of the page was always a margin past the last thing on it
   * — so putting a part near the bottom moved the bottom, and putting it at
   * the new bottom moved it again. Measured: a part dropped at the foot of an
   * 837px page came to rest at y 838 and the page went to 1054. There was
   * nothing to snap to because the end of the page ran away from whatever was
   * put near it.
   *
   * So a part sets the page's foot exactly, and the page settles. Ink, arrows
   * and drawn spaces keep their margin, because those are drawn on the ground
   * below the page rather than placed on it, and the window they live in has
   * to know they are there or the last of them is unreachable.
   */
  /*
   * A part hidden as the page opens (`state`: shown on a press) is not on
   * the page that opens, and the board never draws it. Counted, it made the
   * page as long as the lowest hidden thing: PST's Home is 1574px of site
   * and came in 2607 tall, a thousand pixels of blank page that the site
   * scrolled up into, so the page read as a still frame with the site
   * sliding away inside it. `tests/board-top-edge.mjs`.
   */
  const placed = nodes.reduce((m, n) => (n.state ? m : Math.max(m, n.y + n.h)), 0);
  let scratch = 0;
  for (const sh of also.shapes ?? []) {
    for (const [, y] of sh.points) scratch = Math.max(scratch, y);
  }
  for (const sp of also.spaces ?? []) {
    for (const [, y] of sp.boundary) scratch = Math.max(scratch, y);
  }
  return Math.max(min, placed, scratch ? scratch + 160 : 0);
}

/**
 * How far the highest thing on the page reaches ABOVE its origin.
 *
 * Zero almost always, because y=0 is the site's top and that is where
 * things are put. It is not zero when somebody draws above the page, which
 * is an ordinary thing to do on a surface whose space outside the frame is
 * scratch — and the page must not grow to meet it, because moving the
 * origin would renumber every coordinate in the document. The *board*
 * grows instead: this is how much room it needs above the page, so what is
 * drawn up there is on the surface rather than off the top of it.
 *
 * Parts are counted too. A capture places a part where the site had it, and
 * sink's section pages have the SOL WORKS badge at y -11: the site's own
 * header lets it hang over the top. Leaving parts out was a barrier the
 * owner did not ask for. Measured on 2bbde72: the board keeps 20px of
 * ground over the page, so at the zoom it opens at the badge fitted, and
 * zoomed in to 3.03 its top 13px sat above the board where no scroll
 * reaches; a part at y -200 was 175px out of reach at any zoom.
 * The part is not moved and the page's origin does not move either: the
 * board reaches up to it, as it does to ink. `tests/part-above-reach.mjs`.
 */
export function frameTopReach(
  also: { nodes?: StudioNode[]; shapes?: StudioShape[]; spaces?: Space[] } = {},
  margin = 24,
): number {
  let top = 0;
  for (const n of also.nodes ?? []) top = Math.min(top, n.y);
  for (const sh of also.shapes ?? []) {
    for (const [, y] of sh.points) top = Math.min(top, y);
  }
  for (const sp of also.spaces ?? []) {
    for (const [, y] of sp.boundary) top = Math.min(top, y);
  }
  return top < 0 ? Math.round(-top) + margin : 0;
}

/** Page widths the frame can take. Positions are absolute; the frame just shows what fits. */
export const FRAME_WIDTHS = { desktop: 1440, tablet: 834, phone: 390 } as const;


/**
 * Where a new part may land: inside the page, always.
 *
 * Every way a part comes into being funnels through `addNode`, and none of
 * them used to check this — a part added near an edge simply kept the
 * coordinate it was handed and sat half off the page. Dragging one out
 * afterwards is still allowed, because that is someone saying where they
 * want it; arriving outside is nobody saying anything.
 *
 * A part wider than the page lines up with its left edge rather than being
 * centred, because centring something too big hangs it off both sides at
 * once.
 */
export function placeInFrame(x: number, y: number, w: number, frameWidth: number): { x: number; y: number } {
  // To a hundredth of a pixel: a part laid at a share of a page keeps the
  // share it was laid at, and a hundredth is nothing the board can show.
  const fine = (v: number) => Math.round(v * 100) / 100;
  return {
    x: fine(w >= frameWidth ? 0 : Math.min(Math.max(0, x), frameWidth - w)),
    y: fine(Math.max(0, y)),
  };
}
