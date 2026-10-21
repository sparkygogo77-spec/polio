/**
 * A FLEX ROW'S GAP STANDS BETWEEN THE RUNS IT FOLDS INTO.
 *
 * mochi.trade's hero pill is an <a> laid out as a flex row with an 8px gap:
 * a "Live" chip, its own words, a "▼86.7%" span (the ▼ a span of its own
 * inside it), more words and an arrow. Folded into runs it read
 * "LiveMochiMan is up 86.7% this week→": the gap was gone, and the ▼ went
 * with the span that held it, since the pill took that span's words before
 * the span had folded its own child in. Now each item of the row is set
 * apart by a spacer run as wide as the gap, the children fold first, and a
 * plain sentence (no flex) folds as before (inline-runs.mjs#foldRuns).
 *
 *   node capture/site/capture/check-flex-gap-runs.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-flex-gap-runs-"));
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:40px;font:14px sans-serif;background:#111;color:#ccc}
  a.pill{display:inline-flex;align-items:center;gap:8px;padding:4px 14px;border-radius:999px;background:#222;color:#bbb;text-decoration:none}
  .live{display:inline-flex;gap:6px;padding:2px 8px;border-radius:999px;background:rgba(47,214,123,.12);color:rgb(47,214,123);font-size:11px}
  .down{display:inline-flex;gap:4px;color:rgb(255,77,106);font-weight:600}
  .down i{font-style:normal;font-size:10px}
  .arrow{color:#606061}
</style></head><body>
<a class="pill" href="#"><span class="live">Live</span>MochiMan is up <span class="down"><i>▼</i>86.7%</span> this week <span class="arrow">→</span></a>
<p>a plain sentence with <b>bold words</b> in it</p>
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
const holding = (word) => doc.nodes.find((n) => Array.isArray(n.content) && n.content.some((r) => r.text.includes(word)));
const pill = holding("MochiMan");
const runs = pill?.content ?? [];
const at = (word) => runs.findIndex((r) => r.text.includes(word));
const spacer = (i) => runs[i]?.text === " " && Array.isArray(runs[i].pad);
check("the pill folds into runs", runs.length > 0, J(pill?.content));
check("a spacer stands between \"Live\" and \"MochiMan\"", at("Live") >= 0 && spacer(at("Live") + 1) && at("MochiMan") === at("Live") + 2, J(runs.map((r) => r.text)));
check("a spacer stands between \"this week\" and \"→\"", at("this week") >= 0 && spacer(at("this week") + 1) && at("→") === at("this week") + 2, J(runs.map((r) => r.text)));
const down = runs[at("▼")];
check("the ▼ is kept, in the red of the span that held it", !!down && down.colour === "rgb(255, 77, 106)", J(down));
check("…before its 86.7%", at("▼") >= 0 && at("▼") < at("86.7%"), J(runs.map((r) => r.text)));
const plain = holding("bold words");
check("control: a plain sentence folds with no spacer", !!plain && !plain.content.some((r) => r.pad) && plain.content.map((r) => r.text).join("") === "a plain sentence with bold words in it", J(plain?.content));

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
