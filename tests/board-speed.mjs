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
 *
 * Runs alone: measures stalls while dragging (the longest frame gap); under load one ran to 176ms.
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
  const theme = readFileSync(new URL("../src/features/studio/shelf/parts/theme.ts", import.meta.url), "utf8");
  const line = theme.split("\n").find((l) => l.includes("shadow:") && l.includes("return {")) ?? "";
  // Pinned to the mechanism, not to the names of the locals. These three read
  // `${near}, ${far}` and `${lit}` until the two drifted copies of the light
  // formula became one in `look.ts`; the fallback is now whatever `liftCss`
  // worked out, which is the same string by a different name, and a pin that
  // spells the name fails on a rename that changed nothing.
  check("a lit part asks for the shadow through a variable", /shadow: `var\(--lift-shadow, \$\{[^}]+\}\)`/.test(line), line.trim().slice(0, 74));
  check("and for the sheen the same way", /sheen: `var\(--lift-sheen, \$\{[^}]+\}\)`/.test(line));
  check("with the worked-out values as the fallbacks, so an undragged board is unchanged",
    /var\(--lift-shadow, \$\{(?!\s*\}).+?\}\)/.test(line) && /var\(--lift-sheen, \$\{(?!\s*\}).+?\}\)/.test(line)
    && !/var\(--lift-shadow\)/.test(line) && !/var\(--lift-sheen\)/.test(line));
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

/* One cloud layer and one ember canvas, and they must stay separate: the
   clouds never repaint and the embers repaint thirty times a second, so
   putting them on one surface would drag the cheap half up to the cost of
   the expensive one. The four cloud layers became one when they were
   screened into a single tile — four full-screen blended layers was the
   cost of the whole ground. */
check(
  "the clouds and the embers are separate layers",
  (await page.locator("[data-cloud-layer]").count()) === 1 && (await page.locator("[data-ground-sparks]").count()) === 1,
  `${await page.locator("[data-cloud-layer]").count()} cloud layer, ${await page.locator("[data-ground-sparks]").count()} ember canvas`,
);

const shot = (sel) => page.locator(sel).first().evaluate((el) => el.toDataURL().length + ":" + el.toDataURL().slice(-64));
{
  /*
   * The two halves of the ground now move in two quite different ways, and
   * this is where that is held to.
   *
   * The embers are repainted: new pixels thirty times a second, which is
   * what a streak needs. The clouds are not repainted at all — the field is
   * painted once, bigger than the box, and slid on the compositor — so its
   * pixels stay put while its transform changes every frame. It used to be
   * redrawn 2.4 times a second to move it, and 2.4 times a second is what an
   * eye reads as its frame rate.
   */
  const sparks = new Set();
  const clouds = new Set();
  const moves = new Set();
  const t0 = Date.now();
  for (let i = 0; i < 14; i++) {
    sparks.add(await shot("[data-ground-sparks]"));
    clouds.add(await shot("[data-cloud-layer]"));
    moves.add(await page.locator("[data-cloud-layer]").first().evaluate((el) => getComputedStyle(el).transform));
    await page.waitForTimeout(90);
  }
  const secs = (Date.now() - t0) / 1000;
  check("the embers keep moving", sparks.size >= 6, `${sparks.size} distinct in ${secs.toFixed(1)}s`);
  check("the clouds are not redrawn to drift", clouds.size === 1, `${clouds.size} distinct cloud fields in ${secs.toFixed(1)}s`);
    /* The clouds are moved by one CSS animation now, not by a transform
     written every frame, so the inline style never changes and counting
     writes counts nothing. What matters is that the layer is actually
     travelling, which is the computed transform. */
  check("they are moved instead", moves.size >= 2, `${moves.size} distinct offsets in ${secs.toFixed(1)}s`);
}

