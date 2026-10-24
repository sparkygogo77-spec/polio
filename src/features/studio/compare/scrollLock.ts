"use client";
/**
 * TWO PANES THAT SCROLL AS ONE.
 *
 * Moving either sets the other to the same offset in px, not the same
 * fraction: a copy that is a little taller should still show the same part of
 * the page at the same place, which is what a person comparing is looking at.
 * Setting a scroll position raises a scroll event in the pane it was set on;
 * that echo is told apart by the offset it lands on, so the two never chase
 * each other.
 */
import * as React from "react";

export function useScrollLock(a: HTMLElement | null, b: HTMLElement | null, on: boolean): void {
  React.useEffect(() => {
    if (!on || !a || !b) return;
    const set = new Map<HTMLElement, number>();
    const follow = (from: HTMLElement, to: HTMLElement) => () => {
      if (set.get(from) === from.scrollTop) { set.delete(from); return; }
      if (to.scrollTop === from.scrollTop) return;
      to.scrollTop = from.scrollTop;
      set.set(to, to.scrollTop);
    };
    const ab = follow(a, b);
    const ba = follow(b, a);
    a.addEventListener("scroll", ab, { passive: true });
    b.addEventListener("scroll", ba, { passive: true });
    /* Turned on, or a pane chosen again: they meet where the first one is. */
    ab();
    return () => { a.removeEventListener("scroll", ab); b.removeEventListener("scroll", ba); };
  }, [a, b, on]);
}

/** An element's inner width, kept up to date as the window or the layout moves it. */
export function useInnerWidth(el: HTMLElement | null): number {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!el) return;
    const read = () => setW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}
