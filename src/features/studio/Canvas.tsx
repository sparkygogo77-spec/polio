"use client";
/**
 * The blueprint canvas.
 *
 * Nodes are DOM elements (so they can carry right-click scopes and rich
 * content); ink lives in an SVG layer underneath them. Both sit inside one
 * transformed viewport so pan and zoom are a single transform.
 *
 * Tools: select (drag / marquee), pen (freehand), frame (named region),
 * arrow (relationship between two elements), erase.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { getFeature, categoryOf } from "./catalog";
import {
  activePage, groupBounds, pageGroups, pageNodes, pageShapes, shapeBounds,
  useStudio, type StudioNode, type StudioShape,
} from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { EmptyState } from "@/core/ui/empty-state";
import { Shapes } from "lucide-react";

const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;

interface Drag {
  kind: "node" | "marquee" | "pan" | "draw" | "resize";
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  ids?: string[];
  points?: [number, number][];
  nodeId?: string;
  startPan?: { x: number; y: number };
  moved?: boolean;
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

  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ink, setInk] = React.useState<[number, number][] | null>(null);

  /** Screen → canvas coordinates. */
  const toCanvas = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
    },
    [pan.x, pan.y, zoom],
  );

  /* ---------------------------------------------------------------- drop */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const featureId = e.dataTransfer.getData("application/x-studio-feature");
    if (!featureId) return;
    const p = toCanvas(e.clientX, e.clientY);
    const feature = getFeature(featureId);
    const id = useStudio.getState().addNode(featureId, snap(p.x - (feature?.w ?? 132) / 2), snap(p.y - (feature?.h ?? 76) / 2));
    play("confirm");
    haptic();
    // A brand-new idea wants its prompt written immediately.
    if (featureId === "custom-idea") useStudio.getState().setSelection([id]);
  };

  /* ------------------------------------------------------------- pointer */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // right-click belongs to the context menu
    const p = toCanvas(e.clientX, e.clientY);
    const target = e.target as HTMLElement;
    const nodeEl = target.closest?.("[data-node-id]") as HTMLElement | null;
    const handle = target.closest?.("[data-resize]") as HTMLElement | null;
    const store = useStudio.getState();

    // Middle mouse or the pan tool always pans.
    if (e.button === 1 || tool === "pan" || (tool === "select" && e.altKey)) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({ kind: "pan", startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, startPan: pan });
      return;
    }

    if (handle && nodeEl) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({ kind: "resize", startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, nodeId: nodeEl.dataset.nodeId });
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
          // Selecting a grouped node selects its whole group.
          const groupMates = node?.groupId ? store.nodes.filter((n) => n.groupId === node.groupId).map((n) => n.id) : [id];
          store.setSelection(groupMates);
          ids = groupMates;
        }
        play("select");
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDrag({ kind: "node", startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, ids });
        return;
      }
      if (!e.shiftKey) store.clearSelection();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({ kind: "marquee", startX: p.x, startY: p.y, lastX: p.x, lastY: p.y });
      return;
    }

    if (tool === "erase") {
      const shapeEl = target.closest?.("[data-shape-id]") as HTMLElement | null;
      if (shapeEl?.dataset.shapeId) store.removeShapes([shapeEl.dataset.shapeId]);
      else if (nodeEl?.dataset.nodeId) store.removeNodes([nodeEl.dataset.nodeId]);
      play("deny");
      return;
    }

    // pen / frame / arrow
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setInk([[p.x, p.y]]);
    setDrag({ kind: "draw", startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, points: [[p.x, p.y]] });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const store = useStudio.getState();

    if (drag.kind === "pan") {
      store.setPan({
        x: (drag.startPan?.x ?? 0) + (e.clientX - drag.startX),
        y: (drag.startPan?.y ?? 0) + (e.clientY - drag.startY),
      });
      return;
    }

    const p = toCanvas(e.clientX, e.clientY);

    if (drag.kind === "node" && drag.ids?.length) {
      const dx = p.x - drag.lastX;
      const dy = p.y - drag.lastY;
      if (dx || dy) {
        // Checkpoint once, on the first movement: undo has to land on where the
        // drag began, and a pointer-down that never moves shouldn't touch history.
        if (!drag.moved) store.commit();
        store.moveNodes(drag.ids, dx, dy);
        setDrag({ ...drag, lastX: p.x, lastY: p.y, moved: true });
      }
      return;
    }

    if (drag.kind === "resize" && drag.nodeId) {
      if (!drag.moved) store.commit();
      const node = store.nodes.find((n) => n.id === drag.nodeId);
      if (node) {
        useStudio.setState({
          nodes: store.nodes.map((n) =>
            n.id === node.id ? { ...n, w: Math.max(88, snap(p.x - n.x)), h: Math.max(56, snap(p.y - n.y)) } : n,
          ),
        });
      }
      setDrag({ ...drag, moved: true });
      return;
    }

    if (drag.kind === "marquee") {
      setMarquee({
        x: Math.min(drag.startX, p.x),
        y: Math.min(drag.startY, p.y),
        w: Math.abs(p.x - drag.startX),
        h: Math.abs(p.y - drag.startY),
      });
      return;
    }

    if (drag.kind === "draw") {
      if (tool === "pen") {
        const pts = [...(drag.points ?? []), [p.x, p.y] as [number, number]];
        setDrag({ ...drag, points: pts, lastX: p.x, lastY: p.y });
        setInk(pts);
      } else {
        const pts: [number, number][] = [[drag.startX, drag.startY], [p.x, p.y]];
        setDrag({ ...drag, points: pts, lastX: p.x, lastY: p.y });
        setInk(pts);
      }
    }
  };

  const onPointerUp = () => {
    if (!drag) return;
    const store = useStudio.getState();

    if (drag.kind === "node" && drag.moved && drag.ids?.length) {
      // Snap to grid once, at the end, so dragging itself stays smooth.
      useStudio.setState({
        nodes: useStudio.getState().nodes.map((n) => (drag.ids!.includes(n.id) ? { ...n, x: snap(n.x), y: snap(n.y) } : n)),
      });
      play("tap");
    } else if (drag.kind === "marquee" && marquee) {
      const hits = [
        ...nodes.filter((n) => n.x < marquee.x + marquee.w && n.x + n.w > marquee.x && n.y < marquee.y + marquee.h && n.y + n.h > marquee.y).map((n) => n.id),
        ...shapes
          .filter((sh) => {
            const b = shapeBounds(sh);
            return b.x < marquee.x + marquee.w && b.x + b.w > marquee.x && b.y < marquee.y + marquee.h && b.y + b.h > marquee.y;
          })
          .map((sh) => sh.id),
      ];
      if (hits.length) {
        store.setSelection(hits);
        play("select");
      }
    } else if (drag.kind === "draw" && drag.points && drag.points.length >= 2) {
      const kind = tool === "pen" ? "pen" : tool === "frame" ? "frame" : "arrow";
      const pts = drag.points;
      // An arrow drawn between two elements becomes an explicit relationship.
      const from = kind === "arrow" ? hitNode(nodes, pts[0]![0], pts[0]![1]) : null;
      const to = kind === "arrow" ? hitNode(nodes, pts[pts.length - 1]![0], pts[pts.length - 1]![1]) : null;
      const dist = Math.hypot(pts[pts.length - 1]![0] - pts[0]![0], pts[pts.length - 1]![1] - pts[0]![1]);
      if (kind === "pen" || dist > 16) {
        store.addShape({
          pageId: useStudio.getState().activePageId,
          kind,
          points: pts,
          hue: inkHue,
          width: inkWidth,
          label: "",
          prompt: "",
          fromNodeId: from?.id ?? null,
          toNodeId: to?.id ?? null,
        });
        play("tap");
      }
    }

    setDrag(null);
    setMarquee(null);
    setInk(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const store = useStudio.getState();
      store.setZoom(store.zoom * (e.deltaY > 0 ? 0.92 : 1.08));
      return;
    }
    const store = useStudio.getState();
    store.setPan({ x: store.pan.x - e.deltaX, y: store.pan.y - e.deltaY });
  };

  const cursor =
    tool === "pan" ? "grab" : tool === "select" ? "default" : tool === "erase" ? "crosshair" : "crosshair";

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
      onWheel={onWheel}
    >
      {/* dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border-strong) 1px, transparent 1px)",
          backgroundSize: `${GRID * 3 * zoom}px ${GRID * 3 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
          <defs>
            <marker id="studio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>

          {/* group halos */}
          {groups.map((g) => {
            const b = groupBounds(nodes, g.id);
            if (!b) return null;
            return (
              <g key={g.id}>
                <rect
                  x={b.x - 14} y={b.y - 22} width={b.w + 28} height={b.h + 36} rx={12}
                  fill={`oklch(0.7 0.15 ${g.hue} / 0.07)`}
                  stroke={`oklch(0.7 0.15 ${g.hue} / 0.5)`}
                  strokeDasharray="6 4"
                />
              </g>
            );
          })}

          {shapes.map((sh) => (
            <ShapeView key={sh.id} shape={sh} selected={selection.includes(sh.id)} />
          ))}

          {/* live ink */}
          {ink && ink.length >= 2 ? (
            <ShapeView
              shape={{
                id: "live", pageId: "", kind: tool === "pen" ? "pen" : tool === "frame" ? "frame" : "arrow",
                points: ink, hue: inkHue, width: inkWidth, label: "", prompt: "",
              }}
              selected
            />
          ) : null}

          {marquee ? (
            <rect
              x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
              fill="var(--accent-soft)" stroke="var(--accent)" strokeDasharray="4 3"
            />
          ) : null}
        </svg>

        {/* group labels sit above the halo but below nodes */}
        {groups.map((g) => {
          const b = groupBounds(nodes, g.id);
          if (!b) return null;
          return (
            <div
              key={g.id}
              {...ctxProps("studio-group", g.id, g)}
              className="absolute cursor-default rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                left: b.x - 14, top: b.y - 40, color: `oklch(0.75 0.15 ${g.hue})`,
                background: `oklch(0.7 0.15 ${g.hue} / 0.12)`,
              }}
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
          <NodeView key={n.id} node={n} selected={selection.includes(n.id)} />
        ))}

        {/* labels for named regions and arrows */}
        {shapes
          .filter((sh) => sh.label || sh.prompt)
          .map((sh) => {
            const b = shapeBounds(sh);
            return (
              <div
                key={`label-${sh.id}`}
                className="pointer-events-none absolute max-w-[180px] truncate rounded-sm px-1 text-[10px]"
                style={{ left: b.x, top: b.y - 16, color: `oklch(0.78 0.15 ${sh.hue})` }}
              >
                {sh.label || "✎"}
              </div>
            );
          })}
      </div>

      {nodes.length === 0 && shapes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <EmptyState
            icon={Shapes}
            title="Drag features in from the left"
            body="Drop icons where they should sit on the page, draw regions and arrows between them, then give each one its own prompt. Right-click anything."
          />
        </div>
      ) : null}
    </div>
  );
}

