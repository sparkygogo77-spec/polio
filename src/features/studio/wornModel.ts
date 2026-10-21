/**
 * A drawn shape wearing a style kit: its outline, its record, and the
 * geometry that makes a kit look right on something that is not a box.
 *
 * A kit was read off rectangles. Put on a cone, a star or a scrawl, each of
 * its layers is retargeted rather than pasted:
 *
 *   · the **shadow** is the outline itself, moved by the kit's offset (and
 *     blurred and spread as the page did), never the box round it;
 *   · the **lighting bar** is what an inset shadow paints: the shape, less
 *     itself moved by the band's offset, clipped inside the shape. Its
 *     offset is turned with the shape's long axis, so a tall cone gets its
 *     light along its side the way a wide button gets it along its top;
 *   · the **border** traces the outline, inside it, as a CSS border is;
 *   · the **corners** of a snapped polygon are rounded by the kit's radius.
 *
 * Drawing basics live here too: a line whose end comes back near its start
 * is closed; the hand's wobble is smoothed; a rough circle, triangle, box
 * or star can snap to a clean one, and the raw line is kept so the snap
 * can be undone.
 *
 * Pure: no React, no store, no browser.
 */
import * as clipping from "polygon-clipping";
import { contrastOf, mix, parseRgba, rgbCss, type BoardMotion, type KitBand, type KitShadow, type StyleKit } from "./look/index.ts";

/* The library ships one default object in its browser build and named functions in its Node one; either is taken. */
const pc = ((clipping as unknown as { default?: typeof clipping }).default ?? clipping) as typeof clipping;

export type Pt = [number, number];

/** What a drawn outline may be taken for, when snapped. */
export type SnapName = "circle" | "ellipse" | "triangle" | "rectangle" | "star";
/** What a drawn shape is for. */
export type WornWhat = "button" | "frame" | "decoration" | "section" | "path";

/** Words laid along the outline, or along an open line: their size, face, where they start, and which way round. */
export interface PathWords {
  /** In pixels; null to fit the words to the line. */
  size: number | null;
  /** A font stack, or null for the kit's own. */
  font: string | null;
  /** Where along the line the words begin, 0..100 (percent). */
  start: number;
  /** Run the other way along the line, so the words sit on its other side. */
  flip: boolean;
}

/** A captured motion, as a drawn shape wears it. */
export interface WornMotion {
  id: string;
  name: string;
  frames: BoardMotion["frames"];
  duration: number;
  timing: string;
  /** 0.25..3: faster above 1. */
  speed: number;
  /** 0..2: how far it moves, turns, scales or fades, against the page's own. */
  strength: number;
  /** The part it was seen on, so its distances scale to this shape. */
  size: { w: number; h: number };
}

/**
 * The record a drawn shape keeps on its part (`StudioNode.worn`).
 *
 * The kit is a copy, not a reference: the board it came from may be closed,
 * removed or changed, and a published page must draw exactly what was seen.
 */
export interface Worn {
  /** The outline, closed, in the part's box: 0..1 in x and y, first point not repeated. */
  pts: Pt[];
  /** Curved through the points (a hand-drawn line, a circle), or straight between them (a snapped polygon). */
  smooth: boolean;
  /** What it was snapped to, or null for the line as drawn. */
  snap: SnapName | null;
  /** The line as drawn before it was snapped: its points and the box they were in, in page pixels. Null when nothing was snapped. */
  raw: { pts: Pt[]; box: { x: number; y: number; w: number; h: number } } | null;
  /** The clean shape a snap was undone from, so it can be snapped again. */
  snapBack?: { pts: Pt[]; smooth: boolean; snap: SnapName | null; box: { x: number; y: number; w: number; h: number } } | null;
  kit: StyleKit;
  /** A fill colour picked after drawing, or null for the kit's own. */
  fill: string | null;
  /** The lighting bar: on, and the band it draws (the kit's, else the site's). */
  bar: KitBand | null;
  motion: WornMotion | null;
  /** Answer the hand as the kit's parts did: lift on hover, sink on press. */
  hover: boolean;
  press: boolean;
  what: WornWhat | null;
  /**
   * After a join or a cut, the outline is no longer one line: it is every
   * piece and every hole the two shapes made, each a closed ring, in the
   * part's box (0..1), the first ring of each piece its outside. `pts` is
   * then the outside of the biggest piece, which is what the light, the
   * words and the motion are placed by.
   */
  poly?: Pt[][][] | null;
  /** An open line (drawn without coming back to its start): words run along it, and it has no inside. */
  open?: boolean;
  /** How the words run along the line, when it is "Words along a path". */
  pathWords?: PathWords | null;
}

/* ------------------------------------------------------------------ */
/* Drawing basics                                                       */
/* ------------------------------------------------------------------ */

