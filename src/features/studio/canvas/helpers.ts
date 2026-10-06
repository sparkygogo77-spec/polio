import { boardShows,screenKey,screenLooks,screenPlaces,steppedParts,type PlaceBox,type ScreenRead,type StepLook } from "../boardStates";
import { stateFrames } from "../stateFrames";
import { panelDecides } from "../stateRules";
import { panelsOfPage, readIsolateKey, type PanelSource } from "../panelsOf";
import { panelDrawing, type PanelNode } from "../panels";
import { REACH_WIDTH } from "../strand";
import { roomForWords } from "../roomForWords";
import { type StudioNode } from "../store";
import { type Box as HeldBox,type Held } from "../groupScale";



export const GRID = 8;
export type Source = { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] };
export const sourceOf = (s: { look?: unknown }) => (s.look as { styleSource?: Source } | undefined)?.styleSource;
/** What the parts stepped on the board decide inside them, and where they draw it (`boardStates.ts#steppedParts`). */
export let steppedMemo: { on: unknown; screens: unknown; files: unknown; nodes: unknown; read: ReturnType<typeof steppedParts> } | null = null;
export const NO_STEPS: ReturnType<typeof steppedParts> = { decide: new Map(), places: new Map(), within: new Map(), looks: new Map() };
export function steppedOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[] }): ReturnType<typeof steppedParts> {
  const on = s.statesOn ?? [];
  if (!on.some((k) => k.startsWith("step:"))) return NO_STEPS;
  const source = sourceOf(s);
  if (steppedMemo && steppedMemo.on === on && steppedMemo.screens === source?.screens && steppedMemo.files === source?.files && steppedMemo.nodes === s.nodes) return steppedMemo.read;
  const nodes = s.nodes ?? [];
  const read = steppedParts(nodes, on, source?.screens, (pageId) => source?.files?.find((f) => f.pageId === pageId)?.file ?? null, stateFrames(nodes));
  steppedMemo = { on, screens: source?.screens, files: source?.files, nodes: s.nodes, read };
  return read;
}
/**
 * ONE PANEL, ISOLATED ON THE BOARD (J, 2026-10-06): picked from the Panels
 * rail, the rest of its page steps away and the panel stands alone in the
 * middle of its page (`centreIsolated`), never under the rail, on what
 * still holds it there (the page's dotted ground), in the state picked, so
 * it is seen and edited with its real contrast. Only while it is picked:
 * the rail lets go of it when the pick moves off it (`PanelsPage.tsx`).
 */
