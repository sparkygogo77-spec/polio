/**
 * The ground is nebula and nothing else, and one ember in five is green.
 *
 * Two things this proves, because both are the kind that a screenshot alone
 * argues about:
 *
 *  · **No grid, anywhere.** The dotted/lined overlay used to be a fixed
 *    `.ambient-grid` div over the whole app, switched by `effects.grid`. The
 *    div, the `bg-grid` utility that drew it, the `--grid-line` colour and
 *    the setting are all gone, so this asserts the absence of each rather
 *    than that the picture looks clean: an overlay at 0 opacity would pass
 *    the eye and fail here.
 *  · **One ember in five is green.** Counted off the ember canvas's own
 *    pixels, by hue, not by reading the source: green pixels over green plus
 *    red pixels, which lands near the share of sparks because every spark is
 *    drawn the same size.
 *
 * Screenshots at both sizes land in .screenshots/.
 *
 *   node tests/ground-clean.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

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
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
mkdirSync("shots", { recursive: true });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

/** Anything that draws a grid, asked for by its own name. */
function gridTraces() {
  const el = document.documentElement;
  const out = { attr: el.dataset.grid ?? null, ambient: document.querySelectorAll(".ambient-grid, .bg-grid").length, repeating: [], varSet: "" };
  out.varSet = getComputedStyle(el).getPropertyValue("--grid-line").trim();
  // Any painted element whose background repeats on a small tile is a grid,
  // whatever it is called.
  for (const n of document.querySelectorAll("body *")) {
    const s = getComputedStyle(n);
    if (s.backgroundImage === "none") continue;
    const size = s.backgroundSize;
    if (!/\d/.test(size)) continue;
    const px = [...size.matchAll(/([\d.]+)px/g)].map((m) => Number(m[1]));
    if (px.length && px.every((v) => v > 0 && v <= 40) && s.backgroundRepeat.startsWith("repeat")) {
      const r = n.getBoundingClientRect();
      if (r.width > 200 && r.height > 200) out.repeating.push(`${n.tagName.toLowerCase()}.${n.className || "-"} ${size}`);
    }
  }
  return out;
}

/** The ember canvas's own pixels, split red from green by hue. */
function emberTally() {
  const c = document.querySelector("canvas[data-ground-sparks]");
  if (!c) return { found: false };
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let red = 0, green = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 8) continue;
    const r = d[i], g = d[i + 1];
    if (g > r * 1.4) green++;
    else if (r > g * 1.4) red++;
  }
  return { found: true, w: c.width, h: c.height, red, green, share: green + red ? green / (green + red) : 0 };
}

async function look(w, h, name) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
  // Long enough for the embers to have been lit and moved a few times.
  await page.waitForTimeout(3500);

  const grid = await page.evaluate(gridTraces);
  check(`${name}: no data-grid attribute`, grid.attr === null, grid.attr ? `still "${grid.attr}"` : "absent");
  check(`${name}: no .ambient-grid / .bg-grid element`, grid.ambient === 0, `${grid.ambient} found`);
  check(`${name}: --grid-line is not defined`, grid.varSet === "", grid.varSet || "unset");
  check(`${name}: nothing tiles a small repeating background`, grid.repeating.length === 0, grid.repeating.join("; ") || "none");

  const t = await page.evaluate(emberTally);
  if (t.found) {
    const pct = (t.share * 100).toFixed(1);
    check(`${name}: embers are one in five green`, t.share > 0.1 && t.share < 0.34, `${pct}% of lit ember pixels (${t.green} green, ${t.red} red)`);
  } else {
    check(`${name}: ember canvas found`, false, "no spark canvas");
  }

  await page.screenshot({ path: `.screenshots/${name}.png` });
  console.log(`       .screenshots/${name}.png  ${w}×${h}`);
  await page.close();

  /* And the same ground magnified four times, because an ember is about a
     pixel across and the colour of one is the whole point here. A device
     scale factor rather than an upscale afterwards: the crop comes out of
     the compositor at 4× so the clouds stay smooth behind the sparks. */
  const zoom = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 4 });
  const zp = await zoom.newPage();
  await zp.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await zp.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
  await zp.waitForTimeout(3500);
  /* Crop bare ground, not the page being built: the frame in the middle is
     the site, and it is black on an empty document, which would make a very
     convincing picture of nothing. Take the gap between the frame's right
     edge and the workspace's. */
  /* Point the magnifier at a green ember that is actually there rather than
     at a strip and hoping: a crop of bare ground is a lottery, and the whole
     question here is the colour. The embers no longer stop for anything — a
     spark drifts a pixel or two between being found and being photographed —
     so the window is wide enough that it stays inside it.
  */
  const findGreen = () => zp.evaluate(() => {
    const g = document.querySelector("[data-workspace-ground]").getBoundingClientRect();
    const f = document.querySelector("[data-frame]")?.getBoundingClientRect();
    const c = document.querySelector("canvas[data-ground-sparks]");
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const bare = (x) => !f || x < f.left - 10 || x > f.right + 10;
    let best = null;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3] < 40) continue;
        if (d[i + 1] <= d[i] * 1.4) continue;
        if (!bare(g.left + x)) continue;
        // The brightest green pixel: the core of a spark, not a tail's end.
        if (!best || d[i + 1] > best.g) best = { x, y, g: d[i + 1] };
      }
    }
    const W = 200, H = 130;
    const cx = best ? g.left + best.x : (f ? f.right + 6 : g.left + 8);
    const cy = best ? g.top + best.y : g.top + g.height * 0.3;
    return {
      x: Math.round(Math.max(g.left, Math.min(g.right - W, cx - W / 2))),
      y: Math.round(Math.max(g.top, Math.min(g.bottom - H, cy - H / 2))),
      width: W, height: H, found: !!best,
    };
  });

  /* At a pane's width the frame covers most of the ground and only a strip
     down each side is bare, so at any one instant there may be no green
     ember standing where a camera can see it. Wait for one rather than
     photograph a strip and call whatever turned up representative. */
  let clip = null;
  for (let i = 0; i < 14; i++) {
    clip = await findGreen();
    if (clip.found) break;
    await zp.waitForTimeout(600);
  }
  check(`${name}: a green ember stood where it could be photographed`, clip.found, clip.found ? "centred on it" : "none reached bare ground in 10s");
  await zp.screenshot({ path: `.screenshots/${name}-embers.png`, clip });
  console.log(`       .screenshots/${name}-embers.png  ${clip.width}×${clip.height} of bare ground at 4×, on a green ember`);
  await zoom.close();
}

await look(1500, 950, "ground-pane");
await look(2560, 1440, "ground-1440p");

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
