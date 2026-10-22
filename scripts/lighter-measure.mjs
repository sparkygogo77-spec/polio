#!/usr/bin/env node
/**
 * HOW HEAVY THE BUILDER IS, ON A SAVED BOARD, IN A SLOW BROWSER.
 *
 * A headless Chromium at 1280×800 with the CPU slowed 4× (CDP
 * Emulation.setCPUThrottlingRate), the way the Claude app's browser pane
 * feels on an ordinary laptop. The board is seeded from a saved board, then:
 *
 *   paint     ms from navigation to the first part drawn, and to every part drawn
 *   heap      JS heap used after load and a GC (MB)
 *   dom       element count; parts drawn ([data-node-id])
 *   idle      main-thread busy share over 5 s with no input (films, drift, tickers)
 *   scroll    long tasks while the board is scrolled top to bottom (count, total, worst)
 *   drag      frame gaps while one part is dragged (median, p95, worst)
 *   doc       size of the `builder.studio` document (IndexedDB value, localStorage mirror)
 *   js        script bytes per route (/builder, the published page /), encoded and decoded
 *
 *   npm run build && npx next start -p 3031
 *   node scripts/lighter-measure.mjs http://127.0.0.1:3031 <board.json.gz> [out.json]
 *
 * RUNS=n repeats the board measures and reports the median of each.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { boardDoc, readBoard, seedBoard } from "../tests/lib/board.mjs";

const [BASE = "http://127.0.0.1:3031", BOARD = "pst", OUT] = process.argv.slice(2);
const RUNS = Number(process.env.RUNS ?? 3);
const RATE = Number(process.env.CPU ?? 4);
const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const board = readBoard(BOARD);
const doc = boardDoc(board);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/* What the page records from the very start: when the first part and every part appeared, and every long task. */
const INIT = () => {
  window.__lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ t: e.startTime, d: e.duration }); }).observe({ type: "longtask", buffered: true }); } catch { /* no long tasks here */ }
  window.__paint = {};
  const look = () => {
    const n = document.querySelectorAll("[data-node-id]").length;
    if (n > 0 && window.__paint.first == null) requestAnimationFrame(() => requestAnimationFrame(() => { window.__paint.first ??= performance.now(); }));
    window.__paint.count = n;
    window.__paint.last = n !== window.__paint.prev ? performance.now() : window.__paint.last;
    window.__paint.prev = n;
  };
  new MutationObserver(look).observe(document, { childList: true, subtree: true });
};

async function once() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${BASE}/api/version`, { waitUntil: "load" });
  await seedBoard(page, board);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  await page.addInitScript(INIT);
  await page.goto(`${BASE}/builder`, { waitUntil: "load" });
  for (let i = 0; i < 240 && !(await page.evaluate(() => window.__paint.first != null)); i++) await page.waitForTimeout(250);
  /* Settled: no part added or removed for two seconds. */
  for (let i = 0; i < 240; i++) { const s = await page.evaluate(() => performance.now() - (window.__paint.last ?? 0)); if (s > 2000) break; await page.waitForTimeout(250); }
  const paint = await page.evaluate(() => ({ first: window.__paint.first, all: window.__paint.last, parts: window.__paint.count }));
  await cdp.send("HeapProfiler.collectGarbage");
  const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const m0 = await metric();
  const dom = await page.evaluate(() => ({ elements: document.getElementsByTagName("*").length, parts: document.querySelectorAll("[data-node-id]").length, animations: document.getAnimations().filter((a) => a.playState === "running").length, videos: document.querySelectorAll("video").length, imgs: document.images.length }));

  /* Idle: five seconds, no input. TaskDuration is main-thread busy seconds. */
  await page.mouse.move(5, 795);
  const i0 = await metric();
  await page.waitForTimeout(5000);
  const i1 = await metric();
  const idle = (i1.TaskDuration - i0.TaskDuration) / (i1.Timestamp - i0.Timestamp);

  /* Scroll the board top to bottom with the wheel, over the board. */
  const pane = page.locator("[data-studio-pane]").first();
  const box = await pane.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + Math.min(box.height / 2, 400);
  const h = await pane.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop }));
  await page.evaluate(() => { window.__lt = []; window.__scroll0 = performance.now(); });
  await page.mouse.move(cx, cy);
  const steps = Math.ceil((h.sh - h.ch) / 120);
  const s0 = Date.now();
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
  await page.waitForTimeout(800);
  const scrollMs = Date.now() - s0;
  const reached = await pane.evaluate((el) => el.scrollTop);
  const lt = await page.evaluate(() => window.__lt.filter((e) => e.t >= window.__scroll0).map((e) => e.d));
  await pane.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(1500);

  /* Drag one part: the biggest unlocked part whose middle is on screen and is its own. */
  const target = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[data-node-id]")].map((el) => ({ id: el.getAttribute("data-node-id"), r: el.getBoundingClientRect() }));
    const on = els.filter(({ r }) => r.width > 40 && r.height > 30 && r.width < 700 && r.top > 120 && r.bottom < 760 && r.left > 320 && r.right < 1200);
    for (const { id, r } of on) {
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y)?.closest("[data-node-id]");
      if (hit?.getAttribute("data-node-id") === id) return { id, x, y };
    }
    return null;
  });
  let drag = null;
  if (target) {
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.evaluate(() => { window.__f = []; (function l() { window.__raf = requestAnimationFrame((t) => { window.__f.push(t); l(); }); })(); window.__lt = []; window.__drag0 = performance.now(); });
    for (let i = 1; i <= 60; i++) { await page.mouse.move(target.x + i * 3, target.y + Math.sin(i / 6) * 40); await page.waitForTimeout(16); }
    const f = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return { f: window.__f, lt: window.__lt.filter((e) => e.t >= window.__drag0).map((e) => e.d) }; });
    await page.mouse.up();
    const gaps = f.f.slice(1).map((t, i) => t - f.f[i]);
    const moved = await page.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`)?.getBoundingClientRect().left, target.id);
    drag = { part: target.id, frames: gaps.length, median: r1(median(gaps)), p95: r1(pct(gaps, 0.95)), worst: r1(Math.max(...gaps)), longTasks: f.lt.length, longTaskMs: r1(f.lt.reduce((a, b) => a + b, 0)), movedTo: r1(moved), from: r1(target.x) };
  }

  /* The stored document. */
  const stored = await page.evaluate(async () => {
    const ask = (req) => new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
    let idb = null;
    try { const db = await ask(indexedDB.open("builder.docs")); const v = await ask(db.transaction("docs", "readonly").objectStore("docs").get("builder.studio")); idb = v == null ? null : (typeof v === "string" ? v : JSON.stringify(v)).length; db.close(); } catch { /* none */ }
    return { idbChars: idb, localChars: (localStorage.getItem("builder.studio") ?? "").length };
  });
  await ctx.close();
  return {
    paint: { firstMs: r1(paint.first), allMs: r1(paint.all), parts: paint.parts },
    heapMB: r1(m0.JSHeapUsedSize / 1048576), heapTotalMB: r1(m0.JSHeapTotalSize / 1048576),
    dom, idleBusy: r1(idle * 100),
    scroll: { steps, ms: scrollMs, reached, of: h.sh - h.ch, longTasks: lt.length, totalMs: r1(lt.reduce((a, b) => a + b, 0)), worstMs: r1(lt.length ? Math.max(...lt) : 0) },
    drag, stored,
  };
}

