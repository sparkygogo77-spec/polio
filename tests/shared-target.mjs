#!/usr/bin/env node
/**
 * TWO SITES NEVER SHARE A PUBLISH TARGET.
 *
 * From the owner's walk-through: SOLCINERATOR and Trump & Morty both
 * published to sparkygogo77-spec/trump-morty-trorty on main, so one press of
 * Update live site on SOLCINERATOR would have replaced the live Trump &
 * Morty. The site that last published to a target keeps it; any other site
 * with the same target has Update live site off, with a plain message naming
 * the site that keeps it and how to choose another, flagged in the repository
 * menu, the site switcher and Builds (Repos and the cards). Trump & Morty
 * stays publishable, and neither site's stored target is changed.
 *
 * The Builder's routes are answered in the browser: nothing reaches GitHub
 * or Vercel, no token exists. Screenshots: .screenshots/shared-target-*.png.
 *
 *   node tests/shared-target.mjs http://127.0.0.1:3013
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

const TARGET = { owner: "sparkygogo77-spec", name: "trump-morty-trorty", branch: "main" };
let pushes = 0;
const json = (r, body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
await page.route("**/api/studio/publish**", (r) => {
  if (r.request().method() === "GET") return json(r, { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } });
  pushes++;
  return json(r, { ok: false, reason: "github", message: "a push was sent" });
});
await page.route("**/api/studio/deploy**", (r) => json(r, r.request().method() === "GET" ? { configured: true, source: "server", repo: null, hook: false } : { ok: false, message: "a deploy was asked" }));
await page.route("**/api/studio/repo", (r) => json(r, { ok: true, repos: [{ name: "sparkygogo77-spec/trump-morty-trorty", private: true, branch: "main" }, { name: "sparkygogo77-spec/solcinerator", private: true, branch: "main" }] }));
await page.route("**/api/studio/branches**", (r) => json(r, { ok: true, base: "main", branches: [], more: 0 }));

const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const doc = env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [] });
const seeded = [
  { id: "tm", name: "Trump & Morty", updatedAt: Date.now() - 5000, repo: { ...TARGET }, bound: "connected", live: { url: "https://trump-morty-trorty.vercel.app", at: Date.now() - 3600_000 } },
  { id: "sol", name: "SOLCINERATOR", updatedAt: Date.now(), repo: { ...TARGET }, bound: "connected" },
  { id: "own", name: "Own Site", updatedAt: Date.now() - 9000, repo: { owner: "him", name: "own", branch: "main" }, bound: "made" },
];
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ builds, doc }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); for (const id of ["tm", "own"]) localStorage.setItem(`builder.doc:${id}`, doc); }, { builds: env({ projects: seeded, activeId: "sol" }), doc });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const bar = () => page.locator("header [data-go-live]").first();
const state = () => bar().getAttribute("data-go-live-state");
const shot = (n) => page.screenshot({ path: `.screenshots/shared-target-${n}.png` });

console.log("On SOLCINERATOR");
{
  const s = await state();
  const line = await page.evaluate(() => document.querySelector("header [data-go-live-shared]")?.textContent ?? null);
  check("Update live site is off", s === "shared" && (await bar().getAttribute("aria-disabled")) === "true", s);
  check("…and says which site keeps the target and how to choose another", /^Trump & Morty already publishes to sparkygogo77-spec\/trump-morty-trorty on main, so Update live site is off for this site/.test(line ?? "") && /Choose another repository or branch/.test(line ?? ""), J(line));
  await shot("1-bar");
  await bar().click({ force: true });
  await page.waitForTimeout(1200);
  check("a press sends nothing to GitHub or Vercel", pushes === 0, `${pushes} pushes`);
  const menu = await page.evaluate(() => ({ shared: document.querySelector("[data-repo-shared]")?.textContent ?? null, line: document.querySelector("[data-repo-line]")?.textContent ?? null }));
  check("…and opens the repository menu, which flags it", /Trump & Morty already publishes/.test(menu.shared ?? ""), J(menu));
  const pick = await page.evaluate(() => { const b = document.querySelector("[data-repo-publish-pick='sparkygogo77-spec/trump-morty-trorty']"); return b ? { disabled: b.disabled, text: b.textContent } : null; });
  check("in the menu's list the shared repository says who uses it", !!pick && /used by Trump & Morty/.test(pick.text), J(pick));
  await shot("2-menu");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.locator("[data-builds-switch]").click();
  await page.waitForTimeout(600);
  const flags = await page.evaluate(() => [...document.querySelectorAll("[data-switch-shared]")].map((e) => e.closest("button")?.textContent ?? ""));
  check("the site switcher flags SOLCINERATOR, and only it", flags.length === 1 && /SOLCINERATOR/.test(flags[0]) && /Trump & Morty uses this target/.test(flags[0]), J(flags));
  await shot("3-switcher");
  await page.keyboard.press("Escape");
}

console.log("On Builds");
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
{
  const cards = await page.evaluate(() => [...document.querySelectorAll("[data-card-shared]")].map((e) => e.closest("li")?.textContent ?? ""));
  check("the SOLCINERATOR card is flagged, and only it", cards.length === 1 && /SOLCINERATOR/.test(cards[0]), `${cards.length}`);
  await page.getByRole("radio", { name: /Repos/ }).or(page.getByRole("button", { name: /^Repos$/ })).or(page.getByRole("tab", { name: /Repos/ })).first().click();
  await page.waitForTimeout(600);
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-repo-shared]")].map((e) => e.closest("li")?.textContent ?? ""));
  check("Builds, Repos flags SOLCINERATOR, and only it", rows.length === 1 && /SOLCINERATOR/.test(rows[0]), `${rows.length}`);
  await shot("4-repos");
}

console.log("On Trump & Morty");
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Switch to Trump & Morty" }).click();
await page.waitForTimeout(900);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
{
  for (let i = 0; i < 40 && (await state()) === "checking"; i++) await page.waitForTimeout(250);
  const s = await state();
  check("Trump & Morty stays publishable", s === "live" || s === "ready", s);
  check("…and says nothing about sharing", (await page.locator("header [data-go-live-shared]").count()) === 0);
}

const after = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.projects.map((p) => ({ id: p.id, repo: p.repo })));
check("neither site's stored target was changed", J(after.find((p) => p.id === "tm")?.repo) === J(TARGET) && J(after.find((p) => p.id === "sol")?.repo) === J(TARGET), J(after));

console.log("A copy never shares");
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator("li", { hasText: "Own Site" }).getByRole("button", { name: "Duplicate this site" }).click();
await page.waitForTimeout(900);
{
  const copy = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.projects.find((p) => p.name === "Own Site copy") ?? null);
  check("a duplicated site has no publish target until its first publish makes one", !!copy && !copy.repo, J(copy?.repo));
}

check("no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
