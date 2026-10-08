#!/usr/bin/env node
/**
 * A RIBBON RUNS ON THE SCREEN'S FRAMES, AND A LOADER GOES ON THE VISITOR'S CLOCK.
 *
 * trumpmorty.fun's own script moves each ribbon 0.6 px every frame, plus a
 * boost while the page is scrolled (its eased scroll pace times 0.25, at
 * most 14 px a frame): 36 px a second on a 60 Hz screen, about 86 on the
 * owner's 144 Hz one. Ours ran a fixed 36 px a second with no boost, so on
 * his screen it ran at less than half the speed. And its CRT loader switches
 * off about 2.5 s after the page is asked for; ours went about 1.1 s later,
 * timed from whenever its script happened to run.
 *
 * sink now says which clock a loop runs on (`clock: "frame"`) and when the
 * loader switched off from the navigation's start (`loader.nav.off`), and
 * the import gives the marquee a Step (px a frame) and the loader a Switches
 * off at. Run as published, the exported scripts on a stand-in page:
 *
 *   · the marquee with a Step moves by that step every frame, whatever the
 *     frame rate (sampled as it comes, and again with every frame held 30 ms
 *     longer): the frame's clock;
 *   · scrolled 8 px a frame, its step grows by the boost (0.6 + 8 × 0.25),
 *     and never past the cap;
 *   · a marquee without one still runs at its Speed in px a second;
 *   · the loader with Switches off at 1.2 starts to go 1.2 s after the
 *     navigation, even when its script arrives 0.7 s late;
 *   · and the import writes both from sink's records.
 *
 *   node --experimental-strip-types tests/ribbon-clock.mjs
 */
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { chromium } from "playwright-core";
import { featureFiles, pageFeatureTags, getWork, usesOf } from "../src/features/studio/shelf/library/works.ts";
import { attachCaptured } from "../src/features/studio/shelf/library/captured.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const J = (v) => JSON.stringify(v);

/* ------------------------------------------------ the import */
{
  const nodes = [{ id: "n_red", pageId: "page_home" }, { id: "n_tv", pageId: "page_home", featureId: "picture", data: "trorty.webp" }];
  const got = attachCaptured(nodes, {
    version: 1,
    loops: [{ part: "n_red", kind: "marquee", speed: 19, perFrame: 0.6, fps: 32, clock: "frame", direction: "left" }],
    motion: { scrollSpeed: [{ part: "n_red", base: 0.6, perScroll: 0.245, max: 14 }] },
    loader: { title: "T", pictures: ["https://x/trorty.webp"], lastedMs: 3376, off: { class: "is-off", afterMs: 2537 }, nav: { shown: 40, off: 2537, gone: 3400 } },
  });
  const m = usesOf(got.find((n) => n.id === "n_red")?.work).find((u) => u.id === "marquee")?.inputs;
  check("the import gives a frame-clock ribbon its step a frame, from sink's record", m?.step === "0.6", J(m));
  check("…and its scroll boost and cap", m?.boost === "0.245" && m?.cap === "14", J(m));
  const c = usesOf(got.find((n) => n.id === "n_tv")?.work).find((u) => u.id === "crt-loader")?.inputs;
  check("the loader is given the moment it switched off, from the navigation's start (2.54 s)", c?.at === "2.54", J(c));
  const inputs = getWork("marquee").manifest.inputs;
  check("the Element panel shows the step, the boost and its cap in its first view", ["step", "boost", "cap"].every((id) => inputs.find((i) => i.id === id) && !inputs.find((i) => i.id === id).advanced), J(inputs.map((i) => [i.id, !!i.advanced])));
}

