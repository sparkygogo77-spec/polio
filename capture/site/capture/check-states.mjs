/**
 * WHAT A PRESS SHOWS, KEPT.
 *
 * gotchi.gg's "pick your starter": nine cards, each a `button`; pressing one
 * makes it the chosen card (yellow, tilted) and puts its pet in the panel
 * beside the row (name, blurb). The capture held the page as it opened only,
 * so in the Builder the other cards chose nothing. With `--states` each
 * option of a group of pressables is pressed on the page as it opened, and
 * what it changed is kept: its parts, marked `state`, and the press, in
 * `behaviours.states` (the part pressed, the parts it shows, the parts of the
 * page as it opened that they stand in for).
 *
 * A stand-in page: three cards and their panel; a switch that repaints the
 * whole page (a theme, not a state of it); a row of two links (they leave).
 *
 *   node capture/site/capture/check-states.mjs
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
  body{margin:0;font:16px/20px sans-serif;background:#fff5e0;color:#2b1d2e}
  body.dark{background:#111;color:#eee}
  .row{display:flex;gap:12px;padding:20px}
  .card{width:120px;height:90px;border:3px solid #2b1d2e;background:#fff;font:inherit;cursor:pointer}
  .card:hover{transform:translateY(-2px)}
  .card[aria-pressed="true"]{background:rgb(255, 212, 59);transform:rotate(-2deg)}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  #lcd{width:96px;height:72px;image-rendering:pixelated;background:#b7c595}
  .pick{display:grid;grid-template-columns:420px 400px;align-items:start}
  .panel{position:sticky;top:10px;margin:20px;padding:16px;width:360px;border:3px solid #2b1d2e;background:#fff}
  .panel h3{margin:0 0 8px}
  .top{display:flex;gap:8px;padding:10px}
  .top button{width:90px;height:30px}
  .links a{margin:10px}
  .many{display:grid;grid-template-columns:repeat(10,40px);gap:4px;padding:10px}
  .many i{display:block;height:20px;background:#caa}
  body.dark .many i{background:#533}
</style></head><body>
  <div class="top"><button id="theme">theme</button><button id="noop">nothing</button></div>
  <div class="row" id="cards"><button class="card" aria-pressed="true" data-pet="mochi">mochi</button><button class="card" aria-pressed="false" data-pet="pup">pup</button><button class="card" aria-pressed="false" data-pet="kit">kit</button><button class="card" aria-pressed="false" data-pet="boo">boo</button></div>
  <div class="pick"><div class="tall" style="height:300px"></div><div class="panel"><h3 id="name">mochi</h3><p id="blurb">a rice cake blob.</p></div></div>
  <div class="links"><a href="/a">one</a><a href="/b">two</a></div>
  <div class="many">${"<i></i>".repeat(60)}</div>
  <div class="dev"><canvas id="lcd" width="12" height="9"></canvas><span class="sr" id="say">still an egg.</span><div class="keys"><button id="feed">feed</button><button id="play">play</button></div></div>
  <p class="clock">opened <time id="ago">0s ago</time></p>
  <div class="dlg"><button id="open">details</button><button id="help">help</button></div>
  <dialog id="d"><p>connect a wallet</p><button>phantom</button></dialog>
  <script>
    const BLURB = { mochi: "a rice cake blob.", pup: "a small dog. waits by the screen for you.", kit: "a cat. likes you on its own schedule.", boo: "a little ghost. already died once, so it's chill about it, and it will tell you so at length, twice." };
    for (const c of document.querySelectorAll(".card")) c.addEventListener("click", () => {
      document.querySelectorAll(".card").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      document.getElementById("name").textContent = c.dataset.pet;
      document.getElementById("blurb").textContent = BLURB[c.dataset.pet];
    });
    /* The theme is remembered, as gotchi.gg remembers "lights off": pressed once, every later load opens dark. */
    if (localStorage.getItem("theme") === "dark") document.body.classList.add("dark");
    /* A small screen: an egg that wobbles; a press puts a bowl beside it for a while, blinking. */
    const g = document.getElementById("lcd").getContext("2d"); let tick = 0, fed = 0;
    const paint = () => { g.clearRect(0, 0, 12, 9); g.fillStyle = "#1f2e1b"; g.fillRect(4 + (tick % 2), 3, 3, 4); if (fed && (tick % 2)) g.fillRect(9, 6, 2, 2); tick++; };
    paint(); setInterval(paint, 300);
    /* The answer stands a moment and goes, as the device's "still an egg." does: gone before the page settles. */
    document.getElementById("feed").addEventListener("click", () => { fed = 1; document.getElementById("say").textContent = "yum."; setTimeout(() => { fed = 0; }, 900); });
    /* Changes on its own, every load and every second: a clock is not a press. */
    const t0 = Date.now(); document.getElementById("ago").textContent = (Math.random() * 100 | 0) + "s ago";
    setInterval(() => { document.getElementById("ago").textContent = ((Date.now() - t0) / 1000 | 0) + "s ago"; }, 1000);
    /* A modal: everything else leaves the accessibility tree while it is open. */
    document.getElementById("open").addEventListener("click", () => document.getElementById("d").showModal());
    document.getElementById("theme").addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light"); });
  </script>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = process.env.KEEP_WORK || mkdtempSync(join(tmpdir(), "capture-states-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "900", "--height", "700", "--assets", assets, "--settle", "1", "--frames", "1", "--states"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), cap0.err.trim().split("\n").slice(-12).join(" / "));
const cap = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : {};
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [900, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const byId = new Map(doc.nodes.map((n) => [n.id, n]));
const states = doc.behaviours?.states ?? [];

const named = (s) => states.find((x) => x.name === s);
check("pressing pup and pressing kit are each a state of the page", !!named("pup") && !!named("kit"), JSON.stringify(states.map((s) => s.name)));
/* The card chosen as the page opens: pressing it there changes nothing, and after pup it must choose mochi again, putting back the page as it opened. */
const mochi = named("mochi");
const mochiShown = (mochi?.shows ?? []).map((id) => byId.get(id));
check("the card chosen as the page opens is a press of its own (the opening press)", !!mochi && mochi.opening === true, JSON.stringify(states.map((s) => [s.name, s.opening ?? false])));
check("…pressed on mochi's own card", !!mochi && /mochi/.test(words(byId.get(mochi.part))), JSON.stringify(byId.get(mochi?.part)));
check("…showing the page's own panel, name and blurb: parts of the page as it opened, no copies", mochiShown.some((n) => words(n) === "mochi" && !n.state && n.y > 100) && mochiShown.some((n) => words(n) === "a rice cake blob." && !n.state), JSON.stringify(mochiShown.map((n) => [words(n), n?.state ?? null])));
check("…and the page's own cards, mochi chosen (yellow) and pup not", mochiShown.some((n) => !n.state && n.colour?.bg === "rgb(255, 212, 59)") && mochiShown.some((n) => !n.state && n.x > 100 && n.x < 300 && n.colour?.bg !== "rgb(255, 212, 59)"), JSON.stringify(mochiShown.map((n) => [n?.featureId, n?.x, n?.colour?.bg])));
check("…and hiding nothing of the page", (mochi?.hides ?? []).every((id) => byId.get(id)?.state), JSON.stringify(mochi?.hides));
check("…every part another card's press hides is one mochi's press shows again", ["pup", "kit", "boo"].every((k) => (named(k)?.hides ?? []).every((id) => (mochi?.shows ?? []).includes(id))), JSON.stringify(["pup", "kit", "boo"].map((k) => (named(k)?.hides ?? []).filter((id) => !(mochi?.shows ?? []).includes(id)))));
check("a row of plain buttons marks no choice, so none of it is an opening press (help does nothing, beside details)", !named("help") && !states.some((s) => s.opening && s.name !== "mochi"), JSON.stringify(states.filter((s) => s.opening).map((s) => s.name)));
/* boo's blurb runs three lines: the panel's own box grows, so the press keeps the panel whole, a sticky box with its words inside. */
const boo = named("boo");
const booShown = (boo?.shows ?? []).map((id) => byId.get(id));
const booPanel = booShown.find((n) => n?.from?.position === "sticky");
check("pressing boo, whose words grow the panel, keeps the panel itself: a sticky box of boo's press", !!booPanel && booPanel.state?.option === boo.option && booPanel.from.inset?.top === 10, JSON.stringify(booShown.map((n) => [n?.featureId, n?.from?.position, n?.h])));
check("…with boo's name and blurb as parts of boo's press, inside the panel's path and box", !!booPanel && ["boo", "a little ghost"].every((w) => booShown.some((n) => words(n).startsWith(w) && n.from?.selector?.startsWith(`${booPanel.from.selector} > `) && n.x >= booPanel.x && n.y >= booPanel.y && n.y + n.h <= booPanel.y + booPanel.h + 1)), JSON.stringify(booShown.map((n) => [words(n).slice(0, 12), n?.from?.selector?.slice(-30), n?.x, n?.y])));
check("…standing where the page's own panel stands", !!booPanel && doc.nodes.some((n) => !n.state && n.from?.selector === booPanel.from.selector && Math.abs(n.x - booPanel.x) <= 2 && Math.abs(n.y - booPanel.y) <= 2), JSON.stringify(booPanel && [booPanel.x, booPanel.y]));
const pup = named("pup");
const shown = (pup?.shows ?? []).map((id) => byId.get(id));
check("pup's state shows pup's name and blurb in the panel", shown.some((n) => words(n) === "pup" && n.y > 100) && shown.some((n) => /small dog/.test(words(n))), JSON.stringify(shown.map((n) => [words(n), n?.y])));
check("…and its card, chosen: yellow", shown.some((n) => n?.colour?.bg === "rgb(255, 212, 59)" && n.x > 100 && n.x < 300), JSON.stringify(shown.map((n) => [n?.featureId, n?.x, n?.colour?.bg])));
check("…in place of the page's own: it hides mochi's name and blurb", (pup?.hides ?? []).map((id) => words(byId.get(id))).some((w) => w === "a rice cake blob."), JSON.stringify((pup?.hides ?? []).map((id) => words(byId.get(id)))));
check("…pressed on pup's own card", /pup/.test(words(byId.get(pup?.part))) || byId.get(pup?.part)?.x > 100, JSON.stringify(byId.get(pup?.part)));
check("the state's parts are marked with the press that shows them", shown.length > 0 && shown.every((n) => n?.state?.group === pup.group && n.state.option === pup.option), JSON.stringify(shown.map((n) => n?.state)));
check("the page as it opened is kept whole: mochi's blurb is still a part, unmarked", doc.nodes.some((n) => words(n) === "a rice cake blob." && !n.state));
check("a switch that repaints the whole page (a theme) is not a state", !named("theme"), JSON.stringify(states.map((s) => s.name)));
check("links are not pressed: they leave the page", !states.some((s) => /one|two/.test(s.name)));
const pupCap = cap.states?.find((x) => x.name === "pup");
check("what changes on its own between two loads (a clock) is not part of a press", !!pupCap && !pupCap.changes.some((c) => /time/.test(c.at)), JSON.stringify(pupCap?.changes.map((c) => c.at)));
const signIn = named("details");
check("a modal a press opens is a state of its own: the dialog's words, and not the whole page restated", !!signIn && signIn.shows.map((id) => words(byId.get(id))).some((w) => /connect a wallet/.test(w)) && signIn.hides.length <= 3, JSON.stringify(signIn && [signIn.shows.length, signIn.hides.length]));
const pupCard = (pup?.shows ?? []).map((id) => byId.get(id)).find((n) => n?.colour?.bg === "rgb(255, 212, 59)");
check("the chosen card keeps its tilt under the pointer: a hover rule the cascade overrides is not carried", !!pupCard && /matrix/.test(pupCard.art?.transform ?? "") && !(pupCard.motion?.hover ?? []).some((h) => h.style?.transform), JSON.stringify(pupCard && [pupCard.art, pupCard.motion?.hover]));
check("an unchosen card keeps its hover lift", doc.nodes.some((n) => !n.state && (n.motion?.hover ?? []).some((h) => /translateY/.test(h.style?.transform ?? ""))), "");
check("words for a screen reader only (a 1×1 clipped box) are no part", !doc.nodes.some((n) => /still an egg|yum/.test(words(n))), JSON.stringify(doc.nodes.filter((n) => /egg|yum/.test(words(n))).map((n) => [words(n), n.x, n.y])));
const feed = named("feed");
const screen = (feed?.shows ?? []).map((id) => byId.get(id)).find((n) => n?.featureId === "picture" && n.w === 96);
check("pressing feed shows the screen answering it, played as its frames", !!screen && screen.picture?.type === "image/svg+xml", JSON.stringify(feed && feed.shows.map((id) => [byId.get(id)?.featureId, byId.get(id)?.w, byId.get(id)?.picture?.type])));
const pupLcd = (pup?.shows ?? []).map((id) => byId.get(id)).find((n) => n?.featureId === "picture" && n.w === 96);
const screenSvg = screen?.picture?.path ? readFileSync(join(work, "out", screen.picture.path), "utf8") : "";
check("…once, from the press, holding its last picture: not looping", /1 forwards/.test(screenSvg) && !/infinite/.test(screenSvg), screenSvg.slice(0, 200));
check("a canvas far from the press, repainting on its own, is not said to change with it", !pupLcd, JSON.stringify(pupLcd?.picture));
check("a remembered switch pressed first does not open every later press in its state: the cards are still read (the theme is the first group)", cap.states?.some((s) => s.name === "pup") && cap.states.find((s) => s.name === "pup").changes.length < 10, JSON.stringify((cap.states ?? []).map((s) => [s.name, s.changes.length])));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
