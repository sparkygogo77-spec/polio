/**
 * Compile the blueprint, from inside the book.
 *
 * Four doors open the blueprint: ⌘⏎, the command, the canvas menu and the
 * brief menu, and every one of them comes through `__studioOpenBrief`. In
 * the book mode the blueprint is not a dialog but a tab under the timeline,
 * and the dialog is drawn only outside that mode; so the door set a flag
 * nothing drew, the press showed nothing, and the dialog then popped up by
 * itself the moment the person left the book. The door opens the tab now.
 *
 *   node tests/compile-in-book.mjs [url]
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* Every door is the one door, so one press proves them all. */
const index = readFileSync("src/features/studio/index.ts", "utf8");
const doors = (index.match(/__studioOpenBrief\?\.\(\)/g) ?? []).length;
check("the four ways to compile all go through one door", doors === 4, `${doors} doors`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const dialogs = () => page.locator('[role="dialog"][data-state="open"]').count();
const bookTab = () => page.locator("[data-iteration-book]").count();
const inBook = () => page.locator("[data-finish]").first().getAttribute("aria-pressed");

/* Outside the book, the door is the dialog. That part was never in doubt. */
await page.keyboard.press("Control+Enter");
await page.waitForTimeout(700);
check("on the board, ⌘⏎ opens the blueprint dialog", (await dialogs()) === 1, `${await dialogs()} dialogs`);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
check("and Escape closes it", (await dialogs()) === 0);

/* Into the book. */
await page.locator("[data-finish]").first().click();
await page.waitForTimeout(1000);
check("Finish puts the board in the book mode", (await inBook()) === "true");
check("where the book is a tab that starts closed", (await bookTab()) === 0);

await page.keyboard.press("Control+Enter");
await page.waitForTimeout(700);
check("⌘⏎ in the book opens the book's tab", (await bookTab()) === 1, `${await bookTab()} book tabs`);
check("and no dialog over it", (await dialogs()) === 0, `${await dialogs()} dialogs`);

/* Out again: nothing was left armed. */
await page.locator("[data-finish]").first().click();
await page.waitForTimeout(1000);
check("leaving the book pops no dialog up on its own", (await inBook()) === "false" && (await dialogs()) === 0, `${await dialogs()} dialogs`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
