/**
 * The hand that holds a copied look, and pasting it as one undo step.
 *
 * Copy look on the wheel's tray or in the part panel puts a part's look here
 * (`partLook.ts`); Paste look puts the chosen facets of it on the part, or on
 * every picked part when the part is one of them, in one step the undo key
 * names ("restyle 4 parts"). Kept in this browser across boards, so a look
 * copied on one site can be pasted on another.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStudio, type StudioNode } from "./store";
import { FACETS, lookPatch, lookDiffers, type Facet, type PartLook } from "./partLook";

interface LookClip {
  look: PartLook | null;
  /** The facets Paste puts down; all of them until a person switches some off. */
  chosen: Facet[];
  copy: (look: PartLook) => void;
  toggle: (f: Facet) => void;
  clear: () => void;
}

export const useLookClip = create<LookClip>()(
  persist(
    (set) => ({
      look: null,
      chosen: [...FACETS],
      copy: (look) => set({ look }),
      toggle: (f) => set((s) => ({ chosen: s.chosen.includes(f) ? s.chosen.filter((x) => x !== f) : FACETS.filter((x) => x === f || s.chosen.includes(x)) })),
      clear: () => set({ look: null }),
    }),
    { name: "builder.lookClip", version: 1 },
  ),
);

/** The parts a paste on `node` reaches: every picked part when it is one of them, else it alone. The look's own part is never pasted on. */
export function pasteTargets(node: StudioNode, look: PartLook | null = useLookClip.getState().look): string[] {
  const sel = useStudio.getState().selection;
  const ids = sel.length > 1 && sel.includes(node.id) ? sel : [node.id];
  return ids.filter((id) => id !== look?.from.id);
}

/**
 * Put `chosen` facets of `look` on the parts `ids`, as one undo step. Returns
 * how many parts it changed: a part already wearing all of it is left out of
 * the step.
 */
export function pasteLook(ids: readonly string[], look: PartLook, chosen: readonly Facet[]): number {
  const st = useStudio.getState();
  const byId = new Map(st.nodes.map((n) => [n.id, n]));
  const reach = ids.filter((id) => { const n = byId.get(id); return !!n && lookDiffers(n as never, look, chosen).length > 0; });
  if (!reach.length) return 0;
  st.patchNodes(reach, (n) => lookPatch(n as never, look, chosen));
  return reach.length;
}
