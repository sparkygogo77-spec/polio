#!/usr/bin/env node
/**
 * THE SITE'S OWN LOADING SCREEN, AS CAPTURED, PLAYS AS THE PAGE OPENS.
 *
 * sunkcoin.fun (J, 2026-10-11): "the loading screen also looks like this not
 * the full screen animation like we have now, preview has it wrong and the
 * capturer seemingly doesnt get it". The capture kept the loader as its
 * words and times only, and the Builder dressed them in its own CRT loader.
 * Now the capture pictures the window while the loader stands over it
 * (capture-route.mjs, THE LOADING SCREEN AS IT LOOKED) and the converter
 * makes the pictures one svg that plays once (`behaviours.loader.film`).
 * Here, the Builder's side of it:
 *
 *   1. The hand-over (`captured.ts`) lays the film as a part of its own, the
 *      window's size, in the hidden group `hidden:loading-screen`, carrying
 *      "Loading screen as captured" with when the original started to go
 *      and how long it took; the CRT loader is not given. With no film, the
 *      CRT loader still is. The importer fetches the film (`namedPictures`).
 *   2. The feature's script, in the kit's own file: on a published page the
 *      picture covers the whole window as the page opens, and is gone after
 *      the moment it was told plus its fade.
 *   3. The board does not draw the hidden part; the Preview shows the film
 *      over the whole window as it opens.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/loader-film.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/library/behaviourScripts/effects.ts, src/features/studio/shelf/library/captured.ts, src/features/studio/siteHead.ts, src/features/studio/send-out/kitMotion.ts, kit/starter/vendor/builder-motion.js, capture/site/capture/capture-to-document.mjs, capture/site/capture/capture-route.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, openPreview, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = join(here, "..", "src", "features", "studio", "shelf", "library");
const { attachCaptured } = await jiti.import(join(L, "captured.ts"));
const { usesOf } = await jiti.import(join(L, "works.ts"));
const { namedPictures } = await jiti.import(join(here, "..", "src", "features", "studio", "siteHead.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (v) => JSON.stringify(v);

/* A film as the converter writes it: three frames, played once, the last held. */
const FILM = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><style>@keyframes s0{0%{opacity:1}33%{opacity:0}100%{opacity:0}}@keyframes s1{0%{opacity:0}33%{opacity:1}66%{opacity:0}100%{opacity:0}}@keyframes s2{0%{opacity:0}66%{opacity:1}100%{opacity:1}}</style><defs><rect id="f0" width="1440" height="900" fill="#05142a"/><rect id="f1" width="1440" height="900" fill="#0a2040"/><rect id="f2" width="1440" height="900" fill="#f5d90a"/></defs><use href="#f0" style="opacity:1;animation:s0 900ms step-end 1 forwards"/><use href="#f1" style="opacity:0;animation:s1 900ms step-end 1 forwards"/><use href="#f2" style="opacity:0;animation:s2 900ms step-end 1 forwards"/></svg>`;
const loader = (film) => ({ covers: true, words: [{ text: "DIVING IN", size: 16 }], title: "DIVING IN", ticker: "reading every wallet on the curve", pictures: ["https://seeded.test/helmet-256.png"], animations: ["bob", "fill"], lastedMs: 2285, off: { class: "off", afterMs: 1345 }, nav: { shown: 1381, off: 2726, gone: 3666 }, removed: true, ...(film ? { film: { picture: { id: "pic_film", path: "assets/pictures/pic_film.svg", w: 1440, h: 900 }, frames: 3, from: 277, to: 1081 } } : {}) });

/* 1. The hand-over. */
const seeded = [
  part("n_hero", 0, 0, 1440, 900, { ...captured("body > main > section"), colour: { bg: "rgb(240, 240, 240)" } }),
  part("n_words", 100, 100, 600, 80, { ...captured("body > main > section > h1"), featureId: "prose", content: "The coin that pays" }),
];
const given = attachCaptured(structuredClone(seeded), { version: 1, loader: loader(true) });
const film = given.find((n) => n.id === "n_loader_film");
check("1. The hand-over lays the film as a part of its own, the window's size, its picture the film", film && film.featureId === "picture" && [film.x, film.y, film.w, film.h].join() === "0,0,1440,900" && film.picture?.id === "pic_film" && film.picture.type === "image/svg+xml", J(film && { box: [film.x, film.y, film.w, film.h], picture: film.picture }));
check("…in the hidden group hidden:loading-screen, pinned to the window, taking no press", film?.state?.group === "hidden:loading-screen" && film.from?.position === "fixed" && film.inert === true, J(film && { state: film.state, from: film.from }));
const use = film && usesOf(film.work).find((u) => u.id === "loader-film");
check("…carrying Loading screen as captured: going at the later of its last picture (1.08 s) and the switch-off the behaviours saw (2.73 s), over as long as the original took to go (0.94 s)", use?.inputs.at === "2.73" && use.inputs.fade === "0.94", J(use?.inputs));
check("…and the CRT loader is given to nothing", !given.some((n) => usesOf(n.work).some((u) => u.id === "crt-loader")), J(given.map((n) => [n.id, usesOf(n.work).map((u) => u.id)])));
const noFilm = attachCaptured(structuredClone(seeded), { version: 1, loader: loader(false) });
check("…with no film, the CRT loader is given as before, and no part is laid", noFilm.some((n) => usesOf(n.work).some((u) => u.id === "crt-loader")) && !noFilm.some((n) => n.id === "n_loader_film"));
const again = attachCaptured(given, { version: 1, loader: loader(true) });
check("…handed over twice, still one film", again.filter((n) => n.id === "n_loader_film").length === 1);
const named = namedPictures({ nodes: seeded, behaviours: { loader: loader(true) } });
check("…and the importer is told to fetch the film off the record, as svg", named.some((p) => p.id === "pic_film" && p.type === "image/svg+xml" && p.path === "assets/pictures/pic_film.svg"), J(named.map((p) => p.id)));

const kit = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
check("2. The kit's motion file carries the feature", /siteFeatures\.define\("loader-film"/.test(kit));
const route = readFileSync(join(here, "..", "capture", "site", "capture", "capture-route.mjs"), "utf8");
const conv = readFileSync(join(here, "..", "capture", "site", "capture", "capture-to-document.mjs"), "utf8");
check("…the capture pictures the window under the loader, and the converter plays the pictures once", /l\.film = \{ frames, steps/.test(route) && /out\.loader\.film = \{ picture/.test(conv) && /loader-film\.svg/.test(conv));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* 2. A published page's shape: the hidden part holding the film as an <img>; the kit's file runs the feature named on it. */
  const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(FILM)}`;
  await p.setContent(`<!doctype html><html><head><style>
    [data-hook="loading-screen"]{--builder-motion:"loader-film?at=0.8&fade=0.3";display:none}
    body{margin:0;height:3000px}</style></head>
    <body data-hook="page"><h1 data-hook="words">The coin that pays</h1>
      <div data-hook="loading-screen"><img src="${src}" alt=""></div>
    <script>${kit.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
  await p.waitForTimeout(150);
  const up = await p.evaluate(() => { const o = document.querySelector("[data-loader-film]"); if (!o) return null; const r = o.getBoundingClientRect(); const img = o.querySelector("img"); const top = document.elementFromPoint(500, 300); return { box: [r.width, r.height], src: (img?.getAttribute("src") || "").slice(0, 14), covers: o.contains(top), scroll: getComputedStyle(document.documentElement).overflow }; });
  check("…on a published page the film covers the whole window as the page opens, the page held still under it", up && up.box.join() === "1000,600" && up.src === "data:image/svg" && up.covers === true && up.scroll === "hidden", J(up));
  await p.waitForTimeout(1600);
  const after = await p.evaluate(() => ({ there: !!document.querySelector("[data-loader-film]"), scroll: getComputedStyle(document.documentElement).overflow }));
  check("…and after the moment it was told and its fade, it is gone and the page scrolls", after.there === false && after.scroll !== "hidden", J(after));
  await p.close();

  /* 3. The board and the Preview. */
  const landed = attachCaptured(structuredClone(seeded), { version: 1, loader: { ...loader(true), film: { picture: { id: "pic_film", path: "assets/pictures/pic_film.svg", w: 1440, h: 900 }, frames: 3, from: 1390, to: 60000 } } });
  const board = boardWith(landed, { pictures: [{ id: "pic_film", type: "image/svg+xml", bytes: FILM }] });
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  await ui.waitForTimeout(800);
  const onBoard = await ui.evaluate(() => { const el = document.querySelector('[data-node-id="n_loader_film"]'); const hero = document.querySelector('[data-node-id="n_hero"]'); return { film: el ? Math.round(el.getBoundingClientRect().height) : null, hero: !!hero, overlay: !!document.querySelector("[data-loader-film]") }; });
  check("3. The board does not draw the loading screen as the page opens, nor play it over the Builder", onBoard.hero && !onBoard.film && onBoard.overlay === false, J(onBoard));
  await openPreview(ui, URL_BASE);
  if (process.env.DEBUG) console.error(await ui.evaluate(() => ({ crt: !!document.querySelector("[data-crt]"), moves: document.querySelectorAll("[data-live-node]").length, films: document.querySelectorAll("[data-loader-film]").length, now: performance.now() })));
  const seen = await ui.evaluate(() => { const o = document.querySelector("[data-loader-film]"); if (!o) return null; const r = o.getBoundingClientRect(); const img = o.querySelector("img"); return { box: [Math.round(r.width), Math.round(r.height)], src: (img?.getAttribute("src") || "").slice(0, 5) }; });
  check("…the Preview shows the film over the whole window as the page opens", seen && seen.box.join() === "1440,900" && seen.src === "blob:", J(seen));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
