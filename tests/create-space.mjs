/**
 * Create space, as a person sees it.
 *
 * A closed line drawn on the page with the space tool is a placeholder with
 * two keys on it. Black hole consumes the area and leaves drawing space:
 * the ground inside the line, the ring on it, the page untouched outside.
 * A part inside that space, picked, has a panel of its own at the right
 * edge of the board: what it is, what was asked, which model the route will
 * send it to, and the steps in order, which a person can reorder and which
 * survive a reload. Construct turns the other placeholder into a lantern
 * construct cut to its line.
 *
 * Every check here is a rectangle on screen or a pixel's colour, never the
 * store: the store is how the board is seeded, not how it is judged.
 *
 *   node tests/create-space.mjs [url]      # default http://localhost:3000
 *   SHOTS=1 node tests/create-space.mjs    # also writes docs/shots/create-space-*.png
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { CONSUME_MS, centroid, roundBoundary } from "../src/features/studio/space.ts";
import { HALO as HALO_PAD } from "../src/features/studio/blackHole.ts";

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

/* ------------------------------------------------------------------ */
/* The board                                                            */
/* ------------------------------------------------------------------ */

/** A hand-drawn loop: a round boundary with a wobble, so it is a drawn line and not a circle. */
const loop = (cx, cy, r) => roundBoundary(cx, cy, r, 40).map(([x, y], i) => [x + Math.sin(i * 1.7) * r * 0.06, y + Math.cos(i * 2.3) * r * 0.05]);
const HOLE = loop(520, 420, 170);
const BOX = loop(1060, 400, 120);
const [HX, HY] = centroid(HOLE);

const node = (id, featureId, label, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId, label, prompt: "", content: "", data: "",
  x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false,
  link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
  aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    // A button inside the loop that will become the hole: a part that has landed in the space.
    nodes: [node("n_join", "cta-primary", "Join", HX - 110, HY + 70, 220, 52, { prompt: "a warm invitation, one line" })],
    groups: [],
    shapes: [],
    spaces: [
      { id: "sp_hole", pageId: "page_home", boundary: HOLE, kind: "undecided", since: null, prompt: "", label: "", at: 1 },
      { id: "sp_box", pageId: "page_home", boundary: BOX, kind: "undecided", since: null, prompt: "", label: "", at: 2 },
    ],
    format: {},
    brief: { name: "SPACE", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "page_home", trail: [],
  },
  version: 0,
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
// Seeded once: the script runs again on every navigation, and a reload has to find what the person left, not the seed.
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(doc));
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (SHOTS) mkdirSync("docs/shots", { recursive: true });
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `docs/shots/create-space-${name}.png` }); };

/** Visible means an offset parent and a rectangle with both sides above zero. Existence is not the assertion. */
const onScreen = (l) => l.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return !!el.offsetParent && r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
}).catch(() => false);

