/**
 * One space open at a time, lit evenly, and erasable.
 *
 * J's set on the spaces, each as a thing on the screen:
 *
 *   · the light round a hole is an aura, even all the way round, and its
 *     size follows the shape's size: not a lamp off to the left;
 *   · only one space is open at a time, and opening one closes whatever
 *     was open; a closed space is a line with what it is for written on
 *     it, in the words from its panel, or "This space" until it has any;
 *   · erase deletes a space.
 *
 * Every check is a rectangle on screen or a pixel's colour, never the
 * store: the store seeds the board, and the board is judged.
 *
 *   node tests/space-one-open.mjs [url]
 *   SHOTS=1 node tests/space-one-open.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { CONSUME_MS, roundBoundary } from "../src/features/studio/space.ts";
import { HALO } from "../src/features/studio/blackHole.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const SHOTS = !!process.env.SHOTS;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A big box and a small loop, both drawn lines, both long consumed. The box
   was drawn last, so it is the open one. */
const box = (x, y, w, h) => [[x, y], [x + w * 0.5, y - 2], [x + w, y], [x + w + 2, y + h * 0.5], [x + w, y + h], [x + w * 0.5, y + h + 2], [x, y + h], [x - 2, y + h * 0.5], [x, y]];
const loop = (cx, cy, r) => roundBoundary(cx, cy, r, 40).map(([x, y], i) => [x + Math.sin(i * 1.7) * r * 0.05, y + Math.cos(i * 2.3) * r * 0.05]);
const BIG = { x: 140, y: 120, w: 620, h: 360 };
const SMALL = { cx: 1000, cy: 520, r: 64 };
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes: [], groups: [], shapes: [],
    spaces: [
      { id: "sp_small", pageId: "page_home", boundary: loop(SMALL.cx, SMALL.cy, SMALL.r), since: 1, prompt: "", label: "", at: 1 },
      { id: "sp_big", pageId: "page_home", boundary: box(BIG.x, BIG.y, BIG.w, BIG.h), since: 2, prompt: "", label: "", at: 2 },
    ],
    format: {}, brief: { name: "OPEN", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "page_home", trail: [],
  },
  version: 0,
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(doc));
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(CONSUME_MS + 800);
if (SHOTS) mkdirSync("docs/shots", { recursive: true });
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `docs/shots/space-${n}.png` }); };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

const patch = async (x, y, n) => {
  const png = await page.screenshot({ clip: { x: Math.round(x) - (n >> 1), y: Math.round(y) - (n >> 1), width: n, height: n } });
  return page.evaluate(async ([b64, n]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = n; c.height = n;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, n, n).data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
    return out;
  }, [png.toString("base64"), n]);
};
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
/** The brightest pixel in a small patch: light is thin, and a sample must not miss it by a pixel. */
const glow = async (x, y) => Math.round(Math.max(...(await patch(x, y, 5)).map(luma)));
/**
 * The light on one side, read along its normal: every pixel from the line
 * out to `reach` screen pixels, in one screenshot. Two numbers come back.
 * The lift is the brightest pixel, which is the ring; the aura is the mean
 * from four pixels out to the reach, which is the light beside it. One
 * patch at a fixed distance was the first way this was read, and it caught
 * the ring's peak on one side and landed a pixel past it on the mirrored
 * side, a spread of sixty at the same zoom from rounding alone. A line of
 * pixels along the normal reads the light and not the rounding.
 */
const along = async (x, y, dx, dy, reach = 14) => {
  const png = await page.screenshot();
  const vals = await page.evaluate(async ([b64, pts]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    return pts.map(([px, py]) => { const d = g.getImageData(Math.round(px), Math.round(py), 1, 1).data; return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; });
  }, [png.toString("base64"), Array.from({ length: reach + 1 }, (_, i) => [x + dx * i, y + dy * i])]);
  const outer = vals.slice(4);
  return { lift: Math.round(Math.max(...vals)), aura: Math.round(outer.reduce((a, b) => a + b, 0) / outer.length) };
};

/** Page coordinates to screen, through the open hole's host, which is the box grown by HALO. */
const toScreen = async (id, px, py, boxOf) => {
  const r = await page.locator(`[data-space="${id}"]`).boundingBox();
  const scale = r.width / (boxOf.w + HALO * 2);
  return [r.x + (px - boxOf.x + HALO) * scale, r.y + (py - boxOf.y + HALO) * scale, scale];
};

/* ------------------------------------------------------------------ */
/* 1. One open at a time                                                */
/* ------------------------------------------------------------------ */

