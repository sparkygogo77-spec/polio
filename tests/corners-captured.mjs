#!/usr/bin/env node
/**
 * EVERY ROUNDED CORNER AND CLIP A CAPTURE RECORDED, IN THE EXPORT.
 *
 * The owner still saw trumpmorty.fun boxes sharp in places. Each element the
 * capture recorded as painting something (a fill, an edge, a shadow, a
 * picture or words; sink `sites/<site>/capture/routes/page_home.json`),
 * square or rounded, and each one a rounded box that clips cuts, is found as
 * its part in the document and on the published page, at 1440 and 2000, and
 * compared:
 *
 *   · radius: each corner as the browser draws it (neighbours that overrun a
 *     side scaled down together) on the part's own box, where its fill, edge
 *     and states go: both square, both full (a pill), or within 1px;
 *   · clip: a part the capture cut to a rounded box's curve (the converter's
 *     `art.clipPath … round`) is cut the same way on the page: a clip-path
 *     with the curve on its painted box, or an overflow-hidden rounded box
 *     round it;
 *   · spill: a rounded part inside a rounded box that clips is inside that
 *     box's curve on the page too.
 *
 * Prints every box that differs, with what differs, and a count per width.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/corners-captured.mjs http://127.0.0.1:3013 [sink checkout] [site folder] [--list] [--site <published url>] [--original <the site, or a copy of its files>]
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--site" && all[i - 1] !== "--original");
const BASE = (args[0] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = args[1] ?? join(here, "..", "..", "sink");
const SITE = args[2] ?? "trumpmorty-fun";
const LIST = process.argv.includes("--list");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`);
};
const J = (v) => JSON.stringify(v);

const root = join(SINK, "sites", SITE);
const doc = JSON.parse(readFileSync(join(root, "site", "document.json"), "utf8"));
const cap = JSON.parse(readFileSync(join(root, "capture", "routes", "page_home.json"), "utf8"));
const home = doc.pages[0].id;

/* The capture's path (`body>main:1>section:1>div:4`) and the document's selector (`body > main > section:nth-of-type(1) > div:nth-of-type(4)`), both without the first-of-type mark. */
const norm = (s) => s.replace(/:nth-of-type\(1\)/g, "").replace(/\s*>\s*/g, ">");
const fromPath = (p) => norm(p.replace(/::(before|after)$/, "").split(">").map((x) => { const [t, i] = x.split(":"); return i && i !== "1" ? `${t}:nth-of-type(${i})` : t; }).join(">")) + (/::(before|after)$/.exec(p)?.[0] ?? "");
const bySel = new Map();
for (const n of doc.nodes) if (n.pageId === home && n.from?.selector) { const k = norm(n.from.selector); if (!bySel.has(k)) bySel.set(k, n); }

/* What the capture says of each element: its corners, whether it clips round, and whether a rounded box that clips cuts it. */
const want = [];
(function walk(e, up) {
  if (!e) return;
  const rad = e.radius ?? [0, 0, 0, 0];
  const clipper = up.find((a) => a.ov?.rad && a.ov.rad.some(([x]) => x > 0));
  const inCorner = clipper && (() => {
    const [bx, by, bw, bh] = clipper.ov.box, r = clipper.ov.rad;
    const corners = [[e.x < bx + r[0][0], e.y < by + r[0][1]], [e.x + e.w > bx + bw - r[1][0], e.y < by + r[1][1]], [e.x + e.w > bx + bw - r[2][0], e.y + e.h > by + bh - r[2][1]], [e.x < bx + r[3][0], e.y + e.h > by + bh - r[3][1]]];
    return corners.some(([a, b], i) => a && b && r[i][0] > 0);
  })();
  const paints = !!(e.bg || e.border || e.shadow || e.bgi || e.src || e.text);
  if (e.p && paints) want.push({ p: e.p, t: e.t, text: (e.text ?? "").slice(0, 20), box: [e.x, e.y, e.w, e.h], rad, inCorner: !!inCorner, clipper: clipper?.p ?? null });
  for (const k of e.kids ?? []) walk(k, e.ov ? [e, ...up] : up);
})(cap.tree, []);
const paired = want.map((w) => ({ ...w, node: bySel.get(fromPath(w.p)) ?? null }));
const lost = paired.filter((w) => !w.node);
if (LIST) for (const w of lost) console.log(`         not a part: <${w.t}> ${J(w.text)} corners ${J(w.rad)}${w.inCorner ? " cut" : ""}   (${w.p})`);
console.log(`       ${want.length} painted elements in the capture (${want.filter((w) => w.rad.some((r) => r > 0.5)).length} rounded, ${want.filter((w) => w.inCorner).length} cut by a rounded clip); ${paired.length - lost.length} found as parts, ${lost.length} not parts (folded or dropped)`);

