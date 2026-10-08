/**
 * THE STRUCTURE VIEW: ONE OUTLINE PER PAGE, EDITED ONCE FOR EVERY STATE (J, 2026-10-08).
 *
 * "I have to go through too many pages to simply reformat the structure of
 * pst." So a page's layout is one outline: its regions (the blocks that hold
 * panels) and what sits in each, by hook. Moving a part up or down its region
 * writes `order` for the region's parts, by hook (`StudioNode.place`). The
 * style layer keys that rule by hook alone, never by panel or state, so the
 * move shows in every state at once, and the board restacks the region so
 * every scene draws it moved.
 *
 * Pure: `tests/structure-view.mjs`.
 */

export interface StructureNode {
  id: string;
  pageId: string;
  x: number; y: number; w: number; h: number;
  hooks?: Record<string, string> | null;
  from?: { selector?: string } | null;
  state?: { group: string } | null;
  label?: string;
  place?: { order?: number } | null;
}

export interface StructureItem {
  id: string;
  hook: string;
  label: string;
  /** A declared panel (`data-panel`): one place whatever state it is in. */
  panel: boolean;
  /** Its parts side by side (columns) or one under another. */
  axis: "down" | "across";
  /** What it holds, in order, when it holds a panel somewhere inside; else empty. */
  children: StructureItem[];
}

const isTemplate = (n: StructureNode) => !!n.state?.group.startsWith("hidden:template:");
const hookOf = (n: StructureNode) => n.hooks?.["data-hook"] ?? null;

/** Each hooked part's nearest hooked block round it, by where each was read. */
function parentsOf(nodes: readonly StructureNode[]): Map<string, string | null> {
  const bySel = new Map<string, StructureNode>();
  for (const n of nodes) if (n.from?.selector && hookOf(n)) bySel.set(n.from.selector, n);
  const up = new Map<string, string | null>();
  for (const n of nodes) {
    let s = n.from?.selector ?? "";
    let found: string | null = null;
    for (let cut = s.lastIndexOf(" > "); cut > 0; cut = s.lastIndexOf(" > ")) {
      s = s.slice(0, cut);
      const p = bySel.get(s);
      if (p && p.id !== n.id) { found = p.id; break; }
    }
    up.set(n.id, found);
  }
  return up;
}

/** Laid in a row when most neighbours overlap top to bottom and sit apart left to right. */
function axisOf(kids: readonly StructureNode[]): "down" | "across" {
  if (kids.length < 2) return "down";
  const s = [...kids].sort((a, b) => a.x - b.x);
  let across = 0;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!, b = s[i]!;
    if (b.x >= a.x + a.w - 1 && b.y < a.y + a.h && a.y < b.y + b.h) across++;
  }
  return across * 2 >= s.length - 1 ? "across" : "down";
}

/** In the order it is laid out: its own `order` first where set, else where it sits. */
function inOrder(kids: StructureNode[], axis: "down" | "across"): StructureNode[] {
  const where = (n: StructureNode) => (axis === "down" ? n.y * 1e5 + n.x : n.x * 1e5 + n.y);
  return kids.sort((a, b) => (a.place?.order ?? 0) - (b.place?.order ?? 0) || where(a) - where(b));
}

/**
 * The page's outline: from its outermost hooked blocks down, every block
 * that holds a declared panel is a region and lists what it holds. A panel is
 * one item: what is inside it changes with its states and is edited on the
 * Panels page, not here.
 */
