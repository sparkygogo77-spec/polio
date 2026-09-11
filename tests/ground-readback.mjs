/**
 * What it costs to read a pixel back off the ground, and why that matters.
 *
 * A 60×40 `getImageData` off a ground canvas on the deploy was timed at about
 * 950ms. That is not the few milliseconds a GPU-to-CPU sync costs; it is the
 * cost of forcing a whole composited layer to rasterise synchronously. The
 * ground's layers are window-sized, promoted with `will-change: transform`
 * and blended with `mix-blend-mode: screen`, and touching one through a 2D
 * context makes the browser flush the lot.
 *
 * That matters well beyond probes, because **a recycle writes to the same
 * canvas**, and a write to a promoted 2D canvas pays the same
 * re-rasterisation. Which is the argument for what the ground does now: the
 * expensive paint happens on an `OffscreenCanvas` that is not composited at
 * all, and the visible layer takes the finished bitmap through
 * `transferFromImageBitmap`.
 *
 * This measures three things against each other so the claim is a number and
 * not a story: a plain unpromoted canvas of the same size, the ground's own
 * layers, and the ember canvas (2D, promoted, but small and never blended).
 *
 *   node tests/ground-readback.mjs [url]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  const time = (f, n = 6) => {
    const runs = [];
    for (let i = 0; i < n; i++) { const t = performance.now(); f(); runs.push(performance.now() - t); }
    runs.sort((a, b) => a - b);
    return Math.round(runs[Math.floor(n / 2)] * 100) / 100;
  };
  const layer = document.querySelector("[data-cloud-layer]");
  const kind = layer?.getContext?.("2d") ? "2d" : "not a 2d context";

  // A control: same size, same content shape, no promotion, no blending.
  const plain = document.createElement("canvas");
  plain.width = layer?.width ?? 2860;
  plain.height = layer?.height ?? 1740;
  const pc = plain.getContext("2d", { willReadFrequently: true });
  pc.fillStyle = "rgba(120,60,200,0.5)";
  pc.fillRect(0, 0, plain.width, plain.height);

  // Reading a promoted layer indirectly: draw it into a small scratch, which
  // is the only way to sample one that carries a bitmap renderer.
  const scratch = document.createElement("canvas");
  scratch.width = 60; scratch.height = 40;
  const sc = scratch.getContext("2d", { willReadFrequently: true });

  const res = {
    layerContext: kind,
    layerSize: layer ? `${layer.width}×${layer.height}` : "none",
    plainReadback: time(() => pc.getImageData(0, 0, 60, 40)),
    layerViaDrawImage: layer ? time(() => { sc.drawImage(layer, 0, 0, 60, 40, 0, 0, 60, 40); sc.getImageData(0, 0, 60, 40); }) : null,
    layerDirect: null,
  };
  // Only possible on the old ground, where the layer still has a 2D context.
  const lc = layer?.getContext?.("2d");
  if (lc) res.layerDirect = time(() => lc.getImageData(0, 0, 60, 40));

  /* The old ground's conditions, rebuilt on purpose: a window-sized 2D
     canvas in the document, promoted with `will-change: transform` and
     blended with `mix-blend-mode: screen`, which is exactly what every cloud
     layer used to be. If a readback off this is cheap here and ruinous on
     the deploy, the difference is the graphics card, and this box cannot
     see the phenomenon at all — worth knowing either way. */
  const holder = document.querySelector("[data-ground-clouds]");
  const old = document.createElement("canvas");
  old.width = layer?.width ?? 2860;
  old.height = layer?.height ?? 1740;
  old.style.cssText = "position:absolute;left:0;top:0;mix-blend-mode:screen;will-change:transform;transform:translate3d(0,0,0);opacity:0.001;";
  holder?.appendChild(old);
  const oc = old.getContext("2d");
  oc.fillStyle = "rgba(120,60,200,0.5)";
  oc.fillRect(0, 0, old.width, old.height);
  // A frame, so it is genuinely promoted and composited before it is read.
  res.promotedBlended = null;
  const sp = document.querySelector("canvas[data-ground-sparks]");
  const spc = sp?.getContext("2d", { willReadFrequently: true });
  res.emberReadback = spc ? time(() => spc.getImageData(0, 0, 60, 40)) : null;
  res.emberSize = sp ? `${sp.width}×${sp.height}` : "none";
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
    res.promotedBlended = time(() => oc.getImageData(0, 0, 60, 40));
    // And what a recycle actually does to such a canvas: a full-surface fill.
    res.promotedFill = time(() => { oc.fillStyle = "rgba(120,60,200,0.5)"; oc.fillRect(0, 0, old.width, old.height); }, 4);
    old.remove();
    done(res);
  })));
});

console.log(`
  cloud layer          ${out.layerSize}, context: ${out.layerContext}
  ember canvas         ${out.emberSize}

  60×40 getImageData, median of 6:
    plain canvas, same size, unpromoted     ${out.plainReadback}ms
    cloud layer, direct 2D read             ${out.layerDirect === null ? "impossible — no 2D context" : `${out.layerDirect}ms`}
    cloud layer, via drawImage into scratch  ${out.layerViaDrawImage}ms
    ember canvas (2D, small, unblended)      ${out.emberReadback}ms

  the old ground's conditions, rebuilt: a window-sized 2D canvas in the
  document, promoted and screen-blended —
    60×40 getImageData                       ${out.promotedBlended}ms
    a full-surface fill, as a recycle does   ${out.promotedFill}ms
`);
await browser.close();
