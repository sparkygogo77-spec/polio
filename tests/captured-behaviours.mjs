#!/usr/bin/env node
/**
 * TRUMPMORTY.FUN'S SCRIPT-DRIVEN LIFE, BROUGHT IN, SHOWN, SWITCHABLE, PLAYED.
 *
 * The owner published trumpmorty.fun through the Builder and it came out
 * still. sink now records what the page's scripts do (`doc.behaviours`), and
 * taking the document in attaches the feature that does each
 * (`library/captured.ts`, held without a browser by tests/behaviours-attach.mjs).
 * Held here, through the real door (the repository brought in, GitHub stood
 * in for as tests/export-page.mjs does):
 *
 *   · the board stays still: no loader, no marquee running, no layer moving;
 *   · the Element panel's Working block lists what a part carries, each with
 *     a switch; switched off it stays, with its settings, and the export
 *     leaves it out;
 *   · the Preview plays them: the ribbons run, the landscape follows the
 *     pointer;
 *   · the export plays them: the CRT loader ("CH 47", "TUNING n%") stands and
 *     goes, the red ribbon runs left and the navy right, the layers follow
 *     the pointer, the header takes its yellow bar and black edge once
 *     scrolled, a section waits hidden and comes in, the LIVE dot blinks;
 *   · and for a visitor who asked for less motion: no loader, nothing
 *     moving, every section simply there, the dot lit.
 *
 * Writes a strip of the exported hero (the marquee and the parallax, frame
 * by frame) to docs/shots/captured-behaviours-strip.png.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/captured-behaviours.mjs http://127.0.0.1:3013 <path to a sink checkout>
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
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`usage: node tests/captured-behaviours.mjs <builder url> <sink checkout>; no ${SITE}/site/document.json`); process.exit(2); }
const DOC = readFileSync(join(SITE, "site", "document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const B = doc.behaviours ?? {};
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = async () => {
  await browser.close().catch(() => {});
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

const RED = B.loops?.find((l) => l.direction === "left")?.part, NAVY = B.loops?.find((l) => l.direction === "right")?.part;
const LAYER = B.pointer?.filter((p) => p.kind === "move").sort((a, b) => Math.abs(b.perX) - Math.abs(a.perX))[0]?.part;
const HEADER = B.scrollClass?.[0]?.part;
const DOT = B.idle?.find((i) => i.name === "blink" && i.part && !i.folded)?.part;
const LATE = B.reveal?.filter((r) => r.part && !r.folded).sort((a, b) => b.top - a.top)[0]?.part;
check("sink's document carries the behaviours this holds", !!(RED && NAVY && LAYER && HEADER && DOT && LATE && B.loader), J({ RED, NAVY, LAYER, HEADER, DOT, LATE }));

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

let s = await state();
const node = (id) => (s.nodes ?? []).find((n) => n.id === id);
const carries = (id, w) => { const u = node(id)?.work; return !!u && [u, ...(u.also ?? [])].some((x) => x.id === w && !x.off); };
check("brought in: the ribbons carry Marquee loop, a layer Follow the pointer, the header its bar, the dot Blink, a section Reveal", carries(RED, "marquee") && carries(NAVY, "marquee") && carries(LAYER, "follow-pointer") && carries(HEADER, "scroll-header") && carries(DOT, "blink") && carries(LATE, "reveal"), J([RED, NAVY, LAYER, HEADER, DOT, LATE].map((id) => [id, node(id)?.work?.id])));
check("…and one part the CRT loader", (s.nodes ?? []).filter((n) => carries(n.id, "crt-loader")).length === 1);

/* ------------------------------------------------------------ the board */
await page.waitForTimeout(1500);
const boardAt = () => page.evaluate((ids) => ids.map((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); return el ? [...el.querySelectorAll("*")].concat(el).map((x) => `${getComputedStyle(x).translate}|${getComputedStyle(x).transform}`).join(";").length + ":" + [...el.querySelectorAll("*")].concat(el).map((x) => getComputedStyle(x).translate + getComputedStyle(x).transform).join(";") : null; }), [RED, LAYER]);
const b1 = await boardAt();
await page.mouse.move(300, 300); await page.waitForTimeout(400); await page.mouse.move(1200, 800); await page.waitForTimeout(900);
const b2 = await boardAt();
check("the board stays still: no loader over it", await page.evaluate(() => !document.querySelector("[data-crt]")));
check("…the ribbon's words and the layer do not move, whatever the pointer does", b1.every(Boolean) && J(b1) === J(b2), `${J(b1).slice(0, 120)} → ${J(b2).slice(0, 120)}`);

