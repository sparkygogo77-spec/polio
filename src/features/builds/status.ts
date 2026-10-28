/**
 * WHAT A SITE CARD SAYS ABOUT ITS SITE, read off what the Builder already
 * keeps: the site's own record (`Project`), its stored document's System,
 * the library of Systems, the other sites, and the agents record
 * (`agentsOnSite.ts`). Nothing here asks the network: a Builds page of twenty
 * sites costs twenty reads of localStorage.
 *
 * Pure: no store, no React, so `tests/builds-home.mjs` imports it directly.
 */
/* With its extension, so node can run this file as it is (the test imports it). */
import { timeWords } from "./publishState.ts";

export type ExportMode = "exact" | "clean";
export type ExportTo = "zip" | "repo";

/** The last export, as the site's record keeps it (`store.ts#Project.exported`). */
export interface ExportRecord { at: number; mode: ExportMode; to: ExportTo; repo?: string | null }

/** The bit of a site's record the status reads. */
export interface SiteRecord {
  id: string;
  name: string;
  live?: { url: string; at: number } | null;
  exported?: ExportRecord | null;
  versionOf?: { project: string; made: number } | null;
}

/** The bit of a stored document the status reads: which System it is on. */
export interface DocStyle {
  systemId?: string | null;
  system?: { id?: string; name?: string; house?: number } | null;
}

/** The lanes working on one site now, as the agents record keeps them. */
export interface AgentsOn { lanes: { lane: string; state: string; note: string }[]; at: number }

export interface SiteStatus {
  /** "Live at polio-two.vercel.app, 12:04" and the address; null when it has never gone live. */
  live: { host: string; url: string; at: number; says: string } | null;
  /** "Exported as clean code to the repo, 12:04", or "Not exported yet". */
  exportSays: string;
  exportKind: "none" | ExportMode;
  /** "House style", "Own style: Mochi", or "No System yet". */
  style: { kind: "house" | "own" | "none"; says: string };
  /** Lanes working on it now, or null when none is known. */
  agents: { count: number; says: string } | null;
  /** The sites copied from this one, and the one it was copied from. */
  versions: { copies: { id: string; name: string }[]; original: { id: string; name: string } | null; says: string };
}

/** The host of an address, in the fewest words: "polio-two.vercel.app". */
export function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url.replace(/^https?:\/\//, "").split("/")[0] ?? url; }
}

export const modeWords = (mode: ExportMode): string => (mode === "exact" ? "Exact look" : "Clean code");

export function exportWords(e: ExportRecord | null | undefined, now = Date.now()): string {
  if (!e) return "Not exported yet.";
  const where = e.to === "zip" ? "as a zip" : e.repo ? `to ${e.repo}` : "to its repo";
  return `Exported ${timeWords(e.at, now)}: ${modeWords(e.mode)}, ${where}.`;
}

/**
 * Which style a site is on. The house style is the library's marked System
 * (`system/store.ts#houseOf`); a site on it by id, or holding a copy that
 * carries the mark, is "House style". Any other System is its own.
 */
export function styleOf(doc: DocStyle | null | undefined, houseId: string | null): SiteStatus["style"] {
  const id = doc?.systemId ?? doc?.system?.id ?? null;
  const marked = typeof doc?.system?.house === "number" && doc.system.house > 0;
  if (!id && !doc?.system) return { kind: "none", says: "No System yet." };
  if (marked || (houseId && id === houseId)) return { kind: "house", says: "House style." };
  const name = doc?.system?.name?.trim();
  return { kind: "own", says: name && !/^house style$/i.test(name) ? `Own style: ${name}.` : "Its own style." };
}

/** How long an agents record counts as "now": the dock says again within this, or it is stale. */
export const AGENTS_FRESH_MS = 15 * 60 * 1000;

export function agentsWords(on: AgentsOn | null | undefined, now = Date.now()): SiteStatus["agents"] {
  if (!on || now - on.at > AGENTS_FRESH_MS) return null;
  const working = on.lanes.filter((l) => l.state !== "done" && l.state !== "stopped" && l.state !== "failed");
  if (!working.length) return null;
  const notes = working.map((l) => l.note || l.lane).filter(Boolean);
  return { count: working.length, says: `${working.length} agent${working.length === 1 ? "" : "s"} working now: ${notes.join(", ")}.` };
}

export function versionsOf(site: SiteRecord, all: readonly SiteRecord[]): SiteStatus["versions"] {
  const copies = all.filter((p) => p.versionOf?.project === site.id).map((p) => ({ id: p.id, name: p.name }));
  const from = site.versionOf ? all.find((p) => p.id === site.versionOf!.project) : null;
  const original = from ? { id: from.id, name: from.name } : null;
  const parts: string[] = [];
  if (original) parts.push(`A copy of ${original.name}`);
  if (copies.length) parts.push(`${copies.length} ${copies.length === 1 ? "copy" : "copies"}: ${copies.map((c) => c.name).join(", ")}`);
  return { copies, original, says: parts.length ? `${parts.join(". ")}.` : "No copies yet." };
}

export function siteStatus(o: { site: SiteRecord; doc: DocStyle | null; houseId: string | null; agents: AgentsOn | null; all: readonly SiteRecord[]; now?: number }): SiteStatus {
  const now = o.now ?? Date.now();
  const live = o.site.live ? { host: hostOf(o.site.live.url), url: o.site.live.url, at: o.site.live.at, says: `Live at ${hostOf(o.site.live.url)}, ${timeWords(o.site.live.at, now)}.` } : null;
  return {
    live,
    exportSays: exportWords(o.site.exported, now),
    exportKind: o.site.exported?.mode ?? "none",
    style: styleOf(o.doc, o.houseId),
    agents: agentsWords(o.agents, now),
    versions: versionsOf(o.site, o.all),
  };
}
