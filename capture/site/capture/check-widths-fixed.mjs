#!/usr/bin/env node
/**
 * WHAT IS FIXED TO THE WINDOW, READ WHERE THE WINDOW SHOWS IT (capture-widths).
 *
 * thesolface.site at 390: its page scrolls smoothly (`scroll-behavior:
 * smooth`), so the sweep's return to the top was still on its way when the
 * width was read (scrollY about 749), and the read put every part at its
 * box's top plus scrollY, fixed ones too. The fixed header was recorded at
 * y 756 instead of 7 and drawn mid-hero on the phone; the fixed progress bar
 * at 749; and "Skip to content", fixed 90 px above the window until it has
 * the focus, counted as shown at 659.
 *
 * A stand-in page (all STANDIN), 20 000 px tall, scrolling smoothly, with a
 * fixed header at the top of the window, a part inside it, and a skip link
 * fixed above the window. Captured at 1440, read at 390:
 *   (1) the header's box at 390 is at the top of the page (y 0);
 *   (2) the part inside it too (y under 60);
 *   (3) the skip link, fixed wholly outside the window, is hidden there;
 *   (4) a part in the page's flow far down keeps its place (y 5000).
 *
 *   node capture/site/capture/check-widths-fixed.mjs
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

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STANDIN fixed</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font:16px sans-serif}
header{position:fixed;top:0;left:0;right:0;height:60px;background:#123;color:#fff;z-index:5}header b{display:block;padding:18px 20px}
.skip{position:fixed;top:-90px;left:12px;padding:12px;background:#4f8;color:#000}.skip:focus{top:12px}
main{height:20000px;padding-top:80px}#far{position:absolute;top:5000px;left:20px;width:200px;height:40px;background:#eef}
</style></head><body>
<a class="skip" href="#far">STANDIN skip to content</a>
<header><b>STANDIN header</b></header>
<main><p>STANDIN top words</p><div id="far">STANDIN far down</div></main>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (a) => new Promise((resolve) => { const p = spawn(process.execPath, a, { stdio: ["ignore", "pipe", "pipe"], env }); let err = "", out = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", (d) => (out += d)); p.on("close", (status) => resolve({ status, err, out })); });

const work = mkdtempSync(join(tmpdir(), "widths-fixed-"));
mkdirSync(join(work, "routes"), { recursive: true });
writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1440, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const desk = await run([join(here, "capture-route.mjs"), `${origin}/`, join(work, "routes", "page_home.json"), "--width", "1440", "--height", "900", "--settle", "1", "--frames", "0", "--states", "--assets", join(work, "source")]);
const wid = await run([join(here, "capture-widths.mjs"), join(work, "routes.json"), "--settle", "1", "--widths", "390x844"]);
server.close();
if (process.env.DEBUG) console.log(desk.err, wid.err);
check("captured at 1440 and read at 390", desk.status === 0 && wid.status === 0, (desk.err + wid.err).trim().split("\n").slice(-4).join(" | "));

const ph = existsSync(join(work, "widths", "page_home.390.json")) ? JSON.parse(readFileSync(join(work, "widths", "page_home.390.json"), "utf8")) : { parts: {}, hidden: [] };
const cap = JSON.parse(readFileSync(join(work, "routes", "page_home.json"), "utf8"));
const pathOf = new Map(); (function walk(e) { if (e?.p && e.text) pathOf.set(e.text.trim(), e.p); for (const k of e?.kids ?? []) walk(k); })(cap.tree);
const p = (words) => pathOf.get(words) ?? [...pathOf].find(([w]) => w.includes(words))?.[1];
const box = (words) => ph.parts[p(words)] ?? null;
const headerP = p("STANDIN header")?.split(">").slice(0, -1).join(">");
check("(1) the fixed header's box at 390 is at the top of the page", !!ph.parts[headerP] && ph.parts[headerP][1] === 0, J({ headerP, box: ph.parts[headerP] }));
check("(2) the part inside it too", !!box("STANDIN header") && box("STANDIN header")[1] < 60, J(box("STANDIN header")));
check("(3) the skip link, fixed above the window, is hidden at 390", !!p("STANDIN skip to content") && ph.hidden.includes(p("STANDIN skip to content")), J({ p: p("STANDIN skip to content"), box: box("STANDIN skip to content") }));
check("(4) a part in the flow far down keeps its place (y 5000)", box("STANDIN far down")?.[1] === 5000, J(box("STANDIN far down")));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
