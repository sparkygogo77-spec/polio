/**
 * THE TABLET AND PHONE ARE PART OF EVERY CAPTURE (capture-widths.mjs wired
 * into capture-site.mjs), from thesolface.site.
 *
 * The workflow runs capture-site.mjs, which captured each page at 1440 and
 * converted it; capture-widths.mjs (the site's own layout at 834 and 390)
 * was only ever run by hand, so a captured site had no `layouts` and the
 * Builder worked its phone and tablet out for itself, though thesolface has
 * four breakpoints of its own (1230, 1050, 780, 560).
 *
 *   (1) the plan names a widths step after the page captures, on this run's
 *       routes file, with the gate hidden when the run hides it;
 *   (2) `widths: false` (`--no-widths`) leaves it out;
 *   (3) a Look-only run (no presses) against a stand-in site leaves widths/page_home.834.json and
 *       .390.json, and the document it converts carries `layouts` for both.
 *
 *   node capture/site/capture/check-widths-wired.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { plan, run } from "./capture-site.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const root = mkdtempSync(join(tmpdir(), "widths-wired-"));
const p = plan({ url: "https://example.com/", name: "example", pages: "/, /docs", root, gate: "hide" });
const w = p.widths;
check("(1) the plan has a widths step on the run's routes file", !!w && w.args[0].endsWith("capture-widths.mjs") && w.args.includes(p.routesFile), JSON.stringify(w));
check("(1) …the gate hidden as the captures hide it", !!w && w.args.includes("--hide-gate"));
check("(2) widths: false leaves it out", plan({ url: "https://example.com/", name: "example", root, widths: false }).widths == null);

const PAGE = `<!doctype html><meta charset="utf-8"><title>Stand-in widths</title>
<style>body{margin:0;font:16px sans-serif}main{padding:24px}.aside{float:right;width:200px}h1{font-size:48px;margin:0}
@media(max-width:780px){.aside{display:none}h1{font-size:30px}}</style>
<main><h1>STANDIN heading</h1><p>STANDIN words</p><div class="aside">STANDIN aside</div></main>`;
/* Served from a process of its own: run() waits on its children (spawnSync), which would never be answered by a server in this one. */
const server = spawn(process.execPath, ["-e", `require("http").createServer((q, s) => { s.writeHead(q.url.startsWith("/api/") ? 404 : 200, { "content-type": "text/html" }); s.end(${JSON.stringify(PAGE)}); }).listen(0, "127.0.0.1", function () { console.log(this.address().port); });`], { stdio: ["ignore", "pipe", "inherit"] });
const port = await new Promise((r) => server.stdout.once("data", (d) => r(Number(String(d).trim()))));
const origin = `http://127.0.0.1:${port}`;
const env = process.env;
for (const k of Object.keys(env)) if (/^(https?|all)_proxy$/i.test(k)) delete env[k];

const q = plan({ url: `${origin}/`, name: "standin", pages: "/", root, behaviours: false, states: false, network: false, jobs: 1 });
const failed = run(q);
server.kill();
const widthsDir = join(q.captureDir, "widths");
check("(3) the run succeeded", failed === 0, `failed ${failed}`);
check("(3) widths/page_home.834.json and .390.json written", existsSync(join(widthsDir, "page_home.834.json")) && existsSync(join(widthsDir, "page_home.390.json")));
/* The run above presses nothing (states: false: Look only): the widths are matched to the desktop parts by their paths, so those must be written without the presses pass. */
const readW = (w) => { try { return JSON.parse(readFileSync(join(widthsDir, `page_home.${w}.json`), "utf8")); } catch { return null; } };
const w390 = readW(390), w834 = readW(834);
check("(3) a Look-only run still places parts at 834 and 390 (paths written without --states)", !!w390 && !!w834 && Object.keys(w390.parts).length >= 3 && Object.keys(w834.parts).length >= 3, JSON.stringify({ at390: w390 && Object.keys(w390.parts).length, at834: w834 && Object.keys(w834.parts).length }));
const docFile = join(q.outDir, "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : {};
check("(3) the document carries layouts at 834 and 390", !!doc.layouts && JSON.stringify(doc.capturedWidths ?? []).includes("834") && JSON.stringify(doc.capturedWidths ?? []).includes("390"), JSON.stringify(doc.capturedWidths));
rmSync(root, { recursive: true, force: true });

const bad = results.filter((r) => !r).length;
console.log(bad ? `\n${bad} FAILED` : `\nall ${results.length} ok`);
process.exit(bad ? 1 : 0);
