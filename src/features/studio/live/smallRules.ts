/**
 * What the tablet and phone plan asks of a part (`small.ts`), answered the
 * way the rest of the Builder answers it: a control is `control.ts`'s, what
 * holds what is `owner.ts`'s, words are the part's own.
 */
import type { StudioNode } from "../board/store";
import { isControl } from "../control";
import { holds } from "../owner";
import { plain } from "../parts/spans";
import { carryOwned, type CarryNode } from "../carry";
import { smallPlan, smallTree, type SmallDevice, type SmallPlan, type SmallRules } from "./small";

const words = (n: StudioNode) => plain(n.content).trim();

export const SMALL_RULES: SmallRules<StudioNode> = {
  isControl: (n) => isControl(n),
  isLink: (n) => !!n.link || /^\s*link\b/i.test(n.data ?? ""),
  hasWords: (n) => !!words(n),
  /* Big words: a heading's own part, or a size the capture measured at 28px or more. */
  isHeading: (n) => {
    const w = words(n);
    if (!w) return false;
    if (n.featureId === "heading" || n.featureId === "hero" || /^\s*heading\b/i.test(n.data ?? "")) return true;
    const size = typeof n.font?.size === "number" ? n.font.size : 0;
    return size >= 28;
  },
  holds: (a, b) => holds(a, b),
};

/**
 * The blocks a captured page moves as one on the desktop: a box a hover or a
 * tilt moves carries what it holds inside it (`carry.ts`), and a row turned
 * as a whole turns its words with it (`art.turnsWith`). The published page
 * draws those inside the block, so at every width the block is kept whole.
 */
export function wholeBlocks(nodes: readonly StudioNode[]): Set<string> {
  const out = new Set<string>();
  if (!nodes.some((n) => n.from?.selector?.trim())) return out;
  for (const id of carryOwned(nodes as unknown as CarryNode[]).keys()) out.add(id);
  const bySelector = new Map(nodes.filter((n) => n.from?.selector).map((n) => [n.from!.selector!.trim(), n.id]));
  for (const n of nodes) {
    const tw = (n as { art?: { turnsWith?: { selector?: string } | null } | null }).art?.turnsWith?.selector?.trim();
    const h = tw ? bySelector.get(tw) : undefined;
    if (h) out.add(h);
  }
  return out;
}

export function planFor(nodes: StudioNode[], device: SmallDevice, frameWidth: number): SmallPlan<StudioNode> {
  const whole = wholeBlocks(nodes);
  return smallPlan(nodes, device, frameWidth, whole.size ? { ...SMALL_RULES, keepWhole: (n) => whole.has(n.id) } : SMALL_RULES);
}

/** What holds what on a page, as the plan reads it: the shape the page is drawn in at every width. */
export function treeFor(nodes: StudioNode[]): { parent: Map<string, string>; kids: Map<string, StudioNode[]>; roots: StudioNode[] } {
  const { kids, roots } = smallTree(nodes, SMALL_RULES);
  const parent = new Map<string, string>();
  for (const [p, ks] of kids) for (const k of ks) parent.set(k.id, p);
  return { parent, kids, roots };
}
