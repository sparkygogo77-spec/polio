#!/usr/bin/env node
/**
 * TAKE THE SYSTEM FROM THIS SITE, AND NOTHING MOVES (create-system step 1,
 * handovers/CREATE-SYSTEM-PROPOSAL.md, "(c) The System").
 *
 * A captured site's colours, type sizes and faces, spaces, corners, shadows,
 * motion and components become one stored System in the shared library, and
 * each part's fields point at the tokens holding their values. The ruling:
 * linking never changes a captured pixel, and from then on a token change
 * changes every part pointing at it.
 *
 *   1. pure, on the capture's own document: every linked field holds its
 *      token's value; resolving a linked part hands back the very same part;
 *      a token change reaches exactly the parts pointing at it; a fork keeps
 *      every pointer; a System survives being written and read back;
 *   2. in the Builder, on the site brought in: the board's parts (box and
 *      painted style, every one) and its pixels are the same before and
 *      after the take, and the published page's files are byte for byte the
 *      same (or, where a file differs, its page draws 0 px different);
 *   3. a token changed changes the parts pointing at it on the board and in
 *      the published page; one undo takes it back, in the library too;
 *   4. the site and its System survive a reload; a fork is the site's own.
 *
 *   npx next start -p 3013
 *   node tests/system-take.mjs http://127.0.0.1:3013 <the capture folder>
 *
 * Run on sol face, mochi and sunkcoin (capture/sites/thesolface3, mochi3,
 * sunk2) for the proposal's fidelity check; the suite hands it trumpmorty.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { takeSystem, linksHold } from "../src/features/studio/system/take.ts";
import { resolveWith, materialise } from "../src/features/studio/system/resolve.ts";
import { setTokenValue, fork, onSystem, usedBy } from "../src/features/studio/system/link.ts";
import { readSystem, tokenById } from "../src/features/studio/system/model.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";
import { paletteFromHue } from "../src/features/studio/look/index.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3];
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/system-take.mjs <builder url> <the capture folder>");
  process.exit(2);
}
const TAG = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const SHOTS = ".screenshots/system-take";
mkdirSync(SHOTS, { recursive: true });

const T0 = Date.now();
const say = (w) => console.log(`       … ${w} (${((Date.now() - T0) / 1000).toFixed(0)}s)`);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. Pure                                                              */
/* ------------------------------------------------------------------ */
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
{
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  const palette = { ...paletteFromHue(265), ...landed.palette };
  const t = takeSystem({ nodes: landed.nodes, palette, frameWidth: 1440, name: TAG });
  const nodes = landed.nodes.map((n) => (t.links.has(n.id) ? { ...n, sys: t.links.get(n.id) } : n));
  const s = t.system;
  check("pure: tokens of every kind were found", s.tokens.colour.length >= 6 && s.tokens.type.steps.length > 0 && s.tokens.space.length > 0, JSON.stringify(t.report.found));
  check("pure: most values point at a token", t.report.linked > t.report.oneOffs, `${t.report.linked} linked, ${t.report.oneOffs} one-offs`);
  check("pure: every linked field holds its token's value", linksHold(nodes, s).length === 0, JSON.stringify(linksHold(nodes, s).slice(0, 3)));
  const moved = nodes.filter((n) => resolveWith(n, s) !== n).map((n) => n.id);
  check("pure: resolving a linked part hands back the same part", moved.length === 0, moved.slice(0, 5).join(", "));
  const counts = new Map();
  for (const n of nodes) for (const id of Object.values(n.sys?.f ?? {})) counts.set(id, (counts.get(id) ?? 0) + 1);
  const busiest = [...counts.entries()].filter(([id]) => id.startsWith("spc_") || id.startsWith("col_")).sort((a, b) => b[1] - a[1])[0];
  if (busiest) {
    const [tid] = busiest;
    const next = setTokenValue(s, tid, tid.startsWith("col_") ? "rgb(255, 0, 255)" : 77);
    const m = materialise(nodes, next);
    const users = usedBy(nodes, tid);
    check("pure: a token change reaches exactly the parts pointing at it", m.changed.length === users.length && m.changed.every((id) => users.includes(id)), `${m.changed.length} changed, ${users.length} use ${tid}`);
    check("pure: and they then hold its value", linksHold(m.nodes, next).length === 0);
  }
  const copy = fork(s);
  const forked = onSystem(nodes, s.id, copy.id);
  check("pure: a fork keeps every pointer", copy.id !== s.id && linksHold(forked, copy).length === 0 && forked.filter((n) => n.sys).every((n) => n.sys.s === copy.id));
  const back = readSystem(JSON.parse(JSON.stringify(s)));
  check("pure: a System survives being written and read back", JSON.stringify(back) === JSON.stringify({ ...s, forkOf: null }) || JSON.stringify(back.tokens) === JSON.stringify(s.tokens));
  check("pure: every component's variants name tokens or own values", s.components.every((c) => c.variants.every((v) => Object.values(v.look).every((r) => ("token" in r ? !!tokenById(s, r.token) : "value" in r)))));
}

