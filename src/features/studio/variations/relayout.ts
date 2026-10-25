/**
 * A VARIATION'S LAYOUT, LAID BACK OUT ONTO THE BOARD.
 *
 * The board places every part by hand; the layout tree (`layout/read.ts`)
 * reads them as rows, columns and grids without moving them. Here the tree
 * is changed and the parts are moved to match it:
 *
 *   · gaps (the "space" layer): every gap and space-before in a column, and
 *     in a row where the row still fits its holder, goes onto the chosen
 *     spacing step (`tokens.ts#snapSpace`); what follows moves down by as
 *     much, and every holder grows or shrinks with what it holds;
 *   · section layout: a section's columns centred or set to the left edge
 *     (only items narrower than their holder move), and its rows turned
 *     round, left for right, inside the room they had; and `air`: that much
 *     more space above every section after the first, so the page breathes;
 *   · section order: the page's sections stacked again in the new order,
 *     each keeping the space it had after it. The parts a section holds go
 *     with it, the ones it holds placed by hand among them.
 *
 * Moves are deltas on what the board has, so nothing changes size but the
 * holders, and a part's words never reflow. A part the tree keeps placed
 * moves with the box that holds it. A part shown only on a press goes with
 * the part it sits on.
 *
 * Pure: no store, no DOM.
 */
import { readLayout, type Box, type Flow, type LayoutItem, type LayoutPart, type LayoutTree, type Placed } from "../layout/read.ts";
import type { LayoutChoice, OrderChoice, SectionLayout, SpaceChoice } from "./model.ts";
import { snapSpace } from "./tokens.ts";

export interface Move { dx: number; dy: number; dh: number }
export type RelayNode = LayoutPart & { pageId?: string };

interface Ctx {
  space: SpaceChoice | null;
  layout: LayoutChoice | null;
  sectionIx: Map<string, number>;
  moves: Map<string, Move>;
  /** Which section each part is in, by index. */
  sectionOf: Map<string, number>;
}

const right = (b: Box) => b.x + b.w;

function record(ctx: Ctx, id: string | null, m: Move, section: number | null) {
  if (!id) return;
  ctx.moves.set(id, m);
  if (section != null) ctx.sectionOf.set(id, section);
}

function placedMoves(ctx: Ctx, p: Placed, dx: number, dy: number, section: number | null) {
  record(ctx, p.id, { dx, dy, dh: 0 }, section);
  if (p.flow) relay(ctx, p.flow, p.box, dx, dy, section, null);
}

/** Where an item's lead space starts: the gap (after the first) and its own space before. */
const lead = (f: Flow, it: LayoutItem, i: number) => (i > 0 ? f.gap ?? 0 : 0) + it.before;
const snapped = (ctx: Ctx, f: Flow, it: LayoutItem, i: number) => {
  if (!ctx.space) return lead(f, it, i);
  /* A negative space before is an overlap the reader kept: left as it is. */
  const g = i > 0 && f.gap != null ? snapSpace(f.gap, ctx.space) : 0;
  return g + (it.before > 0 ? snapSpace(it.before, ctx.space) : it.before);
};

/**
 * Lay one flow out again, its holder moved by (dx, dy). Records each part's
 * move and returns how much taller its content became.
 */
