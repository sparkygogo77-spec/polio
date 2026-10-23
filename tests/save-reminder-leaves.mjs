#!/usr/bin/env node
/**
 * THE "NEVER BACKED UP" REMINDER COVERS NO CONTROL.
 *
 * The site audit (1440x900, fresh profile): the reminder hung under the top
 * bar's save line over the toolbar's middle (Draw a space, Snap, the search
 * field), so a person mid-edit had controls under a warning. It is a
 * data-safety warning, so it stays until dismissed or backed up; it now sits
 * in the top bar to the left of the save line, where nothing else is.
 *
 *   node tests/save-reminder-leaves.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(AT && existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
for (let i = 0; i < 12; i++) await page.evaluate((i) => window.__studioHistory.act("setFormat", "pages.nav", i % 2 ? "sidebar" : "top bar"), i);
await page.waitForTimeout(800);
const reminder = page.locator("[data-save-reminder]");
check("after ten edits the reminder shows", (await reminder.count()) === 1);
const hit = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return "missing"; const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e === t || e.contains(t) || t?.contains(e) ? "clear" : "covered by " + (t?.closest("[data-save-reminder]") ? "the reminder" : t?.tagName); }, sel);
check("Draw a space is not under the reminder", (await hit("[data-draw-space-button]")) === "clear", await hit("[data-draw-space-button]"));
check("the search field is not under the reminder", (await hit("[data-tool-search]")) === "clear", await hit("[data-tool-search]"));
await page.locator("[data-draw-space-button]").click();
await page.waitForTimeout(500);
check("Draw a space clicks through with the reminder up", (await reminder.count()) === 1);
check("Snap is not under the reminder", (await hit("[data-kit-snap]")) === "clear", await hit("[data-kit-snap]"));
await page.locator("[data-kit-snap]").click({ timeout: 3000 }).then(() => check("Snap clicks", true), (e) => check("Snap clicks", false, String(e).slice(0, 80)));
await page.locator("[data-tool-search]").click({ timeout: 3000 }).then(() => check("the search field clicks", true), (e) => check("the search field clicks", false, String(e).slice(0, 80)));
await page.waitForTimeout(12000);
check("it is still up 12 s later: a warning stays until dismissed or backed up", (await reminder.count()) === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.locator("[data-reminder-dismiss]").click();
check("Not now dismisses it", (await reminder.count()) === 0);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
