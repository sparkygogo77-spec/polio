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
import { pictureOf } from "./reshapeRun";
import { describeSketch } from "./sketch";
import { resolvePalette } from "./parts/theme";
import { AlignCenter, AlignLeft, AlignRight, StretchHorizontal, Scissors, Sparkles, Ungroup } from "lucide-react";
import { inkGroups, nearestTo, type InkGroup } from "./inkGroups";
import { auraStyle, complementOf, markColour, washCss, type Light, type Palette, type TextureLayer } from "./look";
import { liftVars } from "./lightRig";
import { linkReason } from "./links";
import { TextureDrift } from "./TextureDrift";
import { Workspace } from "./Workspace";
import { BACKGROUND_ID } from "./store";
import {
  activePage, frameHeight, groupBounds, pageGroups, pageNodes, pageShapes, shapeBounds,
  useStudio, type StudioNode, type StudioShape,
} from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { openRadial, pageSpot } from "./RadialMenu";

const GRID = 8;

/** Parts that take the pointer on the board once they are selected. See `handsOn`. */
const HANDS_ON = new Set(["cube-3d"]);

/** Parts that wear a drawn icon when one is dropped on them. */
const WEARS_AN_ICON = new Set(["cta-primary", "quick-action", "follow"]);
/** Breathing room either side of the page. Small: the page is the point. */
const FRAME_GUTTER = 48;
/** How far below the top of the viewport the page rests. */
const TOP_MARGIN = 36;

