/**
 * A SECTION MOVED UP OR DOWN THE PAGE, PAST THE ONE BESIDE IT.
 *
 * J's list for a brought-in site (2026-10-21): a person reorders its sections
 * by hand. A captured page is placed part by part, not flowed, so dragging a
 * section over its neighbour only laid one over the other; and the outline
 * that reorders a kit's regions (`states/StructureView.tsx`) lists hooked
 * parts only, which no capture has. So a picked part trades places with the
 * part beside it in the same holder and the same column (Alt+↑ / Alt+↓ on
 * the board): the one moved takes the other's top, the other follows it at
 * the same gap, and everything each holds goes with it. The two end where the
 * pair ended, so nothing else on the page moves.
 *
 * Pure: the moves, by id, or null when there is nothing to trade places with.
 */
import { parentOf, ridersOf } from "../owner";
import type { StudioNode } from "./store";

type Part = Pick<StudioNode, "id" | "pageId" | "x" | "y" | "w" | "h" | "featureId" | "link" | "data" | "content"> & {
  from?: { selector?: string; position?: string } | null;
  locked?: boolean;
  state?: unknown;
};

const out = (n: Part) => n.from?.position === "absolute" || n.from?.position === "fixed" || n.from?.position === "sticky";

export function swapInFlow<N extends Part>(nodes: readonly N[], id: string, dir: -1 | 1, palette?: Record<string, string | undefined> | null): Map<string, number> | null {
  const me = nodes.find((n) => n.id === id);
  if (!me || me.state || out(me)) return null;
  const page = nodes.filter((n) => n.pageId === me.pageId && !n.state);
  const holder = parentOf(page, me)?.id ?? null;
  const across = (a: Part, b: Part) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > Math.min(a.w, b.w) / 2;
  const sibs = page.filter((n) => n.id !== me.id && !out(n) && (parentOf(page, n)?.id ?? null) === holder && across(n, me));
  const other = dir < 0
    ? sibs.filter((n) => n.y + n.h <= me.y + 2).sort((a, b) => b.y + b.h - (a.y + a.h))[0]
    : sibs.filter((n) => n.y >= me.y + me.h - 2).sort((a, b) => a.y - b.y)[0];
  if (!other) return null;
  const [upper, lower] = dir < 0 ? [other, me] : [me, other];
  const gap = lower.y - (upper.y + upper.h);
  /* The lower takes the upper's top; the upper follows at the same gap, ending where the lower ended. */
  const dLower = upper.y - lower.y;
  const dUpper = lower.h + gap;
  const group = (n: N) => [n.id, ...ridersOf(page, [n.id], palette)];
  const moves = new Map<string, number>();
  for (const k of group(upper)) moves.set(k, dUpper);
  for (const k of group(lower)) if (!moves.has(k)) moves.set(k, dLower);
  for (const k of [...moves.keys()]) if (page.find((n) => n.id === k)?.locked) moves.delete(k);
  return moves;
}
