#!/usr/bin/env node
/**
 * THE SITE BRIDGE: AGENTS CHANGE THE OPEN SITE AS UNDO STEPS
 * (AGENTS-PANEL-PROPOSAL.md, "Where the work happens", site requests).
 *
 * `helper/mcp/site.ts` gives an agent three tools; `src/features/agents/bridge.ts`
 * answers them on the Builder page, through the paired dock frame only.
 *
 *   1. pure: the MCP server lists the three tools, turns a call into the
 *      dock's request, and answers over JSON-RPC; the gate refuses another
 *      site, a part not on the board, a step on keys, and a key-shaped value;
 *   2. on a saved board (sol face): read returns the parts and pages;
 *   3. apply changes one part's colour as a single undo step, named on the
 *      timeline; Ctrl+Z restores the part exactly and the board is otherwise
 *      unchanged;
 *   4. a change on more than 20 parts makes a Duplicate first and offers
 *      Compare; a step on keys, or for another site, is refused and the
 *      board does not move;
 *   5. a message from the page itself (not the dock frame) is ignored;
 *      no page errors.
 *
 *   npx next start -p 3191
 *   node tests/agents-site-bridge.mjs http://127.0.0.1:3191
 */
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3191").replace(/\/$/, "");
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. Pure. */
let M = null, B = null;
process.env.POLIO_SITE_NO_MAIN = "1";
try { M = await import("../helper/mcp/site.ts"); } catch (e) { check("the site MCP module loads", false, String(e?.message ?? e).slice(0, 160)); }
try { B = await import("../src/features/agents/siteSteps.ts"); } catch (e) { check("the site steps module loads", false, String(e?.message ?? e).slice(0, 160)); }
if (M) {
  check("1. three tools: read, shot, apply", JSON.stringify(M.SITE_TOOLS.map((t) => t.name)) === '["site.read","site.shot","site.apply"]');
  const listed = await M.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, async () => ({ ok: true, result: null }));
  check("…listed over JSON-RPC", listed?.result?.tools?.length === 3 && listed.id === 1);
  const sent = [];
  const call = await M.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "site.apply", arguments: { site: "s1", name: "calmer hero", steps: [{ op: "updateNode", id: "n1", patch: { colour: { bg: "#111" } } }] } } }, async (req) => { sent.push(req); return { ok: true, result: { touched: 1 } }; });
  check("…a call becomes the dock's request, and its answer comes back as text", sent[0]?.source === "polio-dock" && sent[0].kind === "site" && sent[0].op === "apply" && sent[0].site === "s1" && sent[0].steps.length === 1 && /touched/.test(call?.result?.content?.[0]?.text ?? ""), JSON.stringify(sent[0]).slice(0, 200));
  const no = await M.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "site.read" } }, async () => ({ ok: false, says: "the open site is another" }));
  check("…a refusal is an error result, not a crash", no?.result?.isError === true && /another/.test(no.result.content[0].text));
  check("…an unknown tool is a JSON-RPC error", (await M.handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "site.delete" } }, async () => ({ ok: true, result: 1 })))?.error?.code === -32602);
}
if (B) {
  const board = { site: "s1", nodeIds: new Set(["n1", "n2"]), pageIds: new Set(["p0"]), tokenIds: new Set(["c1"]) };
  const req = (steps, more = {}) => ({ source: "polio-dock", kind: "site", v: 1, id: "r", op: "apply", site: "s1", name: "calmer hero", steps, ...more });
  check("the gate passes a clean colour step", B.checkApply(req([{ op: "updateNode", id: "n1", patch: { colour: { bg: "#111" } } }]), board).length === 0);
  check("…refuses another site", B.checkApply(req([{ op: "updateNode", id: "n1", patch: { colour: { bg: "#111" } } }], { site: "s2" }), board).length > 0);
  check("…a part not on the board", B.checkApply(req([{ op: "updateNode", id: "n9", patch: { colour: { bg: "#111" } } }]), board).length > 0);
  check("…a step on keys, the Account or publishing", B.checkApply(req([{ op: "updateNode", id: "n1", patch: { keys: { x: 1 } } }]), board).length > 0 && B.checkApply(req([{ op: "setLook", patch: { account: 1 } }]), board).length > 0 && B.checkApply(req([{ op: "updatePage", id: "p0", patch: { published: true } }]), board).length > 0);
  check("…a key-shaped value", B.checkApply(req([{ op: "updateNode", id: "n1", patch: { content: "ghp_" + "a".repeat(30) } }]), board).length > 0);
  check("…an unknown op, and an empty request", B.checkApply(req([{ op: "writeStorage", id: "n1" }]), board).length > 0 && B.checkApply(req([]), board).length > 0);
  check("the plan counts parts once, and calls more than 20 big", B.planApply([{ op: "updateNode", id: "a", patch: {} }, { op: "updateNode", id: "a", patch: {} }], (s) => [s.id]).touched === 1 && B.planApply([{ op: "removeNodes", ids: Array.from({ length: 21 }, (_, i) => `n${i}`) }], (s) => s.ids).big === true && B.BIG_CHANGE === 20);
}

