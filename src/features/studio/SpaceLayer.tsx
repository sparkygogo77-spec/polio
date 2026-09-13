"use client";
/**
 * Spaces on the board: the placeholder, the construct box, the black hole.
 *
 * A space is a closed line drawn with the space tool (`space.ts`). This
 * draws what each one is right now, in the page's own coordinates, under
 * the ink and the parts so that what is drawn or dropped inside sits on it:
 *
 *   · **undecided**: the line as drawn, dashed, with two keys at the middle
 *     of the area. Construct, or Black hole. Nothing else, because a
 *     placeholder is a promise about the layout and not about the feature.
 *   · **construct**: a lantern construct, the timeline's own language for a
 *     thing that holds work, cut to the line that was drawn. Green holds,
 *     red was drawn; a space is neither yet, so it wears the base set.
 *   · **hole**: the black hole grows from the centroid as the drawn shape
 *     itself until it reaches the line (`CONSUME_MS`), and the ground comes
 *     with it: dark matter cut to the same growing edge. Once it has
 *     consumed the area, the area is drawing space, with the horizon on the
 *     line, the photon ring on it and the beamed disc outside it.
 *
 * The light outside the line needs room (`HALO`), so every space's host is
 * its box grown by that on each side, and the boundary is shifted into the
 * host's own pixels once. The page layer it sits in is scaled by the board's
 * zoom, so the keys counter-scale the way the ink door does, and stay one
 * size under the hand.
 *
 * `SpaceSide` is the other half: the per-element panel at the right edge of
 * the board for whatever is picked inside an open hole (`SpacePanel.tsx`).
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { Box as BoxIcon, Circle, Sparkles } from "lucide-react";
import { play } from "@/core/audio/engine";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { VOID } from "@/core/ui/void";
import { DRIFT_MS } from "./darkMatter";
import { HALO, paintHoleAlong, paintHorizonShadowAlong } from "./blackHole";
import { useGround } from "./ground";
import { boundaryBox, boundaryPath, centroid, consumed, CONSUME_MS, grownBoundary, spaceBox, spaceOf, spaceOfDrawing, type Space } from "./space";
import type { SketchPoint as Pt } from "./sketch";
import type { SketchPoint } from "./sketch";
import { nodeInSpace } from "./space";
import { pageNodes, pageShapes, pageSpaces, useStudio } from "./store";
import { inkGroups } from "./inkGroups";
import { SpaceOwnPanel, SpacePanel } from "./SpacePanel";

/** The placeholder's line, and the keys on it: the void's lit rim, because it is not yet anything. */
const PLACEHOLDER = "oklch(0.62 0.08 290)";

export function SpaceMarks({ zoom }: { zoom: number }) {
  const spaces = useStudio(useShallow(pageSpaces));
  if (!spaces.length) return null;
  return (
    <>
      {spaces.map((sp) => <SpaceMark key={sp.id} space={sp} zoom={zoom} />)}
    </>
  );
}

/**
 * Ink drawn inside an open hole, marked as belonging to it.
 *
 * A drawing knows its space the same way a part does — by where it is, not
 * by a pointer written on it — so this is read rather than stored, and a
 * stroke dragged out of a space stops belonging to it. Without the mark
 * the belonging was invisible: a person pressed Make real inside a space
 * they had steered and got an ordinary part, with nothing on the board to
 * say the space had any bearing on it. The part that lands does inherit
 * the space's plan (`store.addNode`); this is how you can see that coming.
 */
export function SpaceInk({ zoom }: { zoom: number }) {
  const spaces = useStudio(useShallow(pageSpaces));
  const shapes = useStudio(useShallow(pageShapes));
  const pageId = useStudio((s) => s.activePageId);
  const drawings = React.useMemo(() => inkGroups(shapes.filter((sh) => sh.kind === "pen")), [shapes]);
  const now = Date.now();
  if (!spaces.length || !drawings.length) return null;
  return (
    <>
      {drawings.map((g) => {
        const space = spaceOfDrawing(spaces, { pageId, bounds: g.bounds }, now);
        if (!space) return null;
        return (
          <div
            key={`ink-space-${g.id}`}
            data-ink-space={g.id}
            data-ink-in={space.id}
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-medium"
            style={{
              left: g.bounds.x,
              top: g.bounds.y + g.bounds.h + 4,
              transform: `scale(${Math.max(1, 1 / zoom)})`,
              transformOrigin: "0 0",
              background: "oklch(0.06 0.01 290 / 0.85)",
              border: "1px solid oklch(0.86 0.16 72 / 0.55)",
              color: "oklch(0.92 0.09 78)",
            }}
          >
            in {space.label.trim() || "this space"}
            {space.plan?.steps?.length ? ", made its way" : ""}
          </div>
        );
      })}
    </>
  );
}