/* ------------------------------------------------ as published */
const dir = mkdtempSync(join(tmpdir(), "ribbon-clock-"));
const PARTS = [
  ["n_frame", "marquee", { step: "0.6", boost: "0.25", cap: "14", direction: "left", pause: "no", gap: "0" }, "top:100px", "FRAME · FRAME · FRAME · FRAME · "],
  ["n_time", "marquee", { speed: "36", direction: "left", pause: "no", gap: "0" }, "top:200px", "TIME · TIME · TIME · TIME · "],
  ["n_crt", "crt-loader", { title: "TUNING", at: "1.2" }, "top:3000px", ""],
];
const nodes = PARTS.map(([id, feature, inputs]) => ({ id, work: { id: feature, inputs } }));
for (const f of featureFiles(nodes)) { mkdirSync(dirname(join(dir, f.path)), { recursive: true }); writeFileSync(join(dir, f.path), f.content); }
writeFileSync(join(dir, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:24px sans-serif;height:6000px;position:relative}.part{position:absolute;left:0;width:600px;height:40px;overflow:hidden;white-space:nowrap}</style></head><body>
${PARTS.map(([id, , , style, words]) => `<div class="part" id="${id}" style="${style}"><span>${words}</span></div>`).join("\n")}
${pageFeatureTags(nodes, "")}
</body></html>`);
/* The feature scripts arrive 0.7 s late, as on a slow page: the loader must still go on its own clock. */
const server = http.createServer((req, res) => {
  const path = join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
  if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
  setTimeout(() => { res.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" }); res.end(readFileSync(path)); }, path.endsWith(".js") ? 700 : 0);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
await ctx.addInitScript(() => {
  /* The first frame the tuning screen starts to go, from the navigation's start. */
  window.__off = null;
  (function watch() {
    const o = document.querySelector("[data-crt]");
    if (o && window.__off === null) { const cs = getComputedStyle(o); if (cs.clipPath && cs.clipPath !== "none" && !/^inset\(0(px)?( 0(px)?)*\)$/.test(cs.clipPath)) window.__off = performance.now(); }
    if (window.__seen === undefined && o) window.__seen = performance.now();
    if (window.__seen !== undefined && !o && window.__off === null) window.__off = performance.now();
    requestAnimationFrame(watch);
  })();
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
await p.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
await p.waitForFunction(() => window.__off !== null, null, { timeout: 8000 }).catch(() => {});
const off = await p.evaluate(() => window.__off);
check("the scripts run without an error", errors.length === 0, errors.join(" | "));
check("the loader starts to go 1.2 s after the navigation, though its script came 0.7 s late", off >= 1150 && off <= 1450, `${Math.round(off)} ms`);
await p.waitForTimeout(1200);

const rate = (id, hold, scroll = 0) => p.evaluate(async ({ id, hold, scroll }) => {
  const track = document.querySelector(`#${id} [data-marquee-track]`);
  const x = () => new DOMMatrix(getComputedStyle(track).transform).m41;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  if (scroll) { scrollTo(0, 0); for (let k = 0; k < 30; k++) await frame(); }
  const st = []; let last = x(), t = performance.now(), y = 0; const t0 = t;
  for (let k = 0; k < 60; k++) {
    if (scroll) { y += scroll; scrollTo(0, y); }
    await frame();
    const now = x(), n = performance.now();
    const d = Math.abs(now - last);
    if (d < 100 && k >= (scroll ? 40 : 0)) st.push([n - t, d]);
    last = now; t = n;
    if (hold) { const u = performance.now() + hold; while (performance.now() < u) { /* a long frame */ } }
  }
  void t0;
  const d = st.reduce((a, v) => a + v[1], 0), dt = st.reduce((a, v) => a + v[0], 0);
  return { perFrame: d / st.length, perSecond: (d / dt) * 1000, fps: (st.length / dt) * 1000 };
}, { id, hold, scroll });
const f1 = await rate("n_frame", 0), f2 = await rate("n_frame", 30);
check("a ribbon with a Step moves 0.6 px every frame at the page's frame rate", Math.abs(f1.perFrame - 0.6) < 0.03, J(f1));
check("…and 0.6 px a frame with every frame held longer: the frame's clock, so a 144 Hz screen runs it 2.4 times as fast as a 60 Hz one", f1.fps / f2.fps > 1.4 && Math.abs(f2.perFrame - 0.6) < 0.03, J({ f1, f2 }));
const boosted = await rate("n_frame", 0, 8);
check("scrolled 8 px a frame, its step grows by the boost toward 0.6 + 8 × 0.25 = 2.6", boosted.perFrame > 2.2 && boosted.perFrame < 2.7, J(boosted));
const capped = await rate("n_frame", 0, 120);
check("…and never past the cap (0.6 + 14)", capped.perFrame <= 14.6 + 0.05, J(capped));
await p.evaluate(() => scrollTo(0, 0));
await p.waitForTimeout(1500);
const t1 = await rate("n_time", 0), t2 = await rate("n_time", 30);
check("a ribbon with no Step still runs at its Speed, 36 px a second, at either frame rate", Math.abs(t1.perSecond - 36) < 4 && Math.abs(t2.perSecond - 36) < 5, J({ t1, t2 }));

await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
