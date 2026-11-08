#!/usr/bin/env node
/**
 * THE SITE BRIDGE REFUSES BAD STEPS, AND EVERY CALL IS KEPT
 * (handovers/INTERFACE-OPTIONS.md, section 3, Hardening).
 *
 *   1. pure: a request carrying `base` must match the board's version; an
 *      empty patch, a value a token can't hold and a request that changes
 *      nothing are refused; the tool passes `base` on, and a call without one
 *      still goes;
 *   2. the log: each call on the helper's relay is a line in its state dir,
 *      with who asked, the step and why it was refused, and never a value;
 *   3. the dock: a refusal shows on "Everything Claude is doing";
 *   4. on a saved board (with a Builder address): a step for a part not on
 *      the board, a step written against an older copy, and a step that
 *      changes nothing are refused with no undo step; a good `base` goes, and
 *      the answer's version is good for the next call; the store's own
 *      updateNode leaves no undo step for a part that isn't there;
 *   5. with a fixtures folder: the same refusals on every repo fixture.
 *
 *   node tests/agents-bridge-hardening.mjs                                   (parts 1 to 3)
 *   npx next start -p 3191
 *   node tests/agents-bridge-hardening.mjs http://127.0.0.1:3191             (parts 1 to 4)
 *   node tests/agents-bridge-hardening.mjs http://127.0.0.1:3191 <sink>      (all five)
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = process.argv[2]?.replace(/\/$/, "") ?? null;
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

process.env.POLIO_SITE_NO_MAIN = "1";
const M = await import("../helper/mcp/site.ts");
const B = await import("../src/features/agents/siteSteps.ts");
const Sv = await import("../helper/server/server.ts");
const Pa = await import("../helper/server/pairing.ts");
const T = await import("../helper/server/tickets.ts");
const L = await import("../helper/server/bridgeLog.ts").catch((e) => { check("the bridge log module loads", false, String(e?.message ?? e).slice(0, 160)); return null; });

/* 1. Pure. */
const board = { site: "s1", nodeIds: new Set(["n1"]), pageIds: new Set(["p0"]), tokenIds: new Set(["c1"]), version: "v2", tokenTakes: (_, value) => value !== "not a colour", unchanged: (s) => s.op === "updateNode" && s.patch?.same === true };
const req = (steps, more = {}) => ({ source: "polio-dock", kind: "site", v: 1, id: "r", op: "apply", site: "s1", name: "calmer hero", steps, ...more });
const good = [{ op: "updateNode", id: "n1", patch: { x: 1 } }];
check("1. a request with no base still goes (old callers)", B.checkApply(req(good), board).length === 0);
check("…with the board's own version it goes", B.checkApply(req(good, { base: "v2" }), board).length === 0);
check("…with an older one it is refused, and says to read again", /older copy/.test(B.checkApply(req(good, { base: "v1" }), board).join()) && /read the site again/.test(B.checkApply(req(good, { base: "v1" }), board).join()));
check("…a base that is not a version is refused too", B.checkApply(req(good, { base: 7 }), board).length > 0 && B.checkApply(req(good, { base: null }), board).length > 0);
check("…an empty patch is refused for a page and for the look", B.checkApply(req([{ op: "updatePage", id: "p0", patch: {} }]), board).length > 0 && B.checkApply(req([{ op: "setLook", patch: {} }]), board).length > 0);
check("…a value the token can't hold is refused before anything runs", /can't hold/.test(B.checkApply(req([{ op: "setToken", id: "c1", value: "not a colour" }]), board).join()));
check("…a request that changes nothing is refused", /nothing would change/.test(B.checkApply(req([{ op: "updateNode", id: "n1", patch: { same: true } }]), board).join()));
check("…but one real step among them goes", B.checkApply(req([{ op: "updateNode", id: "n1", patch: { same: true } }, ...good]), board).length === 0);
check("the version moves with what the board holds, and comes back with it", B.versionOf({ a: 1 }) === B.versionOf({ a: 1 }) && B.versionOf({ a: 1 }) !== B.versionOf({ a: 2 }));
const withBase = M.toRequest("site.apply", { site: "s1", name: "x", steps: good, base: "v2" }, "i");
const noBase = M.toRequest("site.apply", { site: "s1", name: "x", steps: good }, "i");
check("the tool lists base, and passes it on only when sent", withBase.base === "v2" && !("base" in noBase) && "base" in M.SITE_TOOLS.find((t) => t.name === "site.apply").inputSchema.properties);

/* 2. The log, on the real relay with a dock's stream. */
const raw = (port, method, path, { origin, token, ticket, body } = {}) => new Promise((done, no) => {
  const text = body === undefined ? "" : JSON.stringify(body);
  const r = httpRequest({ host: "127.0.0.1", port, path, method, headers: { host: `127.0.0.1:${port}`, ...(origin ? { origin } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(ticket ? { "x-polio-lane": ticket } : {}), ...(text ? { "content-type": "application/json", "content-length": Buffer.byteLength(text) } : {}) } }, (res) => {
    let got = ""; res.on("data", (c) => { got += c; }); res.on("end", () => { let json = null; try { json = JSON.parse(got); } catch { /* not JSON */ } done({ status: res.statusCode, json, text: got }); });
  });
  r.on("error", no); r.end(text);
});
const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 25)); } return null; };
const standIn = () => ({ subscribe: () => () => {}, snapshot: () => [], submit: () => ({}), control: async () => ({ ok: true }) });
const SECRET = "ghp_" + "s".repeat(30);
const siteCall = (more = {}) => ({ source: "polio-dock", kind: "site", v: 1, id: "agent-1", op: "apply", site: "s1", name: "calmer hero", steps: [{ op: "updateNode", id: "n9", patch: { colour: { bg: "rgb(1, 2, 3)" } } }], ...more });

