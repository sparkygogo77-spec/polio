#!/usr/bin/env node
/**
 * THE FEATURE LIBRARY, THE ONE BOX'S READING, AND THE ORANGE !.
 *
 * THE OWNER'S GOAL: the easiest way to program a site on top of designing
 * it. A feature is working code with no look of its own: attached to a part
 * it takes that part's style, and publishing ships a tiny runtime plus the
 * script of each feature used, static, no framework. Every feature made once
 * is there for the next site.
 *
 * Held here, with no server and nothing leaving the machine:
 *   · every feature has a manifest: name, category, inputs, what it needs
 *     (none / wallet / backend / key) and a look for the shelf;
 *   · Live SOL price and Live token price run, as published, against a
 *     stand-in price source and a stand-in page: the part's own element
 *     takes the number, formatted, and asks again every N seconds;
 *   · the one box reads what is typed: a web address is a link, a page name
 *     an internal link, plain text the words, "sol price" the feature, and
 *     anything else a task; it asks only when two readings are both fair;
 *   · on Solcinerator the orange ! sits on every clickable part with nowhere
 *     to go and every live-data spot, and on nothing a link already answers.
 *
 *   node --experimental-strip-types tests/features-library.mjs [path to a sink checkout]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { LIBRARY, RUNTIME_JS, getWork, matchWorks, pageFeatures, featureFiles, scriptFile } from "../src/features/studio/library/works.ts";
import { readWords } from "../src/features/studio/library/read.ts";
import { decisions } from "../src/features/studio/library/badge.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ manifests */
const NEEDS = new Set(["none", "wallet", "backend", "key"]);
check("the library holds Live SOL price and Live token price", !!getWork("sol-price") && !!getWork("token-price"), LIBRARY.map((w) => w.id).join(", "));
for (const w of LIBRARY) {
  const m = w.manifest;
  check(`${m.id}: a manifest with name, category, inputs, needs and a shelf look`,
    !!m.name && (/price/.test(m.id) ? m.category === "data" : !!m.category) && Array.isArray(m.inputs) && NEEDS.has(m.needs) && !!m.look?.sample,
    `${m.name} · ${m.category} · needs ${m.needs} · looks like ${m.look?.sample}`);
  check(`${m.id}: its manifest is plain data, as a repository would hold it`, JSON.stringify(JSON.parse(JSON.stringify(m))) === JSON.stringify(m));
  check(`${m.id}: a script`, typeof w.script === "string" && w.script.includes(`define(${JSON.stringify(m.id)}`));
}
check("Live token price asks for the mint", getWork("token-price").manifest.inputs.some((i) => i.id === "mint"));
check("both refresh every N seconds, set per part", ["sol-price", "token-price"].every((id) => getWork(id).manifest.inputs.some((i) => i.id === "every")));

/* ------------------------------------------------- the scripts, running */
/** A stand-in page: one part, its words inside a span, as the export draws them. */
function standIn(prices) {
  const timers = [];
  const calls = [];
  const text = (v) => ({ nodeType: 3, nodeValue: v });
  const span = { nodeType: 1, tagName: "SPAN", childNodes: [text("$116.59")], children: [], attrs: {} };
  const part = { nodeType: 1, tagName: "DIV", id: "n_prose_92", childNodes: [span], children: [span], attrs: {} };
  for (const el of [span, part]) {
    el.setAttribute = (k, v) => { el.attrs[k] = v; };
    el.removeAttribute = (k) => { delete el.attrs[k]; };
    Object.defineProperty(el, "textContent", {
      get() { return el.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join(""); },
      set(v) { el.childNodes = [text(v)]; el.children = []; },
    });
  }
  const config = { textContent: "" };
  const listeners = {};
  const document = {
    readyState: "loading",
    getElementById: (id) => (id === "n_prose_92" ? part : id === "site-features" ? config : null),
    addEventListener: (k, f) => { (listeners[k] ??= []).push(f); },
  };
  const window = { document };
  const sandbox = {
    window, document, console,
    setInterval: (f, ms) => { timers.push({ f, ms }); return timers.length; },
    clearInterval: () => {},
    setTimeout: (f) => { f(); return 0; },
    fetch: async (url) => {
      calls.push(url);
      const body = prices(url);
      return { ok: body != null, status: body != null ? 200 : 404, json: async () => body };
    },
    Intl, Math, Number, JSON, Promise, Object, Array, String, isFinite,
  };
  window.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  return {
    part, span, calls, timers, config,
    run: (src) => vm.runInContext(src, sandbox),
    ready: () => (listeners.DOMContentLoaded ?? []).forEach((f) => f()),
    words: () => part.textContent,
  };
}
const settle = () => new Promise((r) => setTimeout(r, 20));

