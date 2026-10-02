/**
 * A SEARCH BOX SHOWS ITS PLACEHOLDER, AND ITS ICON STAYS INSIDE IT.
 *
 * stonkfun.xyz's search: a 384 × 44 field with "Search name, ticker, or
 * contract address" in grey, and a magnifier placed `top: 50%; translate: 0
 * -50%` (Tailwind's own translate property) 14px in from the left. The
 * capture read the -50% as -50px, so the icon stood below the box, and kept
 * the placeholder only as a note, so the box was empty. A translate in % is
 * of the element's own box; an empty field shows its placeholder, in the
 * placeholder's colour, in the middle of its height.
 *
 *   node capture/site/capture/check-search-box.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26, timeout: 300000 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-search-box-"));
const ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='7' cy='7' r='5' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E\")";
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:40px;background:#07131a;font:14px sans-serif}
  label{position:relative;display:block;width:384px}
  .ico{position:absolute;left:14px;top:50%;translate:0 -50%;width:16px;height:16px;background:rgb(118, 138, 147);mask:${ICON} center/100% no-repeat;-webkit-mask:${ICON} center/100% no-repeat}
  input{box-sizing:border-box;width:100%;height:44px;padding:0 40px;border:1px solid rgb(105, 170, 193);border-radius:8px;background:rgb(11, 23, 27);color:rgb(243, 248, 248);font:14px/20px sans-serif}
  input::placeholder{color:rgb(118, 138, 147)}
</style></head><body>
<label><span class="ico"></span><input type="text" placeholder="Search name, ticker, or contract address"></label>
<p style="height:20px"></p>
<label><input type="text" value="STONK"></label>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* no document */ }
const field = doc.nodes.find((n) => /label(:nth-of-type\(1\))? > input$/.test(n.from?.selector ?? ""));
const icon = doc.nodes.find((n) => /span$/.test(n.from?.selector ?? ""));
/* Where the icon is drawn: its box moved by its own transform (art.transform, about its centre). */
const dy = (() => { const m = /matrix\(([^)]+)\)/.exec(icon?.art?.transform ?? ""); return m ? Number(m[1].split(",")[5]) : 0; })();
const iconMid = icon ? icon.y + dy + icon.h / 2 : NaN, fieldMid = field ? field.y + field.h / 2 : NaN;
check("the icon is drawn inside the box, in the middle of its height", icon && field && Math.abs(iconMid - fieldMid) <= 1, J({ icon: icon && [icon.y, icon.h, icon.art?.transform], field: field && [field.y, field.h] }));
check("the empty field shows its placeholder", field?.content === "Search name, ticker, or contract address", J(field && field.content));
check("…in the placeholder's colour", field?.colour?.text === "rgb(118, 138, 147)", J(field?.colour));
const padT = field?.pad?.top ?? 0, padB = field?.pad?.bottom ?? 0;
check("…in the middle of its height (padding round a 20px line)", field && Math.abs(padT - padB) <= 1 && Math.abs(padT + padB + 20 + 2 - field.h) <= 2, J(field && field.pad));
const filled = doc.nodes.find((n) => n.content === "STONK");
check("control: a field with a value shows its value, not the placeholder", filled && filled.colour?.text === "rgb(243, 248, 248)", J(filled && [filled.content, filled.colour]));
for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
