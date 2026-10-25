/**
 * Agents panel, the runner: spend is tokens on J's plan, summed per lane.
 *
 * J (2026-10-25): "no api, only plan usage and tokens".
 * - Reading the stream: an assistant message that arrives twice (once per
 *   content block) counts once; cache reads and writes count as input;
 *   `total_cost_usd` is ignored; a `rate_limit_event` becomes the plan-limit
 *   reading (0 to 1).
 * - The spend book: tokens per lane, the request's tokens are the sum of its
 *   lanes', another request's lanes stay out, seconds count only while the
 *   agent runs, a cloud lane's tokens are null (not measured), never 0.
 * - Caps in tokens: per request pauses only that request's lanes; per day
 *   pauses every lane; the plan's limit reached ("rejected") pauses every
 *   lane. Each as "runner", reason "spend-cap". Resume waits until the cap
 *   is raised.
 * - A cloud lane: "on your plan, not measured", and Pause and Stop are
 *   refused with the reason.
 * - There is no API-key adapter any more.
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
check("the contract is v2: plan or cloud, no API way", C?.CONTRACT_VERSION === 2 && C.PAYS.join(",") === "plan,cloud", `${C?.CONTRACT_VERSION} ${C?.PAYS}`);
check("there is no API-key adapter", P && !("pcApiAdapter" in P));

if (St && S && R && P && Cl && C?.CONTRACT_VERSION === 2) {
  // ---- reading the stream ------------------------------------------------
  const reader = new St.StreamReader();
  const events = (msgs) => msgs.flatMap((m) => reader.read(m));
  const a = (id, u) => ({ type: "assistant", message: { id, content: [], usage: u } });
  const first = events([
    a("m1", { input_tokens: 100, output_tokens: 5 }),
    a("m1", { input_tokens: 100, output_tokens: 12 }),
    a("m2", { input_tokens: 10, cache_read_input_tokens: 300, cache_creation_input_tokens: 40, output_tokens: 3 }),
    { type: "result", subtype: "success", total_cost_usd: 0.05 },
  ]);
  const usage = first.filter((e) => e.type === "usage");
  const s1 = usage.reduce((t, e) => ({ in: t.in + e.tokens.in, out: t.out + e.tokens.out }), { in: 0, out: 0 });
  check("a message sent as two blocks counts once, by its growth", s1.out === 15, JSON.stringify(s1));
  check("cache reads and writes count as input", s1.in === 450, JSON.stringify(s1));
  check("total_cost_usd is ignored: no event carries dollars", !first.some((e) => "usd" in e) && usage.length === 3, JSON.stringify(first));
  const plan = events([{ type: "rate_limit_event", rate_limit_info: { status: "allowed", utilization: 0.4, resetsAt: 1793030400 } }]);
  check("a rate_limit_event becomes the plan reading", plan[0]?.type === "plan" && plan[0].plan.used === 0.4 && plan[0].plan.resetsAt === 1793030400 && plan[0].plan.status === "allowed", JSON.stringify(plan));
  const pct = St.planUseOf({ status: "allowed_warning", utilization: 82, resetsAt: 1793030400000 });
  check("a percentage and a time in milliseconds are read as share and seconds", pct?.used === 0.82 && pct.resetsAt === 1793030400, JSON.stringify(pct));
  check("a reading with no share, or an unknown status, is dropped", St.planUseOf({ status: "allowed" }) === null && St.planUseOf({ status: "odd", utilization: 0.1 }) === null);
  const steps = reader.read({ type: "assistant", message: { id: "m3", content: [{ type: "text", text: "ok\n[step:green] closest tests pass\n[question] One page or many?" }] } });
  check("step and question lines are read from the agent's text",
    steps.some((e) => e.type === "step" && e.step === "green" && e.note === "closest tests pass") && steps.some((e) => e.type === "question" && e.text === "One page or many?"));

  // ---- the spend book ----------------------------------------------------
  let now = new Date(2026, 9, 25, 10).getTime();
  const book = new S.SpendBook({ now: () => now });
  book.open("r1", "lane-a", "plan");
  book.open("r1", "lane-b", "plan");
  book.open("r1", "lane-c", "cloud", false);
  book.open("r2", "other", "plan");
  book.running("lane-a", true); book.running("lane-b", true);
  book.add("lane-a", { in: 150, out: 50 });
  book.add("lane-a", { in: 50, out: 0 });
  book.add("lane-b", { in: 400, out: 100 });
  book.add("lane-c", { in: 999, out: 999 });
  book.add("other", { in: 1000, out: 1000 });
  now += 4000; book.running("lane-b", false);
  now += 6000;
  const m = book.message("r1");
  const la = m.lanes.find((l) => l.lane === "lane-a");
  const lb = m.lanes.find((l) => l.lane === "lane-b");
  const lc = m.lanes.find((l) => l.lane === "lane-c");
  check("the spend line is a good v2 contract message", C.problems(m).length === 0, C.problems(m).join("; "));
  check("each lane's tokens add up", la.tokens.in === 200 && la.tokens.out === 50 && lb.tokens.in === 400 && lb.tokens.out === 100, JSON.stringify([la.tokens, lb.tokens]));
  check("the request's tokens are the sum of its measured lanes'", m.tokens.in === 600 && m.tokens.out === 150, JSON.stringify(m.tokens));
  check("a cloud lane's tokens are null (not measured), not 0", lc && lc.tokens === null && lc.pays === "cloud", JSON.stringify(lc));
  check("another request's lanes stay out", m.lanes.length === 3 && !m.lanes.some((l) => l.lane === "other"));
  check("seconds count only while the agent runs", lb.seconds === 4 && la.seconds === 10, `${lb.seconds} ${la.seconds}`);
  check("no plan reading yet: plan is null", m.plan === null);
  check("today's tokens: every request's measured lanes", book.today() === 750 + 2000, String(book.today()));
  now += 24 * 3600_000;
  check("a new day starts at 0", book.today() === 0, String(book.today()));

  // ---- token caps, through the runner ------------------------------------
  // A stand-in plan adapter: each lane reports what the test feeds it.
  const feeds = new Map();
  const stub = {
    where: "pc", pays: "plan", can: { pause: true, stop: true, tokens: true },
    start(spec) {
      const queue = [];
      let wake = null;
      feeds.set(spec.lane, (e) => { queue.push(e); wake?.(); });
      return {
        events: (async function* () {
          for (;;) {
            while (queue.length) { const e = queue.shift(); if (e === "end") return; yield e; }
            await new Promise((r) => { wake = r; }); wake = null;
          }
        })(),
        async steer() {}, async stop() { feeds.get(spec.lane)?.("end"); },
      };
    },
  };
  const dir = mkdtempSync(join(tmpdir(), "agents-spend-"));
  const seen = [];
  const bad = [];
  const fake = fileURLToPath(new URL("../helper/agents/testing/fake-claude.mjs", import.meta.url));
  const spend = new S.SpendBook({ caps: { tokensPerRequest: 1000, tokensPerDay: 5000 } });
  const runner = new R.Runner({
    adapters: { pc: stub, cloud: Cl.cloudAdapter({ command: { file: process.execPath, args: [fake] } }) },
    stateDir: join(dir, "state"), spend, atOnce: 5,
    memory: { ok: () => true, free: () => 8e9, minFree: 4e9 },
    workspace: (lane) => { const w = join(dir, lane); mkdirSync(w, { recursive: true }); return w; },
  });
  runner.subscribe((x) => { seen.push(x); const p = C.problems(x); if (p.length) bad.push(`${x.kind}: ${p.join("; ")}`); });
  const req = (id, text, target = "site") => ({ v: 1, kind: "request", id, text, target, chips: [], action: null, how: "just-do-it" });
  const row = (lane) => seen.filter((x) => x.kind === "lane" && x.lane === lane).at(-1);
  const capPauses = (lane) => seen.filter((x) => x.kind === "control" && x.lane === lane && x.by === "runner" && x.reason === "spend-cap").length;
  const feed = (lane, n) => feeds.get(lane)({ type: "usage", tokens: { in: n, out: 0 } });
  const j = (lane, d) => runner.control({ v: 2, kind: "control", lane, do: d, by: "j" });
  try {
    runner.submit(req("r-a", "Lane one"));
    runner.submit(req("r-b", "Lane two"));
    await until(() => feeds.has("lane-one") && feeds.has("lane-two"));
    feed("lane-one", 600); feed("lane-two", 300);
    await sleep(100);
    check("under the caps, nothing is paused", row("lane-one").state === "working" && row("lane-two").state === "working");
    feed("lane-one", 500);
    await until(() => capPauses("lane-one") === 1);
    check("over the per-request cap, that request's lane pauses, as runner, spend-cap", capPauses("lane-one") === 1 && row("lane-one").state === "paused" && /this request/.test(row("lane-one").note), JSON.stringify(row("lane-one")));
    check("the other request's lane carries on", row("lane-two").state === "working" && capPauses("lane-two") === 0);
    const early = await j("lane-one", "resume");
    check("Resume is refused while the request is over its cap", !early.ok && /cap/.test(early.error), JSON.stringify(early));
    runner.setCaps({ tokensPerRequest: 10_000, tokensPerDay: 5000 });
    const later = await j("lane-one", "resume");
    check("after J raises the cap, Resume works", later.ok && row("lane-one").state === "working", JSON.stringify(later));

    feed("lane-two", 3700);
    await until(() => capPauses("lane-one") === 2 && capPauses("lane-two") === 1);
    check("over the per-day cap, every lane pauses", row("lane-one").state === "paused" && row("lane-two").state === "paused" && /today/.test(row("lane-two").note), `${row("lane-one").note} | ${row("lane-two").note}`);
    runner.setCaps({});
    await j("lane-one", "resume"); await j("lane-two", "resume");
    feeds.get("lane-two")({ type: "plan", plan: { used: 1, resetsAt: 1793030400, status: "rejected" } });
    await until(() => capPauses("lane-one") === 3 && capPauses("lane-two") === 2);
    check("when Claude Code says the plan's limit is reached, every lane pauses", row("lane-one").state === "paused" && /plan's limit/.test(row("lane-one").note), row("lane-one").note);
    const sp = seen.filter((x) => x.kind === "spend" && x.requestId === "r-b").at(-1);
    check("the spend line carries the plan reading", sp?.plan?.status === "rejected" && sp.plan.used === 1, JSON.stringify(sp?.plan));

    // ---- a cloud lane ------------------------------------------------------
    runner.submit(req("r-cloud", "Cloud lane", "builder-ui"));
    const started = await until(() => seen.find((x) => x.kind === "lane" && x.lane === "cloud-lane" && /on your plan, not measured: https:\/\/claude\.ai\/code\/session_01FAKECLOUD/.test(x.note)));
    check("a cloud lane starts a cloud session: on your plan, not measured", !!started, JSON.stringify(row("cloud-lane")));
    const p = await j("cloud-lane", "pause");
    const s = await j("cloud-lane", "stop");
    check("Pause and Stop on a cloud lane are refused, saying why", !p.ok && !s.ok && /claude\.ai/.test(p.error) && /claude\.ai/.test(s.error), `${p.error} | ${s.error}`);
    const st = await runner.control({ v: 2, kind: "control", lane: "cloud-lane", do: "steer", by: "j", text: "use one long page" });
    const log = join(dir, "cloud-lane", "cloud.log");
    check("a steer line goes to the cloud session", st.ok && existsSync(log) && readFileSync(log, "utf8").includes("use one long page"), JSON.stringify(st));
    const cloudSpend = runner.snapshot().find((x) => x.kind === "spend" && x.requestId === "r-cloud");
    check("the cloud lane is in its spend line with tokens null", cloudSpend?.lanes.length === 1 && cloudSpend.lanes[0].tokens === null && cloudSpend.tokens.in === 0, JSON.stringify(cloudSpend));
  } finally {
    await runner.stopAll();
    rmSync(dir, { recursive: true, force: true });
  }
  check("every message the runner sent passes the v2 contract", bad.length === 0 && seen.length > 0, bad.slice(0, 3).join(" | "));
  check("no message carries dollars", !seen.some((x) => /usd|planShare/i.test(JSON.stringify(x))));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
