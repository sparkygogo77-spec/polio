"use client";
/**
 * A TEXTURE A BOXED PART WEARS, and the page's texture worn by a part.
 *
 * A part brought in paints its own fill on its box, so a texture given to it
 * is drawn again on a layer over that fill and under its words. For a kind
 * of panel that is right: each panel is its own piece.
 *
 * For the PAGE it was wrong. The page's texture is worn by every part as wide
 * as the page (on PonsStars: the app, the nav, the title band, the play
 * layout), and each drew its own copy laid out on its own box. Stripes broke
 * at every band's edge, and where a see-through band sat on the app the
 * texture was painted twice (J, 2026-10-09: "i can see a difference between
 * the background texture and the bar over the header and down the page").
 *
 * So a page texture worn by a part is the page's own texture, seen through
 * the part: a layer the size of the page, placed where the page is, cut to
 * the part. Every copy lines up with the page and with each other, and a
 * part with no fill of its own draws none, since the page (or the part
 * under it) already shows it there. A drift starts on the page's clock, so
 * the copies move as one.
 */
import * as React from "react";

type Place = { x: number; y: number; w: number; h: number } | "bare" | null;

/** Where the page's texture is painted: the board's frame, or the live page. */
function groundOf(el: HTMLElement): HTMLElement | null {
  return (el.closest("[data-page-window]")?.querySelector<HTMLElement>("[data-frame]") ?? el.closest<HTMLElement>("[data-live-root]")) || null;
}

/** Does this box paint anything of its own? A clear colour and no image is a box the page shows through. */
function paints(box: Element): boolean {
  const c = getComputedStyle(box);
  if (c.backgroundImage && c.backgroundImage !== "none") return true;
  const a = /rgba?\([^)]*?[,/]\s*([\d.]+%?)\s*\)$/.exec(c.backgroundColor)?.[1];
  if (c.backgroundColor === "transparent") return false;
  if (a == null) return true;
  return (a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a)) > 0.01;
}

/** Every texture drift on these elements, started on the document's clock, so two copies are at the same place at the same moment. */
export function syncDrift(...els: (Element | null | undefined)[]) {
  for (const el of els) {
    for (const a of el?.getAnimations?.() ?? []) {
      const name = (a as Animation & { animationName?: string }).animationName;
      if (name?.startsWith("tex-drift") && a.startTime !== 0) a.startTime = 0;
    }
  }
}

export function WornTexture({ id, paint, page }: { id: string; paint: React.CSSProperties; page: boolean }) {
  const outer = React.useRef<HTMLSpanElement>(null);
  const inner = React.useRef<HTMLSpanElement>(null);
  const [place, setPlace] = React.useState<Place>(null);

  const measure = React.useCallback(() => {
    const el = outer.current;
    if (!el || !page) return;
    const box = el.parentElement;
    const ground = groundOf(el);
    let next: Place = null;
    if (box && !paints(box)) next = "bare";
    else if (ground && ground.offsetWidth) {
      const g = ground.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const scale = g.width / ground.offsetWidth || 1;
      next = {
        x: Math.round(((r.left - g.left) / scale - ground.clientLeft) * 100) / 100,
        y: Math.round(((r.top - g.top) / scale - ground.clientTop) * 100) / 100,
        w: ground.clientWidth,
        h: ground.clientHeight,
      };
    }
    setPlace((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
    syncDrift(inner.current, ground);
  }, [page]);

  /* Every render: a part that moved, grew or changed its fill is placed again. Cheap, and only a change sets state. */
  React.useLayoutEffect(() => { measure(); });
  React.useEffect(() => {
    const el = outer.current;
    if (!el || !page || typeof ResizeObserver === "undefined") return;
    const ground = groundOf(el);
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    if (ground) ro.observe(ground);
    return () => ro.disconnect();
  }, [page, measure]);

  const base: React.CSSProperties = { position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", borderRadius: "inherit" };
  if (!page) return <span aria-hidden data-part-texture={id} style={{ ...base, ...paint }} />;
  if (place === "bare") return <span aria-hidden data-part-texture={id} data-page-texture="bare" ref={outer} style={{ ...base, visibility: "hidden" }} />;
  return (
    <span aria-hidden data-part-texture={id} data-page-texture="" ref={outer} style={{ ...base, overflow: "hidden" }}>
      <span ref={inner} style={{ position: "absolute", ...(place ? { left: -place.x, top: -place.y, width: place.w, height: place.h } : { inset: 0 }), ...paint }} />
    </span>
  );
}
