/**
 * What the lanes board reads off this PC: `handovers/lanes.json`, which the
 * coordinator keeps, and the heartbeats the Pleo hooks write on every tool
 * call (`agents/lanes/<session>.json`, {name, at}).
 *
 * Read fresh each time and handed over as it stands; the board makes sense of
 * it (`src/features/agents/lanes.ts`). Both doors use this: the Builder's
 * `/api/lanes` where the Builder runs on this PC, and the helper's `GET /lanes`
 * for the live Builder, which has no such files.
 *
 * The decisions panel adds two things (2026-11-03): the options' pictures,
 * files under `handovers/` served read-only (`lanesFileAt`), and J's answer
 * to a question, the one thing ever written back (`answerLanes`): `answer`
 * and `answeredAt` of that question, nothing else in the file.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

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

/**
 * What a picture may be, and the styles and images an html design pulls in
 * beside it. Never a script file: handovers/ holds probes, and any page could
 * load one as a script. A design runs its own inline scripts.
 */
export const LANES_FILE_TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
};

/**
 * A file under `handovers/` for the panel, or null. `rel` is decoded already.
 * No climbing out (by `..`, an absolute path or a link), no hidden files, and
 * only the kinds above: never lanes.json itself, a note, a script or a key.
 */
export function lanesFileAt(handovers: string, rel: string): { path: string; type: string } | null {
  if (!rel || rel.includes("\0") || rel.includes("\\") || rel.includes(":") || rel.startsWith("/")) return null;
  if (rel.split("/").some((s) => !s || s === "." || s === ".." || s.startsWith("."))) return null;
  const type = LANES_FILE_TYPES[extname(rel).toLowerCase()];
  if (!type) return null;
  try {
    const root = realpathSync(resolve(handovers));
    const path = resolve(root, rel);
    if (!path.startsWith(root + sep) || !existsSync(path)) return null;
    const real = realpathSync(path);
    if (!real.startsWith(root + sep) || !statSync(real).isFile()) return null;
    return { path: real, type };
  } catch { return null; }
}

/**
 * Headers for such a file. An html page runs sandboxed whatever frames it, so
 * its scripts never share an origin with anything, and only `ancestors` may
 * frame it.
 */
export function lanesFileHeaders(type: string, ancestors: string): Record<string, string> {
  return {
    "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "cross-origin",
    ...(type.startsWith("text/html") ? { "content-security-policy": `sandbox allow-scripts; frame-ancestors ${ancestors}` } : {}),
  };
}

export const MAX_ANSWER = 2000;
export type AnswerResult = { ok: true; id: string; answer: string; answeredAt: string } | { ok: false; status: number; error: string };

/**
 * J's answer to one question: `{id, answer}` sets that question's `answer`
 * and `answeredAt` and nothing else. The file keeps its indent and line ends,
 * and is swapped in whole, so the coordinator never reads half of it.
 */
export function answerLanes(file: string, body: unknown, now = new Date()): AnswerResult {
  const b = (body ?? {}) as { id?: unknown; answer?: unknown };
  if (typeof b.id !== "string" || !b.id || typeof b.answer !== "string") return { ok: false, status: 400, error: "an answer is {id, answer}, both words" };
  const answer = b.answer.trim();
  if (!answer) return { ok: false, status: 400, error: "the answer is empty" };
  if (answer.length > MAX_ANSWER) return { ok: false, status: 400, error: `an answer is at most ${MAX_ANSWER} characters` };
  let text: string;
  try { text = readFileSync(file, "utf8"); } catch { return { ok: false, status: 404, error: "there is no lanes.json on this PC" }; }
  let feed: { decisions?: unknown };
  try { feed = JSON.parse(text); } catch { return { ok: false, status: 409, error: "lanes.json is being written just now: press again" }; }
  const list = Array.isArray(feed?.decisions) ? (feed.decisions as Record<string, unknown>[]) : [];
  const q = list.find((d) => d && typeof d === "object" && d.id === b.id);
  if (!q) return { ok: false, status: 404, error: "no question with that id: the coordinator may have taken it away" };
  const answeredAt = now.toISOString();
  q.answer = answer;
  q.answeredAt = answeredAt;
  const indent = /^[{[]\r?\n([ \t]+)/.exec(text)?.[1] ?? 2;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  let out = JSON.stringify(feed, null, indent);
  if (eol !== "\n") out = out.replace(/\n/g, eol);
  if (/\n$/.test(text)) out += eol;
  const tmp = `${file}.${process.pid}-${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, out);
    try { renameSync(tmp, file); }
    catch { writeFileSync(file, out); try { unlinkSync(tmp); } catch { /* left for the next tidy */ } }
  } catch (e) { return { ok: false, status: 500, error: `couldn't write lanes.json: ${(e as Error).message}` }; }
  return { ok: true, id: b.id, answer, answeredAt };
}
