import { type StudioNode,type StudioShape } from "../store";



export const midOf = (n: StudioNode): [number, number] => [n.x + n.w / 2, n.y + n.h / 2];

/** Where a line from a part's middle toward a point leaves the part's box: where a wire seats. */
export function edgePoint(n: StudioNode, toward: [number, number]): [number, number] {
  const [cx, cy] = midOf(n);
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  if (!dx && !dy) return [cx, cy];
  const sx = dx ? n.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? n.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return [cx + dx * t, cy + dy * t];
}

export function hitNode(nodes: StudioNode[], x: number, y: number): StudioNode | null {
  return nodes.find((n) => x >= n.x - 8 && x <= n.x + n.w + 8 && y >= n.y - 8 && y <= n.y + n.h + 8) ?? null;
}

/** Distance from a point to a segment. */
export function toSegment(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/**
 * The drawing within `tol` of a point, by geometry rather than by pixels.
 *
 * The eraser used to ask the browser what was under the pointer, which for a
 * one-pixel pen line meant hitting the line exactly. A sweep has to catch the
 * line it crosses, so the shapes are measured instead: a pen stroke as its
 * polyline, an arrow as its one segment, a region as the four edges of its
 * box (its inside is empty, and a sweep across an empty region should not
 * take the region).
 */
export function hitShape(shapes: StudioShape[], x: number, y: number, tol: number): StudioShape | null {
  let best: StudioShape | null = null;
  let bestD = tol;
  for (const sh of shapes) {
    const pts = sh.points;
    if (pts.length < 2) continue;
    let d = Infinity;
    if (sh.kind === "frame") {
      const [a, b] = [pts[0]!, pts[pts.length - 1]!];
      const corners: [number, number][] = [a, [b[0], a[1]], b, [a[0], b[1]]];
      for (let i = 0; i < 4; i++) d = Math.min(d, toSegment(x, y, corners[i]!, corners[(i + 1) % 4]!));
    } else {
      for (let i = 1; i < pts.length; i++) d = Math.min(d, toSegment(x, y, pts[i - 1]!, pts[i]!));
    }
    if (d < bestD) { bestD = d; best = sh; }
  }
  return best;
}

/** Do two segments cross? The one case min-of-four-ends cannot see. */
export function segsCross(a1: [number, number], a2: [number, number], b1: [number, number], b2: [number, number]): boolean {
  const side = (p: [number, number], q: [number, number], r: [number, number]) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const d1 = side(b1, b2, a1), d2 = side(b1, b2, a2), d3 = side(a1, a2, b1), d4 = side(a1, a2, b2);
  return d1 !== d2 && d3 !== d4;
}

/**
 * EVERYTHING THE STROKE PASSES OVER, and it is a stroke rather than a dot.
 *
 * The sweep used to ask `hitShape` where the pointer happened to BE on each
 * move, which is two faults in one. A hand moving quickly reports a handful
 * of points a long way apart, and everything between them was never asked
 * about \u2014 so a quick scribble across a drawing left most of it standing. And
 * `hitShape` gives back the NEAREST one thing, so a stroke laid across three
 * drawings at once took one of them and left two.
 *
 * This takes the segment from where the hand was to where it is, and gives
 * back every drawing within reach of ANY part of it.
 */
export function hitAlong(shapes: StudioShape[], from: [number, number], to: [number, number], tol: number): StudioShape[] {
  const out: StudioShape[] = [];
  for (const sh of shapes) {
    const pts = sh.points;
    if (pts.length < 2) continue;
    const edges: [[number, number], [number, number]][] = [];
    if (sh.kind === "frame") {
      const [a, b] = [pts[0]!, pts[pts.length - 1]!];
      const corners: [number, number][] = [a, [b[0], a[1]], b, [a[0], b[1]]];
      for (let i = 0; i < 4; i++) edges.push([corners[i]!, corners[(i + 1) % 4]!]);
    } else {
      for (let i = 1; i < pts.length; i++) edges.push([pts[i - 1]!, pts[i]!]);
    }
    const near = edges.some(([e1, e2]) =>
      segsCross(from, to, e1, e2)
      || Math.min(
        toSegment(from[0], from[1], e1, e2),
        toSegment(to[0], to[1], e1, e2),
        toSegment(e1[0], e1[1], from, to),
        toSegment(e2[0], e2[1], from, to),
      ) < tol);
    if (near) out.push(sh);
  }
  return out;
}

export function penPath(points: [number, number][]): string {
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
