/**
 * A PAGE'S PANELS, FROM THE STORE'S PARTS AND ITS SOURCE (React-free).
 *
 * The same reading for the Panels rail (`PanelsPage.tsx`) and the board's
 * isolated panel (`canvas/helpers.ts`): a site that follows the state rules
 * has its panels and states declared (`stateRules.ts`); any other keeps the
 * captured reading (`panels.ts`), with notes on why.
 */
import type { ScreenRead } from "./boardStates";
import { pagePanels, type Panel, type PanelNode } from "./panels";
import { declaredPagePanels, followsStateRules, stateRuleNotes, type DeclaredScene, type Samples, type SceneScreen } from "./stateRules";

export type PanelSource = { files?: { file: string; pageId: string }[]; screens?: ScreenRead[]; scenes?: DeclaredScene[] | null; samples?: Samples | null } | undefined;

export function panelsOfPage(nodes: readonly PanelNode[], source: PanelSource, pageId: string): { panels: Panel[]; screens: ScreenRead[]; declared: boolean; notes: string[]; file: string | null } {
  const file = source?.files?.find((f) => f.pageId === pageId)?.file ?? null;
  const screens = (source?.screens ?? []).filter((x) => !file || !x.page || x.page === file);
  const declared = followsStateRules(nodes, pageId);
  const notes = source?.files?.length ? stateRuleNotes(nodes, pageId, source.scenes ?? null, file) : [];
  const panels = declared
    ? declaredPagePanels(nodes, pageId, file, screens.filter((x) => (x as SceneScreen).declared) as SceneScreen[], source?.samples ?? null)
    : pagePanels(nodes, pageId, screens);
  return { panels, screens, declared, notes, file };
}

/** The key that isolates one panel on the board, in one state and sample: `isolate:<part id>|<state>|<sample>`. */
export const ISOLATE = "isolate:";
export const isolateKey = (panelId: string, state: string, sample: string) => `${ISOLATE}${panelId}|${state}|${sample}`;
export function readIsolateKey(k: string): { panelId: string; state: string; sample: string } | null {
  if (!k.startsWith(ISOLATE)) return null;
  const [panelId, state, sample] = k.slice(ISOLATE.length).split("|");
  return panelId ? { panelId, state: state ?? "", sample: sample ?? "" } : null;
}
