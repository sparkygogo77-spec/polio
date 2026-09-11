/**
 * What a drawing *is*, as opposed to what it looks like.
 *
 * A drawn shape has been a crop and nothing else: the line becomes the
 * part's edge and the part behaves exactly as it would in a rectangle. But
 * the shapes people draw are not decoration, they are a vocabulary — a box
 * round something means it holds it, an arrow between two things means they
 * are joined, a ring means a wrapper, three parallel strokes mean a list —
 * and throwing that away means the author has to say in words what they
 * already said with the pen.
 *
 * So the geometry is read a second time, for behaviour rather than for
 * shape. Nothing here touches the clip: `outlinePath` still produces the
 * exact edge it always did, and a triangle still cuts out as a triangle.
 * This only says what the part should *do* inside it.
 *
 * Pure, and tested by `tests/shapes.mjs`.
 */
import { saysCube } from "./parts/cubeFaces.ts";
import { sketchBox, strokeClosed, type Sketch, type SketchPoint } from "./sketch.ts";

export type DrawnKind = "cube" | "surface" | "connector" | "container" | "list" | "mark";

export interface DrawnRole {
  kind: DrawnKind;
  /** Why it was read that way, in the words the blueprint uses. */
  why: string;
  /** How many rows, when it is a list. */
  rows?: number;
}

/** What each kind means, for the blueprint and for anyone reading the document. */
export const KIND_MEANS: Record<DrawnKind, string> = {
  cube: "a cube: six faces in real 3D, turned with the pointer or the arrow keys, one piece of content a face",
  surface: "a surface: it holds what is placed on it",
  connector: "a connector: it joins the two parts at its ends",
  container: "a container: what falls inside it belongs to it",
  list: "a list: one row per stroke drawn",
  mark: "a mark: it is the shape and nothing more",
};

/** How straight a stroke is: the distance between its ends over the distance travelled. */
export function straightness(stroke: SketchPoint[]): number {
  if (stroke.length < 2) return 0;
  let run = 0;
  for (let i = 1; i < stroke.length; i++) {
    run += Math.hypot(stroke[i]![0] - stroke[i - 1]![0], stroke[i]![1] - stroke[i - 1]![1]);
  }
  const a = stroke[0]!;
  const b = stroke[stroke.length - 1]!;
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return run > 1e-6 ? span / run : 0;
}

/** The direction a stroke runs, as an angle in radians, folded to a half turn. */
function heading(stroke: SketchPoint[]): number {
  const a = stroke[0]!;
  const b = stroke[stroke.length - 1]!;
  const t = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return ((t % Math.PI) + Math.PI) % Math.PI;
}

function length(stroke: SketchPoint[]): number {
  const a = stroke[0]!;
  const b = stroke[stroke.length - 1]!;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function centre(stroke: SketchPoint[]): [number, number] {
  const b = sketchBox([stroke])!;
  return [b.x + b.w / 2, b.y + b.h / 2];
}

/** Two angles, the smaller way round a half turn. */
function apart(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, Math.PI - d);
}

/** Is one stroke's box inside another's, with room to spare? */
function within(inner: SketchPoint[], outer: SketchPoint[], share = 0.82): boolean {
  const i = sketchBox([inner]);
  const o = sketchBox([outer]);
  if (!i || !o) return false;
  return i.x >= o.x - 0.01 && i.y >= o.y - 0.01 && i.x + i.w <= o.x + o.w + 0.01 && i.y + i.h <= o.y + o.h + 0.01 && i.w * i.h <= o.w * o.h * share;
}

/**
 * Is this drawing a cube?
 *
 * Two ways a person draws one, and both are decided off the geometry with
 * no model anywhere near it:
 *
 * - **Three quadrilaterals meeting at a vertex.** The isometric box: a top,
 *   a left and a right, sharing one corner. Three closed strokes whose
 *   boxes overlap and which all pass within a hair of one common point.
 * - **A hexagon with a Y in it.** The same cube drawn as an outline and
 *   three creases: one closed stroke and three open ones that meet
 *   somewhere inside it.
 *
 * And one way it is said rather than drawn: a plain rectangle, when the
 * words next to it say cube or box. A rectangle is the cheapest thing to
 * draw and "make this a cube" is the cheapest thing to type, so the pair
 * has to work.
 */
function meetAt(strokes: SketchPoint[][], slop: number): boolean {
  // Every stroke has to pass near one point. Try each stroke's own points
  // as the candidate: the shared corner is a point on all of them.
  const first = strokes[0]!;
  for (const p of first) {
    let all = true;
    for (let i = 1; i < strokes.length && all; i++) {
      all = strokes[i]!.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < slop);
    }
    if (all) return true;
  }
  return false;
}