{
  let price = 142.3719;
  const page = standIn((url) => (/coingecko|solana|So1111/.test(url) ? { solana: { usd: price, usd_24h_change: -1.9412 } } : null));
  page.config.textContent = JSON.stringify(pageFeatures([{ id: "n_prose_92", work: { id: "sol-price", inputs: { every: "15" } } }]).bindings);
  page.run(RUNTIME_JS);
  page.run(scriptFile("sol-price"));
  page.ready();
  await settle();
  check("Live SOL price: the part's own words become the price, formatted", page.words() === "$142.37", page.words());
  check("…in the element that held the words, so it keeps that element's style", page.part.childNodes[0] === page.span, page.span.textContent);
  check("…from a public price source", page.calls.some((u) => u.startsWith("https://")), page.calls[0]);
  check("…and asks again every N seconds, as set on the part", page.timers.some((t) => t.ms === 15000), page.timers.map((t) => t.ms).join(","));
  price = 150.5;
  page.timers[0].f();
  await settle();
  check("…and the next answer lands on the same part", page.words() === "$150.50", page.words());
}
{
  const page = standIn((url) => (/coingecko|solana/.test(url) ? { solana: { usd: 116.59, usd_24h_change: -1.9412 } } : null));
  page.config.textContent = JSON.stringify(pageFeatures([{ id: "n_prose_92", work: { id: "sol-price", inputs: { show: "24h change" } } }]).bindings);
  page.run(RUNTIME_JS);
  page.run(scriptFile("sol-price"));
  page.ready();
  await settle();
  check("Live SOL price can show the day's change instead", page.words() === "-1.94%", page.words());
}
{
  const MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
  const page = standIn((url) => (url.includes(MINT) ? (url.includes("jup") ? { [MINT]: { usdPrice: 0.0000234567, priceChange24h: 4.2 } } : { pairs: [{ priceUsd: "0.0000234567" }] }) : null));
  page.config.textContent = JSON.stringify(pageFeatures([{ id: "n_prose_92", work: { id: "token-price", inputs: { mint: MINT } } }]).bindings);
  page.run(RUNTIME_JS);
  page.run(scriptFile("token-price"));
  page.ready();
  await settle();
  check("Live token price by mint: a small price keeps its significant digits", page.words() === "$0.00002346", page.words());
  check("…asked of a public source by that mint", page.calls.some((u) => u.includes(MINT)), page.calls[0]);
}
{
  const page = standIn(() => null);
  page.config.textContent = JSON.stringify(pageFeatures([{ id: "n_prose_92", work: { id: "sol-price", inputs: {} } }]).bindings);
  page.run(RUNTIME_JS);
  page.run(scriptFile("sol-price"));
  page.ready();
  await settle();
  check("when the source does not answer, the words the owner designed stay", page.words() === "$116.59", page.words());
}

/* ------------------------------------------------------ what publishes */
{
  const nodes = [
    { id: "a", pageId: "home", work: { id: "sol-price", inputs: {} } },
    { id: "b", pageId: "home", work: { id: "sol-price", inputs: { every: "10" } } },
    { id: "c", pageId: "tokens", work: { id: "token-price", inputs: { mint: "x" } } },
    { id: "d", pageId: "tokens", work: null },
  ];
  const files = featureFiles(nodes).map((f) => f.path).sort();
  check("publishing ships the runtime and one script per feature used", JSON.stringify(files) === JSON.stringify(["assets/features/runtime.js", "assets/features/sol-price.js", "assets/features/token-price.js"]), files.join(", "));
  check("…and nothing at all for a site that uses none", featureFiles([{ id: "d", pageId: "x", work: null }]).length === 0);
  const home = pageFeatures(nodes.filter((n) => n.pageId === "home"));
  check("a page loads only what it uses", JSON.stringify(home.scripts) === JSON.stringify(["runtime.js", "sol-price.js"]), home.scripts.join(", "));
  check("…and says which part takes which feature", home.bindings.length === 2 && home.bindings[1].part === "b" && home.bindings[1].inputs.every === "10");
  check("a part whose feature is not in the library ships nothing", pageFeatures([{ id: "z", work: { id: "nope", inputs: {} } }]).bindings.length === 0);
}

