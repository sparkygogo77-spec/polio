/**
 * TWO RIBBONS CROSS, AND THE ONE WITH THE Z-INDEX IS ON TOP.
 *
 * THE OWNER'S REPORT, via the polish lane: on trumpmorty.fun the red ribbon
 * row (`z-index: 2`) lies over the navy row wherever they cross; in polio
 * the navy one was on top. Both rows are absolute inside `.tape`, a
 * `relative; z-index: 6` box. The converter ranked a z-auto band by the
 * z-index of the stacking context it sits in (the tape's 6) and a z-indexed
 * one by its own (2), so the navy row sorted after the red one. In the
 * browser both are in the tape's context, and there the z-auto row paints at
 * 0 and the red one at 2.
 *
 * A stand-in tape, the site's own rules, the red row first in the page:
 *   (1) the red row comes after the navy row in the parts;
 *   (2) and so do the red row's words;
 *   (3) control: a positioned band with z-index 5 outside the tape still
 *       paints under the whole tape (6 beats 5 however deep the rows sit);
 *   (4) control: the committed SOLCINERATOR captures convert byte for byte.
 *
 *   node capture/site/capture/check-paint-order.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in tape</title>
<style>
  body{margin:0;font:16px/20px sans-serif;color:#111;background:rgb(240,200,60)}
  .gap{height:200px}
  .tape{position:relative;z-index:6;height:150px;margin:-70px 0 -80px;overflow:hidden;pointer-events:none}
  .row{position:absolute;left:-5%;right:-5%;border-block:4px solid rgb(26,15,11);overflow:hidden;white-space:nowrap}
  .row--a{top:28px;background:rgb(230,57,70);transform:rotate(-2.5deg);z-index:2}
  .row--b{top:62px;background:rgb(29,53,87);transform:rotate(2deg)}
  .track{display:inline-block;font-size:32px;padding:12px 0 6px;color:rgb(255,255,255)}
  .row--b .track{color:rgb(240,200,61)}
  .badge{position:absolute;left:100px;top:180px;width:200px;height:80px;background:rgb(0,160,80);z-index:5}
  .foot{height:600px}
</style></head><body>
  <div class="gap"></div>
  <div class="badge"></div>
  <div class="tape">
    <div class="row row--a"><div class="track">$TRORTY ★ TO THE MOON ★ $TRORTY</div></div>
    <div class="row row--b"><div class="track">WUBBA LUBBA ★ COVFEFE ★ WUBBA</div></div>
  </div>
  <div class="foot"></div>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-paint-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const at = (pred) => doc.nodes.findIndex(pred);
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const red = at((n) => n.colour?.bg === "rgb(230, 57, 70)");
const navy = at((n) => n.colour?.bg === "rgb(29, 53, 87)");
const redWords = at((n) => /TO THE MOON/.test(words(n)));
const navyWords = at((n) => /COVFEFE/.test(words(n)));
const badge = at((n) => n.colour?.bg === "rgb(0, 160, 80)");
const said = JSON.stringify({ red, redWords, navy, navyWords, badge });

check("(1) the red row (z-index 2) comes after the navy row (z auto) in the parts", red >= 0 && navy >= 0 && red > navy, said);
check("(2) …and so do its words: the red row's track after the navy row and its track", redWords > navy && redWords > navyWords, said);
check("(3) control: a z-index 5 band outside the tape paints under the whole tape (6)", badge >= 0 && badge < Math.min(red, navy), said);

/* Control */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("(4) control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
