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
 *   2. the runtime answers a recorded read (an id in the path, a JSON-RPC
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
