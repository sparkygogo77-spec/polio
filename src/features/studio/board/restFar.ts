/**
 * LOOPS FAR FROM THE VIEW REST.
 *
 * A part that moves for ever (a float, a spin, a ticker's run, a film's
 * strip) keeps a compositing layer of its own, and every frame the browser
 * sorts every layer against everything drawn on the board. On the sol face
 * board six such loops sat screens below the view, and with them every
 * frame spent 11 ms at 4× CPU arranging layers; without them, 3.3 ms
 * (`tests/board-far-loops.mjs`). A paused animation keeps its layer, so they
 * are cancelled, not paused, and started again before they come into view:
 * a screen above or below it, so what is seen has always been running. Only
 * loops: an entrance that has played is left alone, so nothing that came in
 * once comes in again. What is near is never touched.
 */
import * as React from "react";

/** How far past the view a loop keeps running: one more view above and below. */
const NEAR = "100% 0px 100% 0px";

/** Its loops, cancelled, by the part's element, to be played again when it comes near. */
const resting = new WeakMap<Element, Animation[]>();

function rest(el: Element) {
  const loops = el.getAnimations({ subtree: true }).filter((a) => a.playState !== "idle" && a.effect?.getTiming().iterations === Infinity);
  if (!loops.length) return;
  for (const a of loops) a.cancel();
  resting.set(el, [...(resting.get(el) ?? []), ...loops]);
}

function wake(el: Element) {
  const loops = resting.get(el);
  if (!loops) return;
  resting.delete(el);
  for (const a of loops) {
    const fx = a.effect as KeyframeEffect | null;
    const target = fx?.target;
    if (!target?.isConnected) continue;
    /* Only if its rule still asks for it: the toolbar's still switch, or an edit, may have taken it off meanwhile. */
    const name = (a as CSSAnimation).animationName;
    if (name && !getComputedStyle(target, fx?.pseudoElement ?? null).animationName.split(",").map((s) => s.trim()).includes(name)) continue;
    a.play();
  }
}

/**
 * Watch the board's parts against the pane they scroll in. `parts` is the
 * drawn parts' ids, so parts drawn anew are watched too.
 */
export function useRestFar(board: React.RefObject<HTMLElement | null>, parts: string) {
  React.useEffect(() => {
    const el = board.current;
    const pane = el?.closest("[data-studio-pane]");
    if (!el || !(pane instanceof HTMLElement) || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((seen) => { for (const s of seen) (s.isIntersecting ? wake : rest)(s.target); }, { root: pane, rootMargin: NEAR });
    for (const part of el.querySelectorAll("[data-node-id]")) io.observe(part);
    return () => {
      io.disconnect();
      for (const part of el.querySelectorAll("[data-node-id]")) wake(part);
    };
  }, [board, parts]);
}
