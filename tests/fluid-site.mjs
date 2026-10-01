#!/usr/bin/env node
/**
 * A CAPTURED SITE IS PUBLISHED FLUID, 1:1, AS THE ORIGINAL DRAWS IT.
 *
 * THE OWNER'S RULING, beside the unlocked original at 2000 wide and 100%:
 * zoom-to-fit drew everything about 13% too big, and browser zoom did
 * nothing because the page rescaled to fill the window. The original draws
 * 1:1 and stretches: the sidebar flush left, full height; the header bar the
 * window's width, its contents centred at natural size; the main column from
 * the sidebar to the right edge, the four stat cards sharing it, the panels
 * reaching the edge; a footer bar pinned to the window's foot.
 *
 * Expectations are the capture's own: the element CSS recorded in sink's
 * site/capture/routes/page_home.json (fixed insets, the header row's
 * max-width, the grid's four columns and gap, margins), not the export's
 * model of it. At 1763, the capture's width, every captured part must stand
 * where the capture put it, on the home page and on Docs.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/fluid-site.mjs http://127.0.0.1:3013 <path to a sink checkout> [screenshot dir]
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { bringSink } from "./fixtures/bring-sink.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const SHOTS = process.argv[4] ?? null;
if (!SINK || !existsSync(join(SINK, "site/capture/routes/page_home.json"))) {
  console.error("usage: node tests/fluid-site.mjs <builder url> <path to a sink checkout> [screenshot dir]");
  process.exit(2);
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The capture's recorded CSS, by element path. */
const cap = JSON.parse(readFileSync(join(SINK, "site/capture/routes/page_home.json"), "utf8"));
const bySel = new Map();
(function walk(el, sel) {
  bySel.set(sel, el);
  const seen = {};
  for (const k of el.kids ?? []) {
    seen[k.t] = (seen[k.t] ?? 0) + 1;
    const same = (el.kids ?? []).filter((x) => x.t === k.t).length;
    walk(k, `${sel} > ${k.t}${same > 1 ? `:nth-of-type(${seen[k.t]})` : ""}`);
  }
})(cap.tree, "body");
const px = (v) => parseFloat(v);
const HEADER = "body > div > header", ASIDE = "body > div > aside", MAIN = "body > div > main", FOOTER = "body > div > footer";
const ROW = `${HEADER} > div`, FROW = `${FOOTER} > div`, GRID = `${MAIN} > div > div:nth-of-type(1)`;
const [W, H] = cap.viewport;
const aside = bySel.get(ASIDE), header = bySel.get(HEADER), footer = bySel.get(FOOTER), row = bySel.get(ROW), grid = bySel.get(GRID), main = bySel.get(MAIN);
check("the capture records the footer's edge on its top only, as the real site draws it", JSON.stringify(footer?.bsides) === "[1,0,0,0]", JSON.stringify({ border: footer?.border, bsides: footer?.bsides }));
check("the capture records the bands fixed, the header row's max-width and the grid", aside?.pos === "fixed" && header?.pos === "fixed" && footer?.pos === "fixed" && row?.maxw === "1280px" && grid?.disp === "grid",
  JSON.stringify({ aside: aside?.pos, header: header?.pos, footer: footer?.pos, maxw: row?.maxw, grid: grid?.cols }));
const cols = String(grid.cols).split(/\s+/).length, gap = px(grid.gap), sideW = aside.w, mainL = main.mar[3], mainT = main.mar[0];

const { browser, page, state } = await bringSink(BASE, SINK);
await page.waitForTimeout(3000);
const s = await state();
/*
 * A glow the capture records rides on the part's edge (`edge.shadow`). Sink's
 * capture recorded none (its capture script never read box-shadow), so one
 * card is given the glow a capture would have handed over, as the converter
 * would write it, and everything after is the Builder's.
 */
