/**
 * A space: a closed line drawn on the page that is not yet a part.
 *
 * Today a line drawn on the background becomes an element. This is the
 * second thing it can become. With the space tool in hand a closed boundary
 * is a **placeholder**, and a placeholder is one of two kinds once a person
 * decides:
 *
 *   · a **construct box**, in the timeline's lantern construct language: a
 *     box that stands for a thing not yet made, cut to the line drawn;
 *   · a **black hole**, which signifies space not yet decided. Chosen, it
 *     expands from the middle to consume the area inside the boundary, and
 *     once it has consumed it that area is drawing space: ground, with the
 *     horizon on the drawn line.
 *
 * Every element that lands inside an open hole gets a panel of its own, on
 * the right: what it is, what was asked, which model the route will send it
 * to, and the order of the tasks it will go through. That is the `Plan`
 * below, and `planFor` is what the panel reads.
 *
 * Pure: no React, no store, no browser. The store holds `Space`s and the
 * board's layer draws them; both import from here. Every measurement is in
 * canvas pixels, the page's own coordinates, because a space is a place on
 * the page rather than a picture in a box.
 */
import { makingOf, needsAlpha, route, STEPS, type ImageModel, type Making, type NoModel, type Step } from "./imageRoute.ts";
import { strokeClosed, type SketchPoint } from "./sketch.ts";

/* ------------------------------------------------------------------ */
/* The record                                                           */
/* ------------------------------------------------------------------ */

/** Undecided is the placeholder. The other two are what a person picked. */
export type SpaceKind = "undecided" | "construct" | "hole";

export interface Space {
  id: string;
  pageId: string;
  /** The boundary as drawn, in canvas pixels. Closed: the last point is near the first. */
  boundary: SketchPoint[];
  kind: SpaceKind;
  /** When the kind was decided, so a hole's consuming can be clocked from it. Null while undecided. */
  since: number | null;
  /** What this space is for, in the person's words. */
  prompt: string;
  label: string;
  /** When it was drawn. */
  at: number;
}

/**
 * How a person wants one element made, when they have said.
 *
 * `model` is a slug from the route's own table, or null to let the route
 * pick. `steps` is the order the work goes through; a step left out is a
 * step not taken. Null on a node means nobody has said anything and the
 * route decides everything, which is what it did before this existed.
 */
export interface Plan {
  model: string | null;
  steps: Step[];
}

/** A closed line has to be at least this big, either way, to be a space. Smaller is a dot. */
export const MIN_SPACE = 24;

/** How long a black hole takes to consume the area inside its boundary. */
export const CONSUME_MS = 1100;

/* ------------------------------------------------------------------ */
/* Geometry                                                             */
/* ------------------------------------------------------------------ */

export interface Box { x: number; y: number; w: number; h: number }

export function boundaryBox(points: SketchPoint[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const spaceBox = (s: Space): Box => boundaryBox(s.boundary);

/**
 * Is this stroke a boundary? Closed, and big enough to hold something.
 *
 * Closed is `strokeClosed` from the drawing board: the ends within a sixth
 * of the diagonal of each other, which is what a hand drawing a loop
 * manages. Its small absolute floor is in the board's own units and means
 * nothing in pixels, so the size check here does that work.
 */
export function isBoundary(points: SketchPoint[]): boolean {
  if (points.length < 4) return false;
  const b = boundaryBox(points);
  if (b.w < MIN_SPACE || b.h < MIN_SPACE) return false;
  return strokeClosed(points);
}

/**
 * The middle of the area, not of the box round it: a crescent's box centre
 * is outside the crescent, and a hole that grows from there grows from
 * nowhere. Falls back to the box's centre for a degenerate line.
 */
export function centroid(points: SketchPoint[]): SketchPoint {
  let area = 0, cx = 0, cy = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % n]!;
    const f = x1 * y2 - x2 * y1;
    area += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(area) < 1e-6) {
    const b = boundaryBox(points);
    return [b.x + b.w / 2, b.y + b.h / 2];
  }
  return [cx / (3 * area), cy / (3 * area)];
}

