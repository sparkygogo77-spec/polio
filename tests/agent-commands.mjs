#!/usr/bin/env node
/**
 * THE AGENT COMMANDS: EVERY CALL PINNED (handovers/INTERFACE-OPTIONS.md,
 * section 3, card 3).
 *
 *   1. pure: the tools are listed and turn into the dock's requests; the gate
 *      refuses each new step's bad forms with a plain reason; the fields a
 *      patch may name are the model's own fields; the log keeps no values;
 *   2. on a board, through a stub of the dock frame: the outline, a read by id,
 *      add, group, ungroup, select, picked, parts under a point (held to the
 *      browser's own `elementsFromPoint`), reorder, and setFont held to the size
 *      the browser computes. Each change is one undo step that undoes exactly;
 *      each refusal leaves no undo step and no change; nothing publishes,
 *      loads or clears through the bridge.
 *
 *   npx next start -p 3361
 *   node tests/agent-commands.mjs                                (part 1)
 *   node tests/agent-commands.mjs http://127.0.0.1:3361          (parts 1, 2 on sol face)
 *   node tests/agent-commands.mjs http://127.0.0.1:3361 <sink>   (and on every repo fixture; <sink>/sites/<name>/site/document.json)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = process.argv[2]?.replace(/\/$/, "") ?? null;
const SINK = process.argv[3] ?? process.env.SINK ?? null;
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

process.env.POLIO_SITE_NO_MAIN = "1";
const M = await import("../helper/mcp/site.ts");
const B = await import("../src/features/agents/siteSteps.ts");
const L = await import("../helper/server/bridgeLog.ts");

/* 1. Pure. */
const names = M.SITE_TOOLS.map((t) => t.name);
check("1. the tools are listed", ["site.read", "site.outline", "site.picked", "site.at", "site.select", "site.shot", "site.apply"].every((n) => names.includes(n)), names.join(", "));
const asked = (name, args) => M.toRequest(name, args, "i");
check("…each becomes the dock's request", asked("site.outline", { page: "p" }).op === "outline" && asked("site.outline", { page: "p" }).page === "p" && asked("site.picked").op === "picked" && asked("site.at", { x: 1, y: 2 }).x === 1 && asked("site.select", { ids: ["a"] }).ids[0] === "a" && asked("site.read", { ids: ["a"] }).ids[0] === "a" && !("ids" in asked("site.read")));
check("…and none of them publishes, loads or clears", !names.some((n) => /publish|load|clear/.test(n)) && asked("site.publish") === null && asked("site.clear") === null && asked("site.load") === null);

const STEPS = ["updateNode", "updatePage", "setLook", "removeNodes", "setToken", "addNode", "group", "ungroup", "reorder", "setFont"];
check("the tool lists every step the gate takes, and only those", JSON.stringify(M.SITE_TOOLS.find((t) => t.name === "site.apply").inputSchema.properties.steps.items.properties.op.enum) === JSON.stringify(STEPS) && JSON.stringify(B.SITE_OPS) === JSON.stringify(STEPS));

