/**
 * THE STAND-IN SERVER: a site's recorded reads, answered with sample data.
 *
 * A capture records every data request each page made on its own (sink
 * `site/capture/network.mjs`): the method, the address with its values left
 * out and ids written `:id`, and one sample answer of each read. Bring reads
 * that map and its samples beside the document (`repoRun.ts`, `standIn` on
 * the document), and this keeps the reads that have a sample.
 *
 * With the advanced Build option **Stand-in server** on (`build.standIn`,
 * off by default), a built or published site answers those reads itself:
 * a request (fetch or XMLHttpRequest) whose method, host and path match a recorded read (`:id`
 * matching any one piece of the path, a JSON-RPC (remote procedure call) or
 * GraphQL read matched by its operation too) gets the sample, and a list or
 * a price shows something real-looking before a backend exists. Anything
 * else, every write among it, goes to the network untouched. A recorded live
 * feed (a WebSocket or an EventSource the capture heard, sink `stream`) is
 * replayed: opened, its messages sent at their recorded pace, from the first
 * again after the last, until it is closed; what the page sends on it goes
 * nowhere. An unrecorded feed is the browser's own.
 *
 * `STAND_IN_RUNTIME` is the one copy of the answering: plain JavaScript,
 * written into a built site (`public/stand-in.js`) and run by the published
 * page (`live/PublishedPage.tsx`). Pure apart from `installStandIn`.
 * `tests/stand-in.mjs`.
 */
export interface StandInRead {
  method: string;
  host: string;
  /** The path as recorded: an id-like piece written `:id`. */
  path: string;
  /** The operation a POST read names: a JSON-RPC method, a GraphQL operation. */
  op?: string | null;
  sample: unknown;
  /** How often the live page asked again, when it did at a steady pace. */
  everyMs?: number | null;
}

/** A live feed as the capture heard it: its messages, each with when it came (ms after the first), replayed at that pace in a loop. */
export interface StandInStream {
  kind: "websocket" | "eventsource";
  host: string;
  path: string;
  messages: { t: number; type?: string; data: unknown }[];
  /** The wait after the last message before the loop starts again, when the feed came at a steady pace. */
  everyMs?: number | null;
}

export interface StandIn {
  site: string | null;
  reads: StandInRead[];
  /** Recorded live feeds (sink `stream`), replayed; absent in a stand-in made before feeds were recorded. */
  streams?: StandInStream[];
}

/** At most this many feeds, and this many messages a feed, are kept with a site. */
export const MOST_STREAMS = 20;
export const MOST_MESSAGES = 50;

/** At most this many reads, and about this many characters of samples, are kept with a site. */
export const MOST_READS = 80;
export const MOST_CHARS = 1_500_000;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * A document's stand-in: its `standIn` (as Bring attached it, or as a
 * published document carries it), or the capture's map inline under `api`.
 * Reads with a sample only; null when there are none.
 */
