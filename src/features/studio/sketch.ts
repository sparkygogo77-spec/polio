/**
 * A sketch: what was drawn on the drawing board, and the words beside it.
 *
 * The board is one dark disc the size of the part menu. Whatever is drawn on
 * it is kept on the part as strokes in the board's own square — fractions of
 * its width, so `[0.5, 0.5]` is the middle whatever size the board is drawn
 * at — and read three ways: turned into words for the blueprint, measured
 * for a reshape that needs no model at all, and written out as text for the
 * reshape route to hand to Claude beside a picture of it.
 *
 * Pure: no React, no store, no browser. `store.ts`, `spec.ts`, the board and
 * the API route all import from here.
 */

export type SketchPoint = [number, number];

export interface Sketch {
  /** Each stroke is a polyline; every point is a fraction of the board's width, 0..1 both ways. */
  strokes: SketchPoint[][];
  /** Words typed beside the drawing, when the drawing is not enough on its own. */
  words: string;
}

export interface SketchBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function emptySketch(): Sketch {
  return { strokes: [], words: "" };
}

/** A sketch with nothing drawn on it — words alone are not a shape. */
export function isBlankSketch(s: Sketch | null | undefined): boolean {
  return !s || !s.strokes.some((st) => st.length >= 2);
}

/**
 * Drop points closer than `gap` to the one before, and round what is left.
 * A stroke at 60Hz is mostly points a pixel apart, and the document lives in
 * localStorage.
 */
export function tidyStroke(points: SketchPoint[], gap = 0.004): SketchPoint[] {
  const out: SketchPoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < gap) continue;
    out.push([round3(p[0]), round3(p[1])]);
  }
  // A tap is a dot: keep it as two points so it still draws.
  if (out.length === 1 && points.length > 0) out.push([...out[0]!] as SketchPoint);
  return out;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** The box round everything drawn, or null when nothing is. */
export function sketchBox(strokes: SketchPoint[][]): SketchBox | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const st of strokes) {
    for (const [x, y] of st) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, w: Math.max(0.002, x1 - x0), h: Math.max(0.002, y1 - y0) };
}

/** Width over height, with a floor so a straight line never divides by nothing. */
export function boxAspect(box: SketchBox): number {
  return Math.max(0.05, Math.min(20, box.w / Math.max(0.002, box.h)));
}

/**
 * Does the stroke come back to where it started?
 *
 * Four points is the fewest that can enclose anything — three corners and the
 * return — and a snapped box is exactly five, a snapped triangle exactly
 * four. Asking for eight, as this once did, meant every shape the board
 * snapped read as an open line: no outline, so no boundary, so the part was
 * fitted to the box round the ink instead of to the line drawn round it.
 */
export function strokeClosed(stroke: SketchPoint[]): boolean {
  if (stroke.length < 4) return false;
  const box = sketchBox([stroke]);
  if (!box) return false;
  const diag = Math.hypot(box.w, box.h);
  const a = stroke[0]!;
  const b = stroke[stroke.length - 1]!;
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < Math.max(0.03, diag * 0.16);
}

/** Shoelace area of a stroke read as a polygon, as a share of its own box. */
function fillOfBox(stroke: SketchPoint[]): number {
  const box = sketchBox([stroke]);
  if (!box) return 0;
  let area = 0;
  for (let i = 0; i < stroke.length; i++) {
    const [x1, y1] = stroke[i]!;
    const [x2, y2] = stroke[(i + 1) % stroke.length]!;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2 / Math.max(1e-6, box.w * box.h);
}

export interface SketchReading {
  strokes: number;
  box: SketchBox | null;
  /** Width over height of everything drawn. */
  aspect: number;
  shape: "wide" | "tall" | "square";
  closed: number;
  open: number;
  /** For the closed outlines: rounded like a pill or a circle, or squared like a box. */
  outline: "rounded" | "boxed" | null;
  /** Closed outlines lying inside another closed outline — a box with things in it. */
  inside: number;
}

/** What the drawing is, measured. */
export function readSketch(sketch: Sketch): SketchReading {
  const strokes = sketch.strokes.filter((s) => s.length >= 2);
  const box = sketchBox(strokes);
  const aspect = box ? boxAspect(box) : 1;
  const shape: SketchReading["shape"] = aspect > 1.25 ? "wide" : aspect < 0.8 ? "tall" : "square";
  const closedStrokes = strokes.filter(strokeClosed);
  const fills = closedStrokes.map(fillOfBox);
  const outline: SketchReading["outline"] = !closedStrokes.length
    ? null
    : fills.reduce((a, b) => a + b, 0) / fills.length < 0.86
      ? "rounded"
      : "boxed";
  const boxes = closedStrokes.map((s) => sketchBox([s])!);
  let inside = 0;
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]!;
    const within = boxes.some((b, j) => j !== i && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && b.w * b.h > a.w * a.h * 1.3);
    if (within) inside++;
  }
  return { strokes: strokes.length, box, aspect, shape, closed: closedStrokes.length, open: strokes.length - closedStrokes.length, outline, inside };
}

