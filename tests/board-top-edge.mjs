/**
 * THE TOP OF THE PAGE IS NEVER CUT OFF ON THE BOARD.
 *
 * THE OWNER'S REPORT, trunk 1772851: PST (sparkygogo77-spec/PST) brought
 * into a blank site, Home open at about 51%. The page's name ("Home / 1440 x
 * ...") and the four orange ! on the nav's links (Play, Leaderboard, My
 * profile, How it works) sat over the page's top edge and its first row, so
 * the top of the page looked cut off. The live page has its nav 8px down.
 *
 * The rule, at 51%, 100% and Fit in view, on PST's Home, trumpmorty.fun and
 * parasiteonsol.fun:
 *   1. the page's name sits wholly above the page and over no part on it;
 *   2. no ! covers the page's edge, the name, or its own part;
 *   3. the board leaves the name room above the page, and neither the board
 *      nor anything round it clips the name or the page's first 40px;
 *   4. every part in that first 40px shows where it starts: nothing of the
 *      board's is drawn over it;
 *   5. scrolled 500px at 51%, the page's edge and its first row move up the
 *      board together by 500, like a sheet of paper, and the page ends where
 *      its last shown part does. J's second report: the border stayed and
 *      the site slid up into nothing, because parts hidden as the page opens
 *      made PST's Home 2607px tall for 1574px of site.
 *
 * PST's Home is read the way the zip door reads a page (`PARTS`, then
 * `pagesToDoc`), from a checkout's web/ folder served with its scripts held
 * back: `PST=path/to/PST` (default ../PST). The captured sites are sink's.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-top-edge.mjs http://127.0.0.1:3013 ../sink/sites/trumpmorty-fun
 *
 * Covers: src/features/studio/Canvas.tsx, src/features/studio/store.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { PARTS } from "../src/features/studio/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/pageParts.ts";
import { launch, sinkRoot, siteDoc } from "./fixtures/look-sites.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK_ROOT = sinkRoot(process.argv[3]);
const PST = process.env.PST ?? "../PST";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await launch();

/** PST's Home as the zip door lands it: its web/ served, no script let run. */
async function pstDoc() {
  const web = join(PST, "web");
  if (!existsSync(join(web, "index.html"))) return null;
  const types = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
  const server = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "") || "index.html";
    const at = join(web, p);
    if (!at.startsWith(web) || !existsSync(at) || extname(at) === ".js") { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[extname(at)] ?? "application/octet-stream" });
    res.end(readFileSync(at));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const bare = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await bare.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 404, body: "" }));
  await bare.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "load" });
  const read = await bare.evaluate(PARTS, 1500);
  await bare.close();
  server.close();
  return pagesToDoc([{ file: "site/index.html", read }], { at: 1 }).doc;
}

/** What is on screen at the page's top: the frame, the name, every ! and the parts in the first 40px. */
const READ = () => {
  const frame = document.querySelector("[data-frame]").getBoundingClientRect();
  const z = frame.width / 1440;
  const box = (r) => ({ x: r.left, y: r.top, r: r.right, b: r.bottom });
  /* Where anything round the board would cut: every clipping box above the frame, intersected. */
  let clip = { x: -1e9, y: -1e9, r: 1e9, b: 1e9 };
  for (let e = document.querySelector("[data-frame]").parentElement; e && e !== document.documentElement; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (/(auto|scroll|hidden|clip)/.test(s.overflowY + s.overflowX)) {
      const r = e.getBoundingClientRect();
      clip = { x: Math.max(clip.x, r.left), y: Math.max(clip.y, r.top), r: Math.min(clip.r, r.right), b: Math.min(clip.b, r.bottom) };
    }
  }
  clip = { ...clip, y: Math.max(clip.y, 0), b: Math.min(clip.b, innerHeight) };
  const label = document.querySelector("[data-page-label]");
  const parts = [...document.querySelectorAll("[data-node-id]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.getAttribute("data-node-id"), ...box(r), w: r.width, h: r.height };
  }).filter((p) => p.w > 1 && p.h > 1);
  const top = parts.filter((p) => p.y >= frame.top - 0.5 && p.y < frame.top + 40 * z);
  /* Each first-row part, sampled along its top: what is drawn there is the part or something inside it. */
  const covered = [];
  for (const p of top) {
    for (const fx of [0.1, 0.5, 0.9]) {
      const x = p.x + (p.r - p.x) * fx, y = p.y + Math.min(3, p.h / 2);
      if (x < clip.x || x > clip.r || y < clip.y || y > clip.b) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit?.closest("[data-page-label], [data-decide]")) covered.push(`${p.id} under ${hit.closest("[data-page-label]") ? "the name" : "a !"}`);
    }
  }
  return {
    z, frame: box(frame), clip, covered,
    label: label ? box(label.getBoundingClientRect()) : null,
    badges: [...document.querySelectorAll("[data-decide]")].map((b) => ({ for: b.getAttribute("data-decide-for"), ...box(b.getBoundingClientRect()) })),
    parts, top: top.map((p) => p.id),
  };
};