/* ------------------------------------------------------------------ */
/* 2. And neither moves while the board is dragged                     */
/* ------------------------------------------------------------------ */
{
  const cloud = () => page.evaluate(() => getComputedStyle(document.querySelector("[data-cloud-layer]")).transform);

  /* Nothing holds for a drag any more.
   *
   * There was a pause: a flag on the root while the hand was down, and the
   * ground stopped where it was. It was bought when the clouds were
   * repainted every frame to move them, so a pan and a full-surface repaint
   * wanted the same main thread. The field is painted once and slid on the
   * compositor now, and a pan with the whole ground running measures inside
   * budget at both sizes (`tests/pan-weather.mjs`), so the pause was paying a
   * bill that no longer arrives. It is gone, and so is the flag that could
   * go on and not come off — which is how the sparks got stuck still.
   *
   * The flag is set here anyway, on purpose: if anything ever starts reading
   * it again, this fails. */
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.evaluate(() => { document.documentElement.dataset.boardDrag = "1"; });
  await page.waitForTimeout(150);
  const cloudA = await cloud();
  const sparkA = await shot("[data-ground-sparks]");
  await page.waitForTimeout(450);
  check("the clouds drift on with the hand down", (await cloud()) !== cloudA);
  check("and the embers burn on with it", (await shot("[data-ground-sparks]")) !== sparkA);
  await page.mouse.up();
  await page.evaluate(() => { delete document.documentElement.dataset.boardDrag; });
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

/*
 * Panning, measured without the ground, for the same reason the sun drag is:
 * four window-sized layers composited every frame is the nebula's cost, it
 * is measured where it belongs (`board-layout.mjs`), and on a container that
 * rasterises in software it swamps whatever else a frame is doing. What is
 * under test here is the pan.
 */
const noGround = await page.addStyleTag({ content: "[data-ground-clouds],[data-ground-sparks]{display:none !important}" });
/* There is no hand tool and no "h" key (`Canvas.tsx:679-689`): a pan is a
   middle-button drag from anywhere, or a drag on bare ground. The middle
   button, so the press cannot land on the frame and start a select instead. */
const frameBefore = await page.locator("[data-frame]").first().boundingBox();
await page.mouse.move(760, 520);
await page.mouse.down({ button: "middle" });
await page.evaluate(START);
for (let i = 0; i < 60; i++) {
  await page.mouse.move(760 - i * 3, 520 + Math.sin(i / 6) * 90);
  await new Promise((r) => setTimeout(r, 12));
}
const pan = await page.evaluate(STOP);
await page.mouse.up({ button: "middle" });
const frameAfter = await page.locator("[data-frame]").first().boundingBox();
// An inert hand would measure an idle page; the frame has to have moved under the drag.
const panned = frameBefore && frameAfter ? Math.hypot(frameAfter.x - frameBefore.x, frameAfter.y - frameBefore.y) : 0;
check("panning: the view moved under the hand", panned > 60, `${Math.round(panned)}px`);
check("panning: the middle frame is well inside the budget", pan.p50 < 16.7, `p50 ${pan.p50}ms of ${pan.frames} frames`);
check("panning: nothing stalls", pan.p95 < 33 && pan.max < 120, `p95 ${pan.p95}ms · max ${pan.max}ms, ground put away`);
await noGround.evaluate((el) => el.remove());

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
  /*
   * The ground is put away for this one.
   *
   * What is under test here is the lamp rig's own cost per frame, and since
   * the nebula became four window-sized layers the compositor carries on
   * every frame, a frame time measured with it on is a measurement of this
   * container's software rasteriser rather than of the rig. The ground has
   * its own numbers in `board-layout.mjs` and in `docs/shelf/README.md`.
   */
  const hidden = await page.addStyleTag({ content: "[data-ground-clouds],[data-ground-sparks]{display:none !important}" });
  await page.waitForTimeout(300);
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
  await hidden.evaluate((el) => el.remove());
  check("dragging the sun: every frame inside the budget", sun.p95 < 16.7, `p95 ${sun.p95}ms over ${n} moves, ${sun.frames} frames, ground put away`);
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