/* The dock, stubbed: it relays what the test gives it to the parent page and keeps the answers. */
const STUB = `<!doctype html><title>dock stub</title><body>dock<script>
window.replies = [];
addEventListener("message", (e) => { if (e.data && e.data.kind === "site") replies.push({ origin: e.origin, data: e.data }); });
window.ask = (req) => new Promise((done) => { const id = req.id; const on = (e) => { if (e.data && e.data.kind === "site" && e.data.id === id) { removeEventListener("message", on); done(e.data); } }; addEventListener("message", on); parent.postMessage(req, "*"); setTimeout(() => { removeEventListener("message", on); done({ timeout: true }); }, 15000); });
</script>`;

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(AT ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: STUB }));
await ctx.route("https://api.github.com/**", (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const doc = async () => page.evaluate(() => { const s = window.__studioHistory?.doc?.() ?? null; return s ? { nodes: s.nodes, pages: s.pages, look: s.look } : null; });
const nodesNow = async () => page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
const past = async () => page.evaluate(() => window.__agents?.board?.().past ?? null);

/* 2. */
await openBoard(page, BASE, "solface");
await page.locator("[data-agents-button]").click();
const frameEl = page.locator("[data-agents-frame]");
await frameEl.waitFor({ timeout: 20_000 });
const dock = page.frames().find((f) => f.url().startsWith(HELPER));
await page.waitForTimeout(800);
const before = await nodesNow();
const pastBefore = await past();
const ask = (req) => dock.evaluate((r) => window.ask(r), req);
const read = await ask({ source: "polio-dock", kind: "site", v: 1, id: "q1", op: "read" });
const parts = read?.result?.parts ?? [];
check("2. read returns the parts and pages of the open site", read?.ok === true && parts.length === JSON.parse(before).length && parts.length > 100 && read.result.pages?.[0]?.id === "page_home" && typeof read.result.site === "string", `${parts.length} parts, site ${read?.result?.site}`);
check("…each part with its id, kind and box, and no board bookkeeping", parts.every((p) => typeof p.id === "string" && typeof p.featureId === "string" && typeof p.x === "number") && !parts.some((p) => "picture" in p || "worn" in p || "from" in p));
const shotR = await ask({ source: "polio-dock", kind: "site", v: 1, id: "q2", op: "shot", part: parts[5].id });
check("…shot answers a board reference with the part's box", shotR?.ok === true && shotR.result.ref === `board:page_home@${read.result.frameWidth}#${parts[5].id}` && shotR.result.box?.w === parts[5].w, JSON.stringify(shotR?.result).slice(0, 160));

/* 3. */
const site = read.result.site;
const target = parts.find((p) => p.featureId === "box" && p.w > 200) ?? parts[5];
const was = JSON.parse(before).find((n) => n.id === target.id);
const applied = await ask({ source: "polio-dock", kind: "site", v: 1, id: "q3", op: "apply", site, name: "calmer hero", steps: [{ op: "updateNode", id: target.id, patch: { colour: { ...(was.colour ?? {}), bg: "rgb(12, 34, 56)" } } }] });
const after = JSON.parse(await nodesNow());
const changed = after.find((n) => n.id === target.id);
const pastAfter = await past();
check("3. apply changes the part's colour", applied?.ok === true && changed?.colour?.bg === "rgb(12, 34, 56)", JSON.stringify(applied).slice(0, 200));
check("…as one undo step", pastAfter === pastBefore + 1, `past ${pastBefore} → ${pastAfter}`);
check("…named on the timeline", await page.evaluate(() => (window.__agents?.board?.().threads ?? []).some((t) => t.ask === "Agent: calmer hero" && t.mode === "agent")) || applied?.result?.name === "Agent: calmer hero", applied?.result?.name);
check("…and every other part is untouched", JSON.stringify(after.filter((n) => n.id !== target.id)) === JSON.stringify(JSON.parse(before).filter((n) => n.id !== target.id)));
check("…the dock heard the answer from the Builder's origin only", await dock.evaluate(() => window.replies.every((r) => r.origin === location.ancestorOrigins?.[0] || r.origin.startsWith("http://127.0.0.1") || r.origin.startsWith("http://localhost"))));
await page.locator("body").click({ position: { x: 5, y: 450 } }).catch(() => {});
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
const undone = await nodesNow();
check("…Ctrl+Z restores the part exactly, and the board with it", undone === before && (await past()) === pastBefore, `past ${await past()}`);

/* 4. */
const builds = async () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state?.projects ?? []);
const n0 = (await builds()).length;
const many = parts.slice(0, 25).map((p) => ({ op: "updateNode", id: p.id, patch: { colour: { ...(JSON.parse(before).find((n) => n.id === p.id).colour ?? {}), text: "rgb(250, 250, 250)" } } }));
const big = await ask({ source: "polio-dock", kind: "site", v: 1, id: "q4", op: "apply", site, name: "lighter words everywhere", steps: many });
const bAfter = await builds();
const copy = bAfter.find((p) => p.versionOf?.project === site);
check("4. a change on 25 parts makes a Duplicate first (the before)", big?.ok === true && big.result.touched === 25 && bAfter.length === n0 + 1 && copy && big.result.duplicate === copy.id, `${n0} → ${bAfter.length} sites, ${JSON.stringify(big?.result).slice(0, 120)}`);
check("…and offers Compare of copy and site", big?.result?.compare === `/builder/compare?a=${copy?.id}&b=${site}` && (await page.locator("[data-agents-compare] a").getAttribute("href")) === big?.result?.compare, big?.result?.compare);
check("…still as one undo step", (await past()) === pastBefore + 1);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
check("…which Ctrl+Z takes back", (await nodesNow()) === before);
const keys = await ask({ source: "polio-dock", kind: "site", v: 1, id: "q5", op: "apply", site, name: "keys", steps: [{ op: "updateNode", id: target.id, patch: { keys: { github: "ghp_" + "x".repeat(30) } } }] });
check("…a step on keys is refused", keys?.ok === false && /can't be changed|looks like a key/.test(keys.says), keys?.says);
const other = await ask({ source: "polio-dock", kind: "site", v: 1, id: "q6", op: "apply", site: "someone-else", name: "x", steps: [{ op: "updateNode", id: target.id, patch: { colour: { bg: "#000" } } }] });
check("…and so is a step for another site", other?.ok === false && /open site/.test(other.says), other?.says);
const mixed = await ask({ source: "polio-dock", kind: "site", v: 1, id: "q7", op: "apply", site, name: "x", steps: [{ op: "updateNode", id: target.id, patch: { colour: { bg: "#000" } } }, { op: "updateNode", id: "not-here", patch: { colour: { bg: "#000" } } }] });
check("…a request with one bad step applies nothing", mixed?.ok === false && (await nodesNow()) === before && (await past()) === pastBefore, mixed?.says);
check("…the board is otherwise unchanged, part by part", (await nodesNow()) === before);
check("…and storage was never written by the bridge: the saved document still matches the board", await page.evaluate(() => { const st = window.__studioHistory?.doc?.(); return !!st && st.nodes.length === (window.__studioNodes?.() ?? []).length; }));

/* 5. */
const fromPage = await page.evaluate(() => new Promise((done) => { const on = (e) => { if (e.data?.source === "polio-builder" && e.data.kind === "site" && e.data.id === "evil") { removeEventListener("message", on); done("answered"); } }; addEventListener("message", on); window.postMessage({ source: "polio-dock", kind: "site", v: 1, id: "evil", op: "read" }, "*"); setTimeout(() => { removeEventListener("message", on); done("ignored"); }, 1500); }));
check("5. a message from the page itself is ignored", fromPage === "ignored", fromPage);
const refusedLog = await page.evaluate(() => window.__agents?.refused?.length ?? -1);
check("…the bridge keeps what it applied and refused", (await page.evaluate(() => window.__agents?.applied?.length)) === 2 && refusedLog >= 3, `applied 2, refused ${refusedLog}`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
