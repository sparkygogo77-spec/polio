/**
 * An icon keeps every stroke it was drawn with, and a card keeps its glow.
 *
 * A stand-in page draws the two icons the Builder found broken, the way an
 * icon set draws them: a "$" as a vertical `<line>` and an S `<path>`, and a
 * trash can as a body `<path>`, a lid `<line>`, a handle `<rect>` with
 * rounded corners, and two `<line>`s inside it. Beside them, a circle, an
 * ellipse, a polyline and a polygon, and a card with a faint green
 * `box-shadow`. It is captured the way every page is (`capture-route.mjs`)
 * and converted; every shape must reach the icon's `vector`, with its
 * stroke's cap and join recorded, and the card must carry its shadow.
 *
 * Also held: the committed captures, which have no shadow and were taken
 * before straight lines were kept, still convert to the committed document
 * byte for byte.
 *
 *   node capture/site/capture/check-strokes.mjs
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
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const SVG = `xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in icons</title>
<style>body{background:#0a0e1a;color:#0f0;margin:0;padding:24px;font:16px monospace} .card{margin-top:24px;width:240px;height:80px;background:#151922;border:1px solid #0f03;box-shadow:0 0 12px rgba(0,255,0,0.15)} button{background:none;border:0;color:#0f0;padding:4px}</style></head>
<body>
  <button id="dollar" aria-label="Price"><svg ${SVG}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></button>
  <button id="trash" aria-label="Burn"><svg ${SVG}><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><line x1="3" x2="21" y1="6" y2="6"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
  <button id="shapes" aria-label="Shapes"><svg ${SVG}><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="6"/><polyline points="2 20 8 14 12 18"/><polygon points="16 2 22 2 19 7"/></svg></button>
  <div class="card"><span>glow</span></div>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "strokes-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
/* The page is on this machine: no proxy between the browser and it. */
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "800", "--height", "400"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
const cap = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : { tree: { kids: [] } };

writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [800, 400], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out")], { encoding: "utf8" });
check("…and converted", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };

/* The capture */
const all = [];
(function walk(e) { all.push(e); (e.kids ?? []).forEach(walk); })(cap.tree);
const lines = all.filter((e) => e.t === "line");
check("every <line> is in the capture, though a straight line's box has no width or no height", lines.length === 4, `${lines.length} of 4`);
check("…each with its geometry", lines.length > 0 && lines.every((l) => /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/.test(l.d ?? "")), lines.map((l) => l.d).join(" | "));
check("…and its stroke's cap and join", lines.length > 0 && lines.every((l) => l.cap === "round" && l.join === "round" && l.sw === 2), JSON.stringify(lines.map((l) => [l.cap, l.join, l.sw])));
const tags = new Set(all.filter((e) => e.d).map((e) => e.t));
check("a path, line, rect, circle, ellipse, polyline and polygon are all captured with their geometry", ["path", "line", "rect", "circle", "ellipse", "polyline", "polygon"].every((t) => tags.has(t)), [...tags].join(", "));
const rect = all.find((e) => e.t === "rect");
check("a rect with rounded corners is drawn rounded", /a1 1 0 0 1/.test(rect?.d ?? ""), rect?.d);
const card = all.find((e) => e.t === "div" && (e.kids ?? []).some((k) => k.text === "glow"));
check("the card's box-shadow is in the capture", card?.shadow === "rgba(0, 255, 0, 0.15) 0px 0px 12px 0px", card?.shadow);

/* The document */
const icon = (label) => doc.nodes.find((n) => n.featureId === "drawn-icon" && n.from?.selector?.includes(`button:nth-of-type(${label})`));
const dollar = icon(1), trash = icon(2), shapes = icon(3);
check("the $ keeps its vertical stroke", !!dollar && dollar.vector.paths.some((p) => p.d === "M12 2L12 22") && dollar.vector.paths.length === 2, JSON.stringify(dollar?.vector?.paths?.map((p) => p.d)));
check("the trash can keeps its lid, its handle and the two lines inside it", !!trash && trash.vector.paths.length === 5 && trash.vector.paths.some((p) => p.d === "M3 6L21 6") && trash.options?.paths === "5", JSON.stringify(trash?.vector?.paths?.map((p) => p.d)));
check("the circle, ellipse, polyline and polygon all reach the icon", shapes?.vector?.paths?.length === 4, String(shapes?.vector?.paths?.length));
const cardNode = doc.nodes.find((n) => card && n.x === card.x && n.y === card.y && n.w === card.w && n.h === card.h);
check("the card part carries its glow, on its edge where polio draws it", cardNode?.edge?.shadow === "rgba(0, 255, 0, 0.15) 0px 0px 12px 0px", String(cardNode?.edge?.shadow));
check("control: a part with no shadow carries none", doc.nodes.filter((n) => n !== cardNode).every((n) => !("shadow" in n) && !n.edge?.shadow));

/* Old captures, unchanged */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
const same = again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8");
check("control: the committed captures convert to the committed document byte for byte", same, again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