check("two spaces on the page is one open hole", (await page.locator("[data-space-horizon][data-space-open]").count()) === 1);
check("and the other is a closed line", (await page.locator("[data-space-closed]").count()) === 1 && (await page.locator('[data-space="sp_small"][data-space-closed]').count()) === 1);
check("the open one is the one drawn last", (await page.locator('[data-space="sp_big"] [data-space-horizon]').count()) === 1);
const closedKey = page.locator("[data-space-closed-key]");
check("a closed space with nothing said yet says so", (await closedKey.innerText()).trim() === "This space", await closedKey.innerText());

/* ------------------------------------------------------------------ */
/* 2. The light is an aura: even all round, sized to the shape          */
/* ------------------------------------------------------------------ */

const bigBox = { x: BIG.x - 2, y: BIG.y - 2, w: BIG.w + 4, h: BIG.h + 4 };
const OUT = 7;
/* The four sides, each read outward from its own line: the bulge of the
   drawn line at the middle of each side is the line there. */
const sides = {
  left: [...await toScreen("sp_big", BIG.x - 2, BIG.y + BIG.h / 2, bigBox), -1, 0],
  right: [...await toScreen("sp_big", BIG.x + BIG.w + 2, BIG.y + BIG.h / 2, bigBox), 1, 0],
  top: [...await toScreen("sp_big", BIG.x + BIG.w / 2, BIG.y - 2, bigBox), 0, -1],
  bottom: [...await toScreen("sp_big", BIG.x + BIG.w / 2, BIG.y + BIG.h + 2, bigBox), 0, 1],
};
/*
 * Each side along its own normal, and against its own background.
 *
 * Two instruments met here and both are kept. Trunk's: the page behind a
 * hole is a full-length surface now and not one flat colour, so a side is
 * read against the same direction further out, and what is compared is
 * how much the light lifts its own patch of background. Mine: a line of
 * pixels along the normal rather than one patch at a fixed distance,
 * because a patch caught the ring's peak on one side and landed a pixel
 * past it on the mirrored side, a spread of sixty from rounding alone.
 * The lift is the ring over the background; the aura is the light beside
 * the ring over the background.
 */
const FAR_REF = 180;
const lit = {}, base = {}, lift = {}, aura = {};
for (const [side, [x, y, scale, dx, dy]] of Object.entries(sides)) {
  lit[side] = await along(x, y, dx, dy);
  base[side] = await glow(x + dx * FAR_REF * scale, y + dy * FAR_REF * scale);
  lift[side] = lit[side].lift - base[side];
  aura[side] = lit[side].aura - base[side];
}
const said = `lift ${["left", "right", "top", "bottom"].map((k) => `${k} ${lift[k]}`).join(", ")} · aura ${["left", "right", "top", "bottom"].map((k) => `${k} ${aura[k]}`).join(", ")} · background ${["left", "right", "top", "bottom"].map((k) => `${k} ${base[k]}`).join(", ")}`;
/* Unlit page, for the reach checks below: the right-hand reference. */
const pageLuma = base.right;
const lifts = Object.values(lift), auras = Object.values(aura);
check("every side of the open hole is lit: the ring on it, and light beside it", lifts.every((v) => v > 100) && auras.every((v) => v > 14), said);
check("and lit the same all the way round, not heavier on the left",
  Math.max(...lifts) - Math.min(...lifts) < 45 && Math.max(...auras) < Math.min(...auras) * 1.5 && aura.left < aura.right * 1.5, said);
/* Size follows the shape: the big hole's aura reaches further than the
   small one's will. Sampled where the big one is still lit and the small
   one, at the same distance, is not. */
const FAR = 34;
const [fx, fy] = await toScreen("sp_big", BIG.x + BIG.w + FAR, BIG.y + BIG.h / 2, bigBox);
const bigFar = await glow(fx, fy);
check("a big hole wears a big aura: still lit well out from its line", bigFar > pageLuma + 10, `${bigFar} at ${FAR}px out, page ${pageLuma}`);
await shot("aura");

/* ------------------------------------------------------------------ */
/* 3. Opening the small one closes the big one; a closed one says what it is for */
/* ------------------------------------------------------------------ */

