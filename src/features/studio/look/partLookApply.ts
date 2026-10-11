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
import { useStudio, type StudioNode } from "../board/store";
import { FACETS, lookOf, lookHas, lookPatch, lookDiffers, type Facet, type PartLook, type PasteOpts } from "./partLook";
import { sameKind } from "../partKind";

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
export function pasteLook(ids: readonly string[], look: PartLook, chosen: readonly Facet[], opts: PasteOpts = {}): number {
  const st = useStudio.getState();
  const byId = new Map(st.nodes.map((n) => [n.id, n]));
  const reach = ids.filter((id) => { const n = byId.get(id); return !!n && lookDiffers(n as never, look, chosen, opts).length > 0; });
  if (!reach.length) return 0;
  st.patchNodes(reach, (n) => lookPatch(n as never, look, chosen, opts));
  return reach.length;
}

/* ------------------------------------------------------------------ */
/* Make all like this                                                   */
/* ------------------------------------------------------------------ */

interface MakeAllPrefs {
  /** What Make all like this carries: every facet but motion, until a person chooses (a site where every button blinks is rarely meant). */
  chosen: Facet[];
  keepColour: boolean;
  toggle: (f: Facet) => void;
  setKeepColour: (on: boolean) => void;
}

export const useMakeAll = create<MakeAllPrefs>()(
  persist(
    (set) => ({
      chosen: FACETS.filter((f) => f !== "motion"),
      keepColour: false,
      toggle: (f) => set((s) => ({ chosen: s.chosen.includes(f) ? s.chosen.filter((x) => x !== f) : FACETS.filter((x) => x === f || s.chosen.includes(x)) })),
      setKeepColour: (keepColour) => set({ keepColour }),
    }),
    { name: "builder.makeAll", version: 1 },
  ),
);

/**
 * The facets Make all like this carries from `node`: the chosen ones its look
 * says something about. A facet the part has nothing of is left out, so it
 * never clears what the other parts wear there (a plain button carries
 * nothing, and wipes nobody's fill, corners or font). The panel and the
 * wheel's tray both go through here.
 */
export function makeAllFacets(node: StudioNode, chosen: readonly Facet[]): Facet[] {
  return lookHas(lookOf(node as never)).filter((f) => chosen.includes(f));
}

/** The parts Make all like this would change: every other part of `node`'s kind on the site that the look would change. */
export function makeAllReach(node: StudioNode, chosen: readonly Facet[], opts: PasteOpts = {}, nodes: readonly StudioNode[] = useStudio.getState().nodes): string[] {
  const look = lookOf(node as never);
  const on = makeAllFacets(node, chosen);
  if (!on.length) return [];
  return sameKind(nodes as never[], node as never).filter((m) => lookDiffers(m as never, look, on, opts).length > 0).map((m) => (m as StudioNode).id);
}

/** Restyle every part of `node`'s kind on the site to `node`'s look, as one undo step. Returns how many changed. */
export function makeAllLike(node: StudioNode, chosen: readonly Facet[], opts: PasteOpts = {}): number {
  const on = makeAllFacets(node, chosen);
  return on.length ? pasteLook(makeAllReach(node, on, opts), lookOf(node as never), on, opts) : 0;
}