/** The screen each device actually has, so the frame is a real viewport. */
const SCREEN_H: Record<number, number> = { 1440: 900, 834: 1112, 390: 844 };
const snapGrid = (v: number) => Math.round(v / GRID) * GRID;
const MIN_W = 40;
const MIN_H = 24;

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Drag {
  kind: "node" | "marquee" | "pan" | "draw" | "resize" | "erase";
  startX: number;
  startY: number;
  ids?: string[];
  /** Original rects at drag start, so positions are set absolutely (and snapped) each move. */
  origin?: Record<string, { x: number; y: number; w: number; h: number }>;
  points?: [number, number][];
  nodeId?: string;
  handle?: Handle;
  startPan?: { x: number; y: number };
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
  const nodes = useStudio(useShallow(pageNodes));
  const shapes = useStudio(useShallow(pageShapes));
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
  const zoom = useStudio((s) => s.zoom);
  const pan = useStudio((s) => s.pan);
  const inkHue = useStudio((s) => s.inkHue);
  const inkWidth = useStudio((s) => s.inkWidth);
  const frameWidth = useStudio((s) => s.frameWidth);
  const showWires = useStudio((s) => s.showWires);
  const fitNonce = useStudio((s) => s.fitNonce);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const theme = React.useMemo(() => themeFrom(format, look), [format, look]);
  const wash = React.useMemo(() => washCss(look.light), [look.light]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const pageMark = React.useMemo(() => complementOf(theme.backdrop), [theme.backdrop]);
  const pageScroll = useStudio((s) => s.pageScroll);
  /*
   * Two heights, where there used to be one.
   *
   * `pageH` is the site: however far down the last part reaches. `frameH` is
   * one screen of it — the frame is a window on the page now, not the whole
   * of it laid out flat. The board used to grow downwards as a site got
   * deeper, until seeing the foot of it meant scrolling the workspace and the
   * parts shelf had gone somewhere below the horizon. A window the shape of
   * the viewer's own viewport, with the site scrolling inside it, is what the
   * live preview shows and what a visitor will see.
   */
  const pageH = frameHeight(nodes);
  const [viewport, setViewport] = React.useState({ w: 1440, h: 900 });
  const frameH = React.useMemo(() => {
    /*
     * One screen of the site, in the shape a screen is.
     *
     * Each frame width is a real device, so each has a real viewport to go
     * with it: a desktop page is 1440×900, a tablet 834×1112, a phone
     * 390×844. That is what makes the board feel 1:1 with the preview — it
     * is the same rectangle a visitor will have. The pane's own shape leans
     * it a little either way, and no further: a board pane that happens to
     * be short and wide must not turn the site into a letterbox.
     */
    const stock = SCREEN_H[frameWidth] ?? Math.round(frameWidth * 0.625);
    const ratio = stock / frameWidth;
    const lean = Math.max(0.9, Math.min(1.1, (viewport.h / Math.max(1, viewport.w)) / ratio));
    return Math.round(frameWidth * ratio * lean);
  }, [frameWidth, viewport]);
  /** How far the page can scroll inside its window. */
  const scrollMax = Math.max(0, pageH - frameH);
  const scrolled = Math.min(pageScroll, scrollMax);

  const [drag, setDrag] = React.useState<Drag | null>(null);

  /* `data-board-drag` used to be set here for the length of a drag, and the
     ground held still while it was. The ground does not stop for anything
     now — the pause was paying for a per-frame cloud repaint that no longer
     exists — so nothing reads the flag and nothing writes it. */
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ink, setInk] = React.useState<[number, number][] | null>(null);
  // A wire that has just joined two parts: the wire draws itself on and
  // both parts ring once. Kept for half a second, then forgotten.
  const [fresh, setFresh] = React.useState<{ wire: string; nodes: string[] } | null>(null);
  React.useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => setFresh(null), 700);
    return () => window.clearTimeout(t);
  }, [fresh]);
  const [guides, setGuides] = React.useState<Guides>({ x: [], y: [] });

  /** Screen → canvas coordinates. */
  const toCanvas = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom + scrolled };
    },
    [pan.x, pan.y, zoom, scrolled],
  );

  /* ---------------------------------------------------- fit the frame
   *
   * The page is the point, so both of its side edges are always on screen with
   * only a small gutter, and the board never zooms out past that — shrinking
   * the window narrows the gutter and then stops. Taller than the viewport is
   * fine: that is what scrolling is for.
   */
  const fitZoom = React.useCallback(
    (vw: number, vh: number, fh: number) =>
      // Both ways at once, and a little short of either: the whole screen of
      // the site is in the pane with the ground showing all the way round it,
      // which is what says "this is a page standing on something" rather than
      // "this is the window".
      Math.max(0.2, Math.min(1, Math.min((vw - FRAME_GUTTER) / frameWidth, (vh - FRAME_GUTTER) / Math.max(1, fh)))),
    [frameWidth],
  );

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewport({ w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) });
    const apply = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      const stock = SCREEN_H[frameWidth] ?? Math.round(frameWidth * 0.625);
      const lean = Math.max(0.9, Math.min(1.1, (vh / Math.max(1, vw)) / (stock / frameWidth)));
      const fh = Math.round(stock * lean);
      const z = fitZoom(vw, vh, fh);
      useStudio.getState().setZoom(z);
      useStudio.getState().setPan({
        x: Math.round((vw - frameWidth * z) / 2),
        // Centred, not pinned to the top: there is no page below the fold to
        // leave room for any more.
        y: Math.max(TOP_MARGIN / 2, Math.round((vh - fh * z) / 2)),
      });
    };
    measure();
    apply();
    // The frame is the pane's own shape, so a pane that changes shape is a
    // frame that changes shape: re-measure and re-seat every time.
    const ro = new ResizeObserver(() => { measure(); apply(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitNonce, frameWidth, fitZoom]);

  /* ------------------------------------------------------------- wheel */
  /*
   * The wheel scrolls the site, inside its frame.
   *
   * It used to pan the board down until the page ran out and then hand the
   * gesture to the column, which is how a deep site pushed the parts shelf
   * off the bottom of the world. The frame is one screen now, so the wheel
   * does what it does in a browser: moves the page behind the frame's edge,
   * and stops at the foot of it. The board's own pan is still there on the
   * middle button and the pan tool, for moving the frame about the ground.
   */
  const reach = React.useRef({ max: 0 });
  reach.current.max = scrollMax;
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
      const max = reach.current.max;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, store.pageScroll + e.deltaY));
      if (next === store.pageScroll) return;
      e.preventDefault();
      store.setPageScroll(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---------------------------------------------------------------- drop */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
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
      const ys = [0];
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
    [nodes, zoom, frameWidth],
  );

  /* ------------------------------------------------------------- pointer */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const p = toCanvas(e.clientX, e.clientY);
    const target = e.target as HTMLElement;
    const nodeEl = target.closest?.("[data-node-id]") as HTMLElement | null;
    const handleEl = target.closest?.("[data-resize]") as HTMLElement | null;
    const store = useStudio.getState();
    const capture = () => (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (e.button === 1 || tool === "pan" || (tool === "select" && e.altKey)) {
      capture();
      setDrag({ kind: "pan", startX: e.clientX, startY: e.clientY, startPan: pan });
      return;
    }

    // A resize handle only wins while you are actually pointing at things. With
    // the pen or the region tool in hand you are drawing, and a handle that
    // happens to be under the first pixel of the stroke is not an instruction.
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
    setInk([[p.x, p.y]]);
    setDrag({ kind: "draw", startX: p.x, startY: p.y, points: [[p.x, p.y]] });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const store = useStudio.getState();

    if (drag.kind === "pan") {
      store.setPan({ x: (drag.startPan?.x ?? 0) + (e.clientX - drag.startX), y: (drag.startPan?.y ?? 0) + (e.clientY - drag.startY) });
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
      const ids = new Set(drag.ids);
      const rects = drag.ids.map((id) => ({ ...drag.origin![id]!, x: drag.origin![id]!.x + dxRaw, y: drag.origin![id]!.y + dyRaw }));
      const snap = snapSelection(rects, ids);
      const positions: Record<string, { x: number; y: number }> = {};
      for (const id of drag.ids) positions[id] = { x: Math.round(drag.origin[id]!.x + dxRaw + snap.dx), y: Math.round(drag.origin[id]!.y + dyRaw + snap.dy) };
      store.setPositions(positions);
      setGuides(snap.guides);
      setDrag({ ...drag, moved: true, snapped: snap.snapped });
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
      const pts: [number, number][] = tool === "pen" ? [...(drag.points ?? []), [p.x, p.y]] : [[drag.startX, drag.startY], [p.x, p.y]];
      setDrag({ ...drag, points: pts });
      setInk(pts);
      return;
    }

    if (drag.kind === "erase") {
      // The sweep. Drawings only: a part under a passing eraser is not an
      // instruction, and a part is erased by pressing on it.
      const live = store.shapes.filter((sh) => sh.pageId === page.id);
      const hit = hitShape(live, p.x, p.y, 10 / zoom);
      if (!hit) return;
      // One step back for the whole sweep, written by whichever came first:
      // the press, or this hit.
      if (!drag.moved) {
        store.commit();
        setDrag({ ...drag, moved: true });
      }
      useStudio.setState((s) => ({ shapes: s.shapes.filter((sh) => sh.id !== hit.id), selection: s.selection.filter((id) => id !== hit.id) }));
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
    } else if (drag.kind === "draw" && drag.points && drag.points.length >= 2) {
      const kind = tool === "pen" ? "pen" : tool === "frame" ? "frame" : "arrow";
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

  const cursor = tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <div
      ref={ref}
      {...ctxProps("studio-canvas", page.id, page)}
      className="relative size-full touch-none overflow-hidden bg-bg select-none"
      style={{ cursor }}
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
      <Workspace />

      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {/*
          The window on the site.
          
          Everything inside it is clipped to one screen, and the site itself
          slides behind that edge as the wheel is turned. The frame used to be
          the whole page laid out flat, which grew downwards for ever and put
          the foot of a long site somewhere below the workspace's own horizon.
        */}
        <div
          data-page-window=""
          className="absolute left-0 top-0 overflow-hidden rounded-[3px]"
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
            ...(theme.surfaceStyle ?? { background: theme.backdrop, backgroundSize: "24px 24px" }),
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
          style={{ width: frameWidth, height: pageH, transform: `translateY(${-scrolled}px)` }}
        >
        <TextureDrift layers={look.texture} palette={palette} />
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
          {scrollMax > 0 ? (
            <span className="text-fg-faint">
              · <span className="num">{Math.round(pageH)}</span> deep{scrolled > 0 ? <> · <span className="num">{Math.round(scrolled)}</span> down</> : null}
            </span>
          ) : null}
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
          {ink && ink.length >= 2 ? <ShapeView shape={{ id: "live", pageId: "", kind: tool === "pen" ? "pen" : tool === "frame" ? "frame" : "arrow", points: ink, hue: inkHue, width: inkWidth, label: "", prompt: "" }} selected /> : null}
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
              className="absolute cursor-default rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
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
                  className="tactile flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium shadow-sm"
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
                    className="tactile flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] shadow-sm"
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
                    className="tactile flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] shadow-sm"
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
            <div key={`label-${sh.id}`} className="pointer-events-none absolute max-w-[180px] truncate rounded-sm px-1 text-[10px]" style={{ left: b.x + (data ? b.w / 2 - 20 : 0), top: b.y + (data ? b.h / 2 - 8 : -16), color: `oklch(0.78 0.15 ${sh.hue})` }}>
              {data ? `⛓ ${sh.label || "data"}` : sh.label || "✎"}
            </div>
          );
        })}
        </div>
        </div>
      </div>

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

