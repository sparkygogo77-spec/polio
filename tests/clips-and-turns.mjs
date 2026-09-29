#!/usr/bin/env node
/**
 * TRUMPMORTY.FUN AGAINST ITS COPY, ROUND TWO: WHAT A ROUNDED BOX CUTS, WHAT
 * TURNS ABOUT WHAT, WHERE THE RIBBON'S WORDS RUN, AND WORDS SET WHOLE.
 *
 * THE OWNER'S REPORT, his site next to ours at 1440 and 2000:
 *   (1) the TV's picture stuck out past the screen's rounded corners, on the
 *       board as on the published page (the screen is `border-radius:
 *       28px/34px; overflow: hidden`); the board's wrappers clipped nothing;
 *   (2) the antenna's rods swung through each other and the red balls stayed
 *       put, off the tips (each rod turns about its foot, the ball is its
 *       `::after`);
 *   (3) the ribbon's words drifted out of the ribbon and were cut level
 *       (the marquee slid the part with its window, inside an untilted clip);
 *   (4) the emoji in each HOW TO BUY circle sat up and to the left
 *       (`place-items: center`);
 *   (5) the H of HOW TO BUY lost its left edge (its 4px outline, clipped);
 *   (6) the CA bar's yellow ends were square past its rounding;
 *   (7) the headings' letters were a little off: drawn at 700 in a face that
 *       has only 400, so the browser thickened them.
 *
 * sink's trumpmorty.fun is brought in through the real door, and read in
 * pixels on the board (at 1:1), in the Preview and on the exported page, with
 * every animation held at its start where a picture is compared:
 *   · the screen's and the bar's corners, outside their curve, are the same
 *     with the picture (the end cells) drawn and hidden: nothing of them
 *     shows past the curve (1, 6), on all three;
 *   · the board draws the TV's screen and the CA bar as the export does, to
 *     within a few levels a pixel (the owner's board-vs-export check);
 *   · picked on the board, the cut picture is still the part a press takes
 *     and a drag moves, and what its box cuts off shows faintly;
 *   · each ball stays on its rod's tip while both sway, and the tips stay
 *     apart (2), in the Preview and on the export;
 *   · along the red ribbon, every stretch of it carries its white words, at
 *     1440 and 2000, and still after the marquee has run (3);
 *   · the emoji's line is centred in its circle (4);
 *   · ink of the H's outline lies left of the heading's box (5);
 *   · a heading is drawn at the weight the page gave it (7).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/clips-and-turns.mjs http://127.0.0.1:3013 <path to a sink checkout>
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
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`usage: node tests/clips-and-turns.mjs <builder url> <sink checkout>; no ${SITE}/site/document.json`); process.exit(2); }
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
const r1 = (n) => Math.round(n * 10) / 10;

/* The parts, found by what the page made them from. */
const sel = (n) => n.from?.selector ?? "";
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const TV = "body > main > section:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(2) > div";
const screen = doc.nodes.find((n) => sel(n) === `${TV} > div:nth-of-type(2) > div:nth-of-type(1)`);
const picture = doc.nodes.find((n) => n.featureId === "picture" && screen && sel(n).startsWith(`${sel(screen)} > `));
const bar = doc.nodes.find((n) => sel(n) === "body > main > section:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(1) > button");
const ends = bar ? doc.nodes.filter((n) => sel(n) === `${sel(bar)} > span:nth-of-type(1)` || sel(n) === `${sel(bar)} > span:nth-of-type(3)`) : [];
const rods = [1, 2].map((i) => doc.nodes.find((n) => sel(n) === `${TV} > div:nth-of-type(1) > i:nth-of-type(${i})`));
const balls = [1, 2].map((i) => doc.nodes.find((n) => sel(n) === `${TV} > div:nth-of-type(1) > i:nth-of-type(${i})::after`));
const RED_BG = "rgb(210, 60, 52)";
const redRow = doc.nodes.find((n) => n.colour?.bg === RED_BG && /^body > main > div > div:nth-of-type\(\d\)$/.test(sel(n)));
const redWords = redRow ? doc.nodes.find((n) => sel(n) === `${sel(redRow)} > div`) : null;
const icon = doc.nodes.find((n) => words(n) === "👛");
const how = doc.nodes.find((n) => words(n) === "HOW TO BUY");
const chart = doc.nodes.find((n) => words(n) === "LIVE CHART");
check("sink's document has the TV's screen and picture, the CA bar and its ends, the rods and balls, the red ribbon, an icon and the headings",
  !!(screen && picture && bar && ends.length === 2 && rods.every(Boolean) && balls.every(Boolean) && redRow && redWords && icon && how && chart),
  J({ screen: screen?.id, picture: picture?.id, bar: bar?.id, ends: ends.map((n) => n.id), rods: rods.map((n) => n?.id), balls: balls.map((n) => n?.id), redRow: redRow?.id, redWords: redWords?.id, icon: icon?.id, how: how?.id, chart: chart?.id }));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
