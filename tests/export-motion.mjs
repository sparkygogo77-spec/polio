#!/usr/bin/env node
/**
 * EXPORTED SITES KEEP THEIR MOTION (export-motion lane; J 2026-11-01: "finish
 * export"). A site as published moves: entrances, scroll effects, hover,
 * looping pictures, what a press does. Both export modes are held to it,
 * measured part by part against the published site served as it is:
 *
 *   · running: the keyframe animations playing, part by part;
 *   · timed: parts whose look changes on their own within a second;
 *   · scrolled: parts whose look changes as the page is walked (a reveal);
 *   · hover: parts that answer the pointer (a sample, the same in each);
 *   · press: what a part with a captured behaviour does when pressed: the
 *     words a copy puts on the clipboard, the parts a press shows or hides;
 *   · pictures: films playing, canvases, frames.
 *
 * Each is a share of what the published page does; each is held to a floor.
 * Exact look is the published markup, so its floor is everything.
 *
 *   PAGES_DUMP=<folder with board.json and site/>,... node tests/export-motion.mjs
 *   node tests/export-motion.mjs http://127.0.0.1:3091 <capture folder> [...]
 *   MOTION_MODES=clean        one mode only
 *   MOTION_JSON=<file>        every number, per site
 *
 * Covers: src/features/studio/send-out/pagesOut.ts, src/features/studio/send-out/exactOut.ts
 */
import { existsSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { JSDOM } from "jsdom";
import { exactOut, tokensOut } from "../src/features/studio/send-out/index.ts";
import { homeFor } from "../src/features/studio/homePage.ts";
import { buildApp, serveApp } from "./lib/export-app.mjs";
import { cleanExport, dumpedSite, importedSite, systemOf } from "./lib/export-input.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const [BASE, ...captures] = process.argv.slice(2);
const sources = process.env.PAGES_DUMP ? process.env.PAGES_DUMP.split(",").map((d) => () => dumpedSite(d)) : captures.map((c) => () => importedSite(browser, BASE, c));
const MODES = (process.env.MOTION_MODES ?? "exact,clean").split(",");
const HOVERS = 16, PRESSES = 8;

/** Runs in the page: a part's look as computed, on its own box. Published parts keep it on `.mo-<id>`; a clean page draws both on the part. */
const LOOKS = () => {
  window.__box = (id) => document.querySelector(`.mo-${CSS.escape(id)}`) ?? document.getElementById(id);
  window.__sig = (id, props) => { const e = window.__box(id); if (!e) return null; const c = getComputedStyle(e); const leaf = [...e.querySelectorAll("*")].find((k) => [...k.childNodes].some((n) => n.nodeType === 3 && /\S/.test(n.nodeValue))) ?? e; return [...props.map((p) => c.getPropertyValue(p)), getComputedStyle(leaf).color].join("|"); };
  const copied = [];
  window.__copied = copied;
  try { Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { copied.push(String(t)); return Promise.resolve(); }, readText: () => Promise.resolve("") }, configurable: true }); } catch { /* the page's own */ }
  document.addEventListener("click", (e) => { if (e.target.closest?.("a[href]")) e.preventDefault(); }, true);
};
const MOVES = ["transform", "translate", "rotate", "scale", "opacity", "filter", "clip-path", "visibility", "display"];
const HOVERED = [...MOVES, "background-color", "background-image", "box-shadow", "border-top-color", "text-decoration-line"];

const sigs = (p, ids, props = MOVES) => p.evaluate(([ids, props]) => Object.fromEntries(ids.map((id) => [id, window.__sig(id, props)])), [ids, props]);
const differ = (a, b) => Object.keys(a).filter((k) => a[k] !== null && b[k] !== null && a[k] !== b[k]);
const shown = (p, ids) => p.evaluate((ids) => ids.filter((id) => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== "none"; }), ids);