const GLOW = "0 0 15px rgba(0, 255, 0, 0.1)";
const CARD1 = s.nodes.find((n) => n.pageId === "page_home" && n.from?.selector === "body > div > main > div > div:nth-of-type(1) > div:nth-of-type(1)");
await page.evaluate(({ id, glow }) => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  raw.state.nodes = raw.state.nodes.map((n) => (n.id === id ? { ...n, edge: { ...(n.edge ?? {}), shadow: glow } } : n));
  localStorage.setItem("builder.studio", JSON.stringify(raw));
}, { id: CARD1.id, glow: GLOW });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
{
  const board = await page.evaluate((id) => { const b = document.querySelector(`[data-node-id="${id}"] [data-part-box]`); return b ? getComputedStyle(b).boxShadow : null; }, CARD1.id);
  check("a glow on a captured card is drawn on the board", !!board && /rgba\(0, 255, 0, 0\.1\) 0px 0px 15px/.test(board), String(board));
}
const files = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null))) ?? [];
check("the exporter gave files", files.length > 0, `${files.length}`);
const nodeBy = (sel, pid = "page_home") => s.nodes.find((n) => n.pageId === pid && n.from?.selector === sel);
const ORIGIN = "http://export.local/";
const open = async (width, height, file = "index.html") => {
  const v = await browser.newPage({ viewport: { width, height } });
  await v.route("http://export.local/**", (r) => {
    const p = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, "") || "index.html";
    const f = files.find((x) => x.path === p);
    if (!f) return r.fulfill({ status: 404, body: "" });
    const type = p.endsWith(".html") ? "text/html" : p.endsWith(".css") ? "text/css" : p.endsWith(".png") ? "image/png" : "application/octet-stream";
    return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
  });
  await v.goto(ORIGIN + file, { waitUntil: "networkidle" });
  await v.waitForTimeout(400);
  return v;
};
const rect = (v, id) => v.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, id);
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
const shot = async (v, name) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await v.screenshot({ path: join(SHOTS, `${name}.png`) }); } };

console.log(`1. At ${W}, the capture's width: every captured part where the capture put it`);
for (const [pid, file] of [["page_home", "index.html"], ["page_docs", "docs/index.html"]]) {
  const v = await open(W, H, file);
  const want = s.nodes.filter((n) => n.pageId === pid && n.from?.selector);
  const got = await v.evaluate((ids) => Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); const r = e?.getBoundingClientRect(); return [id, r ? [r.left, r.top, r.width] : null]; })), want.map((n) => n.id));
  const off = want.filter((n) => { const g = got[n.id]; return !g || !near(g[0], n.x ?? 0) || !near(g[1], n.y ?? 0) || !near(g[2], n.w); });
  check(`${pid}: ${want.length} parts at their captured x, y and width`, want.length > 0 && off.length === 0, off.slice(0, 4).map((n) => `${n.id} ${n.x},${n.y} ${n.w} → ${got[n.id]?.map(Math.round).join(",")}`).join("; "));
  if (pid === "page_home") await shot(v, "home-1763");
  await v.close();
}

