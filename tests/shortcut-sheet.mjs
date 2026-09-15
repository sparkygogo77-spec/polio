/**
 * The cheat sheet lists the shortcuts that fire where you are.
 *
 * Every registered shortcut was listed, and 18 of the Builder's 20 carry a
 * condition: on the board the sheet advertised "b Back to the board", and
 * in the full preview it advertised the select tool, the draw tool and the
 * rest, none of which fire there. The sheet asks each shortcut's own
 * condition now, the same one the key handler asks.
 *
 *   node tests/shortcut-sheet.mjs [url]
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

const rows = async () => {
  await page.keyboard.press("/");
  await page.waitForTimeout(600);
  const list = await page.locator('[role="dialog"][data-state="open"] li').evaluateAll((els) => els.map((e) => e.querySelector("span")?.textContent?.trim() ?? ""));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return list;
};

await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const onBoard = await rows();
check("the sheet opens on the board", onBoard.length > 10, `${onBoard.length} rows`);
check("on the board it lists Design / Preview", onBoard.includes("Design / Preview"));
check("and not Back to the board, which fires only in the full preview", !onBoard.includes("Back to the board"));

await page.goto(`${URL_}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const onPreview = await rows();
check("the sheet opens in the full preview", onPreview.length > 5, `${onPreview.length} rows`);
check("there it lists Back to the board", onPreview.includes("Back to the board"));
check("and not the select tool, which fires only on the board", !onPreview.includes("Select tool"));
check("nor Design / Preview", !onPreview.includes("Design / Preview"));
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
