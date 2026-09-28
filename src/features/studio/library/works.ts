/**
 * The feature library: working parts the Builder can reuse.
 *
 * A FEATURE IS WORKING CODE WITH NO LOOK OF ITS OWN. Attached to a part on
 * the board, it takes that part's style: the part draws exactly as the owner
 * designed it, and on the published page the feature writes into the part's
 * own element. So "Live SOL price" on Solcinerator's `$116.59` is still the
 * green 20px number in the header, only live.
 *
 * (The catalogue in `catalog.ts` calls its parts "features" for historical
 * reasons; these are the other thing, and the code says `work` so the two
 * never meet: `node.work`, `getWork`, `LIBRARY`.)
 *
 * WHAT ONE IS. A manifest, plain data that a repository could hold as
 * `features/<id>/manifest.json` — name, category, inputs, what it needs
 * (none / wallet / backend / key), the words that attach it, and a
 * representative look for the shelf — and a script: a few lines of plain
 * browser JavaScript that call `siteFeatures.define(id, fn)`. No framework.
 *
 * WHAT PUBLISHING SHIPS. `assets/features/runtime.js` (under 2 KB: find the
 * parts, hand each its feature, format numbers, write text into the part's
 * word-holding element), one `assets/features/<id>.js` per feature the site
 * uses, and on each page that uses one a JSON list of which part takes which
 * feature with what inputs. A site that uses none ships nothing.
 *
 * Pure on purpose: no store, no React, no imports, so the tests run it as
 * written under node's type stripping, and a feature read from a repository
 * later is the same shape as one written here. (The behaviours — reveal,
 * copy, tilt and the rest — are in `behaviours.ts`, the same shape.)
 */
import { BEHAVIOURS } from "./behaviours.ts";

/** What a feature needs before it can run. `none` runs on a static page as published. */
export type WorkNeeds = "none" | "wallet" | "backend" | "key";

export interface WorkInput {
  id: string;
  label: string;
  kind: "text" | "number" | "one";
  /** Used when nothing was said. */
  default: string;
  values?: string[];
  placeholder?: string;
  /**
   * How the one box finds this input in what was typed, as a regular
   * expression source whose first group is the value. Plain data, so a
   * manifest read from a repository carries it too.
   */
  heard?: string;
  required?: boolean;
  /** Shown under "More" in the Element panel, not in its first view. */
  advanced?: boolean;
}

export interface WorkManifest {
  id: string;
  name: string;
  /** The shelf category it sits in: one of the catalogue's category ids. */
  category: string;
  blurb: string;
  inputs: WorkInput[];
  needs: WorkNeeds;
  /**
   * Phrases that attach it from the one box. A phrase matches when every
   * word of it is in what was typed; the longest match wins.
   */
  says: string[];
  /** How it looks on the shelf: the kind of thing a part carrying it shows. */
  look: { sample: string; caption?: string };
  version: number;
}

export interface Work {
  manifest: WorkManifest;
  /** Plain browser JavaScript. Calls `siteFeatures.define(id, fn(el, inputs, api))`. */
  script: string;
  /** The folder's README, for a feature that came back from a repository. */
  readme?: string;
  /** `owner/name` of the repository it came back from, when it did. */
  from?: string;
  /**
   * Its shelf picture: the part it was attached to when it was accepted,
   * as that part was, so the shelf can draw it. Null for the built-in ones,
   * which show `look.sample` instead.
   */
  picture?: WorkPicture | null;
}

/** A part, as much of it as the shelf needs to draw it again. */
export interface WorkPicture {
  featureId: string;
  label: string;
  content: unknown;
  w: number;
  h: number;
  colour?: unknown;
  font?: unknown;
  options?: Record<string, string>;
  layout?: unknown;
  pad?: unknown;
  edge?: unknown;
  text?: unknown;
}

/**
 * What a part carries when a feature is attached to it. A part can carry
 * more than one (reveal on scroll and copy with toast on one address): the
 * first is the use itself, the rest ride in `also`, so every reader that
 * only knows one feature a part still sees the first.
 */
