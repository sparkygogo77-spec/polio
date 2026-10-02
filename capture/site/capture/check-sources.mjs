/**
 * A live value says where it comes from.
 *
 * A stand-in page, served here, does what his page does with the SOL price:
 * it fetches a price every five seconds from a price service (with an API
 * key in the address, as a real one would) and writes it into a span. It
 * also asks for the connected wallet's balance, by XHR with a bearer token,
 * and shows it in SOL, and it keeps a socket open that pushes a slot number.
 * The capture is taken the way every capture is (`capture-route.mjs`, with
 * the stand-in wallet and `--sources`), then converted; the document's
 * `sources` section must say which part each value feeds, from which
 * address, at which JSON path, how often, and how sure it is — and carry no
 * key, no token and no wallet address.
 *
 * Also held: the unchanging "SOL" label beside the price feeds from
 * nothing; and the nine committed captures, which have no sources, still
 * convert to the committed document byte for byte.
 *
 *   node capture/site/capture/check-sources.mjs
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const near = (v, want, tol) => typeof v === "number" && Math.abs(v - want) <= tol;
const API_KEY = "STANDIN_KEY_NOT_REAL";
const BEARER = "STANDIN_BEARER_NOT_REAL_TOKEN_VALUE";

/* ------------------------------------------------------------------ */
/* The stand-in page                                                    */
/* ------------------------------------------------------------------ */

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in</title>
<style>body{background:#0a0e1a;color:#fff;font:16px monospace;margin:0;padding:24px} div{margin:8px 0}</style></head>
<body>
  <div class="ticker"><span id="label">SOL</span> <span id="price">Loading...</span></div>
  <div class="wallet"><span id="bal">...</span></div>
  <div class="chain">slot <span id="slot">?</span></div>
<script>
  const price = async () => {
    const r = await fetch("/api/price?ids=SOL&vs=usd&api_key=${API_KEY}");
    const j = await r.json();
    document.getElementById("price").textContent = "$" + j.solana.usd.toFixed(2);
  };
  price(); setInterval(price, 5000);
  const balance = async () => {
    const w = window.phantom && window.phantom.solana;
    if (!w) return;
    const { publicKey } = await w.connect();
    const x = new XMLHttpRequest();
    x.open("POST", "/rpc");
    x.setRequestHeader("Authorization", "Bearer ${BEARER}");
    x.setRequestHeader("Content-Type", "application/json");
    x.onload = () => { const j = JSON.parse(x.responseText); document.getElementById("bal").textContent = (j.result.value / 1e9).toFixed(3) + " SOL"; };
    x.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [publicKey.toString()] }));
  };
  balance(); setInterval(balance, 7000);
  const ws = new WebSocket("ws://" + location.host + "/slots");
  ws.onmessage = (e) => { document.getElementById("slot").textContent = JSON.parse(e.data).slot.toLocaleString("en-US"); };
