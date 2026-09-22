"use client";
/**
 * The board.
 *
 * A page frame sits at the origin — it IS the website's viewport, at the width
 * you pick — and parts render inside it as what they'll be, at the size
 * they'll be. Space outside the frame is scratch. Nothing "slips to fit":
 * where a part sits and how big it is in the frame is the specification.
 *
 * Drag snaps to the frame's edges and centre and to other parts' edges, with
 * guide lines while it happens. Tools: select, pen, region, arrow, erase, pan.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { getFeature, categoryOf } from "./catalog";
import { isLinkable } from "./parts";
import { useActions } from "@/core/actions";
import { Block, themeFrom } from "./blocks";
import { LiveSite, resolvePageLink } from "./live/LiveSite";
import { pictureOf } from "./reshapeRun";
import { REACH_WIDTH } from "./strand";
import { describeSketch } from "./sketch";
import { resolvePalette } from "./parts/theme";
import { AlignCenter, AlignLeft, AlignRight, StretchHorizontal, Scissors, Sparkles, Ungroup } from "lucide-react";
import { inkGroups, nearestTo, type InkGroup } from "./inkGroups";
import { CORNERS, handlePoints } from "./outlineHandles";
import { auraFilter, auraStyle, complementOf, markColour, washCss, type Light, type Palette, type TextureLayer } from "./look";
import { liftVars } from "./lightRig";
import { linkReason } from "./links";
import { TextureDrift } from "./TextureDrift";
import { CarriedFonts } from "./live/CarriedFonts";
import type { CarriedFont } from "./fonts";
import { SpaceForming, SpaceInk, SpaceMarks, SpaceRefused, SpaceSide } from "./SpaceLayer";
import { IMPORT_SETTLE_MS, useArrival, useImportPreview } from "./ImportFlow";
import { useBoxEntry } from "./boxEntry";
import { rasterFragment } from "./renderer";
import { isBoundary, spaceAtLine } from "./space";
import { Workspace } from "./Workspace";
import { BASE_ZOOM, BACKGROUND_ID, FIT_MIN } from "./store";
import {
  activePage, frameHeight, frameTopReach, groupBounds, pageGroups, pageNodes, pageShapes, pageSpaces, shapeBounds,
  useStudio, type StudioNode, type StudioShape,
} from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { openRadial, pageSpot } from "./RadialMenu";
import { useSettleToWords } from "./textFit";

const GRID = 8;

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
const HANDS_ON = new Set(["cube-3d", "mesh-3d"]);
/** Two presses this close together, on the same part, are one gesture. */
const DOUBLE_MS = 400;
/** …and they have to land within this many board pixels of each other. */
const DOUBLE_SLOP = 8;

/** Parts that wear a drawn icon when one is dropped on them. */
const WEARS_AN_ICON = new Set(["cta-primary", "quick-action", "follow"]);
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
const FRAME_GUTTER = 128;
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
const TOP_GUTTER = 20;


/** The screen each device actually has, so the frame is a real viewport. */
const SCREEN_H: Record<number, number> = { 1440: 900, 834: 1112, 390: 844 };
const snapGrid = (v: number) => Math.round(v / GRID) * GRID;

/**
 * How near the eraser has to pass, in board pixels.
 *
 * "THE SAME GENEROSITY AS THE VINE." A vine gives a hand half of
 * `REACH_WIDTH` either side of itself to be caught by; the eraser was giving
 * ten, which is less than half of that, so a stroke he could see himself
 * passing over went by untouched.
 */
const ERASE_REACH = REACH_WIDTH / 2;
const MIN_W = 40;
const MIN_H = 24;

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Drag {
  kind: "node" | "marquee" | "pan" | "draw" | "resize" | "erase";
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
}

interface Guides {
  x: number[];
  y: number[];
}