/* The document, published the way the Builder publishes it. */
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const builder = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await builder.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await builder.evaluate(() => localStorage.clear());
await builder.reload({ waitUntil: "networkidle" });
await builder.waitForTimeout(800);
await builder.evaluate((d) => window.__studioLoadDoc(d), { ...doc, pages: [doc.pages[0]], nodes: doc.nodes.filter((n) => n.pageId === home) });
await builder.waitForTimeout(1500);
const files = await builder.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
/* `--site <url>`: measure a page already published (the owner's own copy) instead of this build's export. */
const PUBLISHED = (() => { const i = process.argv.indexOf("--site"); return i > 0 ? process.argv[i + 1] : null; })();
const out = mkdtempSync(join(tmpdir(), "corners-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const server = http.createServer((req, res) => {
  let q = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(q) && statSync(q).isDirectory()) q = join(q, "index.html");
  if (!existsSync(q)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": q.endsWith(".html") ? "text/html" : q.endsWith(".css") ? "text/css" : q.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  res.end(readFileSync(q));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

/* On the page: the part's painted box (the element that draws its fill, edge or shadow), its corners as px, and the clips round it. */
const READ = (items) => items.map(({ id }) => {
  const el = document.getElementById(id);
  if (!el) return { id, missing: true };
  /* The part's own box: the one the Builder draws round it (its fill, edge, corners and states go there), else the element. */
  let box = el.querySelector("[data-part-box]") ?? el.firstElementChild;
  while (box && getComputedStyle(box).display === "contents") box = box.firstElementChild;
  box = box ?? el;
  const cs = getComputedStyle(box), r = box.getBoundingClientRect();
  const w = box.offsetWidth || r.width, h = box.offsetHeight || r.height;
  const px = (v, of) => { const [a] = String(v).split(" "); const n = parseFloat(a) || 0; return /%/.test(a) ? (n / 100) * of : n; };
  const rad = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map((c) => px(cs[`border${c}Radius`], w));
  /* A curve that cuts it: a clip-path with `round` on the part, anything in it or round it, or a rounded box that clips its overflow round it. */
  let clipRound = [el, ...el.querySelectorAll("*")].some((e) => /round/.test(getComputedStyle(e).clipPath));
  for (let e = el.parentElement; e && e !== document.body && !clipRound; e = e.parentElement) {
    const c = getComputedStyle(e);
    if (/round/.test(c.clipPath)) clipRound = true;
    if ((c.overflow === "hidden" || c.overflow === "clip" || c.overflowX === "hidden") && ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].some((k) => parseFloat(c[`border${k}Radius`]) > 0)) clipRound = true;
  }
  return { id, rad, clipRound, w, h };
});

/* Corners as the browser draws them: where two neighbours add up to more than the side, all are scaled down together (CSS Backgrounds 3, §5.5). */
const used = (rad, w, h) => {
  const f = Math.min(1, w / Math.max(1e-6, rad[0] + rad[1]), w / Math.max(1e-6, rad[3] + rad[2]), h / Math.max(1e-6, rad[0] + rad[3]), h / Math.max(1e-6, rad[1] + rad[2]));
  return rad.map((r) => r * f);
};
/* The same corner: both square, both full (half the shorter side: a pill or a circle), or within 1px as a share of the box. */
const sameCorner = (a, aw, ah, b, bw, bh) => {
  const fullA = a >= Math.min(aw, ah) / 2 - 0.75, fullB = b >= Math.min(bw, bh) / 2 - 0.75;
  if (a < 0.5 && b < 0.5) return true;
  if (fullA && fullB) return true;
  return Math.abs(a - b) <= 1 + Math.abs(a) * Math.abs(1 - bw / Math.max(1, aw));
};

const differs = {};
for (const W of [1440, 2000]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  if (!PUBLISHED) await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await p.goto(PUBLISHED ?? `http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const items = paired.filter((w) => w.node).map((w) => ({ id: w.node.id, box: w.box }));
  const got = new Map((await p.evaluate(READ, items)).map((g) => [g.id, g]));
  const bad = [];
  for (const w of paired.filter((x) => x.node)) {
    const g = got.get(w.node.id);
    const why = [];
    if (!g || g.missing) why.push("not on the page");
    else {
      const cap = used(w.rad, w.box[2], w.box[3]), ours = used(g.rad, g.w, g.h);
      if (cap.some((r, i) => !sameCorner(r, w.box[2], w.box[3], ours[i], g.w, g.h))) why.push(`corners ${J(ours.map((v) => Math.round(v * 10) / 10))} for ${J(cap.map((v) => Math.round(v * 10) / 10))}`);
      if (w.inCorner && !g.clipRound) why.push(`not cut to ${w.clipper}'s curve`);
    }
    if (why.length) bad.push({ id: w.node.id, t: w.t, text: w.text, p: w.p, why: why.join("; ") });
  }
  differs[W] = bad;
  console.log(`       at ${W}: ${bad.length} of ${items.length} differ`);
  if (LIST) for (const b of bad) console.log(`         ${b.id} <${b.t}> ${J(b.text)} ${b.why}   (${b.p})`);
  await ctx.close();
}
/*
 * `--original <url>`: the site itself (or a copy of its own files), and each
 * rounded box read off the pixels on both pages: a corner is square where its
 * corner pixel is the colour of the middle of its edge (its border or its
 * fill), rounded where it is not. Turned boxes are left out: their screenshot
 * is the box round the turn.
 */