function relay(ctx: Ctx, f: Flow, holder: Box, dx: number, dy: number, section: number | null, sl: SectionLayout | null): number {
  let grown = 0;
  const kid = (it: LayoutItem, kx: number, ky: number) => {
    const s = it.part == null ? section : ctx.sectionIx.get(it.id) ?? section;
    const kidSl = ctx.sectionIx.has(it.id) ? ctx.layout?.sections[ctx.sectionIx.get(it.id)!] ?? null : sl;
    const dh = it.flow ? relay(ctx, it.flow, it.box, kx, ky, s, kidSl) : 0;
    record(ctx, it.part, { dx: kx, dy: ky, dh }, s);
    return dh;
  };
  if (f.display === "grid") {
    /* Cells keep their places; a row that grew pushes the rows under it. */
    const rows = [...new Set(f.items.map((it) => Math.round(it.box.y)))].sort((a, b) => a - b);
    let cum = 0;
    for (const y of rows) {
      let most = 0;
      for (const it of f.items.filter((x) => Math.round(x.box.y) === y)) most = Math.max(most, kid(it, dx, dy + cum));
      cum += most;
    }
    grown = cum;
  } else if (f.direction === "column") {
    const inner = { x: holder.x + f.pad.left, w: holder.w - f.pad.left - f.pad.right };
    let cum = 0;
    f.items.forEach((it, i) => {
      cum += snapped(ctx, f, it, i) - lead(f, it, i);
      let ax = 0;
      if (sl && sl.align !== "keep" && it.box.w < inner.w * 0.9) {
        const want = sl.align === "center" ? inner.x + (inner.w - it.box.w) / 2 : inner.x;
        ax = Math.round(want - it.box.x);
      }
      cum += kid(it, dx + ax, dy + cum);
    });
    grown = cum;
  } else {
    /* A row: its gaps on the step only where it still fits; turned round inside its own span. */
    const n = f.items.length;
    const shifts = f.items.map(() => 0);
    if (ctx.space && n > 1) {
      let cum = 0;
      const tryShifts = f.items.map((it, i) => (cum += snapped(ctx, f, it, i) - lead(f, it, i)));
      const room = right(holder) - f.pad.right - Math.max(...f.items.map((it) => right(it.box)));
      if (cum <= room) tryShifts.forEach((v, i) => { shifts[i] = v; });
    }
    const flip = !!sl?.flip && n > 1;
    const left = Math.min(...f.items.map((it) => it.box.x + shifts[f.items.indexOf(it)]!));
    const rightEdge = Math.max(...f.items.map((it, i) => right(it.box) + shifts[i]!));
    let most = 0;
    f.items.forEach((it, i) => {
      const x = it.box.x + shifts[i]!;
      const fx = flip ? left + rightEdge - (x + it.box.w) - it.box.x : shifts[i]!;
      most = Math.max(most, kid(it, dx + Math.round(fx), dy));
    });
    grown = most;
  }
  for (const p of f.placed) placedMoves(ctx, p, dx, dy, section);
  return grown;
}

/** Every part's move for one page's tree. */
export function relayoutMoves(tree: LayoutTree, space: SpaceChoice | null, layout: LayoutChoice | null, order: OrderChoice | null): Map<string, Move> {
  const ctx: Ctx = { space, layout, sectionIx: new Map(tree.sections.map((s, i) => [s.id, i])), moves: new Map(), sectionOf: new Map() };
  if (space || layout) relay(ctx, tree.root, { x: 0, y: 0, w: tree.width, h: 0 }, 0, 0, null, null);
  /* Placed parts the wrappers hold go with the section they lie over. */
  for (const p of tree.placed) if (p.section && ctx.sectionIx.has(p.section) && !ctx.sectionOf.has(p.id)) ctx.sectionOf.set(p.id, ctx.sectionIx.get(p.section)!);
  /* Air: every section after the first moves down by that much more than the one above it. */
  const air = layout?.air ?? 0;
  if (air > 0) {
    const rank = new Map(tree.sections.map((s, i) => [i, s.box.y]));
    const byY = [...rank.entries()].sort((a, b) => a[1] - b[1]).map(([i]) => i);
    const extra = new Map(byY.map((i, k) => [i, k * air]));
    for (const [id, sec] of ctx.sectionOf) {
      const e = extra.get(sec) ?? 0;
      if (!e) continue;
      const m = ctx.moves.get(id) ?? { dx: 0, dy: 0, dh: 0 };
      ctx.moves.set(id, { ...m, dy: m.dy + e });
    }
  }
  if (!order || order.order.length !== tree.sections.length || order.order.every((v, i) => v === i)) return ctx.moves;
  if (!(space || layout)) {
    /* Order alone: membership still needs the walk, with nothing moved. */
    relay({ ...ctx, moves: new Map() }, tree.root, { x: 0, y: 0, w: tree.width, h: 0 }, 0, 0, null, null);
  }
  /* The sections as the moves so far leave them, top to bottom. */
  const at = tree.sections.map((s, i) => {
    const m = (s.part ? ctx.moves.get(s.part) : null) ?? firstMoveIn(ctx, i) ?? { dx: 0, dy: 0, dh: 0 };
    return { i, y: s.box.y + m.dy, h: s.box.h + m.dh };
  });
  const sorted = [...at].sort((a, b) => a.y - b.y);
  for (let k = 1; k < sorted.length; k++) if (sorted[k]!.y < sorted[k - 1]!.y + sorted[k - 1]!.h - 2) return ctx.moves; // overlapping sections: not reordered
  const after = sorted.map((s, k) => (k + 1 < sorted.length ? sorted[k + 1]!.y - (s.y + s.h) : 0));
  const gapAfter = new Map(sorted.map((s, k) => [s.i, after[k]!]));
  let y = sorted[0]!.y;
  const extra = new Map<number, number>();
  for (const i of order.order) {
    const s = at[i]!;
    extra.set(i, y - s.y);
    y += s.h + (gapAfter.get(i) ?? 0);
  }
  for (const [id, sec] of ctx.sectionOf) {
    const e = extra.get(sec) ?? 0;
    if (!e) continue;
    const m = ctx.moves.get(id) ?? { dx: 0, dy: 0, dh: 0 };
    ctx.moves.set(id, { ...m, dy: m.dy + e });
  }
  return ctx.moves;
}

