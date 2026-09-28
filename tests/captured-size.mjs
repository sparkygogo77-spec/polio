#!/usr/bin/env node
/**
 * A CAPTURED PART DRAWS AT THE SIZE IT WAS MEASURED; A HAND-BUILT ONE IS
 * STILL HELD TO ITS RANGE (sink fidelity #7).
 *
 * `NodeFont.size` is a multiplier on the site's base, and `applyFont` held
 * it to 0.6..2 — right for the Font control a person drags, wrong for a
 * size read off a page: trumpmorty.fun's "TRUMP & MORTY" is 124px, 4.84 ×
 * the base × the heading's 1.6, and drew at 51. So a captured part (it has
 * `from.selector`, as `applyCaptured` reads it) takes its size, and its
 * leading, as measured; a part built here is clamped exactly as before.
 *
 * A stand-in document holds the same heading twice, 4.84 × base, once
 * captured and once built by hand; each is read on the board, the preview
 * and the export served on its own.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/captured-size.mjs http://127.0.0.1:3013
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const at = Date.parse("2026-09-27T00:00:00Z");
const node = (id, over) => ({
  id, pageId: "page_home", featureId: "value-prop", label: "TRUMP", prompt: "", content: "TRUMP", data: "", x: 40, y: 40, w: 700, h: 220,
  groupId: null, options: { turn: "none" }, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null, cube: null,
  mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...over,
});
const SIZE = 4.84, LEAD = 0.86;
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("n_valueprop_1", { font: { size: SIZE, leading: LEAD }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > h1", at } }),
    node("n_valueprop_2", { y: 400, font: { size: SIZE, leading: LEAD } }),
    /* A folded title too narrow for its two words on one line: it breaks between them, never inside one. */
    node("n_valueprop_3", { y: 700, w: 420, h: 220, font: { size: SIZE, leading: LEAD }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > h2", at },
      content: [..."TRUMP"].map((c, i) => ({ text: c, transform: `matrix(1, 0, 0, 1, 0, -${i + 1})` })).concat([{ text: " " }], [..."MORTY"].map((c, i) => ({ text: c, transform: `matrix(1, 0, 0, 1, 0, -${i + 1})` }))) }),
  ],
  groups: [], shapes: [],
  format: { "palette.mode": "light", "layout.radius": 0, "type.baseSize": 16 },
  brief: { name: "Sizes", gimmick: "", master: "" },
  look: { palette: { bg: "rgb(255, 255, 255)", text: "rgb(0, 0, 0)" }, texture: [], target: "page" },
  motion: [], activePageId: "page_home", hiddenFeatures: [], frameWidth: 1200, companion: null,
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Sizes", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(2000);

/* The heading's words: value-prop draws them in its one <p>. */
const size = (p, tpl, id) => p.evaluate((sel) => { const el = document.querySelector(sel)?.querySelector("p"); return el ? { fs: parseFloat(getComputedStyle(el).fontSize), lh: parseFloat(getComputedStyle(el).lineHeight) } : null; }, tpl.replace("ID", id));
const want = 16 * SIZE * 1.6; /* base × the node's own size × value-prop's 1.6 */
const held = 16 * 2 * 1.6;    /* the hand-built part's ceiling, as before */
async function sizes(p, where, tpl) {
  const cap = await size(p, tpl, "n_valueprop_1"), hand = await size(p, tpl, "n_valueprop_2");
  check(`${where}: the captured heading draws at its measured ${want.toFixed(1)}px`, !!cap && Math.abs(cap.fs - want) < 0.6, JSON.stringify(cap));
  check(`${where}: …with its measured leading (${LEAD})`, !!cap && Math.abs(cap.lh / cap.fs - LEAD) < 0.01, JSON.stringify(cap));
  const lines = await p.evaluate((sel) => { const el = document.querySelector(sel); return el ? [...el.querySelectorAll("p span")].filter((x) => x.textContent.length === 1 && x.textContent.trim()).map((x) => [x.textContent, Math.round(x.offsetTop)]) : []; }, tpl.replace("ID", "n_valueprop_3"));
  const tops = (w) => new Set(lines.slice(w === 0 ? 0 : 5, w === 0 ? 5 : 10).map((l) => l[1]));
  check(`${where}: a folded title wraps between its words, never inside one`, lines.length === 10 && tops(0).size === 1 && tops(1).size === 1 && [...tops(0)][0] < [...tops(1)][0], JSON.stringify(lines));
  check(`${where}: the same heading built by hand is still held to 2× (${held.toFixed(1)}px), at the part's own leading (1.2)`, !!hand && Math.abs(hand.fs - held) < 0.6 && Math.abs(hand.lh / hand.fs - 1.2) < 0.01, JSON.stringify(hand));
}
await sizes(page, "board", '[data-node-id="ID"]');
await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await sizes(page, "preview", '[data-live-node="ID"]');

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const out = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : null })));
const files = new Map(out.filter((f) => f.content !== null).map((f) => [f.path, f.content]));
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname.replace(/^\//, "") || "index.html";
  const f = files.get(path);
  if (f === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/html" });
  res.end(f);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const site = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
await site.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "load" });
await site.waitForTimeout(800);
await sizes(site, "export", "#ID");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
