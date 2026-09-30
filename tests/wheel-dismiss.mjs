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

/* A bare spot of the frame: a new idea lands in the middle of the view (tests/new-idea-here.mjs), so a fixed point may be under a part. */
const bareSpot = () => page.evaluate(({ x, y, w, h }) => {
  for (const fy of [0.35, 0.5, 0.65, 0.8, 0.2]) for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9]) {
    const px = x + w * fx, py = y + h * fy;
    if (document.elementFromPoint(px, py)?.hasAttribute("data-frame")) return { px, py };
  }
  return { px: x + w * 0.5, py: y + h * 0.35 };
}, { x: box.x, y: box.y, w: box.width, h: Math.min(box.height, 780 - box.y) });
const openOnFrame = async () => {
  const { px, py } = await bareSpot();
  await page.mouse.click(px, py, { button: "right" });
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

/*
 * 5. GONE, and this is the note that replaces it.
 *
 * It read "clicking the wheel itself keeps it open" and it clicked the
 * middle of the wheel's bounding box. On a square menu the middle of that
 * box is the hole, and in the hole is the Add button — so it pressed a
 * control, the control opened the add disc, the disc is inside
 * `[data-radial]`, and `wheelOpen()` came back true. Green every time, for
 * none of the reasons in its name.
 *
 * Both halves of what it was reaching for are already held, properly and
 * once each: a press on a piece is check 6 below, pressed where the word
 * is rather than at a centre that is not on the piece at all; and what the
 * middle does is "the middle of the page's wheel opens the add disc",
 * further down, which presses it on purpose and says so.
 */

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
/*
 * 6b. Looks wears the part's look, and the hand does not paint over it.
 *
 * Every other piece answers a hover by going a brighter blue. Looks *is* the
 * part's colour or texture, so a blue wash over it under the hand says the
 * button is blue after all — which it did. The lift stays; the paint does not
 * move.
 */
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
// The board this suite runs on is empty, so it needs a part of its own.
if (!(await page.locator("[data-node-id]").count())) {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
}
const part = page.locator("[data-node-id]").first();
const partBox = (await part.count()) ? await part.boundingBox() : null;
if (partBox) {
  await page.mouse.click(partBox.x + partBox.width / 2, partBox.y + partBox.height / 2, { button: "right" });
  await page.waitForTimeout(600);
  const looks = page.locator('[data-radial] [data-shard="look"]').first();
  const worn = await page.locator('[data-radial] [data-worn="look"]').count();
  const paint = () => looks.evaluate((el) => `${el.getAttribute("fill")}|${el.getAttribute("stroke")}`);
  const lb = await looks.boundingBox();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(350);
  const atRest = await paint();
  await page.mouse.move(lb.x + lb.width * 0.5, lb.y + lb.height * 0.75);
  await page.waitForTimeout(400);
  const hovered = await paint();
  check("the Looks piece wears the part's own look", worn === 1);
  check("and the hand does not tint it", atRest === hovered, atRest.split("|")[0]);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
} else {
  check("the Looks piece wears the part's own look", false, "no part on the board to open a wheel about");
}

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
