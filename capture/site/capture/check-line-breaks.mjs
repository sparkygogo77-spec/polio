/**
 * A LINE THE PAGE BREAKS STAYS BROKEN.
 *
 * trendtrader.pro/ttp's headings break where the page put a `<br>`: "What’s
 * next for / TrendTrader Pro & TTP.", "Grow the software. / Prepare Fund
 * A.". The capture read the words as one line, so the heading wrapped
 * wherever the width fell and pushed the page under it down. A `<br>` the
 * page shows is a line break in the words ("\n"); one it hides (a phone's
 * break, `display: none` here) is not, nor a newline in the HTML source.
 * And a heading set `text-wrap: balance` ("Build a global private / hedge
 * fund around TTP.", its lines evened out) keeps it, as `text.wrap`.
 *
 *   node capture/site/capture/check-line-breaks.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26, timeout: 300000 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-line-breaks-"));
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px/24px sans-serif} h2{width:750px;font-size:52px;line-height:56px;margin:0 0 20px}
  .mobile{display:none}
</style></head><body>
<h2>What’s next for<br>TrendTrader Pro &amp; TTP.</h2>
<h3>Grow the software.<br>
      Prepare Fund A.</h3>
<p>A sentence with a phone's<br class="mobile"> break that is hidden here.</p>
<h3 style="width:389px;font-size:26px;text-wrap:balance">Build a global private hedge fund around TTP.</h3>
<p>A sentence written
   over two lines of source.</p>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const texts = doc.nodes.map((n) => (typeof n.content === "string" ? n.content : "")).filter(Boolean);
const J = (x) => JSON.stringify(x);
check("a heading broken with <br> keeps its break", texts.includes("What’s next for\nTrendTrader Pro & TTP."), J(texts));
check("…also with the source's own newline and spaces round it", texts.includes("Grow the software.\nPrepare Fund A."), J(texts));
check("a <br> the page hides is no break", texts.includes("A sentence with a phone's break that is hidden here."), J(texts));
check("a newline in the HTML source is a space", texts.includes("A sentence written over two lines of source."), J(texts));

const bal = doc.nodes.find((n) => n.content === "Build a global private hedge fund around TTP.");
check("a heading set text-wrap: balance keeps it (text.wrap)", bal?.text?.wrap === "balance", J(bal && bal.text));
const plain = doc.nodes.find((n) => n.content === "A sentence written over two lines of source.");
check("control: a paragraph wrapped as usual says nothing of it", plain && !plain.text?.wrap, J(plain && plain.text));

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
