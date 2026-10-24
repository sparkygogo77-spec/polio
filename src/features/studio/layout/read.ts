/**
 * READ A BOARD'S PLACED PARTS AS FLOW (the layout tree, `tree.ts`).
 *
 * What holds what is the Builder's own reading (`partTree.ts`: the page path
 * the capture recorded, else the box). Inside each holder the parts are cut
 * into bands, the way a person reads a page:
 *
 *   - a clean horizontal gap between bands means a column (stacked bands);
 *   - inside a band, a clean vertical gap means a row;
 *   - bands of rows whose cells line up, column for column, are a grid;
 *   - the same space between every item is the gap; an item that differs
 *     says its own space before it;
 *   - items lined up to a shared edge, or centred, say it once on the holder
 *     (`align`); one that differs says its own;
 *   - every width is a max-width, so the flow may get narrower and never
 *     wider.
 *
 * Parts that cannot be cut apart (one over another) are not guessed at: the
 * one in the way of most others is kept placed at its own x and y and the
 * rest are cut again. So are parts that are hidden, shown only on a press,
 * have no size, are fixed to the window, or stick out of their holder. Each
 * placed part says why, and the counts always add up to every part.
 *
 * Pure: no store, no DOM. The board does not move.
 */

import { partTree, type TreePart } from "../partTree.ts";
import type { Align, Box, Flow, LayoutItem, LayoutSection, LayoutTree, Pad, Placed } from "./tree.ts";

export type { Align, Box, Flow, LayoutItem, LayoutSection, LayoutTree, Pad, Placed } from "./tree.ts";

export interface LayoutPart extends TreePart {
  hidden?: boolean;
  state?: unknown;
  from?: { selector?: string | null; position?: string } | null;
}

export interface ReadOptions {
  /** Only this page's parts (default: every part given). */
  pageId?: string | null;
  /** The board width (default: the right edge of the widest part). */
  width?: number;
}

/** Two edges this close are one edge. */
const EDGE = 2;
/** Two spaces this close are one gap. */
const GAP = 1;
/** Two boxes may overlap this much (rounding) and still be side by side. */
const TOUCH = 2;

const right = (b: Box) => b.x + b.w;
const bottom = (b: Box) => b.y + b.h;
const boxOf = (n: TreePart): Box => ({ x: n.x, y: n.y, w: Math.max(0, n.w), h: Math.max(0, n.h) });
const bboxOf = (items: { box: Box }[]): Box => {
  const x = Math.min(...items.map((i) => i.box.x)), y = Math.min(...items.map((i) => i.box.y));
  return { x, y, w: Math.max(...items.map((i) => right(i.box))) - x, h: Math.max(...items.map((i) => bottom(i.box))) - y };
};
const overlaps = (a: Box, b: Box) =>
  Math.min(right(a), right(b)) - Math.max(a.x, b.x) > TOUCH && Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > TOUCH;
const mode = <T,>(xs: T[], prefer: T[]): T => {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  let best = xs[0] as T, n = -1;
  for (const p of [...prefer, ...c.keys()]) if ((c.get(p) ?? 0) > n) { best = p; n = c.get(p) ?? 0; }
  return best;
};

/** Cut items into bands along an axis: a new band starts where nothing before reaches. */
function bands(items: LayoutItem[], axis: "x" | "y"): LayoutItem[][] {
  const start = (i: LayoutItem) => (axis === "y" ? i.box.y : i.box.x);
  const end = (i: LayoutItem) => (axis === "y" ? bottom(i.box) : right(i.box));
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(a) - end(b));
  const out: LayoutItem[][] = [];
  let reach = -Infinity;
  for (const it of sorted) {
    if (!out.length || start(it) >= reach - TOUCH) { out.push([it]); reach = end(it); }
    else { out[out.length - 1]!.push(it); reach = Math.max(reach, end(it)); }
  }
  return out;
}

