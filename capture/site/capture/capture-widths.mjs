#!/usr/bin/env node
/**
 * THE SITE AT A TABLET AND A PHONE.
 *
 * A capture reads a site at 1440 wide. Its own layout at a tablet and a phone
 * (what its stylesheet does at those widths: which parts show, in what
 * order, where and how large, in what type, and the phone's menu) is read
 * here, page by page, at the Builder's own frames: 834 x 1112 and 390 x 844.
 * Each part is the desktop capture's own element (its path `p`, the same
 * document at every width), so the converter can give each width's place to
 * the part the document already has (`doc.layouts`).
 *
 *   node capture/site/capture/capture-widths.mjs <routes.json> [--widths 834x1112,390x844]
 *        [--pages page_home,page_x] [--hide-gate] [--settle 8]
 *
 * Next to the desktop captures, one file per page and width:
 *   <capture>/widths/<page>.<width>.json
 *   {
 *     page, path, width, height,     the page and the frame it was read in
 *     pageHeight, overflowX,         how tall it ran; wider than the frame?
 *     parts:  { p: [x, y, w, h] }    every desktop part showing here, its box
 *                                    as seen (cut to what clips it)
 *     fonts:  { p: [px, lineHeight, weight] }   a part's own words' type
 *     hidden: [p]                    desktop parts not showing here
 *     order:  [p]                    the parts with words, a picture or a
 *                                    control, in reading order (top to
 *                                    bottom, a row left to right)
 *     added:  [{ p, box, text }]     what shows here only (a menu button)
 *     menu:   { trigger, panel, stopped } | null
 *   }
 *
 * THE MENU, PRESSED ONCE. A phone's menu button (its words or label say
 * menu or navigation, or it is a button high on the page that expands
 * something) is pressed once, with every write and every leaving of the page
 * stopped (network.mjs `guardWrites`), and what its panel shows is kept. A
 * control that signs in, makes an account, connects a wallet, spends or
 * writes is never pressed (held.mjs, worlds.mjs). A terms gate is hidden,
 * never agreed to (`--hide-gate`).
 *
 * `check-widths.mjs`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { HIDE_GATE, WRITES, ACCOUNT } from "./held.mjs";
import { SPENDS } from "./worlds.mjs";
import { guardWrites } from "./network.mjs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const routesFile = resolve(args.find((a) => !a.startsWith("--") && a.endsWith(".json")) ?? "");
if (!existsSync(routesFile)) { console.error("usage: capture-widths.mjs <routes.json> [--widths 834x1112,390x844] [--pages ids] [--hide-gate]"); process.exit(2); }
const capDir = dirname(routesFile);
const routes = JSON.parse(readFileSync(routesFile, "utf8"));
const FRAMES = String(opt("--widths", "834x1112,390x844")).split(",").map((s) => s.split("x").map(Number)).filter(([w, h]) => w > 0 && h > 0);
const only = opt("--pages", null)?.split(",");
const settleMs = Number(opt("--settle", 8)) * 1000;
const outDir = join(capDir, "widths");
mkdirSync(outDir, { recursive: true });

/** Runs in the page: where each part is at this width, and what shows here only. */
function READ({ paths }) {
  const at = (p) => { let el = document.body; for (const step of String(p).split(">").slice(1)) { const m = /^([a-z0-9-]+):(\d+)$/i.exec(step); if (!m || !el) return null; let k = 0; el = Array.from(el.children).find((c) => c.localName.toLowerCase() === m[1].toLowerCase() && ++k === Number(m[2])) ?? null; } return el; };
  const pathOf = (el) => { const out = []; for (let n = el; n && n !== document.body && n.parentElement; n = n.parentElement) { const t = n.localName; let i = 1; for (let q = n.previousElementSibling; q; q = q.previousElementSibling) if (q.localName === n.localName) i++; out.unshift(`${t}:${i}`); } return `body>${out.join(">")}`; };
  const W = document.documentElement.clientWidth;
  /* The box as seen: cut to every ancestor that clips it, and to the page. */
  const seenBox = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.02) return null;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) return null;
    const r = el.getBoundingClientRect();
    let x0 = r.left, y0 = r.top + scrollY, x1 = r.right, y1 = r.bottom + scrollY;
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n);
      const fixed = getComputedStyle(el).position === "fixed";
      if (/(hidden|clip|auto|scroll)/.test(`${c.overflowX} ${c.overflowY}`) && n !== document.body) {
        const q = n.getBoundingClientRect(), qy = fixed ? q.top : q.top + scrollY;
        if (/(hidden|clip|auto|scroll)/.test(c.overflowX)) { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); }
        if (/(hidden|clip|auto|scroll)/.test(c.overflowY)) { y0 = Math.max(y0, qy); y1 = Math.min(y1, qy + q.height); }
      }
    }
    x0 = Math.max(0, x0); x1 = Math.min(Math.max(W, document.documentElement.scrollWidth), x1);
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return [Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)];
  };
  const ownWords = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim();
  const content = (el) => !!ownWords(el) || /^(img|svg|video|canvas|picture|button|input|select|textarea|a)$/.test(el.localName) || el.getAttribute("role") === "button";
  const parts = {}, fonts = {}, hidden = [], forOrder = [];
  const inPaths = new Set();
  for (const p of paths) {
    const el = at(p);
    if (!el) { hidden.push(p); continue; }
    inPaths.add(el);
    const b = seenBox(el);
    if (!b) { hidden.push(p); continue; }
    parts[p] = b;
    const words = ownWords(el);
    if (words) { const cs = getComputedStyle(el); fonts[p] = [Math.round(parseFloat(cs.fontSize) * 10) / 10, cs.lineHeight === "normal" ? "normal" : Math.round(parseFloat(cs.lineHeight) * 10) / 10, Number(cs.fontWeight) || cs.fontWeight]; }
    if (content(el)) forOrder.push([p, b]);
  }
  /* What shows here only: words, a picture or a control the desktop page did not have showing (a phone's menu button). */
  const added = [];
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    if (added.length >= 200) break;
    if (inPaths.has(el) || !content(el) || el.closest("[data-sink-gate]")) continue;
    const b = seenBox(el);
    if (!b) continue;
    const p = pathOf(el);
    if (paths.includes(p)) continue;
    added.push({ p, box: b, text: (el.getAttribute("aria-label") || ownWords(el) || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60), t: el.localName });
    forOrder.push([p, b]);
  }
  /* Reading order: top to bottom; parts whose boxes share most of a row, left to right. */
  forOrder.sort((a, b) => a[1][1] - b[1][1] || a[1][0] - b[1][0]);
  const order = [];
  const rows = [];
  for (const it of forOrder) {
    const row = rows.find((r) => { const [, y, , h] = it[1]; const overlap = Math.min(r.y1, y + h) - Math.max(r.y0, y); return overlap > Math.min(h, r.y1 - r.y0) * 0.5; });
    if (row) { row.items.push(it); row.y1 = Math.max(row.y1, it[1][1] + it[1][3]); } else rows.push({ y0: it[1][1], y1: it[1][1] + it[1][3], items: [it] });
  }
  for (const r of rows) for (const it of r.items.sort((a, b) => a[1][0] - b[1][0])) order.push(it[0]);
  return { parts, fonts, hidden, added, order, pageHeight: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth > W + 1 };
}