await closedKey.click({ force: true });
await page.waitForTimeout(500);
check("pressing a closed space opens it", (await page.locator('[data-space="sp_small"] [data-space-horizon]').count()) === 1);
check("and closes the one that was open", (await page.locator('[data-space="sp_big"][data-space-closed]').count()) === 1 && (await page.locator("[data-space-horizon]").count()) === 1);
const panel = page.locator('[data-space-panel="sp_small"]');
check("with its own panel open", (await panel.count()) === 1);
await panel.locator("[data-space-prompt]").fill("a chart of the token being traded");
await page.waitForTimeout(300);
const smallBox = { x: SMALL.cx - SMALL.r * 1.06, y: SMALL.cy - SMALL.r * 1.06, w: SMALL.r * 2.12, h: SMALL.r * 2.12 };
const [sx, sy] = await toScreen("sp_small", SMALL.cx + SMALL.r + FAR, SMALL.cy, smallBox);
const smallFar = await glow(sx, sy);
const [nx, ny] = await toScreen("sp_small", SMALL.cx + SMALL.r + OUT, SMALL.cy, smallBox);
const smallNear = await glow(nx, ny);
check("a small hole wears a small aura: lit at its line, gone at the distance the big one still glows", smallNear > pageLuma + 14 && smallFar < bigFar - 8, `${smallNear} near, ${smallFar} at ${FAR}px out; the big one had ${bigFar} there`);

await page.locator("[data-space-closed-key]").click({ force: true });
await page.waitForTimeout(500);
check("opening the big one again closes the small one", (await page.locator('[data-space="sp_big"] [data-space-horizon]').count()) === 1 && (await page.locator('[data-space="sp_small"][data-space-closed]').count()) === 1);
check("and the closed small one now says what it is for", /a chart of the token being traded/.test(await page.locator("[data-space-closed-key]").innerText()), await page.locator("[data-space-closed-key]").innerText());
await shot("closed-says");

/* ------------------------------------------------------------------ */
/* 4. Erase deletes a space                                             */
/* ------------------------------------------------------------------ */

const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height - 40);
await page.keyboard.press("e");
await page.waitForTimeout(250);
const [ex, ey] = await toScreen("sp_big", BIG.x, BIG.y + BIG.h / 2, bigBox);
await page.mouse.click(ex, ey);
await page.waitForTimeout(400);
check("a press of the eraser on a space's line deletes the space, from the board and the store", (await page.locator('[data-space="sp_big"]').count()) === 0 && (await state()).spaces.length === 1, `${(await state()).spaces.length} left`);
check("and the one left is open, since it is the only one", (await page.locator('[data-space="sp_small"] [data-space-horizon]').count()) === 1);
/* And a press in the middle of an empty open hole, where its key sits: the
   eraser goes through the key to the box. Then undo, because it was a step. */
const smallBox2 = { x: SMALL.cx - SMALL.r * 1.06, y: SMALL.cy - SMALL.r * 1.06, w: SMALL.r * 2.12, h: SMALL.r * 2.12 };
const [mx2, my2] = await toScreen("sp_small", SMALL.cx, SMALL.cy, smallBox2);
await page.mouse.click(mx2, my2);
await page.waitForTimeout(400);
check("a press in the middle of an empty hole, on its own key, deletes it too", (await page.locator("[data-space]").count()) === 0 && (await state()).spaces.length === 0, `${(await state()).spaces.length} left, ${await page.locator("[data-space]").count()} on the board`);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
check("and undo brings it back, because erasing it was a step", (await page.locator('[data-space="sp_small"]').count()) === 1 && (await state()).spaces.length === 1);

/* ------------------------------------------------------------------ */
/* 5. Drawing a new one opens it and closes the last                    */
/* ------------------------------------------------------------------ */

await page.keyboard.press("s");
await page.waitForTimeout(250);
const [dx, dy, sc] = await toScreen("sp_small", SMALL.cx, SMALL.cy, smallBox);
const draw = async (pts) => {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(12); }
  await page.mouse.up();
};
const nx0 = dx - 520 * sc, ny0 = dy - 380 * sc, nw = 300 * sc, nh = 200 * sc;
await draw([[nx0, ny0], [nx0 + nw, ny0], [nx0 + nw, ny0 + nh], [nx0, ny0 + nh], [nx0, ny0]]);
await page.waitForTimeout(CONSUME_MS + 700);
check("a newly drawn space is the open one", (await state()).spaces.length === 2 && (await page.locator("[data-space-horizon][data-space-open]").count()) === 1 && (await page.locator('[data-space="sp_small"][data-space-closed]').count()) === 1);
check("and the one it closed still says what it is for", /a chart of the token/.test(await page.locator('[data-space-closed-key="sp_small"]').innerText()));
await shot("drawn-opens");

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
