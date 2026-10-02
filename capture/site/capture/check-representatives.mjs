/**
 * ONE PAGE PER TEMPLATE, ONE ROW PER ROW TYPE.
 *
 * The owner's rule (2026-09-28): what a capture is for is the physical
 * design (its parts, what they do, how they move), not the backend's data.
 * stonkfun.xyz links ~400 token pages that are one template
 * (`/token/<address>`), and /rewards is one list of ~372,000 elements.
 *
 *   (1) `linkPatterns`: same-site links that differ only in one segment
 *       that reads as an id (or that many siblings share) are one pattern,
 *       `/token/:id`, with one representative and the list of ids.
 *   (2) `capture-site --crawl` captures the pages given, reads their
 *       same-site links, and captures each plain page once and one
 *       representative per pattern; the pattern and its ids are in
 *       routes.json and run.json (`crawl`), and the others are not opened.
 *   (4) A site given at a folder (trendtrader.pro/ttp/) is that folder:
 *       the page typed as `/` is the address itself, and the crawl stays
 *       inside the folders of the pages given (`/ttp/`, and
 *       `/ttp-tokenomics/` when typed), never the rest of the host.
 *   (3) A list of many items of one shape (the backend's data) keeps the
 *       items that start within 1.2 windows of its first, and its box is
 *       as tall as they are; it says how many it had (`rows`). A grid that
 *       fits in that height is whole. (The owner's rule of 2026-09-29,
 *       which replaced "the first line and one row of each other shape";
 *       check-lists.mjs holds the endless and redrawn cases.)
 *
 *   node capture/site/capture/check-representatives.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 500)}`}`);
};
const J = (x) => JSON.stringify(x);
const site = await import("./capture-site.mjs");

/* (1) pure */
const ids = ["6GmAFSYs4gk3FDao5FzzySQpPZaWsa4rUJHacpMpUNgx", "HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR", "DEW9dSN6QpWyNthphCpMmAbZP1Q4cEKR9xQXAri98WDP"];
const got = typeof site.linkPatterns === "function" ? site.linkPatterns(["/", "/flywheel", "/revenue", ...ids.map((i) => `/token/${i}`), "/blog/2024/hello", "/docs/intro", "/docs/setup"]) : null;
check("(1) token pages that differ only in an id are one pattern with one representative", got?.patterns?.length === 1 && got.patterns[0].pattern === "/token/:id" && got.patterns[0].representative === `/token/${ids[0]}` && J(got.patterns[0].ids) === J(ids), J(got));
check("(1) plain pages stay pages, a few named siblings are not a pattern", J(got?.pages) === J(["/", "/flywheel", "/revenue", "/blog/2024/hello", "/docs/intro", "/docs/setup"]), J(got?.pages));
const many = typeof site.linkPatterns === "function" ? site.linkPatterns(Array.from({ length: 8 }, (_, i) => `/u/${["amy", "bo", "cy", "dee", "ed", "flo", "gus", "hal"][i]}`)) : null;
check("(1) many siblings under one parent are a pattern even when not id-like", many?.patterns?.[0]?.pattern === "/u/:id" && many.patterns[0].ids.length === 8, J(many));

const short = typeof site.linkPatterns === "function" ? site.linkPatterns(["/", "/g/de9xw93a", "/g/zcsupzwa", "/g/d6vxyr54", "/u/73fiW1SUunYWm5cjtUoa1g7FXwbnwk8LAWEsD1RgQmo2", "/v2", "/web3", "/about"]) : null;
check("(1) short ids of letters and digits are ids (gotchi's /g/de9xw93a), a sibling of their length joins them (/g/zcsupzwa), and one id-like link is already its pattern", J(short?.patterns?.map((x) => [x.pattern, x.count])) === J([["/g/:id", 3], ["/u/:id", 1]]) && J(short.pages) === J(["/", "/v2", "/web3", "/about"]), J(short));

