/**
 * The board keeps up with the hand.
 *
 * Two gestures were slow, and each for its own reason:
 *
 *  · **Panning.** The workspace's weather is a full-surface canvas repaint on
 *    a clock of its own, and it ran at thirty a second whatever else was
 *    happening — including while every part on the board was being dragged
 *    under the hand. The clouds and the embers are two layers now, on two
 *    clocks (the dear half drifts at two a second, the cheap half keeps
 *    thirty), and both hold still while the board is being dragged.
 *
 *  · **Dragging the sun.** Every pointermove wrote the lamp to the store
 *    twice, and every write re-rendered every part so each could recompute
 *    its own shadow. The shadow is a CSS variable now: one pass per animation
 *    frame, geometry measured once when the drag begins, surfaces off screen
 *    skipped, and the store written once — on the drop.
 *
 * What is held here is the shape of both fixes and the frame budget they were
 * for. Numbers are deliberately loose: the point is that a frame is not lost,
 * not that a particular machine hits a particular millisecond.
 *
 *   node tests/board-speed.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 0. What a lit part asks for                                         */
/* ------------------------------------------------------------------ */

/*
 * The whole mechanism in one line: the theme hands the part
 * `var(--lift-shadow, <the shadow>)` rather than the shadow. With no drag on,
 * the variable is unset and the part gets the fallback — the same string this
 * used to hand it — and while the sun is being dragged `lightRig.ts` sets the
 * variable on the part's box instead, with no render behind it.
 */
{
  // Read rather than called: `parts/theme.ts` reaches `look.ts` through an
  // extensionless import, which the bundler resolves and node does not.
  const theme = readFileSync(new URL("../src/features/studio/parts/theme.ts", import.meta.url), "utf8");
  const line = theme.split("\n").find((l) => l.includes("shadow:") && l.includes("return {")) ?? "";
  check("a lit part asks for the shadow through a variable", /shadow: `var\(--lift-shadow, \$\{near\}, \$\{far\}\)`/.test(line), line.trim().slice(0, 74));
  check("and for the sheen the same way", /sheen: `var\(--lift-sheen, \$\{lit\}\)`/.test(line));
  check("with the worked-out values as the fallbacks, so an undragged board is unchanged", /\$\{near\}, \$\{far\}/.test(line) && /\$\{lit\}/.test(line));
}

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const node = (id, featureId, label, x, y, w, h) => ({
  id, pageId: "p0", featureId, label, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("top", "hero-split", "Hero", 60, 60, 1320, 360),
    node("mid", "feature-cards", "Cards", 60, 460, 640, 260),
    node("cta", "cta-primary", "Join", 820, 500, 320, 64),
    // Far below the fold: the one that must never be worked on.
    node("far", "feature-cards", "Deep", 60, 4200, 640, 260),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({
  headless: true,
  // Without these the browser serves rAF at a flat thirty and every frame
  // measurement below is a measurement of the harness.
  args: ["--disable-gpu-vsync", "--disable-frame-rate-limit", ...(process.env.PLAYWRIGHT_CHROMIUM ? ["--no-sandbox"] : [])],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2200);

/* ------------------------------------------------------------------ */
/* 1. The ground is two layers on two clocks                           */
/* ------------------------------------------------------------------ */

check("the clouds and the embers are separate layers", (await page.locator("[data-ground-clouds]").count()) === 1 && (await page.locator("[data-ground-sparks]").count()) === 1);

const shot = (sel) => page.locator(sel).evaluate((el) => el.toDataURL().length + ":" + el.toDataURL().slice(-64));
{
  // Counted over a second rather than sampled twice: the clouds do redraw,
  // just an order of magnitude less often, and two samples 200ms apart can
  // straddle one of their ticks by luck.
  const sparks = new Set();
  const clouds = new Set();
  const t0 = Date.now();
  for (let i = 0; i < 14; i++) {
    sparks.add(await shot("[data-ground-sparks]"));
    clouds.add(await shot("[data-ground-clouds]"));
    await page.waitForTimeout(90);
  }
  // Reading a canvas back is itself slow, so the window is however long the
  // sampling took: the embers are new every time they are looked at, and the
  // clouds are compared against the wall clock rather than against them.
  const secs = (Date.now() - t0) / 1000;
  check("the embers keep moving", sparks.size >= 6, `${sparks.size} distinct in ${secs.toFixed(1)}s`);
  check(
    "the clouds drift at about two a second, not thirty",
    clouds.size <= secs * 3 + 1 && clouds.size < sparks.size,
    `clouds ${clouds.size} in ${secs.toFixed(1)}s · embers ${sparks.size}`,
  );
}

/* ------------------------------------------------------------------ */
/* 2. And neither moves while the board is dragged                     */
/* ------------------------------------------------------------------ */
{
  await page.evaluate(() => { document.documentElement.dataset.boardDrag = "1"; });
  await page.waitForTimeout(120);
  const a = await shot("[data-ground-sparks]");
  await page.waitForTimeout(400);
  const b = await shot("[data-ground-sparks]");
  check("the ground holds still while the hand is down on the board", a === b);
  await page.evaluate(() => { delete document.documentElement.dataset.boardDrag; });
  await page.waitForTimeout(200);
  const c = await shot("[data-ground-sparks]");
  check("and starts again when it lets go", c !== b);
}

/* ------------------------------------------------------------------ */
/* 3. Panning holds the frame                                          */
/* ------------------------------------------------------------------ */

const START = `window.__f = []; (function l(){ window.__r = requestAnimationFrame((t) => { window.__f.push(t); l(); }); })();`;
const STOP = `cancelAnimationFrame(window.__r); (() => {
  const f = window.__f, d = [];
  for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  d.sort((a, b) => a - b);
  const at = (q) => d.length ? +d[Math.min(d.length - 1, Math.floor(d.length * q))].toFixed(1) : NaN;
  return { frames: d.length, p50: at(0.5), p95: at(0.95), max: +(d[d.length - 1] ?? 0).toFixed(1) };
})()`;

await page.keyboard.press("h");
await page.waitForTimeout(300);
await page.mouse.move(760, 520);
await page.mouse.down();
await page.evaluate(START);
for (let i = 0; i < 60; i++) {
  await page.mouse.move(760 - i * 3, 520 + Math.sin(i / 6) * 90);
  await new Promise((r) => setTimeout(r, 12));
}
const pan = await page.evaluate(STOP);
await page.mouse.up();
await page.keyboard.press("v");
check("panning: the middle frame is well inside the budget", pan.p50 < 16.7, `p50 ${pan.p50}ms of ${pan.frames} frames`);
check("panning: nothing stalls", pan.p95 < 33 && pan.max < 120, `p95 ${pan.p95}ms · max ${pan.max}ms`);

/* ------------------------------------------------------------------ */
/* 4. The sun's drag: variables, not renders                           */
/* ------------------------------------------------------------------ */

const frame = await page.locator("[data-frame]").boundingBox();
/*
 * An unlit board is untouched.
 *
 * The shadow is applied by one rule off `--lift-shadow`, and with no lamp
 * there is no variable: the rule falls back to `none`, which is what every
 * part drew before any of this existed.
 */
check(
  "with no lamp, no part carries a shadow",
  await page.evaluate(() => [...document.querySelectorAll("[data-node-id] [data-mode]")].every((el) => getComputedStyle(el).boxShadow === "none")),
  await page.evaluate(() => [...document.querySelectorAll("[data-node-id] [data-mode]")].map((el) => getComputedStyle(el).boxShadow.slice(0, 10)).join(" ")),
);
const seam = await page.evaluate(() => typeof window.__studioLightTo === "function");
check("the drag can be driven without the wheel", seam);

await page.evaluate(() => window.__studioLightStart());
await page.evaluate(({ x, y }) => window.__studioLightTo({ x, y }), { x: frame.x + 240, y: frame.y + 140 });
await page.waitForTimeout(200);
const varsOn = await page.locator('[data-node-id="mid"]').evaluate((el) => el.style.getPropertyValue("--lift-shadow"));
check("a surface gets its shadow as a variable", /px .*oklch/.test(varsOn), varsOn.slice(0, 44) || "(none)");
check("the store is not written while the hand is moving", (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.look.light.on)) === false);
const varsFar = await page.locator('[data-node-id="far"]').evaluate((el) => el.style.getPropertyValue("--lift-shadow"));
check("a surface off screen is skipped entirely", varsFar === "", varsFar.slice(0, 30));

{
  // Fifty moves inside one frame must be one pass, not fifty.
  const before = await page.evaluate(() => window.__studioLightPasses());
  await page.evaluate(({ x, y }) => {
    for (let i = 0; i < 50; i++) window.__studioLightTo({ x: x + i, y: y + i });
  }, { x: frame.x + 200, y: frame.y + 200 });
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__studioLightPasses());
  check("fifty moves in one frame are one pass", after - before === 1, `${after - before} passes`);
}

{
  await page.evaluate(START);
  const t0 = Date.now();
  let n = 0;
  while (Date.now() - t0 < 1200) {
    const a = ((Date.now() - t0) / 1200) * Math.PI * 2;
    await page.evaluate(({ x, y }) => window.__studioLightTo({ x, y }), { x: frame.x + 400 + Math.cos(a) * 260, y: frame.y + 260 + Math.sin(a) * 160 });
    await new Promise((r) => setTimeout(r, 12));
    n++;
  }
  const sun = await page.evaluate(STOP);
  check("dragging the sun: every frame inside the budget", sun.p95 < 16.7, `p95 ${sun.p95}ms over ${n} moves, ${sun.frames} frames`);
  check("dragging the sun: nothing stalls", sun.max < 120, `max ${sun.max}ms`);
}

await page.evaluate(() => window.__studioLightEnd(true));
await page.waitForTimeout(400);
check("the drop is the one write of the whole gesture", (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.look.light.on)) === true);
/*
 * The drop hands the variable over rather than taking it away.
 *
 * Removing it first and letting the render put it back blinks every shadow
 * on the board out for the frame in between, so on a hit the rig leaves what
 * it wrote and the render that follows overwrites the same property with the
 * committed lamp's own value. On a miss — let go off the page — they come
 * straight off and the board goes back to the lamp it had.
 */