/** Is the point inside the boundary? Ray casting, the polygon closed implicitly. */
export function pointInBoundary(points: SketchPoint[], x: number, y: number): boolean {
  let inside = false;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = points[i]!;
    const [xj, yj] = points[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const pointInSpace = (s: Space, x: number, y: number): boolean => pointInBoundary(s.boundary, x, y);

/** A part has landed inside when its middle is inside. Its corners may hang over the line. */
export function nodeInSpace(s: Space, node: { x: number; y: number; w: number; h: number; pageId: string }): boolean {
  if (node.pageId !== s.pageId) return false;
  return pointInSpace(s, node.x + node.w / 2, node.y + node.h / 2);
}

/**
 * The boundary grown from its centroid: `p` of the way from a point to the
 * whole line. This is the consuming. A hole drawn as a blob grows as that
 * blob rather than as a circle that happens to end on it.
 */
export function grownBoundary(points: SketchPoint[], p: number): SketchPoint[] {
  const [cx, cy] = centroid(points);
  const k = Math.max(0, Math.min(1, p));
  return points.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

/** A round boundary, for a space made from the menu rather than drawn. */
export function roundBoundary(cx: number, cy: number, r: number, points = 48): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    out.push([Math.round((cx + Math.cos(a) * r) * 10) / 10, Math.round((cy + Math.sin(a) * r) * 10) / 10]);
  }
  out.push([...out[0]!] as SketchPoint);
  return out;
}

/** The boundary as an SVG path, closed. In the units the points are in. */
export function boundaryPath(points: SketchPoint[]): string {
  if (!points.length) return "";
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
}

/* ------------------------------------------------------------------ */
/* Time                                                                 */
/* ------------------------------------------------------------------ */

/**
 * How far a hole has got, 0..1. A construct or a placeholder is never
 * consuming, so they answer 0; a hole decided before the page was last
 * opened has long finished and answers 1.
 */
export function consumed(s: Space, now: number): number {
  if (s.kind !== "hole" || s.since === null) return 0;
  return Math.max(0, Math.min(1, (now - s.since) / CONSUME_MS));
}

/** Open means a hole that has finished consuming: the area is drawing space. */
export function isOpen(s: Space, now: number): boolean {
  return s.kind === "hole" && consumed(s, now) >= 1;
}

/** The open space the part has landed in, or null. The newest wins when two overlap. */
export function spaceOf<S extends Space>(spaces: readonly S[], node: { x: number; y: number; w: number; h: number; pageId: string }, now: number): S | null {
  let hit: S | null = null;
  for (const s of spaces) if (isOpen(s, now) && nodeInSpace(s, node) && (!hit || s.at > hit.at)) hit = s;
  return hit;
}

/* ------------------------------------------------------------------ */
/* The plan                                                             */
/* ------------------------------------------------------------------ */

/** What the panel needs to know about one part. A subset of the node, so this file stays free of the store. */
export interface Planned {
  label: string;
  prompt: string;
  featureId: string;
  w: number;
  h: number;
  role?: string | null;
  outline?: unknown | null;
  content?: string;
  /** A picture rather than a line: `vector.kind` on the node. */
  pictureKind?: string | null;
  plan?: Plan | null;
  sketch?: { words: string } | null;
}

export interface Reading {
  /** What it is: the part's name. */
  what: string;
  /** What was asked: the prompt, the drawing's words, or nothing. */
  asked: string;
  making: Making;
  /** The model the route will send it to, or null with the reason. */
  model: ImageModel | null;
  why: NoModel | null;
  /** Whether the person named the model or the route picked it. */
  chosen: boolean;
  /** The steps it will go through, in order. */
  steps: Step[];
  /** Whether the person set the order. */
  ordered: boolean;
}

/**
 * Which steps a part goes through when nobody has said.
 *
 * Every step in the route's list, except that alpha is only a step when the
 * part needs the ground taken off and is not already cut to a drawn line.
 * Reading is always first: a drawing has to be read before anything draws.
 */
export function defaultSteps(making: Making, clipped: boolean): Step[] {
  return STEPS.filter((st) => st !== "alpha" || (needsAlpha(making) && !clipped));
}

/** Only steps the route knows, once each, in the order given. */
export function tidySteps(steps: readonly string[]): Step[] {
  const out: Step[] = [];
  for (const st of steps) if ((STEPS as readonly string[]).includes(st) && !out.includes(st as Step)) out.push(st as Step);
  return out;
}

/** Move one step to a new place in the order. Out-of-range is a no-op. */
export function moveStep(steps: readonly Step[], from: number, to: number): Step[] {
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length || from === to) return [...steps];
  const out = [...steps];
  const [s] = out.splice(from, 1);
  out.splice(to, 0, s!);
  return out;
}

/**
 * What the panel says about one part.
 *
 * The route is asked the same question the run asks it, for the first pass
 * that draws anything, so the model named here is the model that would be
 * used. A plan on the node is honoured the way the run honours it: its
 * model is preferred when that model serves the job, and its steps are the
 * order.
 */
export function planFor(n: Planned): Reading {
  const said = (n.prompt || n.sketch?.words || "").trim();
  const clipped = !!n.outline;
  const making = makingOf({
    kind: n.pictureKind ?? undefined,
    role: n.role ?? null,
    hasText: !!(n.content && n.content.trim()),
    said,
    w: n.w,
    h: n.h,
  });
  const steps = n.plan?.steps?.length ? tidySteps(n.plan.steps) : defaultSteps(making, clipped);
  // The first step that asks a model to draw: the one a person means by "the model".
  const first = steps.find((st) => st !== "read") ?? "first";
  const routed = route({ making, step: first, clipped, fromImage: first !== "first", w: n.w, h: n.h, prefer: n.plan?.model ?? undefined });
  return {
    what: n.label,
    asked: said,
    making,
    model: routed.model,
    why: routed.model ? null : routed.why ?? null,
    chosen: !!n.plan?.model && routed.model?.slug === n.plan.model,
    steps,
    ordered: !!n.plan?.steps?.length,
  };
}

/** The step's name in a sentence on the panel. */
export const STEP_MEANS: Record<Step, string> = {
  read: "Read the drawing",
  first: "First pass",
  refine: "Refine it",
  alpha: "Take the ground off",
};