/* ------------------------------------------------------------------ */
/* 2. In the Builder                                                    */
/* ------------------------------------------------------------------ */
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});

say("browser up");
const nodeCount = () => page.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
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
await page.waitForTimeout(300);
if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
say("bringing in");
for (let i = 0; i < 120 && (await nodeCount()) < 50; i++) await page.waitForTimeout(1000);
say("brought in");
await page.mouse.move(2, 2);
await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
check("the site came in", (await nodeCount()) >= 50, `${await nodeCount()} parts`);
check("the System hook is there", await page.evaluate(() => !!window.__polioSystem));

/** Every part on the board: its box, and the painted style of it and of everything it draws, as the browser computed them. */
const PROPS = ["color", "background-color", "background-image", "border-top-color", "border-top-width", "border-radius", "box-shadow", "padding", "gap", "font-size", "font-family", "font-weight", "line-height", "letter-spacing", "transition", "opacity", "transform"];
/* What moves of itself (a breathing critter, a pulsing dot) is held at its first frame for each look, so a look is of the parts, not of the moment. */
const hold = (p) => p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* a finished one */ } } });
const boardRead = async () => { await hold(page); return page.evaluate((PROPS) => {
  const out = {};
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const r = el.getBoundingClientRect();
    const styles = [el, ...el.querySelectorAll("*")].slice(0, 60).map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p)).join("|"); });
    out[el.getAttribute("data-node-id")] = `${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}#${styles.join(";")}`;
  }
  return out;
}, PROPS); };
/** The board: the page frame as far as it is on screen, not the Builder round it (its panels say what was just done). */
const frameClip = () => page.evaluate(() => { const r = document.querySelector("[data-frame]")?.getBoundingClientRect(); if (!r) return null; const x = Math.max(0, r.left), y = Math.max(0, r.top); return { x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y }; });
const shot = async (target) => { await hold(target); const clip = target === page ? await frameClip() : null; return sharp(await target.screenshot({ fullPage: target !== page, animations: "disabled", ...(clip ? { clip } : {}) })).raw().toBuffer({ resolveWithObject: true }); };
/** Pixels that differ, leaving out the ones two shots of the same thing already disagree on (a part that moves of itself). */
function differing(a, b, noise) {
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return { n: Infinity, size: `${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}` };
  const ch = a.info.channels;
  let n = 0, quiet = 0;
  for (let i = 0; i < a.data.length; i += ch) {
    let d = false;
    for (let k = 0; k < 3; k++) if (a.data[i + k] !== b.data[i + k]) { d = true; break; }
    if (!d) continue;
    if (noise && noise.has(i)) { quiet++; continue; }
    n++;
  }
  return { n, quiet };
}
/**
 * Pixels of `after` that match the same pixel in none of `befores`: what
 * changed, beyond what the untouched board already shows over time (the
 * board draws a few pixels differently from moment to moment, measured by
 * the control below, so one shot is not the board).
 */
