/**
 * A CANVAS WORLD'S CHARACTERS, AND WHAT EACH ONE OPENS (worlds.mjs).
 *
 * parasiteonsol.fun walks its coins as pets on a canvas; pressing one opens
 * that coin's dialog. The capture kept the canvas as a flipbook with nothing
 * to press. On a stand-in page (all STANDIN data) with a canvas world of four
 * characters, two that open a dialog,
 * one that goes to another page of the site and one that goes off it,
 * and a canvas that repaints with nothing to press:
 *
 *   (1) the world's part carries `world`: every character, and for each frame
 *       of the flipbook where it stood, matching the pixels the frame shows;
 *   (2) each dialog as the page drew it: its words, its controls with their
 *       own attributes and a name for a backend (`data-world-control`), the
 *       close control marked, its look as classes with the CSS they stand
 *       for, its backdrop, its picture carried; nothing in it that runs;
 *   (3) the character that led to another page is a link to its path; the
 *       one that led off the site is no link, the address kept as data;
 *       every control does what it did on live where it stays on the site,
 *       and stays an inert hook where it needs a wallet, a server or leaves
 *       the site, nothing ever sent;
 *   (4) the page is read as it was: no dialog left open, no part made of one;
 *   (5) a canvas that repaints with nothing to press stays a flipbook;
 *   (6) the ledger and `behaviours.worlds` say so.
 *
 *   node capture/site/capture/check-worlds.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 500)}`}`);
};
/* A 2×2 PNG, the coin's picture in its dialog. */
const ICON = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#f4f1e8;font:14px monospace}
.dlg{width:360px;padding:18px;border:3px solid rgb(43, 29, 46);background:rgb(255, 250, 240);color:rgb(43, 29, 46)}
.dlg::backdrop{background:rgba(20, 10, 30, 0.6)}
.dlg-x{position:absolute;top:8px;right:8px;background:#fff;border:2px solid rgb(43, 29, 46)}
.rt{display:block;width:100%;height:40px;background:rgb(255, 80, 150);color:#fff;border:0;font:inherit}
.seg button{background:#fff;border:2px solid rgb(43, 29, 46)}
</style></head><body>
<h1 style="margin:20px">STANDIN colony</h1>
<div id="stage" style="margin:20px"><div id="tabs"><button type="button" role="tab" aria-selected="true" data-loc="0">Swamp</button><button type="button" role="tab" aria-selected="false" data-loc="1">Beach</button></div>
<canvas id="world" width="200" height="100" style="display:block;width:80vw;image-rendering:pixelated"></canvas></div>
<canvas id="noise" width="60" height="30" style="display:block;width:240px;height:120px;margin:20px"></canvas>
<dialog id="dlg" class="dlg"></dialog>
<script>
const chars = [
  { id: "STANDIN_MINT_A", t: "$STANDA", c: "#ff0000", x: 10, y: 40, vx: 1, label: true },
  { id: "STANDIN_MINT_B", t: "$STANDB", c: "#0000ff", x: 120, y: 60, vx: -1, label: true },
  { id: "STANDIN_MINT_C", t: "$STANDC", c: "#00ff00", x: 80, y: 10, vx: 0.5, go: "/coin/" },
  { id: "STANDIN_MINT_D", t: "$STANDD", c: "#ffff00", x: 150, y: 82, vx: -0.5, go: "https://STANDIN.example/coin/" },
];
/* A rider on A (a parasite on its host), and the beach's own pet. */
const rider = { id: "STANDIN_MINT_R", t: "$STANDR", c: "#00ffff", on: chars[0], dx: 3, dy: -3 };
const beachPet = { id: "STANDIN_MINT_E", t: "$STANDE", c: "#ff8800", x: 60, y: 60, vx: 0.5 };
/* Two hosts standing still, the smaller in the row behind, overlapping the bigger: neighbours, not a rider on its host. */
const front = { id: "STANDIN_MINT_H", t: "$STANDH", c: "#008888", x: 90, y: 22, vx: 0 };
const backRow = { id: "STANDIN_MINT_F", t: "$STANDF", c: "#8800ff", x: 92, y: 14, vx: 0 };
const sheet = document.createElement("canvas"); sheet.width = 80; sheet.height = 10;
const s = sheet.getContext("2d");
[...chars, beachPet].forEach((ch, i) => { s.fillStyle = ch.c; s.fillRect(i * 10, 0, 10, 10); });
s.fillStyle = rider.c; s.fillRect(50, 0, 4, 3);
s.fillStyle = backRow.c; s.fillRect(0, 0, 0, 0);
const sheet2 = document.createElement("canvas"); sheet2.width = 28; sheet2.height = 14; const s2 = sheet2.getContext("2d"); s2.fillStyle = backRow.c; s2.fillRect(0, 0, 12, 10); s2.fillStyle = front.c; s2.fillRect(12, 0, 16, 14);
s.fillStyle = "#884400"; s.fillRect(60, 0, 6, 6); s.fillStyle = "#aa6600"; s.fillRect(70, 0, 6, 6);
const tile = (c) => { const t = document.createElement("canvas"); t.width = 100; t.height = 24; const q = t.getContext("2d"); q.fillStyle = c; q.fillRect(0, 0, 100, 24); q.fillStyle = "#222222"; q.fillRect(0, 0, 100, 1); return t; };
const grounds = [tile("#6a9955"), tile("#e0c890")];
let scene = 0;
const g = world.getContext("2d");
/* The page's own scale: its pixels 2, 4 or 5 CSS pixels wide as the box grows, the canvas as wide as that leaves. */
const fit = () => { const w = world.getBoundingClientRect().width, S = w < 700 ? 2 : w > 1500 ? 5 : 4; world.width = Math.ceil(w / S); world.height = 100; world.style.height = (100 * S) + "px"; world.dataset.s = S; };
new ResizeObserver(fit).observe(world); fit();
(function draw(now) {
  const W = world.width, H = world.height;
  g.fillStyle = scene ? "#bde0ff" : "#cfe8c0"; g.fillRect(0, 0, W, H);
  for (let d = Math.round((W - 100) / 2) % 100 - 100; d < W; d += 100) g.drawImage(grounds[scene], d, H - 24);
  if (!scene) {
    const k = Math.floor((now || 0) / 250) % 2;
    g.drawImage(sheet, k ? 70 : 60, 0, 6, 6, W - 12, H - 26, 6, 6);
    g.drawImage(sheet2, 0, 0, 12, 10, backRow.x, backRow.y, 12, 10);
    g.drawImage(sheet2, 12, 0, 16, 14, front.x, front.y, 16, 14);
    chars.forEach((ch, i) => { ch.x += ch.vx; if (ch.x > 185 || ch.x < 5) ch.vx = -ch.vx; g.drawImage(sheet, i * 10, 0, 10, 10, Math.round(ch.x), ch.y, 10, 10); });
    g.drawImage(sheet, 50, 0, 4, 3, Math.round(rider.on.x) + rider.dx, rider.on.y + rider.dy, 4, 3);
    g.font = "8px monospace"; g.textBaseline = "top";
    chars.filter((ch) => ch.label).forEach((ch) => { const w = Math.ceil(g.measureText(ch.t).width) + 4, x = Math.round(ch.x + 5 - w / 2), y = ch.y - 16; g.fillStyle = "#000000"; g.fillRect(x - 1, y - 1, w + 2, 11); g.fillStyle = "#ffffff"; g.fillRect(x, y, w, 9); g.fillStyle = "#111111"; g.fillText(ch.t, x + 2, y + 1); });
  } else {
    beachPet.x += beachPet.vx; if (beachPet.x > 150 || beachPet.x < 20) beachPet.vx = -beachPet.vx;
    g.drawImage(sheet, 40, 0, 10, 10, Math.round(beachPet.x), beachPet.y, 10, 10);
  }
  requestAnimationFrame(draw);
})();
tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-loc]"); if (!b) return; scene = +b.dataset.loc; tabs.querySelectorAll("[data-loc]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); });
const n = noise.getContext("2d");
(function fizz() { for (let i = 0; i < 40; i++) { n.fillStyle = "hsl(" + (Math.random() * 360) + ",60%,60%)"; n.fillRect(Math.random() * 60, Math.random() * 30, 3, 3); } requestAnimationFrame(fizz); })();
world.addEventListener("click", (e) => {
  const r = world.getBoundingClientRect(), S = +world.dataset.s, x = (e.clientX - r.left) / S, y = (e.clientY - r.top) / S;
  const rx = Math.round(rider.on.x) + rider.dx, ry = rider.on.y + rider.dy;
  const list = scene ? [beachPet] : chars;
  const ch = !scene && x >= rx - 2 && x <= rx + 6 && y >= ry - 2 && y <= ry + 5 ? rider : list.find((ch) => x >= Math.round(ch.x) - 2 && x <= Math.round(ch.x) + 12 && y >= ch.y - 2 && y <= ch.y + 12) || (!scene && x >= front.x - 2 && x <= front.x + 18 && y >= front.y && y <= front.y + 16 ? front : null) || (!scene && x >= backRow.x - 2 && x <= backRow.x + 14 && y >= backRow.y - 2 && y <= backRow.y + 12 ? backRow : null);
  if (!ch) return;
  if (ch.go) { location.href = ch.go + ch.id; return; }
  dlg.dataset.mint = ch.id;
  dlg.innerHTML = '<button class="dlg-x" type="button" data-close aria-label="Close">&times;</button>'
    + '<img src="/icon.png" width="42" height="42" alt="' + ch.t + '"><p>Parasite</p><h2 id="pd-h">' + ch.t + '</h2>'
    + '<label><input data-bsol-in type="text" value="0.5" aria-label="Amount in SOL"><span>SOL</span></label>'
    + '<div class="seg" role="radiogroup">' + ["0.1", "0.5", "1"].map((v) => '<button type="button" role="radio" data-bsol="' + v + '" aria-checked="' + (v === "0.5") + '">' + v + '</button>').join("") + '</div>'
    + '<button class="rt" type="button" data-buysol onclick="window.__bought = 1">Buy with SOL</button>'
    + '<button type="button" data-quote>Get a quote</button>'
    + '<details><summary>Sell</summary><button type="button" data-side="sell">Sell for ' + ch.t + '</button></details>'
    + '<div role="tablist"><button type="button" role="tab" data-tab="stats" aria-selected="true">Stats</button><button type="button" role="tab" data-tab="holders" aria-selected="false">Holders</button></div>'
    + '<p data-panel>STANDIN stats</p>'
    + '<form action="/buy" method="post"><input name="note" placeholder="STANDIN note"><button>Send note</button></form>'
    + '<dl><dt>Price</dt><dd>STANDIN SOL</dd><dt>CA</dt><dd><button type="button" data-cca="' + ch.id + '">Copy CA</button><a href="https://dexscreener.com/solana/' + ch.id + '">dexscreener</a> <a href="/h/' + ch.id + '">Host page</a></dd></dl>'
    + '<button type="button" data-open="' + ch.id + '">Open coin</button>'
    + '<button type="button" data-sheet="' + ch.id + '">Share sheet</button><button type="button" data-copylink="' + ch.id + '">Copy link</button>'
    + '<button class="rt" type="button" data-share="' + ch.id + '">Share</button>';
  dlg.showModal();
});
dlg.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("[data-close]")) return dlg.close();
  const preset = t.closest("[data-bsol]");
  if (preset) { dlg.querySelectorAll("[data-bsol]").forEach((b) => b.setAttribute("aria-checked", String(b === preset))); dlg.querySelector("[data-bsol-in]").value = preset.dataset.bsol; return; }
  const tab = t.closest("[role=tab]");
  if (tab) { dlg.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b === tab))); dlg.querySelector("[data-panel]").textContent = "STANDIN " + tab.dataset.tab; return; }
  if (t.closest("[data-cca]")) return navigator.clipboard.writeText(t.closest("[data-cca]").dataset.cca).catch(() => {});
  if (t.closest("[data-share]")) return window.open("https://x.com/intent/post?text=" + encodeURIComponent("STANDIN " + dlg.dataset.mint), "_blank");
  if (t.closest("[data-sheet]")) return navigator.share({ title: "STANDIN", url: location.origin + "/h/" + dlg.dataset.mint }).catch(() => {});
  if (t.closest("[data-copylink]")) return navigator.clipboard.writeText(location.origin + "/h/" + dlg.dataset.mint).catch(() => {});
  if (t.closest("[data-open]")) { location.href = "/coin/" + t.closest("[data-open]").dataset.open; return; }
  if (t.closest("[data-quote]")) return fetch("/api/quote/" + dlg.dataset.mint + "?amount=0.5&slip=100", { method: "POST", body: "{}" }).catch(() => {});
  if (t.closest("[data-buysol]")) { fetch("/api/pressed/buy").catch(() => {}); const w = document.createElement("dialog"); w.innerHTML = "<h3>Connect a wallet</h3><button>Phantom</button>"; document.body.appendChild(w); w.showModal(); }
});
/* The page's own chain poll, pressed or not. */
setInterval(() => fetch("/api/rpc", { method: "POST", body: JSON.stringify({ method: "getSlot" }) }).catch(() => {}), 250);
</script></body></html>`;
const writes = [], pressed = [];
const server = createServer((req, res) => {
  if (req.url.startsWith("/api/pressed/")) pressed.push(req.url);
  if (req.method !== "GET" && req.method !== "HEAD" && req.url !== "/api/rpc") writes.push(`${req.method} ${req.url}`);
  if (req.url === "/api/rpc") { res.writeHead(200, { "content-type": "application/json" }); return res.end('{"result":1}'); }
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  if (req.url === "/icon.png") { res.writeHead(200, { "content-type": "image/png" }); return res.end(ICON); }
  res.writeHead(404, { "content-type": "text/html" }); res.end("<p>STANDIN elsewhere</p>");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-worlds-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "1", "--world-frames", "6", "--world-every", "150"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
if (process.env.DEBUG) console.log(cap.err.split("\n").filter((l) => /world|scene/.test(l)).join("\n"));
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").slice(-14).join(" | "));
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const raw = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : { tree: {} };
let el = null, noiseEl = null;
(function walk(e) { if (e.t === "canvas" && e.w === 800) el = e; if (e.t === "canvas" && e.w === 240) noiseEl = e; (e.kids ?? []).forEach(walk); })(raw.tree ?? {});
const node = doc.nodes.find((n) => n.world);
const w = node?.world;

/* (1) */
check("the world is a picture part carrying its characters", !!node && node.featureId === "picture" && /canvas/.test(node.label ?? "") && w?.chars?.length === 8, JSON.stringify(doc.nodes.map((n) => [n.id, n.featureId, n.label, !!n.world])));
check("…over the frames it was read in, each standing as long as asked", w?.frames === 6 && w?.every === 150 && el?.frames?.frames?.length === 6 && el?.frames?.steps?.every(([, d]) => d === 150), JSON.stringify({ frames: w?.frames, every: w?.every, steps: el?.frames?.steps }));
const A = w?.chars.find((c) => /STANDIN_MINT_A/.test(c.key)), B = w?.chars.find((c) => /STANDIN_MINT_B/.test(c.key)), C = w?.chars.find((c) => c.href), D = w?.chars.find((c) => c.offsite);
/* Where each character's colour is in each frame's own pixels, read in a browser. */
const req = createRequire(import.meta.url);
const { chromium } = (() => { for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) { try { return req(c); } catch { /* next */ } } throw new Error("No Playwright found."); })();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", headless: true });
const truth = [];
try {
  const tab = await browser.newPage();
  for (const url of el?.frames?.frames ?? []) {
    truth.push(await tab.evaluate(async (url) => {
      const im = new Image(); im.src = url; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const out = {};
      for (const [k, rgb] of Object.entries({ A: [255, 0, 0], B: [0, 0, 255], C: [0, 255, 0] })) {
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
        out[k] = x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
      }
      return out;
    }, url));
  }
} finally { await browser.close(); }
/* The recorded box is the sprite with two canvas pixels round it, as fractions of the 200×100 canvas. */
const agrees = (c, k) => truth.length === 6 && truth.every((t, f) => { const b = c?.boxes?.[f], p = t[k]; if (!b || !p) return false; return Math.abs(b[0] * 200 + 2 - p[0]) <= 1.5 && Math.abs(b[1] * 100 + 2 - p[1]) <= 1.5 && Math.abs(b[2] * 200 - 4 - p[2]) <= 1.5 && Math.abs(b[3] * 100 - 4 - p[3]) <= 1.5; });
check("character A's place in every frame is where that frame shows it", agrees(A, "A"), JSON.stringify({ boxes: A?.boxes, truth: truth.map((t) => t.A) }));
check("…and character B's", agrees(B, "B"), JSON.stringify({ boxes: B?.boxes, truth: truth.map((t) => t.B) }));
check("…and they moved: a world, not a still", new Set((A?.boxes ?? []).map((b) => b?.[0])).size > 2, JSON.stringify(A?.boxes));

/* (2) */
const dA = Number.isInteger(A?.dialog) ? w.dialogs[A.dialog] : null;
const html = dA?.html ?? "";
check("A opens its own dialog, named by the page's own id for it and its heading", /STANDIN_MINT_A/.test(A?.key ?? "") && A?.name === "$STANDA" && /data-mint="STANDIN_MINT_A"/.test(html) && B?.dialog !== A?.dialog, JSON.stringify({ A: A?.key, B: B?.key }));
check("…with its words and every control, each keeping the page's own attributes", ["Buy with SOL", "Sell for $STANDA", "Share", "dexscreener", "STANDIN SOL", 'data-buysol=""', 'data-bsol="0.1"', 'data-side="sell"', 'data-share="STANDIN_MINT_A"', 'value="0.5"', 'aria-label="Amount in SOL"'].every((s) => html.includes(s)), html.slice(0, 600));
check("…each named for a backend to find", ['data-world-control="buy-with-sol"', 'data-world-control="amount-in-sol"', 'data-world-control="0-1"', 'data-world-control="sell"', 'data-world-control="share"', 'data-world-control="dexscreener"'].every((s) => html.includes(s)), (html.match(/data-world-control="[^"]*"/g) ?? []).join(" "));
check("…the close button marked as closing it", /<button[^>]*aria-label="Close"[^>]*data-world-close=""/.test(html), (html.match(/<button[^>]*Close[^>]*>/) ?? [""])[0]);
check("…nothing in it runs or sends: no handler, a form with no address, every button a plain button", !/onclick|<script/i.test(html) && !/action="/.test(html) && /<form[^>]*data-world-form=""/.test(html) && !(html.match(/<button\b[^>]*>/g) ?? []).some((b) => !/type="button"/.test(b)), (html.match(/<form[^>]*>|onclick="[^"]*"/g) ?? []).join(" "));
check("…a link within the site stays a link, by its path", /<a[^>]*href="\/h\/STANDIN_MINT_A"/.test(html), (html.match(/<a[^>]*>/g) ?? []).join(" "));
{
  const dex = (html.match(/<a\b[^>]*data-world-control="dexscreener"[^>]*>/) ?? [""])[0];
  check("…one off the site is no link: inert, its stable name kept, where it went only as data", !/\shref=/.test(dex) && /data-world-does="hook"/.test(dex) && /data-world-offsite="https:\/\/dexscreener\.com\/solana\/STANDIN_MINT_A"/.test(dex), dex);
  check("…and no off-site address is a link anywhere in the dialog", !/\shref="(https?:)?\/\//.test(html), (html.match(/\shref="[^"]*"/g) ?? []).join(" "));
}
check("…its picture carried as a data address", /<img[^>]*src="data:image\//.test(html), (html.match(/<img[^>]*>/) ?? [""])[0].slice(0, 200));
const cls = (re) => { const m = new RegExp(`<${re}[^>]*class="([^"]+)"`).exec(html); return m ? m[1].split(/\s+/)[0] : null; };
const dialogLook = w?.css?.[cls("dialog")] ?? "", buyLook = w?.css?.[(/<button[^>]*class="([^" ]+)[^"]*"[^>]*data-world-control="buy-with-sol"/.exec(html) ?? [])[1]] ?? "";
check("…dressed as the page drew it: the dialog's paint and edge, the buy button's fill", /background-color:rgb\(255, 250, 240\)/.test(dialogLook) && /border-top-width:3px/.test(dialogLook) && /width:\d/.test(dialogLook) && /background-color:rgb\(255, 80, 150\)/.test(buyLook), JSON.stringify({ dialogLook: dialogLook.slice(0, 300), buyLook: buyLook.slice(0, 300), buy: (html.match(/<button[^>]*buy-with-sol[^>]*>/) ?? [""])[0] }));
check("…a closed dialog's own display is the browser's, so it stays closed where it lands", !/(^|;)display:/.test(dialogLook) && !/(^|;)position:/.test(dialogLook), dialogLook.slice(0, 200));
check("…with its backdrop", dA?.backdrop === "background-color:rgba(20, 10, 30, 0.6)", dA?.backdrop);
check("…and only the looks its dialogs wear are carried", Object.keys(w?.css ?? {}).length > 3 && Object.keys(w.css).every((c) => w.dialogs.some((d) => d.html.includes(c))), Object.keys(w?.css ?? {}).length);

