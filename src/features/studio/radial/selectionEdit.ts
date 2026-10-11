/**
 * AN EDIT ON THE WHEEL IS AN EDIT TO THE SELECTION. Opened on one of several
 * picked parts, the wheel changes all of them — but only what was changed:
 * painting the words white on one card leaves the other cards' fills, borders
 * and faces as they are. Colour, edge, font and options are merged key by
 * key; any other field is set as it is. One undo for the lot.
 *
 * Options are the part's own settings, so an option goes only to a picked
 * part that has it (its kind offers it, or it already carries it): a
 * ticker's speed never lands on a slideshow, and the slideshow keeps its
 * autoplay. The words a part says (name, prompt, contents, data) are not
 * sent here at all: they stay on the one part (`PlateEditors.tsx`).
 */
import { getFeature } from "../shelf";
import { useStudio, type StudioNode } from "../board/store";

export const MERGED = new Set(["colour", "edge", "font", "options"]);

type Diff = { set: Record<string, unknown>; drop: string[] } | { whole: unknown };
type Bag = Record<string, unknown>;
const field = (n: StudioNode, k: string) => ((n as unknown as Record<string, Bag | null>)[k] ?? {}) as Bag;

/** The parts an edit on `node` reaches: the picked set when it is in one, else just it. */
export function selectionFor(node: StudioNode, selection: string[]): string[] {
  return selection.length > 1 && selection.includes(node.id) ? selection : [node.id];
}

/** Does part `n` take option `id`? Its kind offers it, or it carries it already. */
export function takesOption(n: StudioNode, id: string): boolean {
  return id in (n.options ?? {}) || !!getFeature(n.featureId)?.options?.some((o) => o.id === id);
}

/**
 * What `patch`, made on `node`, does to any other picked part: the merged
 * fields carry only the keys that changed (or were taken away), every other
 * field goes as it is. Pure, so the checks can hold it without a page.
 */
export function spreadEdit(node: StudioNode, patch: Partial<StudioNode>, takes: (n: StudioNode, id: string) => boolean = takesOption): (n: StudioNode) => Partial<StudioNode> {
  const diff: Record<string, Diff> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!MERGED.has(k)) { diff[k] = { whole: v }; continue; }
    const was = field(node, k);
    const now = (v ?? {}) as Bag;
    const set: Bag = {};
    for (const [kk, vv] of Object.entries(now)) if (JSON.stringify(was[kk]) !== JSON.stringify(vv)) set[kk] = vv;
    diff[k] = { set, drop: Object.keys(was).filter((kk) => !(kk in now)) };
  }
  return (n) => Object.fromEntries(Object.entries(diff).map(([k, d]) => {
    if ("whole" in d) return [k, d.whole];
    const mine = (kk: string) => k !== "options" || n.id === node.id || takes(n, kk);
    const own: Bag = { ...field(n, k) };
    for (const [kk, vv] of Object.entries(d.set)) if (mine(kk)) own[kk] = vv;
    for (const kk of d.drop) if (mine(kk)) delete own[kk];
    // A part's options are always a bag, even an empty one; the looks go back to none.
    return [k, k === "options" || Object.keys(own).length ? own : null];
  })) as Partial<StudioNode>;
}

export function applyToSelection(node: StudioNode, patch: Partial<StudioNode>) {
  const st = useStudio.getState();
  const ids = selectionFor(node, st.selection);
  if (ids.length === 1) return st.updateNode(node.id, patch);
  st.patchNodes(ids, spreadEdit(node, patch));
}
