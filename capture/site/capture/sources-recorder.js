/**
 * Where each live value on the page comes from.
 *
 * Runs in the page, before its own scripts when `capture-route.mjs
 * --sources` injects it, or pasted into the console by hand (see
 * `console-capture.mjs`). It records the page's data traffic — fetch, XHR
 * and WebSocket: the method, the address, how often each repeats, and a
 * small sample of what came back — and watches the page's words. When an
 * element's words change just after an answer arrives, and a number in the
 * new words is a number in that answer (as displayed: rounded, with $ and
 * commas, K/M/B, a percent, or lamports shown as SOL), the element is
 * recorded as fed by that source at that JSON path.
 *
 * Nothing secret is kept. Header values are never read (only whether an
 * auth header was sent). Query parameters named like a key, token, secret,
 * signature or password are written `[redacted]`, and so is any value that
 * looks like one: a JWT, a UUID, a long random token, a signature, a long
 * base64 blob, a hex key, a 64-byte key array, a seed phrase. A public
 * address (base58, 32–44 characters) is kept, except the connected
 * wallet's, which is written `{wallet}` and marks the source as needing a
 * wallet. A private key or seed is never stored.
 *
 *   window.__sinkSources.report()   the sources section, as the capture holds it
 *   window.__sinkSources.mark()     writes data-sink-feeds on each fed element, for the dump
 *   window.__sinkSources.clean      the stripping itself (url, value), for the check
 *
 * Plain ES2019, no imports: it must paste into any console.
 */
