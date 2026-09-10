/**
 * Putting the page's lamp down by pointing at it.
 *
 * The lamp used to be placed by dragging a dot around a thumbnail of the page,
 * which is a map of the thing rather than the thing. These check the moment
 * that replaced it: the board hands itself over, the pointer becomes the
 * light, a press puts it down and the same press's drag says how hard it is —
 * and every way out of the moment puts the lamp back if it was not committed.
 *
 *   node tests/light-placer.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

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
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const frame = await page.locator("[data-frame]").first().boundingBox();
const lightOf = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("builder.studio") ?? "{}")?.state?.look?.light ?? null; } catch { return null; }
});
const up = () => page.locator("[data-light-placer]").count();

/** Open the page's own wheel and walk into the light editor. */
async function openLightEditor() {
  await page.mouse.click(frame.x + frame.width * 0.5, frame.y + frame.height * 0.3, { button: "right" });
  await page.waitForTimeout(600);
  for (const word of [/^Looks$/, /^Light$/]) {
    const el = page.locator("[data-radial]").getByText(word).first();
    if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(700); }
  }
}

// 1. The third choice under the page's Looks, and the button on it.
await openLightEditor();
check("Looks offers Light beside Color and Texture", (await page.locator("[data-arc-button='Place the light']").count()) === 1);
check("the lamp has its own on and off", (await page.locator("[data-arc-button='Lamp on'], [data-arc-button='Lamp off']").count()) === 1);

// 2. Pressing it hands the board over — and takes the wheel away, because the
//    wheel is sitting on the page you are about to point at.
await page.locator("[data-arc-button='Place the light']").first().click({ force: true });
await page.waitForTimeout(500);
check("the board is handed over", (await up()) === 1);
check("the wheel gets out of the way", (await page.locator("[data-radial] [data-console-slab]").count()) === 0);

// 3. The lamp follows the hand over the page, before anything is committed.
await page.mouse.move(frame.x + frame.width * 0.3, frame.y + frame.height * 0.2);
await page.waitForTimeout(250);
const following = await lightOf();
check("the lamp follows the hand over the page", !!following?.on && Math.abs(following.x - 0.3) < 0.03, JSON.stringify(following && { x: +following.x.toFixed(2), y: +following.y.toFixed(2) }));

// 4. Pressing off the page puts it back the way it was.
const before = await lightOf();
await page.mouse.click(frame.x - 30 > 0 ? frame.x - 30 : 8, frame.y + 200);
await page.waitForTimeout(400);
const after = await lightOf();
check("pressing off the page cancels", (await up()) === 0 && !!after && after.on === false, `on=${after?.on}`);
check("cancelling puts the lamp back where it was", !!after && Math.abs(after.strength - (before?.strength ?? 0)) < 0.001);

// 5. Escape is the other way out.
await openLightEditor();
await page.locator("[data-arc-button='Place the light']").first().click({ force: true });
await page.waitForTimeout(400);
await page.mouse.move(frame.x + frame.width * 0.6, frame.y + 150);
await page.waitForTimeout(200);
await page.keyboard.press("Escape");
await page.waitForTimeout(350);
const escaped = await lightOf();
check("Escape gets out of it too", (await up()) === 0 && escaped?.on === false);

// 6. Press, drag up, let go: the place is where the press was and the shadows
//    are heavier by how far the drag went.
await openLightEditor();
await page.locator("[data-arc-button='Place the light']").first().click({ force: true });
await page.waitForTimeout(400);
const was = await lightOf();
const px = frame.x + frame.width * 0.25;
const py = frame.y + frame.height * 0.25;
await page.mouse.move(px, py);
await page.mouse.down();
await page.waitForTimeout(120);
await page.mouse.move(px, py - 130, { steps: 8 });
await page.waitForTimeout(200);
const held = await up();
await page.mouse.up();
await page.waitForTimeout(400);
const placed = await lightOf();
check("the press puts the lamp where the hand was", !!placed?.on && Math.abs(placed.x - 0.25) < 0.02 && Math.abs(placed.y - 0.25) < 0.03,
  placed && `${(placed.x * 100).toFixed(0)}%, ${(placed.y * 100).toFixed(0)}%`);
check("the moment stays up while the hand is down", held === 1);
check("dragging up makes the shadows heavier", !!placed && placed.strength > (was?.strength ?? 0) + 0.3,
  `${((was?.strength ?? 0) * 100).toFixed(0)}% then ${(placed.strength * 100).toFixed(0)}%`);
check("letting go ends it", (await up()) === 0);

// 7. The lamp lights the page only when it is asked to.
check("the lamp does not light the page by itself", (placed?.wash ?? 0) === 0 && (await page.locator("[data-frame-light]").count()) === 0);

await openLightEditor();
const wash = page.locator("[data-arc-slider='Light on the page']").first();
check("and there is a setting that asks it to", (await wash.count()) === 1);
if (await wash.count()) {
  // Drag it to the far end of its own run: the middle of the last step is on
  // the run wherever the wheel has been turned to.
  const step = page.locator("[data-arc-slider='Light on the page'] path:not([fill=\"none\"])").nth(20);
  const sb = await step.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  const lit = await lightOf();
  check("turning it up pools light on the page", (lit?.wash ?? 0) > 0.5 && (await page.locator("[data-frame-light]").count()) === 1,
    `wash ${Math.round((lit?.wash ?? 0) * 100)}%`);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
