/**
 * Agents panel, the runner: a lane that has pushed counts push as done.
 *
 * The first real smoke run (2026-10-29) pushed its branch, then ended its
 * turn without writing `[step:ci]`; the row said "stopped at push: waiting
 * for a line from you" at 4/8. Now, when a PC lane's turn ends at push and
 * origin holds `claude/<lane>` at the worktree's HEAD (helper/agents/pushed.ts),
 * the row goes to 5/8 "pushed …: waiting for CI". Not pushed, it still asks J.
 *
 * Part 1: the real check against a throwaway bare repo as origin (no network).
 * Part 2: the runner with a stand-in lane and a stand-in check.
 *
 *   node tests/agents-push-done.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = () => {
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(25); }
  return fn();
}

let P = null, R = null, S = null, C = null;
try {
  P = await import("../helper/agents/pushed.ts");
  R = await import("../helper/agents/runner.ts");
  S = await import("../helper/agents/spend.ts");
  C = await import("../helper/contract.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the push check, the runner and the contract load", !!(P && R && S && C));
if (!(P && R && S && C)) done();

const dir = mkdtempSync(join(tmpdir(), "agents-push-"));
try {
  // ---- part 1: the real check ------------------------------------------------------
  const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, ...a], { stdio: "pipe" }).toString().trim();
  const origin = join(dir, "origin.git"), work = join(dir, "work");
  execFileSync("git", ["init", "-q", "--bare", origin]);
  execFileSync("git", ["init", "-q", work]);
  for (const [k, v] of [["user.name", "t"], ["user.email", "t@t"], ["commit.gpgsign", "false"]]) git(work, "config", k, v);
  git(work, "remote", "add", "origin", origin);
  writeFileSync(join(work, "a.txt"), "a\n");
  git(work, "add", "a.txt"); git(work, "commit", "-q", "-m", "base");
  git(work, "push", "-q", "origin", "HEAD:refs/heads/base");
  git(work, "checkout", "-q", "-b", "claude/readme-note");

  check("nothing committed, nothing pushed: not pushed", (await P.branchPushed("readme-note", work)) === false);
  writeFileSync(join(work, "README.md"), "<!-- Polio Helper -->\n");
  git(work, "add", "README.md"); git(work, "commit", "-q", "-m", "note");
  check("committed but not pushed: not pushed", (await P.branchPushed("readme-note", work)) === false);
  git(work, "push", "-q", "origin", "HEAD:refs/heads/claude/readme-note");
  check("origin holds claude/<lane> at HEAD: pushed", (await P.branchPushed("readme-note", work)) === true);
  writeFileSync(join(work, "README.md"), "<!-- Polio Helper, more -->\n");
  git(work, "commit", "-q", "-am", "more");
  check("a newer commit not yet pushed: not pushed", (await P.branchPushed("readme-note", work)) === false);
  check("another lane's name: not pushed", (await P.branchPushed("other-lane", work)) === false);
  check("no repo at all: not pushed, no throw", (await P.branchPushed("readme-note", join(dir, "nowhere"))) === false);

  // ---- part 2: the runner -----------------------------------------------------------------
  const feeds = new Map();
  const stub = (where) => ({
    where, pays: where === "pc" ? "plan" : "cloud", can: { pause: true, stop: true, tokens: where === "pc" },
    start(spec) {
      const queue = []; let wake = null;
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
  });
  const asked = [];
  const pushedLanes = new Set(["pushed-lane", "cloud-lane"]);
  const seen = [], bad = [];
  const plans = { "r-1": ["pushed-lane", "pc"], "r-2": ["quiet-lane", "pc"], "r-3": ["cloud-lane", "cloud"], "r-4": ["early-lane", "pc"] };
  const runner = new R.Runner({
    adapters: { pc: stub("pc"), cloud: stub("cloud") }, stateDir: join(dir, "state"), spend: new S.SpendBook(), atOnce: 5,
    memory: { ok: () => true, free: () => 8e9, minFree: 4e9 },
    workspace: (lane) => { const w = join(dir, "lanes", lane); mkdirSync(w, { recursive: true }); return w; },
    plan: (r) => {
      const [lane, where] = plans[r.id];
      return { v: C.CONTRACT_VERSION, kind: "plan", requestId: r.id, newControl: false, lanes: [{ lane, where, files: ["a"], test: "tests/a.mjs", size: "small", stackedOn: null }] };
    },
    pushed: async (lane, cwd) => { asked.push({ lane, cwd }); return pushedLanes.has(lane); },
  });
  runner.subscribe((m) => { seen.push(m); const p = C.problems(m); if (p.length) bad.push(p.join("; ")); });
  const row = (lane) => seen.filter((m) => m.kind === "lane" && m.lane === lane).at(-1);
  const req = (id) => ({ v: C.CONTRACT_VERSION, kind: "request", id, text: "x", target: "builder-ui", chips: [], action: null, how: "just-do-it" });
  const toPush = (lane) => { for (const s of ["brief", "red", "build", "test", "push"]) feeds.get(lane)({ type: "step", step: s, note: s }); };

  for (const id of Object.keys(plans)) runner.submit(req(id));
  await until(() => ["pushed-lane", "quiet-lane", "cloud-lane", "early-lane"].every((l) => feeds.has(l)));

  toPush("pushed-lane"); feeds.get("pushed-lane")({ type: "idle" });
  await until(() => row("pushed-lane")?.stepsDone === 5);
  const p = row("pushed-lane");
  check("a PC lane whose turn ends at push, pushed: push counts as done (5/8)", p?.stepsDone === 5 && p.stepNow === "ci" && p.state === "working", JSON.stringify(p));
  check("its note says so, plainly", /pushed claude\/pushed-lane: waiting for CI/.test(p?.note ?? ""), p?.note);
  check("the check was asked about that lane, in its own worktree", asked.some((a) => a.lane === "pushed-lane" && a.cwd.endsWith(join("lanes", "pushed-lane"))), JSON.stringify(asked));

  toPush("quiet-lane"); feeds.get("quiet-lane")({ type: "idle" });
  await until(() => row("quiet-lane")?.state === "question");
  const q = row("quiet-lane");
  check("not pushed: it still stops at push and asks for a line", q?.stepsDone === 4 && q.state === "question" && /stopped at push/.test(q.note), JSON.stringify(q));

  toPush("cloud-lane"); feeds.get("cloud-lane")({ type: "idle" });
  await until(() => row("cloud-lane")?.state === "question");
  check("a cloud lane isn't checked against this PC's git", row("cloud-lane")?.stepsDone === 4 && !asked.some((a) => a.lane === "cloud-lane"), JSON.stringify(row("cloud-lane")));

  for (const s of ["brief", "red"]) feeds.get("early-lane")({ type: "step", step: s, note: s });
  feeds.get("early-lane")({ type: "idle" });
  await until(() => row("early-lane")?.state === "question");
  check("a turn ending before push isn't checked", row("early-lane")?.stepsDone === 1 && !asked.some((a) => a.lane === "early-lane"));

  feeds.get("pushed-lane")({ type: "step", step: "ci", note: "waiting for CI" });
  await sleep(50);
  check("the lane can go on from there (its next line keeps 5/8)", row("pushed-lane")?.stepsDone === 5 && row("pushed-lane").state === "working");
  check("every row is a good contract message", bad.length === 0, bad.join(" | "));
  await runner.stopAll?.();
} finally {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}
done();