export interface WorkUse {
  id: string;
  inputs: Record<string, string>;
  /** Switched off in the Element panel: kept, with its settings, and shipped nowhere. */
  off?: boolean;
  also?: WorkUse[];
}

/** Every feature a part carries, the first first. */
export function usesOf(work: WorkUse | null | undefined): WorkUse[] {
  if (!work) return [];
  const one = (u: WorkUse): WorkUse => ({ id: u.id, inputs: u.inputs ?? {}, ...(u.off ? { off: true } : {}) });
  return [one(work), ...(work.also ?? []).map(one)];
}
function stack(list: WorkUse[]): WorkUse | null {
  const [first, ...rest] = list;
  if (!first) return null;
  return rest.length ? { ...first, also: rest } : first;
}
/** Two that both write the part's words would fight over them: live data replaces live data. */
const writesWords = (id: string) => getWork(id)?.manifest.category === "data";

/**
 * A part's features with one more. The same feature again replaces its old
 * use; a live-data feature replaces another; anything else stacks.
 */
export function withWork(work: WorkUse | null | undefined, add: WorkUse): WorkUse {
  const kept = usesOf(work).filter((u) => u.id !== add.id && !(writesWords(u.id) && writesWords(add.id)));
  return stack([...kept, { id: add.id, inputs: add.inputs ?? {}, ...(add.off ? { off: true } : {}) }])!;
}
/** A part's features with one switched on or off; its settings kept either way. */
export function withSwitch(work: WorkUse | null | undefined, id: string, on: boolean): WorkUse | null {
  return stack(usesOf(work).map((u) => {
    if (u.id !== id) return u;
    const { off: _off, ...rest } = u;
    void _off;
    return on ? rest : { ...rest, off: true };
  }));
}
/** The features a part carries that are switched on: the ones a page runs. */
export function onUsesOf(work: WorkUse | null | undefined): WorkUse[] {
  return usesOf(work).filter((u) => !u.off);
}
/** A part's features without this one; null when it was the only one. */
export function withoutWork(work: WorkUse | null | undefined, id: string): WorkUse | null {
  return stack(usesOf(work).filter((u) => u.id !== id));
}
/** A part's features with one input of one of them changed. */
export function withInput(work: WorkUse | null | undefined, id: string, input: string, value: string): WorkUse | null {
  return stack(usesOf(work).map((u) => (u.id === id ? { ...u, inputs: { ...u.inputs, [input]: value } } : u)));
}

/* ------------------------------------------------------------------ */
/* The first two                                                       */
/* ------------------------------------------------------------------ */

const EVERY: WorkInput = {
  id: "every", label: "Refresh every (seconds)", kind: "number", default: "30",
  heard: "(\\d+)\\s*(?:s|sec|secs|second|seconds)\\b",
};
const FORMAT: WorkInput = { id: "format", label: "Format", kind: "one", default: "$1.23", values: ["$1.23", "1.23", "$1.2K"] };

const SOL_PRICE: Work = {
  manifest: {
    id: "sol-price",
    name: "Live SOL price",
    category: "data",
    blurb: "The price of SOL in dollars, from a public price source, refreshed every few seconds.",
    inputs: [
      EVERY,
      FORMAT,
      { id: "show", label: "Show", kind: "one", default: "price", values: ["price", "24h change"], heard: "\\b(24h change|change)\\b" },
    ],
    needs: "none",
    says: ["sol price", "solana price", "price of sol", "sol usd", "sol change", "sol 24h"],
    look: { sample: "$142.37", caption: "SOL · live" },
    version: 1,
  },
  script: `siteFeatures.define("sol-price", function (el, inputs, api) {
  var change = /change/.test(inputs.show || "");
  function tick() {
    return api.json("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true")
      .then(function (j) {
        var p = j && j.solana;
        if (!p || !isFinite(p.usd)) throw new Error("no price");
        api.set(el, change ? api.percent(p.usd_24h_change) : api.money(p.usd, inputs.format));
      })
      .catch(function () {
        return api.json("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112").then(function (j) {
          var p = j && j["So11111111111111111111111111111111111111112"];
          if (!p || !isFinite(p.usdPrice)) throw new Error("no price");
          api.set(el, change ? api.percent(p.priceChange24h) : api.money(p.usdPrice, inputs.format));
        });
      })
      .catch(function () { api.stale(el); });
  }
  tick();
  return setInterval(tick, api.seconds(inputs.every, 30) * 1000);
});
`,
};

