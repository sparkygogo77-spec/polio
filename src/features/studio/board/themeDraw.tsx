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

interface Pinnable { id: string; x: number; y: number; w: number; h: number; art?: object | null; from?: { selector?: string; position?: string; inset?: { top?: string | number; bottom?: string | number } | null } | null }

/** The selector of the element that holds this one: its host for a ::before / ::after, else the path one step up. */
export function holderSelector(sel: string): string | null {
  const pseudo = /::?(before|after|marker)$/.exec(sel);
  if (pseudo) return sel.slice(0, pseudo.index) || null;
  const at = sel.lastIndexOf(" > ");
  return at > 0 ? sel.slice(0, at) : null;
}

/** How a part stands over the parts round it: the ride a pinned part takes down the page, and its stacking level. */
export interface Stack { translate?: string; z: number }

/**
 * HOW EACH PART STANDS: pinned parts ride, raised parts stand over the rest,
 * and WHAT THEY HOLD GOES WITH THEM.
 *
 * Fixed: its box was read at the top of the page, so it moves down by as
 * much as the window has, never past the page's foot. Sticky: it stays where
 * it is until the window's top (plus its own `top`) reaches it, then rides
 * down until it meets the foot of the part that holds it (by selector), or
 * the page's. Both are raised over the page's flow (3), and so is a part the
 * page gave a positive z-index (2).
 *
 * On the page a raised or pinned element carries everything inside it; on
 * the board those are parts of their own, siblings of it. Raised alone, the
 * holder covered them: PST's sticky nav rail (z-index 20) drew its wood over
 * its nameplate, dial, tabs and clock, and only the strip showed (J,
 * 2026-10-11). So every part inside takes the holder's ride and level, and
 * stays over it in the page's own order.
 */
export function stacksOf(nodes: readonly Pinnable[], pageH: number): Map<string, Stack> {
  const pinned = (n: Pinnable) => n.from?.position === "fixed" || n.from?.position === "sticky";
  /* The part in the page's flow at each element (a pinned twin at the same element does not hold anything). */
  const flowAt = new Map<string, Pinnable>();
  for (const n of nodes) { const sel = n.from?.selector?.trim(); if (sel && !pinned(n) && !flowAt.has(sel)) flowAt.set(sel, n); }
  const own = new Map<string, Stack>();
  for (const n of nodes) {
    const pos = n.from?.position;
    if (pos === "fixed") {
      const max = Math.max(0, Math.round(pageH - n.y - n.h));
      own.set(n.id, { ...(max > 0 ? { translate: `0 clamp(0px, var(--view-top, 0px), ${max}px)` } : {}), z: 3 });
      continue;
    }
    if (pos === "sticky") {
      const top = px(n.from?.inset?.top ?? undefined) ?? 0;
      /* Held by what scrolls, not by another pinned part. */
      let foot = pageH;
      for (let h = holderSelector(n.from?.selector?.trim() ?? ""); h; h = holderSelector(h)) {
        const holder = flowAt.get(h);
        if (holder) { foot = holder.y + holder.h; break; }
      }
      const max = Math.max(0, Math.round(foot - n.y - n.h));
      own.set(n.id, { ...(max > 0 ? { translate: `0 clamp(0px, calc(var(--view-top, 0px) + ${Math.round(top - n.y)}px), ${max}px)` } : {}), z: 3 });
      continue;
    }
    const z = (n.art as { z?: unknown } | null | undefined)?.z;
    if (typeof z === "number" && z > 0) own.set(n.id, { z: 2 });
  }
  if (!own.size) return own;
  /* Each element's own stand, from whichever of its parts has one. */
  const ownAt = new Map<string, Stack>();
  for (const n of nodes) {
    const sel = n.from?.selector?.trim(), st = own.get(n.id);
    if (!sel || !st) continue;
    const had = ownAt.get(sel);
    ownAt.set(sel, had ? { translate: had.translate ?? st.translate, z: Math.max(had.z, st.z) } : st);
  }
  /* What each part inside a raised or pinned one takes from it: the nearest pinned holder's ride, the highest level above it. */
  const out = new Map<string, Stack>();
  const memo = new Map<string, Stack | null>();
  const inherited = (sel: string | null): Stack | null => {
    if (!sel) return null;
    if (memo.has(sel)) return memo.get(sel)!;
    const mine = ownAt.get(sel) ?? null;
    const up = inherited(holderSelector(sel));
    const got = mine && up ? { translate: mine.translate ?? up.translate, z: Math.max(mine.z, up.z) } : mine ?? up;
    const v = got ? { ...(got.translate ? { translate: got.translate } : {}), z: got.z } : null;
    memo.set(sel, v);
    return v;
  };
  for (const n of nodes) {
    const sel = n.from?.selector?.trim();
    const mine = own.get(n.id) ?? null;
    const up = sel ? inherited(holderSelector(sel)) : null;
    const got = mine && up ? { translate: mine.translate ?? up.translate, z: Math.max(mine.z, up.z) } : mine ?? up;
    if (got) out.set(n.id, { ...(got.translate ? { translate: got.translate } : {}), z: got.z });
  }
  return out;
}

/** The ride alone, for each pinned part and what it holds. */
export function pinsOf(nodes: readonly Pinnable[], pageH: number): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, st] of stacksOf(nodes, pageH)) if (st.translate) out.set(id, st.translate);
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

/**
 * THE SITE'S MOTION ON THE BOARD. The board holds its own parts still
 * (`globals.css`: `[data-mode="board"] *` paused), and that held the page's
 * entrances at their first frame: PST's panels deal in from `opacity: 0`, so
 * on the board they stood invisible, words over the wall with no paper
 * under them (J, 2026-10-11). Played, the page's own motion runs (and an
 * entrance ends where the page ends it); held still, it is taken off, so
 * every part stands as the page does at rest.
 */
const PLAY = '[data-board-motion="play"]';
const STILL = '[data-board-motion="still"]';
const MOVERS = (on: string) => [`${on} .mo`, `${on} .mo *`, `${on} .mo::before`, `${on} .mo::after`, `${on} [data-svg-art] *`, `${on} [data-ground-layer]`].join(", ");
export const BOARD_MOTION_CSS = `${MOVERS(PLAY)} { animation-play-state: running !important; }
${MOVERS(STILL)} { animation: none !important; transition: none !important; }`;

