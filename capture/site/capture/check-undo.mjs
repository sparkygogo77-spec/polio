#!/usr/bin/env node
/**
 * UNDONE IN PLACE: SELECTED, EXPANDED, OPEN, ACTIVE.
 *
 * A stand-in page (all STANDIN data) whose presses leave marks an undo has to
 * take back, none of them a dialog:
 *   - tabs marked active by a class only (no aria), each showing its panel;
 *   - a segmented control whose options sit one to a list item, the one on
 *     marked aria-pressed (a press moves it to another item's button);
 *   - a row of disclosure buttons, each aria-expanded, each opening its own
 *     panel elsewhere on the page;
 *   - a lone <details> opened by its summary;
 *   - a button that marks its row aria-expanded and opens the row's drawer;
 *   - a sound button the page switches on at its first gesture of any kind
 *     (as a device unlocking its audio), whichever control that was, and
 *     that its own press switches back (a state all the same);
 *   - a lights off that switches the whole page's theme (a data-theme on
 *     <html>, every button's look with it), pressed before the rest;
 *   - a Copy CA whose toast fades out over 400 ms after its timer;
 *   - an icon bar that opens with none chosen and none marked (every icon
 *     marked once one is picked): an icon pressed again stays
 *     chosen, and only the bar's own back button clears it (a device's);
 *   - a row of pixel pictures held once for 2.5 s whenever a key is
 *     pressed, then twice again (gotchi.gg's hero, some ten seconds after
 *     it loads): read back after an undo, far more
 *     elements than a press leaves, and none a press's;
 *   - a games button that opens a panel of six buttons (the panel itself
 *     draws nothing) in a hero row centred on its height: everything below
 *     is pushed down by the panel, the column centred beside it by half, and
 *     what holds it grows (gotchi.gg's play); a state all the same;
 *   - a board's Daily / Weekly tabs that replace the page's query
 *     (history.replaceState, no step to go back to);
 *   - a shop's Toys / Snacks tabs, each showing a shelf that is most of
 *     the page (a chosen tab's panel, however large, is a state);
 *   - a market's "details" button that shows a panel already in the page
 *     (its hidden taken off), and a "Show more" that shows more lines by a
 *     class on what holds them: nothing put in, all of it the press's;
 *   - a Search that opens an overlay with more parts than the rest of the
 *     page (a dialog opened over it is new, not the page changed);
 *   - market sources whose tabs change only their aria-selected, over a nav
 *     of links that is different on every load (live): the tab's own mark
 *     is its state;
 *   - a Menu that opens a fixed panel by a class on <body>;
 *   - a Yes whose odds (a span in it) are drawn again every 400 ms: live
 *     data, not what its press left;
 *   - all of it inside <main tabindex="-1"> (a skip link's target), which is
 *     no control: the page's first gesture is still found a spot.
 * Captured twice: the page loaded again after every press (`--reload-each`)
 * and undone in place. Held:
 *   (1) the same states both ways;
 *   (2) undone in place, every press is taken back without loading the page
 *       again: the partner that was on pressed back, what was expanded pressed
 *       again, a <details> closed, an address only replaced set back; and
 *       no page load passed off as undone in place (the server counts each
 *       time the page is asked for);
 *   (3) the run says how many page loads followed a press and how many
 *       presses were undone in place (`pressStats`).
 *
 *   node capture/site/capture/check-undo.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 700)}`}`); };
const J = (x) => JSON.stringify(x);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN undo</title><style>
body{margin:0;font:15px sans-serif}button{margin:4px;padding:4px 8px}.pane{display:none}.pane.on{display:block}
.tabs button.active{background:#333;color:#fff}ul{list-style:none;display:flex;gap:4px;padding:0}
[data-theme=dark] body{background:#222;color:#eee}[data-theme=dark] button,[data-theme=dark] p,[data-theme=dark] summary{background:#444;color:#eee}.hero{display:flex;align-items:center;gap:24px}.hero>div:first-child{width:240px}#gl button{display:block;height:40px;margin:4px}#more .x{display:none}#more.all .x{display:block}.portal{display:none;position:fixed;top:0;right:0;background:#eee;padding:8px}body.menu-open .portal{display:block}.drawer{display:none}.row[aria-expanded="true"] .drawer{display:block}section{padding:6px;border-bottom:1px solid #ccc}
</style></head><body><main id="app" tabindex="-1"><h1>STANDIN undo</h1><header><button type="button" id="search" aria-haspopup="dialog">Search</button><button type="button" id="theme">lights off</button><button type="button" id="sound" aria-pressed="false">sound off</button></header>
<section class="hero"><div><button type="button" id="games" aria-expanded="false">games</button><div id="gl"></div></div><div><p>STANDIN pitch one</p><p>STANDIN pitch two</p><p>STANDIN pitch three</p></div></section>
<section><svg id="row" width="600" height="6">${Array.from({ length: 150 }, (_, i) => `<rect x="${i * 4}" y="0" width="3" height="3"/>`).join("")}</svg></section>
<section><div role="tablist" id="board"><button type="button" role="tab" aria-selected="true" data-b="daily">Daily</button><button type="button" role="tab" aria-selected="false" data-b="weekly">Weekly</button></div><p id="bv">STANDIN daily board</p></section>
<section><div role="tablist" id="shop"><button type="button" role="tab" aria-selected="true" data-s="toys">Toys</button><button type="button" role="tab" aria-selected="false" data-s="snacks">Snacks</button></div><div id="shelf"></div></section>
<section><ul><li><button type="button" id="mdbtn">Market details</button><div id="md" hidden><p>STANDIN volume 1</p><p>STANDIN volume 2</p><p>STANDIN rules</p></div></li></ul><div id="more"><p>STANDIN line one</p><p class="x">STANDIN line two</p><p class="x">STANDIN line three</p><button type="button" id="morebtn">Show more</button></div></section>
<section><div role="tablist" id="src"><button type="button" role="tab" aria-selected="true" data-k="unified">Unified</button><button type="button" role="tab" aria-selected="false" data-k="poly">Poly</button></div><nav id="srcnav"></nav>
<button type="button" id="menubtn">Menu</button><button type="button" id="yes" aria-pressed="false">Yes <span id="yp"><span>16.5%</span></span></button></section>
<section><button type="button" id="copyca">Copy CA</button></section>
<section><div class="dev"><button type="button" aria-label="feed" data-i="feed">F</button><button type="button" aria-label="play" data-i="play">P</button><button type="button" aria-label="back" id="devback">B</button></div><p id="devsay">STANDIN idle</p></section>
<section><div class="tabs"><button type="button" class="active" data-t="a">Alpha</button><button type="button" data-t="b">Beta</button><button type="button" data-t="c">Gamma</button></div>
<div class="pane on" id="pa">STANDIN alpha pane</div><div class="pane" id="pb">STANDIN beta pane</div><div class="pane" id="pc">STANDIN gamma pane</div></section>
<section><ul class="seg"><li><button type="button" aria-pressed="true" data-v="1">One</button></li><li><button type="button" aria-pressed="false" data-v="2">Two</button></li><li><button type="button" aria-pressed="false" data-v="3">Three</button></li></ul><p id="segv">STANDIN value 1</p></section>
<section><div class="disc"><button type="button" aria-expanded="false" data-d="x">Rules</button><button type="button" aria-expanded="false" data-d="y">Fees</button></div>
<div class="pane" id="dx">STANDIN rules text</div><div class="pane" id="dy">STANDIN fees text</div></section>
<section><details><summary>STANDIN more</summary><p>STANDIN hidden detail</p></details></section>
<section><div class="row" aria-expanded="false"><span>STANDIN row</span><button type="button" id="rowbtn">Open row</button><div class="drawer">STANDIN drawer</div></div></section>
<div>${Array.from({ length: 20 }, (_, i) => `<p>STANDIN filler ${i}</p>`).join("")}</div></main>
<script>
document.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b)); ["a", "b", "c"].forEach((k) => document.getElementById("p" + k).classList.toggle("on", k === b.dataset.t)); });
document.querySelector(".seg").addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); segv.textContent = "STANDIN value " + b.dataset.v; });
document.querySelector(".disc").addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (!b) return; const open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(open)); document.getElementById("d" + b.dataset.d).classList.toggle("on", open); });
/* The page's first gesture of any kind unlocks its sound, as a device's audio does: not any control's doing. */
document.addEventListener("pointerdown", () => { sound.setAttribute("aria-pressed", "true"); sound.textContent = "sound on"; }, { once: true });
sound.onclick = () => { const on = sound.getAttribute("aria-pressed") !== "true"; sound.setAttribute("aria-pressed", String(on)); sound.textContent = on ? "sound on" : "sound off"; };
/* A toast that fades out over 400 ms once its timer runs. */
copyca.onclick = () => { navigator.clipboard.writeText("STANDIN0MINT01").catch(() => {}); const t = document.createElement("div"); t.textContent = "STANDIN copied"; t.style.cssText = "position:fixed;bottom:10px;left:10px;background:#cfc;transition:opacity .4s"; document.body.append(t); setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 450); }, 1500); };
document.querySelectorAll(".dev [data-i]").forEach((b) => (b.onclick = () => { document.querySelectorAll(".dev [data-i]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); devsay.textContent = "STANDIN " + b.dataset.i; }));
devback.onclick = () => { document.querySelectorAll(".dev [data-i]").forEach((x) => x.setAttribute("aria-pressed", "false")); devsay.textContent = "STANDIN idle"; };
/* The row held once for 2.5 s whenever a key is pressed (the undo's Escape), as a hero loop that measures itself again: never while the page is read as it opened, always when it is read back after an undo. */
const full = row.innerHTML; let half = null; addEventListener("keydown", () => { row.innerHTML = full.slice(0, full.length / 2); clearTimeout(half); half = setTimeout(() => (row.innerHTML = full), 2500); });
theme.onclick = () => { const dark = document.documentElement.dataset.theme !== "dark"; document.documentElement.dataset.theme = dark ? "dark" : "light"; theme.textContent = dark ? "lights on" : "lights off"; };
games.onclick = () => { const open = games.getAttribute("aria-expanded") !== "true"; games.setAttribute("aria-expanded", String(open)); gl.innerHTML = open ? [0, 1, 2, 3, 4, 5].map((i) => '<button type="button">STANDIN game ' + i + '</button>').join("") : ""; };
const pickBoard = (b) => { board.querySelectorAll("[data-b]").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.b === b))); bv.textContent = "STANDIN " + b + " board"; };
pickBoard(new URLSearchParams(location.search).get("board") || "daily");
board.addEventListener("click", (e) => { const b = e.target.closest("[data-b]"); if (!b) return; pickBoard(b.dataset.b); history.replaceState(null, "", b.dataset.b === "daily" ? "/" : "/?board=" + b.dataset.b); });
const fillShelf = (k) => { shelf.innerHTML = Array.from({ length: 50 }, (_, i) => '<div class="item"><b>STANDIN ' + k + ' ' + i + '</b><i>' + (k === "toys" ? i * 3 : i * 7) + '</i><span>' + k + ' a</span><span>' + k + ' b</span><span>' + k + ' c</span><span>' + k + ' d</span><em>' + k + '</em></div>').join(""); };
fillShelf("toys");
shop.addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (!b) return; shop.querySelectorAll("[data-s]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); fillShelf(b.dataset.s); });
mdbtn.onclick = () => { md.hidden = !md.hidden; };
morebtn.onclick = () => { more.classList.toggle("all"); };
search.onclick = () => { const d = document.createElement("div"); d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.style.cssText = "position:fixed;inset:40px;background:#fff;overflow:auto;border:1px solid #999"; d.innerHTML = '<button type="button" class="close" aria-label="close">x</button>' + Array.from({ length: 400 }, (_, i) => '<p><b>STANDIN result ' + i + '</b></p>').join(""); d.querySelector(".close").onclick = () => d.remove(); document.body.append(d); };
const navFor = (k) => { srcnav.innerHTML = [0, 1, 2].map((i) => '<a href="#">STANDIN ' + k + ' ' + Math.floor(Math.random() * 1000) + '</a>').join(" "); };
navFor("unified");
src.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; src.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); navFor(b.dataset.k); });
menubtn.onclick = () => document.body.classList.toggle("menu-open");
yes.onclick = () => yes.setAttribute("aria-pressed", String(yes.getAttribute("aria-pressed") !== "true"));
setInterval(() => { yp.innerHTML = "<span>" + (10 + Math.random() * 10).toFixed(1) + "%</span>"; }, 400);
rowbtn.onclick = () => { const r = rowbtn.closest(".row"); r.setAttribute("aria-expanded", String(r.getAttribute("aria-expanded") !== "true")); };
</script><div class="portal"><p>STANDIN menu one</p><p>STANDIN menu two</p></div></body></html>`;

/* Every time the page itself is asked for: a load the run must have counted, never one it passed off as undone in place. */
let pageLoads = 0;
const server = createServer((req, res) => { if (!/favicon/.test(req.url)) pageLoads++; res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const take = (extra) => new Promise((resolve) => {
  const work = mkdtempSync(join(tmpdir(), "capture-undo-"));
  mkdirSync(join(work, "routes"), { recursive: true });
  const out = join(work, "routes", "page_home.json");
  const t0 = Date.now();
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, out, "--width", "1000", "--height", "800", "--settle", "1", "--frames", "0", "--states", ...extra], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err, ms: Date.now() - t0, out, cap: existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {} }));
});
const old = await take(["--reload-each"]);
const hitsBefore = pageLoads;
const now = await take([]);
const hits = pageLoads - hitsBefore;
server.close();
if (process.env.DEBUG) console.log(old.err, "\n----\n", now.err);
/* Names with their live numbers blanked (a Yes that reads its odds). */
const names = (c) => (c.states ?? []).map((s) => s.name.replace(/\d+(\.\d+)?%/g, "#%")).sort();
const WANT = ["Poly", "Menu", "Search", "Market details", "Show more", "Snacks", "Weekly", "games", "sound off", "feed", "play", "Beta", "Gamma", "Two", "Three", "Rules", "Fees", "STANDIN more", "Open row"];
check("both captures were taken", old.status === 0 && now.status === 0, (old.err + now.err).trim().split("\n").slice(-3).join(" | "));
check("(1) the Yes with live odds is a state both ways", [old, now].every((r) => names(r.cap).some((n) => /^Yes/.test(n))), J({ old: names(old.cap), now: names(now.cap) }));
check("(1) every press is a state, the page loaded again after each", WANT.every((n) => names(old.cap).includes(n)), J(names(old.cap)));
check("(1) …and the same states undone in place", J(names(now.cap)) === J(names(old.cap)), J({ old: names(old.cap), now: names(now.cap) }));
/* What opens a panel keeps the panel, not the page it pushed down. */
const games = (now.cap.states ?? []).find((st) => st.name === "games");
const gat = (games?.changes ?? []).map((c) => c.at);
check("(1) the games panel is its state: what it opened, not the page it pushed down", !!games && gat.length > 0 && gat.length <= 10 && gat.every((p) => p.startsWith("body>main:1>section:1>div:1")), J(gat));
const s = now.cap.pressStats ?? {};
check("(2) every press undone in place: no page loaded again after one", s.presses >= WANT.length && s.afterPress === 0 && s.undone >= WANT.length - 1, J({ now: s, old: old.cap.pressStats }));
check("(2) no load passed off as undone in place: the page is asked for no more than the loads counted, and its first open and read", hits <= s.loads + 2, `asked for ${hits} times, ${s.loads} loads counted`);
check("(3) the run says page loads after a press, and presses undone in place", typeof s.afterPress === "number" && typeof s.undone === "number" && /page loads \(\d+ after a press, \d+ presses undone in place\)/.test(now.err), now.err.split("\n").find((l) => /^presses:/.test(l)));
console.log(`\n  page loads ${old.cap.pressStats?.loads} → ${s.loads} (after a press ${old.cap.pressStats?.afterPress ?? "?"} → ${s.afterPress}), ${Math.round(old.ms / 1000)}s → ${Math.round(now.ms / 1000)}s`);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
