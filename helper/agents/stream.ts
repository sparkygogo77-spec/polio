/**
 * Reads Claude Code's stream-json (from `claude -p --output-format
 * stream-json --verbose`) into AgentEvents.
 *
 * Steps and questions come from the agent's own text, by the convention in
 * brief.ts: a line `[step:red] writing the red test` or `[question] ...`.
 *
 * Tokens: an assistant message can arrive more than once (once per content
 * block, with the same message id), so usage is kept per message id and
 * only the growth is counted. `in` is every input token the model read:
 * fresh, cache writes and cache reads; `out` is output tokens. Messages from
 * subagents come through the stream too and are counted the same way.
 *
 * No dollars are read (J: plan usage and tokens only), so `total_cost_usd`
 * is ignored.
 *
 * Plan use: a `rate_limit_event` carries `rate_limit_info`. MEASURED on J's
 * PC (Claude Code 2.1.309, 2026-10-29): one comes with every turn of
 * `claude -p --output-format stream-json --verbose` (none in plain `json`),
 * shaped `{status, resetsAt, rateLimitType, …, unifiedWindows: {five_hour:
 * {utilization, resetsAt}, seven_day: {…}}}`, with no top-level
 * `utilization`. So the share is read from the window nearest its limit
 * (the highest utilization), named in `window`; a top-level `utilization`,
 * when an older or newer CLI sends one, still wins. Shares are 0 to 1 (over 1
 * is read as a percentage); `resetsAt` is Unix seconds (ms are divided).
 * A `rejected` status with no share at all reads as used 1, so the runner
 * still pauses on it.
 */
import { STEPS, type PlanUse, type Step, type Tokens } from "../contract.ts";
import type { AgentEvent } from "./types.ts";

type Obj = Record<string, any>;

const STEP_LINE = new RegExp(`^\\s*\\[step:(${STEPS.join("|")})\\]\\s*(.*)$`, "m");
const QUESTION_LINE = /^\s*\[question\]\s*(.+)$/m;

export function tokensOf(usage: Obj | undefined | null): Tokens {
  if (!usage) return { in: 0, out: 0 };
  const n = (x: unknown) => (Number.isFinite(x) ? Number(x) : 0);
  return {
    in: n(usage.input_tokens) + n(usage.cache_creation_input_tokens) + n(usage.cache_read_input_tokens),
    out: n(usage.output_tokens),
  };
}

const STATUSES = ["allowed", "allowed_warning", "rejected"] as const;

/** A rate_limit_info to the contract's plan reading; null when it holds no share. */
export function planUseOf(info: Obj): PlanUse | null {
  const status = STATUSES.find((s) => s === info.status);
  if (!status) return null;
  const share = (x: unknown) => { const n = Number(x); return x !== undefined && x !== null && Number.isFinite(n) && n >= 0 ? Math.min(1, n > 1 ? n / 100 : n) : null; };
  const seconds = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.round(n > 1e11 ? n / 1000 : n) : null; };
  const named = typeof info.rateLimitType === "string" ? { window: info.rateLimitType.slice(0, 40) } : {};
  const top = share(info.utilization);
  if (top !== null) return { used: top, status, resetsAt: seconds(info.resetsAt), ...named };
  // The windows: the one nearest its limit is the one that would stop J.
  const windows = Object.entries(info.unifiedWindows && typeof info.unifiedWindows === "object" ? info.unifiedWindows as Obj : {})
    .map(([name, w]) => ({ name: name.slice(0, 40), used: share(w?.utilization), resetsAt: seconds(w?.resetsAt) }))
    .filter((w): w is { name: string; used: number; resetsAt: number | null } => w.used !== null)
    .sort((a, b) => b.used - a.used);
  const near = windows[0];
  if (near) return { used: near.used, status, resetsAt: near.resetsAt ?? seconds(info.resetsAt), window: near.name };
  return status === "rejected" ? { used: 1, status, resetsAt: seconds(info.resetsAt), ...named } : null;
}

export class StreamReader {
  private seen = new Map<string, Tokens>();
  sessionId: string | null = null;

  /** One message (already parsed from its line) to the events it holds. */
  read(m: Obj): AgentEvent[] {
    const out: AgentEvent[] = [];
    if (!m || typeof m !== "object") return out;
    if (typeof m.session_id === "string") this.sessionId = m.session_id;
    if (m.type === "system" && m.subtype === "init") out.push({ type: "started", sessionId: this.sessionId });
    if (m.type === "assistant" && m.message) {
      const id = String(m.message.id ?? `anon-${this.seen.size}`);
      const now = tokensOf(m.message.usage);
      const was = this.seen.get(id) ?? { in: 0, out: 0 };
      const grow = { in: Math.max(0, now.in - was.in), out: Math.max(0, now.out - was.out) };
      this.seen.set(id, { in: Math.max(now.in, was.in), out: Math.max(now.out, was.out) });
      if (grow.in || grow.out) out.push({ type: "usage", tokens: grow });
      for (const block of Array.isArray(m.message.content) ? m.message.content : []) {
        if (block?.type !== "text" || typeof block.text !== "string") continue;
        for (const line of block.text.split("\n")) {
          const s = STEP_LINE.exec(line);
          if (s) out.push({ type: "step", step: s[1] as Step, note: (s[2] ?? "").trim() });
          const q = QUESTION_LINE.exec(line);
          if (q) out.push({ type: "question", text: (q[1] ?? "").trim() });
        }
      }
    }
    if (m.type === "rate_limit_event" && m.rate_limit_info) {
      const plan = planUseOf(m.rate_limit_info);
      if (plan) out.push({ type: "plan", plan });
    }
    if (m.type === "result") {
      if (m.is_error || (m.subtype && m.subtype !== "success")) out.push({ type: "note", note: `turn ended: ${m.subtype ?? "error"}` });
      out.push({ type: "idle" });
    }
    return out;
  }
}

/** Splits a byte stream into lines and each line into events. */
export async function* readLines(source: AsyncIterable<Buffer | string>, reader: StreamReader): AsyncGenerator<AgentEvent> {
  let rest = "";
  for await (const chunk of source) {
    rest += chunk.toString();
    let i: number;
    while ((i = rest.indexOf("\n")) >= 0) {
      const line = rest.slice(0, i).trim();
      rest = rest.slice(i + 1);
      if (!line) continue;
      let m: Obj;
      try { m = JSON.parse(line); } catch { continue; }
      yield* reader.read(m);
    }
  }
}
