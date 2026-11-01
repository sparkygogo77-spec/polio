/**
 * Every call a lane makes on the site relay (`POST /site`), kept in the
 * helper's state dir as one JSON line each: who asked, what step, accepted or
 * refused and why. The dock's "Everything Claude is doing" tab draws the
 * refusals (`server.ts` sends them down the stream as `{kind: "site-log"}`).
 *
 * A step is kept as its op, its ids and the names of the fields it changes,
 * never their values: a patch can carry anything. What a lane wrote freely
 * (the step's name, a refusal quoting its ids) has anything key-shaped masked,
 * with the patterns the bridge refuses (`siteSteps.ts#KEY_SHAPED`).
 *
 * A log that can't be written never stops a call: the call matters more.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

export type BridgeEntry = { at: number; lane: string | null; op: string | null; name?: string; steps?: string[]; ok: boolean; why?: string };

export const LOG_FILE = "site-calls.jsonl";
const MAX_BYTES = 1 << 20;
const KEEP_REFUSALS = 50;
const MAX_STEPS = 40;
const KEY_SHAPED = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|vc[pk]_[A-Za-z0-9]{20,}|Bearer\s+\S{10,})/g;

const clean = (v: unknown, max = 400) => String(v).replace(KEY_SHAPED, "[a key]").slice(0, max);

function stepWords(s: unknown): string {
  const st = (s ?? {}) as { op?: unknown; id?: unknown; ids?: unknown; patch?: unknown };
  const fields = st.patch && typeof st.patch === "object" ? `: ${Object.keys(st.patch).join(", ")}` : "";
  const ids = Array.isArray(st.ids) ? ` ${st.ids.slice(0, 5).join(", ")}${st.ids.length > 5 ? ` and ${st.ids.length - 5} more` : ""}` : "";
  return clean(`${st.op}${st.id !== undefined ? ` ${st.id}` : ""}${ids}${fields}`, 200);
}

/** A call as the log keeps it. `lane` is null when no good ticket came with it. */
export function describeCall(lane: string | null, request: unknown, ok: boolean, why?: string, at = Date.now()): BridgeEntry {
  const b = (request ?? {}) as { op?: unknown; name?: unknown; steps?: unknown };
  const steps = Array.isArray(b.steps) ? b.steps : null;
  return {
    at, lane, op: typeof b.op === "string" ? clean(b.op, 40) : null, ok,
    ...(typeof b.name === "string" ? { name: clean(b.name, 120) } : {}),
    ...(steps ? { steps: [...steps.slice(0, MAX_STEPS).map(stepWords), ...(steps.length > MAX_STEPS ? [`and ${steps.length - MAX_STEPS} more`] : [])] } : {}),
    ...(why ? { why: clean(why) } : {}),
  };
}

export class BridgeLog {
  readonly file: string;
  private recent: BridgeEntry[] = [];
  private stateDir: string;
  private maxBytes: number;

  constructor(stateDir: string, maxBytes = MAX_BYTES) {
    this.stateDir = stateDir;
    this.maxBytes = maxBytes;
    this.file = join(stateDir, LOG_FILE);
    /* The refusals from before a restart, so the dock still shows them. */
    try {
      if (existsSync(this.file)) for (const line of readFileSync(this.file, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const e = JSON.parse(line) as BridgeEntry;
        if (!e.ok) this.keep(e);
      }
    } catch { /* a damaged log starts the list empty; new lines still append */ }
  }

  private keep(e: BridgeEntry) {
    this.recent.push(e);
    if (this.recent.length > KEEP_REFUSALS) this.recent.shift();
  }

  record(e: BridgeEntry): void {
    if (!e.ok) this.keep(e);
    try {
      mkdirSync(this.stateDir, { recursive: true });
      const line = `${JSON.stringify(e)}\n`;
      if (existsSync(this.file) && statSync(this.file).size + line.length > this.maxBytes) renameSync(this.file, `${this.file}.1`);
      appendFileSync(this.file, line);
    } catch { /* see the top of this file */ }
  }

  /** The latest refusals, oldest first. */
  refusals(): BridgeEntry[] { return [...this.recent]; }
}