/* ------------------------------------------------------------------ */
/* The boundary                                                        */
/* ------------------------------------------------------------------ */

/**
 * How much of everything drawn an outline must enclose before it counts as
 * the part's boundary rather than one mark among many.
 */
export const BOUNDARY_SHARE = 0.6;

/** How far past the boundary a point may sit and still be called inside: a hair, in board widths. */
const BOUNDARY_SLOP = 0.012;

export interface Boundary {
  /** The box the part fills, edge to edge. */
  box: SketchBox;
  /** Width over height of that box: the proportion the part is held to. */
  aspect: number;
  /** True when a closed outline set it; false when it is only the box round the ink. */
  outlined: boolean;
  /** Strokes wholly within the boundary — the barriers and the things the part holds. */
  inside: number;
  /** Strokes that leave the boundary. A drawing meant as one shape has none. */
  crossing: number;
}

/**
 * The part's boundary: the outermost closed outline, or, when nothing was
 * drawn closed, the box round everything.
 *
 * The lines drawn are the barriers and the boundary of the part — the outline
 * is the part's edge, the part fills it, and nothing crosses it. This is
 * where that is measured: the outline that bounds it, the proportion it is
 * held to, what sits inside, and what leaks out. An outline only bounds the
 * part when it holds most of what is drawn (`BOUNDARY_SHARE`), so a small
 * circle beside a big scrawl is a mark inside the drawing, not its edge.
 */
export function readBoundary(sketch: Sketch): Boundary | null {
  const strokes = sketch.strokes.filter((s) => s.length >= 2);
  const all = sketchBox(strokes);
  if (!all) return null;

  let outline: SketchPoint[] | null = null;
  let box: SketchBox | null = null;
  for (const s of strokes) {
    if (!strokeClosed(s)) continue;
    const b = sketchBox([s])!;
    if (!box || b.w * b.h > box.w * box.h) { outline = s; box = b; }
  }
  const outlined = !!box && box.w * box.h >= all.w * all.h * BOUNDARY_SHARE;
  const bound = outlined ? box! : all;

  let inside = 0;
  let crossing = 0;
  for (const s of strokes) {
    if (outlined && s === outline) continue;
    const out = s.some(([x, y]) => x < bound.x - BOUNDARY_SLOP || y < bound.y - BOUNDARY_SLOP || x > bound.x + bound.w + BOUNDARY_SLOP || y > bound.y + bound.h + BOUNDARY_SLOP);
    if (out) crossing++;
    else inside++;
  }
  return { box: bound, aspect: boxAspect(bound), outlined, inside, crossing };
}

/** The boundary in words, in percent of the board: where it is, how big, what proportion, what it holds. */
export function describeBoundary(b: Boundary): string {
  const pc = (v: number) => Math.round(v * 100);
  const where = `${pc(b.box.x)}%,${pc(b.box.y)}% to ${pc(b.box.x + b.box.w)}%,${pc(b.box.y + b.box.h)}% of the board`;
  const size = `${pc(b.box.w)}% wide by ${pc(b.box.h)}% tall, proportion ${aspectWords(b.aspect)} (aspect ${b.aspect.toFixed(2)})`;
  const holds = b.inside ? `${b.inside} stroke${b.inside === 1 ? "" : "s"} inside it` : "nothing inside it";
  const leaks = b.crossing ? `; ${b.crossing} stroke${b.crossing === 1 ? "" : "s"} cross it` : "";
  return `${b.outlined ? "a closed outline" : "no closed outline, so the box round everything drawn"}, ${where}, ${size}, with ${holds}${leaks}`;
}

/** "3:1" or "1:2" — the proportion, in small whole numbers. */
export function aspectWords(aspect: number): string {
  if (aspect >= 1) {
    const r = Math.round(aspect * 2) / 2;
    return r === 1 ? "1:1" : `${r % 1 === 0 ? r : r.toFixed(1)}:1`;
  }
  const r = Math.round((1 / aspect) * 2) / 2;
  return `1:${r % 1 === 0 ? r : r.toFixed(1)}`;
}

/**
 * The drawing in words, for the blueprint and for anyone reading without
 * the picture: how many strokes, the overall proportion, what the outline is
 * like, and the words that went with it.
 */
