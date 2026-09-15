/**
 * A space: a boundary drawn first, which becomes the surface inside it.
 *
 * **Create and Draw differ by how many elements come out, and by nothing
 * else.** Draw makes one element. Create makes a surface holding several.
 * That is the whole distinction, so the choice a person makes is not what
 * kind of object they are making, it is whether they are making one thing
 * or a place holding several things — and it is made before the line is
 * drawn, on the menu, rather than after it on a pair of keys.
 *
 * The construct box is gone. It was a third kind of object offered after
 * the fact, which is exactly the choice this stopped being: both paths
 * open a black hole now.
 *
 * **The create flow.** The boundary is drawn first and is understood as
 * the outermost layer of what is coming rather than as an element. It
 * becomes a black hole in its own right, and its area becomes the ground
 * everything after is drawn on. Each thing drawn inside carries its own
 * prompt — a square saying "chart associated with the currently traded
 * token", the button beside it saying "buy button" — and Generate turns
 * the lot into **one surface holding those elements, locked in the ratio
 * and the size they were drawn at**, relative to each other and to the
 * boundary.
 *
 * That locking is the point. The layout was drawn, so the layout is the
 * specification: every element's rect is kept as a fraction of the
 * boundary's box (`lockLayout`), and moving or resizing the surface
 * carries them with it (`placeLocked`). A surface that let its contents
 * drift would be a drawing of a layout rather than a layout.
 *
 * Every element that lands inside gets a panel of its own, on the right:
 * what it is, what was asked, which model the route will send it to, and
 * the order of the tasks it will go through. That is the `Plan`, and
 * `planFor` is what the panel reads.
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

/**
 * One element's place inside a surface, as fractions of the boundary's box.
 *
 * Kept as fractions rather than pixels because that is what "locked in the
 * ratio and the size he drew them at" means: the surface can be moved and
 * resized and its contents keep the layout that was drawn.
 */
export interface Locked {
  nodeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Space {
  id: string;
  pageId: string;
  /** The boundary as drawn, in canvas pixels. Closed: the last point is near the first. */
  boundary: SketchPoint[];
  /** When it was made, so the consuming can be clocked from it. */
  since: number | null;
  /** What this space is for, in the person's words. */
  prompt: string;
  label: string;
  /**
   * How everything made in this space is to be made, when a person has
   * said: the same record a part carries, set from the space's own panel.
   * A part that lands inside inherits it unless it says otherwise.
   */
  plan?: Plan | null;
  /**
   * The layout, locked: where each element sits inside the boundary, as
   * fractions of it. Written by Generate and read whenever the surface is
   * moved or resized. Null until it has been made.
   */
  locked?: Locked[] | null;
  /**
   * How far the surface has formed, on the timeline's own driver
   * (`formation.ts`): boundary and edge first, then the middle fills.
   * Null before Generate. The same numbers euler's cards form on, because
   * a second formation would be a second answer to one question.
   */
  form?: { p: number; gen: number } | null;
  /**
   * When it was last opened. Only one space is open at a time: the one
   * opened most recently, drawing counting as opening (`openOf`). Absent
   * on a space that has never been opened by hand, which is most of them.
   */
  opened?: number;
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
  /**
   * What the person set on the model, by field name, when they set anything
   * (`ModelField` on the route's table). The run hands it to every later
   * pass; the route holds it to what the model takes.
   */
  options?: Record<string, unknown> | null;
}

/** A closed line has to be at least this big, either way, to be a space. Smaller is a dot. */
export const MIN_SPACE = 24;

/**
 * How close two points on a boundary may be before the second is the same
 * point, in canvas pixels, and how many are kept at the very most.
 *
 * A hand drawing one careful loop sends a point on every pointer move for
 * as long as it is down: a two hundred move loop was kept as two hundred
 * and one points, because nothing thinned it. A drawn stroke has been
 * tidied on the way in since the drawing board existed (`tidyStroke`); a
 * boundary never was, and it is the one that pays for it — every point
 * lands in a `clip-path: path(…)` string that the compositor re-parses on
 * every frame while the hole consumes, and in localStorage for ever after.
 *
 * The cap is `outlinePath`'s own, for the same reason it has one: past
 * about a hundred points a drawn line has no shape left to lose.
 */
export const BOUNDARY_GAP = 2;
export const BOUNDARY_POINTS = 96;

/**
 * A boundary as it is worth keeping: no two points on top of each other,
 * and no more of them than the line has shape.
 *
 * Thinning happens where the space is made rather than where it is drawn,
 * so every door gets it — the hand, the menu and the wheel alike — and a
 * space is the same record however it arrived. The ends are always kept:
 * whether a line is closed is measured from them.
 */
export function tidyBoundary(points: SketchPoint[]): SketchPoint[] {
  if (points.length < 3) return points.map(([x, y]) => [round1(x), round1(y)]);
  const near: SketchPoint[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const last = near[near.length - 1]!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= BOUNDARY_GAP) near.push(p);
  }
  near.push(points[points.length - 1]!);
  // Still too many: keep every nth, and both ends.
  let out = near;
  if (near.length > BOUNDARY_POINTS) {
    const step = (near.length - 1) / (BOUNDARY_POINTS - 1);
    out = Array.from({ length: BOUNDARY_POINTS }, (_, i) => near[Math.round(i * step)]!);
    out[out.length - 1] = near[near.length - 1]!;
  }
  return out.map(([x, y]) => [round1(x), round1(y)]);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

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
  if (s.since === null) return 0;
  return Math.max(0, Math.min(1, (now - s.since) / CONSUME_MS));
}