export type Isolated = { pageId: string; shows: Set<string>; places: Map<string, PlaceBox>; looks: Map<string, StepLook>; panelId: string };
export let isolatedMemo: { on: unknown; nodes: unknown; source: unknown; frameWidth?: number; read: Isolated | null } | null = null;
export function isolatedOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[]; frameWidth?: number }): Isolated | null {
  const on = s.statesOn ?? [];
  const key = on.map(readIsolateKey).find((x) => !!x);
  if (!key) return null;
  const source = sourceOf(s) as PanelSource;
  if (isolatedMemo && isolatedMemo.on === on && isolatedMemo.nodes === s.nodes && isolatedMemo.source === source && isolatedMemo.frameWidth === s.frameWidth) return isolatedMemo.read;
  const nodes = (s.nodes ?? []) as unknown as PanelNode[];
  const p = nodes.find((n) => n.id === key.panelId);
  let read: Isolated | null = null;
  if (p) {
    const panel = panelsOfPage(nodes, source, p.pageId).panels.find((x) => x.id === p.id);
    const state = panel?.states.find((x) => x.key === key.state) ?? panel?.states[0];
    const sample = state?.samples.find((x) => x.key === key.sample) ?? state?.samples[0];
    const page = nodes.filter((n) => n.pageId === p.pageId);
    const d = panelDrawing(page, p.id, sample?.screen ?? null);
    const places = new Map<string, PlaceBox>();
    const looks = new Map<string, StepLook>();
    /* A panel that covers its whole page (the intro tour's dimmed screen and ring) is seen over the page its scene shows, so the ring sits on the part it points at (J, 2026-10-06). */
    const under = overlayScene(page, d.placed[0] ?? null, source, panel?.hook ?? null, state?.key ?? null, s);
    /* Centred on a lone page, so it never sits under the rail or off the side (J, 2026-10-06). */
    const at = under?.places.get(p.id);
    const c = under ? (at && d.placed[0] ? { dx: at.x - d.placed[0].x, dy: at.y - d.placed[0].y } : { dx: 0, dy: 0 }) : centreIsolated(page, d.placed[0] ?? null, s.frameWidth);
    if (under) for (const n of page) if (n.id !== p.id && !d.inner.has(n.id) && under.shows(n as never)) { const b = under.places.get(n.id); if (b) places.set(n.id, b); const l = under.looks.get(n.id); if (l) looks.set(n.id, l); }
    for (const x of d.placed) { places.set(x.node.id, { x: x.x + c.dx, y: x.y + c.dy, w: x.w, h: x.h }); if (x.look) looks.set(x.node.id, x.look); }
    /* What it sits in stays only where it still holds it (the page's dotted ground); a card it has moved out of steps away. */
    const box = d.placed[0] ? { x: d.placed[0].x + c.dx, y: d.placed[0].y + c.dy, w: d.placed[0].w, h: d.placed[0].h } : null;
    const around = d.around.filter((a) => !box || (a.x <= box.x && a.y <= box.y && a.x + a.w >= box.x + box.w && a.y + a.h >= box.y + box.h));
    const shows = new Set([...around, ...d.placed.map((x) => x.node)].map((n) => n.id));
    if (under) for (const n of page) if (n.id !== p.id && !d.inner.has(n.id) && under.shows(n as never)) shows.add(n.id);
    /* Longer words than the page opens with push what follows on their line along (`roomForWords.ts`). */
    read = { pageId: p.pageId, shows, places: roomForWords(nodes as never, p.pageId, (n) => shows.has(n.id), places, looks), looks, panelId: p.id };
  }
  isolatedMemo = { on, nodes: s.nodes, source, frameWidth: s.frameWidth, read };
  return read;
}
/** The page under a panel that covers it (as wide as the frame): the declared scene that puts the panel in this state, drawn as the board draws that scene. Null for any other panel. */
function overlayScene(page: readonly { x: number; w: number }[], root: { w: number } | null, source: PanelSource, hook: string | null, state: string | null, s: { look?: unknown; nodes?: StudioNode[]; frameWidth?: number }) {
  if (!root || !hook || !state) return null;
  const width = s.frameWidth && s.frameWidth > 0 ? s.frameWidth : Math.max(0, ...page.map((n) => n.x + n.w));
  if (!width || root.w < width * 0.9) return null;
  const scene = (source?.screens ?? []).find((x) => (x as { declared?: boolean }).declared && (x as { panels?: Record<string, string> }).panels?.[hook] === state);
  if (!scene) return null;
  const lit = { statesOn: [screenKey(scene.name)], look: s.look, nodes: s.nodes };
  return { shows: shownOnBoard(lit), places: placedOnBoard(lit), looks: looksOnBoard(lit) };
}
/** How far to move an isolated panel so it sits in the middle of its page: across the frame, and down the page's height. */
export function centreIsolated(page: readonly { x: number; y: number; w: number; h: number }[], box: { x: number; y: number; w: number; h: number } | null, frameWidth?: number): { dx: number; dy: number } {
  if (!box) return { dx: 0, dy: 0 };
  const width = frameWidth && frameWidth > 0 ? frameWidth : Math.max(box.x + box.w, ...page.map((n) => n.x + n.w));
  const height = Math.max(box.y + box.h, ...page.map((n) => n.y + n.h));
  return { dx: Math.round(Math.max(0, (width - box.w) / 2) - box.x), dy: Math.round(Math.max(0, (height - box.h) / 2) - box.y) };
}
/** Each part's words and picture as the lit screens and the picked steps have them: a step's own win inside its part. */
export let looksMemo: { on: unknown; screens: unknown; files: unknown; nodes: unknown; looks: Map<string, StepLook> } | null = null;
export const NO_LOOKS = new Map<string, StepLook>();
export function looksOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[] }): Map<string, StepLook> {
  const on = s.statesOn ?? [];
  if (!on.length) return NO_LOOKS;
  const iso = isolatedOnBoard(s);
  if (iso) return iso.looks;
  const source = sourceOf(s);
  if (looksMemo && looksMemo.on === on && looksMemo.screens === source?.screens && looksMemo.files === source?.files && looksMemo.nodes === s.nodes) return looksMemo.looks;
  const looks = on.some((k) => k.startsWith("screen:") || k.startsWith("top:")) ? screenLooks((s.nodes ?? []) as never, on, source?.screens, (file) => source?.files?.find((f) => f.file === file)?.pageId ?? null) : new Map<string, StepLook>();
  for (const [id, l] of steppedOnBoard(s).looks) looks.set(id, l);
  looksMemo = { on, screens: source?.screens, files: source?.files, nodes: s.nodes, looks };
  return looks;
}
/** A part stepped through, and everything it decides: drawn over its neighbours, so a part taller in its step covers what is under it rather than moving it. */
export let liftedMemo: { read: unknown; ids: Set<string> } | null = null;
export const NO_LIFT = new Set<string>();
export function liftedOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[] }): Set<string> {
  const read = steppedOnBoard(s);
  if (read === NO_STEPS) return NO_LIFT;
  if (liftedMemo?.read === read) return liftedMemo.ids;
  const ids = new Set([...read.within.keys(), ...read.within.values()]);
  liftedMemo = { read, ids };
  return ids;
}
/** What the board draws with its states on, kept while the states and screens are the same. */
export let shownMemo: { on: unknown; screens: unknown; files: unknown; nodes: unknown; shows: (n: StudioNode) => boolean } | null = null;
export function shownOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[] }): (n: StudioNode) => boolean {
  const on = s.statesOn ?? [];
  const source = sourceOf(s);
  /* A part stepped on the board, or a scene's part with no hook of its own (it goes with the part round it), is read off the parts, so the parts count only then. */
  const iso = isolatedOnBoard(s);
  if (iso) {
    if (shownMemo?.on === on && shownMemo.nodes === iso) return shownMemo.shows;
    const shows = (n: StudioNode) => (n.pageId === iso.pageId ? iso.shows.has(n.id) : !n.state);
    shownMemo = { on, screens: null, files: null, nodes: iso, shows };
    return shows;
  }
  const panelsOn = on.some((k) => k.startsWith("panel:"));
  const steps = panelsOn || on.some((k) => k.startsWith("step:") || k.startsWith("screen:") || k.startsWith("top:")) ? s.nodes ?? [] : null;
  if (shownMemo && shownMemo.on === on && shownMemo.screens === source?.screens && shownMemo.files === source?.files && shownMemo.nodes === steps) return shownMemo.shows;
  /* A declared panel switched on by itself (right-click, States) decides its own parts, over the scene that is on (`stateRules.ts#panelDecides`). */
  let decide = steps ? steppedOnBoard(s).decide : null;
  if (panelsOn && steps) {
    const lit = (source?.screens ?? []).find((x) => on.includes(screenKey(x.name)) && (x as { declared?: boolean }).declared) as { panels?: Record<string, string> } | undefined;
    decide = new Map([...(decide ?? []), ...panelDecides(steps, on, lit?.panels ? { panels: lit.panels } : null)]);
  }
  const shows = on.length ? boardShows(on, source?.screens, (file) => source?.files?.find((f) => f.file === file)?.pageId ?? null, steps ? stateFrames(steps) : null, decide, steps as never) : (n: StudioNode) => !n.state;
  shownMemo = { on, screens: source?.screens, files: source?.files, nodes: steps, shows };
  return shows;
}
/** Where a lit screen, or a part stepped through, draws its parts (`boardStates.ts#screenPlaces`, `#steppedParts`), kept while the states, screens and parts are the same. */
export let placedMemo: { on: unknown; screens: unknown; files: unknown; nodes: unknown; places: Map<string, PlaceBox> } | null = null;
export const NO_PLACES = new Map<string, PlaceBox>();
export function placedOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[] }): Map<string, PlaceBox> {
  const on = s.statesOn ?? [];
  const iso = isolatedOnBoard(s);
  if (iso) return iso.places;
  const screensOn = on.some((k) => k.startsWith("screen:") || k.startsWith("top:")), stepsOn = on.some((k) => k.startsWith("step:"));
  if (!screensOn && !stepsOn) return NO_PLACES;
  const source = sourceOf(s);
  if (placedMemo && placedMemo.on === on && placedMemo.screens === source?.screens && placedMemo.files === source?.files && placedMemo.nodes === s.nodes) return placedMemo.places;
  const shows = shownOnBoard(s);
  const places = screensOn ? screenPlaces((s.nodes ?? []) as never, on, source?.screens, (file) => source?.files?.find((f) => f.file === file)?.pageId ?? null, shows as never) : new Map<string, PlaceBox>();
  /* A part's own step wins inside it: its parts drawn where it draws them, the rest of the page left alone. */
  if (stepsOn) {
    const st = steppedOnBoard(s);
    /* …and, where a whole-page screen has moved the part itself, they go with it. */
    const byId = new Map((s.nodes ?? []).map((n) => [n.id, n]));
    const shift = (f: string) => { const to = places.get(f), n = byId.get(f); return to && n ? { x: to.x - n.x, y: to.y - n.y } : { x: 0, y: 0 }; };
    const moves = new Map([...new Set(st.within.values())].map((f) => [f, shift(f)]));
    for (const [id, f] of st.within) {
      const d = moves.get(f)!, n = byId.get(id), b = st.places.get(id) ?? (n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null);
      if (!b) continue;
      if (st.places.has(id) || d.x || d.y) places.set(id, { ...b, x: b.x + d.x, y: b.y + d.y });
      else places.delete(id);
    }
    /* A part grown to hold its step, where it stands; what is under it in its column, moved down by as much. */
    for (const [id, b] of st.places) {
      if (st.within.has(id)) continue;
      const at = places.get(id), n = byId.get(id);
      places.set(id, at && n ? { ...at, y: at.y + (b.y - n.y), h: b.h } : b);
    }
  }
  /* A scene's longer words push what follows on their line along (`roomForWords.ts`). */
  const looks = looksOnBoard(s);
  let roomy: Map<string, PlaceBox> = places;
  if (looks.size) { const pages = new Set((s.nodes ?? []).filter((n) => looks.has(n.id)).map((n) => n.pageId)); for (const pg of pages) roomy = roomForWords((s.nodes ?? []) as never, pg, shows as never, roomy, looks); }
  placedMemo = { on, screens: source?.screens, files: source?.files, nodes: s.nodes, places: roomy };
  return roomy;
}
/** A box as the board has it: where a part was before he first moved it (`StudioNode.handFrom`). */
export const boxOf = (n: { x: number; y: number; w: number; h: number }) => ({ x: n.x, y: n.y, w: n.w, h: n.h });

