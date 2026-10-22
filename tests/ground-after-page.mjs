#!/usr/bin/env node
/**
 * THE BUILDER'S CLOUDS ARE GENERATED AFTER THE BOARD'S FIRST FRAME.
 *
 * The ground's nebula is a third of a second of generation at 4× CPU
 * (`darkMatter.ts#nebulaField`), and it ran before the board's first frame:
 * opening sol face, the parts waited on the sky behind them. Now the clouds
 * are generated in the task after the first frame (`ground.ts#useGround`).
 *
 *   1. when the first part is painted, the cloud layer has not been drawn;
 *   2. within three seconds it has, at the ground's size;
 *   3. no page errors.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/ground-after-page.mjs http://127.0.0.1:3013 [board]   # default solface
 *
 * Covers: src/features/studio/ground.ts
 */
import { chromium } from "playwright-core";
import { readBoard, seedBoard } from "./lib/board.mjs";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const board = readBoard(process.argv[3] ?? "solface");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${URL_BASE}/api/version`, { waitUntil: "load" });
await seedBoard(page, board);
/* At the frame that paints the first part: is any cloud layer drawn yet (given a size)? */
await page.addInitScript(() => {
  window.__g = {};
  const drawn = () => [...document.querySelectorAll("canvas[data-cloud-layer]")].some((c) => c.hasAttribute("width"));
  new MutationObserver(() => {
    if (window.__g.cloudAt == null && drawn()) window.__g.cloudAt = performance.now();
    if (window.__g.partAt == null && document.querySelector("[data-node-id]")) {
      window.__g.partAt = performance.now();
      requestAnimationFrame(() => { window.__g.paintAt = performance.now(); window.__g.cloudAtPaint = drawn(); });
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["width"] });
});
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle", timeout: 120_000 });
for (let i = 0; i < 60 && !(await page.evaluate(() => window.__g.cloudAt != null && window.__g.paintAt != null)); i++) await page.waitForTimeout(100);
const g = await page.evaluate(() => window.__g);
const size = await page.evaluate(() => { const c = document.querySelector("canvas[data-cloud-layer]"); return c ? [c.width, c.height] : null; });

check("when the first part is painted, the clouds are not drawn yet", g.paintAt != null && g.cloudAtPaint === false, `part painted at ${Math.round(g.paintAt ?? -1)} ms, clouds at ${Math.round(g.cloudAt ?? -1)} ms`);
check("the clouds are drawn soon after", g.cloudAt != null && g.cloudAt - (g.paintAt ?? 0) < 3000 && !!size && size[0] > 300 && size[1] > 150, `layer ${size?.join("×")}`);
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
