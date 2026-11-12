/**
 * The geometry of a stroke (✍️ MARKUP), with nothing of the page in it, so a check can run it on its own.
 */
export type Pt = [number, number];
export type Box = { x: number; y: number; w: number; h: number };

const STEP = 6;


export function boxOf(points: readonly Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return points.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lengthOf = (points: readonly Pt[]) => points.reduce((s, p, i) => (i ? s + dist(points[i - 1]!, p) : 0), 0);

/** A freehand stroke is a circle when it ends near where it began and goes round its middle, not back and forth. */
export function isClosed(points: readonly Pt[]): boolean {
  if (points.length < 8) return false;
  const b = boxOf(points), size = Math.max(b.w, b.h);
  if (size < 16 || dist(points[0]!, points[points.length - 1]!) > Math.max(24, size * 0.3)) return false;
  /* About as long as its box's outline: a scribble back and forth is several times longer. */
  if (lengthOf(points) > 1.6 * 2 * (b.w + b.h)) return false;
  /* It goes round: the angle about its middle turns most of a full turn one way (a back-and-forth scribble turns none). A flat loop round a wide headline counts. */
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let turn = 0, last = Math.atan2(points[0]![1] - cy, points[0]![0] - cx);
  for (const [x, y] of points.slice(1)) {
    const a = Math.atan2(y - cy, x - cx);
    let d = a - last;
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    turn += d; last = a;
  }
  return Math.abs(turn) >= 1.6 * Math.PI;
}

/** The area a loop closes (its two ends joined). */
export function areaOf(points: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) a += (points[j]![0] + points[i]![0]) * (points[j]![1] - points[i]![1]);
  return Math.abs(a / 2);
}

export function inside(p: Pt, poly: readonly Pt[]): boolean {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) yes = !yes;
  }
  return yes;
}

/** Points every `step` pixels along the stroke, ends included. */
export function along(points: readonly Pt[], step = STEP): Pt[] {
  if (points.length < 2) return [...points];
  const out: Pt[] = [points[0]!];
  let left = step;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]!;
    const b = points[i]!;
    let d = dist(a, b);
    while (d >= left) {
      const t = left / d;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a);
      d -= left;
      left = step;
    }
    left -= d;
  }
  const end = points[points.length - 1]!, last = out[out.length - 1]!;
  if (dist(end, last) > 0.5) out.push(end);
  return out;
}

/** At most `max` points, the shape kept (every n-th). */
export function thin(points: readonly Pt[], max = 200): Pt[] {
  if (points.length <= max) return points.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const every = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * every)]!).map(([x, y]) => [Math.round(x), Math.round(y)]);
}

