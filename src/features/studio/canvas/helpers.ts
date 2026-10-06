import { boardShows,screenLooks,screenPlaces,steppedParts,type PlaceBox,type ScreenRead,type StepLook } from "../boardStates";
import { stateFrames } from "../stateFrames";
import { REACH_WIDTH } from "../strand";
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
/** Each part's words and picture as the lit screens and the picked steps have them: a step's own win inside its part. */
export let looksMemo: { on: unknown; screens: unknown; files: unknown; nodes: unknown; looks: Map<string, StepLook> } | null = null;
export const NO_LOOKS = new Map<string, StepLook>();
export function looksOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[] }): Map<string, StepLook> {
  const on = s.statesOn ?? [];
  if (!on.length) return NO_LOOKS;
  const source = sourceOf(s);
  if (looksMemo && looksMemo.on === on && looksMemo.screens === source?.screens && looksMemo.files === source?.files && looksMemo.nodes === s.nodes) return looksMemo.looks;
  const looks = on.some((k) => k.startsWith("screen:")) ? screenLooks((s.nodes ?? []) as never, on, source?.screens, (file) => source?.files?.find((f) => f.file === file)?.pageId ?? null) : new Map<string, StepLook>();
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
  /* A part stepped on the board is read off the parts, so the parts count only then. */
  const steps = on.some((k) => k.startsWith("step:")) ? s.nodes ?? [] : null;
  if (shownMemo && shownMemo.on === on && shownMemo.screens === source?.screens && shownMemo.files === source?.files && shownMemo.nodes === steps) return shownMemo.shows;
  const shows = on.length ? boardShows(on, source?.screens, (file) => source?.files?.find((f) => f.file === file)?.pageId ?? null, steps ? stateFrames(steps) : null, steps ? steppedOnBoard(s).decide : null) : (n: StudioNode) => !n.state;
  shownMemo = { on, screens: source?.screens, files: source?.files, nodes: steps, shows };
  return shows;
}
/** Where a lit screen, or a part stepped through, draws its parts (`boardStates.ts#screenPlaces`, `#steppedParts`), kept while the states, screens and parts are the same. */
export let placedMemo: { on: unknown; screens: unknown; files: unknown; nodes: unknown; places: Map<string, PlaceBox> } | null = null;
export const NO_PLACES = new Map<string, PlaceBox>();
export function placedOnBoard(s: { statesOn?: string[]; look?: unknown; nodes?: StudioNode[] }): Map<string, PlaceBox> {
  const on = s.statesOn ?? [];
  const screensOn = on.some((k) => k.startsWith("screen:")), stepsOn = on.some((k) => k.startsWith("step:"));
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
  placedMemo = { on, screens: source?.screens, files: source?.files, nodes: s.nodes, places };
  return places;
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
