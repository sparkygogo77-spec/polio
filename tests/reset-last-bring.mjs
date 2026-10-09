#!/usr/bin/env node
/**
 * REFRESH CAN PUT THE BOARD BACK AS IT LAST CAME IN, WITHOUT BRINGING IT IN.
 *
 * J (2026-10-09): "i use the refresh button and clear and bring in too often
 * which does the whole process again ... within this refresh button should
 * be another option to properly reset back to the most recent bring in which
 * clears but doesnt necessarily bring anything NEW in".
 *
 *   1. a real bring-in (a one-page repository, GitHub stood in) keeps a copy
 *      of the board as it landed;
 *   2. a part deleted, then Refresh > Reset to last bring-in: the board is
 *      back as it landed, nothing read from GitHub, and one undo brings the
 *      edit back;
 *   3. PonsStars' saved board (no copy kept, it came in before this): the
 *      option is there but off; kept, edited and reset, every part is back,
 *      and the copy is still there after a reload.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/reset-last-bring.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/lastBring.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/bring-in/fromasite/FromASite.tsx, src/features/studio/board/store/create.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const env = (s) => JSON.stringify({ state: s, version: 0 });
const PAGE = `<!doctype html><html><head><title>A page</title></head><body><header><h1>Blackorb</h1><p>A small studio. <a href="/about">About</a></p><button>Start</button></header><main><h2>What we make</h2><p>Sites, mostly.</p><a href="/work">Work</a></main></body></html>`;
const SHA = "abc1234def5678abc1234def5678abc1234def56";

const nodes = (page) => page.evaluate(() => (window.__studioNodes?.() ?? []).map((n) => n.id));
const kept = (page) => page.evaluate(async () => {
  const ask = (req) => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); });
  const db = await ask(indexedDB.open("builder.docs", 1));
  const keys = await ask(db.transaction("docs", "readonly").objectStore("docs").getAllKeys());
  db.close();
  return keys.filter((k) => String(k).startsWith("builder.lastBring"));
});
/** Delete a part, as the board's Delete does (an undo step of its own). */
async function deleteOne(page) {
  const before = await nodes(page);
  await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
  await page.evaluate((id) => window.__studioHistory.act("removeNodes", [id]), before[before.length - 1]);
  await page.waitForTimeout(300);
  return (await nodes(page)).length === before.length - 1;
}
async function resetFromRefresh(page) {
  await page.locator("header [data-code-refresh]").first().click();
  await page.waitForTimeout(500);
  const btn = page.locator("[data-code-refresh-reset]");
  await btn.click();
  await page.waitForTimeout(600);
}

{
  /* 1 and 2. */
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  let read = 0;
  await page.route("https://api.github.com/**", (r) => {
    const u = new URL(r.request().url());
    const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
    if (/\/git\/(trees|blobs)\/|\/contents\//.test(u.pathname)) read++;
    if (u.pathname.startsWith("/repos/him/page/commits/")) return j({ sha: SHA });
    if (u.pathname === "/repos/him/page") return j({ default_branch: "main", homepage: "" });
    if (u.pathname.startsWith("/repos/him/page/git/trees/")) return j({ tree: [{ path: "index.html", type: "blob", sha: "p1", size: PAGE.length }] });
    if (u.pathname === "/repos/him/page/git/blobs/p1") return j({ encoding: "base64", content: Buffer.from(PAGE).toString("base64") });
    return j({ message: "no" }, 404);
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, { doc: env({ nodes: [] }), builds: env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }) });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(1500);
  await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(600);
  await page.locator("[data-repo-bring]").fill("him/page");
  await page.locator("[data-repo-pull]").click();
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); if (await page.locator("[data-import-chips]").count()) break; }
  await page.waitForTimeout(800);
  const landed = await nodes(page);
  const copies = await kept(page);
  check("1. a bring-in keeps a copy of the board as it landed", landed.length > 0 && copies.length === 1, J({ parts: landed.length, copies }));

  const gone = await deleteOne(page);
  const edited = await nodes(page);
  check("2. a part deleted", gone && edited.length === landed.length - 1, `${landed.length} → ${edited.length}`);
  const readBefore = read;
  await resetFromRefresh(page);
  const back = await nodes(page);
  check("…Reset to last bring-in puts the board back as it landed", J(back) === J(landed), `${back.length} of ${landed.length}`);
  check("…without reading the repository again", read === readBefore, `${read - readBefore} files read`);
  await page.keyboard.press("Escape");
  await page.locator("[data-studio-pane]").click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  check("…and one undo brings the edit back", (await nodes(page)).length === edited.length, `${(await nodes(page)).length}`);
  await page.close();
}

{
  /* 3. */
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(page, BASE, "pst");
  const saved = await nodes(page);
  await page.locator("header [data-code-refresh]").first().click();
  await page.waitForTimeout(500);
  const off = await page.locator("[data-code-refresh-reset]").isDisabled();
  check("3. PST's saved board: the option is in Refresh, off while nothing is kept", (await page.locator("[data-code-refresh-reset]").count()) === 1 && off);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__studioKeepLastBring?.());
  await page.waitForTimeout(500);
  const gone = await deleteOne(page);
  await resetFromRefresh(page);
  const back = await nodes(page);
  check("…kept, edited and reset: every part is back", gone && J(back) === J(saved), `${back.length} of ${saved.length}`);
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.locator("header [data-code-refresh]").first().click();
  await page.waitForTimeout(800);
  check("…and the copy is still there after a reload", (await page.locator("[data-code-refresh-reset]").isEnabled()));
  await page.close();
}

check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
