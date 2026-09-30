#!/usr/bin/env node
/**
 * THE REPOSITORY MENU SAYS WHERE UPDATE LIVE SITE WRITES, IN ONE LINE, THE
 * SAME AS BUILDS, REPOS, AND A SERVER FAILURE IS NOT BLAMED ON GITHUB.
 *
 * From the owner's walk-through: the menu showed "EDITS ARE ON A BRANCH
 * edit/<site>-<date> … Merge into main" in a big red box while Update live
 * site wrote to main all along, and Builds, Repos said it another way. A
 * route that failed with a 5xx read "GitHub could not be reached from this
 * browser".
 *
 *   1. One line, "Update live site writes to <repo> on <branch>.", word for
 *      word the same on Builds, Repos; where it came from, the same too.
 *   2. No edit-branch box and no Merge button for a site that publishes to
 *      main, whatever edit branch the document remembers.
 *   3. A site that publishes to a branch gets a small Merge into main on
 *      that branch's row, not red.
 *   4. A 502 from the Builder's own route says the Builder's server failed,
 *      with the status code.
 *
 * Routes are answered in the browser; nothing reaches GitHub, no token.
 *
 *   node tests/repo-dialog-words.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const json = (r, body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };

async function open(project, { repoList = "ok", branches = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.route("**/api/studio/repo", (r) => (repoList === "502" ? r.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad gateway</html>" }) : json(r, { ok: true, repos: [{ name: "him/site", private: true, branch: "main" }] })));
  await page.route("**/api/studio/branches**", (r) => json(r, { ok: true, base: "main", branches, more: 0 }));
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ builds, doc }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
    builds: env({ projects: [project], activeId: project.id }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [], siteBranch: "edit/site-2026-09-20" }),
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(1200);
  return { ctx, page };
}

console.log("1–2. A site that publishes to main");
{
  const { ctx, page } = await open({ id: "s1", name: "Site", updatedAt: Date.now(), repo: { owner: "him", name: "site", branch: "main" }, bound: "made", source: { owner: "sparkygogo77-spec", name: "sink", branch: "main", dir: "sites/site" } });
  const menu = await page.evaluate(() => ({
    line: document.querySelector("[data-repo-line]")?.textContent?.trim() ?? null,
    source: document.querySelector("[data-repo-line-source]")?.textContent?.trim() ?? null,
    box: !!document.querySelector("[data-repo-branch]"),
    merge: !!document.querySelector("[data-repo-merge]"),
    text: document.querySelector("[data-repo-menu]")?.textContent ?? "",
  }));
  check("the menu says one line: Update live site writes to him/site on main.", menu.line === "Update live site writes to him/site on main.", J(menu.line));
  check("…and where it came from, and that it never writes there", menu.source === "Brought in from sparkygogo77-spec/sink/sites/site; Update live site never writes to it.", J(menu.source));
  check("no 'Edits are on a branch' box, though the document remembers an edit branch", !menu.box && !/Edits are on a branch/i.test(menu.text));
  check("no Merge into main for a site that publishes to main", !menu.merge);
  await page.screenshot({ path: ".screenshots/repo-dialog-1-main.png" });
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByText("Repos", { exact: true }).click();
  await page.waitForTimeout(500);
  const repos = await page.evaluate(() => ({ line: document.querySelector("[data-repo-line]")?.textContent?.trim() ?? null, source: document.querySelector("[data-repo-source]")?.textContent?.trim() ?? null }));
  check("Builds, Repos says it in the same words", repos.line === menu.line && repos.source === menu.source, J(repos));
  await page.screenshot({ path: ".screenshots/repo-dialog-2-builds-repos.png" });
  await ctx.close();
}

console.log("3. A site that publishes to a branch");
{
  const { ctx, page } = await open({ id: "s2", name: "Site", updatedAt: Date.now(), repo: { owner: "him", name: "site", branch: "preview" }, bound: "made" }, { branches: [{ name: "preview", updates: 2, added: 5, removed: 1 }, { name: "old", updates: 0, added: 0, removed: 0 }] });
  const got = await page.evaluate(() => {
    const m = document.querySelector("[data-repo-merge]");
    const d = document.querySelector("[data-repo-branch-delete='preview']");
    return { line: document.querySelector("[data-repo-line]")?.textContent?.trim() ?? null, merge: m?.textContent ?? null, row: m?.closest("[data-repo-branch-row]")?.getAttribute("data-repo-branch-row") ?? null, mergeRing: m ? getComputedStyle(m).borderColor : null, deleteRing: d ? getComputedStyle(d).borderColor : null };
  });
  check("the line names the branch", got.line === "Update live site writes to him/site on preview.", J(got.line));
  check("Merge into main sits on that branch's own row", got.merge === "Merge into main" && got.row === "preview", J(got));
  check("…and is not the red of a button that cannot be undone", !!got.mergeRing && got.mergeRing !== got.deleteRing, `${got.mergeRing} vs ${got.deleteRing}`);
  await page.screenshot({ path: ".screenshots/repo-dialog-3-branch.png" });
  await ctx.close();
}

console.log("4. The Builder's own route fails");
{
  const { ctx, page } = await open({ id: "s3", name: "Site", updatedAt: Date.now(), repo: { owner: "him", name: "site", branch: "main" }, bound: "made" }, { repoList: "502" });
  const said = await page.evaluate(() => document.querySelector("[data-repo-picker-said]")?.textContent ?? null);
  check("a 502 says the Builder's server failed, with the code", /The Builder's server failed \(status 502\)/.test(said ?? ""), J(said));
  check("…and does not blame GitHub or the browser", !/GitHub could not be reached/.test(said ?? ""));
  await page.screenshot({ path: ".screenshots/repo-dialog-4-server.png" });
  await ctx.close();
}

check("no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
