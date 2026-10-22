/**
 * THE PREVIEW AS THE WINDOW, NOT A FRAME IN IT.
 *
 * THE OWNER, beside trumpmorty.fun at 2000 wide: the Preview drew the page in
 * a frame narrower than the window (1440 in a 2000 screen, with a margin),
 * and the hero, 100svh on the site, did not fill it, so the ribbons sat 80%
 * of the way down instead of at the foot. The Preview now opens at the
 * window's size, 1:1 and frameless, the way the published page opens: a
 * captured page is re-anchored by the export's own rules (`fluidPage`, from
 * `fluidSite.ts`), and every window unit those rules write (`100svh`, `vw`)
 * is taken of the Preview's own size, which is the window less the
 * Builder's bars, through two custom properties the page sets. The device
 * widths stay as the other choices. `tests/preview-window.mjs`.
 */
import type { StudioNode } from "../board/store";
import { fluidPage } from "../send-out/exportSite";

/** A window unit in an inline style, as a share of the Preview's size. */
export function previewUnits(style: string): string {
  return style
    .replace(/(-?\d*\.?\d+)[sld]?vh\b/g, (_m, n: string) => `calc(${n} * var(--pv-vh))`)
    .replace(/(-?\d*\.?\d+)[sld]?vw\b/g, (_m, n: string) => `calc(${n} * var(--pv-vw))`);
}

/**
 * Lay the drawn page out as the published page is laid out, at the width it
 * stands in. Run after every render that places the parts again; what it
 * writes is inline style React leaves alone until the part itself changes.
 */
export function previewWindow(root: HTMLElement, pageId: string, nodes: readonly StudioNode[], W: number): void {
  fluidPage(root, pageId, new Map(nodes.map((n) => [n.id, n])), W);
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("[style]"))]) {
    const s = el.getAttribute("style");
    if (s && /\d[sld]?v[hw]\b/.test(s)) el.setAttribute("style", previewUnits(s));
  }
  /* The page clips and is no scroll container, as published: a sticky band sticks to what scrolls. */
  for (const pg of Array.from(root.querySelectorAll<HTMLElement>("[data-live-page]"))) if (pg.style.overflow === "hidden") pg.style.overflow = "clip";
}