/* ------------------------------------------------------- the one box */
const pages = [{ id: "page_home", name: "Creator Hub", path: "/" }, { id: "page_tokens", name: "Tokens", path: "/tokens" }];
const read = (text, part = {}) => readWords(text, { pages, works: LIBRARY.map((w) => w.manifest), drawsWords: true, words: "", ...part });
{
  const r = read("https://x.com/solcinerator");
  check("a web address becomes a link", r.kind === "link" && r.link.kind === "url" && r.link.target === "https://x.com/solcinerator", JSON.stringify(r));
  const r2 = read("x.com/solworks");
  check("…with or without the https", r2.kind === "link" && r2.link.target === "https://x.com/solworks", r2.link?.target);
  const r3 = read("tokens", { drawsWords: false });
  check("a page name becomes an internal link", r3.kind === "link" && r3.link.kind === "page" && r3.link.target === "page_tokens", JSON.stringify(r3));
  const r3b = read("go to the tokens page", { words: "Launch" });
  check("…said as a place to go, it is a link even on a part with words", r3b.kind === "link" && r3b.link.target === "page_tokens", r3b.kind);
  const r4 = read("Launch your token");
  check("plain text becomes the words", r4.kind === "words" && r4.text === "Launch your token", JSON.stringify(r4));
  const r5 = read("sol price");
  check("a library match attaches that feature", r5.kind === "work" && r5.work.id === "sol-price", JSON.stringify(r5));
  const r6 = read("live sol price every 10 seconds");
  check("…with what was said about it as its inputs", r6.kind === "work" && r6.work.inputs.every === "10", JSON.stringify(r6.work?.inputs));
  const r7 = read("price of DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
  check("a mint in the words is Live token price by that mint", r7.kind === "work" && r7.work.id === "token-price" && r7.work.inputs.mint === "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", JSON.stringify(r7.work));
  const r8 = read("show the latest transaction hashes from the connected wallet");
  check("anything else is a task", r8.kind === "task" && r8.text.startsWith("show the latest"), r8.kind);
  const r9 = read("Tokens", { words: "Launch" });
  check("it asks when two readings are both fair: a page's name on a part that has words", r9.kind === "ask" && r9.options.some((o) => o.kind === "link") && r9.options.some((o) => o.kind === "words"), JSON.stringify(r9.options?.map((o) => o.kind)));
  const r10 = read("price");
  check("…or a word that fits two features", r10.kind === "ask" && r10.options.every((o) => o.kind === "work"), JSON.stringify(r10.options?.map((o) => o.work?.id)));
  const r11 = read("“sol price”");
  check("quoted, it is always the words", r11.kind === "words" && r11.text === "sol price", JSON.stringify(r11));
  for (const x of [r, r3, r4, r5, r8]) check(`it says how it understood "${x.kind}"`, typeof x.say === "string" && x.say.length > 3, x.say);
  check("matching finds nothing in words that name no feature", matchWorks("hello there", LIBRARY.map((w) => w.manifest)).length === 0);
}

/* ------------------------------------------------ the orange ! on sink */
const SINK = process.argv[2] ?? "../sink";
if (!existsSync(join(SINK, "site/document.json"))) {
  check("a sink checkout to read Solcinerator from", false, `none at ${SINK}`);
} else {
  const doc = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
  const home = doc.nodes.filter((n) => n.pageId === "page_home");
  const marked = new Map(decisions(home).map((d) => [d.id, d]));
  const words = (id) => { const c = home.find((n) => n.id === id)?.content; return typeof c === "string" ? c : (c ?? []).map((s) => s.text).join(""); };
  const at = (sel) => home.filter((n) => (n.from?.selector ?? "").endsWith(sel));
  /* A ! on an icon's own control counts for the icon: one control, one !. */
  const onIt = (n) => marked.has(n.id) || home.some((c) => marked.has(c.id) && c.from?.selector && (n.from?.selector ?? "").startsWith(`${c.from.selector} >`));
  const expect = [
    ["the header's first icon button (profile)", at("div:nth-of-type(3) > button:nth-of-type(1) > svg")],
    ["the header's second icon button", at("div:nth-of-type(3) > button:nth-of-type(2) > svg")],
    ["?", home.filter((n) => words(n.id) === "?")],
    ["the time-range buttons", home.filter((n) => ["1D", "1W", "1M", "3M", "1Y", "ALL"].includes(words(n.id)))],
    ["refresh", at("div:nth-of-type(1) > div > button > svg")],
    ["the wallet chip", home.filter((n) => words(n.id) === "kgER...9oP7")],
    ["the latest-transaction chip", home.filter((n) => /button$/.test(n.from?.selector ?? "") && /3G8S/.test(n.label))],
    ["the price", home.filter((n) => words(n.id) === "$116.59")],
    ["the price's change", home.filter((n) => words(n.id) === "-1.94%")],
    ["the stat numbers", home.filter((n) => /^[+]?\d+\.\d{4} SOL$/.test(words(n.id)))],
  ];
  for (const [what, ns] of expect) {
    check(`the ! is on ${what}`, ns.length > 0 && ns.every(onIt), `${ns.filter(onIt).length}/${ns.length}`);
  }
  /* The header's and the footer's link icons: the capture read href="/docs" on both, so they go somewhere already. */
  const docs = [...at("header > div > div:nth-of-type(3) > a > svg"), ...at("footer > div > div:nth-of-type(1) > a > svg")];
  check("the two link icons the capture found going to /docs carry no !", docs.length === 2 && docs.every((n) => !onIt(n)), `${docs.length}`);
  const linked = home.filter((n) => n.link);
  check("…and on no part that already goes somewhere", linked.every((n) => !marked.has(n.id)), `${linked.length} linked`);
  const inLinked = home.filter((n) => n.featureId === "drawn-icon" && linked.some((l) => (n.from?.selector ?? "").startsWith(`${l.from?.selector} >`)));
  check("…nor on an icon inside one (the sidebar's)", inLinked.length > 0 && inLinked.every((n) => !marked.has(n.id)), `${inLinked.length} icons`);
  const chip = home.find((n) => /3G8S/.test(n.label) && /button$/.test(n.from?.selector ?? ""));
  const inChip = home.filter((n) => chip && (n.from?.selector ?? "").startsWith(`${chip.from.selector} >`));
  check("…nor twice on one control: the chip carries it, not each thing inside it", inChip.length > 0 && inChip.every((n) => !marked.has(n.id)), `${inChip.length} inside`);
  const labels = home.filter((n) => ["Total PnL", "Total Earned", "PnL Over Time", "SOLCINERATOR"].includes(words(n.id)));
  check("…nor on words that are only words", labels.every((n) => !marked.has(n.id)), labels.map((n) => words(n.id)).join(", "));
  const sorted = [...marked.values()];
  check("each ! says why: somewhere to go, or live data", sorted.every((d) => d.why === "nowhere" || d.why === "live"), [...new Set(sorted.map((d) => d.why))].join(", "));
  const answered = home.map((n) => (marked.has(n.id) ? { ...n, link: { kind: "url", target: "https://x.com" } } : n));
  check("once each is answered, every ! is gone", decisions(answered).length === 0, `${decisions(answered).length} left`);
  const worked = home.map((n) => (words(n.id) === "$116.59" ? { ...n, work: { id: "sol-price", inputs: {} } } : n));
  check("a live spot with a feature attached is answered", !decisions(worked).some((d) => words(d.id) === "$116.59"));
  const tasked = home.map((n) => (words(n.id) === "kgER...9oP7" ? { ...n, task: "connect the wallet" } : n));
  check("a spot with a task written for it is answered", !decisions(tasked).some((d) => words(d.id) === "kgER...9oP7"));
  console.log(`  (${marked.size} marked on Creator Hub)`);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