(function () {
  if (window.__sinkSources) return;
  var VERSION = 1;
  var WINDOW_MS = 2000; // an element's words must change within this long of an answer to be fed by it
  var KEEP_MS = 4000; // how long answers and changes are held for matching
  var SAMPLE_CHARS = 1500;
  var LEAVES_MAX = 3000;
  var started = Date.now();
  var now = function () { return Date.now() - started; };
  var config = window.__sinkSourcesConfig || {};

  /* ---------------------------------------------------------------- */
  /* The wallet                                                         */
  /* ---------------------------------------------------------------- */

  var walletSeen = null;
  function wallet() {
    try {
      var cands = [config.wallet, window.phantom && window.phantom.solana, window.solana, window.solflare, window.backpack, window.xnft && window.xnft.solana, window.glowSolana];
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (!c) continue;
        var pk = typeof c === "string" ? c : c.publicKey;
        var s = pk && (typeof pk === "string" ? pk : pk.toBase58 ? pk.toBase58() : String(pk));
        if (s && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) { walletSeen = s; return s; }
      }
    } catch (e) { /* a provider that throws is no wallet */ }
    return walletSeen;
  }

  /* ---------------------------------------------------------------- */
  /* Secrets out                                                        */
  /* ---------------------------------------------------------------- */

  /* A name that says secret: its value is never kept. "token" alone is weaker, because on Solana a token is
     usually a mint, a public address: its value is kept when it is one. Public keys say so. */
  var SECRET_NAME = /(api[-_]?key|apikey|^key$|[-_]key$|secret|passw|pwd|^auth$|authoriz|auth[-_]?token|x-auth|signature|^sig$|session|jwt|bearer|credential|private|seed|mnemonic|cookie|client[-_]?id|access[-_]?token)/i;
  var WEAK_NAME = /token/i;
  var PUBLIC_NAME = /(public|pubkey)/i;
  var ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  function secretName(name, value) {
    if (PUBLIC_NAME.test(name)) return false;
    if (SECRET_NAME.test(name)) return true;
    return WEAK_NAME.test(name) && typeof value === "string" && !ADDRESS.test(value.trim()) && value.trim().length >= 16;
  }
  var B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
  var R = "[redacted]";

  /** A string as it may be kept: the wallet as {wallet}, anything key-like redacted. */
  function cleanString(s, flags) {
    if (typeof s !== "string") return s;
    var w = wallet();
    if (w && s.indexOf(w) >= 0) { flags.wallet = true; s = s.split(w).join("{wallet}"); }
    var t = s.trim();
    if (/^([a-z]+\s+){11,23}[a-z]+$/.test(t)) return R; // a seed phrase
    if (/^eyJ[\w-]+\.[\w-]+\.[\w-]*$/.test(t)) return R; // a JWT
    if (/^Bearer\s/i.test(t)) return R;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return R; // a UUID, how most API keys look
    if (t.length >= 100 && /^[A-Za-z0-9+/=_-]+$/.test(t)) return R; // a signed transaction, a key, account bytes
    if (B58.test(t) && t.length > 44 && t.length <= 100) return R; // a signature
    if (B58.test(t) && t.length >= 32 && t.length <= 44) return s; // a public address: kept
    if (t.length >= 20 && /^[A-Za-z0-9_\-.~+/=]+$/.test(t) && /[0-9]/.test(t) && /[A-Za-z]/.test(t)) return R; // a random token
    return s;
  }

  /** A value, deep: names that say secret are redacted, a 64-byte array is a secret key. */
  function cleanValue(v, flags, depth) {
    depth = depth || 0;
    if (typeof v === "string") return cleanString(v, flags);
    if (!v || typeof v !== "object") return v;
    if (depth > 12) return null;
    if (Array.isArray(v)) {
      if (v.length === 64 && v.every(function (x) { return typeof x === "number" && x >= 0 && x <= 255 && x % 1 === 0; })) return R;
      return v.map(function (x) { return cleanValue(x, flags, depth + 1); });
    }
    var o = {};
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      var key = cleanString(k, flags);
      o[key] = v[k] != null && secretName(k, v[k]) ? R : cleanValue(v[k], flags, depth + 1);
    }
    return o;
  }

  /** An address as it may be kept: no user or password, key-like parameters and path pieces redacted. */
  function cleanUrl(raw, flags) {
    var u;
    try { u = new URL(raw, location.href); } catch (e) { return { url: cleanString(String(raw), flags), redacted: [] }; }
    var redacted = [];
    u.username = ""; u.password = "";
    u.pathname = u.pathname.split("/").map(function (seg) {
      var d; try { d = decodeURIComponent(seg); } catch (e) { d = seg; }
      var c = cleanString(d, flags);
      if (c === R && redacted.indexOf("(path)") < 0) redacted.push("(path)");
      return c === d ? seg : c;
    }).join("/");
    var q = [];
    u.searchParams.forEach(function (val, name) {
      var c = secretName(name, val) ? R : cleanString(val, flags);
      if (c === R && redacted.indexOf(name) < 0) redacted.push(name);
      q.push([name, c]);
    });
    var search = q.length ? "?" + q.map(function (p) { return encodeURIComponent(p[0]) + "=" + (p[1] === R ? R : encodeURIComponent(p[1]).replace(/%7Bwallet%7D/g, "{wallet}")); }).join("&") : "";
    u.hash = "";
    var path = u.pathname.replace(/%7Bwallet%7D/g, "{wallet}");
    return { url: u.origin + path + search, redacted: redacted };
  }

  /** A small sample of an answer: a few levels, a few items, short strings. */
  function sampleOf(v, budget) {
    budget = budget || SAMPLE_CHARS;
    for (var depth = 6; depth >= 1; depth--) {
      var s = prune(v, depth, 3, 20);
      if (JSON.stringify(s).length <= budget) return s;
    }
    return typeof v === "object" ? "…" : String(v).slice(0, 120);
  }
  function prune(v, depth, items, keys) {
    if (typeof v === "string") return v.length > 120 ? v.slice(0, 119) + "…" : v;
    if (!v || typeof v !== "object") return v;
    if (depth <= 0) return Array.isArray(v) ? "[…]" : "{…}";
    if (Array.isArray(v)) {
      var a = v.slice(0, items).map(function (x) { return prune(x, depth - 1, items, keys); });
      if (v.length > items) a.push("…(" + (v.length - items) + " more)");
      return a;
    }
    var o = {}, n = 0;
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      if (n++ >= keys) { o["…"] = "(more)"; break; }
      o[k] = prune(v[k], depth - 1, items, keys);
    }
    return o;
  }

  /* ---------------------------------------------------------------- */
  /* Sources                                                            */
  /* ---------------------------------------------------------------- */

  var sources = []; // { id, key, kind, method, url, rpc, redacted, auth, needsWallet, times[], sample, status, body }
  var byKey = {};
  var answers = []; // recent answers: { seq, src, t, leaves }
  var seq = 0;

  function rpcOf(body) {
    if (!body || typeof body !== "object") return null;
    if (Array.isArray(body)) { var m = body.map(rpcOf).filter(Boolean); return m.length ? m.join(",") : null; }
    return typeof body.method === "string" ? body.method : null;
  }

  function sourceFor(kind, method, rawUrl, bodyText, auth) {
    var flags = {};
    var cu = cleanUrl(rawUrl, flags);
    var body = null, rpc = null;
    if (typeof bodyText === "string" && bodyText) {
      var parsed = null; try { parsed = JSON.parse(bodyText); } catch (e) { /* not JSON */ }
      if (parsed !== null) { rpc = rpcOf(parsed); body = sampleOf(cleanValue(parsed, flags), 600); }
      else body = cleanString(bodyText.length > 300 ? bodyText.slice(0, 299) + "…" : bodyText, flags);
    }
    var key = [kind, method, cu.url, rpc || ""].join(" ").trim();
    var s = byKey[key];
    if (!s) {
      s = byKey[key] = { id: "s" + (sources.length + 1), key: key, kind: kind, method: method, url: cu.url, rpc: rpc, redacted: cu.redacted, auth: !!auth, needsWallet: !!flags.wallet, times: [], sample: undefined, status: null, body: body };
      sources.push(s);
    }
    if (flags.wallet) s.needsWallet = true;
    if (auth) s.auth = true;
    return s;
  }

  /** Every number in an answer, with its JSON path. Numeric strings count. */
  function leavesOf(v) {
    var out = [];
    (function walk(x, path, depth) {
      if (out.length >= LEAVES_MAX || depth > 14) return;
      if (typeof x === "number" && isFinite(x)) { out.push({ path: path, v: x }); return; }
      if (typeof x === "string") {
        if (/^-?\d+(\.\d+)?$/.test(x.trim()) && x.length < 40) out.push({ path: path, v: parseFloat(x) });
        return;
      }
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) { for (var i = 0; i < x.length && i < 200; i++) walk(x[i], path + "[" + i + "]", depth + 1); return; }
      for (var k in x) {
        if (!Object.prototype.hasOwnProperty.call(x, k)) continue;
        var seg = /^[A-Za-z_$][\w$]*$/.test(k) ? (path ? "." : "") + k : "[" + JSON.stringify(k) + "]";
        walk(x[k], path + seg, depth + 1);
      }
    })(v, "", 0);
    return out;
  }

  function answered(src, t, text, status) {
    try {
      src.times.push(t);
      if (status != null) src.status = status;
      var parsed = null;
      if (typeof text === "string") { try { parsed = JSON.parse(text); } catch (e) { /* not JSON */ } }
      else if (text && typeof text === "object") parsed = text;
      if (src.sample === undefined) {
        var flags = {};
        src.sample = parsed !== null ? sampleOf(cleanValue(parsed, flags)) : typeof text === "string" ? cleanString(text.slice(0, 200), flags) : null;
        src.type = parsed !== null ? "json" : "text";
      }
      if (parsed === null) return;
      var a = { seq: ++seq, src: src, t: t, leaves: leavesOf(parsed) };
      if (!a.leaves.length) return;
      answers.push(a);
      prune2(t);
      for (var i = 0; i < changes.length; i++) if (changes[i].t >= t - 50 && changes[i].t <= t + WINDOW_MS) tryMatch(a, changes[i]);
    } catch (e) { /* the recorder never breaks the page */ }
  }

  /* fetch */
  var ofetch = window.fetch;
  if (ofetch) {
    window.fetch = function (input, init) {
      var p = ofetch.apply(this, arguments);
      try {
        var url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
        var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        var h = (init && init.headers) || (input && input.headers);
        var auth = hasAuth(h);
        var body = init && typeof init.body === "string" ? init.body : null;
        var src = sourceFor("fetch", method, url, body, auth);
        p.then(function (res) {
          var t = now();
          /* Only words are read: a picture, a font or a stream is counted, never read. */
          var type = (res.headers && res.headers.get("content-type")) || "";
          if (!/json|text|javascript/i.test(type) || /event-stream/i.test(type)) { answered(src, t, null, res.status); return; }
          try { res.clone().text().then(function (txt) { answered(src, t, txt, res.status); }, function () { answered(src, t, null, res.status); }); } catch (e) { answered(src, t, null, res.status); }
        }, function () { /* a failed request feeds nothing */ });
      } catch (e) { /* never in the page's way */ }
      return p;
    };
  }
  function hasAuth(h) {
    if (!h) return false;
    var names = [];
    try {
      if (typeof h.forEach === "function" && !Array.isArray(h)) h.forEach(function (_, k) { names.push(k); });
      else if (Array.isArray(h)) h.forEach(function (p) { names.push(p[0]); });
      else names = Object.keys(h);
    } catch (e) { return false; }
    return names.some(function (n) { return SECRET_NAME.test(n) || WEAK_NAME.test(n); });
  }

  /* XHR */
  var X = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (X) {
    var oopen = X.open, osend = X.send, oset = X.setRequestHeader;
    X.open = function (method, url) { try { this.__sink = { method: String(method || "GET").toUpperCase(), url: url, auth: false }; } catch (e) { /* */ } return oopen.apply(this, arguments); };
    X.setRequestHeader = function (name) { try { if (this.__sink && hasAuth([[name]])) this.__sink.auth = true; } catch (e) { /* */ } return oset.apply(this, arguments); };
    X.send = function (body) {
      try {
        var info = this.__sink;
        if (info) {
          var src = sourceFor("xhr", info.method, info.url, typeof body === "string" ? body : null, info.auth);
          var xhr = this;
          this.addEventListener("loadend", function () {
            var t = now();
            try {
              var rt = xhr.responseType;
              answered(src, t, rt === "" || rt === "text" ? xhr.responseText : rt === "json" ? xhr.response : null, xhr.status);
            } catch (e) { /* */ }
          });
        }
      } catch (e) { /* */ }
      return osend.apply(this, arguments);
    };
  }

  /* WebSocket: one source per address; what the page sent on it names its methods and whether it asked about the wallet. */
  var OWS = window.WebSocket;
  if (OWS) {
    var W = function (url, protocols) {
      var ws = protocols === undefined ? new OWS(url) : new OWS(url, protocols);
      try {
        var src = sourceFor("websocket", "WS", url, null, false);
        var osend2 = ws.send;
        ws.send = function (data) {
          try {
            if (typeof data === "string") {
              var flags = {};
              var parsed = null; try { parsed = JSON.parse(data); } catch (e) { /* */ }
              var m = parsed && rpcOf(parsed);
              if (m) { var list = (src.rpc ? src.rpc.split(",") : []); if (list.indexOf(m) < 0) list.push(m); src.rpc = list.join(","); }
              var cleaned = parsed !== null ? sampleOf(cleanValue(parsed, flags), 600) : cleanString(data.slice(0, 300), flags);
              if (!src.sent) src.sent = [];
              if (src.sent.length < 3) src.sent.push(cleaned);
              if (flags.wallet) src.needsWallet = true;
            }
          } catch (e) { /* */ }
          return osend2.apply(ws, arguments);
        };
        ws.addEventListener("message", function (e) { if (typeof e.data === "string") answered(src, now(), e.data, null); });
      } catch (e) { /* */ }
      return ws;
    };
    W.prototype = OWS.prototype;
    ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) { W[k] = OWS[k]; });
    window.WebSocket = W;
  }

  /* ---------------------------------------------------------------- */
  /* The page's words                                                   */
  /* ---------------------------------------------------------------- */

  var changes = []; // { el, t, text }
  var feeds = new Map(); // el → { key → { src, path, scale, shown, hits, seqs, sig } }

  function textOf(el) {
    var s = (el.textContent || "").replace(/\s+/g, " ").trim();
    return s.length > 200 ? null : s;
  }

  function changed(el, t) {
    if (!el || el.nodeType !== 1) return;
    var text = textOf(el);
    if (!text || !/\d/.test(text)) return;
    var c = { el: el, t: t, text: text };
    changes.push(c);
    prune2(t);
    for (var i = 0; i < answers.length; i++) if (answers[i].t <= t + 50 && answers[i].t >= t - WINDOW_MS) tryMatch(answers[i], c);
  }

  function prune2(t) {
    while (changes.length && changes[0].t < t - KEEP_MS) changes.shift();
    while (answers.length && answers[0].t < t - KEEP_MS) answers.shift();
  }

  function startObserver() {
    try {
      new MutationObserver(function (list) {
        var t = now();
        var seen = new Set();
        list.forEach(function (m) {
          var el = m.type === "characterData" ? m.target.parentElement : m.target;
          if (el && !seen.has(el)) { seen.add(el); changed(el, t); }
        });
      }).observe(document.documentElement || document, { subtree: true, childList: true, characterData: true });
    } catch (e) { /* */ }
  }
  if (document.documentElement) startObserver(); else document.addEventListener("DOMContentLoaded", startObserver);

  /** The numbers an element shows: "$150.23" → 150.23 at 2 decimals; "1.2K" → 1200; "12%" → 12. */
  function shownNumbers(text) {
    var out = [];
    var re = /(-|−)?\$?\s?(\d[\d,]*(?:\.\d+)?|\.\d+)\s?([kKmMbB](?![a-zA-Z]))?(%)?/g;
    var m;
    while ((m = re.exec(text))) {
      var digits = m[2];
      if (/,/.test(digits) && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(digits)) continue;
      var plain = digits.replace(/,/g, "");
      var n = parseFloat(plain);
      if (!isFinite(n)) continue;
      var dec = plain.indexOf(".") >= 0 ? plain.length - plain.indexOf(".") - 1 : 0;
      var mult = m[3] ? { k: 1e3, m: 1e6, b: 1e9 }[m[3].toLowerCase()] : 1;
      var sig = plain.replace(".", "").replace(/^0+/, "").length;
      out.push({ n: (m[1] ? -1 : 1) * n * mult, step: Math.pow(10, -dec) * mult, sig: sig, pct: !!m[4] });
    }
    return out;
  }

  var SCALES = [1, 1e-9, 1e-6, 1e-3, 1e3];
  function same(shown, v) {
    for (var i = 0; i < SCALES.length; i++) {
      var x = v * SCALES[i];
      /* As displayed (rounded to the shown step), or, for a short rounded figure, within 0.2%; a long exact figure (a slot, a block) must be exact. */
      var ok = Math.abs(x - shown.n) <= shown.step / 2 + 1e-9 * Math.max(1, Math.abs(x)) || (shown.sig >= 3 && shown.sig <= 6 && Math.abs(x - shown.n) <= Math.abs(x) * 0.002);
      if (ok) return SCALES[i];
      if (shown.pct && SCALES[i] === 1 && Math.abs(x * 100 - shown.n) <= shown.step / 2 + 1e-9) return 100;
    }
    return 0;
  }

  function tryMatch(a, c) {
    var el = c.el;
    if (!el.isConnected) return;
    var nums = shownNumbers(c.text);
    if (!nums.length) return;
    var hits = [];
    for (var i = 0; i < nums.length; i++) {
      for (var j = 0; j < a.leaves.length; j++) {
        var sc = same(nums[i], a.leaves[j].v);
        if (sc) hits.push({ path: a.leaves[j].path, scale: sc, sig: nums[i].sig, shown: c.text });
      }
    }
    if (!hits.length) return;
    var per = feeds.get(el);
    if (!per) { per = {}; feeds.set(el, per); }
    hits.forEach(function (h) {
      var k = a.src.key + "\u0000" + h.path + "\u0000" + h.scale;
      var f = per[k] || (per[k] = { src: a.src, path: h.path, scale: h.scale, shown: h.shown, hits: 0, seqs: [], sig: 0, ambiguous: 0 });
      if (f.seqs.indexOf(a.seq) >= 0) return;
      f.seqs.push(a.seq);
      f.hits++;
      f.shown = h.shown;
      f.sig = Math.max(f.sig, h.sig);
      if (hits.length > 1) f.ambiguous++;
    });
  }

  /* ---------------------------------------------------------------- */
  /* The report                                                         */
  /* ---------------------------------------------------------------- */

  function everyOf(times) {
    if (times.length < 2) return null;
    var d = [];
    for (var i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
    d.sort(function (a, b) { return a - b; });
    return Math.round(d[Math.floor(d.length / 2)] / 100) * 100;
  }
  function steadyOf(times, every) {
    if (times.length < 3 || !every) return false;
    for (var i = 1; i < times.length; i++) if (Math.abs(times[i] - times[i - 1] - every) > every * 0.25) return false;
    return true;
  }

  function best() {
    var out = [];
    feeds.forEach(function (per, el) {
      if (!el.isConnected) return;
      var list = Object.keys(per).map(function (k) { return per[k]; });
      list.forEach(function (f) {
        var conf = 0.45 + 0.15 * Math.min(f.hits - 1, 3) + (f.sig >= 3 ? 0.15 : f.sig === 2 ? 0.05 : -0.1) - (f.scale !== 1 ? 0.05 : 0) - (f.ambiguous === f.hits ? 0.15 : 0) - (list.length > 1 ? 0.1 : 0);
        f.confidence = Math.max(0.05, Math.min(1, Math.round(conf * 100) / 100));
      });
      list.sort(function (a, b) { return b.hits - a.hits || b.confidence - a.confidence || (a.scale === 1 ? -1 : 0) - (b.scale === 1 ? -1 : 0) || a.path.length - b.path.length; });
      out.push({ el: el, f: list[0], also: list.length - 1 });
    });
    return out;
  }

  var lastFed = null;
  function report() {
    var w = wallet();
    var fed = lastFed || best();
    return {
      version: VERSION,
      watchedMs: now(),
      wallet: w ? "connected" : "none",
      sources: sources.map(function (s) {
        var every = everyOf(s.times);
        var o = { id: s.id, key: s.key, kind: s.kind, method: s.method, url: s.url };
        if (s.rpc) o.rpc = s.rpc;
        if (s.body != null) o.body = s.body;
        if (s.sent) o.sent = s.sent;
        o.count = s.times.length;
        o.everyMs = every;
        o.steady = steadyOf(s.times, every);
        o.needsWallet = !!s.needsWallet;
        if (s.auth) o.auth = true;
        if (s.redacted.length) o.redacted = s.redacted;
        if (s.status != null) o.status = s.status;
        if (s.type) o.type = s.type;
        if (s.sample !== undefined) o.sample = s.sample;
        return o;
      }),
      feeds: fed.map(function (x, i) {
        var o = { id: "f" + (i + 1), source: x.f.src.id, path: w ? x.f.path.split(w).join("{wallet}") : x.f.path, scale: x.f.scale, seen: x.f.hits, confidence: x.f.confidence, shown: cleanString(x.f.shown, {}) };
        if (x.also) o.alternatives = x.also;
        return o;
      }),
    };
  }

  /** Writes each fed element's feed ids onto it, for the dump to read as `feeds`. */
  function mark() {
    var fed = lastFed = best();
    fed.forEach(function (x, i) { try { x.el.setAttribute("data-sink-feeds", "f" + (i + 1)); } catch (e) { /* */ } });
    return fed.length;
  }

  window.__sinkSources = { version: VERSION, report: report, mark: mark, clean: { url: cleanUrl, value: cleanValue } };
})();
