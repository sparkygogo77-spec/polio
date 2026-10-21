#!/usr/bin/env node
/**
 * WHAT A SMALL WIDTH CHANGES, CARRIED ONTO THE PART (converter, `widths`).
 *
 * capture-widths.mjs reads, at each small width, each part's box AND its
 * words' type size; the converter put the box on the part
 * (`widths.phone = { x, y, w, h }`) and left the size in `layouts` only, so
 * the Builder, which reads `widths.<device>.px` (live/small.ts, smallCss.ts),
 * drew a 48 px heading at 48 on a phone where the site sets it at 30. And
 * only a width of exactly 834 or 390 reached a part: read at 768 (a common
 * tablet), it was filed as `w768` and the Builder never saw it.
 *
 * A stand-in page (all STANDIN), captured at 1440 and read at 768 and 390:
 *   (1) the heading's `widths.phone.px` is 30 (the site's phone size), and a
 *       part whose type does not change carries its own size too;
 *   (2) a part with no words of its own carries no `px`;
 *   (3) read at 768, the parts carry `widths.tablet` (a width from 600 to
 *       1023 is the tablet), x and w scaled to the Builder's 834 frame, and
 *       `layouts.tablet.width` says 768 was what was read;
 *   (4) `capturedWidths` lists what was read: 1440, 768, 390.
 *
 *   node capture/site/capture/check-widths-carry.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`); };
const J = (x) => JSON.stringify(x);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STANDIN carry</title><style>
*{box-sizing:border-box}body{margin:0;font:16px sans-serif}
h1{font-size:48px;margin:20px}p{margin:20px}
.row{display:flex;gap:20px;padding:20px}.row div{flex:1;height:120px;background:#eef}
@media (max-width:599px){h1{font-size:30px}.row{flex-direction:column}}
</style></head><body>
<h1>STANDIN heading</h1>
<p>STANDIN words that keep their size</p>
<div class="row"><div></div><div></div></div>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (a) => new Promise((resolve) => { const p = spawn(process.execPath, a, { stdio: ["ignore", "pipe", "pipe"], env }); let err = "", out = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", (d) => (out += d)); p.on("close", (status) => resolve({ status, err, out })); });

const work = mkdtempSync(join(tmpdir(), "widths-carry-"));
mkdirSync(join(work, "routes"), { recursive: true });
writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1440, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const desk = await run([join(here, "capture-route.mjs"), `${origin}/`, join(work, "routes", "page_home.json"), "--width", "1440", "--height", "900", "--settle", "1", "--frames", "0", "--states", "--assets", join(work, "source")]);
const wid = await run([join(here, "capture-widths.mjs"), join(work, "routes.json"), "--settle", "1", "--widths", "768x1024,390x844"]);
const conv = await run([join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", join(work, "source")]);
server.close();
if (process.env.DEBUG) console.log(desk.err, wid.err, conv.err);
check("captured at 1440, read at 768 and 390, converted", desk.status === 0 && wid.status === 0 && conv.status === 0, (desk.err + wid.err + conv.err).trim().split("\n").slice(-4).join(" | "));

const doc = existsSync(join(work, "out", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "out", "site", "document.json"), "utf8")) : { nodes: [] };
const parts = doc.nodes.filter((n) => n.pageId === "page_home");
const said = (re) => parts.find((n) => re.test(JSON.stringify(n.content ?? "")));
const h1 = said(/STANDIN heading/), p = said(/keep their size/);
check("(1) the heading carries its phone size, 30 px; words that keep their size carry 16", h1?.widths?.phone?.px === 30 && p?.widths?.phone?.px === 16, J({ h1: h1?.widths, p: p?.widths?.phone }));
const wordless = parts.filter((n) => n.widths?.phone && !n.widths.phone.hidden && !String(n.content ?? "").trim());
check("(2) a part with no words of its own carries no px", wordless.length > 0 && wordless.every((n) => n.widths.phone.px == null), J(wordless.map((n) => [n.id, n.widths.phone])));
const tab = parts.filter((n) => n.widths?.tablet && !n.widths.tablet.hidden);
const raw = existsSync(join(work, "widths", "page_home.768.json")) ? JSON.parse(readFileSync(join(work, "widths", "page_home.768.json"), "utf8")) : { parts: {} };
const rawH1 = raw.parts["body>h1:1"];
check("(3) read at 768, the parts carry widths.tablet, x and w scaled to the 834 frame; layouts.tablet says 768", tab.length * 2 >= parts.length && doc.layouts?.tablet?.width === 768 && !!rawH1 && Math.abs(h1.widths.tablet.w - Math.round(rawH1[2] * 834 / 768)) <= 1 && h1.widths.tablet.y === rawH1[1], J({ tablet: tab.length, of: parts.length, layouts: doc.layouts && Object.keys(doc.layouts), raw: rawH1, carried: h1?.widths?.tablet }));
check("(4) capturedWidths lists 1440, 768, 390", J(doc.capturedWidths) === J([1440, 768, 390]), J(doc.capturedWidths));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
