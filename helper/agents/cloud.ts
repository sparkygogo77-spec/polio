/**
 * The `cloud` adapter: a Claude Code cloud session (claude.ai/code), started
 * by the unmodified CLI under J's own sign-in. Read on 2026-10-25 in
 * claude-code-on-the-web.md; see agents-runner.md for the whole finding.
 *
 * What a program can do, and what this adapter does:
 * - Start one: `claude --cloud "<task>"` creates a session for the current
 *   folder's GitHub remote at its pushed branch. The adapter reads the
 *   session id and link from what the CLI prints, then lets the local
 *   process go (the session runs on in the cloud).
 * - Steer it: `claude -p "<line>" --cloud <id> --output-format json` queues
 *   a message and prints {ok, session_id, url}.
 *
 * What it can't do, so the runner refuses it and the row says why:
 * - Watch it: no event stream (`stream-json` isn't supported with --cloud),
 *   so there are no steps or questions; the row links to the session.
 * - Pause or Stop it: no CLI or API for either; J does it on claude.ai.
 * - Read its tokens: none are published per session. Cloud sessions count
 *   toward J's plan limits, "no separate charge": the row and the spend
 *   line say "on your plan, not measured" (J accepted this, 2026-10-25).
 *
 * BELIEVED, test before relying on it: that `claude --cloud "<task>"` run
 * without a terminal prints the session id or link and returns. If it waits
 * instead, the adapter stops it once the id is read, which leaves the cloud
 * session running.
 */
import { startJob } from "../jobs/job.ts";
import type { Adapter, AgentEvent, AgentRun, LaneSpec } from "./types.ts";

const SESSION = /\b((?:session|cse)_[A-Za-z0-9]+)\b/;
const URL_RE = /https:\/\/claude\.ai\/code\/[^\s"']+/;

export type CloudOptions = { command: { file: string; args?: string[] }; waitMs?: number };

export const CLOUD_LIMITS = "a cloud session can be paused or stopped only on claude.ai, and its tokens can't be read";

export function cloudAdapter({ command, waitMs = 120_000 }: CloudOptions): Adapter {
  const run = (args: string[], spec: LaneSpec) => startJob(command.file, [...(command.args ?? []), ...args], { cwd: spec.cwd, env: spec.env });
  return {
    where: "cloud",
    pays: "cloud",
    can: { pause: false, stop: false, tokens: false },
    limits: CLOUD_LIMITS,
    start(spec: LaneSpec): AgentRun {
      let sessionId: string | null = null;
      async function* events(): AsyncGenerator<AgentEvent> {
        const job = run(["--cloud", spec.prompt], spec);
        job.child.stdin?.end();
        let text = "";
        const timer = setTimeout(() => void job.stop(), waitMs);
        for await (const chunk of job.child.stdout!) {
          text += chunk.toString();
          const id = SESSION.exec(text)?.[1];
          if (id) { sessionId = id; break; }
        }
        clearTimeout(timer);
        await job.stop();
        if (!sessionId) {
          yield { type: "ended", ok: false, reason: "the cloud session didn't start (no session id in the CLI's output)" };
          return;
        }
        const url = URL_RE.exec(text)?.[0] ?? `https://claude.ai/code/${sessionId}`;
        yield { type: "started", sessionId, url };
        yield { type: "note", note: `running in the cloud, on your plan, not measured: ${url}` };
      }
      return {
        events: events(),
        async steer(line) {
          if (!sessionId) throw new Error("the cloud session hasn't started yet");
          const job = run(["-p", line, "--cloud", sessionId, "--output-format", "json"], spec);
          job.child.stdin?.end();
          let out = "";
          for await (const c of job.child.stdout!) out += c.toString();
          await job.exited;
          let reply: { ok?: boolean; error?: string } = {};
          try { reply = JSON.parse(out); } catch {}
          if (!reply.ok) throw new Error(`the line didn't reach the cloud session: ${reply.error ?? out.trim()}`);
        },
        async stop() { throw new Error(CLOUD_LIMITS); },
      };
    },
  };
}
