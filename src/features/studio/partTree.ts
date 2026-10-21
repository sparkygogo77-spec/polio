/**
 * THE PAGE'S PARTS AS A TREE, IN THE ORDER THEY COME ON THE PAGE.
 *
 * The Element tab listed a page's parts flat and in the order they were
 * made, so on trumpmorty.fun the second section ("THE LORE") came last. A
 * person reads a page top to bottom and a section as the things inside it,
 * so the list is a tree: each part under the part that holds it, and each
 * level in the order the page's own code has it (J, 2026-10-21: "in order
 * by order of what contains what"). A captured page is read in document
 * order, so a captured part's place in the list is its place in the page;
 * a part placed by hand has none and goes in by where it sits, top to
 * bottom, then left to right.
 *
 * What holds what is read the way the rest of the Builder reads it
 * (`owner.ts`): the page path the capture recorded, else the box. A part
 * with a path is put under the nearest part whose path it continues; a part
 * with none, or whose path has no part above it, under the smallest part
 * that wholly holds its box.
 *
 * Pure: no store, no DOM. `tests/side-panel-g.mjs` runs it on sink's capture.
 */

export interface TreePart {
  id: string;
  pageId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  from?: { selector?: string | null } | null;
}

export interface PartTree {
  roots: string[];
  kids: Map<string, string[]>;
  parent: Map<string, string | null>;
}

const area = (n: TreePart) => Math.max(0, n.w) * Math.max(0, n.h);
/** The recorded path, with a pseudo-element folded into its element: `a::before` is under `a`. */
const pathOf = (n: TreePart) => (n.from?.selector ?? "").trim().replace(/\s*>\s*/g, " > ");
const boxHolds = (o: TreePart, i: TreePart) => {
  const slack = 1;
  return o.id !== i.id && i.x >= o.x - slack && i.y >= o.y - slack && i.x + i.w <= o.x + o.w + slack && i.y + i.h <= o.y + o.h + slack && area(i) < area(o);
};

/** The path one step up: "a > b > c" is "a > b"; "a > b::after" is "a > b". */
function up(path: string): string | null {
  const pseudo = /::?(before|after)$/.exec(path);
  if (pseudo) return path.slice(0, pseudo.index);
  const i = path.lastIndexOf(" > ");
  return i < 0 ? null : path.slice(0, i);
}

/** Top to bottom, then left to right. */
const byPlace = (all: Map<string, TreePart>) => (a: string, b: string) => {
  const p = all.get(a)!, q = all.get(b)!;
  return p.y - q.y || p.x - q.x || area(q) - area(p);
};

/**
 * One level in page order: the captured parts as the capture met them (the
 * document's order, which a sticky header or a grid reordered by CSS does not
 * change), and the hand-placed ones merged in by place.
 */
function inPageOrder(ids: string[], all: Map<string, TreePart>, at: Map<string, number>): string[] {
  const place = byPlace(all);
  const caught = ids.filter((id) => pathOf(all.get(id)!)).sort((a, b) => at.get(a)! - at.get(b)!);
  const placed = ids.filter((id) => !pathOf(all.get(id)!)).sort(place);
  if (!placed.length) return caught;
  if (!caught.length) return placed;
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < caught.length || j < placed.length) {
    if (j >= placed.length || (i < caught.length && place(caught[i]!, placed[j]!) <= 0)) out.push(caught[i++]!);
    else out.push(placed[j++]!);
  }
  return out;
}

export function partTree(nodes: readonly TreePart[]): PartTree {
  const all = new Map(nodes.map((n) => [n.id, n]));
  const bySel = new Map<string, string>();
  for (const n of nodes) {
    const p = pathOf(n);
    if (p && !bySel.has(`${n.pageId ?? ""}|${p}`)) bySel.set(`${n.pageId ?? ""}|${p}`, n.id);
  }
  const parent = new Map<string, string | null>();
  const pathless = nodes.filter((n) => !pathOf(n));
  for (const n of nodes) {
    let found: string | null = null;
    const p = pathOf(n);
    if (p) {
      for (let at = up(p); at && !found; at = up(at)) {
        const hit = bySel.get(`${n.pageId ?? ""}|${at}`);
        if (hit && hit !== n.id) found = hit;
      }
    }
    if (!found) {
      /* By the box: among parts with no path of their own when this one has a path, so the two readings never disagree. */
      let best: TreePart | null = null;
      for (const c of p ? pathless : nodes) if (c.pageId === n.pageId && boxHolds(c, n) && (!best || area(c) < area(best))) best = c;
      found = best?.id ?? null;
    }
    parent.set(n.id, found);
  }
  /* A loop (a child whose box overflows the part its path is under) is cut where it closes. */
  for (const n of nodes) {
    const seen = new Set([n.id]);
    for (let at = parent.get(n.id); at; at = parent.get(at) ?? null) {
      if (seen.has(at)) { parent.set(n.id, null); break; }
      seen.add(at);
    }
  }
  const kids = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    const p = parent.get(n.id);
    if (p) kids.set(p, [...(kids.get(p) ?? []), n.id]);
    else roots.push(n.id);
  }
  const at = new Map(nodes.map((n, i) => [n.id, i]));
  for (const [id, list] of kids) kids.set(id, inPageOrder(list, all, at));
  return { roots: inPageOrder(roots, all, at), kids, parent };
}

/** The part's holders, outermost first, not including itself. */
export function ancestors(tree: PartTree, id: string): string[] {
  const out: string[] = [];
  for (let at = tree.parent.get(id) ?? null; at; at = tree.parent.get(at) ?? null) out.unshift(at);
  return out;
}

/**
 * One row of the tree as shown. `ends` is how many of the open holders
 * around it close after it: the innermost `ends` of its `depth` holders,
 * so the panel can draw each open holder as a box round what it holds.
 */
export interface TreeRow { id: string; depth: number; kids: number; ends: number }

/** The rows shown: every root, and the parts inside each open one, in page order. */
export function visibleRows(tree: PartTree, open: ReadonlySet<string>): TreeRow[] {
  const out: TreeRow[] = [];
  const walk = (ids: readonly string[], depth: number) => {
    for (const id of ids) {
      const k = tree.kids.get(id) ?? [];
      out.push({ id, depth, kids: k.length, ends: 0 });
      if (k.length && open.has(id)) walk(k, depth + 1);
    }
  };
  walk(tree.roots, 0);
  for (let i = 0; i < out.length; i++) out[i]!.ends = Math.max(0, out[i]!.depth - (out[i + 1]?.depth ?? 0));
  return out;
}

/** Every part in page order, depth first: what the tree reads as when all of it is open. */
export function pageOrder(tree: PartTree): string[] {
  const out: string[] = [];
  const walk = (ids: readonly string[]) => { for (const id of ids) { out.push(id); walk(tree.kids.get(id) ?? []); } };
  walk(tree.roots);
  return out;
}
