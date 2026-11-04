/**
 * THE PART UNDER THE POINTER, AND WHAT HOLDS IT, OUTLINED.
 *
 * The design canvas's way (J, 2026-11-03): as the hand moves, the part under
 * it lights with a faint line and each part holding it with a fainter one,
 * up toward the page, so what is nested in what can be seen before a click.
 *
 * Nothing is stored and nothing is drawn again: each part already carries an
 * empty ring (`NodeView.tsx`, `[data-hover-mark]`), and this writes one
 * attribute, `data-hover-depth`, on the few parts in the chain (0 the part
 * under the hand, 1 its holder, …). globals.css lights the rings from it. The
 * chain is walked only when the part under the hand changes, and kept per
 * document, so a hand going back and forth over 800 parts reads each chain once.
 * `tests/builder-select.mjs`.
 */
import * as React from "react";
import { useStudio, type StudioNode } from "./store";
import { isWrapper } from "../owner";
import { holdersOf } from "./selectTools";

export const DEPTH = "data-hover-depth";

const partOf = (t: EventTarget | null) => (t instanceof Element ? (t.closest("[data-node-id]") as HTMLElement | null) : null);

/** The ids from the part under the hand up, kept per document (a new list after any edit). */
const chains = new WeakMap<readonly StudioNode[], Map<string, string[]>>();
function chainOf(nodes: readonly StudioNode[], id: string): string[] {
  let byId = chains.get(nodes);
  if (!byId) { byId = new Map(); chains.set(nodes, byId); }
  let chain = byId.get(id);
  if (!chain) {
    const part = nodes.find((n) => n.id === id);
    chain = !part || isWrapper(nodes, part) ? [] : [id, ...holdersOf(nodes, part).map((n) => n.id)];
    byId.set(id, chain);
  }
  return chain;
}

/** Keep `data-hover-depth` on the parts in the chain under the pointer. */
export function useHoverOutlines(board: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = board.current;
    if (!el) return;
    let lit: HTMLElement[] = [];
    let at = "";
    let under: HTMLElement | null = null;
    const clear = () => { for (const p of lit) p.removeAttribute(DEPTH); lit = []; at = ""; };
    const light = (part: HTMLElement | null) => {
      const id = part?.getAttribute("data-node-id") ?? "";
      if (id === at) return;
      clear();
      under = part;
      const s = useStudio.getState();
      if (!part || s.mode !== "design") return;
      at = id;
      const chain = chainOf(s.nodes, id);
      if (!chain.length) return;
      /* The parts are siblings on the board: one pass over them finds every holder that is drawn. */
      const want = new Map(chain.map((c, i) => [c, i]));
      for (const sib of part.parentElement?.children ?? []) {
        const d = want.get((sib as HTMLElement).dataset?.nodeId ?? "");
        if (d === undefined) continue;
        sib.setAttribute(DEPTH, String(Math.min(d, 3)));
        lit.push(sib as HTMLElement);
      }
    };
    const over = (e: PointerEvent) => light(partOf(e.target));
    const leave = () => { clear(); under = null; };
    el.addEventListener("pointerover", over);
    el.addEventListener("pointerleave", leave);
    /* An edit can change what holds what: the chain is read again for the part still under the hand. Not mid-drag, when it changes every frame and the lines are hidden. */
    const off = useStudio.subscribe((s, was) => {
      if (s.nodes === was.nodes && s.mode === was.mode) return;
      const keep = under;
      clear();
      if (keep?.isConnected && !el.hasAttribute("data-board-drag")) light(keep);
    });
    return () => {
      el.removeEventListener("pointerover", over);
      el.removeEventListener("pointerleave", leave);
      off();
      clear();
    };
  }, [board]);
}
