#!/usr/bin/env node
/**
 * A TEXTURE ON THE BACKGROUND OF A SITE BROUGHT IN LEAVES ITS COLOURS ALONE.
 *
 * J (2026-10-09): "tried applying some of these textures to the background
 * and it broke the colors of the rest of the site and undo didnt fix it, the
 * textures also never came up how they were supposed to". Measured on his
 * PonsStars import before the fix: one stripes layer on the spaces painted
 * the page's cream under 398 brought-in parts (the TV, the yellow buttons,
 * every drawing worn as a background), the stripes were the pale lime accent
 * on cream at 14% and could not be seen, and a change to a layer took no
 * undo step of its own.
 *
 * On the saved PonsStars board (tests/lib/board.mjs), in the Look panel:
 *   1. Grid fill and a stripes layer on the spaces change no part's paint,
 *   2. and the stripes show on the page,
 *   3. each press on where that layer lands is one undo, and undoing on
 *      takes the layer and the fill away and puts the page back as it was.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/texture-site-colours.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/parts/theme.ts, src/features/studio/look/LookPanel.tsx, src/features/studio/board/store/view.ts
 */
import { existsSync } from "node:fs";
import { openBoard } from "./lib/board.mjs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
const st = await openBoard(ui, URL_BASE, "pst");
check("PST is on the board", (st?.nodes?.length ?? 0) > 20, `${st?.nodes?.length ?? 0} parts`);
await ui.waitForTimeout(1500);
await ui.locator('[aria-label="Side panel"] button', { hasText: /^Look$/ }).first().click({ force: true });
await ui.locator("[data-look-texture] [data-look-fill]").first().waitFor({ timeout: 60000 }).catch(() => {});
await ui.waitForTimeout(1200);

/** Every part's paint, element by element. */
const paints = () => ui.evaluate(() => {
  const m = {};
  for (const n of document.querySelectorAll("[data-node-id]")) {
    [n, ...n.querySelectorAll("*")].forEach((e, i) => { const c = getComputedStyle(e); m[`${n.dataset.nodeId}#${i}`] = `${c.backgroundColor} ${c.backgroundImage.slice(0, 80)} ${c.color}`; });
  }
  return m;
});
/* The page as it stands in the pane, without scrolling it (an element shot scrolls the board, and the side panel follows the page it lands on). */
const frameShot = async () => {
  await ui.waitForTimeout(900);
  const pane = await ui.evaluate(() => { const r = document.querySelector("[data-studio-pane]").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  return ui.screenshot({ clip: pane });
};
/** How much of two pictures differs, in percent, compared in the page's own canvas. */
const differ = (a, b) => ui.evaluate(async ([a, b]) => {
  const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${src}`; });
  const [x, y] = await Promise.all([load(a), load(b)]);
  if (x.width !== y.width || x.height !== y.height) return 100;
  const read = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const p = read(x), q = read(y);
  let n = 0;
  for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 24) n++;
  return Math.round((n / (x.width * x.height)) * 1000) / 10;
}, [a.toString("base64"), b.toString("base64")]);

const before = await paints();
const startGround = await ui.evaluate(() => getComputedStyle(document.querySelector("[data-frame]")).backgroundImage);
const start = await frameShot();
/* The TV's static moves on its own: what two shots of the untouched page differ by is the floor every comparison stands on. */
const still = await differ(start, await frameShot());
const tex = ui.locator("[data-look-texture]");
await tex.locator('[data-look-fill] button[aria-label="Grid"]').click();
await tex.locator('[data-texture-spot="page"]').first().evaluate((b) => b.getAttribute("aria-pressed") === "true" || b.click());
await tex.locator('[data-texture-sample="stripes"]').click();
await ui.waitForTimeout(900);
const after = await paints();
const changed = Object.keys(before).filter((k) => after[k] !== undefined && before[k] !== after[k]);
check("a background texture changes no part's colours", Object.keys(before).length > 1000 && changed.length === 0,
  `${changed.length} of ${Object.keys(before).length} elements repainted${changed.length ? `, e.g. ${changed[0]}: ${before[changed[0]]} -> ${after[changed[0]]}` : ""}`);
const striped = await frameShot();
const seen = await differ(start, striped);
check("and the stripes show on the page", seen >= still + 2, `${seen}% of the page changed, ${still}% moves on its own`);

const layerSpots = tex.locator('[data-texture-spots][aria-label="Where this layer lands"]').first();
await layerSpots.locator('[data-texture-spot="panels"]').click();
await layerSpots.locator('[data-texture-spot="page"]').click();
await ui.waitForTimeout(400);
const pressed = async () => (await layerSpots.locator('[data-texture-spot][aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.dataset.textureSpot))).join("+");
const moved = await pressed();
const undo = async () => { await ui.locator("[data-frame]").first().click({ position: { x: 3, y: 3 }, force: true }).catch(() => {}); await ui.keyboard.press("Escape"); await ui.keyboard.press("Control+z"); await ui.waitForTimeout(500); };
await undo();
const once = await pressed();
check("each press on where the layer lands is one undo", moved === "panels" && once === "page+panels", `${moved}, then ${once}`);
await undo();
await undo();
await undo();
const layers = await tex.locator('[aria-label="Remove layer"]').count();
const ground = () => ui.evaluate(() => getComputedStyle(document.querySelector("[data-frame]")).backgroundImage);
const back = (await ground()) === startGround;
const end = await paints();
const still2 = Object.keys(before).filter((k) => end[k] !== undefined && before[k] !== end[k]).length;
const fill = await tex.locator('[data-look-fill] button[aria-pressed="true"]').getAttribute("aria-label");
check("and Undo takes the layer and the fill away and puts the page back", layers === 0 && fill === "Flat" && back && still2 === 0,
  `${layers} layers, fill ${fill}, page ${back ? "as it was" : "still painted"}, ${still2} elements repainted`);

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
