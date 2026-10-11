/**
 * A STYLESHEET MARQUEE IS THE BUILDER'S OWN MARQUEE.
 *
 * sunkcoin.fun (J, 2026-10-11: "they also have their banner where ours
 * doesnt"): the ticker strip is a flex row of spans, `padding-left: 100%`,
 * carried left by a keyframe (`translateX(-100%)` over 60s, forever) inside
 * a box that clips. Measured at rest every span stood past the page's right
 * edge, wholly outside the box that clips it, so none became a part and the
 * strip came out an empty bar; and the row's animation, inherited by each
 * part, would have slid each by its own width. Now an element run forever
 * by a keyframe that slides it across by its own width is a marquee: one
 * copy of its words folded in as runs (the page repeats them to fill the
 * loop) with the gaps its row set, no animation on it, its box only what the
 * page shows of it, and `behaviours.loops` names it a marquee at the page's
 * own pace, so polio gives it the Marquee feature (captured.ts,
 * tests/marquee-captured.mjs).
 *
 *   node capture/site/capture/check-marquee-css.mjs
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
/* Three words, repeated three times, in a strip 1000 wide: the row is 100% padded and 20s across; the second word carries a yellow number. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#07192f;color:#f3eee3;font-family:monospace}
.strip{overflow:hidden;height:36px;display:flex;align-items:center;background:#05142a;border-bottom:2px solid #fff}
.run{display:flex;gap:48px;white-space:nowrap;font:400 9px/1 monospace;letter-spacing:.12em;text-transform:uppercase;animation:run 20s linear infinite;padding-left:100%}
@keyframes run{to{transform:translateX(-100%)}}
.run span i{color:#f5d90a;font-style:normal}
.bob{width:40px;height:40px;background:#f5d90a;margin:40px;animation:bob 2s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-6px)}}
section{height:600px}
</style></head><body>
<section><h1>Hello</h1><div class="bob"></div></section>
<div class="strip"><div class="run">${`<span>120 underwater</span><span>pot <i>3.82 sol</i></span><span>deepest <i>-95%</i></span>`.repeat(3)}</div></div>
<section></section>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-marquee-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1", "--frames", "0", "--behaviours"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").pop());
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [], behaviours: {} };
const run = doc.nodes.find((n) => /^body > div > div$/.test(n.from?.selector ?? ""));
const spans = doc.nodes.filter((n) => /^body > div > div > /.test(n.from?.selector ?? ""));
const runs = Array.isArray(run?.content) ? run.content : [];
const words = runs.map((r) => r.text).join("");
check("the row is a part of words, one copy of its three spans folded in as runs", run?.featureId === "prose" && /120 UNDERWATER.*POT 3\.82 SOL.*DEEPEST -95%/i.test(words) && !/UNDERWATER[\s\S]*UNDERWATER/i.test(words), JSON.stringify(run?.content));
check("…the yellow number is a run of its own colour", runs.some((r) => /3\.82/.test(r.text) && /245, 217, 10/.test(r.colour ?? "")), JSON.stringify(runs));
check("…with the row's 48px gap between the words, as padded spaces", runs.filter((r) => r.pad && r.pad[1] + r.pad[3] >= 40).length === 2, JSON.stringify(runs.map((r) => r.pad)));
check("…its box only what the page shows: the strip's 1000px, from the left, no padding", run && run.x === 0 && run.w === 1000 && !(run.pad?.left), JSON.stringify({ x: run?.x, w: run?.w, pad: run?.pad }));
check("…and no animation on it (the Marquee feature runs it)", !run?.art?.animation && !(run?.motion?.animation ?? []).length, JSON.stringify({ art: run?.art, motion: run?.motion }));
check("the spans became no parts of their own", spans.length === 0, JSON.stringify(spans.map((n) => n.from.selector)));
const loop = (doc.behaviours?.loops ?? []).find((l) => l.part === run?.id);
/* The row is its padding (the strip's 1000px) and its nine words: about 2100px, carried across in 20s. */
check("behaviours.loops names it a marquee: left, the row's own width over 20s (about 105px/s), 3 copies, gap 48", loop?.kind === "marquee" && loop.css === true && loop.direction === "left" && loop.speed >= 95 && loop.speed <= 120 && loop.copies === 3 && loop.gap === 48, JSON.stringify(loop ?? doc.behaviours?.loops));
const bob = doc.nodes.find((n) => /^body > section:nth-of-type\(1\) > div$/.test(n.from?.selector ?? ""));
check("a box that bobs in place keeps its own animation: not a marquee", bob?.art?.animation === "bob" && bob.featureId === "box", JSON.stringify(bob?.art));

const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