/* ------------------------------------------------------------ the Element panel */
const TICKER = (s.nodes ?? []).find((n) => n.featureId === "prose" && n.content === "$TRORTY" && carries(n.id, "reveal"))?.id;
/* Pressed on the part itself: the board may have it under the fold, and a press on its box lands on it whatever sits over it. */
const part = page.locator(`[data-node-id="${TICKER}"]`).first();
for (const type of ["pointerdown", "pointerup"]) await part.dispatchEvent(type, { button: 0, buttons: type === "pointerdown" ? 1 : 0, isPrimary: true, pointerId: 1, bubbles: true }).catch(() => {});
await part.dispatchEvent("click", { button: 0, bubbles: true }).catch(() => {});
await page.evaluate(() => window.__studioSetLeftPanel?.("inspector"));
await page.waitForTimeout(700);
if (process.env.DEBUG_SHOT) { await page.screenshot({ path: process.env.DEBUG_SHOT }); console.log(await page.evaluate(() => [...document.querySelectorAll("[data-work-fields]")].map((e) => e.getAttribute("data-work-fields")))); }
const field = page.locator(`[data-work-fields="${TICKER}"] [data-work-field="reveal"]`);
check("the Element panel's Working block shows the part's Reveal on scroll, switched on", (await field.count()) === 1 && (await field.getAttribute("data-work-on")) === "on", `${TICKER} ${await field.count()}`);
await page.locator(`[data-work-fields="${TICKER}"] [data-work-switch="reveal"]`).click().catch(() => {});
await page.waitForTimeout(600);
s = await state();
const off = [node(TICKER)?.work, ...(node(TICKER)?.work?.also ?? [])].find((u) => u?.id === "reveal");
check("…switched off, it stays on the part with its settings, marked off", off?.off === true && Number(off?.inputs?.distance) === 40, J(off));
let files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
const listed = (fs, id) => { const html = (fs ?? []).find((f) => f.path === "index.html")?.content ?? ""; const m = /<script id="site-features" type="application\/json">([\s\S]*?)<\/script>/.exec(html); return m ? JSON.parse(m[1]).filter((b) => b.part === id).map((b) => b.feature) : []; };
check("…and the export leaves it out", !listed(files, TICKER).includes("reveal"), J(listed(files, TICKER)));
await page.locator(`[data-work-fields="${TICKER}"] [data-work-switch="reveal"]`).click().catch(() => {});
await page.waitForTimeout(600);
files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
check("…switched on again, the export has it", listed(files, TICKER).includes("reveal"), J(listed(files, TICKER)));
await page.keyboard.press("Escape");

/* ------------------------------------------------------------ the Preview */
await page.goto(`${BASE}/builder/preview`, { waitUntil: "domcontentloaded" });
let loaderInPreview = "";
for (let i = 0; i < 40 && !loaderInPreview; i++) { await page.waitForTimeout(150); loaderInPreview = await page.evaluate(() => document.querySelector("[data-crt]")?.textContent ?? ""); }
check("Preview: the CRT loader stands first", /CH 47/.test(loaderInPreview) && /TUNING/.test(loaderInPreview), loaderInPreview.slice(0, 80));
for (let i = 0; i < 40 && (await page.evaluate(() => !!document.querySelector("[data-crt]"))); i++) await page.waitForTimeout(250);
const trackX = (id) => page.evaluate((id) => { const el = document.querySelector(`[data-live-node="${id}"] [data-marquee] > div, [data-live-node="${id}"][data-marquee] > div`); return el ? new DOMMatrix(getComputedStyle(el).transform).m41 : null; }, id);
const r1 = await trackX(RED), n1 = await trackX(NAVY);
await page.waitForTimeout(600);
const r2 = await trackX(RED), n2 = await trackX(NAVY);
check("Preview: the red ribbon runs left, the navy right", r1 !== null && n1 !== null && r2 < r1 && n2 > n1, J({ r1, r2, n1, n2 }));
const layerT = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).translate : null; }, sel);
await page.mouse.move(200, 200); await page.waitForTimeout(1500);
const p1 = await layerT(`[data-live-node="${LAYER}"]`);
await page.mouse.move(1400, 800); await page.waitForTimeout(1500);
const p2 = await layerT(`[data-live-node="${LAYER}"]`);
check("Preview: the landscape layer follows the pointer", p1 !== null && p1 !== p2, `${p1} → ${p2}`);

/* ------------------------------------------------------------ the export, served */
const out = mkdtempSync(join(tmpdir(), "captured-behaviours-"));
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

const open = async (reducedMotion) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
  await p.goto(SITEURL, { waitUntil: "domcontentloaded" });
  return { ctx, p, errs };
};
const css = (p, id, k) => p.evaluate(([id, k]) => { const el = document.getElementById(id); return el ? getComputedStyle(el)[k] : null; }, [id, k]);
const track = (p, id) => p.evaluate((id) => { const el = document.querySelector(`#${id}[data-marquee] > div`); return el ? new DOMMatrix(getComputedStyle(el).transform).m41 : null; }, id);

