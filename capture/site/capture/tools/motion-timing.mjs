#!/usr/bin/env node
/**
 * WHEN A PAGE SHOWS THROUGH ITS LOADER, AND HOW FAST ITS RIBBONS RUN.
 *
 * For each address, opened `--runs` times with the tab in front:
 *
 *   · the loader: from before the page's own scripts, every frame, the
 *     element covering the window (fixed, nine tenths of it or more) is
 *     watched, and the first frame it starts to go (its opacity under 1, a
 *     clip, hidden, or gone) is written in ms from the navigation's start;
 *   · the ribbons: every element whose transform the page changes each
 *     frame, sampled for 1.5 s at the page's frame rate and again with each
 *     frame held 30 ms longer: its step a frame and its speed a second at
 *     both. A step a frame that holds is a loop on the frame's clock (it
 *     runs twice as fast on a 120 Hz screen); a speed that holds, on the
 *     time's.
 *
 *   node capture/site/capture/tools/motion-timing.mjs <url> [<url> …] [--runs 3] [--width 1440] [--json <file>]
 */
import { writeFileSync } from "node:fs";
import { args, launch } from "./browser.mjs";

const a = args();
const urls = a._;
if (!urls.length) { console.error("usage: motion-timing.mjs <url> [<url> …] [--runs 3] [--width 1440]"); process.exit(2); }
const runs = Number(a.runs ?? 3), width = Number(a.width ?? 1440);

/* Before the page's scripts: every frame, the cover and when it starts to go. */
const WATCH = () => {
  const w = (window.__cover = { seen: null, off: null, how: null });
  const covers = (el) => { const cs = getComputedStyle(el); if (cs.position !== "fixed") return false; const r = el.getBoundingClientRect(); return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9; };
  let el = null;
  const tick = () => {
    if (!el && document.body) {
      for (const n of document.body.querySelectorAll("*")) { const cs = getComputedStyle(n); if (cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.9 && covers(n) && (n.textContent?.trim() || n.querySelector("img, canvas, video"))) { el = n; w.seen = Math.round(performance.now()); break; } }
    }
    if (el && w.off === null) {
      const cs = el.isConnected ? getComputedStyle(el) : null;
      const how = !cs ? "gone" : cs.display === "none" || cs.visibility === "hidden" ? "hidden" : Number(cs.opacity) < 0.99 ? "fading" : cs.clipPath && cs.clipPath !== "none" && !/^inset\(0(px)?( 0(px)?)*\)$/.test(cs.clipPath) ? "clipped" : null;
      if (how) { w.off = Math.round(performance.now()); w.how = how; }
    }
    if (w.off === null && performance.now() < 20000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const RIBBONS = async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const tf = () => new Map(Array.from(document.body.querySelectorAll("*")).map((el) => [el, getComputedStyle(el).transform]));
  const p = tf(); await frame(); await frame(); const q = tf();
  const moving = [...q].filter(([el, t]) => t !== "none" && t !== p.get(el) && el.getBoundingClientRect().width > 200).map(([el]) => el).slice(0, 8);
  const x = (el) => { try { return new DOMMatrix(getComputedStyle(el).transform).m41; } catch { return NaN; } };
  const sample = async (hold) => {
    const s = moving.map(() => []);
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) { await frame(); const t = performance.now(); moving.forEach((el, i) => s[i].push([t, x(el)])); if (hold) { const u = performance.now() + hold; while (performance.now() < u) { /* a long frame */ } } }
    return s.map((pts) => {
      const st = []; for (let k = 1; k < pts.length; k++) st.push([pts[k][0] - pts[k - 1][0], Math.abs(pts[k][1] - pts[k - 1][1])]);
      const med = [...st.map((v) => v[1])].sort((m, n) => m - n)[st.length >> 1] ?? 0;
      const kept = st.filter((v) => v[1] <= Math.max(1, med * 5));
      const d = kept.reduce((n, v) => n + v[1], 0), dt = kept.reduce((n, v) => n + v[0], 0);
      return kept.length && dt ? { perFrame: Math.round((d / kept.length) * 1000) / 1000, perSecond: Math.round((d / dt) * 10000) / 10, fps: Math.round((kept.length / dt) * 1000) } : null;
    });
  };
  const fast = await sample(0), slow = await sample(30);
  return moving.map((el, i) => {
    const f = fast[i], s = slow[i];
    const clock = f && s && f.fps / s.fps > 1.4 ? (Math.abs(s.perFrame - f.perFrame) / f.perFrame < 0.15 ? "frame" : Math.abs(s.perSecond - f.perSecond) / f.perSecond < 0.15 ? "time" : "?") : "?";
    return { words: (el.textContent ?? "").trim().slice(0, 24), clock, fast: f, slowed: s, at60: f ? (clock === "frame" ? Math.round(f.perFrame * 60 * 10) / 10 : f.perSecond) : null, at144: f ? (clock === "frame" ? Math.round(f.perFrame * 144 * 10) / 10 : f.perSecond) : null };
  });
};

const browser = await launch();
const out = [];
for (const url of urls) {
  for (let r = 0; r < runs; r++) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(WATCH);
    const page = await ctx.newPage();
    await page.bringToFront();
    await page.mouse.move(-5, -5).catch(() => {});
    await page.goto(url, { waitUntil: "load" }).catch((e) => console.error(`${url}: ${e.message.split("\n")[0]}`));
    await page.waitForFunction(() => window.__cover && (window.__cover.off !== null || performance.now() > 12000), null, { timeout: 25000 }).catch(() => {});
    const cover = await page.evaluate(() => window.__cover).catch(() => null);
    const ribbons = r === 0 ? await page.evaluate(RIBBONS).catch(() => []) : null;
    out.push({ url, run: r + 1, cover, ...(ribbons ? { ribbons } : {}) });
    console.log(`${url} run ${r + 1}: loader ${cover?.seen === null || !cover ? "none seen" : `seen at ${cover.seen} ms, starts to go at ${cover.off ?? "—"} ms (${cover.how ?? "still up"})`} from the navigation's start`);
    for (const b of ribbons ?? []) console.log(`  ribbon "${b.words}": ${b.clock === "frame" ? `${b.fast.perFrame} px a frame (frame clock): ${b.at60} px/s at 60 Hz, ${b.at144} at 144 Hz` : `${b.fast?.perSecond} px/s (${b.clock === "time" ? "time clock" : "clock not told"})`}; measured at ${b.fast?.fps} and ${b.slowed?.fps} fps`);
    await ctx.close();
  }
}
await browser.close();
if (a.json) writeFileSync(a.json, JSON.stringify(out, null, 2) + "\n");