const TOKEN_PRICE: Work = {
  manifest: {
    id: "token-price",
    name: "Live token price",
    category: "data",
    blurb: "Any Solana token's price in dollars, by its mint address, refreshed every few seconds.",
    inputs: [
      { id: "mint", label: "Token mint", kind: "text", default: "", placeholder: "the token's mint address", heard: "\\b([1-9A-HJ-NP-Za-km-z]{32,44})\\b", required: true },
      EVERY,
      FORMAT,
      { id: "show", label: "Show", kind: "one", default: "price", values: ["price", "24h change"], heard: "\\b(24h change|change)\\b" },
    ],
    needs: "none",
    says: ["token price", "price of token", "mint price", "coin price", "price by mint"],
    look: { sample: "$0.00002346", caption: "token · live" },
    version: 1,
  },
  script: `siteFeatures.define("token-price", function (el, inputs, api) {
  var mint = String(inputs.mint || "").trim();
  var change = /change/.test(inputs.show || "");
  if (!mint) return;
  function tick() {
    return api.json("https://lite-api.jup.ag/price/v3?ids=" + encodeURIComponent(mint))
      .then(function (j) {
        var p = j && j[mint];
        if (!p || !isFinite(p.usdPrice)) throw new Error("no price");
        api.set(el, change ? api.percent(p.priceChange24h) : api.money(p.usdPrice, inputs.format));
      })
      .catch(function () {
        return api.json("https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(mint)).then(function (j) {
          var pair = j && j.pairs && j.pairs[0];
          if (!pair) throw new Error("no pair");
          if (change) api.set(el, api.percent(pair.priceChange && pair.priceChange.h24));
          else api.set(el, api.money(Number(pair.priceUsd), inputs.format));
        });
      })
      .catch(function () { api.stale(el); });
  }
  tick();
  return setInterval(tick, api.seconds(inputs.every, 30) * 1000);
});
`,
};

/** Every feature the Builder has, in shelf order. */
export const LIBRARY: Work[] = [SOL_PRICE, TOKEN_PRICE, ...BEHAVIOURS];

/**
 * The features the owner accepted from their repositories (`roundTrip.ts`),
 * handed in by the library store. Held as text: nothing here runs them.
 * One with a built-in's id replaces that built-in.
 */
let accepted: Work[] = [];
export function setAccepted(list: readonly Work[]): void {
  accepted = [...list];
}

/** Every feature there is: the built-in ones, each replaced by an accepted one of its id, then the accepted new ones. */
export function allWorks(): Work[] {
  const byId = new Map(accepted.map((w) => [w.manifest.id, w]));
  return [...LIBRARY.map((w) => byId.get(w.manifest.id) ?? w), ...accepted.filter((w) => !LIBRARY.some((b) => b.manifest.id === w.manifest.id))];
}

export function getWork(id: string | null | undefined): Work | undefined {
  if (!id) return undefined;
  return accepted.find((w) => w.manifest.id === id) ?? LIBRARY.find((w) => w.manifest.id === id);
}

/** The inputs a part carrying this feature runs with: what it set, else the defaults. */
export function inputsOf(m: WorkManifest, set: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of m.inputs) out[i.id] = set[i.id] ?? i.default;
  return out;
}

