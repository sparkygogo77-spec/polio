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
 *
 * Names and states only (J, 2026-11-03): an imported site's scripts share the
 * Builder's page and could read what it fetched, so the coordinators' and
 * chats' notes and last lines never left this PC.
 *
 * More, since Orbs 2 (J, 2026-11-10, piece G: "you can include more information
 * because I can't tell much currently"): what the Builder reads from the helper
 * stays in J's browser and is never published, so each chat's note, latest
 * line and whole timeline reach the Agents board too (`forBuilder`). Two limits
 * hold: anything shaped like a key is blanked here, and the board folds pids,
 * paths, command lines and session ids (privacy-rules.md). The Builder never
 * writes any of it into a site, an export or a request (tests/orbs-2.mjs).
 *
 * The Agents manager (J's columns, 2026-11-11) adds: each chat's kind, who
 * runs it, its turns, what it runs on, and whether J hid or archived it; the
 * things to look at (`checks`, `iterations`); two more presses, each as
 * narrow as the answer: `archiveLanes` sets one chat's `archived` and
 * `archivedAt` (never deletes), and `pressLanes` appends one row to
 * handovers/console-presses.json, the file the coordinator reads each turn
 * (a model asked for, a picture chosen, a check ticked); and what each chat
 * costs the PC (`costFor`): sums and kinds, never a pid, a path or a command.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { MARKUP_KINDS, markupRow } from "./markup.ts";

export type LanesFiles = { file: string; beats: string };
export type LanesRead = { feed: unknown; beats: { session: string; name: string; at: number }[]; now: number };

/** Beats older than this can't turn a chat blue, so they aren't worth handing over. */
const KEEP_MS = 10 * 60_000;

export function readLanes(at: LanesFiles, now = Date.now()): LanesRead {
  let feed: unknown = null;
  try { feed = blankKeys(forBuilder(JSON.parse(readFileSync(at.file, "utf8")))); } catch { /* not there, or caught mid-write: the board keeps what it has */ }
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
 * A chat's `history`, the details strip's timeline: only the lines the
 * coordinator marked `public: true` reach the Builder (J, 2026-11-08), and of
 * each only its time and words. An unmarked line, like a note, stays on this
 * PC: an imported site's scripts share the Builder's page.
 */
export function publicHistory(raw: unknown): { at: unknown; text: unknown }[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((h) => (h && typeof h === "object" && (h as { public?: unknown }).public === true ? [{ at: (h as { at?: unknown }).at, text: (h as { text?: unknown }).text }] : []));
}
/** What a chat shows the Builder. Since piece G its note and latest line too; anything else on it (a model, a pid) stays here. */
const CHAT_KEYS = ["id", "name", "lane", "code", "emoji", "state", "sentAt", "lastSeen", "helper", "note", "last", "kind", "runBy", "turns", "model", "effort", "hidden", "archived", "archivedAt", "report", "messages", "area"];
/** The whole timeline (piece G): every line, as its time and words. */
export function allHistory(raw: unknown): { at: unknown; text: unknown }[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((h) => (h && typeof h === "object" ? [{ at: (h as { at?: unknown }).at, text: (h as { text?: unknown }).text }] : []));
}
/** Values shaped like a key (GitHub, Anthropic, OpenAI, Vercel, a bearer header) never leave, wherever they sit. */
const KEY_SHAPED = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|vc[pk]_[A-Za-z0-9]{20,}|Bearer\s+\S{10,})/g;
export function blankKeys<T>(v: T): T {
  if (typeof v === "string") return v.replace(KEY_SHAPED, "•••") as T;
  if (Array.isArray(v)) return v.map(blankKeys) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankKeys(x)])) as T;
  return v;
}

/** The feed as the Builder gets it (piece G): coordinators with name, note and retired; chats with CHAT_KEYS and their whole timeline; the questions as they are; keys blanked. */
export function forBuilder(raw: unknown): unknown {
  const r = raw as { updated?: unknown; decisions?: unknown; coordinators?: unknown } | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.coordinators)) return null;
  const pick = (x: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(keys.filter((k) => k in x).map((k) => [k, x[k]]));
  return {
    updated: r.updated,
    decisions: r.decisions,
    ...("checks" in r ? { checks: (r as { checks?: unknown }).checks } : {}),
    ...("iterations" in r ? { iterations: (r as { iterations?: unknown }).iterations } : {}),
    /* BAM mark 40: the merges list for the Builder's Merges button: number, title, state, when and a note; nothing else. */
    ...(Array.isArray((r as { merges?: unknown }).merges) ? { merges: ((r as { merges: unknown[] }).merges).map((m) => (m && typeof m === "object" ? pick(m as Record<string, unknown>, ["n", "title", "state", "at", "note", "lane"]) : null)).filter(Boolean) } : {}),
    coordinators: (r.coordinators as unknown[]).map((c) => {
      if (!c || typeof c !== "object") return c;
      const k = c as Record<string, unknown>;
      return { ...pick(k, ["id", "name", "note", "retired"]), chats: Array.isArray(k.chats) ? k.chats.map((x) => (x && typeof x === "object" ? { ...pick(x as Record<string, unknown>, CHAT_KEYS), ...("history" in x ? { history: allHistory((x as { history?: unknown }).history) } : {}) } : x)) : k.chats };
    }),
  };
}
/** The old name: the board reads `forBuilder` now. */
export const namesOnly = (raw: unknown): unknown => blankKeys(forBuilder(raw));

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
export type AskResult = { ok: true; id: string; ask: string; askedAt: string } | { ok: false; status: number; error: string };
type Wrote = { ok: true; id: string; words: string; at: string } | { ok: false; status: number; error: string };

