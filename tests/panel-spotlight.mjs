#!/usr/bin/env node
/**
 * THE PANELS RAIL'S HOVER SPOTLIGHT DIMS EVERYTHING BUT THE PANEL (J, 2026-10-06).
 *
 * J: hovering a panel dimmed only the background; other panels, drawn after
 * it, stayed bright over the dimming. In a real browser, on a small board
 * whose later parts sit above the hovered one:
 *
 *   1. one layer is drawn over the board beside the rail, never over it,
 *      with a hole exactly where the hovered part is;
 *   2. every other part, even one stacked above the hovered part, is under
 *      the dim layer; the hovered part is not;
 *   3. it follows the part when the board scrolls, and goes when let go.
 *
 *   node tests/panel-spotlight.mjs
 *
 * Covers: src/features/studio/states/panelSpotlight.ts, src/features/studio/states/PanelsPage.tsx
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const ts = req("typescript");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
let chromium = null;
for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) { try { ({ chromium } = req(c)); break; } catch { /* next */ } }
if (!chromium) { console.log("  --   no Playwright: not run"); process.exit(0); }
const src = readFileSync(join(here, "..", "src", "features", "studio", "states", "panelSpotlight.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText.replace(/^export /m, "").replace(/Object\.defineProperty\(exports[^;]*;\s*/, "").replace(/exports\.spotlight = spotlight;\s*/, "").replace(/exports\.spotlight = void 0;\s*/, "");
const html = `<!doctype html><body style="margin:0"><div id="host" style="position:relative;width:800px;height:500px;overflow:hidden">
<div data-studio-pane id="pane" style="position:absolute;inset:0;overflow:auto"><div style="position:relative;width:1400px;height:900px">
<div data-node-id="a" style="position:absolute;left:100px;top:100px;width:200px;height:120px;background:#fa0"></div>
<div data-node-id="b" style="position:absolute;left:350px;top:100px;width:200px;height:120px;background:#0af;z-index:50"></div>
</div></div><div data-panels-page style="position:absolute;right:0;top:0;bottom:0;width:200px;z-index:20;background:#222"></div></div>
<script>${js}; window.spotlight = spotlight;</script></body>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.setContent(html);
  await page.evaluate(() => { window.stop = window.spotlight("a"); });
  await page.waitForTimeout(50);
  const read = () => page.evaluate(() => {
    const layer = document.querySelector("[data-panel-spotlight]");
    const hole = layer?.firstElementChild?.getBoundingClientRect();
    const a = document.querySelector('[data-node-id="a"]').getBoundingClientRect();
    const l = layer?.getBoundingClientRect(), rail = document.querySelector("[data-panels-page]").getBoundingClientRect();
    return { besideRail: !!l && Math.round(l.right) === Math.round(rail.left) && l.left === 0, hole: hole && [hole.left, hole.top, hole.width, hole.height].map(Math.round), a: [a.left, a.top, a.width, a.height].map(Math.round) };
  });
  const r = await read();
  check("1. one layer over the board, beside the rail", r.besideRail, JSON.stringify(r));
  check("1. its hole is exactly the hovered part", JSON.stringify(r.hole) === JSON.stringify(r.a), JSON.stringify(r));
  /* 2: the pixel at b's middle is dimmed even though b is stacked above a; a's is not. */
  const px = async (x, y) => { const b = await page.screenshot({ clip: { x, y, width: 1, height: 1 } }); return b; };
  const bare = await (async () => { await page.evaluate(() => window.stop()); const v = [await px(450, 160), await px(200, 160)]; await page.evaluate(() => { window.stop = window.spotlight("a"); }); await page.waitForTimeout(50); return v; })();
  const lit = [await px(450, 160), await px(200, 160)];
  check("2. another part, even stacked above it, is dimmed", !bare[0].equals(lit[0]));
  check("2. the hovered part is not", bare[1].equals(lit[1]));
  await page.evaluate(() => { document.getElementById("pane").scrollTop = 60; });
  await page.waitForTimeout(80);
  const s = await read();
  check("3. follows it when the board scrolls", JSON.stringify(s.hole) === JSON.stringify(s.a) && s.a[1] === r.a[1] - 60, JSON.stringify(s));
  await page.evaluate(() => window.stop());
  check("3. goes when let go", await page.evaluate(() => !document.querySelector("[data-panel-spotlight]")));
} finally { await browser.close(); }
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
