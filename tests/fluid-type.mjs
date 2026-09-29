#!/usr/bin/env node
/**
 * TYPE GROWS WITH THE WINDOW AS THE ORIGINAL'S DOES, AND THE HERO IS AS SHORT
 * AS ITS OWN CONTENT ALLOWS.
 *
 * THE OWNER, trumpmorty.fun beside his copy:
 *   (C1) the site sets its type with the window (the title clamp(58px, 8.6vw,
 *        132px), the buttons, the badge, the headings), so at 2000 its title
 *        is 132px, the hero's column 14px taller, and the CA line 7px lower
 *        than at 1440; the copy kept the px measured at 1440;
 *   (C2) its hero is min-height 100svh and 808px of its own, so in a window
 *        819 tall it is 819 with the ribbons at its foot; the copy held it at
 *        the 900 measured (max(100svh, 900px)), the ribbons below the fold.
 *
 * Sink records both (sink 3c98763: font.fluid, vh.content). Through the real
 * door, exported and served, and in the Preview's window view with its view
 * sized to the same window, each against the live site's own numbers,
 * measured on trumpmorty.fun (2026-09-28) at each window: the type's sizes to
 * 0.1px, the title, the CA line and the red ribbon to 2px, the hero's height
 * to 1px. The board keeps the px it was captured at.
 *
 *   npm run build && npx next start -p 3013
 * `SHOTS=<dir>` keeps a picture of each surface at each window.
 * The ribbon is read by its layout box (its offset), not the box round its turn.
 *
 *   node tests/fluid-type.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3] ?? join(here, "..", "..", "sink");
const SITE = join(SINK, "sites", "trumpmorty-fun");
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`usage: node tests/layer-units.mjs <builder url> <sink checkout>; no ${SITE}/site/document.json`); process.exit(2); }
const SHOTS = process.env.SHOTS ?? null;
const DOC = readFileSync(join(SITE, "site", "document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const pics = existsSync(join(SITE, "assets", "pictures")) ? readdirSync(join(SITE, "assets", "pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);

/* trumpmorty.fun, measured: [window w, h] → the hero's height, tops, and sizes. */
const LIVE = [
  { w: 1440, h: 900, hero: 900, title: 214.7, ca: 677.1, tape: 858, fs: { title: 123.84, pump: 31.68, dex: 30, badge: 50, h2: 100.8 } },
  { w: 2000, h: 1100, hero: 1100, title: 307.4, ca: 784.4, tape: 1058, fs: { title: 132, pump: 32, dex: 30, badge: 50, h2: 104 } },
  { w: 1440, h: 819, hero: 819, title: 174.2, ca: 636.6, tape: 777, fs: { title: 123.84, pump: 31.68, dex: 30, badge: 50, h2: 100.8 } },
];
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((r) => r.text ?? "").join("")).trim();
const byWords = (re) => doc.nodes.find((n) => re.test(words(n)));
const hero = doc.nodes.find((n) => n.vh?.minHeight && n.pageId === "page_home");
/* The hero's own parts, by the rule their words are set in (the footer repeats the title's words). */
const inHero = (n) => (n.from?.selector ?? "").startsWith("body > main > section:nth-of-type(1)");
const byRule = (rule) => doc.nodes.find((n) => inHero(n) && n.font?.fluid === rule)?.id;
const PARTS = {
  title: byRule("clamp(58px, 8.6vw, 132px)"), pump: byRule("clamp(22px, 2.2vw, 32px)"), dex: byRule("clamp(22px, 2.2vw, 30px)"), badge: byRule("clamp(30px, 3.6vw, 50px)"),
  h2: doc.nodes.find((n) => n.font?.fluid === "clamp(48px, 7vw, 104px)")?.id,
  ca: doc.nodes.find((n) => inHero(n) && /> button$/.test(n.from.selector))?.id,
  tape: doc.nodes.find((n) => n.colour?.bg === "rgb(210, 60, 52)" && /^body > main > div > div:nth-of-type\(\d\)$/.test(n.from?.selector ?? ""))?.id,
  hero: hero?.id,
};
check("sink's document carries the fluid type and the hero's own height", !!hero?.vh?.content && Object.values(PARTS).every(Boolean) && !!doc.nodes.find((n) => n.id === PARTS.title)?.font?.fluid, J(PARTS));