/**
 * J's answer to one question: `{id, answer}` sets that question's `answer`
 * and `answeredAt` and nothing else.
 */
export function answerLanes(file: string, body: unknown, now = new Date()): AnswerResult {
  const b = (body ?? {}) as { id?: unknown; answer?: unknown };
  const r = writeQuestion(file, b.id, b.answer, "answer", "answeredAt", now);
  return r.ok ? { ok: true, id: r.id, answer: r.words, answeredAt: r.at } : r;
}

/**
 * J asking for new options on one question (round 2): `{id, ask}` sets its
 * `ask` and `askedAt` and nothing else; the coordinator clears them when it
 * reposts the question with new options.
 */
export function askLanes(file: string, body: unknown, now = new Date()): AskResult {
  const b = (body ?? {}) as { id?: unknown; ask?: unknown };
  const r = writeQuestion(file, b.id, b.ask, "ask", "askedAt", now);
  return r.ok ? { ok: true, id: r.id, ask: r.words, askedAt: r.at } : r;
}

/**
 * Two fields of one question, words and when. The file keeps its indent and
 * line ends, and is swapped in whole, so the coordinator never reads half of it.
 */
function writeQuestion(file: string, id: unknown, said: unknown, field: string, atField: string, now: Date): Wrote {
  if (typeof id !== "string" || !id || typeof said !== "string") return { ok: false, status: 400, error: `it is {id, ${field}}, both words` };
  const words = said.trim();
  if (!words) return { ok: false, status: 400, error: `the ${field} is empty` };
  if (words.length > MAX_ANSWER) return { ok: false, status: 400, error: `an ${field} is at most ${MAX_ANSWER} characters` };
  let text: string;
  try { text = readFileSync(file, "utf8"); } catch { return { ok: false, status: 404, error: "there is no lanes.json on this PC" }; }
  let feed: { decisions?: unknown };
  try { feed = JSON.parse(text); } catch { return { ok: false, status: 409, error: "lanes.json is being written just now: press again" }; }
  const list = Array.isArray(feed?.decisions) ? (feed.decisions as Record<string, unknown>[]) : [];
  const q = list.find((d) => d && typeof d === "object" && d.id === id);
  if (!q) return { ok: false, status: 404, error: "no question with that id: the coordinator may have taken it away" };
  const at = now.toISOString();
  q[field] = words;
  q[atField] = at;
  return swapIn(file, text, feed) ?? { ok: true, id, words, at };
}

/** The file written back whole, keeping its indent and line ends, so the coordinator never reads half of it. Null when it worked. */
function swapIn(file: string, text: string, feed: unknown): { ok: false; status: number; error: string } | null {
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
  return null;
}

export type ArchiveResult = { ok: true; id: string; archived: boolean; archivedAt: string } | { ok: false; status: number; error: string };
/**
 * One press to archive a chat, or to put it back (the manager's piece F):
 * `{id, archived}` sets that chat's `archived` and `archivedAt` and nothing
 * else. Archived means left off the board and marked in the feed; the row
 * and its history stay. Nothing is ever deleted here.
 */
export function archiveLanes(file: string, body: unknown, now = new Date()): ArchiveResult {
  const b = (body ?? {}) as { id?: unknown; archived?: unknown };
  if (typeof b.id !== "string" || !b.id || typeof b.archived !== "boolean") return { ok: false, status: 400, error: "it is {id, archived}: a chat's id and true or false" };
  let text: string;
  try { text = readFileSync(file, "utf8"); } catch { return { ok: false, status: 404, error: "there is no lanes.json on this PC" }; }
  let feed: { coordinators?: unknown };
  try { feed = JSON.parse(text); } catch { return { ok: false, status: 409, error: "lanes.json is being written just now: press again" }; }
  const chats = (Array.isArray(feed?.coordinators) ? (feed.coordinators as { chats?: unknown }[]) : []).flatMap((c) => (c && Array.isArray(c.chats) ? (c.chats as Record<string, unknown>[]) : []));
  const x = chats.find((c) => c && typeof c === "object" && c.id === b.id);
  if (!x) return { ok: false, status: 404, error: "no chat with that id" };
  const at = now.toISOString();
  x.archived = b.archived;
  x.archivedAt = at;
  return swapIn(file, text, feed) ?? { ok: true, id: b.id, archived: b.archived, archivedAt: at };
}