export function Canvas() {
  const ref = React.useRef<HTMLDivElement>(null);
  const news = useActions();
  /* A carried face that will not load is said, once per face, with why:
     silence about a substitute face is what made his headings wrap in
     one without anybody knowing. */
  const fontFailed = React.useCallback((f: CarriedFont) => {
    const where = f.source.kind === "data" ? "the file in the document" : f.source.kind === "link" ? f.source.href : f.source.url || "nowhere named";
    news.publish({
      key: `studio:font:${f.id}`,
      title: `${f.family} is not drawing`,
      body: `${f.says ?? `It could not be loaded from ${where}`}. Its parts show in the nearest face this machine has.`,
      level: "warn",
      source: "studio",
      toast: { durationMs: 9000 },
    });
  }, [news]);
  const nodes = useStudio(useShallow(pageNodes));
  /*
   * A BOX THAT GREW MOVES WHAT FOLLOWS IT, WHENEVER IT GROWS.
   *
   * The floor in `parts/primitives.tsx` keeps a box's words visible by
   * letting it draw taller than the document says; nothing moved what sat
   * under it unless a flex parent happened to be doing the moving, and on
   * his captured Documentation page twenty-one pairs of parts crossed each
   * other because of it. The arithmetic already existed and ran once, at
   * the end of one import; it is kept up here instead. Captured parts only,
   * and a board with nothing captured on it never settles at all.
   * See `useSettleToWords`.
   */
  useSettleToWords(nodes, React.useCallback((f) => useStudio.getState().settleToWords(f), []));
  const shapes = useStudio(useShallow(pageShapes));
  /* Read here rather than off `getState()` in a handler, because the page's
     own height depends on it: a space drawn below the last part makes the
     page taller and the board must re-render when it does. */
  const spaces = useStudio(useShallow(pageSpaces));
  /*
   * Which strokes are one drawing.
   *
   * The door hangs on the drawing, not on the stroke: a bird is fifteen
   * strokes and one part, and before this every stroke grew its own button.
   */
  const drawings = React.useMemo(() => inkGroups(shapes.filter((sh) => sh.kind === "pen")), [shapes]);
  const groups = useStudio(useShallow(pageGroups));
  const page = useStudio(activePage);
  const selection = useStudio((s) => s.selection);
  const tool = useStudio((s) => s.tool);
  /*
   * `zoom` here is the *applied* scale, not the number in the bar.
   *
   * The bar's readout is nominal and the board is drawn at nominal times
   * `BASE_ZOOM`, so that the size J works at reads as 100%. Every use of
   * `zoom` below — the transform, turning a pointer into board coordinates,
   * the hit thresholds, and the 1/zoom counter-scaling that keeps a chip the
   * same size however far in you are — wants the applied one, so the
   * multiplication happens once, here, and nothing downstream has to know.
   */
  const nominalZoom = useStudio((s) => s.zoom);
  const zoom = nominalZoom * BASE_ZOOM;
  const pan = useStudio((s) => s.pan);
  /**
   * Is the hand making a boundary rather than laying down ink?
   *
   * Two doors reach the same place — the shape tool, and the pen once
   * "surface" has been chosen — so the question is asked once here and both
   * the dashed line and the `addSpace` below read the same answer.
   */
  const drawKind = useStudio((s) => s.drawKind);
  const makingASpace = tool === "space" || (tool === "pen" && drawKind === "surface");
  const inkHue = useStudio((s) => s.inkHue);
  const inkWidth = useStudio((s) => s.inkWidth);
  const frameWidth = useStudio((s) => s.frameWidth);
  const showWires = useStudio((s) => s.showWires);
  const fitNonce = useStudio((s) => s.fitNonce);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const theme = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
  const wash = React.useMemo(() => washCss(look.light), [look.light]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const pageMark = React.useMemo(() => complementOf(theme.backdrop), [theme.backdrop]);
  /* The frame being chosen in Import, if one is. Not in the document and
     not in the undo history — a preview is not an edit. */
  const importing = useImportPreview();
  /*
   * One height, where there were two.
   *
   * It had been two: `pageH` for the site and `frameH` for one screen of it,
   * with the site sliding behind the frame's edge as the wheel turned — a
   * window the shape of a visitor's viewport. J has asked for the opposite
   * and was specific about it: hovering the site and scrolling should move
   * down the entire length of the site, the whole of it rendered, *not*
   * scrolling within the same web frame. A window is a boundary, and he does
   * not want one.
   *
   * So the frame is the whole site again, as tall as the last part reaches,
   * and what moves is the surface it stands on — the pane in `StudioPage`.
   * There is no scrollbox inside the frame and no bar on it.
   *
   * The window existed for a reason worth recording, because it is the thing
   * that has to stay solved: a site that grows downwards used to push the
   * parts shelf below the workspace's horizon. It still goes below on a long
   * page — J asked for exactly that, one gesture "on into the categories" —
   * but it is in the same scroller as the board rather than below a second
   * one, so it is where carrying on takes you, and on a page that fits it
   * has not moved at all.
   *
   * A stock viewport height is still the floor, so an empty page is a page
   * rather than a sliver.
   */
  const stock = SCREEN_H[frameWidth] ?? Math.round(frameWidth * 0.625);
  /* Everything the page draws, not only its parts: ink and drawn spaces
     reach below the last part and the window is sized from this. */
  const [drag, setDrag] = React.useState<Drag | null>(null);
  /*
   * The page's height does not follow a hand.
   *
   * It is `the lowest thing on the page, plus 160`, which shrink-wraps the
   * content with no slack in it: every pixel a part is dragged downward is
   * a pixel the page grows. That is fine as an answer and wrong as a live
   * one, and J caught both halves of what it does. The preview box resizes
   * under the hand — measured at a 1267x1354 window, one part dragged 240px
   * down took the page from 1960 to 2197 while the button was still held.
   * And the shelf, which is under the board in the same scroller, is pushed
   * down by exactly as much: 1456 to 1606, with the pane's travel going 349
   * to 499. Moving a part said how big the site is and where the categories
   * sit, and it should only ever have said where the part is.
   *
   * The timeline does not do it, which is the clue that narrowed it: it is
   * in the same pane but it is `h-full`, so it never grows and the band
   * below it never moves.
   *
   * So the height is held still for as long as something is being moved,
   * and settles when the hand comes off. Held in a ref rather than state
   * because it is derived — reading it must not cause the render that
   * would change it.
   */
  const wanted = Math.max(stock, frameHeight(nodes, 900, { shapes, spaces }));
  const settled = React.useRef(wanted);
  /* A drag that moves or resizes something. A pan is not one: it changes
     nothing about the document, so there is nothing to hold still. */
  const handOn = drag?.kind === "node" || drag?.kind === "resize";
  if (!handOn) settled.current = wanted;
  const pageH = handOn ? settled.current : wanted;
  /* The foot a snap aims at: the one on screen, held still for the length of
     a drag by the same ref the frame is drawn from. */
  const settledH = pageH;
  const frameH = pageH;
  /* Nothing scrolls inside the frame, and nothing pans down the ground:
     the pane does it. */
  /*
   * The board is as tall as the site it is showing.
   *
   * This is the measurement the last two attempts missed, and it is worth
   * stating as a number because it is checkable. The board's root was
   * `size-full`: it took the pane's height, whatever the site's height was,
   * and clipped. Measured at a 1267×1278 window with six parts on the page:
   * the root was 943 tall with 1841 of site in it — 898px of the page that
   * no gesture could reach — and the pane it stood in had a scrollHeight
   * equal to its clientHeight, so the pane did not scroll at all. What moved
   * was the board *inside* the root: a pan in a window, which is the box J
   * keeps reporting.
   *
   * So the root is the site's own drawn height plus the ground above and
   * below it, and the pane is what scrolls. The two numbers that say it
   * worked: the root's height is the site's rendered height plus a gutter,
   * and the pane's scrollHeight is that plus the shelf.
   */
  /*
   * Room above the page for anything drawn up there.
   *
   * Almost always zero. The page keeps its origin — y=0 is the site's top
   * and moving it would renumber the document — so when somebody draws
   * above the page the *board* grows to hold it instead. Without this a
   * stroke at y -520 sat 265px above the board's own top: uncut, since the
   * page stopped clipping, and still unreachable, because a scroller only
   * ever travels down. Sideways needs none of this: the board pans across,
   * so a thing off the left is a pan away rather than lost.
   */
  const above = Math.round(frameTopReach({ shapes, spaces }) * zoom);
  const boardH = Math.round(pageH * zoom) + TOP_GUTTER + above;

  /*
   * Growing the surface upward must not move what you are looking at.
   *
   * `above` changes the moment a stroke crosses the page's top edge, and
   * everything below it shifts down by that much. Left alone, the page
   * jumps out from under the hand mid-stroke. The pane is scrolled by the
   * same amount in the same frame, so the ground appears where it was and
   * only the room above it is new.
   */
  const grown = React.useRef(above);
  React.useLayoutEffect(() => {
    const step = above - grown.current;
    grown.current = above;
    /*
     * Only while a hand is on the board.
     *
     * This exists for one moment: a stroke crossing the page's top edge
     * mid-draw, where the ground must not jump out from under the hand. It
     * was firing on load as well — the document hydrates after the first
     * paint, so `above` goes from nothing to its real size in a step or two
     * and the pane was nudged for each — and a Builder that opens 355px
     * down its own scroll is in the one place it must never be. A guard
     * that skipped the first step only halved it; the honest condition is
     * whether anybody is actually drawing.
     */
    if (!step || !drag) return;
    const pane = ref.current?.closest("[data-studio-pane]");
    if (pane instanceof HTMLElement) pane.scrollTop += step;
  }, [above]);


  /* `data-board-drag` used to be set here for the length of a drag, and the
     ground held still while it was. The ground does not stop for anything
     now — the pause was paying for a per-frame cloud repaint that no longer
     exists — so nothing reads the flag and nothing writes it. */
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ink, setInk] = React.useState<[number, number][] | null>(null);
  // The last line that was not a closed one, so the board can say so where it was drawn.
  const [refused, setRefused] = React.useState<{ points: [number, number][]; at: number } | null>(null);
  // A wire that has just joined two parts: the wire draws itself on and
  // both parts ring once. Kept for half a second, then forgotten.
  const [fresh, setFresh] = React.useState<{ wire: string; nodes: string[] } | null>(null);
  React.useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => setFresh(null), 700);
    return () => window.clearTimeout(t);
  }, [fresh]);
  const [guides, setGuides] = React.useState<Guides>({ x: [], y: [] });

  /** The scroller the board stands in — the one thing that moves down. */
  const paneOf = React.useCallback(() => {
    const pane = ref.current?.closest("[data-studio-pane]");
    return pane instanceof HTMLElement ? pane : null;
  }, []);
  const paneTop = React.useCallback(() => paneOf()?.scrollTop ?? 0, [paneOf]);

  /** Screen → canvas coordinates. */
  /*
   * THE EDGE SCROLL.
   *
   * His words: "when i move an element up the website it should scroll for me
   * as i reach the boundary as well as downward". Measured before this: held
   * still against the foot of the pane with a part in hand, the pane went
   * 0 -> 0. There was no edge scroll in either direction.
   *
   * It is a loop rather than something done on each pointer move, because the
   * hand is *still* when it is against an edge \u2014 there are no more moves to
   * hang it off. Each tick nudges the pane and then re-applies the drag at the
   * same point on screen: the board's box moves with the pane's scroll, so the
   * same screen point maps a little further down the page each time and the
   * part travels with it, staying under the hand.
   */
  const handAt = React.useRef<{ x: number; y: number } | null>(null);
  const dragRef = React.useRef(drag);
  dragRef.current = drag;
  const carryRef = React.useRef<((x: number, y: number) => void) | null>(null);
  /**
   * The last press on a part, so a second press on the same one can be told
   * from a first.
   *
   * A pointer event carries no click count — `detail` is 0 on every
   * `pointerdown` by spec — and the `dblclick` that does carry one is
   * delivered to whatever captured the pointer, which is the board, never
   * the part. So the two presses are timed here.
   */
  const pressed = React.useRef<{ id: string; at: number; x: number; y: number } | null>(null);

  const toCanvas = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      /* `rect` is the board's own box in the window, so the pane's scroll is
         already in it: there is nothing to add for how far down we are. */
      return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - TOP_GUTTER - above) / zoom };
    },
    [pan.x, zoom, above],
  );

  /* ---------------------------------------------------- fit the frame
   *
   * TWO QUANTITIES, AND THEY ARE NOT THE SAME ONE.
   *
   * The page's SIZE is set by its content. It grows downward and outward to
   * hold everything drawn on it, and that is `pageH` and `frameTopReach`
   * above — a rule that took three goes to land and is not traded for
   * anything. Nothing here touches it.
   *
   * The ZOOM is set by the pane's WIDTH, and by nothing else. The page picks
   * a zoom so its width plus the gutter fits across, and if the page is then
   * taller than the pane the pane scrolls down over it at a size a person
   * can read.
   *
   * THE HEIGHT MUST NEVER BIND, and this is the third time round on it, so
   * the reasoning is written down rather than the answer. Fitting the height
   * too is superficially the same rule said twice, and it is not: the page's
   * height is its content's, so a height fit makes the zoom a function of
   * how much is on the page. Measured on the deploy with a 1440×2224 page in
   * a 1509×1191 pane — page window 567×899, a third of its size, every part
   * on screen at once and none of them readable, `scrollHeight` 2285 against
   * a `clientHeight` of 2285 and nothing to scroll. Adding one element low
   * on the page shrank everything already on it. A site is not a diagram and
   * is not meant to be seen all at once.
   *
   * What the height fit was reaching for was a real rule — he must never
   * load in unable to see the categories — and that rule has its own
   * mechanism now and does not need this one: the shelf's band is stuck to
   * the pane's bottom (`sticky bottom-0` in `StudioPage`), so the categories
   * are on screen from the first frame at any page length, and the site runs
   * up behind them as you scroll.
   */
  const fitZoom = React.useCallback(
    (vw: number) => {
      /* Across, and only across: the frame's two side edges on screen with a
         gutter either side. In nominal terms, because that is what the store
         holds — the width is divided by the base so the *drawn* frame is
         what is being fitted. */
      return Math.max(FIT_MIN, Math.min(1, (vw - FRAME_GUTTER) / (frameWidth * BASE_ZOOM)));
    },
    [frameWidth],
  );

  /*
   * What the frame was last fitted for: every input to the fit, not only the
   * pane's width. The height matters now, and so does the page's own grown
   * size — a part dropped at the foot of the page makes the page taller and
   * the fit has to answer that the same way it answers a narrower window.
   * If all of them are as they were, the fit is current; if any has moved,
   * the fit is stale, whoever failed to say so.
   */
  const fittedFor = React.useRef<string | null>(null);
  /* The fit's one input, so the whole of what has to be remembered. It was
     a composite while the height bound too; a page that grows no longer
     changes the zoom, so a page that grows must not re-fit. */
  const fitKey = (pane: Element) => String(pane.clientWidth);

  const fitTo = React.useCallback((pane: Element) => {
    const vw = pane.clientWidth;
    if (!vw) return;
    const z = fitZoom(vw);
    /* Centred on the frame as *drawn*, which is `z` times the base and not
       `z`. Centring on the nominal size put a 1.21× frame in a 1× gap and
       hung it off the right of the pane — `board-layout` caught it: "frame
       324,149 677×437 in 752×733". */
    const drawn = z * BASE_ZOOM;
    /* Only across. Down is the gutter, and the gutter is a constant. */
    const x = Math.round((vw - frameWidth * drawn) / 2);
    const store = useStudio.getState();
    if (store.zoom !== z) store.setFitZoom(z);
    if (store.pan.x !== x || store.pan.y !== 0) store.setPan({ x, y: 0 });
    /*
     * Last, and that ordering is the fix rather than a detail.
     *
     * The version this replaces wrote the width down *before* fitting, in
     * the observer's own callback: `was = pane.clientWidth; apply()`. A
     * throw anywhere inside `apply` — and a throw inside a ResizeObserver
     * callback is swallowed by the browser, with nothing in the console and
     * nothing on the page — left the new width recorded and the fit undone,
     * so the next notification for that width was discarded as already
     * handled and the frame kept the zoom it had for ever. That is the
     * exact shape of what J is seeing, and it is unfalsifiable from here
     * because it leaves no trace. Written in this order the memory is only
     * ever of a fit that actually happened, so a fit that fails is retried
     * by the next render rather than remembered as done.
     */
    fittedFor.current = fitKey(pane);
  }, [fitZoom, frameWidth]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /*
     * Watch the pane, not the board.
     *
     * The board's own height is a function of the zoom now, so a board that
     * watched itself would fit, grow, notice it had grown, and fit again —
     * and a person zooming in would be zoomed back out by their own gesture.
     * The pane is the thing whose shape is an instruction.
     */
    const pane = el.closest("[data-studio-pane]") ?? el.parentElement ?? el;
    const apply = () => {
      fitTo(pane);
      if (pane instanceof HTMLElement) pane.scrollTop = 0;
    };
    apply();
    /*
     * The frame's width is the pane's width less a gutter, so a pane that
     * changes width is a frame that changes width. Its *height* changing is
     * the shelf or the window growing, which the fit has no opinion about.
     *
     * Two witnesses to the same event, and a third below. J reported, off
     * the deploy, a frame keeping the zoom it had been fitted at for a 1509
     * pane while the pane was 772 — 1381 wide in 772 of room, 673 of the
     * site off the right edge. His pane widths are this layout's to the
     * pixel at all three of his window sizes, so the only thing that
     * differed was the zoom, and 1381 is exactly this fit at his widest.
     * The shape of it is a fit that ran once and never again.
     *
     * IT HAS NOT BEEN REPRODUCED HERE, and that is worth writing down
     * rather than papering over: not in dev, not in a clean production
     * build, not on a fresh load at 1000, 1300 or 1737, not through the
     * metrics override, not through a real window resize over CDP, not
     * through a fifty-pixel drag of the edge from 1700 to 950, not with the
     * tab hidden, not after a hand zoom, not after the frame-width keys,
     * and not across a Preview or a Finish round trip. Every one of those
     * tracked the pane.
     *
     * So these are not a diagnosis. They are three independent ways of
     * noticing the same thing, on the reasoning that a fault whose shape is
     * "the one notifier did not fire" is answered by not having one
     * notifier.
     */
    const again = () => { if (fitKey(pane) !== fittedFor.current) apply(); };
    const ro = new ResizeObserver(again);
    ro.observe(pane);
    window.addEventListener("resize", again);
    /*
     * And one that is not told anything at all.
     *
     * The render-time check below was written as this third witness and it
     * is not one on its own: a render happens because something changed, and
     * a notification that goes missing changes nothing, so nothing renders
     * and nothing looks. Measured — with the observer's notification dropped
     * and the window's resize event taken away, the page sat 609px too wide
     * for two and a half seconds and would have sat there for ever.
     *
     * So the last witness is a clock. Four hundred milliseconds, one integer
     * read, and a comparison: well inside the second J asks the fit to come
     * right in, and nothing at all when the width has not moved, which is
     * almost always. `clientWidth` on an idle page whose layout is clean is
     * a read, not a reflow, and the cost was measured against a build that
     * does not have it — the deployment, put behind a local mirror — rather
     * than asserted: the Builder idle for three seconds, 60.2 fps there and
     * 60.3 here, no long tasks on either side.
     */
    const tick = window.setInterval(again, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", again);
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce, frameWidth, fitZoom, fitTo]);

  /*
   * A page you have not seen starts at its top.
   *
   * The pane is one scroller for whichever page is on the board, so going
   * from one to another left the new one at the old one's scrollTop: with
   * five screens on each, switching from the home page 437px down landed
   * 437px down a page nobody had looked at yet. J's rule for anywhere that
   * is not the home page is downward movement only, and arriving part-way
   * down is not the top of that movement.
   *
   * Only on a change of page, so it cannot fight a person's own scrolling,
   * and in a layout effect so the new page is never painted at the old
   * offset first.
   */
  const pageId = page?.id ?? null;
  const cameFrom = React.useRef(pageId);
  React.useLayoutEffect(() => {
    if (cameFrom.current === pageId) return;
    cameFrom.current = pageId;
    const pane = ref.current?.closest("[data-studio-pane]");
    if (pane instanceof HTMLElement) pane.scrollTop = 0;
  }, [pageId]);

  /*
   * And the same comparison at render time, which is free and catches the
   * case a moment sooner than the clock would: the pane's width against the
   * width the frame was fitted for. A render happens for a hundred reasons
   * and the comparison is two numbers; if they agree, which is almost
   * always, it does nothing. On its own it is not a witness — see the clock
   * above for why — but beside one it costs nothing to keep.
   *
   * The condition is the *pane's width*, deliberately, and not whether the
   * frame overruns the pane. Those are different rules and only one of them
   * is right. A person who has zoomed in has asked for a frame wider than
   * the room — the board pans across, so nothing is out of reach — and
   * snapping that back would make the zoom-in key do nothing at all, which
   * is a fault of its own and one I caught this way: four presses took the
   * frame to 2022 in a 1509 pane, and the first version of this undid every
   * one of them. Only a pane that has changed width since the fit is stale,
   * and only a stale fit is put right.
   */
  React.useLayoutEffect(() => {
    const pane = ref.current?.closest("[data-studio-pane]");
    if (!(pane instanceof HTMLElement)) return;
    if (!pane.clientWidth || fitKey(pane) === fittedFor.current) return;
    fitTo(pane);
  });

  /* ------------------------------------------------------------- wheel */
  /*
   * The wheel is not handled here at all, down the page.
   *
   * Three goes at this, and the first two both ended in the same place: a
   * gesture that moved something *inside* a fixed box. First the site slid
   * behind the frame's edge; then the board panned under a `size-full` root.
   * Both are a scrollbox with the bar turned off, and both stop somewhere
   * that is not the end of the page.
   *
   * The board is as tall as the site now and stands in a pane that scrolls,
   * so the browser's own scroll is the whole mechanism: one gesture runs
   * from the head of the site, down every part of it, and on into the
   * categories below, because they are all in the same scroller. Nothing to
   * clamp, nothing to hand over, no floor to compute.
   *
   * What is left here is the two gestures that are not a scroll: zoom, and
   * moving the board *across* the ground, which has no scroller to fall to.
   */
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const store = useStudio.getState();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const floor = 0.2;
        store.setZoom(Math.max(floor, store.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
        return;
      }
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        store.setPan({ x: store.pan.x - e.deltaX, y: store.pan.y });
        return;
      }
      /* Down the page is the pane's, untouched: no preventDefault, no
         clamp, no handover. Falling through to the browser is the fix. */
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---------------------------------------------------------------- drop */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    /*
     * A PICTURE DRAGGED OFF THE GENERATE PANEL, AT THE SIZE IT REALLY IS.
     *
     * HIS WORDS: "the output should also be draggable off the output image
     * onto the web design 1 to 1". So the drag carries the picture's own
     * pixel size and the board uses it rather than guessing a box — one to
     * one is the point, and a picture landed in a default rectangle is a
     * picture that has been resized on the way in.
     *
     * It gives back proportionally when it is wider than the page, because
     * the alternative is a part standing off both edges, and it lands as an
     * ordinary Picture part he can select, move and resize like any other:
     * nothing generated is ever baked into the page behind his back.
     */
    const dropped = e.dataTransfer.getData("application/x-studio-picture");
    if (dropped) {
      try {
        const pic = JSON.parse(dropped) as { src?: string; w?: number; h?: number };
        if (pic.src) {
          const p0 = toCanvas(e.clientX, e.clientY);
          const natural = { w: Math.max(1, pic.w || 512), h: Math.max(1, pic.h || 512) };
          const scale = Math.min(1, frameWidth / natural.w);
          const w = Math.round(natural.w * scale);
          const h = Math.round(natural.h * scale);
          const id = useStudio.getState().addNode("picture", snapGrid(p0.x - w / 2), snapGrid(p0.y - h / 2), { w, h });
          useStudio.getState().updateNode(id, {
            label: "Picture",
            /* The same record any rendered body carries, so the part is an
               ordinary one: it publishes, exports and edits like the rest. */
            code: { html: rasterFragment(pic.src), overlap: 1, attempts: 1, at: Date.now(), source: "renderer", kind: "raster" },
          });
          play("confirm");
          haptic();
        }
      } catch { /* not ours after all */ }
      return;
    }
    const featureId = e.dataTransfer.getData("application/x-studio-feature");
    if (!featureId) return;
    const p = toCanvas(e.clientX, e.clientY);
    const feature = getFeature(featureId);
    const w = feature?.w ?? 420;
    const h = feature?.h ?? 88;
    // Full-width parts land flush; everything else lands centred on the cursor.
    const x = w >= frameWidth ? 0 : snapGrid(p.x - w / 2);
    useStudio.getState().addNode(featureId, x, snapGrid(p.y - h / 2), { w: Math.min(w, frameWidth), h });
    play("confirm");
    haptic();
  };

  /* ---------------------------------------------------------- snapping */
  const snapSelection = React.useCallback(
    (rects: { x: number; y: number; w: number; h: number }[], ids: Set<string>) => {
      const thr = 6 / zoom;
      const left = Math.min(...rects.map((r) => r.x));
      const right = Math.max(...rects.map((r) => r.x + r.w));
      const top = Math.min(...rects.map((r) => r.y));
      const bottom = Math.max(...rects.map((r) => r.y + r.h));
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      const xs = [0, frameWidth / 2, frameWidth];
      /*
       * The page has a foot, and it is a target like any other edge.
       *
       * This was `[0]` — the top and nothing else — while the sides had left,
       * middle and right. His words: "i should be able to snap to bottom like
       * i can the top and sides." It is the settled height rather than the
       * wanted one, so what he snaps to is the foot he can see while his hand
       * is still down, not one recomputed from where the part has got to.
       */
      const ys = [0, settledH / 2, settledH];
      for (const n of nodes) {
        if (ids.has(n.id)) continue;
        xs.push(n.x, n.x + n.w / 2, n.x + n.w);
        ys.push(n.y, n.y + n.h / 2, n.y + n.h);
      }
      let dx = 0;
      let dy = 0;
      let bestX = thr;
      let bestY = thr;
      const gx: number[] = [];
      const gy: number[] = [];
      for (const c of xs) {
        for (const edge of [left, cx, right]) {
          const d = c - edge;
          if (Math.abs(d) < bestX) {
            bestX = Math.abs(d);
            dx = d;
            gx.length = 0;
            gx.push(c);
          }
        }
      }
      for (const c of ys) {
        for (const edge of [top, cy, bottom]) {
          const d = c - edge;
          if (Math.abs(d) < bestY) {
            bestY = Math.abs(d);
            dy = d;
            gy.length = 0;
            gy.push(c);
          }
        }
      }
      return { dx, dy, guides: { x: gx, y: gy }, snapped: gx.length > 0 || gy.length > 0 };
    },
    [nodes, zoom, frameWidth, settledH],
  );

  /**
   * Put the parts in hand where the hand is, snapped.
   *
   * Pulled out of the move handler so the edge scroll can call it with the
   * hand standing still: the scroll changes what a fixed point on screen
   * means in the page, so the same call carries the part along with it.
   */
  const carry = React.useCallback((dx: number, dy: number) => {
    const d = dragRef.current;
    if (!d || d.kind !== "node" || !d.ids?.length || !d.origin) return;
    const ids = new Set(d.ids);
    const rects = d.ids.map((id) => ({ ...d.origin![id]!, x: d.origin![id]!.x + dx, y: d.origin![id]!.y + dy }));
    const snap = snapSelection(rects, ids);
    const positions: Record<string, { x: number; y: number }> = {};
    for (const id of d.ids) positions[id] = { x: Math.round(d.origin![id]!.x + dx + snap.dx), y: Math.round(d.origin![id]!.y + dy + snap.dy) };
    useStudio.getState().setPositions(positions);
    setGuides(snap.guides);
    setDrag({ ...d, moved: true, snapped: snap.snapped });
  }, [snapSelection]);

  carryRef.current = (clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toCanvas(clientX, clientY);
    carry(p.x - d.startX, p.y - d.startY);
  };

  /*
   * How near an edge counts, and how fast it goes there.
   *
   * A band rather than a line, so it starts gently as he approaches and is at
   * full speed only when he is right up against it \u2014 an edge scroll that
   * comes on like a switch throws the page past where he was aiming.
   */
  const EDGE_BAND = 64;
  const EDGE_TOP_SPEED = 22;

  React.useEffect(() => {
    const moving = drag?.kind === "node";
    if (!moving) { handAt.current = null; return; }
    let frame = 0;
    const tick = () => {
      const pane = ref.current?.closest("[data-studio-pane]");
      const at = handAt.current;
      if (pane instanceof HTMLElement && at) {
        const box = pane.getBoundingClientRect();
        const overTop = EDGE_BAND - (at.y - box.top);
        const overFoot = EDGE_BAND - (box.bottom - at.y);
        const push = overFoot > 0 ? overFoot : overTop > 0 ? -overTop : 0;
        if (push) {
          const step = Math.sign(push) * Math.min(EDGE_TOP_SPEED, (Math.abs(push) / EDGE_BAND) * EDGE_TOP_SPEED);
          const was = pane.scrollTop;
          pane.scrollTop = Math.max(0, Math.min(pane.scrollHeight - pane.clientHeight, was + step));
          /* Only when the pane actually moved: at either end there is nothing
             to follow, and re-applying the carry would jitter the part. */
          if (pane.scrollTop !== was) carryRef.current?.(at.x, at.y);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [drag?.kind]);

  /* ------------------------------------------------------------- pointer */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const p = toCanvas(e.clientX, e.clientY);
    const target = e.target as HTMLElement;
    const nodeEl = target.closest?.("[data-node-id]") as HTMLElement | null;
    const handleEl = target.closest?.("[data-resize]") as HTMLElement | null;
    const store = useStudio.getState();
    const capture = () => (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    /* The cursor pans, so there is no pan tool.
     *
     * Which drag you get is decided by what is under the hand, not by a mode
     * chosen in the bar: the bare ground outside the page pushes the view,
     * a part moves, and empty space *inside* the page still draws a marquee.
     * The nebula is the ground you push; the page is the surface you select
     * on. Alt-drag and the middle button still pan from anywhere, including
     * over the page, for the times the rule is not what you wanted.
     *
     * A wire or a drawing is on the page too, even though it is a sibling of
     * `[data-frame]` rather than a child of it — same reason parts are:
     * `closest("[data-frame]")` alone would call a press on one "bare
     * ground" and start a pan instead of ever reaching the shape it landed
     * on. */
    const onBareGround = tool === "select" && !nodeEl && !target.closest?.("[data-frame]") && !target.closest?.("[data-shape-id]");
    if (e.button === 1 || (tool === "select" && e.altKey) || onBareGround) {
      // Pushing the ground used to be a marquee from nothing, which cleared
      // the selection the moment it started. It is a pan now, but a press on
      // bare ground still means "away from what I had," whether or not the
      // hand goes on to move — so the clear stays, and only here: an
      // alt-drag or a middle-button pan is a deliberate override starting
      // from anywhere, including over a part you mean to keep selected.
      if (onBareGround && !e.shiftKey) store.clearSelection();
      capture();
      setDrag({ kind: "pan", startX: e.clientX, startY: e.clientY, startPan: pan, startTop: paneTop() });
      return;
    }

    // A resize handle only wins while you are actually pointing at things.
    // With the pen in hand you are drawing, and a handle that happens to be
    // under the first pixel of the stroke is not an instruction.
    if (handleEl && nodeEl?.dataset.nodeId && tool === "select") {
      const n = store.nodes.find((x) => x.id === nodeEl.dataset.nodeId);
      if (n) {
        capture();
        setDrag({ kind: "resize", startX: p.x, startY: p.y, nodeId: n.id, handle: handleEl.dataset.resize as Handle, origin: { [n.id]: { x: n.x, y: n.y, w: n.w, h: n.h } } });
      }
      return;
    }

    if (tool === "select") {
      if (nodeEl?.dataset.nodeId) {
        const id = nodeEl.dataset.nodeId;
        const node = store.nodes.find((n) => n.id === id);
        let ids = store.selection;
        if (e.shiftKey) {
          store.toggleSelection(id);
          ids = useStudio.getState().selection;
        } else if (!ids.includes(id)) {
          ids = node?.groupId ? store.nodes.filter((n) => n.groupId === node.groupId).map((n) => n.id) : [id];
          store.setSelection(ids);
        }
        play("select");
        /*
         * The second press opens a solid for handling.
         *
         * A cube is a thing you turn, and turning it is a drag across it —
         * the same gesture that moves every other part on the board. That
         * collision is what he found: "once i selected something i have to
         * click off and then clicck and hold to drag." So the two gestures
         * are told apart by how many presses they start with. One press
         * selects and moves, like everything else. Two says "I am turning
         * this one", and from then until the ground is pressed the part has
         * the pointer and the keys.
         *
         * It is read off the press itself rather than from a `dblclick`
         * handler on the part: the board captures the pointer, so the
         * click that follows is delivered to the board and never reaches
         * the part at all.
         */
        const last = pressed.current;
        const again = !!last && last.id === id && e.timeStamp - last.at < DOUBLE_MS && Math.hypot(p.x - last.x, p.y - last.y) < DOUBLE_SLOP;
        pressed.current = { id, at: e.timeStamp, x: p.x, y: p.y };
        if (again && node && !node.locked && HANDS_ON.has(node.featureId) && ids.length === 1) {
          store.hold(id);
          return;
        }
        /*
         * A BUTTON IN THE BUILDER IS PRESSABLE IN THE BUILDER.
         *
         * His words: a button should be pressable here and take him to the
         * page it links to. His captured sidebar carries nine pages he could
         * only reach from the tab bar, which makes a correct import feel
         * dead.
         *
         * The SAME gesture as opening a solid, deliberately — one press
         * selects and moves, two say "I mean this one" — because he is one
         * person learning one tool and a second way to press things would
         * cost him more than it buys. A solid opens for handling; a part
         * that points somewhere goes there. Nothing else on the board takes
         * a press, so the board stays a layout surface.
         *
         * Only a part that reads its own link (`isLinkable`), and only when
         * it has one: a double press on anything else still falls through to
         * the drag below, exactly as it did.
         */
        if (again && node && !node.locked && ids.length === 1 && node.link && isLinkable(node.featureId)) {
          const link = node.link;
          if (link.kind === "url") {
            play("confirm");
            window.open(link.target, "_blank", "noopener");
            return;
          }
          if (link.kind === "node") {
            const to = store.nodes.find((n) => n.id === link.target);
            if (to) { play("select"); store.setSelection([to.id]); }
            return;
          }
          /* By id or by name, the way the live page resolves it, so the
             board and the site cannot disagree about where a link goes. */
          const to = resolvePageLink(store.pages, link.target);
          if (to) { play("confirm"); store.setActivePage(to.id); }
          else news.publish({ key: `studio:link:${id}`, title: "That link points at no page", body: `Nothing here is called “${link.target}” yet.`, level: "warn", source: "studio", toast: { durationMs: 6000 } });
          return;
        }
        capture();
        const origin: Drag["origin"] = {};
        for (const n of store.nodes) if (ids.includes(n.id)) origin[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h };
        setDrag({ kind: "node", startX: p.x, startY: p.y, ids, origin });
        return;
      }
      // Drawings, regions and wires select on click too — not only by marquee.
      const shapeEl = target.closest?.("[data-shape-id]") as SVGElement | HTMLElement | null;
      const shapeId = shapeEl?.dataset?.shapeId;
      if (shapeId && shapeId !== "live") {
        if (e.shiftKey) store.toggleSelection(shapeId);
        else store.setSelection([shapeId]);
        play("select");
        return;
      }
      // The page itself is a thing you can pick: a press on the bare frame
      // selects the background, and a drag from there is still a marquee.
      if (!e.shiftKey) {
        if (target.closest?.("[data-frame]")) { store.setSelection([BACKGROUND_ID]); play("select"); }
        else store.clearSelection();
      }
      capture();
      setDrag({ kind: "marquee", startX: p.x, startY: p.y });
      return;
    }

    if (tool === "erase") {
      // A press erases what is under it — a drawing first, else a part. Then
      // the hold is a sweep: everything drawn that the pointer passes over
      // goes too, and the whole sweep is one step back for undo.
      const shapeEl = target.closest?.("[data-shape-id]") as HTMLElement | null;
      const near = hitShape(shapes, p.x, p.y, 10 / zoom);
      let took = true;
      if (shapeEl?.dataset.shapeId && shapeEl.dataset.shapeId !== "live") store.removeShapes([shapeEl.dataset.shapeId]);
      else if (near) store.removeShapes([near.id]);
      else if (nodeEl?.dataset.nodeId) store.removeNodes([nodeEl.dataset.nodeId]);
      else if (spaceAtLine(pageSpaces(store), p.x, p.y, 10 / zoom)) store.removeSpaces([spaceAtLine(pageSpaces(store), p.x, p.y, 10 / zoom)!.id]);
      else took = false;
      if (took) play("deny");
      capture();
      // `moved` here means "a history step has been written": a press that
      // took something wrote one, and the sweep joins it; a press on nothing
      // leaves it to the sweep's first hit.
      setDrag({ kind: "erase", startX: p.x, startY: p.y, moved: took });
      return;
    }

    capture();
    setRefused(null);
    setInk([[p.x, p.y]]);
    setDrag({ kind: "draw", startX: p.x, startY: p.y, points: [[p.x, p.y]] });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    /* Where the hand is, in window terms, for the edge scroll to read while
       it is standing still. */
    handAt.current = { x: e.clientX, y: e.clientY };
    const store = useStudio.getState();

    if (drag.kind === "pan") {
      /*
       * Across moves the board; down scrolls the pane.
       *
       * Dragging the ground upward and wheeling upward have to arrive at the
       * same place, and only one of them can own the vertical — so the drag
       * hands it to the same scroller the wheel falls through to. `startTop`
       * is where that scroller was when the hand went down, so a drag that
       * turns round returns to where it started rather than drifting.
       */
      store.setPan({ x: (drag.startPan?.x ?? 0) + (e.clientX - drag.startX), y: 0 });
      const pane = paneOf();
      if (pane) pane.scrollTop = (drag.startTop ?? 0) - (e.clientY - drag.startY);
      return;
    }

    const p = toCanvas(e.clientX, e.clientY);
    const dxRaw = p.x - drag.startX;
    const dyRaw = p.y - drag.startY;

    if (drag.kind === "node" && drag.ids?.length && drag.origin) {
      if (!drag.moved) {
        if (Math.abs(dxRaw) < 2 && Math.abs(dyRaw) < 2) return;
        store.commit(); // undo lands where the drag began
      }
      carry(dxRaw, dyRaw);
      return;
    }

    if (drag.kind === "resize" && drag.nodeId && drag.origin && drag.handle) {
      if (!drag.moved) store.commit();
      const o = drag.origin[drag.nodeId]!;
      const h = drag.handle;
      let { x, y, w, hgt } = { x: o.x, y: o.y, w: o.w, hgt: o.h };
      if (h.includes("e")) w = Math.max(MIN_W, o.w + dxRaw);
      if (h.includes("s")) hgt = Math.max(MIN_H, o.h + dyRaw);
      if (h.includes("w")) {
        w = Math.max(MIN_W, o.w - dxRaw);
        x = o.x + (o.w - w);
      }
      if (h.includes("n")) {
        hgt = Math.max(MIN_H, o.h - dyRaw);
        y = o.y + (o.h - hgt);
      }
      // Right and bottom edges snap to the frame and to neighbours.
      const thr = 6 / zoom;
      const xs = [frameWidth, frameWidth / 2, ...nodes.filter((n) => n.id !== drag.nodeId).flatMap((n) => [n.x, n.x + n.w])];
      const ys = nodes.filter((n) => n.id !== drag.nodeId).flatMap((n) => [n.y, n.y + n.h]);
      const gx: number[] = [];
      const gy: number[] = [];
      if (h.includes("e")) for (const c of xs) if (Math.abs(c - (x + w)) < thr) { w = c - x; gx.push(c); break; }
      if (h.includes("s")) for (const c of ys) if (Math.abs(c - (y + hgt)) < thr) { hgt = c - y; gy.push(c); break; }
      useStudio.setState({ nodes: store.nodes.map((n) => (n.id === drag.nodeId ? { ...n, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hgt) } : n)) });
      setGuides({ x: gx, y: gy });
      setDrag({ ...drag, moved: true, snapped: gx.length > 0 || gy.length > 0 });
      return;
    }

    if (drag.kind === "marquee") {
      setMarquee({ x: Math.min(drag.startX, p.x), y: Math.min(drag.startY, p.y), w: Math.abs(dxRaw), h: Math.abs(dyRaw) });
      return;
    }

    if (drag.kind === "draw") {
      /*
       * A trail for the tools that draw a line, two points for the one that
       * draws between two points.
       *
       * The space tool was on the wrong side of this. It kept only where the
       * press started and where the pointer is, so the loop a person drew was
       * thrown away as they drew it and `isBoundary` was handed a straight
       * two-point line — which is never closed, so every space drawn by hand
       * came back "A space is a closed line" however carefully it was closed.
       * It could not be found until the tool could be picked: nothing in the
       * bar or the menus reached it, so nothing had ever drawn with it.
       */
      const trail = tool === "pen" || tool === "space";
      const pts: [number, number][] = trail ? [...(drag.points ?? []), [p.x, p.y]] : [[drag.startX, drag.startY], [p.x, p.y]];
      setDrag({ ...drag, points: pts });
      setInk(pts);
      return;
    }

    if (drag.kind === "erase") {
      // The sweep. Drawings only: a part under a passing eraser is not an
      // instruction, and a part is erased by pressing on it.
      const live = store.shapes.filter((sh) => sh.pageId === page.id);
      /* From where the hand was to where it is, at the same reach the vine
         gives a hand: half of `REACH_WIDTH`. Ten pixels was a good deal less
         generous than the thing he has already said was right. */
      const was: [number, number] = [drag.lastX ?? drag.startX, drag.lastY ?? drag.startY];
      const hits = hitAlong(live, was, [p.x, p.y], ERASE_REACH / zoom);
      setDrag({ ...drag, lastX: p.x, lastY: p.y, moved: drag.moved || hits.length > 0 });
      if (!hits.length) return;
      // One step back for the whole sweep, written by whichever came first:
      // the press, or this hit.
      if (!drag.moved) store.commit();
      const gone = new Set(hits.map((h) => h.id));
      useStudio.setState((s) => ({ shapes: s.shapes.filter((sh) => !gone.has(sh.id)), selection: s.selection.filter((id) => !gone.has(id)) }));
      play("tap");
    }
  };

  /**
   * Ink becomes a part.
   *
   * The same road the drawing disc takes, from a different door: the
   * strokes are put in their own box as fractions, rasterised for the
   * reader, and queued exactly as `DrawBoard` queues them, so everything
   * downstream — the catalogue, the tracer, the queue counter, the
   * iteration on the timeline — is the machinery that was already there.
   * The ink goes, because it is the part now.
   */
  const makeInkReal = React.useCallback((group: InkGroup) => {
    const b = group.bounds;
    if (b.w < 2 && b.h < 2) return;
    const w = Math.max(b.w, 1);
    const h = Math.max(b.h, 1);
    /*
     * Every stroke in the drawing, in one box.
     *
     * It took a single stroke before, which is why a four-stroke gull came
     * back as three unrelated parts. The strokes are normalised against the
     * *group's* box rather than each stroke's own, so the wing stays where
     * it was drawn relative to the body.
     */
    const inGroup = useStudio.getState().shapes.filter((x) => group.strokeIds.includes(x.id));
    const strokes = inGroup.map((x) => x.points.map(([px, py]) => [(px - b.x) / w, (py - b.y) / h] as [number, number]));
    const drawn = { strokes, words: inGroup.map((x) => (x.label || x.prompt || "").trim()).filter(Boolean).join(" ") };
    play("confirm");
    useStudio.getState().enqueueDraw({
      nodeId: null,
      at: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      frameWidth,
      sketch: drawn,
      picture: pictureOf(strokes),
      // The size it was drawn at, so the part lands there rather than
      // filling the frame: the strokes above are fractions of this box.
      drawn: { w: b.w, h: b.h },
      label: `Making ${drawn.words.slice(0, 40) || describeSketch({ strokes, words: "" })}`,
    });
    useStudio.getState().removeShapes(group.strokeIds);
    news.publish({
      key: "studio:queued",
      title: "The drawing is on the queue",
      body: "The counter on the toolbar says when it lands.",
      level: "info",
      source: "studio",
      toast: true,
    });
  }, [frameWidth, news]);

  const onPointerUp = () => {
    if (!drag) return;
    const store = useStudio.getState();
    /*
     * Drawing the shape is the whole action.
     *
     * HIS WORDS: "'this space' should be for the shape i drew and it should
     * skip having to press that buutton once i draw it." The "This space"
     * button on a fresh hole is the way IN to its panel, and it only shows
     * while the space is not the picked one — so a space that picks itself
     * the moment it is drawn never puts that press between him and the
     * panel, and the button is still there for a space he comes back to.
     * Both doors to `addSpace` come through here, so both behave alike.
     */
    const madeASpace = (id: string) => store.setSelection([id]);

    if ((drag.kind === "node" || drag.kind === "resize") && drag.moved) {
      // Grid-snap only when no guide claimed the position: a guide is more exact than the grid.
      if (!drag.snapped) {
        const ids = new Set(drag.ids ?? [drag.nodeId!]);
        useStudio.setState({
          nodes: useStudio.getState().nodes.map((n) =>
            ids.has(n.id) ? { ...n, x: snapGrid(n.x), y: snapGrid(n.y), w: drag.kind === "resize" ? snapGrid(n.w) : n.w, h: drag.kind === "resize" ? snapGrid(n.h) : n.h } : n,
          ),
        });
      }
      /*
       * A drawing used as an icon, let go on top of a button, becomes that
       * button's icon.
       *
       * The paths are copied onto the button rather than referenced,
       * because a button that shipped a pointer at another part would be a
       * button that breaks when that part is deleted; and the drawing is
       * taken off the board, because it is on the button now and two of it
       * would be a mistake nobody made. Nothing else on the board behaves
       * this way, and nothing happens silently: the news says what it did.
       */
      if (drag.kind === "node" && drag.ids?.length === 1) {
        const moved = useStudio.getState().nodes.find((n) => n.id === drag.ids![0]);
        if (moved?.role === "icon" && moved.vector) {
          const cx = moved.x + moved.w / 2;
          const cy = moved.y + moved.h / 2;
          const onto = useStudio.getState().nodes.find(
            (n) => n.id !== moved.id && n.pageId === moved.pageId && WEARS_AN_ICON.has(n.featureId)
              && cx > n.x && cx < n.x + n.w && cy > n.y && cy < n.y + n.h,
          );
          if (onto) {
            useStudio.getState().updateNode(onto.id, { vector: moved.vector });
            useStudio.getState().removeNodes([moved.id]);
            play("confirm");
          }
        }
      }
      play("tap");
    } else if (drag.kind === "marquee" && marquee) {
      const hits = [
        ...nodes.filter((n) => n.x < marquee.x + marquee.w && n.x + n.w > marquee.x && n.y < marquee.y + marquee.h && n.y + n.h > marquee.y).map((n) => n.id),
        ...shapes.filter((sh) => { const b = shapeBounds(sh); return b.x < marquee.x + marquee.w && b.x + b.w > marquee.x && b.y < marquee.y + marquee.h && b.y + b.h > marquee.y; }).map((sh) => sh.id),
      ];
      if (hits.length) {
        store.setSelection(hits);
        play("select");
      }
    } else if (drag.kind === "draw" && tool === "space" && drag.points && drag.points.length >= 2) {
      // The space tool: a closed line is a placeholder (`space.ts`), an open one is nothing, and says so.
      if (isBoundary(drag.points)) { madeASpace(store.addSpace({ pageId: store.activePageId, boundary: drag.points, prompt: "", label: "" })); play("confirm"); }
      else {
        /* Said where the hand was, not in the corner of the window: the
           feed still gets the line, and the message itself is drawn on the
           line that was refused (`SpaceRefused`). */
        play("deny");
        setRefused({ points: drag.points, at: Date.now() });
        news.publish({ key: "studio:space", title: "A space is a closed line", body: "Draw round the area and come back to where you started.", level: "info", source: "studio", toast: false });
      }
    } else if (drag.kind === "draw" && tool === "pen" && store.drawKind === "surface" && drag.points && drag.points.length >= 2) {
      /*
       * SURFACE, CHOSEN BEFORE THE LINE WAS DRAWN.
       *
       * His words: "i found the draw a space button which is cool but i
       * think it should also be this way in the menu like i said instead of
       * forcing the circle". The behaviour he liked is this one, so it is
       * reused rather than reinvented — the same `addSpace` the space tool
       * calls, reached by saying "surface" first and then drawing.
       *
       * A line that does not close is refused exactly as the space tool
       * refuses it, on the line itself, because a surface is a closed line
       * whichever door you came through.
       */
      if (isBoundary(drag.points)) { madeASpace(store.addSpace({ pageId: store.activePageId, boundary: drag.points, prompt: "", label: "" })); play("confirm"); }
      else {
        play("deny");
        setRefused({ points: drag.points, at: Date.now() });
        news.publish({ key: "studio:space", title: "A surface is a closed line", body: "Draw round the area and come back to where you started.", level: "info", source: "studio", toast: false });
      }
    } else if (drag.kind === "draw" && tool === "pen" && store.drawKind === "button" && drag.points && drag.points.length >= 2) {
      /*
       * BUTTON, CHOSEN BEFORE THE LINE WAS DRAWN, AND REAL THE MOMENT IT LANDS.
       *
       * "i would like some preset options like a button to be instantly coded
       * and pressable and linkable via the chain to either a link or multiple
       * options if not linked to another part of the site."
       *
       * So nothing is asked of a model and nothing is spent: the line he drew
       * is a box, and an ordinary `cta-primary` goes in it. It is pressable
       * from that moment because it is the same part the shelf drops, and the
       * chain links it because `link` is an ordinary field on an ordinary
       * node. A stroke too small to be a button gets a button's own minimum
       * rather than a sliver nobody could press.
       */
      const xs = drag.points.map((q) => q[0]);
      const ys = drag.points.map((q) => q[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const w = Math.max(96, Math.round(Math.max(...xs) - x0));
      const h = Math.max(36, Math.round(Math.max(...ys) - y0));
      store.addNode("cta-primary", Math.round(x0), Math.round(y0), { w, h });
      play("confirm");
      news.publish({ key: "studio:button", title: "A button, ready to press", body: "Link it with the chain, to a page or an address.", level: "success", source: "studio", toast: false });
    } else if (drag.kind === "draw" && drag.points && drag.points.length >= 2) {
      const kind = tool === "pen" ? "pen" : "arrow";
      const pts = drag.points;
      const from = kind === "arrow" ? hitNode(nodes, pts[0]![0], pts[0]![1]) : null;
      const to = kind === "arrow" ? hitNode(nodes, pts[pts.length - 1]![0], pts[pts.length - 1]![1]) : null;
      const dist = Math.hypot(pts[pts.length - 1]![0] - pts[0]![0], pts[pts.length - 1]![1] - pts[0]![1]);
      if (kind === "pen" || dist > 16) {
        // A wire between two parts seats itself: its ends snap to the two
        // edges, it draws itself on, both parts ring, and the source now
        // sends people to the target when it is a thing that links.
        const joined = kind === "arrow" && from && to && from.id !== to.id ? { from, to } : null;
        const points = joined ? [edgePoint(joined.from, midOf(joined.to)), edgePoint(joined.to, midOf(joined.from))] : pts;
        const id = store.addShape({ pageId: store.activePageId, kind, points, hue: inkHue, width: inkWidth, label: "", prompt: "", relation: "flow",
          fromNodeId: from?.id ?? null, toNodeId: to?.id ?? null });
        if (joined) {
          play("confirm");
          setFresh({ wire: id, nodes: [joined.from.id, joined.to.id] });
          if (isLinkable(joined.from.featureId)) store.updateNode(joined.from.id, { link: { kind: "node", target: joined.to.id } });
        } else play("tap");
      }
    }

    setDrag(null);
    setMarquee(null);
    setInk(null);
    setGuides({ x: [], y: [] });
  };

  /* Grabbing while a pan is under way, an arrow otherwise. There is no pan
     tool to point at any more, so the cursor follows the drag rather than a
     mode: it changes when you actually start pushing the ground. */
  const cursor = drag?.kind === "pan" ? "grabbing" : tool === "select" ? "default" : "crosshair";

  return (
    <div
      ref={ref}
      {...ctxProps("studio-canvas", page.id, page)}
      /* No background. The ground is mounted once behind all three views
         (`StudioPage`), and the contract written there is that each view is
         transparent over it. This root used to carry `bg-bg`, which was
         harmless while `<Workspace />` was rendered *inside* it — the ground
         sat above the fill. When the ground moved out to be shared, the fill
         stayed, and an opaque board painted straight over the nebula: the
         workspace went flat black in design mode while the timeline, which
         has no background of its own, kept its ground. Anything that needs
         an opaque surface here should paint it on the frame, not on the
         window the frame floats in. */
      /*
       * As tall as the site, and it does not clip.
       *
       * `size-full` was here, and it is the single fault behind every
       * report of "a box that fills the screen and scrolls inside itself":
       * `h-full` takes the pane's height whatever the site's height is, and
       * `overflow-hidden` throws the rest away. At a 1267×1278 window with
       * six parts, that was a 943px root holding 1841px of page.
       *
       * The height is the site as drawn plus the ground either side of it,
       * so the pane has the whole page to scroll and nothing here hides any
       * of it.
       */
      className="relative w-full shrink-0 touch-none select-none"
      style={{ cursor, height: boardH }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/*
        The ground: the same dark matter every other surface stands on, and
        the whole of the ground now.

        There used to be a dot grid over this — a hangover from when the
        workspace was the app's flat background and needed something to say
        it was scratch. The nebula says it. Two backgrounds arguing is one
        too many, and the dots read as a defect over cloud. Snapping still
        works to `GRID`; the grid is a rule, not a picture of one. A grid
        that belongs to the *site* being built is the site's own business and
        is drawn inside the frame, untouched by this.
      */}
      {/*
        The ground is not mounted here.

        It used to be, and the timeline mounted its own, and pressing Preview
        swapped between them — so the green button changed the weather, which
        is the one thing a button for "show me the site" must not do. There
        is one instance now, behind all three views in `StudioPage`, and this
        surface is transparent over it.
      */}

      {/* Across on the pan, down on the gutter plus whatever room the ground
          above the page needs: the pane owns down. */}
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${TOP_GUTTER + above}px) scale(${zoom})` }}>
        {/*
          The page's box, which no longer clips to itself.

          It was a window: `overflow-hidden`, and everything outside the
          page's own rectangle thrown away. That was right while the frame
          was one screen of a site sliding behind its edge, and it is wrong
          now — the page is the whole site and the space round it is scratch,
          which the board has always said it is. Anything drawn out there
          belongs to the person and has to be visible.

          The fault it leaves is at the top and the left rather than the
          bottom and the right, and that asymmetry is exactly why it went
          unnoticed. `frameHeight` grows the page downward, so ink below the
          last part pushes the box out to meet it. Nothing grows it upward,
          because the page's origin is the site's top and moving it would
          renumber every coordinate in the document — so a stroke at y -34
          simply fell outside, and `scrollHeight`, which only ever measures
          overflow below and to the right, could not see that it had. It
          measured 900 against 900 while 28px of a drawn line sat above the
          edge, unreachable by any gesture.

          So the page keeps its origin and stops clipping. What is outside
          it shows on the ground where it was drawn, on all four sides.
          `tests/board-edges.mjs` reads the drawn things themselves rather
          than a scroll height, because two of the four sides cannot be
          measured that way at all.
        */}
        <div
          data-page-window=""
          className="absolute left-0 top-0 rounded-[3px]"
          style={{ width: frameWidth, height: frameH }}
        >
        {/* ---------- the page frame: this is the website ---------- */}
        <div
          data-frame=""
          data-selected={selection.includes(BACKGROUND_ID) ? "" : undefined}
          // The page's own wheel: a right press on the bare frame opens the
          // same wheel a part gets, about the background. Parts are siblings
          // of the frame, not children, so a press here is never on a part.
          onPointerDown={(e) => {
            if (e.button !== 2 || e.target !== e.currentTarget) return;
            e.preventDefault();
            e.stopPropagation();
            useStudio.getState().selectBackground();
            // The same spot on the page, so the wheel's Add lands a part where the hand was.
            openRadial(BACKGROUND_ID, e.clientX, e.clientY, pageSpot(e.currentTarget, e.clientX, e.clientY));
          }}
          onContextMenu={(e) => {
            if (e.target !== e.currentTarget) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute left-0 top-0 rounded-[3px] shadow-[0_20px_60px_oklch(0_0_0/0.45)]"
          style={{
            width: frameWidth,
            height: frameH,
            /* No size patched on here. The backdrop carries its own now —
               a grid arrived unsized, so this tiled it at 24px while the
               swatch said 8 and the live page drew a hairline. */
            ...(theme.surfaceStyle ?? { background: theme.backdrop }),
            // The page is marked in the far side of its own colour, like a
            // part: an accent-blue box round the whole frame was the loudest
            // thing on a board whose whole subject is what the page looks like.
            outline: selection.includes(BACKGROUND_ID) ? `${(1.5 / zoom).toFixed(2)}px solid ${pageMark}` : "1px solid var(--border-strong)",
          }}
        />
        {/* The page itself, sliding behind the window's edge. */}
        <div
          data-page-scroll=""
          /*
            Transparent to the hand.

            The layer covers the whole page, so with pointer events on it the
            bare page was never bare: a right press meant for the background's
            own wheel landed on this instead. The parts and the drawn shapes
            in it take their own presses back.
          */
          className="pointer-events-none absolute left-0 top-0"
          style={{ width: frameWidth, height: pageH }}
        >
        <TextureDrift layers={look.texture} palette={palette} />
        {/* The faces the site carries, drawn in the real file; one that will not load is said once. */}
        <CarriedFonts fonts={look.fonts} onFail={fontFailed} />
        <SpaceMarks zoom={zoom} />
        <SpaceInk zoom={zoom} />
        <SpaceRefused at={refused} zoom={zoom} />
        {/* The pool the lamp puts on the page, when it has been asked for. Under
            the parts, because a lamp lights a table and the things on it cast
            their shadows down on to it. */}
        {wash ? (
          <div
            aria-hidden
            data-frame-light=""
            className="pointer-events-none absolute left-0 top-0 rounded-[3px]"
            style={{ width: frameWidth, height: pageH, backgroundImage: wash }}
          />
        ) : null}
        {/*
          The frame Import is showing, live.

          Over the page's own background and under everything standing on
          it, which is where a background picture goes — so what is on the
          board while the scrubber moves is what "Fit to standard" will
          actually commit, rather than a thumbnail of it somewhere else.
        */}
        {importing ? (
          <div
            aria-hidden
            data-import-preview=""
            className="pointer-events-none absolute left-0 top-0 rounded-[3px]"
            style={{ width: frameWidth, height: pageH, backgroundImage: `url(${importing})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        ) : null}
        {selection.includes(BACKGROUND_ID) ? (
          <div
            data-background-selected=""
            className="pointer-events-none absolute whitespace-nowrap rounded-sm px-1.5 py-0.5 font-medium"
            style={{ left: 8, top: 8, fontSize: 10 / zoom, background: "var(--accent)", color: "oklch(0.99 0 0)" }}
          >
            Background · ⌘X cuts it, ⌫ strips it
          </div>
        ) : null}
        <div className="pointer-events-none absolute left-0 flex items-center gap-2 whitespace-nowrap text-fg-muted" style={{ top: -22, fontSize: 11 / zoom }}>
          <span className="font-medium text-fg">{page.name}</span>
          <span>{page.path}</span>
          <span className="num">{frameWidth} × {Math.round(frameH)}</span>
        </div>
        {/*
          The fold is the window's own bottom edge now.

          A dashed line at 900px was how you were told where the first screen
          ended on a page drawn flat. The frame *is* the first screen, so the
          line would sit exactly on its edge and say nothing; what is worth
          saying is how much page there is below it, and that is on the
          caption above the frame.
        */}

        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
          <defs>
            <marker id="studio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {groups.map((g) => {
            const b = groupBounds(nodes, g.id);
            if (!b) return null;
            return <rect key={g.id} x={b.x - 14} y={b.y - 22} width={b.w + 28} height={b.h + 36} rx={12} fill={`oklch(0.7 0.15 ${g.hue} / 0.07)`} stroke={`oklch(0.7 0.15 ${g.hue} / 0.5)`} strokeDasharray="6 4" />;
          })}
          {shapes.filter((sh) => showWires || sh.kind !== "arrow").map((sh) => (
            <ShapeView
              key={sh.id}
              shape={sh}
              selected={selection.includes(sh.id)}
              fresh={fresh?.wire === sh.id}
              // Why this chain is here, worked out from what the two parts
              // already say about themselves. Not typed twice.
              reason={reasonOn(sh, nodes)}
            />
          ))}
          {/*
             A boundary being drawn is drawn as a boundary.

             HIS WORDS: "it should allow me to create the shape ... with
             dashes lines". Ink and a boundary were the same solid line
             under the hand, so nothing on screen said which of the two you
             were making until you let go. A space is dashed the whole way
             round, which is the same language the marquee and the frame
             already speak here: a dashed line is a line that is about to
             become something rather than a line that stays. */}
          {ink && ink.length >= 2 ? <ShapeView shape={{ id: "live", pageId: "", kind: tool === "arrow" ? "arrow" : "pen", points: ink, hue: inkHue, width: inkWidth, label: "", prompt: "" }} selected dashed={makingASpace} /> : null}
          {marquee ? <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="var(--accent-soft)" stroke="var(--accent)" strokeDasharray="4 3" /> : null}
          {guides.x.map((x) => <line key={`gx${x}`} x1={x} x2={x} y1={-40} y2={frameH + 40} stroke="var(--accent)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />)}
          {guides.y.map((y) => <line key={`gy${y}`} y1={y} y2={y} x1={-40} x2={frameWidth + 40} stroke="var(--accent)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} />)}
        </svg>

        {groups.map((g) => {
          const b = groupBounds(nodes, g.id);
          if (!b) return null;
          return (
            <div
              key={g.id}
              {...ctxProps("studio-group", g.id, g)}
              className="absolute cursor-default rounded-sm px-1.5 py-0.5 text-small font-medium"
              style={{ left: b.x - 14, top: b.y - 40, color: `oklch(0.75 0.15 ${g.hue})`, background: `oklch(0.7 0.15 ${g.hue} / 0.12)` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                useStudio.getState().setSelection(nodes.filter((n) => n.groupId === g.id).map((n) => n.id));
                play("select");
              }}
            >
              {g.label}
              {g.prompt ? " ✎" : ""}
            </div>
          );
        })}

        {nodes.map((n) => (
          <NodeView
            key={n.id}
            node={n}
            selected={selection.includes(n.id)}
            theme={theme}
            palette={palette}
            zoom={zoom}
            light={look.light}
            page={{ w: frameWidth, h: frameH }}
            layers={look.texture}
            flash={!!fresh && fresh.nodes.includes(n.id)}
          />
        ))}

        {/* A layer set to "over everything" washes across the finished page. */}
        {theme.overlayStyle ? (
          <div
            aria-hidden
            data-frame-wash=""
            className="pointer-events-none absolute left-0 top-0 rounded-[3px]"
            style={{ width: frameWidth, height: pageH, ...theme.overlayStyle }}
          />
        ) : null}
        {/* The veil: a dim over the whole page, set from the background's wheel. */}
        {theme.veil ? (
          <div
            aria-hidden
            data-frame-veil=""
            className="pointer-events-none absolute left-0 top-0 rounded-[3px]"
            style={{ width: frameWidth, height: pageH, background: theme.veil }}
          />
        ) : null}

        {/*
          The door.

          Make real used to live in exactly one place: right-press a part,
          pick Draw in the wheel, and press it in the tray under the disc.
          Someone who picked up the pencil and drew on the page — which is
          the obvious thing to do — got ink and no way to turn it into
          anything, and a person who spent an hour looking never found the
          door at all. Ink is not an annotation unless someone says it is.

          So the ink carries the control. One button, on the drawing, saying
          what it does, from the moment the stroke is finished.
        */}
        {drawings.map((g) => {
          const b = g.bounds;
          const many = g.strokeIds.length > 1;
          const other = drawings.length > 1;
          return (
            <React.Fragment key={`ink-${g.id}`}>
              {/*
                The grouping, drawn. A guess nobody can see is a guess nobody
                can correct, so the drawing this button is about is ringed
                before it is pressed — dashed while it is guessed, solid once
                a person has said.
              */}
              {many ? (
                <div
                  data-ink-group={g.id}
                  data-ink-strokes={g.strokeIds.length}
                  data-ink-decided={g.decided ? "" : undefined}
                  className="pointer-events-none absolute z-10 rounded-lg border"
                  style={{
                    left: b.x - 10,
                    top: b.y - 10,
                    width: b.w + 20,
                    height: b.h + 20,
                    borderColor: g.decided ? "oklch(0.62 0.17 250 / 0.75)" : "oklch(0.62 0.17 250 / 0.4)",
                    borderStyle: g.decided ? "solid" : "dashed",
                  }}
                />
              ) : null}
              <div
                className="pointer-events-auto absolute z-20 flex items-center gap-1 whitespace-nowrap"
                style={{
                  left: b.x + b.w + 12,
                  top: b.y - (many ? 10 : 0),
                  transform: `scale(${Math.max(1, 1 / zoom)})`,
                  transformOrigin: "0 0",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  data-make-real={g.id}
                  title={many ? `Turn these ${g.strokeIds.length} strokes into one part` : "Turn this drawing into a part"}
                  onClick={(e) => { e.stopPropagation(); makeInkReal(g); }}
                  className="tactile flex items-center gap-1 rounded-md border px-1.5 py-1 text-small font-medium shadow-sm"
                  style={{ borderColor: "oklch(0.62 0.17 250)", background: "oklch(0.32 0.1 250)", color: "oklch(0.95 0.04 250)" }}
                >
                  <Sparkles className="size-3" />
                  Make real
                  {many ? <span style={{ opacity: 0.7 }}>· {g.strokeIds.length} strokes</span> : null}
                </button>
                {/* These belong together: take in whichever drawing is nearest. */}
                {other ? (
                  <button
                    type="button"
                    data-ink-join={g.id}
                    title="One drawing with the nearest one"
                    onClick={(e) => {
                      e.stopPropagation();
                      const mate = nearestTo(drawings, g.id);
                      if (!mate) return;
                      play("tick");
                      useStudio.getState().joinInk([...g.strokeIds, ...mate.strokeIds]);
                    }}
                    className="tactile flex items-center gap-1 rounded-md border px-1.5 py-1 text-small shadow-sm"
                    style={{ borderColor: "oklch(0.5 0.1 250)", background: "oklch(0.24 0.06 250)", color: "oklch(0.9 0.04 250)" }}
                  >
                    <Ungroup className="size-3" />
                    Join
                  </button>
                ) : null}
                {/* And apart again: every stroke its own drawing. */}
                {many ? (
                  <button
                    type="button"
                    data-ink-split={g.id}
                    title="Split these into separate drawings"
                    onClick={(e) => { e.stopPropagation(); play("tick"); useStudio.getState().splitInk(g.strokeIds); }}
                    className="tactile flex items-center gap-1 rounded-md border px-1.5 py-1 text-small shadow-sm"
                    style={{ borderColor: "oklch(0.5 0.1 250)", background: "oklch(0.24 0.06 250)", color: "oklch(0.9 0.04 250)" }}
                  >
                    <Scissors className="size-3" />
                    Split
                  </button>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}

        {/*
          What a drawn thing is called, over its middle or above its corner.
          A chain is not in this layer: it says why it is there on itself, in
          its own colour, and a "⛓ data" chip beside a drawn chain was the
          same fact twice, printed on top of the reason, at that.
        */}
        {shapes.filter((sh) => (sh.label || sh.prompt || sh.relation === "data") && (showWires || sh.kind !== "arrow") && !isChain(sh)).map((sh) => {
          const b = shapeBounds(sh);
          const data = sh.relation === "data";
          return (
            <div key={`label-${sh.id}`} className="pointer-events-none absolute max-w-[180px] truncate rounded-sm px-1 text-small" style={{ left: b.x + (data ? b.w / 2 - 20 : 0), top: b.y + (data ? b.h / 2 - 8 : -16), color: `oklch(0.78 0.15 ${sh.hue})` }}>
              {data ? `⛓ ${sh.label || "data"}` : sh.label || "✎"}
            </div>
          );
        })}
        </div>
        </div>
      </div>

      {/* The panel for the one part picked inside an open black hole, and the surfaces forming (`SpaceLayer.tsx`). */}
      <SpaceSide />
      <SpaceForming />
    </div>
  );
}

const midOf = (n: StudioNode): [number, number] => [n.x + n.w / 2, n.y + n.h / 2];

/** Where a line from a part's middle toward a point leaves the part's box: where a wire seats. */
function edgePoint(n: StudioNode, toward: [number, number]): [number, number] {
  const [cx, cy] = midOf(n);
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  if (!dx && !dy) return [cx, cy];
  const sx = dx ? n.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? n.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return [cx + dx * t, cy + dy * t];
}

function hitNode(nodes: StudioNode[], x: number, y: number): StudioNode | null {
  return nodes.find((n) => x >= n.x - 8 && x <= n.x + n.w + 8 && y >= n.y - 8 && y <= n.y + n.h + 8) ?? null;
}

/** Distance from a point to a segment. */
function toSegment(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/**
 * The drawing within `tol` of a point, by geometry rather than by pixels.
 *
 * The eraser used to ask the browser what was under the pointer, which for a
 * one-pixel pen line meant hitting the line exactly. A sweep has to catch the
 * line it crosses, so the shapes are measured instead: a pen stroke as its
 * polyline, an arrow as its one segment, a region as the four edges of its
 * box (its inside is empty, and a sweep across an empty region should not
 * take the region).
 */
function hitShape(shapes: StudioShape[], x: number, y: number, tol: number): StudioShape | null {
  let best: StudioShape | null = null;
  let bestD = tol;
  for (const sh of shapes) {
    const pts = sh.points;
    if (pts.length < 2) continue;
    let d = Infinity;
    if (sh.kind === "frame") {
      const [a, b] = [pts[0]!, pts[pts.length - 1]!];
      const corners: [number, number][] = [a, [b[0], a[1]], b, [a[0], b[1]]];
      for (let i = 0; i < 4; i++) d = Math.min(d, toSegment(x, y, corners[i]!, corners[(i + 1) % 4]!));
    } else {
      for (let i = 1; i < pts.length; i++) d = Math.min(d, toSegment(x, y, pts[i - 1]!, pts[i]!));
    }
    if (d < bestD) { bestD = d; best = sh; }
  }
  return best;
}

/** Do two segments cross? The one case min-of-four-ends cannot see. */
function segsCross(a1: [number, number], a2: [number, number], b1: [number, number], b2: [number, number]): boolean {
  const side = (p: [number, number], q: [number, number], r: [number, number]) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const d1 = side(b1, b2, a1), d2 = side(b1, b2, a2), d3 = side(a1, a2, b1), d4 = side(a1, a2, b2);
  return d1 !== d2 && d3 !== d4;
}

/**
 * EVERYTHING THE STROKE PASSES OVER, and it is a stroke rather than a dot.
 *
 * The sweep used to ask `hitShape` where the pointer happened to BE on each
 * move, which is two faults in one. A hand moving quickly reports a handful
 * of points a long way apart, and everything between them was never asked
 * about \u2014 so a quick scribble across a drawing left most of it standing. And
 * `hitShape` gives back the NEAREST one thing, so a stroke laid across three
 * drawings at once took one of them and left two.
 *
 * This takes the segment from where the hand was to where it is, and gives
 * back every drawing within reach of ANY part of it.
 */
function hitAlong(shapes: StudioShape[], from: [number, number], to: [number, number], tol: number): StudioShape[] {
  const out: StudioShape[] = [];
  for (const sh of shapes) {
    const pts = sh.points;
    if (pts.length < 2) continue;
    const edges: [[number, number], [number, number]][] = [];
    if (sh.kind === "frame") {
      const [a, b] = [pts[0]!, pts[pts.length - 1]!];
      const corners: [number, number][] = [a, [b[0], a[1]], b, [a[0], b[1]]];
      for (let i = 0; i < 4; i++) edges.push([corners[i]!, corners[(i + 1) % 4]!]);
    } else {
      for (let i = 1; i < pts.length; i++) edges.push([pts[i - 1]!, pts[i]!]);
    }
    const near = edges.some(([e1, e2]) =>
      segsCross(from, to, e1, e2)
      || Math.min(
        toSegment(from[0], from[1], e1, e2),
        toSegment(to[0], to[1], e1, e2),
        toSegment(e1[0], e1[1], from, to),
        toSegment(e2[0], e2[1], from, to),
      ) < tol);
    if (near) out.push(sh);
  }
  return out;
}

function penPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    d += ` Q ${a[0]} ${a[1]} ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}`;
  }
  const last = points[points.length - 1]!;
  return d + ` L ${last[0]} ${last[1]}`;
}

/**
 * The red a chain is drawn in.
 *
 * The same red as Delete on the wheel and as the one control on a slab that
 * is *on*: this app keeps red for the handful of things that are not
 * decoration, and a chain — two parts that must be built to agree — is one
 * of them.
 */
const CHAIN_RED = "oklch(0.64 0.23 27)";
/** And what marks it when it is picked up: the far side of that red. */
const CHAIN_MARK = "oklch(0.82 0.19 207)";

/**
 * A chain, drawn as a chain.
 *
 * Interlocking links: an oval along the run, then one seen edge-on, then
 * another along the run. Two ellipses a period, rotated to the line, and the
 * pair overlap by a third of a link so they read as *through* each other
 * rather than as beads on a string. Stroked, never filled, so the board shows
 * through the middle of every link the way it does through a real one.
 *
 * It is wider than the wire it replaces — a chain that reads as a chain has
 * to be — and it is drawn once per render from two points, which is cheaper
 * than it looks: a long run is thirty ellipses.
 */
function Chain({ a, b, colour, lit, fresh, len, mark }: { a: [number, number]; b: [number, number]; colour: string; lit: boolean; fresh?: boolean; len: number; mark: string }) {
  const links = React.useMemo(() => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const run = Math.hypot(dx, dy) || 1;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    // One link is 13 long and 9 across; they step 9 apart, so each takes a
    // bite out of the one before it.
    const step = 9;
    const n = Math.max(2, Math.floor((run - 10) / step));
    const spare = (run - (n - 1) * step) / 2;
    return Array.from({ length: n }, (_, i) => {
      const t = (spare + i * step) / run;
      return { x: a[0] + dx * t, y: a[1] + dy * t, flat: i % 2 === 0, deg };
    });
  }, [a, b]);

  return (
    <g
      data-chain=""
      style={{
        // Picked up: the links glow in the far side of their own red, the way
        // a picked part is marked. Never a blue box over the top of it.
        ...(lit ? { filter: `drop-shadow(0 0 5px ${mark})` } : null),
        ...(fresh ? { "--wire-len": `${Math.ceil(len)}`, animation: "wire-snap 420ms cubic-bezier(0.2, 0.9, 0.2, 1) both" } : null),
      } as React.CSSProperties}
    >
      {links.map((l, i) => (
        <ellipse
          key={i}
          cx={l.x}
          cy={l.y}
          rx={6.5}
          ry={l.flat ? 4.5 : 1.9}
          transform={`rotate(${l.deg.toFixed(2)} ${l.x.toFixed(2)} ${l.y.toFixed(2)})`}
          fill="none"
          stroke={colour}
          strokeWidth={lit ? 2.4 : 2}
          opacity={l.flat ? 1 : 0.85}
        />
      ))}
    </g>
  );
}

/**
 * A wire with a part at each end: a chain rather than a line.
 *
 * A wire dropped on the board is still a wire — it joins a part to a patch
 * of nothing, and there is no second part to have a reason about.
 */
export function isChain(shape: StudioShape): boolean {
  return shape.kind === "arrow" && !!shape.fromNodeId && !!shape.toNodeId && shape.id !== "live";
}

/** A chain's reason, from the two parts it is drawn between. */
function reasonOn(shape: StudioShape, nodes: StudioNode[]): string {
  if (shape.kind !== "arrow" || !shape.fromNodeId || !shape.toNodeId) return "";
  const from = nodes.find((n) => n.id === shape.fromNodeId);
  const to = nodes.find((n) => n.id === shape.toNodeId);
  // A reason typed by hand wins: the point is that nobody has to, not that
  // nobody may.
  return shape.label.trim() || linkReason(from, to, shape.relation ?? "flow");
}

const ShapeView = React.memo(function ShapeView({ shape, selected, fresh, reason, dashed }: { shape: StudioShape; selected: boolean; fresh?: boolean; reason?: string; dashed?: boolean }) {
  const color = `oklch(0.78 0.16 ${shape.hue})`;
  // Ink is marked the same way a part is: the far side of its own colour,
  // rather than the app's accent glowing round somebody's drawing.
  const mark = `oklch(0.82 0.19 ${(shape.hue + 180) % 360})`;
  const common = {
    "data-shape-id": shape.id,
    stroke: color,
    strokeWidth: shape.width,
    fill: "none",
    className: "pointer-events-auto",
    style: selected ? { filter: `drop-shadow(0 0 5px ${mark})` } : undefined,
    ...(shape.id !== "live" ? ctxProps("studio-shape", shape.id, shape) : {}),
  } as const;
  if (shape.kind === "frame" && shape.points.length >= 2) {
    const [p1, p2] = [shape.points[0]!, shape.points[1]!];
    return <rect {...common} x={Math.min(p1[0], p2[0])} y={Math.min(p1[1], p2[1])} width={Math.abs(p2[0] - p1[0])} height={Math.abs(p2[1] - p1[1])} rx={10} strokeDasharray="8 5" fill={`oklch(0.78 0.16 ${shape.hue} / 0.05)`} />;
  }
  if (shape.kind === "arrow" && shape.points.length >= 2) {
    const [p1, p2] = [shape.points[0]!, shape.points[shape.points.length - 1]!];
    const data = shape.relation === "data";
    // A wire with a part at each end is a chain: a link at either end, and
    // when it has just been made it draws itself on and seats with a snap.
    const chained = isChain(shape);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const { className, ...line } = common;
    // A chain is red, whatever colour the pen was: it is not ink, it is a
    // statement about two parts, and red is what this app reserves for the
    // few things that are not decoration.
    const wire = chained ? CHAIN_RED : color;
    return (
      <g className={className} {...(shape.id !== "live" ? ctxProps("studio-shape", shape.id, shape) : {})} data-shape-id={shape.id} data-chained={chained ? "" : undefined}>
        {/* A wire is three pixels wide; this invisible one is easy to hit. */}
        <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="transparent" strokeWidth={18} fill="none" strokeLinecap="round" />
        {chained ? (
          <Chain a={p1} b={p2} colour={wire} lit={selected} fresh={fresh} len={len} mark={CHAIN_MARK} />
        ) : (
          <line
            {...line}
            data-shape-id={undefined}
            x1={p1[0]}
            y1={p1[1]}
            x2={p2[0]}
            y2={p2[1]}
            markerEnd="url(#studio-arrow)"
            style={{
              color,
              ...(fresh ? { "--wire-len": `${Math.ceil(len)}`, "--wire-w": `${data ? shape.width + 1 : shape.width}px`, strokeDasharray: data ? undefined : Math.ceil(len), animation: "wire-snap 420ms cubic-bezier(0.2, 0.9, 0.2, 1) both" } : {}),
            } as React.CSSProperties}
            strokeLinecap="round"
            strokeDasharray={data ? "2 6" : undefined}
            strokeWidth={data ? shape.width + 1 : shape.width}
          />
        )}
        {chained ? (
          <>
            <circle cx={p1[0]} cy={p1[1]} r={4.5} fill="var(--bg)" stroke={wire} strokeWidth={2} />
            <circle cx={p2[0]} cy={p2[1]} r={4.5} fill={wire} stroke={wire} strokeWidth={2} />
            {/*
              The reason, on the chain.

              Horizontal, never turned with the wire: a label you have to tilt
              your head to read is a label nobody reads. It sits over the
              middle of the run on a dark plate, so it survives whatever the
              page behind it is doing.
            */}
            {reason ? (
              <foreignObject
                x={(p1[0] + p2[0]) / 2 - 135}
                y={(p1[1] + p2[1]) / 2 - 13}
                width={270}
                height={26}
                className="pointer-events-none overflow-visible"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <span
                    data-chain-reason={shape.id}
                    className="max-w-full truncate rounded-full border px-1.5 py-[3px] text-small font-medium leading-none"
                    style={{ borderColor: wire, background: "oklch(0.16 0.03 20 / 0.92)", color: "oklch(0.9 0.06 27)" }}
                    title={reason}
                  >
                    {reason}
                  </span>
                </div>
              </foreignObject>
            ) : null}
          </>
        ) : null}
      </g>
    );
  }
  return (
    <path
      {...common}
      d={penPath(shape.points)}
      strokeLinecap="round"
      strokeLinejoin="round"
      /* A boundary under the hand, rather than ink. The dash is in the
         shape's own stroke width so it reads the same at any zoom. */
      strokeDasharray={dashed ? `${shape.width * 3} ${shape.width * 2.2}` : undefined}
    />
  );
});

/**
 * The corners are squares; the edges are the edges.
 *
 * A dot in the middle of an edge is a target the size of a dot. The whole
 * edge is a bar you can take hold of anywhere along it, drawn thin so it
 * reads as the part's outline rather than as a frame round it.
 */
/** Which way each handle pulls, for a handle that is not on a corner of the box. */
const HANDLE_CURSOR: Record<string, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize",
  se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize",
};

const HANDLES: { h: Handle; cls: string; bar?: boolean }[] = [
  { h: "nw", cls: "-left-1 -top-1 cursor-nwse-resize" },
  { h: "n", cls: "left-2 right-2 -top-[3px] h-[6px] cursor-ns-resize", bar: true },
  { h: "ne", cls: "-right-1 -top-1 cursor-nesw-resize" },
  { h: "e", cls: "top-2 bottom-2 -right-[3px] w-[6px] cursor-ew-resize", bar: true },
  { h: "se", cls: "-right-1 -bottom-1 cursor-nwse-resize" },
  { h: "s", cls: "left-2 right-2 -bottom-[3px] h-[6px] cursor-ns-resize", bar: true },
  { h: "sw", cls: "-left-1 -bottom-1 cursor-nesw-resize" },
  { h: "w", cls: "top-2 bottom-2 -left-[3px] w-[6px] cursor-ew-resize", bar: true },
];

/**
 * Fill: a tab under the selected part that opens, on hover, into the four
 * things you reach for while sizing — fill the width, centre it, push it to
 * either edge. It used to be a Size choice in the menu with number fields,
 * which is a form for something your hand is already doing on the board.
 */
function FillTab({ node, chipScale }: { node: StudioNode; chipScale: number }) {
  const frameWidth = useStudio((s) => s.frameWidth);
  const set = (patch: Partial<StudioNode>) => { play("tap"); useStudio.getState().updateNode(node.id, patch); };
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const btn = "tactile flex h-5 items-center justify-center gap-1 rounded-sm px-1.5 text-fine text-fg-muted hover:bg-panel hover:text-fg";
  return (
    <div
      data-fill-tab=""
      onPointerDown={stop}
      className="group/fill absolute left-1/2 z-10 flex origin-top -translate-x-1/2 items-center rounded-md border border-border bg-panel/95 shadow-sm backdrop-blur"
      style={{ top: "calc(100% + 3px)", transform: `translateX(-50%) scale(${chipScale})` }}
    >
      <span className="flex h-5 w-6 items-center justify-center text-fg-faint group-hover/fill:hidden" title="Fill and align">
        <StretchHorizontal className="size-3" />
      </span>
      <div className="hidden items-center gap-0.5 p-0.5 group-hover/fill:flex">
        <button type="button" aria-label="Fill width" title="Fill width" className={btn} onClick={() => set({ x: 0, w: frameWidth })}><StretchHorizontal className="size-3" />Fill</button>
        <button type="button" aria-label="Flush left" title="Flush left" className={btn} onClick={() => set({ x: 0 })}><AlignLeft className="size-3" /></button>
        <button type="button" aria-label="Centre" title="Centre" className={btn} onClick={() => set({ x: Math.round((frameWidth - node.w) / 2) })}><AlignCenter className="size-3" /></button>
        <button type="button" aria-label="Flush right" title="Flush right" className={btn} onClick={() => set({ x: frameWidth - node.w })}><AlignRight className="size-3" /></button>
      </div>
    </div>
  );
}

/**
 * A page of the site, standing on a cube's surface, on the board.
 *
 * The same renderer the preview and the published page use, at the site's
 * own width and scaled into the box the face gives it. Its own page is
 * never offered — a surface showing the page it is part of is a mirror —
 * and nothing inside it takes a pointer, so the cube can still be turned
 * by dragging across it. Mounted only for a cube that has a page bound to
 * a face, so a board of ordinary parts pays nothing for it.
 */
function BoardSurface({ target, on, box }: { target: string; on: string; box: { w: number; h: number } }) {
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const shapes = useStudio((s) => s.shapes);
  const siteName = useStudio((s) => s.brief.name);
  const frameWidth = useStudio((s) => s.frameWidth);
  const page = resolvePageLink(pages, target);
  if (page?.id === on) return null;
  if (!page) {
    return (
      <div data-cube-surface="gone" className="grid size-full place-items-center px-2 text-center text-fine leading-snug text-fg-faint" style={{ width: box.w, height: box.h, pointerEvents: "none" }}>
        the page this side showed is not in the site any more
      </div>
    );
  }
  const scale = Math.max(0.02, box.w / Math.max(1, frameWidth));
  return (
    <div data-cube-surface={page.id} style={{ width: box.w, height: box.h, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ width: frameWidth, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <LiveSite pages={pages} nodes={nodes} pageId={page.id} device="desktop" frameWidth={frameWidth} format={format} look={look} siteName={siteName} shapes={shapes} depth={1} />
      </div>
    </div>
  );
}

const NodeView = React.memo(function NodeView({ node, selected, theme, palette, zoom, light, page, layers, flash }: { node: StudioNode; selected: boolean; theme: ReturnType<typeof themeFrom>; palette: Palette; zoom: number; light?: Light; page: { w: number; h: number }; layers?: TextureLayer[]; flash?: boolean }) {
  // What a picked part is marked in: the far side of its own aura or fill.
  // Not the app's accent, which was the loudest thing on the board and sat
  // on top of the aura you were editing.
  const mark = React.useMemo(() => markColour(node, palette), [node, palette]);
  /*
   * Where this part stands under the page's lamp.
   *
   * A part cut to a drawn outline is left out: its silhouette is a path, and
   * a rectangular shadow under it would be a shadow of the wrong thing.
   */
  const lift = React.useMemo(
    () => (light?.on && page && !node.outline
      ? liftVars(light, (node.x + node.w / 2) / Math.max(1, page.w), (node.y + node.h / 2) / Math.max(1, page.h))
      : null),
    [light, page, node.x, node.y, node.w, node.h, node.outline],
  );
  // The same corner the part is cut to (`blocks.tsx`), so the shadow hugs it.
  const liftRadius = !lift ? undefined
    : node.shape === "circle" || node.shape === "ellipse" ? "50%"
      : node.shape === "rounded" ? Math.min(28, Math.min(node.w, node.h) / 6)
        : undefined;
  const feature = getFeature(node.featureId);
  /**
   * The parts that are worth touching on the board itself, once they have
   * been opened. A very short list on purpose: a part earns a place here
   * only when looking at it tells you nothing and handling it tells you
   * everything.
   *
   * Opened, not selected. A selected part is a part you are working on and
   * it drags like every other part on the board — that is his complaint,
   * and it is answered here. A part you are HANDLING is one you pressed
   * twice, and while it is open the press belongs to it.
   */
  const canHandle = HANDS_ON.has(node.featureId);
  const handsOn = useStudio((s) => s.handling === node.id) && canHandle;
  // The face being pointed at, when this is the cube it belongs to.
  const pickedSide = useStudio((s) => (handsOn && s.pickedFace?.nodeId === node.id ? s.pickedFace.side : null));
  const cat = feature ? categoryOf(feature.category) : null;
  const hue = node.hue ?? cat?.hue ?? 265;
  const Icon = feature?.icon;
  const hasPrompt = node.prompt.trim().length > 0;
  const chipScale = Math.max(1, 1 / zoom);
  /*
   * A part cut to a drawn line is marked along that line.
   *
   * The clip has been on the node for a while; the selection was still a
   * square, so picking up a diagonal drew a box with a lot of empty corners.
   * The same path the crop uses is walked for the mark and for where the
   * handles sit, so the two can never disagree.
   */
  const hugs = React.useMemo(() => (node.outline?.cut ? handlePoints(node.outline.cut) : null), [node.outline?.cut]);

  /*
   * An import shrinking in from the edges.
   *
   * Run by the part, once, on the frame after it mounts, and only if it is
   * the part that just arrived — `claimArrival` spends the mark, so a board
   * that re-renders for any other reason does not replay it. The Web
   * Animations API rather than a class: the box it starts from depends on
   * where this part landed and how tall the page is, and a stylesheet knows
   * neither. Nothing is left behind on the element when it finishes.
   */
  const body = React.useRef<HTMLDivElement>(null);
  /*
   * A box out of a captured page waits its turn to be painted: a run of
   * them comes up .2s apart rather than all in one frame. Only the paint
   * waits — the part is here, sized and placed, from the moment it was
   * added — see `boxEntry.ts` for why that distinction is the whole of it.
   */
  const held = useBoxEntry(node.id, body);
  const arrive = useArrival(node.id);
  React.useEffect(() => {
    const from = arrive;
    const el = body.current;
    if (!from || !el) return;
    const run = el.animate(
      [{ transform: from, opacity: 0.55 }, { transform: "none", opacity: 1 }],
      { duration: IMPORT_SETTLE_MS, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)", fill: "none" },
    );
    return () => run.cancel();
  }, [arrive]);

  return (
    <div
      ref={body}
      data-node-id={node.id}
      onPointerDown={(e) => {
        // The wheel opens on the press, not on the release — so the same hold
        // that opened it can carry straight on into pulling the line out. On
        // the release it opened a beat late and you had to press again to get
        // anywhere, which is two gestures for one thing.
        if (e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        useStudio.getState().setSelection([node.id]);
        openRadial(node.id, e.clientX, e.clientY);
      }}
      onContextMenu={(e) => {
        // The wheel, not a twenty-item list. Stops the global menu from opening too.
        e.preventDefault();
        e.stopPropagation();
      }}
      className={cn("group pointer-events-auto absolute cursor-grab active:cursor-grabbing", node.locked && "cursor-not-allowed", flash && "node-snap")}
      style={{
        left: node.x, top: node.y, width: node.w,
        /* A minimum, not a height: the part grows past it when its words
           need the room. `parts/primitives.tsx` holds the reasoning. */
        minHeight: node.h, display: "flex", flexDirection: "column",
        // Its turn has not come: not drawn, but holding its place, so
        // nothing measures a different page while a run is arriving.
        ...(held ? { opacity: 0 } : {}),
        /*
         * The aura belongs to the element, not to anything inside it — and
         * on a part cut to a drawn line it belongs to the *line*. A
         * box-shadow can only glow a rectangle, so a diagonal came out as a
         * glowing rectangle with the diagonal inside it. That one wears a
         * drop-shadow instead, put on the clipped surface below rather than
         * here, because a filter here would glow the label chip and the
         * handles too.
         */
        ...(hugs ? {} : ((auraStyle(node.aura, palette, node.auraSize, node.auraStyle) ?? {}) as React.CSSProperties)),
        /*
         * Where this part stands under the page's lamp.
         *
         * `liftTheme` hands the shadow to the *part*, and exactly one thing in
         * the library — the button primitive — ever put it anywhere. So Place
         * the light did nothing to a hero, a card, a gallery or a form: the
         * feature worked on one surface out of two hundred and eighteen. The
         * box round a part is the surface every part has, so the value is
         * carried here and one rule in `globals.css` puts it on that box.
         *
         * It is the same variable the drag writes, so a lamp being carried
         * lights every part as it passes; unset when the lamp is off, and the
         * rule falls back to `none`, so an unlit board is untouched.
         */
        ...(lift ? { "--lift-shadow": lift.shadow, "--lift-sheen": lift.sheen } : null),
      } as React.CSSProperties}
    >
      {/* the part itself, at real size */}
      {/* The selected part runs its own clocks, so you can see what it does. */}
      <div
        /*
         * IN THE FLOW, NOT PINNED TO THE BOX. This was `absolute inset-0`,
         * which is a box exactly as tall as the node and no taller, so a
         * part whose words needed more room was clipped here whatever the
         * part itself did. In the flow it grows with what it holds and the
         * node's `min-height` still keeps it from shrinking below the size
         * the capture gave it. `flex: 1 0 auto` fills the box when the box
         * is the taller of the two.
         */
        className="relative flex w-full flex-col overflow-hidden"
        data-mode={selected ? "live" : "board"}
        data-lit={lift ? "" : undefined}
        /*
         * Every part on the board is inert, and has to be: the canvas is a
         * layout surface, and a part that took the pointer could not be
         * picked up or moved.
         *
         * One exception, and it is the whole point of the part it is for. A
         * cube is a thing you turn; a cube you cannot turn is a picture of a
         * cube. So a cube you have OPENED — pressed twice, which is a
         * deliberate "I am handling this one" — takes the pointer and the
         * keys. Merely selecting it does not, because that was the bug:
         * selecting it handed it the press that would have moved it, and
         * the only way to move it was to let go of it first.
         */
        data-handling={handsOn ? "" : undefined}
        inert={handsOn ? undefined : true}
        style={{
          // Fills the node's box when the box is taller, grows past it when
          // its words need more: see the note on this element above.
          flex: "1 0 auto",
          pointerEvents: handsOn ? "auto" : "none",
          // The lamp's shadow is put here by one rule in `globals.css`, off
          // the `--lift-shadow` the wrapper carries; the corner is the one the
          // part is cut to, so the shadow hugs it.
          borderRadius: liftRadius,
          // Thin, and *inside* the part: the aura's own hairline sits on the
          // edge, so a mark drawn there would cover the thing being edited.
          outline: selected && !hugs ? `${(1.5 / zoom).toFixed(2)}px solid ${mark}` : "1px solid transparent",
          outlineOffset: selected && !hugs ? `${(-1.5 / zoom).toFixed(2)}px` : 0,
          // The aura, on the shape itself: `drop-shadow` follows what is
          // actually painted, and what is painted here is already cut to the
          // drawn line.
          ...(hugs ? ((auraFilter(node.aura, palette, node.auraSize, node.auraStyle) ?? {}) as React.CSSProperties) : {}),
        }}
      >
        <Block
          node={node}
          t={theme}
          palette={palette}
          light={light}
          page={page}
          layers={layers}
          mode={selected ? "live" : "board"}
          /*
           * A selected part is live, so a cube on the board turns as soon as
           * it is picked. Where it is left is worth keeping: the part cannot
           * touch the document, so it says where it settled and the board
           * writes it down.
           */
          pick={pickedSide ? { id: pickedSide, colour: mark } : null}
          /*
           * A surface is a page, on the board as on the site. Only a cube
           * that has one bound gets the renderer at all; pressing a face
           * on the board still picks it, because the board is where the
           * faces are edited and jumping pages mid-edit is not an answer
           * to a press.
           */
          surface={node.cube?.faces?.some((f) => f.pageId?.trim()) ? (target, box) => <BoardSurface target={target} on={node.pageId} box={box} /> : undefined}
          emit={(e) => {
            // Where a thing you can turn was left is worth keeping, so the
            // board draws that angle and publish ships it.
            if (e.type === "cube") useStudio.getState().setCubeTurn(node.id, e.turn);
            if (e.type === "mesh") useStudio.getState().setMeshTurn(node.id, e.turn);
            // A face pressed is a face picked; pressed again it is let go.
            if (e.type === "cube-face") {
              const now = useStudio.getState().pickedFace;
              useStudio.getState().pickFace(node.id, now?.nodeId === node.id && now.side === e.side ? null : e.side);
            }
          }}
        />
      </div>
      {/* The mark along the drawn edge, in place of the box. */}
      {selected && hugs && node.outline ? (
        <svg
          data-outline-mark={node.id}
          aria-hidden
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <path
            d={node.outline.cut}
            fill="none"
            stroke={mark}
            strokeWidth={1.5 / zoom}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {/*
        Hover outline, so an unpicked part still reads as a part, and only
        then. It is drawn in the part's *category* hue, which on a first-screen
        button is a red, so leaving it on under the hand put a red dashed box
        round the picked part on top of the mark: two rings saying the same
        thing, one of them in the colour this app keeps for Delete.
      */}
      {selected ? null : (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ outline: `1px dashed oklch(0.75 0.15 ${hue} / 0.8)` }} />
      )}

      {/* What is this, and when would you want it? Answered without clicking, and out of the way once it is picked. */}
      {feature && !selected ? (
        <div
          className="pointer-events-none absolute left-0 z-10 hidden w-[280px] origin-top-left rounded-md border border-border bg-panel/95 p-2 text-plain leading-snug text-fg-muted shadow-panel backdrop-blur group-hover:block"
          style={{ top: `calc(100% + 8px)`, transform: `scale(${chipScale})` }}
        >
          <span className="mb-0.5 block font-medium text-fg">{feature.name}</span>
          {feature.explain ?? feature.blurb}
        </div>
      ) : null}

      {/* label chip: what this is, in the builder's words */}
      <div
        className={cn("pointer-events-none absolute left-0 flex origin-bottom-left items-center gap-1 whitespace-nowrap rounded-sm border border-border bg-panel/95 px-1.5 py-0.5 text-small text-fg shadow-sm transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
        style={{ top: -6, transform: `translateY(-100%) scale(${chipScale})` }}
      >
        {node.glyph ? <span>{node.glyph}</span> : Icon ? <Icon className="size-3" style={{ color: `oklch(0.8 0.15 ${hue})` }} /> : null}
        <span className="font-medium">{node.label}</span>
        <span className="num text-fg-faint">{node.w}×{node.h}</span>
        {/* What the drawing was read as, on the part it made: a box says it is a box. */}
        {node.kind === "cube" ? <span data-kind-chip="cube" className="rounded-xs border border-border px-1 text-fine text-fg-faint">box · cube</span> : null}
        {/* A solid is turned, and a gesture nobody can see is a gesture
            nobody uses. So the part says which of the two it is in, and the
            way out of the one it is in. */}
        {canHandle && selected
          ? <span data-hold-chip={handsOn ? "open" : "shut"} className="rounded-xs border px-1 text-fine" style={{ borderColor: mark, color: mark }}>
              {handsOn ? "turning · press the ground to stop" : "press twice to turn it"}
            </span>
          : null}
        {hasPrompt ? <span className="size-1.5 rounded-full bg-accent" title="Has its own prompt" /> : null}
        {node.priority !== "must" ? <span className="rounded-xs border border-border px-1 text-fine uppercase text-fg-faint">{node.priority}</span> : null}
        {node.locked ? <span className="text-fine text-fg-faint">locked</span> : null}
      </div>

      {selected && !node.locked
        ? hugs
          // On the path's own extremes: on a diagonal the two corner handles
          // land on the two ends of the line and the rest sit on its sides.
          ? CORNERS.map((h) => (
              <span
                key={h}
                data-resize={h}
                data-on-outline=""
                className="absolute size-2 rounded-[2px] border bg-panel"
                style={{
                  left: `${hugs[h][0] * 100}%`,
                  top: `${hugs[h][1] * 100}%`,
                  transform: `translate(-50%, -50%) scale(${chipScale})`,
                  borderColor: mark,
                  cursor: HANDLE_CURSOR[h],
                }}
              />
            ))
          : HANDLES.map(({ h, cls, bar }) => (
              <span
                key={h}
                data-resize={h}
                className={cn("absolute", bar ? "rounded-[3px] hover:bg-(--mark)/35" : "size-2 rounded-[2px] border bg-panel", cls)}
                style={bar
                  ? ({ "--mark": mark } as React.CSSProperties)
                  : { transform: `scale(${chipScale})`, borderColor: mark }}
              />
            ))
        : null}
      {selected && !node.locked ? <FillTab node={node} chipScale={chipScale} /> : null}
    </div>
  );
});
