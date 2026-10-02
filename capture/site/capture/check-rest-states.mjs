/**
 * A LOOK AT REST IS NOT ITS HOVER; A PRESS IS ITS OWN STATE; A LOADER'S
 * SWITCH-OFF IS TIMED FROM THE NAVIGATION.
 *
 * trumpmorty.fun, measured by the coordinator against its copy: the TG and X
 * stickers rest at `4px 4px` and hover at `calc(var(--sh) + 3px)` = 7px; the
 * CA bar rests at `6px 6px` and hovers at `8px 8px`. The copy rested at 7px
 * and 8px: the dump tried each `:hover` rule on the element with its
 * transition held off, then gave the transition back before the page had
 * been read at rest again, so the next read caught the first frame of a
 * transition from the hover look back to rest. `:active` (the sticker
 * pushed into its shadow) was not read at all.
 *
 * A stand-in page, served locally:
 *
 *   · a sticker (`--sh: 4px`, a transition on transform and box-shadow, a
 *     `:hover` that lifts it to `calc(var(--sh) + 3px)` and an `:active`
 *     that pushes it to `1px`);
 *   · a CA bar: a button, rounded 16px, `overflow: hidden`, a 6px shadow
 *     (8px hovered), whose COPY end is a square span inside it: its corners
 *     are cut by the bar's curve, as a part of its own;
 *   · a loader over the window, switched off with `.is-off` about 1.2 s
 *     after the navigation started, removed 0.8 s later;
 *   · two ribbons, one stepped 0.6 px a frame and one timed at 36 px a
 *     second: sampled at two frame rates, each is said to run on its clock;
 *   · a cookie banner with Accept All and Reject side by side, captured
 *     with the presses on (`--states`): neither is ever pressed;
 *   · a coin card's "Open" and "Buy" and a ledger's "Tree" and "Burn
 *     ledger" tabs, each only showing something (parasiteonsol.fun): each is
 *     pressed and kept, not skipped for its words;
 *   · and the pointer left over the sticker by the behaviours drive's last
 *     move (it moves the pointer about the window).
 *
 * The capture must read each at rest, keep the hover and the press as
 * `motion.hover` and `motion.active`, cut the COPY end to the curve, and
 * say when the loader switched off, from the navigation's start.
 *
 *   node capture/site/capture/check-rest-states.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  :root{--sh:6px;--ink:#1a0f0b}
  body{margin:0;font:18px/24px sans-serif;background:#f3d440;color:#1a0f0b;min-height:1400px}
  header{position:fixed;left:0;right:0;top:0;height:120px;display:flex;align-items:center;gap:20px;padding:0 40px}
  .sticker{display:inline-flex;align-items:center;padding:10px 18px 7px;border:4px solid var(--ink);border-radius:13px;background:#89cebc;color:var(--ink);--sh:4px;
    box-shadow:var(--sh) var(--sh) 0 var(--ink);transition:transform .2s ease,box-shadow .2s;position:relative;text-decoration:none}
  .sticker:hover{transform:translate(-3px,-3px) rotate(-4deg);box-shadow:calc(var(--sh) + 3px) calc(var(--sh) + 3px) 0 var(--ink)}
  .sticker:active{transform:translate(4px,4px);box-shadow:1px 1px 0 var(--ink)}
  main{padding:200px 40px}
  .ca{display:flex;align-items:center;gap:0;width:560px;padding:0;background:#fafafa;border:4px solid var(--ink);border-radius:16px;box-shadow:6px 6px 0 var(--ink);overflow:hidden;
    text-align:left;font:inherit;transition:transform .2s ease,box-shadow .2s;cursor:pointer}
  .ca:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 var(--ink)}
  .ca:active{transform:translate(4px,4px);box-shadow:2px 2px 0 var(--ink)}
  .ca__label{padding:12px 14px 8px;background:#292f44;color:#f3d440;align-self:stretch;display:flex;align-items:center}
  .ca__value{padding:8px 14px;flex:1;white-space:nowrap;overflow:hidden}
  .ca__btn{padding:12px 16px 8px;background:#f3d440;border-left:4px solid var(--ink);align-self:stretch;display:flex;align-items:center}
  .band{position:relative;top:130px;overflow:hidden;height:40px;white-space:nowrap}
  .ft,.tt{display:inline-block;font-size:30px}
  #loader{position:fixed;inset:0;z-index:2000;background:#000;color:#b8ff6a;display:grid;place-items:center;transition:opacity .5s ease .1s}
  #loader.is-off{opacity:0}
</style></head><body class="is-loading">
  <div id="loader"><div>CH 47 · TUNING <span id="pct">0</span>%</div></div>
  <header><a class="sticker" href="#tg">TG</a><a class="sticker" href="#x">X</a></header>
  <div class="band"><div class="ft">FRAME FRAME FRAME FRAME </div></div>
  <div class="band"><div class="tt">CLOCK CLOCK CLOCK CLOCK </div></div>
  <div id="cookies" style="position:fixed;left:20px;bottom:20px;width:420px;padding:12px;background:#fff;border:2px solid #000;z-index:50">We use cookies to improve your visit.
    <div class="cb"><button id="acc">Accept All</button><button id="rej">Reject</button></div></div>
  <div class="card" style="position:absolute;left:600px;top:200px;width:300px"><div class="acts"><button id="opencard">Open $STANDIN</button><button id="buycard">Buy</button></div><div id="panel"></div></div>
  <div class="ledger" style="position:absolute;left:600px;top:320px;width:300px"><div class="tabs"><button id="tree" aria-pressed="true">Tree</button><button id="burnl" aria-pressed="false">Burn ledger</button></div><div id="view">the tree</div></div>
  <main><button class="ca" type="button"><span class="ca__label">CA</span><span class="ca__value">STANDINxADDRESSxONLYxFORxTHISxCHECK</span><span class="ca__btn">COPY</span></button></main>
  <script>
    /* Two ribbons: one stepped 0.6 px every frame (trumpmorty's), one timed by the clock at 36 px a second. */
    (function () {
      var f = document.querySelector(".ft"), t = document.querySelector(".tt"), x = 0, t0 = performance.now();
      (function go() { x -= 0.6; if (x < -200) x += 200; f.style.transform = "translateX(" + x + "px)"; t.style.transform = "translateX(" + (-((performance.now() - t0) * 0.036) % 200) + "px)"; requestAnimationFrame(go); })();
    })();
    /* A coin card's actions and a ledger's tabs (parasiteonsol.fun): each only shows something, client side. */
    document.getElementById("opencard").addEventListener("click", () => { document.getElementById("panel").innerHTML = "<p style='background:#fff;padding:8px'>STANDIN coin card, opened</p>"; });
    document.getElementById("buycard").addEventListener("click", () => { document.getElementById("panel").innerHTML = "<p style='background:#cfc;padding:8px'>Buy STANDIN with SOL: a panel, nothing sent</p>"; });
    document.getElementById("tree").addEventListener("click", () => { document.getElementById("view").textContent = "the tree"; });
    document.getElementById("burnl").addEventListener("click", () => { document.getElementById("view").textContent = "the burn ledger, row by row"; });
    /* A cookie choice: pressed, it goes, and the page remembers it. */
    for (const id of ["acc", "rej"]) document.getElementById(id).addEventListener("click", () => { document.getElementById("cookies").remove(); document.title = "consent:" + id; });
    /* Off at 1.2 s from the navigation, whenever this script ran. */
    (function tick() {
      var t = performance.now();
      document.getElementById("pct").textContent = String(Math.min(100, Math.round(t / 12)));
      if (t >= 1200) { document.getElementById("loader").classList.add("is-off"); document.body.classList.remove("is-loading"); setTimeout(function () { document.getElementById("loader").remove(); }, 800); return; }
      requestAnimationFrame(tick);
    })();
  </script>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = process.env.KEEP_WORK || mkdtempSync(join(tmpdir(), "capture-rest-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "1", "--behaviours", "--states"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), cap0.err.trim().split("\n").slice(-12).join(" / "));
const cap = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : { tree: { kids: [] } };
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };

const all = [];
(function walk(e) { if (!e) return; all.push(e); for (const k of e.kids ?? []) walk(k); })(cap.tree);
const stickers = all.filter((e) => e.t === "a" && /^(TG|X)$/.test(e.text ?? ""));
const bar = all.find((e) => e.t === "button" && (e.kids ?? []).some((k) => k.text === "COPY"));
const px = (sh) => (/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/.exec(sh ?? "") ?? []).slice(1).map(Number);

check("both stickers were read", stickers.length === 2, JSON.stringify(all.map((e) => [e.t, e.text]).slice(0, 12)));
check("each sticker's shadow is its resting 4px 4px, not its hover's 7px", stickers.length === 2 && stickers.every((s) => px(s.shadow).join() === "4,4"), JSON.stringify(stickers.map((s) => s.shadow)));
check("…and its resting transform is none", stickers.every((s) => !s.tf || s.tf === "none"), JSON.stringify(stickers.map((s) => s.tf)));
const hov = stickers[0]?.motion?.hover?.[0]?.style ?? {};
check("its hover is kept as its own state: the lift and the 7px shadow", /translate\(-3px, ?-3px\)/.test(hov.transform ?? "") && /calc\(4px \+ 3px\)/.test(hov["box-shadow"] ?? ""), JSON.stringify(stickers[0]?.motion));
const act = stickers[0]?.motion?.active?.[0]?.style ?? {};
check("its press is kept apart, as motion.active: pushed 4px into a 1px shadow", /translate\(4px, ?4px\)/.test(act.transform ?? "") && /^1px 1px/.test(act["box-shadow"] ?? ""), JSON.stringify(stickers[0]?.motion));
check("the press is not folded into the hover", !(stickers[0]?.motion?.hover ?? []).some((h) => /:active/.test(h.selector ?? "")), JSON.stringify(stickers[0]?.motion?.hover));
check("the CA bar rests at 6px 6px, not its hover's 8px", px(bar?.shadow).join() === "6,6", bar?.shadow);
check("…and keeps 8px 8px as its hover and 2px 2px as its press", /^8px 8px/.test(bar?.motion?.hover?.[0]?.style?.["box-shadow"] ?? "") && /^2px 2px/.test(bar?.motion?.active?.[0]?.style?.["box-shadow"] ?? ""), JSON.stringify(bar?.motion));

const node = (sel) => doc.nodes.find((n) => n.from?.selector && sel(n.from.selector));
const sticker = node((s) => /header > a(:nth-of-type\(1\))?$/.test(s));
check("in the document, a sticker's edge shadow is the resting 4px", /^(rgb\([^)]*\) )?4px 4px/.test(sticker?.edge?.shadow ?? "") || /4px 4px 0px/.test(sticker?.edge?.shadow ?? ""), JSON.stringify(sticker?.edge));
check("…and its motion carries hover and active apart", !!sticker?.motion?.hover?.length && !!sticker?.motion?.active?.length, JSON.stringify(sticker?.motion));
const copy = doc.nodes.find((n) => /span:nth-of-type\(3\)$/.test(n.from?.selector ?? ""));
check("the COPY end, a part of its own, is cut to the bar's rounded inner corners", /inset\([^)]*round 12px/.test(copy?.art?.clipPath ?? ""), JSON.stringify(copy?.art));
const label = doc.nodes.find((n) => /span:nth-of-type\(1\)$/.test(n.from?.selector ?? ""));
check("…and so is the CA end at the other side", /inset\([^)]*round 12px/.test(label?.art?.clipPath ?? ""), JSON.stringify(label?.art));

