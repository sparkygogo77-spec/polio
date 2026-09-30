#!/usr/bin/env node
/**
 * A PUBLISH CARRIES EVERY FILE ITS PAGES POINT AT, AND SAYS WHICH IT COULD NOT.
 *
 * The live check of 30 September: TrendTrader's published page pointed at
 * /placeholder/scene.svg (the crop an empty picture part shows) and
 * BLACKORB's at nine /construct/*.png, files the Builder serves itself and
 * publish never carried. In the browser, pressing Update live site:
 *   1. a site with an empty picture part goes up with placeholder/scene.svg
 *      in the push, copied from the Builder, at the path the page names;
 *   2. a site whose page shows a picture this browser no longer has still
 *      publishes, as it always did (the owner is never kept from going live
 *      by it), and the publish status warns which file is missing, on which
 *      page, and what to do.
 *
 * The Builder's own routes are answered in the browser: nothing reaches
 * GitHub or Vercel and no token exists. Screenshot: .screenshots/publish-complete.png.
 *
 *   node tests/publish-complete.mjs http://127.0.0.1:3013
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
const part = (id, extra = {}) => ({ id, pageId: "page_home", featureId: "picture", label: "Picture", prompt: "", content: "", data: "", x: 40, y: 40, w: 400, h: 300, groupId: null, options: {}, priority: "must", custom: false, ...extra });

async function press(nodes) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const pushed = [];
  await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.route("**/api/studio/publish**", (r) => {
    const req = r.request();
    if (req.method() === "GET") return new URL(req.url()).searchParams.get("tree") ? json(r, { ok: false, tree: [] }) : json(r, { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } });
    const body = JSON.parse(req.postData() ?? "{}");
    pushed.push(...(body.files ?? []).map((f) => f.path));
    return json(r, { ok: true, sha: "abc1234", commitUrl: "https://github.com/him/site/commit/abc1234", branch: "main", repo: "him/site", files: pushed.length, deployed: false, hook: false });
  });
  await page.route("**/api/studio/deploy**", (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === "GET") return u.searchParams.get("id") ? json(r, { ok: true, state: "READY", done: true, url: "https://site.vercel.app", inspectorUrl: null }) : u.searchParams.get("address") ? json(r, { ok: false }) : json(r, { configured: true, source: "server", repo: null, hook: false });
    return json(r, { ok: true, id: "dpl_1", project: "site", repo: "him/site", branch: "main", team: null, state: "QUEUED", url: null, inspectorUrl: null });
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ builds, doc }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
    builds: env({ projects: [{ id: "s1", name: "Site One", updatedAt: Date.now(), repo: { owner: "him", name: "site", branch: "main" } }], activeId: "s1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes }),
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const bar = page.locator("header [data-go-live]").first();
  for (let i = 0; i < 40 && (await bar.getAttribute("data-go-live-state")) === "checking"; i++) await page.waitForTimeout(250);
  await bar.click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 120 && (await bar.getAttribute("data-go-live-state")) === "busy"; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(500);
  const said = await page.evaluate(() => document.querySelector("header [data-go-live-said]")?.textContent ?? null);
  const warned = await page.evaluate(() => document.querySelector("header [data-go-live-warned]")?.getAttribute("title") ?? null);
  const live = await page.evaluate(() => document.querySelector("header [data-go-live-step='live']")?.textContent ?? null);
  return { ctx, page, pushed, said, warned, live };
}

console.log("1. An empty picture part: the crop it shows goes up with it");
{
  const { ctx, pushed, said, warned } = await press([part("n1")]);
  check("the page goes up", pushed.includes("index.html"), J(pushed.slice(0, 6)));
  check("placeholder/scene.svg is in the push, at the path the page names", pushed.includes("placeholder/scene.svg"), J(pushed.filter((p) => !p.startsWith("assets/features"))));
  check("nothing was refused, and nothing is warned about", said === null && warned === null, J({ said, warned }));
  await ctx.close();
}

console.log("2. A picture this browser no longer has");
{
  const gone = { id: "pic_gone", path: "assets/pictures/pic_gone.png", type: "image/png", w: 10, h: 10, bytes: 10, alt: "", from: "upload" };
  const { ctx, page, pushed, said, warned, live } = await press([part("n2", { picture: gone })]);
  check("it still publishes, as before: the page goes up and the site goes live", pushed.includes("index.html") && said === null && /^Live ✓/.test(live ?? ""), J({ pushed: pushed.slice(0, 4), said, live }));
  check("…without the missing picture", !pushed.includes("assets/pictures/pic_gone.png"));
  check("the publish status warns which file is missing, on which page, and what to do", /^Published without 1 file the pages point at, so it is missing on the live site/.test(warned ?? "") && /assets\/pictures\/pic_gone\.png \(used on Home\)/.test(warned ?? "") && /Add the missing pictures again on the board/.test(warned ?? ""), J(warned));
  await page.screenshot({ path: ".screenshots/publish-complete.png", clip: { x: 0, y: 0, width: 1440, height: 120 } });
  await ctx.close();
}

check("no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
