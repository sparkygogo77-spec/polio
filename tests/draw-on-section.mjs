#!/usr/bin/env node
/**
 * A DRAWING ON A PART THAT HOLDS A SECTION IS MADE OVER IT: THE HERO STAYS THE
 * WINDOW'S WIDTH.
 *
 * THE OWNER'S REPORT, trump-morty-trorty.vercel.app after Update live site
 * (2026-09-28, 18:24 PT): at 1944 wide the hero no longer spanned the window:
 * a 1339 × 1278 box at x 0, the planet cut, everything right of 1340 the
 * page's dark navy; the header and ribbons still full width. His published
 * documents say what happened between 13:02 (hero 1440 × 901, a box) and
 * 18:24 (hero 1339 × 969, `cube-3d`, a sketch on it): a cube was drawn on the
 * hero, and the drawing reshaped the hero itself — its own area at the
 * drawing's proportion — and turned it into the cube. No export changed; the
 * export drew the 1339-wide part it was given.
 *
 * Held here through the same queue the draw board uses (no model key, as on
 * a machine without one): sink's trumpmorty.fun on the board, a box drawn on
 * the hero and Make real. Then:
 *   · the hero keeps its size and its kind, and the drawing is a new part;
 *   · exported and opened at 1440, 2000 and 2560 wide, the hero is the
 *     window's width, its own fill shows at the window's right edge (not the
 *     page's), and its sky and deserts reach the edge;
 *   · and the fluid type still stands where trumpmorty.fun has it at 1440 and
 *     2000 (the title and the CA line within 2px, as tests/fluid-type.mjs).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/draw-on-section.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3] ?? "capture/versions/sink-0ee06fa";
const DOCFILE = join(SINK, "sites", "trumpmorty-fun", "site", "document.json");
if (!existsSync(DOCFILE)) { console.error(`usage: node tests/draw-on-section.mjs <builder url> <capture folder>; no ${DOCFILE}`); process.exit(2); }
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);

const doc = JSON.parse(readFileSync(DOCFILE, "utf8"));
/* The hero: the part that keeps the window's height, or on a capture that has none, the page's first section. */
const hero = doc.nodes.find((n) => n.vh?.minHeight && n.pageId === "page_home")
  ?? doc.nodes.find((n) => n.pageId === "page_home" && /> section(:nth-of-type\(1\))?$/.test(n.from?.selector ?? "") && n.y <= 1);
const inHero = (n) => (n.from?.selector ?? "").startsWith(`${hero.from.selector} > `);
const layers = doc.nodes.filter((n) => n.units?.of?.part === hero?.id && n.units.left && n.units.right);
const TITLE = doc.nodes.find((n) => inHero(n) && n.font?.fluid === "clamp(58px, 8.6vw, 132px)")?.id;
const CA = doc.nodes.find((n) => inHero(n) && /> button$/.test(n.from.selector))?.id;
/* trumpmorty.fun, measured (tests/fluid-type.mjs). */
const LIVE = { 1440: { title: 214.7, ca: 677.1 }, 2000: { title: 307.4, ca: 784.4 } };
/* Sink's captures differ by branch: the checks on parts this capture does not have are skipped and said so, never failed on its account. */
check("sink's document has the hero", !!hero, J({ hero: hero?.id }));
const skipped = (what) => console.log(`  skip  ${what} — not in this capture of trumpmorty.fun`);
if (layers.length < 3) skipped("its full-width layers");
if (!TITLE) skipped("the title's fluid type");

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
/* No model anywhere: the drawing is decided on the board, as on a machine without a key. */
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: J({ set: {}, repo: null, branch: "main" }) }));
for (const route of ["**/api/studio/body", "**/api/studio/reshape", "**/api/studio/image"]) {
  await page.route(route, (r) => r.fulfill({ status: 200, contentType: "application/json", body: J({ ok: false, reason: "no-key", message: "no key" }) }));
}
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(2500);
const nodeOf = (id) => page.evaluate((id) => { const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {}; const n = (s.nodes ?? []).find((x) => x.id === id); return n ? { featureId: n.featureId, x: n.x, y: n.y, w: n.w, h: n.h } : null; }, id);
const before = await nodeOf(hero.id);
const count0 = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).length);

