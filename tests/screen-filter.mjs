/**
 * A SCREEN'S FILTER IS DRAWN: SCANLINES, VIGNETTE, WASH, GLOW LINE, DIMMED LABEL.
 *
 * THE OWNER'S REPORT: trumpmorty.fun's TV screen has CRT scanlines, a darker
 * vignette, a slight wash, and its "CH 47 • LIVE" label reads dimmed through
 * them; his published copy showed the picture clean. (That copy predates
 * 5a0d109, whose twins pass had dropped a layer the size of the picture
 * under it; sink also dropped a layer that is only an inset shadow, fixed in
 * its check-overlays.mjs.) Held here in general, on every surface, from
 * sink's own conversion of a stand-in screen (`fixtures/overlays-doc.json`:
 * a scanline `::before`, a vignette `::after` that is only an inset shadow,
 * an overlay-blended wash that flickers, a 1px screen-blended glow line,
 * a label at opacity .7; the picture a flat fill so no file is needed).
 *
 * Read in pixels inside the screen, the same way on the stand-in page itself
 * (so the measures are shown to see what they claim) and on the board (at
 * 1:1), in Preview and on the exported page:
 *   · scanlines: along a column, the light changes every two pixels;
 *   · vignette: a corner is darker than the middle;
 *   · glow line: its row is greener than the rows by it;
 *   · wash: something in the part blends by `overlay`;
 *   · label: drawn at .7.
 *
 *   node tests/screen-filter.mjs http://127.0.0.1:3013
 */
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);

const doc = JSON.parse(readFileSync(join(here, "fixtures", "overlays-doc.json"), "utf8"));
const SCREEN = doc.nodes.find((n) => n.from?.selector === "body > div:nth-of-type(1)");
const LABEL = doc.nodes.find((n) => /div:nth-of-type\(3\)$/.test(n.from?.selector ?? ""));
const WASH = doc.nodes.find((n) => n.art?.blend === "overlay");
const GLOW = doc.nodes.find((n) => n.art?.blend === "screen");

/* The stand-in as the page drew it, the picture a flat fill as in the fixture. */
const STAND_IN = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px/20px sans-serif;background:rgb(240,200,60)}
  @keyframes flick{0%,49%{opacity:1}50%,100%{opacity:.02}}
  .screen{position:relative;margin:80px;width:400px;height:300px;overflow:hidden;background:rgb(0,0,0);border:5px solid rgb(26,15,11);box-shadow:inset 0 0 40px rgba(0,0,0,.6)}
  .pic{width:100%;height:100%;background:rgb(200,120,60)}
  .screen::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 2px,transparent 2px 4px);pointer-events:none;z-index:1}
  .screen::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 60px rgba(0,0,0,.8);pointer-events:none;z-index:1}
  .wash{position:absolute;inset:0;background:rgba(255,255,255,.06);mix-blend-mode:overlay;animation:flick .4s steps(1) infinite;pointer-events:none;z-index:1}
  .glow{position:absolute;left:0;right:0;top:150px;height:1px;background:rgba(160,255,90,.5);mix-blend-mode:screen;pointer-events:none;z-index:1}
  .label{position:absolute;top:12px;left:14px;z-index:2;font:24px/28px monospace;color:rgb(184,255,106);opacity:.7}