const meet = (a, b) => Math.min(a.r, b.r) - Math.max(a.x, b.x) > 0.5 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 0.5;

async function walk(name, doc) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  /* Every part's ! on the board, as the top bar's count shows them (`decideShown.ts`): by default only the picked part wears one. */
  await page.addInitScript(() => localStorage.setItem("builder.decideBadges.v1", "all"));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
  await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "top-edge", name: "top-edge", updatedAt: Date.now() }], activeId: "top-edge" }));
    localStorage.setItem("builder.studio", env({ nodes: [] }));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const home = doc.pages.find((p) => p.path === "/") ?? doc.pages[0];
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: home.id });
  await page.waitForTimeout(2500);

  for (const at of [0.51, 1, "fit"]) {
    await page.evaluate((z) => window.__studioZoom(z), at);
    await page.waitForTimeout(900);
    /* The top of the board, as a person scrolled up to it sees it ("fit" leaves the scroll where the fit put it). */
    if (at !== "fit") {
      await page.evaluate(() => {
        for (let e = document.querySelector("[data-frame]"); e; e = e.parentElement) if (e.scrollTop) e.scrollTop = 0;
      });
      await page.waitForTimeout(400);
    }
    const s = await page.evaluate(READ);
    const say = `${name} at ${at === "fit" ? "fit" : `${Math.round(at * 100)}%`} (${Math.round(s.z * 100)}% drawn)`;
    const L = s.label;
    check(`${say}: the page's name sits wholly above the page`, !!L && L.b <= s.frame.y + 0.5, L ? `name ${L.y.toFixed(1)}–${L.b.toFixed(1)}, page top ${s.frame.y.toFixed(1)}` : "no name");
    const onPage = s.parts.filter((p) => p.y >= s.frame.y - 0.5);
    const underName = L ? onPage.filter((p) => meet(L, p)).map((p) => p.id) : [];
    check(`${say}: the name is over no part on the page`, underName.length === 0, underName.slice(0, 5).join(", "));
    check(`${say}: the board and its frame clip neither the name nor the page's first 40px`, !!L && L.y >= s.clip.y - 0.5 && s.frame.y >= s.clip.y - 0.5 && s.frame.y + 40 * s.z <= s.clip.b, `clip top ${s.clip.y.toFixed(1)}, name top ${L?.y.toFixed(1)}, page top ${s.frame.y.toFixed(1)}`);
    const acrossEdge = s.badges.filter((b) => b.y < s.frame.y - 0.5 && b.b > s.frame.y + 0.5).map((b) => b.for);
    const onName = L ? s.badges.filter((b) => meet(b, L)).map((b) => b.for) : [];
    const onOwn = s.badges.filter((b) => { const p = s.parts.find((q) => q.id === b.for); return p && meet(b, p); }).map((b) => b.for);
    check(`${say}: no ! stands across the page's top edge`, acrossEdge.length === 0, acrossEdge.join(", "));
    check(`${say}: no ! covers the page's name`, onName.length === 0, onName.join(", "));
    check(`${say}: no ! covers its own part`, onOwn.length === 0, onOwn.join(", "));
    check(`${say}: the first row (${s.top.length} part${s.top.length === 1 ? "" : "s"}) shows along its top, nothing of the board's over it`, s.covered.length === 0, s.covered.slice(0, 5).join(", "));
    if (name === "PST Home") check(`${say}: the nav's links have their !`, s.badges.length >= 4 && s.top.length > 0, `${s.badges.length} !, ${s.top.length} parts in the first 40px`);
  }
  /*
   * 5. Scrolled, the page is a sheet of paper: its edge and its first row go
   *    up the board together, by exactly what the wheel moved, and the page
   *    ends where its last part does (no blank page for the site to slide
   *    away into, nothing of it past the page's foot).
   */
  await page.evaluate((z) => window.__studioZoom(z), 0.51);
  await page.waitForTimeout(900);
  await page.evaluate(() => { for (let e = document.querySelector("[data-frame]"); e; e = e.parentElement) if (e.scrollTop) e.scrollTop = 0; });
  await page.waitForTimeout(400);
  const paneTop = () => page.evaluate(() => { let t = 0; for (let e = document.querySelector("[data-frame]"); e; e = e.parentElement) t += e.scrollTop; return t; });
  const before = await page.evaluate(READ);
  const top0 = await paneTop();
  const over = { x: (before.frame.x + before.frame.r) / 2, y: Math.min(before.clip.b - 40, before.frame.y + 200) };
  await page.mouse.move(over.x, over.y);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(900);
  const after = await page.evaluate(READ);
  /* 500, or what is left of the page if it ends sooner: the board scrolls no further than its own foot. */
  const scrolled = (await paneTop()) - top0;
  const moved = after.frame.y - before.frame.y;
  check(`${name} at 51%: scrolled down 500px, the page's edge went up the board by what the board scrolled`, scrolled > 0 && Math.abs(moved + scrolled) <= 1, `board scrolled ${scrolled}, page moved ${moved.toFixed(1)}`);
  const lag = before.top.map((id) => {
    const a = before.parts.find((p) => p.id === id), b = after.parts.find((p) => p.id === id);
    return { id, d: b ? b.y - a.y : NaN };
  }).filter((p) => !(Math.abs(p.d - moved) <= 1));
  check(`${name} at 51%: and its first row went with it, by the same amount`, before.top.length > 0 && lag.length === 0, lag.slice(0, 4).map((p) => `${p.id} ${p.d}`).join(", "));
  const foot = Math.max(...after.parts.filter((p) => p.y >= after.frame.y - 0.5).map((p) => p.b));
  check(`${name} at 51%: nothing on the page runs past the page's foot`, foot <= after.frame.b + 1, `last part ends ${foot.toFixed(1)}, page ends ${after.frame.b.toFixed(1)}`);
  const tail = (after.frame.b - foot) / after.z;
  check(`${name} at 51%: the page ends where the site does, no blank page below it`, tail <= 48 || (after.frame.b - after.frame.y) / after.z <= 1000, `${Math.round(tail)}px of empty page under the last part`);
  check(`${name}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await page.close();
}

const pst = await pstDoc();
if (pst) await walk("PST Home", pst);
else check(`PST's web/index.html is at ${PST}`, false, "set PST=path/to/a PST checkout");
for (const site of ["trumpmorty-fun", "parasiteonsol-fun"]) {
  if (existsSync(join(SINK_ROOT, "sites", site, "site", "document.json"))) {
    /* One of trumpmorty's 262 parts carries no `options`, and the board throws on it (`opt` in spec.ts):
       not this test's subject, so the gap is filled here rather than the whole board lost. */
    const doc = siteDoc(SINK_ROOT, site);
    await walk(site, { ...doc, nodes: doc.nodes.map((n) => ({ options: {}, ...n })) });
  }
  else check(`${site} is in the sink checkout at ${SINK_ROOT}`, false);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