/** Runs in the page: the phone's menu button, never one that signs in, connects, spends or writes. */
function MENU_BUTTON({ never }) {
  const NEVER = new RegExp(never, "i");
  const words = (el) => `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""} ${el.textContent ?? ""}`.trim();
  const seen = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const all = Array.from(document.querySelectorAll('button, [role="button"], [aria-expanded], [aria-controls]')).filter((el) => seen(el) && !el.closest("[data-sink-gate], form") && !NEVER.test(words(el)));
  const MENU = /\b(menu|navigation|nav|open (the )?menu|toggle (the )?(menu|navigation))\b|☰|≡/i;
  /* A real menu button only: its words or label say menu or navigation; or an icon button (no words of its own) high on the page that expands or controls something, whose press must then show the site's links. Never a "Share", a "More", a sort. */
  const icon = (el) => !/[a-z0-9]/i.test(el.textContent ?? "") && !!el.querySelector("svg, img, i, span") && el.getBoundingClientRect().top < 160 && (el.hasAttribute("aria-expanded") || el.hasAttribute("aria-controls") || el.hasAttribute("aria-haspopup"));
  const labelled = all.find((el) => MENU.test(words(el)));
  const pick = labelled ?? all.find(icon);
  if (!pick) return null;
  pick.setAttribute("data-sink-menu", "");
  /* The links showing before the press, to tell what the press showed. */
  window.__sinkLinksBefore = new Set(Array.from(document.querySelectorAll("a[href]")).filter(seen));
  return { label: words(pick).replace(/\s+/g, " ").slice(0, 60) || "menu", labelled: !!labelled };
}

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  headless: true,
  ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.trim().split(/\s+/) } : {}),
  ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
});

