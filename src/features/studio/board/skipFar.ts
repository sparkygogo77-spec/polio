/**
 * ON A SETTLED BOARD, PARTS FAR FROM THE VIEW ARE NOT DRAWN.
 *
 * Every part on sol face's board is drawn, 13,500 elements, ~9,000 px of them
 * below the view, and every style pass, layout and paint of the board goes
 * through all of them. Once the board has settled (`textFit.ts#useBoardSettled`:
 * the last settle had nothing to write, none is due and no import is tidying),
 * a part more than a view and a half away is left to the browser to skip
 * (`content-visibility: auto`), standing at exactly the size it was drawn at
 * (`contain-intrinsic-size`), so nothing under or around it moves and nothing
 * that watches sizes hears of it. The moment a settle or a tidy is asked for,
 * every part is drawn again first, because those read parts as drawn. A part
 * coming near is drawn before it is seen; the browser draws one in view
 * anyway, whatever this says.
 *
 * THE SIZE IS THE ONE LAYOUT GAVE, NOT THE ONE STYLE REPORTS. Computed style
 * rounds to a thousandth under the board's zoom (716.989 for a box laid out at
 * 716.984375), and that difference was enough for the settle's resize watch to
 * hear every skipped part change size, draw them all, find nothing, settle
 * and skip again, twice a second. So each part's content box is taken from a
 * resize observer of its own, which reports layout's own numbers.
 */
import * as React from "react";

/** How far past the view a part stays drawn: a view and a half above and below. */
const NEAR = "150% 0px 150% 0px";
export const SKIP = "data-skip";

function skip(el: HTMLElement, size: { w: number; h: number } | undefined) {
  if (el.hasAttribute(SKIP) || !size) return;
  el.style.setProperty("contain-intrinsic-size", `${size.w}px ${size.h}px`);
  el.style.setProperty("content-visibility", "auto");
  el.setAttribute(SKIP, "");
}

function draw(el: Element) {
  if (!(el instanceof HTMLElement) || !el.hasAttribute(SKIP)) return;
  el.style.removeProperty("content-visibility");
  el.style.removeProperty("contain-intrinsic-size");
  el.removeAttribute(SKIP);
}

/**
 * Skip far parts while `settled`, draw them all again when it turns false.
 * `parts` is the drawn parts' ids, so parts drawn anew are watched too.
 */
export function useSkipFar(board: React.RefObject<HTMLElement | null>, settled: boolean, parts: string) {
  React.useEffect(() => {
    const el = board.current;
    const pane = el?.closest("[data-studio-pane]");
    if (!el || !settled || !(pane instanceof HTMLElement) || typeof IntersectionObserver === "undefined" || typeof ResizeObserver === "undefined") return;
    /* Each part's content box as layout last gave it, while it was drawn. */
    const sizes = new WeakMap<Element, { w: number; h: number }>();
    const far = new Set<HTMLElement>();
    const ro = new ResizeObserver((seen) => {
      for (const s of seen) {
        if (s.target.hasAttribute(SKIP)) continue;
        const box = s.contentBoxSize?.[0];
        sizes.set(s.target, box ? { w: box.inlineSize, h: box.blockSize } : { w: s.contentRect.width, h: s.contentRect.height });
        if (far.has(s.target as HTMLElement)) skip(s.target as HTMLElement, sizes.get(s.target));
      }
    });
    const io = new IntersectionObserver((seen) => {
      for (const s of seen) {
        const t = s.target as HTMLElement;
        if (s.isIntersecting) { far.delete(t); draw(t); } else { far.add(t); skip(t, sizes.get(t)); }
      }
    }, { root: pane, rootMargin: NEAR });
    for (const part of el.querySelectorAll("[data-node-id]")) { ro.observe(part); io.observe(part); }
    return () => {
      io.disconnect();
      ro.disconnect();
      for (const part of el.querySelectorAll(`[${SKIP}]`)) draw(part);
    };
  }, [board, settled, parts]);
}
