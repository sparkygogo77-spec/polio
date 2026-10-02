/**
 * A SCREEN'S FILTER SURVIVES: SCANLINES, SHADING, WASH, FLICKER, A DIMMED LABEL.
 *
 * THE OWNER'S REPORT: on trumpmorty.fun the TV screen has CRT scanlines, a
 * darker vignette, a slight wash, and its "CH 47 • LIVE" label reads dimmed
 * through them; his published copy showed the picture clean. The site draws
 * them as thin layers over the picture (`.tv__scan`, a repeating gradient;
 * `.tv__glare`, two radial ones; an inset shadow on the screen). A stand-in
 * screen holds every way a page does that, each over a picture:
 *
 *   (1) a `::before` of scanlines (repeating-linear-gradient, no clicks);
 *   (2) an `::after` that is only an inset shadow (the vignette);
 *   (3) a wash layer in `mix-blend-mode: overlay` whose flicker animation
 *       holds it near transparent for half of every beat;
 *   (4) a 1px glow line in `mix-blend-mode: screen`;
 *   (5) the label, dimmed (opacity .7), over all of them.
 *
 * Each must be a part, painted after the picture (and the label after the
 * layers), keeping its gradient, shadow, blend, opacity and animation.
 * Control: the committed SOLCINERATOR captures convert byte for byte.
 * `SAVE_DOC=<file>` keeps the converted stand-in: polio holds its drawing of
 * the same screen to it (polio tests/fixtures/overlays-doc.json).
 *
 *   node capture/site/capture/check-overlays.mjs
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
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in screen</title>
<style>
  body{margin:0;font:16px/20px sans-serif;background:rgb(240,200,60)}
  @keyframes flick{0%,49%{opacity:1}50%,100%{opacity:.02}}
  .screen{position:relative;margin:80px;width:400px;height:300px;overflow:hidden;background:rgb(0,0,0);border:5px solid rgb(26,15,11);box-shadow:inset 0 0 40px rgba(0,0,0,.6)}
  .screen img{display:block;width:100%;height:100%;object-fit:cover}
  .screen::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 2px,transparent 2px 4px);pointer-events:none;z-index:1}
  .screen::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 60px rgba(0,0,0,.8);pointer-events:none;z-index:1}
  .wash{position:absolute;inset:0;background:rgba(255,255,255,.06);mix-blend-mode:overlay;animation:flick .4s steps(1) infinite;pointer-events:none;z-index:1}
  .glow{position:absolute;left:0;right:0;top:150px;height:1px;background:rgba(160,255,90,.5);mix-blend-mode:screen;pointer-events:none;z-index:1}
  .label{position:absolute;top:12px;left:14px;z-index:2;font:24px/28px monospace;color:rgb(184,255,106);opacity:.7}
</style></head><body>
  <div class="screen"><img src="/p.png" alt=""><div class="wash"></div><div class="glow"></div><div class="label">CH 47</div></div>
  <div style="height:900px"></div>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/p.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(PNG); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-overlays-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1", "--behaviours"], { stdio: ["ignore", "pipe", "pipe"], env });
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
if (process.env.SAVE_DOC) writeFileSync(process.env.SAVE_DOC, JSON.stringify(doc));
const nodes = doc.nodes;
const at = (pred) => nodes.findIndex(pred);
const sel = (re) => (n) => re.test(n.from?.selector ?? "");
const J = (x) => JSON.stringify(x);
const pic = at((n) => !!n.picture && /img$/.test(n.from?.selector ?? ""));
const scan = at(sel(/::before$/)), vig = at(sel(/::after$/)), wash = at(sel(/div:nth-of-type\(1\) > div:nth-of-type\(1\)$/)), glow = at(sel(/div:nth-of-type\(1\) > div:nth-of-type\(2\)$/)), label = at(sel(/div:nth-of-type\(1\) > div:nth-of-type\(3\)$/));
const N = (i) => nodes[i];
const said = J({ pic, scan, vig, wash, glow, label });
check("the picture is a part", pic >= 0, said);
check("(1) the scanlines are a part after the picture, with their repeating gradient, taking no clicks", scan > pic && /repeating-linear-gradient/.test(N(scan)?.art?.background ?? "") && N(scan)?.inert === true, J(N(scan) && [N(scan).art, N(scan).inert]));
check("(2) the vignette, an inset shadow and nothing else, is a part after the picture with its shadow", vig > pic && /inset/.test(N(vig)?.edge?.shadow ?? N(vig)?.art?.shadow ?? ""), J(N(vig) && [N(vig).edge, N(vig).art]));
check("(3) the wash is a part after the picture: overlay, its fill's alpha, and its flicker", wash > pic && N(wash)?.art?.blend === "overlay" && /0\.06\)/.test(N(wash)?.colour?.bg ?? "") && N(wash)?.art?.animation === "flick" && (N(wash)?.opacity === undefined || N(wash)?.opacity === null || N(wash)?.opacity > 0.5), J(N(wash) && [N(wash).art, N(wash).colour, N(wash).opacity]));
check("(3) …and the flicker's keyframes are in the document", (doc.keyframes ?? []).some((k) => k.name === "flick"), J((doc.keyframes ?? []).map((k) => k.name)));
check("(4) the 1px glow line is a part: screen blend, its fill", glow > pic && N(glow)?.h === 1 && N(glow)?.art?.blend === "screen", J(N(glow) && [N(glow).h, N(glow).art, N(glow).colour]));
check("(5) the label is over all of them, dimmed to .7", label > Math.max(scan, vig, wash, glow) && N(label)?.opacity === 0.7, J(N(label) && [label, N(label).opacity]));

/* Control */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
