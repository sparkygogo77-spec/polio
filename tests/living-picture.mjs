#!/usr/bin/env node
/**
 * A PICTURE OR A SHAPE MOVES WITH NO PROMPT, AND MOVES THE SAME ON THE SITE.
 *
 * J (2026-10-08): generated pictures and drawn shapes sat still unless a
 * code chat wrote their motion. Now a part picks one of eight motions by
 * name (`living.ts`): drift, breathe, shimmer, glow pulse and parallax for
 * pictures; draw on, trace glow and wobble for shapes. A picture can be cut
 * into layers (`livingCut.ts`) that drift at their own depths. It all goes
 * back to the code as tokens and fixed keyframes in the style layer.
 *
 * Two halves:
 *   1. pure: the tokens and slots a motion writes, layers, the style layer
 *      rule for a PonsStars panel with its keyframes and reduced-motion
 *      rule, joining a captured animation, taking it off, the brief;
 *   2. in Chromium: a light-construct picture cut into three layers, the
 *      layer put on a PonsStars-like page, and the panel really moving:
 *      its layers drift at different depths, breathe swells, wobble turns,
 *      and a visitor asking for reduced motion sees it still.
 *
 *   node tests/living-picture.mjs
 *
 * Covers: src/features/studio/living.ts, src/features/studio/livingCut.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/inspector/livingField.tsx, src/features/studio/shelf/parts/theme.ts
 */
