/**
 * While a part is dragged, only the board moves.
 *
 * THE OWNER'S ASK (2026-10-06): "dragging elements around is still laggy".
 * Saving already waited for the drop (`tests/drag-saves-once.mjs`), but every
 * move still redrew the side panel (the picked part's Element panel: its
 * trail, colours, link, effects), the page bar and the preview, and the
 * ground's sparks kept repainting thirty times a second. On a 300-part page
 * that was about 25ms of script a move; with them held it is about 9.
 *
 * Counted, not timed: while the hand is down and moving, nothing outside the
 * board's pane changes in the page, and the sparks are not drawn. After the
 * drop the panels catch up.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/drag-panels-still.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/store/heldView.ts, src/features/studio/ground.ts, src/features/studio/canvas/DesktopCanvas.tsx
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
const b = await page.locator('[data-node-id="n1"]').boundingBox();
const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
await page.mouse.click(at.x, at.y);
await page.waitForTimeout(800);
await page.mouse.move(at.x, at.y);
await page.mouse.down();
await page.mouse.move(at.x + 6, at.y);
await page.waitForTimeout(300);
await page.evaluate(() => {
  window.__outside = [];
  window.__sparks = 0;
  const pane = document.querySelector("[data-studio-pane]");
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!el || (pane && pane.contains(el)) || el.closest?.("[data-studio-pane]")) continue;
      window.__outside.push(el.outerHTML.slice(0, 120));
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const sparks = document.querySelector("[data-ground-sparks]");
  for (const m of ["clearRect", "fillRect", "fill", "stroke", "drawImage"]) {
    const o = CanvasRenderingContext2D.prototype[m];
    CanvasRenderingContext2D.prototype[m] = function (...a) { if (this.canvas === sparks) window.__sparks++; return o.apply(this, a); };
  }
});
for (let i = 1; i <= 30; i++) await page.mouse.move(at.x + 6 + i * 4, at.y);
await page.waitForTimeout(300);
const outside = await page.evaluate(() => window.__outside);
const sparks = await page.evaluate(() => window.__sparks);
const moving = await page.evaluate(() => document.querySelector('[data-node-id="n1"]').getBoundingClientRect().x);
check("the part follows the hand", moving - b.x > 60, `${Math.round(moving - b.x)}px`);
check("nothing outside the board changes while the hand is down", outside.length === 0, `${outside.length} changes${outside.length ? `, first: ${outside[0]}` : ""}`);
check("the sparks hold still while the hand is down", sparks === 0, `${sparks} draws`);
await page.evaluate(() => { window.__outside = []; window.__sparks = 0; });
await page.mouse.up();
await page.waitForTimeout(1500);
check("after the drop, the panels catch up", (await page.evaluate(() => window.__outside.length)) > 0, `${await page.evaluate(() => window.__outside.length)} changes`);
check("and the sparks go on", (await page.evaluate(() => window.__sparks)) > 0, `${await page.evaluate(() => window.__sparks)} draws`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