/**
 * The presses the Builder may save for the coordinator, and nothing else: a model asked for, a picture chosen, a
 * check ticked; and, from the manager's terminal (BAM, J 2026-11-11: "a terminal … is how you chat"), words: said
 * to the coordinator, a note on a question or a chat, or the brief of a new chat.
 */
export const PRESS_KINDS = ["model", "choose", "check", "say", "note", "new-chat", "delete", "end", "continue", "new-coordinator", "merge", ...MARKUP_KINDS] as const;
/**
 * BAM (J, 2026-11-11: "I should be able to delete questions and end the orbs from the builder"): `delete` a question or
 * a picture round (the coordinator closes it in lanes.json with a backup), `end` a chat (the coordinator stops or
 * retires it), `continue` a carried question in a new chat (`text` optional), and `new-coordinator` with `mode` fresh or
 * carry, a model and an effort (`text` optional), as the console writes it.
 */
export const COORD_MODES = ["fresh", "carry"];
export const MAX_SAY = 4000;
export const PRESS_MODELS = ["Fable 5.2", "Opus 5.5", "Sonnet 5.5", "Haiku 5.5"];
export const PRESS_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
export type PressResult = { ok: true; at: string; kind: string; target: string } | { ok: false; status: number; error: string };
/**
 * One press saved for the coordinator (the manager's piece G, and its cube):
 * a row appended to handovers/console-presses.json, the same file and the
 * same shape the console writes, one press a line. `{kind: "model", target,
 * model, effort}` asks for a chat to run on another model (only the
 * coordinator can set it); `{kind: "choose", target, option}` picks a
 * picture round's option; `{kind: "check", target}` ticks a thing looked at.
 * A file that is there and does not parse is never overwritten.
 */
export function pressLanes(file: string, body: unknown, now = new Date()): PressResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const word = (v: unknown, max = 120) => (typeof v === "string" && v.trim() && v.length <= max && !/[\r\n\0]/.test(v) ? v.trim() : null);
  const kind = PRESS_KINDS.find((k) => k === b.kind), target = word(b.target);
  if (!kind || !target) return { ok: false, status: 400, error: `it is {kind, target}: kind one of ${PRESS_KINDS.join(", ")}` };
  const row: Record<string, unknown> = { at: now.toISOString(), kind, target, from: "builder" };
  if (kind === "model") {
    if (!PRESS_MODELS.includes(b.model as string) || !PRESS_EFFORTS.includes(b.effort as string)) return { ok: false, status: 400, error: "a model press names one of the four models and an effort" };
    row.model = b.model; row.effort = b.effort;
  }
  if (kind === "choose") {
    const option = word(b.option, 40);
    if (!option) return { ok: false, status: 400, error: "a choose press names the option" };
    row.option = option;
  }
  if (kind === "say" || kind === "note" || kind === "new-chat") {
    const text = typeof b.text === "string" ? b.text.replace(/\r\n?/g, "\n").replace(/\0/g, "").trim() : "";
    if (!text) return { ok: false, status: 400, error: "there are no words to save" };
    if (text.length > MAX_SAY) return { ok: false, status: 400, error: `at most ${MAX_SAY} characters` };
    row.text = text;
  }
  if (kind === "continue" || kind === "new-coordinator") {
    const text = typeof b.text === "string" ? b.text.replace(/\r\n?/g, "\n").replace(/\0/g, "").trim() : "";
    if (text.length > MAX_SAY) return { ok: false, status: 400, error: `at most ${MAX_SAY} characters` };
    row.text = text;
  }
  if (kind === "new-coordinator") {
    if (!COORD_MODES.includes(b.mode as string)) return { ok: false, status: 400, error: "a new coordinator is fresh or carry" };
    if (!PRESS_MODELS.includes(b.model as string) || !PRESS_EFFORTS.includes(b.effort as string)) return { ok: false, status: 400, error: "a new coordinator names one of the four models and an effort" };
    row.mode = b.mode; row.model = b.model; row.effort = b.effort;
  }
  /* ✍️ MARKUP: what J drew, each stroke with the elements it touched; its pictures are written beside, the words go in the row. */
  if (kind === "markup" || kind === "snapshot") {
    if (existsSync(file)) { try { if (!Array.isArray(JSON.parse(readFileSync(file, "utf8").trim() || "[]"))) throw 0; } catch { return { ok: false, status: 409, error: "console-presses.json does not parse, so nothing was saved: ask the coordinator to fix it" }; } }
    const m = markupRow(dirname(file), kind, b, now);
    if (!m.ok) return m;
    Object.assign(row, m.extra);
  }
  let list: unknown[] = [];
  if (existsSync(file)) {
    try { const j = JSON.parse(readFileSync(file, "utf8").trim() || "[]") as unknown; if (!Array.isArray(j)) throw new Error("not a list"); list = j; }
    catch { return { ok: false, status: 409, error: "console-presses.json does not parse, so nothing was saved: ask the coordinator to fix it" }; }
  }
  list.push(row);
  const out = `[\n${list.map((p) => `  ${JSON.stringify(p)}`).join(",\n")}\n]\n`;
  const tmp = `${file}.${process.pid}-${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, out);
    try { renameSync(tmp, file); }
    catch { writeFileSync(file, out); try { unlinkSync(tmp); } catch { /* left for the next tidy */ } }
  } catch (e) { return { ok: false, status: 500, error: `couldn't write console-presses.json: ${(e as Error).message}` }; }
  return { ok: true, at: row.at as string, kind, target };
}