/** Read a surface: each part's top and height, and the size its words are drawn at. `attr` names a part's element. */
const read = (p, attr, dy = 0) => p.evaluate(({ PARTS, attr, dy }) => {
  const el = (id) => (attr === "id" ? document.getElementById(id) : document.querySelector(`[${attr}="${id}"]`));
  const page = attr === "id" ? document.body : document.querySelector(attr === "data-node-id" ? "[data-frame]" : "[data-live-page]");
  const top0 = page.getBoundingClientRect().top;
  const out = { box: {}, fs: {} };
  for (const [k, id] of Object.entries(PARTS)) {
    const e = el(id); if (!e) continue;
    const q = e.getBoundingClientRect();
    out.box[k] = { y: +(q.top - top0 + dy).toFixed(1), h: +q.height.toFixed(1) };
    const lit = [e, ...e.querySelectorAll("*")].filter((x) => [...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).map((x) => parseFloat(getComputedStyle(x).fontSize));
    if (lit.length) out.fs[k] = Math.max(...lit);
  }
  return out;
}, { PARTS, attr, dy });
const holds = (label, L, r) => {
  for (const k of ["title", "pump", "dex", "badge", "h2"]) check(`${label}: the ${k === "h2" ? "section heading" : k}'s words are ${L.fs[k]}px, as live`, Math.abs((r.fs[k] ?? 0) - L.fs[k]) <= 0.1, String(r.fs[k]));
  check(`${label}: the hero is ${L.hero} tall, as live`, Math.abs((r.box.hero?.h ?? 0) - L.hero) <= 1, String(r.box.hero?.h));
  for (const k of ["title", "ca", "tape"]) check(`${label}: the ${k === "ca" ? "CA line" : k === "tape" ? "red ribbon" : k} stands at ${L[k]}, within 2px of live`, Math.abs((r.box[k]?.y ?? NaN) - L[k]) <= 2, String(r.box[k]?.y));
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1640, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(REPO.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SITE, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

/* An empty site, a placeholder key, and the repository brought in. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);


let files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
const out = mkdtempSync(join(tmpdir(), "layer-units-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", webp: "image/webp", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let p = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[p.split(".").pop()] ?? "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const SITEURL = `http://127.0.0.1:${server.address().port}/`;

for (const L of LIVE) {
  const ctx = await browser.newContext({ viewport: { width: L.w, height: L.h }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
  await p.goto(SITEURL, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  holds(`export ${L.w} × ${L.h}`, L, await read(p, "id"));
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: join(SHOTS, `export-${L.w}x${L.h}.png`) }); }
  await ctx.close();
}
/* The Preview, its view sized to the same window. */
for (const L of LIVE) {
  await page.setViewportSize({ width: L.w, height: L.h + 200 });
  /* Asked for before the page opens, as the export's context is: asked for after, the first visit ran the loader and held the hero's words 40px low for its intro. */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const bars = await page.evaluate(() => document.querySelector("[data-live-scroller]").getBoundingClientRect().top);
  await page.setViewportSize({ width: L.w, height: Math.round(L.h + bars) });
  await page.waitForTimeout(1500);
  const view = await page.evaluate(() => { const v = document.querySelector("[data-live-scroller]"); return [v.clientWidth, v.clientHeight]; });
  check(`Preview ${L.w} × ${L.h}: its view is the window's size`, view[0] === L.w && view[1] === L.h, J(view));
  holds(`Preview ${L.w} × ${L.h}`, L, await read(page, "data-live-node"));
  if (SHOTS) { const t = await page.evaluate(() => document.querySelector("[data-live-scroller]").getBoundingClientRect().top); await page.screenshot({ path: join(SHOTS, `preview-${L.w}x${L.h}.png`), clip: { x: 0, y: t, width: L.w, height: L.h } }); }
}
/* With motion: the loader and the intro play, and once they end the words stand where live's do. */
{
  const L = LIVE[0];
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: L.w, height: L.h + 200 });
  await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  const bars = await page.evaluate(() => document.querySelector("[data-live-scroller]").getBoundingClientRect().top);
  await page.setViewportSize({ width: L.w, height: Math.round(L.h + bars) });
  const early = await read(page, "data-live-node");
  check(`Preview ${L.w} × ${L.h} with motion: the intro holds the title low while the loader stands`, (early.box.title?.y ?? 0) > L.title + 10, String(early.box.title?.y));
  await page.waitForFunction(() => !document.querySelector("[data-crt]"), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const r = await read(page, "data-live-node");
  for (const k of ["title", "ca"]) check(`Preview ${L.w} × ${L.h} with motion, the intro over: the ${k === "ca" ? "CA line" : k} stands at ${L[k]}, within 2px of live`, Math.abs((r.box[k]?.y ?? NaN) - L[k]) <= 2, String(r.box[k]?.y));
  await page.emulateMedia({ reducedMotion: "reduce" });
}
/* The board keeps the px it was captured at. */
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.evaluate(() => { const z = document.querySelector("[data-board-zoom]"); if (z) z.style.zoom = "1"; });
const b = await read(page, "data-node-id");
check("board: the title keeps its captured 123.84px", Math.abs((b.fs.title ?? 0) - 123.84) <= 0.1, String(b.fs.title));
server.close();
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
