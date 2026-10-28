/**
 * Reads Claude Code's stream-json (from `claude -p --output-format
 * stream-json --verbose`, and the same messages from the Agent SDK) into
 * AgentEvents.
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
 * Dollars: the result message's `total_cost_usd`. A long-lived `-p` process
 * with stream-json input sends one result per turn. BELIEVED: the figure is
 * the process's running total, so only its growth is counted; if a result
 * comes in lower than the last one, it is read as that turn's own figure.
 */
import { STEPS, type Step, type Tokens } from "../contract.ts";
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

export class StreamReader {
  private seen = new Map<string, Tokens>();
  private lastCost = 0;
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
      if (grow.in || grow.out) out.push({ type: "usage", tokens: grow, usd: null });
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
    if (m.type === "result") {
      const cost = Number(m.total_cost_usd);
      if (Number.isFinite(cost) && cost > 0) {
        const usd = cost >= this.lastCost ? cost - this.lastCost : cost;
        this.lastCost = cost;
        if (usd > 0) out.push({ type: "usage", tokens: { in: 0, out: 0 }, usd });
      }
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
