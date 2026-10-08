/**
 * Where parts go when the page is narrower than the board. Pure: no React,
 * no catalogue, no store, so `tests/reflow-same.mjs` can hold it without a
 * browser. `layout.ts` is the wrapper that knows which parts are behaviours
 * and which keep their aspect; this is the arithmetic.
 *
 * At the width the board was designed for, positions are the board's — the
 * frame is the truth. Narrower than that, rows reflow: each row's parts
 * stack in reading order at the device width. A picture keeps its aspect;
 * anything else narrowed by some factor grows in height by that factor,
 * bounded, since its words need the lines.
 *
 * A part whose `layout` says flex or grid is a CONTAINER, and the parts its
 * box holds are its children. They leave the row flow: they are placed
 * inside the container's placed box, squeezed across with it, keeping their
 * heights and where they stood down the box. A row that wraps, squeezed
 * past `WRAP_AT`, wraps its children into lines at their own width and
 * grows to hold them, and what comes after moves down by the growth. His
 * captured page is a header that is a row, a strip of cards, a footer of
 * columns — and with no notion of a container every one of them came out
 * as a pile at tablet and phone. With no layout field anywhere there are no
 * containers and the placement is exactly what it was.
 */
import type { StudioNode } from "../board/store";

/** The most a narrowed part grows in height: a part four times narrower is four times taller, and no more. */
const GROW_MAX = 4;
/** Squeezed below this share of its width, a wrapping row wraps instead. */
const WRAP_AT = 0.6;

export interface Placed {
  node: StudioNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReflowRules {
  /** Full width is this share of the frame or more (the reshape rule's nine tenths). */
  fullBleed: number;
  /** A part that keeps its aspect when narrowed: pictures, first screens. */
  aspectBound: (n: StudioNode) => boolean;
}

/**
 * Parts in the same horizontal band are one row, ordered left to right.
 * Rows are ordered top to bottom.
 */
export function toRows(nodes: StudioNode[]): StudioNode[][] {
  const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: StudioNode[][] = [];
  for (const n of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const bottom = Math.max(...row.map((r) => r.y + r.h));
      const top = Math.min(...row.map((r) => r.y));
      const overlap = Math.min(bottom, n.y + n.h) - Math.max(top, n.y);
      // More than a third of the shorter element shares a horizontal band.
      if (overlap > Math.min(n.h, bottom - top) * 0.34) {
        row.push(n);
        continue;
      }
    }
    rows.push([n]);
  }
  return rows.map((r) => [...r].sort((a, b) => a.x - b.x));
}

export function frameHeightOf(nodes: StudioNode[], min = 900): number {
  const bottom = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  return Math.max(min, bottom + 160);
}

/** A part whose layout says its inside is a flex row or column, or a grid. */
function isContainer(n: StudioNode): boolean {
  const d = n.layout?.display;
  return d === "flex" || d === "grid";
}

/**
 * The container each part sits in: the smallest container whose box holds
 * it. Two boxes the same size — a wrapper round a wrapper, which a captured
 * page is full of — nest in the order they were listed, outer first, so
 * nothing can be its own ancestor.
 */
function parentsOf(nodes: StudioNode[]): Map<string, StudioNode> {
  const parents = new Map<string, StudioNode>();
  const containers = nodes.map((n, i) => ({ n, i, area: n.w * n.h })).filter((c) => isContainer(c.n));
  if (!containers.length) return parents;
  const holds = (c: StudioNode, n: StudioNode) => c.x <= n.x + 1 && c.y <= n.y + 1 && c.x + c.w >= n.x + n.w - 1 && c.y + c.h >= n.y + n.h - 1;
  nodes.forEach((n, i) => {
    const area = n.w * n.h;
    let best: { n: StudioNode; i: number; area: number } | null = null;
    for (const c of containers) {
      if (c.n === n || !holds(c.n, n)) continue;
      if (c.area < area || (c.area === area && c.i > i)) continue;
      if (!best || c.area < best.area || (c.area === best.area && c.i > best.i)) best = c;
    }
    if (best) parents.set(n.id, best.n);
  });
  return parents;
}

