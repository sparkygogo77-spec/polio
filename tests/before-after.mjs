#!/usr/bin/env node
/**
 * THE BEFORE / AFTER SLIDER REVEALS, IT DOES NOT STRETCH.
 *
 * J (2026-10-10): "the sliding bar also isnt a proper before and after its
 * more of a picture on the left that i can resize ... it would be hidden
 * until i reveal with the slider". Both pictures now sit at full size in the
 * same place and the handle only clips the before. Three places:
 *
 *   · the part itself (board and Preview): the before layer covers the whole
 *     box and is cut by `clip-path`, never by its width;
 *   · Publish: the exported markup is driven by the `compare` feature the
 *     part now carries, and a drag moves the cut, not the picture;
 *   · the kit's vendor/builder-motion.js: a hook named `compare` stacks its
 *     two pictures and splits them the same way.
 *
 *   node tests/before-after.mjs
 *
 * Covers: src/features/studio/shelf/parts/Media.tsx, src/features/studio/shelf/library/behaviourScripts/interactions.ts, src/features/studio/shelf/library/works.ts, src/features/studio/send-out/kitMotion.ts, scripts/kit-motion.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { BeforeAfter } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "Media.tsx"));
const { themeFrom } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));
const W = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "library", "works.ts"));
const { KIT_EFFECTS } = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const t = themeFrom({ "palette.mode": "light" });
const html = renderToStaticMarkup(React.createElement(BeforeAfter, { id: "before-after", content: "", theme: t, mode: "live" }));
const tag = (attr) => (html.match(new RegExp(`<div ${attr}=""[^>]*>`)) ?? [""])[0];
const before = tag("data-compare-before"), after = tag("data-compare-after");
check("The part draws the after and the before as two layers", !!before && !!after, html.slice(0, 200));
check("…the before covers the whole box and is cut by clip-path at the line", /inset:0/.test(before) && /clip-path:inset\(0 50% 0 0\)/.test(before), before);
check("…and its width never follows the handle (the stretching)", !/width:\s*\d+%/.test(before), before);
check("…both are the same scene, so the line only reveals", (before.match(/url\([^)]*\)/) ?? [""])[0] === (after.match(/url\([^)]*\)/) ?? ["x"])[0]);
check("Published, the slider carries the compare feature", W.pageFeatures([{ id: "n1", featureId: "before-after" }]).bindings.some((b) => b.feature === "compare"));
check("The kit's motion file names compare", KIT_EFFECTS.includes("compare") && readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8").includes('"compare"'));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const esc = (s) => s.replace(/<\/script/g, "<\\/script");
const drag = async (p, sel, from, to) => {
  const r = await p.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, sel);
  await p.mouse.move(r.x + r.w * from, r.y + r.h / 2);
  await p.mouse.down();
  await p.mouse.move(r.x + r.w * ((from + to) / 2), r.y + r.h / 2, { steps: 4 });
  await p.mouse.move(r.x + r.w * to, r.y + r.h / 2, { steps: 4 });
  await p.mouse.up();
};
try {
  /* Publish: the exported markup, the runtime and the feature's script, as the page loads them. */
  const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const binding = JSON.stringify([{ part: "n1", feature: "compare", inputs: {} }]);
  await p.setContent(`<!doctype html><html><body style="margin:0"><div id="n1" style="position:relative;width:600px;height:300px;margin:40px">${html}</div>
  <script id="site-features" type="application/json">${binding}</script>
  <script>${esc(W.RUNTIME_JS)}</script><script>${esc(W.scriptFile("compare"))}</script></body></html>`);
  await p.waitForTimeout(100);
  const sizes = () => p.evaluate(() => { const b = document.querySelector("[data-compare-before]"), a = document.querySelector("[data-compare-after]"), l = document.querySelector("[data-compare-line]"); return { bw: b.getBoundingClientRect().width, aw: a.getBoundingClientRect().width, bl: b.getBoundingClientRect().left, clip: b.style.clipPath, line: l.style.left }; });
  const s0 = await sizes();
  await drag(p, "[data-compare]", 0.5, 0.2);
  const s1 = await sizes();
  check("Published, a drag moves the cut to the pointer", /inset\(0(px)? 8\d(\.\d+)?% 0(px)? 0(px)?\)/.test(s1.clip) && /^2\d(\.\d+)?%$/.test(s1.line), JSON.stringify(s1));
  check("…and the before picture keeps its full size and place", s1.bw === s0.bw && s1.bw === s1.aw && s1.bl === s0.bl, JSON.stringify({ s0, s1 }));
  await p.focus("[data-compare]");
  await p.keyboard.press("ArrowRight");
  const s2 = await sizes();
  check("…arrow keys move the line too", /^2\d(\.\d+)?%$/.test(s2.line) && parseFloat(s2.line) > parseFloat(s1.line), s2.line);
  /* Preview: the part drives its own box; the script must leave a box the part owns alone. */
  const q = await browser.newPage();
  await q.setContent(`<!doctype html><html><body><div id="n1" style="position:relative;width:600px;height:300px">${html}</div></body></html>`);
  const owned = await q.evaluate(`(() => { const box = document.querySelector("[data-compare]"); box.__compareOwned = true; var siteFeatures = { define: (id, fn) => fn(document.getElementById("n1"), {}) }; new Function("siteFeatures", ${JSON.stringify(W.getWork("compare").script)})(siteFeatures); return box.hasAttribute("aria-valuenow") && !box.__compare; })()`);
  check("In the Preview, the script leaves the part's own slider to it", owned === true);
  /* The kit file: a hook named compare, its two pictures. */
  const k = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const js = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
  const svg = (c) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="${c}"/></svg>`)}`;
  await k.setContent(`<!doctype html><html><head><style>
    [data-hook="cmp"] { --builder-motion: "compare"; width: 500px; height: 250px; margin: 40px; }
  </style></head><body data-hook="page"><div data-hook="cmp"><img data-hook="cmp-after" data-compare-after src="${svg("green")}"><img data-hook="cmp-before" data-compare-before src="${svg("gray")}"></div>
  <script>${esc(js)}</script></body></html>`);
  await k.waitForTimeout(150);
  const kz = () => k.evaluate(() => { const b = document.querySelector('[data-hook="cmp-before"]'), a = document.querySelector('[data-hook="cmp-after"]'); const rb = b.getBoundingClientRect(), ra = a.getBoundingClientRect(); return { b: [rb.left, rb.top, rb.width, rb.height], a: [ra.left, ra.top, ra.width, ra.height], clip: b.style.clipPath }; });
  const k0 = await kz();
  check("Kit file: the two pictures are stacked at full size in the same place", JSON.stringify(k0.b) === JSON.stringify(k0.a) && k0.b[2] === 500 && /inset\(0(px)? 50% 0(px)? 0(px)?\)/.test(k0.clip), JSON.stringify(k0));
  await drag(k, '[data-hook="cmp"]', 0.5, 0.8);
  const k1 = await kz();
  check("…a drag reveals more of the before without moving or stretching it", /inset\(0(px)? 2\d(\.\d+)?% 0(px)? 0(px)?\)/.test(k1.clip) && JSON.stringify(k1.b) === JSON.stringify(k0.b), JSON.stringify(k1));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
