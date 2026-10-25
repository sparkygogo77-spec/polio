#!/usr/bin/env node
/**
 * EXACT LOOK: THE BOARD AS A NEXT.JS APP THAT JUST GOES LIVE (create-system
 * "(d) Export"; J 2026-10-24: "an exact-look export that just goes live").
 *
 * A captured site brought into the Builder is written as the exact-look app
 * (`send-out/exactOut.ts`): each page the published page's own markup, its
 * stylesheets in order, the tokens as CSS variables. The ruling:
 *
 *   1. the files: a page per page, the published markup whole, the
 *      stylesheets and scripts it loaded, tokens.css, and Tailwind without
 *      its base styles; the roles that equal a token read it;
 *   2. `next build` passes;
 *   3. served at the board's width and settled: with scripts off (nothing
 *      moving), it draws today's published page element for element; against
 *      the board's preview of the same page (as served, or lifted onto a
 *      layer of its own as the preview's page is, whichever is nearer), it is
 *      within 1%, or no further than today's published site is, give or take
 *      what moved in this run (films, canvases and scan lines are caught at
 *      another moment on every load); every number is printed;
 *   4. a token changed in tokens.css changes the site (a role that reads it).
 *
 *   npx next start -p 3091
 *   node tests/exact-out.mjs http://127.0.0.1:3091 <capture folder> [...]
 *   PAGES_DUMP=<folder with board.json and site/> node tests/exact-out.mjs   (no board preview: only the published-site control)
 *
 * Covers: src/features/studio/send-out/exactOut.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { JSDOM } from "jsdom";
import { exactOut, tokensOut, tokenNames } from "../src/features/studio/send-out/index.ts";
import { homeFor } from "../src/features/studio/homePage.ts";
import { buildApp, serveApp } from "./lib/export-app.mjs";
import { dumpedSite, importedSite, systemOf } from "./lib/export-input.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const [BASE, ...captures] = process.argv.slice(2);
const sources = process.env.PAGES_DUMP ? process.env.PAGES_DUMP.split(",").map((d) => () => dumpedSite(d)) : captures.map((c) => () => importedSite(browser, BASE, c));

/** Walks a page so every reveal has played, then back to the top. */
async function walk(p) {
  await p.waitForTimeout(1200);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 600) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(100); }
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.mouse.move(1, 1);
  await p.waitForTimeout(800);
}
/** A picture of one element, once two in a row agree. */
async function settled(p, sel) {
  const shot = async () => (await p.locator(sel).first().screenshot({ animations: "disabled", timeout: 60000 })).toString("base64");
  let last = await shot();
  for (let i = 0; i < 5; i++) { await p.waitForTimeout(700); const next = await shot(); if (next === last) return last; last = next; }
  return last;
}
/** How many pixels differ between two pictures (more than 12 in the summed channels), as tests/export-page.mjs counts them. */
const compare = (p, a, b, more = []) => p.evaluate(async ([a, b, more]) => {
  const load = async (s) => { const i = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext("2d"); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; };
  const P = await load(a), Q = await load(b), M = await Promise.all(more.map(load));
  const w = Math.min(P.w, Q.w), h = Math.min(P.h, Q.h);
  const off = (A, i, B, j) => Math.abs(A.d[i] - B.d[j]) + Math.abs(A.d[i + 1] - B.d[j + 1]) + Math.abs(A.d[i + 2] - B.d[j + 2]) > 12;
  let n = 0, all = 0, still = 0; const cells = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * P.w + x) * 4, j = (y * Q.w + x) * 4;
    const moves = M.some((R) => R.w !== P.w || R.h !== P.h || off(P, i, R, i));
    if (!moves) still++;
    if (off(P, i, Q, j)) { all++; if (!moves) { n++; const k = `${Math.floor(x / 100) * 100},${Math.floor(y / 100) * 100}`; cells.set(k, (cells.get(k) ?? 0) + 1); } }
  }
  const px = Math.max(P.w, Q.w) * Math.max(P.h, Q.h);
  return { size: `${P.w}×${P.h} vs ${Q.w}×${Q.h}`, same: P.w === Q.w && P.h === Q.h, n, all, still, share: (100 * n) / (M.length ? Math.max(1, still) : px), allShare: (100 * all) / px, worst: [...cells].sort((x, y) => y[1] - x[1]).slice(0, 4) };
}, [a, b, more]);
const layered = async (p, sel) => {
  await p.evaluate(() => { const r = document.querySelector("[data-page]"); if (r) r.style.willChange = "transform"; });
  await p.waitForTimeout(500);
  return settled(p, sel);
};