/** How many corners a closed stroke turns, after the wobble is taken out. */
export function corners(stroke: SketchPoint[], sharp = Math.PI / 5): number {
  const pts = stroke.filter((_, i) => i % Math.max(1, Math.floor(stroke.length / 32)) === 0);
  if (pts.length < 4) return pts.length;
  let turns = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length]!;
    const b = pts[i]!;
    const c = pts[(i + 1) % pts.length]!;
    const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(t2 - t1);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d > sharp) turns++;
  }
  return turns;
}

export function isCube(sketch: Sketch, said = ""): boolean {
  const strokes = sketch.strokes.filter((s) => s.length >= 2);
  if (!strokes.length) return false;
  const closed = strokes.filter(strokeClosed);
  const open = strokes.filter((s) => !strokeClosed(s));
  const all = sketchBox(strokes)!;
  const slop = Math.max(0.04, Math.hypot(all.w, all.h) * 0.14);

  // Three faces meeting at a corner.
  if (closed.length >= 3 && meetAt(closed.slice(0, 3), slop)) return true;
  // A hexagon with a Y inside it.
  if (closed.length === 1 && open.length === 3 && meetAt(open, slop)) {
    const n = corners(closed[0]!);
    if (n >= 5 && n <= 8) return true;
  }
  // Said rather than drawn: one closed shape that fills its box.
  const words = `${sketch.words ?? ""} ${said}`;
  if (saysCube(words) && closed.length >= 1) {
    const box = sketchBox([closed[0]!])!;
    if (box.w > 0.03 && box.h > 0.03) return true;
  }
  return false;
}

/** How straight counts as a line, and how parallel counts as parallel. */
const STRAIGHT = 0.92;
const PARALLEL = 0.22;

/**
 * Read a drawing for what it does.
 *
 * The order matters and is the order of certainty. A ring is two closed
 * lines, one inside the other, and nothing else is; a list is three or more
 * strokes running the same way at roughly the same length; a connector is a
 * single straight open line, with or without the two short strokes that
 * make it an arrow; a surface is one closed line with things inside it or
 * nothing inside it at all. What fits none of them is a mark, which is what
 * every drawing was until now.
 */
export function kindOfSketch(sketch: Sketch, said = ""): DrawnRole {
  const strokes = sketch.strokes.filter((s) => s.length >= 2);
  if (!strokes.length) return { kind: "mark", why: KIND_MEANS.mark };

  const closed = strokes.filter(strokeClosed);
  const open = strokes.filter((s) => !strokeClosed(s));

  /* A cube first: it is the one kind that replaces the part rather than
     dressing it, and a cube drawn as three faces would otherwise read as a
     container or a list. */
  if (isCube(sketch, said)) return { kind: "cube", why: KIND_MEANS.cube };

  /* A ring: a closed line with another closed line inside it. */
  if (closed.length >= 2) {
    const ordered = [...closed].sort((a, b) => {
      const x = sketchBox([a])!;
      const y = sketchBox([b])!;
      return y.w * y.h - x.w * x.h;
    });
    const outer = ordered[0]!;
    const inner = ordered.slice(1).find((s) => within(s, outer));
    if (inner) {
      const [ox, oy] = centre(outer);
      const [ix, iy] = centre(inner);
      const b = sketchBox([outer])!;
      const off = Math.hypot(ix - ox, iy - oy) / Math.max(1e-6, Math.hypot(b.w, b.h));
      if (off < 0.18) return { kind: "container", why: KIND_MEANS.container };
    }
  }

  /* A list: three or more strokes running the same way, of a similar length. */
  if (strokes.length >= 3 && open.length >= 3) {
    const lines = open.filter((s) => straightness(s) > 0.86);
    if (lines.length >= 3) {
      const head = heading(lines[0]!);
      const same = lines.filter((s) => apart(heading(s), head) < PARALLEL);
      if (same.length >= 3) {
        const lens = same.map(length);
        const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
        const even = lens.every((l) => Math.abs(l - mean) < mean * 0.45);
        if (even) return { kind: "list", why: KIND_MEANS.list, rows: same.length };
      }
    }
  }

  /* A connector: one straight open line, alone or with an arrowhead on it. */
  if (!closed.length && open.length) {
    const [spine, ...rest] = [...open].sort((a, b) => length(b) - length(a));
    const head = rest.length <= 2 && rest.every((s) => length(s) < length(spine!) * 0.45);
    if (straightness(spine!) > STRAIGHT && head) {
      return { kind: "connector", why: KIND_MEANS.connector };
    }
  }

  /* A surface: one closed line, whatever shape, holding whatever is in it. */
  if (closed.length === 1) return { kind: "surface", why: KIND_MEANS.surface };

  return { kind: "mark", why: KIND_MEANS.mark };
}