/** In a sentence, for the one box and the blueprint: "Live SOL price, every 30 s". */
export function describeWork(use: WorkUse): string {
  const all = usesOf(use);
  if (all.length > 1) return [describeWork(all[0]!), ...all.slice(1).map((u) => getWork(u.id)?.manifest.name ?? u.id)].join(" + ");
  const w = getWork(use.id);
  if (!w) return use.id;
  const inputs = inputsOf(w.manifest, use.inputs);
  const bits = [w.manifest.name];
  if (inputs.mint) bits.push(`for ${inputs.mint.length > 12 ? `${inputs.mint.slice(0, 4)}…${inputs.mint.slice(-4)}` : inputs.mint}`);
  if (inputs.show && inputs.show !== "price") bits.push(`(${inputs.show})`);
  if (inputs.every) bits.push(`every ${inputs.every} s`);
  return bits.join(" ").replace(/ every/, ", every");
}

/* ------------------------------------------------------------------ */
/* Matching what was typed                                             */
/* ------------------------------------------------------------------ */

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9$%.]+/g, " ").trim().split(/\s+/).filter(Boolean);

export interface WorkMatch {
  manifest: WorkManifest;
  /** How much of the phrase was heard: the longest phrase matched, in words. */
  score: number;
  inputs: Record<string, string>;
}

/**
 * The features the words name, best first.
 *
 * A phrase matches when every one of its words is in the text. An input with
 * a `heard` pattern that finds itself in the text counts as a match too (a
 * mint address alone is Live token price), and is carried as that input.
 * A single word that is in a phrase of more than one feature ("price") gives
 * each of them a weak match, which is what lets the box ask.
 */
