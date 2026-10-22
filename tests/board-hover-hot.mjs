#!/usr/bin/env node
/**
 * NO `:root:has(…)` ON THE BOARD: A GROUP'S HOVER, FOCUS AND PRESS ARE ATTRIBUTES.
 *
 * A captured state that lights a group fired through `:root:has(…:hover)`
 * (or `:focus-visible`, `:focus-within`, `:active`). With any such rule on
 * the board, every element the browser restyled cost about twice as much:
 * scrolling sol face's board restyles ~8,600 elements a wheel step, at
 * 12–13 µs each with them and 7 without (6 with no motion sheet at all).
 * The board now writes, on its own element, the part each state is on and
 * the paths it stands under (`board/hoverHot.ts`), and the rules name those.
 *
 *   1. the board's sheet has no `:has(` left; the published page's sheet is
 *      not changed;
 *   2. it is the same motion: pointed at, pressed on, and focused in a part
 *      under each of a dozen named paths, and each path's host, every part
 *      computes the same style as under the sheet said with `:has`;
 *   3. while scrolling, a restyled element costs at most 1.4× what it costs
 *      with no motion sheet (it was ~2×);
 *   4. off the board, nothing is hot.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-hover-hot.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/hoverHot.ts, src/features/studio/board/DesktopCanvas.tsx, src/features/studio/shelf/parts/capturedMotion.ts
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
const { page } = h;
const SHEET = "style[data-board-motion-css]";

/* 1. */
const sheet = await page.evaluate((s) => document.querySelector(s)?.textContent ?? "", SHEET);
const hasLeft = sheet.split(":has(").length - 1;
check("1. the board's sheet has no :has( left", sheet.length > 0 && hasLeft === 0, `${hasLeft} left`);
const live = await page.evaluate(() => { const all = window.__studioNodes?.() ?? []; const st = JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state ?? {}; return { nodes: all, page: st.activePageId ?? all[0]?.pageId, keyframes: st.look?.keyframes }; });
const on = live.nodes.filter((n) => n.pageId === live.page);
const at = (id) => `[data-node-id="${id}"]`;
const used = new Set();
const pathCode = M.pathCodes(on);
const viaHas = M.motionCss(on, live.keyframes, at, undefined, pathCode, used);
const published = M.motionCss(on, undefined, (id) => `#${id}`, undefined, M.pathCodes(on), new Set());
check("…and the published page's sheet still says :has, as before", published.includes(":root:has(") && !published.includes("data-hot"));

/* 2. Each state, under each sheet. */
await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
const PROPS = ["transform", "translate", "scale", "rotate", "opacity", "color", "background-color", "background-image", "box-shadow", "filter", "border-color", "outline-color", "text-decoration-color"];
const read = () => page.evaluate((props) => [...document.querySelectorAll("[data-node-id], [class*='mo-']")].map((el) => { const c = getComputedStyle(el); return props.map((p) => c.getPropertyValue(p)).join("|"); }).join("\n"), PROPS);
const use = (css) => page.evaluate(({ s, css }) => { document.querySelector(s).textContent = css; }, { s: SHEET, css });
const spotOf = (sel) => page.evaluate((sel) => {
  for (const el of document.querySelectorAll(sel)) {
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const x = r.left + Math.min(r.width / 2, 20), y = r.top + Math.min(r.height / 2, 10);
    if (r.width > 4 && r.height > 4 && el.contains(document.elementFromPoint(x, y))) return { x, y };
  }
  return null;
}, sel);
const away = async () => { await page.mouse.move(2, 2); await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(80); };
const hosts = new Map(on.map((n) => [pathCode(n.id), n.id]));
let same = 0, tried = 0, lit = 0;
const differ = [];
for (const code of [...used].slice(0, 12)) {
  for (const sel of [`[data-at^="${code}"]:not([data-at="${code}"])`, hosts.get(code) ? `[data-node-id="${hosts.get(code)}"]` : null].filter(Boolean)) {
    const spot = await spotOf(sel);
    if (!spot) continue;
    const states = {
      hover: async () => { await page.mouse.move(spot.x, spot.y); await page.waitForTimeout(120); const r = await read(); return r; },
      press: async () => { await page.mouse.move(spot.x, spot.y); await page.mouse.down(); await page.waitForTimeout(80); const r = await read(); await page.mouse.up(); await page.keyboard.press("Control+z"); return r; },
      focus: async () => {
        await page.evaluate((sel) => {
          const p = document.querySelector(sel);
          const f = "a,button,input,select,textarea,[tabindex]";
          const t = p?.matches(f) ? p : p?.querySelector(f) ?? p;
          if (t && !t.matches(f)) t.setAttribute("tabindex", "-1");
          t?.focus({ focusVisible: true });
        }, sel);
        await page.waitForTimeout(80);
        return read();
      },
    };
    for (const [state, act] of Object.entries(states)) {
      tried++;
      await away(); await use(viaHas); const a = await act();
      await away(); const rest = await read();
      await use(sheet); const b = await act();
      await away();
      if (a !== rest) lit++;
      if (a === b) same++; else differ.push(`${state} ${sel}`);
    }
  }
}
await use(sheet);
check("2. pointed at, pressed on and focused in each path's parts and host, every part computes the same style as under :has", tried >= 18 && same === tried, `${same} of ${tried} alike, ${lit} of them lit something${differ.length ? `; differ: ${differ.slice(0, 3).join(" | ")}` : ""}`);

/* 3. Cost per restyled element while scrolling, the board's sheet against none, in the same page. */
const pane = page.locator("[data-studio-pane]").first();
const perElement = async () => {
  await pane.evaluate((el) => { el.scrollTop = 0; });
  await page.mouse.move(700, 450);
  await page.waitForTimeout(800);
  const { events } = await h.trace(async () => { for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 120); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); } });
  const ult = events.filter((e) => e.name === "UpdateLayoutTree" && e.ph === "X");
  return ult.reduce((a, e) => a + e.dur, 0) / Math.max(1, ult.reduce((a, e) => a + (e.args?.elementCount ?? 0), 0));
};
const withSheet = ((await perElement()) + (await perElement())) / 2;
await page.evaluate((s) => { document.querySelector(s).sheet.disabled = true; }, SHEET);
const without = ((await perElement()) + (await perElement())) / 2;
await page.evaluate((s) => { document.querySelector(s).sheet.disabled = false; }, SHEET);
check("3. scrolling, a restyled element costs at most 1.4× what it does with no motion sheet", withSheet <= 1.4 * without, `${withSheet.toFixed(1)} µs against ${without.toFixed(1)} (${(withSheet / without).toFixed(2)}×)`);

/* 4. */
await page.mouse.move(700, 450);
await page.waitForTimeout(200);
const hotOn = await page.evaluate(() => document.querySelector("[data-hot]")?.getAttribute("data-hot") ?? "");
await page.mouse.move(150, 300); // the side panel, off the board
await page.waitForTimeout(200);
const hotOff = await page.evaluate(() => document.querySelector("[data-hot]")?.getAttribute("data-hot") ?? "");
check("4. on a part something is hot; off the board nothing is", hotOn.length > 0 && hotOff === "", `on: "${hotOn.slice(0, 40)}", off: "${hotOff}"`);
check("…and nothing threw", h.errors.length === 0, h.errors[0] ?? "");

await h.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