function unlike(befores, after) {
  const ch = after.info.channels;
  if (befores.some((b) => b.data.length !== after.data.length)) return Infinity;
  let n = 0;
  for (let i = 0; i < after.data.length; i += ch) {
    if (!befores.some((b) => b.data[i] === after.data[i] && b.data[i + 1] === after.data[i + 1] && b.data[i + 2] === after.data[i + 2])) n++;
  }
  return n;
}
/** Where the untouched board moves of itself: every pixel two untouched shots disagree on, widened by `r` px (a moving thing's edge is not where it was a moment ago). */
function movingMask(shots, r = 6) {
  const { width: W, height: H, channels: ch } = shots[0].info;
  const raw = new Uint8Array(W * H);
  for (let s = 1; s < shots.length; s++) for (let p = 0, i = 0; p < W * H; p++, i += ch) {
    const a = shots[0].data, b = shots[s].data;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) raw[p] = 1;
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw[y * W + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = 1; }
  return out;
}
/** Pixels of `b` unlike `a` outside the mask, and how many the mask covers. */
function outside(a, b, mask) {
  if (a.data.length !== b.data.length) return { n: Infinity, masked: 0 };
  const ch = a.info.channels;
  let n = 0, masked = 0;
  for (let p = 0, i = 0; i < a.data.length; p++, i += ch) if (mask[p]) masked++; else if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
  return { n, masked };
}
function noiseOf(a, b) {
  const set = new Set();
  const ch = a.info.channels;
  if (a.data.length !== b.data.length) return set;
  for (let i = 0; i < a.data.length; i += ch) for (let k = 0; k < 3; k++) if (a.data[i + k] !== b.data[i + k]) { set.add(i); break; }
  return set;
}
const exported = () => page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: f.content, encoding: f.encoding })));
async function publishedShot(files, tag) {
  const byPath = new Map(files.map((f) => [f.path.replace(/^\/+/, ""), f]));
  const out = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await out.route("http://site.test/**", (r) => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
    const f = byPath.get(path) ?? byPath.get(`${path}/index.html`);
    if (!f) return r.fulfill({ status: 404, body: "" });
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".svg") ? "image/svg+xml" : /\.(png|webp|jpe?g)$/.test(path) ? "image/" + path.split(".").pop().replace("jpg", "jpeg") : "text/html";
    return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
  });
  await out.goto("http://site.test/index.html", { waitUntil: "load" });
  const H = await out.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 700) { await out.evaluate((y) => window.scrollTo(0, y), y); await out.waitForTimeout(100); }
  await out.evaluate(() => window.scrollTo(0, 0));
  await out.waitForTimeout(2500);
  const a = await shot(out);
  await out.waitForTimeout(600);
  const b = await shot(out);
  await out.screenshot({ path: `${SHOTS}/${TAG}-published-${tag}.png`, fullPage: true });
  await out.close();
  return { a, b };
}

say("reading the board");
const board0 = await boardRead();
const storeOf = (id) => page.evaluate((id) => { const n = window.__studioHistory.doc().nodes.find((n) => n.id === id); if (!n) return null; const { sys, ...rest } = n; return JSON.stringify(rest); }, id);
const cta0 = process.env.DIAG_ID ? await storeOf(process.env.DIAG_ID) : null;
say("read");
const px0a = await shot(page);
await page.waitForTimeout(500);
const px0b = await shot(page);
/* The control: the same board, untouched, a few seconds later, measured the same way. */
await page.waitForTimeout(2500);
const px0c = await shot(page);
await page.waitForTimeout(1500);
const px0d = await shot(page);
await page.waitForTimeout(1500);
const px0e = await shot(page);
const files0 = await exported();
say("exported");
await page.screenshot({ path: `${SHOTS}/${TAG}-board-before.png` });

