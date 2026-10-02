#!/usr/bin/env node
/**
 * THE NETWORK RECORDER, THE HELD PRESSES AND LEARN ON CLICK, on a stand-in
 * site (all STANDIN data) served here:
 *
 *   (1) the API map: every data request the page made on its own, one entry
 *       an endpoint, values redacted (no key anywhere), ids in a path as
 *       `:id`, a JSON-RPC (remote procedure call) read told from a write,
 *       how often a poll came back, a sample of each read cut short;
 *   (2) an automatic capture only looks: a form's button, words that spend or
 *       connect, and a press that tried to write are held with their part
 *       and their place on the live page; the terms gate is hidden, never
 *       agreed to; no write a press would make ever reached the server;
 *   (3) the document says the capturer can Learn;
 *   (4) the learn input is read strictly: one press a control, stopping on a
 *       wallet, a wallet control never pressed, within the cap;
 *   (5) a Learn run presses only what was chosen, once each, 2 s apart, with
 *       the owner's values, records what it asked and what came back and the
 *       screen it left, and reports `doc.learned`; the owner's values are
 *       kept nowhere;
 *   (6) a wallet prompt ends the run there;
 *   (7) a control inside a canvas world's dialog is held with its place in
 *       the dialog, and Learn reaches it as the capture did: the world's
 *       frames held, its characters pressed until the named one's dialog
 *       opens (nothing sent while it looks), the control pressed by its
 *       place, once; the dialog's wallet control is never pressed;
 *   (8) a live feed, read only: a WebSocket's and an EventSource's messages
 *       kept (at most 50, shape, pace, secrets out, the address redacted),
 *       what the page sent on the socket kept as its shape, and nothing sent
 *       on it but what the page itself sent.
 *
 *   node capture/site/capture/check-network.mjs
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLearn, planLearn, withLearned } from "./learn.mjs";
import { redactUrl, isRead, mapOf } from "./network.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`);
};
const J = (x) => JSON.stringify(x);
const KEY = "STANDIN_KEY_NOT_REAL_0123456789";

/* The pure half first. */
{
  const r = redactUrl(`https://api.standin.example/v1/coins/STANDIN0MINT0ADDRESS0000000001/holders?api-key=${KEY}&limit=20`);
  check("an address: its values out, an id in the path is :id, a key nowhere", r.url === "https://api.standin.example/v1/coins/:id/holders?api-key=…&limit=…" && !J(r).includes(KEY), r.url);
  check("a JSON-RPC read is a read, a send is a write, a GraphQL mutation is a write", isRead("POST", J({ method: "getBalance" })) && !isRead("POST", J({ method: "sendTransaction" })) && !isRead("POST", J({ query: "mutation Vote { vote }" })) && isRead("POST", J({ query: "query Coins { coins }" })) && !isRead("POST", "a=1"));
  const m = mapOf([
    { method: "GET", url: `https://x.standin.example/p?k=${KEY}`, t: 0, phase: "load", status: 200, json: { list: Array.from({ length: 60 }, (_, i) => ({ i, secret: KEY })) } },
    { method: "GET", url: `https://x.standin.example/p?k=other`, t: 1000, phase: "open", status: 200 },
    { method: "GET", url: `https://x.standin.example/p?k=third`, t: 2000, phase: "open", status: 200 },
    { method: "GET", url: `https://x.standin.example/p?k=fourth`, t: 3000, phase: "open", status: 200 },
  ]);
  check("one endpoint however it was asked, its pace read, its sample cut and stripped", m.length === 1 && m[0].count === 4 && m[0].everyMs === 1000 && m[0].steady && m[0].sample.list.length <= 25 && !J(m).includes(KEY), J(m).slice(0, 300));
  check("the learn input: more than one press, or past a wallet, refused whole", !parseLearn({ targets: [], pressesPerControl: 2, stopOnWallet: true, cap: 1 }).ok && !parseLearn({ targets: [], pressesPerControl: 1, stopOnWallet: false, cap: 1 }).ok && !parseLearn("not json").ok);
  const p = parseLearn(J({ learn: { targets: [{ page: "page_home", part: "n1", control: "a", selector: "#a" }, { page: "page_home", part: "n1", control: "a", selector: "#a" }, { page: "page_home" }], pressesPerControl: 1, stopOnWallet: true, cap: 99 } }));
  check("…a target asked twice is pressed once, one with no selector is left out, the cap never past 25", p.ok && p.targets.length === 1 && p.left.length === 2 && p.cap === 25, J(p));
  const doc = { held: [
    { page: "page_home", part: "n1", held: "server-call", control: "a", selector: "#a", live: true },
    { page: "page_home", part: "n2", held: "wallet", control: "buy", selector: "#buy", live: true },
    { page: "page_home", part: "n3", held: "server-call", control: "w", selector: "#n3 dialog [data-world-control=\"w\"]" },
  ] };
  const plan = planLearn({ targets: [{ page: "page_home", part: "old", control: "a", selector: "#a" }, { page: "page_home", part: "n2", control: "buy", selector: "#buy" }, { page: "page_home", part: "n3", control: "w", selector: "x" }, { page: "page_home", part: "n9", control: "gone", selector: "#gone" }], cap: 5, left: [] }, doc, { pages: [{ id: "page_home", route: "/" }] });
  check("the plan: matched by its control to this capture's part; a wallet, a world's dialog, a control no longer held refused", plan.press.length === 1 && plan.press[0].held.part === "n1" && plan.refused.length === 3 && /wallet/.test(plan.refused[0].why), J(plan.refused.map((x) => x.why)));
  const w = withLearned(doc, [{ page: "page_home", part: "n1", asked: "old", control: "a", selector: "#a", result: "pressed", at: "t", requests: [{ key: "POST h/x", sample: { ok: true } }], screen: { picture: "learn/01.jpg" } }], { endpoints: [] });
  check("learned: its entry with this capture's part, its held entry marked, the map gains its endpoint", w.doc.learned.length === 1 && w.doc.learned[0].part === "n1" && w.doc.held[0].learned === true && w.map.endpoints[0].learned === true && w.samples.length === 1);
}

