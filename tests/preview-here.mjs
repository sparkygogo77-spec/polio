/**
 * "Preview here" previews here.
 *
 * The page's wheel has a tray under it with Preview here on it, and the
 * key `p` flips the board between Design and Preview in place. The tray
 * item left the board instead, for the full /builder/preview address, so
 * the same word meant two things and "here" was the one that went away.
 * The page's Preview here flips the board now; a part's still goes to the
 * live page and scrolls to that part, because that is what it is for.
 *
 * And the site config's `home` block (a hero with two calls to action, a
 * module grid, an agent guide) had no reader: Builds owns "/". It is gone,
 * with its type.
 *
 *   node tests/preview-here.mjs [url]
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
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

check("the site config has no home block nothing reads", !/\bhome:/.test(bare("site.config.ts")) && !/showModuleGrid|showAgentGuide|HeroConfig/.test(bare("src/core/site.ts")));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const bare_ = await page.evaluate(() => {
  const f = document.querySelector("[data-frame]").getBoundingClientRect();
  return { x: Math.round(f.x + 60), y: Math.round(f.y + f.height / 2) };
});
await page.mouse.click(bare_.x, bare_.y, { button: "right" });
await page.waitForTimeout(700);
check("the page's wheel opens", (await page.locator("[data-radial]").count()) === 1);
/* The tray is a tab under the wheel that opens into its row on hover. */
await page.locator('[data-tray="page"]').first().hover();
await page.waitForTimeout(400);
const item = page.locator('[data-tray-item="preview"]').first();
check("with Preview here on its tray", (await item.count()) === 1 && (await item.isVisible()));
await item.click();
await page.waitForTimeout(900);
check("pressing it previews here: the address does not change", new URL(page.url()).pathname === "/builder", new URL(page.url()).pathname);
check("and the board is in Preview", (await page.locator("[data-live-scroller]").count()) === 1 && (await page.locator("[data-frame]:not([data-board-kept] *)").count()) === 0);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
