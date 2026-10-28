#!/usr/bin/env node
/**
 * A stand-in for the `claude` CLI, for the runner's tests: no real Claude
 * call is ever made. It speaks the same stream-json and runs the hooks from
 * --settings the way Claude Code does (the call as JSON on stdin; exit 2
 * refuses it).
 *
 * Stream mode (-p --input-format stream-json ...), in the lane's cwd:
 *   turn 1: init; "[step:brief]" (one message sent as two blocks, so its
 *           usage arrives twice); waits for the file `go`; one Bash call
 *           through the PreToolUse hook (tool.log gets "ran" or "refused");
 *           "[step:red]"; a rate_limit_event (82% of the plan used); a result
 *           (its total_cost_usd must be ignored).
 *   later turns: each user line goes into steer.log; "[step:live]"; a result.
 * Cloud: `--cloud "<task>"` prints a session id and link; `-p <line>
 *   --cloud <id> --output-format json` prints {ok, session_id, url} and
 *   adds the line to cloud.log.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const out = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (args.includes("--cloud")) {
  const id = flag("--cloud");
  if (args.includes("-p")) {
    appendFileSync("cloud.log", `${args[args.indexOf("-p") + 1]}\n`);
    out({ ok: true, session_id: id, url: `https://claude.ai/code/${id}` });
  } else {
    process.stdout.write("Created cloud session.\nSession ID: session_01FAKECLOUD\nView: https://claude.ai/code/session_01FAKECLOUD?from=cli\n");
  }
  process.exit(0);
}

// What it was started with, so a test can check the plan path: the flags,
// and whether any Claude credential reached it (none should).
writeFileSync("argv.json", JSON.stringify({ args, credentials: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"].filter((k) => k in process.env) }));
const settings = JSON.parse(readFileSync(flag("--settings"), "utf8"));
const session_id = "fake-session-1";

function runHooks(event, call) {
  const list = (settings.hooks?.[event] ?? []).flatMap((m) => m.hooks ?? []);
  return list.reduce(async (prev, h) => {
    const code = await prev;
    if (code === 2) return 2;
    return new Promise((resolve) => {
      const p = spawn(h.command, { shell: true, stdio: ["pipe", "ignore", "pipe"] });
      p.stdin.end(JSON.stringify({ session_id, hook_event_name: event, ...call }));
      p.on("exit", (c) => resolve(c));
    });
  }, Promise.resolve(0));
}

const assistant = (id, text, usage) => out({ type: "assistant", session_id,
  message: { id, role: "assistant", content: [{ type: "text", text }], usage } });

let turn = 0;
const rl = createInterface({ input: process.stdin });
for await (const line of rl) {
  if (!line.trim()) continue;
  const m = JSON.parse(line);
  turn++;
  if (turn === 1) {
    out({ type: "system", subtype: "init", session_id, tools: ["Bash"] });
    assistant("m1", "Looking.", { input_tokens: 100, output_tokens: 5 });
    assistant("m1", "[step:brief] reading the brief", { input_tokens: 100, output_tokens: 10 });
    while (!existsSync("go")) await sleep(50);
    const call = { tool_name: "Bash", tool_input: { command: "echo hi" }, tool_use_id: "t1" };
    out({ type: "assistant", session_id, message: { id: "m2", role: "assistant",
      content: [{ type: "tool_use", id: "t1", name: "Bash", input: call.tool_input }],
      usage: { input_tokens: 50, cache_read_input_tokens: 25, cache_creation_input_tokens: 5, output_tokens: 5 } } });
    const code = await runHooks("PreToolUse", call);
    appendFileSync("tool.log", code === 2 ? "refused\n" : "ran\n");
    out({ type: "user", session_id, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: code === 2 ? "refused" : "hi", is_error: code === 2 }] } });
    if (code !== 2) await runHooks("PostToolUse", call);
    assistant("m3", "[step:red] the red test fails on base", { input_tokens: 20, output_tokens: 20 });
    out({ type: "rate_limit_event", session_id, uuid: "u1", rate_limit_info: { status: "allowed_warning", utilization: 0.82, resetsAt: 1793030400 } });
    out({ type: "result", subtype: "success", session_id, is_error: false, num_turns: 3, total_cost_usd: 0.01,
      usage: { input_tokens: 170, output_tokens: 35 } });
  } else {
    appendFileSync("steer.log", `${typeof m.message?.content === "string" ? m.message.content : JSON.stringify(m.message?.content)}\n`);
    assistant(`m${turn + 10}`, "[step:live] live and checked", { input_tokens: 10, output_tokens: 10 });
    out({ type: "result", subtype: "success", session_id, is_error: false, num_turns: 1, total_cost_usd: 0.01 + 0.01 * (turn - 1) });
  }
}
