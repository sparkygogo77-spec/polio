/**
 * THE SHOW SWITCH: STATES ARE A PREVIEW, NOT A PLACE (J, 2026-10-08).
 *
 * "States does seem to be fixing priority because i have to go through too
 * many pages to simply reformat the structure of pst." So a page's states are
 * one switch at the top of the board, "Show: as it opens / lobby / queue /
 * match / result", and nothing is edited per screen unless he asks:
 *
 *   · a preview is a moment of the site's flow (`scenes.ts#momentOf`). The
 *     page states of one moment are one preview, each a chip inside it (the
 *     match starting and live; won and lost), so PonsStars' play page has six
 *     previews, not eight page states plus the Panels page;
 *   · what comes over the page and changes one part only (the tour, a pop-up,
 *     a banner: a folded scene whose panel no page state draws) is "on top":
 *     switched on over whichever preview is showing;
 *   · an edit made in a preview changes the part in every preview, as on the
 *     plain board; with "This state only" ticked, the panels on show wear this
 *     preview's state and an edit is kept as that state's look
 *     (`stateEdits.ts`), so only a panel that really differs per state (the
 *     TV box) carries per-state looks.
 *
 * Pure: `tests/show-switch.mjs`.
 */
import { momentOf } from "./scenes";
import { isPageState, readDeclared, stateIn, type RuleNode, type SceneScreen } from "./stateRules";
import { stateEditKey } from "./stateEdits";

export interface Preview {
  /** The moment's key ("lobby", "match"), or the scene's own name when it is none. */
  key: string;
  name: string;
  /** Its page states in the site's order: the first is what the switch shows, the others are chips. */
  scenes: SceneScreen[];
}
export interface OnTop {
  /** The folded scene it comes from. */
  scene: string;
  label: string;
  /** The panel that comes over the page and the state it comes in. */
  panel: string;
  state: string;
}

/** A label's words after its "Kind:" lead ("Pop-up: create a new wallet" is "create a new wallet"); an overlay keeps its lead when that is all it says. */
const after = (s: string) => s.replace(/^[^:]{1,40}:\s*/, "").trim() || s;

/**
 * A page's previews and what goes on top of them, from its declared scenes
 * (`stateRules.ts#sceneScreens`, folded or not), in the site's order.
 */
export function showPreviews(scenes: readonly SceneScreen[], nodes: readonly Pick<RuleNode, "hooks">[] = []): { previews: Preview[]; onTop: OnTop[] } {
  const pages = scenes.filter(isPageState);
  const previews: Preview[] = [];
  for (const sc of pages) {
    const m = momentOf(`${sc.name} ${sc.label ?? ""}`);
    const key = m?.key ?? sc.name;
    const known = previews.find((p) => p.key === key);
    if (known) known.scenes.push(sc);
    else previews.push({ key, name: m?.name ?? (after(sc.label ?? "") || sc.name), scenes: [sc] });
  }
  /* On top: a scene folded into one panel that no page state draws (it is off, or absent, in every one). */
  const drawn = (panel: string) => pages.some((p) => { const st = p.panels[panel]; return st !== undefined && st !== "off"; });
  const onTop: OnTop[] = [];
  for (const sc of scenes) {
    if (!sc.part || drawn(sc.part) || onTop.some((t) => t.panel === sc.part)) continue;
    const state = sc.panels[sc.part];
    if (!state || state === "off") continue;
    /* Named by the panel's own label (rule 21), else by its scene's lead ("Intro tour: one step" is "Intro tour"). */
    const own = nodes.find((n) => n.hooks?.["data-panel"] === sc.part && n.hooks?.["data-label"])?.hooks?.["data-label"];
    onTop.push({ scene: sc.name, label: own ?? ((sc.label ?? "").split(/[:(,]/)[0]!.trim() || sc.part), panel: sc.part, state });
  }
  return { previews, onTop };
}

/**
 * The parts that wear one state's look in a scene, by edit key: each part goes
 * with the innermost panel round it (the duel circles with the duel, not the
 * TV), and only panels with more than one state are listed (one state has
 * nothing to differ by).
 */
export function stateLooksIn(nodes: readonly RuleNode[], pageId: string, scene: Pick<SceneScreen, "panels">): { key: string; ids: string[] }[] {
  const d = readDeclared(nodes);
  const byKey = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.pageId !== pageId) continue;
    const own = n.hooks?.["data-panel"];
    const panel = own && d.panels.has(own) ? own : (d.up.get(n.id) ?? []).map((a) => a.hooks?.["data-panel"]).find((p): p is string => !!p && d.panels.has(p));
    const p = panel ? d.panels.get(panel) : undefined;
    if (!p || p.states.length < 2) continue;
    const state = stateIn(p, scene);
    if (state === "off") continue;
    const key = stateEditKey(p.id, state);
    byKey.set(key, [...(byKey.get(key) ?? []), n.id]);
  }
  return [...byKey].map(([key, ids]) => ({ key, ids }));
}
