/**
 * A SCROLL-PROGRESS BAR (thesolface.site's #scrollFill), on any page.
 *
 * A thin fixed track whose fill a script widens with the page's scroll
 * (`fill.style.width = scrollY / (height - window) * 100 + '%'`). The
 * scroll-grow pass fits a line's growth against where its own top is in the
 * window; a fixed bar's top never moves, so it was never recorded
 * (`motion.scrollGrow` empty on thesolface).
 *
 *   (1) the fixed fill is a `scrollProgress` on its part: width, from 0 to
 *       100 % of its track, over the scroll positions it starts and ends at
 *       (`startY` near 0, `endY` near the page's last scroll);
 *   (2) a fixed bar that never changes (a decoy) is not recorded;
 *   (3) the in-flow line grown by its section's passing is still a
 *       `scrollGrow`, and is not also a scrollProgress.
 *
 * Captured with `--behaviours` and converted: `doc.behaviours.motion.scrollProgress`.
 *
 *   node capture/site/capture/check-scroll-progress.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-scroll-progress-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:sans-serif;background:#10141c;color:#fff}
  .track{position:fixed;left:0;right:0;top:0;height:4px;background:#222a3a;z-index:50}
  .track i{display:block;height:100%;width:0;background:#4cff83}
  .decoy{position:fixed;left:0;right:0;bottom:0;height:4px;background:#333;z-index:50}
  .decoy i{display:block;height:100%;width:40%;background:#c33}
  section{height:1400px;padding:40px}
  .line{height:6px;background:#334;margin:80px 0}
  .line i{display:block;height:100%;width:0;background:#9cf}
</style></head><body>
<div class="track"><i id="fill"></i></div>
<div class="decoy"><i></i></div>
<section><h1>STANDIN top</h1></section>
<section><h2>STANDIN middle</h2><div class="line"><i id="gl"></i></div></section>
<section><h2>STANDIN end</h2></section>
<script>
  var fill = document.getElementById("fill"), gl = document.getElementById("gl");
  function sync() {
    var max = document.documentElement.scrollHeight - innerHeight;
    fill.style.width = Math.max(0, Math.min(1, scrollY / max)) * 100 + "%";
    var top = gl.parentElement.getBoundingClientRect().top;
    gl.style.width = Math.max(0, Math.min(1, (innerHeight * 0.85 - top) / (innerHeight * 0.6))) * 100 + "%";
  }
  addEventListener("scroll", sync, { passive: true }); sync();
</script></body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "3", "--behaviours"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const M = doc.behaviours?.motion ?? {};
const node = (id) => doc.nodes.find((n) => n.id === id);
const sel = (id) => node(id)?.from?.selector ?? "";
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const J = (x) => JSON.stringify(x);
const last = JSON.parse(readFileSync(capture, "utf8")).page[1] - 800; // the page's last scroll

const sp = (M.scrollProgress ?? []).find((g) => /^body > div:nth-of-type\(1\) > i$/.test(sel(g.part)));
check("(1) the fixed fill is a scrollProgress on its part, by width", sp && sp.prop === "width", J(M.scrollProgress));
check("(1) …from nothing to its whole track", near(sp?.from, 0, 2) && near(sp?.to, 100, 3), J({ from: sp?.from, to: sp?.to }));
check("(1) …starting at the top and whole at the page's last scroll", near(sp?.startY, 0, 60) && near(sp?.endY, last, 200), J({ startY: sp?.startY, endY: sp?.endY, last }));
check("(2) the fixed bar that never changes is not recorded", (M.scrollProgress ?? []).length === 1, J(M.scrollProgress));
const gr = (M.scrollGrow ?? [])[0];
check("(3) the in-flow line is still a scrollGrow", gr && gr.prop === "width", J(M.scrollGrow));
check("(3) …and not also a scrollProgress", !(M.scrollProgress ?? []).some((g) => g.part === gr?.part));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 400)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
