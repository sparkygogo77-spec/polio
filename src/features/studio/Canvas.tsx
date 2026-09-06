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
import { Block, themeFrom } from "./blocks";
import { resolvePalette } from "./parts/theme";
import type { Palette } from "./look";
import {
  activePage, frameHeight, groupBounds, pageGroups, pageNodes, pageShapes, shapeBounds,
  useStudio, type StudioNode, type StudioShape,
} from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { openRadial } from "./RadialMenu";

const GRID = 8;
/** Breathing room either side of the page. Small: the page is the point. */
const FRAME_GUTTER = 48;
const snapGrid = (v: number) => Math.round(v / GRID) * GRID;
const MIN_W = 40;
const MIN_H = 24;

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Drag {
  kind: "node" | "marquee" | "pan" | "draw" | "resize";
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
      useStudio.getState().setPan({ x: Math.round((el.clientWidth - frameWidth * z) / 2), y: 36 });
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
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const store = useStudio.getState();
      if (e.ctrlKey || e.metaKey) {
        const floor = ref.current ? fitZoom(ref.current.clientWidth) : 0.2;
        store.setZoom(Math.max(floor, store.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
      }
      else store.setPan({ x: store.pan.x - e.deltaX, y: store.pan.y - e.deltaY });
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

    if (handleEl && nodeEl?.dataset.nodeId) {
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
      if (!e.shiftKey) store.clearSelection();
      capture();
      setDrag({ kind: "marquee", startX: p.x, startY: p.y });
      return;
    }

    if (tool === "erase") {
      const shapeEl = target.closest?.("[data-shape-id]") as HTMLElement | null;
      if (shapeEl?.dataset.shapeId) store.removeShapes([shapeEl.dataset.shapeId]);
      else if (nodeEl?.dataset.nodeId) store.removeNodes([nodeEl.dataset.nodeId]);
      play("deny");
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
        store.addShape({ pageId: store.activePageId, kind, points: pts, hue: inkHue, width: inkWidth, label: "", prompt: "", relation: "flow",
        fromNodeId: from?.id ?? null, toNodeId: to?.id ?? null });
        play("tap");
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
      className="relative size-full touch-none overflow-hidden overscroll-contain bg-bg select-none"
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
          className="absolute left-0 top-0 rounded-[3px] shadow-[0_20px_60px_oklch(0_0_0/0.45)]"
          style={{ width: frameWidth, height: frameH, ...(theme.surfaceStyle ?? { background: theme.backdrop, backgroundSize: "24px 24px" }), outline: "1px solid var(--border-strong)" }}
        />
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
          {shapes.filter((sh) => showWires || sh.kind !== "arrow").map((sh) => <ShapeView key={sh.id} shape={sh} selected={selection.includes(sh.id)} />)}
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

        {nodes.map((n) => <NodeView key={n.id} node={n} selected={selection.includes(n.id)} theme={theme} palette={palette} zoom={zoom} />)}

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

function hitNode(nodes: StudioNode[], x: number, y: number): StudioNode | null {
  return nodes.find((n) => x >= n.x - 8 && x <= n.x + n.w + 8 && y >= n.y - 8 && y <= n.y + n.h + 8) ?? null;
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

const ShapeView = React.memo(function ShapeView({ shape, selected }: { shape: StudioShape; selected: boolean }) {
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
    const { className, ...line } = common;
    return (
      <g className={className} {...(shape.id !== "live" ? ctxProps("studio-shape", shape.id, shape) : {})} data-shape-id={shape.id}>
        {/* A wire is three pixels wide; this invisible one is easy to hit. */}
        <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="transparent" strokeWidth={16} fill="none" strokeLinecap="round" />
        <line
          {...line}
          data-shape-id={undefined}
          x1={p1[0]}
          y1={p1[1]}
          x2={p2[0]}
          y2={p2[1]}
          markerEnd="url(#studio-arrow)"
          style={{ color }}
          strokeLinecap="round"
          strokeDasharray={data ? "2 6" : undefined}
          strokeWidth={data ? shape.width + 1 : shape.width}
        />
      </g>
    );
  }
  return <path {...common} d={penPath(shape.points)} strokeLinecap="round" strokeLinejoin="round" />;
});

const HANDLES: { h: Handle; cls: string }[] = [
  { h: "nw", cls: "-left-1 -top-1 cursor-nwse-resize" },
  { h: "n", cls: "left-1/2 -top-1 -translate-x-1/2 cursor-ns-resize" },
  { h: "ne", cls: "-right-1 -top-1 cursor-nesw-resize" },
  { h: "e", cls: "-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
  { h: "se", cls: "-right-1 -bottom-1 cursor-nwse-resize" },
  { h: "s", cls: "left-1/2 -bottom-1 -translate-x-1/2 cursor-ns-resize" },
  { h: "sw", cls: "-left-1 -bottom-1 cursor-nesw-resize" },
  { h: "w", cls: "-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize" },
];

const NodeView = React.memo(function NodeView({ node, selected, theme, palette, zoom }: { node: StudioNode; selected: boolean; theme: ReturnType<typeof themeFrom>; palette: Palette; zoom: number }) {
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
      onContextMenu={(e) => {
        // The wheel, not a twenty-item list. Stops the global menu from opening too.
        e.preventDefault();
        e.stopPropagation();
        useStudio.getState().setSelection([node.id]);
        openRadial(node.id, e.clientX, e.clientY);
      }}
      className={cn("group absolute cursor-grab active:cursor-grabbing", node.locked && "cursor-not-allowed")}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      {/* the part itself, at real size */}
      {/* The selected part runs its own clocks, so you can see what it does. */}
      <div
        className="absolute inset-0 overflow-hidden"
        data-mode={selected ? "live" : "board"}
        inert
        style={{ pointerEvents: "none", outline: selected ? "2px solid var(--accent)" : "1px solid transparent", outlineOffset: 0 }}
      >
        <Block node={node} t={theme} palette={palette} mode={selected ? "live" : "board"} />
      </div>
      {/* hover outline so unselected parts still read as parts */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ outline: `1px dashed oklch(0.75 0.15 ${hue} / 0.8)` }} />

      {/* What is this, and when would you want it? Answered without clicking. */}
      {feature ? (
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
        ? HANDLES.map(({ h, cls }) => (
            <span key={h} data-resize={h} className={cn("absolute size-2 rounded-[2px] border border-accent bg-panel", cls)} style={{ transform: `${cls.includes("translate") ? "" : ""} scale(${chipScale})` }} />
          ))
        : null}
    </div>
  );
});
