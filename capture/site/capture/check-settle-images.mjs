/**
 * THE PAGE READ ONLY ONCE ITS PICTURES HAVE LOADED (sweep.mjs `settleImages`),
 * from thesolface.site.
 *
 * thesolface has 20 `loading="lazy"` pictures; the capture's first sweep left
 * the page 10268 px tall (10382 once they had loaded) and a read soon after
 * saw #community at y 9106 and its three children at 9011 (95 px up).
 *
 * A stand-in page holds three lazy pictures that take 700 ms to arrive and
 * give the page its height when they do:
 *
 *   (1) after settleImages every picture is complete, and the page's height
 *       stays the same for another 500 ms;
 *   (2) the height it reports is the page's final height;
 *   (3) capture-route.mjs settles the pictures before its main read and after
 *       every reload (fresh()).
 *
 *   node capture/site/capture/check-settle-images.mjs
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./tools/browser.mjs";
import { scrollThrough, settleImages } from "./sweep.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const PAGE = `<!doctype html><meta charset="utf-8"><title>Stand-in lazy</title>
<style>body{margin:0}.gap{height:1500px}img{display:block;width:300px}</style>
<div class="gap"></div><img loading="lazy" src="/a.svg"><div class="gap"></div><img loading="lazy" src="/b.svg"><div class="gap"></div><img loading="lazy" src="/c.svg"><div class="gap"></div>`;
const svg = (h) => `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${h}"><rect width="300" height="${h}" fill="#4cff83"/></svg>`;
const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  const m = /^\/([abc])\.svg/.exec(req.url);
  if (!m) { res.writeHead(404); res.end(); return; }
  setTimeout(() => { res.writeHead(200, { "content-type": "image/svg+xml" }); res.end(svg({ a: 200, b: 300, c: 400 }[m[1]])); }, 700);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.goto(url);
  await scrollThrough(page);
  const h = await settleImages(page);
  const s1 = await page.evaluate(() => ({ undone: Array.from(document.images).filter((i) => !i.complete || !i.naturalHeight).length, h: document.documentElement.scrollHeight }));
  await page.waitForTimeout(500);
  const s2 = await page.evaluate(() => document.documentElement.scrollHeight);
  check("(1) every picture is complete after settleImages", s1.undone === 0, JSON.stringify(s1));
  check("(1) …and the page's height stays the same", s1.h === s2, `${s1.h} then ${s2}`);
  check("(2) the height it reports is the final height (6000 of gaps and 900 of pictures)", h === s2 && s2 === 6000 + 900, `${h} ${s2}`);
  const route = readFileSync(join(here, "capture-route.mjs"), "utf8");
  const fresh = route.slice(route.indexOf("const fresh = async"), route.indexOf("const primeGesture"));
  check("(3) fresh() settles the pictures after its sweep", /settleImages\(page\)/.test(fresh));
  const before = route.slice(route.indexOf("await restPointer(page);") - 400, route.indexOf("await restPointer(page);") + 30);
  check("(3) the main read settles the pictures first", /settleImages\(page\)/.test(before), before.slice(-200));
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
