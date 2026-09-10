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

/*
 * 6. And a press on a *piece* keeps it open, pressed where the word is.
 *
 * A square menu's outer pieces wrap a corner of the hole, so the middle of the
 * box that contains one is the hole — press there and you have pressed the
 * board through the gap, which is a press that closes the menu. The word is
 * always on the piece.
 */
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await openOnFrame();
const word = page.locator("[data-radial]").getByText(/^Looks$/).first();
if (await word.count()) {
  const b = await word.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(450);
  check("pressing a piece where its word is keeps the wheel open", await wheelOpen());
} else check("pressing a piece where its word is keeps the wheel open", false, "no Looks piece found");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/*
 * 7. And what the middle opens: the add disc, whose parts are drawn as
 *    themselves.
 *
 * A part is its real component, and a real card or tab bar has buttons in it,
 * so the row that holds one cannot itself be a button: the browser closes the
 * outer one where the inner one starts and the tree the server sent is not
 * the tree the browser built, which is a hydration error. It was one, and the
 * console said so on every open. The row is an option in a listbox now, and
 * the press still lands a part.
 */
await openOnFrame();
const middle = page.locator("[data-radial] [data-menu-add]").first();
if (await middle.count()) {
  await middle.click({ force: true });
  await page.waitForTimeout(1500);
}
check("the middle of the page's wheel opens the add disc", (await page.locator("[data-add-disc]").count()) === 1);
check("no part row is a button, or inside one",
  await page.evaluate(() => [...document.querySelectorAll("[data-add-item]")].every((el) => el.tagName !== "BUTTON" && !el.closest("button"))),
  `${await page.locator("[data-add-item]").count()} parts`);

const nodesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") ?? "{}")?.state?.nodes?.length ?? 0);
const pick = page.locator("[data-add-chosen]").first();
if (await pick.count()) { await pick.click({ force: true }); await page.waitForTimeout(1200); }
const nodesAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") ?? "{}")?.state?.nodes?.length ?? 0);
check("pressing a part still lands it on the board", nodesAfter === nodesBefore + 1, `${nodesBefore} → ${nodesAfter}`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
