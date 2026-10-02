#!/usr/bin/env node
/**
 * EVERY INLINE SVG ON A LIVE PAGE, AS CARRIED AGAINST AS DRAWN.
 *
 * check-svg-paint.mjs holds the rule on a stand-in; this holds it on the
 * sites themselves. It captures a page's first screen and more with the
 * capture code as it stands (capture-route.mjs, no behaviours), converts it,
 * opens the live page again, and for every part the document made of an
 * inline svg (a drawn icon or a picture of one) rasterises what the document
 * carries, at the part's box on the part's own ground, against a crop of the
 * live element. The difference is the mean per channel over the box; an
 * icon past `--within` (default 12) is listed with its selector.
 *
 * Live pages move (a marquee, a blink), so this is an audit, not a check:
 * run it before and after a change and compare the counts.
 *
 * `--shots <dir>` keeps each pair (live, ours) and what was carried.
 *
 *   node capture/site/capture/audit-svg.mjs https://trumpmorty.fun [--width 1440 --height 900 --within 12 --settle 6 --shots dir --agree]
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const url = args.find((a) => /^https?:/.test(a));
if (!url) { console.error("usage: node capture/site/capture/audit-svg.mjs <url> [--width 1440 --height 900 --within 12 --settle 6]"); process.exit(2); }
const W = Number(opt("--width", 1440)), H = Number(opt("--height", 900)), WITHIN = Number(opt("--within", 12));

const work = mkdtempSync(join(tmpdir(), "audit-svg-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const cap = spawnSync(process.execPath, [join(here, "capture-route.mjs"), url, capFile, "--width", String(W), "--height", String(H), "--assets", assets, "--settle", opt("--settle", "6"), ...(args.includes("--agree") ? ["--agree"] : [])], { encoding: "utf8", maxBuffer: 1 << 26 });
if (cap.status !== 0 || !existsSync(capFile)) { console.error(`capture failed: ${(cap.stderr || cap.stdout).trim().split("\n").pop()}`); process.exit(1); }
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: new URL(url).origin, viewport: [W, H], pages: [{ id: "page_home", name: "Home", path: new URL(url).pathname, route: new URL(url).pathname }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", maxBuffer: 1 << 26 });
if (conv.status !== 0) { console.error(`convert failed: ${conv.stderr.trim().split("\n").pop()}`); process.exit(1); }
const doc = JSON.parse(readFileSync(join(work, "out", "site", "document.json"), "utf8"));
const icons = doc.nodes.filter((n) => /(^|> )svg(:nth-of-type\(\d+\))?$/.test(n.from?.selector ?? "") && (n.vector || n.picture) && n.w >= 4 && n.h >= 4);

const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}) });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "load" }).catch(() => {});
await page.waitForTimeout(Number(opt("--settle", "6")) * 1000);
/* A load cut on the way in (share.xyz through a proxy) finds none of the icons the capture saw: loaded again, up to three times. */
const found = () => page.evaluate((sels) => sels.filter((q) => { try { return !!document.querySelector(q); } catch { return false; } }).length, icons.map((n) => n.from.selector));
for (let i = 0; i < 3 && icons.length && (await found()) < icons.length / 2; i++) {
  await page.goto(url, { waitUntil: "load" }).catch(() => {});
  await page.waitForTimeout(Number(opt("--settle", "6")) * 1000);
}
/* A terms gate over the page (stonkfun.xyz), pressed as capture-route.mjs presses it: never a Decline. */
if (args.includes("--agree")) for (let round = 0; round < 3; round++) {
  const dialog = page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]').filter({ hasText: /terms|agree|disclaimer|consent|conditions/i }).first();
  if (!(await dialog.count()) || !(await dialog.isVisible().catch(() => false))) break;
  const boxes = dialog.getByRole("checkbox", { name: /agree|accept|read|understand|confirm/i });
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check({ timeout: 2000 }).catch(() => boxes.nth(i).click({ timeout: 2000 }).catch(() => {}));
  const yes = dialog.getByRole("button", { name: /^\s*(i\s+)?(accept|agree|continue|got it|ok|enter)\b/i }).filter({ hasNotText: /decline|reject|cancel/i });
  if (!(await yes.count())) break;
  await yes.last().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** What the document carries for one part, as the Builder draws it (polio vector.ts#vectorMarkup, with `vector.stroke` and `vector.crisp`; a picture as its file). */
const carried = (n, box = { w: n.w, h: n.h }) => {
  let html = null;
  if (n.picture) {
    const f = join(work, "out", n.picture.path);
    if (existsSync(f)) html = `<img src="data:${n.picture.type};base64,${readFileSync(f).toString("base64")}" style="width:${box.w}px;height:${box.h}px;display:block">`;
  } else if (n.vector) {
    const line = n.options?.["drawn as"] !== "solid";
    const k = n.vector.stroke ?? { width: 2, cap: "round", join: "round" };
    const inner = n.vector.paths.map((p) => (line ? `<path d="${p.d}" fill="none" stroke="currentColor" stroke-width="${k.width}" stroke-linecap="${k.cap}" stroke-linejoin="${k.join}"/>` : `<path d="${p.d}" fill="currentColor"/>`)).join("");
    html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n.vector.viewBox}"${n.vector.crisp ? ' shape-rendering="crispEdges"' : ""} style="width:${box.w}px;height:${box.h}px;display:block;color:${n.colour?.text ?? "#000"}" fill="currentColor">${inner}</svg>`;
  }
  const op = typeof n.opacity === "number" ? n.opacity : 1;
  return html && op < 1 ? `<div style="opacity:${op}">${html}</div>` : html;
};
const diff = (a, b) => page.evaluate(async ([a, b]) => {
  const load = async (s) => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
  const x = await load(a), y = await load(b);
  if (x.length !== y.length) return 255;
  let t = 0; for (let i = 0; i < x.length; i += 4) t += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]);
  return t / (x.length / 4) / 3;
}, [a.toString("base64"), b.toString("base64")]);

