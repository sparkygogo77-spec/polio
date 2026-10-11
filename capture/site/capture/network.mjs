/**
 * THE NETWORK RECORDER: every request a page makes on its own, as an API map.
 *
 * While a page is captured, each data request it makes (fetch, XHR (the
 * browser's XMLHttpRequest), EventSource and WebSocket; never its pictures,
 * faces, styles or scripts) is written down once per endpoint: the method,
 * the address with its values redacted, the answers' statuses, the shape of
 * what came back, how often the page asked again, and one sample answer.
 * The converter gathers every page's into one map for the site
 * (`sites/<name>/api/map.json`, samples beside it), and polio's export can
 * answer those reads with the samples before a real backend exists.
 *
 * NOTHING SECRET IS KEPT. The address and every sample go through the same
 * stripping `sources-recorder.js` does in the page (`clean.url`,
 * `clean.value`, run here in a sandbox so there is one set of rules): a key,
 * a token, a signature, a seed, a JWT (JSON web token) or a bearer value is
 * `[redacted]`; header values are never read. Then the map's own address
 * leaves every value out (`?q=…`) and writes an id-like piece of the path as
 * `:id`, so one endpoint is one entry however many ids it was asked with.
 *
 * READ OR WRITE. A GET, HEAD or OPTIONS is a read; so is a POST whose body
 * is a JSON-RPC (remote procedure call) asking only for reads (`getBalance`,
 * `eth_call`, …) or a GraphQL query that is not a mutation. Anything else is
 * a write. A write the page makes on its own as it loads (an analytics ping)
 * is recorded as one; a write a press would make is what an automatic
 * capture never lets out (`guardWrites`), and the press is held.
 *
 * LIVE FEEDS, READ ONLY. A WebSocket's incoming frames (Playwright's own view
 * of the browser's socket) and an EventSource's messages (listened to beside
 * the page's own listeners, EVENTSOURCE_WATCH) are kept: the first
 * `STREAM_MAX`, each with its time, its value cut short and stripped, and the
 * pace they came at (`stream`, `streamOf`); what the page sent on a socket is
 * kept as its shape only. Nothing is ever sent on a feed but what the page
 * itself sent.
 *
 * Pure apart from `recordNetwork` and `guardWrites`, which are handed a
 * Playwright page. `check-network.mjs`.
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

export const NETWORK_VERSION = 1;
/** The resource types that are data. */
const DATA = new Set(["fetch", "xhr", "eventsource", "websocket"]);
/** An answer read for its shape and sample: no bigger than this. */
const READ_MAX = 1_000_000;
/** A sample kept for the stand-in: about this many characters at most. */
const SAMPLE_CHARS = 16_000;
/** A stream's messages kept: the first this many, each cut to about this many characters. */
export const STREAM_MAX = 50;
const MESSAGE_CHARS = 2_000;

/* The stripping itself, from sources-recorder.js: one set of rules, in the page and here. */
let cleaners = null;
function clean() {
  if (cleaners) return cleaners;
  const win = { location: { href: "https://standin.invalid/" }, URL, __sinkSourcesConfig: {} };
  win.window = win;
  runInNewContext(readFileSync(new URL("./sources-recorder.js", import.meta.url), "utf8"), {
    window: win, location: win.location, URL, document: { addEventListener() {} },
    Date, Math, JSON, Object, Array, Set, Map, String, Number, RegExp, parseFloat, isFinite, encodeURIComponent, decodeURIComponent,
  });
  cleaners = win.__sinkSources.clean;
  return cleaners;
}
/** A value with every secret out, as sources-recorder.js strips it. */
export const cleanValue = (v) => clean().value(v, {});

const idLike = (seg) => /^\d{3,}$/.test(seg) || /^[0-9a-f]{8,}$/i.test(seg) || /^[0-9a-f-]{32,36}$/i.test(seg)
  || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(seg) || (/^[A-Za-z0-9_-]{16,}$/.test(seg) && /\d/.test(seg)) || seg === "[redacted]" || seg === "{wallet}";

