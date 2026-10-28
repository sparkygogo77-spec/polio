/**
 * Agents panel, the lead and the queue (helper/coordinator/*).
 *
 * - Stacking: a plan with two lanes on one file comes out stacked; the
 *   second starts only once the first has pushed, from the first one's
 *   branch, and its brief says so.
 * - Owners: a file owned by an open lane that is still pushing makes a lane
 *   wait; an idle owner (pushed hours ago) is stacked on instead; a merged
 *   or stale owner holds nothing up.
 * - A new Builder control marks the lanes only-you; nothing runs until J
 *   says yes.
 * - The cap: 3 at once by default, 5 at most, and the next lane starts
 *   when one ends.
 * - Briefs carry J's rules from lane-rules.md (Windows notes only on PC
 *   lanes) and the progress lines; pc only when a lane needs the PC (the
 *   lead's needs, local paths, or a captured site named in the request);
 *   Opus for the lead and design-heavy lanes, Sonnet for the rest.
 * - A request too vague to plan becomes a question to J, and his answer
 *   goes back to the lead. Odd lead answers are cleaned or asked again.
 * - The lead sees the lanes running here, not only owners.json.
 * - The owners map: matching, branch claims from handovers, folder owners,
 *   queued vs stale, built from a fake git.
 * - The server with the coordinator behind it: POST /request gives the plan.
 *
 * The lead's Claude call is a stub: no real calls.
 *
 *   node tests/agents-lead.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
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

let Q = null, L = null, O = null, B = null, C = null, S = null, Sv = null, Pa = null;
try {
  Q = await import("../helper/coordinator/queue.ts");
  L = await import("../helper/coordinator/lead.ts");
  O = await import("../helper/coordinator/owners.ts");
  B = await import("../helper/coordinator/brief.ts");
  C = await import("../helper/contract.ts");
  S = await import("../helper/agents/spend.ts");
  Sv = await import("../helper/server/server.ts");
  Pa = await import("../helper/server/pairing.ts");
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
  const BASE = "origin/claude/template-ui-website-builder-11bfgl";
  const NOW = Date.parse("2026-10-25T12:00:00Z");
  let n = 0;
  const req = (text, over = {}) => ({ v, kind: "request", id: `r${++n}`, text, target: "site", chips: [], action: null, how: "just-do-it", ...over });

  /** An adapter whose runs go on until the test moves them along. */
  function fakeAdapter(where) {
    const runs = new Map();
    const a = {
      where, pays: where === "pc" ? "plan" : "cloud", can: { pause: true, stop: true, tokens: where === "pc" },
      runs, started: [],
      start(spec) {
        const queue = [], waiters = [];
        let closed = false;
        const push = (e) => { const w = waiters.shift(); if (w) w({ value: e, done: false }); else queue.push(e); };
        const close = () => { closed = true; for (const w of waiters.splice(0)) w({ value: undefined, done: true }); };
        const events = { [Symbol.asyncIterator]: () => ({ next: () => queue.length ? Promise.resolve({ value: queue.shift(), done: false }) : closed ? Promise.resolve({ value: undefined, done: true }) : new Promise((r) => waiters.push(r)) }) };
        const run = { events, steer: async () => {}, stop: async () => close(), spec,
          pushed: () => push({ type: "step", step: "ci", note: "pushed; CI running" }),
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
    const seen = [], bad = [], workspaces = [];
    const coord = new Q.Coordinator({
      runner: {
        adapters: { pc, cloud }, stateDir: join(dir, `state-${n}-${Math.random().toString(36).slice(2, 6)}`),
        spend: new S.SpendBook({ planWindowTokens: 1_000_000 }),
        memory: { ok: () => true, free: () => 8e9, minFree: 4e9 },
        workspace: (lane, where, from) => { workspaces.push({ lane, where, from }); const w = join(dir, `work-${lane}`); mkdirSync(w, { recursive: true }); return w; },
      },
      ask: async (prompt, opts) => { asked.push({ prompt, ...opts }); return typeof answer === "function" ? answer(asked.length, prompt) : answer; },
      owners: () => box.owners, rules: () => RULES, base: BASE, atOnce, now: () => NOW,
    });
    coord.subscribe((m) => { seen.push(m); const p = C.problems(m); if (p.length) bad.push(`${m.kind}: ${p.join("; ")}`); });
    const row = (lane) => seen.filter((m) => m.kind === "lane" && m.lane === lane).at(-1);
    const started = () => [...pc.started, ...cloud.started];
    return { coord, pc, cloud, asked, box, seen, bad, row, started, workspaces };
  }
  const answer = (lanes) => "Here is the plan:\n```json\n" + JSON.stringify({ lanes }) + "\n```";
  const lane = (name, files, more = {}) => ({ lane: name, files, test: `tests/${name}.mjs`, size: "small", needs: [], design: false, adds: [], why: "", ...more });
  const owner = (lane, owns, more = {}) => ({ lane, branch: `claude/${lane}`, state: "open", owns, pushedAt: new Date(NOW - 3 * 3600_000).toISOString(), queued: true, ...more });

  // ---- stacking ------------------------------------------------------------
  {
    const t = setup({ answer: (i, prompt) => prompt.includes("more on rails") ? answer([lane("more-on-rails", ["src/features/studio/board/rails.ts"])]) : answer([
      lane("boxes-hug", ["src/features/studio/board/layout.ts", "tests/boxes-hug.mjs"]),
      lane("rails-apart", ["src/features/studio/board/rails.ts"]),
      lane("stack-apart", ["src/features/studio/board/layout.ts", "src/features/studio/board/stack.ts"]),
    ]) });
    const plan = await t.coord.submit(req("boxes hug, rails apart, stack apart"));
    const [a, b, c] = plan.lanes;
    check("a plan with two lanes on one file comes out stacked", c.stackedOn === "boxes-hug" && a.stackedOn === null && b.stackedOn === null,
      plan.lanes.map((l) => `${l.lane}<-${l.stackedOn}`).join(" "));
    check("the dock gets the whole plan once (the runner's own plans are kept back)", t.seen.filter((m) => m.kind === "plan").length === 1);
    await until(() => t.started().length >= 2);
    check("the stacked lane doesn't run beside the lane it is stacked on", t.started().includes("boxes-hug") && t.started().includes("rails-apart") && !t.started().includes("stack-apart"), t.started().join(", "));
    check("its row says what it waits for", /stacked on boxes-hug: waits until it has pushed/.test(t.row("stack-apart")?.note ?? ""), t.row("stack-apart")?.note);
    check("an unstacked lane starts from the base", t.workspaces.find((w) => w.lane === "boxes-hug")?.from === BASE);
    t.cloud.runs.get("boxes-hug").pushed();
    await until(() => t.started().includes("stack-apart"));
    check("once the first lane has pushed, the stacked one starts", t.started().includes("stack-apart"), t.started().join(", "));
    check("it starts from the first lane's branch", t.coord.startOf("stack-apart") === "claude/boxes-hug" && t.workspaces.find((w) => w.lane === "stack-apart")?.from === "claude/boxes-hug", t.coord.startOf("stack-apart"));
    const brief = t.cloud.runs.get("stack-apart").spec.prompt;
    check("its brief says so", brief.includes("started from claude/boxes-hug") && brief.includes("Stacked after boxes-hug") && brief.includes('"stacked on boxes-hug"'));
    check("its row says so too", /stacked on boxes-hug: started from claude\/boxes-hug/.test(t.row("stack-apart")?.note ?? "") || t.row("stack-apart")?.note === "starting", t.row("stack-apart")?.note);
    check("a folder owner stacks a lane on a file inside it", L.shapePlan(req("x"), [lane("one", ["src/a/*"]), lane("two", ["src/a/b.ts"])]).plan.lanes[1].stackedOn === "one");
    const three = L.shapePlan(req("x"), [lane("a", ["f1"]), lane("b", ["f2"]), lane("c", ["f1", "f2"])]);
    check("a lane sharing files with two lanes waits for both (stackedOn names the last)", three.plan.lanes[2].stackedOn === "b" && three.extra.get("c").after.join() === "a,b");
    // A later request on a file a running lane here touches: it is stacked too, and the lead is told.
    const p2 = await t.coord.submit(req("more on rails"));
    await sleep(50);
    check("the lead is shown the lanes running here, with their files", t.asked.at(-1).prompt.includes("rails-apart (running here now): src/features/studio/board/rails.ts"));
    check("a later request on a running lane's file waits for it to push", p2.lanes[0].lane === "more-on-rails" && /stacked on rails-apart/.test(t.row("more-on-rails")?.note ?? ""), t.row("more-on-rails")?.note);
    check("every message passes the contract", t.bad.length === 0, t.bad[0]);
    await t.coord.stopAll();
  }

  // ---- owners ---------------------------------------------------------------
  {
    const owners = { v: 1, base: "b", built: "", owners: [
      owner("editable-imports", ["src/features/studio/shelf/parts/*"], { pushedAt: new Date(NOW - 5 * 60_000).toISOString() }),
      owner("export-sync", ["src/features/studio/send-out/exportSync.ts"]),
      owner("old-lane", ["src/features/studio/stale.ts"], { state: "stale", queued: false, pushedAt: new Date(NOW - 9 * 864e5).toISOString() }),
    ] };
    const t = setup({ owners, answer: answer([
      lane("text-part", ["src/features/studio/shelf/parts/text.tsx"]),
      lane("stale-ok", ["src/features/studio/stale.ts"]),
      lane("export-more", ["src/features/studio/send-out/exportSync.ts"]),
    ]) });
    await t.coord.submit(req("text part, stale, export"));
    await until(() => t.started().includes("stale-ok") && t.started().includes("export-more"));
    check("a file owned by an open lane that is still pushing makes the lane wait", !t.started().includes("text-part"), t.started().join(", "));
    check("its row names the owner", /waiting for editable-imports, which owns src\/features\/studio\/shelf\/parts\/text.tsx and is still pushing/.test(t.row("text-part")?.note ?? ""), t.row("text-part")?.note);
    check("a stale owner doesn't hold a lane up", t.started().includes("stale-ok"));
    check("an idle owner (pushed hours ago) is stacked on, not waited for", t.started().includes("export-more") && t.coord.startOf("export-more") === "origin/claude/export-sync", t.coord.startOf("export-more"));
    check("the brief says which branch and whom it follows", t.cloud.runs.get("export-more").spec.prompt.includes("started from origin/claude/export-sync") && t.cloud.runs.get("export-more").spec.prompt.includes("Stacked after export-sync"));
    check("the lead is shown the open lanes and their files", t.asked[0].prompt.includes("editable-imports (claude/editable-imports): src/features/studio/shelf/parts/*") && !t.asked[0].prompt.includes("old-lane"));
    t.box.owners = { ...owners, owners: owners.owners.map((o) => ({ ...o, state: "merged" })) };
    t.coord.ownersChanged();
    await until(() => t.started().includes("text-part"));
    check("once the owner merged, the lane goes ahead from the base", t.started().includes("text-part") && t.coord.startOf("text-part") === BASE);
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
    check("nothing runs before J's yes", t.started().length === 0);
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
    check("a plan-first request waits for Start", pf.row("plain")?.state === "only-you" && pf.row("plain").note === "waiting for Start" && pf.started().length === 0);
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
    check("a request that names a captured site (sol face, mochi, sunkcoin) goes to the PC whatever the lead said",
      ["the hero on sol face moves after import", "import Mochi and check the board", "sunkcoin's footer"].every((s) => L.shapePlan(req(s), [lane("l", ["src/a.ts"])]).plan.lanes[0].where === "pc")
      && L.shapePlan(req("the share-xyz fixture fails"), [lane("l", ["src/a.ts"])]).plan.lanes[0].where === "cloud");
    check("a part chip named after a captured site counts too", L.shapePlan(req("fix this part", { chips: [{ kind: "part", id: "p", name: "mochi hero" }] }), [lane("l", ["src/a.ts"])]).plan.lanes[0].where === "pc");
    await until(() => t.pc.runs.has("pc-one") && t.cloud.runs.has("cloud-one"));
    const pcBrief = t.pc.runs.get("pc-one").spec.prompt, cloudBrief = t.cloud.runs.get("cloud-one").spec.prompt;
    check("the lane starts on its brief through the runner's adapter", pcBrief === t.coord.briefOf("pc-one") && pcBrief.length > 0);
    const jRules = ["Never merge yourself", "Test on every repo fixture", "Test networks only", "Leave nothing running", "Notify J"];
    check("the briefs include J's rules", jRules.every((r) => pcBrief.includes(r) && cloudBrief.includes(r)), jRules.filter((r) => !cloudBrief.includes(r)).join(", "));
    check("Windows notes go to PC lanes only", pcBrief.includes("## Windows notes") && !cloudBrief.includes("## Windows notes"));
    check("the brief has the lane's files, test, chips and the progress lines",
      cloudBrief.includes("Files you own: src/x.ts") && cloudBrief.includes("tests/cloud-one.mjs") && cloudBrief.includes('"name":"Hero"') && cloudBrief.includes("[step:<name>]"));
    check("the lead runs on Opus", t.asked.every((a) => a.model === L.OPUS) && L.LEAD_MODEL === L.OPUS);
    check("a design-heavy lane runs on Opus, a contained one on Sonnet",
      t.pc.runs.get("pc-one").spec.model === L.OPUS && t.cloud.runs.get("cloud-one").spec.model === L.SONNET);
    check("no Fable", ![L.OPUS, L.SONNET].some((m) => /fable/i.test(m)));
    t.cloud.runs.get("cloud-one").finish();
    await until(() => t.seen.some((m) => m.kind === "spend"));
    const cloudSpend = t.seen.filter((m) => m.kind === "spend").flatMap((m) => m.lanes).filter((l) => l.lane === "cloud-one");
    check("a cloud lane is never shown measured (left out, or tokens null: on the plan, not measured)", cloudSpend.every((l) => l.tokens === null || l.tokens === undefined), JSON.stringify(cloudSpend[0] ?? "left out"));
    let threw = false;
    try { B.briefFor({ req: req("x"), lane: c1, rules: "# no rules here", from: "b", after: [], model: L.SONNET }); } catch { threw = true; }
    check("a brief without J's rules is refused, not sent", threw);
    const here = fileURLToPath(new URL("..", import.meta.url));
    for (const f of [join(here, "..", "handovers", "lane-rules.md"), join(here, "docs", "agents-panel", "LANE-RULES.md")]) {
      if (!existsSync(f)) continue;
      const real = B.briefFor({ req: req("x"), lane: p1, rules: readFileSync(f, "utf8"), from: "b", after: [], model: L.OPUS });
      check(`the real ${f.includes("handovers") ? "handovers/lane-rules.md" : "LANE-RULES.md"} briefs a PC lane with both sections`, real.includes("Test networks only") && real.includes("## Windows notes"));
    }
    await t.coord.stopAll();
  }

  // ---- the lead's answer -----------------------------------------------------
  {
    const t = setup({ answer: (i) => (i === 1 ? "I think two lanes." : answer([lane("ok", ["a.ts"])])) });
    const p = await t.coord.submit(req("something"));
    check("an answer with no lanes is asked once more", t.asked.length === 2 && p.lanes[0].lane === "ok");
    const junk = setup({ answer: (i) => (i === 1 ? '{"lanes":[1,"two",null]}' : answer([lane("fine", ["a.ts"])])) });
    const pj = await junk.coord.submit(req("junk first"));
    check("a lanes list with nothing usable in it is asked again, not run", junk.asked.length === 2 && pj.lanes[0].lane === "fine");
    const odd = L.shapePlan(req("x"), [{ lane: "Bad Name!!", files: ["a\\b.ts", "./a/b.ts", "../etc/passwd", "/src/c.ts", "C:/x"], test: "tests/../x.mjs", size: "huge", needs: ["moon"] }, { lane: "bad-name" }]);
    const [o1, o2] = odd.plan.lanes;
    check("names, files, test and size are cleaned (no dot-dot, no drive, one slash kind)", o1.lane === "bad-name" && o2.lane === "bad-name-2" && o1.files.join() === "a/b.ts,src/c.ts" && o1.test === "tests/bad-name.mjs" && o1.size === "medium" && o1.where === "cloud", `${o1.files.join()} ${o1.test}`);

    // Too vague: the lead asks, J answers, the lead plans again.
    const vague = setup({ answer: (i, prompt) => (i === 1 ? '{"question":"Which page: the home page or the gallery?"}' : answer([lane("gallery-hero", ["src/g.ts"], { why: prompt.includes("J's answer") ? "answered" : "" })])) });
    const pv = await vague.coord.submit(req("make it pop"));
    await sleep(50);
    const qLane = pv.lanes[0].lane;
    check("a request too vague to plan becomes a question to J, and nothing runs", pv.lanes.length === 1 && vague.row(qLane)?.state === "question" && vague.row(qLane).note === "Which page: the home page or the gallery?" && vague.started().length === 0, vague.row(qLane)?.note);
    const bad = await vague.coord.control({ v, kind: "control", lane: qLane, do: "approve", by: "j" });
    check("approve isn't an answer", !bad.ok);
    const ans = await vague.coord.control({ v, kind: "control", lane: qLane, do: "answer", by: "j", text: "the gallery" });
    await until(() => vague.started().includes("gallery-hero"));
    check("J's answer goes back to the lead with the request, and the new lane runs", ans.ok && vague.asked.length === 2 && /J's answer to "Which page[^"]*": the gallery/.test(vague.asked[1].prompt) && vague.started().includes("gallery-hero"), vague.asked[1]?.prompt.split("\n").slice(3, 6).join(" | "));
    check("the new plan reaches the dock and the question's row steps aside", vague.seen.filter((m) => m.kind === "plan").length === 2 && vague.row(qLane)?.state === "paused" && /you said: the gallery/.test(vague.row(qLane).note));
    const silent = setup({ answer: "no idea" });
    const ps = await silent.coord.submit(req("make the hero bigger"));
    await sleep(50);
    check("two misses become the lead's own question, never a blind lane", silent.asked.length === 2 && ps.lanes.length === 1 && silent.row(ps.lanes[0].lane)?.state === "question" && silent.row(ps.lanes[0].lane).note === L.CANT_PLAN && silent.started().length === 0);
    const no = await silent.coord.control({ v, kind: "control", lane: ps.lanes[0].lane, do: "decline", by: "j" });
    check("J can say no to a question", no.ok && silent.row(ps.lanes[0].lane)?.state === "paused");

    // Two requests at once can't be given one lane name.
    const twin = setup({ answer: answer([lane("same", ["src/s.ts"])]) });
    const [x, y] = await Promise.all([twin.coord.submit(req("one")), twin.coord.submit(req("two"))]);
    check("two requests planned at once get different lane names", x.lanes[0].lane === "same" && y.lanes[0].lane === "same-2", `${x.lanes[0].lane} ${y.lanes[0].lane}`);
    check("every message passes the contract", [t, junk, vague, silent, twin].every((s) => s.bad.length === 0), [t, junk, vague, silent, twin].flatMap((s) => s.bad)[0]);
    for (const s of [t, junk, vague, silent, twin]) await s.coord.stopAll();
  }

  // ---- the owners map ---------------------------------------------------------
  {
    check("folder/* owns its own files, not deeper ones", O.matches("src/a/*", "src/a/b.ts") && !O.matches("src/a/*", "src/a/c/d.ts") && O.matches("src/a/**", "src/a/c/d.ts") && O.matches("src\\a\\b.ts", "src/a/b.ts"));
    const md = "| Branch | Commit |\n|---|---|\n| `claude/agents-dock` | 567f | stacked on `claude/agents-contract` |\n- **Branch:** `claude/system-panel` at fd85, rebased onto `claude/system-model`.\nSee `claude/other`.\n";
    check("a handover claims its own branches, not the ones it mentions", O.branchesIn(md).join() === "claude/agents-dock,claude/system-panel", O.branchesIn(md).join());
    const pats = O.ownedPatterns(["helper/coordinator/a.ts", "helper/coordinator/b.ts", "tests/x.mjs", "tests/y.mjs"], ["helper/coordinator/a.ts", "helper/coordinator/b.ts", "tests/x.mjs", "tests/y.mjs"], (d) => d !== "tests");
    check("a new folder becomes folder/*, a shared one stays file by file", pats.join() === "helper/coordinator/*,tests/x.mjs,tests/y.mjs", pats.join());
    check("only open owners are busy", O.busyOwners({ owners: [{ lane: "a", state: "merged", owns: ["x"] }, { lane: "b", state: "open", owns: ["x"] }, { lane: "c", state: "stale", owns: ["x"] }] }, "x").map((o) => o.lane).join() === "b");

    // buildOwners against a fake git: queued vs stale, pushedAt, a squash merge.
    const hd = join(dir, "handovers");
    mkdirSync(hd, { recursive: true });
    writeFileSync(join(hd, "MERGE-QUEUE.md"), "# Queue\n\n7. `claude/system-panel` (fd85, PR #398). **P2.** The System tab.\n8. `claude/old-queued` (abc1). **P2.** Waiting.\n");
    writeFileSync(join(hd, "fresh.md"), "# Lane fresh\n| Branch | Commit |\n|---|---|\n| `claude/fresh-work` | 1111 | pushed |\n");
    const base = "origin/claude/base";
    const tips = { "origin/claude/fresh-work": NOW - 3600_000, "origin/claude/old-queued": NOW - 9 * 864e5, "origin/claude/old-gone": NOW - 9 * 864e5, "origin/claude/system-panel": NOW - 2 * 864e5 };
    const git = (...a) => {
      const s = a.join(" ");
      if (s.startsWith("for-each-ref") && s.includes("--merged=origin/claude/base")) return "";
      if (s.startsWith("for-each-ref") && s.includes("--merged=")) return "";
      if (s.startsWith("for-each-ref")) return Object.keys(tips).join("\n");
      if (s.startsWith("log --first-parent")) return `${new Date(NOW - 864e5).toISOString()} The System tab in the side panel (#398)\n${new Date(NOW - 3 * 864e5).toISOString()} something else`;
      if (s.startsWith("log -1")) return new Date(tips[a.at(-1)]).toISOString();
      if (s.startsWith("rev-list")) return "1";
      if (s.startsWith("diff --name-only --diff-filter=A")) return a.at(-1).includes("fresh") ? "helper/new/a.ts\nhelper/new/b.ts" : "";
      if (s.startsWith("diff --name-only")) return a.at(-1).includes("fresh") ? "helper/new/a.ts\nhelper/new/b.ts\nsrc/x.ts" : "src/y.ts";
      if (s.startsWith("ls-tree")) return "";
      throw new Error(`fake git doesn't know: ${s}`);
    };
    const built = O.buildOwners({ handoversDir: hd, git, base, now: () => new Date(NOW) });
    const by = Object.fromEntries(built.owners.map((o) => [o.branch, o]));
    check("a branch pushed an hour ago is open, owned by the handover that claims it, with pushedAt and folder/* for its new folder",
      by["claude/fresh-work"]?.state === "open" && by["claude/fresh-work"].lane === "fresh" && by["claude/fresh-work"].pushedAt === new Date(NOW - 3600_000).toISOString() && by["claude/fresh-work"].owns.join() === "helper/new/*,src/x.ts", JSON.stringify(by["claude/fresh-work"]));
    check("an old branch that MERGE-QUEUE lists stays open (it will merge); one nobody lists goes stale",
      by["claude/old-queued"]?.state === "open" && by["claude/old-queued"].queued === true && by["claude/old-gone"]?.state === "stale" && by["claude/old-gone"].queued === false, `${by["claude/old-queued"]?.state} ${by["claude/old-gone"]?.state}`);
    check("a branch squash-merged under its PR number counts as merged", by["claude/system-panel"]?.state === "merged", by["claude/system-panel"]?.state);
    const file = join(hd, "owners.json");
    O.saveOwners(file, built);
    const read = O.ownersReader(file);
    const first = read();
    check("ownersReader reads the file once until it changes", first === read() && first.owners.length === 4);
  }

  // ---- the server with the coordinator behind it ---------------------------------
  if (Sv && Pa) {
    const t = setup({ answer: answer([lane("via-server", ["src/v.ts"])]) });
    const shown = [];
    const pairing = new Pa.Pairing({ show: (c) => shown.push(c) });
    const helper = await Sv.startHelperServer({ runner: t.coord, pairing, port: 0 });
    const port = helper.port;
    const DOCK = `http://127.0.0.1:${port}`;
    const call = (method, path, { origin, token, body } = {}) => new Promise((resolve, reject) => {
      const headers = { host: `127.0.0.1:${port}` };
      if (origin) headers.origin = origin;
      if (token) headers.authorization = `Bearer ${token}`;
      if (body !== undefined) headers["content-type"] = "application/json";
      const r = httpRequest({ host: "127.0.0.1", port, method, path, headers }, (res) => {
        let text = "";
        res.on("data", (c) => { text += c; if (path === "/stream" && res.statusCode === 200) { res.destroy(); resolve({ status: 200, text }); } });
        res.on("end", () => { let json = null; try { json = JSON.parse(text); } catch {} resolve({ status: res.statusCode, text, json }); });
      });
      r.on("error", reject);
      if (body !== undefined) r.write(JSON.stringify(body));
      r.end();
    });
    try {
      await call("POST", "/pair/start", { origin: DOCK });
      const token = (await call("POST", "/pair", { origin: DOCK, body: { code: shown[0] } })).json?.token;
      const r = await call("POST", "/request", { origin: DOCK, token, body: req("through the server") });
      check("POST /request goes through the lead and answers with its plan", r.status === 200 && r.json?.plan?.lanes?.[0]?.lane === "via-server" && t.asked.length === 1, r.text.slice(0, 120));
      await until(() => t.started().includes("via-server"));
      const stream = await call("GET", "/stream", { origin: DOCK, token });
      check("the stream's snapshot has the lane's row", stream.text.includes('"lane":"via-server"'));
      const c = await call("POST", "/control", { origin: DOCK, token, body: { v, kind: "control", lane: "via-server", do: "stop", by: "j" } });
      check("a control reaches the lane through the queue", c.status === 200 && c.json?.ok === true);
    } finally {
      await t.coord.stopAll();
      await helper.close();
    }
  }

  rmSync(dir, { recursive: true, force: true });
}

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
