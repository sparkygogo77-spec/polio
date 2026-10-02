/**
 * A CHIP IN A SENTENCE KEEPS ITS FILL.
 *
 * parasiteonsol.fun tags its headings with small dark chips: "HOST" before
 * "Hosts", "10:39 UTC" after "read from chain". Each chip is folded back into
 * its sentence as a run, and a run kept its ink and face but not its fill:
 * white words on the cream page, gone. A run keeps its background, its
 * padding and its rounding (`bg`, `pad`, `radius`), and its own size: the
 * 12px tag was drawn at its 28px heading's.
 *
 *   node capture/site/capture/check-chips.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-chips-"));
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:40px;font:16px sans-serif;background:#f5efd9;color:#2b1838}
  .tag{background:rgb(43, 24, 56);color:#fff;padding:6px 8px;border-radius:3px;font-size:12px}
  h2{font-size:28px;margin:0 0 20px} p{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5b4668}
</style></head><body>
<h2><span class="tag">HOST</span> Hosts</h2>
<p>read from chain <span class="tag">10:39 UTC</span></p>
<p>no chip here <b>just bold</b></p>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
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
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* no document */ }
const runOf = (word) => { for (const n of doc.nodes) if (Array.isArray(n.content)) { const r = n.content.find((s) => s.text.trim() === word); if (r) return { n, r }; } const n = doc.nodes.find((x) => x.content === word); return n ? { n, r: null } : null; };
for (const w of ["HOST", "10:39 UTC"]) {
  const got = runOf(w);
  const fill = got?.r ? got.r.bg : got?.n?.colour?.bg;
  const pad = got?.r ? got.r.pad : got?.n?.pad && [got.n.pad.top, got.n.pad.right, got.n.pad.bottom, got.n.pad.left];
  check(`the chip "${w}" keeps its dark fill`, fill === "rgb(43, 24, 56)", J(got && (got.r ?? { content: got.n.content, colour: got.n.colour })));
  check(`…and its padding (6 8 6 8)`, J(pad) === J([6, 8, 6, 8]), J(pad));
}
const host = runOf("HOST");
check("the chip keeps its own size (12px in a 28px heading)", host?.r?.size === 12, J(host?.r));
const bold = runOf("just bold");
check("control: a bold run has no fill", bold && !(bold.r ?? {}).bg && !bold.n.colour?.bg, J(bold && (bold.r ?? bold.n.content)));

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
