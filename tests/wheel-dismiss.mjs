/**
 * The wheel goes away when you click off it.
 *
 * One rule, checked on both wheels, because it was got wrong once: the
 * background's wheel used to stay up while you clicked the page frame it was
 * about, and the frame is most of the screen — so the only way out was the
 * grid at the very edge. A part's wheel keeps its own exception: clicking the
 * part you are editing leaves the menu up, on purpose, so it can be parked
 * aside and worked against.
 *
 *   node tests/wheel-dismiss.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

// Playwright is not a dependency of this template: it is used where it happens
// to be installed. PLAYWRIGHT_MODULE names one explicitly.
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });

const wheel = () => page.locator("[data-radial] svg, [data-radial] [data-slot]").first();
const wheelOpen = async () => (await page.locator("[data-radial]").count()) > 0 && (await page.locator("[data-radial]").first().isVisible());
const frame = page.locator("[data-frame]").first();
const box = await frame.boundingBox();
if (!box) throw new Error("No page frame on the board — cannot run.");

const openOnFrame = async () => {
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.35, { button: "right" });
  await page.waitForTimeout(450);
};

// 1. The background wheel opens on the bare frame.
await openOnFrame();
check("right-press on the page frame opens the wheel", await wheelOpen());

// 2. Clicking the frame elsewhere closes it. This is the rule that was wrong.
await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.7);
await page.waitForTimeout(450);
check("clicking the frame elsewhere closes the background wheel", !(await wheelOpen()));

// 3. Clicking outside the frame closes it too.
await openOnFrame();
await page.mouse.click(box.x - 40 > 0 ? box.x - 40 : 8, box.y + 20);
await page.waitForTimeout(450);
check("clicking the grid outside the frame closes it", !(await wheelOpen()));

// 4. Escape closes it.
await openOnFrame();
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("Escape closes the background wheel", !(await wheelOpen()));

// 5. Clicking the wheel itself does not close it.
await openOnFrame();
const w = await wheel().boundingBox();
if (w) {
  await page.mouse.click(w.x + w.width / 2, w.y + w.height / 2);
  await page.waitForTimeout(400);
  check("clicking the wheel itself keeps it open", await wheelOpen());
} else check("clicking the wheel itself keeps it open", false, "no wheel geometry found");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
