"use client";
/**
 * WHICH AGENTS ARE ON WHICH SITE, as the Builder last heard from the dock.
 *
 * The lanes live in the dock, on the helper; the Builder is told, never
 * asks. Two things the paired dock frame posts to the page say who is on
 * a site: a lane line (`kind: "lanes"`, the lanes of a request with the
 * site it is for) and a site call (`kind: "site"`, a lane reading or
 * changing the open site through the bridge). Each is written here, in
 * localStorage under `builder.agents`, so the Builds page can say "2
 * agents working now" with no frame open and no call made. A record older
 * than `AGENTS_FRESH_MS` says nothing: a lane the dock stopped telling us
 * about is not still working.
 *
 * Only a message from the helper's origin is taken, and only its lane
 * names, states and notes: no token, no control (`agents/context.ts`).
 */
import { HELPER_ORIGIN } from "@/features/agents/context";
import { AGENTS_FRESH_MS, type AgentsOn } from "./status";

export const AGENTS_KEY = "builder.agents";

export interface AgentsRecord {
  /** The dock has paired with the helper on this PC, as far as this browser has heard. */
  paired: boolean;
  /** When the dock last said anything. */
  at: number;
  sites: Record<string, AgentsOn>;
}

const EMPTY: AgentsRecord = { paired: false, at: 0, sites: {} };

export function readAgents(): AgentsRecord {
  try {
    const raw = localStorage.getItem(AGENTS_KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<AgentsRecord>;
    return { paired: v.paired === true, at: typeof v.at === "number" ? v.at : 0, sites: v.sites && typeof v.sites === "object" ? v.sites : {} };
  } catch {
    return EMPTY;
  }
}

function writeAgents(r: AgentsRecord): void {
  try { localStorage.setItem(AGENTS_KEY, JSON.stringify(r)); } catch { /* not kept: the next message writes again */ }
  window.dispatchEvent(new Event("builds:agents"));
}

/** The lanes on one site, or null when none is known. The reader decides what is fresh (`status.ts#agentsWords`). */
export function agentsOn(siteId: string): AgentsOn | null {
  return readAgents().sites[siteId] ?? null;
}

/** Has the dock paired recently? The Start row's entry reads "Open the agents dock" then, "Set up agents" otherwise. */
export function pairedRecently(now = Date.now()): boolean {
  const r = readAgents();
  return r.paired && now - r.at <= AGENTS_FRESH_MS;
}

/** What the dock posts about lanes: the shape the Builds page reads. The dock may add to it; nothing else is read. */
interface LanesLine { source: "polio-dock"; kind: "lanes"; site?: string | null; paired?: boolean; lanes?: { lane?: unknown; state?: unknown; note?: unknown }[] }
interface SiteLine { source: "polio-dock"; kind: "site"; op: string; site?: string; name?: string }

const str = (v: unknown, or = ""): string => (typeof v === "string" ? v : or);

/** One message from the dock, taken in. Exported for the test; the listener calls it. */
export function takeDockMessage(data: unknown, now = Date.now()): boolean {
  if (!data || typeof data !== "object" || (data as { source?: unknown }).source !== "polio-dock") return false;
  const d = data as LanesLine | SiteLine;
  const r = readAgents();
  if (d.kind === "lanes") {
    const lanes = Array.isArray(d.lanes) ? d.lanes.map((l) => ({ lane: str(l?.lane), state: str(l?.state, "running"), note: str(l?.note) })).filter((l) => l.lane) : [];
    const paired = d.paired === undefined ? true : d.paired === true;
    const sites = { ...r.sites };
    if (d.site) sites[d.site] = { lanes, at: now };
    writeAgents({ paired, at: now, sites });
    return true;
  }
  if (d.kind === "site") {
    /* A site call reaches the page only through the paired dock: the lane named is working on that site now. */
    const site = str(d.site) || null;
    const sites = { ...r.sites };
    if (site) {
      const name = str(d.name) || d.op;
      const was = sites[site]?.lanes ?? [];
      sites[site] = { lanes: [...was.filter((l) => l.lane !== name), { lane: name, state: "running", note: str(d.name) }], at: now };
    }
    writeAgents({ paired: true, at: now, sites });
    return true;
  }
  return false;
}

let watching = false;
/** Hear the dock, for as long as the page lives. Started once by the builds module (`index.ts`). */
export function watchAgents(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== HELPER_ORIGIN) return;
    takeDockMessage(e.data);
  });
}
