#!/usr/bin/env node
/**
 * THE WORDS IN THE "MORE TOOLS" MENU DO WHAT THEIR ICON DOES.
 *
 * Found by the site audit: each row of More shows a name beside a small
 * icon key, but only the icon was a key: pressing "Capture a site", "Updates",
 * "Hide the wires" or "Part menu: square edge" did nothing and left the menu open.
 *
 *   node tests/more-tools-words.mjs [url]     # default http://localhost:3000
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
const more = async () => { await page.locator("[data-toolbar-more]").click(); await page.waitForTimeout(250); };
const word = (name) => page.getByText(name, { exact: true }).first();

await more();
const shape0 = await page.locator("[data-menu-shape]").first().getAttribute("data-menu-shape");
await word(shape0 === "square" ? "Part menu: square edge" : "Part menu: round edge").click();
await page.waitForTimeout(250);
check("pressing the part menu's words turns its edge", (await page.locator("[data-menu-shape]").first().getAttribute("data-menu-shape")) !== shape0);

await word("Hide the wires").click();
await page.waitForTimeout(250);
check("pressing the wires' words hides them", (await page.getByText("Show the wires", { exact: true }).count()) === 1);

await word("Capture a site").click();
await page.waitForTimeout(600);
check("pressing Capture a site opens the capture dialog and closes the menu", (await page.locator("[data-toolbar-more-menu]").count()) === 0 && (await page.getByRole("dialog", { name: /capture a site/i }).count()) === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await more();
await word("Updates").click();
await page.waitForTimeout(600);
check("pressing Updates closes the menu and opens the updates", (await page.locator("[data-toolbar-more-menu]").count()) === 0 && (await page.locator("[data-updates-panel], [data-updates]").count()) > 0);

await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
