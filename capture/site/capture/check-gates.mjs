/**
 * A TERMS GATE IS AGREED TO, NOT CAPTURED AS THE PAGE.
 *
 * stonkfun.xyz opens on a "Website Terms of Use" dialog over everything:
 * a box to tick ("I have read and agree…") and an Accept button that does
 * nothing until it is ticked. A capture of that page was a capture of the
 * dialog. `--agree` knew one gate only, SOLCINERATOR's "AGREE AND CLOSE".
 * Stand-in pages hold both kinds:
 *
 *   (1) a dialog with a box to tick and an Accept that waits for it;
 *   (2) SOLCINERATOR's one button, "AGREE AND CLOSE".
 *
 * With `--agree` the dialog's words are not in the capture and the page's
 * are; without it the dialog is captured as it stands. capture-site passes
 * `--agree` unless `--no-agree`, so the Builder's "Capture a site" gets it.
 *
 *   (3) `--hide-gate` (the owner, 2026-09-29: "don't accept it for me, just
 *       hide it"): nothing is ticked or pressed; the dialog and the veil it
 *       sits in are hidden in the capture's own browser and the page's
 *       scrolling is unlocked, so the page is read as it stands behind it.
 *
 *   node capture/site/capture/check-gates.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { plan } from "./capture-site.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const TERMS = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in gate</title>
<style>html.locked,html.locked body{overflow:hidden}body{margin:0;font:16px sans-serif}.veil{position:fixed;inset:0;background:rgba(0,0,0,.7);display:grid;place-items:center}
.box{background:#fff;width:500px;padding:20px}</style></head><body>
<main><h1>Launch coins with anything</h1></main>
<div class="veil" role="dialog" aria-modal="true"><div class="box"><h2>Website Terms of Use</h2><p>THESE TERMS INCLUDE A WAIVER</p>
<label><input type="checkbox" id="ok"> I have read and agree to the Website Terms of Use.</label>
<button id="no">Decline</button><button id="yes" disabled>Accept</button></div></div>
<div style="height:2000px">long page</div>
<script>document.documentElement.classList.add("locked");window.agreed=false;ok.onchange=()=>{yes.disabled=!ok.checked};yes.onclick=()=>{if(ok.checked){document.querySelector(".veil").remove();document.documentElement.classList.remove("locked");document.body.dataset.agreed="yes"}};no.onclick=()=>{document.body.textContent="declined"}</script>
</body></html>`;
const ONE = `<!doctype html><html><head><meta charset="utf-8"></head><body><main><h1>Incinerate</h1></main>
<div id="d" style="position:fixed;inset:0;background:#000;color:#fff"><p>DISCLAIMER words</p><button onclick="d.remove()">AGREE AND CLOSE</button></div></body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" || req.url === "/one" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? TERMS : req.url === "/one" ? ONE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-gates-"));
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const take = (path, out, extra) => new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), origin + path, join(work, out), "--width", "1000", "--height", "600", "--assets", join(work, "src"), "--settle", "1", ...extra], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err, text: existsSync(join(work, out)) ? readFileSync(join(work, out), "utf8") : "" }));
});

const agreed = await take("/", "agreed.json", ["--agree"]);
const plain = await take("/", "plain.json", []);
const one = await take("/one", "one.json", ["--agree"]);
const hidden = await take("/", "hidden.json", ["--hide-gate"]);
server.close();
check("(1) with --agree, the box is ticked and Accept pressed: the dialog is not in the capture", agreed.status === 0 && !agreed.text.includes("Website Terms of Use") && !agreed.text.includes("declined"), agreed.err.trim().split("\n").pop());
check("(1) …and the page under it is", agreed.text.includes("Launch coins with anything"));
check("(1) without --agree the dialog is captured as it stands", plain.status === 0 && plain.text.includes("Website Terms of Use"));
check("(2) SOLCINERATOR's AGREE AND CLOSE is still pressed", one.status === 0 && !one.text.includes("DISCLAIMER words") && one.text.includes("Incinerate"), one.err.trim().split("\n").pop());
check("(3) with --hide-gate the dialog is not in the capture, and the page under it is", hidden.status === 0 && !hidden.text.includes("Website Terms of Use") && hidden.text.includes("Launch coins with anything"), hidden.err.trim().split("\n").pop());
check("(3) …nothing was agreed to: Accept was never pressed", hidden.text && !/"agreed"|data-agreed|agreed=yes/.test(hidden.text) && !hidden.text.includes("declined"));
check("(3) …and the whole page was read, its scrolling unlocked", (() => { try { return JSON.parse(hidden.text).page[1] >= 2000; } catch { return false; } })(), (() => { try { return JSON.stringify(JSON.parse(hidden.text).page); } catch { return "no capture"; } })());
check("(3) capture-site passes --hide-gate in place of --agree when asked", (() => { const q = plan({ url: "https://example.com/", name: "example", pages: "/", root: work, gate: "hide" }); return q.captures[0].args.includes("--hide-gate") && !q.captures[0].args.includes("--agree"); })());
const pl = plan({ url: "https://example.com/", name: "example", pages: "/", root: work });
check("a site captured by capture-site agrees unless told not to", pl.captures[0].args.includes("--agree") && !plan({ url: "https://example.com/", name: "example", pages: "/", root: work, agree: false }).captures[0].args.includes("--agree"));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
