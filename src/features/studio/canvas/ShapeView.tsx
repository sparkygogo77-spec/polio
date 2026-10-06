"use client";
import * as React from "react";
import { linkReason } from "../links";
import { type StudioNode,type StudioShape } from "../store";
import { ctxProps } from "@/core/context-menu/ctx";

import { type Handle } from "./helpers";
import { penPath } from "./geometry";

/**
 * The red a chain is drawn in.
 *
 * The same red as Delete on the wheel and as the one control on a slab that
 * is *on*: this app keeps red for the handful of things that are not
 * decoration, and a chain — two parts that must be built to agree — is one
 * of them.
 */
export const CHAIN_RED = "oklch(0.64 0.23 27)";
/** And what marks it when it is picked up: the far side of that red. */
export const CHAIN_MARK = "oklch(0.82 0.19 207)";

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
export function Chain({ a, b, colour, lit, fresh, len, mark }: { a: [number, number]; b: [number, number]; colour: string; lit: boolean; fresh?: boolean; len: number; mark: string }) {
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
export function reasonOn(shape: StudioShape, nodes: StudioNode[]): string {
  if (shape.kind !== "arrow" || !shape.fromNodeId || !shape.toNodeId) return "";
  const from = nodes.find((n) => n.id === shape.fromNodeId);
  const to = nodes.find((n) => n.id === shape.toNodeId);
  // A reason typed by hand wins: the point is that nobody has to, not that
  // nobody may.
  return shape.label.trim() || linkReason(from, to, shape.relation ?? "flow");
}

export const ShapeView = React.memo(function ShapeView({ shape, selected, fresh, reason, dashed }: { shape: StudioShape; selected: boolean; fresh?: boolean; reason?: string; dashed?: boolean }) {
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
/** A held group's eight handles: which, and where on its frame. */
export const GROUP_HANDLES: [Handle, string, string][] = [
  ["nw", "0%", "0%"], ["n", "50%", "0%"], ["ne", "100%", "0%"], ["e", "100%", "50%"],
  ["se", "100%", "100%"], ["s", "50%", "100%"], ["sw", "0%", "100%"], ["w", "0%", "50%"],
];

export const HANDLE_CURSOR: Record<string, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize",
  se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize",
};

export const HANDLES: { h: Handle; cls: string; bar?: boolean }[] = [
  { h: "nw", cls: "-left-1 -top-1 cursor-nwse-resize" },
  { h: "n", cls: "left-2 right-2 -top-[3px] h-[6px] cursor-ns-resize", bar: true },
  { h: "ne", cls: "-right-1 -top-1 cursor-nesw-resize" },
  { h: "e", cls: "top-2 bottom-2 -right-[3px] w-[6px] cursor-ew-resize", bar: true },
  { h: "se", cls: "-right-1 -bottom-1 cursor-nwse-resize" },
  { h: "s", cls: "left-2 right-2 -bottom-[3px] h-[6px] cursor-ns-resize", bar: true },
  { h: "sw", cls: "-left-1 -bottom-1 cursor-nesw-resize" },
  { h: "w", cls: "top-2 bottom-2 -left-[3px] w-[6px] cursor-ew-resize", bar: true },
];