const state = mkdtempSync(join(tmpdir(), "bridge-log-"));
const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(AT ? { executablePath: AT } : {}) });
const errors = [];

if (L) {
  const shown = [];
  const pairing = new Pa.Pairing({ show: (c) => shown.push(c) });
  const tickets = new T.SiteTickets();
  const siteLog = new L.BridgeLog(state);
  const helper = await Sv.startHelperServer({ runner: standIn(), pairing, tickets, siteLog, port: 0, siteWaitMs: 400 });
  const port = helper.port, DOCK = `http://127.0.0.1:${port}`;
  const lines = () => (existsSync(siteLog.file) ? readFileSync(siteLog.file, "utf8") : "").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  try {
    await raw(port, "POST", "/pair/start", { origin: DOCK });
    const token = (await raw(port, "POST", "/pair", { origin: DOCK, body: { code: shown.at(-1) } })).json?.token;
    const ticket = tickets.issue("calm-hero");

    await raw(port, "POST", "/site", { body: siteCall() });
    check("2. a call with no ticket is logged as refused, with no lane", lines().at(-1)?.ok === false && lines().at(-1)?.lane === null && /ticket/.test(lines().at(-1)?.why ?? ""), JSON.stringify(lines().at(-1)));
    await raw(port, "POST", "/site", { ticket, body: siteCall() });
    check("…so is a call with no dock open, under its lane, with its step", lines().at(-1)?.lane === "calm-hero" && lines().at(-1)?.ok === false && /dock isn't open/.test(lines().at(-1)?.why ?? "") && lines().at(-1)?.steps?.[0] === "updateNode n9: colour", JSON.stringify(lines().at(-1)));
    const stream = [];
    let res = null;
    await new Promise((ok) => {
      httpRequest({ host: "127.0.0.1", port, path: "/stream", headers: { host: `127.0.0.1:${port}`, origin: DOCK, authorization: `Bearer ${token}` } }, (r) => {
        res = r; let buf = "";
        r.on("data", (c) => { buf += c; let at; while ((at = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, at); buf = buf.slice(at + 1); if (l.trim()) stream.push(JSON.parse(l)); } });
        ok();
      }).end();
    });
    check("…a dock that opens later is told the refusals so far", !!(await until(() => stream.filter((l) => l.kind === "site-log").length === 2)));
    const answer = async (reply) => {
      const seen = stream.filter((l) => l.kind === "site").length;
      const call = raw(port, "POST", "/site", { ticket, body: reply.call });
      const got = await until(() => stream.filter((l) => l.kind === "site")[seen]);
      await raw(port, "POST", "/site/reply", { origin: DOCK, token, body: { source: "polio-builder", kind: "site", v: 1, id: got.request.id, ...reply.answer } });
      return call;
    };
    const no = await answer({ call: siteCall({ base: "v1" }), answer: { ok: false, says: `written against an older copy; ${SECRET}` } });
    check("…the Builder's refusal reaches the agent", no.json?.ok === false && /older copy/.test(no.json?.says ?? ""), no.text.slice(0, 120));
    check("…and the log, with its reason, the key masked", lines().at(-1)?.ok === false && /older copy/.test(lines().at(-1)?.why ?? "") && !readFileSync(siteLog.file, "utf8").includes(SECRET), lines().at(-1)?.why);
    check("…and the dock's stream at once", !!(await until(() => stream.filter((l) => l.kind === "site-log").at(-1)?.entry?.why === lines().at(-1)?.why)));
    const yes = await answer({ call: siteCall({ steps: [{ op: "updateNode", id: "n1", patch: { content: SECRET, colour: { bg: "rgb(1, 2, 3)" } } }] }), answer: { ok: true, result: { touched: 1 } } });
    check("an accepted call is logged too, and not sent to the dock as a refusal", yes.json?.ok === true && lines().at(-1)?.ok === true && !lines().at(-1)?.why && stream.filter((l) => l.kind === "site-log").every((l) => l.entry.ok === false));
    check("…as its op and field names, never the values it carried", lines().at(-1)?.steps?.[0] === "updateNode n1: content, colour" && !/rgb|ghp_/.test(readFileSync(siteLog.file, "utf8")), lines().at(-1)?.steps?.[0]);
    const read = await answer({ call: { source: "polio-dock", kind: "site", v: 1, id: "agent-2", op: "read" }, answer: { ok: true, result: { parts: [] } } });
    check("a read is logged as well", read.json?.ok === true && lines().at(-1)?.op === "read" && lines().at(-1)?.ok === true);
    const late = await raw(port, "POST", "/site", { ticket, body: { source: "polio-dock", kind: "site", v: 1, id: "agent-3", op: "read" } });
    check("a call the Builder never answers is logged as refused", late.json?.ok === false && /didn't answer/.test(lines().at(-1)?.why ?? ""));
    const again = new L.BridgeLog(state);
    check("after a restart the log still has its refusals", again.refusals().length === siteLog.refusals().length && again.refusals().length >= 4, `${again.refusals().length}`);
    const small = new L.BridgeLog(mkdtempSync(join(tmpdir(), "bridge-log-small-")), 200);
    for (let i = 0; i < 12; i++) small.record(L.describeCall("x", siteCall(), true));
    check("the log never grows past its limit: it starts over, keeping one old file", readFileSync(small.file, "utf8").length <= 200 && existsSync(`${small.file}.1`));
    res?.destroy();

    /* 3. The dock itself, on the helper that serves it, not inside a Builder: so it answers every site call "the dock isn't inside the Builder", which is a refusal like any other. */
    const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${DOCK}/dock/?tab=pc`, { waitUntil: "load" });
    await page.waitForFunction(() => document.body.dataset.helperState === "pair");
    await page.locator("[data-pair-start]").click();
    await until(() => shown.length >= 2);
    await page.locator("[data-pair-code]").fill(shown.at(-1));
    await page.locator("[data-pair-send]").click();
    await page.waitForFunction(() => document.body.dataset.helperState === "live", null, { timeout: 10_000 });
    const old = await page.locator("[data-site-refusal]").count();
    check("3. the dock shows the refusals from before it opened", old >= 4 && await page.locator("[data-site-refused-box]").isVisible(), `${old} rows`);
    const fresh = await raw(port, "POST", "/site", { ticket, body: siteCall({ name: "made-up hero" }) });
    check("…the refused call is answered as refused", fresh.json?.ok === false && /isn't inside the Builder/.test(fresh.json?.says ?? ""), fresh.text.slice(0, 120));
    await page.waitForFunction(() => [...document.querySelectorAll("[data-site-refusal]")].some((r) => r.textContent.includes("made-up hero")), null, { timeout: 5000 }).catch(() => {});
    const top = await page.locator("[data-site-refusal]").first().innerText().catch(() => "");
    check("…and a new one lands on top, with the lane, the change and the reason", /calm-hero/.test(top) && /made-up hero/.test(top) && /isn't inside the Builder/.test(top), top.replace(/\s+/g, " "));
    await ctx.close();
  } finally {
    await helper.close();
  }
}

/* 4. On a saved board, through a stub of the dock frame (tests/agents-site-bridge.mjs). */
if (BASE) {
  const STUB = `<!doctype html><title>dock stub</title><body>dock<script>
  window.ask = (req) => new Promise((done) => { const on = (e) => { if (e.data && e.data.kind === "site" && e.data.id === req.id) { removeEventListener("message", on); done(e.data); } }; addEventListener("message", on); parent.postMessage(req, "*"); setTimeout(() => { removeEventListener("message", on); done({ timeout: true }); }, 15000); });
  </script>`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: STUB }));
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await openBoard(page, BASE, "solface");
  await page.locator("[data-agents-button]").click();
  await page.locator("[data-agents-frame]").waitFor({ timeout: 20_000 });
  const dock = page.frames().find((f) => f.url().startsWith(HELPER));
  await page.waitForTimeout(800);
  let n = 0;
  const ask = (more) => dock.evaluate((r) => window.ask(r), { source: "polio-dock", kind: "site", v: 1, id: `h${++n}`, ...more });
  const past = () => page.evaluate(() => window.__agents.board().past);
  const nodes = () => page.evaluate(() => JSON.stringify(window.__studioNodes()));

  const read = await ask({ op: "read" });
  const site = read.result.site, v0 = read.result.version;
  const part = read.result.parts.find((p) => p.featureId === "box" && p.w > 200) ?? read.result.parts[5];
  const apply = (steps, more = {}) => ask({ op: "apply", site, name: "calmer hero", steps, ...more });
  const paint = (bg) => [{ op: "updateNode", id: part.id, patch: { colour: { ...(part.colour ?? {}), bg } } }];
  check("4. read answers the board's version", typeof v0 === "string" && v0.length > 3, v0);
  await page.waitForTimeout(1500);
  check("…and left alone the board keeps it", (await ask({ op: "read" })).result.version === v0);
  const p0 = await past(), n0 = await nodes();
  const steady = async () => (await past()) === p0 && (await nodes()) === n0;

  const unknown = await apply([{ op: "updateNode", id: "n_nope_1", patch: { x: 1 } }]);
  check("a part not on the board is refused, with no undo step", unknown.ok === false && /n_nope_1.*not on the open site/.test(unknown.says) && await steady(), unknown.says);
  const gone = await apply([{ op: "removeNodes", ids: ["n_nope_1"] }]);
  check("…for a removal too", gone.ok === false && await steady(), gone.says);
  const same = await apply([{ op: "updateNode", id: part.id, patch: { x: part.x } }]);
  check("a step that changes nothing is refused, with no undo step", same.ok === false && /nothing would change/.test(same.says) && await steady(), same.says);
  const empty = await apply([{ op: "setLook", patch: {} }]);
  check("…and an empty look", empty.ok === false && await steady(), empty.says);

  /* The store's own action, by name: the route the probe measured an empty undo step on. */
  await page.evaluate(() => window.__studioHistory.act("updateNode", "n_nope_1", { x: 1 }));
  check("the store's updateNode leaves no undo step for a part that isn't there", await steady(), `past ${p0} → ${await past()}`);

  /* J changes the board by hand while the agent is writing. */
  await page.evaluate((id) => window.__studioHistory.act("updateNode", id, { x: 7 }), part.id);
  const p1 = await past(), n1 = await nodes();
  const v1 = (await ask({ op: "read" })).result.version;
  check("a change on the board moves the version", v1 !== v0 && p1 === p0 + 1);
  const stale = await apply(paint("rgb(9, 9, 9)"), { base: v0 });
  check("a step written against the older copy is refused, with no undo step", stale.ok === false && /older copy/.test(stale.says) && (await past()) === p1 && (await nodes()) === n1, stale.says);
  const fine = await apply(paint("rgb(12, 34, 56)"), { base: v1 });
  check("the same step against the board as it is goes, as one undo step", fine.ok === true && (await past()) === p1 + 1 && JSON.parse(await nodes()).find((x) => x.id === part.id).colour.bg === "rgb(12, 34, 56)", JSON.stringify(fine).slice(0, 160));
  const next = await apply(paint("rgb(56, 34, 12)"), { base: fine.result?.version });
  check("…and its answer's version is good for the next call", next.ok === true && (await past()) === p1 + 2);
  const old = await apply(paint("rgb(1, 1, 1)"));
  check("a call with no base still goes", old.ok === true && (await past()) === p1 + 3);
  for (let i = 0; i < 4; i++) { await page.locator("body").click({ position: { x: 5, y: 450 } }).catch(() => {}); await page.keyboard.press("Control+z"); await page.waitForTimeout(250); }
  check("undone back, the board and its version are what they were", (await nodes()) === n0 && (await ask({ op: "read" })).result.version === v0);
  await ctx.close();
} else {
  console.log("  --   part 4 skipped: no Builder address given");
}

/* 5. The same refusals on every repo fixture (lane-rules.md), one at a time. */
const SINK = process.argv[3] ?? process.env.SINK ?? null;
if (BASE && SINK) {
  const STUB = `<!doctype html><body>dock<script>window.ask = (req) => new Promise((done) => { const on = (e) => { if (e.data && e.data.kind === "site" && e.data.id === req.id) { removeEventListener("message", on); done(e.data); } }; addEventListener("message", on); parent.postMessage(req, "*"); setTimeout(() => { removeEventListener("message", on); done({ timeout: true }); }, 30000); });</script>`;
  for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
    const file = join(SINK, "sites", site, "site", "document.json");
    if (!existsSync(file)) { check(`5. ${site}: its capture is here`, false, file); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: STUB }));
    await ctx.route("https://api.github.com/**", (r) => r.abort());
    const page = await ctx.newPage();
    page.setDefaultTimeout(120_000);
    page.on("pageerror", (e) => errors.push(`${site}: ${e.message}`));
    await openBoard(page, BASE, "solface");
    const doc = JSON.parse(readFileSync(file, "utf8"));
    await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id });
    await page.waitForTimeout(1500);
    await page.locator("[data-agents-button]").click();
    await page.locator("[data-agents-frame]").waitFor({ timeout: 20_000 });
    const dock = page.frames().find((f) => f.url().startsWith(HELPER));
    await page.waitForTimeout(800);
    let n = 0;
    const ask = (more) => dock.evaluate((r) => window.ask(r), { source: "polio-dock", kind: "site", v: 1, id: `${site}-${++n}`, ...more });
    const past = () => page.evaluate(() => window.__agents.board().past);
    const read = await ask({ op: "read" });
    const part = read.result?.parts?.find((p) => typeof p.x === "number");
    const apply = (steps, more = {}) => ask({ op: "apply", site: read.result.site, name: "calmer hero", steps, ...more });
    const p0 = await past();
    const unknown = await apply([{ op: "updateNode", id: "n_nope_1", patch: { x: 1 } }]);
    const same = await apply([{ op: "updateNode", id: part.id, patch: { x: part.x } }]);
    const stale = await apply([{ op: "updateNode", id: part.id, patch: { x: part.x + 5 } }], { base: "0-old" });
    const quiet = (await past()) === p0;
    const v0 = (await ask({ op: "read" })).result.version;
    const fine = await apply([{ op: "updateNode", id: part.id, patch: { x: part.x + 5 } }], { base: v0 });
    const one = (await past()) === p0 + 1;
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.evaluate(() => window.__studioHistory.act("undo"));
    await page.waitForTimeout(400);
    const back = (await ask({ op: "read" })).result.version === v0;
    check(`5. ${site}: bad, empty and stale steps refused with no undo step; a good one is one step, undone exactly`, unknown.ok === false && same.ok === false && stale.ok === false && quiet && fine.ok === true && one && back, `${read.result?.parts?.length} parts, ${JSON.stringify({ unknown: unknown.ok, same: same.ok, stale: stale.ok, quiet, fine: fine.ok, one, back })}`);
    await ctx.close();
  }
} else if (BASE) {
  console.log("  --   part 5 skipped: no fixtures folder given (argv 3 or SINK)");
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
rmSync(state, { recursive: true, force: true });
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
