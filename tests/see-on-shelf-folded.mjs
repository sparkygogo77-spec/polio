#!/usr/bin/env node
/**
 * "SEE EVERY MOTION ON THE SHELF" OPENS THE SHELF, FOLDED OR NOT.
 *
 * Found by the site audit: with the parts shelf folded (how a fresh board
 * starts), the Motion tab's link sent `studio:shelf`, which only chose the
 * category: nothing opened, so the button seemed dead. It unfolds the shelf now.
 *
 *   node tests/see-on-shelf-folded.mjs [url]     # default http://localhost:3000
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
await page.waitForTimeout(800);
const search = () => page.locator("input[placeholder*='Search parts']").count();
check("the shelf starts folded", (await search()) === 0);
await page.getByRole("tab", { name: "Motion" }).click().catch(() => page.getByText("Motion", { exact: true }).first().click());
await page.waitForTimeout(400);
await page.locator("[data-see-on-shelf]").click();
await page.waitForTimeout(800);
check("pressing the link unfolds the shelf", (await search()) === 1);
check("and opens its Motion category", /Motion and interaction/.test(await page.locator("body").innerText()) && (await page.getByText("As you scroll").count()) > 0);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
