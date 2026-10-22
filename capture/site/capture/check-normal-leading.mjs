/**
 * A LINE SET AT `line-height: normal` KEEPS ITS REAL LINE HEIGHT, from
 * thesolface.site's labels (solface-fidelity).
 *
 * `normal` gives no number, so a part's `font.leading` came from the box of
 * its words when they stood on one line, and not at all on a block of
 * several: the Builder fell back to 1.55 and drew every line too far apart.
 * The dump now reads the pitch of the lines the browser drew (`nlh`: the
 * distance between two lines of the element's own words, else the height of
 * its one line) and the converter writes `font.leading` from it.
 *
 * A stand-in page has, all at `line-height: normal`:
 *   (1) a paragraph of five lines (Arial 20px, 300px wide);
 *   (2) a one-line label (Courier 13px);
 * and
 *   (3) a heading with an explicit `line-height: 1.1` (its number must stay 1.1).
 *
 *   node capture/site/capture/check-normal-leading.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { launch } from "./tools/browser.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-normal-leading-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:30px;background:#fff;color:#111}
  p.long{font:20px/normal Arial,sans-serif;width:300px;margin:0 0 30px}
  .label{font:13px/normal "Courier New",monospace;margin:0 0 30px}
  h2{font:700 30px/1.1 Arial,sans-serif;margin:0}
</style></head><body>
<p class="long">STANDIN words that go on for five lines of this paragraph so that the browser has to break them again and again across its width, one after another, line after line.</p>
<div class="label">STANDIN LABEL</div>
<h2>STANDIN HEADING</h2>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

/* What the browser drew: the pitch of the paragraph's lines, and the label's line. */
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`http://127.0.0.1:${port}/`);
const drawn = await page.evaluate(() => {
  const tops = (el) => { const r = document.createRange(); r.selectNodeContents(el); return [...new Set(Array.from(r.getClientRects()).map((q) => Math.round(q.top * 100) / 100))].sort((a, b) => a - b); };
  const t = tops(document.querySelector("p.long"));
  return { lines: t.length, pitch: t.length > 1 ? (t[t.length - 1] - t[0]) / (t.length - 1) : 0, label: document.querySelector(".label").getBoundingClientRect().height };
});
await browser.close();

const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [800, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "800", "--height", "600", "--assets", assets, "--settle", "2"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const J = (x) => JSON.stringify(x);
const text = (n) => (Array.isArray(n.content) ? n.content.map((r) => r.text).join("") : String(n.content ?? ""));
const part = (re) => doc.nodes.find((n) => re.test(text(n)));
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const para = part(/five lines/), label = part(/STANDIN LABEL/), head = part(/STANDIN HEADING/);
check("(0) the stand-in paragraph is drawn on several lines", drawn.lines >= 4, J(drawn));
check("(1) the five-line paragraph at `normal` has font.leading = its line pitch / its size", para && near(para.font?.leading, drawn.pitch / 20, 0.02), J({ leading: para?.font?.leading, font: para?.font, expect: drawn.pitch / 20, found: !!para }));
check("(2) the one-line label at `normal` has font.leading = its line / its size", label && near(label.font?.leading, drawn.label / 13, 0.06), J({ leading: label?.font?.leading, expect: drawn.label / 13 }));
check("(3) the explicit line-height 1.1 stays 1.1", head && near(head.font?.leading, 1.1, 0.005), J(head?.font));
/* (4) And `normal` is said so: a normal line is the reader's own face's, and the number alone froze this machine's into every board (theme.ts#lineOf). */
check("(4) a line at `normal` is marked font.leadingNormal, the number kept beside it", para?.font?.leadingNormal === true && label?.font?.leadingNormal === true && typeof para?.font?.leading === "number", J({ para: para?.font, label: label?.font }));
check("…and an explicit number is not", head && head.font?.leadingNormal === undefined, J(head?.font));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 400)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
