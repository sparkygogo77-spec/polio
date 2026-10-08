"use client";
import { partUnder } from "../states";
import { clampMove,frameRiders,inside,keepInFrame,liftToFrame,stateFrames } from "../states";
import * as React from "react";
import { tryOn,useTryLook } from "../tryLook";
import { useShallow } from "zustand/react/shallow";
import { getFeature } from "../catalog";
import { isLinkable } from "../parts";
import { useActions } from "@/core/actions";
import { leadsOf,withLead } from "../parts/leadIn";
import { themeFrom } from "../blocks";
import { resolvePageLink } from "../live/LiveSite";
import { pictureOf } from "../reshapeRun";
import { describeSketch } from "../sketch";
import { resolvePalette } from "../parts/theme";
import { Scissors,Sparkles,Ungroup } from "lucide-react";
import { inkGroups,nearestTo,type InkGroup } from "../inkGroups";
import { complementOf,washCss } from "../look";
import { TextureDrift } from "../TextureDrift";
import { CarriedFonts } from "../live/CarriedFonts";
import type { CarriedFont } from "../fonts";
import { SpaceForming,SpaceInk,SpaceMarks,SpaceRefused,SpaceSide } from "../SpaceLayer";
import { BringHost } from "../FromASite";
import { LearnBadge } from "../LearnPanel";
import { partLearned } from "../learn";
import { useDecideAll } from "../states/ui";
import { useImportPreview } from "../ImportFlow";
import { hasPicture,pictureFrom,readDrop } from "../pictureDrop";
import { put as putPicture } from "../pictures";
import { isBoundary,spaceAtLine } from "../space";
import { BASE_ZOOM,BACKGROUND_ID,FIT_MIN,holdSaves,useSteady } from "../store";
import { useDrawKit } from "../DrawKits";
import { insideOutline,lineFromStroke,nearlyClosed,PATH_WORDS,PATH_WORDS_SAMPLE,shapeFromLine,toBox,wornFor,type Worn } from "../wornShape";
import { ownsOthers } from "../holds";
import { SmallBoard } from "../SmallBoard";
import { partName } from "../partNames";
import { ownerOf,parentOf,ridersOf,wordsIn,wordsOf } from "../owner";
import { carriedBy,componentsOf,GRABBED,rereadComponents,resizedWith } from "../components";
import { editingWords,openWords,WordsInPlace } from "../WordsInPlace";
import {
activePage,frameHeight,frameTopReach,groupBounds,pageGroups,pageNodes,pageShapes,pageSpaces,shapeBounds,
useStudio,type StudioNode
} from "../store";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { openRadial,pageSpot } from "../RadialMenu";
import { decisions } from "../library/badge";
import { useSettleToWords } from "../textFit";
import { isControl } from "../control";
import { useSettingValue } from "@/core/settings/useSetting";
import { pulledBox,scaleHeld } from "../groupScale";
import { pageFeatures } from "../library/works";
import { AMBIENT } from "../library/behaviours";
import { runWorks } from "../live/runWorks";

import { shownOnBoard,placedOnBoard,boxOf,HANDS_ON,DOUBLE_MS,DOUBLE_SLOP,WEARS_AN_ICON,FRAME_GUTTER,TOP_GUTTER,LABEL_LINE,LABEL_GAP,SITE_TOP_MAX,SCREEN_H,snapGrid,ERASE_REACH,MIN_W,MIN_H,type Handle,type Drag,type Guides } from "./helpers";
import { midOf,edgePoint,hitNode,hitShape,hitAlong } from "./geometry";
import { isChain,reasonOn,ShapeView,GROUP_HANDLES,HANDLE_CURSOR } from "./ShapeView";
import { NodeView } from "./NodeView";

/**
 * The board: the desktop page with its boxes, or the page on a tablet or a
 * phone (`SmallBoard.tsx`), as the switch in the bar says.
 */
export function Canvas() {
  const view = useStudio((s) => s.view);
  return view === "tablet" || view === "phone" ? <SmallBoard device={view} /> : <DesktopCanvas />;
}

