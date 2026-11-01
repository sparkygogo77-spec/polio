#!/usr/bin/env node
/**
 * THE TEST HOOKS THAT WRITE ARE NOT ON THE LIVE PAGE (src/features/studio/testHooks.ts).
 *
 * The same built Builder is opened twice, on 127.0.0.1 and on a name that
 * isn't this PC's own (mapped to the same server by the browser, so what runs
 * is what Vercel serves):
 *
 *   1. pure: only this PC's own addresses count;
 *   2. on 127.0.0.1 the hooks are there, and work: the checks keep them;
 *   3. on the other name none of them is, for any script on the page, and a
 *      flag set before the page loads does not bring them back;
 *   4. what is left there is on a known list, so a new hook has to be looked at;
 *   5. what reads is still there for a live check, and the Builder's own
 *      Publish does not need a hook: nothing in src calls one;
 *   6. the bridge still changes the board there, as one undo step, through
 *      the paired dock's frame.
 *
 *   npx next start -p 3191
 *   node tests/test-hooks-locked.mjs http://127.0.0.1:3191
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3191").replace(/\/$/, "");
const FAR = "polio-live.test";
const FAR_BASE = BASE.replace("127.0.0.1", FAR);
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* What may stay on a page that isn't this PC's: reads and the Builder's own doors. */
const LEFT = new Set([
  "__studioOpenBrief", "__studioToggleLibrary", "__studioSetBrief", "__studioSetLibrary", "__studioSetLeftPanel", // the Builder's own commands open these
  "__studioHistory", "__studioNodes", "__studioSelection", "__studioUndoDepth", "__studioPublishDoc", "__studioQueue", "__studioLearned", "__studioRecord", "__studioExport", "__studioKitExport", "__studioKitSteps", "__studioLightPasses", "__studioCompiled", // read
  "__studioSelect", "__studioZoom", // where J is looking: nothing saved changes
  "__studioFacePair", // J's own switch between two cuts of the face
]);
const CLOSED = ["__studioPublish", "__studioLoadDoc", "__studioKitBranch", "__studioGiveWork", "__studioPutComponent", "__studioPutLearned", "__studioRollTheme", "__studioStartNewSite", "__studioNotePass", "__studioSetFormat", "__studioDraw", "__studioLightStart", "__studioLightTo", "__studioLightEnd", "__polioSystem", "__studioKeepLastBring", "__studioAgeLastBring"];

/* 1. */
const G = await import("../src/features/studio/testHooks.ts").catch((e) => { check("the gate's module loads", false, String(e?.message ?? e).slice(0, 160)); return null; });
if (G) {
  check("1. this PC's own addresses count", ["localhost", "127.0.0.1", "[::1]", "polio.localhost"].every((h) => G.testHooksOpen(h)));
  check("…and nothing else does", ["polio-two.vercel.app", "polio-git-x.vercel.app", "localhost.evil.com", "127.0.0.1.nip.io", "notlocalhost", ""].every((h) => !G.testHooksOpen(h)));
}

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--no-sandbox", `--host-resolver-rules=MAP ${FAR} 127.0.0.1`], ...(AT ? { executablePath: AT } : {}) });
const errors = [];
const STUB = `<!doctype html><title>dock stub</title><body>dock<script>
window.ask = (req) => new Promise((done) => { const on = (e) => { if (e.data && e.data.kind === "site" && e.data.id === req.id) { removeEventListener("message", on); done(e.data); } }; addEventListener("message", on); parent.postMessage(req, "*"); setTimeout(() => { removeEventListener("message", on); done({ timeout: true }); }, 15000); });
</script>`;
const open = async (base, init) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: STUB }));
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await openBoard(page, base, "solface");
  return { ctx, page };
};
const has = (page, names) => page.evaluate((list) => list.filter((n) => typeof window[n] !== "undefined"), names);