check(
  "the drop leaves the shadow standing, not a blank frame",
  (await page.locator('[data-node-id="mid"]').evaluate((el) => el.style.getPropertyValue("--lift-shadow"))) !== "",
);
check(
  "and every surface is wearing it, not just the buttons",
  await page.evaluate(() => ["mid", "cta", "top"].every((id) => {
    const box = document.querySelector(`[data-node-id="${id}"] [data-mode]`);
    return !!box && getComputedStyle(box).boxShadow !== "none";
  })),
  await page.evaluate(() => ["mid", "cta", "top"].map((id) => `${id}:${(getComputedStyle(document.querySelector(`[data-node-id="${id}"] [data-mode]`)).boxShadow || "").slice(0, 14)}`).join(" ")),
);
{
  // Let go off the page: nothing was chosen, so the board goes back to the
  // lamp it had rather than keeping wherever the hand happened to be.
  const committed = await page.locator('[data-node-id="mid"]').evaluate((el) => el.style.getPropertyValue("--lift-shadow"));
  await page.evaluate(() => window.__studioLightStart());
  await page.evaluate(() => window.__studioLightTo({ x: 4, y: 4 }));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__studioLightEnd(false));
  await page.waitForTimeout(400);
  const after = await page.locator('[data-node-id="mid"]').evaluate((el) => el.style.getPropertyValue("--lift-shadow"));
  check("a miss puts the board back on the lamp it had", after === committed, `${after.slice(0, 24)} vs ${committed.slice(0, 24)}`);
}


await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
