/**
 * The ground actually paints something.
 *
 * Every ground check written tonight read a canvas's backing store, and that
 * is why a live regression got past all of them: the layers were switched to
 * a bitmap renderer, the bitmap never arrived on hardware with a graphics
 * card, and the workspace went flat black while every suite stayed green.
 * A backing store is what the page *meant* to draw. This reads what a person
 * would actually see.
 *
 * So it screenshots a patch of bare ground and decodes the PNG itself — no
 * image library, just zlib and the PNG spec — then asks three things of the
 * pixels:
 *
 *   · it is not black. A mean well above zero.
 *   · it is not flat. Real spread across the patch, because a solid fill of
 *     any colour is not a nebula.
 *   · it is the nebula's own colours. Violet and magenta carry more blue and
 *     red than green, so a patch whose channels are level is fog, not this.
 *
 * And two guards on the mechanism that failed, because the failure mode was
 * silent and left no console line to find:
 *
 *   · every cloud layer answers `getContext("2d")`. A layer holding a bitmap
 *     renderer cannot be read, cannot be checked, and is one missing frame
 *     away from being invisible.
 *   · the embers have lit pixels.
 *
 *   node tests/ground-paints.mjs [url]
 */
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";
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
  throw new Error("No Playwright found.");
})();

/** A PNG, unpacked far enough to look at. Colour types 2 and 6, 8 bits. */
function decodePng(buf) {
  let p = 8, w = 0, h = 0, type = 6, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tag = buf.toString("ascii", p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (tag === "IHDR") { w = body.readUInt32BE(0); h = body.readUInt32BE(4); type = body[9]; }
    else if (tag === "IDAT") idat.push(body);
    else if (tag === "IEND") break;
    p += 12 + len;
  }
  const chan = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * chan);
  const stride = w * chan;
  let q = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[q++];
    const line = raw.subarray(q, q + stride);
    q += stride;
    const to = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= chan ? out[to + x - chan] : 0;
      const b = y > 0 ? out[to - stride + x] : 0;
      const c = x >= chan && y > 0 ? out[to - stride + x - chan] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[to + x] = v & 255;
    }
  }
  return { w, h, chan, data: out };
}

const URL_ = process.argv[2] ?? "http://localhost:3000";
mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