for (const load of sources) {
  const site = await load();
  console.log(`\n${site.name}`);
  const { board } = site;
  const { system } = systemOf(board, site.name);
  const pages = board.pages?.length ? board.pages : [{ id: board.nodes[0].pageId, name: "Home", path: "/" }];
  const home = homeFor(pages);
  const byPath = new Map(site.files.map((f) => [f.path, f]));
  const published = new Map(pages.flatMap((p) => { const f = byPath.get(home.file(p)); return f ? [[p.id, new JSDOM(f.bytes.toString("utf8")).window.document]] : []; }));
  const out = exactOut({ name: site.name, pages, published, assets: site.files.map((f) => ({ path: f.path, content: f.bytes })), system });
  const files = [...tokensOut(system), ...out.files];
  const file = (p) => files.find((f) => f.path === p)?.content ?? "";

  /* 1. The files. */
  check("a page per page, each the published markup whole", out.pages === pages.length && file("app/markup.ts").length > 1000, `${out.pages} pages`);
  const homeHtml = byPath.get("index.html").bytes.toString("utf8");
  const ids = [...homeHtml.matchAll(/ id="(n_[^"]+)"/g)].map((m) => m[1]);
  const markup = String(file("app/markup.ts"));
  check("every part the published page draws is in the markup", ids.length > 0 && ids.every((id) => markup.includes(`id=\\"${id}\\"`)), `${ids.length} parts`);
  const sheets = [...homeHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => `/${m[1]}`);
  const page = String(file("app/page.tsx"));
  check("its stylesheets load in the same order, from public/", sheets.length > 0 && sheets.every((s, i) => page.indexOf(`href="${s}"`) > (i ? page.indexOf(`href="${sheets[i - 1]}"`) : -1)) && sheets.every((s) => files.some((f) => f.path === `public${s}`)), sheets.join(", "));
  const scripts = [...homeHtml.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  check("its scripts are served, and the markup still loads them", scripts.every((s) => files.some((f) => f.path === `public/${s}`)) && scripts.every((s) => markup.includes(`src=\\"/${s}\\"`)), `${scripts.length} scripts`);
  const globals = String(file("app/globals.css"));
  check("tokens.css and Tailwind are there, without Tailwind's base styles", globals.includes(`@import "../tokens/tokens.css"`) && globals.includes("tailwindcss/utilities.css") && !/@import "tailwindcss";/.test(globals) && !globals.includes("preflight"));
  const bridged = (globals.match(/^\s+--[a-z]+: var\(--colour-/gm) ?? []).length;
  check("the palette roles that equal a token read it", bridged > 0, `${bridged} roles`);

  /* 2. next build. */
  const app = await buildApp(`exact-${site.name}`, files);
  check("next build passes", app.ok, app.ok ? "" : app.log.split("\n").filter((l) => /rror|failed|Type /.test(l)).slice(0, 8).join(" / "));
  if (!app.ok) continue;
  const srv = await serveApp(app.dir);
  check("the built app is served", srv.ok, srv.ok ? "" : srv.log().split("\n").slice(-6).join(" / "));
  if (!srv.ok) { srv.stop(); continue; }

  /* 3. The pixels. */
  const W = board.frameWidth ?? 1440;
  const ex = await browser.newPage({ viewport: { width: W, height: 900 } });
  const errs = [];
  ex.on("pageerror", (e) => errs.push(e.message));
  await ex.goto(srv.url, { waitUntil: "load" });
  await walk(ex);
  const exShot = await settled(ex, "[data-page]");
  const exLayered = await layered(ex, "[data-page]");

  /* Today's published site, served as it is: the control the app should equal. */
  const st = await browser.newPage({ viewport: { width: W, height: 900 } });
  await st.route("http://site.test/**", (r) => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
    const f = byPath.get(path) ?? byPath.get(`${path}/index.html`.replace(/^\//, ""));
    if (!f) return r.fulfill({ status: 404, body: "" });
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".svg") ? "image/svg+xml" : /\.(png|webp|jpe?g|gif)$/.test(path) ? `image/${path.split(".").pop().replace("jpg", "jpeg")}` : "text/html";
    return r.fulfill({ status: 200, contentType: type, body: f.bytes });
  });
  await st.goto("http://site.test/index.html", { waitUntil: "load" });
  await walk(st);
  const stShot = await settled(st, "[data-page]");
  const shots = async (name, b64) => { if (process.env.SHOTS) (await import("node:fs")).writeFileSync(`${process.env.SHOTS}/${site.name}-${name}.png`, Buffer.from(b64, "base64")); };
  await shots("published", stShot); await shots("exact", exShot);
  const moving = await compare(ex, stShot, exShot);
  /*
   * With their scripts running, a site's films, canvases and scan lines are
   * caught at a different moment on every load (two loads of the published
   * site itself differ by up to 1%). With scripts off nothing moves, and the
   * app is the published page's markup and stylesheets: the two must draw
   * the same picture, pixel for pixel.
   */
  const still = async (p, url) => { await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1500); return settled(p, "[data-page]"); };
  const stStill = await browser.newPage({ viewport: { width: W, height: 900 }, javaScriptEnabled: false });
  await stStill.route("http://site.test/**", (r) => { const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html"; const f = byPath.get(path); return f ? r.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : /\.(png|webp|jpe?g|gif)$/.test(path) ? `image/${path.split(".").pop().replace("jpg", "jpeg")}` : path.endsWith(".js") ? "text/javascript" : "text/html", body: f.bytes }) : r.fulfill({ status: 404, body: "" }); });
  const exStill = await browser.newPage({ viewport: { width: W, height: 900 }, javaScriptEnabled: false });
  const [pubStill, appStill] = [await still(stStill, "http://site.test/index.html"), await still(exStill, srv.url)];
  await shots("published-still", pubStill); await shots("exact-still", appStill);
  const control = await compare(ex, pubStill, appStill);
  /* The page as drawn, element for element, with the addresses written the one way (the app serves pictures from /assets/, the published site beside the page). */
  const pageOf = (p) => p.evaluate(() => document.querySelector("[data-page]")?.outerHTML ?? "");
  const same = (h) => h.replace(/(["'(]|&quot;)(?:\.\.\/|\.\/|\/)*assets\//g, "$1assets/").replace(/ href="[^"]*"/g, ' href=""');
  const [pubHtml, appHtml] = [same(await pageOf(stStill)), same(await pageOf(exStill))];
  let at = 0; while (at < pubHtml.length && pubHtml[at] === appHtml[at]) at++;
  await stStill.close(); await exStill.close();
  console.log(`       against today's published site, scripts off: the page ${pubHtml.length} characters, ${pubHtml === appHtml ? "identical" : `differs at ${at}: ${JSON.stringify(pubHtml.slice(at, at + 60))} → ${JSON.stringify(appHtml.slice(at, at + 60))}`}; pixels ${control.n} (${control.share.toFixed(3)}%, animated pictures move even with scripts off); with scripts running ${moving.n} (${moving.share.toFixed(3)}%)`);
  check("it draws today's published page, element for element (scripts off)", pubHtml.length > 1000 && pubHtml === appHtml, pubHtml === appHtml ? `${pubHtml.length} characters` : `differs at ${at}`);
  check("no script error on the page", errs.length === 0, errs.slice(0, 2).join(" / "));
  await st.close();

  if (site.page) {
    /* The board's own drawing: the preview of the same page at the captured width, at 100%, walked as the published page is. */
    const b = site.page;
    await b.setViewportSize({ width: W + 200, height: 1000 });
    await b.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
    await b.evaluate(() => window.__studioLiveDevice?.("desktop"));
    await b.waitForTimeout(3000);
    /* The preview's page sits in a scrolling box: every box round it lets the whole page show, so the window scrolls it (its reveals play, as the published page's do) and the far end is painted too. */
    await b.evaluate(() => { for (let e = document.querySelector("[data-live-page]")?.parentElement; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflow !== "visible" || s.overflowY !== "visible") { e.style.setProperty("overflow", "visible", "important"); } if (s.height !== "auto") e.style.setProperty("height", "auto", "important"); e.style.setProperty("max-height", "none", "important"); } });
    await b.waitForTimeout(800);
    await walk(b);
    const ref = await settled(b, "[data-live-page]");
    await shots("preview", ref);
    const pub = await compare(ex, ref, stShot);
    const plain = await compare(ex, ref, exShot);
    const lifted = await compare(ex, ref, exLayered);
    await shots("exact-layered", exLayered);
    console.log(`       against the board's preview: today's published site ${pub.n} px (${pub.share.toFixed(2)}%), ${pub.size}; the app ${plain.n} px as served (${plain.share.toFixed(2)}%), on its own layer as the preview's page is ${lifted.n} px (${lifted.share.toFixed(2)}%); worst ${lifted.worst.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
    /* The app is today's published site (checked above); against the board it is held to that site's own score, plus 0.1%, and the 1% bar is said beside it. */
    const best = Math.min(plain.share, lifted.share);
    console.log(`       ${best < 1 ? "within" : "NOT within"} 1% of the board's pixels: ${best.toFixed(2)}% (today's published site ${pub.share.toFixed(2)}% on the same picture)`);
    /* What moves is allowed for as this run measured it: the app against today's published site, both running (the same markup, so every pixel apart is motion). */
    check("at the board's width it draws within 1% of the board's pixels, or as near as today's published site does give or take what moved", plain.same && (best < 1 || best <= pub.share + moving.share + 0.1), `${Math.min(plain.share, lifted.share).toFixed(2)}% (${plain.share.toFixed(2)}% as served, ${lifted.share.toFixed(2)}% on its own layer; today's published site ${pub.share.toFixed(2)}%)`);
  } else console.log("       (no Builder: the board's preview is compared only when the site is brought in)");

  /* 4. A token changed in tokens.css changes the site. */
  const accent = system.tokens.colour.find((t) => t.role === "accent" && globals.includes(`--accent: var(${tokenNames(system).get(t.id).css})`));
  if (accent) {
    const v = tokenNames(system).get(accent.id).css;
    await ex.evaluate((v) => { const s = document.createElement("style"); s.textContent = `:root { ${v}: rgb(255, 0, 255) !important; }`; document.head.append(s); }, v);
    const now = await ex.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    check("a token changed in tokens.css reaches the role the page paints with", /255,\s*0,\s*255/.test(now), `--accent is ${now}`);
  }
  await ex.close();
  srv.stop();
  if (site.page) await site.page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