</style></head><body><div class="screen"><div class="pic"></div><div class="wash"></div><div class="glow"></div><div class="label">CH 47</div></div></body></html>`;

/** The five readings, inside a screen whose outer box is `r` on page `p`, its parts found by `find`. */
async function measure(p, r, find) {
  const png = (await p.screenshot({ clip: { x: r.x, y: r.y, width: r.w, height: r.h } })).toString("base64");
  const px = await p.evaluate(async ({ src }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const at = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)];
    return { w: img.width, h: img.height, col: Array.from({ length: 60 }, (_, i) => at(300, 60 + i)), corner: at(12, 12), mid: [0, 1, 2, 3].map((i) => at(220, 100 + i)), glow: [at(220, 5 + 150), at(220, 5 + 146), at(220, 5 + 154)] };
  }, { src: `data:image/png;base64,${png}` });
  const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  let flips = 0;
  for (let i = 1; i < px.col.length; i++) if (Math.abs(L(px.col[i]) - L(px.col[i - 1])) > 4) flips++;
  const mid = px.mid.reduce((t, c) => t + L(c), 0) / px.mid.length;
  const [fn, attr] = Array.isArray(find) ? find : [find, null];
  const styles = await p.evaluate(fn, { LABEL: LABEL.id, WASH: WASH.id, attr });
  return { flips, corner: +L(px.corner).toFixed(1), mid: +mid.toFixed(1), glow: px.glow.map((c) => c[1]), ...styles };
}
const holds = (label, m) => {
  check(`${label}: scanlines — along a column the light changes every two pixels`, m.flips >= 20, `${m.flips} changes in 60px`);
  check(`${label}: vignette — a corner is darker than the middle`, m.mid - m.corner >= 20, `corner ${m.corner}, middle ${m.mid}`);
  check(`${label}: glow line — its row is greener than the rows by it`, m.glow[0] - Math.max(m.glow[1], m.glow[2]) >= 10, J(m.glow));
  check(`${label}: wash — it blends by overlay`, m.blend === true, J(m.blend));
  check(`${label}: label — drawn at .7`, Math.abs((m.labelOpacity ?? 0) - 0.7) < 0.011, J(m.labelOpacity));
};
/** In a page of parts (`attr` names a part's element): the wash's blend, and the label's opacity along its words' ancestors to the part. */
const inParts = (attr) => [({ LABEL, WASH, attr }) => {
  const part = (id) => (attr === "id" ? document.getElementById(id) : document.querySelector(`[${attr}="${id}"]`));
  const lab = part(LABEL), wash = part(WASH);
  /* Inside the part's own drawing: on the board a part also carries its name chip. The export has no data- marks, so there it is the part. */
  const drawing = lab ? [...lab.querySelectorAll("[data-part-box], [data-part]")] : [];
  const words = lab ? [...(drawing.length ? drawing.flatMap((d) => [d, ...d.querySelectorAll("*")]) : lab.querySelectorAll("*"))].filter((e) => e.textContent.trim() === "CH 47").pop() ?? null : null;
  let o = 1;
  for (let e = words; e && e !== lab.parentElement; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
  return { blend: !!wash && [wash, ...wash.querySelectorAll("*")].some((e) => getComputedStyle(e).mixBlendMode === "overlay"), labelOpacity: words ? +o.toFixed(3) : null };
}, attr];

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/* The stand-in itself: the readings see what they claim. */
{
  const p = await browser.newPage({ viewport: { width: 1000, height: 700 }, reducedMotion: "reduce" });
  await p.setContent(STAND_IN);
  await p.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
  const r = await p.evaluate(() => { const q = document.querySelector(".screen").getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; });
  holds("the stand-in page", await measure(p, r, () => ({ blend: getComputedStyle(document.querySelector(".wash")).mixBlendMode === "overlay", labelOpacity: Number(getComputedStyle(document.querySelector(".label")).opacity) })));
  await p.close();
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
const state = { ...doc, activePageId: doc.activePageId ?? "page_home" };
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify({ state, version: 0 }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.mouse.move(2, 2);

/* The board, read at 1:1 (it draws with CSS zoom). */
{
  await page.evaluate(() => { const z = document.querySelector("[data-board-zoom]"); if (z) z.style.zoom = "1"; });
  await page.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`)?.scrollIntoView({ block: "center" }), SCREEN.id);
  await page.waitForTimeout(500);
  const r = await page.evaluate((id) => { const q = document.querySelector(`[data-node-id="${id}"]`)?.getBoundingClientRect(); return q ? { x: q.left, y: q.top, w: q.width, h: q.height } : null; }, SCREEN.id);
  if (r) holds("board", await measure(page, r, inParts("data-node-id"))); else check("board: the screen is drawn", false);
}
/* The Preview. */
{
  await page.goto(`${URL_}/builder/preview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.mouse.move(2, 2);
  const r = await page.evaluate((id) => { const q = document.querySelector(`[data-live-node="${id}"]`)?.getBoundingClientRect(); return q ? { x: q.left, y: q.top, w: q.width, h: q.height } : null; }, SCREEN.id);
  const scale = r ? r.w / SCREEN.w : 1;
  check("Preview: drawn at 1:1, so the pixels compare", Math.abs(scale - 1) < 0.01, `scale ${scale.toFixed(3)}`);
  if (r) holds("Preview", await measure(page, r, inParts("data-live-node"))); else check("Preview: the screen is drawn", false);
}
/* The exported page. */
{
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
  check("the site exports", Array.isArray(files) && files.some((f) => f.path === "index.html"), J((files ?? []).map((f) => f.path).slice(0, 4)));
  const out = mkdtempSync(join(tmpdir(), "screen-filter-"));
  for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
  const types = { html: "text/html", css: "text/css", js: "text/javascript", png: "image/png", woff2: "font/woff2" };
  const server = http.createServer((req, res) => {
    let f = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[f.split(".").pop()] ?? "application/octet-stream" }); res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const r = await p.evaluate((id) => { const q = document.getElementById(id)?.getBoundingClientRect(); return q ? { x: q.left, y: q.top, w: q.width, h: q.height } : null; }, SCREEN.id);
  if (r) holds("export", await measure(p, r, inParts("id"))); else check("export: the screen is drawn", false);
  server.close();
}
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