const rows = [];
for (const n of icons) {
  /* The live element, scrolled into view, its box and the ground behind it (the svg hidden for a moment). */
  const at = await page.evaluate(([sel, box]) => {
    /* By its path, or, where the path counted only the siblings the capture kept (share.xyz's hidden first div), by where the capture measured it. */
    let e = null;
    try { e = document.querySelector(sel); } catch { /* not a selector this browser takes */ }
    if (!e) {
      let best = null, d = 9;
      for (const c of document.querySelectorAll("svg")) {
        const q = c.getBoundingClientRect();
        const off = Math.max(Math.abs(q.left + scrollX - box.x), Math.abs(q.top + scrollY - box.y), Math.abs(q.width - box.w), Math.abs(q.height - box.h));
        if (off < d) { d = off; best = c; }
      }
      e = best;
      if (e) e.setAttribute("data-audit", sel);
    } else e.setAttribute("data-audit", sel);
    if (!e) return { gone: true };
    e.scrollIntoView({ block: "center" });
    const q = e.getBoundingClientRect();
    return q.width > 0 && q.height > 0 ? { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) } : { gone: true, empty: true };
  }, [n.from.selector, { x: n.x, y: n.y, w: n.w, h: n.h }]);
  if (at?.gone) { rows.push({ sel: n.from.selector, kind: n.picture ? "picture" : "drawn icon", diff: null, why: at.empty ? "drawn at no size now" : "not on the live page now" }); continue; }
  if (!at || at.x < 0 || at.y < 0 || at.x + at.w > W || at.y + at.h > H) { rows.push({ sel: n.from.selector, kind: n.picture ? "picture" : "drawn icon", diff: null, why: "not on screen" }); continue; }
  await page.waitForTimeout(150);
  const clip = { x: at.x, y: at.y, width: at.w, height: at.h };
  const live = await page.screenshot({ clip });
  await page.evaluate((sel) => { for (const e of document.querySelectorAll("[data-audit]")) if (e.getAttribute("data-audit") === sel) e.style.visibility = "hidden"; }, n.from.selector);
  const ground = await page.screenshot({ clip });
  await page.evaluate((sel) => { for (const e of document.querySelectorAll("[data-audit]")) if (e.getAttribute("data-audit") === sel) e.style.visibility = ""; }, n.from.selector);
  /* Drawn at the live element's box: this audits paint and turns, not a box a reveal was scaling when the capture looked. */
  const html = carried(n, at);
  if (!html) { rows.push({ sel: n.from.selector, kind: "nothing", diff: null, why: "nothing carried" }); continue; }
  const p = await browser.newPage({ viewport: { width: at.w + 20, height: at.h + 20 }, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${ground.toString("base64")}" style="position:absolute;left:10px;top:10px;width:${at.w}px;height:${at.h}px"><div style="position:absolute;left:10px;top:10px">${html}</div></body>`);
  await p.waitForTimeout(80);
  const ours = await p.screenshot({ clip: { x: 10, y: 10, width: at.w, height: at.h } });
  await p.close();
  const d = +(await diff(live, ours)).toFixed(2);
  const SHOTS = opt("--shots");
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); const k = rows.length; writeFileSync(join(SHOTS, `${k}-live.png`), live); writeFileSync(join(SHOTS, `${k}-ours.png`), ours); writeFileSync(join(SHOTS, `${k}.txt`), `${n.from.selector}\n${d}\n${html.slice(0, 2000)}`); }
  rows.push({ sel: n.from.selector, kind: n.picture ? "picture" : "drawn icon", diff: d });
}
await browser.close();
const measured = rows.filter((r) => r.diff !== null);
const off = measured.filter((r) => r.diff > WITHIN);
if (args.includes("--why")) for (const r of rows.filter((r) => r.diff === null)) console.error(r.why, r.sel.slice(-80));
console.log(JSON.stringify({ url, icons: icons.length, measured: measured.length, within: measured.length - off.length, off: off.map((r) => [r.sel.slice(-70), r.kind, r.diff]) }, null, 1));