const ORIGINAL = (() => { const i = process.argv.indexOf("--original"); return i > 0 ? process.argv[i + 1] : null; })();
const drawn = {};
if (ORIGINAL) {
  const pathSel = (pth) => pth.split(">").map((x, i) => { if (!i) return x; const [t, n] = x.split(":"); return `${t}:nth-of-type(${n ?? 1})`; }).join(" > ");
  const CORNERS = async (p, get) => {
    const h = await get(p);
    if (!h) return null;
    const png = await h.screenshot({ animations: "disabled" }).catch(() => null);
    if (!png) return null;
    return p.evaluate(async (b64) => {
      const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext("2d");
      g.drawImage(bm, 0, 0);
      const at = (x, y) => Array.from(g.getImageData(Math.max(0, Math.min(bm.width - 1, x)), Math.max(0, Math.min(bm.height - 1, y)), 1, 1).data.slice(0, 3));
      const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 40);
      const W = bm.width - 1, H = bm.height - 1, mx = W >> 1, my = H >> 1;
      /* Each corner's own pixel against the middle of each edge it sits on. */
      return [[[1, 1], [1, my], [mx, 1]], [[W - 1, 1], [W - 1, my], [mx, 1]], [[W - 1, H - 1], [W - 1, my], [mx, H - 1]], [[1, H - 1], [1, my], [mx, H - 1]]]
        .map(([k, e1, e2]) => (near(at(...k), at(...e1)) || near(at(...k), at(...e2)) ? "square" : "round"));
    }, png.toString("base64"));
  };
  const rounded = paired.filter((w) => w.node && !w.p.includes("::") && w.box[2] >= 16 && w.box[3] >= 16 && used(w.rad, w.box[2], w.box[3]).some((r) => r >= 6) && !(w.node.art?.transform && /matrix\((?!1, 0, 0, 1)/.test(w.node.art.transform)));
  for (const W of [1440, 2000]) {
    const ctxA = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const ctxB = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const a = await ctxA.newPage(), b = await ctxB.newPage();
    await a.goto(ORIGINAL, { waitUntil: "load" }).catch(() => {});
    if (!PUBLISHED) await b.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await b.goto(PUBLISHED ?? `http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
    await a.waitForTimeout(4500); await b.waitForTimeout(2500);
    /* The original's loader goes; nothing else of it is touched. */
    await a.evaluate(() => { document.getElementById("loader")?.remove(); document.body.classList.remove("is-loading"); });
    const bad = [];
    for (const w of rounded) {
      const live = await CORNERS(a, (p) => p.$(pathSel(w.p)));
      const ours = await CORNERS(b, (p) => p.evaluateHandle((id) => { const el = document.getElementById(id); let x = el?.firstElementChild; while (x && getComputedStyle(x).display === "contents") x = x.firstElementChild; return x ?? el; }, w.node.id).then((h) => h.asElement()));
      if (!live || !ours) continue;
      const want = used(w.rad, w.box[2], w.box[3]);
      const off = [0, 1, 2, 3].filter((i) => want[i] >= 6 && live[i] === "round" && ours[i] !== "round");
      if (off.length) bad.push({ id: w.node.id, t: w.t, text: w.text, p: w.p, why: `drawn ${J(ours)} where the original draws ${J(live)}` });
    }
    drawn[W] = bad;
    console.log(`       drawn at ${W}: ${bad.length} of ${rounded.length} rounded boxes are square where the original is round`);
    if (LIST) for (const x of bad) console.log(`         ${x.id} <${x.t}> ${J(x.text)} ${x.why}   (${x.p})`);
    await ctxA.close(); await ctxB.close();
  }
}
check("at 1440 every rounded or cut box is rounded and cut as captured", differs[1440].length === 0, differs[1440].map((b) => `${b.id}: ${b.why}`).join(" | "));
if (ORIGINAL) for (const W of [1440, 2000]) check(`drawn at ${W}: every corner the original draws round is round`, drawn[W].length === 0, drawn[W].map((x) => `${x.id}: ${x.why}`).join(" | "));
check("…and at 2000", differs[2000].length === 0, differs[2000].map((b) => `${b.id}: ${b.why}`).join(" | "));

await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