/** Open means a hole that has finished consuming: the area is drawing space. */
export function isOpen(s: Space, now: number): boolean {
  return consumed(s, now) >= 1;
}

/** The open space the part has landed in, or null. The newest wins when two overlap. */
/**
 * The one open space: a black hole is open on one line at a time.
 *
 * Opening one closes whatever was open. The open one is the space opened
 * most recently, and drawing a space opens it, so with nothing opened by
 * hand it is the newest line; a surface already made is not a hole and is
 * never the open one. Null when there is nothing to open.
 */
export function openOf<S extends Space>(spaces: readonly S[]): S | null {
  let best: S | null = null;
  let when = -Infinity;
  for (const sp of spaces) {
    if (isMade(sp)) continue;
    const t = Math.max(sp.opened ?? -Infinity, sp.since ?? -Infinity, sp.at);
    if (t > when) { when = t; best = sp; }
  }
  return best;
}

/** How far from the point to the nearest piece of the line. */
export function distanceToBoundary(points: SketchPoint[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)));
  }
  return best;
}

/**
 * The space the eraser is on: its line within `tol`, or, failing that, the
 * newest space the point is inside. On the line first because a small hole
 * inside a big one is erased by its own line, not by the big one's area.
 */
export function spaceAtLine<S extends Space>(spaces: readonly S[], x: number, y: number, tol: number): S | null {
  let best: S | null = null;
  let bestD = tol;
  for (const sp of spaces) {
    const d = distanceToBoundary(sp.boundary, x, y);
    if (d < bestD) { bestD = d; best = sp; }
  }
  if (best) return best;
  const inside = spaces.filter((sp) => pointInBoundary(sp.boundary, x, y));
  return inside.length ? inside.reduce((a, b) => (b.at > a.at ? b : a)) : null;
}

export function spaceOf<S extends Space>(spaces: readonly S[], node: { x: number; y: number; w: number; h: number; pageId: string }, now: number): S | null {
  let hit: S | null = null;
  for (const s of spaces) if (isOpen(s, now) && nodeInSpace(s, node) && (!hit || s.at > hit.at)) hit = s;
  return hit;
}

/**
 * The open space a drawing was drawn in, or null.
 *
 * A drawing belongs to a space by the same rule a part does — geometry,
 * never a stored pointer — because both are things that sit somewhere on
 * the page and the page is where the truth is. The middle of the drawing's
 * own box is the test, so a stroke whose tail wanders over the line still
 * belongs to the space it was drawn in, exactly as a part whose corner
 * hangs over does.
 *
 * This is what was missing: a drawing made inside a hole did not know the
 * hole, so its Make real door produced an ordinary part that happened to
 * land in the same place, with none of the space's plan on it.
 */
export function spaceOfDrawing<S extends Space>(
  spaces: readonly S[],
  drawing: { pageId: string; bounds: { x: number; y: number; w: number; h: number } },
  now: number,
): S | null {
  const { x, y, w, h } = drawing.bounds;
  return spaceOf(spaces, { pageId: drawing.pageId, x, y, w, h }, now);
}

