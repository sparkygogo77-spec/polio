#!/usr/bin/env node
/**
 * THE TOP BAR FOLLOWS THE PAGE.
 *
 * From the owner: on Builds the bar "doesn't update and still includes the
 * previous site's buttons when off the page": Refresh, Publish, Update live
 * site, the live line and its Vercel and GitHub links, all for whichever
 * site was last open in the Builder. Those act on the open site, so they show
 * on the Builder's pages only (`routes` on a top bar item); the keys, the
 * theme and the settings show everywhere.
 *
 * Held here, with a site that is already live:
 *   · in the Builder the bar has Update live site, the live link and the save line;
 *   · moving to Builds without a reload, all of them leave the bar, and the
 *     keys and the settings stay;
 *   · loading Builds fresh, the same;
 *   · back in the Builder, they return.
 *
 * Nothing reaches GitHub or Vercel; no token exists.
 * Screenshots: .screenshots/bar-follows-page-*.png.
 *
 *   node tests/bar-follows-page.mjs http://127.0.0.1:3013
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const json = (r, body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
await page.route("**/api/studio/publish**", (r) => json(r, r.request().method() === "GET" ? { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } } : { ok: false, message: "nothing is pushed here" }));
await page.route("**/api/studio/deploy**", (r) => json(r, r.request().method() === "GET" ? { configured: true, source: "server", repo: null, hook: false } : { ok: false, message: "nothing is deployed here" }));
await page.route("**/api/studio/repo", (r) => json(r, { ok: true, repos: [] }));
await page.route("**/api/studio/branches**", (r) => json(r, { ok: true, base: "main", branches: [], more: 0 }));

const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const doc = env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [] });
const site = {
  id: "s6", name: "Site 6", updatedAt: Date.now(),
  repo: { owner: "someone", name: "site-6", branch: "main" }, bound: "made",
  live: { url: "https://site-6-stand-in.vercel.app", at: Date.now() - 60_000, inspectorUrl: "https://vercel.com/stand-in/site-6/abc" },
  published: { at: Date.now() - 60_000, commitUrl: "https://github.com/someone/site-6/commit/abc" },
};
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ builds, doc }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, { builds: env({ projects: [site], activeId: "s6" }), doc });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const bar = () => page.evaluate(() => {
  const h = document.querySelector("header[data-app-topbar]");
  const has = (s) => !!h?.querySelector(s);
  return {
    goLive: has("[data-go-live]"),
    address: has("[data-go-live-address]"),
    saved: has("[data-save-line]"),
    github: has("[data-github-button]"),
    keys: has('[aria-label="Keys"]'),
    settings: has('[aria-label="Settings"]'),
    words: (h?.textContent ?? "").replace(/\s+/g, " ").trim(),
  };
});
const shot = (n) => page.screenshot({ path: `.screenshots/bar-follows-page-${n}.png` });
const siteGone = (b) => !b.goLive && !b.address && !b.saved && !b.github && !/Update live site|Go live|Refresh|Publish|Vercel deployment|GitHub commit/.test(b.words);

let b = await bar();
check("in the Builder the bar has Update live site, the live link and the save line", b.goLive && b.address && b.saved, J(b));
await shot("1-builder");

/* Out to Builds without a reload: the bar has to change on its own. */
await page.evaluate(() => window.next?.router?.push("/builds"));
await page.waitForURL(/\/builds$/);
await page.waitForTimeout(800);
b = await bar();
check("moving to Builds, the open site's controls leave the bar", siteGone(b), J(b));
check("…and the keys and the settings stay", b.keys && b.settings, J(b));
await shot("2-builds");

await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
b = await bar();
check("loading Builds fresh, the same", siteGone(b) && b.keys && b.settings, J(b));
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
b = await bar();
check("and at /, which is Builds too", siteGone(b), J(b));

await page.evaluate(() => window.next?.router?.push("/builder"));
await page.waitForURL(/\/builder$/);
await page.waitForTimeout(1500);
b = await bar();
check("back in the Builder, they return", b.goLive && b.address && b.saved, J(b));
await shot("3-back");

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
