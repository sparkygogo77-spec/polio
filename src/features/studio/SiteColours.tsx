"use client";
/**
 * ON THIS SITE: every colour and face the parts use, and swap-all.
 *
 * The six roles above this are how a site made here is painted. A site
 * brought in was not painted that way — trumpmorty.fun wears one near-black
 * on its words, outlines, hard shadows and eight fills, a dozen pastels one
 * card each, and three faces — so under the roles the panel lists what the
 * parts actually wear, grouped by what it is used for, each with how many
 * parts use it that way (`siteColours.ts`, docs/audit/palette-captured.md).
 *
 * Press a swatch and it says which parts wear it and for what (press one to
 * pick it on the board), and offers one thing: recolour exactly those parts.
 * Nothing moves until that button is pressed, and it is one undo. The same
 * for faces. The wheel's "every part like it" is the same call.
 */
import { hasKept, keepBefore } from "./previewWas";
import * as React from "react";
import { MoreHint } from "@/core/ui/more-hint";
import { ChevronRight, Dices, Undo2 } from "lucide-react";
import { ROLES, glowRings, setGlow, css, faceOf, parseColor, rollTheme, spotsOf, toHex, withColours, type ColourUse, type Palette } from "./look";
import { PAGE_ID, SITE_TYPE, firstSays, fontsInPageOrder, type FaceTo } from "./look";
import { partName } from "./partNames";
import { PieceTexture, kindGround, pageGround } from "./PieceTexture";
import { ROLE_USE, siteRoles, mainColours, type RoleSwatch, type SiteRoles } from "./siteRoles";
import { siteKinds, type SiteKinds, type SurfaceKind } from "./themeKinds";
import { componentsOf, type CompNode } from "./components";
import type { CountedAs } from "./siteRoles";
import { bytesFor, type Picture } from "./pictures";
import { getFeature } from "./shelf";
import { FAMILY, resolvePalette } from "./shelf/run";
import { endGesture, gestureBase, startGesture, useHeldStudio, useStudio } from "./board/store";
import type { StudioNode } from "./board/store";
import { cn } from "@/core/lib/cn";
import { pointParts } from "./board/pointed";
import { Slider, HandColour } from "./HandSlider";
import { useSiteFormat } from "./panels/ui";
import { FORMAT_FIELDS } from "./format";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { VirtualList } from "@/core/ui/virtual-list";

function useSite() {
  const nodes = useHeldStudio((s) => s.nodes);
  const format = useHeldStudio((s) => s.format);
  const look = useHeldStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  return { nodes, palette, look };
}

/**
 * A name for a part a person can read: its own name, its words, the name the
 * browser gave it, or what it is and the section it is in (`partNames.ts`),
 * never the capture's "div · 1 inside".
 */
function nameOf(n: Parameters<typeof partName>[0] | undefined, id: string, all: Parameters<typeof partName>[1] = []): string {
  if (id === PAGE_ID) return "The page";
  if (!n) return "A part no longer on the board";
  return partName(n, all, (f) => getFeature(f)?.name);
}

/* ------------------------------------------------------------------ */
/* Pointing at a part on the board                                     */
/* ------------------------------------------------------------------ */

/**
 * Hover a part in a list here and it glows on the board, so "which one is
 * that" is answered without picking it and losing what is picked. Nothing in
 * the document changes: the part wears a neon silhouette while the hand is
 * on the row (`board/pointed.ts`), and lets it go when the hand leaves.
 */
let follow = 0;
export function pointAt(ids: string[] | null) {
  pointParts(ids);
  /*
   * And the board follows: a part below the fold is scrolled into view, so
   * hovering down a list keeps the board with it (J, 2026-10-09: "as it goes
   * lower the page does not move to keep up"). A short wait first, so a hand
   * sweeping across rows on its way somewhere does not drag the board about.
   */
  window.clearTimeout(follow);
  if (ids?.length) follow = window.setTimeout(() => scrollToParts(ids), 140);
}

const nodeEl = (id: string) => document.querySelector(`[data-studio-scroll] [data-node-id="${CSS.escape(id)}"]`) ?? document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);

/**
 * Scroll the board's pane so these parts can be seen. One part: until all of
 * it is in view (its top, when it is taller than the pane). Several (a
 * colour's parts, all over the page): only when none of them is in view, then
 * to the first. Nothing moves when they already show.
 */
export function scrollToParts(ids: readonly string[]) {
  const els = ids.map(nodeEl).filter((el): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0);
  const first = els[0];
  const pane = first?.closest("[data-studio-pane]") ?? first?.closest("[data-studio-scroll]");
  if (!first || !(pane instanceof HTMLElement)) return;
  const p = pane.getBoundingClientRect();
  const shows = (r: DOMRect) => (els.length === 1
    ? r.top >= p.top && (r.bottom <= p.bottom || r.height > p.height)
    : r.bottom > p.top && r.top < p.bottom);
  if (els.some((el) => shows(el.getBoundingClientRect()))) return;
  const r = first.getBoundingClientRect();
  pane.scrollTo({ top: pane.scrollTop + (r.top - p.top) - Math.max(24, (p.height - r.height) / 2), behavior: "smooth" });
}

/* ------------------------------------------------------------------ */
/* Walking a kind's parts from the theme preview                       */
/* ------------------------------------------------------------------ */

/**
 * J (2026-10-11): "add a button near the panel hover so when I click I could
 * scroll to the next one if it's not on the same screen ... when hovering over
 * the preview, use the scroll wheel to move through them, a smooth glide to
 * the next one or a snap if another page; when I stop hovering I want to be
 * back at the beginning, if I clicked of course it should stay."
 *
 * So while the hand is on a piece of the preview, the wheel steps through
 * that kind's parts on the board, in reading order across the pages: the
 * board glides to the next on the same page and snaps to one on another. The
 * piece's Next button steps to the next one not already in view. Leaving the
 * preview puts the board back on the page and at the scroll it had when the
 * hand came in, unless a press was made in it (a pick, or Next): then it
 * stays where the hand left it.
 */
const tour = { key: "", at: -1, start: null as { page: string; top: number } | null, kept: false };

const boardPane = (): HTMLElement | null => {
  const p = document.querySelector("[data-studio-pane]");
  return p instanceof HTMLElement ? p : null;
};

/** The hand came onto the preview: where the board is now is where it goes back to. */
export function tourBegin() {
  if (tour.start) return;
  tour.start = { page: useStudio.getState().activePageId, top: boardPane()?.scrollTop ?? 0 };
  tour.kept = false;
}

/** A press in the preview: the board stays where it is taken. */
export function tourKeep() { tour.kept = true; }

/** The hand left the preview: back to the start, unless a press kept the board where it is. */
export function tourEnd() {
  const was = tour.start;
  tour.start = null;
  tour.key = "";
  tour.at = -1;
  if (!was || tour.kept) return;
  window.clearTimeout(follow);
  const s = useStudio.getState();
  if (s.activePageId !== was.page) {
    s.setActivePage(was.page);
    requestAnimationFrame(() => requestAnimationFrame(() => boardPane()?.scrollTo({ top: was.top, behavior: "auto" })));
  } else boardPane()?.scrollTo({ top: was.top, behavior: "smooth" });
}

