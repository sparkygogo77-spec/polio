#!/usr/bin/env node
/**
 * A LOADER WAITED OUT.
 *
 * A stand-in page (all STANDIN data) that shows a full-window spinner that
 * loops forever (no control in it, few words) for 3.5 s on every load, and
 * only then puts its content in: a heading, a price that ticks every 700 ms
 * (live data) and a range's 24h / 7d tabs that redraw a chart (stonkfun.xyz's
 * home and revenue). Captured with its presses. Held:
 *   (1) the page as captured is its content, not the spinner;
 *   (2) the 7d tab is a state, its own mark and its chart, though the price
 *       ticks on its own throughout;
 *   (3) the run says it waited for the loader.
 *
 *   node capture/site/capture/check-loader.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 500)}`}`); };
const J = (x) => JSON.stringify(x);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN loader</title><style>
body{margin:0;font:15px sans-serif}#spin{position:fixed;inset:0;background:#111;display:grid;place-items:center;z-index:9}
#spin i{width:40px;height:40px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;animation:r 1s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}[role=tab][aria-selected=true]{background:#333;color:#fff}.bar{display:inline-block;width:20px;background:#69c;margin:2px}
</style></head><body><div id="spin"><i></i></div><div id="app"></div>
<script>
setTimeout(() => {
  app.innerHTML = '<h1>STANDIN revenue</h1><p>STANDIN price <b id="px">1.000</b></p><div role="tablist"><button type="button" role="tab" aria-selected="true" data-r="24h">24h</button><button type="button" role="tab" aria-selected="false" data-r="7d">7d</button></div><div id="chart"></div>';
  const draw = (r) => { chart.innerHTML = (r === "24h" ? [3, 5, 2, 6] : [8, 1, 7, 4, 9, 2, 5]).map((h) => '<span class="bar" style="height:' + h * 8 + 'px"></span>').join(""); };
  draw("24h");
  document.querySelector("[role=tablist]").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (!b) return; document.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); draw(b.dataset.r); });
  setInterval(() => { px.textContent = (1 + Math.random()).toFixed(3); }, 700);
  spin.remove();
}, 3500);
</script></body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const work = mkdtempSync(join(tmpdir(), "capture-loader-"));
mkdirSync(join(work, "routes"), { recursive: true });
const out = join(work, "routes", "page_home.json");
const run = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, out, "--width", "1000", "--height", "700", "--settle", "8", "--frames", "0", "--states"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
if (process.env.DEBUG) console.log(run.err);
const cap = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
const words = (n, acc = []) => { if (!n) return acc; if (n.text) acc.push(n.text); for (const k of n.kids ?? []) words(k, acc); return acc; };
const all = words(cap.tree).join(" ");
check("the capture was taken", run.status === 0, run.err.trim().split("\n").slice(-3).join(" | "));
check("(1) the page as captured is its content, not the spinner", /STANDIN revenue/.test(all) && /24h/.test(all), all.slice(0, 200));
const st = (cap.states ?? []).find((s) => s.name === "7d");
check("(2) the 7d tab is a state (its mark and its chart), the ticking price no part of it", !!st && st.changes.some((c) => /chart|span/.test(c.at) || /div:\d+$/.test(c.at)) && !st.changes.some((c) => /b:1$/.test(c.at)), J({ states: (cap.states ?? []).map((s) => s.name), at: st?.changes.map((c) => c.at) }));
check("(3) the run says it waited for the loader", /loader: waited/.test(run.err), run.err.split("\n").slice(0, 4).join(" | "));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
