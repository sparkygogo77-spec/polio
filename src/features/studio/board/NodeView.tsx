"use client";
import { RemakeOnPart } from "../RemakePicture";
import * as React from "react";
import { getFeature,categoryOf } from "../catalog";
import { isOverlay } from "../parts";
import { pageClip } from "../pageClip";
import { leadsOf } from "../parts/leadIn";
import { Block,themeFrom } from "../blocks";
import { LiveSite,PartCopy,resolvePageLink } from "../live/LiveSite";
import { placeNodes } from "../live/layout";
import { resolvePalette } from "../parts/theme";
import { AlignCenter,AlignLeft,AlignRight,StretchHorizontal } from "lucide-react";
import { CORNERS,handlePoints } from "../outlineHandles";
import { auraFilter,auraStyle,markColour,type Light,type Palette,type TextureLayer } from "../look";
import { liftVars } from "../lightRig";
import { heldSays } from "../learn";
import { IMPORT_SETTLE_MS,useArrival } from "../ImportFlow";
import { useBoxEntry } from "../boxEntry";
import { seesThrough,usePicture } from "../pictures";
import {
useStudio,type StudioNode
} from "./store";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { openRadial } from "../RadialMenu";
import { type Decision } from "../library/badge";
import { getWork,usesOf } from "../library/works";
import { missingDrawnCopy,namesDrawnCopy } from "../promised";
import { plain } from "../parts/spans";

import { looksOnBoard,liftedOnBoard,shownOnBoard,placedOnBoard,screenHoles,HANDS_ON } from "./helpers";
import { HANDLE_CURSOR,HANDLES } from "./ShapeView";

/**
 * Fill: a tab under the selected part that opens, on hover, into the four
 * things you reach for while sizing — fill the width, centre it, push it to
 * either edge. It used to be a Size choice in the menu with number fields,
 * which is a form for something your hand is already doing on the board.
 */