/* 2. */
{
  const { ctx, page } = await open(BASE);
  const there = await has(page, CLOSED);
  check("2. on 127.0.0.1 every hook is there", there.length === CLOSED.length, CLOSED.filter((n) => !there.includes(n)).join(", "));
  const nodes = await page.evaluate(() => { const before = window.__studioHistory.doc(); window.__studioLoadDoc({ ...before, nodes: before.nodes.slice(0, 3) }); return window.__studioNodes().length; });
  check("…and they work: a whole document goes on the board", nodes === 3, `${nodes} parts`);
  check("…and a store action by name", await page.evaluate(() => { window.__studioHistory.act("resetAll"); return window.__studioNodes().length === 0; }));
  await ctx.close();
}

/* 3, 4, 5. */
{
  const { ctx, page } = await open(FAR_BASE);
  check("3. on another name the page is a Builder with the board on it", (await page.evaluate(() => location.hostname)) === FAR && (await page.evaluate(() => window.__studioNodes().length)) > 100);
  const open3 = await has(page, CLOSED);
  check("…and none of the hooks that write is there", open3.length === 0, open3.join(", "));
  const act = await page.evaluate(() => typeof window.__studioHistory?.act);
  check("…nor a store action by name, which is the way to clear everything", act === "undefined", act);
  const tried = await page.evaluate(() => {
    const out = [];
    /* Not publish: on a build where the gate failed, this check must not send anything out. */
    for (const [name, call] of [["load", () => window.__studioLoadDoc({ nodes: [] })], ["clear", () => window.__studioHistory.act("resetAll")]]) { try { call(); out.push(`${name} ran`); } catch { /* it isn't there */ } }
    return { out, nodes: window.__studioNodes().length };
  });
  check("…so a script that calls them changes nothing", tried.out.length === 0 && tried.nodes > 100, JSON.stringify(tried));
  const left = await page.evaluate(() => Object.keys(window).filter((k) => /^__(studio|polio)/.test(k)));
  const unknown = left.filter((k) => !LEFT.has(k));
  check("4. what is left is on the known list", unknown.length === 0, unknown.join(", "));
  check("5. a live check can still read", await page.evaluate(() => Array.isArray(window.__studioHistory.doc().nodes) && Array.isArray(window.__studioNodes()) && typeof window.__studioPublishDoc() === "object"));
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
  const src = fileURLToPath(new URL("../src", import.meta.url));
  const callers = walk(src).filter((f) => !/StudioPage\.tsx$|HistoryControls\.tsx$|testHooks\.ts$/.test(f) && /__studioPublish\b|__studioLoadDoc\b|__studioKitBranch\b|__studioHistory\b/.test(readFileSync(f, "utf8")));
  check("…and nothing in the Builder calls a locked hook, so Publish doesn't need one", callers.length === 0, callers.join(", "));

  /* 6. */
  await page.locator("[data-agents-button]").click();
  await page.locator("[data-agents-frame]").waitFor({ timeout: 20_000 });
  const dock = page.frames().find((f) => f.url().startsWith(HELPER));
  await page.waitForTimeout(800);
  const ask = (r) => dock.evaluate((x) => window.ask(x), { source: "polio-dock", kind: "site", v: 1, ...r });
  const read = await ask({ id: "h1", op: "read" });
  const part = read.result.parts.find((p) => p.featureId === "box" && p.w > 200) ?? read.result.parts[5];
  const past = () => page.evaluate(() => window.__agents.board().past);
  const p0 = await past();
  const did = await ask({ id: "h2", op: "apply", site: read.result.site, base: read.result.version, name: "calmer hero", steps: [{ op: "updateNode", id: part.id, patch: { colour: { ...(part.colour ?? {}), bg: "rgb(12, 34, 56)" } } }] });
  check("6. the paired dock's bridge still changes the board there, as one undo step", did.ok === true && (await past()) === p0 + 1 && (await page.evaluate((id) => window.__studioNodes().find((n) => n.id === id).colour.bg, part.id)) === "rgb(12, 34, 56)", JSON.stringify(did).slice(0, 160));
  await ctx.close();
}

/* 3, again: a flag set before the page's own scripts changes nothing. */
{
  const { ctx, page } = await open(FAR_BASE, () => { window.__polioTestMode = true; window.__studioTest = true; try { localStorage.setItem("builder.testMode", "1"); } catch { /* */ } });
  const opened = await has(page, CLOSED);
  check("…and a flag set before the page loads doesn't bring them back", opened.length === 0, opened.join(", "));
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
