#!/usr/bin/env node
/**
 * A LIVE NUMBER ON A PANEL KEEPS THE PANEL; AN OUTLINE ENTRY GOES SOMEWHERE.
 *
 * J (2026-10-10, polio/shelf-items-audit.md fixes 8 and 9): Live SOL price
 * put on a panel replaced the panel's whole drawing with a bare "$109.53",
 * and a table of contents' entries did nothing in the Preview. Now the
 * number goes on the panel in a layer of its own, and an entry scrolls to
 * the heading with its words. No browser: a few stand-in elements.
 *
 *   node tests/price-on-panel-and-outline.mjs
 *
 * Covers: src/features/studio/shelf/library/works.ts (RUNTIME_JS api.set), src/features/studio/shelf/parts/Layout.tsx (Outline, outlineTarget)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { RUNTIME_JS } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "library", "works.ts"));
const { outlineTarget } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "Layout.tsx"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* Stand-in elements: just what api.set and outlineTarget read. */
const text = (v) => ({ nodeType: 3, nodeValue: v });
function el(tag, kids = [], attrs = {}) {
  const e = {
    nodeType: 1, tagName: tag, childNodes: kids, attrs: { ...attrs }, style: {},
    get textContent() { return this.childNodes.map((k) => (k.nodeType === 3 ? k.nodeValue : k.textContent)).join(""); },
    set textContent(v) { this.childNodes = [text(v)]; },
    hasAttribute(a) { return a in this.attrs; }, setAttribute(a, v) { this.attrs[a] = String(v); }, removeAttribute(a) { delete this.attrs[a]; },
    appendChild(k) { this.childNodes.push(k); return k; },
    querySelector(sel) { const m = /\[data-feature-layer=words\]/.test(sel); return m ? this.childNodes.find((k) => k.attrs?.["data-feature-layer"] === "words") ?? null : null; },
    contains(o) { return o === this || this.childNodes.some((k) => k.nodeType === 1 && k.contains(o)); },
    ownerDocument: { createElement: (t) => el(t) },
  };
  return e;
}
const win = {};
new Function("window", "document", RUNTIME_JS)(win, { readyState: "loading", addEventListener() {}, getElementById: () => null });
const api = win.siteFeatures.api;

const drawing = el("div", [], { "data-part-box": "" });
const panel = el("div", [drawing]);
api.set(panel, "$109.53");
check("On a panel, the panel's drawing stays", panel.childNodes[0] === drawing);
check("…and the price is on it, in a layer of its own", panel.childNodes[1]?.attrs?.["data-feature-layer"] === "words" && panel.childNodes[1].textContent === "$109.53");
api.set(panel, "$110.00");
check("…written again in the same layer, not a second one", panel.childNodes.length === 2 && panel.childNodes[1].textContent === "$110.00");
const words = el("div", [el("span", [text("$116.59")])]);
api.set(words, "$120.00");
check("On a words part, the words become the price, as before", words.textContent === "$120.00" && words.childNodes.length === 1);
const empty = el("div", []);
api.set(empty, "$1.00");
check("On an empty part, the price is its words, as before", empty.textContent === "$1.00");

/* The outline. */
const self = el("nav", [el("button", [text("How it works")])]);
const heading = el("h2", [text("How  it works")]);
const all = [self, ...self.childNodes, heading, el("div", [text("Details")], { "data-live-node": "x" })];
const page = { querySelectorAll: (sel) => all.filter((x) => (sel.startsWith("h1") ? /^h[1-6]$/.test(x.tagName) : "data-live-node" in x.attrs)) };
check("An entry goes to the heading with its words, any spacing or case", outlineTarget(page, "how it works", self) === heading);
check("…else to a part with its words", outlineTarget(page, "Details", self)?.attrs["data-live-node"] === "x");
check("…and never to the outline's own entry", outlineTarget({ querySelectorAll: () => [self.childNodes[0]] }, "How it works", self) === null);

const passed = results.filter(Boolean).length;
console.log(`\n${passed} of ${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