function firstMoveIn(ctx: Ctx, section: number): Move | null {
  for (const [id, s] of ctx.sectionOf) if (s === section) return ctx.moves.get(id) ?? null;
  return null;
}

/**
 * The parts with a variation's layout, space gaps and order laid out on
 * every page. Parts nothing moved are handed back as they were (the same
 * objects).
 */
export function relayout<N extends RelayNode>(nodes: readonly N[], o: { space: SpaceChoice | null; layout: LayoutChoice | null; order: OrderChoice | null; width?: number; pageIds?: readonly string[] }): { nodes: N[]; moved: number } {
  if (!o.space && !o.layout && !o.order) return { nodes: [...nodes], moved: 0 };
  const pages = o.pageIds ?? [...new Set(nodes.map((n) => n.pageId ?? ""))];
  const all = new Map<string, Move>();
  for (const pageId of pages) {
    const mine = nodes.filter((n) => (n.pageId ?? "") === pageId);
    if (!mine.length) continue;
    const tree = readLayout(mine, { pageId: null, width: o.width });
    const moves = relayoutMoves(tree, o.space, o.layout, o.order);
    /* A part a press shows goes with the smallest moved part it sits on. */
    const boxes = mine.filter((n) => moves.has(n.id)).map((n) => ({ n, m: moves.get(n.id)! }));
    for (const s of mine.filter((n) => n.state)) {
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      let best: { n: N; m: Move } | null = null;
      for (const b of boxes) if (cx >= b.n.x && cx <= b.n.x + b.n.w && cy >= b.n.y && cy <= b.n.y + b.n.h && (!best || b.n.w * b.n.h < best.n.w * best.n.h)) best = b;
      if (best) moves.set(s.id, { dx: best.m.dx, dy: best.m.dy, dh: 0 });
    }
    for (const [id, m] of moves) all.set(id, m);
  }
  let moved = 0;
  const out = nodes.map((n) => {
    const m = all.get(n.id);
    if (!m || (!m.dx && !m.dy && !m.dh)) return n;
    moved++;
    return { ...n, x: n.x + m.dx, y: n.y + m.dy, h: Math.max(1, n.h + m.dh) };
  });
  return { nodes: out, moved };
}

/** How many sections a page has, as the tree reads them: what the order and layout layers roll over. */
export function sectionCount(nodes: readonly RelayNode[], pageId: string | null, width?: number): number {
  const mine = pageId == null ? nodes : nodes.filter((n) => n.pageId === pageId);
  return mine.length ? readLayout(mine, { pageId: null, width }).sections.length : 0;
}
