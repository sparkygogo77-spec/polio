/**
 * Agents panel, the runner: spend sums correctly per lane.
 *
 * - Reading the stream: an assistant message that arrives twice (once per
 *   content block) counts once; cache reads and writes count as input; the
 *   result's running dollar total counts only by its growth.
 * - The spend book: a plan lane says its share of the plan window (and what
 *   it would cost), an API lane says dollars; the request's tokens are the
 *   sum of its lanes'; another request's lanes stay out; seconds count only
 *   while the agent runs.
 * - The cap: over it, the runner pauses every lane it can, as "runner" with
 *   reason "spend-cap", and Resume is refused until the cap is raised.
 * - A cloud lane: tokens can't be read, so it isn't in the spend line (not
 *   shown as 0), and Pause and Stop are refused with the reason.
 *
 *   node tests/agents-runner-spend.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
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

let St = null, S = null, R = null, P = null, Cl = null, C = null;
try {
  St = await import("../helper/agents/stream.ts");
  S = await import("../helper/agents/spend.ts");
  R = await import("../helper/agents/runner.ts");
  P = await import("../helper/agents/pc.ts");
  Cl = await import("../helper/agents/cloud.ts");
  C = await import("../helper/contract.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the stream reader, spend book and runner load", !!(St && S && R && P && Cl));

if (St && S && R && P && Cl) {
  // ---- reading the stream ------------------------------------------------
  const reader = new St.StreamReader();
  const usage = (msgs) => msgs.flatMap((m) => reader.read(m)).filter((e) => e.type === "usage");
  const a = (id, u) => ({ type: "assistant", message: { id, content: [], usage: u } });
  const first = usage([
    a("m1", { input_tokens: 100, output_tokens: 5 }),
    a("m1", { input_tokens: 100, output_tokens: 12 }),
    a("m2", { input_tokens: 10, cache_read_input_tokens: 300, cache_creation_input_tokens: 40, output_tokens: 3 }),
  ]);
  const sum = (es) => es.reduce((t, e) => ({ in: t.in + e.tokens.in, out: t.out + e.tokens.out, usd: t.usd + (e.usd ?? 0) }), { in: 0, out: 0, usd: 0 });
  const s1 = sum(first);
  check("a message sent as two blocks counts once, by its growth", s1.out === 15, JSON.stringify(s1));
  check("cache reads and writes count as input", s1.in === 450, JSON.stringify(s1));
  const cost = sum(usage([{ type: "result", subtype: "success", total_cost_usd: 0.05 }, { type: "result", subtype: "success", total_cost_usd: 0.08 }]));
  check("the running dollar total counts by its growth", Math.abs(cost.usd - 0.08) < 1e-9, String(cost.usd));
  const steps = reader.read({ type: "assistant", message: { id: "m3", content: [{ type: "text", text: "ok\n[step:green] closest tests pass\n[question] One page or many?" }] } });
  check("step and question lines are read from the agent's text",
    steps.some((e) => e.type === "step" && e.step === "green" && e.note === "closest tests pass") && steps.some((e) => e.type === "question" && e.text === "One page or many?"));

  // ---- the spend book ----------------------------------------------------
  let now = 0;
  const book = new S.SpendBook({ planWindowTokens: 1000, now: () => now });
  book.open("r1", "plan-lane", "plan");
  book.open("r1", "api-lane", "api");
  book.open("r2", "other", "api");
  book.running("plan-lane", true); book.running("api-lane", true);
  book.add("plan-lane", { in: 150, out: 50 }, 0.02);
  book.add("plan-lane", { in: 50, out: 0 }, null);
  book.add("api-lane", { in: 400, out: 100 }, 0.3);
  book.add("api-lane", { in: 0, out: 0 }, 0.05);
  book.add("other", { in: 9999, out: 9999 }, 9);
  now = 4000; book.running("api-lane", false);
  now = 10000;
  const m = book.message("r1");
  const plan = m.lanes.find((l) => l.lane === "plan-lane");
  const apiL = m.lanes.find((l) => l.lane === "api-lane");
  check("the spend line is a good contract message", C.problems(m).length === 0, C.problems(m).join("; "));
  check("the plan lane's tokens add up", plan.tokens.in === 200 && plan.tokens.out === 50, JSON.stringify(plan.tokens));
  check("the plan lane says its share of the plan window", plan.pays === "plan" && Math.abs(plan.planShare - 0.25) < 1e-9, String(plan.planShare));
  check("the API lane's dollars add up", apiL.pays === "api" && Math.abs(apiL.usd - 0.35) < 1e-9 && apiL.planShare === null, JSON.stringify(apiL));
  check("the request's tokens are the sum of its lanes'", m.tokens.in === 600 && m.tokens.out === 150, JSON.stringify(m.tokens));
  check("another request's lanes stay out", m.lanes.length === 2 && !m.lanes.some((l) => l.lane === "other"));
  check("seconds count only while the agent runs", apiL.seconds === 4 && plan.seconds === 10, `${apiL.seconds} ${plan.seconds}`);

  // ---- the cap, through the runner ----------------------------------------
  const dir = mkdtempSync(join(tmpdir(), "agents-spend-"));
  const seen = [];
  const bad = [];
  const results1 = [0.01, 0.02];
  let release = null;
  const query = ({ prompt }) => (async function* () {
    for await (const _ of prompt) {
      yield { type: "system", subtype: "init", session_id: "s" };
      for (const [i, c] of results1.entries()) {
        yield { type: "assistant", session_id: "s", message: { id: `x${i}`, content: [{ type: "text", text: "[step:fix] fixing" }], usage: { input_tokens: 100, output_tokens: 10 } } };
        yield { type: "result", subtype: "success", session_id: "s", total_cost_usd: c };
      }
      await new Promise((r) => { release = r; });
      break;
    }
  })();
  const fake = fileURLToPath(new URL("../helper/agents/testing/fake-claude.mjs", import.meta.url));
  const spend = new S.SpendBook({ planWindowTokens: 1_000_000, caps: { usdPerDay: 0.015 } });
  const runner = new R.Runner({
    adapters: { pc: P.pcApiAdapter({ query, apiKey: () => "sk-test-not-a-key" }), cloud: Cl.cloudAdapter({ command: { file: process.execPath, args: [fake] } }) },
    stateDir: join(dir, "state"), spend,
    memory: { ok: () => true, free: () => 8e9, minFree: 4e9 },
    workspace: (lane) => { const w = join(dir, lane); mkdirSync(w, { recursive: true }); return w; },
    apiKey: () => "sk-test-not-a-key",
  });
  runner.subscribe((x) => { seen.push(x); const p = C.problems(x); if (p.length) bad.push(`${x.kind}: ${p.join("; ")}`); });
  const req = (id, text, target) => ({ v: 1, kind: "request", id, text, target, chips: [], action: null, how: "just-do-it" });
  try {
    runner.submit(req("r-cap", "Over cap", "site"));
    const capPause = await until(() => seen.find((x) => x.kind === "control" && x.do === "pause"));
    check("over the cap, the runner pauses the lane as runner, reason spend-cap", capPause?.by === "runner" && capPause?.reason === "spend-cap", JSON.stringify(capPause));
    check("and the row says paused, with why", seen.filter((x) => x.kind === "lane" && x.lane === "over-cap").at(-1)?.state === "paused");
    const last = seen.filter((x) => x.kind === "spend" && x.requestId === "r-cap").at(-1);
    check("the lane's spend is the result's growth, not the sum of totals", Math.abs(last.lanes[0].usd - 0.02) < 1e-9 && last.lanes[0].tokens.in === 200, JSON.stringify(last.lanes[0]));
    const again = await runner.control({ v: 1, kind: "control", lane: "over-cap", do: "resume", by: "j" });
    check("Resume is refused while still over the cap", !again.ok && /cap/.test(again.error), JSON.stringify(again));

    // ---- a cloud lane ------------------------------------------------------
    runner.submit(req("r-cloud", "Cloud lane", "builder-ui"));
    const started = await until(() => seen.find((x) => x.kind === "lane" && x.lane === "cloud-lane" && /claude\.ai\/code\/session_01FAKECLOUD/.test(x.note)));
    check("a cloud lane starts a cloud session and links it", !!started, JSON.stringify(started));
    const p = await runner.control({ v: 1, kind: "control", lane: "cloud-lane", do: "pause", by: "j" });
    const s = await runner.control({ v: 1, kind: "control", lane: "cloud-lane", do: "stop", by: "j" });
    check("Pause and Stop on a cloud lane are refused, saying why", !p.ok && !s.ok && /claude\.ai/.test(p.error) && /claude\.ai/.test(s.error), `${p.error} | ${s.error}`);
    const st = await runner.control({ v: 1, kind: "control", lane: "cloud-lane", do: "steer", by: "j", text: "use one long page" });
    const log = join(dir, "cloud-lane", "cloud.log");
    check("a steer line goes to the cloud session", st.ok && existsSync(log) && readFileSync(log, "utf8").includes("use one long page"), JSON.stringify(st));
    const cloudSpend = runner.snapshot().find((x) => x.kind === "spend" && x.requestId === "r-cloud");
    check("the cloud lane isn't in the spend line (its tokens can't be read), not shown as 0", cloudSpend && cloudSpend.lanes.length === 0 && cloudSpend.tokens.in === 0, JSON.stringify(cloudSpend));
  } finally {
    release?.();
    await runner.stopAll();
    rmSync(dir, { recursive: true, force: true });
  }
  check("every message the runner sent passes the contract", bad.length === 0 && seen.length > 0, bad.slice(0, 3).join(" | "));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