/* A window the board draws its 1440 page in at 1:1 (the fit is by height). */
const page = await browser.newPage({ viewport: { width: 2200, height: 1305 }, deviceScaleFactor: 1 });
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
await page.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
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

const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
check("the site exports", Array.isArray(files) && files.some((f) => f.path === "index.html"), J((files ?? []).map((f) => f.path).slice(0, 5)));
const out = mkdtempSync(join(tmpdir(), "clips-turns-"));
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

/* ------------------------------------------------------------------ */
/* Pixels: read in a page of their own.                                 */
/* ------------------------------------------------------------------ */
const reader = await browser.newPage();
await reader.setContent("<canvas></canvas>");
/** RGBA of a PNG, as a small handle the reader keeps. */
const load = (buf) => reader.evaluate(async (b64) => {
  const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
  const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height);
  (window.__px ??= []).push(d);
  return window.__px.length - 1;
}, buf.toString("base64"));
const at = (h, pts) => reader.evaluate(([h, pts]) => { const d = window.__px[h]; return pts.map(([x, y]) => { const i = (Math.round(y) * d.width + Math.round(x)) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2]]; }); }, [h, pts]);
const meanDiff = (a, b) => reader.evaluate(([a, b]) => { const A = window.__px[a], B = window.__px[b]; const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height); let s = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * A.width + x) * 4, j = (y * B.width + x) * 4; s += (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2])) / 3; } return s / (w * h); }, [a, b]);
const dist = (p, q) => Math.max(...p.map((v, k) => Math.abs(v - q[k])));

/** Every loop on the page held at its start, so two pictures of it are of the same moment; what plays once (a reveal) played to its end. */
const hold = (p) => p.evaluate(() => { for (const a of document.getAnimations()) { if (a.effect?.getComputedTiming?.().iterations === Infinity) { a.pause(); a.currentTime = 0; } else { try { a.finish(); } catch { a.pause(); } } } });
/** A part's element on a surface, and its untransformed box in the window. */
const find = (p, how, id) => p.evaluate(([how, id]) => {
  const e = how === "id" ? document.getElementById(id) : document.querySelector(`[${how}="${id}"]`);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, [how, id]);
const shot = async (p, box) => p.screenshot({ clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.w), height: Math.round(box.h) } });
/* Hidden by a rule that outranks the page's own reveals and inline styles: the part and everything in it. */
const hide = (p, how, ids, on) => p.evaluate(([how, ids, on]) => {
  document.getElementById("__hide")?.remove();
  if (!on) return;
  const st = document.createElement("style"); st.id = "__hide";
  st.textContent = ids.map((id) => { const s = how === "id" ? `[id="${id}"]` : `[${how}="${id}"]`; return `${s}, ${s} * { visibility: hidden !important; }`; }).join("\n");
  document.head.append(st);
}, [how, ids, on]);

/*
 * Outside the curve, drawn and hidden alike. Points in from each corner of
 * `box` along the diagonal, in the band between its outer curve and the
 * inner one its children are cut to (the screen: 6 to 12px in, the bar: 4
 * to 6): with `parts` hidden and drawn they must read the same.
 */
const cornersClean = async (p, how, box, parts, inset) => {
  const pts = [];
  for (const k of inset) pts.push([k, k], [box.w - 1 - k, k], [box.w - 1 - k, box.h - 1 - k], [k, box.h - 1 - k]);
  await hide(p, how, parts, true); await p.waitForTimeout(80);
  const bare = await at(await load(await shot(p, box)), pts);
  await hide(p, how, parts, false); await p.waitForTimeout(80);
  const drawn = await at(await load(await shot(p, box)), pts);
  const worst = Math.max(...bare.map((b, i) => dist(b, drawn[i])));
  return { worst, at: pts[bare.findIndex((b, i) => dist(b, drawn[i]) === worst)] };
};

