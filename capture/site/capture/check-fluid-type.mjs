/**
 * TYPE SET IN THE WINDOW'S UNITS KEEPS THEM.
 *
 * THE OWNER, trumpmorty.fun at 2000 beside his copy: the site sets its type
 * with the window (the title `clamp(58px, 8.6vw, 132px)`, the buttons
 * `clamp(22px, 2.2vw, 32px)`, the badge, the headings), so at 2000 the title
 * is 132px where the capture measured 123.8 at 1440, the hero's column is
 * taller, and the CA line sits 7px lower. The capture kept only the px.
 *
 * A stand-in holds each way a page does it:
 *   (1) a title whose letters inherit `clamp(58px, 8.6vw, 132px)` from their
 *       row (the letters fold into one part);
 *   (2) its "&" at `.62em` of that: `calc(<the clamp> * 0.62)`;
 *   (3) a button `clamp(22px, 2.2vw, 30px)`;
 *   (4) a heading `min(7vw, 104px)`;
 *   (5) control: words in px inside the title's block stay px only;
 *   (6) control: `calc(1rem + 2px)` names no window unit, so it is not kept;
 *   (7) control: a rule in a media query that does not match is not read;
 *   (8) the hero (`min-height: 100svh`) also says how tall it is on its own,
 *       what it holds and its padding, for a window shorter than that.
 * The authored value goes to the capture as `fsu` and to the part as
 * `font.fluid`, beside `font.px`. Control: the committed SOLCINERATOR
 * captures still convert byte for byte.
 *
 *   node capture/site/capture/check-fluid-type.mjs
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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in type</title>
<style>
  body{margin:0;font:16px/20px sans-serif;color:#111;background:rgb(240,200,60)}
  .hero{position:relative;min-height:100vh;min-height:100svh;display:flex;align-items:center;padding:30px 0 40px;background:rgb(250,220,120)}
  .title{display:flex;flex-direction:column;align-items:flex-start;line-height:.86;margin:40px}
  .row{display:flex;align-items:center;font-size:clamp(58px,8.6vw,132px);color:rgb(250,250,250)}
  .amp{display:inline-block;margin-left:.12em;font-size:.62em;color:rgb(140,210,60)}
  .btn{display:inline-flex;margin:20px 40px;padding:16px 28px;font-size:clamp(22px,2.2vw,30px);background:rgb(166,216,111);border:4px solid #111;border-radius:20px}
  .h2{margin:20px 40px;font-size:min(7vw,104px);line-height:.9;color:rgb(20,20,90)}
  .small{margin:10px 40px;font-size:14px;color:rgb(90,20,20)}
  .rem{margin:10px 40px;font-size:calc(1rem + 2px);color:rgb(20,90,20)}
  @media (max-width:500px){.h2{font-size:9vw}}
</style></head><body>
  <section class="hero"><h1 class="title"><span class="row"><span class="l">T</span><span class="l">R</span><span class="l">U</span><span class="l">M</span><span class="l">P</span><span class="amp">&amp;</span></span><span class="row"><span class="l">M</span><span class="l">O</span><span class="l">R</span><span class="l">T</span><span class="l">Y</span></span></h1></section>
  <a class="btn" href="#x">BUY ON PUMP.FUN</a>
  <h2 class="h2">THE LORE</h2>
  <p class="small">A hole ripped open</p>
  <p class="rem">Plain rem words</p>
  <div style="height:900px"></div>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/p.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(PNG); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-fluid-type-"));
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
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const J = (x) => JSON.stringify(x);
const find = (re) => doc.nodes.find((n) => re.test(words(n)));
const title = find(/TRUMP/), btn = find(/BUY ON/), h2 = find(/THE LORE/), small = find(/hole ripped/), rem = find(/Plain rem/);
const amp = Array.isArray(title?.content) ? title.content.find((r) => r.text?.includes("&")) : null;
check("(1) the title's letters keep the row's clamp as font.fluid, beside its px", title?.font?.fluid === "clamp(58px, 8.6vw, 132px)" && title?.font?.px === 86, J(title?.font));
check("(2) its \"&\" keeps .62em of it", /^calc\(clamp\(58px, 8\.6vw, 132px\) \* 0\.62\)$/.test(amp?.fluid ?? ""), J(amp));
check("(3) the button keeps clamp(22px, 2.2vw, 30px)", btn?.font?.fluid === "clamp(22px, 2.2vw, 30px)", J(btn?.font));
check("(4) the heading keeps min(7vw, 104px)", h2?.font?.fluid === "min(7vw, 104px)", J(h2?.font));
check("(5) control: px words stay px only", !!small && small.font?.fluid === undefined && small.font?.px === 14, J(small?.font));
check("(6) control: calc(1rem + 2px) names no window unit and is not kept", !!rem && rem.font?.fluid === undefined, J(rem?.font));
check("(7) control: a media rule that does not match is not read (the heading is min(), not 9vw)", h2?.font?.fluid !== "9vw", J(h2?.font));

const hero = doc.nodes.find((n) => n.vh?.minHeight);
const own = title ? title.h + 30 + 40 + 2 * 40 : NaN; /* the title, the hero's padding, the title's margins */
check("(8) the hero keeps how tall it is on its own: its content and padding", !!hero && hero.vh.px === 600 && Math.abs((hero.vh.content ?? 0) - own) <= 2, J({ vh: hero?.vh, own }));

/* Control */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