/** How each item sits across a holder, from its distance to the near and far edge. */
function across(near: number[], far: number[], keep: boolean): { align: Align; pad: [number, number]; cls: Align[]; off: number[] } {
  if (near.length && near.every((l, i) => Math.abs(l - far[i]!) <= EDGE) && !near.every((l) => l <= EDGE)) {
    /*
     * All centred. Across a column the max-widths centre them and no padding
     * is needed. Across a row the holder's height is what the padding says
     * (`keep`): the tallest item's space above and below.
     */
    const pad: [number, number] = keep ? [Math.max(0, Math.min(...near)), Math.max(0, Math.min(...far))] : [0, 0];
    return { align: "center", pad, cls: near.map(() => "center"), off: near.map(() => 0) };
  }
  const pn = Math.max(0, Math.min(...near)), pf = Math.max(0, Math.min(...far));
  const cls: Align[] = [], off: number[] = [];
  near.forEach((l0, i) => {
    const l = l0 - pn, r = far[i]! - pf;
    if (l <= EDGE && r <= EDGE) { cls.push("stretch"); off.push(l); }
    else if (l <= EDGE) { cls.push("start"); off.push(l); }
    else if (r <= EDGE) { cls.push("end"); off.push(0); }
    else if (Math.abs(l - r) <= EDGE) { cls.push("center"); off.push(0); }
    else { cls.push("start"); off.push(l); }
  });
  return { align: mode(cls, ["stretch", "start", "center", "end"]), pad: [pn, pf], cls, off };
}

/** The space before each item along the main direction, said as one gap where it is one. */
function spacing(gaps: number[]): { gap: number | null; before: number[]; drift: number } {
  if (!gaps.length) return { gap: null, before: [], drift: 0 };
  /* The middle gap itself (not the mean of two), so it is always one of them. */
  const mid = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!;
  const near = gaps.filter((g) => Math.abs(g - mid) <= GAP);
  /* CSS has no negative gap: items that overlap a little say it as their own (negative) space before. */
  const gap = Math.max(0, near.reduce((a, b) => a + b, 0) / near.length);
  /* Gaps a little off the one gap add up down a long column: once the sum is more than a pixel out, the item says its own space and the sum starts again. */
  let drift = 0;
  const before = gaps.map((g) => {
    const d = drift + g - gap;
    if (Math.abs(d) <= GAP) { drift = d; return 0; }
    drift = 0;
    return d;
  });
  return { gap: Math.abs(gap) < 0.01 ? 0 : gap, before, drift };
}

function line(items: LayoutItem[], holder: Box, direction: "row" | "column", placed: Placed[]): Flow {
  const col = direction === "column";
  const sorted = [...items].sort((a, b) => (col ? a.box.y - b.box.y : a.box.x - b.box.x));
  const s0 = (b: Box) => (col ? b.y : b.x), e0 = (b: Box) => (col ? bottom(b) : right(b));
  const gaps = sorted.slice(1).map((it, i) => s0(it.box) - e0(sorted[i]!.box));
  const { gap, before, drift } = spacing(gaps);
  const near = sorted.map((it) => (col ? it.box.x - holder.x : it.box.y - holder.y));
  const far = sorted.map((it) => (col ? right(holder) - right(it.box) : bottom(holder) - bottom(it.box)));
  const a = across(near, far, !col);
  const first = sorted[0], last = sorted[sorted.length - 1];
  /* No negative padding in CSS: a first item a pixel above its holder says it as a negative space before. */
  const lead0 = first ? s0(first.box) - s0(holder) : 0;
  const lead = Math.max(0, lead0);
  /* What the gaps left over (under a pixel) comes off the end, so the holder keeps its size. */
  const tail = last ? Math.max(0, e0(holder) - e0(last.box) + drift) : 0;
  const pad: Pad = col
    ? { top: lead, bottom: tail, left: a.pad[0], right: a.pad[1] }
    : { left: lead, right: tail, top: a.pad[0], bottom: a.pad[1] };
  /*
   * A row is as tall as its tallest item. When no item spans it (one at the
   * top, a shorter one at the bottom), its height is said as a min-height.
   */
  let minHeight: number | null = null;
  if (!col && sorted.length) {
    const span = holder.h - pad.top - pad.bottom;
    const outer = Math.max(...sorted.map((it, i) => (a.cls[i] === "start" || a.cls[i] === "stretch" ? a.off[i]! : 0) + it.box.h));
    if (outer < span - 0.5) minHeight = holder.h;
  }
  const out = sorted.map((it, i) => ({
    ...it,
    before: i === 0 ? Math.min(0, lead0) : before[i - 1]!,
    self: a.cls[i]! === a.align ? null : a.cls[i]!,
    offset: a.cls[i] === "start" || a.cls[i] === "stretch" ? a.off[i]! : 0,
    fill: col && a.cls[i] === "stretch",
  }));
  return { display: "flex", direction, gap, rowGap: null, columns: null, align: a.align, pad, minHeight, items: out, placed };
}

