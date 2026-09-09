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

/** Does the stroke come back to where it started? */
export function strokeClosed(stroke: SketchPoint[]): boolean {
  if (stroke.length < 8) return false;
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
 * A size in the drawing's proportion, keeping the part's area.
 *
 * The one reshape that needs no model: the drawing's width over height
 * becomes the part's, and the part keeps the room it had. Clamped to the
 * frame and to the smallest a part can be.
 */
export function fitToSketch(sketch: Sketch, w: number, h: number, frameWidth: number): { w: number; h: number } {
  const r = readSketch(sketch);
  if (!r.box) return { w, h };
  const area = Math.max(40 * 24, w * h);
  let nw = Math.sqrt(area * r.aspect);
  let nh = Math.sqrt(area / r.aspect);
  if (nw > frameWidth) {
    nw = frameWidth;
    nh = nw / r.aspect;
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
