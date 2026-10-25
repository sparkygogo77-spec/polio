/**
 * Agents panel, the runner: Pause holds a fake agent's tool call.
 *
 * A PC lane runs a stand-in for `claude -p` (helper/agents/testing/
 * fake-claude.mjs, no real Claude call) that runs the PreToolUse hook from
 * its --settings before its one tool call, as Claude Code does. J pauses
 * the lane before the call: the call must not run while paused, and must
 * run once J resumes. Then a steer line reaches the same session and the
 * lane finishes. The Agent SDK path is checked the same way, with `query`
 * stubbed. Every message the runner sends passes the contract's checks.
 *
 *   node tests/agents-runner-pause.mjs
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(50); }
  return fn();
}

let R = null, P = null, S = null, C = null;
try {
  R = await import("../helper/agents/runner.ts");
  P = await import("../helper/agents/pc.ts");
  S = await import("../helper/agents/spend.ts");
  C = await import("../helper/contract.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the runner and the PC adapters load", !!(R && P && S));

const fake = fileURLToPath(new URL("../helper/agents/testing/fake-claude.mjs", import.meta.url));
const request = (id, text) => ({ v: 1, kind: "request", id, text, target: "site", chips: [], action: null, how: "just-do-it" });
const j = (lane, d, text) => ({ v: 1, kind: "control", lane, do: d, by: "j", ...(text ? { text } : {}) });

if (R && P && S) {
  const dir = mkdtempSync(join(tmpdir(), "agents-pause-"));
  const seen = [];
  const bad = [];
  const make = (pc) => {
    const runner = new R.Runner({
      adapters: { pc }, stateDir: join(dir, "state"),
      spend: new S.SpendBook({ planWindowTokens: 1_000_000 }),
      memory: { ok: () => true, free: () => 8e9, minFree: 4e9 },
      workspace: (lane) => { const w = join(dir, `work-${lane}`); mkdirSync(w, { recursive: true }); return w; },
      apiKey: () => "sk-test-not-a-key",
    });
    runner.subscribe((m) => { seen.push(m); const p = C.problems(m); if (p.length) bad.push(p.join("; ")); });
    return runner;
  };
  const rowOf = (lane) => seen.filter((m) => m.kind === "lane" && m.lane === lane).at(-1);

  // ---- the plan path: claude -p with the hold hook ----------------------
  const runner = make(P.pcPlanAdapter({ command: { file: process.execPath, args: [fake] } }));
  const lane = "hero-calm";
  const work = join(dir, `work-${lane}`);
  try {
    runner.submit(request("req-1", "Hero calm"));
    const brief = await until(() => rowOf(lane)?.note === "reading the brief");
    check("the lane starts and reports its first step", !!brief, JSON.stringify(rowOf(lane)));
    const settings = JSON.parse(readFileSync(join(dir, "state", "lanes", lane, "settings.json"), "utf8"));
    const pre = settings.hooks?.PreToolUse?.[0]?.hooks?.[0];
    check("the lane's settings put the hold hook before every tool", settings.hooks?.PreToolUse?.[0]?.matcher === "*" && /hold-hook\.mjs" pre/.test(pre?.command ?? ""), pre?.command);
    check("the hook's timeout is longer than its hold (a timed-out hook lets the call through)", pre?.timeout > 3300, String(pre?.timeout));

    const paused = await runner.control(j(lane, "pause"));
    check("J's Pause is taken", paused.ok, JSON.stringify(paused));
    check("the row says paused", rowOf(lane)?.state === "paused");
    writeFileSync(join(work, "go"), "");
    await sleep(2500);
    check("while paused, the agent's tool call does not run", !existsSync(join(work, "tool.log")));

    const resumed = await runner.control(j(lane, "resume"));
    check("J's Resume is taken", resumed.ok, JSON.stringify(resumed));
    const ran = await until(() => existsSync(join(work, "tool.log")) && readFileSync(join(work, "tool.log"), "utf8"));
    check("after Resume, the held call runs (not refused)", ran === "ran\n", JSON.stringify(ran));

    const notJ = await runner.control({ ...j(lane, "pause"), by: "runner" });
    check("a pause by the runner without the spend cap is refused", !notJ.ok, JSON.stringify(notJ));

    await until(() => rowOf(lane)?.state === "question");
    const steer = await runner.control(j(lane, "steer", "keep the second badge row"));
    check("a steer line is taken", steer.ok, JSON.stringify(steer));
    const said = await until(() => existsSync(join(work, "steer.log")) && readFileSync(join(work, "steer.log"), "utf8"));
    check("and reaches the same session", (said || "").includes("keep the second badge row"), JSON.stringify(said));
    const done = await until(() => rowOf(lane)?.state === "done");
    check("the lane ends done, all 8 steps", !!done && rowOf(lane).stepsDone === 8, JSON.stringify(rowOf(lane)));
    const late = await runner.control(j(lane, "pause"));
    check("a control on an ended lane is refused", !late.ok);
  } finally {
    await runner.stopAll();
  }

  // ---- the API path: the Agent SDK's query(), stubbed --------------------
  const ranSdk = [];
  let options = null;
  const query = ({ prompt, options: o }) => {
    options = o;
    return (async function* () {
      for await (const m of prompt) {
        yield { type: "system", subtype: "init", session_id: "sdk-1" };
        yield { type: "assistant", session_id: "sdk-1", message: { id: "a1", content: [{ type: "text", text: "[step:brief] reading" }], usage: { input_tokens: 10, output_tokens: 1 } } };
        while (!existsSync(join(dir, "sdk-go"))) await sleep(50);
        const hook = o.hooks.PreToolUse[0].hooks[0];
        const r = await hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "echo" } }, "t1", { signal: new AbortController().signal });
        ranSdk.push(r?.hookSpecificOutput?.permissionDecision === "deny" ? "refused" : "ran");
        yield { type: "result", subtype: "success", session_id: "sdk-1", total_cost_usd: 0.02 };
        break;
      }
    })();
  };
  const api = make(P.pcApiAdapter({ query, apiKey: () => "sk-test-not-a-key" }));
  try {
    api.submit(request("req-2", "Sdk lane"));
    await until(() => rowOf("sdk-lane")?.note === "reading");
    check("an API lane gets the key in its env, and in auto mode", options?.env?.ANTHROPIC_API_KEY === "sk-test-not-a-key" && options?.permissionMode === "auto");
    await api.control(j("sdk-lane", "pause"));
    writeFileSync(join(dir, "sdk-go"), "");
    await sleep(800);
    check("while paused, the SDK lane's tool call waits in its hook", ranSdk.length === 0);
    await api.control(j("sdk-lane", "resume"));
    await until(() => ranSdk.length > 0);
    check("after Resume, it runs", ranSdk[0] === "ran", JSON.stringify(ranSdk));
  } finally {
    await api.stopAll();
  }

  check("every message the runner sent passes the contract", bad.length === 0 && seen.length > 0, bad.slice(0, 3).join(" | "));
  rmSync(dir, { recursive: true, force: true });
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
