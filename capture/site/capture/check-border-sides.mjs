/**
 * An edge drawn on some sides only is recorded side by side, and the
 * document draws it on those sides only.
 *
 * SOLCINERATOR's footer has `border-top: 1px solid` and nothing else. The
 * capture wrote it as `border: "1px solid rgb(45, 55, 72)"`, one edge all
 * round, so polio drew a 1px line on all four sides and took 2px off the
 * width of what the footer holds: its row came out 1246 wide where the real
 * site's is 1248 (polio tests/fluid-site.mjs).
 *
 * A stand-in page draws the shapes an edge takes: on the top only, on the
 * bottom only, sides of different widths, sides of one width in different
 * colours, and, the control, one edge all round. It is captured the way
 * every page is (`capture-route.mjs`) and converted; each box must record
 * each side's width and colour, and its part must draw its edge on those
 * sides only, with what it holds exactly as wide as on the page.
 *
 *   node capture/site/capture/check-border-sides.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);

/* Each box holds one row whose width is what the edge leaves it: the thing polio lays out. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in edges</title>
<style>
  body{background:#0a0e1a;color:#fff;margin:0;padding:24px;font:16px monospace}
  .box{width:400px;padding:16px;margin-bottom:24px;box-sizing:border-box;background:#111827}
  .row{height:40px;background:#1f2937}
  #top{border-top:1px solid #2d3748}
  #bottom{border-bottom:3px dashed #ff0000}
  #mixed{border-style:solid;border-color:#2d3748;border-width:1px 2px 4px 0}
  #colours{border:2px solid;border-color:#ff0000 #00ff00 #0000ff #ffff00}
  #round{border:2px solid #00ff00}
</style></head>
<body>
  <footer class="box" id="top"><div class="row">top</div></footer>
  <div class="box" id="bottom"><div class="row">bottom</div></div>
  <div class="box" id="mixed"><div class="row">mixed</div></div>
  <div class="box" id="colours"><div class="row">colours</div></div>
  <div class="box" id="round"><div class="row">round</div></div>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "border-sides-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
/* The page is on this machine: no proxy between the browser and it. */
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "800", "--height", "900"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
const cap = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : { tree: { kids: [] } };

writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [800, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out")], { encoding: "utf8" });
check("…and converted", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };

/* ------------------------------------------------------------ the capture */
const all = [];
(function walk(e) { all.push(e); (e.kids ?? []).forEach(walk); })(cap.tree);
const box = (words) => all.find((e) => (e.kids ?? []).some((k) => k.text === words));
const rowOf = (words) => all.find((e) => e.text === words);
const top = box("top"), bottom = box("bottom"), mixed = box("mixed"), colours = box("colours"), round = box("round");
check("a top-only edge is recorded on the top only", J(top?.bsides) === J([1, 0, 0, 0]) && /^1px solid rgb\(45, 55, 72\)$/.test(top?.border ?? ""), J({ border: top?.border, bsides: top?.bsides }));
check("a bottom-only edge is recorded on the bottom only, in its own style and colour", J(bottom?.bsides) === J([0, 0, 3, 0]) && /^3px dashed rgb\(255, 0, 0\)$/.test(bottom?.border ?? ""), J({ border: bottom?.border, bsides: bottom?.bsides }));
check("sides of different widths are each recorded", J(mixed?.bsides) === J([1, 2, 4, 0]), J(mixed?.bsides));
check("sides of one width in different colours are each recorded, colour by colour", J(colours?.bcolours) === J(["rgb(255, 0, 0)", "rgb(0, 255, 0)", "rgb(0, 0, 255)", "rgb(255, 255, 0)"]), J({ border: colours?.border, bsides: colours?.bsides, bcolours: colours?.bcolours }));
check("control: one edge all round is one border, nothing side by side", /^2px solid rgb\(0, 255, 0\)$/.test(round?.border ?? "") && !round?.bsides && !round?.bcolours, J({ border: round?.border, bsides: round?.bsides, bcolours: round?.bcolours }));

/* ------------------------------------------------------------ the document */
const byWords = (words) => { const r = rowOf(words); return doc.nodes.find((n) => n.content === words || (typeof n.content === "string" && n.content.includes(words) && Math.abs(n.w - (r?.w ?? 0)) < 1)); };
const partOf = (e) => doc.nodes.find((n) => Math.abs(n.x - e.x) < 1 && Math.abs(n.y - e.y) < 1 && Math.abs(n.w - e.w) < 1 && Math.abs(n.h - e.h) < 1 && n.content !== (e.kids?.[0]?.text));
const inset = (n) => String(n?.edge?.shadow ?? "").split(/,\s*(?![^()]*\))/).filter((s) => /^inset/.test(s.trim()));
const holds = (n) => (n ? n.w - (n.pad?.left ?? 0) - (n.pad?.right ?? 0) : null);
for (const [name, e, want] of [
  ["top-only", top, ["inset 0 1px 0 0 rgb(45, 55, 72)"]],
  ["bottom-only", bottom, ["inset 0 -3px 0 0 rgb(255, 0, 0)"]],
  ["mixed-width", mixed, ["inset 0 1px 0 0 rgb(45, 55, 72)", "inset -2px 0 0 0 rgb(45, 55, 72)", "inset 0 -4px 0 0 rgb(45, 55, 72)"]],
  ["per-colour", colours, ["inset 0 2px 0 0 rgb(255, 0, 0)", "inset -2px 0 0 0 rgb(0, 255, 0)", "inset 0 -2px 0 0 rgb(0, 0, 255)", "inset 2px 0 0 0 rgb(255, 255, 0)"]],
]) {
  const n = e ? partOf(e) : null;
  check(`the ${name} box draws its edge on those sides only, each in its own colour`, !!n && (n.edge?.width ?? 0) === 0 && J(inset(n).map((s) => s.trim())) === J(want), J({ id: n?.id, edge: n?.edge }));
  const row = rowOf(name === "top-only" ? "top" : name === "bottom-only" ? "bottom" : name === "mixed-width" ? "mixed" : "colours");
  check(`…and what it holds is as wide as on the page (${row?.w}px)`, !!n && !!row && Math.abs(holds(n) - row.w) < 0.5, J({ holds: holds(n), row: row?.w, pad: n?.pad }));
}
const rn = round ? partOf(round) : null;
check("control: one edge all round is drawn as the part's edge", rn?.edge?.width === 2 && rn?.edge?.style === "solid" && !inset(rn).length, J(rn?.edge));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
