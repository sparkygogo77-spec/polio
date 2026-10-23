#!/usr/bin/env node
/**
 * THE "NEVER BACKED UP" REMINDER LEAVES ON ITS OWN.
 *
 * The site audit (1440x900, fresh profile): the reminder hangs under the
 * top bar's save line over the toolbar's middle (Draw a space, Snap, the
 * search field) and stays until someone presses "Not now", so a person
 * mid-edit has controls under a notice they never asked for. It is a
 * reminder shown once, so it may go by itself after a few seconds; the
 * save line still opens the backups.
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
await page.waitForTimeout(14000);
check("it has gone by itself 14 s later", (await reminder.count()) === 0);
check("the save line is still there to open the backups", (await page.locator("[data-save-line]").count()) === 1);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
