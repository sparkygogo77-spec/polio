/**
 * A LINE TALLER THAN THE BOX THE PAGE SET IT IN, from thesolface.site.
 *
 * The hero's ✳ is a 38×38 square (`display: grid; place-items: center`, a
 * 1px border) holding one line of 23px DM Mono at 1.7: a 39.1px line in a
 * 36px inside. The page sets the square's size and lets the line run past
 * it, the glyph centred. #community's ➤ 𝕏 ↗ links are the same (a 35px
 * square, a 35.9px line). The part took the line height as it was, so the
 * Builder drew the line whole and the square grew to it: 41 tall, +3, and
 * everything under it moved down by 3.
 *
 * A box laid out by its contents is never shorter inside than its line, so a
 * flex or grid box that is says the page fixed its size. Its words are set
 * on a line as tall as its inside: one line, centred as before, the box the
 * size the page made it.
 *
 *   (1) the ✳ square's line fits its 36px inside;
 *   (2) …the square keeps its 38px;
 *   (3) control: a grid box sized by its words keeps their line height (1.7);
 *   (4) control: a block line of words keeps its line height;
 *   (5) a square at `line-height: normal` (#community's 𝕏: 27px in a 35px square
 *       padded 4px, its normal line 36) is set on its inside too, as a number:
 *       drawn at `normal` it grew to 39.
 *
 *   node capture/site/capture/check-line-in-box.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-line-in-box-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#10241a;color:#4cff83;padding:40px;font:23px/1.7 "Courier New",monospace}
  .sq{display:grid;place-items:center;width:38px;height:38px;box-sizing:border-box;border:1px solid #306548;margin-bottom:40px}
  .auto{display:grid;place-items:center;width:120px;border:1px solid #306548;margin-bottom:40px}
  p{margin:0;width:300px}
  .nsq{display:grid;place-items:center;width:35px;height:35px;box-sizing:border-box;padding:4px 0;border:1px solid #559a7b;font:27px/normal Georgia,serif;margin-top:40px}
</style></head><body>
<span class="sq">✳</span>
<div class="auto">STAND</div>
<p>STANDIN LINE</p>
<span class="nsq">X</span>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "2"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const J = (x) => JSON.stringify(x);
const text = (n) => (Array.isArray(n.content) ? n.content.map((r) => r.text).join("") : String(n.content ?? ""));
const part = (w) => doc.nodes.find((n) => text(n).trim() === w);
const line = (n) => (n?.font?.px ?? 0) * (n?.font?.leading ?? 0);
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

const sq = part("✳"), auto = part("STAND"), p = part("STANDIN LINE"), nsq = part("X");
check("(1) the ✳ square's line fits its 36px inside", sq && line(sq) > 30 && line(sq) <= 36, J({ font: sq?.font, line: line(sq) }));
check("(2) …the square keeps its 38px", sq && near(sq.h, 38, 0.5), J(sq && { h: sq.h, w: sq.w }));
check("(3) control: a grid box sized by its words keeps their line height", auto && near(auto.font?.leading, 1.7, 0.005), J(auto?.font));
check("(4) control: a block line of words keeps its line height", p && near(p.font?.leading, 1.7, 0.005), J(p?.font));
check("(5) a square at line-height normal is set on its 25px inside, as a number", nsq && !nsq.font?.leadingNormal && line(nsq) > 20 && line(nsq) <= 25, J({ font: nsq?.font, line: line(nsq) }));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 500)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