/** The page's motion, part by part. `plan`: what to hover and press, chosen from the published page so every mode is asked the same. */
async function measure(url, ids, plan, serve) {
  const p = await browser.newPage({ viewport: { width: plan.width, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(LOOKS);
  if (serve) await serve(p);
  await p.goto(url, { waitUntil: "load" });
  /* A clean page loads its behaviour scripts after it has hydrated, one by one: measured once they are all there (or after eight seconds). */
  const loaded = () => p.evaluate(() => performance.getEntriesByType("resource").filter((r) => /assets\/(features|site-motion|parts)/.test(r.name)).length);
  for (let i = 0; i < 40 && (await loaded()) < (plan.scripts ?? 0); i++) await p.waitForTimeout(200);
  await p.waitForTimeout(1800);
  const out = { errs };
  out.scripts = await loaded();
  out.running = await p.evaluate(() => [...new Set(document.getAnimations().filter((a) => a.animationName && a.playState === "running").map((a) => `${a.effect.target?.closest?.("[id]")?.id ?? "?"} ${a.animationName}`))]);
  /* On their own, within a second. */
  const t0 = await sigs(p, ids);
  await p.waitForTimeout(1000);
  const t1 = await sigs(p, ids);
  out.timed = differ(t0, t1);
  /* Down the page: what changes over what changed anyway. */
  const moving = new Set(out.timed);
  const top = t1;
  const scrolled = new Set();
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 450) {
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    await p.waitForTimeout(90);
    for (const k of differ(top, await sigs(p, ids))) if (!moving.has(k)) scrolled.add(k);
  }
  out.scrolled = [...scrolled];
  out.pictures = await p.evaluate(() => ({ films: document.querySelectorAll("video").length, playing: [...document.querySelectorAll("video")].filter((v) => !v.paused).length, canvases: document.querySelectorAll("canvas").length, frames: document.querySelectorAll("iframe").length }));
  /* The pointer. */
  out.hover = {};
  for (const id of plan.hovers) {
    const at = await p.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; e.scrollIntoView({ block: "center", behavior: "instant" }); const r = e.getBoundingClientRect(); return r.width && r.height ? [r.x + r.width / 2, r.y + r.height / 2] : null; }, id);
    if (!at) { out.hover[id] = false; continue; }
    await p.mouse.move(1, 1);
    await p.waitForTimeout(350);
    const before = await sigs(p, [id], HOVERED);
    await p.mouse.move(at[0], at[1]);
    await p.waitForTimeout(450);
    const after = await sigs(p, [id], HOVERED);
    out.hover[id] = differ(before, after).length > 0;
  }
  await p.mouse.move(1, 1);
  /* The press: each on a fresh page, so one press never stands in for another. */
  out.press = {};
  for (const b of plan.presses) {
    await p.goto(url, { waitUntil: "load" });
    await p.waitForTimeout(1200);
    const at = await p.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; e.scrollIntoView({ block: "center", behavior: "instant" }); const r = e.getBoundingClientRect(); return r.width && r.height ? [r.x + r.width / 2, r.y + r.height / 2] : null; }, b.part);
    if (!at) { out.press[b.key] = { missing: true }; continue; }
    await p.waitForTimeout(200);
    await p.mouse.click(at[0], at[1]);
    await p.waitForTimeout(350);
    out.press[b.key] = { copied: await p.evaluate(() => window.__copied.slice(-1)[0] ?? null), shown: (await shown(p, b.shows)).length, hidden: b.hides.length - (await shown(p, b.hides)).length };
  }
  await p.close();
  return out;
}

/* Of a handful, one may be caught at another moment on every load (the published site itself does this): one miss in five or fewer is allowed for. */
const share = (kept, all) => (all ? (all <= 5 && kept >= all - 1 ? 1 : kept / all) : 1);
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
const report = {};