/* The rods' tips and the balls' middles, in the window, from the transforms as drawn. */
const antenna = (p, how) => p.evaluate(([how, rods, balls]) => {
  const el = (id) => (how === "id" ? document.getElementById(id) : document.querySelector(`[${how}="${id}"]`));
  const turned = (id) => { const w = el(id); if (!w) return null; let t = w; while (t && getComputedStyle(t).transform === "none" && t.firstElementChild) t = t.firstElementChild; return { w, t }; };
  const place = (id, fx, fy) => {
    const got = turned(id); if (!got) return null;
    const cs = getComputedStyle(got.t), r = got.w.getBoundingClientRect();
    const m = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform);
    const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
    const w = got.t.offsetWidth, h = got.t.offsetHeight;
    const q = new DOMPoint(fx * w - ox, fy * h - oy).matrixTransform(m);
    return [r.x + ox + q.x, r.y + oy + q.y, Math.atan2(m.b, m.a) * 180 / Math.PI];
  };
  return { tips: rods.map((id) => place(id, 0.5, 0)), balls: balls.map((id) => place(id, 0.5, 0.5)) };
}, [how, rods.map((n) => n.id), balls.map((n) => n.id)]);
const antennaHolds = async (label, p, how) => {
  const seen = [];
  for (let i = 0; i < 4; i++) { seen.push(await antenna(p, how)); await p.waitForTimeout(700); }
  const off = Math.max(...seen.flatMap((s) => s.tips.map((t, i) => (t && s.balls[i] ? Math.hypot(t[0] - s.balls[i][0], t[1] - s.balls[i][1]) : 1e9))));
  const sway = Math.max(...[0, 1].map((i) => Math.max(...seen.map((s) => s.tips[i]?.[2] ?? 0)) - Math.min(...seen.map((s) => s.tips[i]?.[2] ?? 0))));
  const apart = Math.min(...seen.map((s) => (s.tips[1]?.[0] ?? 0) - (s.tips[0]?.[0] ?? 0)));
  check(`${label}: each red ball stays on its rod's tip while the rods sway, and the tips stay apart`, off < 7 && sway > 1.5 && apart > 60, J({ ballFromTip: r1(off), swayDeg: r1(sway), tipsApart: r1(apart) }));
};

/* Along the red ribbon, its words: near-white pixels in every stretch of the tape's width. */
const ribbonWords = async (p, how, W) => {
  const tape = await find(p, how, doc.nodes.find((n) => sel(n) === "body > main > div")?.id);
  if (!tape) return { bins: [], empty: -1 };
  const band = { x: 0, y: Math.max(0, tape.y), w: W, h: Math.round(tape.h) };
  const h = await load(await shot(p, band));
  const bins = await reader.evaluate(([h, W]) => { const d = window.__px[h]; const out = []; for (let b = 40; b + 120 <= W - 40; b += 120) { let n = 0; for (let y = 0; y < d.height; y++) for (let x = b; x < b + 120; x++) { const i = (y * d.width + x) * 4; if (d.data[i] > 235 && d.data[i + 1] > 235 && d.data[i + 2] > 235) n++; } out.push(n); } return out; }, [h, W]);
  return { bins, empty: bins.filter((n) => n < 30).length };
};