/**
 * What a part made inside a space inherits from it.
 *
 * The space's own plan, when it has one, and its prompt as the words the
 * part is made under. A part that lands in a space a person has already
 * steered should be steered the same way without their saying it twice;
 * anything the part says for itself wins, because it is more particular.
 */
export function inheritedFrom(space: Space | null): { plan?: Plan; prompt?: string } {
  if (!space) return {};
  return {
    ...(space.plan ? { plan: { model: space.plan.model, steps: [...space.plan.steps] } } : {}),
    ...(space.prompt.trim() ? { prompt: space.prompt.trim() } : {}),
  };
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
/** The parts that are a solid by what they are: the cube (code) and the mesh (a file). Their words are what is on them. */
export function isSolidPart(featureId: string): boolean {
  return featureId === "cube-3d" || featureId === "mesh-3d";
}

export function defaultSteps(making: Making, clipped: boolean): Step[] {
  // Recreate — the grounded step, the real thing from the world — is never a
  // default: it is taken when a person puts it in the order, and not before.
  return STEPS.filter((st) => st !== "recreate" && (st !== "alpha" || (needsAlpha(making) && !clipped)));
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
  /*
   * A cube is a solid before its words are read. It is the one part that
   * is code rather than a picture, and the road past it goes to the one
   * cell that returns a solid, in one step: its own four faces up, a mesh
   * back. Read off the part, not off the words, because a cube's words
   * are what is written on its sides and say nothing about where it goes.
   */
  const solid = isSolidPart(n.featureId);
  const making = solid
    ? "object"
    : makingOf({
        kind: n.pictureKind ?? undefined,
        role: n.role ?? null,
        hasText: !!(n.content && n.content.trim()),
        said,
        w: n.w,
        h: n.h,
      });
  const steps = n.plan?.steps?.length ? tidySteps(n.plan.steps) : solid ? ["first" as Step] : defaultSteps(making, clipped);
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

/* ------------------------------------------------------------------ */
/* The surface: the layout, locked                                      */
/* ------------------------------------------------------------------ */

/** What Generate is handed about one element: enough to lock it and to brief it. */
export interface Placed {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  prompt: string;
}

/**
 * The layout as fractions of the boundary's box.
 *
 * This is the whole of "locked in the ratio and the size he drew them at,
 * relative to each other and to the boundary": every element's rect is
 * divided by the boundary it was drawn in, so what is kept is the layout
 * rather than a set of coordinates that happened to be true once.
 */
export function lockLayout(space: Space, placed: readonly Placed[]): Locked[] {
  const b = spaceBox(space);
  const w = Math.max(1, b.w);
  const h = Math.max(1, b.h);
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return placed.map((p) => ({
    nodeId: p.id,
    x: r4((p.x - b.x) / w),
    y: r4((p.y - b.y) / h),
    w: r4(p.w / w),
    h: r4(p.h / h),
  }));
}

/**
 * Where every locked element goes when the surface's box is `box`.
 *
 * The inverse of `lockLayout`, and the reason the locking is worth having:
 * move the surface and its contents move with it, resize it and they scale
 * with it, in the proportions they were drawn in. Rounded to whole pixels,
 * because a part's rect is whole pixels everywhere else in this app.
 */
export function placeLocked(space: Space, box: Box): { nodeId: string; x: number; y: number; w: number; h: number }[] {
  if (!space.locked?.length) return [];
  return space.locked.map((l) => ({
    nodeId: l.nodeId,
    x: Math.round(box.x + l.x * box.w),
    y: Math.round(box.y + l.y * box.h),
    w: Math.max(8, Math.round(l.w * box.w)),
    h: Math.max(8, Math.round(l.h * box.h)),
  }));
}

/** The boundary itself, moved and scaled to a new box: the surface's own edge follows. */
export function boundaryIn(space: Space, box: Box): SketchPoint[] {
  const b = spaceBox(space);
  const sx = box.w / Math.max(1, b.w);
  const sy = box.h / Math.max(1, b.h);
  return space.boundary.map(([x, y]) => [
    Math.round((box.x + (x - b.x) * sx) * 10) / 10,
    Math.round((box.y + (y - b.y) * sy) * 10) / 10,
  ]);
}

/** Has this surface been made? A locked layout is what says so. */
export const isMade = (s: Space): boolean => !!s.locked?.length;

/**
 * Which of the queue's jobs belong to this space.
 *
 * By where the drawing was, like everything else here, rather than by a
 * field written on the job: a job carries the point its drawing was made
 * at, and that point is either inside the boundary or it is not.
 */
export function jobsInSpace<J extends { at: { x: number; y: number } | null; status: string }>(jobs: readonly J[], space: Space): J[] {
  return jobs.filter((j) => j.at && pointInSpace(space, j.at.x, j.at.y));
}

/**
 * How far a surface has formed, from the work it started.
 *
 * The elements are what the surface is, so the surface is as far along as
 * they are: one share for each, and a job part-way through counts for the
 * part of it that has run. `QUEUED` is the floor because a surface that
 * has been asked for exists, which is euler's rule for a card and the same
 * rule here.
 */
export function formFromJobs(
  jobs: readonly { status: string; step?: string }[],
  queued: number,
  progress: (step: string | undefined) => number | null = () => null,
): number {
  if (!jobs.length) return 1;
  let sum = 0;
  for (const j of jobs) {
    if (j.status === "done" || j.status === "failed") sum += 1;
    // A job part-way through counts for the step it is on, read the way a
    // card reads it (`progressOf`); half, when the step says nothing.
    else if (j.status === "running") sum += Math.max(queued, Math.min(0.95, progress(j.step) ?? 0.5));
    else sum += queued;
  }
  return Math.max(queued, Math.min(1, sum / jobs.length));
}

/* ------------------------------------------------------------------ */
/* The brief                                                            */
/* ------------------------------------------------------------------ */

/**
 * What a person wrote here, as something a model can build a backend from.
 *
 * Every prompt written in a space has that as its real destination, so it
 * leaves here as a brief rather than as a label: what the surface is, how
 * big it is, and every element in it with its own words *and its place*,
 * given as a share of the surface rather than in pixels, because the
 * layout is the specification and a pixel is only true at one size.
 *
 * The conventions are said in the text, the way the blueprint says its
 * own, so this can be handed to an agent with nothing else attached.
 */
export function surfaceBrief(space: Space, placed: readonly Placed[]): string {
  const b = spaceBox(space);
  const name = space.label.trim() || "A surface";
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const lines: string[] = [];
  lines.push(`# ${name}`);
  lines.push("");
  lines.push(`One surface holding ${placed.length} element${placed.length === 1 ? "" : "s"}, drawn at ${Math.round(b.w)} × ${Math.round(b.h)}.`);
  if (space.prompt.trim()) {
    lines.push("");
    lines.push(space.prompt.trim());
  }
  lines.push("");
  lines.push("## How to read this");
  lines.push("");
  lines.push("Every position and size below is a share of the surface, not a pixel count: the layout was drawn and the proportions are the specification. Left and top are measured from the surface's top left. An element keeps its share of the surface at any size.");
  lines.push("");
  lines.push("## What is in it");
  const b0 = spaceBox(space);
  const w = Math.max(1, b0.w);
  const h = Math.max(1, b0.h);
  for (const p of [...placed].sort((a, z) => a.y - z.y || a.x - z.x)) {
    lines.push("");
    lines.push(`### ${p.label.trim() || "An element"}`);
    lines.push("");
    lines.push(`- Sits ${pct((p.x - b0.x) / w)} from the left and ${pct((p.y - b0.y) / h)} from the top, ${pct(p.w / w)} of the surface wide and ${pct(p.h / h)} of it tall.`);
    lines.push(`- What it is for: ${p.prompt.trim() || "not said yet."}`);
  }
  lines.push("");
  lines.push("## What the backend must provide");
  lines.push("");
  const asked = placed.filter((p) => p.prompt.trim());
  if (!asked.length) {
    lines.push("Nothing yet: no element in this surface has been said to do anything.");
  } else {
    lines.push("Read off what each element was asked for, one line each. Anything naming live values, a price, a balance, a list that changes, or an action a visitor takes, needs something behind it.");
    for (const p of asked) lines.push(`- **${p.label.trim() || "An element"}**: ${p.prompt.trim()}`);
  }
  return lines.join("\n");
}

/** The step's name in a sentence on the panel. */
export const STEP_MEANS: Record<Step, string> = {
  read: "Read the drawing",
  first: "First pass",
  refine: "Refine it",
  recreate: "Recreate the real thing",
  alpha: "Take the ground off",
};