async function look(w, h, tag) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const noise = [];
  page.on("console", (m) => { if (m.type() === "error") noise.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => noise.push(`threw: ${String(e).slice(0, 160)}`));
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
  await page.waitForTimeout(2600);

  /* The mechanism guards. */
  const mech = await page.evaluate(() => {
    const layers = [...document.querySelectorAll("[data-cloud-layer]")];
    return {
      n: layers.length,
      twoD: layers.filter((c) => { try { return !!c.getContext("2d"); } catch { return false; } }).length,
      sized: layers.filter((c) => c.width > 1 && c.height > 1).length,
      sky: !!document.querySelector("[data-ground-sky]"),
    };
  });
  check(`${tag}: four cloud layers, sized`, mech.n === 4 && mech.sized === 4, `${mech.n} layers, ${mech.sized} sized`);
  check(`${tag}: every layer can still be read as 2D`, mech.twoD === 4, `${mech.twoD}/4 — a bitmap renderer cannot be checked`);
  check(`${tag}: the sky is there`, mech.sky);

  /* The embers, from their own canvas. */
  const lit = await page.evaluate(() => {
    const sp = document.querySelector("canvas[data-ground-sparks]");
    if (!sp?.width) return -1;
    const g = sp.getContext("2d", { willReadFrequently: true });
    const d = g.getImageData(0, 0, sp.width, sp.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  });
  check(`${tag}: the embers are lit`, lit > 20, `${lit} lit pixels`);

  /* Both surfaces, not one.
     The board and the timeline stand on the same ground, and the whole point
     of mounting it once outside the switch is that pressing Finish changes
     what is on the ground and never the ground. So the pixels are sampled on
     each in turn, and the count of grounds is taken on each: one holder, one
     sky, four layers, on both. A second instance would show up here. */
  const groundsOn = () => page.evaluate(() => ({
    holders: document.querySelectorAll("[data-ground-clouds]").length,
    skies: document.querySelectorAll("[data-ground-sky]").length,
    layers: document.querySelectorAll("[data-cloud-layer]").length,
    blends: [...new Set([...document.querySelectorAll("[data-cloud-layer]")].map((c) => getComputedStyle(c).mixBlendMode))].join(","),
    canvases: document.querySelectorAll("canvas").length,
  }));

  /* And the thing itself: what is on the screen where bare ground is. */
  const clip = await page.evaluate(() => {
    const g = document.querySelector("[data-workspace-ground]").getBoundingClientRect();
    const f = document.querySelector("[data-frame]")?.getBoundingClientRect();
    const x = f ? f.right + 6 : g.left + 8;
    return { x: Math.round(x), y: Math.round(g.top + g.height * 0.25), width: Math.max(90, Math.min(300, Math.floor(g.right - 6 - x))), height: 200 };
  });
  const shot = await page.screenshot({ clip });
  const { data, chan, w: pw, h: ph } = decodePng(shot);
  let sum = 0, n = 0, sr = 0, sg = 0, sb = 0;
  const vals = [];
  for (let i = 0; i < data.length; i += chan) {
    const r = data[i], g2 = data[i + 1], b = data[i + 2];
    const y = 0.2126 * r + 0.7152 * g2 + 0.0722 * b;
    sum += y; n++; vals.push(y); sr += r; sg += g2; sb += b;
  }
  const mean = sum / n;
  const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  const [mr, mg, mb] = [sr / n, sg / n, sb / n];
  console.log(`       ${tag}: ${pw}×${ph} of bare ground — mean ${mean.toFixed(1)}, spread ${sd.toFixed(1)}, rgb ${mr.toFixed(0)}/${mg.toFixed(0)}/${mb.toFixed(0)}`);
  check(`${tag}: the ground is not black`, mean > 6, `mean luminance ${mean.toFixed(1)}`);
  check(`${tag}: the ground is not a flat fill`, sd > 3, `spread ${sd.toFixed(1)}`);
  check(`${tag}: it is violet and magenta, not grey`, mr > mg * 1.25 && mb > mg * 1.5, `r${mr.toFixed(0)} g${mg.toFixed(0)} b${mb.toFixed(0)}`);
  check(`${tag}: nothing threw while it painted`, noise.length === 0, noise.slice(0, 2).join(" | ") || "clean");
  await page.screenshot({ path: `.screenshots/ground-paints-${tag}.png`, clip });

  const onBoard = await groundsOn();
  check(`${tag}: one ground on the board`, onBoard.holders === 1 && onBoard.skies === 1 && onBoard.layers === 4,
    `${onBoard.holders} holder, ${onBoard.skies} sky, ${onBoard.layers} layers, ${onBoard.canvases} canvases`);
  check(`${tag}: one blend mode`, onBoard.blends === "screen", onBoard.blends);

  /* Press Finish and look again: same ground, still painting. */
  const fin = page.locator("[data-finish]");
  if (await fin.count()) {
    await fin.click();
    await page.waitForTimeout(2200);
    const onLine = await groundsOn();
    check(`${tag}: the timeline stands on the same one ground`,
      onLine.holders === 1 && onLine.skies === 1 && onLine.layers === 4,
      `${onLine.holders} holder, ${onLine.skies} sky, ${onLine.layers} layers, ${onLine.canvases} canvases`);
    check(`${tag}: and the same blend mode`, onLine.blends === "screen", onLine.blends);

    const c2 = await page.evaluate(() => {
      const g = document.querySelector("[data-workspace-ground]").getBoundingClientRect();
      return { x: Math.round(g.left + 12), y: Math.round(g.top + g.height * 0.25), width: 260, height: 200 };
    });
    const s2 = decodePng(await page.screenshot({ clip: c2 }));
    let t2 = 0, n2 = 0; const v2 = [];
    for (let i = 0; i < s2.data.length; i += s2.chan) {
      const y = 0.2126 * s2.data[i] + 0.7152 * s2.data[i + 1] + 0.0722 * s2.data[i + 2];
      t2 += y; n2++; v2.push(y);
    }
    const m2 = t2 / n2;
    const d2 = Math.sqrt(v2.reduce((a, v) => a + (v - m2) ** 2, 0) / n2);
    console.log(`       ${tag}: the timeline's ground — mean ${m2.toFixed(1)}, spread ${d2.toFixed(1)}`);
    check(`${tag}: the timeline's ground paints too`, m2 > 6 && d2 > 3, `mean ${m2.toFixed(1)}, spread ${d2.toFixed(1)}`);
    await page.screenshot({ path: `.screenshots/ground-paints-${tag}-timeline.png`, clip: c2 });
  }
  await page.close();
}

await look(1500, 950, "pane");
await look(2560, 1440, "1440p");
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