/* (2b) What each control did on live, done again where it can be; a hook where it needs a wallet or a server. */
const tagOf = (re) => (html.match(new RegExp(`<[a-z]+\\b[^>]*${re}[^>]*>`)) ?? [""])[0];
const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : null; };
const preset = tagOf('data-bsol="0\\.1"');
const change = JSON.parse(attr(preset, "data-world-change") ?? "[]");
check("a preset fills the amount box and marks itself chosen, as on live (a change to replay)", attr(preset, "data-world-does") === "ui" && change.some((c) => c.v === "0.1") && change.some((c) => c.a?.["aria-checked"] === "true") && change.some((c) => c.a?.["aria-checked"] === "false"), JSON.stringify({ preset, change }));
check("…each element it changes findable by its place", change.every((c) => html.includes(`data-world-el="${c.e}"`)), JSON.stringify(change.map((c) => c.e)));
const tab = tagOf('data-tab="holders"');
check("a tab switches, words and all", attr(tab, "data-world-does") === "ui" && JSON.parse(attr(tab, "data-world-change") ?? "[]").some((c) => c.t === "STANDIN holders"), tab);
const copy = tagOf("data-cca=");
check("Copy CA copies the address", attr(copy, "data-world-does") === "copy" && attr(copy, "data-world-copy") === "STANDIN_MINT_A", copy);
const share = tagOf("data-share=");
check("Share, which opened a window off the site (an intent), stays inert, the address it opened kept as data", attr(share, "data-world-does") === "hook" && /^https:\/\/x\.com\/intent\/post\?text=STANDIN%20STANDIN_MINT_A$/.test(attr(share, "data-world-offsite") ?? "") && !attr(share, "data-world-href"), share);
const sheet = tagOf("data-sheet=");
check("a Share sheet for the site's own page is kept with that page as its path, for the allow-list to let run", attr(sheet, "data-world-does") === "hook" && JSON.parse(attr(sheet, "data-world-share") ?? "{}").url === "/h/STANDIN_MINT_A", sheet);
const copyLink = tagOf("data-copylink=");
check("a copied link to the site's own page is kept as its path too, so a copy of the site copies its own address", attr(copyLink, "data-world-does") === "copy" && attr(copyLink, "data-world-copy-path") === "/h/STANDIN_MINT_A", copyLink);
const go = tagOf("data-open=");
check("a button that goes to another page of the site is a link to it, by its path", attr(go, "data-world-does") === "link" && attr(go, "data-world-href") === "/coin/STANDIN_MINT_A", go);
const buy = tagOf("data-buysol=");
check("Buy with SOL is never pressed (its words read as spending): held for a wallet, and the page never heard it", attr(buy, "data-world-does") === "hook" && attr(buy, "data-world-held") === "wallet" && /^not pressed/.test(attr(buy, "data-world-hook") ?? "") && !pressed.length, `${buy} ${pressed.join(",")}`);
const quote = tagOf("data-quote=");
check("a press read as harmless that still tried to write is stopped there and held, naming where, its values left out", attr(quote, "data-world-does") === "hook" && attr(quote, "data-world-held") === "server-call" && attr(quote, "data-world-hook") === `POST ${origin.replace(/^https?:\/\//, "")}/api/quote/:id?amount=…&slip=…`, quote);
const send = tagOf('data-world-control="send-note"');
check("a form's own button is never pressed: held as a server call", attr(send, "data-world-does") === "hook" && attr(send, "data-world-held") === "server-call" && /not pressed: it sends a form/.test(attr(send, "data-world-hook") ?? ""), send);
check("the Sell toggle and the amount box are the browser's own", attr(tagOf('data-world-control="sell"'), "data-world-does") === "native" && attr(tagOf('data-world-control="amount-in-sol"'), "data-world-does") === "native");
check("the close button closes", attr(tagOf("data-world-close="), "data-world-does") === "close");
check("the page's own chain poll is nobody's press", !/api\/rpc/.test(html), (html.match(/data-world-(hook|reads)="[^"]*rpc[^"]*"/) ?? [""])[0]);
check("nothing was ever sent: no form, no write reached the server", !writes.length, writes.join(", "));