</script></body></html>`;

let lamports = 2_345_678_901;
let slot = 287_654_321;
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (u.pathname === "/api/price") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ solana: { usd: Math.round((140 + Math.random() * 20) * 10000) / 10000, usd_24h_change: -1.2345 } }));
    return;
  }
  if (u.pathname === "/rpc") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lamports += 1_000_000;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { context: { slot }, value: lamports } }));
    });
    return;
  }
  res.writeHead(404); res.end();
});
/* The smallest socket that speaks: the handshake, then an unmasked text frame every two seconds. */
server.on("upgrade", (req, socket) => {
  const accept = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const send = () => { const p = Buffer.from(JSON.stringify({ slot: (slot += 5) })); socket.write(Buffer.concat([Buffer.from([0x81, p.length]), p])); };
  send();
  const t = setInterval(send, 2000);
  socket.on("error", () => {});
  socket.on("close", () => clearInterval(t));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

/* ------------------------------------------------------------------ */
/* Capture it, then convert it                                          */
/* ------------------------------------------------------------------ */

const work = mkdtempSync(join(tmpdir(), "sources-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const run = (args) => new Promise((resolve) => {
  /* Asynchronously, so this process keeps serving the page while the capture runs. */
  import("node:child_process").then(({ spawn }) => {
    /* The page is on this machine: no proxy between the browser and it. */
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], env });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    p.on("close", (status) => resolve({ status, out, err }));
  });
});
const cap0 = await run([join(here, "capture-route.mjs"), `${origin}/`, capFile, "--wallet", "--sources", "16", "--width", "800", "--height", "400"]);

/* The owner's way: the snippet pasted into the console of a page already running, and the file it downloads. */
const consoleCap = await (async () => {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let chromium = null;
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) { try { ({ chromium } = req(c)); break; } catch { /* next */ } }
  if (!chromium) return null;
  const snippet = spawnSync(process.execPath, [join(here, "console-capture.mjs"), "--seconds", "12"], { encoding: "utf8" }).stdout;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", headless: true });
  try {
    const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const got = page.waitForEvent("download", { timeout: 40000 });
    await page.evaluate(snippet);
    const file = join(work, "console.json");
    await (await got).saveAs(file);
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) { return { error: String(e) }; } finally { await browser.close(); }
})();
server.close();
const cPrice = consoleCap?.sources?.sources?.find((s) => /\/api\/price\?/.test(s.url));
const cFeed = consoleCap?.sources?.feeds?.find((f) => f.source === cPrice?.id);
check("pasted into the console of a running page, the snippet downloads a capture with its sources", consoleCap?.sources?.version === 1 && !!consoleCap?.tree, consoleCap?.error ?? "");
check("…the price seen refreshing every five seconds, feeding its span at solana.usd", near(cPrice?.everyMs, 5000, 400) && cFeed?.path === "solana.usd", JSON.stringify(cFeed));
check("…the span marked in the tree", JSON.stringify(consoleCap?.tree ?? {}).includes(`"feeds":["${cFeed?.id}"]`));
check("…and no API key in it", !JSON.stringify(consoleCap ?? {}).includes(API_KEY.slice(8)));

check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
const capText = existsSync(capFile) ? readFileSync(capFile, "utf8") : "{}";
const cap = JSON.parse(capText);

writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [800, 400], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out")], { encoding: "utf8" });
check("…and converted", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const docText = existsSync(docFile) ? readFileSync(docFile, "utf8") : "{}";
const doc = JSON.parse(docText);
const S = doc.sources ?? {};

/* ------------------------------------------------------------------ */
/* What the document says                                               */
/* ------------------------------------------------------------------ */

check("the document has a sources section, versioned", S.version === 1, JSON.stringify(S.version));
const srcs = S.sources ?? [];
const feeds = S.feeds ?? [];
const partOf = (id) => (doc.nodes ?? []).find((n) => n.id === id);

const price = srcs.find((s) => s.kind === "fetch" && /\/api\/price\?/.test(s.url ?? ""));
check("the price service is a source: a GET by fetch", price?.method === "GET", JSON.stringify(price && { method: price.method, url: price.url }));
check("…seen at least three times in the watch", (price?.count ?? 0) >= 3, String(price?.count));
check("…refreshing every five seconds", near(price?.everyMs, 5000, 400), String(price?.everyMs));
check("…with its API key stripped from the address, and named as stripped", /api_key=%5Bredacted%5D|api_key=\[redacted\]/.test(price?.url ?? "") && (price?.redacted ?? []).includes("api_key"), price?.url);
check("…and a sample of what it answered", typeof price?.sample?.solana?.usd === "number", JSON.stringify(price?.sample));
check("…needing no wallet", price?.needsWallet === false, String(price?.needsWallet));

const pf = feeds.find((f) => f.source === price?.id);
const pricePart = pf && partOf(pf.part);
check("the price part is fed by the price service", !!pf && /^\$\d+\.\d\d$/.test(String(pricePart?.content ?? "")), JSON.stringify(pf ?? feeds));
check("…at the JSON path solana.usd", pf?.path === "solana.usd", String(pf?.path));
check("…every five seconds", near(pf?.everyMs, 5000, 400), String(pf?.everyMs));
check("…with confidence", (pf?.confidence ?? 0) >= 0.7 && pf.confidence <= 1, String(pf?.confidence));
check("…on the page it was captured on", pf?.page === "page_home", String(pf?.page));

const rpc = srcs.find((s) => s.kind === "xhr");
check("the wallet's balance is a source: a POST by XHR, the RPC method named", rpc?.method === "POST" && rpc?.rpc === "getBalance", JSON.stringify(rpc && { method: rpc.method, rpc: rpc.rpc }));
check("…needing a wallet, because its body carries the connected address", rpc?.needsWallet === true, String(rpc?.needsWallet));
check("…the address written as {wallet}", /\{wallet\}/.test(JSON.stringify(rpc?.body ?? "")), JSON.stringify(rpc?.body));
check("…the auth header named but not kept", rpc?.auth === true, String(rpc?.auth));
const bf = feeds.find((f) => f.source === rpc?.id);
check("…feeding the balance part at result.value, in SOL from lamports", bf?.path === "result.value" && bf?.scale === 1e-9 && /SOL$/.test(String(partOf(bf.part)?.content)), JSON.stringify(bf));
check("…and the feed says it needs a wallet", bf?.needsWallet === true, String(bf?.needsWallet));

const ws = srcs.find((s) => s.kind === "websocket");
check("the socket is a source", /\/slots$/.test(ws?.url ?? ""), ws?.url);
const sf = feeds.find((f) => f.source === ws?.id);
check("…feeding the slot part at slot", sf?.path === "slot", JSON.stringify(sf));
check("…every two seconds", near(ws?.everyMs, 2000, 400), String(ws?.everyMs));

check("control: the unchanging SOL label feeds from nothing", !feeds.some((f) => partOf(f.part)?.content === "SOL"), JSON.stringify(feeds.map((f) => partOf(f.part)?.content)));

/* No secret travels, in the capture or in the document. The stand-in's address is the one capture-route.mjs makes from its fixed bytes. */
const addr = (() => {
  const bytes = Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 251);
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const d = [0];
  for (const b of bytes) { let c = b; for (let j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } }
  return d.reverse().map((x) => A[x]).join("");
})();
for (const [name, text] of [["capture", JSON.stringify(cap.sources ?? null)], ["document", JSON.stringify(doc.sources ?? null)]]) {
  check(`no API key in the ${name}'s sources`, !text.includes(API_KEY.slice(8)));
  check(`no bearer token in the ${name}'s sources`, !text.includes(BEARER.slice(10, 30)));
  check(`no wallet address in the ${name}'s sources`, !text.includes(addr), addr);
}

