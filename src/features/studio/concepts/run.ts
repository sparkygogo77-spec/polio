"use client";
/**
 * MAKING, RE-ROLLING, MIXING AND PROMOTING CONCEPTS, in this browser.
 *
 *   makeConcepts   one prompt → one call to idea-versions (Claude, or the
 *                  free local roll) → every version drawn as a WHOLE page of
 *                  real parts (`buildSite`, words in) in a System of its own,
 *                  and written as a site of its own in Builds. No board is
 *                  touched: each concept lands in its own slot, so the site
 *                  that was open stays as it was.
 *   again          one concept rolled again on the same prompt; the others
 *                  stay. Written over the same site. When that concept is the
 *                  open board it is loaded as ONE undo step.
 *   take / untake  a section of a concept into the group's Mix: the Mix is a
 *                  site of its own, rebuilt from its takes each time
 *                  (`model.ts#mixNodes`).
 *   promote        a concept (or the Mix) becomes an ordinary site: its
 *                  concept record goes, and it opens in the Builder.
 *   discard        the site and its record go.
 *
 * Each concept's System goes into the shared library, so the System panel
 * edits a concept like any other site, and Make variations works on one.
 */
import { useBuilds, type Project } from "@/features/builds/store";
import { useStudio } from "../board/store";
import type { Doc } from "../board/store/model";
import { readDoc, unpackDocText, writeDocNow } from "../docStore";
import { formatOf } from "../starterPage";
import { themeColours } from "../siteTheme";
import { useSystems } from "../system/store";
import type { System } from "../system/model";
import type { Idea } from "../idea/plan";
import { askVersions, styleFor, type Asked, type Style } from "../idea/versionsRun";
import { buildSite, wholeVersion, type Versions } from "../idea/versions";
import { rolesOf } from "../system/resolve";
import { conceptName, mixName, mixNodes, withTake, withoutTake, type Concept, type Group, type PartLike, type Take } from "./model";
import { useConcepts } from "./store";

const LIVE = "builder.studio";
const slot = (id: string) => `builder.doc:${id}`;
const FRAME = 1440;

type Envelope = { state: Record<string, unknown> & { nodes?: PartLike[]; pages?: { id: string }[]; systemId?: string | null; system?: System | null; format?: unknown; frameWidth?: number }; version?: number };

/** A site's stored document, the open one read from the live key. */
export async function readEnvelope(id: string): Promise<Envelope | null> {
  const active = useBuilds.getState().activeId === id;
  const raw = await readDoc(active ? LIVE : slot(id));
  if (!raw) return null;
  try {
    const env = JSON.parse(unpackDocText(raw)) as Envelope;
    return env?.state && Array.isArray(env.state.nodes) ? env : null;
  } catch {
    return null;
  }
}

