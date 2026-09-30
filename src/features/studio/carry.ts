/**
 * Which parts a box carries, and which parts can be pressed: read off the
 * capture, the same on every surface. Pure: no store, no React, so the
 * export and `tests/ca-bar-seams.mjs` run it as written.
 */
import { inside, movesItself, underPath, type MotionNode } from "./parts/capturedMotion";
import { onUsesOf, type WorkUse } from "./library/works";

/** A part, as far as these read it. */
export interface CarryNode extends MotionNode { featureId?: string; data?: unknown; work?: WorkUse | null; motion?: MotionNode["motion"]; state?: { group?: string; option?: number } | null }

/**
 * WHAT MOVES UNDER THE POINTER CARRIES WHAT IS ON IT. On the page a remote
 * key's gloss strip (`a::before`), its number and its icon were inside the
 * key, and a how-to-buy card's icon, words and red badge inside the card:
 * the key rose and sank, the card tilted, and all of it went along. Here
 * they are parts of their own, and each followed by a rule of its own, on
 * its own clock, or not at all: the gloss stayed put when the key rose, and
 * the card jumped while its words eased after it. So a captured box that a
 * hover, a press or a focus moves (`movesItself`), or that tilts under the
 * pointer, takes every part it owns (by element path, `underPath`) inside
 * its own box on the published page, and one transform moves them as one.
 * A part owned by two such boxes goes in the nearer. `tests/ca-bar-seams.mjs`.
 */
export function carryOwned(nodes: readonly CarryNode[]): Map<string, string[]> {
  const tilts = (n: CarryNode) => onUsesOf(n.work).some((u) => u.id === "tilt" && u.inputs?.mode !== "scroll");
  const hosts = nodes.filter((n) => n.from?.selector?.trim() && (movesItself(n) || tilts(n)));
  const out = new Map<string, string[]>();
  for (const kid of nodes) {
    const sel = kid.from?.selector?.trim() ?? "";
    /*
     * Only a box of the same state: a press's parts (trumpmorty's "COPIED!")
     * sit at the element paths of the parts they stand in for, and carried
     * into the bar the press hides they were hidden with it.
     */
    const same = (h: CarryNode) => (h.state?.group ?? null) === (kid.state?.group ?? null) && (h.state?.option ?? null) === (kid.state?.option ?? null);
    const owner = hosts
      .filter((h) => h.pageId === kid.pageId && same(h) && underPath(h.from!.selector!.trim(), sel))
      .sort((a, b) => b.from!.selector!.length - a.from!.selector!.length)[0];
    if (owner) out.set(owner.id, [...(out.get(owner.id) ?? []), kid.id]);
  }
  return out;
}

/**
 * CAN IT BE PRESSED? A link, a button (the capture's role for it: "button,
 * named …", "link, named …"), a captured call to action, or a part the page
 * gave a pressed look. Its whole box shows the pointing hand, not only its
 * words, and so does every part the page drew inside it, as on the page: the
 * remote's keys, the COPY CA bar, the nav's links (`tests/ca-bar-seams.mjs`).
 */
export function pressable(n: CarryNode): boolean {
  return !!n.link || /^cta-/.test(n.featureId ?? "") || /^(button|link)\b/.test(String(n.data ?? "")) || !!n.motion?.active?.length;
}


/** The parts that show the pointing hand on a page: every pressable part, and every part inside one. */
export function pointing(nodes: readonly CarryNode[]): Set<string> {
  const out = new Set<string>();
  for (const n of nodes.filter(pressable)) { out.add(n.id); for (const k of inside(n, nodes)) out.add(k.id); }
  return out;
}
