/**
 * A pan writes nothing; an edit is still saved.
 *
 * THE OWNER'S REPORT (2026-10-06): panning stayed laggy after the parts
 * stopped redrawing (`tests/pan-no-redraw.mjs`). The persister saved the whole
 * document on every change of state, and a pan changes `pan` on every move,
 * which is not even saved: for an imported PonsStars board (733 parts, 2 MB)
 * that was 2 MB turned to text and written to localStorage a move, 2.8s of
 * script in one pan. Now only a change to what is saved is written
 * (`store/create.ts#keptOnly`).
 *
 * Counted, not timed: `localStorage.setItem` for `builder.studio` is wrapped
 * before the page loads. A middle-button pan must make no write; two arrow
 * nudges on a picked part must make at least one, and survive a reload.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/pan-no-save.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/store/create.ts, src/features/studio/store/persist.ts, src/features/studio/docStore.ts
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
  nodes, groups: [], shapes: [], format: {}, brief: { name: "SAVE", gimmick: "", master: "" },
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

/* The pan */
const before = await page.locator("[data-frame]").first().boundingBox();
await page.mouse.move(760, 520);
await page.mouse.down({ button: "middle" });
await page.evaluate(() => { window.__writes = 0; });
for (let i = 0; i < 30; i++) await page.mouse.move(760 - i * 6, 520 + (i % 2) * 4);
await page.waitForTimeout(300);
const panWrites = await page.evaluate(() => window.__writes);
await page.mouse.up({ button: "middle" });
await page.waitForTimeout(300);
const after = await page.locator("[data-frame]").first().boundingBox();
const moved = before && after ? Math.round(Math.abs(after.x - before.x)) : 0;
check("the pan moved the board", moved > 60, `${moved}px`);
check("the pan wrote nothing", panWrites === 0, `${panWrites} writes of the document over 30 moves (was one a move)`);

/* An edit still saves */
const xOf = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.id === "n0").x);
const x0 = await xOf();
const b = await page.locator('[data-node-id="n0"]').boundingBox();
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(300);
await page.evaluate(() => { window.__writes = 0; });
await page.keyboard.press("ArrowRight"); await page.waitForTimeout(200);
await page.keyboard.press("ArrowRight"); await page.waitForTimeout(800);
const editWrites = await page.evaluate(() => window.__writes);
check("a nudge is written", editWrites >= 1 && (await xOf()) === x0 + 2, `${editWrites} writes, x ${x0} -> ${await xOf()}`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
check("and survives a reload", (await xOf()) === x0 + 2, `x ${await xOf()} after reload, wanted ${x0 + 2}`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
