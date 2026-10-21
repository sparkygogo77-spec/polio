/**
 * THE SLOW SWEEP (sweep.mjs), from thesolface.site's gallery.
 *
 * A stand-in page reveals each `.reveal` card only after the window has
 * stayed over it for 300 ms (an IntersectionObserver and a timer, as a busy
 * page with lazy pictures behaves), and a lazy picture below the fold only
 * takes its height once it has been revealed, so the page grows.
 *
 *   (1) the old sweep (40 ms a step) leaves cards unrevealed — the stand-in
 *       is as hard as thesolface's gallery was;
 *   (2) the slow sweep reveals every card and the page reaches its full height;
 *   (3) capture-route.mjs's `fresh()` and capture-widths.mjs scroll through
 *       with that sweep, not their own fast loop.
 *
 *   node capture/site/capture/check-sweep.mjs
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./tools/browser.mjs";
import { scrollThrough } from "./sweep.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const PAGE = `<!doctype html><meta charset="utf-8"><title>Stand-in sweep</title>
<style>body{margin:0}.reveal{height:300px;margin:60px 0;background:#234;opacity:0;transition:opacity .2s}.reveal.in-view{opacity:1}.late{height:0;overflow:hidden}.late.in-view{height:120px}</style>
<div style="height:600px"></div>
${Array.from({ length: 12 }, (_, i) => `<div class="reveal${i % 3 === 2 ? " late" : ""}" id="c${i}"></div>`).join("\n")}
<script>
  const timers = new Map();
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) timers.set(e.target, setTimeout(() => { e.target.classList.add("in-view"); io.unobserve(e.target); }, 300));
    else clearTimeout(timers.get(e.target));
  }), { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
</script>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch();
const state = (page) => page.evaluate(() => ({ left: [...document.querySelectorAll(".reveal")].filter((e) => !e.classList.contains("in-view")).length, h: document.documentElement.scrollHeight }));

try {
  const old = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await old.goto(url);
  await old.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += Math.max(100, innerHeight / 6)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
  await old.waitForTimeout(500);
  const o = await state(old);
  check("(1) the 40 ms sweep leaves the stand-in's cards unrevealed", o.left > 0, JSON.stringify(o));

  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.goto(url);
  const ok = await scrollThrough(page);
  await page.waitForTimeout(500);
  const s = await state(page);
  check("(2) the slow sweep reveals every card", ok && s.left === 0, JSON.stringify(s));
  check("(2) …and the page has its full height", s.h > o.h, `${s.h} vs ${o.h}`);

  const route = readFileSync(join(here, "capture-route.mjs"), "utf8");
  const widths = readFileSync(join(here, "capture-widths.mjs"), "utf8");
  const fresh = route.slice(route.indexOf("const fresh = async"), route.indexOf("const primeGesture"));
  check("(3) fresh() scrolls through with scrollThrough", /scrollThrough\(page\)/.test(fresh) && !/setTimeout\(r, 40\)/.test(fresh));
  check("(3) capture-widths.mjs scrolls through with scrollThrough", /scrollThrough\(page\)/.test(widths) && !/setTimeout\(r, 40\)/.test(widths));
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
