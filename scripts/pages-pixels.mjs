/*
 * Pixel proof for a route: the same pictures from two servers, diffed.
 *
 *   node scripts/pages-pixels.mjs <base url> <branch url> <out dir> [/site /site/other ...] [--board <board>]
 *
 * Each route is shot at desktop (1280×800) and phone (390×844) width, at the
 * top and at three more places down its longest scroller. Base is shot four
 * times, so what moves by itself (a film, a clock, a drawn orb) is known and
 * left out; what is
 * left is what the branch draws differently. `--board` opens a saved board
 * first (`tests/lib/board.mjs`), for routes that draw the author's board.
 * Motion is frozen the same way on both. From Git Bash, set MSYS_NO_PATHCONV=1
 * or the routes arrive as Windows paths.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";
import { openBoard } from "../tests/lib/board.mjs";

const args = process.argv.slice(2);
const boardAt = args.includes("--board") ? args[args.indexOf("--board") + 1] : null;
const [BASE, BRANCH, OUT] = args.filter((a) => !a.startsWith("/") && a !== "--board" && a !== boardAt);
const routes = args.filter((a) => a.startsWith("/"));
if (!routes.length) routes.push("/site");
mkdirSync(OUT, { recursive: true });
const FREEZE = "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; } canvas[data-ground-sparks], [data-ground] canvas { visibility: hidden !important; }";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu", "--font-render-hinting=none"] });
const VIEWS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const PLACES = [0, 1 / 3, 2 / 3, 1];
const CLOCK = Date.UTC(2026, 0, 1);

async function shots(url, route, view) {
  const page = await browser.newPage({ viewport: VIEWS[view] });
  if (boardAt) await openBoard(page, url, boardAt);
  /* One clock for every shot: what draws by the time (an orb, a film) stands at the same moment on both. */
  await page.clock.install({ time: CLOCK });
  await page.goto(url + route, { waitUntil: "networkidle", timeout: 120_000 });
  await page.clock.pauseAt(CLOCK + 8000);
  await page.clock.runFor(500);
  await page.addStyleTag({ content: FREEZE });
  await page.mouse.move(2, VIEWS[view].height - 2);
  const out = [];
  for (const f of PLACES) {
    await page.evaluate((f) => {
      /* The longest scroller on the page, or the page itself. */
      let best = document.scrollingElement, most = best.scrollHeight - best.clientHeight;
      for (const el of document.querySelectorAll("*")) {
        const s = getComputedStyle(el).overflowY;
        if ((s === "auto" || s === "scroll") && el.scrollHeight - el.clientHeight > most) { best = el; most = el.scrollHeight - el.clientHeight; }
      }
      best.scrollTop = Math.round(most * f);
    }, f);
    await page.clock.runFor(700);
    await page.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
    out.push(await page.screenshot());
  }
  await page.close();
  return out;
}

const raw = async (png) => (await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
async function differing(a, b) {
  const [x, y] = [await raw(a), await raw(b)];
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return { size: true, set: null };
  const set = new Set();
  for (let i = 0; i < x.data.length; i += 4) if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2]) set.add(i / 4);
  return { size: false, set, info: x.info };
}

const report = [];
for (const route of routes) for (const view of Object.keys(VIEWS)) {
  const b1 = await shots(BASE, route, view);
  const again = [await shots(BASE, route, view), await shots(BASE, route, view), await shots(BASE, route, view)];
  const br = await shots(BRANCH, route, view);
  for (let i = 0; i < PLACES.length; i++) {
    const tag = `${route.replace(/\W+/g, "_")}-${view}-${i}`;
    writeFileSync(join(OUT, `${tag}-base.png`), b1[i]);
    writeFileSync(join(OUT, `${tag}-branch.png`), br[i]);
    /* What base itself changes between shots, all of it. */
    const noise = { set: new Set() };
    for (const b2 of again) { const n = await differing(b1[i], b2[i]); if (n.size) noise.size = true; else for (const p of n.set) noise.set.add(p); }
    const d = await differing(b1[i], br[i]);
    let left = d.size ? Infinity : 0;
    if (!d.size) for (const p of d.set) if (!noise.set?.has(p)) left++;
    const line = { route, view, place: PLACES[i], basesDiffer: noise.size ? "size" : noise.set.size, branchDiffers: d.set?.size ?? "size", outsideNoise: left };
    report.push(line);
    console.log(`${tag}: base vs base ${line.basesDiffer} px, base vs branch ${line.branchDiffers} px, ${left} px outside what moves by itself`);
  }
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.some((r) => r.outsideNoise) ? 1 : 0);