/* The stand-in site. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN market</title><style>
body{margin:0;font:15px sans-serif;background:#fff;color:#111}
.gate{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
.gate div{background:#fff;padding:20px;width:320px}
button{margin:4px;padding:6px 10px}
</style></head><body>
<h1>STANDIN market</h1>
<div id="tabs"><button type="button" role="tab" aria-selected="true" data-t="hot">Hot</button><button type="button" role="tab" aria-selected="false" data-t="new">New</button><button type="button" role="tab" aria-selected="false" data-t="top">Top</button></div>
<p id="panel">STANDIN hot coins</p>
<div id="heat"><button type="button" aria-pressed="true" data-h="mild">Mild</button><button type="button" aria-pressed="false" data-h="spicy">Spicy</button></div>
<ul id="coins"></ul>
<button type="button" id="buy">Buy $STANDA</button>
<button type="button" id="connect">Connect wallet</button>
<form id="join" action="/api/subscribe" method="post"><input name="email" required placeholder="you@STANDIN.example"><button>Join</button></form>
<form id="note" action="/api/note" method="post"><input name="note" placeholder="STANDIN note"><button>Leave a note</button></form>
<p id="said" role="status"></p>
<div class="gate" role="dialog" aria-modal="true"><div><p>Read the terms and conditions.</p><button type="button" id="agree" onclick="fetch('/api/agree',{method:'POST'});this.closest('.gate').remove()">I agree</button></div></div>
<script>
const say = (t) => { document.getElementById("said").textContent = t; };
fetch("/api/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: ["STANDIN0MINT0ADDRESS0000000001"] }) });
fetch("/api/track", { method: "POST", body: "page=home" });
fetch("/api/coins/STANDIN0MINT0ADDRESS0000000001?api-key=${KEY}").then((r) => r.json()).then((j) => { document.getElementById("coins").innerHTML = j.coins.slice(0, 3).map((c) => "<li>" + c.name + "</li>").join(""); });
setInterval(() => fetch("/api/price?mint=STANDIN0MINT0ADDRESS0000000001&api-key=${KEY}"), 700);
tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; tabs.querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); panel.textContent = "STANDIN " + b.dataset.t + " coins"; });
heat.addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (!b) return; if (b.dataset.h === "spicy") fetch("/api/prefs", { method: "POST", body: JSON.stringify({ heat: "spicy" }) }); heat.querySelectorAll("[data-h]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
buy.addEventListener("click", () => window.solana && window.solana.connect());
connect.addEventListener("click", () => window.solana && window.solana.connect());
join.addEventListener("submit", async (e) => { e.preventDefault(); const r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: join.email.value }) }); const j = await r.json(); say("Thanks, you are on the STANDIN list (" + j.id + ")"); });
note.addEventListener("submit", async (e) => { e.preventDefault(); try { await window.solana.connect(); } catch (err) { say("A wallet is needed"); return; } fetch("/api/note", { method: "POST", body: note.note.value }); });
</script></body></html>`;

/* A canvas world: two pets walking, each opening its coin's dialog, with a note form (a server call) and a Buy (a wallet). */
const WORLD = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN colony</title><style>
body{margin:0;font:14px monospace;background:#f4f1e8}.dlg{width:320px;padding:16px;border:3px solid #222;background:#fffaf0}
</style></head><body><h1>STANDIN colony</h1>
<canvas id="world" width="200" height="100" style="display:block;width:800px;height:400px;image-rendering:pixelated;margin:20px"></canvas>
<dialog id="dlg" class="dlg"></dialog>
<script>
const chars = [{ id: "STANDIN_MINT_A", t: "$STANDA", c: "#ff0000", x: 20, y: 40, vx: 1 }, { id: "STANDIN_MINT_B", t: "$STANDB", c: "#0000ff", x: 140, y: 60, vx: -1 }];
const sheet = document.createElement("canvas"); sheet.width = 20; sheet.height = 10;
const s = sheet.getContext("2d"); chars.forEach((ch, i) => { s.fillStyle = ch.c; s.fillRect(i * 10, 0, 10, 10); });
const g = world.getContext("2d");
(function draw() { g.fillStyle = "#cfe8c0"; g.fillRect(0, 0, 200, 100); chars.forEach((ch, i) => { ch.x += ch.vx; if (ch.x > 185 || ch.x < 5) ch.vx = -ch.vx; g.drawImage(sheet, i * 10, 0, 10, 10, Math.round(ch.x), ch.y, 10, 10); }); requestAnimationFrame(draw); })();
world.addEventListener("click", (e) => {
  const r = world.getBoundingClientRect(), x = (e.clientX - r.left) / 4, y = (e.clientY - r.top) / 4;
  const ch = chars.find((c) => x >= Math.round(c.x) - 2 && x <= Math.round(c.x) + 12 && y >= c.y - 2 && y <= c.y + 12);
  if (!ch) return;
  dlg.dataset.mint = ch.id;
  dlg.innerHTML = '<button type="button" data-close aria-label="Close">x</button><h2>' + ch.t + '</h2>'
    + '<form action="/api/note" method="post"><input name="note" placeholder="STANDIN note"><button>Send note</button></form>'
    + '<button type="button" data-buy>Buy with SOL</button>';
  dlg.querySelector("[data-close]").onclick = () => dlg.close();
  dlg.querySelector("[data-buy]").onclick = () => window.solana && window.solana.connect();
  dlg.querySelector("form").onsubmit = (ev) => { ev.preventDefault(); fetch("/api/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint: dlg.dataset.mint, note: ev.target.note.value }) }); };
  dlg.showModal();
});
</script></body></html>`;

/* A live page: prices down a WebSocket, trades down an EventSource. */
const LIVE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN live</title></head><body>
<h1>STANDIN live</h1><p id="price">…</p><p id="trade">…</p>
<script>
const ws = new WebSocket("ws://" + location.host + "/ws?token=${KEY}");
ws.onopen = () => ws.send(JSON.stringify({ op: "subscribe", channel: "prices", mint: "STANDIN0MINT0ADDRESS0000000001" }));
ws.onmessage = (e) => { price.textContent = JSON.parse(e.data).price; };
const es = new EventSource("/api/stream?api-key=${KEY}");
es.addEventListener("trade", (e) => { trade.textContent = JSON.parse(e.data).side; });
</script></body></html>`;
/* The socket's own side, by hand: the handshake, and text frames each way. */
const wsFromClient = [];
const frame = (text) => { const b = Buffer.from(text); return Buffer.concat([Buffer.from(b.length < 126 ? [0x81, b.length] : [0x81, 126, b.length >> 8, b.length & 255]), b]); };
const unmask = (buf) => { const out = []; let i = 0; while (i + 2 <= buf.length) { const op = buf[i] & 15; let len = buf[i + 1] & 127, at = i + 2; if (len === 126) { len = buf.readUInt16BE(at); at += 2; } const mask = buf.subarray(at, at + 4); at += 4; const data = Buffer.from(buf.subarray(at, at + len)).map((x, k) => x ^ mask[k % 4]); if (op === 1) out.push(data.toString()); i = at + len; } return out; };

const got = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    got.push({ method: req.method, url: req.url, body, t: Date.now() });
    const json = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(J(o)); };
    if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
    if (req.url === "/live") { res.writeHead(200, { "content-type": "text/html" }); return res.end(LIVE); }
    if (req.url.startsWith("/api/stream")) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      let n = 0;
      const tick = setInterval(() => { n++; res.write(n % 2 ? `event: trade\ndata: ${J({ side: "buy", amount: n, apiKey: KEY })}\n\n` : `data: ${J({ ping: n })}\n\n`); }, 250);
      res.on("close", () => clearInterval(tick));
      return;
    }
    if (req.url === "/world") { res.writeHead(200, { "content-type": "text/html" }); return res.end(WORLD); }
    if (req.url.startsWith("/api/rpc")) return json({ jsonrpc: "2.0", id: 1, result: { value: 1234 } });
    if (req.url.startsWith("/api/coins/")) return json({ coins: Array.from({ length: 60 }, (_, i) => ({ name: `STANDIN coin ${i}`, mint: `STANDIN0MINT0ADDRESS00000000${String(i).padStart(2, "0")}`, apiKey: KEY })) });
    if (req.url.startsWith("/api/price")) return json({ price: 1.25, at: Date.now() });
    if (req.url === "/api/subscribe") return json({ ok: true, id: "STANDIN_SUB_1" });
    if (req.url.startsWith("/api/")) return json({ ok: true });
    res.writeHead(404, { "content-type": "text/html" }); res.end("<p>STANDIN elsewhere</p>");
  });
});
server.on("upgrade", (req, socket) => {
  const accept = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  let n = 0;
  const tick = setInterval(() => { n++; socket.write(frame(J({ price: 1 + n / 100, n, mint: "STANDIN0MINT0ADDRESS0000000001", apiKey: KEY }))); }, 300);
  socket.on("data", (d) => wsFromClient.push(...unmask(d)));
  socket.on("close", () => clearInterval(tick));
  socket.on("error", () => clearInterval(tick));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-network-"));
const site = join(work, "sites", "standin");
mkdirSync(join(site, "capture", "routes"), { recursive: true });
const capFile = join(site, "capture", "routes", "page_home.json");
const assets = join(site, "assets", "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
const cap = await run([join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "1", "--frames", "0", "--hide-gate", "--states", "--network"]);
if (process.env.DEBUG) console.log(cap.err);
check("the stand-in site was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").slice(-8).join(" | "));
const routes = { site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] };
writeFileSync(join(site, "capture", "routes.json"), J(routes));
const conv = await run([join(here, "capture-to-document.mjs"), join(site, "capture", "routes.json"), site, "--assets", assets]);
check("the capture converts", conv.status === 0, conv.err.trim().split("\n").pop());
const docFile = join(site, "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const mapFile = join(site, "api", "map.json");
const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : { endpoints: [] };
const apiText = existsSync(join(site, "api")) ? [mapFile, ...readdirSync(join(site, "api", "samples")).map((f) => join(site, "api", "samples", f))].map((f) => readFileSync(f, "utf8")).join("\n") : "";
const ep = (re) => map.endpoints.find((e) => re.test(e.key));

/* (1) */
const price = ep(/^GET 127\.0\.0\.1:\d+\/api\/price$/), coins = ep(/\/api\/coins\/:id$/), rpc = ep(/\/api\/rpc#getBalance$/), track = ep(/\/api\/track$/);
check("(1) the poll: one endpoint, its query's names kept and values out, how often it came back", price && price.url.endsWith("/api/price?mint=…&api-key=…") && price.count >= 3 && price.everyMs >= 500 && price.everyMs <= 1000, J(price));
check("(1) an id in the path is :id; the list's sample is cut short and its key stripped", coins && coins.read && existsSync(join(site, "api", coins.sample ?? "none")) && JSON.parse(readFileSync(join(site, "api", coins.sample), "utf8")).coins.length <= 25 && coins.shape?.coins?.[0]?.name === "string", J(coins).slice(0, 300));
check("(1) a JSON-RPC read is a read, with its method in its key and what it sent as a shape", rpc && rpc.read && rpc.body?.params?.[0] === "string", J(rpc));
check("(1) the page's own analytics ping is a write, with no sample", track && !track.read && track.sample == null, J(track));
check("(1) no key anywhere in the map or its samples", apiText.length > 0 && !apiText.includes(KEY) && !apiText.includes("STANDIN_KEY"), apiText.match(/.{40}STANDIN_KEY.{10}/)?.[0]);
check("(1) the document names the map", doc.api?.map === "api/map.json" && doc.api.reads >= 3, J(doc.api));

/* (2) */
const held = doc.held ?? [];
const partIds = new Set(doc.nodes.map((n) => n.id));
const h = (label) => held.find((x) => x.label === label);
check("(2) a form's button is held as a server call, with the form's fields and where it is on the live page", h("Join")?.held === "server-call" && h("Join").form === true && J(h("Join").fields) === J([{ name: "email", type: "text", required: true, placeholder: "you@STANDIN.example" }]) && h("Join").live === true && /^#|^body >/.test(h("Join").selector), J(h("Join")));
check("(2) words that spend or connect are held as a wallet", h("Buy $STANDA")?.held === "wallet" && h("Connect wallet")?.held === "wallet", J(held.map((x) => [x.label, x.held])));
check("(2) a press that tried to write is held, with what it would have sent", h("Spicy")?.held === "server-call" && /POST 127\.0\.0\.1:\d+\/api\/prefs/.test(h("Spicy").hook ?? ""), J(h("Spicy")));
check("(2) each held control is on a part of the document", held.length >= 5 && held.every((x) => partIds.has(x.part)), J(held.map((x) => x.part)));
check("(2) the terms gate is not held and was never agreed to", !held.some((x) => /agree/i.test(x.label ?? "")) && !got.some((g) => g.url === "/api/agree"));
check("(2) no write a press would make reached the server", !got.some((g) => /^\/api\/(prefs|subscribe|note)/.test(g.url)), J(got.filter((g) => g.method !== "GET").map((g) => g.url)));
check("(2) a client-only press is still a state", (JSON.parse(readFileSync(capFile, "utf8")).states ?? []).some((s) => /New|Top/.test(s.name)));

/* (3) */
check("(3) the capturer says it can Learn", doc.capturer?.learn === true && doc.capturer.can.includes("learn"), J(doc.capturer));

/* (5) A Learn run: the form with the owner's value, the press that wrote, and the wallet control (refused). */
const target = (x, values = null) => ({ page: x.page, part: x.part, control: x.control ?? null, selector: x.selector, values });
const EMAIL = "owner@STANDIN.example";
const before = got.length;
const learn = { targets: [target(h("Join") ?? {}, { email: EMAIL }), target(h("Spicy") ?? {}), target(h("Buy $STANDA") ?? {})], pressesPerControl: 1, stopOnWallet: true, cap: 5 };
const lr = await run([join(here, "learn.mjs"), "--site", site, "--url", origin, "--learn", J(learn)]);
if (process.env.DEBUG) console.log(lr.err);
const sent = got.slice(before);
const subs = sent.filter((g) => g.url === "/api/subscribe"), prefs = sent.filter((g) => g.url === "/api/prefs");
check("(5) the run ends well", lr.status === 0, lr.err.trim().split("\n").slice(-4).join(" | "));
check("(5) each chosen control pressed once, the form with the owner's value", subs.length === 1 && JSON.parse(subs[0].body).email === EMAIL && prefs.length === 1, J(sent.filter((g) => g.method !== "GET").map((g) => g.url)));
check("(5) at least 2 s apart", subs.length === 1 && prefs.length === 1 && Math.abs(prefs[0].t - subs[0].t) >= 1900, subs[0] && prefs[0] ? `${prefs[0].t - subs[0].t}ms` : "");
check("(5) the terms gate still never agreed to", !got.some((g) => g.url === "/api/agree"));
const doc2 = JSON.parse(readFileSync(docFile, "utf8"));
const runFile = join(site, "learn", "run.json");
const runJ = existsSync(runFile) ? JSON.parse(readFileSync(runFile, "utf8")) : { results: [], refused: [] };
check("(5) doc.learned: the two pressed, on their parts; their held entries marked learned", doc2.learned?.length === 2 && doc2.learned.every((x) => partIds.has(x.part)) && doc2.held.filter((x) => x.learned).length === 2, J(doc2.learned));
check("(5) the wallet control was refused, never pressed", runJ.refused.some((x) => x.target?.control === h("Buy $STANDA")?.control && /wallet/.test(x.why)));
const joined = runJ.results.find((r) => r.control === h("Join")?.control);
check("(5) what the press asked and what came back, and the screen it left", joined?.requests?.some((q) => /\/api\/subscribe$/.test(q.key) && !q.read && J(q.body) === J({ email: "string" })) && joined.screen?.said?.some((t) => /STANDIN list/.test(t)) && existsSync(join(site, joined.screen.picture)), J(joined).slice(0, 400));
const map2 = JSON.parse(readFileSync(mapFile, "utf8"));
const subEp = map2.endpoints.find((e) => /\/api\/subscribe$/.test(e.key));
check("(5) the map gains the write it learned, its answer as a sample", subEp?.learned === true && existsSync(join(site, "api", subEp.sample ?? "none")) && JSON.parse(readFileSync(join(site, "api", subEp.sample), "utf8")).id === "STANDIN_SUB_1", J(subEp));
const everything = [readFileSync(docFile, "utf8"), readFileSync(runFile, "utf8"), readFileSync(mapFile, "utf8"), ...readdirSync(join(site, "api", "samples")).map((f) => readFileSync(join(site, "api", "samples", f), "utf8"))].join("\n");
check("(5) the owner's typed value is kept nowhere", !everything.includes(EMAIL));

/* (6) A wallet prompt ends the run: the note form asks for one first. */
const before6 = got.length;
const noteH = h("Leave a note");
const lr6 = await run([join(here, "learn.mjs"), "--site", site, "--url", origin, "--learn", J({ targets: [target(noteH ?? {}, { note: "STANDIN" }), target(h("Join") ?? {}, { email: EMAIL })], pressesPerControl: 1, stopOnWallet: true, cap: 5 })]);
const run6 = JSON.parse(readFileSync(runFile, "utf8"));
check("(6) the press that asked for a wallet stopped the run; nothing after it pressed, nothing signed or sent", lr6.status === 0 && run6.results[0]?.result === "stopped: wallet" && run6.results[1]?.result === "not pressed" && !got.slice(before6).some((g) => /^\/api\/(note|subscribe)/.test(g.url)), J(run6.results.map((r) => [r.control, r.result, r.why])));

/* (7) The canvas world. */
{
  const wsite = join(work, "sites", "standin-world");
  mkdirSync(join(wsite, "capture", "routes"), { recursive: true });
  const wcap = join(wsite, "capture", "routes", "page_home.json");
  const wassets = join(wsite, "assets", "source");
  const c7 = await run([join(here, "capture-route.mjs"), `${origin}/world`, wcap, "--width", "1000", "--height", "700", "--assets", wassets, "--settle", "1", "--hide-gate", "--network", "--world-frames", "6", "--world-every", "150"]);
  if (process.env.DEBUG) console.log(c7.err);
  writeFileSync(join(wsite, "capture", "routes.json"), J({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/world", route: "/world" }] }));
  const v7 = await run([join(here, "capture-to-document.mjs"), join(wsite, "capture", "routes.json"), wsite, "--assets", wassets]);
  const wdocFile = join(wsite, "site", "document.json");
  const wdoc = existsSync(wdocFile) ? JSON.parse(readFileSync(wdocFile, "utf8")) : { held: [] };
  const wheld = wdoc.held ?? [];
  const noteB = wheld.find((x) => x.control === "send-note" && x.character?.some((k) => k.includes("STANDIN_MINT_B")));
  const buyB = wheld.find((x) => x.held === "wallet" && x.character?.some((k) => k.includes("STANDIN_MINT_B")));
  check("(7) the world was captured and converted", c7.status === 0 && v7.status === 0 && wdoc.nodes?.some((n) => n.world), (c7.err + v7.err).trim().split("\n").slice(-4).join(" | "));
  check("(7) a world dialog's form button is held with its character and its place in the dialog", noteB?.held === "server-call" && Number.isInteger(noteB.el) && !noteB.live, J(wheld.map((x) => [x.control, x.held, x.el, x.character])));
  check("(7) nothing the capture pressed sent a note", !got.some((g) => g.url === "/api/note"));
  const before7 = got.length;
  const learn7 = { targets: [target(noteB ?? {}, { note: "STANDIN hello" }), target(buyB ?? {})], pressesPerControl: 1, stopOnWallet: true, cap: 5 };
  const l7 = await run([join(here, "learn.mjs"), "--site", wsite, "--url", `${origin}/world`, "--learn", J(learn7)]);
  if (process.env.DEBUG) console.log(l7.err);
  const notes = got.slice(before7).filter((g) => g.url === "/api/note");
  const run7 = existsSync(join(wsite, "learn", "run.json")) ? JSON.parse(readFileSync(join(wsite, "learn", "run.json"), "utf8")) : { results: [], refused: [] };
  check("(7) Learn found the character, opened its dialog and pressed the control once, with the owner's value", l7.status === 0 && notes.length === 1 && JSON.parse(notes[0].body).mint === "STANDIN_MINT_B" && JSON.parse(notes[0].body).note === "STANDIN hello", J({ notes, results: run7.results.map((r) => [r.control, r.result, r.why]) }));
  check("(7) nothing else was sent while it looked, and no page was left", got.slice(before7).every((g) => g.method === "GET" || g.url === "/api/note"), J(got.slice(before7).filter((g) => g.method !== "GET").map((g) => g.url)));
  const wdoc2 = JSON.parse(readFileSync(wdocFile, "utf8"));
  check("(7) doc.learned names it on the world's part; the Buy in the same dialog was refused", wdoc2.learned?.length === 1 && wdoc2.learned[0].part === noteB?.part && wdoc2.learned[0].control === "send-note" && run7.refused.some((x) => /wallet/.test(x.why)), J({ learned: wdoc2.learned, refused: run7.refused }));
}

/* (8) Live feeds. */
{
  const lsite = join(work, "sites", "standin-live");
  mkdirSync(join(lsite, "capture", "routes"), { recursive: true });
  const lcap = join(lsite, "capture", "routes", "page_home.json");
  const c8 = await run([join(here, "capture-route.mjs"), `${origin}/live`, lcap, "--width", "1000", "--height", "700", "--assets", join(lsite, "assets", "source"), "--settle", "1", "--frames", "0", "--hide-gate", "--network"]);
  if (process.env.DEBUG) console.log(c8.err);
  writeFileSync(join(lsite, "capture", "routes.json"), J({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/live", route: "/live" }] }));
  const v8 = await run([join(here, "capture-to-document.mjs"), join(lsite, "capture", "routes.json"), lsite, "--assets", join(lsite, "assets", "source")]);
  const lmapFile = join(lsite, "api", "map.json");
  const lmap = existsSync(lmapFile) ? JSON.parse(readFileSync(lmapFile, "utf8")) : { endpoints: [] };
  const sampleOfEp = (e) => (e?.sample && existsSync(join(lsite, "api", e.sample)) ? JSON.parse(readFileSync(join(lsite, "api", e.sample), "utf8")) : null);
  const wsEp = lmap.endpoints.find((e) => e.method === "WS" && /\/ws$/.test(e.key));
  const esEp = lmap.endpoints.find((e) => e.stream?.kind === "eventsource");
  const wsS = sampleOfEp(wsEp), esS = sampleOfEp(esEp);
  check("(8) the live page was captured and converted", c8.status === 0 && v8.status === 0, (c8.err + v8.err).trim().split("\n").slice(-3).join(" | "));
  check("(8) the socket: its address redacted, its messages kept with their shape and pace", wsEp?.read === true && /^ws:\/\/127\.0\.0\.1:\d+\/ws\?token=…$/.test(wsEp.url) && wsEp.stream?.kind === "websocket" && wsEp.stream.count >= 5 && wsEp.stream.everyMs >= 200 && wsEp.stream.everyMs <= 450 && wsS?.messages?.length >= 5 && typeof wsS.messages[1].data.price === "number" && wsEp.shape?.price === "number", J({ wsEp, first: wsS?.messages?.slice(0, 2) }).slice(0, 500));
  check("(8) what the page sent on it kept as its shape only", J(wsEp?.stream?.sent) === J([{ op: "string", channel: "string", mint: "string" }]), J(wsEp?.stream?.sent));
  check("(8) the EventSource: its named events and its plain messages, the address redacted", esEp?.read === true && /\/api\/stream\?api-key=…$/.test(esEp.url) && esS?.messages?.some((m) => m.type === "trade" && m.data.side === "buy") && esS.messages.some((m) => !m.type && m.data.ping), J({ esEp, first: esS?.messages?.slice(0, 3) }).slice(0, 500));
  check("(8) never more than 50 messages kept", (wsS?.messages?.length ?? 0) <= 50 && (esS?.messages?.length ?? 0) <= 50);
  const liveText = existsSync(join(lsite, "api")) ? [lmapFile, ...readdirSync(join(lsite, "api", "samples")).map((f) => join(lsite, "api", "samples", f))].map((f) => readFileSync(f, "utf8")).join("\n") : "";
  check("(8) no key in any stream kept", liveText.length > 0 && !liveText.includes(KEY));
  check("(8) nothing sent on the socket but what the page itself sent", wsFromClient.length >= 1 && wsFromClient.every((m) => JSON.parse(m).op === "subscribe"), J(wsFromClient));
}

server.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