import { createRequire, stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
import { describeLiving, liveCss, liveLayers, liveName, liveStyle, LIVE_KEYFRAMES, newLiving, switchPreset } from "../src/features/studio/living.ts";
import { artCss, buildLayer, changedDeclarations, lookOf } from "../src/features/studio/send-out/styleLayer.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ---------------------------------------------------------------- 1. pure */
const l0 = newLiving("breathe");
const css0 = liveCss(l0);
check("a motion goes out as tokens", css0["--live-seconds"] === "4s" && css0["--live-amount"] === "0.5" && !!css0["--live-colour"], JSON.stringify(css0));
check("and plays fixed keyframes that read them", css0.animation === "polio-live-breathe var(--live-seconds) ease-in-out infinite alternate" && LIVE_KEYFRAMES.includes("@keyframes polio-live-breathe"));
check("every preset has its keyframes", ["drift", "breathe", "shimmer", "glow", "parallax", "draw", "trace", "wobble"].every((p) => LIVE_KEYFRAMES.includes(`@keyframes ${liveName(newLiving(p))} `)));
check("switching preset takes that preset's usual speed", switchPreset(l0, "drift").seconds === 8 && switchPreset(l0, "drift").amount === 0.5);
check("speed and strength stay in range", liveCss({ ...l0, seconds: 99, amount: 7 })["--live-seconds"] === "20s" && liveCss({ ...l0, seconds: 99, amount: 7 })["--live-amount"] === "1");
check("one layer is no cut", liveLayers({ ...l0, layers: ["data:a"] }).length === 0 && liveLayers({ ...l0, layers: ["a", "b", "c", "d", "e"] }).length === 4);
const SRC = ["data:image/png;base64,FRONT", "data:image/png;base64,MID", "data:image/png;base64,BACK"];
const drift = { ...newLiving("drift"), layers: SRC };
const dcss = liveCss(drift);
check("a cut picture drifts on its own keyframes, one place per layer", liveName(drift) === "polio-live-drift-3" && LIVE_KEYFRAMES.includes("@keyframes polio-live-drift-3") && dcss["background-size"].split(",").length === 3);
check("its layers are a token, front first", dcss["--live-layers"].startsWith('url("data:image/png;base64,FRONT")') && dcss["background-image"] === "var(--live-layers)");
check("parallax follows the scroll, not a clock", liveCss(newLiving("parallax"))["animation-timeline"] === "view()");
check("shimmer's light is a mask, so it sweeps over whatever the part draws", !!liveStyle(newLiving("shimmer")).WebkitMaskImage && liveStyle(newLiving("shimmer")).maskSize === "300% 100%");
check("moving parts use translate, scale and rotate, so a part's own transform stays", !/transform:/.test(LIVE_KEYFRAMES) && /scale:/.test(LIVE_KEYFRAMES) && /rotate:/.test(LIVE_KEYFRAMES));

/* A PonsStars panel, as brought in. */
const panel = { id: "p1", pageId: "play", featureId: "box", x: 40, y: 80, w: 480, h: 260, content: "", hooks: { "data-hook": "match-panel" } };
const was = lookOf(panel);
const living = { ...panel, art: { live: drift }, source: { file: "play.html", hook: { attr: "data-hook", value: "match-panel" }, was } };
check("the part's slots carry the motion", artCss(living).animation?.startsWith("polio-live-drift-3"));
const decl = changedDeclarations(was, lookOf(living), { dx: 0, dy: 0 });
check("the layer writes the motion for the hook", decl.includes("--live-seconds: 8s") && decl.some((d) => d.startsWith("animation: polio-live-drift-3")), decl.join("; ").slice(0, 200));
const source = { repo: "x/PST", ref: "main", dir: "web", files: [{ file: "play.html", pageId: "play", hooks: [{ attr: "data-hook", value: "match-panel", line: 3, imported: true }], vars: [] }] };
const layer = buildLayer([living], null, source, { kit: true });
check("a builder-ready repository gets it keyed by data-hook", layer.rules.some((r) => r.selector === '[data-hook="match-panel"]' && r.declarations.includes("background-image: var(--live-layers)")));
check("the layer carries the keyframes once", layer.css.split("@keyframes polio-live-drift-3 ").length === 2);
check("and holds it still for a visitor who asks for less motion", /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-hook="match-panel"\] \{ animation: none !important; \}/.test(layer.css));
check("a layer with nothing moving carries no keyframes", !buildLayer([{ ...living, art: null }], null, source, { kit: true }).css.includes("@keyframes"));
const captured = { ...living, motion: { animation: [{ name: "pst-pulse", duration: "2s", iterations: "infinite" }] }, art: { live: newLiving("parallax") } };
check("it plays after an animation the page already had", artCss(captured).animation === "pst-pulse 2s infinite, polio-live-parallax linear both" && artCss(captured)["animation-timeline"] === "auto, view()", artCss(captured).animation);
const off = changedDeclarations(lookOf(living), lookOf({ ...living, art: null }), { dx: 0, dy: 0 });
check("taking it off writes its slots back to nothing", off.includes("animation: none") && off.includes("background-image: none"), off.join("; ").slice(0, 200));
check("the brief says it in words", /no script/.test(describeLiving(drift)) && /3 layers/.test(describeLiving(drift)) && /reduced motion/.test(describeLiving(drift)));

