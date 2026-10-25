/**
 * Agents panel, the lead and the queue (helper/coordinator/*).
 *
 * - Stacking: a plan with two lanes on one file comes out stacked, and the
 *   second starts only when the first is done, from the first one's branch.
 * - A file owned by an open lane in owners.json makes a lane wait; once the
 *   owner merges, it goes ahead.
 * - A new Builder control marks the lanes only-you; nothing runs until J
 *   says yes.
 * - The cap: 3 at once by default, 5 at most, and the next lane starts
 *   when one ends.
 * - Briefs carry J's rules from lane-rules.md (Windows notes only on PC
 *   lanes) and the progress lines; pc only when a lane needs the PC;
 *   Opus for the lead and design-heavy lanes, Sonnet for the rest.
 * - The owners map: matching, branch claims from handovers, folder owners.
 *
 * The lead's Claude call is a stub: no real calls.
 *
 *   node tests/agents-lead.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(20); }
  return fn();
}

let Q = null, L = null, O = null, B = null, C = null, S = null;
try {
  Q = await import("../helper/coordinator/queue.ts");
  L = await import("../helper/coordinator/lead.ts");
  O = await import("../helper/coordinator/owners.ts");
  B = await import("../helper/coordinator/brief.ts");
  C = await import("../helper/contract.ts");
  S = await import("../helper/agents/spend.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the lead, queue, owners and briefs load", !!(Q && L && O && B));

const RULES = `# Rules for every Polio lane

## J's rules
- One branch, one PR per item. Never merge yourself.
- **Test on every repo fixture** (share-xyz, trumpmorty-fun, gotchi-gg, stonkfun-xyz, parasiteonsol-fun, trendtrader-pro).
- Test networks only. Never print or commit keys.
- **Leave nothing running** (J, 2026-10-24).
- **Notify J** when you finish a piece.

## Windows notes (from editable-imports.md)
- Node 24 at \`C:\\Program Files\\nodejs\`.
`;

if (Q && L && O && B) {
  const dir = mkdtempSync(join(tmpdir(), "agents-lead-"));
  const v = C.CONTRACT_VERSION;
  let n = 0;
  const req = (text, over = {}) => ({ v, kind: "request", id: `r${++n}`, text, target: "site", chips: [], action: null, how: "just-do-it", ...over });

  /** An adapter whose runs go on until the test ends them. */
  function fakeAdapter(where) {
    const runs = new Map();
    const a = {
      where, pays: where === "pc" ? "plan" : "cloud", can: { pause: true, stop: true, tokens: true },
      runs, started: [],
      start(spec) {
        const queue = [], waiters = [];
        let closed = false;
        const push = (e) => { const w = waiters.shift(); if (w) w({ value: e, done: false }); else queue.push(e); };
        const close = () => { closed = true; for (const w of waiters.splice(0)) w({ value: undefined, done: true }); };
        const events = { [Symbol.asyncIterator]: () => ({ next: () => queue.length ? Promise.resolve({ value: queue.shift(), done: false }) : closed ? Promise.resolve({ value: undefined, done: true }) : new Promise((r) => waiters.push(r)) }) };
        const run = { events, steer: async () => {}, stop: async () => close(), spec,
          finish: () => { push({ type: "step", step: "live", note: "checking live" }); push({ type: "ended", ok: true, reason: "live and checked" }); close(); } };
        runs.set(spec.lane, run);
        a.started.push(spec.lane);
        push({ type: "started", sessionId: `s-${spec.lane}` });
        return run;
      },
    };
    return a;
  }

  function setup({ answer, owners = { v: 1, base: "", built: "", owners: [] }, atOnce } = {}) {
    const pc = fakeAdapter("pc"), cloud = fakeAdapter("cloud");
    const asked = [];
    const box = { owners };
    const seen = [], bad = [];
    const coord = new Q.Coordinator({
      runner: {
        adapters: { pc, cloud }, stateDir: join(dir, `state-${n}-${Math.random().toString(36).slice(2, 6)}`),
        spend: new S.SpendBook({ planWindowTokens: 1_000_000 }),
        memory: { ok: () => true, free: () => 8e9, minFree: 4e9 },
        workspace: (lane) => { const w = join(dir, `work-${lane}`); mkdirSync(w, { recursive: true }); return w; },
      },
      ask: async (prompt, opts) => { asked.push({ prompt, ...opts }); return typeof answer === "function" ? answer(asked.length) : answer; },
      owners: () => box.owners, rules: () => RULES, base: "origin/claude/template-ui-website-builder-11bfgl", atOnce,
    });
    coord.subscribe((m) => { seen.push(m); const p = C.problems(m); if (p.length) bad.push(`${m.kind}: ${p.join("; ")}`); });
    const row = (lane) => seen.filter((m) => m.kind === "lane" && m.lane === lane).at(-1);
    return { coord, pc, cloud, asked, box, seen, bad, row };
  }
  const answer = (lanes) => "Here is the plan:\n```json\n" + JSON.stringify({ lanes }) + "\n```";
  const lane = (name, files, more = {}) => ({ lane: name, files, test: `tests/${name}.mjs`, size: "small", needs: [], design: false, adds: [], why: "", ...more });

  // ---- stacking ------------------------------------------------------------
  {
    const t = setup({ answer: answer([
      lane("boxes-hug", ["src/features/studio/board/layout.ts", "tests/boxes-hug.mjs"]),
      lane("rails-apart", ["src/features/studio/board/rails.ts"]),
      lane("stack-apart", ["src/features/studio/board/layout.ts", "src/features/studio/board/stack.ts"]),
    ]) });
    const plan = await t.coord.submit(req("boxes hug, rails apart, stack apart"));
    const [a, b, c] = plan.lanes;
    check("a plan with two lanes on one file comes out stacked", c.stackedOn === "boxes-hug" && a.stackedOn === null && b.stackedOn === null,
      plan.lanes.map((l) => `${l.lane}<-${l.stackedOn}`).join(" "));
    check("the dock gets the whole plan once (the runner's own plans are kept back)", t.seen.filter((m) => m.kind === "plan").length === 1);
    await until(() => t.pc.started.length + t.cloud.started.length >= 2);
    const started = () => [...t.pc.started, ...t.cloud.started];
    check("the stacked lane doesn't run beside the lane it is stacked on", started().includes("boxes-hug") && started().includes("rails-apart") && !started().includes("stack-apart"), started().join(", "));
    check("its row says what it waits for", /stacked on boxes-hug/.test(t.row("stack-apart")?.note ?? ""), t.row("stack-apart")?.note);
    const brief = t.coord.briefOf("stack-apart");
    check("its brief starts it from the lane it is stacked on", brief.includes("started from claude/boxes-hug") && brief.includes("Stacked after boxes-hug"));
    t.cloud.runs.get("boxes-hug").finish();
    await until(() => started().includes("stack-apart"));
    check("once the first lane is done, the stacked one starts", started().includes("stack-apart"), started().join(", "));
    check("a folder owner stacks a lane on a file inside it", L.shapePlan(req("x"), [lane("one", ["src/a/*"]), lane("two", ["src/a/b.ts"])]).plan.lanes[1].stackedOn === "one");
    const three = L.shapePlan(req("x"), [lane("a", ["f1"]), lane("b", ["f2"]), lane("c", ["f1", "f2"])]);
    check("a lane sharing files with two lanes waits for both (stackedOn names the last)", three.plan.lanes[2].stackedOn === "b" && three.extra.get("c").after.join() === "a,b");
    check("every message passes the contract", t.bad.length === 0, t.bad[0]);
    await t.coord.stopAll();
  }

  // ---- a busy owner ----------------------------------------------------------
  {
    const owners = { v: 1, base: "b", built: "", owners: [
      { lane: "editable-imports", branch: "claude/editable-imports", state: "open", owns: ["src/features/studio/shelf/parts/*"] },
      { lane: "old-lane", branch: "claude/old-lane", state: "stale", owns: ["src/features/studio/stale.ts"] },
    ] };
    const t = setup({ owners, answer: answer([
      lane("text-part", ["src/features/studio/shelf/parts/text.tsx"]),
      lane("stale-ok", ["src/features/studio/stale.ts"]),
    ]) });
    await t.coord.submit(req("text part"));
    const started = () => [...t.pc.started, ...t.cloud.started];
    await until(() => started().includes("stale-ok"));
    check("a file owned by an open lane makes the lane wait", !started().includes("text-part"), started().join(", "));
    check("its row names the owner", /waiting for editable-imports/.test(t.row("text-part")?.note ?? ""), t.row("text-part")?.note);
    check("a stale owner doesn't hold a lane up", started().includes("stale-ok"));
    check("the lead is shown the open lanes and their files", t.asked[0].prompt.includes("editable-imports (claude/editable-imports): src/features/studio/shelf/parts/*") && !t.asked[0].prompt.includes("old-lane"));
    t.box.owners = { ...owners, owners: owners.owners.map((o) => ({ ...o, state: "merged" })) };
    t.coord.ownersChanged();
    await until(() => started().includes("text-part"));
    check("once the owner merged, the lane goes ahead", started().includes("text-part"));
    const t2 = setup({ owners, answer: answer([lane("editable-imports", ["x.ts"])]) });
    const p2 = await t2.coord.submit(req("y"));
    check("a lane isn't given a name in owners.json", p2.lanes[0].lane !== "editable-imports", p2.lanes[0].lane);
    check("every message passes the contract", t.bad.length === 0 && t2.bad.length === 0, t.bad[0] ?? t2.bad[0]);
    await t.coord.stopAll(); await t2.coord.stopAll();
  }

  // ---- a new control ---------------------------------------------------------
  {
    const t = setup({ answer: answer([lane("share-button", ["src/features/share/Share.tsx"], { adds: ["Share button"] }), lane("share-copy", ["src/features/share/copy.ts"])]) });
    const plan = await t.coord.submit(req("let J share a site", { target: "builder-ui" }));
    await sleep(100);
    check("a lane that adds a Builder control marks the plan newControl", plan.newControl === true);
    check("its lanes are only-you, waiting for J's yes", ["share-button", "share-copy"].every((l) => t.row(l)?.state === "only-you" && /new control/.test(t.row(l).note)), t.row("share-button")?.note);
    check("nothing runs before J's yes", t.pc.started.length + t.cloud.started.length === 0);
    const r = await t.coord.control({ v, kind: "control", lane: "share-button", do: "approve", by: "j" });
    await until(() => t.cloud.started.includes("share-button"));
    check("J's yes starts it", r.ok && t.cloud.started.includes("share-button") && !t.cloud.started.includes("share-copy"));
    const d = await t.coord.control({ v, kind: "control", lane: "share-copy", do: "decline", by: "j" });
    check("J's no stops it with nothing run", d.ok && t.row("share-copy")?.state === "paused" && /nothing ran/.test(t.row("share-copy").note));
    const agent = await t.coord.control({ v, kind: "control", lane: "share-copy", do: "approve", by: "runner" });
    check("an approve not from J is refused", !agent.ok);
    check("a design-heavy lane (a new control) runs on Opus", t.cloud.runs.get("share-button").spec.model === L.OPUS);
    const asked = L.shapePlan(req("add a new toggle for dark mode", { target: "builder-ui" }), [lane("dark", ["src/a.ts"])]);
    check("a request asking for a new control marks it even if the lead missed it", asked.plan.newControl === true);
    const fix = L.shapePlan(req("the wheel shows the wrong colour", { target: "builder-ui" }), [lane("wheel", ["src/a.ts"])]);
    check("a plain fix doesn't", fix.plan.newControl === false);
    const pf = setup({ answer: answer([lane("plain", ["src/b.ts"])]) });
    await pf.coord.submit(req("plain one", { how: "plan-first" }));
    await sleep(50);
    check("a plan-first request waits for Start", pf.row("plain")?.state === "only-you" && pf.row("plain").note === "waiting for Start" && pf.cloud.started.length === 0);
    check("every message passes the contract", t.bad.length === 0 && pf.bad.length === 0, t.bad[0] ?? pf.bad[0]);
    await t.coord.stopAll(); await pf.coord.stopAll();
  }

  // ---- the cap -----------------------------------------------------------
  {
    const five = ["a1", "a2", "a3", "a4", "a5"].map((x) => lane(`lane-${x}`, [`src/${x}.ts`]));
    const t = setup({ answer: answer(five) });
    await t.coord.submit(req("five things"));
    await until(() => t.cloud.started.length >= 3);
    await sleep(100);
    check("the cap of 3 holds", t.cloud.started.length === 3, t.cloud.started.join(", "));
    check("the rest wait their turn, and say so", ["lane-a4", "lane-a5"].every((l) => /waiting its turn \(3 of 3 running\)/.test(t.row(l)?.note ?? "")), t.row("lane-a4")?.note);
    t.cloud.runs.get("lane-a1").finish();
    await until(() => t.cloud.started.length >= 4);
    await sleep(100);
    check("when one ends, the next starts and the cap still holds", t.cloud.started.length === 4 && t.cloud.started.at(-1) === "lane-a4");
    await t.coord.control({ v, kind: "control", lane: "lane-a2", do: "stop", by: "j" });
    await until(() => t.cloud.started.length >= 5);
    check("a lane J stops frees its place too", t.cloud.started.length === 5);
    const big = setup({ answer: answer(five), atOnce: 9 });
    check("J's setting goes up to 5 and no further", big.coord.atOnce === 5);
    check("every message passes the contract", t.bad.length === 0, t.bad[0]);
    await t.coord.stopAll();
  }

  // ---- briefs, where, models --------------------------------------------------
  {
    const t = setup({ answer: answer([
      lane("cloud-one", ["src/x.ts"]),
      lane("pc-one", ["src/y.ts"], { needs: ["captures"], design: true }),
      lane("pc-two", ["tests/z.mjs"], { test: "tests/z.mjs" }),
    ]) });
    const plan = await t.coord.submit(req("three", { chips: [{ kind: "part", id: "p1", name: "Hero" }] }));
    const [c1, p1] = plan.lanes;
    check("cloud unless the lane needs the PC", c1.where === "cloud" && p1.where === "pc");
    check("a lane whose files are local captures goes to the PC whatever the lead said",
      L.shapePlan(req("x"), [lane("cap", ["work-editable/capture/sites/mochi3/index.html"])]).plan.lanes[0].where === "pc");
    await until(() => t.pc.runs.has("pc-one") && t.cloud.runs.has("cloud-one"));
    const pcBrief = t.pc.runs.get("pc-one").spec.prompt, cloudBrief = t.cloud.runs.get("cloud-one").spec.prompt;
    check("the lane starts on its brief through the runner's adapter", pcBrief === t.coord.briefOf("pc-one"));
    const jRules = ["Never merge yourself", "Test on every repo fixture", "Test networks only", "Leave nothing running", "Notify J"];
    check("the briefs include J's rules", jRules.every((r) => pcBrief.includes(r) && cloudBrief.includes(r)), jRules.filter((r) => !cloudBrief.includes(r)).join(", "));
    check("Windows notes go to PC lanes only", pcBrief.includes("## Windows notes") && !cloudBrief.includes("## Windows notes"));
    check("the brief has the lane's files, test, chips and the progress lines",
      cloudBrief.includes("Files you own: src/x.ts") && cloudBrief.includes("tests/cloud-one.mjs") && cloudBrief.includes('"name":"Hero"') && cloudBrief.includes("[step:<name>]"));
    check("the lead runs on Opus", t.asked.every((a) => a.model === L.OPUS) && L.LEAD_MODEL === L.OPUS);
    check("a design-heavy lane runs on Opus, a contained one on Sonnet",
      t.pc.runs.get("pc-one").spec.model === L.OPUS && t.cloud.runs.get("cloud-one").spec.model === L.SONNET);
    check("no Fable", ![L.OPUS, L.SONNET].some((m) => /fable/i.test(m)));
    let threw = false;
    try { B.briefFor({ req: req("x"), lane: c1, rules: "# no rules here", base: "b", after: [], model: L.SONNET }); } catch { threw = true; }
    check("a brief without J's rules is refused, not sent", threw);
    const here = fileURLToPath(new URL("..", import.meta.url));
    for (const f of [join(here, "..", "handovers", "lane-rules.md"), join(here, "docs", "agents-panel", "LANE-RULES.md")]) {
      if (!existsSync(f)) continue;
      const real = B.briefFor({ req: req("x"), lane: p1, rules: readFileSync(f, "utf8"), base: "b", after: [], model: L.OPUS });
      check(`the real ${f.includes("handovers") ? "handovers/lane-rules.md" : "LANE-RULES.md"} briefs a PC lane with both sections`, real.includes("Test networks only") && real.includes("## Windows notes"));
    }
    await t.coord.stopAll();
  }

  // ---- the lead's answer -----------------------------------------------------
  {
    const t = setup({ answer: (i) => (i === 1 ? "I think two lanes." : answer([lane("ok", ["a.ts"])])) });
    const p = await t.coord.submit(req("something"));
    check("an answer with no lanes is asked once more", t.asked.length === 2 && p.lanes[0].lane === "ok");
    const t2 = setup({ answer: "no idea" });
    const p2 = await t2.coord.submit(req("make the hero bigger"));
    check("two misses run it as one lane, on the PC for a site request", p2.lanes.length === 1 && p2.lanes[0].where === "pc" && p2.lanes[0].lane === "make-the-hero-bigger");
    const odd = L.shapePlan(req("x"), [{ lane: "Bad Name!!", files: ["a\\b.ts", "a\\b.ts"], test: "../etc", size: "huge", needs: ["moon"] }, { lane: "bad-name" }]);
    const [o1, o2] = odd.plan.lanes;
    check("names, files, test and size are cleaned", o1.lane === "bad-name" && o2.lane === "bad-name-2" && o1.files.join() === "a/b.ts" && o1.test === "tests/bad-name.mjs" && o1.size === "medium" && o1.where === "cloud");
    await t.coord.stopAll(); await t2.coord.stopAll();
  }

  // ---- the owners map ---------------------------------------------------------
  {
    check("folder/* owns its own files, not deeper ones", O.matches("src/a/*", "src/a/b.ts") && !O.matches("src/a/*", "src/a/c/d.ts") && O.matches("src/a/**", "src/a/c/d.ts") && O.matches("src\\a\\b.ts", "src/a/b.ts"));
    const md = "| Branch | Commit |\n|---|---|\n| `claude/agents-dock` | 567f | stacked on `claude/agents-contract` |\n- **Branch:** `claude/system-panel` at fd85, rebased onto `claude/system-model`.\nSee `claude/other`.\n";
    check("a handover claims its own branches, not the ones it mentions", O.branchesIn(md).join() === "claude/agents-dock,claude/system-panel", O.branchesIn(md).join());
    const pats = O.ownedPatterns(["helper/coordinator/a.ts", "helper/coordinator/b.ts", "tests/x.mjs", "tests/y.mjs"], ["helper/coordinator/a.ts", "helper/coordinator/b.ts", "tests/x.mjs", "tests/y.mjs"], (d) => d !== "tests");
    check("a new folder becomes folder/*, a shared one stays file by file", pats.join() === "helper/coordinator/*,tests/x.mjs,tests/y.mjs", pats.join());
    check("only open owners are busy", O.busyOwners({ owners: [{ lane: "a", state: "merged", owns: ["x"] }, { lane: "b", state: "open", owns: ["x"] }] }, "x").map((o) => o.lane).join() === "b");
  }

  rmSync(dir, { recursive: true, force: true });
}

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
