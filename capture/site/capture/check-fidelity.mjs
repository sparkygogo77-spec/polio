/**
 * WHAT SHARE.XYZ SHOWED THE PIPELINE DROPPING (docs/fidelity/share-xyz.md).
 *
 * A stand-in page holds one of each: a sticky header; a card with rounded
 * corners, a transparent border and a box-shadow ring; a tab button whose
 * words sit beside an icon; a tag `<span role="img">` with words and no
 * picture. It is captured the way every page is (`capture-route.mjs`) and
 * converted with a routes file that names no `sections`. Then:
 *
 *   (f) the converter does not crash on a routes file without `sections`;
 *   (a) the card's border-radius is in the capture and reaches `node.radius`;
 *   (b) the card's shadow is written where polio draws it, `edge.shadow`,
 *       and nowhere else;
 *   (c) the header is `from.position: "sticky"` with the inset that stuck it;
 *   (d) the tab's words are not folded into a box that also holds its icon,
 *       so they keep their own place beside it;
 *   (e) the tag is words, never a picture with no picture.
 *
 *   node capture/site/capture/check-fidelity.mjs
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

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in fidelity</title>
<style>
  body{margin:0;font:14px/20px monospace;color:#000;background:#fff}
  header{position:sticky;top:0;height:60px;background:#fff;z-index:20;padding:0 16px}
  main{padding:16px}
  .card{width:300px;height:120px;padding:16px;background:#fff;border:1px solid rgba(0,0,0,0);border-radius:12px;box-shadow:rgb(240,240,240) 0px 0px 0px 1px, rgba(0,0,0,0.05) 0px 2px 6px 0px}
  .tab{display:flex;align-items:center;gap:8px;height:28px;padding:0 10px;border:1px solid #ccc;border-radius:14px;background:#fff;font:inherit}
  .tag{display:inline-block;padding:2px 8px;background:rgb(151,252,228);border-radius:6px}
  .tall{height:1200px}
</style></head>
<body>
  <header><span>Top bar</span></header>
  <main>
    <div class="card"><span>Cardinals vs 49ers</span></div>
    <aside><button class="tab" role="tab"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/></svg>Unified</button></aside>
    <p><span class="tag" role="img" aria-label="Save 71 times">Save 71×</span></p>
    <div class="tall"></div>
  </main>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "fidelity-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
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

/* (f) A routes file that names no sections: a site that is not SOLCINERATOR. */
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [800, 400], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out")], { encoding: "utf8" });
check("(f) a routes file with no `sections` converts without crashing", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };

const all = [];
(function walk(e, parent) { e.parent = parent; all.push(e); (e.kids ?? []).forEach((k) => walk(k, e)); })(cap.tree, null);
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const nodeAt = (e) => doc.nodes.find((n) => e && n.x === e.x && n.y === e.y && n.w === e.w && n.h === e.h);

/* (a) Rounded corners. */
const card = all.find((e) => e.t === "div" && (e.kids ?? []).some((k) => k.text === "Cardinals vs 49ers"));
check("(a) the card's border-radius is in the capture", Array.isArray(card?.radius) && card.radius.every((r) => r === 12), JSON.stringify(card?.radius));
const cardNode = nodeAt(card);
check("(a) …and reaches node.radius", cardNode?.radius === 12, String(cardNode?.radius));
const tab = all.find((e) => e.t === "button");
check("(a) a pill's radius too", Array.isArray(tab?.radius) && tab.radius.every((r) => r === 14), JSON.stringify(tab?.radius));

/* (b) The shadow, where polio draws it. */
check("(b) the card's shadow is written as edge.shadow", typeof cardNode?.edge?.shadow === "string" && cardNode.edge.shadow.startsWith("rgb(240, 240, 240) 0px 0px 0px 1px"), String(cardNode?.edge?.shadow));
check("(b) …and not as node.shadow, which nothing draws", doc.nodes.every((n) => !("shadow" in n)));

/* (c) The sticky header. */
const header = all.find((e) => e.t === "header");
const headerNode = nodeAt(header);
check("(c) the sticky header is from.position sticky with its inset", headerNode?.from?.position === "sticky" && headerNode?.from?.inset?.top === 0, JSON.stringify(headerNode?.from));

/* (d) Words beside an icon keep their own place. */
const icon = doc.nodes.find((n) => n.featureId === "drawn-icon");
const unified = doc.nodes.find((n) => words(n) === "Unified");
check("(d) the tab's own words start after the icon beside them: pad.left is the icon's right edge plus the gap", !!unified && !!icon && unified.x + (unified.pad?.left ?? 0) === icon.x + icon.w + 8, `${unified?.x} + ${unified?.pad?.left} vs ${icon?.x} + ${icon?.w} + 8`);
check("(d) …and the tab keeps its edge and radius", !!unified && unified.edge?.width === 1 && unified.radius === 14, JSON.stringify(unified && [unified.featureId, unified.edge, unified.radius]));

/* (e) A tag with words and no picture is words. */
const tag = doc.nodes.find((n) => words(n) === "Save 71×");
check("(e) the tag is a words part, not a picture", !!tag && tag.featureId !== "picture" && tag.label !== "undefined", JSON.stringify(tag && [tag.featureId, tag.label]));
check("(e) control: no picture part in the document lacks its picture", doc.nodes.filter((n) => n.featureId === "picture").every((n) => n.picture));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