/* Script bytes per route, no throttling needed: what the browser downloads and parses. */
async function scripts(path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  const seen = new Map();
  cdp.on("Network.responseReceived", (e) => { if (e.type === "Script") seen.set(e.requestId, { url: e.response.url, enc: 0, dec: 0 }); });
  cdp.on("Network.dataReceived", (e) => { const s = seen.get(e.requestId); if (s) s.dec += e.dataLength; });
  cdp.on("Network.loadingFinished", (e) => { const s = seen.get(e.requestId); if (s) s.enc = e.encodedDataLength; });
  if (path === "/builder") { await page.goto(`${BASE}/api/version`); await seedBoard(page, board); }
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const list = [...seen.values()];
  await ctx.close();
  const kb = (n) => Math.round(n / 1024);
  return { files: list.length, encodedKB: kb(list.reduce((a, s) => a + s.enc, 0)), decodedKB: kb(list.reduce((a, s) => a + s.dec, 0)), biggest: list.sort((a, b) => b.dec - a.dec).slice(0, 5).map((s) => ({ file: s.url.split("/").pop(), KB: kb(s.dec) })) };
}

const runs = [];
for (let i = 0; i < RUNS; i++) { const r = await once(); runs.push(r); console.error(`run ${i + 1}: ${JSON.stringify(r)}`); }
const pick = (f) => r1(median(runs.map(f).filter((x) => x != null)));
const js = { builder: await scripts("/builder"), published: await scripts("/") };
const parts = doc.nodes?.length ?? 0;
const result = {
  board: BOARD, partsInDocument: parts, partsShownOnBoard: (doc.nodes ?? []).filter((n) => !n.state).length, cpu: `${RATE}×`, runs: RUNS,
  firstPaintMs: pick((r) => r.paint.firstMs), allPartsMs: pick((r) => r.paint.allMs), partsDrawn: pick((r) => r.paint.parts),
  heapMB: pick((r) => r.heapMB), domElements: pick((r) => r.dom.elements), runningAnimations: pick((r) => r.dom.animations), videos: pick((r) => r.dom.videos), images: pick((r) => r.dom.imgs),
  idleBusyPct: pick((r) => r.idleBusy),
  scrollLongTasks: pick((r) => r.scroll.longTasks), scrollLongTaskMs: pick((r) => r.scroll.totalMs), scrollWorstMs: pick((r) => r.scroll.worstMs), scrollWallMs: pick((r) => r.scroll.ms),
  dragFrameMedianMs: pick((r) => r.drag?.median), dragFrameP95Ms: pick((r) => r.drag?.p95), dragWorstMs: pick((r) => r.drag?.worst), dragLongTaskMs: pick((r) => r.drag?.longTaskMs),
  docIdbChars: runs[0].stored.idbChars, docLocalChars: runs[0].stored.localChars,
  js, raw: runs,
};
console.log(JSON.stringify(result, null, 1));
if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 1));
await browser.close();
