#!/usr/bin/env node
/**
 * THE ORIGINAL AND OURS, SIDE BY SIDE, AT EACH WIDTH.
 *
 * Both pages opened in the same browser at each width (1440 and 2000 by
 * default), the pointer off the page, their loaders waited out, then shot at
 * the same scroll offsets. Each pair is written as `<width>-<y>-live.png` and
 * `<width>-<y>-ours.png`, and how much of the window differs (a pixel counts
 * when any channel is more than 24 apart) is written to `report.json` and
 * printed. A measure to compare before and after a fix, not a check: a live
 * page moves.
 *
 *   node capture/site/capture/tools/compare-shots.mjs --live <url> --ours <url> --out <dir>
 *        [--widths 1440,2000] [--height 900] [--at 0,900,1800] [--wait 4000]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { args, launch, list } from "./browser.mjs";

const a = args();
if (!a.live || !a.ours || !a.out) { console.error("usage: compare-shots.mjs --live <url> --ours <url> --out <dir> [--widths 1440,2000] [--at 0,900,1800]"); process.exit(2); }
const widths = list(a.widths, "1440,2000").map(Number), height = Number(a.height ?? 900), wait = Number(a.wait ?? 4000);
mkdirSync(a.out, { recursive: true });
const browser = await launch();

/** Share of pixels that differ between two PNGs of one size, worked out in a blank page. */
async function differs(page, x, y) {
  return page.evaluate(async ([x, y]) => {
    const load = async (b64) => createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const [p, q] = await Promise.all([load(x), load(y)]);
    const w = Math.min(p.width, q.width), h = Math.min(p.height, q.height);
    const px = (bm) => { const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const A = px(p), B = px(q);
    let n = 0;
    for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) > 24 || Math.abs(A[i + 1] - B[i + 1]) > 24 || Math.abs(A[i + 2] - B[i + 2]) > 24) n++;
    return Math.round((n / (w * h)) * 10000) / 100;
  }, [x.toString("base64"), y.toString("base64")]);
}

const report = [];
for (const width of widths) {
  const shots = {};
  for (const [side, url] of [["live", a.live], ["ours", a.ours]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load" }).catch((e) => console.error(`${side} ${width}: ${e.message.split("\n")[0]}`));
    await page.mouse.move(-5, -5).catch(() => {});
    await page.waitForTimeout(wait);
    const full = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => height);
    const at = a.at ? list(a.at).map(Number) : [0, height, height * 2].filter((y) => y < full);
    for (const y of at) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(700);
      const png = await page.screenshot();
      writeFileSync(join(a.out, `${width}-${y}-${side}.png`), png);
      (shots[y] ??= {})[side] = png;
    }
    await ctx.close();
  }
  const blank = await browser.newPage();
  for (const [y, s] of Object.entries(shots)) {
    if (!s.live || !s.ours) continue;
    const pct = await differs(blank, s.live, s.ours);
    report.push({ width, y: Number(y), differs: pct });
    console.log(`${width} at ${y}: ${pct}% of the window differs`);
  }
  await blank.close();
}
writeFileSync(join(a.out, "report.json"), JSON.stringify({ live: a.live, ours: a.ours, height, report }, null, 2) + "\n");
await browser.close();