/**
 * Bands of rows whose cells line up column for column, with one space
 * between columns and one between rows, are a grid. The last row may be
 * short (a card grid with three in the last row of four).
 */
function asGrid(rows: LayoutItem[][], holder: Box, placed: Placed[]): Flow | null {
  if (rows.length < 2) return null;
  const cells = rows.map((r) => [...r].sort((a, b) => a.box.x - b.box.x));
  const k = cells[0]!.length;
  if (k < 2 || cells.some((r, i) => r.length > k || r.length < 2 || (r.length < k && i < cells.length - 1))) return null;
  const lefts = cells[0]!.map((c) => c.box.x), widths = cells[0]!.map((c) => c.box.w);
  for (const r of cells) for (let c = 0; c < r.length; c++) {
    if (Math.abs(r[c]!.box.x - lefts[c]!) > EDGE || r[c]!.box.w > widths[c]! + EDGE) return null;
  }
  const colGaps = lefts.slice(1).map((l, i) => l - lefts[i]! - widths[i]!);
  if (Math.max(...colGaps) - Math.min(...colGaps) > GAP || Math.min(...colGaps) < -TOUCH) return null;
  const tops = cells.map((r) => Math.min(...r.map((c) => c.box.y)));
  const bots = cells.map((r) => Math.max(...r.map((c) => bottom(c.box))));
  const rowGaps = tops.slice(1).map((t, i) => t - bots[i]!);
  if (Math.max(...rowGaps) - Math.min(...rowGaps) > GAP || Math.min(...rowGaps) < -TOUCH) return null;
  const items: LayoutItem[] = [];
  cells.forEach((r, ri) => r.forEach((c, ci) => items.push({ ...c, before: c.box.y - tops[ri]!, self: null, offset: c.box.x - lefts[ci]!, fill: false })));
  const colGap = colGaps.reduce((a, b) => a + b, 0) / colGaps.length;
  const rowGap = rowGaps.reduce((a, b) => a + b, 0) / rowGaps.length;
  const colGapAt = colGaps.reduce((a, b) => a + b, 0) / colGaps.length;
  if (rowGap < 0 || colGapAt < 0) return null;
  for (const [gs, at] of [[rowGaps, rowGap], [colGaps, colGapAt]] as const) {
    let drift = 0;
    for (const g of gs) { drift += g - at; if (Math.abs(drift) > GAP) return null; }
  }
  const pad: Pad = {
    top: tops[0]! - holder.y,
    bottom: Math.max(0, bottom(holder) - bots[bots.length - 1]!),
    left: lefts[0]! - holder.x,
    right: Math.max(0, right(holder) - (lefts[k - 1]! + widths[k - 1]!)),
  };
  return { display: "grid", direction: "row", gap: colGap, rowGap, columns: widths, align: "start", pad, minHeight: null, items, placed };
}