for (const [width, height] of [[1922, 1080], [1366, 900], [1280, 800]]) {
  console.log(`2. At ${width} wide: the original's layout, 1:1`);
  const v = await open(width, height);
  const iw = await v.evaluate(() => innerWidth);
  const scroll = await v.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`${width}: no sideways scroll`, scroll <= 0, `${scroll}px`);
  const zoom = await v.evaluate(() => getComputedStyle(document.querySelector(".site-root")).zoom);
  check(`${width}: drawn 1:1, so browser zoom is the browser's (no page zoom)`, zoom === "1" || zoom === "normal", zoom);
  const hd = await rect(v, nodeBy(HEADER).id);
  check(`${width}: the header bar spans the window`, hd && near(hd.x, 0) && near(hd.r, iw) && near(hd.y, 0), JSON.stringify(hd));
  const rw = await rect(v, nodeBy(ROW).id);
  const rowW = Math.min(px(row.maxw), iw - header.pad[1] - header.pad[3]);
  check(`${width}: its contents centred at their natural size (max-width ${row.maxw})`, rw && near(rw.w, rowW) && near(rw.x, (iw - rowW) / 2), JSON.stringify(rw));
  const logo = s.nodes.find((n) => n.pageId === "page_home" && n.picture?.id === "pic_cc8659c3");
  const lg = await rect(v, logo.id);
  /* Centred in the row in the capture (its centre is the row's, ${row.x + row.w / 2}), so centred in it at any width. */
  /*
   * Seen centred in the row, as the real site draws it at every width. A
   * capture taken since boxes are measured untransformed records its box
   * (left: 50%) and its own move back (translate(-50%)) apart: where it is
   * seen is the box moved by that transform, read off the drawn picture.
   */
  const shift = (() => { const m = /matrix\(([^)]+)\)/.exec(logo.art?.transform ?? ""); return m ? Number(m[1].split(",")[4]) : 0; })();
  check(`${width}: the SOL WORKS logo centred in the row, at ${logo.w}px, at its captured height`, near(logo.x + shift + logo.w / 2, row.x + row.w / 2) && lg && rw && near(lg.x + shift + lg.w / 2, rw.x + rw.w / 2) && near(lg.w, logo.w) && near(lg.y, logo.y), JSON.stringify({ ...lg, shift }));
  const sd = await rect(v, nodeBy(ASIDE).id);
  check(`${width}: the sidebar flush left, ${sideW}px, the window's height between the bars`, sd && near(sd.x, 0) && near(sd.w, sideW) && near(sd.y, px(aside.ins[0])) && near(sd.b, height - px(aside.ins[2])), JSON.stringify(sd));
  const mn = await rect(v, nodeBy(MAIN).id);
  check(`${width}: the main column from the sidebar to the right edge`, mn && near(mn.x, mainL) && near(mn.r, iw), JSON.stringify(mn));
  const cardW = (iw - mainL - gap * (cols - 1)) / cols;
  const cards = await Promise.all([1, 2, 3, 4].map((i) => rect(v, nodeBy(`${GRID} > div:nth-of-type(${i})`).id)));
  check(`${width}: the ${cols} stat cards share it equally`, cards.every((c, i) => c && near(c.x, mainL + i * (cardW + gap)) && near(c.w, cardW)), cards.map((c) => c && `${Math.round(c.x)}+${Math.round(c.w)}`).join(", ") + ` (want ${Math.round(cardW)} each)`);
  const panels = await Promise.all([2, 3, 4].map((i) => rect(v, nodeBy(`${MAIN} > div > div:nth-of-type(${i})`).id)));
  check(`${width}: the PnL, Top Tokens and Your Tokens panels reach the right edge`, panels.every((p) => p && near(p.x, mainL) && near(p.r, iw)), panels.map((p) => p && `${Math.round(p.x)}..${Math.round(p.r)}`).join(", "));
  const ft = await rect(v, nodeBy(FOOTER).id);
  check(`${width}: the footer bar pinned to the window's foot, the window's width`, ft && near(ft.b, height) && near(ft.x, 0) && near(ft.r, iw) && near(ft.h, footer.h), JSON.stringify(ft));
  const fr = await rect(v, nodeBy(FROW).id);
  /* Its sides as the capture records them (`bsides`, clockwise from the top; sink check-border-sides.mjs), else one edge all round. */
  const sidesW = Array.isArray(footer.bsides) ? footer.bsides[1] + footer.bsides[3] : 2 * (px(footer.border ?? "0") || 0);
  const fRowW = Math.min(px(bySel.get(FROW).maxw), iw - footer.pad[1] - footer.pad[3] - sidesW);
  check(`${width}: the footer's contents centred like the header's`, fr && near(fr.x, (iw - fr.w) / 2) && near(fr.w, fRowW), JSON.stringify(fr));
  /* As wide as on the real site: the footer's edge is border-top only, so its row has the header's room (1248 at 1280). Needs a capture with per-side edges (sink check-border-sides.mjs). */
  check(`${width}: the footer's contents are as wide as the header's, as on the real site`, fr && near(fr.w, rowW), `${JSON.stringify(fr)} against ${rowW}`);
  const version = s.nodes.find((n) => n.pageId === "page_home" && /v2\.0\.0/.test(JSON.stringify(n.content ?? "")));
  const vr = version ? await rect(v, version.id) : null;
  check(`${width}: "v2.0.0 | A SolWorks project" on screen, right of the footer's centre`, !!vr && vr.b <= height && vr.x > width / 2 && vr.r <= iw, JSON.stringify(vr));
  /* The original's banner ends where the page below it begins (the sidebar's top inset and main's margin, 73px), so the cards' top edges are drawn in full just under it. */
  const edges = await v.evaluate((ids) => ids.map((id) => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); /* Whatever lies over the edge must let it show: a picture (the logo's transparent margin) or nothing painted. */
    const over = []; for (const h of document.elementsFromPoint(r.left + r.width / 2, r.top + 0.5)) { if (e.contains(h)) return over.every((o) => o.tagName === "IMG" || (getComputedStyle(o).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(o).backgroundImage === "none" && getComputedStyle(o).borderTopWidth === "0px")); over.push(h); } return false; }), [1, 2, 3, 4].map((i) => nodeBy(`${GRID} > div:nth-of-type(${i})`).id));
  check(`${width}: the cards' top edges are drawn in full, not under the banner`, edges.every(Boolean), JSON.stringify(edges));
  check(`${width}: the banner ends where the page below it begins (${mainT}px)`, hd && near(hd.b, mainT), `${hd?.b}`);
  if (width === 1922) {
    const glow = await v.evaluate((id) => { const b = document.getElementById(id)?.querySelector("div"); return b ? getComputedStyle(b).boxShadow : null; }, CARD1.id);
    check("the glow is published on that card", !!glow && /rgba\(0, 255, 0, 0\.1\) 0px 0px 15px/.test(glow), String(glow));
  }
  if (width !== 1280) await shot(v, `home-${width}`);
  await v.close();
}