export function boxOf(pts: readonly Pt[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Does the line come back near where it began? Near is a fifth of the
 * shape's size, or 28px, whichever is more: a hand never lands on the pixel
 * it started from, and a line that ends a thumb's width away meant to close.
 */
export function nearlyClosed(pts: readonly Pt[]): boolean {
  if (pts.length < 4) return false;
  const b = boxOf(pts);
  const gap = Math.hypot(pts[0]![0] - pts[pts.length - 1]![0], pts[0]![1] - pts[pts.length - 1]![1]);
  return Math.min(b.w, b.h) >= 12 && gap <= Math.max(28, Math.hypot(b.w, b.h) * 0.2);
}

/** The line closed: an end drawn past the start is trimmed back to it, and the last point is not the first twice. */
export function closeLine(pts: readonly Pt[]): Pt[] {
  let out = pts.slice();
  // An overshoot: the hand went past where it began. Cut at the point nearest the start in the last fifth.
  const tail = Math.floor(out.length * 0.8);
  let best = out.length - 1, bestD = Infinity;
  for (let i = tail; i < out.length; i++) {
    const d = Math.hypot(out[i]![0] - out[0]![0], out[i]![1] - out[0]![1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  out = out.slice(0, best + 1);
  while (out.length > 3 && Math.hypot(out[out.length - 1]![0] - out[0]![0], out[out.length - 1]![1] - out[0]![1]) < 2) out.pop();
  return out;
}

/** Points no closer together than `gap`, at most `max` of them. */
export function thin(pts: readonly Pt[], gap: number, max = 64): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < gap) continue;
    out.push([p[0], p[1]]);
  }
  while (out.length > max) for (let i = out.length - 2; i > 0; i -= 2) out.splice(i, 1);
  return out;
}

/** The hand's wobble taken out: a moving average round a closed line. */
export function smoothClosed(pts: readonly Pt[], passes = 2): Pt[] {
  let cur = pts.slice();
  const n = cur.length;
  if (n < 4) return cur;
  for (let k = 0; k < passes; k++) {
    cur = cur.map((c, i) => {
      const p = cur[(i - 1 + n) % n]!, q = cur[(i + 1) % n]!;
      return [(p[0] + c[0] * 2 + q[0]) / 4, (p[1] + c[1] * 2 + q[1]) / 4] as Pt;
    });
  }
  return cur;
}

function area(pts: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i]!, [x2, y2] = pts[(i + 1) % pts.length]!; a += x1 * y2 - x2 * y1; }
  return a / 2;
}

/** Where the area balances. */
export function centreOf(pts: readonly Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]!, [x2, y2] = pts[(i + 1) % pts.length]!;
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-6) { const b = boxOf(pts); return [b.x + b.w / 2, b.y + b.h / 2]; }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Douglas–Peucker on a closed line: the corners a hand meant. */
function corners(pts: readonly Pt[], eps: number): Pt[] {
  const rdp = (p: readonly Pt[]): Pt[] => {
    if (p.length < 3) return p.slice();
    const a = p[0]!, b = p[p.length - 1]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    let far = -1, at = 0;
    for (let i = 1; i < p.length - 1; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - p[i]![1]) - (a[0] - p[i]![0]) * (b[1] - a[1])) / len;
      if (d > far) { far = d; at = i; }
    }
    if (far <= eps) return [a, b];
    return [...rdp(p.slice(0, at + 1)).slice(0, -1), ...rdp(p.slice(at))];
  };
  // Start at the point furthest from the centre so a corner is never cut in two by the seam.
  const c = centreOf(pts);
  let s = 0, far = -1;
  pts.forEach((p, i) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d > far) { far = d; s = i; } });
  const loop = [...pts.slice(s), ...pts.slice(0, s)];
  // A loop's two ends are one point, so it is cut in two at the point furthest from it first.
  let mid = 1, md = -1;
  loop.forEach((p, i) => { const d = Math.hypot(p[0] - loop[0]![0], p[1] - loop[0]![1]); if (d > md) { md = d; mid = i; } });
  const got = [...rdp(loop.slice(0, mid + 1)).slice(0, -1), ...rdp([...loop.slice(mid), loop[0]!]).slice(0, -1)];
  // Drop the ones on a straight run.
  const keep: Pt[] = [];
  for (let i = 0; i < got.length; i++) {
    const p = got[(i - 1 + got.length) % got.length]!, q = got[i]!, r = got[(i + 1) % got.length]!;
    const ax = p[0] - q[0], ay = p[1] - q[1], bx = r[0] - q[0], by = r[1] - q[1];
    const cos = (ax * bx + ay * by) / Math.max(1e-9, Math.hypot(ax, ay) * Math.hypot(bx, by));
    if (cos > -0.95) keep.push(q);
  }
  return keep;
}

/**
 * The clean shape a rough outline nearly is, or null when it is none of them.
 * In the same pixels it was drawn in.
 *
 *   · round (every point about as far from the middle) → a circle when it
 *     is about as wide as tall, else an ellipse;
 *   · three corners → a triangle (a cone is a triangle, snapped the same);
 *   · four corners filling most of their box → a box;
 *   · ten corners alternating far and near → a five-pointed star (and so
 *     for any even count from eight to sixteen).
 */
