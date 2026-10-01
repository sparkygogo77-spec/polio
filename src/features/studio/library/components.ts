/**
 * SAVED COMPONENTS: a whole composite thing kept on the shelf, placed on any board.
 *
 * THE OWNER'S WORDS: a styled button and its options must be reusable
 * without rebuilding; the TV should be saved in a category, not only on its
 * site. So a part and everything it holds (the TV's case, its screen
 * picture with its filter, the scanlines over it, its knobs and the words
 * on it) is saved as one component: every part as it is, positions kept
 * relative to the component's corner, its features and their settings, the
 * keyframes its motion names and the fonts its words are set in. Placing
 * it on another board gives every part a fresh id and moves it to where it
 * goes, so it looks and behaves exactly as it did.
 *
 * What a component holds is the part and the parts inside it
 * (`partTree.ts`). Lane J is building component grouping (one button, one
 * component with its layers); when it lands, `members` is where its
 * grouping plugs in, and nothing else changes.
 *
 * Pure: no store, no React.
 */
import { partTree, type TreePart } from "../partTree.ts";

interface Frames { name: string; frames: { key: string; style: Record<string, string> }[] }
type Node = Record<string, unknown> & { id: string; x: number; y: number; w: number; h: number; pageId?: string };

export interface SavedComponent {
  id: string;
  name: string;
  /** The shelf category it is shown in ("media") and the word for what it is ("TV screen"). */
  category: string;
  kind: string;
  /** The site it was saved from, when it came from one. */
  site?: string | null;
  at: number;
  w: number;
  h: number;
  /** Every part, positioned from the component's top left; the first is the component itself. */
  nodes: Node[];
  frames: Frames[];
  fonts: { family: string; id?: string }[];
}

/** The part and everything it holds, in page order: the part tree's own reading, or a grouping handed in (Lane J). */
export function membersOf(nodes: readonly Node[], rootId: string, members?: readonly string[]): Node[] {
  const root = nodes.find((n) => n.id === rootId);
  if (!root) return [];
  if (members?.length) return [root, ...nodes.filter((n) => n.id !== rootId && members.includes(n.id))];
  const page = nodes.filter((n) => n.pageId === root.pageId);
  const tree = partTree(page as unknown as TreePart[]);
  const out: Node[] = [];
  const byId = new Map(page.map((n) => [n.id, n]));
  const walk = (id: string) => { const n = byId.get(id); if (!n) return; out.push(n); for (const k of tree.kids.get(id) ?? []) walk(k); };
  walk(rootId);
  /* Paint order is document order: kept, so what was on top stays on top. */
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  return [root, ...out.slice(1).sort((a, b) => order.get(a.id)! - order.get(b.id)!)];
}

/** Every keyframe name a part's motion or features name. */
function namesIn(n: Node): string[] {
  const m = n.motion as { animation?: { name?: string }[] } | null | undefined;
  return (m?.animation ?? []).map((a) => String(a.name ?? "").replace(/^cap-/, "")).filter(Boolean);
}

/** Save a part and what it holds as a component. */
export function componentOf(
  nodes: readonly Node[],
  rootId: string,
  opts: { name: string; category: string; kind: string; site?: string | null; keyframes?: readonly Frames[]; fonts?: readonly { family: string; id?: string }[]; members?: readonly string[]; at?: number; id?: string },
): SavedComponent | null {
  const parts = membersOf(nodes, rootId, opts.members);
  const root = parts[0];
  if (!root) return null;
  const names = new Set(parts.flatMap(namesIn));
  const frames = (opts.keyframes ?? []).filter((k) => names.has(k.name) || names.has(k.name.replace(/^cap-/, "")));
  const faces = new Set(parts.map((n) => (n.font as { face?: string } | null)?.face?.replace(/['"]/g, "")).filter(Boolean));
  const fonts = (opts.fonts ?? []).filter((f) => faces.has(f.family));
  const rel = parts.map((n) => ({ ...JSON.parse(JSON.stringify(n)), x: n.x - root.x, y: n.y - root.y }) as Node);
  return {
    id: opts.id ?? `comp_${Math.random().toString(36).slice(2, 10)}`,
    name: opts.name, category: opts.category, kind: opts.kind, site: opts.site ?? null,
    at: opts.at ?? Date.now(), w: root.w, h: root.h, nodes: rel, frames, fonts,
  };
}

/**
 * The component's parts for a board: fresh ids, at `x, y` on `pageId`, and
 * every reference inside it (a feature's settings naming a part, a link to
 * a part, the page path the capture read, which is how a holder knows what
 * it holds) moved to the new ids, so it holds and behaves as it did and
 * cannot be mistaken for any part already on the board.
 */
export function placeComponent(c: SavedComponent, at: { x: number; y: number }, pageId: string, newId: (old: string) => string): Node[] {
  const ids = new Map(c.nodes.map((n) => [n.id, newId(n.id)]));
  const tag = ids.get(c.nodes[0]!.id)!;
  const swap = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(/\bn_[a-z]+_\d+\b|\b[a-z]+_[a-z0-9]+\b/g, (m) => ids.get(m) ?? m);
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  return c.nodes.map((n) => {
    const from = n.from as { selector?: string } | null | undefined;
    const copy = { ...n } as Node;
    copy.id = ids.get(n.id)!;
    copy.pageId = pageId;
    copy.x = Math.round(at.x + n.x);
    copy.y = Math.round(at.y + n.y);
    if (copy.work) copy.work = swap(copy.work);
    const link = copy.link as { kind?: string; target?: string } | null | undefined;
    if (link?.kind === "node" && link.target && ids.has(link.target)) copy.link = { ...link, target: ids.get(link.target) };
    /* Its own page path, under the component's own root, so what held what still does, and nothing on the board shares it. */
    if (from?.selector) copy.from = { ...from, selector: `component-${tag} > ${from.selector}` };
    if (copy.groupId) copy.groupId = null;
    copy.locked = false;
    return copy;
  });
}