/*
 * THE OWNER'S RULING: the original fits the whole screen with no scrolling,
 * and ours showed a scrollbar. A page that fit the capture's window (its
 * parts end at the foot of the lowest fixed band) fits the window exactly;
 * one that scrolls keeps scrolling, with no scrollbar shown.
 */
console.log("3. Fit, and no scrollbar");
for (const [file, width, height, fits] of [["index.html", W, H, true], ["index.html", 1922, 1080, false], ["docs/index.html", 1763, 900, false]]) {
  const v = await open(width, height, file);
  const m = await v.evaluate(() => ({
    over: document.documentElement.scrollHeight - innerHeight,
    bar: innerWidth - document.documentElement.clientWidth,
    hidden: getComputedStyle(document.documentElement).scrollbarWidth,
  }));
  const tag = `${file} at ${width}×${height}`;
  if (fits) check(`${tag}: fits the window exactly, nothing to scroll`, m.over <= 0, `${m.over}px over`);
  else {
    await v.mouse.wheel(0, 300);
    await v.waitForTimeout(300);
    const y = await v.evaluate(() => scrollY);
    check(`${tag}: still scrolls`, m.over > 0 && y > 0, `${m.over}px over, scrolled ${y}`);
  }
  check(`${tag}: no scrollbar shown`, m.bar === 0 && m.hidden === "none", JSON.stringify(m));
  await v.close();
}

/* A window shorter than the capture's: the page scrolls, nothing cut off, the header at the top and the footer at the foot (the coordinator's ruling: small laptops must reach everything). */
{
  const v = await open(1922, 700);
  const tall = await v.evaluate(() => document.documentElement.scrollHeight);
  const lowest = Math.max(...s.nodes.filter((n) => n.pageId === "page_home").map((n) => (n.y ?? 0) + n.h));
  await v.mouse.wheel(0, 5000);
  await v.waitForTimeout(400);
  const y = await v.evaluate(() => scrollY);
  const hd = await rect(v, nodeBy(HEADER).id), ft = await rect(v, nodeBy(FOOTER).id);
  check("in a 700px window the page scrolls to its lowest part, nothing cut off", tall >= lowest && near(y, tall - 700), JSON.stringify({ tall, lowest, scrolled: y }));
  check("…with the header at the top and the footer at the foot", hd && ft && near(hd.y, 0) && near(ft.b, 700), JSON.stringify({ header: hd?.y, footer: ft?.b }));
  await v.close();
}

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