export function snapOutline(raw: readonly Pt[]): { pts: Pt[]; snap: SnapName } | null {
  if (raw.length < 6) return null;
  const pts = thin(raw, 1, 400);
  const b = boxOf(pts);
  if (b.w < 12 || b.h < 12) return null;
  const c: Pt = [b.x + b.w / 2, b.y + b.h / 2];
  const fill = Math.abs(area(pts)) / Math.max(1, b.w * b.h);

  // Round.
  const norm = pts.map(([x, y]) => Math.hypot((x - c[0]) / (b.w / 2), (y - c[1]) / (b.h / 2)));
  const mean = norm.reduce((a, v) => a + v, 0) / norm.length;
  const sd = Math.sqrt(norm.reduce((a, v) => a + (v - mean) ** 2, 0) / norm.length);
  const eps = Math.max(4, Math.hypot(b.w, b.h) * 0.06);
  const cs = corners(pts, eps);
  if (sd < 0.09 && fill > 0.68 && fill < 0.86 && cs.length > 4) {
    const aspect = b.w / b.h;
    const round = aspect > 0.82 && aspect < 1.22;
    const rx = round ? (b.w + b.h) / 4 : b.w / 2, ry = round ? rx : b.h / 2;
    const n = 48;
    return { pts: Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2 - Math.PI / 2; return [+(c[0] + Math.cos(t) * rx).toFixed(2), +(c[1] + Math.sin(t) * ry).toFixed(2)] as Pt; }), snap: round ? "circle" : "ellipse" };
  }
  if (cs.length === 3) return { pts: cs.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)] as Pt), snap: "triangle" };
  if (cs.length === 4 && fill > 0.78) return { pts: [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]], snap: "rectangle" };
  // A star: an even count of corners, alternately far from and near the middle.
  const sc = corners(pts, Math.max(3, Math.hypot(b.w, b.h) * 0.035));
  if (sc.length >= 8 && sc.length <= 16 && sc.length % 2 === 0) {
    const m = centreOf(pts);
    const r = sc.map(([x, y]) => Math.hypot(x - m[0], y - m[1]));
    const odd = r.filter((_, i) => i % 2 === 1), even = r.filter((_, i) => i % 2 === 0);
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const [outer, inner, first] = avg(even) > avg(odd) ? [avg(even), avg(odd), 0] : [avg(odd), avg(even), 1];
    const alternates = r.every((v, i) => ((i % 2 === first) ? v > (outer + inner) / 2 : v < (outer + inner) / 2));
    if (alternates && inner / outer < 0.75) {
      const k = sc.length / 2;
      const a0 = Math.atan2(sc[first]![1] - m[1], sc[first]![0] - m[0]);
      const dir = area(sc) > 0 ? 1 : -1;
      return {
        pts: Array.from({ length: k * 2 }, (_, i) => {
          const t = a0 + (dir * i * Math.PI) / k;
          const rr = i % 2 === 0 ? outer : inner;
          return [+(m[0] + Math.cos(t) * rr).toFixed(2), +(m[1] + Math.sin(t) * rr).toFixed(2)] as Pt;
        }),
        snap: "star",
      };
    }
  }
  return null;
}

/** Page pixels into the part's box, 0..1, and the box. */
export function toBox(pts: readonly Pt[]): { pts: Pt[]; box: { x: number; y: number; w: number; h: number } } {
  const b = boxOf(pts);
  const w = Math.max(1, b.w), h = Math.max(1, b.h);
  return { pts: pts.map(([x, y]) => [+((x - b.x) / w).toFixed(4), +((y - b.y) / h).toFixed(4)] as Pt), box: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(w), h: Math.round(h) } };
}

/**
 * A line as the hand drew it, made ready to wear a kit: closed, smoothed,
 * and snapped when asked and when it is near a clean shape. In page pixels.
 */
export function shapeFromLine(line: readonly Pt[], opts: { snap: boolean }): { pts: Pt[]; smooth: boolean; snap: SnapName | null; raw: Pt[] } {
  const closed = closeLine(line);
  const raw = smoothClosed(thin(closed, 3, 96), 2);
  if (opts.snap) {
    const s = snapOutline(closed);
    if (s) return { pts: s.pts, smooth: s.snap === "circle" || s.snap === "ellipse", snap: s.snap, raw };
  }
  return { pts: raw, smooth: true, snap: null, raw };
}

/* ------------------------------------------------------------------ */
/* The outline as a path                                                */
/* ------------------------------------------------------------------ */

const f = (n: number) => +n.toFixed(2);

