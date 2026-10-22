/**
 * A FACE'S AXES, AS THE PAGE SET THEM, CARRIED, from sunkcoin.fun.
 *
 * sunkcoin's payday heading is Fraunces, a variable face, set at its largest
 * optical size: `font-variation-settings: "opsz" 144`. The capture did not
 * read it, so the Builder drew the heading at the face's own optical size for
 * 60px, about a tenth wider: five lines became six, the heading grew 61px and
 * the whole page under it moved down by 61 (MEASURED, 1440).
 *
 * The dump reads `font-variation-settings` where it is set (`fvs`) and the
 * converter writes it on the part's type (`font.variation`).
 *
 *   (1) the heading's part carries "opsz" 144;
 *   (2) its words' runs keep it as they fold (the heading holds an <em>);
 *   (3) control: a paragraph with no axes set carries none.
 *
 *   node capture/site/capture/check-font-variation.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-font-variation-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:40px;font:16px/1.5 Georgia,serif}
  h2{font:400 60px/1.02 Georgia,serif;font-variation-settings:"opsz" 144;width:462px;margin:0 0 40px}
  h2 em{font-weight:300}
  p{width:400px;margin:0}
</style></head><body>
<h2>STANDIN when the chart dips, the pot <em>buys the dip</em> and hands it on.</h2>
<p>STANDIN plain words</p>
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
const head = doc.nodes.find((n) => /chart dips/.test(text(n)));
const para = doc.nodes.find((n) => /plain words/.test(text(n)));
check("(1) the heading's part carries \"opsz\" 144", head && /"opsz" 144/.test(head.font?.variation ?? ""), J(head?.font));
check("(2) its words fold with the <em> as a run, the part's axes over all of them", head && Array.isArray(head.content) && head.content.some((r) => /buys the dip/.test(r.text)), J(head?.content));
check("(3) control: a paragraph with no axes set carries none", para && !para.font?.variation, J(para?.font));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 500)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