const board = {
  site: "s1", nodeIds: new Set(["n1", "n2", "n3"]), pageIds: new Set(["p0", "p1"]), tokenIds: new Set(), groupIds: new Set(["g1"]), version: "v2",
  hasKind: (k) => k === "prose", pageOf: (id) => (id === "n3" ? "p1" : "p0"),
  fontOf: (id) => (id === "n2" ? { words: false, font: null } : { words: true, font: { size: 1, px: 16, stack: "Old", face: "Old" } }),
};
const req = (steps, more = {}) => ({ source: "polio-dock", kind: "site", v: 1, id: "r", op: "apply", site: "s1", name: "x", steps, ...more });
const gate = (...steps) => B.checkApply(req(steps), board).join("; ");
const passes = (name, ...steps) => check(`the gate passes ${name}`, gate(...steps) === "", gate(...steps));
const refuses = (name, re, ...steps) => { const w = gate(...steps); check(`…refuses ${name}`, re.test(w), w); };
passes("an add", { op: "addNode", featureId: "prose", x: 1, y: 2, patch: { content: "hi" } });
passes("an add, then a group and a font by its name", { op: "addNode", featureId: "prose", x: 1, y: 2, as: "a" }, { op: "group", ids: ["a", "n1"] }, { op: "setFont", id: "a", px: 20 }, { op: "reorder", id: "a", to: "back" });
passes("a group, an ungroup, a reorder, a font", { op: "group", ids: ["n1", "n2"], label: "pair" }, { op: "ungroup", group: "g1" }, { op: "reorder", id: "n1", to: "front" }, { op: "reorder", id: "n1", above: "n2" }, { op: "setFont", id: "n1", px: 24, face: "Inter", weight: 700 });
refuses("a kind the Builder doesn't have", /no part of kind "nope"/, { op: "addNode", featureId: "nope", x: 1, y: 2 });
refuses("an add with no place", /x must be a number/, { op: "addNode", featureId: "prose", y: 2 });
refuses("an add on a page that isn't there", /page "p9"/, { op: "addNode", featureId: "prose", x: 1, y: 2, page: "p9" });
refuses("an add carrying keys", /looks like a key/, { op: "addNode", featureId: "prose", x: 1, y: 2, patch: { content: `ghp_${"a".repeat(30)}` } });
refuses("an add setting its own id", /can't be changed/, { op: "addNode", featureId: "prose", x: 1, y: 2, patch: { id: "n1" } });
refuses("a name used twice", /already a part's name/, { op: "addNode", featureId: "prose", x: 1, y: 2, as: "a" }, { op: "addNode", featureId: "prose", x: 1, y: 2, as: "a" });
refuses("a name before its add", /part "a" is not on the open site/, { op: "setFont", id: "a", px: 20 }, { op: "addNode", featureId: "prose", x: 1, y: 2, as: "a" });
refuses("a group of one", /at least two/, { op: "group", ids: ["n1"] });
refuses("a group with a made-up part", /part "n9"/, { op: "group", ids: ["n1", "n9"] });
refuses("a group across pages", /one page/, { op: "group", ids: ["n1", "n3"] });
refuses("an ungroup of no group", /group "g9"/, { op: "ungroup", group: "g9" });
refuses("a reorder saying two things", /one of to, above or below/, { op: "reorder", id: "n1", to: "front", above: "n2" });
refuses("a reorder saying nothing", /one of to, above or below/, { op: "reorder", id: "n1" });
refuses("a reorder to nowhere", /"sideways" is not one of/, { op: "reorder", id: "n1", to: "sideways" });
refuses("a reorder against itself", /relative to itself/, { op: "reorder", id: "n1", above: "n1" });
refuses("a reorder across pages", /different pages/, { op: "reorder", id: "n1", above: "n3" });
refuses("a font asking nothing", /say px, face or weight/, { op: "setFont", id: "n1" });
refuses("a size past the range", /not a size from 8 to 200/, { op: "setFont", id: "n1", px: 500 });
refuses("a weight that isn't one", /not one of 300 to 800/, { op: "setFont", id: "n1", weight: 450 });
refuses("a font on a part with no words", /no words for a font/, { op: "setFont", id: "n2", px: 20 });
refuses("font.px, which draws nothing", /font\.px is not what is drawn: use setFont/, { op: "updateNode", id: "n1", patch: { font: { px: 24 } } });
refuses("a new face under the old stack", /hidden under font\.stack: use setFont/, { op: "updateNode", id: "n1", patch: { font: { face: "New", stack: "Old" } } });
refuses("a field a part doesn't have", /colur is not a field a part has/, { op: "updateNode", id: "n1", patch: { colur: { bg: "#000" } } });
refuses("a box that isn't a number", /x must be a number/, { op: "updateNode", id: "n1", patch: { x: "12" } });
refuses("a step the board has no such op for", /"publish" is not a step/, { op: "publish" });
check("…a new step is held to an older copy too", /older copy/.test(B.checkApply(req([{ op: "addNode", featureId: "prose", x: 1, y: 2 }], { base: "v1" }), board).join()));

const model = readFileSync(new URL("../src/features/studio/board/store/model.ts", import.meta.url), "utf8");
const face = model.slice(model.indexOf("export interface StudioNode"));
const fields = [...face.slice(0, face.indexOf("\n}")).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]).filter((k) => k !== "id" && k !== "pageId");
const missing = fields.filter((k) => !B.PART_FIELDS.has(k)), extra = [...B.PART_FIELDS].filter((k) => !fields.includes(k));
check("the fields a patch may name are the model's own", fields.length > 30 && !missing.length && !extra.length, JSON.stringify({ missing, extra }));

check("the outline's first words: a string, runs, nothing, and long words cut", B.firstWords(" a  b ") === "a b" && B.firstWords([{ text: "a " }, { text: "b" }]) === "a b" && B.firstWords(null) === "" && B.firstWords("x".repeat(70)).length === 41);
const under = B.underPoint([{ id: "low", x: 0, y: 0, w: 10, h: 10, z: 0, at: 0 }, { id: "high", x: 0, y: 0, w: 10, h: 10, z: 0, at: 1 }, { id: "pinned", x: 0, y: 0, w: 10, h: 10, z: 5, at: 0 }, { id: "away", x: 50, y: 0, w: 10, h: 10, z: 9, at: 2 }], 5, 5).map((p) => p.id).join();
check("parts under a point: the higher level first, then the later", under === "pinned,high,low", under);

const logged = L.describeCall("lane", req([{ op: "addNode", featureId: "prose", x: 1, y: 2, patch: { content: "SECRET WORDS" } }, { op: "ungroup", group: "g1" }, { op: "setFont", id: "n1", face: "SECRET FACE" }]), true);
check("the log keeps a new step's op and ids, never its values", logged.steps[0].startsWith("addNode prose: content") && logged.steps[1] === "ungroup g1" && logged.steps[2] === "setFont n1" && !JSON.stringify(logged).includes("SECRET"), JSON.stringify(logged.steps));
check("…and what a pick picked", L.describeCall("lane", { op: "select", ids: ["n1", "n2"] }, true).steps[0] === "select n1, n2");

/* 2. On a board. */
const STUB = `<!doctype html><title>dock stub</title><body>dock<script>
window.ask = (req) => new Promise((done) => { const on = (e) => { if (e.data && e.data.kind === "site" && e.data.id === req.id) { removeEventListener("message", on); done(e.data); } }; addEventListener("message", on); parent.postMessage(req, "*"); setTimeout(() => { removeEventListener("message", on); done({ timeout: true }); }, 60000); });
</script>`;

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const launch = () => chromium.launch({ args: ["--no-sandbox"], ...(AT ? { executablePath: AT } : {}) });
let browser = await launch();
/* A headless board under swiftshader can freeze for good mid-site (import-checkup saw it on mochi3). On parasiteonsol-fun, the heaviest fixture, it comes about
   130 s into the run, on whichever call is then drawing: the page stops answering and a debugger can't pause it, so no script is running (2026-11-01, five runs).
   A site past this many minutes is marked, its browser thrown away, and the next site gets a new one, so a freeze never holds the heavy lock or hides the rest.
   LATE_ONLY=1 skips from the add to the reorder, so the checks after them run on a fresh page. */
const SITE_MINUTES = Number(process.env.SITE_MINUTES) || 5;
const EARLY = !process.env.LATE_ONLY;
async function guarded(label, doc) {
  let t;
  const stall = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`stalled for ${SITE_MINUTES} minutes`)), SITE_MINUTES * 60_000); });
  try { await Promise.race([onBoard(label, doc), stall]); }
  catch (e) {
    check(`${label}: ran to the end (the headless renderer ${e.message})`, false, String(e.stack ?? e).split("\n").slice(0, 2).join(" "));
    const old = browser;
    await Promise.race([old.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
    try { old.process()?.kill("SIGKILL"); } catch {}
    browser = await launch();
  } finally { clearTimeout(t); }
}
const errors = [];

async function onBoard(label, doc) {
  const say = (name, ok, detail) => check(`${label}: ${name}`, ok, detail);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: STUB }));
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(180_000);
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await openBoard(page, BASE, "solface");
  if (doc) { await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id }); await page.waitForTimeout(1500); }
  await page.locator("[data-agents-button]").click();
  await page.locator("[data-agents-frame]").waitFor({ timeout: 120_000 });
  const dock = page.frames().find((f) => f.url().startsWith(HELPER));
  await page.waitForTimeout(800);
  let n = 0;
  const ask = (more) => dock.evaluate((r) => window.ask(r), { source: "polio-dock", kind: "site", v: 1, id: `c${++n}`, ...more });
  const past = () => page.evaluate(() => window.__agents.board().past);
  const nodes = () => page.evaluate(() => JSON.stringify(window.__studioNodes()));
  const picked = () => page.evaluate(() => window.__studioSelection());
  const undo = async () => { await page.evaluate(() => window.__studioHistory.act("undo")); await page.waitForTimeout(250); };

  /* The outline, against the whole read. */
  const whole = await ask({ op: "read" });
  if (whole.ok !== true) { say("the whole site reads", false, whole.says); return; }
  const site = whole.result?.site;
  const outline = await ask({ op: "outline" });
  const slim = outline.result?.pages?.flatMap((p) => p.parts) ?? [];
  const chars = JSON.stringify(outline.result ?? "").length, fullChars = JSON.stringify(whole.result ?? "").length;
  say("the outline has every part, with id, kind, box and first words", outline.ok === true && slim.length === whole.result.parts.length && slim.every((p) => typeof p.id === "string" && typeof p.kind === "string" && p.box?.length === 4) && slim.some((p) => typeof p.words === "string"), `${slim.length} parts`);
  say("…and is a fraction of the whole read", chars < fullChars / 3, `${chars} characters against ${fullChars}`);
  if (!doc) say("…on sol face about a seventh of the whole read, 16,000 tokens at most by a rough count", chars / 4 < 16_000 && chars * 7 < fullChars, `about ${Math.round(chars / 4)} tokens against about ${Math.round(fullChars / 4)}`);
  const home = whole.result.activePageId;
  const words = slim.filter((p) => p.words);
  const reading = await ask({ op: "read", ids: [words[0].id] });
  say("a read by id answers that part in full, and no more", reading.ok === true && reading.result.parts.length === 1 && reading.result.parts[0].id === words[0].id && !("look" in reading.result), JSON.stringify(reading.says ?? ""));
  const noRead = await ask({ op: "read", ids: ["n_nope"] });
  say("…a made-up id is refused", noRead.ok === false && /n_nope/.test(noRead.says), noRead.says);
  const noPage = await ask({ op: "outline", page: "page_nope" });
  say("…so is an outline of a made-up page", noPage.ok === false && /page_nope/.test(noPage.says), noPage.says);

  const apply = (steps, more = {}) => ask({ op: "apply", site, name: "agent commands", steps, ...more });
  const undoes = async (name, before, p) => { await undo(); say(`…${name} undoes exactly`, (await nodes()) === before && (await past()) === p); };

  /* Select and picked: no undo step, and the version stands. */
  const onHome = whole.result.parts.filter((x) => x.pageId === home);
  const two = onHome.slice(0, 2).map((x) => x.id);
  const p0 = await past();
  const v0 = (await ask({ op: "read", ids: [two[0]] })).result.version;
  const sel = await ask({ op: "select", ids: two });
  say("select picks the parts on the board", sel.ok === true && JSON.stringify(await picked()) === JSON.stringify(two), JSON.stringify(await picked()));
  const asPicked = await ask({ op: "picked" });
  say("picked answers them, with name and box", asPicked.ok === true && JSON.stringify(asPicked.result.ids) === JSON.stringify(two) && asPicked.result.parts[0].box.length === 4 && typeof asPicked.result.parts[0].name === "string");
  say("…with no undo step, and the same version", (await past()) === p0 && (await ask({ op: "read", ids: [two[0]] })).result.version === v0);
  const badPick = await ask({ op: "select", ids: ["n_nope"] });
  say("…a made-up part is refused, and the pick stands", badPick.ok === false && /n_nope/.test(badPick.says) && JSON.stringify(await picked()) === JSON.stringify(two), badPick.says);
  const otherPage = whole.result.parts.find((x) => x.pageId !== home);
  if (otherPage) { const away = await ask({ op: "select", ids: [otherPage.id] }); say("…so is a part on a page that isn't open", away.ok === false && /another page/.test(away.says), away.says); }
  const wrongSite = await ask({ op: "select", site: "someone-else", ids: two });
  say("…and another site", wrongSite.ok === false && /open site/.test(wrongSite.says), wrongSite.says);
  await ask({ op: "select", ids: [two[0]] });

  /* Add. */
  if (EARLY) {
  const pa = await past(), na = await nodes();
  const add = await apply([{ op: "addNode", featureId: "prose", x: 40, y: 60, patch: { content: "Added by an agent", w: 300 }, as: "words" }]);
  const made = add.result?.added?.[0];
  const madeNode = JSON.parse(await nodes()).find((x) => x.id === made?.id);
  say("add puts a part on the page, as one undo step", add.ok === true && madeNode?.content === "Added by an agent" && madeNode.pageId === home && (await past()) === pa + 1, JSON.stringify(add.result?.added ?? add.says));
  await page.locator(`[data-node-id="${made?.id}"]`).waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});
  say("…it is drawn", (await page.locator(`[data-node-id="${made?.id}"]`).count()) === 1);
  say("…what J had picked stays picked", JSON.stringify(await picked()) === JSON.stringify([two[0]]), JSON.stringify(await picked()));
  await undoes("the add", na, pa);
  }
  const before = { past: await past(), nodes: await nodes() };
  const quiet = async (name, r, re) => say(`${name} is refused, with no undo step`, r.ok === false && re.test(r.says) && (await past()) === before.past && (await nodes()) === before.nodes, r.says);
  await quiet("an unknown kind", await apply([{ op: "addNode", featureId: "nope", x: 1, y: 1 }]), /no part of kind/);
  await quiet("an add, then a bad step", await apply([{ op: "addNode", featureId: "prose", x: 1, y: 1 }, { op: "updateNode", id: "n_nope", patch: { x: 1 } }]), /n_nope/);

  if (EARLY) {
  /* Add and group in one call. */
  const inOne = await apply([{ op: "addNode", featureId: "prose", x: 40, y: 60, as: "a", patch: { content: "One" } }, { op: "addNode", featureId: "prose", x: 40, y: 120, as: "b", patch: { content: "Two" } }, { op: "group", ids: ["a", "b"], label: "Pair" }]);
  const grouped = JSON.parse(await nodes()).filter((x) => inOne.result?.added?.some((a) => a.id === x.id));
  const pairId = inOne.result?.grouped?.[0]?.id;
  say("two adds and their group in one call are one undo step", inOne.ok === true && grouped.length === 2 && grouped.every((x) => x.groupId === pairId) && (await past()) === before.past + 1, JSON.stringify(inOne.says ?? inOne.result?.grouped));
  const seen = (await ask({ op: "outline", page: home })).result;
  say("…the outline has the group", seen.groups.some((g) => g.id === pairId && g.label === "Pair"));
  await undoes("the call", before.nodes, before.past);

  /* Group and ungroup on the board. */
  const loose = onHome.filter((x) => !x.groupId).slice(0, 2).map((x) => x.id);
  const grp = await apply([{ op: "group", ids: loose, label: "Two parts" }]);
  const gid = grp.result?.grouped?.[0]?.id;
  say("group holds two parts, as one undo step", grp.ok === true && JSON.parse(await nodes()).filter((x) => x.groupId === gid).length === 2 && (await past()) === before.past + 1, JSON.stringify(grp.says ?? gid));
  const pg = await past();
  const again = await apply([{ op: "group", ids: loose }]);
  say("…grouping them again is refused, with no undo step", again.ok === false && /nothing would change/.test(again.says) && (await past()) === pg, again.says);
  const ung = await apply([{ op: "ungroup", group: gid }]);
  say("ungroup lets them go, as one undo step", ung.ok === true && !JSON.parse(await nodes()).some((x) => x.groupId === gid) && (await past()) === pg + 1, ung.says);
  await undo(); await undo();
  say("…both undo exactly", (await nodes()) === before.nodes && (await past()) === before.past);
  await quiet("an ungroup of no group", await apply([{ op: "ungroup", group: "g_nope" }]), /g_nope/);

  /* Parts under a point, against the browser's own answer. */
  const view = await page.evaluate(() => {
    const frame = document.querySelector("[data-frame]").getBoundingClientRect();
    return { left: frame.left, top: frame.top, scale: frame.width / window.__studioFrameWidth?.() || null, w: frame.width };
  });
  const frameW = whole.result.frameWidth, scale = view.w / frameW;
  const onScreen = onHome.filter((x) => x.w > 20 && x.h > 20 && x.y >= 0 && (x.y + x.h / 2) * scale + view.top < 880 && (x.y + x.h / 2) * scale + view.top > 60 && (x.x + x.w / 2) * scale + view.left > 0 && (x.x + x.w / 2) * scale + view.left < 1100).slice(0, 12);
  let agree = 0, tried = 0; const off = [], stacks = [];
  for (const part of onScreen) {
    const x = part.x + part.w / 2, y = part.y + part.h / 2;
    const at = await ask({ op: "at", x, y });
    const browserSays = await page.evaluate(({ sx, sy }) => { const out = []; for (const el of document.elementsFromPoint(sx, sy)) { const id = el.closest?.("[data-node-id]")?.getAttribute("data-node-id"); if (id && !out.includes(id)) out.push(id); } return out; }, { sx: x * scale + view.left, sy: y * scale + view.top });
    const ours = at.result?.parts?.map((p) => p.id) ?? [];
    const clickable = at.result?.parts?.filter((p) => p.clicks).map((p) => p.id) ?? [];
    tried++;
    /* The parts a click reaches are the browser's, in its order; the ones it passes through follow, and the part itself is always named. */
    if (at.ok === true && JSON.stringify(clickable) === JSON.stringify(browserSays) && ours.includes(part.id) && ours.slice(clickable.length).every((id) => !browserSays.includes(id))) agree++;
    else off.push({ part: part.id, ours: ours.slice(0, 5), browserSays: browserSays.slice(0, 5) });
    if (clickable.length >= 2) stacks.push({ x, y, ours, clickable });
  }
  say("parts under a point match the browser's own, topmost first, and name what a click passes through", tried > 0 && agree === tried, `${agree}/${tried} ${JSON.stringify(off.slice(0, 2))}`);
  const nowhere = await ask({ op: "at", x: -500, y: -500 });
  say("…nothing there is an empty answer", nowhere.ok === true && nowhere.result.parts.length === 0);
  const badAt = await ask({ op: "at", x: "left", y: 2 });
  say("…a point that isn't one is refused", badAt.ok === false && /must be numbers/.test(badAt.says), badAt.says);

  /* Reorder: a part below comes to the top of the stack at a point. Only a part a click reaches can be seen on top (a sheet that lets presses
     through is not hit-tested), and the board paints a holder beneath what it holds (paintOrder.ts), so a section's box can't come over its own
     parts: that is refused saying what it holds, with no undo step, and the next part up, then the next point, is tried. */
  let p = await past(), was = await nodes();
  const pStart = p, wasStart = was;
  let stack = null, low = null, up = null, holderSaid = null, mine = null;
  for (const st of stacks) {
    for (const id of st.clickable.slice(1).reverse()) {
      up = await apply([{ op: "reorder", id, to: "front" }]);
      if (up.ok === true) { low = id; stack = st; break; }
      if (/holds .*paints beneath what it holds/.test(up.says) && (await past()) === p) { holderSaid = up.says; continue; }
      break;
    }
    if (low || (up && up.ok !== true && !/holds .*paints beneath/.test(up.says))) break;
  }
  if (holderSaid) say("…a holder below is refused plainly, saying what it holds, with no undo step", true, holderSaid);
  /* A site where every part under another is its holder (a card's box under its words: gotchi, stonkfun, trendtrader): the agent's own new part is the one
     to move. It is added over the stack, sent to the back, and "front" must bring it up again. */
  if (!stack && stacks.length) {
    const st = stacks[0];
    const add = await apply([{ op: "addNode", featureId: "box", x: Math.round(st.x - 40), y: Math.round(st.y - 40), patch: { w: 80, h: 80 }, as: "mine" }, { op: "reorder", id: "mine", to: "back" }]);
    const id = add.result?.added?.[0]?.id;
    say("…so the agent's own part is added over the stack and sent to the back, in one step", add.ok === true && !!id && (await past()) === p + 1, add.says);
    if (id) {
      await page.waitForTimeout(600);
      p = await past(); was = await nodes();
      up = await apply([{ op: "reorder", id, to: "front" }]);
      if (up.ok === true) { low = id; mine = id; stack = { ...st, clickable: [...st.clickable, id] }; }
    }
  }
  if (stack) {
    const now = (await ask({ op: "at", x: stack.x, y: stack.y })).result.parts.map((q) => q.id);
    const ownZ = await page.evaluate(([a, b]) => { const z = (id) => Number.parseInt(getComputedStyle(document.querySelector(`[data-node-id="${id}"]`)).zIndex, 10) || 0; return z(a) >= z(b); }, [low, stack.clickable[0]]);
    say("reorder to the front takes the part to the top of the stack, as one undo step", up.ok === true && (!ownZ || now[0] === low) && (await past()) === p + 1, JSON.stringify({ low, now: now.slice(0, 3), tried: stack.clickable }));
    const twice = await apply([{ op: "reorder", id: low, to: "front" }]);
    say("…again is refused: it is already there", twice.ok === false && /nothing would change/.test(twice.says) && (await past()) === p + 1, twice.says);
    await undoes("the reorder", was, p);
    const pb = await past();
    const under = await apply([{ op: "reorder", id: stack.clickable[0], below: low }]);
    say("reorder below another part goes under it", under.ok === true && (await past()) === pb + 1, under.says);
    await undoes("that", was, pb);
    if (mine) { await undo(); say("…and the agent's own part is undone with it, back to the board as it was", (await nodes()) === wasStart && (await past()) === pStart); }
  } else say("a point with a part that can come to the front", false, JSON.stringify({ points: stacks.length, says: up?.says }));
  await quiet("a reorder of no part", await apply([{ op: "reorder", id: "n_nope", to: "front" }]), /n_nope/);
  await quiet("a reorder to nowhere", await apply([{ op: "reorder", id: two[0], to: "sideways" }]), /sideways/);

  }

  /* setFont: the number is the size the browser draws. */
  const sized = (id) => page.evaluate((i) => {
    const el = document.querySelector(`[data-node-id="${i}"]`);
    if (!el) return null;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) { if (t.textContent.trim() && t.parentElement.getClientRects().length) { const c = getComputedStyle(t.parentElement); return { px: parseFloat(c.fontSize), family: c.fontFamily }; } }
    return null;
  }, id);
  const kinds = new Map();
  for (const part of slim) { if (!part.words || !onHome.some((x) => x.id === part.id)) continue; if (part.box[1] > 900 || kinds.has(part.kind)) continue; if ((await sized(part.id))?.px) kinds.set(part.kind, part); if (kinds.size >= 5) break; }
  const wrong = [];
  for (const part of kinds.values()) {
    const p = await past(), was = await nodes();
    const was0 = await sized(part.id);
    const want = Math.round(was0.px) === 31 ? 37 : 31;
    const r = await apply([{ op: "setFont", id: part.id, px: want }]);
    await page.waitForTimeout(250);
    const drawn = await sized(part.id);
    const told = (await ask({ op: "read", ids: [part.id] })).result.parts[0].drawnPx;
    const one = (await past()) === p + 1;
    if (!(r.ok === true && Math.abs(drawn.px - want) < 1 && Math.abs(told - want) < 1 && one)) wrong.push({ kind: part.kind, id: part.id, want, drawn: drawn?.px, told, one, says: r.says, was: was0.px });
    await undo();
    /* A heavy board settles round the restored words a moment after the undo: give it time, and name what still differs. */
    let back = await nodes();
    for (let i = 0; i < 16 && back !== was; i++) { await page.waitForTimeout(500); back = await nodes(); }
    if (back !== was) {
      const old = new Map(JSON.parse(was).map((x) => [x.id, x]));
      const drift = JSON.parse(back).flatMap((x) => { const o = old.get(x.id); if (!o) return [{ id: x.id, added: true }]; const fields = [...new Set([...Object.keys(o), ...Object.keys(x)])].filter((k) => JSON.stringify(o[k]) !== JSON.stringify(x[k])); return fields.length ? [{ id: x.id, fields: fields.map((k) => k + ":" + JSON.stringify(o[k])?.slice(0, 40) + ">" + JSON.stringify(x[k])?.slice(0, 40)) }] : []; });
      /* The one allowed: the part itself re-measured round its words, a pixel or two, by the board's settle, which is outside history (the handover says so). */
      const settled = drift.length === 1 && drift[0].id === part.id && drift[0].fields?.length === 1 && drift[0].fields[0].startsWith("h:") && Math.abs(JSON.parse(back).find((x) => x.id === part.id).h - old.get(part.id).h) <= 2;
      if (!settled) wrong.push({ kind: part.kind, undo: "not exact", parts: drift.length, drift: drift.slice(0, 4) });
      else { console.log("  --   " + label + ": " + part.id + " re-measured after the undo: " + drift[0].fields[0]); }
    }
  }
  say("setFont draws the words at the size it names, on each kind, as one undo step", kinds.size > 0 && !wrong.length, `${kinds.size} kinds ${JSON.stringify(wrong.slice(0, 3)).slice(0, 900)}`);

  const facePart = [...kinds.values()][0];
  if (facePart) {
    const was = await nodes();
    const r = await apply([{ op: "setFont", id: facePart.id, face: "Courier New" }]);
    await page.waitForTimeout(250);
    const drawn = await sized(facePart.id);
    const f = JSON.parse(await nodes()).find((x) => x.id === facePart.id).font;
    say("setFont's face is the one drawn, with no old stack over it", r.ok === true && /courier new/i.test(drawn.family.split(",")[0]) && !f.stack, JSON.stringify({ family: drawn?.family, says: r.says }));
    const same = await apply([{ op: "setFont", id: facePart.id, face: "Courier New" }]);
    say("…the same again is refused", same.ok === false && /nothing would change/.test(same.says), same.says);
    await undo();
    /* The font comes back exactly. A face change can make words taller, and the board's own settle then writes the new heights down outside history, as it does for a change from the panel: those are not this call's to undo. */
    const fontBack = JSON.stringify(JSON.parse(await nodes()).find((x) => x.id === facePart.id).font ?? null) === JSON.stringify(JSON.parse(was).find((x) => x.id === facePart.id).font ?? null);
    say("…and the font undoes exactly", fontBack && (await past()) === before.past);
    const hidden = await apply([{ op: "updateNode", id: facePart.id, patch: { font: { px: 99 } } }]);
    say("patch.font.px is refused, and says what to use", hidden.ok === false && /use setFont/.test(hidden.says), hidden.says);
  }
  /* From here the board may hold re-measured heights (above), so what "unchanged" means is taken again. */
  before.nodes = await nodes(); before.past = await past();
  const pristineNow = before.nodes;
  const noWords = onHome.find((x) => !x.content && !x.font);
  if (noWords) await quiet("a font on a part with no words", await apply([{ op: "setFont", id: noWords.id, px: 20 }]), /no words/);
  await quiet("a size past the range", await apply([{ op: "setFont", id: words[0].id, px: 900 }]), /8 to 200/);
  await quiet("a misspelled field", await apply([{ op: "updateNode", id: words[0].id, patch: { colur: { bg: "#000" } } }]), /not a field a part has/);

  /* Hardening's checks stand on every new step. */
  await quiet("a new step against an older copy", await apply([{ op: "addNode", featureId: "prose", x: 1, y: 1 }], { base: "0-old" }), /older copy/);
  await quiet("a step for publishing", await apply([{ op: "publish" }]), /not a step/);
  await quiet("a step for clearing", await apply([{ op: "clear" }]), /not a step/);
  await quiet("a step for loading a site", await apply([{ op: "loadDoc", doc: {} }]), /not a step/);
  for (const op of ["publish", "load", "clear"]) { const r = await ask({ op, site }); say(`…${op} as a call of its own is refused`, r.ok === false && (await nodes()) === pristineNow, r.says); }
  const fromPage = await page.evaluate(() => new Promise((done) => { const on = (e) => { if (e.data?.source === "polio-builder" && e.data.id === "evil") { removeEventListener("message", on); done("answered"); } }; addEventListener("message", on); window.postMessage({ source: "polio-dock", kind: "site", v: 1, id: "evil", op: "outline" }, "*"); setTimeout(() => { removeEventListener("message", on); done("ignored"); }, 800); }));
  say("the new reads hear only the dock: a message from the page is ignored", fromPage === "ignored", fromPage);
  /* Down the page: Move up and Move down's own step. A site may have no pair to trade; the refusal must say so. */
  before.past = await past(); before.nodes = await nodes();
  let moved = null, noTrade = null;
  for (const part of onHome.slice(0, 60)) {
    const r = await apply([{ op: "reorder", id: part.id, to: "later" }]);
    if (r.ok) { moved = part.id; break; }
    noTrade = r.says;
  }
  if (moved) {
    say("reorder later trades places down the page, as one undo step", (await past()) === before.past + 1 && JSON.parse(await nodes()).find((x) => x.id === moved).y !== onHome.find((x) => x.id === moved).y);
    await undoes("the trade", before.nodes, before.past);
  } else say("…with no neighbour the refusal says so", /no neighbour/.test(noTrade ?? ""), noTrade);
  say("…no refusal left anything behind", (await past()) === before.past && (await nodes()) === before.nodes);

  await ctx.close();
}

if (BASE) {
  const only = process.env.ONLY_SITE;
  if (!only) await guarded("sol face", null);
  if (SINK) {
    for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
      if (only && only !== site) continue;
      const file = join(SINK, "sites", site, "site", "document.json");
      if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); continue; }
      await guarded(site, JSON.parse(readFileSync(file, "utf8")));
    }
  } else console.log("  --   the fixtures skipped: no fixtures folder given (argv 3 or SINK)");
} else console.log("  --   part 2 skipped: no Builder address given");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