/**
 * Parts that take the pointer on the board once they have been OPENED.
 *
 * A very short list on purpose, and both of them are on it for the same
 * reason: they are solids, and looking at a solid tells you nothing that
 * turning it does.
 *
 * It used to be "once they are selected", and that is the bug he found:
 * "once i selected something i have to click off and then clicck and hold
 * to drag." Selecting one handed it the pointer, so the press that would
 * have moved it turned it instead, and the only way to move it was to let
 * go of it first. Now selecting is only selecting, opening is a second
 * press, and the ground closes it. See `handsOn`.
 */
export const HANDS_ON = new Set(["cube-3d", "mesh-3d"]);
/** Two presses this close together, on the same part, are one gesture. */
export const DOUBLE_MS = 400;
/** …and they have to land within this many board pixels of each other. */
export const DOUBLE_SLOP = 8;

/** Parts that wear a drawn icon when one is dropped on them. */
export const WEARS_AN_ICON = new Set(["cta-primary", "quick-action", "follow"]);
/** Breathing room either side of the page. Small: the page is the point. */
/**
 * The ground left showing round the page, both ways.
 *
 * 48 — 24 a side — was enough while the fit was held by the pane's height
 * and the width had hundreds of pixels spare. Giving the pane a whole screen
 * so the column can scroll past it makes the fit width-held instead, and the
 * frame grew from 979 to 1201 of 1272: 35px of ground a side, which is not
 * something a hand can take hold of, and dragging bare ground is how the
 * board is panned. One decision, not two — the scroll takes the ground away
 * and the gutter is what gives it back. 128 leaves 64 a side, a thumb rather
 * than a hairline.
 */
