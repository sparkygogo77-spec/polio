/**
 * A DRAWING KEPT WHOLE SHOWS ITS PICTURES, AND ITS WORDS ONCE.
 *
 * trendtrader.pro/ttp's roadmap draws each horizon as an inline svg: frames
 * and lines in several colours (so it is kept whole, as a picture of
 * itself), the TTP coin as an `<image href="/ttp/assets/ttp-coin-480.webp">`,
 * and labels as `<text>` ("Private fund", "Positions", "Gold"). A picture
 * drawn from a file loads nothing from outside it, so the coin was gone;
 * and the labels came twice: as parts in the page's face and inside the
 * picture in a serif (a picture has no web fonts). Now every `<image>` it
 * holds is fetched and written in, and its words are the parts alone.
 *
 *   node capture/site/capture/check-svg-whole.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26, timeout: 300000 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-svg-whole-"));
/* A 2 × 2 png, blue. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkYPjPwMDAxMDAwMDAAAAN/gEBhnhD0gAAAABJRU5ErkJggg==", "base64");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:16px sans-serif;background:#05080f;color:#eee}</style></head><body>
<div style="padding:40px"><svg width="400" height="230" viewBox="0 0 400 230">
  <rect x="10" y="10" width="200" height="150" rx="8" fill="#0d1520" stroke="#2a3a4a"/>
  <path d="M220 80 L300 80" stroke="#5fd3c4" stroke-width="2"/>
  <image href="/coin.png" x="300" y="40" width="80" height="80"/>
  <text x="30" y="40" fill="#ffffff" font-size="11">Private fund</text>
  <text x="30" y="70" fill="#9aa" font-size="11">Positions</text>
</svg></div></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/coin.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(PNG); return; }
  res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : "");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
let cap = null, doc = { nodes: [] };
try { cap = JSON.parse(readFileSync(capture, "utf8")); } catch { /* no capture */ }
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* no document */ }
let svgEl = null;
(function walk(e) { if (!e) return; if (e.t === "svg") svgEl = e; (e.kids ?? []).forEach(walk); })(cap?.tree);
const file = svgEl?.svgFile && existsSync(join(assets, svgEl.svgFile)) ? readFileSync(join(assets, svgEl.svgFile), "utf8") : "";
check("the drawing is kept whole, as a file", !!file, J(svgEl && Object.keys(svgEl)));
check("…its <image> is written into it (data:), not left as an address a picture cannot load", /<image[^>]*href="data:image\/png;base64,/.test(file) && !/href="\/coin\.png"/.test(file), (file.match(/<image[^>]*/) ?? [""])[0].slice(0, 200));
check("…and it holds no <text>: its words are parts", !/<text/.test(file), (file.match(/<text[^>]*>[^<]*/g) ?? []).join(" | ").slice(0, 200));
for (const w of ["Private fund", "Positions"]) {
  const parts = doc.nodes.filter((n) => n.content === w);
  check(`"${w}" is one part, in the page's face`, parts.length === 1, J(parts.map((n) => [n.id, n.x, n.y])));
}

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