/* -------------------------------------------------------------- 2. Chromium */
/* The cutter, as the browser runs it: its own source with the types taken off. */
const cutSrc = stripTypeScriptTypes(readFileSync(new URL("../src/features/studio/livingCut.ts", import.meta.url), "utf8"))
  .replace(/^import .*$/m, "const MAX_LAYERS = 4;").replace(/export async function/, "window.cutLayers = async function");

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  await page.setContent("<!doctype html><body></body>");
  await page.addScriptTag({ content: cutSrc });
  /* A light-construct picture: dark glass, a mid-bright grid, bright glowing edges. */
  const layers = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320; c.height = 200;
    const g = c.getContext("2d");
    g.fillStyle = "#0a1428"; g.fillRect(0, 0, 320, 200);
    g.strokeStyle = "#2a5a7a"; g.lineWidth = 2;
    for (let x = 20; x < 320; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 200); g.stroke(); }
    g.shadowColor = "#3df"; g.shadowBlur = 12; g.strokeStyle = "#cff"; g.lineWidth = 5; g.strokeRect(24, 24, 272, 152);
    return window.cutLayers(c.toDataURL("image/png"), 3);
  });
  check("the picture cuts into three layers", layers.length === 3 && layers.every((s) => s.startsWith("data:image/png")));
  const alpha = await page.evaluate(async (layers) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const out = [];
    for (const s of layers) {
      const img = await load(s);
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let seen = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) seen++;
      out.push({ share: seen / (d.length / 4), edge: d[(24 * c.width + 24) * 4 + 3], ground: d[(100 * c.width + 160) * 4 + 3] });
    }
    return out;
  }, layers);
  check("the back layer is the whole picture", alpha[2].share > 0.99, alpha.map((a) => a.share.toFixed(2)).join(" "));
  check("the front layer holds only the bright edge, see-through over the dark ground", alpha[0].share < 0.3 && alpha[0].edge > 200 && alpha[0].ground < 30, JSON.stringify(alpha[0]));
  check("each layer in front holds less than the one behind it", alpha[0].share < alpha[1].share && alpha[1].share < alpha[2].share);

  /* The layer on a PonsStars-like page: the panel drifting in three layers, a breathing badge, a wobbling mark. */
  const nodes = [
    { ...living, art: { live: { ...newLiving("drift"), seconds: 1, amount: 1, layers } } },
    { ...panel, id: "b", hooks: { "data-hook": "badge" }, art: { live: { ...newLiving("breathe"), seconds: 1, amount: 1 } }, source: { file: "play.html", hook: { attr: "data-hook", value: "badge" }, was } },
    { ...panel, id: "w", hooks: { "data-hook": "mark" }, art: { live: { ...newLiving("wobble"), seconds: 1, amount: 1 } }, source: { file: "play.html", hook: { attr: "data-hook", value: "mark" }, was } },
  ];
  const lay = buildLayer(nodes, null, { ...source, files: [{ ...source.files[0], hooks: ["match-panel", "badge", "mark"].map((v, i) => ({ attr: "data-hook", value: v, line: 3 + i, imported: true })) }] }, { kit: true });
  const html = `<!doctype html><html><head><style>
    body { margin: 0; background: #0b0f17; }
    [data-hook] { width: 400px; height: 240px; margin: 20px; transform: translateX(10px); }
    ${lay.css}
  </style></head><body><section data-hook="match-panel"></section><div data-hook="badge"></div><div data-hook="mark"></div></body></html>`;
  await page.setContent(html);
  const read = () => page.evaluate(() => {
    const s = (h) => getComputedStyle(document.querySelector(`[data-hook="${h}"]`));
    return { pos: s("match-panel").backgroundPosition, scale: s("badge").scale, rotate: s("mark").rotate, transform: s("badge").transform, running: document.getAnimations().length };
  });
  const a = await read();
  await page.waitForTimeout(400);
  const b = await read();
  check("the page plays three animations from the style layer alone, no script", a.running === 3, String(a.running));
  check("the cut picture's layers move", a.pos !== b.pos, `${a.pos} → ${b.pos}`);
  const xs = (p) => p.split(",").map((v) => parseFloat(v.trim().split(" ")[0]));
  const moved = xs(b.pos).map((x, i) => Math.abs(x - xs(a.pos)[i]));
  check("the front layer moves most and the back least", moved[0] > moved[1] && moved[1] > moved[2], moved.map((m) => m.toFixed(1)).join(" "));
  check("breathe swells", a.scale !== b.scale && [a.scale, b.scale].some((v) => parseFloat(v) > 1.001), `${a.scale} → ${b.scale}`);
  check("and the part's own transform stays", b.transform.includes("10"), b.transform);
  check("wobble turns", a.rotate !== b.rotate, `${a.rotate} → ${b.rotate}`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent(html);
  check("a visitor asking for reduced motion sees it still", (await read()).running === 0);
} finally {
  await browser.close();
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