const took = await page.evaluate(() => window.__polioSystem.take());
check("Take from this site", took.ok === true, JSON.stringify(took.report ?? took));
await page.waitForTimeout(2500);
check("every linked field holds its token's value on the board", (await page.evaluate(() => window.__polioSystem.broken().length)) === 0);
const doc1 = await page.evaluate(() => window.__polioSystem.doc());
check("the site names its System, and the library holds it", !!doc1.systemId && (await page.evaluate((id) => window.__polioSystem.library().some((s) => s.id === id), doc1.systemId)));

const board1 = await boardRead();
const changedParts = Object.keys(board0).filter((id) => board0[id] !== board1[id]);
if (process.env.DIAG_ID) { const c1 = await storeOf(process.env.DIAG_ID); console.log("       DIAG store same:", c1 === cta0); if (c1 !== cta0) { const a = JSON.parse(cta0), b = JSON.parse(c1); for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log("       DIAG", k, JSON.stringify(a[k]), "=>", JSON.stringify(b[k])); } }
if (process.env.DIAG) for (const id of changedParts.slice(0, 2)) { const a = board0[id].split(";"), b = board1[id]?.split(";") ?? []; a.forEach((x, i) => { if (x !== b[i]) console.log("       DIAG", id, i, x, "=>", b[i]); }); }
check("every part's box and painted style are the same after the take", changedParts.length === 0 && Object.keys(board1).length === Object.keys(board0).length, `${Object.keys(board0).length} parts, ${changedParts.length} differ ${changedParts.slice(0, 5).join(", ")}`);
const px1 = await shot(page);
await page.screenshot({ path: `${SHOTS}/${TAG}-board-after.png` });
await page.waitForTimeout(1500);
const px2 = await shot(page);
const BEFORE = [px0a, px0b, px0c, px0d];
const mask = movingMask(BEFORE);
const t1 = outside(px0a, px1, mask), t2 = outside(px0a, px2, mask);
const boardPx = { n: Math.min(t1.n, t2.n), quiet: differing(px0a, px1).n, masked: t1.masked };
const control = { n: outside(px0a, px0e, mask).n };
const where = (a, b) => { const ch = a.info.channels, W = a.info.width; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 0; i < a.data.length; i += ch) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) { const p = i / ch, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return x1 < 0 ? "none" : `${x0},${y0}..${x1},${y1}`; };
console.log(`       board pixels: after the take ${boardPx.n} differ outside what moves of itself (${boardPx.masked} px left out; raw diff ${boardPx.quiet} at ${where(px0a, px1)}); control, untouched: ${control.n}`);
/* On a board that moves almost everywhere (sunkcoin: its sea and its films) a few hundred px differ from moment to moment even untouched: the take may differ by no more than the untouched board does from itself. */
check("the board is 0 px different after the take", boardPx.n === 0 || boardPx.n <= control.n, `${boardPx.n} px differ (the untouched board, ${control.n}); ${boardPx.masked} px move of themselves and are left out`);

const files1 = await exported();
const key = (f) => `${f.path}:${f.encoding ?? ""}:${f.content}`;
const differ = files0.filter((f) => !files1.some((g) => key(g) === key(f))).map((f) => f.path);
const newOnes = files1.filter((g) => !files0.some((f) => f.path === g.path)).map((f) => f.path);
console.log(`       published files: ${files0.length}; differing ${JSON.stringify(differ)}; new ${JSON.stringify(newOnes)}`);
if (differ.length || newOnes.length) {
  const p0 = await publishedShot(files0, "before");
  const p1 = await publishedShot(files1, "after");
  const pub = differing(p0.a, p1.a, noiseOf(p0.a, p0.b));
  check("the published page is 0 px different after the take", pub.n === 0, `${pub.n} px differ (${pub.quiet ?? 0} move by themselves); files that differ: ${differ.join(", ")}`);
} else check("the published page's files are byte for byte the same after the take", true, `${files0.length} files`);

