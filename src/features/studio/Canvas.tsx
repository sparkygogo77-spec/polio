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
import { Block, themeFrom } from "./blocks";
import { resolvePalette } from "./parts/theme";
import { AlignCenter, AlignLeft, AlignRight, StretchHorizontal } from "lucide-react";
import { auraStyle, type Light, type Palette, type TextureLayer } from "./look";
import { BACKGROUND_ID } from "./store";
import {
  activePage, frameHeight, groupBounds, pageGroups, pageNodes, pageShapes, shapeBounds,
  useStudio, type StudioNode, type StudioShape,
} from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { openRadial, spotOn } from "./RadialMenu";

const GRID = 8;
/** Breathing room either side of the page. Small: the page is the point. */
const FRAME_GUTTER = 48;
/** How far below the top of the viewport the page rests. */
const TOP_MARGIN = 36;
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
  const nodes = useStudio(useShallow(pageNodes));
  const shapes = useStudio(useShallow(pageShapes));
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
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const frameH = frameHeight(nodes);

  const [drag, setDrag] = React.useState<Drag | null>(null);
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
      return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
    },
    [pan.x, pan.y, zoom],
  );

  /* ---------------------------------------------------- fit the frame
   *
   * The page is the point, so both of its side edges are always on screen with
   * only a small gutter, and the board never zooms out past that — shrinking
   * the window narrows the gutter and then stops. Taller than the viewport is
   * fine: that is what scrolling is for.
   */
  const fitZoom = React.useCallback((vw: number) => Math.max(0.2, Math.min(1, (vw - FRAME_GUTTER) / frameWidth)), [frameWidth]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (z: number) => {
      useStudio.getState().setZoom(z);
      useStudio.getState().setPan({ x: Math.round((el.clientWidth - frameWidth * z) / 2), y: TOP_MARGIN });
    };
    apply(fitZoom(el.clientWidth));
    // Re-fit only when the page would actually be cut off. A pane that grew
    // just means a wider gutter; snapping the view every time it did would
    // move the board under your hands for no reason.
    const ro = new ResizeObserver(() => {
      const z = useStudio.getState().zoom;
      if (frameWidth * z > el.clientWidth - 8) apply(fitZoom(el.clientWidth));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitNonce, frameWidth, fitZoom]);

  /* ------------------------------------------------------------- wheel */
  // The board pans until the page runs out, and then hands the wheel on to
  // the column it sits in — so one gesture carries you down the page and
  // straight into the shelf, and back up again, without the page ever being
  // scaled to make room. `frameRef` keeps the current page height available
  // to a listener that is attached once.
  const frameRef = React.useRef(frameH);
  frameRef.current = frameH;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const store = useStudio.getState();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const floor = ref.current ? fitZoom(ref.current.clientWidth) : 0.2;
        store.setZoom(Math.max(floor, store.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
        return;
      }
      if (e.deltaX) {
        e.preventDefault();
        store.setPan({ x: store.pan.x - e.deltaX, y: store.pan.y - e.deltaY });
        return;
      }
      const outer = el.closest("[data-studio-scroll]") as HTMLElement | null;
      const bottom = store.pan.y + frameRef.current * store.zoom;
      const down = e.deltaY > 0;
      // Down: pan while there is still page below the fold. Up: pan while the
      // page has been pushed above its resting margin — but only once the
      // column itself is back at the top, so the shelf closes first.
      const more = down ? bottom > el.clientHeight : store.pan.y < TOP_MARGIN && (!outer || outer.scrollTop <= 0);
      if (!more) return;
      e.preventDefault();
      const next = down
        ? Math.max(el.clientHeight - frameRef.current * store.zoom, store.pan.y - e.deltaY)
        : Math.min(TOP_MARGIN, store.pan.y - e.deltaY);
      store.setPan({ x: store.pan.x, y: next });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitZoom]);

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
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border-strong) 1px, transparent 1px)",
          backgroundSize: `${GRID * 3 * zoom}px ${GRID * 3 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
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
            openRadial(BACKGROUND_ID, e.clientX, e.clientY, spotOn(e.currentTarget, e.clientX, e.clientY));
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
            outline: selection.includes(BACKGROUND_ID) ? `${2 / zoom}px solid var(--accent)` : "1px solid var(--border-strong)",
          }}
        />
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
        {/* fold line: what fits on the first screen */}
        <div className="pointer-events-none absolute left-0 border-t border-dashed border-accent/40" style={{ top: 900, width: frameWidth }}>
          <span className="absolute right-0 -top-4 text-accent/70" style={{ fontSize: 10 / zoom }}>first screen ends</span>
        </div>

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
          {shapes.filter((sh) => showWires || sh.kind !== "arrow").map((sh) => <ShapeView key={sh.id} shape={sh} selected={selection.includes(sh.id)} fresh={fresh?.wire === sh.id} />)}
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
            style={{ width: frameWidth, height: frameH, ...theme.overlayStyle }}
          />
        ) : null}
        {/* The veil: a dim over the whole page, set from the background's wheel. */}
        {theme.veil ? (
          <div
            aria-hidden
            data-frame-veil=""
            className="pointer-events-none absolute left-0 top-0 rounded-[3px]"
            style={{ width: frameWidth, height: frameH, background: theme.veil }}
          />
        ) : null}

        {shapes.filter((sh) => (sh.label || sh.prompt || sh.relation === "data") && (showWires || sh.kind !== "arrow")).map((sh) => {
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

const ShapeView = React.memo(function ShapeView({ shape, selected, fresh }: { shape: StudioShape; selected: boolean; fresh?: boolean }) {
  const color = `oklch(0.78 0.16 ${shape.hue})`;
  const common = {
    "data-shape-id": shape.id,
    stroke: color,
    strokeWidth: shape.width,
    fill: "none",
    className: cn("pointer-events-auto", selected && "drop-shadow-[0_0_6px_var(--accent)]"),
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
    const chained = !!shape.fromNodeId && !!shape.toNodeId && shape.id !== "live";
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const { className, ...line } = common;
    return (
      <g className={className} {...(shape.id !== "live" ? ctxProps("studio-shape", shape.id, shape) : {})} data-shape-id={shape.id} data-chained={chained ? "" : undefined}>
        {/* A wire is three pixels wide; this invisible one is easy to hit. */}
        <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="transparent" strokeWidth={16} fill="none" strokeLinecap="round" />
        <line
          {...line}
          data-shape-id={undefined}
          x1={p1[0]}
          y1={p1[1]}
          x2={p2[0]}
          y2={p2[1]}
          markerEnd={chained ? undefined : "url(#studio-arrow)"}
          style={{
            color,
            ...(fresh ? { "--wire-len": `${Math.ceil(len)}`, "--wire-w": `${data ? shape.width + 1 : shape.width}px`, strokeDasharray: data ? undefined : Math.ceil(len), animation: "wire-snap 420ms cubic-bezier(0.2, 0.9, 0.2, 1) both" } : {}),
          } as React.CSSProperties}
          strokeLinecap="round"
          strokeDasharray={data ? "2 6" : undefined}
          strokeWidth={data ? shape.width + 1 : shape.width}
        />
        {chained ? (
          <>
            <circle cx={p1[0]} cy={p1[1]} r={4} fill="var(--bg)" stroke={color} strokeWidth={2} />
            <circle cx={p2[0]} cy={p2[1]} r={4} fill={color} stroke={color} strokeWidth={2} />
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
  const feature = getFeature(node.featureId);
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
      className={cn("group absolute cursor-grab active:cursor-grabbing", node.locked && "cursor-not-allowed", flash && "node-snap")}
      style={{
        left: node.x, top: node.y, width: node.w, height: node.h,
        // The aura belongs to the element, not to anything inside it.
        ...((auraStyle(node.aura, palette, node.auraSize, node.auraStyle) ?? {}) as React.CSSProperties),
      }}
    >
      {/* the part itself, at real size */}
      {/* The selected part runs its own clocks, so you can see what it does. */}
      <div
        className="absolute inset-0 overflow-hidden"
        data-mode={selected ? "live" : "board"}
        inert
        style={{ pointerEvents: "none", outline: selected ? "2px solid var(--accent)" : "1px solid transparent", outlineOffset: 0 }}
      >
        <Block node={node} t={theme} palette={palette} light={light} page={page} layers={layers} mode={selected ? "live" : "board"} />
      </div>
      {/* hover outline so unselected parts still read as parts */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ outline: `1px dashed oklch(0.75 0.15 ${hue} / 0.8)` }} />

      {/* What is this, and when would you want it? Answered without clicking — and out of the way once it is picked. */}
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
              className={cn("absolute", bar ? "rounded-[3px] bg-accent/0 hover:bg-accent/35" : "size-2 rounded-[2px] border border-accent bg-panel", cls)}
              style={bar ? undefined : { transform: `scale(${chipScale})` }}
            />
          ))
        : null}
      {selected && !node.locked ? <FillTab node={node} chipScale={chipScale} /> : null}
    </div>
  );
});
