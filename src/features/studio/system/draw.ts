"use client";
/**
 * The one place a part's drawing asks the System: `Block` calls
 * `useResolved(node)` before anything else, so every surface that draws a
 * part (the board, the Preview, a site card, the published page as it is
 * written from the Preview) draws a token's value where the part points at
 * one. A part pointing at nothing is handed back as it came, at the cost of
 * one store read.
 *
 * A System changes rarely, and the answer is kept per part per System
 * version (`resolve.ts#resolveNode`), so this adds nothing to a drag.
 */
import { resolveNode, type SysNode } from "./resolve";
import { useSystems } from "./store";

export function useResolved<N extends SysNode>(n: N): N {
  const id = n.sys?.s;
  const s = useSystems((l) => (id ? l.byId[id] : undefined));
  return resolveNode(n, s);
}