/* ---- what each chat costs the PC (the manager's piece E) ---- */

type CostKind = "shell" | "host" | "node" | "browser" | "other";
const COST_KIND: Record<string, CostKind> = { shell: "shell", "terminal-tab": "shell", console: "host", node: "node", "dev-server": "node", build: "node", test: "node", npm: "node", browser: "browser" };
type PcLike = { at?: unknown; memory?: { totalBytes?: unknown }; groups?: unknown };
type ItemLike = { kind?: unknown; cpu?: unknown; memBytes?: unknown; created?: unknown; startedBy?: unknown };
export type CostOwner = { key: string; title: string; memBytes: number; cpu: number | null; startedAt: number; kinds: { kind: CostKind; count: number; memBytes: number; cpu: number | null }[] };
/**
 * The PC view (helper/pc) as the Builder's manager gets it: one row per
 * owner (a chat's session by its id and title; a labelled job by its label's
 * `session` word, so the tray is TRAY and never "no session"), each with its
 * memory, CPU, oldest start and its processes counted by kind. No pid, port,
 * folder, command line or label text leaves: the Builder's page is shared
 * with an imported site's scripts, and sums are all the panes show.
 */
export function costFor(pc: unknown): { at: number; memTotal: number; owners: CostOwner[] } {
  const p = (pc ?? {}) as PcLike;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const owners = new Map<string, CostOwner>();
  const add = (key: string, title: string, it: ItemLike) => {
    let o = owners.get(key);
    if (!o) { o = { key, title, memBytes: 0, cpu: null, startedAt: 0, kinds: [] }; owners.set(key, o); }
    const kind = COST_KIND[String(it.kind)] ?? "other", mem = num(it.memBytes), cpu = typeof it.cpu === "number" ? num(it.cpu) : null, at = num(it.created);
    o.memBytes += mem;
    if (cpu !== null) o.cpu = (o.cpu ?? 0) + cpu;
    if (at && (!o.startedAt || at < o.startedAt)) o.startedAt = at;
    let k = o.kinds.find((x) => x.kind === kind);
    if (!k) { k = { kind, count: 0, memBytes: 0, cpu: null }; o.kinds.push(k); }
    k.count++; k.memBytes += mem;
    if (cpu !== null) k.cpu = (k.cpu ?? 0) + cpu;
  };
  for (const g of Array.isArray(p.groups) ? (p.groups as { id?: unknown; kind?: unknown; title?: unknown; items?: unknown }[]) : []) {
    if (!g || !Array.isArray(g.items)) continue;
    for (const it of g.items as ItemLike[]) {
      if (!it) continue;
      /* A labelled job inside a session's tree still counts under its label's word when that is a badge of its own. */
      if (g.kind === "session" && typeof g.id === "string") add(g.id, typeof g.title === "string" ? g.title : "", it);
      /* Left running: a labelled job belongs to its label's session word; an unlabelled orphan to nobody by name. */
      else if (g.kind === "left") add(typeof it.startedBy === "string" && !/^no session/i.test(it.startedBy) ? it.startedBy : "unlabelled", "", it);
    }
  }
  for (const o of owners.values()) o.kinds.sort((a, b) => b.memBytes - a.memBytes);
  return { at: num(p.at), memTotal: num(p.memory?.totalBytes), owners: [...owners.values()] };
}