/**
 * A container's children, placed inside its placed box. Returns the height
 * the container needs, which is its own unless wrapping grew it.
 */
function placeInside(c: StudioNode, box: Placed, nodes: StudioNode[], parents: Map<string, StudioNode>, placed: Placed[]): number {
  const kids = nodes.filter((k) => parents.get(k.id) === c).sort((a, b) => a.y - b.y || a.x - b.x);
  if (!kids.length) return box.h;
  const sx = box.w / Math.max(1, c.w);
  const l = c.layout!;
  // The room the board left under the children, kept under them here.
  const under = Math.max(0, c.y + c.h - Math.max(...kids.map((k) => k.y + k.h)));
  let bottom = box.y;
  if (l.display === "flex" && l.direction !== "column" && l.wrap && sx < WRAP_AT) {
    const inset = Math.max(0, Math.min(...kids.map((k) => k.x - c.x)));
    const gap = typeof l.gap === "number" && l.gap > 0 ? l.gap : 12;
    const x0 = box.x + inset;
    const xMax = box.x + box.w - inset;
    let cx = x0;
    let cy = box.y + (kids[0]!.y - c.y);
    let lineH = 0;
    for (const k of kids) {
      const kw = Math.max(1, Math.min(k.w, xMax - x0));
      if (cx > x0 && cx + kw > xMax) { cx = x0; cy += lineH + gap; lineH = 0; }
      const kb: Placed = { node: k, x: Math.round(cx), y: Math.round(cy), w: Math.round(kw), h: k.h };
      placed.push(kb);
      if (isContainer(k)) kb.h = placeInside(k, kb, nodes, parents, placed);
      lineH = Math.max(lineH, kb.h);
      cx += kw + gap;
    }
    bottom = cy + lineH;
  } else {
    for (const k of kids) {
      const kb: Placed = { node: k, x: box.x + Math.round((k.x - c.x) * sx), y: box.y + (k.y - c.y), w: Math.max(1, Math.round(k.w * sx)), h: k.h };
      placed.push(kb);
      if (isContainer(k)) kb.h = placeInside(k, kb, nodes, parents, placed);
      bottom = Math.max(bottom, kb.y + kb.h);
    }
  }
  return Math.max(box.h, bottom - box.y + under);
}

export function reflow(nodes: StudioNode[], target: number, frameWidth: number, rules: ReflowRules): { width: number; height: number; placed: Placed[]; reflowed: boolean } {
  if (target >= frameWidth) {
    return {
      width: frameWidth,
      height: frameHeightOf(nodes),
      placed: nodes.map((n) => ({ node: n, x: n.x, y: n.y, w: n.w, h: n.h })),
      reflowed: false,
    };
  }
  const parents = parentsOf(nodes);
  const top = parents.size ? nodes.filter((n) => !parents.has(n.id)) : nodes;
  const gap = 12;
  const placed: Placed[] = [];
  let y = gap;
  // Top-level parts placed so far: what `placed.length` counted before containers put their children in the list too.
  let laid = 0;
  for (const row of toRows(top)) {
    for (const n of row) {
      // Full width is the reshape rule's nine tenths, not the frame less a pixel.
      const full = n.w >= frameWidth * rules.fullBleed;
      const w = full ? target : Math.min(n.w, target - gap * 2);
      // Pictures keep their aspect; everything else grows by how much narrower it got, so its text has the lines it needs.
      // A container does neither: its children have their own heights, and wrapping is what grows it.
      const container = isContainer(n);
      const narrower = Math.min(GROW_MAX, Math.max(1, n.w / Math.max(1, w)));
      const h = container ? n.h : rules.aspectBound(n) ? (n.w > target ? Math.round(n.h * Math.min(1, target / n.w) * 1.15) : n.h) : Math.round(n.h * narrower);
      const box: Placed = { node: n, x: full ? 0 : Math.round((target - w) / 2), y: full && laid === 0 ? 0 : y, w, h };
      placed.push(box);
      laid++;
      if (container) box.h = placeInside(n, box, nodes, parents, placed);
      y = (full && laid === 1 ? 0 : y) + box.h + gap;
    }
  }
  return { width: target, height: Math.max(y + gap, 320), placed, reflowed: true };
}