export function describeSketch(sketch: Sketch): string {
  const r = readSketch(sketch);
  const parts: string[] = [];
  if (r.strokes) {
    parts.push(`${r.strokes} stroke${r.strokes === 1 ? "" : "s"}`);
    parts.push(`about ${aspectWords(r.aspect)}, ${r.shape === "square" ? "roughly square" : r.shape === "wide" ? "wider than tall" : "taller than wide"}`);
    if (r.closed) parts.push(`${r.closed} closed ${r.outline === "rounded" ? "rounded" : "boxed"} outline${r.closed === 1 ? "" : "s"}${r.inside ? ` (${r.inside} inside another)` : ""}`);
    if (r.open) parts.push(`${r.open} open line${r.open === 1 ? "" : "s"}`);
    if (r.box) {
      const cx = r.box.x + r.box.w / 2;
      const cy = r.box.y + r.box.h / 2;
      const where = [cy < 0.4 ? "top" : cy > 0.6 ? "bottom" : "", cx < 0.4 ? "left" : cx > 0.6 ? "right" : ""].filter(Boolean).join(" ");
      parts.push(`${Math.round(Math.max(r.box.w, r.box.h) * 100)}% of the board${where ? `, toward the ${where}` : ""}`);
    }
  }
  const words = sketch.words.trim();
  if (words) parts.push(`words: "${words}"`);
  return parts.join("; ");
}

/**
 * A size in the boundary's proportion, keeping the part's area.
 *
 * The one reshape that needs no model: the outline's width over height
 * becomes the part's, and the part keeps the room it had. Clamped to the
 * frame and to the smallest a part can be.
 */
export function fitToSketch(sketch: Sketch, w: number, h: number, frameWidth: number): { w: number; h: number } {
  const b = readBoundary(sketch);
  if (!b) return { w, h };
  const area = Math.max(40 * 24, w * h);
  let nw = Math.sqrt(area * b.aspect);
  let nh = Math.sqrt(area / b.aspect);
  if (nw > frameWidth) {
    nw = frameWidth;
    nh = nw / b.aspect;
  }
  return { w: Math.round(Math.max(40, nw)), h: Math.round(Math.max(24, Math.min(1600, nh))) };
}

/**
 * The strokes as text, for a model reading beside the picture: each stroke
 * as up to `per` points in percent of the board, so a shape can be read off
 * the numbers when the picture is ambiguous.
 */
export function sketchToText(sketch: Sketch, per = 24): string {
  return sketch.strokes
    .filter((s) => s.length >= 2)
    .map((s, i) => {
      const step = Math.max(1, Math.ceil(s.length / per));
      const pts = s.filter((_, k) => k % step === 0 || k === s.length - 1);
      const closed = strokeClosed(s) ? " (closed)" : "";
      return `stroke ${i + 1}${closed}: ${pts.map(([x, y]) => `${Math.round(x * 100)},${Math.round(y * 100)}`).join(" ")}`;
    })
    .join("\n");
}

/** Anything saved before the board existed, or by hand, comes back as a sketch or nothing. */
export function normaliseSketch(v: unknown): Sketch | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { strokes?: unknown; words?: unknown };
  if (!Array.isArray(o.strokes)) return null;
  const strokes = o.strokes
    .filter((s): s is unknown[] => Array.isArray(s))
    .map((s) => s.filter((p): p is SketchPoint => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])))
    .filter((s) => s.length >= 1);
  return { strokes, words: typeof o.words === "string" ? o.words : "" };
}

/* ------------------------------------------------------------------ */
/* Snapping and smoothing                                              */
/* ------------------------------------------------------------------ */

/** How a finished stroke is kept: snapped to the shape it nearly is, smoothed, or as drawn. */
export type DrawMode = "snap" | "smooth" | "raw";

/** Ramer–Douglas–Peucker: the few points that carry the stroke's corners. */
function simplify(points: SketchPoint[], eps: number): SketchPoint[] {
  if (points.length < 3) return points.slice();
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let far = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const d = len < 1e-6 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > far) { far = d; at = i; }
  }
  if (far <= eps) return [a, b];
  const left = simplify(points.slice(0, at + 1), eps);
  const right = simplify(points.slice(at), eps);
  return [...left.slice(0, -1), ...right];
}

/** Drop vertices that sit on a straight run between their neighbours. */
function dropStraight(vertices: SketchPoint[], closed: boolean): SketchPoint[] {
  if (vertices.length < 3) return vertices;
  const keep: SketchPoint[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) { keep.push(vertices[i]!); continue; }
    const p = vertices[(i - 1 + n) % n]!, c = vertices[i]!, q = vertices[(i + 1) % n]!;
    const ax = p[0] - c[0], ay = p[1] - c[1], bx = q[0] - c[0], by = q[1] - c[1];
    const cos = (ax * bx + ay * by) / Math.max(1e-9, Math.hypot(ax, ay) * Math.hypot(bx, by));
    // cos near -1 is a straight line through c
    if (cos > -0.94) keep.push(c);
  }
  return keep;
}