const uid = () => `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * The idea idea-versions is asked. "three concepts for a lantern shop landing
 * page" is about a lantern shop landing page: the asking words come off, so
 * the first screen's heading is the subject and not the request.
 */
export function ideaOf(prompt: string): Idea {
  const subject = siteNameOf(prompt, "");
  const text = /[.!?]$/.test(subject) ? subject : `${subject}.`;
  return { text, sections: [], ref: null };
}

/** The site's name out of the prompt when the versions gave none: "three concepts for a lantern shop landing page" → "Lantern shop landing page". */
export function siteNameOf(prompt: string, given: string): string {
  if (given && given !== "New site") return given;
  const words = prompt.trim().replace(/^(make|give me|i want|draft)\s+/i, "").replace(/^(three|four|3|4|some|a few)?\s*(concepts?|options?|versions?|ideas?|directions?)\s+(for|of)\s+(a|an|the)?\s*/i, "").replace(/[.!?]+$/, "").trim();
  const name = (words || prompt.trim()).slice(0, 48);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** One version drawn as a whole site document, in this System. */
function conceptDoc(v: Versions, i: number, style: Style, name: string): Record<string, unknown> {
  const site = buildSite(v, wholeVersion(v, i), style.system, { frameWidth: FRAME, words: "fill" });
  return {
    pages: site.pages,
    nodes: site.nodes,
    groups: [],
    look: { palette: site.palette },
    ...(style.theme ? { format: formatOf(style.theme, themeColours(style.theme)) } : {}),
    brief: { name, description: v.versions[i]?.pitch ?? v.description },
    systemId: style.system.id,
    system: style.system,
    activePageId: site.pages[0]?.id,
    frameWidth: FRAME,
  };
}

/** Write a document as a new site, or over `into`. The site's id. */
async function writeSite(doc: Record<string, unknown>, name: string, into: string | null): Promise<string> {
  const raw = JSON.stringify({ state: doc, version: 0 });
  if (into) {
    const active = useBuilds.getState().activeId === into;
    if (active) {
      /* The open board: loaded as one undo step, and saved to its slot by the store as any edit is. */
      useStudio.getState().loadDoc(doc as unknown as Partial<Doc>);
    } else {
      await writeDocNow(slot(into), raw);
    }
    useBuilds.setState((s) => ({ projects: s.projects.map((p) => (p.id === into ? { ...p, name, updatedAt: Date.now() } : p)) }));
    return into;
  }
  const p: Omit<Project, "id"> = { name, updatedAt: Date.now() };
  return useBuilds.getState().restore(p, raw);
}

export type MakeResult = { ok: true; group: string; ids: string[]; plain: string | null } | { ok: false; says: string };

/** One prompt → three (or `count`) concepts, each a site of its own. */
export async function makeConcepts(prompt: string, o: { claude: boolean; count?: number } = { claude: false }): Promise<MakeResult> {
  const text = prompt.trim();
  if (!text) return { ok: false, says: "Say what the page is for first." };
  await useBuilds.getState().save();
  const idea = ideaOf(text);
  let asked: Asked;
  try {
    asked = await askVersions(idea, { claude: o.claude });
  } catch (e) {
    return { ok: false, says: `The versions did not come back (${e instanceof Error ? e.message : "unknown"}).` };
  }
  const v = { ...asked.versions, name: siteNameOf(text, asked.versions.name) };
  const want = Math.max(1, Math.min(v.versions.length, o.count ?? 3));
  const group: Group = { id: uid(), prompt: text, made: Date.now(), ids: [], mix: null, takes: [] };
  const ids: string[] = [];
  for (let i = 0; i < want; i++) {
    /* A System of its own per concept: J's house style when there is one, else one rolled on the prompt's words, so three concepts look like three. */
    const style = styleFor({ ...idea, text: `${text} ${v.versions[i]!.name}. ${v.versions[i]!.pitch}` }, conceptName(v.name, v.versions[i]!.name));
    if (!useSystems.getState().byId[style.system.id]) useSystems.getState().put(style.system);
    const name = conceptName(v.name, v.versions[i]!.name);
    const id = await writeSite(conceptDoc(v, i, style, name), name, null);
    const c: Concept = { group: group.id, name: v.versions[i]!.name, pitch: v.versions[i]!.pitch, index: i, made: Date.now(), by: v.by, systemId: style.system.id };
    useConcepts.getState().put(id, c);
    ids.push(id);
  }
  group.ids = ids;
  useConcepts.getState().putGroup(group);
  return ids.length ? { ok: true, group: group.id, ids, plain: asked.plain } : { ok: false, says: "No concept could be written. The browser's storage may be full." };
}

/** One concept rolled again on the group's prompt; the rest stay. */
export async function again(id: string, o: { claude: boolean } = { claude: false }): Promise<MakeResult> {
  const c = useConcepts.getState().byId[id];
  const g = c && useConcepts.getState().groups[c.group];
  if (!c || !g) return { ok: false, says: "That is not a concept this browser made." };
  const idea = ideaOf(g.prompt);
  const asked = await askVersions(idea, { claude: o.claude });
  const v = { ...asked.versions, name: siteNameOf(g.prompt, asked.versions.name) };
  /* A direction the row does not already show, else the one at this place. */
  const shown = new Set(g.ids.filter((x) => x !== id).map((x) => useConcepts.getState().byId[x]?.name.toLowerCase()));
  let i = v.versions.findIndex((x) => !shown.has(x.name.toLowerCase()) && x.name.toLowerCase() !== c.name.toLowerCase());
  if (i < 0) i = v.versions.findIndex((x) => !shown.has(x.name.toLowerCase()));
  if (i < 0) i = Math.min(c.index, v.versions.length - 1);
  const name = conceptName(v.name, v.versions[i]!.name);
  const style = styleFor({ ...idea, text: `${g.prompt} ${v.versions[i]!.name}. ${v.versions[i]!.pitch}` }, name);
  if (!useSystems.getState().byId[style.system.id]) useSystems.getState().put(style.system);
  await writeSite(conceptDoc(v, i, style, name), name, id);
  useConcepts.getState().put(id, { ...c, name: v.versions[i]!.name, pitch: v.versions[i]!.pitch, made: Date.now(), by: v.by, systemId: style.system.id });
  /* Its takes in the Mix pointed at sections it no longer has: the Mix is built again. */
  if (g.takes.some((t) => t.from === id)) await rebuildMix(g.id);
  return { ok: true, group: g.id, ids: [id], plain: asked.plain };
}

/** The Mix of a group built from its takes and written as (or over) its Mix site. */
async function rebuildMix(groupId: string): Promise<string | null> {
  const g = useConcepts.getState().groups[groupId];
  if (!g) return null;
  const docs = new Map<string, PartLike[]>();
  const envs = new Map<string, Envelope>();
  for (const id of new Set(g.takes.map((t) => t.from))) {
    const env = await readEnvelope(id);
    if (env) { envs.set(id, env); docs.set(id, env.state.nodes ?? []); }
  }
  const takes = g.takes.filter((t) => docs.has(t.from) && (docs.get(t.from) ?? []).some((n) => (n.label ?? "").split(": ")[0] === t.section));
  if (!takes.length) {
    if (g.mix) { useConcepts.getState().drop(g.mix); await useBuilds.getState().remove(g.mix); }
    useConcepts.getState().setTakes(groupId, [], null);
    return null;
  }
  const nodes = mixNodes(takes, docs, { pageId: "page_home" });
  const first = envs.get(takes[0]!.from)!.state;
  const system = (first.system as System | null) ?? (first.systemId ? useSystems.getState().byId[first.systemId] ?? null : null);
  const siteName = (useBuilds.getState().projects.find((p) => p.id === takes[0]!.from)?.name ?? "Concepts").split(": ")[0] ?? "Concepts";
  const name = mixName(siteName);
  const doc: Record<string, unknown> = {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes, groups: [],
    look: { palette: system ? rolesOf(system) : (first.look as { palette?: unknown } | undefined)?.palette },
    ...(first.format ? { format: first.format } : {}),
    brief: { name, description: `Mixed from ${takes.length} ${takes.length === 1 ? "section" : "sections"}.` },
    systemId: system?.id ?? null, system,
    activePageId: "page_home", frameWidth: first.frameWidth ?? FRAME,
  };
  const id = await writeSite(doc, name, g.mix);
  if (!g.mix) useConcepts.getState().put(id, { group: groupId, name: "Mix", pitch: "", index: 99, made: Date.now(), by: "local", systemId: system?.id ?? null, mix: true });
  useConcepts.getState().setTakes(groupId, takes, id);
  return id;
}

/** A section of a concept into its group's Mix. The Mix's site id. */
export async function take(groupId: string, t: Take): Promise<string | null> {
  const g = useConcepts.getState().groups[groupId];
  if (!g) return null;
  useConcepts.getState().setTakes(groupId, withTake(g.takes, t), g.mix);
  return rebuildMix(groupId);
}

export async function untake(groupId: string, t: Take): Promise<string | null> {
  const g = useConcepts.getState().groups[groupId];
  if (!g) return null;
  useConcepts.getState().setTakes(groupId, withoutTake(g.takes, t), g.mix);
  return rebuildMix(groupId);
}

export async function setTakes(groupId: string, takes: Take[]): Promise<string | null> {
  const g = useConcepts.getState().groups[groupId];
  if (!g) return null;
  useConcepts.getState().setTakes(groupId, takes, g.mix);
  return rebuildMix(groupId);
}

/** Open a concept in the Builder to edit it with the normal tools. It stays a concept. */
export async function edit(id: string): Promise<void> {
  await useBuilds.getState().open(id);
}

/** It becomes an ordinary site (it already is one): its record goes, and it opens in the Builder. */
export async function promote(id: string): Promise<void> {
  const c = useConcepts.getState().byId[id];
  if (c?.mix) {
    const g = useConcepts.getState().groups[c.group];
    if (g) useConcepts.getState().setTakes(c.group, g.takes, null);
  }
  useConcepts.getState().drop(id);
  await useBuilds.getState().open(id);
}

export async function discard(id: string): Promise<void> {
  const c = useConcepts.getState().byId[id];
  useConcepts.getState().drop(id);
  await useBuilds.getState().remove(id);
  if (c && !c.mix) {
    const g = useConcepts.getState().groups[c.group];
    if (g?.takes.length) await rebuildMix(c.group);
  }
}

/** Whether the open site is a concept, and its group: the Builder's way back to the canvas. */
export function openConcept(): { id: string; group: string } | null {
  const id = useBuilds.getState().activeId;
  const c = id ? useConcepts.getState().byId[id] : null;
  return id && c ? { id, group: c.group } : null;
}
