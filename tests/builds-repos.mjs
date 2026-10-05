#!/usr/bin/env node
/**
 * BUILDS SHOWS THE REPOS BESIDE THE SITES, AND LISTS HIS OWN.
 *
 * His words: "the repos page should also be available since there is much
 * space and the website doesnt utilize too much of it, i also shouldnt have
 * to type it in it should access my list since my token is in."
 *
 *   1. Sites and Repos are both on the page at once, side by side on a wide
 *      screen: no Sites / Repos switch to press.
 *   2. The site pictures are the biggest thing on it: each card's picture is
 *      wider than the repo column's rows are tall, and wider than before
 *      (the old cards were 352 wide).
 *   3. With a list from GitHub, pressing a site's field opens his repos; one
 *      press sets it, with that repo's own default branch, and nothing typed.
 *   4. A repo another site already publishes to is offered but cannot be
 *      pressed, and says which site holds it.
 *   5. His repos are listed under the sites' rows, each naming the site
 *      that publishes there.
 *   6. With no token, the column says so and offers Keys, and the field is
 *      still there to type owner/name into.
 *
 * The Builder's routes are answered in the browser: nothing reaches GitHub,
 * no token exists.
 *
 *   node tests/builds-repos.mjs http://127.0.0.1:3013
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
const now = Date.now();
const SITES = [
  { id: "a", name: "Alpha", updatedAt: now },
  { id: "b", name: "Bravo", updatedAt: now - 1000, repo: { owner: "him", name: "bravo-site", branch: "main" } },
];
const REPOS = [
  { name: "him/landing", private: true, pushed: new Date(now - 3600e3).toISOString(), branch: "trunk" },
  { name: "him/bravo-site", private: false, pushed: new Date(now - 86400e3).toISOString(), branch: "main" },
  { name: "him/notes", private: false, pushed: null, branch: "main" },
];

async function open(list) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.route("**/api/studio/repo", (r) => (r.request().method() === "GET" ? json(r, list) : json(r, { ok: false, message: "not in this test" })));
  await page.goto(`${BASE}/builds`, { waitUntil: "domcontentloaded" });
  await page.evaluate((b) => { localStorage.clear(); localStorage.setItem("builder.builds", b); }, env({ projects: SITES, activeId: "a" }));
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

console.log("With his list");
{
  const { ctx, page } = await open({ ok: true, owner: "him", repos: REPOS });
  const box = async (sel) => page.locator(sel).first().boundingBox();
  const list = await box("[data-builds-list]");
  const col = await box("[data-builds-repos]");
  check("Sites and Repos are both on the page, side by side", !!list && !!col && col.x >= list.x + list.width - 1 && Math.abs(col.y - list.y) < 60, J({ list, col }));
  check("…with no Sites / Repos switch to press", (await page.getByRole("radio", { name: /Repos|Sites/ }).count()) === 0);
  const pic = await box("[data-builds-list] li > button");
  check("each site's picture is the focal point: wider than the old 352 px card", !!pic && pic.width > 400, J(pic));

  await page.locator("input[aria-label='Publish Alpha to this repository']").click();
  await page.waitForTimeout(300);
  const offered = await page.evaluate(() => [...document.querySelectorAll("[data-repo-row-pick]")].map((b) => ({ name: b.getAttribute("data-repo-row-pick"), off: b.disabled, text: b.textContent })));
  check("pressing a site's field lists his repos, newest first", J(offered.map((o) => o.name)) === J(REPOS.map((r) => r.name)), J(offered));
  const held = offered.find((o) => o.name === "him/bravo-site");
  check("a repo another site publishes to cannot be pressed, and names that site", !!held && held.off && /Bravo/.test(held.text ?? ""), J(held));
  await page.screenshot({ path: ".screenshots/builds-repos-list.png" });
  await page.locator("[data-repo-row-pick='him/landing']").click();
  await page.waitForTimeout(500);
  const alpha = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.projects.find((p) => p.id === "a")?.repo ?? null);
  check("one press sets it, with that repo's own default branch", alpha?.owner === "him" && alpha?.name === "landing" && alpha?.branch === "trunk", J(alpha));
  const words = await page.locator("[data-repo-row='a'] [data-repo-line]").innerText().catch(() => "");
  check("…and the row says where Update live site now writes", /him\/landing/.test(words) && /trunk/.test(words), words);

  const mine = await page.evaluate(() => [...document.querySelectorAll("[data-my-repo]")].map((a) => ({ name: a.getAttribute("data-my-repo"), text: a.textContent, href: a.getAttribute("href") })));
  check("his repos are listed on the page, each a link to GitHub", mine.length === 3 && mine.every((m) => m.href === `https://github.com/${m.name}`), J(mine));
  check("…naming the site that publishes to each", /Alpha/.test(mine.find((m) => m.name === "him/landing")?.text ?? "") && /Bravo/.test(mine.find((m) => m.name === "him/bravo-site")?.text ?? ""), J(mine));
  await page.screenshot({ path: ".screenshots/builds-repos.png", fullPage: true });
  await ctx.close();
}

console.log("With no token");
{
  const { ctx, page } = await open({ ok: false, reason: "no-token", message: "No GitHub token yet. Put one in the Keys panel and this can list your repositories and make new ones." });
  const said = await page.locator("[data-my-repos-said]").innerText().catch(() => "");
  check("the column says there is no token, and offers Keys", /No GitHub token yet/.test(said) && /Keys/.test(said), said);
  const field = await page.locator("input[aria-label='Publish Alpha to this repository']").getAttribute("placeholder");
  check("…and the field is still there to type owner/name into", field === "owner/name", field ?? "");
  await ctx.close();
}

check("no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
