#!/usr/bin/env node
/**
 * ONE THING ON BOTH PAGES, MEASURED AT REST, HOVERED AND PRESSED.
 *
 * Each thing is named by its words (`TG`, `X`, `COPY`): on each page the
 * smallest element whose own words those are, and the box that draws round
 * them (itself, or the nearest element up that paints an edge, a fill or a
 * shadow). For that box, with the pointer off the page, then over its
 * middle, then held down: its place and size, its shadow, its corners and
 * its transform. And how deep each corner is cut: px along its diagonal,
 * from just inside its borders, before its own fill as drawn starts (0 for a
 * square corner; about 4 for a 12px curve), so a square end
 * poking out of a rounded, clipped bar (trumpmorty.fun's COPY) reads 0 where the
 * original reads about 4. Printed as a table, live beside ours, and written as JSON.
 *
 * The corner depth is read off the element's own screenshot; where a copy
 * cuts a part with a clip that reaches past its own box, or a wash lies over
 * the page, it can mislead: look at the crops `--shots` writes.
 *
 *   node capture/site/capture/tools/compare-geometry.mjs --live <url> --ours <url> --words "TG,X,COPY"
 *        [--widths 1440,2000] [--wait 4000] [--json <file>] [--shots <dir>: each box as measured]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { args, launch, list } from "./browser.mjs";

const a = args();
if (!a.live || !a.ours || !a.words) { console.error('usage: compare-geometry.mjs --live <url> --ours <url> --words "TG,X,COPY" [--widths 1440,2000]'); process.exit(2); }
const words = list(a.words), widths = list(a.widths, "1440,2000").map(Number), wait = Number(a.wait ?? 4000);
const browser = await launch();

/** In the page: the box drawn round the words, marked, and its look. */
const FIND = (w) => {
  const own = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
  const hits = Array.from(document.body.querySelectorAll("*")).filter((el) => own(el) === w || (el.textContent ?? "").trim() === w).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  hits.sort((p, q) => p.getBoundingClientRect().width * p.getBoundingClientRect().height - q.getBoundingClientRect().width * q.getBoundingClientRect().height);
  const el = hits[0];
  if (!el) return null;
  const paints = (n) => { const cs = getComputedStyle(n); return cs.boxShadow !== "none" || (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent"); };
  /* The box round them: up the tree, as the original nests it; else, where a copy draws its words as a part of their own over a sibling box, the smallest box drawn under them. */
  const t = el.getBoundingClientRect(), area = (q) => q.width * q.height;
  let box = null;
  for (let n = el; n && n !== document.body; n = n.parentElement) if (paints(n)) { if (area(n.getBoundingClientRect()) <= area(t) * 40) box = n; break; }
  if (!box) {
    const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
    const under = Array.from(document.body.querySelectorAll("*")).filter((n) => { if (n === el || n.contains(el) && !paints(n)) return false; const q = n.getBoundingClientRect(); return paints(n) && q.left <= cx && q.right >= cx && q.top <= cy && q.bottom >= cy && area(q) >= area(t) && area(q) <= area(t) * 40; });
    under.sort((p, q) => area(p.getBoundingClientRect()) - area(q.getBoundingClientRect()));
    box = under[0] ?? el;
  }
  document.querySelectorAll("[data-geo]").forEach((n) => n.removeAttribute("data-geo"));
  box.setAttribute("data-geo", "");
  return true;
};
const READ = () => {
  const box = document.querySelector("[data-geo]");
  if (!box) return null;
  const r = box.getBoundingClientRect(), cs = getComputedStyle(box);
  const px = (v) => (/(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(v) ?? []).slice(1).map(Number);
  /* The drop shadow: the first that is not inset (an inset one draws an edge inside, as a copy may draw a one-sided border). */
  const outer = cs.boxShadow.replace(/rgba?\([^)]*\)/g, "").split(",").find((x) => !/inset/.test(x)) ?? "";
  return { box: [r.left + scrollX, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10), shadow: cs.boxShadow, offset: px(outer), radius: cs.borderRadius, transform: cs.transform };
};

async function corners(page, name) {
  const r = await page.evaluate(() => {
    const b = document.querySelector("[data-geo]"); if (!b) return null;
    const q = b.getBoundingClientRect(), cs = getComputedStyle(b);
    const bw = ["Top", "Right", "Bottom", "Left"].map((s) => (cs[`border${s}Style`] === "none" ? 0 : parseFloat(cs[`border${s}Width`]) || 0));
    /* An edge drawn as an inset shadow (`inset 4px 0 0 0` is a left edge) counts as a border here. */
    for (const sh of cs.boxShadow.replace(/rgba?\([^)]*\)/g, "").split(",").filter((x) => /inset/.test(x))) {
      const [x = 0, y = 0, , spread = 0] = (sh.match(/-?[\d.]+px/g) ?? []).map(parseFloat);
      if (x > 0) bw[3] = Math.max(bw[3], x + spread); if (x < 0) bw[1] = Math.max(bw[1], -x + spread);
      if (y > 0) bw[0] = Math.max(bw[0], y + spread); if (y < 0) bw[2] = Math.max(bw[2], -y + spread);
    }
    const fill = /rgba?\((\d+), (\d+), (\d+)/.exec(cs.backgroundColor);
    return { box: [q.left, q.top, q.width, q.height], bw, fill: fill ? fill.slice(1).map(Number) : null };
  });
  if (!r || !r.fill || r.box[2] < 8 || r.box[3] < 8) return null;
  /* The element's own screenshot: Playwright scrolls it into view and waits for it to stand still (a page may scroll smoothly by its own script). */
  const png = await page.locator("[data-geo]").screenshot({ animations: "disabled" }).catch(() => null);
  if (!png) return null;
  if (a.shots) { mkdirSync(a.shots, { recursive: true }); writeFileSync(join(a.shots, `${name}.png`), png); }
  return page.evaluate(async ({ b64, bw, fill }) => {
    const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext("2d");
    g.drawImage(bm, 0, 0);
    const at = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
    /*
     * Its fill as drawn: the colour met most often halfway along its four
     * inner edges (a wash or a grain over the page shifts every colour, so
     * the computed fill is only a fallback).
     */
    const [t0, r0, b0, l0] = bw.map((v) => Math.round(v) + 3);
    const mids = [[bm.width >> 1, t0], [bm.width - 1 - r0, bm.height >> 1], [bm.width >> 1, bm.height - 1 - b0], [l0, bm.height >> 1]].map(([x, y]) => at(x, y));
    const near = (p, q) => p.every((v, i) => Math.abs(v - q[i]) < 30);
    const drawn = mids.map((m) => [m, mids.filter((q) => near(q, m)).length]).sort((p, q) => q[1] - p[1])[0];
    const ref = drawn && drawn[1] >= 2 ? drawn[0] : fill;
    const own = (p) => near(p, ref);
    /* Each corner, walked in along its diagonal from just inside its borders: how many px before its own fill starts. 0 is a square corner; a 12px curve is cut about 4 deep. */
    const [t, rt, bt, l] = bw.map((v) => Math.round(v));
    const starts = [[l, t, 1, 1], [bm.width - 1 - rt, t, -1, 1], [bm.width - 1 - rt, bm.height - 1 - bt, -1, -1], [l, bm.height - 1 - bt, 1, -1]];
    const depth = starts.map(([x, y, dx, dy]) => { for (let k = 0; k <= 12; k++) { const px = x + dx * k, py = y + dy * k; if (px < 0 || py < 0 || px >= bm.width || py >= bm.height) break; if (own(at(px, py))) return k; } return 13; });
    return { corners: depth, fill: ref, seen: starts.map(([x, y]) => [x, y, ...at(x, y)]) };
  }, { b64: png.toString("base64"), bw: r.bw, fill: r.fill });
}

const out = [];
for (const width of widths) {
  for (const [side, url] of [["live", a.live], ["ours", a.ours]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load" }).catch((e) => console.error(`${side}: ${e.message.split("\n")[0]}`));
    await page.mouse.move(-5, -5).catch(() => {});
    await page.waitForTimeout(wait);
    for (const w of words) {
      if (!(await page.evaluate(FIND, w).catch(() => null))) { out.push({ width, side, words: w, found: false }); continue; }
      await page.mouse.move(-5, -5);
      await page.waitForTimeout(500);
      const rest = await page.evaluate(READ);
      const read = await corners(page, `${width}-${w.replace(/[^\w-]+/g, "_")}-${side}`);
      const mid = await page.evaluate(() => { const q = document.querySelector("[data-geo]").getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
      await page.mouse.move(mid[0], mid[1], { steps: 3 });
      await page.waitForTimeout(500);
      const hover = await page.evaluate(READ);
      await page.mouse.down();
      await page.waitForTimeout(400);
      const pressed = await page.evaluate(READ);
      /* Let go off the element, so nothing is clicked. */
      await page.mouse.move(-5, -5); await page.mouse.up();
      out.push({ width, side, words: w, found: true, rest, hover, pressed, corners: read?.corners ?? null, cornerPixels: read ? { fill: read.fill, seen: read.seen } : null });
    }
    await ctx.close();
  }
}
await browser.close();
const f = (s) => (s ? `${s.offset.join("/") || "none"} ${s.transform === "none" ? "" : s.transform}`.trim() : "—");
for (const width of widths) for (const w of words) {
  const L = out.find((o) => o.width === width && o.side === "live" && o.words === w), O = out.find((o) => o.width === width && o.side === "ours" && o.words === w);
  console.log(`${width} ${w}: shadow at rest live ${f(L?.rest)} | ours ${f(O?.rest)}; hovered live ${f(L?.hover)} | ours ${f(O?.hover)}; pressed live ${f(L?.pressed)} | ours ${f(O?.pressed)}; corners live ${L?.corners?.join(",") ?? "—"} | ours ${O?.corners?.join(",") ?? "—"}`);
}
if (a.json) writeFileSync(a.json, JSON.stringify(out, null, 2) + "\n");
