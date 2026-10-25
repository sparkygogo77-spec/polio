#!/usr/bin/env node
/**
 * The command hook a `claude -p` lane runs around every tool call. Claude
 * Code starts it with the call as JSON on stdin (tool_name, tool_input).
 *
 *   node hold-hook.mjs pre  <gate dir> <lock dir> <lane> [hold seconds]
 *   node hold-hook.mjs post <gate dir> <lock dir> <lane>
 *
 * pre:
 *   - stopped: refuse the call (exit 2; stderr is what the agent reads).
 *   - paused: wait until Resume. A PreToolUse hook that reaches its timeout
 *     does NOT block the call (hooks doc, "Timeouts"), so before the hold
 *     runs out the hook refuses the call instead of letting it through.
 *     The settings give the hook a timeout longer than the hold.
 *   - a build command (next build, npm run build/check): wait for the one
 *     build lock (J's rule: one big build at a time), then take it.
 * post: give the build lock back if this lane holds it.
 *
 * A hook is a check, not a wall: the agent runs as J's user and could
 * delete these files. The guard-hooks lane refuses commands that touch the
 * helper's folder.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isBuild, takeBuildLock, giveBuildLock } from "./build-lock.ts";

const [mode, gateDir, lockDir, lane, holdArg] = process.argv.slice(2);
const holdMs = Number(holdArg ?? 3300) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let input = "";
for await (const chunk of process.stdin) input += chunk;
let call = {};
try { call = JSON.parse(input); } catch {}
const command = String(call?.tool_input?.command ?? "");

const refuse = (why) => { process.stderr.write(why); process.exit(2); };

if (mode === "post") {
  if (isBuild(command)) giveBuildLock(lockDir, lane);
  process.exit(0);
}

const end = Date.now() + holdMs;
for (;;) {
  if (existsSync(join(gateDir, "stopped"))) refuse("This lane was stopped by J. Do not run more tools; end your turn.");
  if (!existsSync(join(gateDir, "paused"))) break;
  if (Date.now() > end) refuse("This lane is paused by J. Wait for Resume, then try the same step again.");
  await sleep(200);
}

if (isBuild(command)) {
  for (;;) {
    if (existsSync(join(gateDir, "stopped"))) refuse("This lane was stopped by J.");
    if (takeBuildLock(lockDir, lane)) break;
    if (Date.now() > end) refuse(`Another build is running (${readFileSync(join(lockDir, "build.lock"), "utf8").trim()}). Try again later.`);
    await sleep(500);
  }
}
process.exit(0);
