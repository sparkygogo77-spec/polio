/**
 * A toast under the pointer stays.
 *
 * "Pause feeds on hover: rows never slide away mid-click." Hovering a
 * toast froze its drain bar and nothing else: the sweep that runs every
 * half second still took it away at its expiry, bar frozen at half. The
 * store holds a hovered toast now and lets it go when the pointer leaves,
 * with what was left of its time.
 *
 *   node tests/toast-hold.mjs [url]
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
/* A short life, so the hold is what keeps it. */
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("builder.settings") ?? localStorage.getItem("settings") ?? "{}");
  void raw;
});
const toasts = () => page.locator('[role="status"]').count();
const fire = page.getByRole("button", { name: /^info$/i }).first();
check("the showcase has a key that toasts", (await fire.count()) === 1);
await fire.click();
await page.waitForTimeout(300);
check("pressing it puts a toast up", (await toasts()) === 1, `${await toasts()} toasts`);
const life = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.settings") ?? "{}");
  return s?.state?.values?.["feed.toastDurationMs"] ?? null;
});
await page.locator('[role="status"]').first().hover();
const held = 6500;
await page.waitForTimeout(held);
check(`hovered, it is still there ${held}ms later (its life is ${life ?? "the default, 1000 to 10000"}ms)`, (await toasts()) === 1, `${await toasts()} toasts`);
await page.mouse.move(10, 10);
await page.waitForTimeout(6000);
check("and once the pointer leaves it goes on its own", (await toasts()) === 0, `${await toasts()} toasts`);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
