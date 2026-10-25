"use client";
/**
 * MAKE A DRAFT: J's idea, planned by Claude, laid out in the house style, on
 * the new site.
 *
 *   1. the plan: one call to `/api/studio/draft` (the key in Keys, else the
 *      server's). With no key, or when the call fails, the plain plan
 *      (`plan.ts#plainPlan`), and the reason is said;
 *   2. the style: the house style, else the site's System, else one rolled
 *      on the idea's words and kept in the library (`houseStyle.ts`);
 *   3. the board: the plan laid out with every part linked to that style's
 *      tokens (`planToBoard.ts`), loaded as the site's document, the site
 *      pointed at the System, with nothing to undo back to, as a new site's
 *      sample page has nothing before it.
 *
 * A draft is an ordinary site: the System panel edits it, and the
 * variations lane's lock-and-randomize works on it as on any other.
 */
import { useStudio } from "../board/store";
import { useBuilds } from "@/features/builds/store";
import { keyHeader } from "../loop/run";
import { CALL_DEADLINE_MS, heldEffort } from "../effort";
import { claudeSpend, type Spend } from "../spend";
import { newSeed } from "../newSite";
import { formatOf } from "../starterPage";
import { themeColours } from "../siteTheme";
import { libraryList, useSystems } from "../system/store";
import { pointSiteAt, siteSystem } from "../system/api";
import { plainPlan, type Idea, type Plan } from "./plan";
import { pickStyle, type StyleFrom } from "./houseStyle";
import { planToBoard } from "./planToBoard";

export interface Made {
  plan: Plan;
  /** Which System it is drawn in, and where that came from. */
  style: { id: string; name: string; from: StyleFrom };
  /** Why the plan is the plain one, when it is. */
  plain: string | null;
  parts: number;
  spend: Spend | null;
}

type Answer = { ok: true; plan: Plan; usage?: { model?: string; input?: number; output?: number; cached?: number; written?: number } } | { ok: false; reason?: string; message?: string; usage?: { model?: string } };

async function askClaude(idea: Idea, name: string): Promise<{ answer: Answer; ms: number }> {
  const from = Date.now();
  try {
    const res = await fetch("/api/studio/draft", {
      method: "POST",
      signal: AbortSignal.timeout(CALL_DEADLINE_MS),
      headers: { "content-type": "application/json", ...keyHeader() },
      body: JSON.stringify({ idea, name, effort: heldEffort() }),
    });
    return { answer: (await res.json()) as Answer, ms: Date.now() - from };
  } catch (e) {
    return { answer: { ok: false, reason: "error", message: `The draft call did not come back (${e instanceof Error ? e.message : "unknown"}).` }, ms: Date.now() - from };
  }
}

/** Make the draft on the open site. */
export async function makeDraft(idea: Idea): Promise<Made> {
  const project = useBuilds.getState().projects.find((p) => p.id === useBuilds.getState().activeId) ?? null;
  const named = project && !/^Site \d+$/.test(project.name) ? project.name : "";
  const { answer, ms } = await askClaude(idea, named);
  const plan = answer.ok ? answer.plan : plainPlan(idea, named);
  const plain = answer.ok ? null : answer.message ?? "The draft call failed, so this is the plain draft.";

  const picked = pickStyle({ library: libraryList(), site: siteSystem(), words: idea.text, seed: newSeed(), name: `${plan.name} style` });
  if (!useSystems.getState().byId[picked.system.id]) useSystems.getState().put(picked.system);

  const st = useStudio.getState();
  const board = planToBoard(plan, picked.system, { pageId: st.activePageId, frameWidth: st.frameWidth });
  st.loadDoc({
    nodes: board.nodes,
    look: { palette: board.palette },
    ...(picked.theme ? { format: formatOf(picked.theme, themeColours(picked.theme)) } : {}),
    brief: { name: plan.name, description: plan.description },
  } as unknown as Parameters<typeof st.loadDoc>[0]);
  pointSiteAt(picked.system.id);
  useStudio.setState({ past: [], future: [] });
  if (project && !named) useBuilds.getState().rename(project.id, plan.name);
  return {
    plan,
    style: { id: picked.system.id, name: picked.system.name, from: picked.from },
    plain,
    parts: board.nodes.length,
    spend: answer.ok ? claudeSpend(answer.usage, ms) : null,
  };
}