/** Where a point on the page is on the screen, read off the hole's own host box. */
const host = page.locator('[data-space="sp_hole"]');
const toScreen = async (px, py) => {
  const r = await host.boundingBox();
  const box = bounds(HOLE);
  const scale = r.width / (box.w + HALO_PAD * 2);
  return [r.x + (px - box.x + HALO_PAD) * scale, r.y + (py - box.y + HALO_PAD) * scale];
};
function bounds(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The colour on the screen at a point: a screenshot of the pixel, read back. */
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
/** The colour at a point: the middle of a 3×3 patch. */
const pixel = async (x, y) => (await patch(x, y, 3))[4];
/** The brightest colour within a few pixels: where a one-pixel line is, without knowing which pixel. */
const brightest = async (x, y) => (await patch(x, y, 7)).reduce((a, b) => (luma(b) > luma(a) ? b : a));
const differs = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const rgb = (p) => `rgb(${p.join(",")})`;

/* 1. The placeholder */
const constructKey = page.locator('[data-space="sp_hole"] [data-space-construct-key]');
const holeKey = page.locator('[data-space="sp_hole"] [data-space-hole-key]');
check("a closed line is a placeholder with a Construct key on it", await onScreen(constructKey));
check("and a Black hole key beside it", await onScreen(holeKey));
check("and no Make real door, because it is not ink", (await page.locator("[data-make-real]").count()) === 0);
const [mx, my] = await toScreen(HX, HY);
const edge = HOLE.reduce((a, b) => (b[0] > a[0] ? b : a));
const [ex, ey] = await toScreen(edge[0], edge[1]);
const [ox, oy] = await toScreen(bounds(HOLE).x + bounds(HOLE).w + 140, HY);
const pageBefore = await pixel(ox, oy);
const insideBefore = await pixel(mx, my - 110);
check("before anything is chosen, the inside is the page", Math.abs(luma(insideBefore) - luma(pageBefore)) < 12, `${rgb(insideBefore)} vs page ${rgb(pageBefore)}`);
await shot("placeholder");

/* 2. The black hole */
await holeKey.click();
await page.waitForTimeout(CONSUME_MS * 0.35);
const horizon = page.locator('[data-space="sp_hole"] [data-space-horizon]');
check("chosen, the hole is consuming and not yet open", (await horizon.getAttribute("data-space-open")) === null);
const midway = await pixel(mx, my - 110);
await page.waitForTimeout(CONSUME_MS * 0.9 + 400);
check("a beat later it has consumed the area", (await horizon.getAttribute("data-space-open")) !== null);
check("the two keys are gone", (await holeKey.count()) === 0 && (await constructKey.count()) === 0);
const inside = await pixel(mx, my - 110);
const ring = await brightest(ex, ey);
const outside = await pixel(ox, oy);
check("inside the line is ground now, not the page", differs(inside, pageBefore) > 18 && luma(inside) < 90, `${rgb(inside)}, the page is ${rgb(pageBefore)}`);
check("the ring is the brightest thing on the line", luma(ring) > 140 && luma(ring) > luma(inside) + 80, rgb(ring));
check("the page outside the halo is untouched", differs(outside, pageBefore) < 12, `${rgb(outside)} vs ${rgb(pageBefore)}`);
check("it grew: a third of the way in, the far inside was still the page", differs(midway, pageBefore) < 12 && differs(midway, inside) > 18, `${rgb(midway)} at a third, ${rgb(inside)} at the end`);
await shot("hole");

/* 3. The part inside has a panel of its own */
const part = page.locator('[data-node-id="n_join"]');
check("the part that was inside the line is still on the board", await onScreen(part));
check("with no panel of its own until it is picked", (await page.locator("[data-space-panel]").count()) === 0);
const pr = await part.boundingBox();
await page.mouse.click(pr.x + pr.width / 2, pr.y + pr.height / 2);
await page.waitForTimeout(400);
const panel = page.locator('[data-space-panel="n_join"]');
check("picked, it has a panel at the right edge of the board", await onScreen(panel));
const pb = await panel.boundingBox();
const side = await page.locator("[data-side-panel]").boundingBox();
check("on the right, clear of the column on the left", !!pb && (!side || pb.x > side.x + side.width + 200), pb ? `panel at x=${Math.round(pb.x)}` : "no panel");
check("it says what the part is", (await panel.locator("[data-space-what]").inputValue()) === "Join");
check("and what was asked", (await panel.locator("[data-space-asked]").inputValue()) === "a warm invitation, one line");
const modelName = (await panel.locator("[data-space-model]").innerText()).trim();
check("and which model the route will send it to", modelName.length > 0 && !/^No model/.test(modelName), modelName);
const order = async () => panel.locator("[data-space-step]").evaluateAll((els) => els.map((e) => e.dataset.spaceStep));
const before = await order();
check("and the steps, starting by reading the drawing", before[0] === "read" && before.length >= 3, before.join(" › "));
await shot("panel");

/* 4. The order is the person's to change, and it stays changed */
await panel.getByTestId("space-step-down-read").click();
await page.waitForTimeout(200);
const after = await order();
check("moving the first step later puts it second", after[1] === "read" && after[0] === before[1], after.join(" › "));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const part2 = await page.locator('[data-node-id="n_join"]').boundingBox();
await page.mouse.click(part2.x + part2.width / 2, part2.y + part2.height / 2);
await page.waitForTimeout(400);
const kept = await page.locator('[data-space-panel="n_join"] [data-space-step]').evaluateAll((els) => els.map((e) => e.dataset.spaceStep));
check("and the order is still the person's after a reload", kept.join(",") === after.join(","), kept.join(" › "));
const panel2 = page.locator('[data-space-panel="n_join"]');
await panel2.locator("[data-space-plan-reset]").click();
await page.waitForTimeout(200);
const reset = await panel2.locator("[data-space-step]").evaluateAll((els) => els.map((e) => e.dataset.spaceStep));
check("Let the route decide puts the route's order back", reset.join(",") === before.join(","), reset.join(" › "));
check("the hole is still open after the reload", (await page.locator('[data-space="sp_hole"] [data-space-horizon]').getAttribute("data-space-open")) !== null);

/* 5. The construct box */
const boxKey = page.locator('[data-space="sp_box"] [data-space-construct-key]');
check("the other placeholder still offers its keys", await onScreen(boxKey));
const bc = centroid(BOX);
const bhost = page.locator('[data-space="sp_box"]');
const br = await bhost.boundingBox();
const bb = bounds(BOX);
const bscale = br.width / (bb.w + HALO_PAD * 2);
const [bx, by] = [br.x + (bc[0] - bb.x + HALO_PAD) * bscale, br.y + (bc[1] - bb.y + HALO_PAD) * bscale];
const boxBefore = await pixel(bx, by + 40);
await boxKey.click();
await page.waitForTimeout(500);
const construct = page.locator('[data-space="sp_box"] [data-space-construct]');
check("Construct makes a construct box where the line was", await onScreen(construct));
check("in the lantern's own language", await construct.evaluate((el) => el.classList.contains("molten") && !el.classList.contains("molten-ember") && !el.classList.contains("molten-verdant")));
check("cut to the drawn line", await construct.evaluate((el) => /^path\(/.test(getComputedStyle(el).clipPath)));
const boxAfter = await pixel(bx, by + 40);
check("and it reads red, not the page", boxAfter[0] > boxAfter[1] + 10 && luma(boxAfter) !== luma(boxBefore), `${rgb(boxAfter)}, was ${rgb(boxBefore)}`);
await shot("construct");

console.log("  wait  drawing a space by hand: the tool's key and its bar button are hypatia's; checked here when they land");

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