/** A moving average that keeps the ends where they are. */
export function smoothStroke(points: SketchPoint[], passes = 2): SketchPoint[] {
  if (points.length < 3) return points.slice();
  let pts = points.slice();
  for (let k = 0; k < passes; k++) {
    const out: SketchPoint[] = [pts[0]!];
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1]!, c = pts[i]!, q = pts[i + 1]!;
      out.push([(p[0] + c[0] * 2 + q[0]) / 4, (p[1] + c[1] * 2 + q[1]) / 4]);
    }
    out.push(pts[pts.length - 1]!);
    pts = out;
  }
  return pts.map(([x, y]) => [round3(x), round3(y)]);
}

function ellipsePoints(box: SketchBox, n = 40): SketchPoint[] {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const out: SketchPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([round3(cx + Math.cos(t) * box.w / 2), round3(cy + Math.sin(t) * box.h / 2)]);
  }
  return out;
}

function rectPoints(box: SketchBox): SketchPoint[] {
  const r = (v: number) => round3(v);
  return [[r(box.x), r(box.y)], [r(box.x + box.w), r(box.y)], [r(box.x + box.w), r(box.y + box.h)], [r(box.x), r(box.y + box.h)], [r(box.x), r(box.y)]];
}

/** What a snapped stroke was read as, for a note on the board. */
export type SnapKind = "line" | "polyline" | "rectangle" | "triangle" | "ellipse" | "curve" | "loop" | "dot";

/**
 * The stroke as the shape it nearly is: a straight line (level or upright
 * when it nearly was), a few straight legs, a box, a triangle, an ellipse;
 * anything else smoothed and, if it came back to its start, closed.
 */
export function snapStroke(points: SketchPoint[]): { points: SketchPoint[]; kind: SnapKind } {
  const box = sketchBox([points]);
  if (!box || points.length < 2) return { points: points.slice(), kind: "dot" };
  const diag = Math.hypot(box.w, box.h);
  if (diag < 0.02) return { points: points.slice(), kind: "dot" };
  const eps = Math.max(0.012, diag * 0.07);
  const closed = strokeClosed(points);
  const raw = simplify(points, eps);
  const vertices = dropStraight(closed ? (Math.hypot(raw[0]![0] - raw[raw.length - 1]![0], raw[0]![1] - raw[raw.length - 1]![1]) < eps * 1.5 ? raw.slice(0, -1) : raw) : raw, closed);

  if (!closed) {
    if (vertices.length <= 2) {
      const a = points[0]!, b = points[points.length - 1]!;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      // Nearly level or nearly upright: make it so.
      if (Math.abs(dx) > Math.abs(dy) * 6) { const y = round3((a[1] + b[1]) / 2); return { points: [[round3(a[0]), y], [round3(b[0]), y]], kind: "line" }; }
      if (Math.abs(dy) > Math.abs(dx) * 6) { const x = round3((a[0] + b[0]) / 2); return { points: [[x, round3(a[1])], [x, round3(b[1])]], kind: "line" }; }
      return { points: [[round3(a[0]), round3(a[1])], [round3(b[0]), round3(b[1])]], kind: "line" };
    }
    if (vertices.length <= 5) return { points: vertices.map(([x, y]) => [round3(x), round3(y)]), kind: "polyline" };
    return { points: smoothStroke(points), kind: "curve" };
  }

  const fill = fillOfBox(points);
  if (vertices.length === 4 && fill > 0.72) return { points: rectPoints(box), kind: "rectangle" };
  if (vertices.length === 3) { const v = vertices.map(([x, y]) => [round3(x), round3(y)] as SketchPoint); return { points: [...v, v[0]!], kind: "triangle" }; }
  // Round: every point about the same normalised distance from the centre.
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const radii = points.map(([x, y]) => Math.hypot((x - cx) / Math.max(1e-6, box.w / 2), (y - cy) / Math.max(1e-6, box.h / 2)));
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const sd = Math.sqrt(radii.reduce((a, r) => a + (r - mean) * (r - mean), 0) / radii.length);
  if (sd < 0.16 && fill > 0.6 && vertices.length >= 5) return { points: ellipsePoints(box), kind: "ellipse" };
  const smoothed = smoothStroke(points);
  smoothed[smoothed.length - 1] = smoothed[0]!;
  return { points: smoothed, kind: "loop" };
}

/** A finished stroke, kept the way the board is set to keep it. */
export function refineStroke(points: SketchPoint[], mode: DrawMode): { points: SketchPoint[]; kind: SnapKind | null } {
  if (mode === "raw") return { points, kind: null };
  if (mode === "smooth") return { points: smoothStroke(points), kind: null };
  return snapStroke(points);
}
