/**
 * What the lanes board reads off this PC: `handovers/lanes.json`, which the
 * coordinator keeps, and the heartbeats the Pleo hooks write on every tool
 * call (`agents/lanes/<session>.json`, {name, at}).
 *
 * Read fresh each time and handed over as it stands; the board makes sense of
 * it (`src/features/agents/lanes.ts`). Both doors use this: the Builder's
 * `/api/lanes` where the Builder runs on this PC, and the helper's `GET /lanes`
 * for the live Builder, which has no such files.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type LanesFiles = { file: string; beats: string };
export type LanesRead = { feed: unknown; beats: { session: string; name: string; at: number }[]; now: number };

/** Beats older than this can't turn a chat blue, so they aren't worth handing over. */
const KEEP_MS = 10 * 60_000;

export function readLanes(at: LanesFiles, now = Date.now()): LanesRead {
  let feed: unknown = null;
  try { feed = JSON.parse(readFileSync(at.file, "utf8")); } catch { /* not there, or caught mid-write: the board keeps what it has */ }
  const beats: LanesRead["beats"] = [];
  let names: string[] = [];
  try { names = readdirSync(at.beats); } catch { /* no hook has run yet */ }
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    try {
      const b = JSON.parse(readFileSync(join(at.beats, n), "utf8")) as { name?: unknown; at?: unknown };
      if (typeof b.at === "number" && now - b.at < KEEP_MS) beats.push({ session: n.slice(0, -5), name: typeof b.name === "string" ? b.name : "", at: b.at });
    } catch { /* a beat caught mid-write: the next one will do */ }
  }
  return { feed, beats, now };
}