/** Seen whole in the board's pane now. */
function inView(id: string): boolean {
  const el = nodeEl(id);
  const pane = el instanceof HTMLElement ? el.closest("[data-studio-pane]") ?? el.closest("[data-studio-scroll]") : null;
  if (!(el instanceof HTMLElement) || !pane || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect();
  return r.top >= p.top && r.bottom <= p.bottom;
}

/** Bring one part to the middle of the board's pane: gliding, or at once. */
function glideTo(id: string, behavior: ScrollBehavior) {
  const el = nodeEl(id);
  const pane = el instanceof HTMLElement ? el.closest("[data-studio-pane]") ?? el.closest("[data-studio-scroll]") : null;
  if (!(el instanceof HTMLElement) || !(pane instanceof HTMLElement)) return;
  const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect();
  pane.scrollTo({ top: pane.scrollTop + (r.top - p.top) - Math.max(24, (p.height - r.height) / 2), behavior });
}

/** A kind's parts in reading order: page by page as the site lists them, then top to bottom, left to right. */
export function readingOrder(ids: readonly string[], nodes: readonly { id: string; pageId: string; x?: number; y?: number }[], pages: readonly { id: string }[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pageAt = new Map(pages.map((p, i) => [p.id, i]));
  return ids.filter((id) => byId.has(id)).sort((a, b) => {
    const m = byId.get(a)!, n = byId.get(b)!;
    return (pageAt.get(m.pageId) ?? 0) - (pageAt.get(n.pageId) ?? 0) || (Math.abs((m.y ?? 0) - (n.y ?? 0)) > 8 ? (m.y ?? 0) - (n.y ?? 0) : (m.x ?? 0) - (n.x ?? 0));
  });
}

/**
 * One step through a kind's parts: the next (or the one before) after the one
 * stepped to last; with `unseen`, the next one not already in view. A part
 * on another page turns the board to that page and snaps to it.
 */
export function tourStep(ids: readonly string[], dir: 1 | -1, unseen = false) {
  const s = useStudio.getState();
  const order = readingOrder(ids, s.nodes, s.pages);
  if (!order.length) return;
  tourBegin();
  const key = order.join("|");
  if (tour.key !== key) { tour.key = key; tour.at = -1; }
  const page = new Map(s.nodes.map((n) => [n.id, n.pageId]));
  /* Where to step from, the first time: the first of them at or below the top of the view, on the page in view, so the wheel goes on from what is seen. */
  if (tour.at < 0) {
    const top = boardPane()?.getBoundingClientRect().top ?? 0;
    const here = order.map((id, i) => ({ id, i })).filter(({ id }) => page.get(id) === s.activePageId && drawnNow(id));
    const j = here.find(({ id }) => (nodeEl(id)?.getBoundingClientRect().bottom ?? -Infinity) > top)?.i ?? (here.length ? here[here.length - 1]!.i + 1 : 0);
    tour.at = dir > 0 ? j - 1 : j;
  }
  let i = tour.at;
  for (let k = 0; k < order.length; k++) {
    i = (((i + dir) % order.length) + order.length) % order.length;
    const id = order[i]!;
    /* A part in a hidden state on the page in view is not drawn: there is nothing to glide to. */
    if (page.get(id) === s.activePageId && !drawnNow(id)) continue;
    if (unseen && page.get(id) === s.activePageId && inView(id)) continue;
    break;
  }
  tour.at = i;
  const id = order[i]!;
  window.clearTimeout(follow);
  if (page.get(id) !== s.activePageId && page.get(id)) {
    s.setActivePage(page.get(id)!);
    requestAnimationFrame(() => requestAnimationFrame(() => { pointParts(onThisPage([...ids])); glideTo(id, "auto"); }));
  } else {
    pointParts(onThisPage([...ids]));
    glideTo(id, "smooth");
  }
}

/** Pick these on the board, on the page the first of them is on. */
function pickOnBoard(ids: string[]) {
  const s = useStudio.getState();
  const real = ids.filter((id) => id !== PAGE_ID);
  const first = s.nodes.find((n) => n.id === real[0]);
  if (!first) return;
  if (first.pageId !== s.activePageId) s.setActivePage(first.pageId);
  /* Only what the board draws now. A pick of a hidden part switches its panel
     on so it can be drawn; picking a colour's hundreds of parts switched every
     hidden panel on at once, over the page, and Undo (which steps edits, not
     what is shown) could not take it back (J, 2026-10-09). */
  const drawn = (id: string) => { const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`); return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none"; };
  const ids_ = real.filter((id) => s.nodes.find((n) => n.id === id)?.pageId === first.pageId);
  const on = s.statesOn ?? [];
  s.setSelection(first.pageId === s.activePageId ? ids_.filter(drawn) : ids_);
  /* And should a pick still reach a hidden panel, what is shown stays as it was. */
  useStudio.getState().setStatesOn(on);
  play("select");
}

function PartsList({ spots, rest = null }: { spots: { id: string; where: string }[]; rest?: string[] | null }) {
  const nodes = useHeldStudio((s) => s.nodes);
  React.useEffect(() => () => pointAt(null), []);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const rows = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of spots) m.set(s.id, [...new Set([...(m.get(s.id) ?? []), s.where])]);
    return [...m.entries()].map(([id, where]) => ({ id, where: where.join(", ") }));
  }, [spots]);
  const row = (r: { id: string; where: string }) => (
    <button
      type="button"
      data-site-part={r.id}
      onClick={() => pickOnBoard([r.id])}
      onMouseEnter={() => pointAt([r.id])}
      onMouseLeave={() => pointAt(rest)}
      onFocus={() => pointAt([r.id])}
      onBlur={() => pointAt(rest)}
      className="tactile flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
    >
      <span className="min-w-0 flex-1 truncate text-small text-fg">{nameOf(byId.get(r.id), r.id, nodes)}</span>
      <span className="shrink-0 text-fine text-fg-faint">{r.where}</span>
    </button>
  );
  /* Every part that wears it is in the list, not only the ones a virtual
     window happened to draw: a face on 27 parts listed 16. Virtual only
     past a hundred rows (AGENTS.md), where drawing them all would cost. */
  return rows.length > 100 ? (
    <VirtualList items={rows} getKey={(r) => r.id} renderItem={row} estimateSize={26} className="h-40 rounded-md border border-border" />
  ) : (
    <div data-site-parts="" className={cn("rounded-md border border-border", rows.length > 6 && "max-h-40 overflow-y-auto")}>{rows.map((r) => <React.Fragment key={r.id}>{row(r)}</React.Fragment>)}</div>
  );
}

/* ------------------------------------------------------------------ */
/* The short palette, by role (siteRoles.ts)                           */
/* ------------------------------------------------------------------ */

/** A picture's main colours, sampled once in this browser and kept for the session. */
const pictureCache = new Map<string, string[] | "loading">();
const pictureWatchers = new Set<() => void>();
async function samplePicture(pic: Picture): Promise<void> {
  if (pictureCache.has(pic.id)) return;
  pictureCache.set(pic.id, "loading");
  try {
    const blob = await bytesFor(pic);
    if (!blob) { pictureCache.set(pic.id, []); return; }
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) { pictureCache.set(pic.id, []); return; }
    g.drawImage(bmp, 0, 0, 32, 32);
    pictureCache.set(pic.id, mainColours(g.getImageData(0, 0, 32, 32).data));
  } catch {
    pictureCache.set(pic.id, []);
  }
  pictureWatchers.forEach((w) => w());
}

/** Each picture part's main colours, by part id, as they are sampled. */
function usePictureColours(nodes: readonly { id: string; picture?: unknown }[]): Map<string, string[]> {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { pictureWatchers.add(bump); return () => { pictureWatchers.delete(bump); }; }, []);
  React.useEffect(() => {
    for (const n of nodes) {
      const pic = (n.picture as { pic?: Picture } | null)?.pic ?? (n.picture as Picture | null);
      if (pic && typeof pic === "object" && "id" in pic && "path" in pic) void samplePicture(pic as Picture);
    }
  }, [nodes]);
  const out = new Map<string, string[]>();
  for (const n of nodes) {
    const pic = (n.picture as { pic?: Picture } | null)?.pic ?? (n.picture as Picture | null);
    const got = pic && typeof pic === "object" && "id" in pic ? pictureCache.get((pic as Picture).id) : undefined;
    if (Array.isArray(got) && got.length) out.set(n.id, got);
  }
  return out;
}

/**
 * RANDOMIZE THEME on a site brought in (`rollTheme`): every theme swatch
 * gets a new colour from one hue family, the page and its background layers
 * with it, words on a button get black or white to read on it, and the six
 * roles follow so new parts match. One undo step.
 */
function randomizeTheme(roles: SiteRoles, palette: Palette, counted: CountedAs): number {
  const theme = roles.short.flatMap((r) => r.swatches).filter((s) => s.role !== "pictures");
  const roll = rollTheme(theme.map((s) => ({ id: s.id, role: s.role, value: s.value })));
  const st = useStudio.getState();
  const mark = st.historyMark();
  const changed = new Set<string>();
  /* Which button each part's words stand on: the button itself, or a part stacked on it. */
  const buttonOf = new Map<string, string>();
  for (const b of theme.filter((s) => s.role === "buttons")) for (const x of b.spots) buttonOf.set(counted.countAs(x.id), b.id);
  const onButton = (id: string) => buttonOf.get(counted.countAs(id));
  const swap = (sw: RoleSwatch, into: string, ids: string[], use = ROLE_USE[sw.role]) => {
    if (!ids.length) return;
    const pal = resolvePalette(useStudio.getState().format, useStudio.getState().look);
    for (const shade of sw.shades) for (const id of useStudio.getState().swapColourAll(shade, into, pal, { use, only: ids })) changed.add(id);
  };
  const free = (sw: RoleSwatch) => [...new Set(sw.spots.filter((x) => x.where !== "in its picture").map((x) => x.id))];
  st.setLook({ palette: { ...st.look.palette, ...roll.palette } });
  for (const sw of theme) {
    const into = roll.to.get(sw.id);
    if (!into) continue;
    const ids = free(sw);
    if (sw.role !== "words") { swap(sw, into, ids); continue; }
    swap(sw, into, ids.filter((id) => !onButton(id)));
    for (const [button, ink] of roll.onButtons) swap(sw, ink, ids.filter((id) => onButton(id) === button));
  }
  /* Plain ink on a button turns to whichever of black or white reads on it. */
  for (const sw of roles.ink) for (const [button, ink] of roll.onButtons) {
    const ids = [...new Set(sw.spots.filter((x) => x.use === "text" && onButton(x.id) === button).map((x) => x.id))];
    swap(sw, ink, ids, "text");
  }
  /* The background layers take the page's new colour. */
  const nodes = useStudio.getState().nodes;
  for (const id of roles.left.backgroundLayers) {
    const n = nodes.find((x) => x.id === id);
    if (!n) continue;
    for (const f of spotsOf(n, palette).filter((x) => x.spot.use === "fill")) for (const c of useStudio.getState().swapColourAll(f.key, roll.page, resolvePalette(useStudio.getState().format, useStudio.getState().look), { use: "fill", only: [id] })) changed.add(c);
  }
  useStudio.getState().oneStepSince(mark);
  return changed.size;
}

/**
 * THE THEME, SEEN AND CHANGED IN ONE PLACE (J, 2026-10-09): a frame drawn
 * from the kinds of surface the site's parts really are (`themeKinds.ts`):
 * the page with its words, each kind of panel with the words, face, outline,
 * shadow and corners its parts wear, and each kind of button, with its own
 * words, standing in the kind it stands in on the site. Nothing is made up.
 *
 * "I should instead be able to click on the elements in the preview box and
 * see it pop up the relevant menus below it": press a piece and its editor
 * opens under the frame (`KindEditor`). Each piece is a kind, so one edit
 * reaches every copy of it across the site, as one undo step. Pieces are
 * named by what they are for, never their colour, with how many parts wear
 * them as a bold neon-green number in the corner.
 */
type Pick = "page" | number;

/** A count's number: always neon green, bright and vibrant on any swatch (J, 2026-10-09), ringed by a thin dark outline. */
const COUNT_INK = "#39ff14";
function countStyle(): React.CSSProperties {
  const edge = "rgb(0 0 0 / 0.85)";
  return { color: COUNT_INK, textShadow: `1px 0 0 ${edge}, -1px 0 0 ${edge}, 0 1px 0 ${edge}, 0 -1px 0 ${edge}, 0 0 3px ${edge}` };
}

function ThemePreview({ site, palette, picked, onPick, ground, grounds }: { site: SiteKinds; palette: Palette; picked: Pick | null; onPick: (p: Pick) => void; ground: React.CSSProperties; grounds: Map<number, React.CSSProperties> }) {
  /* The surfaces, the one the buttons stand in first, as wide as the frame. */
  /* Tabs and label bars sit over a panel's top edge, as on the site; the rest are tiles. */
  const tabs = site.kinds.filter((k) => k.tab && !k.button).slice(0, 4);
  /* A big painted piece (the TV bodies) is always drawn, after the four most-worn surfaces. */
  const surfaces = [...site.kinds.filter((k) => !k.button && !k.tab && !k.piece && !k.accent).slice(0, 4), ...site.kinds.filter((k) => k.piece)].sort((a, b) => Number(site.kinds.some((x) => x.button && x.inside === site.kinds.indexOf(b))) - Number(site.kinds.some((x) => x.button && x.inside === site.kinds.indexOf(a))));
  const buttons = site.kinds.filter((k) => k.button).slice(0, 4);
  /* Small accent colours (a legend's dots, thin bars, edge stripes: `ACCENT_SHARE`) are a dot each, not a box as big as a panel (J, 2026-10-11). */
  const accents = site.kinds.filter((k) => k.accent).slice(0, 8);
  const at = (k: SurfaceKind) => site.kinds.indexOf(k);
  const ink = (k: SurfaceKind) => k.words ?? site.page.words ?? palette.text;
  /* Only a glow most of the words wear, at the size they wear it: the preview shows what the site shows. */
  const glow = (g: { glow: string | null; glowSize: number; glowShown: boolean }): React.CSSProperties => (g.glow && g.glowShown ? { textShadow: glowRings(g.glow, g.glowSize).join(", ") } : {});
  const dress = (k: SurfaceKind): React.CSSProperties => ({
    background: k.paint,
    /* The texture its parts wear, over its paint, as the board draws it. */
    ...grounds.get(at(k)),
    color: ink(k),
    border: k.outline ? `${Math.min(k.outline.width, 3)}px solid ${k.outline.colour}` : undefined,
    boxShadow: k.shadow ? k.shadow.replace(/(-?\d+(?:\.\d+)?)px/g, (_, n: string) => `${Math.round(Number(n) / 2)}px`) : undefined,
    borderRadius: Math.min(k.radius, 16),
  });
  const ring = (on: boolean) => (on ? "outline outline-2 outline-offset-2 outline-accent" : "hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-fg-muted");
  /* Just the number on the corner, no box behind it (J, 2026-10-09): bright, with a thin dark outline so it reads on a light swatch and a dark one. */
  const count = (n: number, small = false) => (
    <span data-preview-count={n} className={cn("num pointer-events-none absolute font-bold leading-none", small ? "-right-1 -top-1.5 text-[11px]" : "right-1 top-1 text-[13px]")} style={countStyle()}>{n}</span>
  );
  /* The wheel over a piece steps through its kind's parts on the board (`tourStep`). */
  const kinds = React.useRef(site.kinds);
  kinds.current = site.kinds;
  const root = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    let last = 0;
    /* Not passive: over a piece the wheel walks the board, and the panel under it must not scroll as well. */
    const wheel = (e: WheelEvent) => {
      /* The piece under the hand, the innermost one: a button standing in a panel walks the buttons. */
      const piece = e.target instanceof Element ? e.target.closest("[data-preview-kind]") : null;
      const ids = piece ? kinds.current[Number(piece.getAttribute("data-preview-kind"))]?.ids : null;
      if (!ids?.length || Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const now = performance.now();
      /* One step a notch: a trackpad's run of small deltas is one step, not twenty. */
      if (now - last < 260) return;
      last = now;
      tourStep(ids, e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { el.removeEventListener("wheel", wheel); tourEnd(); };
  }, []);
  const choose = (p: Pick, ids: string[]) => ({
    role: "button",
    tabIndex: 0,
    "aria-pressed": picked === p,
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); tourKeep(); play("select"); onPick(p); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); tourKeep(); play("select"); onPick(p); } },
    onMouseEnter: () => pointAt(onThisPage(ids)),
    onMouseLeave: () => pointAt(resting ? onThisPage(resting) : null),
  });
  /* Next: the board goes to the next of this kind's parts not already in view; a press, so the board stays there. */
  const next = (k: SurfaceKind, small = false) => k.parts > 1 ? (
    <button type="button" data-preview-next={at(k)} aria-label={`Next of the ${k.name}`} title="Next one on the site (or turn the wheel)"
      onClick={(e) => { e.stopPropagation(); tourKeep(); play("tick"); tourStep(k.ids, 1, true); }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn("tactile absolute z-10 grid place-items-center rounded-full border border-border bg-elevated text-fg opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
        small ? "-bottom-2 -right-2 size-4" : "bottom-1 right-1 size-5")}>
      <ChevronRight className={small ? "size-2.5" : "size-3"} />
    </button>
  ) : null;
  const button = (k: SurfaceKind) => (
    <span key={at(k)} data-preview-part="button" data-preview-kind={at(k)} {...choose(at(k), k.ids)} title={`${k.name}: ${k.parts} on the site`}
      className={cn("group relative inline-block cursor-pointer px-2 py-0.5 text-fine font-semibold", ring(picked === at(k)))}
      style={{ ...dress(k), ...faceCss(k.face), ...glow(k), borderRadius: Math.min(k.radius, 12) }}>
      {k.sample ?? k.name}
      {count(k.parts, true)}
      {next(k, true)}
    </span>
  );
  const standing = (where: number) => buttons.filter((b) => b.inside === where);
  const loose = buttons.filter((b) => b.inside === -1 || !surfaces.some((k) => at(k) === b.inside));
  return (
    <div ref={root} data-theme-preview="" data-preview-part="page" {...choose("page", [])}
      onMouseEnter={() => { tourBegin(); pointAt([]); }}
      onMouseLeave={() => { pointAt(resting ? onThisPage(resting) : null); tourEnd(); }}
      className={cn("cursor-pointer space-y-2 overflow-hidden rounded-md border border-border p-2", picked === "page" && "outline outline-2 outline-offset-2 outline-accent")}
      style={{ ...ground, color: site.page.words ?? palette.text }} title="The page">
      <span data-preview-part="heading" className="block text-[15px] font-bold leading-tight" style={{ ...faceCss(site.page.face), ...glow(site.page) }}>The page&rsquo;s own words</span>
      {tabs.length ? (
        <div data-preview-tabs="" className="relative z-10 -mb-3 flex flex-wrap gap-1 pl-2">
          {tabs.map((k) => (
            <span key={at(k)} data-preview-part="tab" data-preview-kind={at(k)} {...choose(at(k), k.ids)} title={`${k.name}: ${k.parts} on the site`}
              className={cn("group relative inline-block cursor-pointer px-2 py-0.5 pr-4 text-fine font-semibold", ring(picked === at(k)))}
              style={{ ...dress(k), ...faceCss(k.face), ...glow(k) }}>
              <span data-preview-name="">{k.name}</span>
              {count(k.parts, true)}
              {next(k, true)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {surfaces.map((k) => (
          <div key={at(k)} data-preview-part="surface" data-preview-kind={at(k)} data-preview-fill={k.fill} {...choose(at(k), k.ids)} title={`${k.name}: ${k.parts} on the site`}
            className={cn("group relative min-w-0 cursor-pointer space-y-1 p-1.5 pr-7", standing(at(k)).length && "col-span-2", tabs.length && at(k) === at(surfaces[0]!) && "pt-4", ring(picked === at(k)))} style={dress(k)}>
            <span data-preview-name="" className="block truncate text-small font-semibold leading-tight" style={faceCss(k.face)}>{k.name}</span>
            {k.wordsIds.length ? <span className="block truncate text-fine leading-snug" style={{ ...faceCss(k.face), ...glow(k) }}>{k.sample ?? "Its words"}</span> : null}
            {count(k.parts)}
            {next(k)}
            {standing(at(k)).length ? <div className="flex flex-wrap gap-1.5 pt-0.5">{standing(at(k)).map(button)}</div> : null}
          </div>
        ))}
      </div>
      {accents.length ? (
        <div data-preview-accents="" className="flex flex-wrap gap-x-2.5 gap-y-1">
          {accents.map((k) => (
            <span key={at(k)} data-preview-part="accent" data-preview-kind={at(k)} data-preview-fill={k.fill} {...choose(at(k), k.ids)} title={`${k.name}: ${k.parts} on the site, a small accent`}
              className={cn("group relative inline-flex cursor-pointer items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2.5 text-fine", ring(picked === at(k)))}>
              <span data-preview-dot="" className="size-3 shrink-0 rounded-full" style={{ background: k.paint, boxShadow: "0 0 0 1px rgb(0 0 0 / 0.35)" }} />
              <span data-preview-name="" className="max-w-[9rem] truncate">{k.name}</span>
              {count(k.parts, true)}
              {next(k, true)}
            </span>
          ))}
        </div>
      ) : null}
      {loose.length ? <div className="flex flex-wrap gap-1.5">{loose.map(button)}</div> : null}
    </div>
  );
}

/** The picked piece's parts: what the board goes back to outlining when a hover leaves. */
let resting: string[] | null = null;

/** Drawn on the board now: on the page in view and in the state it shows. */
function drawnNow(id: string): boolean {
  const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
  return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none";
}

/**
 * A pressed piece, seen on the board: its parts glow where they are drawn,
 * and nothing else changes. When none is drawn on the page in view, the board
 * turns to the page one of them is on. It never switches a hidden state on:
 * that drew the PonsStars "Menu" button (a hidden part of the nav) over the
 * Play tab, kept it there after the editor closed, and Undo, which steps
 * edits, could not take it off (J, 2026-10-10). A part in a hidden state is
 * still edited with its kind; it shows when its state is picked in the Show bar.
 */
function bringIntoView(ids: string[]) {
  if (!ids.length) { pointAt(null); return; }
  const s = useStudio.getState();
  if (ids.some((id) => drawnNow(id))) { pointAt(onThisPage(ids)); return; }
  const pageOf = new Map(s.nodes.map((n) => [n.id, n.pageId]));
  const target = ids.find((id) => pageOf.get(id) !== s.activePageId && pageOf.get(id));
  if (ids.some((id) => pageOf.get(id) === s.activePageId) || !target) { pointAt(onThisPage(ids)); return; }
  s.setActivePage(pageOf.get(target)!);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    pointAt(onThisPage(ids));
    scrollToParts(ids.filter((id) => drawnNow(id)));
  }));
}

/** Of these parts, the ones on the page in view: those are the ones that can be outlined. */
function onThisPage(ids: string[]): string[] {
  const s = useStudio.getState();
  const page = new Map(s.nodes.map((n) => [n.id, n.pageId]));
  return ids.filter((id) => page.get(id) === s.activePageId);
}

/** A colour the picker gives (no see-through) keeping how see-through the old one was: a glow stays a glow. */
function keepAlpha(was: string, to: string): string {
  const m = /rgba\([^)]*,\s*([\d.]+)\s*\)$/.exec(was.replace(/\s+/g, " "));
  const a = m ? Number(m[1]) : 1;
  if (a >= 1) return to;
  const c = parseColor(to);
  return c ? `${css(c).replace(/\)$/, "")} / ${a})` : to;
}

/**
 * One colour in the editor: the swatch is the picker. While the hand is in
 * the picker the colour reaches the board once a frame, redone each time from
 * the site as the hand found it, with nothing saved; letting go saves once and
 * is one undo step (`board/store/gesture.ts`).
 */
function Paint({ hook, label, value, onTo }: { hook: string; label: string; value: string; onTo: (from: string, to: string) => void }) {
  const [hex, setHex] = React.useState(toHex(parseColor(value) ?? { l: 0.5, c: 0, h: 0 }));
  React.useEffect(() => { setHex(toHex(parseColor(value) ?? { l: 0.5, c: 0, h: 0 })); }, [value]);
  /* The colour the hand went down on: every frame swaps from it, never from one passed on the way. */
  const from = React.useRef<string | null>(null);
  const preview = (to: string) => {
    if (from.current === null) from.current = value;
    const was = from.current;
    const base = gestureBase();
    if (base) useStudio.setState({ nodes: base.nodes, look: base.look });
    onTo(was, keepAlpha(was, to));
  };
  const typed = (to: string) => { startGesture(); preview(to); endGesture(); from.current = null; };
  return (
    /* Not a <label>: a press on the name or the gap beside it opened the picker (J, 2026-10-09). Only the swatch does. */
    <div data-kind-colour={hook} className="flex items-center gap-2 text-small text-fg">
      <HandColour aria-label={label} value={toHex(parseColor(value) ?? { l: 0.5, c: 0, h: 0 }).slice(0, 7)}
        onPick={preview} onSettle={() => { from.current = null; }}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent" />
      <span className="min-w-0 flex-1">{label}</span>
      {/* As wide as the code it holds. */}
      <Input inputSize="sm" mono size={Math.max(7, hex.length)} className="w-fit shrink-0" value={hex} aria-label={`${label}, as hex`}
        onChange={(e) => setHex(e.target.value)}
        onBlur={() => { const c = parseColor(hex); if (c && toHex(c) !== toHex(parseColor(value) ?? c)) typed(toHex(c)); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

/**
 * A whole-site number read off the captured site (Format's old "This site":
 * base size, corners), set from the page's editor. A drag is one undo step.
 */
function SiteDial({ id, label, min, max, hint }: { id: "type.baseSize" | "layout.radius"; label: string; min: number; max: number; hint: string }) {
  const { readings, format } = useSiteFormat();
  const read = Number.parseFloat(readings[id]?.shows ?? "");
  const value = Number(format[id] ?? (Number.isFinite(read) ? read : id === "type.baseSize" ? 16 : 10));
  return (
    <label data-site-dial={id} className="block space-y-1 text-small text-fg">
      <span>{label}</span>
      <Slider value={[value]} min={min} max={max} step={1} readout={(n) => `${n}px`} silent aria-label={label}
        onValueChange={(v) => useStudio.getState().setFormat(id, v[0] ?? value)} />
      <span className="block text-fine leading-snug text-fg-faint">{hint}</span>
    </label>
  );
}

/**
 * The corners of every part of a kind: its own radius, which the board and
 * the export draw (a whole-site radius leaves a part the site rounded as it
 * was, so on a site brought in it moved nothing; J, 2026-10-09). A drag is one undo step.
 */
/** "Square": a radius the board reads as set (0 reads as "the site's default") and nobody can see. */
const SQUARE = 0.5;
function KindCorners({ k }: { k: SurfaceKind }) {
  /* Past half its shortest side a corner cannot round any more: the cap is that, for the smallest copy (J, 2026-10-09). */
  const nodes = useHeldStudio((s) => s.nodes);
  const cap = React.useMemo(() => {
    const ids = new Set(k.ids);
    const sides = nodes.filter((n) => ids.has(n.id)).map((n) => Math.min(n.w ?? 0, n.h ?? 0)).filter((x) => x > 0);
    return Math.max(1, Math.floor((sides.length ? Math.min(...sides) : 96) / 2));
  }, [nodes, k.ids]);
  return (
    <label data-kind-corners="" className="block space-y-1 text-small text-fg">
      <span>Corners</span>
      <Slider value={[Math.min(k.radius, cap)]} min={0} max={cap} step={1} readout={(n) => `${n}px`} silent aria-label="Corners"
        onValueChange={(v) => { keepBefore(k.ids); useStudio.getState().patchNodes(k.ids, () => ({ radius: Math.max(v[0] ?? 0, SQUARE), radii: undefined, radiiY: undefined } as Partial<StudioNode>)); }} />
    </label>
  );
}

/**
 * The words of a kind wear one glow, the same on every one of them as the
 * preview draws it (J, 2026-10-09: the page's glow showed in the preview and
 * on one TV caption only): `colour` at `px`, or none. Hard drop shadows under
 * it stay. One store change, so one undo step (a drag: one gesture).
 */
function wearGlow(ids: string[], colour: string | null, px: number): void {
  keepBefore(ids);
  useStudio.getState().patchNodes(ids, (n) => {
    const art = n.art as { textShadow?: string } | null | undefined;
    const patch: Record<string, unknown> = {};
    const sh = setGlow(art?.textShadow, colour, px);
    if (sh !== (art?.textShadow ?? undefined)) {
      const { textShadow: _drop, ...rest } = art ?? {};
      patch.art = sh ? { ...rest, textShadow: sh } : Object.keys(rest).length ? rest : null;
    }
    if (Array.isArray(n.content) && (n.content as unknown as Record<string, unknown>[]).some((r) => r && typeof r.textShadow === "string")) {
      patch.content = (n.content as unknown as Record<string, unknown>[]).map((r) => {
        if (!r || typeof r.textShadow !== "string") return r;
        const { textShadow: was, ...rest } = r;
        const now = setGlow(was as string, colour, px);
        return now ? { ...rest, textShadow: now } : rest;
      });
    }
    return patch as Partial<StudioNode>;
  });
}

/**
 * How far the glow on a kind's words spreads, or none. PonsStars' label tabs
 * wear a 5px glow the nav tabs do not; recoloured darker than the words it
 * smudges them, and a colour alone could not take it away (J, 2026-10-09).
 * "No glow" takes the glow off every word of the kind, leaving no shadow
 * where there was only the glow.
 */
function KindGlow({ glow, size, ids }: { glow: string; size: number; ids: string[] }) {
  return (
    <div data-kind-glow="" className="space-y-1 text-small text-fg">
      <div className="flex items-center gap-2">
        <span className="flex-1">Glow size</span>
        <Button size="xs" variant="ghost" data-kind-glow-off="" onClick={() => { wearGlow(ids, null, size); play("close"); }}>No glow</Button>
      </div>
      <Slider value={[Math.min(size, 20)]} min={1} max={20} step={1} readout={(n) => `${n}px`} silent aria-label="Glow size"
        onValueChange={(v) => wearGlow(ids, glow, v[0] ?? size)} />
    </div>
  );
}

/** The face a site made here sets its headings or words in. */
function SiteFamily({ id, label }: { id: "type.headingFamily" | "type.bodyFamily"; label: string }) {
  const field = FORMAT_FIELDS.find((f) => f.id === id)!;
  const value = String(useHeldStudio((s) => s.format[id]) ?? field.default);
  return (
    <label data-site-family={id} className="flex items-center gap-2 text-small text-fg">
      <span className="w-20 shrink-0">{label}</span>
      <Select className="min-w-0 flex-1" aria-label={`${label} font`} value={value} onChange={(v) => useStudio.getState().setFormat(id, v)}
        options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />
    </label>
  );
}

/** A stack the page wrote is used as written; a face's key goes through the site's own faces. */
const faceCss = (f: string | null): React.CSSProperties => (f && (f.includes(",") || /^(monospace|serif|sans-serif|system-ui|cursive)$/.test(f)) ? { fontFamily: f } : faceStyle(f ?? SITE_TYPE));

/**
 * What a piece of the preview opens: its colour (each stop of its gradient),
 * the words on it and their glow, its outline, its font (folded), and for a
 * panel or field its texture. Every change reaches every part of the kind.
 */
function KindEditor({ pick, site, palette, background, onClose }: { pick: Pick; site: SiteKinds; palette: Palette; background: readonly string[]; onClose: () => void }) {
  const nodes = useHeldStudio((s) => s.nodes);
  const pages = useHeldStudio((s) => s.pages);
  const carried = useHeldStudio((s) => s.look.fonts);
  const k = pick === "page" ? null : site.kinds[pick] ?? null;
  const ids = React.useMemo(() => (k ? k.ids : []), [k]);
  /* Picked, its parts stay outlined on the board for as long as its editor is open (J, 2026-10-09): through
     a hover over another piece, an edit, a turn to another page or state. */
  const active = useStudio((s) => s.activePageId);
  const shown = useStudio((s) => (s.statesOn ?? []).join("|"));
  const idsKey = ids.join("|");
  React.useEffect(() => { bringIntoView(ids); }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    resting = ids;
    pointAt(onThisPage(ids));
    return () => { resting = null; pointAt(null); };
  }, [idsKey, active, shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const [fontOpen, setFontOpen] = React.useState(false);
  const { captured } = useSiteFormat();
  if (pick !== "page" && !k) return null;
  const pal = () => resolvePalette(useStudio.getState().format, useStudio.getState().look);
  const swap = (from: string, to: string, use: ColourUse, only: string[]) => useStudio.getState().swapColourAll(from, to, pal(), { use, only });
  const words = k ? k.words : site.page.words;
  const wordsIds = k ? k.wordsIds : site.page.wordsIds;
  const glowOn = k ? k.glow : site.page.glow;
  const glowSize = k ? k.glowSize : site.page.glowSize;
  const faceKey = k ? k.faceKey : site.page.faceKey;
  const name = k ? k.name : "The page";
  /* Every face on the site, the site's own type, and the families. */
  const faces = [...new Set([...fontsInPageOrder(nodes, pages.map((p) => p.id)).map((f) => f.key).filter((x) => x && !FAMILY[x]), ...(carried ?? []).map((f) => f.family)])];
  const targets: { id: string; label: string; to: FaceTo }[] = [
    { id: "site", label: "The site's type", to: { site: true } },
    ...faces.map((f) => ({ id: `face:${f}`, label: f, to: { face: f } as FaceTo })),
    ...Object.keys(FAMILY).map((x) => ({ id: `family:${x}`, label: x, to: { family: x } as FaceTo })),
  ];
  const setFace = (id: string) => {
    const t = targets.find((x) => x.id === id);
    if (!t) return;
    keepBefore(wordsIds);
    const st = useStudio.getState();
    const mark = st.historyMark();
    const byId = new Map(st.nodes.map((n) => [n.id, n]));
    let n = 0;
    for (const f of new Set(wordsIds.map((x) => faceOf(byId.get(x) ?? { id: x })))) n += useStudio.getState().swapFontAll(f, t.to, wordsIds).length;
    useStudio.getState().oneStepSince(mark);
    play(n ? "confirm" : "deny");
  };
  /* The page's colour, and the background layers as wide as the page with it. */
  const pageTo = (from: string, to: string) => {
    swap(from, to, "fill", [PAGE_ID]);
    const now = useStudio.getState().nodes;
    for (const id of background) {
      const n = now.find((x) => x.id === id);
      if (n) for (const f of spotsOf(n, pal()).filter((x) => x.spot.use === "fill")) swap(f.key, to, "fill", [id]);
    }
  };
  return (
    <div data-kind-editor={name} className="space-y-2 rounded-md border border-border bg-elevated p-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-small font-semibold text-fg">{name}</span>
        {k ? <span className="num text-small font-bold text-fg-muted">{k.parts}</span> : null}
        <Button size="xs" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {k ? (
        k.stops.length > 1 ? (
          <div data-kind-gradient={k.stops.length} className="space-y-1">
            <p className="text-fine text-fg-faint">Gradient</p>
            {k.stops.map((c, i) => <Paint key={i} hook={`stop-${i}`} label={i ? `Colour ${i + 1}` : "Colour 1"} value={c} onTo={(f, t) => swap(f, t, "fill", k.ids)} />)}
          </div>
        ) : (
          <Paint hook="fill" label="Fill" value={k.fill} onTo={(f, t) => { for (const sh of new Set([f, ...k.shades])) swap(sh, t, "fill", k.ids); }} />
        )
      ) : (
        <Paint hook="fill" label="Background" value={site.page.fill} onTo={pageTo} />
      )}
      {words ? <Paint hook="words" label="Words" value={words} onTo={(f, t) => swap(f, t, "text", wordsIds)} /> : null}
      {glowOn ? <Paint hook="glow" label="Glow on the words" value={glowOn} onTo={(_f, t) => wearGlow(wordsIds, t, glowSize)} /> : null}
      {glowOn ? <KindGlow glow={glowOn} size={glowSize} ids={wordsIds} /> : null}
      {!glowOn && wordsIds.length ? (
        <div data-kind-glow-add="" className="flex items-center gap-2 text-small text-fg">
          <span className="flex-1">Glow on the words</span>
          <Button size="xs" variant="ghost" onClick={() => { wearGlow(wordsIds, palette.accent ?? "#ffffff", 6); play("confirm"); }}>Add a glow</Button>
        </div>
      ) : null}
      {k?.outline ? <Paint hook="outline" label="Outline" value={k.outline.colour} onTo={(f, t) => swap(f, t, "border", k.ids)} /> : null}
      {wordsIds.length || !k ? (
        <div data-kind-font="" className="rounded-md border border-border">
          <button type="button" aria-expanded={fontOpen} onClick={() => { play("select"); setFontOpen((o) => !o); }} className="tactile flex w-full items-center gap-2 px-2 py-1 text-left text-small text-fg hover:bg-hover">
            <span className="flex-1">Font</span>
            <span className="truncate text-fg-muted" style={faceCss(faceKey)}>{faceKey || "The site's type"}</span>
          </button>
          {fontOpen ? (
            <div className="space-y-2 border-t border-border p-2">
              {wordsIds.length ? (
                <Select className="w-full" aria-label="Font" value="" placeholder="Set the words in…" onChange={setFace}
                  options={targets.filter((t) => t.id !== `face:${faceKey}` && t.id !== `family:${faceKey}` && !(faceKey === SITE_TYPE && t.id === "site")).map((t) => ({ value: t.id, label: t.label }))} />
              ) : null}
              {/* A site made here: the faces new headings and words are set in (Format's old "This site"). */}
              {k || captured ? null : <><SiteFamily id="type.headingFamily" label="Headings" /><SiteFamily id="type.bodyFamily" label="Words" /></>}
              {k ? null : <SiteDial id="type.baseSize" label="Text size, the whole site" min={13} max={22} hint="Every word on the site is sized from this, so they all grow or shrink together." />}
            </div>
          ) : null}
        </div>
      ) : null}
      {k ? <KindCorners k={k} /> : null}
      {k || captured ? null : <SiteDial id="layout.radius" label="Corners" min={0} max={32} hint="Boxes the site rounded keep their own corners; this sets the rest." />}
      {/* The page, a panel or a field: its texture, given here (`PieceTexture.tsx`). Not a button: a button is words on a fill. */}
      {!k ? <PieceTexture ids={[...background]} page ground={site.page.fill} palette={palette} /> : !k.button ? <PieceTexture ids={k.ids} page={false} ground={k.fill} palette={palette} /> : null}
    </div>
  );
}

/**
 * Back to what the site gave, on a site brought in; the app's own otherwise.
 * The roles AND every part the panel repainted (a theme roll, a kind's
 * colour), each to its colours before its first change (`look.coloursWas`):
 * putting only the roles back left the rolled colours on the parts. One undo.
 */
function resetColours(): void {
  const st = useStudio.getState();
  const mark = st.historyMark();
  const from = st.look.paletteFrom;
  const was = st.look.coloursWas ?? {};
  const lookWas = st.look.lookWas ?? {};
  const textureWas = st.look.textureWas;
  st.setLook({ palette: from ? Object.fromEntries(ROLES.flatMap((r) => (from[r] ? [[r, from[r]!.colour]] : []))) : {}, coloursWas: {}, lookWas: {}, textureWas: undefined, ...(textureWas ? { texture: textureWas } : {}) });
  /* Corners, glow, font and texture first, as they were before the preview's editors (`previewWas.ts`); then the colours, which are kept from before any change. */
  const shaped = st.nodes.filter((n) => lookWas[n.id]).map((n) => n.id);
  if (shaped.length) useStudio.getState().patchNodes(shaped, (n) => lookWas[n.id] as Partial<StudioNode>);
  const ids = st.nodes.filter((n) => was[n.id]).map((n) => n.id);
  if (ids.length) useStudio.getState().patchNodes(ids, (n) => withColours(n, was[n.id]!) as Partial<StudioNode>);
  useStudio.getState().oneStepSince(mark);
}

export function SiteColoursSection({ captured = true, paletteRoles = null }: { captured?: boolean; paletteRoles?: React.ReactNode } = {}) {
  const { nodes, palette, look } = useSite();
  const frameWidth = useHeldStudio((s) => s.frameWidth);
  const pictureColours = usePictureColours(nodes);
  const pictureKey = [...pictureColours.entries()].map(([k, v]) => `${k}:${v.join("")}`).join("|");
  /* A button painted by stacked parts is one button in every count (`components.ts`). */
  const counted = React.useMemo<CountedAs>(() => {
    const c = componentsOf(nodes as unknown as CompNode[], palette as Record<string, string>);
    return { countAs: (id) => c.of.get(id) ?? id, kindOf: (id) => { const host = c.of.get(id); return host ? c.byId.get(host)?.kind ?? null : null; } };
  }, [nodes, palette]);
  const roles = React.useMemo(() => siteRoles(nodes, palette, frameWidth || 1440, pictureColours, undefined, counted), [nodes, palette, frameWidth, pictureKey, counted]); // eslint-disable-line react-hooks/exhaustive-deps
  const background = React.useMemo(() => new Set(roles.left.backgroundLayers), [roles]);
  const site = React.useMemo(() => siteKinds(nodes, palette, background), [nodes, palette, background]);
  /* What the page and each kind wear, texture included: the preview draws what the board draws. */
  const ground = React.useMemo(() => pageGround(roles.left.backgroundLayers, nodes, look.texture, palette, site.page.fill), [roles, nodes, look.texture, palette, site.page.fill]);
  const grounds = React.useMemo(() => new Map(site.kinds.flatMap((k, i) => { const g = !k.button ? kindGround(k.ids, nodes, look.texture, palette, k.fill) : null; return g ? [[i, g] as const] : []; })), [site, nodes, look.texture, palette]);
  const [picked, setPicked] = React.useState<Pick | null>(null);
  const [rolled, setRolled] = React.useState<number | null>(null);
  const [rolesOpen, setRolesOpen] = React.useState(false);
  const roll = () => { const n = randomizeTheme(roles, palette, counted); play(n ? "confirm" : "deny"); setRolled(n); };

  return (
    <section data-site-colours="" className="space-y-3 border-b border-border p-3">
      <div>
        <div className="flex items-center justify-between">
          <h3 data-look-heading className="text-plain font-semibold text-fg">Colours</h3>
          {(look.palette && Object.keys(look.palette).length) || Object.keys(look.coloursWas ?? {}).length || hasKept(look) ? (
            <button
              type="button"
              data-colours-reset=""
              onClick={() => { play("close"); resetColours(); }}
              className="text-small text-fg-muted hover:text-fg"
            >
              Reset
            </button>
          ) : null}
        </div>
        <MoreHint
          className="text-small leading-snug text-fg-muted"
          text={captured
            ? "The site's own kinds of surface, words and buttons, each with how many parts wear it. Press one to change it everywhere it is used. A colour on one or two parts is changed on the part itself."
            : "The site's colours. Press one to change it; every part that follows it changes with it."}
        />
      </div>
      {captured ? null : paletteRoles}
      <ThemePreview site={site} palette={palette} picked={picked} onPick={(p) => setPicked((was) => (was === p ? null : p))} ground={ground} grounds={grounds} />
      {picked !== null ? <KindEditor key={String(picked)} pick={picked} site={site} palette={palette} background={roles.left.backgroundLayers} onClose={() => setPicked(null)} /> : null}
      {captured ? (
        <div data-randomize-theme="" className="space-y-1">
          <Button size="xs" variant="outline" className="w-full" onClick={roll}>
            <Dices className="size-3" /> Randomize theme
          </Button>
          {rolled !== null ? (
            <p data-theme-rolled="" className="flex items-center gap-2 text-small text-fg-muted">
              {rolled ? `New theme on ${rolled} part${rolled === 1 ? "" : "s"}, in one step.` : "Nothing to recolour."}
              {rolled ? (
                <button type="button" className="inline-flex items-center gap-1 text-fg hover:underline" onClick={() => { useStudio.getState().undo(); setRolled(null); play("close"); }}>
                  <Undo2 className="size-3" /> Undo
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {captured && paletteRoles ? (
        /* The six roles parts added here are painted from: advanced, folded (J: the background and ink are edited from the preview now). */
        <div data-six-roles="">
          <button type="button" aria-expanded={rolesOpen} onClick={() => { play("select"); setRolesOpen((o) => !o); }} className="tactile text-small text-fg-muted hover:text-fg">
            {rolesOpen ? "Hide" : "Advanced:"} colours for parts added here
          </button>
          {rolesOpen ? <div className="pt-2">{paletteRoles}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

const faceStyle = (key: string): React.CSSProperties =>
  key === SITE_TYPE ? {} : FAMILY[key] ? { fontFamily: FAMILY[key] } : { fontFamily: `"${key}"` };

export function SiteFontsSection() {
  const nodes = useHeldStudio((s) => s.nodes);
  const carried = useHeldStudio((s) => s.look.fonts);
  const pages = useHeldStudio((s) => s.pages);
  /* In page order: by where each face is first used, top of the site to the bottom (`fontsInPageOrder`). */
  const fonts = React.useMemo(() => fontsInPageOrder(nodes, pages.map((p) => p.id)), [nodes, pages]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string>("");
  const [done, setDone] = React.useState<number | null>(null);
  if (!fonts.length || (fonts.length === 1 && fonts[0]!.key === SITE_TYPE)) return null;
  const faces = [...new Set([...fonts.map((f) => f.key).filter((k) => k && !FAMILY[k]), ...(carried ?? []).map((f) => f.family)])];
  const targets: { id: string; label: string; to: FaceTo }[] = [
    { id: "site", label: "The site's type", to: { site: true } },
    ...faces.map((f) => ({ id: `face:${f}`, label: f, to: { face: f } as FaceTo })),
    ...Object.keys(FAMILY).map((k) => ({ id: `family:${k}`, label: k, to: { family: k } as FaceTo })),
  ];
  const openFont = fonts.find((f) => f.key === open);
  return (
    <section data-site-fonts="" className="space-y-2 border-b border-border p-3">
      <div>
        <h3 data-look-heading className="text-plain font-semibold text-fg">Fonts on this site</h3>
        <MoreHint className="text-small leading-snug text-fg-muted" text="Each face the words are set in, top of the site to the bottom, and how many parts use it. Press one to swap it everywhere it is used." />
      </div>
      <div className="space-y-1">
        {fonts.map((f) => (
          <button
            key={f.key || "site"}
            type="button"
            data-site-font={f.key || "site"}
            aria-pressed={open === f.key}
            onClick={() => { play("select"); setDone(null); setTo(""); setOpen((o) => (o === f.key ? null : f.key)); }}
            className={cn("tactile flex w-full items-baseline gap-2 rounded-md border px-2 py-1.5 text-left", open === f.key ? "border-accent" : "border-border hover:bg-hover")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-plain text-fg" style={faceStyle(f.key)}>{f.key || "The site's type"}</span>
              {f.first ? (
                <span data-site-font-first="" className="block truncate text-fine text-fg-faint">
                  {firstSays(f.first)}{pages.length > 1 && f.first.pageId !== pages[0]?.id ? `, on ${pages.find((p) => p.id === f.first!.pageId)?.name ?? "another page"}` : ""}
                </span>
              ) : null}
            </span>
            <span className="num shrink-0 text-small text-fg-muted">{f.parts} part{f.parts === 1 ? "" : "s"}</span>
          </button>
        ))}
      </div>
      {openFont ? (
        <div data-site-font-detail={openFont.key || "site"} className="space-y-2 rounded-md border border-border bg-elevated p-2">
          <PartsList spots={openFont.ids.map((id) => ({ id, where: "words" }))} />
          <label className="flex items-center gap-2 text-small text-fg-muted">
            Set them in
            <Select
              className="min-w-0 flex-1"
              aria-label="New face"
              value={to}
              placeholder="choose a face…"
              onChange={setTo}
              options={targets.filter((t) => t.id !== `face:${openFont.key}` && t.id !== `family:${openFont.key}` && !(openFont.key === SITE_TYPE && t.id === "site")).map((t) => ({ value: t.id, label: t.label }))}
            />
          </label>
          <Button
            data-site-font-swap=""
            size="xs"
            variant="outline"
            className="w-full"
            disabled={!to}
            onClick={() => {
              const t = targets.find((x) => x.id === to);
              if (!t) return;
              keepBefore(useStudio.getState().nodes.filter((n) => faceOf(n) === openFont.key).map((n) => n.id));
              const changed = useStudio.getState().swapFontAll(openFont.key, t.to);
              play(changed.length ? "confirm" : "deny");
              setDone(changed.length);
              setOpen(null);
            }}
          >
            Swap {openFont.parts === 1 ? "this part" : `all ${openFont.parts} parts`}
          </Button>
        </div>
      ) : null}
      {done !== null ? (
        <p data-site-font-swapped="" className="flex items-center gap-2 text-small text-fg-muted">
          Set {done} part{done === 1 ? "" : "s"} in the new face.
          <button type="button" className="inline-flex items-center gap-1 text-fg hover:underline" onClick={() => { useStudio.getState().undo(); setDone(null); play("close"); }}>
            <Undo2 className="size-3" /> Undo
          </button>
        </p>
      ) : null}
    </section>
  );
}
