/**
 * The showcase's controls do what their labels say.
 *
 * The showcase is on by default and a keystroke away (g s). Its right-click
 * cards offered Liked and Remove card, and both only toasted: the heart
 * never changed and the card stayed. Its Presets menu had five entries with
 * nothing behind them, its empty state's Open feed opened nothing, and its
 * inputs wore a "/" key hint that no key honoured. A demo of controls whose
 * controls do nothing is a demo of nothing.
 *
 *   node tests/showcase-live.mjs [url]
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
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
await page.goto(`${URL_}/showcase`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const cards = () => page.locator('[data-ctx="demo-card"]').count();
const liked = () => page.locator('[data-ctx="demo-card"][data-liked="true"]').count();
check("three cards, one liked", (await cards()) === 3 && (await liked()) === 1, `${await cards()} cards, ${await liked()} liked`);

const menu = async (card, name) => {
  await page.locator(`[data-ctx="demo-card"][data-ctx-id="${card}"]`).click({ button: "right" });
  await page.waitForTimeout(400);
  const item = page.getByRole("menuitem", { name }).or(page.getByRole("menuitemcheckbox", { name })).first();
  const there = (await item.count()) === 1;
  if (there) await item.click(); else await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return there;
};
check("Liked is on the card's menu", await menu("alpha", "Liked"));
check("and pressing it likes the card", (await liked()) === 2, `${await liked()} liked`);
check("Remove card is on the menu", await menu("gamma", "Remove card"));
await page.getByRole("button", { name: "Remove" }).click();
await page.waitForTimeout(400);
check("and confirming it removes the card", (await cards()) === 2, `${await cards()} cards`);

const saidP3 = () => page.locator('[role="status"]').filter({ hasText: /P3/ }).count();
await page.getByRole("button", { name: /^Presets/ }).click();
await page.waitForTimeout(400);
await page.getByRole("menuitem", { name: /P3/ }).click();
await page.waitForTimeout(400);
check("choosing a preset from the menu says which", (await saidP3()) === 1, `${await saidP3()} toasts name P3`);

/* The feed the showcase used to open is gone, panel and bell with it. What
   the page still demonstrates is the coalescing, on the card itself. */
check("no feed left to open", (await page.getByRole("button", { name: "Open feed" }).count()) === 0);
check("and no news panel behind it", (await page.locator('[role="dialog"][aria-label="News"]').count()) === 0);
const coalesced = async () => {
  await page.getByRole("button", { name: "+1%", exact: true }).click();
  await page.waitForTimeout(120);
};
await coalesced(); await coalesced(); await coalesced();
await page.waitForTimeout(300);
const cards3 = await page.locator('[role="status"]').filter({ hasText: /Slippage/ }).count();
check("three presses of the same key make one card", cards3 === 1, `${cards3} cards`);

check("no input wears a key hint that nothing honours", (await page.locator("input + * kbd, kbd").filter({ hasText: /^\/$/ }).count()) === 0);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
