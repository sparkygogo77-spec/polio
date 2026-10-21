/**
 * A FIXED THING FILMED IN A LATER WINDOW KEEPS ITS PLACE IN THE WINDOW
 * (frames-drive.mjs), from thesolface.site's header button.
 *
 * The frames pass looks at the page a window at a time and wrote each moving
 * part's box as the window's place plus the scroll (`pageBox`). A fixed
 * thing in the second window (a header button at y 31 found with the page
 * scrolled 893 px) was recorded at 924: a place on the page it is never at.
 * A fixed thing is at the same place in the window whatever the scroll.
 *
 * A stand-in page has a fixed blinking square (top 30, left 20) that starts
 * to blink only once the page is scrolled past 600 px (so it is found in the
 * second window), and a blinking square in the page's flow at y 1100.
 *
 *   (1) the fixed square's box is at y 30 (its place in the window), not 30 plus the scroll;
 *   (2) the square in the flow keeps its place on the page (y 1100, give or take a pixel or two).
 *
 *   node capture/site/capture/check-fixed-frames.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-fixed-frames-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#101820;color:#fff;font:16px sans-serif}
  #fx{position:fixed;top:30px;left:20px;width:48px;height:48px;background:#4cff83;z-index:10;opacity:0}
  #fx.on{animation:blink 1s steps(2) infinite}
  #fl{position:absolute;top:1100px;left:300px;width:60px;height:60px;background:#ff8a3c;animation:blink 1s steps(2) infinite}
  @keyframes blink{50%{opacity:.1}}
  .tall{height:3000px}
</style></head><body>
<div id="fx"></div>
<div class="tall"><p>STANDIN</p></div><div id="fl"></div>
<script>addEventListener("scroll", function () { document.getElementById("fx").classList.toggle("on", scrollY > 600); }, { passive: true });</script>
</body></html>`;

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
const F = doc.behaviours?.motion?.frames ?? [];
const node = (id) => doc.nodes.find((n) => n.id === id);
const sel = (id) => node(id)?.from?.selector ?? "";
const J = (x) => JSON.stringify(x);
const fixed = F.find((f) => f.box?.[0] === 20);
const flow = F.find((f) => f.box?.[0] === 300);
check("(1) the fixed square is pictured", !!fixed, J(F.map((f) => ({ s: sel(f.part), box: f.box }))));
check("(1) …at y 30, its place in the window", fixed && Math.abs(fixed.box[1] - 30) <= 3, J(fixed?.box));
check("(2) the square in the flow is pictured at y 1100 on the page", flow && Math.abs(flow.box[1] - 1100) <= 3, J(flow?.box));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 400)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