export function matchWorks(text: string, manifests: WorkManifest[]): WorkMatch[] {
  const heard = new Set(words(text));
  const out: WorkMatch[] = [];
  for (const m of manifests) {
    let score = 0;
    for (const p of m.says) {
      const need = words(p);
      if (need.length && need.every((w) => heard.has(w))) score = Math.max(score, need.length);
    }
    const inputs: Record<string, string> = {};
    for (const i of m.inputs) {
      if (!i.heard) continue;
      const got = new RegExp(i.heard, "i").exec(text);
      if (got?.[1]) {
        inputs[i.id] = got[1];
        if (i.required) score = Math.max(score, 3);
      }
    }
    if (!score && heard.size === 1) {
      const [only] = [...heard];
      if (only && only.length > 2 && m.says.some((p) => words(p).includes(only))) score = 0.5;
    }
    if (score > 0) out.push({ manifest: m, score, inputs });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* What publishing ships                                               */
/* ------------------------------------------------------------------ */

/**
 * The runtime, as it is written into the published site.
 *
 * `api.set` writes into the element that holds the part's words — the first
 * one down the tree with text of its own — so the part keeps the face,
 * size and colour it was designed in; its other text nodes are emptied, not
 * removed, so nothing else moves. When a source does not answer, the words
 * the owner designed stay where they are and the part is marked stale.
 */
export const RUNTIME_JS = `/* The site's features: which part takes which feature is listed in #site-features on each page. */
(function () {
  var defs = {};
  function leaf(el) {
    var kids = el.childNodes || [];
    for (var i = 0; i < kids.length; i++) if (kids[i].nodeType === 3 && /\\S/.test(kids[i].nodeValue)) return el;
    for (var j = 0; j < kids.length; j++) if (kids[j].nodeType === 1) { var f = leaf(kids[j]); if (f) return f; }
    return null;
  }
  var api = {
    json: function (url) {
      return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    },
    set: function (el, text) {
      var at = leaf(el);
      if (!at) { el.textContent = text; return; }
      var put = false;
      for (var i = 0; i < at.childNodes.length; i++) {
        var n = at.childNodes[i];
        if (n.nodeType !== 3) continue;
        if (!put && /\\S/.test(n.nodeValue)) { n.nodeValue = text; put = true; } else if (put) n.nodeValue = "";
      }
      if (el.removeAttribute) el.removeAttribute("data-stale");
    },
    stale: function (el) { if (el.setAttribute) el.setAttribute("data-stale", ""); },
    seconds: function (v, d) { var n = Number(v); return isFinite(n) && n >= 5 ? n : d; },
    money: function (n, format) {
      n = Number(n);
      if (!isFinite(n)) return "";
      var sign = format === "1.23" ? "" : "$";
      if (format === "$1.2K" && Math.abs(n) >= 1000) return sign + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
      if (Math.abs(n) >= 1) return sign + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return sign + Number(n.toPrecision(4)).toFixed(Math.min(12, Math.max(2, 3 - Math.floor(Math.log10(Math.abs(n) || 1)))));
    },
    percent: function (n) {
      n = Number(n);
      if (!isFinite(n)) return "";
      return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
    }
  };
  var F = window.siteFeatures = { define: function (id, fn) { defs[id] = fn; }, api: api };
  var started = false;
  function start() {
    if (started) return;
    started = true;
    var c = document.getElementById("site-features");
    var list = [];
    try { list = JSON.parse((c && c.textContent) || "[]"); } catch (e) { list = []; }
    for (var i = 0; i < list.length; i++) {
      var b = list[i], el = document.getElementById(b.part), fn = defs[b.feature];
      if (el && fn) { try { fn(el, b.inputs || {}, api); } catch (e) { api.stale(el); } }
    }
  }
  if (document.readyState === "complete") start();
  else { document.addEventListener("DOMContentLoaded", start); if (window.addEventListener) window.addEventListener("load", start); }
  void F;
})();
`;

/** A script as it is written into the site: the runtime's global is in scope as a free name. */
export function scriptFile(id: string): string {
  const w = getWork(id);
  return w ? shipped(w) : "";
}
function shipped(w: Work): string {
  return `/* ${w.manifest.name} — ${w.manifest.blurb} Needs: ${w.manifest.needs}. */\n(function (siteFeatures) {\n${w.script}})(window.siteFeatures);\n`;
}

/** The fields of a part this reads. Any node shape will do. */
interface Carrier { id: string; work?: WorkUse | null }

export interface Binding { part: string; feature: string; inputs: Record<string, string> }

/**
 * What one page needs: the scripts to load, in order, and which part takes
 * which feature. Nothing for a page that uses none.
 */
export function pageFeatures(nodes: readonly Carrier[]): { scripts: string[]; bindings: Binding[] } {
  const bindings: Binding[] = [];
  const used: string[] = [];
  for (const n of nodes) {
    for (const u of onUsesOf(n.work)) {
      const w = getWork(u.id);
      if (!w) continue;
      bindings.push({ part: n.id, feature: w.manifest.id, inputs: inputsOf(w.manifest, u.inputs) });
      if (!used.includes(w.manifest.id)) used.push(w.manifest.id);
    }
  }
  return { scripts: bindings.length ? ["runtime.js", ...used.map((id) => `${id}.js`)] : [], bindings };
}

/** The tags a page that uses features carries, before `</body>`. `up` is the way back to the root. */
export function pageFeatureTags(nodes: readonly Carrier[], up: string): string {
  const { scripts, bindings } = pageFeatures(nodes);
  if (!bindings.length) return "";
  const list = JSON.stringify(bindings).replace(/</g, "\\u003c");
  return [
    `<script id="site-features" type="application/json">${list}</script>`,
    ...scripts.map((s) => `<script src="${up}assets/features/${s}" defer></script>`),
  ].join("\n");
}

/** The files the whole site needs: the runtime and each used feature's script, once. */
export function featureFiles(nodes: readonly Carrier[]): { path: string; content: string }[] {
  const used = new Set<string>();
  for (const n of nodes) for (const u of onUsesOf(n.work)) if (getWork(u.id)) used.add(u.id);
  if (!used.size) return [];
  return [
    { path: "assets/features/runtime.js", content: RUNTIME_JS },
    ...allWorks().filter((w) => used.has(w.manifest.id)).map((w) => ({ path: `assets/features/${w.manifest.id}.js`, content: shipped(w) })),
  ];
}
