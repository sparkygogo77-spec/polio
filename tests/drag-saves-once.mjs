/**
 * A part dragged is saved once, when it is let go.
 *
 * THE OWNER'S ASK (2026-10-06): after the pan stopped saving
 * (`tests/pan-no-save.mjs`), a drag still did. A drag does change the
 * document on every move, so each move wrote all of it: on a 700-part import
 * 40 writes of 2 MB in one short drag, and frames held up to half a second.
 * The board now holds the saves while a part is under the hand
 * (`store/hold.ts`) and writes once on the drop.
 *
 * Counted, not timed: `localStorage.setItem` for `builder.studio` is wrapped
 * before the page loads. Dragging a part across 30 moves must write nothing
 * until the hand comes up, then write, and the new place survives a reload.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/drag-saves-once.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/store/hold.ts, src/features/studio/board/store/create.ts, src/features/studio/board/DesktopCanvas.tsx
 */
import { createRequire } from "node:module";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const PARTS = 300;
const node = (id, featureId, label, x, y, w, h) => ({
  id, pageId: "p0", featureId, label, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const kinds = ["feature-cards", "cta-primary", "hero-split"];
const nodes = Array.from({ length: PARTS }, (_, i) => node(`n${i}`, kinds[i % 3], `Part ${i}`, 40 + (i % 4) * 340, 40 + Math.floor(i / 4) * 120, 320, 110));
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "DRAG", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}),
});
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
/* Seeded once: a reload must read what the Builder saved, not the seed again. */
await context.addInitScript((d) => {
  if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); }
  window.__writes = 0;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && k === "builder.studio") window.__writes++; return set.call(this, k, v); };
}, doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const drawn = await page.locator("[data-node-id]").count();
check("the parts are on the board", drawn >= PARTS, `${drawn} of ${PARTS}`);

/* The drag */
const xOf = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.id === "n1").x);
const x0 = await xOf();
const b = await page.locator('[data-node-id="n1"]').boundingBox();
const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
await page.mouse.click(at.x, at.y);
await page.waitForTimeout(400);
await page.mouse.move(at.x, at.y);
await page.mouse.down();
await page.evaluate(() => { window.__writes = 0; });
for (let i = 1; i <= 30; i++) await page.mouse.move(at.x + i * 4, at.y);
await page.waitForTimeout(300);
const during = await page.evaluate(() => window.__writes);
const moving = await page.evaluate(() => document.querySelector('[data-node-id="n1"]').getBoundingClientRect().x);
check("the part follows the hand", moving - b.x > 60, `${Math.round(moving - b.x)}px`);
check("nothing is written while the hand is down", during === 0, `${during} writes of the document over 30 moves (was one a move)`);
await page.mouse.up();
await page.waitForTimeout(800);
const dropped = await page.evaluate(() => window.__writes);
const x1 = await xOf();
check("the drop is written", dropped >= 1 && x1 > x0 + 60, `${dropped} writes, x ${x0} -> ${x1}`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
check("and survives a reload", (await xOf()) === x1, `x ${await xOf()} after reload, wanted ${x1}`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