/* (2)+(3) a stand-in site */
const tokens = Array.from({ length: 30 }, (_, i) => `So1${String(i).padStart(3, "0")}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`);
const FOLDER = (links) => `<!doctype html><html><head><meta charset="utf-8"></head><body>${links.map((l) => `<a href="${l}">${l}</a>`).join(" ")}</body></html>`;
const pages = { "/": HOME_PAGE(),
  "/shop/": FOLDER(["/", "/blog", "/shop/", "/shop/cart", "/shop-terms/"]), "/shop/cart": FOLDER(["/shop/"]), "/shop-terms/": FOLDER(["/shop-terms/faq", "/about"]), "/shop-terms/faq": FOLDER([]), "/blog": FOLDER([]), "/about": `<!doctype html><html><head><meta charset="utf-8"></head><body><p>about us</p><a href="/">home</a></body></html>` };
function HOME_PAGE() {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font:16px sans-serif">
<nav><a href="/">home</a> <a href="/about">about</a></nav>
<div style="display:grid;grid-template-columns:repeat(3,200px);gap:10px">${tokens.map((t) => `<a class="card" href="/token/${t}" style="display:block;height:60px;background:#eee">${t.slice(0, 6)}</a>`).join("")}</div></body></html>`;
}
const TOKEN = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font:16px sans-serif"><h1>Token</h1>
<ul class="trades" style="list-style:none;margin:0;padding:0">${Array.from({ length: 200 }, (_, i) => i % 50 === 7 ? `<li class="row big" style="height:40px;background:#fcc"><b>whale</b> <i>${i}</i></li>` : `<li class="row" style="height:20px"><span>buy</span> <span>${i}</span></li>`).join("")}</ul></body></html>`;
/* The stand-in site runs in its own process: run() waits on each capture, and would starve a server in this one. */
const serverCode = `const pages = ${JSON.stringify(pages)}; const TOKEN = ${JSON.stringify(TOKEN)};
require("node:http").createServer((req, res) => { console.log("GET " + req.url); const page = pages[req.url] ?? (req.url.startsWith("/token/") ? TOKEN : null);
res.writeHead(page ? 200 : 404, { "content-type": "text/html" }); res.end(page ?? ""); }).listen(0, "127.0.0.1", function () { console.log("PORT " + this.address().port); });`;
const server = spawn(process.execPath, ["-e", serverCode], { stdio: ["ignore", "pipe", "inherit"] });
const opened = [];
let log = "";
const port = await new Promise((resolve) => server.stdout.on("data", (d) => { log += d; const m = /PORT (\d+)/.exec(log); if (m) resolve(m[1]); }));
server.stdout.on("data", (d) => { log += d; });
const origin = `http://127.0.0.1:${port}`;
const work = mkdtempSync(join(tmpdir(), "capture-reps-"));
for (const k of Object.keys(process.env)) if (/^(https?|all)_proxy$/i.test(k)) delete process.env[k];
let p = null;
try { p = site.plan({ url: `${origin}/`, name: "standin", pages: "/", root: work, viewport: [1000, 600], crawl: true, behaviours: false }); } catch (e) { check("(2) a crawl can be planned", false, e.message); }
if (p) site.run(p);
await new Promise((r) => setTimeout(r, 500));
server.kill();
opened.push(...[...log.matchAll(/GET (\S+)/g)].map((m) => m[1]));
const routesFile = join(work, "sites", "standin", "capture", "routes.json");
const routes = existsSync(routesFile) ? JSON.parse(readFileSync(routesFile, "utf8")) : {};
const run = existsSync(join(work, "sites", "standin", "capture", "run.json")) ? JSON.parse(readFileSync(join(work, "sites", "standin", "capture", "run.json"), "utf8")) : {};
const tokenPages = opened.filter((u) => u.startsWith("/token/"));
check("(2) the crawl captured home, about and one token page", J((routes.pages ?? []).map((x) => x.path).sort()) === J(["/", "/about", `/token/${tokens[0]}`].sort()), J(routes.pages));
check("(2) only one token page was opened", new Set(tokenPages).size === 1, J([...new Set(tokenPages)].length));
const pat = routes.crawl?.patterns?.[0];
check("(2) routes.json records the pattern, its representative and every id", pat?.pattern === "/token/:id" && pat.representative === `/token/${tokens[0]}` && pat.ids?.length === 30, J(routes.crawl));
check("(2) …and run.json says so too", run.crawl?.patterns?.[0]?.ids?.length === 30, J(run.crawl));
check("(2) the representative page is named for its pattern", (routes.pages ?? []).some((x) => x.id === "page_token" && x.pattern === "/token/:id"), J(routes.pages));
const tokFile = join(work, "sites", "standin", "capture", "routes", "page_token.json");
const cap = existsSync(tokFile) ? JSON.parse(readFileSync(tokFile, "utf8")) : null;
const find = (n, pred) => (pred(n) ? n : (n.kids ?? []).map((k) => find(k, pred)).find(Boolean));
const ul = cap && find(cap.tree, (n) => n.t === "ul");
/* The window is 600 tall: the rows starting within 720px of the first are kept, 20px each and one 40px whale among them. */
const keptH = (ul?.kids ?? []).reduce((a, k) => a + k.h, 0);
check("(3) the list of 200 rows keeps the rows that start within 1.2 windows (720px), plain and whale alike", ul && ul.kids.length >= 34 && ul.kids.length <= 37 && ul.kids.some((k) => k.h === 40) && keptH >= 720 && keptH <= 760, J(ul && [ul.kids.length, keptH]));
check("(3) …its box is as tall as what it keeps, not 200 rows", ul && Math.abs(ul.h - keptH) <= 2, J(ul && [ul.h, keptH]));
check("(3) …and says how many rows it had, and that it was cut", ul?.rows?.of === 200 && ul.rows.kept === ul.kids.length && ul.rows.trimmed === true, J(ul?.rows));
const homeCap = existsSync(join(work, "sites", "standin", "capture", "routes", "page_home.json")) ? JSON.parse(readFileSync(join(work, "sites", "standin", "capture", "routes", "page_home.json"), "utf8")) : null;
const grid = homeCap && find(homeCap.tree, (n) => n.t === "div" && (n.kids ?? []).some((k) => k.t === "a" && /token/.test(k.href ?? "")));
check("(3) a grid of 30 cards that fits in 1.2 windows (10 lines of 70px) is whole", grid?.kids?.length === 30 && !grid.rows, J(grid && [grid.kids?.length, grid.rows]));
const doc = existsSync(join(work, "sites", "standin", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "sites", "standin", "site", "document.json"), "utf8")) : null;
check("the three pages convert into one document", doc?.pages?.length === 3, J(doc?.pages?.map((x) => x.id)));

