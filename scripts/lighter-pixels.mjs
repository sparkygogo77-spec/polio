/*
 * Pixel proof: the same pictures from two Builders, diffed.
 *   node scripts/lighter-pixels.mjs <base url> <branch url> <board> <out dir>
 * Motion is frozen the same way on both (no animation, no transition, the
 * drifting ground canvases hidden), so what differs is what is drawn.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";
import { openBoard } from "../tests/lib/board.mjs";

const [BASE, BRANCH, BOARD, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const FREEZE = "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; } canvas[data-ground-sparks], [data-ground] canvas { visibility: hidden !important; }";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu", "--font-render-hinting=none"] });

async function shots(url, tag) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await openBoard(page, url, BOARD);
  await page.waitForTimeout(5000);
  await page.addStyleTag({ content: FREEZE });
  await page.mouse.move(2, 798);
  const pane = page.locator("[data-studio-pane]").first();
  if (!(await pane.count())) { await page.screenshot({ path: join(OUT, `${tag}-NO-PANE.png`) }); throw new Error(`${tag}: no board pane`); }
  const out = {};
  const still = () => page.evaluate(() => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; }
    /* The save line's clock reads the minute it was taken. */
    for (const el of document.querySelectorAll("span, div")) if (el.childElementCount === 0 && /^Saved in this browser/.test(el.textContent ?? "")) el.style.visibility = "hidden";
  });
  const snap = async (name) => { await page.waitForTimeout(700); await still(); out[name] = await page.screenshot(); writeFileSync(join(OUT, `${tag}-${name}.png`), out[name]); out[`${name}~`] = []; for (let k = 0; k < 3; k++) { await page.waitForTimeout(400); out[`${name}~`].push(await page.screenshot()); } };
  const max = await pane.evaluate((el) => el.scrollHeight - el.clientHeight);
  for (const [name, f] of [["board-top", 0], ["board-third", 1 / 3], ["board-two-thirds", 2 / 3], ["board-foot", 1]]) {
    await pane.evaluate((el, t) => { el.scrollTop = t; }, Math.round(max * f));
    await snap(name);
  }
  await pane.evaluate((el) => { el.scrollTop = 0; });
  /* The shelf: opened from the board's Add bar, then a family opened. */
  const add = page.getByText("Add", { exact: true }).last();
  if (await add.count()) { await add.click(); await page.mouse.move(2, 798); await snap("shelf"); }
  const family = page.getByText("Layout and menus", { exact: true }).first();
  if (await family.count()) { await family.click(); await page.mouse.move(2, 798); await snap("shelf-open"); }
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  /* The page as published: Preview. */
  await page.locator('[aria-label="Preview"]').first().click();
  await page.waitForTimeout(3000);
  await page.addStyleTag({ content: FREEZE });
  await snap("preview-top");
  await page.evaluate(() => { const s = [...document.querySelectorAll("[data-live-shell], [data-live-shell] *")].find((e) => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)); (s ?? document.scrollingElement).scrollTop = 2400; });
  await snap("preview-down");
  await page.close();
  return out;
}

/* Base twice, branch once: a pixel the branch changes must be one the base changes by itself (films, a blinking dot), give or take a few pixels. */
const a = await shots(BASE, "base"), a2 = await shots(BASE, "base2"), b = await shots(BRANCH, "branch");
const raw = (p) => sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const differs = (x, y) => { const m = new Uint8Array(x.info.width * x.info.height); for (let i = 0, j = 0; i < x.data.length; i += 4, j++) if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2]) m[j] = 1; return m; };
const grow = (m, w, h, r) => { const o = new Uint8Array(m.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < h && xx >= 0 && xx < w) o[yy * w + xx] = 1; } return o; };
const rows = [];
for (const name of Object.keys(a).filter((k) => !k.endsWith("~"))) {
  if (!b[name] || !a2[name]) { rows.push({ name, result: "missing" }); continue; }
  const [x, x2, y] = await Promise.all([a[name], a2[name], b[name]].map(raw));
  const w = x.info.width, h = x.info.height;
  /* What moves by itself: base against its second run, and each run against itself over a second. */
  const own = await Promise.all([...a[`${name}~`], ...a2[`${name}~`], ...b[`${name}~`]].map(raw));
  const moving = differs(x, x2);
  for (const o of own) { const d = differs(x, o); for (let j = 0; j < d.length; j++) moving[j] |= d[j]; }
  const noise = grow(moving, w, h, 4);
  const change = differs(x, y);
  let changed = 0, real = 0;
  const img = Buffer.alloc(x.data.length);
  for (let j = 0; j < change.length; j++) {
    const i = j * 4, g = x.data[i] >> 2;
    img[i] = img[i + 1] = img[i + 2] = g; img[i + 3] = 255;
    if (noise[j]) { img[i + 2] = Math.min(255, g + 90); }
    if (change[j]) { changed++; if (!noise[j]) { real++; img[i] = 255; img[i + 1] = 0; img[i + 2] = 0; } }
  }
  if (changed) await sharp(img, { raw: { width: w, height: h, channels: 4 } }).png().toFile(join(OUT, `diff-${name}.png`));
  rows.push({ name, pixels: w * h, "moves by itself": moving.reduce((s, v) => s + v, 0), "branch vs base": changed, "outside base's own noise": real });
}
console.table(rows);
writeFileSync(join(OUT, "pixels.json"), JSON.stringify(rows, null, 1));
await browser.close();
