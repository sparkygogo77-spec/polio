#!/usr/bin/env node
/**
 * THE PAGE'S TEXTURE IS ONE LAYER; EACH TEXTURE GETS THE DIALS THAT CHANGE IT.
 *
 * J (2026-10-09), PonsStars on the board with Stripes on the page: the
 * stripes broke above and below the header and the red bar, because every
 * part as wide as the page drew its own copy laid out on its own box, and a
 * see-through band drew a second copy over the app's. Angle did nothing to
 * Dots, and Drift did nothing to Stripes or Dots.
 *
 *   1. Dots turn with Angle (a turned grid, not dots turned in place);
 *      Stripes drift (along their own direction, a whole number of lines);
 *   2. on the saved PST board, the page's Stripes worn by the app are laid
 *      exactly where the page is, and the see-through bands draw none;
 *   3. each kind shows only the dials that change it, and Flat colour is
 *      not a texture (the Background colour is);
 *   4. Drift on the page's stripes moves them, on keyframes that exist.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/page-texture-seams.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/WornTexture.tsx, src/features/studio/look/lookparts/textureCss.ts, src/features/studio/look/lookparts/texture.ts, src/features/studio/PieceTexture.tsx, src/features/studio/blocks.tsx, src/features/studio/shelf/parts/theme.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { layerCss, textureCss, turnedLattice } from "../src/features/studio/look/lookparts/textureCss.ts";
import { newLayer } from "../src/features/studio/look/lookparts/texture.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. */
const dots = (angle) => layerCss({ ...newLayer("dots"), angle, scale: 20 }, "#000");
check("1. Angle turns Dots: 0° and 30° are different patterns", dots(0).image !== dots(30).image && dots(0).size !== dots(30).size, `${dots(0).size} / ${dots(30).size}`);
const lat = turnedLattice(20, 30);
let near = Infinity;
for (const p of lat.points) for (const q of lat.points) for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
  if (p === q && !gx && !gy) continue;
  near = Math.min(near, Math.hypot(p[0] - q[0] - gx * lat.tile, p[1] - q[1] - gy * lat.tile));
}
check("…the turned grid keeps its spacing and turns near the angle asked", Math.abs(near - 20) < 0.01 && Math.abs(lat.turned - 30) < 3, `spacing ${near.toFixed(2)}, turned ${lat.turned.toFixed(1)}°`);
const pal = { bg: "#fdf0dc", surface: "#fff", text: "#111", muted: "#555", accent: "#f80", highlight: "#f80" };
const moving = textureCss([{ ...newLayer("stripes"), drift: 0.5 }], pal, "#fdf0dc");
const still = textureCss([{ ...newLayer("stripes"), drift: 0 }], pal, "#fdf0dc");
check("…Drift moves Stripes", /^tex-drift-/.test(String(moving.animation ?? "")) && !still.animation, String(moving.animation));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
await ui.locator('[aria-label="Side panel"] button', { hasText: /^Look$/ }).first().click({ force: true });
await ui.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true });
await ui.waitForTimeout(500);
const row = ui.locator("[data-kind-texture]").first();
const pick = async (k) => { await row.locator(`[data-texture-sample="${k}"]`).click(); await ui.waitForTimeout(700); };
const dials = () => row.locator("[data-texture-dial]").evaluateAll((els) => els.map((e) => e.dataset.textureDial).join(","));

/* 2. */
await pick("stripes");
const laid = await ui.evaluate(() => {
  const frame = document.querySelector("[data-frame]").getBoundingClientRect();
  const nodeOf = (s) => s.closest("[data-node-id]")?.dataset.nodeId;
  const app = window.__studioNodes().find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "app")?.id;
  const spans = [...document.querySelectorAll("[data-page-texture]")].filter((s) => s.getBoundingClientRect().width > 0);
  const on = spans.find((s) => nodeOf(s) === app);
  const inner = on?.firstElementChild?.getBoundingClientRect();
  const bare = spans.filter((s) => s.dataset.pageTexture === "bare").map(nodeOf);
  const drawn = spans.filter((s) => s.dataset.pageTexture === "").map(nodeOf);
  return { frame: [frame.x, frame.y, frame.width, frame.height], inner: inner ? [inner.x, inner.y, inner.width, inner.height] : null, bare, drawn };
});
const off = laid.inner ? Math.max(...laid.inner.map((v, i) => Math.abs(v - laid.frame[i]))) : Infinity;
check("2. the app wears the page's stripes laid exactly where the page is", off < 1.5, `off by ${off.toFixed(2)}px`);
check("…the see-through bands (nav, title, play layout) draw no second copy", laid.bare.length >= 3 && laid.drawn.length >= 1, `drawn ${laid.drawn.join()}, bare ${laid.bare.join()}`);

/* 3. */
check("3. Stripes: line width, angle and drift", (await dials()) === "shape,angle,drift", await dials());
await pick("dots");
check("…Dots: dot size, angle and drift", (await dials()) === "shape,angle,drift", await dials());
/* (The page's row has a Gradient tile, sample "flat", since 1d680d3f; no tile is called Flat colour.) */
check("…no Flat colour: the Background colour already is one", (await row.locator("[data-texture-sample]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent ?? ""))).every((l) => !/^flat/i.test(l.trim())));
await pick("mesh");
check("…Mesh: no Drift, since it is laid once across the page", (await dials()) === "shape,angle", await dials());
const meshOff = await ui.evaluate(() => {
  const f = document.querySelector("[data-frame]").getBoundingClientRect();
  const i = [...document.querySelectorAll('[data-page-texture=""]')].find((s) => s.getBoundingClientRect().width > 0)?.firstElementChild?.getBoundingClientRect();
  return i ? Math.max(Math.abs(i.x - f.x), Math.abs(i.y - f.y), Math.abs(i.width - f.width), Math.abs(i.height - f.height)) : Infinity;
});
check("…and the mesh under the bands is the page's own, laid where the page is", meshOff < 1.5, `off by ${meshOff}`);

/* 4. */
await pick("stripes");
await row.locator('[aria-label="Drift"]').first().scrollIntoViewIfNeeded();
const track = await row.locator('[aria-label="Drift"]').first().boundingBox();
await ui.mouse.click(track.x + track.width * 0.6, track.y + track.height / 2);
await ui.waitForTimeout(600);
const at = () => ui.evaluate(() => getComputedStyle(document.querySelector("[data-frame]")).backgroundPosition);
const name = await ui.evaluate(() => getComputedStyle(document.querySelector("[data-frame]")).animationName);
const has = await ui.evaluate((n) => [...document.querySelectorAll("style")].some((s) => s.textContent.includes(`@keyframes ${n}{`)), name);
const a = await at();
await ui.waitForTimeout(1500);
const b = await at();
check("4. Drift on the page's stripes moves them, on keyframes that exist", /^tex-drift-/.test(name) && has && a !== b, `${name}, ${has}, ${a} → ${b}`);

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
