/**
 * The key that hides the side panel says it hides the side panel.
 *
 * One toolbar key toggles the whole five-tab side panel (Element, Format,
 * Pages, Look, Motion). Its tooltip said "Show / Hide colour & texture",
 * its name to a screen reader was "Toggle look", its command was "show or
 * hide the library" and its shortcut line "Show / hide the library". Four
 * names, none of them the thing: the parts library is never hidden by it,
 * and colour is one tab of five.
 *
 *   node tests/side-panel-label.mjs [url]
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
/** Source without its comments, so a pin never matches the sentence explaining a removal. */
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const studioPage = bare("src/features/studio/StudioPage.tsx");
const index = bare("src/features/studio/index.ts");
check("the tooltip names the side panel", /"Hide the side panel" : "Show the side panel"/.test(studioPage));
check("and does not say colour & texture", !/colou?r & texture/.test(studioPage));
check("the key's name names the side panel", /aria-label="Toggle the side panel"/.test(studioPage));
check("the command names the side panel", /label: "Builder: show or hide the side panel"/.test(index));
check("and so does the l shortcut", /keys: "l", label: "Show \/ hide the side panel"/.test(index));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const panels = () => page.locator("aside[data-side-panel]").count();
const shelf = () => page.locator("[data-shelf]").count();
check("the side panel and the shelf both start on screen", (await panels()) === 1 && (await shelf()) === 1);
const key = page.locator('[aria-label="Toggle the side panel"]');
check("the key is there under its new name", (await key.count()) === 1);
if (await key.count()) {
  await key.click();
  await page.waitForTimeout(400);
  check("pressing it hides the side panel", (await panels()) === 0, `${await panels()} panels`);
  check("and leaves the shelf where it was", (await shelf()) === 1);
  await key.click();
  await page.waitForTimeout(400);
  check("pressing it again brings the panel back", (await panels()) === 1);
}
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
