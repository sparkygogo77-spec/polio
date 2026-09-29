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
 * a request whose method, host and path match a recorded read (`:id`
 * matching any one piece of the path, a JSON-RPC (remote procedure call) or
 * GraphQL read matched by its operation too) gets the sample, and a list or
 * a price shows something real-looking before a backend exists. Anything
 * else, every write among it, goes to the network untouched.
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

export interface StandIn {
  site: string | null;
  reads: StandInRead[];
}

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
  let chars = 0;
  for (const e of list as Record<string, unknown>[]) {
    if (!e || typeof e !== "object") continue;
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
  return reads.length ? { site: str(raw.site), reads } : null;
}

/** Whether a site built or published now answers with its stand-in: the option on and something to answer with. */
export const standInOn = (format: Record<string, unknown> | null | undefined, s: StandIn | null | undefined): s is StandIn =>
  format?.["build.standIn"] === true && !!s && s.reads.length > 0;

/**
 * The answering, as plain JavaScript: `window.__standIn = { answer, install }`.
 * `answer(map, method, url, body)` is the sample for a recorded read, or
 * undefined; `install(map)` puts it in front of `fetch` and returns how to
 * take it away. It reads nothing but its arguments and `location`.
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
  function install(map) {
    var real = w.fetch;
    if (!real) return function () {};
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
    return function () { w.fetch = real; };
  }
  w.__standIn = { answer: answer, install: install };
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
