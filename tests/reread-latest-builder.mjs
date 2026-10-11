#!/usr/bin/env node
/**
 * REFRESH READS THE SAME CODE AGAIN WITH THE LATEST BUILDER.
 *
 * J (2026-10-11): "the refresh to last bring in ... decides to read the exact
 * same code that came in during the previous update instead of choosing to re
 * read the same code with the new update which is forcing me to choose clear
 * and bring in and do the whole process".
 *
 *   1. a bring-in (one page, GitHub stood in) keeps a copy that says which
 *      build of the Builder read it;
 *   2. a part deleted, then Refresh > "Read again with the latest builder":
 *      the files are read at the commit the board came in from (not the
 *      branch), none is fetched from GitHub again (kept by hash), the site
 *      stays on its branch, and the deleted part stays deleted;
 *   3. the kept copy marked as read by an older build: Reset no longer puts
 *      that old reading back, it reads the same code again on a clear board,
 *      and the deleted part is back.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/reread-latest-builder.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/lastBring.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/bringRepo.ts, src/features/studio/repoRun.ts, src/features/studio/bring-in/fromasite/FromASite.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

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
const BLOB = "0123456789abcdef0123456789abcdef01234567";

const nodes = (page) => page.evaluate(() => (window.__studioNodes?.() ?? []).map((n) => n.id));
const copy = (page) => page.evaluate(async () => {
  const ask = (req) => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); });
  const db = await ask(indexedDB.open("builder.docs", 1));
  const os = db.transaction("docs", "readonly").objectStore("docs");
  const keys = (await ask(os.getAllKeys())).filter((k) => String(k).startsWith("builder.lastBring"));
  const raw = keys.length ? await ask(os.get(keys[0])) : null;
  db.close();
  const c = raw ? JSON.parse(raw) : null;
  return c ? { at: c.at, builder: c.builder ?? null } : null;
});
const source = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("builder.studio")).state.look.styleSource ?? null; } catch { return null; } });
async function landedAfter(page, at) {
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(500); const c = await copy(page); if (c && c.at > at) break; }
  await page.waitForTimeout(1500);
}
async function deleteOne(page) {
  const before = await nodes(page);
  await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
  await page.evaluate((id) => window.__studioHistory.act("removeNodes", [id]), before[before.length - 1]);
  await page.waitForTimeout(300);
  return (await nodes(page)).length === before.length - 1;
}
async function choose(page, hook) {
  await page.locator("header [data-code-refresh]").first().click();
  await page.waitForTimeout(500);
  await page.locator(`[${hook}]`).click();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push(e.message));
const asked = { trees: [], blobs: 0 };
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
  if (u.pathname.startsWith("/repos/him/page/commits/")) return j({ sha: SHA });
  if (u.pathname === "/repos/him/page") return j({ default_branch: "main", homepage: "" });
  if (u.pathname.startsWith("/repos/him/page/git/trees/")) { asked.trees.push(decodeURIComponent(u.pathname.split("/trees/")[1])); return j({ tree: [{ path: "index.html", type: "blob", sha: BLOB, size: PAGE.length }] }); }
  if (u.pathname === `/repos/him/page/git/blobs/${BLOB}`) { asked.blobs++; return j({ encoding: "base64", content: Buffer.from(PAGE).toString("base64") }); }
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
await landedAfter(page, 0);
const landed = await nodes(page);
const first = await copy(page);
check("1. a bring-in keeps a copy that names the build that read it", landed.length > 0 && !!first?.builder, J(first));

/* 2. */
await deleteOne(page);
const edited = await nodes(page);
const blobsBefore = asked.blobs;
const treesBefore = asked.trees.length;
await choose(page, "data-code-refresh-reread");
await landedAfter(page, first.at);
const again = await nodes(page);
const src = await source(page);
check("2. Read again with the latest builder reads at the commit it came in from", asked.trees.slice(treesBefore).every((t) => t === SHA) && asked.trees.length > treesBefore, J(asked.trees.slice(treesBefore)));
check("…fetching no file from GitHub again", asked.blobs === blobsBefore, `${asked.blobs - blobsBefore} fetched`);
check("…the site stays on its branch, at that commit", src?.ref === "main" && src?.commit === SHA, J({ ref: src?.ref, commit: src?.commit }));
check("…and keeps the part he deleted deleted", again.length === edited.length, `${landed.length} landed, ${edited.length} after the edit, ${again.length} now`);

/* 3. */
const second = await copy(page);
const aged = await page.evaluate(() => window.__studioAgeLastBring?.());
await page.waitForTimeout(400);
await page.locator("header [data-code-refresh]").first().click();
await page.waitForTimeout(500);
const says = await page.locator("[data-code-refresh-reset]").innerText();
check("3. a copy an older build read: Reset says it reads the same code again", aged === true && /builder has changed/i.test(says), says.replace(/\s+/g, " "));
const treesBefore3 = asked.trees.length;
await page.locator("[data-code-refresh-reset]").click();
await landedAfter(page, second.at);
const reset = await nodes(page);
check("…and does, at the same commit, rather than putting the old reading back", asked.trees.length > treesBefore3 && asked.trees.slice(treesBefore3).every((t) => t === SHA), J(asked.trees.slice(treesBefore3)));
check("…on a clear board: the deleted part is back", reset.length === landed.length, `${reset.length} of ${landed.length}`);
const third = await copy(page);
check("…and the new copy is this build's", !!third && third.builder === first.builder, J(third));

check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