/* (2c) Everything held back, gathered for the owner to choose from later. */
{
  const held = doc.held ?? [];
  const find = (control) => held.find((h) => h.control === control && h.character.some((k) => /STANDIN_MINT_A/.test(k)));
  const buyH = find("buy-with-sol"), sendH = find("send-note"), dexH = find("dexscreener"), shareH = find("share");
  check("doc.held lists each control held back, with why, its page, part, character, stable name and a selector", buyH?.held === "wallet" && sendH?.held === "server-call" && dexH?.held === "off-site" && shareH?.held === "off-site" && buyH.page === "page_home" && buyH.part === node?.id && buyH.selector === `#${node?.id} dialog[data-world-dialog="${A?.dialog}"] [data-world-control="buy-with-sol"]` && buyH.attrs.includes("data-buysol"), JSON.stringify(held.slice(0, 6)));
  check("…and the character that led off the site", held.some((h) => h.held === "off-site" && h.offsite === "https://standin.example/coin/STANDIN_MINT_D" && /data-world-hit/.test(h.selector)), JSON.stringify(held.filter((h) => /hit/.test(h.selector))));
  check("…while client-only presses are not held (a preset, a tab, a copy)", !held.some((h) => ["0-1", "holders", "copy-ca"].includes(h.control)));
}

