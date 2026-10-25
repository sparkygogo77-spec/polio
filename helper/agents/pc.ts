/**
 * The `pc` adapters: an agent on J's PC, in the lane's git worktree, inside
 * a Windows job object (helper/jobs), so Stop ends only its own tree.
 *
 * Two ways to pay, one stream format:
 *
 * - pcPlanAdapter: the unmodified `claude` CLI, headless, under J's own
 *   sign-in (pays "plan"):
 *     claude -p --input-format stream-json --output-format stream-json
 *       --verbose --permission-mode auto --settings <lane settings>
 *       --append-system-prompt <progress rules> [--resume <id>] [--model m]
 *   The process stays up for the lane: J's steer lines are written to its
 *   stdin as more user messages, which queue until the turn ends. Pause is
 *   the hold hook (hold-hook.mjs) refusing to let the next tool call start.
 *
 * - pcApiAdapter: the Claude Agent SDK's `query()` with J's API key (pays
 *   "api"). Pause is an in-process PreToolUse hook awaiting the gate. The
 *   SDK starts the CLI itself; `spawnClaudeCodeProcess` (BELIEVED, from the
 *   TS reference) lets the helper start it in a job like the plan path.
 *   The SDK isn't a dependency of the repo yet: it is loaded when an API
 *   run starts, and a missing package says so on the row.
 *
 * Agents run in auto mode, never bypass (proposal, Safety).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startJob, type Job } from "../jobs/job.ts";
import { PROGRESS_RULES } from "./brief.ts";
import { readLines, StreamReader } from "./stream.ts";
import type { Adapter, AgentEvent, AgentRun, LaneSpec } from "./types.ts";

const HOOK = fileURLToPath(new URL("./hold-hook.mjs", import.meta.url)).replace(/\\/g, "/");
/** The hold gives up (refusing the call) before the hook's own timeout lets it through. */
const HOLD_SECONDS = 3300;
const HOOK_TIMEOUT = 3600;

const slash = (p: string) => p.replace(/\\/g, "/");
const userLine = (text: string) => JSON.stringify({ type: "user", message: { role: "user", content: text } }) + "\n";

/** The settings file a plan lane runs with: the hold hook around every tool. */
export function laneSettings(spec: Pick<LaneSpec, "lane" | "gate" | "stateDir">) {
  const hook = (mode: "pre" | "post") =>
    `node "${HOOK}" ${mode} "${slash(spec.gate.dir)}" "${slash(spec.stateDir)}" ${spec.lane}${mode === "pre" ? ` ${HOLD_SECONDS}` : ""}`;
  return {
    hooks: {
      PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: hook("pre"), timeout: HOOK_TIMEOUT }] }],
      PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: hook("post"), timeout: 30 }] }],
    },
  };
}

export type PlanOptions = {
  /** The claude executable, or for a test a node script: { file: node, args: [script] }. */
  command: { file: string; args?: string[] };
  permissionMode?: "auto" | "acceptEdits" | "plan" | "default";
};

export function pcPlanAdapter({ command, permissionMode = "auto" }: PlanOptions): Adapter {
  return {
    where: "pc",
    pays: "plan",
    can: { pause: true, stop: true, tokens: true },
    start(spec: LaneSpec): AgentRun {
      const dir = join(spec.stateDir, "lanes", spec.lane);
      mkdirSync(dir, { recursive: true });
      const settings = join(dir, "settings.json");
      writeFileSync(settings, JSON.stringify(laneSettings(spec), null, 2));
      const args = [
        ...(command.args ?? []),
        "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--permission-mode", permissionMode,
        "--settings", settings,
        "--append-system-prompt", PROGRESS_RULES,
        ...(spec.resume ? ["--resume", spec.resume] : []),
        ...(spec.model ? ["--model", spec.model] : []),
      ];
      const job: Job = startJob(command.file, args, { cwd: spec.cwd, env: spec.env });
      job.child.stdin!.write(userLine(spec.prompt));
      const reader = new StreamReader();
      async function* events(): AsyncGenerator<AgentEvent> {
        yield* readLines(job.child.stdout!, reader);
        const code = await job.exited;
        yield { type: "ended", ok: code === 0, reason: code === 0 ? "the agent finished" : `the agent exited with ${code}` };
      }
      return {
        events: events(),
        async steer(text) { if (job.child.stdin?.writable) job.child.stdin.write(userLine(text)); },
        async stop() { job.child.stdin?.end(); await job.stop(); },
      };
    },
  };
}