/* ------------------------------------------------------------------ */
/* The board, at 1:1.                                                   */
/* ------------------------------------------------------------------ */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.mouse.move(2, 2);
const zoomNow = () => page.evaluate(() => document.querySelector("[data-frame]").getBoundingClientRect().width / 1440);
/* The board fits its first screen to the window's height: the height that makes it 1:1. */
for (let i = 0, z = await zoomNow(); i < 4 && Math.abs(z - 1) >= 0.002; i++, z = await zoomNow()) {
  await page.setViewportSize({ width: 2200, height: Math.round(page.viewportSize().height - (z - 1) * 900) });
  await page.waitForTimeout(900);
}
const zoom = await zoomNow();
check("the board draws its 1440 page at 1:1 in this window", Math.abs(zoom - 1) < 0.01, `zoom ${zoom.toFixed(4)}`);
await page.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`)?.scrollIntoView({ block: "center" }), screen.id);
await page.waitForTimeout(800);
{
  /* Picked, it is still the part: a press at its middle takes it, a (Ctrl) drag moves it, and what is cut off shows faintly. */
  const pb = await find(page, "data-node-id", picture.id);
  await page.mouse.click(pb.x + pb.w / 2, pb.y + pb.h / 2);
  await page.waitForTimeout(400);
  const picked = await page.evaluate(() => [...document.querySelectorAll('[data-node-id] > [data-part-drawn][data-mode="live"]')].map((e) => e.parentElement.getAttribute("data-node-id")));
  const ghost = await page.evaluate((id) => !!document.querySelector(`[data-node-id="${id}"] [data-cut-ghost]`), picture.id);
  const x0 = (await state()).nodes.find((n) => n.id === picture.id)?.x;
  await page.waitForTimeout(1200); /* past a double press, which opens a part for handling rather than moving it */
  /* It holds the screen's scanlines, glare and caption, so a plain press on it draws a marquee; Ctrl moves it on purpose (Canvas.tsx, "A part that holds others"). */
  await page.mouse.move(pb.x + pb.w / 2, pb.y + pb.h / 2);
  await page.keyboard.down("Control");
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(pb.x + pb.w / 2 + (40 * i) / 12, pb.y + pb.h / 2);
  await page.mouse.up();
  await page.keyboard.up("Control");
  await page.waitForTimeout(800);
  const pb1 = await find(page, "data-node-id", picture.id);
  const after = (await state()).nodes;
  const x1 = after.find((n) => n.id === picture.id)?.x;
  check("board: the cut picture is the part a press takes and a drag (Ctrl, as it holds others) moves, and its cut-off shows faintly while picked", picked.includes(picture.id) && ghost && Math.abs(x1 - x0 - 40) <= 2 && Math.abs(pb1.x - pb.x - 40) <= 2, J({ picked, ghost, stored: [x0, x1], drawn: [r1(pb.x), r1(pb1.x)] }));
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
}
await page.mouse.click(4, 400); /* the ground: nothing picked, as the pictures below are taken */
await page.waitForTimeout(600);
await hold(page);
const boardPix = {};
{
  const sb = await find(page, "data-node-id", screen.id), bb = await find(page, "data-node-id", bar.id);
  const s = await cornersClean(page, "data-node-id", sb, [picture.id], [6, 7, 8, 9, 10, 11, 12]);
  check("(1) board: nothing of the TV's picture shows past the screen's rounded corners", s.worst <= 12, J(s));
  const c = await cornersClean(page, "data-node-id", bb, ends.map((n) => n.id), [4, 5, 6]);
  check("(6) board: the CA bar's end cells are cut to its rounded corners", c.worst <= 12, J(c));
  boardPix.screen = await load(await shot(page, sb)); boardPix.bar = await load(await shot(page, bb));
  await page.waitForTimeout(400);
}

/* ------------------------------------------------------------------ */
/* The Preview.                                                         */
/* ------------------------------------------------------------------ */
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/builder/preview`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40 && (await page.evaluate(() => !!document.querySelector("[data-crt]"))); i++) await page.waitForTimeout(250);
await page.waitForTimeout(6000);
await page.evaluate((id) => document.querySelector(`[data-live-node="${id}"]`)?.scrollIntoView({ block: "center" }), screen.id);
await page.waitForTimeout(800);
await antennaHolds("(2) Preview", page, "data-live-node");
await hold(page);
{
  const s = await cornersClean(page, "data-live-node", await find(page, "data-live-node", screen.id), [picture.id], [6, 7, 8, 9, 10, 11, 12]);
  check("(1) Preview: nothing of the TV's picture shows past the screen's rounded corners", s.worst <= 12, J(s));
  const c = await cornersClean(page, "data-live-node", await find(page, "data-live-node", bar.id), ends.map((n) => n.id), [4, 5, 6]);
  check("(6) Preview: the CA bar's end cells are cut to its rounded corners", c.worst <= 12, J(c));
}