/* (7) What the world is made of, for polio to draw it again live at any width (stage.mjs). */
{
  const st = w?.stage;
  const R = w?.chars.find((c) => /STANDIN_MINT_R/.test(c.key)), E2 = w?.chars.find((c) => /STANDIN_MINT_E/.test(c.key));
  const iA = w?.chars.indexOf(A);
  check("the world carries a stage: two scenes, each its own fill, and its ground as the page painted it at each scale (2, 4, 5)", st?.scenes?.length === 2 && st.scenes[0].sky === "#cfe8c0" && st.scenes[1].sky === "#bde0ff" && st.scenes.every((sc) => JSON.stringify(sc.backgrounds?.map((g) => g.px)) === "[2,4,5]" && sc.backgrounds.every((g) => g.h === 100 && g.w > 0)), JSON.stringify(st?.scenes?.map((sc) => ({ sky: sc.sky, backgrounds: sc.backgrounds }))));
  const tabs = st?.scenes?.map((sc) => doc.nodes.find((n) => n.id === sc.tab));
  check("…each scene's tab is the part the page's tab became", tabs?.length === 2 && tabs.every(Boolean) && /Swamp/.test(JSON.stringify(tabs[0].content) + tabs[0].label) && /Beach/.test(JSON.stringify(tabs[1].content) + tabs[1].label), JSON.stringify(st?.scenes?.map((sc) => sc.tab)));
  check("…the beach's own pet belongs to the beach", E2?.scene === 1 && A?.scene === 0, JSON.stringify({ E: E2?.scene, A: A?.scene }));
  const spA = A?.sprite && st?.sprites[A.sprite.r ?? A.sprite.l];
  check("a character's sprite is its own piece of the sheet, its size as drawn", !!spA && spA[3] === 10 && spA[4] === 10, JSON.stringify({ sprite: A?.sprite, spA }));
  check("…its home, its range, its foot and its pace, from how it moved", A?.at > 0 && A?.at < 1 && A?.range > 0.02 && A?.foot === 100 - 50 && A?.speed > 5, JSON.stringify({ at: A?.at, range: A?.range, foot: A?.foot, speed: A?.speed }));
  check("the rider rides its host, where it sat", R?.rides === iA && JSON.stringify(R?.ride) === "[3,-3]", JSON.stringify({ rides: R?.rides, iA, ride: R?.ride }));
  const F = w?.chars.find((c) => /STANDIN_MINT_F/.test(c.key));
  check("a host standing still in the row behind another, overlapping it, is its own walker with its own foot, not a rider", !!F && F.rides === undefined && F.foot === 100 - 24, JSON.stringify(F && { rides: F.rides, foot: F.foot, ride: F.ride }));
  check("the words drawn over a host are its label, in the page's face and colours", A?.label === "$STANDA" && /monospace/.test(st?.label?.font ?? "") && st?.label?.bg === "#ffffff" && st?.label?.edge === "#000000" && st?.label?.fg === "#111111" && st?.label?.h === 9, JSON.stringify({ label: A?.label, style: st?.label }));
  /* The grounds, read in a browser: no character, rider or label in them; the ground's own colours, the prop standing in it. */
  const grounds = [];
  {
    const b2 = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", headless: true });
    const tab = await b2.newPage();
    for (const [n, sc] of (st?.scenes ?? []).entries()) for (const g of sc.backgrounds ?? []) grounds.push({ n, px: g.px, ...(await tab.evaluate(async (url) => {
      const im = new Image(); im.src = url; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const q = c.getContext("2d"); q.drawImage(im, 0, 0);
      const d = q.getImageData(0, 0, c.width, c.height).data, has = (r, g, b) => { for (let i = 0; i < d.length; i += 4) if (d[i] === r && d[i + 1] === g && d[i + 2] === b) return true; return false; };
      return { chars: has(255, 0, 0) || has(0, 0, 255) || has(0, 255, 255) || has(255, 136, 0), label: has(255, 255, 255) || has(17, 17, 17), ground: has(106, 153, 85) || has(224, 200, 144), prop: has(136, 68, 0) || has(170, 102, 0) };
    }, st.images[g.img])) });
    await b2.close();
  }
  check("…with its characters, riders and labels left out, and what stands in it (the prop) kept", grounds.length === 6 && grounds.every((g) => !g.chars && !g.label && g.ground) && grounds.filter((g) => g.n === 0).every((g) => g.prop), JSON.stringify(grounds));
  check("the page's scale at each width it was seen at: 2, 4 and 5 CSS pixels a canvas pixel", JSON.stringify((st?.scaleAt ?? []).map((p) => p[1])) === "[2,4,5]" && st?.px === 4, JSON.stringify({ scaleAt: st?.scaleAt, px: st?.px }));
  check("its pictures are carried whole in the document, cut to the pieces it uses", st?.images?.length >= 2 && st.images.every((u) => /^data:image\/png;base64,/.test(u)), JSON.stringify(st?.images?.map((u) => u.slice(0, 30))));
  check("the document's picture of it is a still, not a flipbook: the engine does the moving", node?.picture && !/svg/.test(node.picture.type ?? "") && !/frames/.test(node.label ?? ""), JSON.stringify({ label: node?.label, type: node?.picture?.type }));
}

