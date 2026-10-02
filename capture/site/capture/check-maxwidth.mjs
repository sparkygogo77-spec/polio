/**
 * A MAX-WIDTH IS KEPT.
 *
 * stonkfun.xyz wraps its page in `max-width: 1440px; margin: 0 auto`. The
 * capture read it (`maxw`) and the converter dropped it ("a node has a size,
 * not a constraint on one"), so polio stretched the page's contents edge to
 * edge on a wider window. A max-width in px is carried as `node.maxw`; one
 * that is a share (`50%`) or none says nothing.
 *
 *   node capture/site/capture/check-maxwidth.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-maxwidth-"));
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px sans-serif;background:#07131a;color:#eef}
  header{height:64px;background:#0b171b}
  .wrap{max-width:1440px;margin:0 auto;padding:32px 24px;box-sizing:border-box;background:#0d1d22}
  section{height:300px;background:#12303a}
  .half{max-width:50%;height:40px;background:#345}
</style></head><body><header></header><div class="wrap"><section><h1>Launch coins paired with a stock</h1></section><div class="half"></div></div></body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1440, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1440", "--height", "900", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* no document */ }
const wrap = doc.nodes.find((n) => /body > div$/.test(n.from?.selector ?? ""));
const half = doc.nodes.find((n) => /div > div$/.test(n.from?.selector ?? ""));
const head = doc.nodes.find((n) => /header$/.test(n.from?.selector ?? ""));
check("the 1440px max-width container carries maxw 1440", wrap?.maxw === 1440, J(wrap && { maxw: wrap.maxw, w: wrap.w }));
check("control: a max-width of 50% says nothing", half && half.maxw === undefined, J(half && half.maxw));
check("control: the full-bleed header has none", head && head.maxw === undefined, J(head && head.maxw));
for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
