/**
 * THE SITE'S THEME, DRAWN ON THE BOARD (J, 2026-10-11: "the board must draw
 * it"). An import keeps what makes a site look like itself: drawings as real
 * svg, turns written as `rotate:` / `translate:` / `scale:`, the page's own
 * background layers (html, body and their ::before / ::after), parts the page
 * pins to the window (`position: fixed` / `sticky`), and its animations. The
 * board drew none of them: a dial's ticks and hands were gone, a seal stood
 * straight, the page's grain was missing behind the frame, a left rail
 * scrolled away and nothing moved. Everything here is general: it reads only
 * what the importer stored (`bring-in/pageParts.ts`), never a site's name.
 *
 *   · `cleanSvg`: a part's own svg markup, without anything that runs.
 *   · `PageGroundLayers`: the page's background layers, behind the parts (or
 *     over them, when the page put them over), pinned to the window when the
 *     page fixed them.
 *   · `pinOf`: how far a fixed or sticky part rides down as the board
 *     scrolls, as a CSS `translate` on one variable (`--view-top`, the page
 *     y at the window's top edge) that the board sets on scroll, so a scroll
 *     redraws nothing.
 *   · `useBoardMotion`: the one toolbar switch that stills all motion while
 *     editing; it starts still for a person who asked for less motion.
 *
 * `tests/board-theme.mjs` holds it.
 */
import * as React from "react";
import { animationsValue, type MotionAnimation } from "../shelf/parts/capturedMotion";

/* ------------------------------------------------------------------ svg */

const RUNS = /^on/i;
const BAD_TAGS = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "handler", "listener"]);
const cleaned = new Map<string, string>();

/** A drawing's markup with nothing that runs and nothing that leaves the page: scripts, handlers, javascript: links and foreign content are taken out. Sized to its box. */
export function cleanSvg(markup: string): string {
  const hit = cleaned.get(markup);
  if (hit !== undefined) return hit;
  let out = "";
  if (typeof DOMParser !== "undefined" && typeof XMLSerializer !== "undefined") {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (root && root.nodeName.toLowerCase() === "svg" && !doc.getElementsByTagName("parsererror").length) {
      for (const el of Array.from(root.querySelectorAll("*"))) {
        if (BAD_TAGS.has(el.localName.toLowerCase())) { el.remove(); continue; }
        for (const a of Array.from(el.attributes)) {
          if (RUNS.test(a.name) || (/(^|:)href$/i.test(a.name) && /^\s*(javascript|data:text\/html)/i.test(a.value))) el.removeAttribute(a.name);
        }
      }
      for (const a of Array.from(root.attributes)) if (RUNS.test(a.name)) root.removeAttribute(a.name);
      /* The box is the part's: the drawing fills it as its viewBox and aspect say. */
      root.setAttribute("width", "100%");
      root.setAttribute("height", "100%");
      root.setAttribute("style", `${(root.getAttribute("style") ?? "").replace(/(^|;)\s*(width|height|position|inset|left|top|right|bottom|transform|rotate|translate|scale)\s*:[^;]*/gi, "")};display:block;overflow:visible`);
      out = new XMLSerializer().serializeToString(root);
    }
  }
  if (cleaned.size > 500) cleaned.clear();
  cleaned.set(markup, out);
  return out;
}

/** The svg a part carries, when it carries one (`node.svg.markup`, from the importer). */
export function svgMarkupOf(n: unknown): string | null {
  const m = (n as { svg?: { markup?: unknown } | null } | null)?.svg?.markup;
  return typeof m === "string" && /^\s*<svg[\s>]/i.test(m) ? m : null;
}