function hitNode(nodes: StudioNode[], x: number, y: number): StudioNode | null {
  return nodes.find((n) => x >= n.x - 8 && x <= n.x + n.w + 8 && y >= n.y - 8 && y <= n.y + n.h + 8) ?? null;
}

function penPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  // Quadratic smoothing through midpoints keeps freehand strokes from looking polygonal.
  let d = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    d += ` Q ${a[0]} ${a[1]} ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last[0]} ${last[1]}`;
  return d;
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
    return (
      <rect
        {...common}
        x={Math.min(p1[0], p2[0])}
        y={Math.min(p1[1], p2[1])}
        width={Math.abs(p2[0] - p1[0])}
        height={Math.abs(p2[1] - p1[1])}
        rx={10}
        strokeDasharray="8 5"
        fill={`oklch(0.78 0.16 ${shape.hue} / 0.05)`}
      />
    );
  }

  if (shape.kind === "arrow" && shape.points.length >= 2) {
    const [p1, p2] = [shape.points[0]!, shape.points[shape.points.length - 1]!];
    return (
      <line
        {...common}
        x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]}
        markerEnd="url(#studio-arrow)"
        style={{ color }}
        strokeLinecap="round"
      />
    );
  }

  return <path {...common} d={penPath(shape.points)} strokeLinecap="round" strokeLinejoin="round" />;
});