/* A box drawn on the hero, and Make real. */
const jobId = await page.evaluate(({ id }) => window.__studioDraw({ nodeId: id, at: null, frameWidth: 1440, sketch: { strokes: [[[0.1, 0.1], [0.9, 0.1], [0.9, 0.85], [0.1, 0.85], [0.1, 0.1]]], words: "a 3d cube" }, picture: null, want: null, label: "Reshaping the hero" }), { id: hero.id });
let job = null;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(400);
  job = await page.evaluate((jid) => (window.__studioQueue?.() ?? []).find((j) => j.id === jid) ?? null, jobId);
  if (job && !["queued", "running"].includes(job.status)) break;
}
/* A question, if one is asked, answered with its first choice. */
if (job?.status === "asking") {
  await page.locator("[data-queue-question] button").first().click({ force: true }).catch(() => {});
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(400); job = await page.evaluate((jid) => (window.__studioQueue?.() ?? []).find((j) => j.id === jid) ?? null, jobId); if (job && !["queued", "running", "asking"].includes(job.status)) break; }
}
const after = await nodeOf(hero.id);
const count1 = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).length);
check("the drawing went through the queue", !!job && job.status === "done", J(job));
check("the hero keeps its size and its kind", J(after) === J(before), `${J(before)} → ${J(after)}`);
check("…and the drawing is a new part over it", count1 === count0 + 1 && !!job?.madeId && job.madeId !== hero.id, `${count0} → ${count1}, made ${job?.madeId}`);

/* The export, served. */
const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
const out = mkdtempSync(join(tmpdir(), "draw-on-section-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", webp: "image/webp", png: "image/png", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let f = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[f.split(".").pop()] ?? "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const SITE = `http://127.0.0.1:${server.address().port}/`;
const fill = hero.colour?.bg ?? null;

for (const [W, H] of [[1440, 900], [2000, 1100], [2560, 1400]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: "reduce", deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
  await p.goto(SITE, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(({ hero, layers, TITLE, CA }) => {
    const box = (id) => { const e = document.getElementById(id); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left, r: q.right, y: q.top + scrollY, w: q.width, h: q.height }; };
    return { hero: box(hero), layers: layers.map((id) => [id, box(id)]), title: box(TITLE), ca: box(CA) };
  }, { hero: hero.id, layers: layers.map((n) => n.id), TITLE, CA });
  /* Its own fill at the window's right edge, halfway down the first screen: with no picture served, the layers draw nothing and the hero's fill is what shows. */
  const png = (await p.screenshot({ clip: { x: W - 6, y: Math.round(H * 0.3), width: 4, height: 4 } })).toString("base64");
  const edge = await p.evaluate(async (src) => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return [...g.getImageData(1, 1, 1, 1).data.slice(0, 3)]; }, `data:image/png;base64,${png}`);
  const L = `${W} × ${H}`;
  check(`${L}: the hero is the window's width`, !!r.hero && Math.abs(r.hero.x) <= 1 && Math.abs(r.hero.w - W) <= 1, J(r.hero));
  check(`${L}: its fill shows at the window's right edge`, !!fill && `rgb(${edge.join(", ")})` === fill, `rgb(${edge.join(", ")}) against the hero's ${fill}`);
  if (layers.length >= 3) check(`${L}: its sky and deserts reach the window's right edge`, r.layers.every(([, b]) => b && b.r >= W - 1), J(r.layers.map(([id, b]) => [id, b && Math.round(b.r)])));
  /* The fluid type is only held on the capture it was measured against (the one whose title is fluid). */
  if (LIVE[W] && TITLE && CA) {
    check(`${L}: the title stands at ${LIVE[W].title}, within 2px of live`, Math.abs((r.title?.y ?? NaN) - LIVE[W].title) <= 2, String(r.title?.y));
    check(`${L}: the CA line stands at ${LIVE[W].ca}, within 2px of live`, Math.abs((r.ca?.y ?? NaN) - LIVE[W].ca) <= 2, String(r.ca?.y));
  }
  await ctx.close();
}
server.close();
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