/* The stripping on its own, over the shapes a key takes on a Solana site. */
{
  const { runInNewContext } = await import("node:vm");
  const win = { location: { href: "https://ccc-woad.vercel.app/" }, URL, __sinkSourcesConfig: { wallet: addr } };
  win.window = win;
  runInNewContext(readFileSync(join(here, "sources-recorder.js"), "utf8"), { window: win, location: win.location, URL, document: { addEventListener() {} }, Date, Math, JSON, Object, Array, Set, Map, String, Number, RegExp, parseFloat, isFinite, encodeURIComponent, decodeURIComponent });
  const { url, value } = win.__sinkSources.clean;
  const SOL = "So11111111111111111111111111111111111111112";
  const helius = url(`https://mainnet.helius-rpc.com/?api-key=STANDIN_KEY_NOT_REAL&owner=${addr}`, {});
  check("stripping: a Helius key is redacted, the wallet in the address becomes {wallet}", helius.url === "https://mainnet.helius-rpc.com/?api-key=[redacted]&owner={wallet}" && helius.redacted.includes("api-key"), helius.url);
  const alchemy = url("https://solana-mainnet.g.alchemy.com/v2/standin0not0real0path0key", {});
  check("stripping: a key in the path is redacted", alchemy.url === "https://solana-mainnet.g.alchemy.com/v2/[redacted]", alchemy.url);
  const jup = url(`https://api.jup.ag/price/v2?ids=${SOL}&token=${SOL}`, {});
  check("stripping: a mint address is public and kept", jup.url === `https://api.jup.ag/price/v2?ids=${SOL}&token=${SOL}` && !jup.redacted.length, jup.url);
  const flags = {};
  const v = value({ publicKey: addr, privateKey: { bytes: [1, 2, 3] }, secretKey: Array.from({ length: 64 }, (_, i) => i), seed: "abandon ability able about above absent absorb abstract absurd abuse access accident", jwt: BEARER, sig: "5".repeat(88), note: "abandon ability able about above absent absorb abstract absurd abuse access accident", data: "A".repeat(160), mint: SOL, price: 150.2 }, flags);
  check("stripping: a 64-byte key, a seed phrase (by name or by shape), a JWT, a signature and a blob are redacted", ["privateKey", "secretKey", "seed", "jwt", "sig", "note", "data"].every((k) => v[k] === "[redacted]"), JSON.stringify(v));
  check("stripping: the wallet's public key becomes {wallet} and marks it; a mint and a price are kept", v.publicKey === "{wallet}" && flags.wallet === true && v.mint === SOL && v.price === 150.2, JSON.stringify({ publicKey: v.publicKey, mint: v.mint, price: v.price }));
}

/* ------------------------------------------------------------------ */
/* Old captures, unchanged                                              */
/* ------------------------------------------------------------------ */

const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
const same = again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8");
check("control: the committed captures, which have no sources, convert to the committed document byte for byte", same, again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