export const FRAME_GUTTER = 128;
/**
 * Ground above the page. There is none below it.
 *
 * It was half of `FRAME_GUTTER` — 64, the same as each side — and J
 * measured the result on the deploy: "too much headroom above the website",
 * and the gap above should be "much slimmer than the sides". The sides are
 * the part he likes and they are not touched; this is.
 *
 * Below the page there is nothing at all, because he said so plainly: the
 * website has no underside gap. The page's foot is the board's foot.
 *
 * A constant rather than something the pan moves: the board is laid out in
 * the pane's flow, so the page sits this far down its own surface and the
 * surface is what scrolls. Vertical pan would be a second way of moving the
 * same thing in the same direction, and two of those disagree.
 */
export const TOP_GUTTER = 20;
/*
 * The page's name above it, in screen pixels: one 14px line standing 4px
 * off the page's edge, 18 of the gutter's 20, so the name never reaches the
 * page and never touches the pane's top. It was drawn in page pixels, which
 * put its foot on the page's first row at any zoom under 1. The gutter was
 * raised to 28 for it once; that broke J's measured "much slimmer than the
 * sides" (`tests/full-page.mjs`, `tests/scroll-contract.mjs`), and the name
 * fits in the 20 he set.
 */
export const LABEL_LINE = 14;
export const LABEL_GAP = 4;
/** How far above the page's top a site part may start and still draw the page up to it (`DesktopCanvas#siteTop`); higher is overhang. */
export const SITE_TOP_MAX = 240;