/** A closed curve through the points (Catmull-Rom as cubic Béziers). */
function curve(p: readonly Pt[]): string {
  const n = p.length;
  if (n < 3) return "";
  let d = `M${f(p[0]![0])} ${f(p[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]!, p1 = p[i]!, p2 = p[(i + 1) % n]!, p3 = p[(i + 2) % n]!;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

/** A polygon with each corner rounded by `r` (never more than a third of either edge beside it). */
function rounded(p: readonly Pt[], r: number): string {
  const n = p.length;
  if (n < 3) return "";
  if (r <= 0.5) return `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")} Z`;
  const cut = p.map((c, i) => {
    const a = p[(i - 1 + n) % n]!, b = p[(i + 1) % n]!;
    const la = Math.hypot(a[0] - c[0], a[1] - c[1]), lb = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const k = Math.min(r, la / 3, lb / 3);
    return { c, a: [c[0] + ((a[0] - c[0]) / la) * k, c[1] + ((a[1] - c[1]) / la) * k] as Pt, b: [c[0] + ((b[0] - c[0]) / lb) * k, c[1] + ((b[1] - c[1]) / lb) * k] as Pt };
  });
  let d = `M${f(cut[0]!.b[0])} ${f(cut[0]!.b[1])}`;
  for (let i = 1; i <= n; i++) { const k = cut[i % n]!; d += ` L${f(k.a[0])} ${f(k.a[1])} Q${f(k.c[0])} ${f(k.c[1])} ${f(k.b[0])} ${f(k.b[1])}`; }
  return `${d} Z`;
}