export function FillTab({ node, chipScale }: { node: StudioNode; chipScale: number }) {
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
export function BoardSurface({ target, on, box }: { target: string; on: string; box: { w: number; h: number } }) {
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

/** A part of this page and what stands inside it, drawn into a box on the board: a "What's new" step's preview (`PartCopy`). */
export function BoardPartCopy({ of, pageId, box }: { of: string; pageId: string; box: { w: number; h: number } }) {
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const frameWidth = useStudio((s) => s.frameWidth);
  const page = React.useMemo(() => nodes.filter((n) => n.pageId === pageId), [nodes, pageId]);
  const placed = React.useMemo(() => placeNodes(page, "desktop", frameWidth).placed, [page, frameWidth]);
  const leads = React.useMemo(() => leadsOf(page), [page]);
  const t = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  return <PartCopy of={of} box={box} placed={placed} leads={leads} t={t} palette={palette} light={look?.light} look={look} still />;
}

/**
 * The words a picked part's prompt names and the part is not drawing.
 *
 * It used to be a "1 NOT SHOWN" badge inside every unpicked part, bottom
 * right: on a 32×32 header button it wrapped to 42×22, covered the icon it
 * was about and spilled onto the part beside it, and picking the part hid
 * it, because a picked part is drawn live and the badge was board-only. His
 * ruling: nothing until he picks the part, and then say what is missing. So
 * it is read here, only while the part is picked, and written on the label
 * chip above the part rather than on the part.
 *
 * It reads what the part drew, not the node: a part handed four lines and
 * built for three keeps all four on the node and draws three. It reads the
 * part's own `[data-part]` body, else the whole drawn surface for the few
 * parts that draw no words (the drawn icon), and it reads twice, after the
 * paint and a beat later, because some parts fill themselves over a frame
 * or two. The accessible names a capture writes into a prompt are not copy
 * he asked for (`missingDrawnCopy`), so a button that is an icon in a box
 * is never told its screen-reader name is missing.
 */
export function useUnshown(node: StudioNode, body: React.RefObject<HTMLDivElement | null>, selected: boolean): string[] {
  const [missing, setMissing] = React.useState<string[]>([]);
  const prompt = node.prompt ?? "";
  /*
   * A picture that did not arrive is missing too, and is said by its own
   * name. The accessible name is not copy (see above), but on a picture it
   * is the picture's name, and a picture the node holds that this browser
   * does not have, or that failed to load, is exactly the "something is
   * missing" he asked to be told about. Read off what was drawn, not off
   * the node: `[data-picture-lost]` is `PictureSlot`'s own mark for a file
   * the browser no longer holds, and a broken image is one that finished
   * with no pixels. A stand-in picture never had a file and is not missing.
   */
  const pictureName = /\bnamed\s+["\u201c]([^"\u201d\n]+)["\u201d]/.exec(prompt)?.[1] || node.picture?.alt?.trim() || node.label;
  const asks = selected && (namesDrawnCopy(prompt) || !!node.picture);
  const watch = [plain(node.content), node.data ?? "", JSON.stringify(node.options ?? {}), JSON.stringify(node.picture ?? null), node.w, node.h].join("|");
  React.useEffect(() => {
    if (!asks) { setMissing((was) => (was.length ? [] : was)); return; }
    let live = true;
    const read = () => {
      const surface = body.current?.querySelector<HTMLElement>("[data-mode]") ?? null;
      const drawn = surface?.querySelector<HTMLElement>("[data-part]") ?? surface;
      if (!live || !drawn) return;
      const lost = !!node.picture && (!!drawn.querySelector("[data-picture-lost]")
        || [...drawn.querySelectorAll("img")].some((img) => img.complete && img.naturalWidth === 0));
      const next = [
        ...(lost ? [`the picture \u201c${pictureName}\u201d`] : []),
        ...missingDrawnCopy(prompt, drawn.innerText ?? "").map((w) => `\u201c${w}\u201d`),
      ];
      setMissing((was) => (was.length === next.length && was.every((w, i) => w === next[i]) ? was : next));
    };
    const frame = requestAnimationFrame(read);
    const later = window.setTimeout(read, 450);
    return () => { live = false; cancelAnimationFrame(frame); window.clearTimeout(later); };
  }, [asks, prompt, watch, body, node.picture, pictureName]);
  return asks ? missing : [];
}

/** A part pinned to the window and as wide as the page: a dimmed screen over it, such as a tour's (`boardStates.ts#keepOverlaysOnPage` stretches it over the page). */
export const isScreenShade = (n: { w: number; from?: { position?: string } | null }, pageW: number) => n.from?.position === "fixed" && pageW > 0 && n.w >= pageW * 0.9;
/** A mask that is the whole part less each "x,y,w,h" box. */
export function holeMask(holes: string): React.CSSProperties {
  const boxes = holes.split(";").map((h) => h.split(",").map(Number));
  const layer = (n: number) => Array(n).fill("linear-gradient(#000,#000)").join(",");
  return {
    maskImage: layer(boxes.length + 1),
    maskRepeat: "no-repeat",
    /* The holes on top, the whole part at the bottom; each hole cuts itself out of what is under it. */
    maskPosition: [...boxes.map(([x, y]) => `${x}px ${y}px`), "0 0"].join(","),
    maskSize: [...boxes.map(([, , w, h]) => `${w}px ${h}px`), "100% 100%"].join(","),
    maskComposite: Array(boxes.length + 1).fill("exclude").join(","),
  } as React.CSSProperties;
}
export const NodeView = React.memo(function NodeView({ node, name, selected, inHeldGroup, theme, palette, zoom, light, page, layers, flash, decide }: { node: StudioNode; name: string; selected: boolean; inHeldGroup?: boolean; theme: ReturnType<typeof themeFrom>; palette: Palette; zoom: number; light?: Light; page: { w: number; h: number }; layers?: TextureLayer[]; flash?: boolean; decide?: Decision["why"] | null }) {
  // What a picked part is marked in: the far side of its own aura or fill.
  // Not the app's accent, which was the loudest thing on the board and sat
  // on top of the aura you were editing.
  const mark = React.useMemo(() => markColour(node, palette), [node, palette]);
  /*
   * A see-through picture not yet marked so (cleared before the mark
   * existed, or a logo that came see-through): looked at once, at its
   * corners, and marked, so it wears no frame (`parts/primitives.tsx`).
   * Quietly: it is the board noticing, not an edit to undo.
   */
  const unmarked = node.picture && !node.picture.seeThrough ? node.picture : null;
  const { src: unmarkedSrc } = usePicture(unmarked);
  React.useEffect(() => {
    if (!unmarked || !unmarkedSrc) return;
    let live = true;
    void seesThrough(unmarkedSrc).then((clear) => {
      if (!live || !clear) return;
      const now = useStudio.getState().nodes.find((n) => n.id === node.id)?.picture;
      if (now?.id === unmarked.id && !now.seeThrough) useStudio.getState().updateNodeQuiet(node.id, { picture: { ...now, seeThrough: true } });
    });
    return () => { live = false; };
  }, [node.id, unmarked?.id, unmarkedSrc]); // eslint-disable-line react-hooks/exhaustive-deps
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
  /* Script-sized only where this part is picked or asks a question; the hover chips read `--chip-scale` off the board (`DesktopCanvas.tsx`). */
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
  /* A part of a hidden state is drawn only while that state is on (the States control, `boardStates.ts`). */
  const shownHere = useStudio((s) => shownOnBoard(s)(node));
  /* Drawn where a lit screen draws it, so two states in one flow do not sit on top of each other. */
  const place = useStudio((s) => placedOnBoard(s).get(node.id));
  const lifted = useStudio((s) => liftedOnBoard(s).has(node.id));
  /* A dimmed screen leaves the outline it holds bright: a hole in its fill over each one. */
  const shade = isScreenShade(node, page.w);
  const holes = useStudio((s) => (shade ? screenHoles(s, node) : ""));
  /* Its words and picture as the step picked has them ("You lost.", FINAL, the match's chart): the board's drawing only, the part keeps its own. */
  const stepLook = useStudio((s) => looksOnBoard(s).get(node.id));
  /* …in the box the state draws it in, so words that wrap there wrap here (the tour's text: four lines, not one). */
  const drawn = React.useMemo(() => (stepLook || place ? ({ ...node, ...stepLook, ...(place ? { w: place.w, h: place.h } : {}) } as StudioNode) : node), [node, stepLook, place]);
  // What his prompt named and this part is not drawing: read only while it is picked. See `useUnshown`.
  const unshown = useUnshown(node, body, selected);
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
      /* Picked, for a check to ask without reading the store. */
      data-picked={selected ? "" : undefined}
      onPointerDown={(e) => {
        // The wheel opens on the press, not on the release — so the same hold
        // that opened it can carry straight on into pulling the line out. On
        // the release it opened a beat late and you had to press again to get
        // anywhere, which is two gestures for one thing.
        if (e.button !== 2) return;
        e.preventDefault();
        e.stopPropagation();
        /* A part already in a picked set keeps the set: the wheel's edits go to every picked part (RadialMenu's applyToSelection). */
        const st = useStudio.getState();
        if (!st.selection.includes(node.id)) st.setSelection([node.id]);
        openRadial(node.id, e.clientX, e.clientY);
      }}
      onContextMenu={(e) => {
        // The wheel, not a twenty-item list. Stops the global menu from opening too.
        e.preventDefault();
        e.stopPropagation();
      }}
      /* An inert part (sink: the page's grain over everything) lets a press through to what is under it (`tests/board-inert.mjs`). Hit-testing only. */
      /* A dimmed screen pinned over the whole window (PST's intro tour) is never grabbed off the board, picked or not: a press goes to what is on it, its card (J, 2026-10-06: dragging moved the dim). It is still picked from the Panels list or the layers. */
      className={cn("group absolute cursor-grab active:cursor-grabbing", ((node as { inert?: boolean }).inert && !selected) || isScreenShade(node, page.w) ? "pointer-events-none" : "pointer-events-auto", node.locked && "cursor-not-allowed", flash && "node-snap")}
      style={{
        left: place?.x ?? node.x, top: place?.y ?? node.y, width: place?.w ?? node.w,
        /* A minimum, not a height: the part grows past it when its words
           need the room. `parts/primitives.tsx` holds the reasoning. */
        minHeight: place?.h ?? node.h, display: "flex", flexDirection: "column",
        /* A part stepped through on the board stands over its neighbours (`liftedOnBoard`). */
        ...(lifted ? { zIndex: 4 } : {}),
        ...(holes ? holeMask(holes) : {}),
        // Its turn has not come: not drawn, but holding its place, so
        // nothing measures a different page while a run is arriving.
        ...(held ? { opacity: 0 } : {}),
        /* A part a press shows (sink `behaviours.states`): the board lays out the page as it opens, so it is not drawn here; the press plays in the Preview and on the published page. */
        ...(!shownHere ? { display: "none" } : {}),
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
      {/*
        WHAT ITS BOX CUTS OFF, FAINTLY, WHILE IT IS PICKED. A part cut to the
        rounded box it sits in (`art.clipPath`: the picture in the TV's screen,
        the CA bar's yellow ends) is drawn cut, as the site draws it; picked,
        the rest of it shows at a quarter strength under it, so what is being
        moved or resized is the whole part and not only its window. It takes
        no pointer and is not the part (`tests/clips-and-turns.mjs`).
      */}
      {selected && node.art?.clipPath ? (
        <div data-cut-ghost="" aria-hidden inert className="pointer-events-none absolute inset-0 flex flex-col" style={{ opacity: 0.25 }}>
          <Block node={{ ...node, art: { ...node.art, clipPath: undefined } }} t={theme} palette={palette} light={light} page={page} layers={layers} mode="board" />
        </div>
      ) : null}
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
        /* A part its own transform moves (the site's translateY(24px) rotate on
           trumpmorty.fun's roadmap cards) is drawn whole where it moved, as
           Preview and the export draw it; clipped here it lost its lower 22px
           (`tests/board-turned.mjs`). */
        /* Nor is a line of words the document holds on one line (`Prose`,
           `data-one-line`): set in another machine's font it can need more
           than the width the capture measured, and cut here it lost its end
           (PST's title, "PonsStars test pag": 334px of words in 314).
           Drawn whole, as the page and the Preview draw it
           (`tests/tv-import.mjs`, 7). */
        className={cn("relative flex w-full flex-col", node.art?.transform || node.worn ? "overflow-visible" : "overflow-hidden has-[[data-one-line]]:overflow-visible")}
        data-part-drawn=""
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
          // Cut at the page's edge, as the site is (`pageClip.ts`).
          clipPath: pageClip(node, page.w),
        }}
      >
        <Block
          node={drawn}
          t={theme}
          palette={palette}
          light={light}
          page={page}
          layers={layers}
          /* A card over the page ("What's new") stays drawn open where it is edited: live, it is closed until its feature opens it. */
          mode={selected && !isOverlay(node.featureId) ? "live" : "board"}
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
          /* A "What's new" step's preview: the part it is about, drawn here as the board draws it. */
          partView={node.featureId === "whats-new" ? (of, box) => <BoardPartCopy of={of} pageId={node.pageId} box={box} /> : undefined}
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
          style={{ top: `calc(100% + 8px)`, transform: "scale(var(--chip-scale, 1))" }}
        >
          <span className="mb-0.5 block font-medium text-fg">{feature.name}</span>
          {feature.explain ?? feature.blurb}
        </div>
      ) : null}

      {/* A picture being remade says so on the part, with Cancel (RemakePicture.tsx). */}
      <RemakeOnPart nodeId={node.id} />
      {/* label chip: what this is, in the builder's words */}
      <div
        className={cn("pointer-events-none absolute left-0 flex origin-bottom-left items-center gap-1 whitespace-nowrap rounded-sm border border-border bg-panel/95 px-1.5 py-0.5 text-small text-fg shadow-sm transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
        style={{ top: -6, transform: "translateY(-100%) scale(var(--chip-scale, 1))" }}
      >
        {node.glyph ? <span>{node.glyph}</span> : Icon ? <Icon className="size-3" style={{ color: `oklch(0.8 0.15 ${hue})` }} /> : null}
        {/* The side panel's readable name (`partNames.ts`), never the capture's "div · 1 inside". */}
        <span data-part-tag="" className="font-medium">{name}</span>
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
        {node.work && getWork(node.work.id) ? <span data-work-chip={node.work.id} className="rounded-xs border border-border px-1 text-fine text-fg-muted">⚡ {usesOf(node.work).map((u) => getWork(u.id)?.manifest.name).filter(Boolean).join(" + ")}</span> : null}
        {node.task?.trim() ? <span data-task-chip="" className="max-w-[220px] truncate rounded-xs border border-border px-1 text-fine text-fg-faint" title={node.task}>task: {node.task}</span> : null}
        {/* The words his prompt named and the part is not drawing, on the chip above it: outside the part, and only while it is picked. */}
        {unshown.length ? (
          <span
            data-asked-for={unshown.length}
            title={`Not showing ${unshown.join(", ")}.`}
            className="max-w-[320px] truncate rounded-xs border px-1 text-fine"
            style={{ borderColor: "oklch(0.7 0.12 70 / 0.6)", background: "oklch(0.22 0.09 62 / 0.78)", color: "oklch(0.9 0.09 82)" }}
          >
            not shown: {unshown.join(" · ")}
          </span>
        ) : null}
        {node.priority !== "must" ? <span className="rounded-xs border border-border px-1 text-fine uppercase text-fg-faint">{node.priority}</span> : null}
        {node.locked ? <span className="text-fine text-fg-faint">locked</span> : null}
      </div>

      {/* A member of a held group is sized by the group's frame, not by handles of its own. */}
      {selected && !node.locked && !inHeldGroup
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
      {selected && !node.locked && !inHeldGroup ? <FillTab node={node} chipScale={chipScale} /> : null}
      {/* Not on a part only its code shows (a hidden state's buttons: the trade knobs, the tour's dots): what it does is its code's, and a badge on each stacked over the state (J, 2026-10-05). */}
      {decide && !node.state ? <DecideBadge node={node} why={decide} chipScale={chipScale} /> : null}
    </div>
  );
});

/**
 * The orange !: this part still needs a decision.
 *
 * On the picked part, when it goes nowhere or is a live-data spot
 * (`library/badge.ts`); on all of them only while the top bar's count is
 * pressed (`decideShown.ts`). In the Builder only: it is drawn by the board over
 * the part, never by the part, so a published page cannot carry it. It sits
 * just above the part's top-right corner rather than on the part, because a
 * badge inside a 16px icon covers the icon it is about. Pressing it opens the
 * one box (`SayBox.tsx`) on that part; answering it takes the ! away.
 *
 * Except near the page's top edge. PST's nav sits 8px down, so the four
 * badges on its links stood across the page's edge and up into its name,
 * and the top of the page read as cut off. A part whose badge would reach
 * above the page wears it under its bottom-right corner instead: still off
 * the part's words, and now off the edge and the label too, at any zoom
 * (the room is worked out in page pixels from the badge's drawn size).
 * `tests/board-top-edge.mjs`.
 */
export const BADGE = 14;
export function DecideBadge({ node, why, chipScale }: { node: StudioNode; why: Decision["why"]; chipScale: number }) {
  /* Why a capture held its press back, said on hover after the ask (`learn.ts`). */
  const held = useStudio((s) => (s.learn ? heldSays(s.learn, node.id) : null));
  const said = why === "live" ? "Live data: say where it comes from" : "Goes nowhere yet: say what it does";
  const say = held ? `${said}. ${held.charAt(0).toUpperCase()}${held.slice(1)}` : said;
  /* The badge's height on the page with its gap and a little air: above the part only if that fits under the page's edge. */
  const under = node.y < (BADGE + 4) * chipScale && node.y + node.h > 0;
  return (
    <button
      type="button"
      data-decide={why}
      data-decide-for={node.id}
      data-decide-under={under ? "" : undefined}
      aria-label={say}
      title={say}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => {
        e.stopPropagation();
        play("open");
        useStudio.getState().setSelection([node.id]);
        /* The part's own panel opens beside it, with the decision and its fix at the top. */
        useStudio.getState().want({ panel: "inspector" });
        openRadial(node.id, e.clientX, e.clientY, null, "write");
      }}
      className={`tactile pointer-events-auto absolute right-0 ${under ? "top-full" : "top-0"} z-[4] flex items-center justify-center rounded-full font-bold leading-none`}
      style={{
        width: BADGE,
        height: BADGE,
        fontSize: 10,
        transform: under ? `translate(35%, 2px) scale(${chipScale})` : `translate(35%, calc(-100% - 2px)) scale(${chipScale})`,
        transformOrigin: under ? "left top" : "left bottom",
        background: "oklch(0.74 0.18 55)",
        color: "oklch(0.2 0.05 50)",
        boxShadow: "0 0 0 1.5px oklch(0.2 0.03 50), 0 1px 3px oklch(0 0 0 / 0.5)",
      }}
    >
      !
    </button>
  );
}
