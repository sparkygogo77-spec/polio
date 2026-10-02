/**
 * A PAGE WITH ITS OWN SCROLLBAR IS AS WIDE AS WHAT IT LAYS OUT.
 *
 * parasiteonsol.fun keeps room for its scrollbar (`html { scrollbar-gutter:
 * stable }`), 15px of the 1440px window where scrollbars take room (as on
 * Windows and Linux, and in the capture's browser): the page is laid out
 * 1425 wide. The
 * document said its frame was 1440, so no part spanned the frame, polio
 * stretched none of them with the window, and at 2000 the export stopped
 * 575px short of the right edge. The frame is the width the page was laid
 * out in (`frameWidth` 1425), and a full-width band spans it.
 *
 *   node capture/site/capture/check-scrollbar-width.mjs
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
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
const PAGE = (bar) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px sans-serif} header{height:64px;background:#fff5e0;border-bottom:2px solid #2b1838}
  section{height:1600px;background:#eaf6d6}
  ${bar ? "html{scrollbar-gutter:stable} body{overflow-y:auto}" : ""}
</style></head><body><header><b>Parasite</b></header><section><h1>Coins priced in another coin.</h1></section></body></html>`;
for (const bar of [true, false]) {
  const dir = mkdtempSync(join(tmpdir(), "check-scrollbar-"));
  const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE(bar) : ""); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
  writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1440, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
  await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1440", "--height", "900", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
  await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
  server.close();
  let doc = { nodes: [] };
  try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* no document */ }
  const header = doc.nodes.find((n) => /header$/.test(n.from?.selector ?? ""));
  if (bar) {
    check("with its own 15px scrollbar the page is laid out 1425 wide, and that is the frame", doc.frameWidth === 1425, J(doc.frameWidth));
    check("…and its full-width header spans the frame", header && header.x === 0 && header.w === doc.frameWidth, J(header && [header.x, header.w, doc.frameWidth]));
  } else check("control: with no scrollbar of its own the frame is the window, 1440", doc.frameWidth === 1440 && header?.w === 1440, J([doc.frameWidth, header?.w]));
}
for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
