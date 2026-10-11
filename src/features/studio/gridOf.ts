/**
 * THE GRID A PART IS ONE CARD OF (J, 2026-10-11, on sunkcoin's eight rule
 * cards): "should be more of a grid ... all follow the same colour as a right
 * click setting, or I can unlock them and individually select."
 *
 * A grid is four parts or more on one page, the same kind of part, the same
 * size and the same fill, lying in two columns or more and two rows or more
 * (`themeKinds.ts#shapeOf`). The part menu locks them as one group, so a
 * press picks every card and one colour reaches them all; unlocking takes the
 * group off, and each card is picked on its own again.
 *
 * Pure: `tests/kind-shapes.mjs`.
 */
import { shapeOf } from "./themeKinds.ts";

interface Card {
  id: string;
  pageId?: string;
  featureId?: string;
  x?: number; y?: number; w?: number; h?: number;
  colour?: { bg?: string | null } | null;
  art?: { background?: string | null } | null;
  groupId?: string | null;
}

/** The name a locked grid's group carries, so the menu knows it for one. */
export const GRID_LABEL = "Grid";

const fillOf = (n: Card) => `${n.colour?.bg ?? ""}|${n.art?.background ?? ""}`;
const near = (a: number, b: number) => Math.abs(a - b) <= 0.1 * Math.max(a, b, 1);

/** Every card of the grid this part is in, itself first, in reading order; empty when it is in none. */
export function gridOf(nodes: readonly Card[], node: Card): string[] {
  const like = nodes.filter((n) => n.pageId === node.pageId && (n.featureId ?? "") === (node.featureId ?? "") && fillOf(n) === fillOf(node)
    && near(n.w ?? 0, node.w ?? 0) && near(n.h ?? 0, node.h ?? 0));
  if (like.length < 4 || shapeOf(like) !== "grid") return [];
  return [...like].sort((a, b) => (Math.abs((a.y ?? 0) - (b.y ?? 0)) > 8 ? (a.y ?? 0) - (b.y ?? 0) : (a.x ?? 0) - (b.x ?? 0))).map((n) => n.id);
}
