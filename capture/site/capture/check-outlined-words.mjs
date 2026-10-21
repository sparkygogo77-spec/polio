/**
 * OUTLINED AND GRADIENT WORDS INSIDE A HEADING, from thesolface.site.
 *
 * thesolface's headings hold words drawn with no ink of their own:
 * `<span class="gradient-text">CHASE</span>` (a gradient clipped to the
 * words: `background-clip: text`, colour transparent) and
 * `<em class="stroke-word">STARS.</em>` (`-webkit-text-stroke`, colour
 * transparent). Folded into the heading as runs, each arrived as a
 * transparent run and nothing else: the words were invisible.
 *
 *   (1) a stroked run carries `textStroke: { w, color }` (the field a split
 *       title's letters already carry);
 *   (2) a gradient-clipped run carries `fill: { image, clip: "text" }`, the
 *       computed background-image verbatim, and keeps its transparent `colour`;
 *   (3) a run that is neither (ordinary words, a plain coloured run) carries
 *       neither field.
 *
 *   node capture/site/capture/check-outlined-words.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-outlined-words-"));
const GRADIENT = "linear-gradient(112deg, rgb(76, 255, 131) 3%, rgb(25, 233, 197) 48%, rgb(41, 204, 253) 69%)";

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0a0f18;color:#f6f5ef;font:700 64px/1.1 sans-serif;padding:40px}
  h2{margin:0 0 40px}
  .gradient-text{background:${GRADIENT};-webkit-background-clip:text;background-clip:text;color:transparent}
  .stroke-word{font-style:normal;color:transparent;-webkit-text-stroke:2px #4cff83}
  .plain{color:#ff8a3c}
</style></head><body>
<h2>HE DOESN'T <span class="gradient-text">CHASE</span> THE CANDLE.</h2>
<h2>FROM THE <span class="gradient-text">TRENCHES</span> TO THE <em class="stroke-word">STARS.</em></h2>
<h2>THE <span class="plain">FROG</span> FILES</h2>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "2"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const runs = doc.nodes.flatMap((n) => (Array.isArray(n.content) ? n.content : []));
const J = (x) => JSON.stringify(x);
const word = (w) => runs.find((r) => r.text?.trim() === w);

const stars = word("STARS.");
check("(1) STARS. is a run carrying textStroke { w: 2, color }", stars && stars.textStroke?.w === 2 && /76, 255, 131/.test(stars.textStroke?.color ?? ""), J(stars));
check("(1) …and keeps its transparent ink", stars && /rgba\(0, 0, 0, 0\)|transparent/.test(stars.colour ?? ""), J(stars));
for (const w of ["CHASE", "TRENCHES"]) {
  const r = word(w);
  check(`(2) ${w} carries fill { image: the gradient, clip: "text" } and its transparent ink`, r && r.fill?.clip === "text" && r.fill?.image === GRADIENT && /rgba\(0, 0, 0, 0\)|transparent/.test(r.colour ?? ""), J(r));
}
const frog = word("FROG");
check("(3) a plain coloured run carries neither textStroke nor fill", frog && frog.colour && !("textStroke" in frog) && !("fill" in frog), J(frog));
check("(3) the heading's own plain words carry neither", runs.filter((r) => /^(HE DOESN'T|THE CANDLE|FROM THE|FILES)/.test(r.text.trim())).every((r) => !("textStroke" in r) && !("fill" in r)), J(runs));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 400)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
