/**
 * Carrying the page's lamp out of the menu and dropping it where it goes.
 *
 * The lamp used to be placed by dragging a dot around a thumbnail of the page,
 * which is a map of the thing rather than the thing. These check what replaced
 * it: opening Light dims the board everywhere but the page and lights the sun
 * on its button, the sun is dragged out and dropped, and a drop anywhere but
 * the page leaves the lamp exactly as it was.
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
const dimmed = () => page.locator("[data-light-dim]").count();
const sun = page.locator("[data-arc-button='Drag the sun']");

/** Open the page's own wheel and walk into the light editor. */
async function openLightEditor() {
  await page.mouse.click(frame.x + frame.width * 0.5, frame.y + frame.height * 0.3, { button: "right" });
  await page.waitForTimeout(600);
  for (const word of [/^Looks$/, /^Light$/]) {
    const el = page.locator("[data-radial]").getByText(word).first();
    if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(700); }
  }
}

/** Drag the sun out of the button and let go at a point on the screen. */
async function dropAt(x, y) {
  const b = await sun.first().boundingBox();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(150);
  const carrying = await page.locator("[data-light-ball]").count();
  await page.mouse.up();
  await page.waitForTimeout(450);
  return carrying;
}

// 1. The third choice under the page's Looks, and what is on it.
await openLightEditor();
check("Looks offers Light beside Color and Texture", (await sun.count()) === 1);
check("the lamp has its own on and off", (await page.locator("[data-arc-button='Lamp on'], [data-arc-button='Lamp off']").count()) === 1);
check("shadow strength has a slider of its own", (await page.locator("[data-arc-slider='Shadow strength']").count()) === 1);

// 2. Opening it is the whole of the arming: no press, and the menu stays put
//    because the sun has to be dragged out of it.
check("opening it dims the board", (await dimmed()) === 1);
check("the menu stays up to be dragged out of", (await page.locator("[data-radial] [data-console-slab]").count()) > 0);

// 3. No screen glass under the bars: it is for a slab you type on.
check("the sliders are not sitting on a screen", (await page.locator("[data-console-slab] [data-screen-face]").count()) === 0);

// 4. Carried out and dropped on the page.
const before = await lightOf();
const carrying = await dropAt(frame.x + frame.width * 0.28, frame.y + frame.height * 0.62);
check("the sun is in the hand while it is carried", carrying === 1);
const placed = await lightOf();
check("dropping it on the page puts the lamp there", !!placed?.on && Math.abs(placed.x - 0.28) < 0.02 && Math.abs(placed.y - 0.62) < 0.03,
  placed && `${(placed.x * 100).toFixed(0)}%, ${(placed.y * 100).toFixed(0)}%`);
check("the board comes back once it is placed", (await dimmed()) === 0);
check("it does not light the page by itself", (placed?.wash ?? 0) === 0 && (await page.locator("[data-frame-light]").count()) === 0);

// 5. Dropped anywhere else, the lamp is exactly as it was.
await openLightEditor();
const kept = await lightOf();
await dropAt(Math.max(8, frame.x - 60), frame.y + 200);
const after = await lightOf();
check("a drop off the page leaves the lamp alone", !!after && Math.abs(after.x - kept.x) < 0.001 && Math.abs(after.y - kept.y) < 0.001,
  after && `${(after.x * 100).toFixed(0)}%, ${(after.y * 100).toFixed(0)}%`);
check("and the light stays out, ready to try again", (await dimmed()) === 1);

// 6. Escape gets out of it.
await page.keyboard.press("Escape");
await page.waitForTimeout(350);
check("Escape gets out of it", (await dimmed()) === 0);

// 7. Shadow strength is a slider, and it moves.
await openLightEditor();
const bar = page.locator("[data-arc-slider='Shadow strength']").first();
const bb = await bar.boundingBox();
await page.mouse.move(bb.x + bb.width * 0.8, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width * 0.8, bb.y + bb.height / 2, { steps: 3 });
await page.mouse.up();
await page.waitForTimeout(300);
const harder = await lightOf();
check("shadow strength can be set", (harder?.strength ?? 0) > (before?.strength ?? 0) + 0.2,
  `${Math.round((before?.strength ?? 0) * 100)}% then ${Math.round((harder?.strength ?? 0) * 100)}%`);

// 8. The lamp lights the page only when it is asked to.
const wash = page.locator("[data-arc-slider='Light on the page']").first();
check("and there is a setting that asks it to", (await wash.count()) === 1);
if (await wash.count()) {
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
