#!/usr/bin/env node
/**
 * THE FRAMES THE CAPTURE TOOK OF WHAT MOVED ARE PLAYED BACK.
 *
 * polio #210 made the capture picture each part the screen showed changing
 * (sink `behaviours.motion.frames`, capture/site/capture/frames-drive.mjs): a
 * flipbook svg cut to the part, read as a loop with its period, a once, a
 * drift, a live run, the pointer's (its place a frame) or the scroll's (px a
 * frame). The Builder kept the record and showed nothing of it. Here, the
 * Builder's side of it:
 *
 *   1. The hand-over (`captured.ts`) lays each record's flipbook over its
 *      part as a layer of its own (`Picture.moving`), after the part and what
 *      is inside it, taking no press, carrying "Moves as captured" with how
 *      it moved and the pointer's or the scroll's readings. A stylesheet loop
 *      the part already plays is not laid twice. The importer fetches those
 *      pictures: `namedPictures` names them off the record.
 *   2. The feature's script, in the kit's own file (vendor/builder-motion.js,
 *      what a published page runs): a scroll run shows the frame taken at the
 *      nearest scroll; a pointer run the frame taken when the pointer stood
 *      where the visitor's does; a loop is left to the svg, which plays itself.
 *   3. The Preview, on a seeded page: the scroll layer's flipbook follows the
 *      window's scroll; the loop layer shows its self-playing picture. And the
 *      board draws the layer's picture, still.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/moving-frames.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/library/behaviourScripts/effects.ts, src/features/studio/shelf/library/captured.ts, src/features/studio/shelf/parts/primitives.tsx, src/features/studio/siteHead.ts, src/features/studio/send-out/kitMotion.ts, kit/starter/vendor/builder-motion.js, capture/site/capture/capture-to-document.mjs
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

/* A still flipbook as the converter writes a pointer's or a scroll's run: N coloured frames, each shown once for `every` ms, no animation of its own. */
const COLOURS = ["#1b4fd8", "#2aa84a", "#d8321b", "#e9c46a", "#8338ec", "#ff7b00", "#00b4d8", "#6a994e"];
const stillBook = (n, w, h, every = 100) => {
  const defs = Array.from({ length: n }, (_, i) => `<rect id="f${i}" width="${w}" height="${h}" fill="${COLOURS[i % COLOURS.length]}"/>`).join("");
  const uses = Array.from({ length: n }, (_, i) => `<use href="#f${i}" data-ms="${every}" style="opacity:${i === 0 ? 1 : 0}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${uses}</svg>`;
};
/* A loop as the converter writes it: two frames taking turns, playing itself. */
const LOOP = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><style>@keyframes s0{0%{opacity:1}50%{opacity:0}100%{opacity:0}}@keyframes s1{0%{opacity:0}50%{opacity:1}100%{opacity:0}}</style><defs><rect id="f0" width="40" height="40" fill="#d8321b"/><rect id="f1" width="40" height="40" fill="#1b4fd8"/></defs><use href="#f0" style="opacity:1;animation:s0 1000ms step-end infinite"/><use href="#f1" style="opacity:0;animation:s1 1000ms step-end infinite"/></svg>`;

/* The scroll's readings, 0 to 300 px in 16 steps, and the pointer's: a circle round the middle of a 1000 × 600 window, radii 22 % of its sides (frames-drive.mjs). */
const SCROLLS = Array.from({ length: 16 }, (_, k) => k * 20);
const N_PTR = 16;
const POINTER = Array.from({ length: N_PTR }, (_, k) => [Math.round(500 + 220 * Math.cos((k / N_PTR) * 2 * Math.PI)), Math.round(300 + 132 * Math.sin((k / N_PTR) * 2 * Math.PI))]);

/* 1. The hand-over. */
const frames = [
  { part: "n_dot", selector: "body > div:nth-of-type(1)", kind: "loop", box: [100, 100, 40, 40], w: 40, h: 40, scale: 1, every: 100, ms: 3200, frames: 2, picture: { id: "pic_loop", path: "assets/pictures/pic_loop.svg", w: 40, h: 40 }, period: 1000, what: ["opacity"], via: "script", self: true },
  { part: "n_hill", selector: "body > div:nth-of-type(2)", kind: "scroll", box: [0, 1200, 600, 240], w: 600, h: 240, scale: 1, every: 100, ms: 1600, frames: 16, picture: { id: "pic_scroll", path: "assets/pictures/pic_scroll.svg", w: 600, h: 240 }, what: ["background-position"], via: "script", self: true, scroll: SCROLLS },
  { part: "n_follow", selector: "body > div:nth-of-type(3)", kind: "pointer", box: [400, 200, 200, 200], w: 200, h: 200, scale: 1, every: 100, ms: 1600, frames: 16, picture: { id: "pic_ptr", path: "assets/pictures/pic_ptr.svg", w: 200, h: 200 }, what: ["transform"], via: "script", self: true, pointer: POINTER },
  { part: "n_css", selector: "body > div:nth-of-type(4)", kind: "loop", box: [700, 100, 40, 40], w: 40, h: 40, scale: 1, every: 100, ms: 3200, frames: 2, picture: { id: "pic_css", path: "assets/pictures/pic_css.svg", w: 40, h: 40 }, period: 2000, name: "blink", what: ["opacity"], via: "css", self: true },
];
const seeded = [
  part("n_dot", 100, 100, 40, 40, captured("body > div:nth-of-type(1)")),
  part("n_hill", 0, 1200, 600, 240, captured("body > div:nth-of-type(2)")),
  part("n_hill_words", 20, 1220, 200, 40, captured("body > div:nth-of-type(2) > b")),
  part("n_follow", 400, 200, 200, 200, captured("body > div:nth-of-type(3)")),
  part("n_css", 700, 100, 40, 40, { ...captured("body > div:nth-of-type(4)"), motion: { animation: [{ name: "blink", duration: "2s", iterations: "infinite" }] } }),
];
const behaviours = { version: 1, motion: { frames } };
const given = attachCaptured(structuredClone(seeded), behaviours);
const layers = given.filter((n) => n.picture?.moving);
const byId = new Map(given.map((n, i) => [n.id, { n, i }]));
check("1. The hand-over lays a layer over each moving part: the loop, the scroll's and the pointer's", layers.length === 3 && layers.every((l) => l.featureId === "picture" && l.inert === true), J(layers.map((l) => ({ id: l.id, kind: l.picture.moving.kind, inert: l.inert }))));
const loop = layers.find((l) => l.picture.id === "pic_loop"), hill = layers.find((l) => l.picture.id === "pic_scroll"), ptr = layers.find((l) => l.picture.id === "pic_ptr");
check("…each at the box the frames were cut at, carrying the picture as a moving one", loop && [loop.x, loop.y, loop.w, loop.h].join() === "100,100,40,40" && hill && hill.y === 1200 && hill.picture.type === "image/svg+xml" && hill.picture.moving.kind === "scroll", J(layers.map((l) => [l.x, l.y, l.w, l.h])));
check("…after the part and what is inside it (the hill's words), so it covers them as the frames did", hill && byId.get(hill.id).i === byId.get("n_hill_words").i + 1 && byId.get("n_hill_words").i === byId.get("n_hill").i + 1, J(given.map((n) => n.id)));
const hillUse = hill && usesOf(hill.work).find((u) => u.id === "moving-frames");
const ptrUse = ptr && usesOf(ptr.work).find((u) => u.id === "moving-frames");
const loopUse = loop && usesOf(loop.work).find((u) => u.id === "moving-frames");
check("…carrying Moves as captured: the scroll's with its readings, the pointer's with its places, the loop plain", hillUse?.inputs.kind === "scroll" && hillUse.inputs.scroll === SCROLLS.join(",") && hillUse.inputs.every === "100" && ptrUse?.inputs.kind === "pointer" && ptrUse.inputs.pointer === POINTER.map((p) => p.join(",")).join(";") && loopUse?.inputs.kind === "loop" && !loopUse.inputs.scroll && !loopUse.inputs.pointer, J({ hill: hillUse?.inputs, ptr: ptrUse?.inputs, loop: loopUse?.inputs }));
check("…and no layer for a stylesheet loop the part already plays as captured CSS", !layers.some((l) => l.picture.id === "pic_css") && given.find((n) => n.id === "n_css") && !given.find((n) => n.id === "n_css").work, J(given.find((n) => n.id === "n_css")?.work ?? null));
check("…the parts themselves untouched by it", ["n_dot", "n_hill", "n_follow"].every((id) => !given.find((n) => n.id === id).work), J(given.filter((n) => !n.picture).map((n) => [n.id, n.work])));
const named = namedPictures({ nodes: seeded, behaviours });
check("…and the importer is told to fetch the frames' pictures off the record, as svg", ["pic_loop", "pic_scroll", "pic_ptr", "pic_css"].every((id) => named.some((p) => p.id === id && p.type === "image/svg+xml" && p.path === `assets/pictures/${id}.svg`)), J(named.map((p) => p.id)));

const kit = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
check("2. The kit's motion file carries the feature", /siteFeatures\.define\("moving-frames"/.test(kit));

/* The converter writes a pointer's or a scroll's run still, each use stamped with its time; a loop still plays itself. */
const conv = readFileSync(join(here, "..", "capture", "site", "capture", "capture-to-document.mjs"), "utf8");
check("…and the converter writes the pointer's and the scroll's flipbooks still, each frame stamped with how long it stood", /__still: f\.kind === "pointer" \|\| f\.kind === "scroll"/.test(conv) && /data-ms=/.test(conv));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* 2. A published page's shape: a hooked layer holding the flipbook as an <img>; the kit's file runs the feature named on it. */
  const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const url = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  const q = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  await p.setContent(`<!doctype html><html><head><style>
    [data-hook="hill"]{--builder-motion:"moving-frames?${q({ kind: "scroll", scroll: SCROLLS.join(","), every: "100" })}"}
    [data-hook="follow"]{--builder-motion:"moving-frames?${q({ kind: "pointer", pointer: POINTER.map((x) => x.join(",")).join(";"), every: "100" })}"}
    [data-hook="dot"]{--builder-motion:"moving-frames?kind=loop"}
    body{margin:0;height:3000px}</style></head>
    <body data-hook="page">
      <div data-hook="hill" style="position:absolute;left:0;top:1200px;width:600px;height:240px"><img data-moving-frames="" src="${url(stillBook(16, 600, 240))}" style="width:100%;height:100%;display:block"></div>
      <div data-hook="follow" style="position:fixed;left:400px;top:200px;width:200px;height:200px"><img data-moving-frames="" src="${url(stillBook(16, 200, 200))}" style="width:100%;height:100%;display:block"></div>
      <div data-hook="dot" style="position:absolute;left:100px;top:100px;width:40px;height:40px"><img data-moving-frames="" src="${url(LOOP)}" style="width:100%;height:100%;display:block"></div>
    <script>${kit.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
  await p.waitForTimeout(600);
  const settle = () => p.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 60)));
  const frameOf = (hook) => p.evaluate((h) => { const svg = document.querySelector(`[data-hook="${h}"] svg[data-moving-frames]`); if (!svg) return null; const on = [...svg.querySelectorAll("use")].findIndex((u) => u.style.opacity === "1"); return { shown: on, says: svg.getAttribute("data-frame"), uses: svg.querySelectorAll("use").length, styles: svg.querySelectorAll("style").length }; }, hook);
  await settle();
  const top = await frameOf("hill");
  check("…on a published page the scroll's flipbook is taken over: inlined, still, its first frame showing as the page opens", top && top.shown === 0 && top.uses === 16 && top.styles === 0, J(top));
  await p.evaluate(() => scrollTo(0, 160));
  await settle();
  const mid = await frameOf("hill");
  check("…scrolled 160 px, the frame taken at 160 px (the ninth) shows", mid && mid.shown === 8 && mid.says === "8", J(mid));
  await p.evaluate(() => scrollTo(0, 2500));
  await settle();
  const far = await frameOf("hill");
  check("…scrolled past the last reading, the last frame holds", far && far.shown === 15, J(far));
  await p.evaluate(() => scrollTo(0, 0));
  await settle();
  check("…and back at the top, the first", (await frameOf("hill"))?.shown === 0);
  /* The pointer: at the sweep's start (right of the middle) the first frame; a quarter turn on (below the middle) the fifth. */
  await p.mouse.move(720, 300, { steps: 4 });
  await settle();
  const right = await frameOf("follow");
  check("…the pointer's flipbook shows the frame taken when the pointer stood where the visitor's does: right of the middle, the first", right && right.shown === 0, J(right));
  await p.mouse.move(500, 432, { steps: 4 });
  await settle();
  const below = await frameOf("follow");
  check("…below the middle, a quarter turn round the sweep: the fifth", below && below.shown === 4, J(below));
  await p.mouse.move(280, 300, { steps: 4 });
  await settle();
  check("…left of the middle, half way round: the ninth", (await frameOf("follow"))?.shown === 8);
  const dot = await p.evaluate(() => { const img = document.querySelector('[data-hook="dot"] img[data-moving-frames]'); return img ? { kind: img.getAttribute("data-moving-frames"), svg: !!document.querySelector('[data-hook="dot"] svg') } : null; });
  check("…and the loop is left to its picture, which plays itself", dot && dot.kind === "loop" && !dot.svg, J(dot));
  await p.close();

  /* 3. The Preview and the board. */
  const parts = [
    part("n_dot", 100, 100, 40, 40, { ...captured("body > div:nth-of-type(1)"), colour: { bg: "rgba(0,0,0,0.2)" } }),
    part("n_hill", 0, 1200, 600, 240, { ...captured("body > div:nth-of-type(2)"), colour: { bg: "rgba(0,0,0,0.2)" } }),
    part("n_foot", 0, 2600, 600, 300, { ...captured("body > div:nth-of-type(3)"), colour: { bg: "rgba(0,0,0,0.2)" } }),
  ];
  const landed = attachCaptured(parts, { version: 1, motion: { frames: frames.filter((f) => f.part === "n_dot" || f.part === "n_hill") } });
  const bookHill = stillBook(16, 600, 240);
  const board = boardWith(landed, { pictures: [{ id: "pic_loop", type: "image/svg+xml", bytes: LOOP }, { id: "pic_scroll", type: "image/svg+xml", bytes: bookHill }] });
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  await ui.waitForTimeout(800);
  const onBoard = await ui.evaluate(() => { const img = document.querySelector('[data-node-id="n_frames_1"] img[data-moving-frames]'); const hill = document.querySelector('[data-node-id="n_frames_2"] img[data-moving-frames]'); return { loop: img ? { kind: img.getAttribute("data-moving-frames"), src: (img.getAttribute("src") || "").slice(0, 5), w: Math.round(img.getBoundingClientRect().width) } : null, hill: hill ? { kind: hill.getAttribute("data-moving-frames"), svg: !!document.querySelector('[data-node-id="n_frames_2"] svg[data-moving-frames]') } : null }; });
  check("3. The board draws each layer's picture: the loop's plays itself, the scroll's stands still as its first frame", onBoard.loop?.kind === "loop" && onBoard.loop.src === "blob:" && onBoard.loop.w > 0 && onBoard.hill?.kind === "scroll" && onBoard.hill.svg === false, J(onBoard));
  await openPreview(ui, URL_BASE);
  const seen = await ui.evaluate(async () => {
    const el = document.querySelector('[data-live-node="n_frames_2"]');
    const scroller = el?.closest("[data-live-scroller]");
    if (!el || !scroller) return { found: false, el: !!el, scroller: !!scroller };
    const wait = () => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 150));
    for (let i = 0; i < 20 && !el.querySelector("svg[data-moving-frames]"); i++) await wait();
    const svg = el.querySelector("svg[data-moving-frames]");
    if (!svg) return { found: true, svg: false, html: el.innerHTML.slice(0, 200) };
    const shown = () => [...svg.querySelectorAll("use")].findIndex((u) => u.style.opacity === "1");
    const out = [];
    for (const to of [0, 160, 0]) { scroller.scrollTop = to; await wait(); out.push({ to, shown: shown(), says: svg.getAttribute("data-frame") }); }
    const loop = document.querySelector('[data-live-node="n_frames_1"] img[data-moving-frames]');
    return { found: true, svg: true, out, box: [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)], loop: loop ? loop.getAttribute("data-moving-frames") : null, pointer: getComputedStyle(el).pointerEvents };
  });
  check("…the Preview takes the scroll layer's flipbook over, inlined at the layer's box, taking no press", seen.found === true && seen.svg === true && seen.box?.[0] === 600 && seen.pointer === "none", J(seen));
  check("…as the page opens its first frame shows; scrolled 160 px, the ninth; back at the top, the first", seen.out?.[0]?.shown === 0 && seen.out?.[1]?.shown === 8 && seen.out?.[2]?.shown === 0, J(seen.out));
  check("…and the loop layer keeps its self-playing picture", seen.loop === "loop", J(seen.loop));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
