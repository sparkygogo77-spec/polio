/**
 * A LONG LIST IS KEPT A WINDOW AND A LITTLE MORE (the owner, 2026-09-29).
 *
 * parasiteonsol.fun's /coins is a live list the page redraws; others grow
 * as they are scrolled, without end. Neither is the design: the backend
 * fills them. So a box of many items of one shape keeps only the items
 * that start within 1.2 window heights of its first, cut in the page before
 * it is read (list-trim.js), and the section is as tall as what is kept.
 * On a stand-in page, 1200 × 800:
 *
 *   (1) an endless feed (60px rows, 20 more whenever the bottom nears):
 *       the capture finishes, keeps 16 rows (960px of them), says how many
 *       live had and that it grows, and the section is 16 rows tall;
 *   (2) a live table redrawn every half second (30 rows of 40px): 24 kept,
 *       said to be redrawn;
 *   (3) what follows (the footer) stands right under what is kept;
 *   (4) the document names each list (`doc.lists`), its kept items' parts
 *       and the list's own part carries `rows`;
 *   (5) controls: a nav of 14 links on one line and a list of 8 are whole.
 *
 *   node capture/site/capture/check-lists.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26, timeout: 600000 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-lists-"));

const PAGE = `<!doctype html><html><head><style>
  body{margin:0;font:16px sans-serif}
  header{height:200px;background:#123;color:#fff}
  nav ul{display:flex;gap:8px;list-style:none;margin:0;padding:10px}
  nav li{width:60px;height:24px;background:#345}
  section{padding:20px 0;margin:0}
  h2{height:40px;margin:0;font-size:24px}
  ul.feed,div.live,ol.short{list-style:none;margin:0;padding:0}
  .feed li{height:60px;box-sizing:border-box;border-bottom:1px solid #ccc}
  .live .row{height:40px;display:flex;gap:10px}
  .short li{height:30px}
  footer{height:300px;background:#321;color:#fff}
</style></head><body>
<header><nav><ul>${Array.from({ length: 14 }, (_, i) => `<li>n${i}</li>`).join("")}</ul></nav></header>
<section id="s1"><h2>Feed</h2><ul class="feed" id="feed"></ul></section>
<section id="s2"><h2>Live</h2><div class="live" id="live"></div></section>
<section id="s3"><h2>Short</h2><ol class="short">${Array.from({ length: 8 }, (_, i) => `<li>short ${i}</li>`).join("")}</ol></section>
<footer><p>THE FOOTER</p></footer>
<script>
  var feed = document.getElementById("feed"), n = 0;
  function more() { for (var i = 0; i < 20; i++) { var li = document.createElement("li"); li.innerHTML = "<span>item " + n + "</span> <b>" + (n * 7 % 13) + "</b>"; n++; feed.appendChild(li); } }
  more();
  addEventListener("scroll", function () { if (scrollY + innerHeight > document.documentElement.scrollHeight - 400) more(); });
  var live = document.getElementById("live"), tick = 0;
  function draw() { var h = ""; for (var i = 0; i < 30; i++) h += '<div class="row"><span>coin ' + i + '</span><i>' + ((i * 31 + tick) % 97) + '</i></div>'; live.innerHTML = h; tick++; }
  draw(); setInterval(draw, 500);
</script></body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
const t0 = Date.now();
let took = null;
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "2", "--behaviours", "--states"]).then(() => { took = (Date.now() - t0) / 1000; }).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const node = (id) => doc.nodes.find((x) => x.id === id);
const lists = doc.lists ?? [];
const feed = lists.find((l) => /ul$/.test(l.selector));
const live = lists.find((l) => /div$/.test(l.selector) && /section:nth-of-type\(2\)/.test(l.selector));
const words = (re) => doc.nodes.find((x) => re.test(typeof x.content === "string" ? x.content : J(x.content ?? "")));

check("the capture finishes, and quickly (under 150 s)", took !== null && took < 150, took);
/* (1) */
check("(1) the endless feed is cut: 16 rows kept (those starting within 960px of its first)", feed && feed.kept >= 15 && feed.kept <= 17, J(feed));
check("(1) …live had more than it keeps, and it grows as it is scrolled", feed && feed.of > feed.kept && feed.endless === true, J(feed));
check("(1) …no row past the kept ones is in the document", !words(/item (1[7-9]|[2-9]\d)\b/), J(words(/item (1[7-9]|[2-9]\d)\b/)?.content));
const s1 = doc.nodes.find((x) => /section:nth-of-type\(1\)$/.test(x.from?.selector ?? ""));
check("(1) …and its section is as tall as what is kept (padding, heading, the rows)", s1 && feed && Math.abs(s1.h - (40 + 40 + feed.kept * 60)) <= 2, J({ h: s1?.h, kept: feed?.kept }));
/* (2) */
check("(2) the live table is cut to 24 rows of its 30, said to be redrawn by the page", live && live.kept === 24 && live.of === 30 && live.rebuilt === true, J(live));
/* (3) */
const foot = doc.nodes.find((x) => /footer$/.test(x.from?.selector ?? ""));
/* …and its paragraph's 16px margin, which collapses through the footer's top as the browser lays it out. */
const want = 200 + (40 + 40 + (feed?.kept ?? 0) * 60) + (40 + 40 + (live?.kept ?? 0) * 40) + (40 + 40 + 8 * 30) + 16;
check("(3) the footer stands right under what is kept", foot && Math.abs(foot.y - want) <= 3, J({ y: foot?.y, want }));
/* (4) */
check("(4) each kept item is a part the list names", feed && feed.items?.length === feed.kept && feed.items.every((id) => node(id)), J(feed?.items?.length));
const listPart = feed?.part ? node(feed.part) : doc.nodes.find((x) => x.rows?.trimmed && /ul$/.test(x.from?.selector ?? ""));
check("(4) the list's part (when it is one) carries rows: of, kept, trimmed", !feed?.part || (listPart?.rows?.trimmed && listPart.rows.kept === feed.kept), J(listPart?.rows));
/* (5) */
check("control: the nav of 14 on one line is whole and no list", !lists.some((l) => /nav/.test(l.selector)) && doc.nodes.filter((x) => /^n\d+$/.test(String(x.content))).length === 14, J(lists.map((l) => l.selector)));
check("control: the list of 8 is whole", doc.nodes.filter((x) => /^short \d$/.test(String(x.content))).length === 8);

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
