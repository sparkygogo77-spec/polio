/**
 * Agents panel, the runner: Pause holds a fake agent's tool call.
 *
 * A PC lane runs a stand-in for `claude -p` (helper/agents/testing/
 * fake-claude.mjs, no real Claude call) that runs the PreToolUse hook from
 * its --settings before its one tool call, as Claude Code does. J pauses
 * the lane before the call: the call must not run while paused, and must
 * run once J resumes. Then a steer line reaches the same session and the
 * lane finishes. The run is on J's plan only: `claude -p` with stream-json,
 * no --bare or --max-budget-usd, and no Claude credential in its env even
 * when the helper has some; the plan-limit reading reaches the spend line,
 * with no dollars anywhere. Every message passes the contract's checks.
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
check("the runner and the PC adapter load", !!(R && P && S));

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
      // The helper may have credentials of its own; none may reach the agent.
      baseEnv: { ...process.env, ANTHROPIC_API_KEY: "sk-test-not-a-key", CLAUDE_CODE_OAUTH_TOKEN: "test-not-a-token", ANTHROPIC_AUTH_TOKEN: "test" },
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
    const argv = JSON.parse(readFileSync(join(work, "argv.json"), "utf8"));
    const flags = argv.args.join(" ");
    check("the plan path runs claude -p with stream-json in and out", /-p --input-format stream-json --output-format stream-json --verbose --permission-mode auto/.test(flags), flags.slice(0, 160));
    check("it never passes --bare or --max-budget-usd", ["--bare", "--max-budget-usd"].every((f) => !argv.args.includes(f)) && !argv.args.includes("bypassPermissions"));
    check("no Claude credential reaches the agent: it uses J's own sign-in", argv.credentials.length === 0, argv.credentials.join(", "));
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
    const spendLine = seen.filter((m) => m.kind === "spend" && m.requestId === "req-1").at(-1);
    check("the plan-limit reading reaches the spend line", spendLine?.plan?.used === 0.82 && spendLine.plan.status === "allowed_warning" && spendLine.plan.resetsAt === 1793030400, JSON.stringify(spendLine?.plan));
    check("the lane's tokens are counted from its stream", spendLine?.lanes[0]?.pays === "plan" && spendLine.lanes[0].tokens.in === 100 + 80 + 20 && spendLine.lanes[0].tokens.out === 10 + 5 + 20, JSON.stringify(spendLine?.lanes[0]));
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

  check("every message the runner sent passes the contract", bad.length === 0 && seen.length > 0, bad.slice(0, 3).join(" | "));
  check("no message carries dollars (the fake's total_cost_usd is ignored)", !seen.some((m) => /usd|planShare/i.test(JSON.stringify(m))));
  rmSync(dir, { recursive: true, force: true });
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
