#!/usr/bin/env node
/**
 * EVERY PAGE OF A BROUGHT-IN SITE, SCORED AGAINST THE SITE ITSELF.
 *
 * tests/tv-import.mjs check 7 scores Play alone, at 1440 and 390. This does
 * the same for every page the saved board holds, at every width the Builder
 * shows (the window at 1440 and 1920, the tablet, the phone), on the Preview
 * and on the published page (`/s/...` draws the same LiveSite), against the
 * site's own pages as the import reads them (its HTML and CSS, scripts out).
 *
 *   npm run build && npx next start -p 3013
 *   node scripts/pst-sweep.mjs --url http://127.0.0.1:3013 --site ../PST [--board pst] [--pages page_home,page_profile] [--widths 1440,390] [--out sweep.json]
 *
 * Prints, per page and width, how many parts match and what differs for the
 * rest (place, size, words, look), as tv-import's score does.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "../tests/lib/board.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => { const i = argv.indexOf(`--${name}`); return i < 0 ? fallback : argv[i + 1]; };
const URL_BASE = opt("url", "http://127.0.0.1:3013");
const SITE = resolve(opt("site", "../PST"));
const BOARD = opt("board", "pst");
const ONLY = opt("pages")?.split(",") ?? null;
const WIDTHS = (opt("widths", "1440,1920,834,390")).split(",").map(Number);
const OUT = opt("out");
const PUBLISHED = argv.includes("--published");

const FILES = {};
const walk = (d, rel) => { for (const n of readdirSync(d)) { const p = join(d, n), r = `${rel}/${n}`; if (statSync(p).isDirectory()) walk(p, r); else FILES[r] = readFileSync(p); } };
walk(join(SITE, "web"), "web");
const TYPES = { html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2", jpg: "image/jpeg", webp: "image/webp" };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const st = await openBoard(ui, URL_BASE, BOARD);
const live = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await live.route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "pst.invalid") return r.abort();
  const f = u.pathname.slice(1) || "web/index.html";
  const body = FILES[f];
  if (!body) return r.fulfill({ status: 404, body: "" });
  r.fulfill({ status: 200, contentType: TYPES[f.split(".").pop()] ?? "application/octet-stream", body: f.endsWith(".html") ? body.toString("utf8").replace(/<script\b[\s\S]*?<\/script>/gi, "") : body });
});

const fileOf = (p) => { const t = p.path.replace(/^\/+|\/+$/g, ""); return `web/${t || "index"}.html`; };
const words = (t) => (t ?? "").replace(/​/g, "").replace(/\s+/g, " ").trim();

const DEVICE = (w) => (w === 390 ? "phone" : w === 834 ? "tablet" : "window");
async function score(pg, width) {
  const device = DEVICE(width);
  const prev = ui;
  const win = device === "window" ? width : width + 120;
  await prev.setViewportSize({ width: win, height: 900 });
  const path = pg.path.replace(/^\/+|\/+$/g, "");
  await prev.goto(`${URL_BASE}/builder/preview${path ? `/${path}` : ""}`, { waitUntil: "networkidle" });
  await prev.waitForTimeout(1500);
  /* The window the page is seen in: the Preview's own room in the window, the device's screen otherwise. */
  const screenH = device === "phone" ? 844 : device === "tablet" ? 1194 : await prev.evaluate(() => document.querySelector("[data-live-scroller]")?.clientHeight ?? 900);
  if (device !== "window") { await prev.evaluate((d) => window.__studioLiveDevice?.(d), device); await prev.waitForTimeout(1200); }
  const tall = await prev.evaluate(() => {
    const sc = document.querySelector("[data-live-scroller]");
    if (!sc) return 0;
    const h = sc.scrollHeight;
    sc.style.overflow = "visible"; sc.style.height = `${h}px`; sc.style.flex = "none";
    if (sc.parentElement) sc.parentElement.style.height = `${h}px`;
    return h;
  });
  await prev.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await prev.setViewportSize({ width: win, height: Math.max(900, tall + 200) });
  await prev.waitForTimeout(500);
  const origin = await prev.evaluate(() => { const r = document.querySelector("[data-live-root]")?.getBoundingClientRect(); return r ? { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } : { x: 0, y: 0, w: 0, h: 0 }; });
  const nodes = st.nodes.filter((n) => n.pageId === pg.id && !n.state && n.hooks?.["data-hook"]);
  const board = await prev.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const e = document.querySelector(`[data-live-node="${id}"]`);
    if (!e) return [id, null];
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return [id, r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" ? { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, text: (e.innerText ?? "").replace(/\s+/g, " ").trim() } : null];
  })), nodes.map((n) => n.id));
  const previewShot = (await prev.screenshot({ fullPage: true })).toString("base64");

  await live.setViewportSize({ width, height: screenH });
  await live.goto(`https://pst.invalid/${fileOf(pg)}`, { waitUntil: "load" });
  await live.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await live.waitForTimeout(400);
  const onPage = await live.evaluate((hs) => Object.fromEntries(hs.map((h) => {
    const hit = document.querySelector(`[data-hook="${h}"]`);
    const e = hit?.matches("input[type=checkbox], input[type=radio]") ? hit.closest("label") ?? hit : hit;
    if (!e) return [h, null];
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return [h, r.width > 0 && r.height > 0 && cs.visibility !== "hidden" ? { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, text: (e.innerText ?? "").replace(/\s+/g, " ").trim() } : null];
  })), nodes.map((n) => n.hooks["data-hook"]));
  /* Hooked parts the page shows that the board has no part for at all. */
  const known = new Set(nodes.map((n) => n.hooks["data-hook"]));
  const allHooks = new Set(st.nodes.filter((n) => n.pageId === pg.id).map((n) => n.hooks?.["data-hook"]).filter(Boolean));
  const missing = await live.evaluate((have) => [...document.querySelectorAll("body [data-hook]")].filter((e) => {
    if (have.includes(e.dataset.hook) || e.closest("template")) return false;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return r.width >= 4 && r.height >= 4 && cs.visibility !== "hidden" && cs.display !== "none" && e.tagName !== "SCRIPT";
  }).map((e) => e.dataset.hook), [...allHooks]);
  const liveShot = (await live.screenshot({ fullPage: true })).toString("base64");
  if (process.env.SHOTDIR) { writeFileSync(`${process.env.SHOTDIR}/${pg.id}-${width}-page.png`, Buffer.from(liveShot, "base64")); writeFileSync(`${process.env.SHOTDIR}/${pg.id}-${width}-builder.png`, Buffer.from(previewShot, "base64")); }
  const parts = nodes.filter((n) => onPage[n.hooks["data-hook"]] && n.w >= 4 && n.h >= 4).map((n) => ({ hook: n.hooks["data-hook"], turned: !!n.art?.transform, worded: typeof n.content === "string" ? !!n.content.trim() : Array.isArray(n.content) && n.content.some((r) => r.text?.trim()), a: onPage[n.hooks["data-hook"]], b: board[n.id] ? { ...board[n.id], x: board[n.id].x - origin.x, y: board[n.id].y - origin.y } : null }));
  /* Parts the builder draws that the page does not show at this width. */
  const extra = nodes.filter((n) => !onPage[n.hooks["data-hook"]] && board[n.id] && board[n.id].w >= 4 && board[n.id].h >= 4).map((n) => n.hooks["data-hook"]);
  const px = await prev.evaluate(async ({ A, B, parts, origin }) => {
    const load = async (b64) => { const i = new Image(); i.src = `data:image/png;base64,${b64}`; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(i, 0, 0); return { g, w: i.width, h: i.height, d: g.getImageData(0, 0, i.width, i.height).data }; };
    const P = await load(A), Q = await load(B);
    const at = (img, x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null; const i = (y * img.w + x) * 4; return [img.d[i], img.d[i + 1], img.d[i + 2]]; };
    const dist = (p, q) => (!p || !q ? Infinity : Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]));
    const far = (pa, x, y) => { if (!pa) return true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dist(pa, at(Q, x + dx, y + dy)) <= 96) return false; return true; };
    const each = parts.map((p) => {
      if (!p.b) return null;
      const nx = Math.max(1, Math.min(60, Math.round(p.a.w))), ny = Math.max(1, Math.min(60, Math.round(p.a.h)));
      let off = 0, n = 0; const ma = [0, 0, 0], mb = [0, 0, 0];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const u = (i + 0.5) / nx, v = (j + 0.5) / ny;
        const ax = p.a.x + u * p.a.w, ay = p.a.y + v * p.a.h, bx = p.turned ? ax : p.b.x + u * p.b.w, by = p.turned ? ay : p.b.y + v * p.b.h;
        const pa = at(P, ax, ay), pb = at(Q, origin.x + bx, origin.y + by);
        n++; if (far(pa, origin.x + bx, origin.y + by)) off++;
        if (pa) for (let k = 0; k < 3; k++) ma[k] += pa[k];
        if (pb) for (let k = 0; k < 3; k++) mb[k] += pb[k];
      }
      return n ? { off: off / n, mean: Math.hypot(...ma.map((v, k) => (v - mb[k]) / n)) } : null;
    });
    let off = 0, all = 0;
    for (let y = 0; y < P.h; y += 2) for (let x = 0; x < P.w; x += 2) { all++; if (far(at(P, x, y), origin.x + x, origin.y + y)) off++; }
    return { each, page: off / Math.max(1, all), heights: [P.h, Q.h - origin.y] };
  }, { A: liveShot, B: previewShot, parts, origin });
  const off = [];
  parts.forEach((p, i) => {
    const what = [];
    if (!p.b) what.push("not drawn by the builder");
    else {
      if (!p.turned && (Math.abs(p.a.x - p.b.x) > 4 || Math.abs(p.a.y - p.b.y) > 4)) what.push(`place off ${Math.round(p.b.x - p.a.x)}, ${Math.round(p.b.y - p.a.y)}`);
      if (!p.turned && (Math.abs(p.a.w - p.b.w) > 4 || Math.abs(p.a.h - p.b.h) > 4)) what.push(`size ${Math.round(p.b.w)}x${Math.round(p.b.h)}, page ${Math.round(p.a.w)}x${Math.round(p.a.h)}`);
      if (p.worded && words(p.a.text) !== words(p.b.text)) what.push(`text “${p.b.text.slice(0, 40)}”, page “${p.a.text.slice(0, 40)}”`);
      const q = px.each[i];
      if (q && (q.off > 0.12 || q.mean > 30)) what.push(`look ${Math.round(q.off * 100)}% of pixels off, mean colour off ${Math.round(q.mean)}`);
    }
    if (what.length) off.push({ hook: p.hook, what });
  });
  const matching = parts.length - off.length;
  console.log(`\n${pg.name} (${pg.path}) at ${width}: ${matching}/${parts.length} parts match, ${(px.page * 100).toFixed(1)}% pixels differ, page ${px.heights[0]}px tall, builder ${Math.round(px.heights[1])}px`);
  for (const o of off) console.log(`    ${o.hook}  ${o.what.join("; ")}`);
  if (missing.length) console.log(`    NOT ON BOARD: ${missing.join(", ")}`);
  if (extra.length) console.log(`    DRAWN BUT NOT SHOWN BY PAGE: ${extra.join(", ")}`);
  return { page: pg.id, path: pg.path, width, parts: parts.length, matching, pixels: px.page, heights: px.heights, off, missing, extra };
}

const out = [];
for (const pg of st.pages.filter((p) => !ONLY || ONLY.includes(p.id))) {
  for (const w of WIDTHS) {
    try { out.push(await score(pg, w)); } catch (e) { console.log(`${pg.name} at ${w}: ERROR ${e.message.split("\n")[0]}`); out.push({ page: pg.id, width: w, error: e.message }); }
  }
}
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log("\nSUMMARY");
for (const r of out) if (!r.error) console.log(`  ${r.page.padEnd(18)} ${String(r.width).padStart(4)}  ${r.matching}/${r.parts}  ${(r.pixels * 100).toFixed(1)}%${r.missing.length ? `  missing ${r.missing.length}` : ""}${r.extra.length ? `  extra ${r.extra.length}` : ""}`);
await browser.close();