/** The screen each device actually has, so the frame is a real viewport. */
export const SCREEN_H: Record<number, number> = { 1440: 900, 834: 1112, 390: 844 };
export const snapGrid = (v: number) => Math.round(v / GRID) * GRID;

/**
 * How near the eraser has to pass, in board pixels.
 *
 * "THE SAME GENEROSITY AS THE VINE." A vine gives a hand half of
 * `REACH_WIDTH` either side of itself to be caught by; the eraser was giving
 * ten, which is less than half of that, so a stroke he could see himself
 * passing over went by untouched.
 */
export const ERASE_REACH = REACH_WIDTH / 2;
export const MIN_W = 40;
export const MIN_H = 24;

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface Drag {
  kind: "node" | "marquee" | "pan" | "draw" | "resize" | "erase" | "group";
  startX: number;
  startY: number;
  ids?: string[];
  /** Where the hand was on the last move, so a sweep knows what it crossed. */
  lastX?: number;
  lastY?: number;
  /** Original rects at drag start, so positions are set absolutely (and snapped) each move. */
  origin?: Record<string, { x: number; y: number; w: number; h: number }>;
  points?: [number, number][];
  nodeId?: string;
  handle?: Handle;
  startPan?: { x: number; y: number };
  /** Where the pane was scrolled to when the hand went down. */
  startTop?: number;
  moved?: boolean;
  snapped?: boolean;
  /** A marquee begun on a part that holds others: released without a drag, that part is picked. */
  from?: string;
  /** Parts carried because a moving control holds them: they keep their place on it, never snapped on their own. */
  riders?: string[];
  /** A locked group being resized: its id, its box and its members as they were when the hand went down. */
  groupId?: string;
  box?: HeldBox;
  held?: Held[];
  /** The words of that resize wanted more (or less) than the renderer's clamp allows. */
  clamped?: "largest" | "smallest" | null;
}


export interface Guides {
  x: number[];
  y: number[];
}
