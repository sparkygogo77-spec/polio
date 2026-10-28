"use client";
/**
 * SEVERAL VERSIONS, IN THE BUILDER: asked for, picked from, built, worded.
 *
 *   askVersions   one call to `/api/studio/draft` with `versions: true` (the
 *                 key in Keys, else the server's), or the free local roll
 *                 (`versions.ts#localVersions`) when J chooses it, or when
 *                 there is no key or the call fails, saying why;
 *   styleFor      the house style, else the site's System, else one rolled on
 *                 the idea's words and kept in the library (`houseStyle.ts`);
 *   buildPicked   the pages J ticked, loaded as the site's document in ONE
 *                 undo step: one Ctrl+Z puts back what was there before;
 *   acceptOffer   one suggested line put in, as its own undo step, and only
 *                 where the part still says its stand-in.
 *
 * The result is an ordinary site: the System panel edits it, and Make
 * variations' lock-and-randomize works on it as on any other.
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
import type { System } from "../system/model";
import type { SiteTheme } from "../siteTheme";
import type { Idea } from "./plan";
import { pickStyle, type StyleFrom } from "./houseStyle";
import { buildSite, localVersions, type Picks, type Versions, type WordOffer } from "./versions";

export interface Asked {
  versions: Versions;
  /** Why these are the local versions, when Claude was asked and could not answer. */
  plain: string | null;
  spend: Spend | null;
}

const siteName = () => {
  const project = useBuilds.getState().projects.find((p) => p.id === useBuilds.getState().activeId) ?? null;
  return project && !/^Site \d+$/.test(project.name) ? project.name : "";
};

type Answer = { ok: true; versions: Versions; usage?: { model?: string; input?: number; output?: number; cached?: number; written?: number } } | { ok: false; reason?: string; message?: string };

/** The versions: Claude's (one call for all of them) or the free local ones. */
export async function askVersions(idea: Idea, o: { claude: boolean }): Promise<Asked> {
  const name = siteName();
  if (!o.claude) return { versions: localVersions(idea, { name, seed: newSeed() }), plain: null, spend: null };
  const from = Date.now();
  let answer: Answer;
  try {
    const res = await fetch("/api/studio/draft", {
      method: "POST",
      signal: AbortSignal.timeout(CALL_DEADLINE_MS),
      headers: { "content-type": "application/json", ...keyHeader() },
      body: JSON.stringify({ idea, name, versions: true, effort: heldEffort() }),
    });
    answer = (await res.json()) as Answer;
  } catch (e) {
    answer = { ok: false, reason: "error", message: `The call did not come back (${e instanceof Error ? e.message : "unknown"}).` };
  }
  if (answer.ok && answer.versions?.versions?.length) return { versions: answer.versions, plain: null, spend: claudeSpend(answer.usage, Date.now() - from) };
  const why = (!answer.ok && answer.message) || "Claude's answer had no versions.";
  return { versions: localVersions(idea, { name, seed: newSeed() }), plain: `${why} These are the free versions, made here from the catalogue.`, spend: null };
}

export interface Style { system: System; from: StyleFrom; theme: SiteTheme | null }

/** The System everything is drawn in, put in the library when it is new. */
export function styleFor(idea: Idea, name: string): Style {
  const picked = pickStyle({ library: libraryList(), site: siteSystem(), words: idea.text, seed: newSeed(), name: `${name} style` });
  return picked;
}

export interface Built { pages: number; parts: number; offers: WordOffer[]; style: { id: string; name: string; from: StyleFrom } }

/** The pages J ticked become the site: one undo step. */
export function buildPicked(v: Versions, picks: Picks, style: Style): Built {
  if (!useSystems.getState().byId[style.system.id]) useSystems.getState().put(style.system);
  const st = useStudio.getState();
  const site = buildSite(v, picks, style.system, { frameWidth: st.frameWidth });
  const before = st.past.length;
  st.loadDoc({
    pages: site.pages,
    nodes: site.nodes,
    look: { palette: site.palette },
    ...(style.theme ? { format: formatOf(style.theme, themeColours(style.theme)) } : {}),
    brief: { name: v.name, description: v.description },
  } as unknown as Parameters<typeof st.loadDoc>[0]);
  pointSiteAt(style.system.id);
  /* Pointing the site at its System is a step of its own; the load's step already holds the whole document before (its System too), so one undo takes back both. */
  const past = useStudio.getState().past;
  if (past.length > before + 1) useStudio.setState({ past: past.slice(0, before + 1) });
  const project = useBuilds.getState().projects.find((p) => p.id === useBuilds.getState().activeId) ?? null;
  if (project && /^Site \d+$/.test(project.name)) useBuilds.getState().rename(project.id, v.name);
  return { pages: site.pages.length, parts: site.nodes.length, offers: site.offers, style: { id: style.system.id, name: style.system.name, from: style.from } };
}

/** Whether a suggested line can still go in: its part is there and still says the stand-in. */
export function offerOpen(o: WordOffer): boolean {
  const n = useStudio.getState().nodes.find((x) => x.id === o.nodeId);
  return !!n && n.content === o.now;
}

/** One suggested line put in, as its own undo step. */
export function acceptOffer(o: WordOffer): boolean {
  if (!offerOpen(o)) return false;
  useStudio.getState().updateNode(o.nodeId, { content: o.to });
  return true;
}