/* (3) */
check("the character that led away is a link to the path it went to, with no dialog", C?.href === "/coin/STANDIN_MINT_C" && C?.dialog === undefined, JSON.stringify(C));
check("one that led off the site is no link: where it went kept only as data", D?.offsite === "https://standin.example/coin/STANDIN_MINT_D" && !D?.href && D?.dialog === undefined, JSON.stringify(D));

/* (4) */
check("the page is read as it was: no part made of a dialog, no dialog words on it", !doc.nodes.some((n) => /Buy with SOL|\$STANDA|STANDIN SOL/.test(JSON.stringify(n.content ?? "") + (n.label ?? ""))), doc.nodes.filter((n) => /Buy with SOL|\$STANDA/.test(JSON.stringify(n.content ?? ""))).map((n) => n.id).join(","));

/* (5) */
const noise = doc.nodes.find((n) => n.w === 240 && /canvas/.test(n.from?.selector ?? ""));
check("a canvas that repaints with nothing to press stays a flipbook, with no world", !!noiseEl?.frames && !noiseEl?.world && !!noise && !noise.world, JSON.stringify({ frames: !!noiseEl?.frames, world: !!noiseEl?.world, node: noise?.id }));

/* (6) */
const ledger = existsSync(join(work, "out", "site", "ledger.json")) ? readFileSync(join(work, "out", "site", "ledger.json"), "utf8") : readFileSync(join(work, "out", "ledger.json"), "utf8");
check("the ledger says what the world became", /node\.world: 8 characters to press over 6 frames of 150ms, 1 of them links within the site, 1 off it, 6 dialogs/.test(ledger), (ledger.match(/node\.world[^"]*/) ?? ["no line"])[0]);
check("behaviours.worlds names the part, for polio to give it its feature", doc.behaviours?.worlds?.length === 1 && doc.behaviours.worlds[0].part === node?.id, JSON.stringify(doc.behaviours?.worlds));
/* A pet walking is followed from frame to frame, not pressed again each frame (worlds.mjs); where each stood is still checked above. */
check("a walking pet is followed, not pressed every frame", (raw.worldStats?.assumed ?? 0) > 0 && raw.worldStats.pressed < raw.worldStats.pressed + raw.worldStats.assumed, JSON.stringify(raw.worldStats));
/* The pets' dialogs are laid out alike: one's controls were pressed, the others told from it (worlds.mjs, NO PRESS TWICE), and the document says how many. */
check("dialogs laid out alike are pressed once and the rest told, said in behaviours.worlds", (doc.behaviours?.worlds?.[0]?.toldDialogs ?? 0) >= 1 && (raw.worldStats?.probedDialogs ?? 99) < (w?.dialogs?.length ?? 0), JSON.stringify({ worlds: doc.behaviours?.worlds, stats: raw.worldStats, dialogs: w?.dialogs?.length }));

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