const NEVER = [ACCOUNT.source, WRITES.source, SPENDS.source, "\\bwallet\\b", "\\b(cookies?|consent|accept|agree|terms|privacy)\\b"].join("|");
const site = routes.site.replace(/\/+$/, "");
const summary = [];
for (const def of routes.pages) {
  if (only && !only.includes(def.id)) continue;
  const capFile = join(capDir, "routes", `${def.id}.json`);
  if (!existsSync(capFile)) { console.error(`${def.id}: no desktop capture, not read`); continue; }
  const cap = JSON.parse(readFileSync(capFile, "utf8"));
  const paths = [];
  (function walk(e) { if (e?.p && !e.p.includes("::")) paths.push(e.p); for (const k of e?.kids ?? []) walk(k); })(cap.tree);
  for (const [W, H] of FRAMES) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ...(W < 600 ? { isMobile: true, hasTouch: true } : {}) });
    const page = await context.newPage();
    const url = def.path?.startsWith("http") ? def.path : `${site}${def.path ?? "/"}`;
    const t0 = Date.now();
    const why = await page.goto(url, { waitUntil: "load", timeout: 60000 }).then(() => null).catch((e) => String(e.message ?? e).split("\n")[0]);
    if (why) { console.error(`${def.id} at ${W}: the page did not load (${url}: ${why})`); await context.close(); continue; }
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    if (flag("--hide-gate")) await page.evaluate(HIDE_GATE).catch(() => {});
    /* A loader over the whole window, holding no control, waited out (as capture-route.mjs). */
    for (const t = Date.now(); Date.now() - t < settleMs;) {
      const covered = await page.evaluate(() => Array.from(document.body.querySelectorAll("*")).some((el) => { const cs = getComputedStyle(el); if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05 || el.closest("[data-sink-gate]")) return false; const r = el.getBoundingClientRect(); if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.9) return false; if (el.querySelector('button, a[href], input, select, textarea, [role="button"], [role="dialog"]') || (el.textContent ?? "").trim().length > 120) return false; return [[0.5, 0.5], [0.3, 0.3], [0.7, 0.7]].every(([fx, fy]) => { const hit = document.elementFromPoint(innerWidth * fx, innerHeight * fy); return !!hit && el.contains(hit); }); })).catch(() => false);
      if (!covered) break;
      await page.waitForTimeout(250);
    }
    if (flag("--hide-gate")) await page.evaluate(HIDE_GATE).catch(() => {});
    /* Scrolled through once, as the desktop capture was: what reveals itself on the way down has. */
    await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += Math.max(100, innerHeight / 6)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); }).catch(() => {});
    await page.waitForTimeout(500);
    const read = await page.evaluate(READ, { paths }).catch((e) => ({ error: String(e.message ?? e) }));
    if (read.error) { console.error(`${def.id} at ${W}: not read (${read.error})`); await context.close(); continue; }
    /* The menu, pressed once with writes and leaving stopped; never at the desktop's own width. */
    let menu = null;
    if (W < 1024) {
      const btn = await page.evaluate(MENU_BUTTON, { never: NEVER }).catch(() => null);
      if (btn) {
        const stopped = [];
        const guard = await guardWrites(page, { nav: true });
        await guard.on(stopped);
        const trigger = await page.evaluate(() => { const el = document.querySelector("[data-sink-menu]"); if (!el) return null; const out = []; for (let n = el; n && n !== document.body; n = n.parentElement) { let i = 1; for (let q = n.previousElementSibling; q; q = q.previousElementSibling) if (q.localName === n.localName) i++; out.unshift(`${n.localName}:${i}`); } const r = el.getBoundingClientRect(); return { p: `body>${out.join(">")}`, box: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)] }; }).catch(() => null);
        await page.locator("[data-sink-menu]").first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(900);
        await guard.off();
        await guard.dispose();
        const after = await page.evaluate(READ, { paths }).catch(() => null);
        /* An icon button counts as the menu only when its press showed the site's links (two or more). */
        const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).filter((a) => { const r = a.getBoundingClientRect(), cs = getComputedStyle(a); return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && !window.__sinkLinksBefore?.has(a); }).length).catch(() => 0);
        if (!btn.labelled && links < 2) console.error(`${def.id} at ${W}: "${btn.label}" opened no navigation (${links} links): no menu recorded`);
        else if (after && trigger) {
          const was = new Set([...Object.keys(read.parts), ...read.added.map((a) => a.p)]);
          const panel = [
            ...Object.entries(after.parts).filter(([p]) => !was.has(p)).map(([p, box]) => ({ p, box })),
            ...after.added.filter((a) => !was.has(a.p)).map(({ p, box, text }) => ({ p, box, text })),
          ];
          menu = { trigger: { ...trigger, label: btn.label }, panel, ...(stopped.length ? { stopped } : {}) };
        }
      }
    }
    const out = {
      _: "The page at this width, as its own stylesheet lays it out (capture-widths.mjs).",
      page: def.id, path: def.path ?? "/", width: W, height: H, pageHeight: read.pageHeight, overflowX: read.overflowX,
      parts: read.parts, fonts: read.fonts, hidden: read.hidden, order: read.order, added: read.added, menu,
    };
    writeFileSync(join(outDir, `${def.id}.${W}.json`), JSON.stringify(out, null, 1));
    const outside = Object.values(read.parts).filter(([x, , w]) => x < -1 || x + w > W + 1).length;
    /* How far the reading order departs from the page's own source order (CSS order, a grid's areas): adjacent pairs read the other way round. */
    const srcAt = new Map(paths.map((p, i) => [p, i]));
    const seq = read.order.map((p) => srcAt.get(p)).filter((i) => i != null);
    const moved = seq.reduce((n, v, i) => n + (i && v < seq[i - 1] ? 1 : 0), 0);
    summary.push({ page: def.id, width: W, shown: Object.keys(read.parts).length, hidden: read.hidden.length, added: read.added.length, menu: menu ? menu.panel.length : null, outside, moved, s: Math.round((Date.now() - t0) / 100) / 10 });
    console.error(`${def.id} at ${W}: ${Object.keys(read.parts).length} parts showing, ${read.hidden.length} hidden, ${read.added.length} here only${menu ? `, menu "${menu.trigger.label}" opens ${menu.panel.length} parts${menu.stopped ? ` (${menu.stopped.length} writes stopped)` : ""}` : ""}${outside ? `, ${outside} outside the page` : ""}${read.overflowX ? ", the page is wider than the frame" : ""}; reading order ${moved ? `departs from the source at ${moved} places` : "as the source"}`);
    await context.close();
  }
}
await browser.close();
console.log(JSON.stringify(summary));
