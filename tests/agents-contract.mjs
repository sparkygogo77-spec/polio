/**
 * The Agents panel's contract (step 0): the typed messages between the dock
 * and the runner, and a fake runner the dock and the other lanes build on.
 *
 * Good messages pass the checks and bad ones are named: a missing token
 * count, an unknown state, steps out of range or out of step with the step
 * under way, a J-only control sent by anyone else, a version newer than the
 * reader. The fake runner's script is all good messages, walks the lane
 * through all 8 steps and every state, and waits on J's controls unless
 * told to play them itself.
 *
 *   node tests/agents-contract.mjs
 */
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

let C = null;
let F = null;
try { C = await import("../helper/contract.ts"); F = await import("../helper/fake.ts"); } catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the contract and the fake runner load", !!(C && F && typeof C.problems === "function" && typeof F.fakeRunner === "function"));

if (C && F) {
  const { problems, parse, STEPS, STATES, CONTRACT_VERSION: v } = C;
  const script = F.fakeScript();
  const bad = script.map((m, i) => [i, problems(m)]).filter(([, p]) => p.length);
  check("every message in the fake script is good", bad.length === 0, bad.map(([i, p]) => `#${i} ${p.join("; ")}`).join(" | "));
  check("there are 8 steps, brief to live", STEPS.join(",") === "brief,red,fix,green,push,ci,merge,live");

  const lane = script.find((m) => m.kind === "lane");
  const spend = script.find((m) => m.kind === "spend");
  const control = script.find((m) => m.kind === "control" && m.do === "pause");
  const merge = script.find((m) => m.kind === "merge");
  const plan = script.find((m) => m.kind === "plan");
  const named = (name, m, needle) => {
    const p = problems(m);
    check(name, p.some((x) => x.includes(needle)), p.join("; ") || "accepted");
  };

  const noOut = structuredClone(spend); delete noOut.lanes[0].tokens.out; noOut.tokens.out = 0;
  named("a lane's spend with no output token count is refused", noOut, "tokens.out");
  const noTokens = structuredClone(spend); delete noTokens.tokens;
  named("a request's spend with no tokens is refused", noTokens, "tokens missing");
  named("a request total that is not the sum of its lanes is refused", { ...spend, tokens: { in: 1, out: 1 } }, "sum");
  const planRun = structuredClone(spend); planRun.lanes[0].pays = "plan";
  named("a run on J's plan must say its share of the plan", planRun, "planShare");
  planRun.lanes[0].planShare = 0.04; planRun.lanes[0].usd = null;
  check("and with its share it is good, with no dollars", problems(planRun).length === 0, problems(planRun).join("; "));
  const apiRun = structuredClone(spend); apiRun.lanes[0].pays = "api"; apiRun.lanes[0].usd = null;
  named("an API run must say its dollars", apiRun, "usd");

  named("an unknown state is refused", { ...lane, state: "sleeping" }, "unknown state");
  named("nine steps done is out of range", { ...lane, stepsDone: 9, stepNow: null }, "stepsDone");
  named("minus one steps done is out of range", { ...lane, stepsDone: -1 }, "stepsDone");
  named("half a step is out of range", { ...lane, stepsDone: 2.5 }, "stepsDone");
  named("the step under way must be the next one", { ...lane, stepsDone: 3, stepNow: "fix" }, "stepNow");
  named("done before the 8th step is refused", { ...lane, state: "done" }, "done means");
  named("eta is seconds or null", { ...lane, etaSeconds: "soon" }, "etaSeconds");
  named("a lane runs in the cloud or on the PC", { ...lane, where: "moon" }, "where");

  named("pause from the runner, without the spend cap, is refused", { ...control, by: "runner" }, "J's only");
  check("pause from the runner at the spend cap is good", problems({ ...control, by: "runner", reason: "spend-cap" }).length === 0);
  named("stop from the runner is refused, cap or not", { ...control, do: "stop", by: "runner", reason: "spend-cap" }, "J's only");
  named("an agent cannot send a control", { ...control, by: "agent" }, "by must be");
  named("steer needs its line", { ...control, do: "steer" }, "needs text");
  named("an unknown control is refused", { ...control, do: "explode" }, "unknown control");

  named("a merge line needs P1 to P3", { ...merge, p: 4 }, "p must be");
  named("a merge line needs generality 1 to 5", { ...merge, generality: 0 }, "generality");
  named("a plan lane needs its test", { ...plan, lanes: [{ ...plan.lanes[0], test: "" }] }, "test missing");
  named("a plan lane stacked on a lane not in the plan is refused", { ...plan, lanes: [{ ...plan.lanes[0], stackedOn: "ghost" }] }, "stackedOn");
  const req = script.find((m) => m.kind === "request");
  named("an unknown target is refused", { ...req, target: "everything" }, "target");
  named("an unknown part action is refused", { ...req, action: "delete" }, "part action");
  check("each part action is accepted", C.PART_ACTIONS.every((a) => problems({ ...req, action: a }).length === 0) && C.PART_ACTIONS.length === 5);
  named("a shot chip needs its ref", { ...req, chips: [{ kind: "shot" }] }, "chips[0]");

  named("a message newer than the reader is refused", { ...lane, v: v + 1 }, "newer");
  named("a message with no version is refused", { ...lane, v: undefined }, "version");
  named("an unknown kind is refused", { ...lane, kind: "gossip" }, "unknown kind");
  let threw = "";
  try { parse(JSON.stringify({ ...lane, state: "sleeping" })); } catch (e) { threw = e.message; }
  check("parse throws with the problem named", threw.includes("unknown state"), threw);
  check("parse reads a good line back as it was", JSON.stringify(parse(JSON.stringify(lane))) === JSON.stringify(lane));

  const rows = script.filter((m) => m.kind === "lane");
  const seen = new Set(rows.map((r) => r.state));
  check("the fake lane goes through every state", STATES.every((s) => seen.has(s)), [...seen].join(", "));
  const done = rows.map((r) => r.stepsDone);
  check("its steps only go forward, 0 to 8, missing none", done.every((n, i) => i === 0 || n === done[i - 1] || n === done[i - 1] + 1) && done[0] === 0 && done.at(-1) === 8);
  check("each of the 8 steps is under way at some point", STEPS.every((s) => rows.some((r) => r.stepNow === s && r.state === "working")));
  check("it ends done, with the spend after", rows.at(-1).state === "done" && script.at(-1).kind === "spend");
  const ctl = script.filter((m) => m.kind === "control").map((c) => c.do);
  check("J answers, pauses, resumes and approves, in that order", ctl.join(",") === "answer,pause,resume,approve", ctl.join(","));

  // Played with auto, the stream is the runner's half of the script.
  const auto = [];
  for await (const m of F.fakeRunner({ auto: true }).messages) auto.push(m);
  check("played with auto, the runner sends its half of the script", auto.length === script.filter((m) => m.kind !== "request" && m.kind !== "control").length);

  // Played by hand, it waits on each of J's controls.
  const r = F.fakeRunner();
  const it = r.messages[Symbol.asyncIterator]();
  const got = [];
  // A pull that times out keeps its next() for the following pull, so no message is lost.
  let pending = null;
  const pull = async () => {
    pending ??= it.next();
    const n = await Promise.race([pending, new Promise((res) => setTimeout(() => res("waiting"), 50))]);
    if (n === "waiting") return n;
    pending = null;
    if (!n.done) got.push(n.value);
    return n;
  };
  while ((await pull()) !== "waiting") { /* up to the question */ }
  check("by hand, it stops on the question until J answers", got.at(-1)?.state === "question", got.at(-1)?.state);
  r.send({ v, kind: "control", lane: "export-gallery", do: "pause", by: "j" });
  check("a control the script is not waiting on does not let it go on", (await pull()) === "waiting");
  r.send({ v, kind: "control", lane: "export-gallery", do: "answer", by: "j", text: "One long page" });
  const next = await pull();
  check("the answer lets it go on", next !== "waiting" && next.value.stepsDone === 1, JSON.stringify(next.value ?? next));
  r.send({ v, kind: "control", lane: "export-gallery", do: "resume", by: "j" });
  r.send({ v, kind: "control", lane: "export-gallery", do: "approve", by: "j" });
  let n; do { n = await pull(); } while (n !== "waiting" && !n.done);
  check("with its controls sent, it plays to the end", n !== "waiting" && got.at(-1)?.kind === "spend");
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