{
  const { ctx, p, errs } = await open("no-preference");
  await p.waitForTimeout(600);
  const words = await p.evaluate(() => document.querySelector("[data-crt]")?.textContent ?? "");
  check("export: the CRT loader stands over the page as it opens, CH 47 and TUNING n%", /CH 47/.test(words) && /TUNING \d+%/.test(words) && /TRUMP & MORTY/.test(words), words.slice(0, 100));
  await p.screenshot({ path: join(out, "f-loader.png") });
  for (let i = 0; i < 40 && (await p.evaluate(() => !!document.querySelector("[data-crt]"))); i++) await p.waitForTimeout(250);
  check("…and switches off and goes", await p.evaluate(() => !document.querySelector("[data-crt]")));
  const a1 = await track(p, RED), c1 = await track(p, NAVY);
  await p.waitForTimeout(700);
  const a2 = await track(p, RED), c2 = await track(p, NAVY);
  check("export: the red ribbon runs left and the navy one right", a1 !== null && c1 !== null && a2 < a1 && c2 > c1, J({ a1, a2, c1, c2 }));
  check("…at about 36 px a second", Math.abs((a1 - a2) / 0.7 - 36) < 12, `${((a1 - a2) / 0.7).toFixed(1)} px/s`);
  /* The strip: the pointer swept across while the ribbons run. */
  const frames = [];
  for (let i = 0; i < 4; i++) {
    await p.mouse.move(150 + i * 380, 150 + i * 200, { steps: 6 });
    await p.waitForTimeout(900);
    frames.push(await p.screenshot({ clip: { x: 0, y: 420, width: 1440, height: 580 } }));
    if (i === 0) var t1 = await css(p, LAYER, "translate");
    if (i === 3) var t2 = await css(p, LAYER, "translate");
  }
  check("export: the landscape layer follows the pointer", t1 && t1 !== t2, `${t1} → ${t2}`);
  const late1 = Number(await css(p, LATE, "opacity"));
  check("export: a section further down waits, hidden", late1 === 0, String(late1));
  const dots = new Set();
  for (let i = 0; i < 10; i++) { dots.add(Number(await css(p, DOT, "opacity"))); await p.waitForTimeout(120); }
  check("export: the LIVE dot blinks", dots.has(0) && dots.has(1), [...dots].join(","));
  check("export: the header has no bar at the top", (await css(p, HEADER, "backgroundColor")) === "rgba(0, 0, 0, 0)", await css(p, HEADER, "backgroundColor"));
  await p.evaluate(() => window.scrollTo(0, 120));
  await p.waitForTimeout(600);
  check("…and once scrolled, the yellow bar with the black bottom edge", (await css(p, HEADER, "backgroundColor")) === "rgb(243, 212, 64)" && /rgb\(26, 15, 11\) 0px 4px 0px/.test(await css(p, HEADER, "boxShadow")), `${await css(p, HEADER, "backgroundColor")} ${await css(p, HEADER, "boxShadow")}`);
  await p.screenshot({ path: join(out, "f-scrolled.png") });
  await p.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "center" }), LATE);
  await p.waitForTimeout(1600);
  check("…and the section comes in when scrolled to", Number(await css(p, LATE, "opacity")) === 1, await css(p, LATE, "opacity"));
  check("export: no script error", errs.length === 0, errs.join(" | "));
  await ctx.close();
  /* The strip, one frame under the other. */
  const strip = await browser.newPage({ viewport: { width: 1440, height: 580 * frames.length } });
  await strip.setContent(`<body style="margin:0;background:#000">${frames.map((f) => `<img style="display:block;width:1440px" src="data:image/png;base64,${f.toString("base64")}">`).join("")}</body>`);
  const shots = join(here, "..", "docs", "shots");
  mkdirSync(shots, { recursive: true });
  await strip.screenshot({ path: join(shots, "captured-behaviours-strip.png"), fullPage: true, type: "png" });
  await strip.close();
}

{
  const { ctx, p, errs } = await open("reduce");
  await p.waitForTimeout(800);
  check("less motion: no loader", await p.evaluate(() => !document.querySelector("[data-crt]")));
  check("…the ribbons hold still", (await track(p, RED)) === null);
  const lit = new Set();
  for (let i = 0; i < 8; i++) { lit.add(Number(await css(p, DOT, "opacity"))); await p.waitForTimeout(120); }
  check("…the dot stays lit", lit.size === 1 && lit.has(1), [...lit].join(","));
  check("…every section simply there", Number(await css(p, LATE, "opacity")) === 1);
  await p.mouse.move(200, 200); await p.waitForTimeout(300); await p.mouse.move(1300, 800); await p.waitForTimeout(500);
  check("…the landscape does not follow the pointer", ["none", "0px"].includes(await css(p, LAYER, "translate")), await css(p, LAYER, "translate"));
  await p.evaluate(() => window.scrollTo(0, 120)); await p.waitForTimeout(300);
  check("…the header still takes its bar, at once", (await css(p, HEADER, "backgroundColor")) === "rgb(243, 212, 64)");
  check("…and no script error", errs.length === 0, errs.join(" | "));
  await ctx.close();
}
server.close();
check("the Builder raised no error", errors.length === 0, errors.slice(0, 3).join(" | "));
await done();