export function structureOf(nodes: readonly StructureNode[], pageId: string): StructureItem[] {
  const mine = nodes.filter((n) => n.pageId === pageId && hookOf(n) && !isTemplate(n));
  const up = parentsOf(mine);
  const kidsOf = new Map<string | null, StructureNode[]>();
  for (const n of mine) { const p = up.get(n.id) ?? null; kidsOf.set(p, [...(kidsOf.get(p) ?? []), n]); }
  const holdsPanel = new Map<string, boolean>();
  const holds = (n: StructureNode): boolean => {
    if (holdsPanel.has(n.id)) return holdsPanel.get(n.id)!;
    holdsPanel.set(n.id, false);
    const v = (kidsOf.get(n.id) ?? []).some((k) => !!k.hooks?.["data-panel"] || holds(k));
    holdsPanel.set(n.id, v);
    return v;
  };
  const item = (n: StructureNode): StructureItem => {
    const panel = !!n.hooks?.["data-panel"];
    const kids = !panel && holds(n) ? kidsOf.get(n.id) ?? [] : [];
    const axis = axisOf(kids);
    return { id: n.id, hook: hookOf(n)!, label: n.hooks?.["data-label"] ?? hookOf(n)!, panel, axis, children: inOrder([...kids], axis).map(item) };
  };
  const top = kidsOf.get(null) ?? [];
  return inOrder(top.filter((n) => n.hooks?.["data-panel"] || holds(n)), axisOf(top)).map(item);
}

/** The item with this id, and the region it sits in (null at the top). */
export function findItem(items: readonly StructureItem[], id: string, parent: StructureItem | null = null): { item: StructureItem; parent: StructureItem | null } | null {
  for (const it of items) {
    if (it.id === id) return { item: it, parent };
    const got = findItem(it.children, id, it);
    if (got) return got;
  }
  return null;
}

/**
 * One part moved within its region, from place `from` to place `to`: the
 * `order` every part of the region then has, 1 up. Every part gets one, so
 * a part with none does not jump to the front.
 */
export function reorder(region: readonly StructureItem[], from: number, to: number): Map<string, number> {
  const ids = region.map((x) => x.id);
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return new Map();
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved!);
  return new Map(ids.map((id, i) => [id, i + 1]));
}

/**
 * The board after a region's new order: its parts restacked along the
 * region's axis in that order, keeping the first one's start and the usual
 * gap, and everything inside each part carried with it. Returns the moves by
 * id; nothing for a part already in place.
 */
export function restack(nodes: readonly StructureNode[], region: readonly StructureItem[], axis: "down" | "across", order: ReadonlyMap<string, number>): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parts = region.map((x) => byId.get(x.id)).filter((n): n is StructureNode => !!n);
  if (parts.length < 2) return new Map();
  const down = axis === "down";
  const lo = (n: StructureNode) => (down ? n.y : n.x), size = (n: StructureNode) => (down ? n.h : n.w);
  const was = [...parts].sort((a, b) => lo(a) - lo(b));
  const gaps = was.slice(1).map((n, i) => lo(n) - (lo(was[i]!) + size(was[i]!))).filter((g) => g >= 0).sort((a, b) => a - b);
  const gap = gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 0;
  const now = [...parts].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const shift = new Map<string, number>();
  let at = lo(was[0]!);
  for (const n of now) { if (at !== lo(n)) shift.set(n.id, at - lo(n)); at += size(n) + gap; }
  if (!shift.size) return new Map();
  /* What sits inside a moved part goes with it: by where it was read, else by its box. */
  const up = parentsOf(nodes);
  const moveOf = (n: StructureNode): number | null => {
    for (let p: string | null = n.id; p; p = up.get(p) ?? null) if (shift.has(p)) return shift.get(p)!;
    return null;
  };
  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    if (n.pageId !== parts[0]!.pageId) continue;
    const d = moveOf(n);
    if (d === null) continue;
    out.set(n.id, down ? { x: n.x, y: n.y + d } : { x: n.x + d, y: n.y });
  }
  return out;
}

/**
 * The layout declarations for one hook, as tokens: `--<hook>-order: 2;
 * order: var(--<hook>-order)`, so a site's builder can read and change the
 * number like any other token.
 */
export function layoutDeclarations(hook: string, place: { order?: number } | null | undefined): string[] {
  if (!place || typeof place.order !== "number") return [];
  const name = `--${hook}-order`;
  return [`${name}: ${place.order}`, `order: var(${name})`];
}