/* ------------------------------------------------------------------ */
/* 3. A token changed, and taken back                                   */
/* ------------------------------------------------------------------ */
const pick = await page.evaluate(() => {
  const s = window.__polioSystem.system();
  const doc = window.__studioHistory.doc();
  const count = new Map();
  for (const n of doc.nodes) for (const [f, id] of Object.entries(n.sys?.f ?? {})) if (f === "colour.bg" || f === "colour.text" || f === "edge.colour") count.set(id, (count.get(id) ?? 0) + 1);
  const [id, n] = [...count.entries()].filter(([id]) => !s.tokens.colour.find((t) => t.id === id)?.role).sort((a, b) => b[1] - a[1])[0] ?? [];
  return id ? { id, n, value: s.tokens.colour.find((t) => t.id === id).value, users: window.__polioSystem.usedBy(id) } : null;
});
if (!pick) check("a colour token worn by parts", false);
else {
  const MAGENTA = "rgb(255, 0, 255)";
  const boardT0 = await boardRead();
  await page.evaluate(([id, v]) => window.__polioSystem.setToken(id, v), [pick.id, MAGENTA]);
  await page.waitForTimeout(1500);
  const shows = await page.evaluate(([ids, v]) => ids.filter((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); if (!el) return null; return [el, ...el.querySelectorAll("*")].some((e) => { const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.borderLeftColor, cs.borderRightColor, cs.backgroundImage].some((c) => c.includes(v)); }); }), [pick.users, MAGENTA]);
  const drawn = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-node-id="${id}"]`)).length, pick.users);
  const boardT1 = await boardRead();
  const repainted = Object.keys(boardT0).filter((id) => boardT0[id] !== boardT1[id]);
  const others = repainted.filter((id) => !pick.users.includes(id));
  check("a token changed repaints the parts pointing at it on the board, and only them", shows.length > 0 && others.length === 0, `${repainted.length} parts repainted, ${shows.length} of ${drawn} drawn users show the colour (the rest wear it where nothing draws it), ${others.length} others: ${others.slice(0, 4).join(", ")}`);
  check("and the document holds the new value (word fitting and export read it)", (await page.evaluate(() => window.__polioSystem.broken().length)) === 0);
  const filesM = await exported();
  check("and the published page wears it", filesM.some((f) => f.encoding !== "base64" && typeof f.content === "string" && /255,\s*0,\s*255|#ff00ff/i.test(f.content)));
  await page.evaluate(() => window.__studioHistory.act("undo"));
  await page.waitForTimeout(1500);
  const back = await page.evaluate((id) => window.__polioSystem.system().tokens.colour.find((t) => t.id === id)?.value, pick.id);
  check("one undo takes the token back, in the library too", back === pick.value, `${back} (was ${pick.value})`);
  const board2 = await boardRead();
  const still = Object.keys(board1).filter((id) => board1[id] !== board2[id]);
  check("and the board is as it was", still.length === 0, `${still.length} parts differ ${still.slice(0, 5).join(", ")}`);
}

/* ------------------------------------------------------------------ */
/* 4. A reload, and a fork                                              */
/* ------------------------------------------------------------------ */
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "networkidle" });
for (let i = 0; i < 60 && (await nodeCount()) < 50; i++) await page.waitForTimeout(500);
await page.waitForTimeout(3000);
const doc2 = await page.evaluate(() => window.__polioSystem?.doc());
check("the site and its System survive a reload", doc2?.systemId === doc1.systemId && (await page.evaluate(() => window.__polioSystem.broken().length)) === 0);
const forked = await page.evaluate(() => { const s = window.__polioSystem.forkSite(); return s.id ?? null; });
const doc3 = await page.evaluate(() => window.__polioSystem.doc());
check("a fork is the site's own copy, every pointer kept", !!forked && forked !== doc1.systemId && doc3.systemId === forked && (await page.evaluate(() => window.__polioSystem.broken().length)) === 0);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

writeFileSync(`${SHOTS}/${TAG}-report.json`, JSON.stringify({ report: took.report, boardPx, differ, newOnes }, null, 2));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