/** An open curve through the points, its ends where the hand began and stopped. */
function openCurve(p: readonly Pt[]): string {
  const n = p.length;
  if (n < 2) return "";
  let d = `M${f(p[0]![0])} ${f(p[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[Math.min(n - 1, i + 2)]!;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** Rings as one path: each piece and each hole closed, to be filled even-odd so a hole is a hole. */
function ringsPath(poly: readonly (readonly (readonly Pt[])[])[], w: number, h: number): string {
  return poly.flatMap((piece) => piece.filter((r) => r.length >= 3).map((r) => `M${r.map(([x, y]) => `${f(x * w)} ${f(y * h)}`).join(" L")} Z`)).join(" ");
}

/** The part's outline in its own pixels, `w` by `h`. */
export function wornPath(worn: Pick<Worn, "pts" | "smooth" | "kit" | "poly" | "open">, w: number, h: number): string {
  if (worn.poly?.length) return ringsPath(worn.poly, w, h);
  const px = worn.pts.map(([x, y]) => [x * w, y * h] as Pt);
  if (worn.open) return openCurve(px);
  return worn.smooth ? curve(px) : rounded(px, Math.min(worn.kit.radius, Math.min(w, h) / 4));
}

/* ------------------------------------------------------------------ */
/* Join and cut                                                         */
/* ------------------------------------------------------------------ */

/** Points along a closed Catmull-Rom curve, `per` to each stretch between two of its points. */
function sampleCurve(p: readonly Pt[], per = 10): Pt[] {
  const n = p.length, out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]!, p1 = p[i]!, p2 = p[(i + 1) % n]!, p3 = p[(i + 2) % n]!;
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** Points along a polygon whose corners are rounded by `r`, as `rounded` draws it. */
function sampleRounded(p: readonly Pt[], r: number): Pt[] {
  const n = p.length;
  if (r <= 0.5) return p.slice();
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const c = p[i]!, a = p[(i - 1 + n) % n]!, b = p[(i + 1) % n]!;
    const la = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1, lb = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1;
    const k = Math.min(r, la / 3, lb / 3);
    const s: Pt = [c[0] + ((a[0] - c[0]) / la) * k, c[1] + ((a[1] - c[1]) / la) * k];
    const e: Pt = [c[0] + ((b[0] - c[0]) / lb) * k, c[1] + ((b[1] - c[1]) / lb) * k];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6, u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * c[0] + t * t * e[0], u * u * s[1] + 2 * u * t * c[1] + t * t * e[1]]);
    }
  }
  return out;
}

type Box = { x: number; y: number; w: number; h: number };

/** A closed drawn shape's outline on the page: every piece, each its outside then its holes, in page pixels. */
export function outlineOnPage(worn: Pick<Worn, "pts" | "smooth" | "kit" | "poly">, box: Box): Pt[][][] {
  const at = ([x, y]: Pt): Pt => [box.x + x * box.w, box.y + y * box.h];
  if (worn.poly?.length) return worn.poly.map((piece) => piece.map((r) => r.map(at)));
  const px = worn.pts.map(at);
  const ring = worn.smooth ? sampleCurve(px) : sampleRounded(px, Math.min(worn.kit.radius, Math.min(box.w, box.h) / 4));
  return [[ring]];
}

/**
 * Two drawn shapes made one: joined (everything either covers) or cut (the
 * first, less what the second covers). The result keeps the first one's
 * kit, colour, lighting bar and motion, and its outline is the new edge,
 * so the shadow, the light and the border follow it as they followed the
 * old one. A cut that leaves a hole keeps it: the light and the border run
 * round the hole's edge too. Null when nothing is left.
 */
export function combine(a: { worn: Worn; box: Box }, b: { worn: Worn; box: Box }, how: "join" | "cut"): { worn: Worn; box: Box } | null {
  const A = outlineOnPage(a.worn, a.box) as clipping.MultiPolygon, B = outlineOnPage(b.worn, b.box) as clipping.MultiPolygon;
  const got = how === "join" ? pc.union(A, B) : pc.difference(A, B);
  const pieces = got.map((piece) => piece.map((r) => {
    const ring = r.slice();
    const [x0, y0] = ring[0]!, [x1, y1] = ring[ring.length - 1]!;
    if (Math.abs(x0 - x1) < 1e-6 && Math.abs(y0 - y1) < 1e-6) ring.pop();
    return thin(ring as Pt[], 0.75, 600);
  }).filter((r) => r.length >= 3 && Math.abs(area(r)) >= 4)).filter((piece) => piece.length && Math.abs(area(piece[0]!)) >= 16);
  if (!pieces.length) return null;
  const b0 = boxOf(pieces.flatMap((piece) => piece[0]!));
  const box = { x: Math.round(b0.x), y: Math.round(b0.y), w: Math.max(1, Math.round(b0.w)), h: Math.max(1, Math.round(b0.h)) };
  const norm = ([x, y]: Pt): Pt => [+((x - box.x) / box.w).toFixed(4), +((y - box.y) / box.h).toFixed(4)];
  const poly = pieces.map((piece) => piece.map((r) => r.map(norm)));
  const biggest = poly.reduce((m, piece) => (Math.abs(area(piece[0]!)) > Math.abs(area(m[0]!)) ? piece : m), poly[0]!);
  return {
    worn: { ...a.worn, pts: biggest[0]!, poly, smooth: false, snap: null, raw: null, snapBack: null, open: false, what: a.worn.what === "path" ? null : a.worn.what },
    box,
  };
}

/** How many pieces and holes an outline has: one piece and no holes for a shape as drawn. */
export function piecesOf(worn: Pick<Worn, "poly">): { pieces: number; holes: number } {
  if (!worn.poly?.length) return { pieces: 1, holes: 0 };
  return { pieces: worn.poly.length, holes: worn.poly.reduce((s, piece) => s + piece.length - 1, 0) };
}

/** Is a page point inside a closed drawn shape (holes excepted)? */
export function insideOutline(worn: Pick<Worn, "pts" | "smooth" | "kit" | "poly" | "open">, box: Box, p: Pt): boolean {
  if (worn.open) return false;
  let inside = false;
  for (const piece of outlineOnPage(worn, box)) for (const r of piece) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!, [xj, yj] = r[j]!;
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/* ------------------------------------------------------------------ */
/* Words along a path                                                   */
/* ------------------------------------------------------------------ */

/** An open line as the hand drew it, made ready to carry words: thinned, smoothed, in a box with room round it for the letters. */
export function lineFromStroke(line: readonly Pt[], room = 28): { pts: Pt[]; box: Box } | null {
  let pts = thin(line, 4, 64);
  if (pts.length < 2) return null;
  // The wobble taken out, the two ends kept where they were.
  for (let k = 0; k < 2; k++) pts = pts.map((c, i) => (i === 0 || i === pts.length - 1 ? c : [(pts[i - 1]![0] + c[0] * 2 + pts[i + 1]![0]) / 4, (pts[i - 1]![1] + c[1] * 2 + pts[i + 1]![1]) / 4] as Pt));
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  if (len < 60) return null;
  const b = boxOf(pts);
  const box = { x: Math.round(b.x - room), y: Math.round(b.y - room), w: Math.round(b.w + room * 2), h: Math.round(b.h + room * 2) };
  return { pts: pts.map(([x, y]) => [+((x - box.x) / box.w).toFixed(4), +((y - box.y) / box.h).toFixed(4)] as Pt), box };
}

/** The line the words run along, in the part's pixels: the open line, or the outline (its biggest piece's outside), turned round when flipped. */
export function wordsGuide(worn: Pick<Worn, "pts" | "smooth" | "kit" | "poly" | "open" | "pathWords">, w: number, h: number): string {
  let px = worn.pts.map(([x, y]) => [x * w, y * h] as Pt);
  if (worn.pathWords?.flip) px = px.slice().reverse();
  if (worn.open) return openCurve(px);
  if (worn.poly?.length) return `M${px.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")} Z`;
  return worn.smooth ? curve(px) : rounded(px, Math.min(worn.kit.radius, Math.min(w, h) / 4));
}

/** How long the words' line is, in the part's pixels. */
export function guideLength(worn: Pick<Worn, "pts" | "smooth" | "open">, w: number, h: number): number {
  const px = worn.pts.map(([x, y]) => [x * w, y * h] as Pt);
  const pts = worn.open ? px : worn.smooth ? sampleCurve(px, 8) : px;
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  if (!worn.open && pts.length > 2) len += Math.hypot(pts[0]![0] - pts[pts.length - 1]![0], pts[0]![1] - pts[pts.length - 1]![1]);
  return len;
}

/** The size words are drawn at along the line: the size picked, else the kit's own grown a little, shrunk until they fit. */
export function pathWordsSize(worn: Pick<Worn, "pts" | "smooth" | "open" | "kit" | "pathWords">, w: number, h: number, words: string): number {
  if (worn.pathWords?.size) return Math.max(8, Math.min(160, worn.pathWords.size));
  const want = Math.max(16, (worn.kit.text?.px ?? 20) * 1.4);
  const fit = (guideLength(worn, w, h) * (1 - (worn.pathWords?.start ?? 0) / 100) * 0.92) / Math.max(1, words.length * 0.6);
  return Math.round(Math.max(10, Math.min(want, fit, 96)));
}

/** The words' paint: the kit's fill on the letters, its border as their outline, so the words wear the kit as the shape did. */
export function pathInk(worn: Pick<Worn, "fill" | "kit">): { fill: StyleKit["fill"]; stroke: { colour: string; width: number } | null } {
  const fill = fillOf(worn);
  const p = parseRgba(fill.colour);
  if (fill.kind === "none" || !p || p.a < 0.3) return { fill: { kind: "solid", colour: worn.kit.text?.colour ?? "rgb(20, 20, 20)" }, stroke: null };
  return { fill, stroke: worn.kit.border ? { colour: worn.kit.border.colour, width: Math.max(0.5, Math.min(worn.kit.border.width, 3)) } : null };
}

/** The words a new line carries until someone writes their own. */
export const PATH_WORDS_SAMPLE = "Words along a path";

/** What a new line of words carries before it is changed. */
export const PATH_WORDS: PathWords = { size: null, font: null, start: 0, flip: false };

/**
 * The direction the shape is longest in, in degrees (-90..90]: its main
 * axis, from the spread of its outline about its middle.
 */
export function longAxis(pts: readonly Pt[]): number {
  const c = centreOf(pts);
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { const dx = x - c[0], dy = y - c[1]; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  let a = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI;
  if (a <= -90) a += 180;
  if (a > 90) a -= 180;
  return a;
}

/**
 * A band's offset turned onto a new shape: as far as the page moved it, at
 * the same angle to the shape's long axis as it was to the source part's
 * (0° for a part wider than tall, 90° for one taller), kept on the lit side.
 */
export function bandOffset(band: KitBand, source: { w: number; h: number }, pts: readonly Pt[]): Pt {
  const srcAxis = source.w >= source.h ? 0 : 90;
  const turn = ((longAxis(pts) - srcAxis) * Math.PI) / 180;
  let dx = band.dx * Math.cos(turn) - band.dy * Math.sin(turn);
  let dy = band.dx * Math.sin(turn) + band.dy * Math.cos(turn);
  /*
   * The axis has no front and back, so the turned band could land on either
   * side. It lands on the side the page's light came from: a band lit from
   * above or the left stays lit from above or the left (its offset points
   * down or right), and a shade from below stays below.
   */
  const was = band.dx + band.dy, now = dx + dy;
  if (Math.abs(was) > 0.01 && Math.abs(now) > 0.01 && Math.sign(was) !== Math.sign(now)) { dx = -dx; dy = -dy; }
  return [+dx.toFixed(2), +dy.toFixed(2)];
}

/**
 * A gloss strip laid on a new shape: parallel to its long axis, on its lit
 * side (up, or left when the shape stands upright), `edge` px in from the
 * outline there, as deep as the same share of the shape's depth the page's
 * strip was of its part's. Returned in the frame of the axis: `u` along it,
 * `n` toward the light, so the strip is a plain rectangle in that frame and
 * `matrix(u.x u.y n.x n.y 0 0)` puts it on the page. `ends` is how far the
 * outline is pulled in before the strip is cut to it, so it never touches
 * the edge, as the page's never did.
 */
export function glossFrame(band: KitBand, pts: readonly Pt[]): { u: Pt; n: Pt; x: number; y: number; w: number; h: number; rx: number; ends: number } {
  const a = (longAxis(pts) * Math.PI) / 180;
  const u: Pt = [Math.cos(a), Math.sin(a)];
  let n: Pt = [-u[1], u[0]];
  if (n[0] + n[1] > 0 || (Math.abs(n[0] + n[1]) < 1e-6 && n[1] > 0)) n = [-n[0], -n[1]];
  const along = pts.map(([x, y]) => x * u[0] + y * u[1]);
  const toward = pts.map(([x, y]) => x * n[0] + y * n[1]);
  const lo = Math.min(...toward), hi = Math.max(...toward);
  const depth = Math.max(1, hi - lo);
  const edge = Math.min(band.edge ?? 0, depth * 0.2);
  const thick = Math.max(2, (band.share ?? 0.25) * depth);
  // The strip's far edge (toward the light) sits `edge` in from the lit extreme; y runs toward the light.
  return {
    u, n,
    x: Math.min(...along) - 4, w: Math.max(...along) - Math.min(...along) + 8,
    y: hi - edge - thick, h: thick,
    rx: Math.min(band.radius ?? 0, thick / 2),
    ends: Math.min(band.ends ?? 0, depth * 0.2),
  };
}

/* ------------------------------------------------------------------ */
/* Colour                                                               */
/* ------------------------------------------------------------------ */

/** The fill a worn shape draws: the colour picked, else the kit's own. */
export function fillOf(worn: Pick<Worn, "fill" | "kit">): StyleKit["fill"] {
  const k = worn.kit.fill;
  if (!worn.fill) return k;
  if (k.kind === "linear" || k.kind === "radial") {
    // A gradient kit keeps its light and dark in the new colour.
    return { ...k, colour: worn.fill, stops: [{ colour: mix(worn.fill, "rgb(255, 255, 255)", 0.28), at: null }, { colour: worn.fill, at: 0.5 }, { colour: mix(worn.fill, "rgb(0, 0, 0)", 0.2), at: null }] };
  }
  return { kind: "solid", colour: worn.fill };
}

/** The colour the words need on this fill to be read: the kit's own when it is readable enough, else dark or light. */
export function wordsColour(worn: Pick<Worn, "fill" | "kit">): { colour: string; swapped: boolean } {
  const ground = fillOf(worn).colour;
  const own = worn.kit.text?.colour ?? worn.kit.border?.colour ?? "rgb(20, 20, 20)";
  const g = parseRgba(ground);
  if (!g || g.a < 0.1 || contrastOf(own, ground) >= 4.5) return { colour: own, swapped: false };
  const dark = worn.kit.border && contrastOf(worn.kit.border.colour, ground) >= 4.5 ? worn.kit.border.colour : "rgb(17, 17, 17)";
  const pick = contrastOf(dark, ground) >= contrastOf("rgb(255, 255, 255)", ground) ? dark : "rgb(255, 255, 255)";
  return { colour: pick, swapped: true };
}

/** A palette's colours in the order a picker shows them: the site's roles first, then the kit's swatches, each once. */
export function colourChoices(palette: Record<string, string | undefined> | null | undefined, kit: StyleKit): string[] {
  const out: string[] = [];
  const add = (c: string | undefined) => { const p = parseRgba(c ?? ""); if (!p || p.a < 0.5) return; const s = rgbCss(p); if (!out.includes(s)) out.push(s); };
  for (const r of ["accent", "highlight", "surface", "bg", "text", "muted"]) add(palette?.[r]);
  for (const s of kit.swatches) add(s);
  return out.slice(0, 16);
}

/* ------------------------------------------------------------------ */
/* Motion and the hand, as CSS                                          */
/* ------------------------------------------------------------------ */

const SAFE = /^[\w\s.,%()#+\-/]*$/;

/** One transform value's numbers scaled: distances and turns by `k`, scales toward 1. */
function scaleTransform(v: string, strength: number, dist: number): string {
  return v.replace(/(translate[XYZ3d]*|rotate[XYZ]?|scale[XYZ3d]*|skew[XY]?)\(([^)]*)\)/g, (_, fn: string, args: string) => {
    const parts = args.split(",").map((a) => a.trim());
    const out = parts.map((a) => {
      const m = /^(-?[\d.]+)(px|deg|turn|rad|%)?$/.exec(a);
      if (!m) return a;
      const n = Number(m[1]);
      const unit = m[2] ?? "";
      if (fn.startsWith("scale")) return `${+(1 + (n - 1) * strength).toFixed(4)}`;
      if (unit === "px") return `${+(n * strength * dist).toFixed(2)}px`;
      return `${+(n * strength).toFixed(3)}${unit}`;
    });
    return `${fn}(${out.join(", ")})`;
  });
}

/** A motion's frames at a strength, its distances scaled from the part it was seen on to this one. */
export function motionFrames(m: WornMotion, w: number, h: number): { key: string; style: Record<string, string> }[] {
  const dist = Math.max(0.5, Math.min(2.5, Math.min(w, h) / Math.max(8, Math.min(m.size.w, m.size.h))));
  const s = Math.max(0, Math.min(3, m.strength));
  return m.frames.map((fr) => ({
    key: fr.key,
    style: Object.fromEntries(Object.entries(fr.style).flatMap(([p, v]) => {
      if (typeof v !== "string" || !SAFE.test(v)) return [];
      if (p === "transform-origin") return [];
      if (p === "opacity") return [[p, `${+(1 - (1 - Number(v)) * Math.min(1, s)).toFixed(3)}`]];
      if (p === "transform" || p === "translate" || p === "rotate" || p === "scale") {
        if (p === "rotate") { const m2 = /^(-?[\d.]+)deg$/.exec(v); return [[p, m2 ? `${+(Number(m2[1]) * s).toFixed(2)}deg` : v]]; }
        if (p === "translate") return [[p, v.split(/\s+/).map((x) => { const m2 = /^(-?[\d.]+)px$/.exec(x); return m2 ? `${+(Number(m2[1]) * s * dist).toFixed(2)}px` : x; }).join(" ")]];
        if (p === "scale") return [[p, v.split(/\s+/).map((x) => `${+(1 + (Number(x) - 1) * s).toFixed(4)}`).join(" ")]];
        return [[p, scaleTransform(v, s, dist)]];
      }
      return [[p, v]];
    })),
  })).filter((fr) => /^(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*$/.test(fr.key.trim()));
}

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const TIMING = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|steps\(\d+(,\s*(start|end|jump-\w+))?\)|cubic-bezier\([-\d.,\s]+\))$/;

/** Where the shape turns and scales about: the middle of its area, in its box. */
export function originOf(pts: readonly Pt[]): string {
  const [x, y] = centreOf(pts);
  return `${+(x * 100).toFixed(1)}% ${+(y * 100).toFixed(1)}%`;
}

/**
 * The stylesheet a worn shape carries with it: its motion, and its answer to
 * the hand. Scoped to the part's class, so two shapes never share a rule;
 * the motion only for a visitor who has not asked for less. Written into
 * the part's own markup, so the published page carries it without anything
 * of the Builder's.
 */
export function wornCss(id: string, worn: Worn, w: number, h: number, opts: { still?: boolean } = {}): string {
  if (!ID.test(id)) return "";
  const k = `.wk-${id}`;
  const out: string[] = [];
  const shadowAt = (s: KitShadow[] | null | undefined, rest: KitShadow[]) => {
    const a = s?.[0], b = rest[0];
    return (a && b ? [a.dx - b.dx, a.dy - b.dy] : [0, 0]) as [number, number];
  };
  const kit = worn.kit;
  const hv = worn.hover ? kit.hover ?? { dx: 0, dy: -3, rotate: 0, scale: 1, shadows: null } : null;
  const pr = worn.press ? kit.press ?? { dx: 0, dy: 2, rotate: 0, scale: 0.97, shadows: null } : null;
  out.push(`${k} .wk-lift, ${k} .wk-shadow { transition: transform 0.16s cubic-bezier(0.2, 0.9, 0.25, 1.2); transform-origin: ${originOf(worn.pts)}; transform-box: fill-box; }`);
  if (!opts.still) {
    if (hv) {
      const [sx, sy] = shadowAt(hv.shadows, kit.shadows);
      out.push(`${k}:hover .wk-lift { transform: translate(${f(hv.dx)}px, ${f(hv.dy)}px) rotate(${f(hv.rotate)}deg) scale(${f(hv.scale)}); }`);
      if (sx || sy) out.push(`${k}:hover .wk-shadow { transform: translate(${f(sx)}px, ${f(sy)}px); }`);
    }
    if (pr) {
      const [sx, sy] = shadowAt(pr.shadows, kit.shadows);
      const squash = pr.scale === 1 && !kit.press ? "" : ` scale(${f(pr.scale)})`;
      out.push(`${k}:active .wk-lift { transform: translate(${f(pr.dx)}px, ${f(pr.dy)}px)${squash}; transition-duration: 0.06s; }`);
      // Pressed, the shadow tucks in under it by as far as it moved.
      out.push(`${k}:active .wk-shadow { transform: translate(${f(sx - pr.dx)}px, ${f(sy - pr.dy)}px); transition-duration: 0.06s; }`);
    }
  }
  const m = worn.motion;
  if (m && !opts.still) {
    const frames = motionFrames(m, w, h);
    const dur = Math.max(80, Math.round(m.duration / Math.max(0.1, m.speed)));
    const timing = TIMING.test(m.timing.trim()) ? m.timing.trim() : "ease-in-out";
    if (frames.length) {
      const name = `wk-${id}-move`;
      out.push(`@keyframes ${name} {\n${frames.map((fr) => `  ${fr.key} { ${Object.entries(fr.style).map(([p, v]) => `${p}: ${v}`).join("; ")} }`).join("\n")}\n}`);
      out.push(`@media (prefers-reduced-motion: no-preference) { ${k} .wk-move { animation: ${name} ${dur}ms ${timing} 0ms infinite; transform-origin: ${originOf(worn.pts)}; } }`);
    }
  }
  return out.join("\n");
}

/** A new worn record for a line and a kit. What it is is left for its panel to ask (`WhatIsThis`), with the kit's own kind suggested there. */
export function wornFor(kit: StyleKit, shape: { pts: Pt[]; smooth: boolean; snap: SnapName | null }, raw: { pts: Pt[]; box: { x: number; y: number; w: number; h: number } } | null, bar: KitBand | null): Worn {
  return { pts: shape.pts, smooth: shape.smooth, snap: shape.snap, raw, kit, fill: null, bar: kit.bar ?? bar, motion: null, hover: !!kit.hover, press: !!kit.press, what: null };
}
