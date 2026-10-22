#!/usr/bin/env node
/**
 * A LONG LIST CUT ON THE DESKTOP IS CUT THE SAME AT EVERY WIDTH, from sunkcoin.fun.
 *
 * A long list is the backend's data, not the design (the owner, 2026-09-29),
 * so the desktop capture keeps a little more than one window of it
 * (`list-trim.js`): sunkcoin's roster table, 60 rows, kept 29, and the page
 * laid out at what was kept. The tablet and phone reads (`capture-widths.mjs`)
 * loaded the page without that trim, so their boxes were the whole 60-row
 * table (2296 tall) and everything under it sat where the 60 rows put it,
 * while the document held 29 rows: on a tablet or a phone the table showed a
 * thousand pixels of empty rows, and the desktop and the small widths were two
 * different pages.
 *
 * Now the small widths keep exactly the rows the desktop kept, list by list,
 * and no other list is cut.
 *
 * A stand-in page: a list of 60 rows, a short list of 5, a footer.
 *   (1) the desktop keeps part of the long list (the trim, unchanged);
 *   (2) at 390 the long list is as tall as the rows the desktop kept;
 *   (3) …every kept row has a box at 390, none hidden;
 *   (4) …and the footer stands under them, not under 60;
 *   (5) control: the short list keeps all 5 rows at 390.
 *
 *   node capture/site/capture/check-widths-trim.mjs
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

const rows = (n, w) => Array.from({ length: n }, (_, i) => `<li>STANDIN ${w} row ${i + 1}</li>`).join("");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STANDIN trim</title><style>
*{box-sizing:border-box}body{margin:0;font:16px/20px sans-serif}
ul{list-style:none;margin:0 20px;padding:0}li{height:40px;padding:10px;border-bottom:1px solid #ccc}
.few{margin-top:40px}footer{height:120px;background:#eee;margin-top:40px}
@media (max-width:599px){li{height:48px}}
</style></head><body>
<ul class="many">${rows(60, "long")}</ul>
<ul class="few">${rows(5, "short")}</ul>
<footer>STANDIN footer</footer>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (a) => new Promise((resolve) => { const p = spawn(process.execPath, a, { stdio: ["ignore", "pipe", "pipe"], env }); let err = "", out = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", (d) => (out += d)); p.on("close", (status) => resolve({ status, err, out })); });

const work = mkdtempSync(join(tmpdir(), "widths-trim-"));
mkdirSync(join(work, "routes"), { recursive: true });
writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1440, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const desk = await run([join(here, "capture-route.mjs"), `${origin}/`, join(work, "routes", "page_home.json"), "--width", "1440", "--height", "900", "--settle", "1", "--frames", "0", "--paths", "--assets", join(work, "source")]);
const wid = await run([join(here, "capture-widths.mjs"), join(work, "routes.json"), "--settle", "1", "--widths", "390x844"]);
const conv = await run([join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", join(work, "source")]);
server.close();
if (process.env.DEBUG) console.log(desk.err, wid.err, conv.err);
check("captured at 1440, read at 390, converted", desk.status === 0 && wid.status === 0 && conv.status === 0, (desk.err + wid.err + conv.err).trim().split("\n").slice(-4).join(" | "));

const doc = existsSync(join(work, "out", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "out", "site", "document.json"), "utf8")) : { nodes: [] };
const text = (n) => (Array.isArray(n.content) ? n.content.map((r) => r.text).join("") : String(n.content ?? ""));
const kept = doc.nodes.filter((n) => /^STANDIN long row/.test(text(n)));
const short = doc.nodes.filter((n) => /^STANDIN short row/.test(text(n)));
const list = doc.nodes.find((n) => /ul(:nth-of-type\(1\))?$/.test(n.from?.selector ?? "") && n.w > 500);
const foot = doc.nodes.find((n) => /footer$/.test(n.from?.selector ?? ""));
check("(1) the desktop keeps part of the long list", kept.length > 5 && kept.length < 60, `${kept.length} rows kept`);
const phoneRows = kept.map((n) => n.widths?.phone).filter((b) => b && !b.hidden);
check("(3) every kept row has a box at 390, none hidden", phoneRows.length === kept.length, `${phoneRows.length} of ${kept.length}`);
check("(2) at 390 the long list is as tall as the rows the desktop kept", !!list?.widths?.phone && Math.abs(list.widths.phone.h - kept.length * 48) <= 2, J({ list: list?.widths?.phone, kept: kept.length, want: kept.length * 48 }));
const lastShort = short.map((n) => n.widths?.phone).filter(Boolean).sort((a, b) => b.y - a.y)[0];
check("(4) …and the footer stands under them, not under 60", !!foot?.widths?.phone && !!lastShort && Math.abs(foot.widths.phone.y - (lastShort.y + lastShort.h + 40)) <= 2 && foot.widths.phone.y < 60 * 48, J({ foot: foot?.widths?.phone, lastShort }));
check("(5) control: the short list keeps all 5 rows at 390", short.length === 5 && short.every((n) => n.widths?.phone && !n.widths.phone.hidden), `${short.filter((n) => n.widths?.phone && !n.widths.phone.hidden).length} of ${short.length}`);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
