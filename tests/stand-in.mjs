#!/usr/bin/env node
/**
 * THE STAND-IN SERVER, AND WHAT THE CAPTURER NOW SENDS.
 *
 * sink's capture records each page's requests as an API map with sample
 * answers (`site/capture/network.mjs`), holds every press that would write
 * or ask for a wallet (`doc.held`), and Learns the ones the owner chooses
 * (`doc.learned`, `doc.capturer.learn`). Held here, on STANDIN data shaped
 * exactly as sink writes it:
 *   1. only reads with a sample are kept, within the limits;
 *   2. the runtime answers a recorded read, by fetch or XMLHttpRequest, and
 *      replays a recorded live feed at its pace in a loop (an id in the path, a JSON-RPC
 *      (remote procedure call) read by its method) with its sample, and lets
 *      a write or anything unrecorded go to the network;
 *   3. the Build option is advanced and off by default: off, a built site
 *      carries no stand-in; on, it carries the runtime, the layout loads it
 *      first, BUILD.md says so, and the file it writes answers by itself;
 *   4. a document that is a new capture replaces the stand-in; one that is
 *      not keeps it;
 *   5. sink's held and learned entries, and its capturer line, read through
 *      the Learn adapter: Learn is offered, and a learned control's mark goes.
 *
 *   node tests/stand-in.mjs
 */
import { runInNewContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`); };
const J = (x) => JSON.stringify(x);
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url);
const S = await jiti.import(join(here, "..", "src", "features", "studio", "standIn.ts"));
const { scaffold } = await jiti.import(join(here, "..", "src", "features", "studio", "scaffold.ts"));
const { FORMAT_FIELDS } = await jiti.import(join(here, "..", "src", "features", "studio", "format.ts"));
const { takeDoc } = await jiti.import(join(here, "..", "src", "features", "studio", "docTake.ts"));
const L = await jiti.import(join(here, "..", "src", "features", "studio", "learn.ts"));

/* sink's API map, as Bring attaches it: each read's sample read in beside it. */
const MAP = {
  site: "https://standin.example",
  endpoints: [
    { key: "GET api.standin.example/v1/coins/:id/holders", method: "GET", url: "https://api.standin.example/v1/coins/:id/holders?limit=…", host: "api.standin.example", path: "/v1/coins/:id/holders", query: ["limit"], read: true, statuses: [200], count: 3, everyMs: 5000, steady: true, sample: { holders: [{ owner: "STANDIN_OWNER_1", amount: 12 }] } },
    { key: "POST rpc.standin.example/#getBalance", method: "POST", url: "https://rpc.standin.example/", host: "rpc.standin.example", path: "/", op: { kind: "rpc", name: "getBalance" }, read: true, sample: { jsonrpc: "2.0", id: 1, result: { value: 1234 } } },
    { key: "POST api.standin.example/track", method: "POST", host: "api.standin.example", path: "/track", read: false, sample: null },
    { key: "GET api.standin.example/v1/price", method: "GET", host: "api.standin.example", path: "/v1/price", read: true, sample: null },
    { key: "GET api.standin.example/v1/later", method: "GET", host: "api.standin.example", path: "/v1/later", read: true, sample: "samples/004.json" },
  ],
};

/* 1 */
const map = S.standInFromDoc({ standIn: MAP });
check("1. only reads with a sample are kept: the holders list and the RPC read", map?.reads.length === 2 && map.reads[0].path === "/v1/coins/:id/holders" && map.reads[1].op === "getBalance" && map.site === "https://standin.example", J(map));
check("1. …a document with no map has no stand-in", S.standInFromDoc({ pages: [] }) === null);
const big = S.standInFromDoc({ standIn: { endpoints: Array.from({ length: 200 }, (_, i) => ({ method: "GET", host: "h.standin.example", path: `/p${i}`, read: true, sample: { i } })) } });
check("1. …and never past the limit of reads", big.reads.length === S.MOST_READS);

/* 2 */
const network = [];
const win = {
  location: { href: "https://mysite.standin.example/" },
  Response: class { constructor(body, init) { this.body = body; this.status = init.status; this.headers = init.headers; } async json() { return JSON.parse(this.body); } },
  fetch: async (input, init) => { network.push(`${init?.method ?? "GET"} ${input}`); return { status: 599 }; },
};
win.window = win;
runInNewContext(S.STAND_IN_RUNTIME, { window: win, globalThis: win, URL, JSON, Promise, String, Array });
win.__standIn.install(map);
const a = await win.fetch("https://api.standin.example/v1/coins/STANDIN0MINT0000000000000000000001/holders?limit=20");
const b = await win.fetch("https://rpc.standin.example/", { method: "POST", body: J({ jsonrpc: "2.0", id: 7, method: "getBalance", params: ["STANDIN_WALLET"] }) });
await win.fetch("https://rpc.standin.example/", { method: "POST", body: J({ jsonrpc: "2.0", id: 8, method: "sendTransaction", params: ["STANDIN_TX"] }) });
await win.fetch("https://api.standin.example/v1/other");
await win.fetch("https://api.standin.example/v1/coins/a/b/holders");
check("2. a recorded read with any id is answered with its sample", a.status === 200 && (await a.json()).holders[0].owner === "STANDIN_OWNER_1" && a.headers["x-stand-in"] === "sample");
check("2. a JSON-RPC read is answered by its method", b.status === 200 && (await b.json()).result.value === 1234);
check("2. a write, an unrecorded address and a longer path go to the network untouched", J(network) === J(["POST https://rpc.standin.example/", "GET https://api.standin.example/v1/other", "GET https://api.standin.example/v1/coins/a/b/holders"]), J(network));

/* 2b. XMLHttpRequest: a stand-in of the browser's, recording what would have gone out. */
{
  const sent = [];
  class FakeXhr {
    constructor() { this.readyState = 0; this.status = 0; this.responseType = ""; this.responseText = ""; this.response = ""; this.listeners = {}; }
    open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
    send(body) { sent.push(`${this.method} ${this.url}`); this.real = true; }
    addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
    dispatchEvent(ev) { (this.listeners[ev.type] ?? []).forEach((f) => f.call(this, ev)); if (typeof this[`on${ev.type}`] === "function") this[`on${ev.type}`](ev); return true; }
  }
  const xw = { location: { href: "https://mysite.standin.example/" }, XMLHttpRequest: FakeXhr, Event: class { constructor(type) { this.type = type; } } };
  xw.window = xw;
  runInNewContext(S.STAND_IN_RUNTIME, { window: xw, globalThis: xw, URL, JSON, Promise, String, Array, Object, setTimeout });
  const undo = xw.__standIn.install(map);
  const xhr = (method, url, body, type = "") => new Promise((done) => {
    const x = new xw.XMLHttpRequest();
    x.open(method, url);
    x.responseType = type;
    const seen = [];
    x.onreadystatechange = () => seen.push(`rsc${x.readyState}`);
    x.addEventListener("load", () => seen.push("load"));
    x.onloadend = () => { seen.push("loadend"); done({ x, seen }); };
    x.send(body ?? null);
    if (x.real) done({ x, seen, real: true });
  });
  const g1 = await xhr("GET", "https://api.standin.example/v1/coins/STANDIN0MINT0000000000000000000003/holders?limit=5");
  check("2b. an XMLHttpRequest read is answered with its sample: status, text, header and its events in order", !g1.real && g1.x.status === 200 && g1.x.readyState === 4 && JSON.parse(g1.x.responseText).holders[0].owner === "STANDIN_OWNER_1" && g1.x.getResponseHeader("X-Stand-In") === "sample" && J(g1.seen) === J(["rsc4", "load", "loadend"]), J({ status: g1.x.status, seen: g1.seen }));
  const g2 = await xhr("POST", "https://rpc.standin.example/", J({ jsonrpc: "2.0", id: 3, method: "getBalance", params: ["STANDIN_WALLET"] }), "json");
  check("2b. …a JSON-RPC read by its method, as JSON when asked for JSON", !g2.real && g2.x.response?.result?.value === 1234);
  const g3 = await xhr("POST", "https://rpc.standin.example/", J({ jsonrpc: "2.0", id: 4, method: "sendTransaction", params: ["STANDIN_TX"] }));
  const g4 = await xhr("GET", "https://api.standin.example/v1/other");
  check("2b. a write and an unrecorded read go out untouched", g3.real && g4.real && J(sent) === J(["POST https://rpc.standin.example/", "GET https://api.standin.example/v1/other"]), J(sent));
  undo();
  const g5 = await xhr("GET", "https://api.standin.example/v1/coins/STANDIN0MINT0000000000000000000003/holders");
  check("2b. taken away, XMLHttpRequest is the browser's own again", g5.real);
}

/* 2c. Live feeds: a recorded socket and event stream replayed at their pace, in a loop; anything else the browser's own. */
{
  const FEED = { ...MAP, endpoints: [...MAP.endpoints,
    { key: "WS stream.standin.example/ws", method: "WS", host: "stream.standin.example", path: "/ws", read: true, kind: "websocket", stream: { kind: "websocket", count: 3, everyMs: 40 }, sample: { messages: [{ t: 0, data: { price: 1.01 } }, { t: 40, data: { price: 1.02 } }, { t: 80, data: "STANDIN tick" }, { t: 120, data: { binary: 12 } }] } },
    { key: "GET stream.standin.example/trades/:id", method: "GET", host: "stream.standin.example", path: "/trades/:id", read: true, kind: "eventsource", stream: { kind: "eventsource", count: 2 }, sample: { messages: [{ t: 0, type: "trade", data: { side: "buy" } }, { t: 30, data: { ping: 1 } }] } },
  ] };
  const fm = S.standInFromDoc({ standIn: FEED });
  check("2c. feeds are kept apart from reads, bytes left out", fm.streams?.length === 2 && fm.reads.length === 2 && fm.streams[0].messages.length === 3 && fm.streams[1].kind === "eventsource", J(fm.streams));
  check("2c. a document with only a feed still has a stand-in, and turns it on", S.standInOn({ "build.standIn": true }, S.standInFromDoc({ standIn: { endpoints: [FEED.endpoints[5]] } })));
  const made = [];
  class RealWS { constructor(url) { made.push(`ws ${url}`); } }
  class RealES { constructor(url) { made.push(`es ${url}`); } }
  const fw = { location: { href: "https://mysite.standin.example/" }, WebSocket: RealWS, EventSource: RealES };
  fw.window = fw;
  runInNewContext(S.STAND_IN_RUNTIME, { window: fw, globalThis: fw, URL, JSON, Promise, String, Array, Object, Math, setTimeout, clearTimeout });
  const undo = fw.__standIn.install(fm);
  const got = [], evs = [];
  const sock = new fw.WebSocket("wss://stream.standin.example/ws?token=STANDIN");
  sock.onopen = () => got.push("open");
  sock.addEventListener("message", (e) => got.push(e.data));
  sock.send(J({ op: "subscribe" }));
  const es = new fw.EventSource("https://stream.standin.example/trades/STANDIN0MINT01");
  es.addEventListener("trade", (e) => evs.push(`trade ${e.data}`));
  es.onmessage = (e) => evs.push(`message ${e.data}`);
  new fw.WebSocket("wss://other.standin.example/ws");
  new fw.EventSource("https://stream.standin.example/elsewhere");
  await new Promise((r) => setTimeout(r, 300));
  const count = got.length;
  sock.close(); es.close();
  await new Promise((r) => setTimeout(r, 150));
  check("2c. the socket opens and its messages come in order, then again from the first", got[0] === "open" && got[1] === J({ price: 1.01 }) && got[2] === J({ price: 1.02 }) && got[3] === "STANDIN tick" && got[4] === J({ price: 1.01 }) && count >= 6, J(got));
  check("2c. at the recorded pace: about 40 ms apart, not all at once", count <= 12, `${count} in 300ms`);
  check("2c. the event stream's named events and plain messages, replayed", evs[0] === `trade ${J({ side: "buy" })}` && evs[1] === `message ${J({ ping: 1 })}` && evs.length >= 4, J(evs));
  check("2c. closed, nothing more comes", got.length === count);
  check("2c. what the page sends goes nowhere; unrecorded feeds are the browser's own", J(made) === J(["ws wss://other.standin.example/ws", "es https://stream.standin.example/elsewhere"]), J(made));
  undo();
  check("2c. taken away, WebSocket and EventSource are the browser's own again", fw.WebSocket === RealWS && fw.EventSource === RealES);
}

/* 3 */
const field = FORMAT_FIELDS.find((f) => f.id === "build.standIn");
check("3. the Build option is advanced and off by default", field && field.group === "build" && field.type === "toggle" && field.default === false && field.advanced === true, J(field));
check("3. …and on only with something to answer", S.standInOn({ "build.standIn": true }, map) && !S.standInOn({}, map) && !S.standInOn({ "build.standIn": true }, null));
const input = { name: "STANDIN", frameWidth: 1440, pages: [{ id: "page_home", name: "Home", path: "/" }], parts: [], palette: { bg: "#000" }, tokens: {} };
const off = scaffold(input);
check("3. off: a built site carries no stand-in", !off.some((f) => /stand-in/.test(f.path)) && !off.find((f) => f.path === "app/layout.tsx").content.includes("stand-in"));
const on = scaffold({ ...input, standIn: map });
const js = on.find((f) => f.path === "public/stand-in.js");
check("3. on: the runtime and its samples, loaded by the layout before the page, and BUILD.md says so", !!js && on.find((f) => f.path === "app/layout.tsx").content.includes('<script src="/stand-in.js" />') && /stand-in server/.test(on.find((f) => f.path === "BUILD.md").content));
const built = { location: { href: "https://mysite.standin.example/" }, Response: win.Response, fetch: async () => ({ status: 599 }) };
built.window = built;
runInNewContext(js?.content ?? "", { window: built, globalThis: built, URL, JSON, Promise, String, Array });
const c = await built.fetch("https://api.standin.example/v1/coins/STANDIN0MINT0000000000000000000002/holders");
check("3. …and the file it writes answers by itself", c.status === 200 && (await c.json()).holders.length === 1);

/* 4 */
const defaults = { format: () => ({}), look: () => ({}) };
const prev = { pages: [{ id: "page_home" }], nodes: [], frameWidth: 1440, brief: {}, look: {}, standIn: map };
check("4. a new capture brings its own stand-in, or none", takeDoc(prev, { pages: [{ id: "page_home" }], nodes: [], capturer: { learn: true } }, defaults).standIn === null && takeDoc(prev, { pages: [{ id: "page_home" }], nodes: [], standIn: { endpoints: [MAP.endpoints[0]] } }, defaults).standIn.reads.length === 1);
check("4. …a document that is not a capture keeps it", takeDoc(prev, { pages: [{ id: "page_home" }], nodes: [] }, defaults).standIn === map);

/* 5 — held and learned, exactly as sink writes them (held.mjs, learn.mjs). */
const HELD = [
  { page: "page_home", part: "n_button_12", held: "server-call", control: "join-join", selector: "body > form:nth-of-type(1) > button:nth-of-type(1)", live: true, label: "Join", hook: "not pressed: it sends a form to POST standin.example/api/subscribe", form: true, fields: [{ name: "email", type: "text", required: true }] },
  { page: "page_home", part: "n_button_9", held: "wallet", control: "buy", selector: "#buy", live: true, label: "Buy $STANDA", hook: "not pressed: its words read as spending, signing or connecting" },
  { page: "page_home", part: "n_row_7", held: "server-call", control: "spicy", selector: "body > div:nth-of-type(2) > button:nth-of-type(2)", live: true, label: "Spicy", hook: "POST standin.example/api/prefs" },
];
let s = L.learnFromDoc({ held: HELD, capturer: { name: "sink", learn: true, can: ["held", "network", "learn"] } }, undefined);
check("5. sink's capturer line says it can press", s.supported === true);
check("5. its form is a form, its wallet never learnable, its write learnable", s.held[0].form && !L.learnable(s.held[1]) && L.learnable(s.held[2]), J(s.held.map((h) => [h.control, h.why, h.form])));
s = L.queued(s, s.held);
const req = L.learnRequest({ ...s, values: { [L.keyOf(s.held[0])]: "email=owner@STANDIN.example" } }, Date.UTC(2026, 9, 1));
check("5. the one request is the shape sink's learn.mjs reads", req.learn.pressesPerControl === 1 && req.learn.stopOnWallet === true && req.learn.targets.length === 2 && req.learn.targets[0].values.email === "owner@STANDIN.example" && req.learn.targets.every((t) => t.page && t.part && t.selector), J(req));
const back = L.learnFromDoc({ held: HELD.map((h) => (h.control === "join-join" ? { ...h, learned: true } : h)), learned: [{ page: "page_home", part: "n_button_12", control: "join-join", selector: HELD[0].selector, held: "server-call", learned: true, requests: ["POST standin.example/api/subscribe"], screen: "learn/01-join-join.jpg" }], capturer: { learn: true } }, s);
check("5. what sink learned clears its mark and leaves the queue", L.partLearned(back, "n_button_12") && !back.queue.includes(L.keyOf(s.held[0])) && back.queue.includes(L.keyOf(s.held[2])), J(back.queue));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
