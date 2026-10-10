/**
 * THE EDGE SCROLL, FOR EVERY DRAG ON THE BOARD.
 *
 * J (2026-10-10): "the site should scroll like when pressing down a scroll
 * wheel and you reach the edges to scroll up and down". A middle-click
 * scroll goes faster the further the hand is from where it started; here
 * the "start" is a band inside the board's top and bottom edges. In the
 * band it starts gently, at the edge it is brisk, and past the edge (over
 * the shelf, over the top bar) it keeps speeding up to a ceiling, so a hand
 * thrown well past the edge travels the page quickly.
 *
 * One loop, used by moving a part, resizing, the selection box, drawing,
 * and a shelf card carried over the board (`cardCarry.ts`). A loop rather
 * than a pointer move, because a hand held against an edge sends no moves.
 */

/** How far inside an edge the scroll starts. */
export const EDGE_BAND = 72;
/** Pixels a frame (at 60 a second) when the hand is far past the edge. */
export const EDGE_TOP_SPEED = 36;
/** Past the edge by this much, the scroll is at its ceiling. */
const EDGE_PAST = 160;

/**
 * Pixels to scroll this frame for a hand at `y` in a scroller spanning
 * `top`..`bottom` on screen: negative is up, 0 is out of every band.
 */
export function edgeStep(y: number, top: number, bottom: number): number {
  const intoFoot = y - (bottom - EDGE_BAND);
  const intoHead = top + EDGE_BAND - y;
  const push = intoFoot > 0 ? intoFoot : intoHead > 0 ? -intoHead : 0;
  if (!push) return 0;
  const t = Math.min(1, Math.abs(push) / (EDGE_BAND + EDGE_PAST));
  /* Gentle at the start of the band, then faster the further in: a curve, not a switch. */
  return Math.sign(push) * Math.max(1, EDGE_TOP_SPEED * t * t);
}

/** The scroller the board stands in. */
export function boardPane(): HTMLElement | null {
  const p = typeof document === "undefined" ? null : document.querySelector("[data-studio-pane]");
  return p instanceof HTMLElement ? p : null;
}

/**
 * Run the edge scroll until the returned stop is called. `hand` is where the
 * pointer is now (null: not yet, or not to scroll); `scrolled` is told after
 * each frame the pane really moved, so the drag can be re-applied at the
 * same point on screen and what is held travels with the page.
 */
export function startEdgeScroll(
  hand: () => { x: number; y: number } | null,
  scrolled: (at: { x: number; y: number }) => void,
  pane: () => HTMLElement | null = boardPane,
): () => void {
  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = last ? Math.min(3, (now - last) / (1000 / 60)) : 1;
    last = now;
    const p = pane();
    const at = hand();
    if (p && at) {
      const box = p.getBoundingClientRect();
      const step = edgeStep(at.y, box.top, box.bottom) * dt;
      if (step) {
        const was = p.scrollTop;
        p.scrollTop = Math.max(0, Math.min(p.scrollHeight - p.clientHeight, was + step));
        /* Only when it moved: at either end there is nothing to follow. */
        if (p.scrollTop !== was) scrolled(at);
      }
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