/* (4) a site given at a folder */
{
  const pure = site.plan({ url: "https://example.com/ttp/", name: "t", root: work });
  check("(4) the page typed as / is the address's own folder", pure.routes.pages[0]?.path === "/ttp/" && pure.captures[0]?.args[1] === "https://example.com/ttp/", J(pure.routes.pages[0]));
  const server2 = spawn(process.execPath, ["-e", serverCode], { stdio: ["ignore", "pipe", "inherit"] });
  let log2 = "";
  const port2 = await new Promise((resolve) => server2.stdout.on("data", (d) => { log2 += d; const m = /PORT (\d+)/.exec(log2); if (m) resolve(m[1]); }));
  server2.stdout.on("data", (d) => { log2 += d; });
  const work2 = mkdtempSync(join(tmpdir(), "capture-folder-"));
  const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {});
  const q = site.plan({ url: `http://127.0.0.1:${port2}/shop/`, name: "folder", pages: "/, /shop-terms/", root: work2, viewport: [1000, 600], crawl: true, behaviours: false, states: false });
  site.run(q);
  await new Promise((r) => setTimeout(r, 500));
  server2.kill();
  const got2 = (read(join(work2, "sites", "folder", "capture", "routes.json")).pages ?? []).map((x) => x.path);
  check("(4) the crawl takes the folders given and what is inside them", J([...got2].sort()) === J(["/shop-terms/", "/shop-terms/faq", "/shop/", "/shop/cart"]), J(got2));
  const opened2 = [...log2.matchAll(/GET (\S+)/g)].map((m) => m[1]);
  check("(4) …never the host's other pages (/, /blog, /about), and the folder's page never again as /shop", !opened2.some((u) => ["/", "/blog", "/about"].includes(u)) && !opened2.includes("/shop") && opened2.includes("/shop/"), J([...new Set(opened2)]));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
