/**
 * WHAT A PART IS, AS A HOOK NAME, where the Builder recognised it as a thing
 * every site has (`components.ts`): a loading bar's track is `loading-bar`,
 * the level bar inside it `loading-bar-level` (J, 2026-10-11: sunkcoin's
 * ranked-list bars "should have been recognised as loading bars ... an
 * element that will likely have that data hook"). Export for code
 * (`kitExport.ts#nameFor`) hooks a part the site gave no hook by this.
 *
 * Pure. `tests/loading-bars.mjs`.
 */
import { componentsOf, type CompNode } from "./components.ts";

export function partRoles(nodes: readonly CompNode[], palette?: Record<string, string | undefined> | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of componentsOf(nodes, palette).list) {
    if (c.kind !== "progress") continue;
    out.set(c.id, "loading-bar");
    for (const l of c.layers) if (l.role === "fill") out.set(l.id, "loading-bar-level");
  }
  return out;
}