export function standInFromDoc(doc: Record<string, unknown> | null | undefined): StandIn | null {
  if (!doc) return null;
  const raw = (doc.standIn ?? (doc.api && typeof doc.api === "object" && Array.isArray((doc.api as { endpoints?: unknown }).endpoints) ? doc.api : null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  const list = Array.isArray(raw.reads) ? raw.reads : Array.isArray(raw.endpoints) ? raw.endpoints : [];
  const reads: StandInRead[] = [];
  const streams: StandInStream[] = [];
  let chars = 0;
  for (const e of list as Record<string, unknown>[]) {
    if (!e || typeof e !== "object") continue;
    /* A live feed: a WebSocket or an EventSource, with the messages it sent (sink `stream`, the sample holding `messages`). */
    const kind = str((e.stream as { kind?: unknown } | undefined)?.kind) ?? str(e.kind);
    const said = (e.sample as { messages?: unknown } | null | undefined)?.messages;
    if (kind === "websocket" || kind === "eventsource" || str(e.method)?.toUpperCase() === "WS") {
      const host = str(e.host), path = typeof e.path === "string" ? e.path || "/" : null;
      if (!host || !path || !Array.isArray(said) || streams.length >= MOST_STREAMS) continue;
      const messages = (said as Record<string, unknown>[])
        .filter((m) => m && typeof m === "object" && typeof m.t === "number" && m.data !== undefined && !(m.data && typeof m.data === "object" && "binary" in (m.data as object)))
        .slice(0, MOST_MESSAGES)
        .map((m) => ({ t: Math.max(0, m.t as number), ...(str(m.type) ? { type: str(m.type)! } : {}), data: m.data }));
      const size = JSON.stringify(messages).length;
      if (!messages.length || chars + size > MOST_CHARS) continue;
      chars += size;
      const every = (e.stream as { everyMs?: unknown } | undefined)?.everyMs ?? e.everyMs;
      streams.push({ kind: kind === "eventsource" ? "eventsource" : "websocket", host, path, messages, ...(typeof every === "number" ? { everyMs: every } : {}) });
      continue;
    }
    const method = str(e.method)?.toUpperCase();
    const host = str(e.host);
    const path = typeof e.path === "string" ? e.path || "/" : null;
    if (!method || !host || !path || e.read === false || e.sample === undefined || e.sample === null || typeof e.sample === "string" && /^samples\//.test(e.sample)) continue;
    if (!/^(GET|HEAD|POST)$/.test(method)) continue;
    const op = str((e.op as { name?: unknown } | undefined)?.name) ?? str(e.op);
    if (method === "POST" && !op) continue;
    const size = JSON.stringify(e.sample).length;
    if (reads.length >= MOST_READS || chars + size > MOST_CHARS) break;
    chars += size;
    reads.push({ method, host, path, ...(op ? { op } : {}), sample: e.sample, ...(typeof e.everyMs === "number" ? { everyMs: e.everyMs } : {}) });
  }
  if (Array.isArray(raw.streams)) for (const x of raw.streams as StandInStream[]) if (x && Array.isArray(x.messages) && streams.length < MOST_STREAMS) streams.push(x);
  return reads.length || streams.length ? { site: str(raw.site), reads, ...(streams.length ? { streams } : {}) } : null;
}

/** Something to answer with: a read or a feed. */
export const standInHas = (s: StandIn | null | undefined): s is StandIn => !!s && (s.reads.length > 0 || (s.streams?.length ?? 0) > 0);

/** Whether a site built or published now answers with its stand-in: the option on and something to answer with. */
export const standInOn = (format: Record<string, unknown> | null | undefined, s: StandIn | null | undefined): s is StandIn =>
  format?.["build.standIn"] === true && standInHas(s);

/**
 * The answering, as plain JavaScript: `window.__standIn = { answer, install }`.
 * `answer(map, method, url, body)` is the sample for a recorded read, or
 * undefined; `install(map)` puts it in front of `fetch` and XMLHttpRequest
 * and returns how to take it away. It reads nothing but its arguments and `location`.
 */
export const STAND_IN_RUNTIME = `(function (w) {
  if (w.__standIn) return;
  function opOf(body) {
    if (typeof body !== "string" || !body) return null;
    var j; try { j = JSON.parse(body); } catch (e) { return null; }
    var list = Array.isArray(j) ? j : [j], names = [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x && typeof x.method === "string") names.push(x.method);
      else if (x && typeof x.query === "string") { var m = /^\\s*(query|mutation|subscription)?\\s*([A-Za-z_]\\w*)?/.exec(x.query); names.push(x.operationName || (m && m[2]) || "anonymous"); }
    }
    return names.length ? names.filter(function (n, k) { return names.indexOf(n) === k; }).join(",") : null;
  }
  function samePath(rec, got) {
    var a = rec.split("/"), b = got.split("/");
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== ":id" && a[i] !== b[i]) return false;
    return true;
  }
  function answer(map, method, url, body) {
    if (!map || !map.reads) return undefined;
    var u; try { u = new URL(url, w.location && w.location.href || "http://localhost/"); } catch (e) { return undefined; }
    var m = String(method || "GET").toUpperCase(), op = m === "POST" ? opOf(body) : null;
    for (var i = 0; i < map.reads.length; i++) {
      var r = map.reads[i];
      if (r.method !== m || r.host !== u.host || !samePath(r.path, u.pathname)) continue;
      if (m === "POST" && r.op !== op) continue;
      return r.sample;
    }
    return undefined;
  }
  /* An XMLHttpRequest answered with a sample: its state set as a finished request's, and its events fired as the browser fires them. */
  function answerXhr(x, got) {
    var text = JSON.stringify(got), type = x.responseType;
    var own = function (k, v) { try { Object.defineProperty(x, k, { value: v, configurable: true }); } catch (e) { /* read-only here */ } };
    own("readyState", 4); own("status", 200); own("statusText", "OK"); own("responseURL", x.__standInUrl || "");
    own("responseText", type === "" || type === "text" ? text : "");
    own("response", type === "json" ? JSON.parse(text) : type === "" || type === "text" ? text : null);
    own("getResponseHeader", function (n) { n = String(n).toLowerCase(); return n === "content-type" ? "application/json" : n === "x-stand-in" ? "sample" : null; });
    own("getAllResponseHeaders", function () { return "content-type: application/json\\r\\nx-stand-in: sample\\r\\n"; });
    setTimeout(function () {
      ["readystatechange", "load", "loadend"].forEach(function (t) {
        var ev; try { ev = new w.Event(t); } catch (e) { ev = { type: t }; }
        x.dispatchEvent(ev);
      });
    }, 0);
  }
  /* A recorded feed for this address: same kind, host and path (an :id any one piece). */
  function streamFor(map, kind, url) {
    if (!map || !map.streams) return null;
    var u; try { u = new URL(url, w.location && w.location.href || "http://localhost/"); } catch (e) { return null; }
    for (var i = 0; i < map.streams.length; i++) {
      var s = map.streams[i];
      if (s.kind === kind && s.host === u.host && samePath(s.path, u.pathname) && s.messages && s.messages.length) return s;
    }
    return null;
  }
  /* Events on a stand-in feed: its listeners, then its on<type> handler. */
  function Feed() { this.__l = {}; this.__timer = null; }
  Feed.prototype.addEventListener = function (t, f) { if (typeof f === "function" || (f && f.handleEvent)) (this.__l[t] = this.__l[t] || []).push(f); };
  Feed.prototype.removeEventListener = function (t, f) { var l = this.__l[t] || []; var k = l.indexOf(f); if (k >= 0) l.splice(k, 1); };
  Feed.prototype.dispatchEvent = function (ev) {
    var l = (this.__l[ev.type] || []).slice();
    for (var i = 0; i < l.length; i++) { try { typeof l[i] === "function" ? l[i].call(this, ev) : l[i].handleEvent(ev); } catch (e) { setTimeout(function () { throw e; }, 0); } }
    var h = this["on" + ev.type];
    if (typeof h === "function") { try { h.call(this, ev); } catch (e) { setTimeout(function () { throw e; }, 0); } }
    return true;
  };
  function fire(t, type, extra) { var ev = { type: type, target: t, currentTarget: t }; for (var k in extra) ev[k] = extra[k]; t.dispatchEvent(ev); }
  /* The feed's messages at their recorded pace, from the first again after the last, until it is closed. */
  function replay(t, s, open) {
    var msgs = s.messages, i = 0, lastGap = msgs.length > 1 ? msgs[msgs.length - 1].t - msgs[msgs.length - 2].t : 1000;
    var loopGap = Math.max(50, s.everyMs || lastGap || 1000);
    var next = function () {
      if (!open()) return;
      var m = msgs[i];
      fire(t, m.type || "message", { data: typeof m.data === "string" ? m.data : JSON.stringify(m.data), origin: t.__origin, lastEventId: "" });
      i = (i + 1) % msgs.length;
      var wait = i === 0 ? loopGap : Math.max(0, msgs[i].t - m.t);
      t.__timer = setTimeout(next, wait);
    };
    t.__timer = setTimeout(next, Math.max(0, msgs[0].t));
  }
  function StandInSocket(url, s) {
    Feed.call(this);
    var self = this;
    this.url = String(url); this.readyState = 0; this.protocol = ""; this.extensions = ""; this.bufferedAmount = 0; this.binaryType = "blob";
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    try { this.__origin = new URL(url, w.location.href).origin; } catch (e) { this.__origin = ""; }
    setTimeout(function () {
      if (self.readyState !== 0) return;
      self.readyState = 1;
      fire(self, "open", {});
      replay(self, s, function () { return self.readyState === 1; });
    }, 0);
  }
  StandInSocket.prototype = Object.create(Feed.prototype);
  /* Nothing the page sends on a stand-in feed leaves the machine. */
  StandInSocket.prototype.send = function () {};
  StandInSocket.prototype.close = function (code, reason) {
    if (this.readyState >= 2) return;
    this.readyState = 3; clearTimeout(this.__timer);
    fire(this, "close", { code: code || 1000, reason: reason || "", wasClean: true });
  };
  StandInSocket.CONNECTING = StandInSocket.prototype.CONNECTING = 0; StandInSocket.OPEN = StandInSocket.prototype.OPEN = 1;
  StandInSocket.CLOSING = StandInSocket.prototype.CLOSING = 2; StandInSocket.CLOSED = StandInSocket.prototype.CLOSED = 3;
  function StandInEvents(url, s) {
    Feed.call(this);
    var self = this;
    this.url = String(url); this.readyState = 0; this.withCredentials = false;
    this.onopen = this.onmessage = this.onerror = null;
    try { this.__origin = new URL(url, w.location.href).origin; } catch (e) { this.__origin = ""; }
    setTimeout(function () {
      if (self.readyState !== 0) return;
      self.readyState = 1;
      fire(self, "open", {});
      replay(self, s, function () { return self.readyState === 1; });
    }, 0);
  }
  StandInEvents.prototype = Object.create(Feed.prototype);
  StandInEvents.prototype.close = function () { this.readyState = 2; clearTimeout(this.__timer); };
  StandInEvents.CONNECTING = StandInEvents.prototype.CONNECTING = 0; StandInEvents.OPEN = StandInEvents.prototype.OPEN = 1; StandInEvents.CLOSED = StandInEvents.prototype.CLOSED = 2;
  function install(map) {
    var undo = [];
    /* Live feeds: a recorded one is replayed, anything else is the browser's own. */
    var RealWS = w.WebSocket;
    if (RealWS && map && map.streams && map.streams.length) {
      var WS = function (url, protocols) {
        var s = streamFor(map, "websocket", url);
        if (s) return new StandInSocket(url, s);
        return protocols === undefined ? new RealWS(url) : new RealWS(url, protocols);
      };
      WS.prototype = RealWS.prototype;
      ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) { WS[k] = RealWS[k]; });
      w.WebSocket = WS;
      undo.push(function () { w.WebSocket = RealWS; });
    }
    var RealES = w.EventSource;
    if (RealES && map && map.streams && map.streams.length) {
      var ES = function (url, init) {
        var s = streamFor(map, "eventsource", url);
        if (s) return new StandInEvents(url, s);
        return init === undefined ? new RealES(url) : new RealES(url, init);
      };
      ES.prototype = RealES.prototype;
      ["CONNECTING", "OPEN", "CLOSED"].forEach(function (k) { ES[k] = RealES[k]; });
      w.EventSource = ES;
      undo.push(function () { w.EventSource = RealES; });
    }
    var real = w.fetch;
    if (real) {
      w.fetch = function (input, init) {
        try {
          var url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
          var method = (init && init.method) || (input && input.method) || "GET";
          var body = init && typeof init.body === "string" ? init.body : null;
          var got = answer(map, method, url, body);
          if (got !== undefined) return Promise.resolve(new w.Response(JSON.stringify(got), { status: 200, headers: { "content-type": "application/json", "x-stand-in": "sample" } }));
        } catch (e) { /* the page's own request goes on */ }
        return real.apply(this, arguments);
      };
      undo.push(function () { w.fetch = real; });
    }
    /* XMLHttpRequest: open() is remembered, send() answers a recorded read and sends nothing; anything else goes on as it was. */
    var X = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
    if (X) {
      var open = X.open, send = X.send;
      X.open = function (method, url) {
        try { this.__standInMethod = String(method || "GET"); this.__standInUrl = String(url); } catch (e) { /* */ }
        return open.apply(this, arguments);
      };
      X.send = function (body) {
        try {
          var got = this.__standInUrl ? answer(map, this.__standInMethod, this.__standInUrl, typeof body === "string" ? body : null) : undefined;
          if (got !== undefined) { answerXhr(this, got); return; }
        } catch (e) { /* the page's own request goes on */ }
        return send.apply(this, arguments);
      };
      undo.push(function () { X.open = open; X.send = send; });
    }
    return function () { undo.forEach(function (f) { f(); }); };
  }
  w.__standIn = { answer: answer, install: install, streamFor: streamFor };
})(typeof window !== "undefined" ? window : globalThis);`;

/** The runtime in this window, once, answering with `map`. Returns how to take it away. */
export function installStandIn(map: StandIn, w: Window & { __standIn?: { install: (m: StandIn) => () => void } } = window): () => void {
  if (!w.__standIn) new Function(STAND_IN_RUNTIME)();
  return w.__standIn!.install(map);
}

/** A built site's stand-in: the runtime and the map in one file, loaded by the layout before the page's own scripts. */
export function standInFiles(map: StandIn): { path: string; content: string }[] {
  return [{
    path: "public/stand-in.js",
    content: `/* The stand-in server: this site's recorded reads answered with sample data until a real backend exists.
 * Turn it off with the Build option "Stand-in server", or delete this file and its <script> in app/layout.tsx.
 * Writes, and anything not recorded, go to the network untouched. Edit a sample below to change what a read answers. */
${STAND_IN_RUNTIME}
window.__standIn.install(${JSON.stringify(map, null, 1)});
`,
  }];
}
