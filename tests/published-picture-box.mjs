#!/usr/bin/env node
/**
 * A PICTURE IS PUBLISHED AT ITS BOX, NOT AT ITS OWN SHAPE.
 *
 * thesolface.site, published from a fresh import (the hand-edit pass,
 * 2026-10-22): the gallery's slide is a square picture shown in a 870×495
 * box, cut to it (`object-fit: cover`), as the page draws it. The board
 * drew it 495 tall. The published page drew it 870 tall, square, running
 * 375px down over the card under it. The mountain and the coin stickers,
 * 480×330 and 240×150 boxes round 480×360 and 240×180 pictures, were 30px
 * taller each.
 *
 * Every published part stands in a box with the board's height as its floor
 * (`min-height`, so words are never cut off), and the picture fills its
 * part with `height: 100%`: a share of a box with no height of its own,
 * which the browser reads as the picture's own height. A picture has no
 * words to keep: its part is exactly its box.
 *
 *   1. The board draws the picture at its box (it too drew 870 tall).
 *   2. The published page at 1440 draws it at the same box, 870×495.
 *   3. A picture as wide as its shape is unchanged (480×360 in 480×360).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/published-picture-box.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/LiveSite.tsx, src/features/studio/shelf/parts/Media.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const svg = (w, h, fill) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="white"/></svg>`);
const pic = (id, w, h) => ({ id, path: `assets/pictures/${id}.svg`, type: "image/svg+xml", w, h, bytes: 300, alt: "", from: "upload" });
const parts = [
  part("n_main", 0, 0, 1440, 1600, { ...captured("body > main"), colour: { bg: "rgb(16, 20, 30)" } }),
  part("n_slide", 519, 200, 870, 495, { featureId: "picture", picture: pic("pic_square", 870, 870), ...captured("body > main > div > img:nth-of-type(1)") }),
  part("n_card", 519, 695, 870, 180, { ...captured("body > main > div > div"), colour: { bg: "rgb(40, 200, 120)" } }),
  part("n_fits", 100, 1000, 480, 360, { featureId: "picture", picture: pic("pic_wide", 480, 360), ...captured("body > main > img:nth-of-type(2)") }),
];
const board = boardWith(parts, { pictures: [{ id: "pic_square", type: "image/svg+xml", bytes: svg(870, 870, "rgb(200, 40, 160)") }, { id: "pic_wide", type: "image/svg+xml", bytes: svg(480, 360, "rgb(40, 120, 220)") }] });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  await ui.waitForTimeout(1500);

  /* 1. */
  const onBoard = await ui.evaluate(() => { const el = document.querySelector('[data-node-id="n_slide"]'); const img = el?.querySelector("img"); return el && img ? { box: el.offsetHeight, img: Math.round(img.getBoundingClientRect().height / (el.getBoundingClientRect().height / el.offsetHeight)) } : null; });
  check("1. the board draws the square picture in its 870×495 box, cut to it", onBoard?.box === 495 && Math.abs(onBoard.img - 495) <= 1, JSON.stringify(onBoard));

  /* 2, 3: the published page, served as files. */
  const files = await ui.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path.replace(/^\/+/, ""), content: f.content, encoding: f.encoding })));
  const byPath = new Map(files.map((f) => [f.path, f]));
  const out = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await out.route("http://site.test/**", (r) => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
    const f = byPath.get(path);
    if (!f) return r.fulfill({ status: 404, body: "" });
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".svg") ? "image/svg+xml" : "text/html";
    return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
  });
  await out.goto("http://site.test/index.html", { waitUntil: "load" });
  await out.waitForTimeout(1500);
  const box = (id) => out.evaluate((id) => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); const img = el.querySelector("img"); return { w: Math.round(r.width), h: Math.round(r.height), img: img ? Math.round(img.getBoundingClientRect().height) : null }; }, id);
  const slide = await box("n_slide"), fits = await box("n_fits");
  check("2. published at 1440, the square picture is 870×495, as on the board, its picture cut to the box", slide?.w === 870 && slide.h === 495 && slide.img <= 495, JSON.stringify(slide));
  check("3. a picture the shape of its box is unchanged: 480×360", fits?.w === 480 && fits.h === 360, JSON.stringify(fits));
  check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