const L = doc.behaviours?.loader;
check("the loader is recorded", !!L, JSON.stringify(Object.keys(doc.behaviours ?? {})));
check("its switch-off is timed from the navigation's start: about 1.2 s", Number.isFinite(L?.nav?.off) && L.nav.off >= 1150 && L.nav.off <= 1600, JSON.stringify(L?.nav));
check("…with when it was seen and when it was gone, in order", L?.nav?.shown <= L?.nav?.off && L?.nav?.off <= L?.nav?.gone, JSON.stringify(L?.nav));

const loops = doc.behaviours?.loops ?? [];
const ribbon = (w) => loops.find((l) => new RegExp(w).test(String(doc.nodes.find((n) => n.id === l.part)?.content ?? "")));
check("a ribbon stepped by so much a frame is said to run on the frame's clock", ribbon("FRAME")?.clock === "frame" && Math.abs((ribbon("FRAME")?.perFrame ?? 0) - 0.6) < 0.05, JSON.stringify(ribbon("FRAME")));
check("…and one timed by the clock, on the time's", ribbon("CLOCK")?.clock === "time", JSON.stringify(ribbon("CLOCK")));

const cookie = all.find((e) => /We use cookies/.test(e.text ?? ""));
check("a cookie banner is never pressed: it is still there, as the page opened", !!cookie, JSON.stringify(all.filter((e) => e.pos === "fixed").map((e) => e.text)));
check("…and no press of it is recorded as a state", !(cap.states ?? []).some((st) => /accept|reject/i.test(st.name ?? "")), JSON.stringify((cap.states ?? []).map((st) => st.name)));

const pressed = (cap.states ?? []).map((st) => st.name);
check("a coin card's Open and Buy, which only show a panel, are each pressed and kept", pressed.includes("Open $STANDIN") && pressed.includes("Buy"), JSON.stringify(pressed));
check("…and a ledger's Burn ledger tab", pressed.includes("Burn ledger"), JSON.stringify(pressed));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
