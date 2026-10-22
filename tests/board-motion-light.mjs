#!/usr/bin/env node
/**
 * THE BOARD'S MOTION RULES NAME A PATH, NOT EVERY PART BY ID.
 *
 * A captured hover that lights a whole group (a card, a nav) fires when the
 * pointer is on any part of it, so its rule is a `:root:has(…:hover)`. The
 * board said every part of the group by id inside it; the published page
 * says the host and the path its parts stand under (`motionCss#trigger`,
 * `data-at`). On sol face that made the board's sheet 1.6 MB, with 35,546
 * `:hover`s inside 1,076 `:root:has(…)`, and every style pass of the board
 * matched all of it: with the sheet switched off a drag move took 83 ms
 * instead of 217, and ten wheel steps 1.0 s instead of 2.7.
 *
 *   1. the board's sheet is under 400 KB and no `:has(…)` in it lists more
 *      than three selectors;
 *   2. it is the same motion: pointed at a part under each of a dozen named
 *      paths, every part on the board computes the same style under the
 *      sheet said by id as under the sheet said by path;
 *   3. dragging a part and scrolling the board cost under the budgets set
 *      from the measurement (main-thread time, unthrottled): a move under
 *      150 ms (was 217), a wheel step under 180 ms (was 270).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-motion-light.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx, src/features/studio/board/NodeView.tsx, src/features/studio/shelf/parts/capturedMotion.ts, src/features/studio/send-out/exportSite.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { heavyBoard } from "./lib/heavy.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const M = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "capturedMotion.ts"));

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const h = await heavyBoard(URL_BASE);
const { page, cdp } = h;
const SHEET = "style[data-board-motion-css]";

/* 1. */
const sheet = await page.evaluate((s) => document.querySelector(s)?.textContent ?? "", SHEET);
const widest = Math.max(0, ...[...sheet.matchAll(/:has\(([^{]*?)\)\s/g)].map((m) => m[1].split(",").length));
check("1. the board's motion sheet is under 400 KB", sheet.length < 400_000, `${Math.round(sheet.length / 1024)} KB`);
check("…and no :has(…) in it lists more than three selectors", widest <= 3, `widest lists ${widest}`);

/* 2. Both sheets from the board's own parts, one said by id and one by path. */
const live = await page.evaluate(() => { const all = window.__studioNodes?.() ?? []; const st = JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state ?? {}; return { nodes: all, page: st.activePageId ?? all[0]?.pageId, keyframes: st.look?.keyframes }; });
const on = live.nodes.filter((n) => n.pageId === live.page);
const at = (id) => `[data-node-id="${id}"]`;
const byId = M.motionCss(on, live.keyframes, at);
const pathCode = M.pathCodes(on);
const used = new Set();
const byPath = M.motionCss(on, live.keyframes, at, undefined, pathCode, used);
const worn = M.codesWorn(on, pathCode, used);
const wearing = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-at]")].map((el) => [el.getAttribute("data-node-id"), el.getAttribute("data-at")])));
check("2. the parts under a named path wear its code on the board", worn.size > 0 && [...worn].every(([id, code]) => wearing[id] === code), `${Object.keys(wearing).length} wear one, ${worn.size} should`);

/* Still: no animation or transition, so what is read is the rule and not the moment. */
await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
const PROPS = ["transform", "translate", "scale", "rotate", "opacity", "color", "background-color", "background-image", "box-shadow", "filter", "border-color", "outline-color", "text-decoration-color"];
const read = () => page.evaluate((props) => [...document.querySelectorAll("[data-node-id], [class*='mo-']")].map((el) => { const c = getComputedStyle(el); return props.map((p) => c.getPropertyValue(p)).join("|"); }).join("\n"), PROPS);
const use = (css) => page.evaluate(({ s, css }) => { document.querySelector(s).textContent = css; }, { s: SHEET, css });
const codes = [...used].slice(0, 12);
let same = 0, tried = 0;
const differ = [];
for (const code of codes) {
  const spot = await page.evaluate((code) => {
    for (const el of document.querySelectorAll(`[data-at^="${code}"]:not([data-at="${code}"])`)) {
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const x = r.left + Math.min(r.width / 2, 20), y = r.top + Math.min(r.height / 2, 10);
      if (r.width > 4 && r.height > 4 && el.contains(document.elementFromPoint(x, y))) return { x, y };
    }
    return null;
  }, code);
  if (!spot) continue;
  tried++;
  const at1 = async (css) => { await use(css); await page.mouse.move(2, 2); await page.waitForTimeout(80); await page.mouse.move(spot.x, spot.y); await page.waitForTimeout(120); return read(); };
  const a = await at1(byId), b = await at1(byPath);
  if (a === b) same++; else differ.push(code);
}
await use(sheet);
await page.mouse.move(2, 2);
check("…and pointed at a part under each named path, every part computes the same style either way", tried >= 3 && same === tried, `${same} of ${tried} paths alike${differ.length ? `; differ under ${differ.join(" ")}` : ""}`);

/* 3. Main-thread time, from the browser's own count. */
const busy = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
await cdp.send("Performance.enable");
await page.locator("[data-studio-pane]").first().evaluate((el) => { el.scrollTop = 0; });
await page.waitForTimeout(800);
const t = await h.grabbable();
await page.mouse.move(t.x, t.y);
await page.mouse.down();
await page.mouse.move(t.x + 4, t.y);
let b0 = await busy();
for (let i = 1; i <= 10; i++) { await page.mouse.move(t.x + 4 + i * 4, t.y + i); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
const perMove = ((await busy()) - b0) * 100;
await page.mouse.up();
await page.keyboard.press("Control+z");
await page.waitForTimeout(800);
await page.mouse.move(700, 450);
b0 = await busy();
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 120); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
const perStep = ((await busy()) - b0) * 100;
check("3. a drag move costs under 150 ms of main thread", perMove < 150, `${Math.round(perMove)} ms a move`);
check("…and a wheel step under 180 ms", perStep < 180, `${Math.round(perStep)} ms a step`);
check("…and nothing threw", h.errors.length === 0, h.errors[0] ?? "");

await h.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
