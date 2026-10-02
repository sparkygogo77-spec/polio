#!/usr/bin/env node
/**
 * A LIVE CHART AND ITS RANGES.
 *
 * A stand-in page (all STANDIN data) whose chart is drawn again every 400 ms
 * with live values (each bar's height and its figure move, its labels carry
 * the clock to the second), beside a price that ticks, under a range's 24h /
 * 7d / 30d / All tabs: each range draws its own number of bars under its
 * own labels (stonkfun.xyz's revenue, share.xyz's
 * event). Captured with its presses, undone in place. Held:
 *   (1) every range is a state, and its state holds the chart as that range
 *       draws it (its bars and labels), not only the tab's own mark;
 *   (2) the live values alone (the price ticking, the bars' heights and
 *       figures moving) are in no state;
 *   (3) every press undone in place.
 *
 *   node capture/site/capture/check-live-chart.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`); };
const J = (x) => JSON.stringify(x);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN live chart</title><style>
body{margin:0;font:15px sans-serif}section{padding:10px}[role=tab][aria-selected=true]{background:#333;color:#fff}
#chart{display:flex;align-items:flex-end;gap:4px;height:160px;border-bottom:1px solid #999}#chart .bar{width:18px;background:#69c;display:flex;flex-direction:column;justify-content:flex-start}#chart .bar small{font-size:9px}
#axis{display:flex;gap:4px}#axis span{width:18px;font-size:9px}
</style></head><body><h1>STANDIN revenue</h1>
<section><p>STANDIN price <b id="px">1.000</b></p></section>
<section><div role="tablist" id="ranges"><button type="button" role="tab" aria-selected="true" data-r="24h">24h</button><button type="button" role="tab" aria-selected="false" data-r="7d">7d</button><button type="button" role="tab" aria-selected="false" data-r="30d">30d</button><button type="button" role="tab" aria-selected="false" data-r="all">All</button></div>
<div id="chart"></div><div id="axis"></div></section>
<section>${Array.from({ length: 12 }, (_, i) => `<p>STANDIN note ${i}</p>`).join("")}</section>
<script>
/* Each range's labels carry the live clock to the second, so they differ from one read to the next, as a chart's dates and times do. */
const RANGES = { "24h": ["", "", "", ""], "7d": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "30d": ["W1", "W2", "W3", "W4", "W5"], all: ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9"] };
let range = "24h";
const draw = () => {
  const now = new Date().toTimeString().slice(0, 8);
  const labels = RANGES[range].map((l, i) => (l ? l + " " : "") + now.slice(0, 6) + String((Number(now.slice(6)) + i) % 60).padStart(2, "0"));
  chart.innerHTML = labels.map(() => { const v = 20 + Math.random() * 120; return '<div class="bar" style="height:' + v.toFixed(0) + 'px"><small>' + v.toFixed(1) + '</small></div>'; }).join("");
  axis.innerHTML = labels.map((l) => "<span>" + l + "</span>").join("");
};
draw();
setInterval(draw, 400);
setInterval(() => { px.textContent = (1 + Math.random()).toFixed(3); }, 300);
ranges.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (!b) return; ranges.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); range = b.dataset.r; draw(); });
</script></body></html>`;

const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const work = mkdtempSync(join(tmpdir(), "capture-live-chart-"));
mkdirSync(join(work, "routes"), { recursive: true });
const out = join(work, "routes", "page_home.json");
const run = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, process.env.ROUTE ?? "capture-route.mjs"), `${origin}/`, out, "--width", "1000", "--height", "800", "--settle", "1", "--frames", "0", "--states"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
if (process.env.DEBUG) console.log(run.err);
const cap = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
const states = cap.states ?? [];
const words = (n, acc = []) => { if (!n) return acc; if (n.text) acc.push(n.text); for (const k of n.kids ?? []) words(k, acc); return acc; };
const holds = (st, re) => st.changes.some((c) => re.test(words(c.el).join(" ")));
check("the capture was taken", run.status === 0, run.err.trim().split("\n").slice(-3).join(" | "));
const want = { "7d": /Mon/, "30d": /W5/, All: /Q9/ };
const got = Object.fromEntries(Object.keys(want).map((k) => [k, states.find((s) => s.name === k)]));
check("(1) every range is a state, holding the chart as that range draws it (its labels)", Object.entries(want).every(([k, re]) => got[k] && holds(got[k], re)), J(Object.fromEntries(Object.entries(got).map(([k, s]) => [k, s ? s.changes.map((c) => c.at).slice(0, 6) : null]))));
check("(2) the price ticking is in no state", !states.some((s) => s.changes.some((c) => /section:1>p:1(>b:1)?$/.test(c.at))), J(states.map((s) => [s.name, s.changes.map((c) => c.at).filter((a) => /section:1/.test(a))])));
const ps = cap.pressStats ?? {};
check("(3) every press undone in place", ps.presses >= 3 && ps.afterPress === 0, J(ps));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
