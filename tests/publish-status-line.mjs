#!/usr/bin/env node
/**
 * THE TOP BAR SAYS WHERE A PUBLISH IS, IN PLAIN STEPS, AND A LATER SUCCESS
 * CLEARS AN OLD ERROR.
 *
 * From the owner's walk-through of the live Builder: the bar showed Vercel's
 * raw 'Resource is limited - try again in 24 hours (more than 100, code:
 * "api-deployments-free-per-day")'. Now:
 *   1. Vercel's daily limit: "Vercel's daily limit on builds is used up. Your
 *      change is saved on GitHub … and goes live when Vercel allows, about
 *      <time>", with the raw words under "details".
 *   2. A later publish that goes live clears it and says "Live ✓ at <time>",
 *      with the address to open.
 *   3. The Builder's own server failing says so with its status code.
 *   4. GitHub unreachable from the server says nothing was saved.
 *   5. A missing key names it.
 *
 * The Builder's own routes are answered in the browser (Playwright's route),
 * so nothing reaches GitHub or Vercel and no token exists. Screenshots go to
 * .screenshots/publish-status-*.png.
 *
 *   node tests/publish-status-line.mjs http://127.0.0.1:3013
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

/* How each route answers, changed between presses. */
const RAW = 'Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day").';
const plan = { publish: "ok", deploy: "limit", vercelKey: true };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
await page.route("**/api/studio/publish**", async (r) => {
  const req = r.request();
  const url = new URL(req.url());
  if (req.method() === "GET") return url.searchParams.get("tree") ? json(r, { ok: false, tree: [] }) : json(r, { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } });
  if (plan.publish === "500") return r.fulfill({ status: 500, contentType: "text/html", body: "<html><body>Internal Server Error</body></html>" });
  if (plan.publish === "unreachable") return json(r, { ok: false, reason: "github", message: "fetch failed (getaddrinfo ENOTFOUND api.github.com)" });
  return json(r, { ok: true, sha: "abc1234def", commitUrl: "https://github.com/him/site/commit/abc1234", branch: "main", repo: "him/site", files: 3, deployed: false, hook: false, changed: 3, total: 3 });
});
await page.route("**/api/studio/deploy**", async (r) => {
  const req = r.request();
  const url = new URL(req.url());
  if (req.method() === "GET") {
    if (url.searchParams.get("address")) return json(r, { ok: false });
    if (url.searchParams.get("id")) return json(r, { ok: true, state: "READY", done: true, url: "https://site-live.vercel.app", inspectorUrl: null });
    return json(r, { configured: plan.vercelKey, source: plan.vercelKey ? "server" : null, repo: null, hook: false });
  }
  if (plan.deploy === "limit") return json(r, { ok: false, reason: "vercel", status: 429, code: "api-deployments-free-per-day", reset: Math.round(Date.now() / 1000) + 5 * 3600, message: RAW });
  return json(r, { ok: true, id: "dpl_1", project: "site", repo: "him/site", branch: "main", team: null, state: "QUEUED", url: null, inspectorUrl: null });
});

const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
  builds: env({ projects: [{ id: "s1", name: "Site One", updatedAt: Date.now(), repo: { owner: "him", name: "site", branch: "main" } }], activeId: "s1" }),
  doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [] }),
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const bar = () => page.locator("header [data-go-live]").first();
const press = async () => {
  for (let i = 0; i < 40 && (await bar().getAttribute("data-go-live-state")) === "checking"; i++) await page.waitForTimeout(250);
  await bar().click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 120 && (await bar().getAttribute("data-go-live-state")) === "busy"; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(500);
};
const said = () => page.evaluate(() => document.querySelector("header [data-go-live-said]")?.textContent?.replace(/\s+/g, " ").trim() ?? null);
const shot = (n) => page.screenshot({ path: `.screenshots/publish-status-${n}.png`, clip: { x: 0, y: 0, width: 1440, height: 120 } });

/* The steps, seen as they pass: the push is held a moment so "Saving to GitHub…" can be read. */
{
  let seen = [];
  const watch = setInterval(async () => { const t = await page.evaluate(() => document.querySelector("header [data-go-live-step]")?.textContent ?? null).catch(() => null); if (t && seen.at(-1) !== t) seen.push(t); }, 60);
  await press();
  clearInterval(watch);
  check("while it works the bar says the step: Saving to GitHub…", seen.some((t) => t === "Saving to GitHub…"), J(seen));
}

console.log("1. Vercel's daily limit");
{
  const line = await said();
  check("the line is plain: the change is saved on GitHub and goes live when Vercel allows, about a time", /^Site One: Vercel's daily limit on builds is used up\. Your change is saved on GitHub \(him\/site on main\) and goes live when Vercel allows, about \d/.test(line ?? ""), J(line));
  check("…with none of the provider's own text in it", !/Resource is limited|api-deployments|code:/.test(line ?? ""));
  await shot("1-limit");
  await page.locator("header [data-go-live-details]").click();
  await page.waitForTimeout(400);
  const detail = await page.evaluate(() => document.querySelector("[data-go-live-detail]")?.textContent ?? null);
  check("the raw words are behind 'details'", (detail ?? "").includes(RAW), J(detail));
  await shot("1-limit-details");
  await page.keyboard.press("Escape");
}

console.log("2. A later success clears it");
plan.deploy = "ok";
await press();
{
  const line = await said();
  const live = await page.evaluate(() => { const a = document.querySelector("header [data-go-live-step='live']"); return a ? { text: a.textContent, href: a.getAttribute("href") } : null; });
  check("the old error is gone", line === null, J(line));
  check("the bar says Live ✓ with the time and the address to open", !!live && /^Live ✓ at \d/.test(live.text) && live.href === "https://site-live.vercel.app" && /open site-live\.vercel\.app/.test(live.text), J(live));
  await shot("2-live");
}

console.log("3. The Builder's own server fails");
plan.publish = "500";
await press();
{
  const line = await said();
  check("it says the Builder's server failed, with the status code, and that nothing was saved", /Builder's own server failed \(status 500\) while saving to GitHub, so nothing was saved/.test(line ?? ""), J(line));
  check("the Live line from before is not shown beside an error", (await page.locator("header [data-go-live-step='live']").count()) === 0);
  await shot("3-server");
}

console.log("4. GitHub unreachable from the server");
plan.publish = "unreachable";
await press();
{
  const line = await said();
  check("it says GitHub could not be reached and nothing was saved", /GitHub could not be reached, so nothing was saved/.test(line ?? ""), J(line));
  await shot("4-github");
}

console.log("5. A missing key");
plan.publish = "ok";
plan.vercelKey = false;
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
{
  for (let i = 0; i < 40 && (await bar().getAttribute("data-go-live-state")) === "checking"; i++) await page.waitForTimeout(250);
  const state = await bar().getAttribute("data-go-live-state");
  const why = await page.evaluate(() => document.querySelector("header [data-go-live-why]")?.textContent ?? null);
  check("with no Vercel key the button is off and names the key", state === "blocked" && /Vercel/.test(why ?? ""), `${state} ${J(why)}`);
}

check("no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