/** The slice of the SDK's `query()` this adapter uses, so a test can stub it. */
export type QueryFn = (args: { prompt: AsyncIterable<unknown>; options: Record<string, unknown> }) => AsyncIterable<any> & { interrupt?: () => Promise<unknown> };

export type ApiOptions = {
  /** Loads `query` from @anthropic-ai/claude-agent-sdk unless a test gives one. */
  query?: QueryFn;
  apiKey: () => string;
  permissionMode?: "auto" | "acceptEdits" | "plan" | "default";
  maxBudgetUsd?: number;
};

async function loadQuery(): Promise<QueryFn> {
  const name = "@anthropic-ai/claude-agent-sdk";
  try { return (await import(name)).query as QueryFn; }
  catch { throw new Error(`the Claude Agent SDK isn't installed: run npm i ${name} in the helper's folder`); }
}

export function pcApiAdapter(opts: ApiOptions): Adapter {
  return {
    where: "pc",
    pays: "api",
    can: { pause: true, stop: true, tokens: true },
    start(spec: LaneSpec): AgentRun {
      const abort = new AbortController();
      const lines: string[] = [spec.prompt];
      let wake: (() => void) | null = null;
      let closed = false;
      async function* prompt() {
        for (;;) {
          while (lines.length) yield { type: "user", message: { role: "user", content: lines.shift()! }, parent_tool_use_id: null, session_id: "" };
          if (closed) return;
          await new Promise<void>((r) => { wake = r; });
          wake = null;
        }
      }
      const jobs: Job[] = [];
      const hold = async () => {
        const r = await spec.gate.wait();
        if (r === "stopped") return { decision: "block", reason: "This lane was stopped by J.",
          hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "stopped by J" } };
        return {};
      };
      const options: Record<string, unknown> = {
        cwd: spec.cwd,
        env: { ...spec.env, ANTHROPIC_API_KEY: opts.apiKey() },
        permissionMode: opts.permissionMode ?? "auto",
        abortController: abort,
        appendSystemPrompt: PROGRESS_RULES,
        hooks: { PreToolUse: [{ hooks: [hold], timeout: HOOK_TIMEOUT }] },
        ...(opts.maxBudgetUsd ? { maxBudgetUsd: opts.maxBudgetUsd } : {}),
        ...(spec.resume ? { resume: spec.resume } : {}),
        ...(spec.model ? { model: spec.model } : {}),
        spawnClaudeCodeProcess: (o: { command: string; args: string[]; cwd?: string; env?: NodeJS.ProcessEnv }) => {
          const job = startJob(o.command, o.args, { cwd: o.cwd ?? spec.cwd, env: o.env ?? spec.env });
          jobs.push(job);
          return job.child;
        },
      };
      const reader = new StreamReader();
      async function* events(): AsyncGenerator<AgentEvent> {
        let ok = true, reason = "the agent finished";
        try {
          const query = opts.query ?? (await loadQuery());
          for await (const m of query({ prompt: prompt(), options })) yield* reader.read(m);
        } catch (e) {
          ok = false;
          reason = abort.signal.aborted ? "stopped by J" : String((e as Error).message ?? e);
        }
        yield { type: "ended", ok, reason };
      }
      return {
        events: events(),
        async steer(text) { lines.push(text); wake?.(); },
        async stop() {
          closed = true; wake?.();
          abort.abort();
          await Promise.all(jobs.map((j) => j.stop()));
        },
      };
    },
  };
}
