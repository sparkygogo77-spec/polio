/**
 * AN ANIMATED ELEMENT KEEPS WHAT ITS ANCESTORS ADD.
 *
 * sunkcoin.fun (J, 2026-10-11, "the arrow is not the same motion"): the
 * "scroll to dive" arrow is `rotate(45deg)` inside a cue placed `left: 50%;
 * transform: translateX(-50%)`, nudged by a keyframe `rotate(45deg)
 * translate(4px, 4px)` at 50%. The part's transform is everything that
 * moved the element, the cue's shift included, and a keyframe replaces the
 * whole of it: at 50% the arrow lost the shift and jumped 62px sideways,
 * twice a second. A keyframe replaces only the element's own transform. So
 * an animated element whose ancestors move it carries that part, `base`, on
 * each of its animations, about the same point as art.transform; polio plays
 * a copy of the keyframes with every transform frame composed on it
 * (capturedMotion.ts, tests/animation-base.mjs). One whose ancestors add
 * nothing carries none, so the committed captures convert as they did.
 *
 *   node capture/site/capture/check-animation-base.mjs
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
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#07192f;color:#f3eee3;font-family:monospace}
.hero{position:relative;height:600px}
.cue{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);text-align:center;font:400 8px/1 monospace;color:#f3eee3;width:123px}
.cue i{display:block;width:10px;height:10px;border-right:3px solid #f5d90a;border-bottom:3px solid #f5d90a;transform:rotate(45deg);margin:10px auto 0;animation:nudge 1.2s ease-in-out infinite}
@keyframes nudge{50%{transform:rotate(45deg) translate(4px,4px)}}
.bob{position:absolute;left:100px;top:100px;width:40px;height:40px;background:#f5d90a;animation:bob 2s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-6px)}}
section{height:600px}
</style></head><body>
<div class="hero"><div class="bob"></div><div class="cue"><span>SCROLL TO DIVE</span><i></i></div></div>
<section></section>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-base-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1", "--frames", "0"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").pop());
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const arrow = doc.nodes.find((n) => /> i$/.test(n.from?.selector ?? ""));
const a = arrow?.motion?.animation?.[0];
const base = /^matrix\(([^)]+)\)$/.exec(a?.base ?? "")?.[1]?.split(",").map(Number) ?? null;
check("the arrow's part wears everything that moved it: the cue's shift and its own turn (art.transform, a turn of 45°)", /^matrix\(0\.7071, 0\.7071, -0\.7071, 0\.7071/.test(arrow?.art?.transform ?? ""), JSON.stringify(arrow?.art));
check("…its nudge carries the cue's shift as base: no turn, 61.5px to the left", !!base && base.length === 6 && base[0] === 1 && base[1] === 0 && base[2] === 0 && base[3] === 1 && Math.abs(base[4] + 61.5) <= 1 && Math.abs(base[5]) <= 0.5, JSON.stringify(a));
const bob = doc.nodes.find((n) => /> div:nth-of-type\(1\)$/.test(n.from?.selector ?? "") && n.art?.animation === "bob");
check("a box animated with nothing over it carries no base", !!bob && !bob.motion?.animation?.[0]?.base, JSON.stringify(bob?.motion));

const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