export function DesktopCanvas() {
  const ref = React.useRef<HTMLDivElement>(null);
  /* What is being tried on the picked part (tryLook.ts): laid over it as it is drawn, never written. */
  const trying = useTryLook((s) => s.trying);
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
  /* The parts as they were when the hand went down, while one is under it (`store/hold.ts`): what is worked out from the whole page and does not change because a part is being carried — its features, its names, which parts ask a question, where a row's words start — is worked out once for the drag, not on every move (J, 2026-10-06, "dragging elements around is still laggy"). */
  const steadyNodes = useSteady(nodes);
  /* What moves on its own (a spin, a float, the dust) plays on the board too, softly, on the drawn layer inside each part: the part's box stays put and editable (`live/runWorks.ts`, board). Again only when what they are told changes. */
  const boardMoves = React.useMemo(() => JSON.stringify(pageFeatures(steadyNodes).bindings.filter((b) => (AMBIENT as readonly string[]).includes(b.feature))), [steadyNodes]);
  React.useEffect(() => {
    if (boardMoves === "[]" || !ref.current) return;
    return runWorks(ref.current, useStudio.getState().nodes.filter((n) => n.pageId === useStudio.getState().activePageId), { board: true });
  }, [boardMoves]);
  /* The parts still waiting on a decision: each wears the orange ! (`library/badge.ts`). */
  /* A part whose held presses have all been learned loses its ! (`learn.ts`); every other ! is as it was. */
  const learnState = useStudio((s) => s.learn);
  /* The names the side panel prints, worked out once for the page: the tag over a part says the same. */
  const names = React.useMemo(() => new Map(steadyNodes.map((n) => [n.id, partName(n, steadyNodes, (id) => getFeature(id)?.name)])), [steadyNodes]);
  /* Only the picked part wears its ! unless the top bar's count says show them all (`decideShown.ts`). */
  const decideAll = useDecideAll();
  /* Which parts ask a question does not change under the hand: read from the parts as they were when it went down (`store/hold.ts`). */
  const decide = React.useMemo(() => new Map(decisions(steadyNodes).filter((d) => !learnState || !partLearned(learnState, d.id)).map((d) => [d.id, d.why])), [steadyNodes, learnState]);
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
  const settleFrame = useStudio((s) => s.frameWidth);
  /* Nothing is settled round a part while a look is being tried on it (tryLook.ts): what is tried is drawn, never written. */
  useSettleToWords(nodes, React.useCallback((f) => { if (!useTryLook.getState().trying) useStudio.getState().settleToWords(f); }, []), settleFrame);
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
  /* The select tool's option (`toolOptions.tsx`): a locked group's icons and words scale with it. */
  const scaleContents = useSettingValue<boolean>("studio.groupScaleContents") !== false;
  /* Where the last resize of a locked group met the text clamp, said on its frame. */
  const [ceiling, setCeiling] = React.useState<{ groupId: string; which: "largest" | "smallest" } | null>(null);
  /* The locked groups that are picked whole: each is framed and sized as one thing. */
  const held = React.useMemo(() => groups.flatMap((g) => {
    if (!g.locked) return [];
    const b = groupBounds(nodes, g.id);
    return b && b.members.every((m) => selection.includes(m.id)) ? [{ g, b }] : [];
  }), [groups, nodes, selection]);
  const heldIds = React.useMemo(() => new Set(held.flatMap(({ b }) => b.members.map((m) => m.id))), [held]);
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
  /* A part under the hand is saved once, when it is let go (`store/create.ts#holdSaves`). */
  const holding = drag?.kind === "node" || drag?.kind === "resize";
  React.useEffect(() => {
    if (!holding) return;
    holdSaves(true);
    return () => holdSaves(false);
  }, [holding]);
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
  /* With a state on, the page holds what it draws: a step that grows a part, and moves what is under it down, grows the page (J, 2026-10-05: nothing outside the page). */
  const statesFoot = useStudio((s) => {
    if (!(s.statesOn ?? []).length) return 0;
    const places = placedOnBoard(s), shows = shownOnBoard(s);
    let m = 0;
    for (const n of nodes) { if (!shows(n)) continue; const b = places.get(n.id) ?? n; m = Math.max(m, b.y + b.h); }
    return Math.round(m);
  });
  const wanted = Math.max(stock, frameHeight(nodes, 900, { shapes, spaces }), statesFoot);
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
   *
   * INK, NOT PARTS. Parts counted too once, so that a captured badge at
   * y -11 stayed reachable zoomed right in. The owner then opened his
   * trumpmorty.fun (trunk 2849a20): the site's planet is a part at
   * (-355, -441), 1109 across, the room above came to 441 × zoom + 24, and
   * every fit — a load, a resize of the window or the pane — opened the page
   * halfway down the screen under an empty starfield. A part hanging off the
   * page is the site's decoration, drawn where the site drew it and cut
   * where the pane ends, like the site's own window cuts it; it never moves
   * where the page opens or how big it is drawn. What a person draws on
   * the ground above the page is theirs to reach, so ink and drawn spaces
   * still make room. `tests/board-overhang-fit.mjs`.
   */
  /*
   * THE SITE'S OWN TOP, when it reaches above the page's (J, 2026-10-06).
   * A site part drawn above y 0 (an import's nav a few pixels up, a screen
   * or a step that lifts the page's head) sat in the gutter under the
   * page's name and was cut by the pane's top as the board scrolled: "a
   * forced overhead barrier". The page is drawn from the highest site part
   * instead, the name above that. Only parts in the site's flow count: one
   * placed by the site itself (`position: absolute` or `fixed`, like
   * trumpmorty's planets) or reaching more than `SITE_TOP_MAX` up is
   * decoration hanging off, and moves nothing (`tests/board-overhang-fit.mjs`).
   */
  const siteTop = useStudio((s) => {
    const places = placedOnBoard(s), shows = shownOnBoard(s);
    let top = 0;
    for (const n of nodes) {
      const pos = (n as { from?: { position?: string } | null }).from?.position;
      if (!shows(n) || pos === "fixed" || pos === "absolute") continue;
      const b = places.get(n.id) ?? n;
      if (b.y >= 0 || b.y + b.h <= 0 || b.y < -SITE_TOP_MAX) continue;
      top = Math.min(top, b.y);
    }
    return Math.round(top);
  });
  const above = Math.round(Math.max(frameTopReach({ shapes, spaces }), -siteTop) * zoom);
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
  /*
   * THE SAME RECTANGLE, WITHOUT WAITING FOR A RENDER. State draws it; this
   * is what the release reads. The release's handler is the one from the
   * last render, so reading state there needed a render to land between the
   * last move and the release: a dropped frame on a loaded machine and the
   * release saw the rectangle one move late, or not at all, and picked the
   * box the hand drew across instead of what it drew round. Written on every
   * move and cleared with the state. `tests/marquee-burst.mjs`.
   */
  const marqueeRef = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ink, setInk] = React.useState<[number, number][] | null>(null);
  // The last line that was not a closed one, so the board can say so where it was drawn.
  const [refused, setRefused] = React.useState<{ points: [number, number][]; at: number; hand?: { x: number; y: number } } | null>(null);
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
      /* Across: the frame's two side edges on screen with a gutter either
         side. In nominal terms, because that is what the store holds — the
         width is divided by the base so the *drawn* frame is what is being
         fitted. */
      const across = (vw - FRAME_GUTTER) / (frameWidth * BASE_ZOOM);
      /*
       * ACROSS ONLY: THE PAGE'S WIDTH FILLS THE PANE. Fitting its first
       * screen down too (`SCREEN_H` above the shelf) opened an imported
       * 1440 page at 37 to 49%, and the owner read that as the board framing
       * something bigger than the page (2026-10-03: "fit-to-page to frame
       * the page itself"). The shelf stays stuck to the pane's foot, so the
       * categories are on screen whatever runs under it.
       */
      return Math.max(FIT_MIN, Math.min(1, across));
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
  /* The pane's height is an input now too (its first screen has to fit
     down it); a page that grows still does not change the pane's height,
     and neither does a category opening, so neither re-fits. */
  const fitKey = (pane: Element) => `${pane.clientWidth}x${pane.clientHeight}`;

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
    /*
     * ANY PICTURE, FROM ANYWHERE, WHOLE (`pictureDrop.ts`). The Render panel's
     * own drag, a file from disk, a link or an <img> from another page: read
     * to the last byte, checked, and kept as a stored picture on a Picture
     * part at its own size. It was written into the part as a `data:` URL,
     * and Chrome will not load one past 2 MB: a 1024² PNG drew a strip.
     * Nothing is placed until all of it is here, and what cannot be is said.
     */
    const featureDrag = e.dataTransfer.getData("application/x-studio-feature");
    const got = featureDrag ? null : readDrop(e.dataTransfer);
    if (got && hasPicture(got)) {
      const p0 = toCanvas(e.clientX, e.clientY);
      void pictureFrom(got).then(async (pic) => {
        if (!pic) return;
        if (!pic.ok) {
          play("deny");
          news.publish({ key: "studio:picture-drop", title: "The picture was not kept", body: pic.says, level: "warn", source: "studio", toast: { durationMs: 9000 } });
          return;
        }
        const made = await putPicture(pic.blob, { alt: pic.name === "Picture" ? "" : pic.name, from: "upload" });
        /*
         * DROPPED ONTO A DRAWN SHAPE: the shape is its mask. The picture goes
         * inside the outline, clipped to it, and the kit's border, light and
         * shadow stay round it. The topmost shape under the hand takes it.
         */
        const st0 = useStudio.getState();
        const into = st0.nodes.filter((n) => n.pageId === st0.activePageId && n.worn && n.worn.what !== "path" && insideOutline(n.worn, n, [p0.x, p0.y])).pop();
        if (into?.worn) {
          st0.updateNode(into.id, { picture: made, worn: { ...into.worn, what: into.worn.what === "button" ? "button" : "frame" } });
          st0.setSelection([into.id]);
          play("confirm");
          haptic();
          return;
        }
        const scale = Math.min(1, frameWidth / pic.w);
        const w = Math.round(pic.w * scale);
        const h = Math.round(pic.h * scale);
        const st = useStudio.getState();
        const id = st.addNode("picture", snapGrid(p0.x - w / 2), snapGrid(p0.y - h / 2), { w, h });
        st.updateNode(id, { label: "Picture", picture: made });
        play("confirm");
        haptic();
      });
      return;
    }
    const featureId = featureDrag;
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
    /* A state stops at its frame's edge, and what moves with it stops there too (`stateFrames.ts#clampMove`). */
    const by = clampMove(useStudio.getState().nodes, d.ids, d.origin, dx + snap.dx, dy + snap.dy);
    const positions: Record<string, { x: number; y: number }> = {};
    for (const id of d.ids) positions[id] = { x: Math.round(d.origin![id]!.x + by.dx), y: Math.round(d.origin![id]!.y + by.dy) };
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

  /* ------------------------------------------------------------- keys
   *
   * THE BOARD'S OWN KEYS, for what is picked on it.
   *
   *  · Escape steps out one level at a time: out of the words being typed
   *    (the editor's own), a drawing tool back to Select, then from a part
   *    to the part that holds it, then to nothing picked. It did nothing
   *    with a part picked, and Draw a space stayed in the hand.
   *  · Enter goes into the words: a part's own, or the words a button holds.
   *  · The arrows nudge what is picked a pixel, ten with Shift. A run of
   *    nudges is one step of undo.
   *
   * Only when nothing else has the key: a field being typed in, the wheel,
   * a dialog, the lamp being placed and the shelf all answer Escape first.
   * `tests/board-keys.mjs`.
   */
  const lastNudge = React.useRef(0);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      if (!["Escape", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (editingWords()) return;
      /* Something standing over the board has the key. */
      /* A part on the page may draw a menu or a dialog of its own; those are the site's, not over the board. */
      /* A closed console or keys panel stays in the page, hidden and inert: only an open one counts. */
      const over = (el: Element) => !el.closest("[data-node-id], [aria-hidden='true'], [inert]") && (el as HTMLElement).getClientRects().length > 0;
      if ([...document.querySelectorAll("[data-radial], [role='dialog'], [role='menu']")].some(over)) return;
      const s = useStudio.getState();
      if (s.mode !== "design" || s.placingLight) return;
      const picked = s.selection.map((id) => s.nodes.find((n) => n.id === id)).filter((n): n is StudioNode => !!n && n.pageId === s.activePageId);

      if (e.key === "Escape") {
        if (s.tool !== "select") { s.setTool("select"); play("tap"); return; }
        if (s.handling) { s.hold(null); return; }
        if (!s.selection.length) return;
        const one = picked.length === 1 && s.selection.length === 1 ? picked[0]! : null;
        const up = one ? parentOf(s.nodes, one) : null;
        if (up) s.setSelection([up.id]);
        else s.clearSelection();
        play("tap");
        return;
      }
      if (e.key === "Enter") {
        if (picked.length !== 1 || e.shiftKey) return;
        const into = wordsIn(s.nodes, picked[0]!) ?? picked[0]!;
        if (openWords(into.id)) { e.preventDefault(); play("select"); }
        return;
      }
      /* The arrows. A page with nothing picked scrolls as it always did. */
      if (!picked.length) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      const ids = picked.map((n) => n.id);
      const held = [...ids, ...ridersOf(s.nodes, ids, resolvePalette(s.format, s.look))];
      /* A frame takes its states; a state stops at its frame's edge (`stateFrames.ts`). */
      const all = [...held, ...frameRiders(s.nodes, held)];
      if (e.timeStamp - lastNudge.current > 800) s.commit();
      lastNudge.current = e.timeStamp;
      const was: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const n of s.nodes) if (all.includes(n.id)) was[n.id] = boxOf(n);
      const by = clampMove(s.nodes, all, was, dx, dy);
      const positions: Record<string, { x: number; y: number }> = {};
      for (const n of s.nodes) if (all.includes(n.id) && !n.locked) positions[n.id] = { x: n.x + by.dx, y: n.y + by.dy };
      s.setPositions(positions);
      const before = new Map(s.nodes.map((n) => [n.id, n]));
      useStudio.setState({ nodes: useStudio.getState().nodes.map((n) => (positions[n.id] && !n.byHand ? { ...n, byHand: true, handFrom: boxOf(before.get(n.id) ?? n) } : n)) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    /* A locked group's own handle: the group is resized as one thing (`groupScale.ts`). */
    const groupHandle = target.closest?.("[data-group-resize]") as HTMLElement | null;
    if (groupHandle && tool === "select" && e.button === 0) {
      const gid = groupHandle.dataset.groupId ?? "";
      const b = groupBounds(store.nodes.filter((n) => n.pageId === store.activePageId), gid);
      if (b) {
        capture();
        setCeiling(null);
        setDrag({
          kind: "group", startX: p.x, startY: p.y, groupId: gid, handle: groupHandle.dataset.groupResize as Handle,
          box: { x: b.x, y: b.y, w: b.w, h: b.h },
          held: b.members.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, size: typeof n.font?.size === "number" ? n.font.size : null })),
          ids: b.members.map((n) => n.id),
        });
      }
      return;
    }

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
        /* A component is resized whole: every layer keeps its place and size on it (`components.ts#resizedWith`). */
        const st = useStudio.getState();
        const own = carriedBy(componentsOf(st.nodes, resolvePalette(st.format, st.look)), n.id).filter((id) => id !== n.id);
        /* A frame's states keep their place and size on it, as a component's layers do (`stateFrames.ts`). */
        const layers = [...own, ...frameRiders(st.nodes, [n.id, ...own])];
        const origin: NonNullable<Drag["origin"]> = { [n.id]: { x: n.x, y: n.y, w: n.w, h: n.h } };
        for (const m of st.nodes) if (layers.includes(m.id) && !m.locked) origin[m.id] = { x: m.x, y: m.y, w: m.w, h: m.h };
        setDrag({ kind: "resize", startX: p.x, startY: p.y, nodeId: n.id, handle: handleEl.dataset.resize as Handle, origin, riders: layers });
      }
      return;
    }

    if (tool === "select") {
      if (nodeEl?.dataset.nodeId) {
        /* What the hand is on, and what a press on it picks (see below). */
        const hitId = nodeEl.dataset.nodeId;
        const hit = store.nodes.find((n) => n.id === hitId);
        {
          const prior = pressed.current;
          const twice = !!prior && prior.id === hitId && e.timeStamp - prior.at < DOUBLE_MS && Math.hypot(p.x - prior.x, p.y - prior.y) < DOUBLE_SLOP;
          /*
           * TWO PRESSES ON WORDS OPEN THE WORDS, ON THE CANVAS.
           *
           * The second press goes into the words that were pressed, even
           * when the first press picked the button that owns them: typed
           * where they are drawn (`WordsInPlace.tsx`), or in the panel's
           * WORDS box where they are not drawn as one piece of text. A solid
           * still opens for turning on its own second press, below.
           */
          /* A part that points somewhere goes there on two presses (below,
             `tests/press-in-builder.mjs`): its words are Enter away. */
          /* TWO PRESSES ON A PART THAT HOLDS OTHERS GO IN: the smallest part under the hand, inside it, even one it covers (`boardStates.ts#partUnder`). Escape climbs back out. */
          if (twice && hit && !e.shiftKey && !HANDS_ON.has(hit.featureId) && !isControl(hit) && ownsOthers(store.nodes, hit)) {
            const st = useStudio.getState();
            const places = placedOnBoard(st);
            const inner = partUnder(st.nodes, hit, p, shownOnBoard(st), (n) => places.get(n.id));
            if (inner) {
              pressed.current = null;
              store.setSelection([inner.id]);
              store.want({ panel: "inspector", id: inner.id });
              play("select");
              e.preventDefault();
              return;
            }
          }
          const goes = !!hit?.link && isLinkable(hit.featureId);
          if (twice && hit && !goes && !e.shiftKey && !HANDS_ON.has(hit.featureId) && (wordsOf(hit) || (hit.id === store.selection[0] && store.selection.length === 1 && getFeature(hit.featureId)?.content))) {
            pressed.current = null;
            const opened = openWords(hitId);
            /* The press's own default would move the caret back off the words it just opened. */
            if (opened) { e.preventDefault(); play("select"); return; }
          }
        }
        /*
         * ONE PRESS PICKS THE CONTROL THAT OWNS WHAT WAS PRESSED.
         *
         * A button on a captured page is the button and its words, two parts,
         * and the words are on top: a press on BUY picked the words and a
         * drag slid them off their button. So a press on a part inside a
         * button, a link or a card picks that button, link or card
         * (`owner.ts`), and a drag moves it with everything it holds. The
         * words are one more press away, or Enter; Escape climbs back out.
         * Shift-clicking, and a press on something already picked, still
         * take exactly what is under the hand.
         */
        const pal = resolvePalette(store.format, store.look);
        const owner = hit && !e.shiftKey && !store.selection.includes(hitId) ? ownerOf(store.nodes, hit, pal) : null;
        const id = owner?.id ?? hitId;
        const node = owner ?? hit;
        /*
         * A PART THAT HOLDS OTHERS IS DRAWN ACROSS, NOT MOVED.
         *
         * His ruling. On a captured board every point is covered by some
         * part — the banner, the panels, the page wrapper — so a marquee
         * could never start: every press grabbed a part and dragged it,
         * whole banners across the page. So a press on a part that owns
         * others starts a marquee, and a press on a leaf grabs the leaf.
         * A CONTROL IS ALWAYS GRABBED, whatever it holds (`control.ts`): all
         * eight sidebar buttons on his home page hold their icon, and under
         * the holding rule alone none of them could be dragged, while the
         * same buttons on his docs page, holding nothing, could.
         * Released without a drag, the part is picked as any part is (see
         * the marquee's release).
         *
         * TURNED ROUND (J, 2026-10-06): "some panels are also undraggable",
         * and on the card he chose "Always moves". So a plain drag moves a
         * part that holds others, like any part, and the held modifier —
         * Ctrl, or ⌘ on a Mac — is what draws the box across it now. A second press in quick succession falls
         * through to the double-press below, so a linked container still
         * goes where it points.
         */
        const prior = pressed.current;
        const twice = !!prior && prior.id === hitId && e.timeStamp - prior.at < DOUBLE_MS && Math.hypot(p.x - prior.x, p.y - prior.y) < DOUBLE_SLOP;
        /* A button, badge, tab, copy bar or card is one thing: grabbed whole, like a control (`components.ts`). */
        const whole = node ? componentsOf(store.nodes, pal).byId.get(node.id) : undefined;
        if (node && !twice && !e.shiftKey && (e.ctrlKey || e.metaKey) && !isControl(node) && !(whole && GRABBED.has(whole.kind)) && ownsOthers(store.nodes, node)) {
          pressed.current = { id: hitId, at: e.timeStamp, x: p.x, y: p.y };
          capture();
          marqueeRef.current = null;
          setDrag({ kind: "marquee", startX: p.x, startY: p.y, from: id });
          return;
        }
        let ids = store.selection;
        if (e.shiftKey) {
          store.toggleSelection(id);
          ids = useStudio.getState().selection;
        } else if (!ids.includes(id)) {
          ids = node?.groupId ? store.nodes.filter((n) => n.groupId === node.groupId).map((n) => n.id) : [id];
          store.setSelection(ids);
        }
        play("select");
        /* ONE PRESS ON A PART OPENS ITS PANEL: the Element panel, for the
           part just chosen. Read off the press, not off the selection, so a
           part selected as it lands (a picture just laid, whose layer the
           Look panel is showing) does not take the panel away. */
        if (node && ids.length === 1) store.want({ panel: "inspector", id });
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
        const again = !!last && last.id === hitId && id === hitId && e.timeStamp - last.at < DOUBLE_MS && Math.hypot(p.x - last.x, p.y - last.y) < DOUBLE_SLOP;
        pressed.current = { id: hitId, at: e.timeStamp, x: p.x, y: p.y };
        if (again && node && !node.locked && HANDS_ON.has(node.featureId) && ids.length === 1) {
          store.hold(id);
          return;
        }
        /* TWO PRESSES ON A PART WITH WORDS OPEN ITS WORDS: handled at the
           top of this branch, on the canvas where they are drawn, else in
           the panel's WORDS box (`tests/words-on-press.mjs`,
           `tests/select-owner.mjs`). */
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
        /* A face as big as its frame has no room in it: the drag moves the frame, faces and all (`stateFrames.ts#liftToFrame`). */
        const lifted = liftToFrame(store.nodes, ids);
        /* A button moves with its words and its icon: what it holds rides along (`owner.ts`). */
        const held = ridersOf(store.nodes, lifted, pal);
        /* A frame moves with its states, the hidden faces too (`stateFrames.ts`). */
        const riders = [...held, ...frameRiders(store.nodes, [...lifted, ...held])];
        const carried = [...new Set([...lifted, ...riders])];
        const origin: Drag["origin"] = {};
        for (const n of store.nodes) if (carried.includes(n.id)) origin[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h };
        setDrag({ kind: "node", startX: p.x, startY: p.y, ids: carried, origin, riders });
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
      marqueeRef.current = null;
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
      let to = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hgt) };
      /* A state resized by hand stays in its frame, when it started there. */
      const frameId = stateFrames(store.nodes).frameOf.get(drag.nodeId);
      const fr = frameId ? store.nodes.find((n) => n.id === frameId) : null;
      if (fr && inside(o, fr, 0)) to = keepInFrame(to, fr);
      useStudio.setState({ nodes: store.nodes.map((n) => (n.id === drag.nodeId ? { ...n, ...to } : drag.riders?.includes(n.id) && drag.origin?.[n.id] ? { ...n, ...resizedWith(o, to, drag.origin[n.id]!) } : n)) });
      setGuides({ x: gx, y: gy });
      setDrag({ ...drag, moved: true, snapped: gx.length > 0 || gy.length > 0 });
      return;
    }

    if (drag.kind === "group" && drag.box && drag.held && drag.handle) {
      if (!drag.moved) {
        if (Math.abs(dxRaw) < 2 && Math.abs(dyRaw) < 2) return;
        store.commit(); // one undo for the whole resize
      }
      const to = pulledBox(drag.box, drag.handle, dxRaw, dyRaw, MIN_H);
      const { next, ceiling: clamped } = scaleHeld(drag.held, drag.box, to, scaleContents);
      const by = new Map(next.map((m) => [m.id, m]));
      useStudio.setState({
        nodes: store.nodes.map((n) => {
          const m = by.get(n.id);
          if (!m) return n;
          const geo = { x: m.x, y: m.y, w: m.w, h: m.h };
          // A part that never set a size and still reads 1× keeps its font as it was.
          if (m.size === undefined || (m.size === 1 && n.font?.size == null)) return { ...n, ...geo };
          return { ...n, ...geo, font: { ...(n.font ?? {}), size: m.size } };
        }),
      });
      setDrag({ ...drag, moved: true, clamped });
      return;
    }

    if (drag.kind === "marquee") {
      const m = { x: Math.min(drag.startX, p.x), y: Math.min(drag.startY, p.y), w: Math.abs(dxRaw), h: Math.abs(dyRaw) };
      marqueeRef.current = m;
      setMarquee(m);
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
      /* Icon or Cube, chosen on the Draw row before drawing: carried, and
         honoured with or without a key (`tests/draw-kind-chips.mjs`). */
      want: (() => { const k = useStudio.getState().drawKind; return k === "icon" || k === "cube" ? k : null; })(),
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

  const onPointerUp = (e?: React.PointerEvent) => {
    if (!drag) return;
    const store = useStudio.getState();
    // The rectangle as the last move left it, rendered or not (see `marqueeRef`).
    const marquee = marqueeRef.current;
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
      /*
       * A BOX HE MOVED IS HIS FROM NOW ON.
       *
       * The healing in `textFit.ts` writes grown heights down and lays what
       * follows under them; it must never move a part he put somewhere on
       * purpose. This is the moment that becomes true — a drag or a resize
       * that actually travelled — so it is marked here rather than guessed
       * at later from the geometry.
       */
      const moved = new Set(drag.ids ?? [drag.nodeId!]);
      useStudio.setState({
        nodes: useStudio.getState().nodes.map((n) => (moved.has(n.id) && !n.byHand ? { ...n, byHand: true, handFrom: boxOf(drag.origin?.[n.id] ?? n) } : n)),
      });
      /* What holds what may have changed: the components are read again (`components.ts`). */
      rereadComponents();
      // Grid-snap only when no guide claimed the position: a guide is more exact than the grid.
      if (drag.kind === "resize" && drag.riders?.length) {
        /* A component resized whole is not snapped: its layers were placed on its box, and a snapped box would leave them a pixel off. */
      } else if (!drag.snapped && drag.riders?.length) {
        /* A control and what it holds snap as one: the lead's step to the grid, taken by all. */
        const ids = new Set(drag.ids ?? []);
        const lead = useStudio.getState().nodes.find((n) => n.id === drag.ids![0]);
        const sx = lead ? snapGrid(lead.x) - lead.x : 0;
        const sy = lead ? snapGrid(lead.y) - lead.y : 0;
        useStudio.setState({ nodes: useStudio.getState().nodes.map((n) => (ids.has(n.id) && !n.locked ? { ...n, x: n.x + sx, y: n.y + sy } : n)) });
      } else if (!drag.snapped) {
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
    } else if (drag.kind === "marquee" && marquee && (marquee.w > 3 || marquee.h > 3)) {
      /*
       * ONLY WHAT IT FULLY COVERS. His ruling: a marquee takes the parts,
       * drawings and wires wholly inside it, so drawing a box over a region
       * never picks up what lies behind it. And one that catches nothing
       * picks nothing: the press that began it on the bare page had picked
       * the background, and that is let go rather than kept.
       */
      const inside = (b: { x: number; y: number; w: number; h: number }) =>
        b.x >= marquee.x && b.y >= marquee.y && b.x + b.w <= marquee.x + marquee.w && b.y + b.h <= marquee.y + marquee.h;
      const hits = [
        ...nodes.filter(inside).map((n) => n.id),
        ...shapes.filter((sh) => inside(shapeBounds(sh))).map((sh) => sh.id),
      ];
      if (hits.length) {
        store.setSelection(hits);
        play("select");
      } else store.clearSelection();
    } else if (drag.kind === "marquee" && drag.from) {
      // A press on a part that holds others, let go without a drag: it is picked, with its group.
      const n = store.nodes.find((x) => x.id === drag.from);
      if (n) {
        store.setSelection(n.groupId ? store.nodes.filter((m) => m.groupId === n.groupId).map((m) => m.id) : [n.id]);
        play("select");
      }
    } else if (drag.kind === "group" && drag.moved) {
      const held = new Set(drag.ids ?? []);
      useStudio.setState({ nodes: useStudio.getState().nodes.map((n) => (held.has(n.id) && !n.byHand ? { ...n, byHand: true, handFrom: boxOf(drag.origin?.[n.id] ?? n) } : n)) });
      setCeiling(drag.clamped && drag.groupId ? { groupId: drag.groupId, which: drag.clamped } : null);
      play("tap");
    } else if (drag.kind === "draw" && tool === "space" && drag.points && drag.points.length >= 2) {
      // The space tool: a closed line is a placeholder (`space.ts`), an open one is nothing, and says so.
      /*
       * WEARING A STYLE. With a kit picked (`DrawKits.tsx`), a closed line
       * is not a space: it is a part in that shape, wearing the kit
       * (`wornShape.ts`), closed if its end came back near its start, and
       * snapped clean when the hand nearly drew a circle, triangle, box or
       * star. Its own popover opens beside it for colour and motion.
       */
      const wearing = useDrawKit.getState().kit;
      if (wearing && nearlyClosed(drag.points)) {
        const line = shapeFromLine(drag.points, { snap: useDrawKit.getState().snap });
        const shaped = toBox(line.pts);
        const raw = line.snap ? toBox(line.raw) : null;
        const worn = wornFor(wearing, { pts: shaped.pts, smooth: line.smooth, snap: line.snap }, raw, null);
        const id = store.addNode("box", shaped.box.x, shaped.box.y, { w: Math.max(16, shaped.box.w), h: Math.max(16, shaped.box.h), worn, label: `${wearing.name} shape`, byHand: true });
        store.setSelection([id]);
        /* Its colour, style, lighting bar and motion are its part panel's Look and Motion: open it there. */
        store.want({ panel: "inspector", id });
        play("confirm");
        news.publish({ key: "studio:worn", title: `Drawn wearing ${wearing.name}`, body: line.snap ? `Snapped to a clean ${line.snap}; its panel's Look section can put the line back as drawn.` : "Its colour and motion are in its panel's Look and Motion.", level: "success", source: "studio", toast: false });
      } else if (wearing && lineFromStroke(drag.points)) {
        /*
         * AN OPEN LINE, WEARING A STYLE: words along it. The line is where
         * the words go; they are lettered in the kit, and the part panel
         * asks what it is with "Words along a path" already chosen.
         */
        const line = lineFromStroke(drag.points)!;
        const worn: Worn = { ...wornFor(wearing, { pts: line.pts, smooth: true, snap: null }, null, null), open: true, what: "path", pathWords: { ...PATH_WORDS }, hover: false, press: false };
        const id = store.addNode("box", line.box.x, line.box.y, { w: line.box.w, h: line.box.h, worn, label: "Words along a path", content: PATH_WORDS_SAMPLE, byHand: true });
        store.setSelection([id]);
        store.want({ panel: "inspector", id });
        play("confirm");
        news.publish({ key: "studio:worn", title: `Words along a line, in ${wearing.name}`, body: "Change the words, their font and size in its panel.", level: "success", source: "studio", toast: false });
      } else if (isBoundary(drag.points)) { madeASpace(store.addSpace({ pageId: store.activePageId, boundary: drag.points, prompt: "", label: "" })); play("confirm"); }
      else {
        /* Said where the hand was, not in the corner of the window: the
           feed still gets the line, and the message itself is drawn on the
           line that was refused (`SpaceRefused`). */
        play("deny");
        setRefused({ points: drag.points, at: Date.now(), hand: e ? { x: e.clientX, y: e.clientY } : handAt.current ?? undefined });
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
        setRefused({ points: drag.points, at: Date.now(), hand: e ? { x: e.clientX, y: e.clientY } : handAt.current ?? undefined });
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
    marqueeRef.current = null;
    setInk(null);
    setGuides({ x: [], y: [] });
  };

  /* Grabbing while a pan is under way, an arrow otherwise. There is no pan
     tool to point at any more, so the cursor follows the drag rather than a
     mode: it changes when you actually start pushing the ground. */
  /* Every part is a `React.memo`, so what it is handed has to keep its identity
     between renders. A pan re-renders the board on every move, and a fresh
     `{ w, h }` or a fresh lead-in copy made every part redraw each time
     (`tests/pan-no-redraw.mjs`). */
  const pageBox = React.useMemo(() => ({ w: frameWidth, h: frameH }), [frameWidth, frameH]);
  /* Kept per part, so a part the hand is not on keeps the same object across a drag and its `NodeView` is not drawn again. */
  const leads = React.useMemo(() => leadsOf(steadyNodes), [steadyNodes]);
  const ledOf = React.useMemo(() => { const kept = new WeakMap<StudioNode, StudioNode>(); return (n: StudioNode) => { let v = kept.get(n); if (!v) { v = withLead(n, leads); kept.set(n, v); } return v; }; }, [leads]);
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
      data-board-tool={tool}
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
      {/*
        The page drawn AT the zoom, not drawn at 1:1 and shrunk.

        It was `scale(zoom)` on this box: the page laid out at its real size
        and the picture made smaller. At 0.79 a 4px border is 3.16 device
        pixels starting part-way into one, so each side of a box smeared
        differently — the owner's TG / X pills and BUY ON PUMP.FUN with
        stair-stepped, broken outlines, which the exported page never had.
        CSS `zoom` lays the page out at the zoomed size instead, so edges,
        borders and text land on whole pixels the way a browser at 79% draws
        a site. Every rectangle reads as it did (offsets stay unzoomed, the
        client rects zoomed), so turning a pointer into the page, the hit
        thresholds and the 1/zoom chips are unchanged. Words laid out zoomed
        never wrap onto more lines than at 1:1 (0 of 1824 widths × fonts ×
        zooms measured), so a part sized to its words stays one line. The pan
        stays a transform on the box outside, in screen pixels. What reads
        the words' drawn size back (the settle) reads it at 1:1
        (`textFit.ts#atFullSize`). `tests/board-crisp.mjs`.
      */}
      <div className="absolute left-0 top-0" style={{ transform: `translate(${pan.x}px, ${TOP_GUTTER + above}px)` }}>
      {/* `--chip-scale`: the 1/zoom a part's hover chips are drawn at, set here once so a zoom does not redraw every part to tell it (`NodeView.tsx`). */}
      <div data-board-zoom="" className="absolute left-0 top-0" style={{ zoom, "--chip-scale": Math.max(1, 1 / zoom) } as React.CSSProperties}>
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
          data-site-top={siteTop || undefined}
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
          className="absolute left-0 rounded-[3px] shadow-[0_20px_60px_oklch(0_0_0/0.45)]"
          style={{
            width: frameWidth,
            /* From the site's own top when a part of it reaches above the page's (`siteTop`). */
            top: siteTop,
            height: frameH - siteTop,
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
        {/*
          The page's name, standing on the page's top edge from outside.

          It was `top: -22` in page pixels with the words at 11 / zoom: the
          offset shrank with the zoom and the words did not, so at 51% the
          label sat 11 screen pixels up with 16 pixels of line, and its foot
          lay over the page's first row (PST's Home, its nav 8px down). Its
          foot is pinned to the page's top now and everything about it is
          sized in screen pixels, so it is the same 18px at every zoom and
          `TOP_GUTTER` always has room for it. `tests/board-top-edge.mjs`.
        */}
        <div
          data-page-label=""
          className="pointer-events-none absolute left-0 flex items-center gap-2 whitespace-nowrap text-fg-muted"
          style={{ bottom: `calc(100% + ${-siteTop}px)`, paddingBottom: LABEL_GAP / zoom, fontSize: 11 / zoom, lineHeight: `${LABEL_LINE / zoom}px` }}
        >
          <span className="font-medium text-fg">{page.name}</span>
          <span>{page.path}</span>
          <span className="num">{frameWidth} × {Math.round(frameH - siteTop)}</span>
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
          {marquee ? <rect data-marquee="" x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="var(--accent-soft)" stroke="var(--accent)" strokeDasharray="4 3" /> : null}
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
            /* The words of a captured row start after what stands before them (`parts/leadIn.ts`). */
            node={tryOn(ledOf(n), trying)}
            selected={selection.includes(n.id)}
            inHeldGroup={heldIds.has(n.id)}
            theme={theme}
            palette={palette}
            /* Only a picked part, or one wearing a question, draws anything sized by the zoom in script (its mark, handles, badge); every other
               part's chips read `--chip-scale`, so a zoom redraws the few that need it and not all of them (`tests/zoom-few-redraw.mjs`). */
            zoom={selection.includes(n.id) || ((decideAll || selection.includes(n.id)) && decide.has(n.id)) ? zoom : 1}
            light={look.light}
            page={pageBox}
            layers={look.texture}
            flash={!!fresh && fresh.nodes.includes(n.id)}
            decide={decideAll || selection.includes(n.id) ? decide.get(n.id) ?? null : null}
            name={names.get(n.id) ?? n.label}
          />
        ))}
        {/* Words typed where they are drawn (`WordsInPlace.tsx`). */}
        <WordsInPlace zoom={zoom} />

        {/*
          A held group, picked: one frame round the whole arrangement and
          eight handles on it, which resize every member as one thing
          (`groupScale.ts`). Over the parts, so its handles are never under
          one. Where the last resize met the text clamp it says so, under
          the frame, rather than the words quietly stopping.
        */}
        {held.map(({ g, b }) => (
          <div
            key={`held-${g.id}`}
            data-group-frame={g.id}
            className="pointer-events-none absolute z-20"
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, outline: `${(1.5 / zoom).toFixed(2)}px solid oklch(0.78 0.15 ${g.hue})`, outlineOffset: `${(3 / zoom).toFixed(2)}px` }}
          >
            {GROUP_HANDLES.map(([h, left, top]) => (
              <span
                key={h}
                data-group-resize={h}
                data-group-id={g.id}
                className="pointer-events-auto absolute size-2.5 rounded-[2px] border bg-panel"
                style={{ left, top, transform: `translate(-50%, -50%) scale(${Math.max(1, 1 / zoom)})`, borderColor: `oklch(0.78 0.15 ${g.hue})`, cursor: HANDLE_CURSOR[h] }}
              />
            ))}
            {ceiling?.groupId === g.id ? (
              <span
                data-group-ceiling={ceiling.which}
                className="absolute left-0 origin-top-left whitespace-nowrap rounded-sm border border-border bg-panel/95 px-1.5 py-0.5 text-small text-fg-muted shadow-sm"
                style={{ top: "calc(100% + 8px)", transform: `scale(${Math.max(1, 1 / zoom)})` }}
              >
                {ceiling.which === "largest"
                  ? "Words at their largest: 2× the site's size. The boxes kept growing."
                  : "Words at their smallest: 0.6× the site's size. The boxes kept shrinking."}
              </span>
            ) : null}
          </div>
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
      </div>

      {/* The panel for the one part picked inside an open black hole, and the surfaces forming (`SpaceLayer.tsx`). */}
      <SpaceSide />
      <SpaceForming />
      {/* A repository's import, run out of sight: no space, no panel (`FromASite.tsx`). */}
      <BringHost />
      {/* The Learn queue, one press for all of it (`LearnPanel.tsx`). */}
      <LearnBadge />
    </div>
  );
}