/**
 * Why a line did not become a space, said where the line was drawn.
 *
 * It was a toast at the bottom right of the window, truncated to about a
 * hundred and forty pixels: a person watching their own hand at the top of
 * the board never saw it, and J has toasts off altogether, which makes the
 * corner worse than useless. A refusal belongs at the gesture it refuses,
 * so this is drawn on the line the hand just let go of, and fades on its
 * own rather than needing to be dismissed.
 */
export function SpaceRefused({ at, zoom }: { at: { points: Pt[]; at: number } | null; zoom: number }) {
  const [gone, setGone] = React.useState(false);
  React.useEffect(() => {
    setGone(false);
    if (!at) return;
    const t = setTimeout(() => setGone(true), 3200);
    return () => clearTimeout(t);
  }, [at]);
  if (!at || gone) return null;
  const box = boundaryBox(at.points);
  const ends: Pt[] = [at.points[0]!, at.points[at.points.length - 1]!];
  return (
    <div className="pointer-events-none absolute z-30" style={{ left: box.x, top: box.y, width: Math.max(1, box.w), height: Math.max(1, box.h) }}>
      {/* The two ends that did not meet, ringed: the thing to fix, on the thing itself. */}
      <svg className="absolute overflow-visible" style={{ left: 0, top: 0 }} width={Math.max(1, box.w)} height={Math.max(1, box.h)} aria-hidden>
        {ends.map((p, i) => (
          <circle key={i} cx={p[0] - box.x} cy={p[1] - box.y} r={7 / zoom} fill="none" stroke="oklch(0.7 0.19 27)" strokeWidth={1.5 / zoom} />
        ))}
        <line
          x1={ends[0]![0] - box.x} y1={ends[0]![1] - box.y} x2={ends[1]![0] - box.x} y2={ends[1]![1] - box.y}
          stroke="oklch(0.7 0.19 27 / 0.5)" strokeWidth={1.2 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`}
        />
      </svg>
      <div
        data-space-refused=""
        role="status"
        className="absolute whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-lg"
        style={{
          left: box.w / 2,
          top: -6,
          transform: `translate(-50%, -100%) scale(${Math.max(1, 1 / zoom)})`,
          background: "oklch(0.16 0.04 25)",
          border: "1px solid oklch(0.7 0.19 27)",
          color: "oklch(0.95 0.06 30)",
        }}
      >
        A space is a closed line. Come back to where you started.
      </div>
    </div>
  );
}

function SpaceMark({ space, zoom }: { space: Space; zoom: number }) {
  const box = spaceBox(space);
  const pad = HALO;
  // The boundary in the host's own pixels, once.
  const local = React.useMemo<SketchPoint[]>(() => space.boundary.map(([x, y]) => [x - box.x + pad, y - box.y + pad]), [space.boundary, box.x, box.y, pad]);
  const [mx, my] = React.useMemo(() => centroid(local), [local]);
  const counter = Math.max(1, 1 / zoom);
  return (
    <div
      data-space={space.id}
      data-space-kind={space.kind}
      className="pointer-events-none absolute"
      style={{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2 }}
    >
      {space.kind === "hole" ? <Hole space={space} local={local} pad={pad} box={box} zoom={zoom} /> : null}
      {space.kind === "construct" ? (
        <div
          data-space-construct=""
          className={moltenClass("lantern")}
          style={{
            position: "absolute",
            left: pad,
            top: pad,
            width: box.w,
            height: box.h,
            borderRadius: 0,
            clipPath: `path("${boundaryPath(local.map(([x, y]) => [x - pad, y - pad]))}")`,
            color: "oklch(0.93 0.05 40)",
            ...moltenSeed(space.id),
          }}
        >
          <span data-molten="" />
          <span
            className="absolute left-0 top-0 flex size-full items-center justify-center text-center text-[11px] font-medium tracking-wide"
            style={{ transform: `scale(${counter})`, textShadow: "0 1px 3px oklch(0 0 0 / 0.7)" }}
          >
            {space.label.trim() || "Construct"}
          </span>
        </div>
      ) : null}
      {/*
        The construct's rim, on the drawn line. The construct draws its own
        thin bright edge round its box, and the clip cuts that away with the
        corners, so the edge is put back along the line itself: the same
        colour, one screen pixel and a little of its glow.
      */}
      {space.kind === "construct" ? (
        <svg className="absolute left-0 top-0 overflow-visible" width={box.w + pad * 2} height={box.h + pad * 2} aria-hidden style={{ filter: "drop-shadow(0 0 3px var(--molten-hot))" }}>
          <path data-space-rim="" d={boundaryPath(local)} fill="none" stroke="var(--molten-hot)" strokeWidth={1.5 / zoom} strokeLinejoin="round" />
        </svg>
      ) : null}
      {space.kind === "hole" ? <FillKey space={space} zoom={zoom} at={[mx, my]} /> : null}
      {space.kind === "undecided" ? (
        <>
          <svg className="absolute left-0 top-0 overflow-visible" width={box.w + pad * 2} height={box.h + pad * 2} aria-hidden>
            <path d={boundaryPath(local)} fill="oklch(0.2 0.035 288 / 0.35)" stroke={PLACEHOLDER} strokeWidth={1.5 / zoom} strokeDasharray={`${6 / zoom} ${5 / zoom}`} />
          </svg>
          {/*
            The choice, at the middle of the area. Two keys and nothing else:
            what this space is, decided by the hand that drew it.
          */}
          <div
            data-space-choice={space.id}
            className="pointer-events-auto absolute z-30 flex items-center gap-1.5 whitespace-nowrap"
            style={{ left: mx, top: my, transform: `translate(-50%, -50%) scale(${counter})` }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              data-space-construct-key=""
              title="A construct box: a thing to be made, in the timeline's language"
              onClick={(e) => { e.stopPropagation(); play("confirm"); useStudio.getState().decideSpace(space.id, "construct"); }}
              className="tactile flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium shadow-sm"
              style={{ borderColor: "oklch(0.798 0.209 40)", background: "oklch(0.309 0.076 25)", color: "oklch(0.95 0.05 40)" }}
            >
              <BoxIcon className="size-3" />
              Construct
            </button>
            <button
              type="button"
              data-space-hole-key=""
              title="A black hole: space not yet decided. It consumes the area and leaves drawing space."
              onClick={(e) => { e.stopPropagation(); play("confirm"); useStudio.getState().decideSpace(space.id, "hole"); }}
              className="tactile flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium shadow-sm"
              style={{ borderColor: "oklch(0.86 0.16 72)", background: "oklch(0.06 0.01 290)", color: "oklch(0.98 0.06 85)" }}
            >
              <Circle className="size-3" />
              Black hole
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The one key an empty hole carries: the way to its own panel.
 *
 * A hole with something in it is steered through that thing — pick it and
 * its panel opens. A hole with nothing in it had no way in at all, which
 * is where a recreation from a real site would land, so the space had to
 * be reachable as itself. One key, at the middle of the area, and only
 * while the hole is both open and empty.
 */
function FillKey({ space, zoom, at }: { space: Space; zoom: number; at: [number, number] }) {
  const nodes = useStudio(useShallow(pageNodes));
  const picked = useStudio((s) => s.selection.includes(space.id));
  const [open, setOpen] = React.useState(() => consumed(space, Date.now()) >= 1);
  React.useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setOpen(true), Math.max(0, CONSUME_MS - (Date.now() - (space.since ?? 0))) + 60);
    return () => clearTimeout(t);
  }, [open, space.since]);
  if (!open || picked) return null;
  if (nodes.some((n) => nodeInSpace(space, n))) return null;
  return (
    <button
      type="button"
      data-space-fill={space.id}
      title="What this space is for, and how to fill it"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); play("select"); useStudio.getState().setSelection([space.id]); }}
      className="tactile pointer-events-auto absolute z-30 flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-medium shadow-sm"
      style={{
        left: at[0], top: at[1],
        transform: `translate(-50%, -50%) scale(${Math.max(1, 1 / zoom)})`,
        borderColor: "oklch(0.86 0.16 72 / 0.7)", background: "oklch(0.09 0.02 290 / 0.9)", color: "oklch(0.95 0.08 80)",
      }}
    >
      <Sparkles className="size-3" />
      Fill this space
    </button>
  );
}

/**
 * The hole: the ground cut to the growing edge, and the horizon painted
 * along it on a canvas over the ground.
 *
 * One loop per hole, on the ground's own beat (`DRIFT_MS`): every frame
 * while it is consuming, so the growth is smooth, and thirty times a second
 * after, which is all the breathing needs. The ground's own clip is the
 * whole boundary and never changes, so the weather is generated once; the
 * growth is a second clip on the wrapper, written straight to the element.
 */
function Hole({ space, local, pad, box, zoom }: { space: Space; local: SketchPoint[]; pad: number; box: { w: number; h: number }; zoom: number }) {
  const host = React.useRef<HTMLDivElement>(null);
  const clouds = React.useRef<HTMLDivElement>(null);
  const embers = React.useRef<HTMLCanvasElement>(null);
  const grow = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = React.useState(() => consumed(space, Date.now()) >= 1);
  const zoomRef = React.useRef(zoom);
  zoomRef.current = zoom;
  // The boundary in the ground's own pixels: the host sits `pad` in from the mark.
  const inBox = React.useMemo<SketchPoint[]>(() => local.map(([x, y]) => [x - pad, y - pad]), [local, pad]);
  const clip = React.useMemo(() => `path("${boundaryPath(inBox)}")`, [inBox]);
  useGround(host, clouds, embers, { dim: 0.7, clip });

  const w = box.w + pad * 2;
  const h = box.h + pad * 2;

  React.useEffect(() => {
    let raf = 0;
    let last = 0;
    const born = performance.now();
    const paint = (now: number) => {
      raf = requestAnimationFrame(paint);
      const p = consumed(space, Date.now());
      if (p >= 1 && now - last < DRIFT_MS) return;
      if (document.hidden) return;
      last = now;
      const el = canvas.current;
      const c = el?.getContext("2d");
      if (!el || !c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      // The edge so far: the line grown from the middle of the area.
      const edge = p >= 1 ? local : grownBoundary(local, 0.04 + 0.96 * p);
      if (grow.current) grow.current.style.clipPath = p >= 1 ? "none" : `path("${boundaryPath(edge.map(([x, y]) => [x - pad, y - pad]))}")`;
      // The page layer is scaled by the zoom, so a one-pixel ring is drawn 1/zoom wide to land as one pixel.
      const hair = Math.max(1, 1 / zoomRef.current);
      paintHorizonShadowAlong(c, edge, hair);
      paintHoleAlong(c, { path: edge, t: (now - born) / 1000, hair });
      if (p >= 1) setOpen((o) => o || true);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [space, local, pad, w, h]);

  return (
    <>
      {/* The ground, cut to the line, and to the growing edge while it is consuming. */}
      <div ref={grow} className="absolute" style={{ left: pad, top: pad, width: box.w, height: box.h }}>
        <div ref={host} data-space-ground="" className="absolute inset-0">
          <div ref={clouds} data-ground-clouds="" className="absolute inset-0" />
          <canvas ref={embers} data-ground-sparks="" className="absolute left-0 top-0" />
        </div>
      </div>
      {/* The horizon: the shadow inside the line and the light outside it. */}
      <canvas
        ref={canvas}
        data-space-horizon=""
        data-space-open={open ? "" : undefined}
        aria-hidden
        className="absolute left-0 top-0"
        style={{ width: w, height: h }}
      />
    </>
  );
}

/**
 * The right-side panel for the one part picked inside an open hole.
 *
 * Mounted at the board's edge rather than in the chrome: the panel belongs
 * to the space the part landed in, and the column on the left stays what it
 * is. Nothing when nothing inside a hole is picked.
 */
export function SpaceSide() {
  const selection = useStudio((s) => s.selection);
  const nodes = useStudio(useShallow(pageNodes));
  const spaces = useStudio(useShallow(pageSpaces));
  // Time is read when the selection or the spaces change, not on a clock:
  // a hole that is still consuming is not a place yet, and the frame after
  // it opens the selection is re-read by the first press inside it.
  const now = Date.now();
  const picked = selection.length === 1 ? nodes.find((n) => n.id === selection[0]) : undefined;
  const space = picked ? spaceOf(spaces, picked, now) : null;
  // A space picked as itself: an empty hole, steered before anything is in it.
  const own = !picked && selection.length === 1 ? spaces.find((sp) => sp.id === selection[0] && sp.kind === "hole") : undefined;
  if ((!picked || !space) && !own) return null;
  return (
    <aside
      data-space-panel={picked?.id ?? own!.id}
      className="absolute bottom-3 right-3 top-3 z-30 flex w-[248px] flex-col overflow-hidden rounded-lg"
      style={{ background: VOID.face, border: `1px solid ${VOID.rim}`, boxShadow: VOID.drop, color: VOID.text }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {picked && space ? <SpacePanel node={picked} space={space} /> : <SpaceOwnPanel space={own!} />}
    </aside>
  );
}
