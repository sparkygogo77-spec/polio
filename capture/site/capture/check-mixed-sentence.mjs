/**
 * A SENTENCE SET IN TWO FACES IS ONE PART, HOWEVER MANY LINES IT TAKES.
 *
 * sunkcoin.fun's title reads "The coin that pays" and, after a <br>, "your
 * sunk cost." in the same serif slanted, lighter and orange; its paragraph
 * runs over four lines with "underwater", "$SUNK" and "Sell, and your payouts
 * stop." in bold; its Payday heading has "buys the dip" italic and yellow in
 * the middle. Each came in as a sentence with holes and its children as parts
 * of their own at the places the page measured, and the moment the board
 * broke the lines elsewhere (its own fonts) the pieces lay over each other
 * (J, 2026-10-11). A wrapped sentence had no order: boxes on several lines
 * say nothing about which word came first.
 *
 * The capture now records the order the page wrote them (`ot[6]`, dump.mjs)
 * and a <br> as a run of "\n", and inline-runs.mjs folds by that order. So:
 * one part per sentence, runs in DOM order, the break kept, italics and the
 * lighter weight and the colour on the run that wore them, and a run in
 * another face by its name. A bar of links (words that only separate) is
 * still split as before.
 *
 *   node capture/site/capture/check-mixed-sentence.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-mixed-"));
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:40px;font:18px/1.5 Georgia, serif;background:#0b1a2e;color:#f3eee3;width:420px}
  h1{font:400 64px/.96 Georgia, serif;margin:0 0 18px}
  h1 em, h2 em{font-style:italic;font-weight:300;color:rgb(255, 176, 112)}
  h2{font:400 40px/1.02 Georgia, serif;margin:0 0 20px}
  p{margin:0 0 20px} p b{font-weight:700}
  .mono{font-family:"Courier New", monospace}
  nav a{color:#fff;margin:0 4px}
</style></head><body>
<h1>The coin that pays<br><em>your sunk cost.</em></h1>
<p>Bought high? Price now below what you paid? You are <b>underwater</b>. When the price dips, the pot buys <b>$SUNK</b> and hands the coins to everyone underwater. The further under you are, the bigger your share. <b>Sell, and your payouts stop.</b></p>
<h2>When the chart dips, the pot <em>buys the dip</em> and hands it to the people who are under</h2>
<p>A code word <span class="mono">in another face</span> inside a sentence that goes on long enough to wrap onto a second line here.</p>
<nav><a href="/a">Play</a> | <a href="/b">Rules</a> | <a href="/c">Ledger</a></nav>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "900", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* no document */ }
const plain = (c) => (typeof c === "string" ? c : (c ?? []).map((s) => s.text).join(""));
const holding = (word) => doc.nodes.filter((n) => plain(n.content).includes(word));
const runOf = (n, word) => (Array.isArray(n?.content) ? n.content.find((s) => s.text.includes(word)) : null);

/* 1. The title: two lines, the second a run of its own, the break between them. */
const title = holding("The coin that pays")[0];
check("the title is one part", holding("The coin that pays").length === 1 && holding("your sunk cost.").length === 1 && holding("your sunk cost.")[0] === title, J(doc.nodes.filter((n) => /coin that|sunk cost/.test(plain(n.content))).map((n) => plain(n.content))));
check("…reading as written, with its <br> as a line break", plain(title?.content) === "The coin that pays\nyour sunk cost.", J(plain(title?.content)));
const cost = runOf(title, "your sunk cost.");
check("…its second line italic, lighter and orange, as a run", cost?.italic === true && cost?.weight === 300 && cost?.colour === "rgb(255, 176, 112)", J(cost));
check("…and the first line carries nothing of its own", title && Array.isArray(title.content) && Object.keys(title.content[0] ?? {}).length === 1, J(title?.content?.[0]));

/* 2. The wrapped paragraph: three bold runs in their places. */
const para = holding("Bought high?")[0];
check("the four-line paragraph is one part, its bold words inside it", para && holding("underwater.").length === 1 && !doc.nodes.some((n) => plain(n.content) === "underwater" || plain(n.content) === "$SUNK"), J(doc.nodes.filter((n) => /underwater|SUNK|payouts/.test(plain(n.content))).map((n) => plain(n.content))));
check("…reading in the order the page wrote it", plain(para?.content) === "Bought high? Price now below what you paid? You are underwater. When the price dips, the pot buys $SUNK and hands the coins to everyone underwater. The further under you are, the bigger your share. Sell, and your payouts stop.", J(plain(para?.content)));
check("…with the bold runs bold and the rest not", runOf(para, "underwater")?.weight === 700 && runOf(para, "$SUNK")?.weight === 700 && runOf(para, "Sell, and")?.weight === 700 && !runOf(para, "Bought high")?.weight, J(para?.content));

/* 3. The heading with its italic in the middle. */
const pay = holding("When the chart dips")[0];
check("the heading with an italic run in the middle is one part", pay && plain(pay.content) === "When the chart dips, the pot buys the dip and hands it to the people who are under", J(plain(pay?.content)));
check("…the run italic and orange, nothing else", runOf(pay, "buys the dip")?.italic === true && runOf(pay, "buys the dip")?.colour === "rgb(255, 176, 112)" && !runOf(pay, "When the chart")?.italic, J(pay?.content));

/* 4. Another face mid-sentence keeps its name. */
const code = holding("A code word")[0];
check("a run in another face stays in the sentence, by its face's name", /Courier New/i.test(runOf(code, "in another face")?.face ?? "") && plain(code?.content).startsWith("A code word in another face inside"), J(code?.content));

/* 5. Control: a bar of links is still its links. */
check("control: a nav of links between bars is not folded into one sentence", holding("Play").every((n) => plain(n.content).trim() === "Play" || !plain(n.content).includes("Rules")), J(holding("Play").map((n) => plain(n.content))));

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 600)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