const NodeView = React.memo(function NodeView({ node, selected }: { node: StudioNode; selected: boolean }) {
  const feature = getFeature(node.featureId);
  const category = feature ? categoryOf(feature.category) : null;
  const hue = node.hue ?? category?.hue ?? 265;
  const Icon = feature?.icon;
  const hasPrompt = node.prompt.trim().length > 0;

  return (
    <div
      data-node-id={node.id}
      {...ctxProps("studio-node", node.id, node)}
      className={cn(
        "group absolute flex cursor-grab flex-col gap-1 rounded-lg border p-2 transition-shadow active:cursor-grabbing",
        selected ? "border-accent shadow-[0_0_0_2px_var(--accent-soft)]" : "border-border hover:border-border-strong",
        node.locked && "cursor-not-allowed opacity-70",
      )}
      style={{
        left: node.x, top: node.y, width: node.w, height: node.h,
        background: `linear-gradient(160deg, oklch(0.7 0.14 ${hue} / 0.16), var(--panel))`,
      }}
    >
      <div className="flex items-center gap-1.5">
        {node.glyph ? (
          <span className="text-sm leading-none">{node.glyph}</span>
        ) : Icon ? (
          <Icon className="size-4 shrink-0" style={{ color: `oklch(0.8 0.15 ${hue})` }} />
        ) : null}
        <span className="truncate text-[11px] font-semibold text-fg">{node.label}</span>
      </div>
      <div className="line-clamp-2 text-[10px] leading-tight text-fg-muted">
        {node.prompt.trim() || feature?.blurb || "No prompt yet"}
      </div>

      <div className="mt-auto flex items-center gap-1">
        {hasPrompt ? <span className="size-1.5 rounded-full bg-accent" title="Has its own prompt" /> : null}
        {node.priority !== "must" ? (
          <span className="rounded-xs border border-border px-1 text-[9px] uppercase tracking-wide text-fg-faint">{node.priority}</span>
        ) : null}
        {node.locked ? <span className="text-[9px] text-fg-faint">locked</span> : null}
      </div>

      {selected && !node.locked ? (
        <span
          data-resize="br"
          className="absolute -bottom-1 -right-1 size-3 cursor-se-resize rounded-sm border border-accent bg-panel"
        />
      ) : null}
    </div>
  );
});