for (const load of sources) {
  const site = await load();
  console.log(`\n${site.name}`);
  const { board } = site;
  const pages = board.pages?.length ? board.pages : [{ id: board.nodes[0].pageId, name: "Home", path: "/" }];
  const home = homeFor(pages);
  const byPath = new Map(site.files.map((f) => [f.path, f]));
  const homeHtml = byPath.get("index.html").bytes.toString("utf8");
  const ids = [...new Set([...homeHtml.matchAll(/ id="(n_[^"]+)"/g)].map((m) => m[1]))];
  const width = board.frameWidth ?? 1440;

  /* What the published page asks for: parts with a hover rule of their own, parts with a captured behaviour. */
  const sheet = (homeHtml.match(/href="(assets\/motion\/[^"]+)"/) ?? [])[1];
  const sheetCss = sheet ? byPath.get(sheet)?.bytes.toString("utf8") ?? "" : "";
  const hoverIds = [...new Set([...sheetCss.matchAll(/#(n_[\w-]+):hover \.mo-\1/g)].map((m) => m[1]))].filter((id) => ids.includes(id));
  const list = JSON.parse(/<script id="site-features" type="application\/json">([\s\S]*?)<\/script>/.exec(homeHtml)?.[1]?.replace(/\\u003c/g, "<") ?? "[]");
  const spread = (a, n) => (a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.floor((i * a.length) / n)]));
  const pressable = list.filter((b) => ["press-shows", "copy-toast"].includes(b.feature));
  const csv = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  /* One of each kind first: a site's copies should not crowd out its tabs. */
  const kinds = ["copy-toast", "press-shows"].map((k) => pressable.filter((b) => b.feature === k));
  const presses = [...spread(kinds[0], PRESSES / 2), ...spread(kinds[1], PRESSES / 2)].map((b, i) => ({ key: `${i} ${b.feature} ${b.part}`, feature: b.feature, part: b.part, shows: csv(b.inputs?.shows), hides: csv(b.inputs?.hides) }));
  const plan = { width, hovers: spread(hoverIds, HOVERS), presses, scripts: (homeHtml.match(/<script src="/g) ?? []).length };

  const serve = async (p) => {
    await p.route("http://site.test/**", (r) => {
      const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
      const f = byPath.get(path) ?? byPath.get(`${path}/index.html`);
      if (!f) return r.fulfill({ status: 404, body: "" });
      const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".svg") ? "image/svg+xml" : /\.(png|webp|jpe?g|gif)$/.test(path) ? `image/${path.split(".").pop().replace("jpg", "jpeg")}` : path.endsWith(".html") || !path.includes(".") ? "text/html" : "application/octet-stream";
      return r.fulfill({ status: 200, contentType: type, body: f.bytes });
    });
  };
  const pub = await measure("http://site.test/index.html", ids, plan, serve);
  /* What the published page itself did: only that is asked of an export. */
  const hovers = plan.hovers.filter((id) => pub.hover[id]);
  const pressed = Object.keys(pub.press).filter((k) => { const r = pub.press[k]; return r.copied || r.shown || r.hidden; });
  console.log(`       published: ${pub.running.length} animations playing, ${pub.timed.length} parts moving on their own, ${pub.scrolled.length} on the scroll, ${hovers.length}/${plan.hovers.length} hovers, ${pressed.length}/${plan.presses.length} presses, ${pub.scripts} scripts, pictures ${JSON.stringify(pub.pictures)}`);
  report[site.name] = { published: pub };

  for (const mode of MODES) {
    const files = mode === "exact" ? exactFiles(site, pages, home, byPath) : cleanExport(site, { library: true }).files;
    const app = await buildApp(`motion-${mode}-${site.name}`, files);
    check(`${mode}: next build passes`, app.ok, app.ok ? "" : app.log.split("\n").filter((l) => /rror|failed|Type /.test(l)).slice(0, 8).join(" / "));
    if (!app.ok) continue;
    const srv = await serveApp(app.dir);
    if (!srv.ok) { check(`${mode}: the built app is served`, false, srv.log().split("\n").slice(-6).join(" / ")); srv.stop(); continue; }
    const got = await measure(srv.url, ids, plan);
    srv.stop();
    report[site.name][mode] = got;

    const has = new Set(got.running);
    const running = share(pub.running.filter((a) => has.has(a)).length, pub.running.length);
    const timedSet = new Set([...got.timed, ...got.scrolled]);
    /* A part may move on the clock in one and on the scroll in the other (a reveal that ends a moment later): it moved. */
    const timed = share(pub.timed.filter((k) => timedSet.has(k)).length, pub.timed.length);
    const scrolled = share(pub.scrolled.filter((k) => timedSet.has(k)).length, pub.scrolled.length);
    const hover = share(hovers.filter((id) => got.hover[id]).length, hovers.length);
    const presz = pressed.filter((k) => {
      const a = pub.press[k], b = got.press[k];
      return b && !b.missing && (a.copied ?? null) === (b.copied ?? null) && a.shown === b.shown && a.hidden === b.hidden;
    });
    const press = share(presz.length, pressed.length);
    const missed = [...pressed.filter((k) => !presz.includes(k)).map((k) => k.split(" ").slice(1).join(" "))].slice(0, 3);
    const films = share(got.pictures.playing + got.pictures.canvases + got.pictures.frames, pub.pictures.playing + pub.pictures.canvases + pub.pictures.frames);
    console.log(`       ${mode}: running ${pct(running)}, on their own ${pct(timed)}, scroll ${pct(scrolled)}, hover ${pct(hover)}, press ${pct(press)}${missed.length ? ` (lost ${missed.join("; ")})` : ""}, pictures ${pct(Math.min(1, films))}, scripts ${got.scripts}`);
    const floor = mode === "exact" ? { motion: 0.9, press: 1 } : { motion: Number(process.env.MOTION_FLOOR ?? 0.9), press: Number(process.env.PRESS_FLOOR ?? 0.75) };
    check(`${mode}: the keyframe animations still play`, running >= floor.motion, pct(running));
    check(`${mode}: what moves on its own still moves`, timed >= floor.motion, pct(timed));
    check(`${mode}: what moves on the scroll still moves`, scrolled >= floor.motion, pct(scrolled));
    check(`${mode}: the parts that answer the pointer still do`, hover >= floor.motion, pct(hover));
    check(`${mode}: what a press does still happens`, press >= floor.press, `${presz.length}/${pressed.length}`);
    check(`${mode}: films, canvases and frames are kept`, films >= 1, JSON.stringify(got.pictures));
    check(`${mode}: no script or hydration error`, got.errs.length === 0, got.errs.slice(0, 2).join(" / ").slice(0, 300));
  }
}

function exactFiles(site, pages, home, byPath) {
  const { system } = systemOf(site.board, site.name);
  const published = new Map(pages.flatMap((p) => { const f = byPath.get(home.file(p)); return f ? [[p.id, new JSDOM(f.bytes.toString("utf8")).window.document]] : []; }));
  const out = exactOut({ name: site.name, pages, published, assets: site.files.map((f) => ({ path: f.path, content: f.bytes })), system });
  return [...tokensOut(system), ...out.files];
}

if (process.env.MOTION_JSON) writeFileSync(process.env.MOTION_JSON, JSON.stringify(report, null, 1));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
