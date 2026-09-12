/**
 * The ground may not repeat inside a screenful.
 *
 * The rule, in J's words: *the period along a layer's heading must be at
 * least the viewport extent along that heading, and comfortably more.* Break
 * it and the same cloud is on both sides of the board at once, which is what
 * "repeating squares and repeating circles" was.
 *
 * The old ground broke it twice over. Its composite tile was 1536px, narrower
 * than any real board, and inside that tile were four sub-patterns with
 * periods of 768, 512, 256 and 192 — a 192px puff thirteen times across a
 * 2560 screen. This checks the outer period against the box, and then goes
 * looking for the inner ones directly in the pixels: if the field still
 * repeated at some smaller step, a column would match a column that far away
 * far better than chance.
 *
 * It also reports what the ask wanted reported — period and pixels a second
 * per layer, measured off the running page rather than read off the CSS.
 *
 *   node tests/ground-period.mjs [url]
 */
import { createRequire } from "node:module";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

/** How much wider than the box the period must be. Copied, not imported. */
const ROOM = 1.25;
/** How long to watch a layer travel before dividing distance by time. */
const WATCH_MS = 12000;

const URL_ = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

for (const vp of [{ width: 2560, height: 1440 }, { width: 1282, height: 917 }]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
  await page.waitForTimeout(2000);

  console.log(`\n— viewport ${vp.width}×${vp.height} —`);

  const read = () => page.evaluate(() => {
    const holder = document.querySelector("[data-cloud-layer]")?.parentElement;
    const box = holder?.getBoundingClientRect();
    return [...document.querySelectorAll("[data-cloud-layer]")].map((c) => {
      const st = getComputedStyle(c);
      const m = new DOMMatrixReadOnly(st.transform);
      return {
        name: c.dataset.cloudLayer,
        gx: Number((c.style.getPropertyValue("--gx") || "0").replace("px", "")),
        gy: Number((c.style.getPropertyValue("--gy") || "0").replace("px", "")),
        cw: c.width, ch: c.height,
        w: parseFloat(st.width), h: parseFloat(st.height),
        boxW: box?.width ?? 0, boxH: box?.height ?? 0,
        tx: m.m41, ty: m.m42,
        at: performance.now(),
      };
    });
  });

  const a = await read();
  check("the ground is one layer", a.length === 1, `${a.length}`);

  for (const l of a) {
    /* The box's extent along the heading: for a heading that is not axis
       aligned it is the box's shadow on that direction, which for a
       rectangle is |w·cos| + |h·sin|. */
    const len = Math.hypot(l.gx, l.gy);
    const ux = len ? l.gx / len : 1, uy = len ? l.gy / len : 0;
    const extent = Math.abs(l.boxW * ux) + Math.abs(l.boxH * uy);
    check(
      `${l.name}: the period clears the board along its heading`,
      len >= extent * ROOM,
      `period ${len.toFixed(0)}px against ${extent.toFixed(0)}px of board — ${(len / extent).toFixed(2)}×, wanted ${ROOM}×`,
    );
    check(
      `${l.name}: the canvas carries the board plus a whole period`,
      l.w >= extent + len - 1,
      `${l.w.toFixed(0)}px of canvas for ${extent.toFixed(0)} + ${len.toFixed(0)}`,
    );
    console.log(`       ${l.name}: backing store ${l.cw}×${l.ch} = ${((l.cw * l.ch * 4) / 1048576).toFixed(1)}MB`);
  }

  /* Pixels a second, measured: where the layer actually is, twice, far
     enough apart that the difference is not a rounding. */
  await page.waitForTimeout(WATCH_MS);
  const b = await read();
  for (let i = 0; i < a.length; i++) {
    const l = a[i], m = b[i];
    const secs = (m.at - l.at) / 1000;
    /* It loops, so a wrap looks like a big jump backwards. */
    let dx = m.tx - l.tx, dy = m.ty - l.ty;
    if (dx < -1) dx += Math.abs(l.gx);
    if (dy < -1) dy += Math.abs(l.gy);
    const px = Math.hypot(dx, dy) / secs;
    check(`${l.name}: it is moving, at the pace it says`, Math.abs(px - 6) < 1, `${px.toFixed(3)}px a second over ${secs.toFixed(1)}s`);
  }

  /* And now the inner periods, in the pixels themselves. A field that still
     repeated every k would have column x and column x+k almost identical. */
  const rep = await page.evaluate(() => {
    const c = document.querySelector("[data-cloud-layer]");
    const period = Math.abs(Number((c.style.getPropertyValue("--gx") || "0").replace("px", ""))) || c.width;
    const scratch = document.createElement("canvas");
    const W = Math.min(c.width, 2048), H = Math.min(c.height, 512);
    scratch.width = W; scratch.height = H;
    const g = scratch.getContext("2d", { willReadFrequently: true });
    g.drawImage(c, 0, 0, W, H, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const col = new Float64Array(W);
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4;
        s += (d[i] * 0.3 + d[i + 1] * 0.6 + d[i + 2] * 0.1) * (d[i + 3] / 255);
      }
      col[x] = s / H;
    }
    const mean = col.reduce((p, q) => p + q, 0) / W;
    let varr = 0;
    for (let x = 0; x < W; x++) varr += (col[x] - mean) ** 2;
    varr /= W;
    // Correlation of the column profile with itself, shifted by k.
    const corr = (k) => {
      let s = 0, n = 0;
      for (let x = 0; x + k < W; x++, n++) s += (col[x] - mean) * (col[x + k] - mean);
      return varr ? s / n / varr : 0;
    };
    /* Only steps between twice the largest cloud and one period. Below that
       a cloud simply overlaps itself, which is what a cloud is; at the period
       the canvas holds the field twice on purpose, which is the mechanism. */
    const ks = [256, 384, 512, 768, 1024, 1536, 2048].filter((k) => k < period && k < W);
    return { period, worst: ks.map((k) => [k, corr(k)]).sort((p, q) => q[1] - p[1])[0], all: ks.map((k) => [k, +corr(k).toFixed(2)]) };
  });
  check(
    "nothing repeats at any step smaller than the period",
    rep.worst[1] < 0.5,
    `strongest self-match is ${(rep.worst[1] * 100).toFixed(0)}% at ${rep.worst[0]}px, over steps up to the ${rep.period}px period — ${rep.all.map(([k, v]) => `${k}:${v}`).join(" ")}`,
  );

  await page.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
