/**
 * The `pc` adapter: an agent on J's PC, in the lane's git worktree, inside
 * a Windows job object (helper/jobs), so Stop ends only its own tree.
 *
 * Every run is on J's plan (J, 2026-10-25: "no api"): the unmodified
 * `claude` CLI, headless, under J's own sign-in:
 *     claude -p --input-format stream-json --output-format stream-json
 *       --verbose --permission-mode auto --settings <lane settings>
 *       --append-system-prompt <progress rules> [--resume <id>] [--model m]
 * Never --bare (it skips the plan sign-in), never --max-budget-usd (spend
 * is tokens), never a setup-token. There is no Agent SDK path: the SDK is
 * for API keys, and its docs bar third-party apps from plan logins.
 *
 * The process stays up for the lane: J's steer lines are written to its
 * stdin as more user messages, which queue until the turn ends. Pause is
 * the hold hook (hold-hook.mjs) refusing to let the next tool call start.
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

/** Flags the plan path must never pass (agents-runner-pause checks the real argv). */
export const NEVER_FLAGS = ["--bare", "--max-budget-usd"];

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