/** A part's drawing, inline, filling its box. Under its words, if it has any. */
export function SvgArt({ markup }: { markup: string }) {
  const html = React.useMemo(() => cleanSvg(markup), [markup]);
  if (!html) return null;
  return <span data-svg-art="" aria-hidden className="pointer-events-none" style={{ position: "absolute", inset: 0, display: "block" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* --------------------------------------------------------- page layers */

/** One of the page's own background layers, as the importer read it (`LandedPage.ground.layers`). */
export interface GroundLayer {
  which: "html" | "body" | "html::before" | "html::after" | "body::before" | "body::after" | string;
  background?: string;
  color?: string;
  size?: string;
  position?: string;
  repeat?: string;
  attachment?: string;
  blend?: string;
  opacity?: number;
  filter?: string;
  inset?: { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number };
  fixed?: boolean;
  z?: number;
  animation?: MotionAnimation[];
  /** Its box as the page measured it, px (a fixed one's against the window). */
  box?: { x: number; y: number; w: number; h: number };
  /** How its own background layers blend (`background-blend-mode`). */
  blendLayers?: string;
  mask?: string;
  maskOptions?: string[];
}
export interface PageGround { layers?: unknown[] }

/** A layer as the importer stores it (`siteread/faces.ts` `PageRead.layers`): where it came from, its box, its paint under `art`. */
interface ReadLayer { from: string; position?: "absolute" | "fixed"; box?: { x: number; y: number; w: number; h: number }; z?: number | null; art?: { colour?: string; background?: string; backgroundOptions?: string[]; backgroundBlend?: string; filter?: string; mask?: string; maskOptions?: string[]; blend?: string; opacity?: number } }

/** Either shape, as one. */
function asLayer(raw: unknown): GroundLayer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as ReadLayer & GroundLayer;
  if (typeof r.from === "string") {
    const a = r.art ?? {};
    return {
      which: r.from, color: a.colour, background: a.background, size: a.backgroundOptions?.[0], position: a.backgroundOptions?.[1], repeat: a.backgroundOptions?.[2],
      blendLayers: a.backgroundBlend, blend: a.blend, opacity: a.opacity, filter: a.filter, mask: a.mask, maskOptions: a.maskOptions,
      fixed: r.position === "fixed", ...(typeof r.z === "number" ? { z: r.z } : {}), ...(r.box ? { box: r.box } : {}),
    };
  }
  return typeof r.which === "string" ? r : null;
}

/** The page's own layers, when its record carries them. */
export function groundLayersOf(page: unknown): GroundLayer[] {
  const list = (page as { ground?: PageGround | null } | null)?.ground?.layers;
  return Array.isArray(list) ? list.map(asLayer).filter((l): l is GroundLayer => !!l && !!(l.background || l.color || l.mask)) : [];
}

const SAFE = (v: unknown): string | undefined => (typeof v === "string" && v.trim() && v.length < 4000 && !/[{};<>\\]|expression\s*\(|javascript:/i.test(v) ? v.trim() : undefined);
const px = (v: string | number | null | undefined): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (!v || v === "auto") return null;
  const m = /^(-?[\d.]+)px$/.exec(v.trim());
  return m ? Number(m[1]) : null;
};

/** A layer's box and paint, on a page `w` × `h`, in page pixels. */
export function layerStyle(l: GroundLayer, w: number, h: number): React.CSSProperties {
  const pseudo = /::(before|after)$/.test(l.which);
  /* Pinned to the window: it rides down with the view, as tall as the window (`--view-h`). */
  const pinned = !!l.fixed || l.attachment === "fixed";
  const s: React.CSSProperties = { position: "absolute", pointerEvents: "none" };
  const t = px(l.inset?.top), b = px(l.inset?.bottom), lf = px(l.inset?.left), r = px(l.inset?.right);
  const left = pseudo ? lf ?? 0 : 0;
  const width = pseudo && lf !== null && r !== null ? Math.max(0, w - lf - r) : w;
  s.left = left;
  s.width = width;
  /* Measured: its own box, the window's for a fixed one. */
  const bx = l.box && [l.box.x, l.box.y, l.box.w, l.box.h].every((v) => typeof v === "number" && Number.isFinite(v)) ? l.box : null;
  if (bx) {
    s.left = bx.x;
    s.width = Math.max(0, bx.w);
    s.top = pinned ? `calc(var(--view-top, 0px) + ${bx.y}px)` : bx.y;
    s.height = Math.max(0, bx.h);
  } else if (pinned) {
    const top = pseudo ? t ?? 0 : 0;
    s.top = `calc(var(--view-top, 0px) + ${top}px)`;
    s.height = pseudo && t !== null && b !== null ? `calc(var(--view-h, 100%) - ${t + b}px)` : "var(--view-h, 100%)";
    s.maxHeight = h;
  } else {
    s.top = pseudo ? t ?? 0 : 0;
    s.height = pseudo && t !== null && b !== null ? Math.max(0, h - t - b) : h;
  }
  const bg = SAFE(l.background);
  const col = SAFE(l.color);
  if (col) s.backgroundColor = col;
  if (bg && bg !== "none") {
    s.backgroundImage = bg;
    if (SAFE(l.size)) s.backgroundSize = SAFE(l.size);
    if (SAFE(l.position)) s.backgroundPosition = SAFE(l.position);
    if (SAFE(l.repeat)) s.backgroundRepeat = SAFE(l.repeat);
  }
  if (SAFE(l.blendLayers)) s.backgroundBlendMode = SAFE(l.blendLayers);
  if (SAFE(l.mask) && l.mask !== "none") {
    const m = s as Record<string, string>;
    m.maskImage = m.WebkitMaskImage = SAFE(l.mask)!;
    if (SAFE(l.maskOptions?.[0])) m.maskSize = m.WebkitMaskSize = SAFE(l.maskOptions?.[0])!;
    if (SAFE(l.maskOptions?.[1])) m.maskPosition = m.WebkitMaskPosition = SAFE(l.maskOptions?.[1])!;
    if (SAFE(l.maskOptions?.[2])) m.maskRepeat = m.WebkitMaskRepeat = SAFE(l.maskOptions?.[2])!;
  }
  if (SAFE(l.blend)) s.mixBlendMode = SAFE(l.blend) as React.CSSProperties["mixBlendMode"];
  if (typeof l.opacity === "number" && l.opacity >= 0 && l.opacity < 1) s.opacity = l.opacity;
  if (SAFE(l.filter) && l.filter !== "none") s.filter = SAFE(l.filter);
  const anim = animationsValue(l.animation);
  if (anim) s.animation = anim;
  return s;
}

/** Whether a layer is drawn over the parts (the page set it above its content, a grain or scanlines over everything). */
export const overParts = (l: GroundLayer): boolean => typeof l.z === "number" && l.z > 0;

/** The page's background layers, in paint order. `over`: only the ones the page drew over its content; else only the ones under it. */
export function PageGroundLayers({ layers, width, height, over = false }: { layers: GroundLayer[]; width: number; height: number; over?: boolean }) {
  const here = layers.filter((l) => overParts(l) === over);
  if (!here.length) return null;
  return (
    <div aria-hidden data-page-ground-layers={over ? "over" : "under"} className="pointer-events-none absolute left-0 top-0" style={{ width, height, overflow: "clip" }}>
      {here.map((l, i) => <div key={`${l.which}-${i}`} data-ground-layer={l.which} className="mo" style={layerStyle(l, width, height)} />)}
    </div>
  );
}

/* ------------------------------------------------------- pinned parts */

interface Pinnable { id: string; x: number; y: number; w: number; h: number; from?: { selector?: string; position?: string; inset?: { top?: string | number; bottom?: string | number } | null } | null }

/**
 * How each fixed or sticky part rides down the page as the board scrolls,
 * as a `translate` that reads `--view-top`.
 *
 * Fixed: its box was read at the top of the page, so it moves down by as
 * much as the window has, never past the page's foot. Sticky: it stays where
 * it is until the window's top (plus its own `top`) reaches it, then rides
 * down until it meets the foot of the part that holds it (by selector), or
 * the page's.
 */
export function pinsOf(nodes: readonly Pinnable[], pageH: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of nodes) {
    const pos = n.from?.position;
    if (pos !== "fixed" && pos !== "sticky") continue;
    if (pos === "fixed") {
      const max = Math.max(0, Math.round(pageH - n.y - n.h));
      if (max > 0) out.set(n.id, `0 clamp(0px, var(--view-top, 0px), ${max}px)`);
      continue;
    }
    const top = px(n.from?.inset?.top ?? undefined) ?? 0;
    const sel = n.from?.selector?.trim();
    let foot = pageH;
    if (sel) {
      let best: Pinnable | null = null;
      for (const h of nodes) {
        const hs = h.from?.selector?.trim();
        /* Held by what scrolls, not by another pinned part. */
        if (h === n || !hs || !sel.startsWith(`${hs} > `) || h.from?.position === "fixed" || h.from?.position === "sticky") continue;
        if (!best || hs.length > (best.from?.selector?.trim().length ?? 0)) best = h;
      }
      if (best) foot = best.y + best.h;
    }
    const max = Math.max(0, Math.round(foot - n.y - n.h));
    if (max > 0) out.set(n.id, `0 clamp(0px, calc(var(--view-top, 0px) + ${Math.round(top - n.y)}px), ${max}px)`);
  }
  return out;
}

/** Keeps `--view-top` and `--view-h` (page pixels) on `host` as the scroller moves: the window's top and height over the page. */
export function useViewTop(host: React.RefObject<HTMLElement | null>, page: React.RefObject<HTMLElement | null>, scroller: () => HTMLElement | null, zoom: number, on: boolean) {
  React.useEffect(() => {
    const el = host.current;
    const pane = scroller();
    if (!el || !on) { el?.style.removeProperty("--view-top"); el?.style.removeProperty("--view-h"); return; }
    let raf = 0;
    const put = () => {
      raf = 0;
      const p = page.current;
      if (!p) return;
      const top = pane ? pane.getBoundingClientRect().top : 0;
      const h = pane ? pane.clientHeight : window.innerHeight;
      const z = zoom > 0 ? zoom : 1;
      el.style.setProperty("--view-top", `${Math.max(0, Math.round((top - p.getBoundingClientRect().top) / z))}px`);
      el.style.setProperty("--view-h", `${Math.round(h / z)}px`);
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(put); };
    put();
    (pane ?? window).addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    return () => { (pane ?? window).removeEventListener("scroll", ask); window.removeEventListener("resize", ask); if (raf) cancelAnimationFrame(raf); };
  }, [host, page, scroller, zoom, on]);
}

/* ------------------------------------------------------------ motion */

const KEY = "polio.boardMotion";
const listeners = new Set<() => void>();
let current: "play" | "still" | null = null;

function initial(): "play" | "still" {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "play" || v === "still") return v;
  } catch { /* storage closed: the default */ }
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "still" : "play";
}

/** Whether the board plays the site's motion ("play") or holds every part at rest ("still"). */
export function boardMotion(): "play" | "still" {
  if (current === null) current = typeof window === "undefined" ? "play" : initial();
  return current;
}

export function setBoardMotion(v: "play" | "still") {
  current = v;
  try { localStorage.setItem(KEY, v); } catch { /* kept for this visit */ }
  for (const f of listeners) f();
}

export function useBoardMotion(): "play" | "still" {
  return React.useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, boardMotion, () => "play");
}

/** Held at rest: no animation and no transition anywhere on the page's parts or layers. */
export const STILL_CSS = `[data-board-motion="still"] .mo, [data-board-motion="still"] .mo *, [data-board-motion="still"] .mo::before, [data-board-motion="still"] .mo::after, [data-board-motion="still"] [data-svg-art] *, [data-board-motion="still"] [data-ground-layer] { animation: none !important; transition: none !important; }`;