/**
 * An address as the map keeps it: no user, no password, no value. The path's
 * id-like pieces are `:id`; the query keeps its names, each `=…`.
 */
export function redactUrl(raw, base = "https://standin.invalid/") {
  let u;
  try { u = new URL(clean().url(String(raw), {}).url, base); } catch { return { url: String(raw).split(/[?#]/)[0], host: "", path: "", query: [] }; }
  const path = u.pathname.split("/").map((s) => { let d = s; try { d = decodeURIComponent(s); } catch { /* as written */ } return idLike(d) ? ":id" : s; }).join("/");
  const query = [...new Set([...u.searchParams.keys()])];
  const scheme = u.protocol === "wss:" || u.protocol === "ws:" ? u.protocol : u.protocol;
  return { url: `${scheme}//${u.host}${path}${query.length ? `?${query.map((k) => `${k}=…`).join("&")}` : ""}`, host: u.host, path, query };
}

/** The operation a body asks for: a JSON-RPC method (or several), or a GraphQL operation. */
export function operationOf(body) {
  if (typeof body !== "string" || !body) return null;
  let j; try { j = JSON.parse(body); } catch { return null; }
  const one = (x) => {
    if (!x || typeof x !== "object") return null;
    if (typeof x.method === "string") return { kind: "rpc", name: x.method };
    if (typeof x.query === "string") {
      const m = /^\s*(query|mutation|subscription)?\s*([A-Za-z_]\w*)?/.exec(x.query);
      return { kind: "graphql", name: x.operationName ?? m?.[2] ?? "anonymous", op: m?.[1] ?? "query" };
    }
    return null;
  };
  const list = (Array.isArray(j) ? j : [j]).map(one).filter(Boolean);
  if (!list.length) return null;
  return { kind: list[0].kind, name: [...new Set(list.map((x) => x.name))].join(","), ops: list };
}

/** A JSON-RPC method that only reads: Solana's get…/is…/simulate…, Ethereum's eth_call and eth_get…, the chain's id. */
const RPC_READ = /^(get|is|simulate|query|eth_(call|get|chainId|blockNumber|gasPrice|estimateGas|feeHistory)|net_|web3_)/i;

/** A read: nothing on the server changes when it is asked. */
export function isRead(method, body) {
  const m = String(method || "GET").toUpperCase();
  if (/^(GET|HEAD|OPTIONS|WS)$/.test(m)) return true;
  if (m !== "POST") return false;
  const op = operationOf(body);
  if (!op) return false;
  if (op.kind === "rpc") return op.ops.every((o) => RPC_READ.test(o.name));
  return op.ops.every((o) => o.op === "query");
}

/** The shape of an answer: each key's kind, an array as its items' merged shape and a length. Values left out. */
export function shapeOf(v, depth = 0) {
  if (v === null) return "null";
  if (Array.isArray(v)) {
    if (depth > 6) return ["…"];
    const items = v.slice(0, 5).map((x) => shapeOf(x, depth + 1));
    const objs = items.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    const merged = objs.length ? Object.assign({}, ...objs) : items[0] ?? "unknown";
    return [merged];
  }
  if (typeof v === "object") {
    if (depth > 6) return "object";
    const o = {};
    for (const k of Object.keys(v).slice(0, 60)) o[k] = shapeOf(v[k], depth + 1);
    return o;
  }
  return typeof v;
}

/** A sample small enough to keep: long lists cut to their first items, long words cut. Secrets already out. */
export function sampleOf(v, budget = SAMPLE_CHARS) {
  const prune = (x, depth, items) => {
    if (typeof x === "string") return x.length > 400 ? `${x.slice(0, 399)}…` : x;
    if (!x || typeof x !== "object") return x;
    if (depth <= 0) return Array.isArray(x) ? [] : {};
    if (Array.isArray(x)) return x.slice(0, items).map((y) => prune(y, depth - 1, items));
    const o = {};
    for (const k of Object.keys(x).slice(0, 80)) o[k] = prune(x[k], depth - 1, items);
    return o;
  };
  for (const [depth, items] of [[10, 25], [8, 12], [6, 6], [4, 3], [2, 2]]) {
    const s = prune(v, depth, items);
    if (JSON.stringify(s).length <= budget) return s;
  }
  return null;
}

/**
 * A live feed as kept: its first `STREAM_MAX` messages, each with when it came
 * (ms after the first) and what it said, secrets stripped and cut short (JSON
 * as a value, words as words, bytes only as their count), and how often they
 * came. `messages` is `{ t, data, type? }` as the browser handed them.
 */
export function streamOf(messages, total = messages.length) {
  const list = messages.slice(0, STREAM_MAX);
  const t0 = list.length ? list[0].t : 0;
  const kept = list.map((m) => {
    let data;
    if (m.data && typeof m.data === "object" && typeof m.data.binary === "number") data = { binary: m.data.binary };
    else {
      const text = String(m.data ?? "");
      let j; try { j = JSON.parse(text); } catch { j = undefined; }
      data = j !== undefined && j !== null && typeof j === "object" ? sampleOf(cleanValue(j), MESSAGE_CHARS) : cleanValue(text.length > 500 ? `${text.slice(0, 499)}…` : text);
    }
    return { t: Math.max(0, Math.round(m.t - t0)), ...(m.type && m.type !== "message" ? { type: m.type } : {}), data };
  });
  const every = everyOf(kept.map((m) => m.t));
  const first = kept.find((m) => m.data && typeof m.data === "object" && !("binary" in m.data));
  return { messages: kept, count: total, ...(every ? { everyMs: every.ms, steady: every.steady } : {}), shape: first ? shapeOf(first.data) : kept.length ? typeof kept[0].data : null };
}

/** The key one endpoint is kept under: method, host and path, and the operation a body names. */
export const endpointKey = (method, redacted, op) => `${method} ${redacted.host}${redacted.path}${op ? `#${op.name}` : ""}`;

/** The key of one request, as the map files it. */
export const keyOfRequest = (method, url, body, base) => endpointKey(String(method || "GET").toUpperCase(), redactUrl(url, base), operationOf(body));

/** How often the page asked again, from the times it asked (ms): the middle gap, when it asked three times or more at a steady pace. */
export function everyOf(times) {
  if (times.length < 3) return null;
  const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 200).sort((a, b) => a - b);
  if (gaps.length < 2) return null;
  const mid = gaps[Math.floor(gaps.length / 2)];
  const steady = gaps.every((g) => Math.abs(g - mid) <= Math.max(500, mid * 0.35));
  return { ms: Math.round(mid), steady };
}

/**
 * The map of one page, from what was seen: `seen` is a list of
 * `{ method, url, body, status, type, json, t, phase }` as the browser
 * reported them. Pure: the check hands it a list.
 */
export function mapOf(seen, { base, writes = false } = {}) {
  const byKey = new Map();
  for (const s of seen) {
    const method = String(s.method || "GET").toUpperCase();
    const r = redactUrl(s.url, base);
    const op = operationOf(s.body);
    const key = endpointKey(method, r, op);
    let e = byKey.get(key);
    if (!e) {
      e = { key, method, url: r.url, host: r.host, path: r.path, query: r.query, ...(op ? { op: { kind: op.kind, name: op.name } } : {}), read: isRead(method, s.body), kind: s.kind ?? "fetch", statuses: [], type: null, count: 0, times: [], phases: [], shape: null, sample: undefined };
      byKey.set(key, e);
    }
    e.count++;
    if (s.phase && !e.phases.includes(s.phase)) e.phases.push(s.phase);
    /* Refresh timing is read off the page left alone: its load and the time it stood open, not the presses and reloads. */
    if (typeof s.t === "number" && (!s.phase || s.phase === "load" || s.phase === "open")) e.times.push(s.t);
    if (s.status != null && !e.statuses.includes(s.status)) e.statuses.push(s.status);
    if (s.type && !e.type) e.type = String(s.type).split(";")[0].trim();
    /* What was sent, as its shape: names and kinds, never the values (an owner's typed values stay his). */
    if (!e.body && typeof s.body === "string" && s.body) {
      let j = null; try { j = JSON.parse(s.body); } catch { /* a form */ }
      e.body = j !== null ? shapeOf(j) : Object.fromEntries([...new URLSearchParams(s.body).keys()].map((k) => [k, "string"]));
    }
    /* A live feed: what came down it, read only, from the first connection that said anything. */
    if (s.messages?.length && e.sample === undefined) {
      const st = streamOf(s.messages, s.frames ?? s.messages.length);
      e.stream = { kind: s.kind, count: st.count, ...(st.everyMs ? { everyMs: st.everyMs, steady: st.steady } : {}), ...(s.sent ? { sent: s.sent } : {}) };
      e.shape = st.shape;
      e.sample = { messages: st.messages };
    }
    if ((e.read || writes) && s.json !== undefined && e.sample === undefined && s.status >= 200 && s.status < 300) {
      const cleaned = cleanValue(s.json);
      e.shape = shapeOf(cleaned);
      e.sample = sampleOf(cleaned);
    }
  }
  return [...byKey.values()].map(({ times, ...e }) => {
    const every = everyOf(times.sort((a, b) => a - b));
    return { ...e, ...(every ? { everyMs: every.ms, steady: every.steady } : {}), ...(e.sample === undefined ? { sample: null } : {}) };
  });
}

/**
 * Watch a page's data requests. Returns `phase(name)` to say what the
 * capture is doing now ("load", "open", "press", "learn:<id>"), `seen` (the
 * raw list, secrets not yet stripped: it never leaves this process) and
 * `report()`, the page's map.
 */
export function recordNetwork(page, { started = Date.now(), base } = {}) {
  const seen = [];
  let phase = "load";
  const pending = new Map();
  /* An endpoint whose answer was read once (2xx JSON): later answers of it are counted and timed, never read again (mapOf keeps the first sample only). */
  const sampled = new Set();
  page.on("request", (q) => {
    if (!DATA.has(q.resourceType())) return;
    let body = null; try { body = q.postData(); } catch { /* bytes */ }
    const rec = { method: q.method(), url: q.url(), body: body && body.length < 20_000 ? body : null, kind: q.resourceType(), t: Date.now() - started, phase, status: null };
    pending.set(q, rec);
    seen.push(rec);
  });
  page.on("response", async (res) => {
    const rec = pending.get(res.request());
    if (!rec) return;
    pending.delete(res.request());
    rec.status = res.status();
    const type = res.headers()["content-type"] ?? "";
    rec.type = type;
    if (!/json/i.test(type) || /event-stream/i.test(type)) return;
    const len = Number(res.headers()["content-length"] ?? 0);
    if (len > READ_MAX) return;
    const key = keyOfRequest(rec.method, rec.url, rec.body, base ?? page.url());
    if (sampled.has(key)) return;
    try { const text = await res.text(); if (text.length <= READ_MAX) { rec.json = JSON.parse(text); if (rec.status >= 200 && rec.status < 300) sampled.add(key); } } catch { /* gone, or not JSON after all */ }
  });
  page.on("requestfailed", (q) => { const rec = pending.get(q); if (rec) { rec.status = 0; rec.failed = q.failure()?.errorText ?? "failed"; pending.delete(q); } });
  /*
   * A WebSocket: what came down it is read as it arrives, and what the page
   * sent on it only as its shape. Nothing is ever sent on it but what the
   * page itself sent: these are the browser's own frames, watched.
   */
  page.on("websocket", (ws) => {
    const rec = { method: "WS", url: ws.url(), kind: "websocket", t: Date.now() - started, phase, status: 101, messages: [], frames: 0 };
    seen.push(rec);
    const opened = Date.now();
    ws.on("framereceived", (f) => {
      rec.frames++;
      if (rec.messages.length < STREAM_MAX) rec.messages.push({ t: Date.now() - opened, data: typeof f.payload === "string" ? f.payload : { binary: f.payload?.length ?? 0 } });
    });
    ws.on("framesent", (f) => {
      if (typeof f.payload !== "string") return;
      /* Every shape the page sent on its own as it loaded and stood open (up to 50): a press's frame of the same shape is the page's, not the press's (capture-route.mjs `background`). */
      if ((rec.sentShapes ??= []).length < 50) { const k = keyOfSocketSend(ws.url(), f.payload, page.url()); if (!rec.sentShapes.includes(k)) rec.sentShapes.push(k); }
      if ((rec.sent ??= []).length >= 3) return;
      let j; try { j = JSON.parse(f.payload); } catch { j = undefined; }
      rec.sent.push(j !== undefined ? shapeOf(j) : "string");
    });
  });
  /* An EventSource: the page's own, listened to beside it (EVENTSOURCE_WATCH), its messages collected by `flush()`. */
  const ready = page.addInitScript(EVENTSOURCE_WATCH).catch(() => {});
  return {
    seen,
    ready,
    flush: async () => {
      const logs = await page.evaluate(() => (window.__sinkStreams || []).map((l) => ({ url: l.url, count: l.count, messages: l.messages.slice() }))).catch(() => []);
      for (const l of logs) {
        const rec = seen.find((q) => q.kind === "eventsource" && q.url === l.url && !q.messages) ?? (() => { const q = { method: "GET", url: l.url, kind: "eventsource", phase, status: 200 }; seen.push(q); return q; })();
        rec.messages = l.messages; rec.frames = l.count;
      }
    },
    phase: (p) => { phase = p; },
    report: () => ({ version: NETWORK_VERSION, endpoints: mapOf(seen, { base: base ?? page.url() }) }),
  };
}

/**
 * Put into the page before its scripts: every EventSource it opens is
 * listened to beside it, read only (the messages it gets, and the named events
 * the page itself listens for), into `window.__sinkStreams`. It sends nothing
 * and changes nothing the page sees.
 */
export const EVENTSOURCE_WATCH = `(() => {
  const Real = window.EventSource;
  if (!Real || window.__sinkStreams) return;
  window.__sinkStreams = [];
  const MAX = ${STREAM_MAX};
  function W(url, init) {
    const es = init === undefined ? new Real(url) : new Real(url, init);
    const log = { url: es.url, opened: Date.now(), count: 0, messages: [] };
    window.__sinkStreams.push(log);
    const watched = new Set();
    const hear = (e) => { log.count++; if (log.messages.length < MAX) log.messages.push({ t: Date.now() - log.opened, type: e.type, data: String(e.data).slice(0, 20000) }); };
    const watch = (type) => { if (watched.has(type) || type === "open" || type === "error") return; watched.add(type); Real.prototype.addEventListener.call(es, type, hear); };
    watch("message");
    const add = es.addEventListener;
    es.addEventListener = function (type) { try { watch(String(type)); } catch (e) { /* */ } return add.apply(this, arguments); };
    return es;
  }
  W.prototype = Real.prototype;
  ["CONNECTING", "OPEN", "CLOSED"].forEach((k) => { W[k] = Real[k]; });
  window.EventSource = W;
})();`;

/**
 * A frame the page sends on a WebSocket, read or write. A heartbeat
 * ("ping", "pong", a Socket.IO "2"/"3"), a JSON-RPC asking only for reads
 * (`getBalance`, `accountSubscribe`) and a subscribe/unsubscribe of any
 * shape (`{ type: "subscribe" }`, `["subscribe", …]`, `{ op: "unsub" }`) are
 * reads; anything else (a vote, a chat line, a game move) is a write. Written
 * to run in the page too (`WRITE_WATCH` carries its source), so it uses
 * nothing from this file.
 */
export function isSocketRead(payload) {
  if (typeof payload !== "string") return false;
  const READ_WORD = /^(ping|pong|heartbeat|hb|keepalive|sub|subscribe|unsub|unsubscribe|get[A-Z_]\w*|query|hello)$/i;
  const RPC = /^(get|is|simulate|query|eth_(call|get|chainId|blockNumber|gasPrice|estimateGas|feeHistory)|net_|web3_|\w*(un)?subscribe)/i;
  const s = payload.trim();
  if (!s || /^(ping|pong|heartbeat|[2356])$/i.test(s)) return true;
  let j; try { j = JSON.parse(s); } catch { return false; }
  const one = (x) => {
    if (typeof x === "string") return READ_WORD.test(x);
    if (!x || typeof x !== "object") return false;
    if (typeof x.method === "string") return RPC.test(x.method);
    for (const k of ["type", "event", "op", "action", "cmd", "command", "channel_op"]) if (typeof x[k] === "string") return READ_WORD.test(x[k]);
    return false;
  };
  if (Array.isArray(j)) return j.length > 0 && (typeof j[0] === "string" ? one(j[0]) : j.every(one));
  return one(j);
}

/** The key of a frame a press sent on a socket: the socket's redacted address and the frame's shape, never its values. */
export function keyOfSocketSend(url, payload, base) {
  let shape = "string";
  if (typeof payload === "string") { try { shape = shapeOf(JSON.parse(payload)); } catch { /* words */ } }
  else if (payload && typeof payload === "object") shape = payload.binary != null ? "binary" : payload;
  return `WS ${redactUrl(url, base).url} ${JSON.stringify(shape)}`;
}

/**
 * Put into the page before its scripts, by `guardWrites`: a press that writes
 * over an already-open WebSocket is never seen by the browser's request
 * routing, so the socket's `send` is watched here. While `__sinkGuard.on`,
 * a frame that is not a read (`isSocketRead`) is dropped before it leaves and
 * reported through `__sinkGuardStopped` (the capturer's own binding; the
 * frame's words stay inside the capturer and are kept only as their shape).
 * A `navigator.sendBeacon` made while on is dropped the same way. Off, both
 * run as the page wrote them.
 */
export const WRITE_WATCH = `(() => {
  if (window.__sinkGuard) return;
  const g = window.__sinkGuard = { on: false };
  const isSocketRead = ${isSocketRead.toString()};
  const report = (kind, url, payload) => { try { const f = window.__sinkGuardStopped; if (typeof f === "function") f({ kind, url: String(url), payload: typeof payload === "string" ? payload : { binary: payload && payload.byteLength != null ? payload.byteLength : payload && payload.size != null ? payload.size : 0 } }); } catch (e) { /* no binding */ } };
  const W = window.WebSocket;
  if (W && W.prototype && typeof W.prototype.send === "function") {
    const realSend = W.prototype.send;
    W.prototype.send = function (data) {
      if (g.on && !(typeof data === "string" && isSocketRead(data))) { report("WS", this.url, data); return; }
      return realSend.apply(this, arguments);
    };
  }
  const nav = window.navigator;
  if (nav && typeof nav.sendBeacon === "function") {
    const realBeacon = nav.sendBeacon;
    nav.sendBeacon = function (url, data) {
      if (g.on) { report("BEACON", (() => { try { return new URL(String(url), location.href).href; } catch (e) { return String(url); } })(), typeof data === "string" ? data : ""); return true; }
      return realBeacon.apply(this, arguments);
    };
  }
})();`;

/**
 * While armed, a write a press would make is stopped before it leaves (a read
 * goes on): a fetch or XHR by the browser's request routing, a frame on a
 * WebSocket or a beacon by `WRITE_WATCH` in the page. `on(list)` arms it and
 * writes each stopped write into `list`; `off()` disarms; both settle once the
 * page knows. Returns the handle and `dispose()` to take the route away.
 */
export async function guardWrites(page, { nav = false } = {}) {
  let list = null;
  /* The socket's and the beacon's side: in the page, every frame from now on and the frames already open (the prototype is patched, so a socket opened before counts too). */
  await page.exposeBinding("__sinkGuardStopped", (_src, q) => {
    if (!list || !q) return;
    const method = q.kind === "BEACON" ? "BEACON" : "WS";
    list.push({ method, url: redactUrl(q.url, page.url()).url, key: method === "WS" ? keyOfSocketSend(q.url, q.payload, page.url()) : `BEACON ${redactUrl(q.url, page.url()).url}` });
  }).catch(() => {});
  await page.addInitScript(WRITE_WATCH).catch(() => {});
  const inPage = (code) => Promise.all(page.frames().map((f) => f.evaluate(code).catch(() => {})));
  await inPage(WRITE_WATCH);
  const arm = (v) => inPage(`(() => { ${WRITE_WATCH}; if (window.__sinkGuard) window.__sinkGuard.on = ${v}; })()`);
  const route = async (r) => {
    const q = r.request();
    /* With `nav`, a press that would load another page is answered 204 (No Content), on which the browser stays, and its address kept. */
    if (list && nav && q.isNavigationRequest() && q.frame() === page.mainFrame()) { list.push({ nav: q.url() }); return r.fulfill({ status: 204, body: "" }).catch(() => {}); }
    if (list && !/^(image|font|stylesheet|media|script|manifest|texttrack)$/.test(q.resourceType()) && !q.isNavigationRequest() && !isRead(q.method(), (() => { try { return q.postData(); } catch { return null; } })())) {
      let body = null; try { body = q.postData(); } catch { /* bytes */ }
      list.push({ method: q.method(), url: redactUrl(q.url(), page.url()).url, key: keyOfRequest(q.method(), q.url(), body, page.url()) });
      return r.abort().catch(() => {});
    }
    return r.fallback().catch(() => {});
  };
  await page.route("**/*", route);
  return {
    on: async (l) => { list = l; await arm(true); },
    off: async () => { await arm(false); list = null; },
    dispose: () => page.unroute("**/*", route).catch(() => {}),
  };
}

/**
 * The site's map: every page's endpoints as one, each with the pages that
 * asked for it, and the samples to write beside it (`api/samples/<n>.json`).
 */
export function siteMap(pages) {
  const byKey = new Map();
  for (const { page, network } of pages) {
    if (!network || network.version !== NETWORK_VERSION) continue;
    for (const e of network.endpoints ?? []) {
      const had = byKey.get(e.key);
      if (!had) { byKey.set(e.key, { ...e, pages: [page] }); continue; }
      if (!had.pages.includes(page)) had.pages.push(page);
      had.count += e.count;
      for (const s of e.statuses) if (!had.statuses.includes(s)) had.statuses.push(s);
      for (const p of e.phases) if (!had.phases.includes(p)) had.phases.push(p);
      if (had.sample == null && e.sample != null) Object.assign(had, { sample: e.sample, shape: e.shape, ...(e.stream ? { stream: e.stream } : {}) });
      if (e.everyMs && !had.everyMs) Object.assign(had, { everyMs: e.everyMs, steady: e.steady });
    }
  }
  const endpoints = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  const samples = [];
  const map = endpoints.map(({ sample, ...e }, i) => {
    if (sample == null) return e;
    const file = `samples/${String(i + 1).padStart(3, "0")}.json`;
    samples.push({ file, sample });
    return { ...e, sample: file };
  });
  return { version: NETWORK_VERSION, endpoints: map, samples };
}