/* ------------------------------------------------------------------ */
/* The published page, at 1440 and 2000.                                */
/* ------------------------------------------------------------------ */
for (const W of [1440, 2000]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
  await p.goto(SITEURL, { waitUntil: "load" });
  await p.waitForTimeout(7000);
  /* The ribbon, once the marquee has run a while, and its words still in it. */
  await p.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "center" }), redRow.id);
  await p.waitForTimeout(12000);
  const rw = await ribbonWords(p, "id", W);
  check(`(3) export ${W}: every stretch of the red ribbon carries its words, after the marquee has run 12s`, rw.bins.length > 5 && rw.empty === 0, J(rw));
  await p.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "center" }), screen.id);
  await p.waitForTimeout(600);
  if (W === 1440) await antennaHolds("(2) export 1440", p, "id");
  await hold(p);
  const sb = await find(p, "id", screen.id), bb = await find(p, "id", bar.id);
  const s = await cornersClean(p, "id", sb, [picture.id], [6, 7, 8, 9, 10, 11, 12]);
  check(`(1) export ${W}: nothing of the TV's picture shows past the screen's rounded corners`, s.worst <= 12, J(s));
  const c = await cornersClean(p, "id", bb, ends.map((n) => n.id), [4, 5, 6]);
  check(`(6) export ${W}: the CA bar's end cells are cut to its rounded corners`, c.worst <= 12, J(c));
  if (W === 1440) {
    /* The owner's check: the board draws the TV's screen and the CA bar as the export does. */
    const ds = await meanDiff(boardPix.screen, await load(await shot(p, sb)));
    const db = await meanDiff(boardPix.bar, await load(await shot(p, bb)));
    check("board vs export at 1440: the TV's screen and the CA bar, pixel for pixel, within a few levels", ds < 6 && db < 6, J({ screen: r1(ds), bar: r1(db) }));
  }
  /* (4) The emoji in the middle of its circle, as the grid centres it: its line's box against the circle's (both under whatever tilt the card has). */
  await p.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "center" }), icon.id);
  await p.waitForTimeout(400);
  const off = await p.evaluate((id) => {
    const e = document.getElementById(id); if (!e) return null;
    const ring = [...e.querySelectorAll("*")].find((k) => parseFloat(getComputedStyle(k).borderTopWidth) > 0) ?? e;
    const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let t = null; while (walk.nextNode()) if (walk.currentNode.textContent.trim()) { t = walk.currentNode; break; }
    if (!t) return null;
    const rg = document.createRange(); rg.selectNodeContents(t);
    const a = rg.getBoundingClientRect(), b = ring.getBoundingClientRect();
    return { dx: a.x + a.width / 2 - (b.x + b.width / 2), dy: a.y + a.height / 2 - (b.y + b.height / 2), text: [a.width, a.height].map(Math.round) };
  }, icon.id);
  check(`(4) export ${W}: the emoji sits in the middle of its circle`, !!off && Math.abs(off.dx) <= 1.5 && Math.abs(off.dy) <= 1.5, J(off && { dx: r1(off.dx), dy: r1(off.dy), text: off.text }));
  /* (5) The H's outline is drawn on its left as on its right: along each row, the first thing met from the left is the outline's ink, not the white of the letter cut flat. */
  await p.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "center" }), how.id);
  await p.waitForTimeout(1500);
  const hb = await find(p, "id", how.id);
  const strip = await load(await shot(p, { x: hb.x - 6, y: hb.y + 6, w: 40, h: Math.round(hb.h) - 12 }));
  const rows = await reader.evaluate((h) => { const d = window.__px[h]; let ink = 0, cut = 0; for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) { const i = (y * d.width + x) * 4, [r, g, b] = [d.data[i], d.data[i + 1], d.data[i + 2]]; if (r < 70 && g < 70 && b < 70) { ink++; break; } if (r > 235 && g > 235 && b > 235) { cut++; break; } } return { ink, cut }; }, strip);
  check(`(5) export ${W}: the H of HOW TO BUY keeps its outline on its left edge`, rows.ink >= 20 && rows.cut <= 2, `rows met first by ink ${rows.ink}, by the letter's white ${rows.cut}`);
  const weights = await p.evaluate((ids) => ids.map((id) => { const e = document.getElementById(id); const t = e && [...e.querySelectorAll("*")].find((k) => k.childNodes.length && [...k.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())); return t ? getComputedStyle(t).fontWeight : null; }), [how.id, chart.id]);
  check(`(7) export ${W}: the headings are drawn at the weight the page gave them (${how.font?.weight}), not thickened`, weights.every((w) => Number(w) === how.font?.weight), J(weights));
  await ctx.close();
}
check("no page errors", errors.length === 0, J(errors.slice(0, 3)));
server.close();
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