const ShapeView = React.memo(function ShapeView({ shape, selected, fresh, reason }: { shape: StudioShape; selected: boolean; fresh?: boolean; reason?: string }) {
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
                    className="max-w-full truncate rounded-full border px-1.5 py-[3px] text-[10px] font-medium leading-none"
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
  return <path {...common} d={penPath(shape.points)} strokeLinecap="round" strokeLinejoin="round" />;
});

/**
 * The corners are squares; the edges are the edges.
 *
 * A dot in the middle of an edge is a target the size of a dot. The whole
 * edge is a bar you can take hold of anywhere along it, drawn thin so it
 * reads as the part's outline rather than as a frame round it.
 */
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
  const btn = "tactile flex h-5 items-center justify-center gap-1 rounded-sm px-1.5 text-[9px] text-fg-muted hover:bg-panel hover:text-fg";
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
   * The parts that are worth touching on the board itself, once they are
   * the selected one. A very short list on purpose: a part earns a place
   * here only when looking at it tells you nothing and handling it tells
   * you everything.
   */
  const handsOn = selected && HANDS_ON.has(node.featureId);
  const cat = feature ? categoryOf(feature.category) : null;
  const hue = node.hue ?? cat?.hue ?? 265;
  const Icon = feature?.icon;
  const hasPrompt = node.prompt.trim().length > 0;
  const chipScale = Math.max(1, 1 / zoom);

  return (
    <div
      data-node-id={node.id}
      {...ctxProps("studio-node", node.id, node)}
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
        left: node.x, top: node.y, width: node.w, height: node.h,
        // The aura belongs to the element, not to anything inside it.
        ...((auraStyle(node.aura, palette, node.auraSize, node.auraStyle) ?? {}) as React.CSSProperties),
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
        className="absolute inset-0 overflow-hidden"
        data-mode={selected ? "live" : "board"}
        data-lit={lift ? "" : undefined}
        /*
         * Every part on the board is inert, and has to be: the canvas is a
         * layout surface, and a part that took the pointer could not be
         * picked up or moved.
         *
         * One exception, and it is the whole point of the part it is for. A
         * cube is a thing you turn; a cube you cannot turn is a picture of a
         * cube. So when it is the selected part — already the state that
         * means "I am working on this one" — it takes the pointer and the
         * keys. Unselected it is inert like everything else, which is how it
         * is still dragged around the page: click the ground to let go of
         * it, then drag it.
         */
        inert={handsOn ? undefined : true}
        style={{
          pointerEvents: handsOn ? "auto" : "none",
          // The lamp's shadow is put here by one rule in `globals.css`, off
          // the `--lift-shadow` the wrapper carries; the corner is the one the
          // part is cut to, so the shadow hugs it.
          borderRadius: liftRadius,
          // Thin, and *inside* the part: the aura's own hairline sits on the
          // edge, so a mark drawn there would cover the thing being edited.
          outline: selected ? `${(1.5 / zoom).toFixed(2)}px solid ${mark}` : "1px solid transparent",
          outlineOffset: selected ? `${(-1.5 / zoom).toFixed(2)}px` : 0,
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
          emit={(e) => { if (e.type === "cube") useStudio.getState().setCubeTurn(node.id, e.turn); }}
        />
      </div>
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
          className="pointer-events-none absolute left-0 z-10 hidden w-[280px] origin-top-left rounded-md border border-border bg-panel/95 p-2 text-[11px] leading-snug text-fg-muted shadow-panel backdrop-blur group-hover:block"
          style={{ top: `calc(100% + 8px)`, transform: `scale(${chipScale})` }}
        >
          <span className="mb-0.5 block font-medium text-fg">{feature.name}</span>
          {feature.explain ?? feature.blurb}
        </div>
      ) : null}

      {/* label chip: what this is, in the builder's words */}
      <div
        className={cn("pointer-events-none absolute left-0 flex origin-bottom-left items-center gap-1 whitespace-nowrap rounded-sm border border-border bg-panel/95 px-1.5 py-0.5 text-[10px] text-fg shadow-sm transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
        style={{ top: -6, transform: `translateY(-100%) scale(${chipScale})` }}
      >
        {node.glyph ? <span>{node.glyph}</span> : Icon ? <Icon className="size-3" style={{ color: `oklch(0.8 0.15 ${hue})` }} /> : null}
        <span className="font-medium">{node.label}</span>
        <span className="num text-fg-faint">{node.w}×{node.h}</span>
        {hasPrompt ? <span className="size-1.5 rounded-full bg-accent" title="Has its own prompt" /> : null}
        {node.priority !== "must" ? <span className="rounded-xs border border-border px-1 text-[9px] uppercase text-fg-faint">{node.priority}</span> : null}
        {node.locked ? <span className="text-[9px] text-fg-faint">locked</span> : null}
      </div>

      {selected && !node.locked
        ? HANDLES.map(({ h, cls, bar }) => (
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