export function readLayout(nodes: readonly LayoutPart[], opts: ReadOptions = {}): LayoutTree {
  const all = opts.pageId == null ? [...nodes] : nodes.filter((n) => n.pageId === opts.pageId);
  /* A part a press shows (a tab's other panels) is not on the page as it opens: it is a state, not layout, and is counted apart. */
  const states = all.filter((n) => n.state);
  const page = all.filter((n) => !n.state);
  const width = opts.width ?? Math.max(0, ...page.map((n) => n.x + n.w));
  const tree = partTree(page);
  const byId = new Map(page.map((n) => [n.id, n]));
  const label = (id: string) => id;

  const placedOf = (it: LayoutItem, holder: Box, why: string): Placed => ({
    id: it.id, box: it.box, left: it.box.x - holder.x, top: it.box.y - holder.y, why, flow: it.flow,
  });

  /** Why a part cannot be laid out in its holder's flow, or null when it can. */
  const outOfFlow = (n: LayoutPart, holder: Box, isPage: boolean): string | null => {
    if (n.hidden) return "hidden (its eye is shut)";
    if (!(n.w > 0 && n.h > 0)) return "has no size";
    if (n.from?.position === "fixed") return "fixed to the window";
    const b = boxOf(n);
    if (b.x < holder.x - EDGE || right(b) > right(holder) + EDGE || (!isPage && (b.y < holder.y - EDGE || bottom(b) > bottom(holder) + EDGE))) {
      return isPage ? "outside the page" : "sticks out of the box that holds it";
    }
    return null;
  };

  /**
   * Cut the in-flow items of one holder into flow. What cannot be cut goes to
   * `sink`, the real holder's placed list (`own`: this is that holder's flow,
   * so it shows the list; a made-up group's flow shows none).
   */
  const cut = (items: LayoutItem[], holder: Box, real: Box, sink: Placed[], own: boolean): Flow => {
    const placed = own ? sink : [];
    let list = items;
    for (;;) {
      if (list.length <= 1) return line(list, holder, "column", placed);
      const ys = bands(list, "y");
      if (ys.length > 1) {
        const rows = ys.map((b) => (b.length === 1 ? null : bands(b, "x")));
        if (rows.every((r) => r && r.length > 1 && r.every((c) => c.length === 1))) {
          const grid = asGrid(rows.map((r) => r!.map((c) => c[0]!)), holder, placed);
          if (grid) return grid;
        }
        return line(ys.map((b) => (b.length === 1 ? b[0]! : made(b, real, sink))), holder, "column", placed);
      }
      const xs = bands(list, "x");
      if (xs.length > 1) return line(xs.map((b) => (b.length === 1 ? b[0]! : made(b, real, sink))), holder, "row", placed);
      /* Tangled: keep the part in the way of most others where it is, and cut the rest again. */
      const hits = list.map((a) => list.filter((b) => b !== a && overlaps(a.box, b.box)));
      let pick = 0;
      for (let i = 1; i < list.length; i++) {
        const d = hits[i]!.length - hits[pick]!.length;
        if (d > 0 || (d === 0 && list[i]!.box.w * list[i]!.box.h > list[pick]!.box.w * list[pick]!.box.h)) pick = i;
      }
      const names = hits[pick]!.slice(0, 3).map((o) => label(o.id)).join(", ") + (hits[pick]!.length > 3 ? ` and ${hits[pick]!.length - 3} more` : "");
      sink.push(placedOf(list[pick]!, real, hits[pick]!.length ? `over ${names}` : "could not be cut from the parts beside it"));
      list = list.filter((_, i) => i !== pick);
    }
  };

  /** A band of parts with no box of its own: a group the reader made up. */
  const made = (band: LayoutItem[], real: Box, sink: Placed[]): LayoutItem => {
    const box = bboxOf(band);
    const flow = cut(band, box, real, sink, false);
    return { id: `g:${band[0]!.id}`, part: null, box, maxWidth: box.w, fill: false, height: flow.items.length ? null : box.h, before: 0, self: null, offset: 0, flow };
  };

  /** One holder's flow: its kids in flow, cut; the rest placed. */
  const holderFlow = (holder: Box, kids: string[], isPage: boolean): Flow | null => {
    if (!kids.length) return null;
    const placed: Placed[] = [];
    const inFlow: LayoutItem[] = [];
    for (const id of kids) {
      const n = byId.get(id)!;
      const it = itemOf(n);
      const why = outOfFlow(n, holder, isPage);
      if (why) placed.push(placedOf(it, holder, why));
      else inFlow.push(it);
    }
    return cut(inFlow, holder, holder, placed, true);
  };

  const itemOf = (n: LayoutPart): LayoutItem => {
    const box = boxOf(n);
    const flow = holderFlow(box, tree.kids.get(n.id) ?? [], false);
    return { id: n.id, part: n.id, box, maxWidth: box.w, fill: false, height: flow && flow.items.length ? null : box.h, before: 0, self: null, offset: 0, flow };
  };

  const pageBox: Box = { x: 0, y: 0, w: width, h: Math.max(0, ...page.map((n) => n.y + n.h)) };
  const root = holderFlow(pageBox, tree.roots, true) ?? line([], pageBox, "column", []);

  /* Sections: go down through page-wide wrappers (body, main) to the first level that is more than one band. */
  const tagOf = (it: LayoutItem) => {
    const sel = it.part ? byId.get(it.part)?.from?.selector ?? "" : "";
    return /(?:^|[\s>])([a-z][a-z0-9-]*)(?:[.#:[][^\s>]*)?\s*$/i.exec(sel)?.[1]?.toLowerCase() ?? "";
  };
  const sectionItems: LayoutItem[] = [];
  const wrapperPlaced: Placed[] = [...root.placed];
  const down = (flow: Flow) => {
    for (const it of flow.items) {
      const wrapper = it.flow && it.flow.display === "flex" && it.flow.direction === "column" && it.flow.items.length >= 2
        && it.box.w >= width * 0.9 && !["section", "header", "footer", "nav", "article", "aside"].includes(tagOf(it))
        && (it.part == null || it.box.h > 1200);
      if (wrapper) { wrapperPlaced.push(...it.flow!.placed); down(it.flow!); }
      else sectionItems.push(it);
    }
  };
  down(root);

  /* Count what each section holds. */
  const count = (it: LayoutItem | Placed, into: { grouped: number; placed: number; list: Placed[] }, isPlaced: boolean) => {
    if (isPlaced) { into.placed++; into.list.push(it as Placed); }
    else if ((it as LayoutItem).part) into.grouped++;
    const f = it.flow;
    if (!f) return;
    for (const c of f.items) count(c, into, false);
    for (const p of f.placed) count(p, into, true);
  };
  const sections: LayoutSection[] = [];
  const placedAll: (Placed & { section: string | null })[] = [];
  let grouped = 0, placedN = 0;
  for (const it of sectionItems) {
    const c = { grouped: 0, placed: 0, list: [] as Placed[] };
    count(it, c, false);
    sections.push({ id: it.id, part: it.part, box: it.box, grouped: c.grouped, placed: c.placed });
    placedAll.push(...c.list.map((p) => ({ ...p, section: it.id })));
    grouped += c.grouped; placedN += c.placed;
  }
  /* The wrappers themselves are grouped; what they hold at their own level that is placed goes to the section it lies over most. */
  const wrappers = (flow: Flow): number => flow.items.reduce((s, it) => s + (sectionItems.includes(it) ? 0 : (it.part ? 1 : 0) + (it.flow ? wrappers(it.flow) : 0)), 0);
  grouped += wrappers(root);
  for (const p of wrapperPlaced) {
    const c = { grouped: 0, placed: 0, list: [] as Placed[] };
    count(p, c, true);
    let best: LayoutSection | null = null, most = 0;
    for (const s of sections) {
      const o = Math.max(0, Math.min(bottom(s.box), bottom(p.box)) - Math.max(s.box.y, p.box.y)) * Math.max(0, Math.min(right(s.box), right(p.box)) - Math.max(s.box.x, p.box.x));
      if (o > most) { most = o; best = s; }
    }
    if (best) { best.grouped += c.grouped; best.placed += c.placed; }
    placedAll.push(...c.list.map((q) => ({ ...q, section: best?.id ?? null })));
    grouped += c.grouped; placedN += c.placed;
  }
  return { pageId: opts.pageId ?? null, width, root, sections, placed: placedAll, states: states.map((n) => n.id), counts: { parts: page.length, grouped, placed: placedN, states: states.length } };
}
