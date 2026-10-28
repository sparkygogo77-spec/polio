/**
 * Agents panel, the last wiring (helper/server/main.ts): a lane whose CI is
 * green goes through mergeStep, then the live check, and both results reach
 * the dock as merge lines.
 *
 * - The live board's "before" reading is taken before anything merges.
 * - `ours` is true only for a lane this helper's runner started.
 * - A merge that waits for J goes on when he presses Approve on that lane.
 * - The tray's Pause all and Resume all.
 * - Every process the helper starts is hidden (windowsHide or
 *   CREATE_NO_WINDOW), and the helper never takes an API key.
 *
 * GitHub, git and the browser are stand-ins: nothing real is merged or opened.
 *
 *   node tests/agents-after-green.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = () => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};

let M = null, R = null, K = null, problems = null, V = null;
try {
  M = await import("../helper/server/main.ts");
  R = await import("../helper/merge/route.ts");
  K = await import("../helper/livecheck/check.ts");
  ({ problems, CONTRACT_VERSION: V } = await import("../helper/contract.ts"));
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("main.ts loads without starting the helper", !!M && typeof M.afterGreen === "function" && typeof M.withMerges === "function");
if (!M?.afterGreen || !M?.withMerges) done();

// ---- stand-ins -----------------------------------------------------------------
const facts = (lane) => ({
  lane, branch: `claude/${lane}`, commit: "abcdef1234567890", files: ["helper/merge/gate.ts"],
  p: 2, generality: 5, fixes: "The hero's hover is calmer", before: "hover-calm 6/6, red on base",
  after: "the live check", prTitle: "P2: calmer hover", prBody: "body", after_branch: null,
});
const board = { a: { x: 0, y: 0, w: 100, h: 50 }, b: { x: 0, y: 60, w: 100, h: 50 } };
function setup({ ours = true, token = null, github, moved = false, browser = true, landed = "mergesha" } = {}) {
  const events = [];
  const sent = [];
  let reads = 0, merged = false;
  const fakeBrowser = async () => {
    if (!browser) return null;
    events.push("browser");
    return {
      deps: {
        version: async () => "mergesha",
        read: async () => { reads++; events.push(merged ? "read-after" : "read-before"); return merged && moved ? { ...board, b: { ...board.b, y: 90 } } : board; },
        shoot: async (name) => `C:/shots/${name}.png`,
        sleep: async () => {},
      },
      close: async () => events.push("close"),
    };
  };
  const deps = {
    ours: () => ours,
    onlyYou: () => false,
    facts: async (lane) => (events.push("facts"), facts(lane)),
    token: async () => token,
    github,
    browser: fakeBrowser,
    landed: async () => { events.push("landed"); merged = true; return landed; },
    merge: async (...a) => { events.push("merge"); return R.mergeStep(...a); },
    check: async (...a) => { events.push("check"); return K.liveCheck(...a); },
  };
  return { deps, events, sent, send: (m) => sent.push(m), reads: () => reads };
}
function github() {
  const calls = [];
  let head = "claude/hover-calm";
  const fetch = async (url, init = {}) => {
    const path = url.replace("https://api.github.com", "");
    const method = init.method ?? "GET";
    calls.push({ method, path });
    const ok = (data, status = 200) => ({ ok: status < 300, status, json: async () => data });
    if (method === "GET" && path.startsWith("/repos/sparkygogo77-spec/polio/pulls?state=open")) return ok([]);
    if (method === "POST" && path === "/repos/sparkygogo77-spec/polio/pulls") { head = JSON.parse(init.body).head?.split(":").at(-1) ?? head; return ok({ number: 501 }, 201); }
    if (method === "GET" && /\/pulls\/\d+$/.test(path)) return ok({ head: { sha: "headsha", ref: head, repo: { full_name: "sparkygogo77-spec/polio" } }, mergeable: true, mergeable_state: "clean" });
    if (method === "GET" && path.includes("/check-runs")) return ok({ check_runs: [{ name: "tests", status: "completed", conclusion: "success" }] });
    if (method === "PUT" && path.endsWith("/merge")) return ok({ sha: "mergesha", merged: true });
    return ok({}, 404);
  };
  return { fetch, calls };
}
const valid = (m) => problems(m).length === 0;

// ---- afterGreen: the GitHub way --------------------------------------------------
{
  const gh = github();
  const s = setup({ token: "t", github: { fetch: gh.fetch } });
  const step = await M.afterGreen("hover-calm", { ...s.deps, send: s.send });
  const order = s.events.filter((e) => ["read-before", "merge", "landed", "check", "read-after"].includes(e));
  check("green lane: the before reading, then merge, then the live check",
    order[0] === "read-before" && order.indexOf("merge") > order.lastIndexOf("read-before") && order.indexOf("check") > order.indexOf("merge") && order.at(-1) === "read-after", order.join(" → "));
  check("the browser is closed between the before reading and the merge", s.events.indexOf("close") < s.events.indexOf("merge"));
  check("mergeStep merged it on GitHub", step?.line.status === "merged" && step.line.pr === 501 && gh.calls.some((c) => c.method === "PUT"));
  check("the dock gets two merge lines: merged, then checked", s.sent.map((m) => m.status).join(",") === "merged,checked", s.sent.map((m) => m.status).join(","));
  check("both lines are valid contract messages", s.sent.every(valid), s.sent.map((m) => problems(m).join("; ")).join(" | "));
  check("the checked line has the before and after shots and Undo", s.sent[1]?.shots?.before === "C:/shots/hover-calm-before.png" && s.sent[1]?.shots?.after === "C:/shots/hover-calm-after.png" && s.sent[1]?.undo === true);
  check("the checked line keeps the PR number", s.sent[1]?.pr === 501);
}

// ---- the chat way (no token) -------------------------------------------------------
{
  const s = setup({ token: null });
  const step = await M.afterGreen("hover-calm", { ...s.deps, send: s.send });
  check("no token: the project-chat lines to copy", !!step?.copy && /^PR: open from claude\/hover-calm/.test(step.copy));
  check("no token: the live check runs once the base holds the commit", s.sent.map((m) => m.status).join(",") === "waiting-ci,checked" && s.events.includes("landed"), s.sent.map((m) => m.status).join(","));
}

// ---- a part moved ---------------------------------------------------------------------
{
  const s = setup({ token: "t", github: { fetch: github().fetch }, moved: true });
  await M.afterGreen("hover-calm", { ...s.deps, send: s.send });
  const last = s.sent.at(-1);
  check("a part that moved: check-failed, naming it, with Undo", last?.status === "check-failed" && /b by 30px/.test(last.line) && last.undo === true, last?.line);
}

// ---- not ours, and Approve -------------------------------------------------------------
{
  const gh = github();
  const s = setup({ ours: false, token: "t", github: { fetch: gh.fetch } });
  const step = await M.afterGreen("stranger", { ...s.deps, send: s.send });
  check("a lane the runner didn't start waits for J and calls nothing", step?.waitsFor === "your agents didn't make this branch" && gh.calls.length === 0 && !s.events.includes("check"));
  check("its line says it waits for Approve", s.sent.length === 1 && s.sent[0].status === "stacked" && /Waits for your Approve/.test(s.sent[0].line));
}

// ---- no browser ----------------------------------------------------------------------------
{
  const s = setup({ token: "t", github: { fetch: github().fetch }, browser: false });
  await M.afterGreen("hover-calm", { ...s.deps, send: s.send });
  check("no browser: merged, and the line says the live check didn't run", s.sent.at(-1)?.status === "merged" && /didn't run/.test(s.sent.at(-1).line) && s.sent.every(valid));
}

// ---- withMerges: rows from the runner, once per lane, Approve --------------------------------
const row = (lane, stepsDone, state = "working", note = "") => ({ v: V, kind: "lane", requestId: "r1", lane, where: "pc", stepsDone, stepNow: ["brief", "red", "fix", "green", "push", "ci", "merge", "live"][stepsDone] ?? null, etaSeconds: null, state, note });
check("isGreen: CI still running is not green", M.isGreen(row("x", 5)) === false);
check("isGreen: past ci is green", M.isGreen(row("x", 6)) === true);
check("isGreen: a failed lane is not green", M.isGreen(row("x", 6, "only-you", "ended at ci")) === false);
check("isGreen: a stopped lane is not green", M.isGreen(row("x", 7, "paused", "stopped by you; the branch is kept as it is")) === false);
{
  const fromRunner = new Set();
  const controls = [];
  const inner = {
    subscribe: (fn) => (fromRunner.add(fn), () => fromRunner.delete(fn)),
    snapshot: () => [row("hover-calm", 6)],
    submit: async () => ({}),
    control: async (c) => (controls.push(c), { ok: true }),
  };
  const ours = new Set(["hover-calm"]);
  const gh = github();
  const s = setup({ token: "t", github: { fetch: gh.fetch } });
  const runner = M.withMerges(inner, { ...s.deps, ours: (lane) => ours.has(lane) });
  const seen = [];
  runner.subscribe((m) => seen.push(m));
  const emit = (m) => { for (const fn of fromRunner) fn(m); };
  emit(row("hover-calm", 4));
  emit(row("hover-calm", 6));
  emit(row("hover-calm", 7));
  await runner.idle();
  check("the dock still gets the runner's rows", seen.filter((m) => m.kind === "lane").length === 3);
  check("a green lane goes through merge once, however many rows say so", s.events.filter((e) => e === "merge").length === 1);
  check("the dock's stream gets the merge lines", seen.filter((m) => m.kind === "merge").map((m) => m.status).join(",") === "merged,checked");
  check("a dock that connects later gets the newest merge line in the snapshot", runner.snapshot().some((m) => m.kind === "merge" && m.status === "checked"));

  emit(row("stranger", 6));
  await runner.idle();
  const waits = seen.filter((m) => m.kind === "merge" && m.lane === "stranger");
  check("a stranger's lane: one line, waiting for Approve", waits.length === 1 && waits[0].status === "stacked");
  const r = await runner.control({ v: V, kind: "control", lane: "stranger", do: "approve", by: "j" });
  await runner.idle();
  const after = seen.filter((m) => m.kind === "merge" && m.lane === "stranger").map((m) => m.status).join(",");
  check("J's Approve on a waiting merge runs it again, approved, and isn't passed to the runner", r.ok && !controls.some((c) => c.lane === "stranger") && after === "stacked,merged,checked", `${JSON.stringify(r)} ${after}`);
  await runner.control({ v: V, kind: "control", lane: "other", do: "pause", by: "j" });
  check("other controls go to the runner", controls.some((c) => c.lane === "other" && c.do === "pause"));
}

// ---- the PR body --------------------------------------------------------------------------
{
  const b = M.readPrBody("**P2, generality 5.** Something\n\n## The tray\n\n**You get:** a tray icon with Open, Pause all and Quit.\n\nTests: agents-installer 68/68\n", "agents-installer");
  check("the PR body: P, generality, You get, title and tests", b.p === 2 && b.generality === 5 && b.fixes === "a tray icon with Open, Pause all and Quit." && b.prTitle === "P2: The tray" && b.before === "agents-installer 68/68", JSON.stringify(b));
  const none = M.readPrBody(null, "x");
  check("no PR body: treated as a P1, so it waits for J", none.p === 1 && /no PR body/.test(none.fixes));
}

// ---- the tray's commands -----------------------------------------------------------------
{
  const controls = [];
  const rows = [row("a", 2), row("b", 3, "paused", "paused by you"), row("c", 1)];
  const runner = { subscribe: () => () => {}, snapshot: () => rows, submit: async () => ({}), control: async (c) => (controls.push(`${c.do} ${c.lane}`), { ok: true }) };
  let quit = 0;
  const tray = M.trayCommands(runner, () => quit++);
  await tray("pause-all");
  check("Pause all pauses the working lanes only", controls.join(",") === "pause a,pause c", controls.join(","));
  await tray("resume-all");
  check("Resume all resumes those, not the one J paused himself", controls.slice(2).join(",") === "resume a,resume c", controls.slice(2).join(","));
  await tray("quit");
  await tray("rm -rf");
  check("quit quits; anything else does nothing", quit === 1 && controls.length === 4);
}

// ---- hidden windows, plan only ------------------------------------------------------------
const root = fileURLToPath(new URL("../helper/", import.meta.url));
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === "testing" ? [] : walk(p)) : /\.(ts|mjs)$/.test(n) ? [p] : []; });
const unhidden = [];
for (const f of walk(root)) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\b(spawn|spawnSync|execFile|execFileSync|exec|execSync|fork)\(/g)) {
    if (/import|\.exec\(/.test(src.slice(Math.max(0, m.index - 1), m.index + m[0].length)) && src[m.index - 1] === ".") continue;
    const call = src.slice(m.index, m.index + 600);
    const end = call.indexOf(");");
    if (!/windowsHide:\s*true/.test(end > 0 ? call.slice(0, end) : call)) unhidden.push(`${f.slice(root.length)}: ${m[1]}`);
  }
}
check("every process the helper starts is hidden (windowsHide)", unhidden.length === 0, unhidden.join(", "));
const job = readFileSync(join(root, "jobs", "job.ps1"), "utf8");
check("the job launcher starts lanes with CREATE_NO_WINDOW", /CreateProcess\([^)]*CREATE_NO_WINDOW/.test(job.replace(/\s+/g, " ")));
const main = readFileSync(join(root, "server", "main.ts"), "utf8");
check("main.ts takes `ours` from the runner's own lanes, not the branch name", /ours: \(lane\) => coordinator\.startOf\(lane\) !== null/.test(main));
const code = main.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
check("main.ts never takes an API key", !/ANTHROPIC_API_KEY|apiKey|api-key/i.test(code));
check("measure.ts (the browser kit) is loaded only when a live check runs", !/^import .*measure\.ts/m.test(main) && /import\("\.\.\/livecheck\/measure\.ts"\)/.test(main));
done();
