/**
 * A published site is seen at the width it was designed at.
 *
 * Publish writes `frameWidth` into the site's document, and the published
 * page loads that document into a fresh visitor's store with `loadDoc`.
 * `loadDoc` never set the width, so a site designed at phone width, 390,
 * arrived at the default 1440 for everyone who did not build it.
 *
 *   node tests/published-width.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { takeDoc } from "../src/features/studio/docTake.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The store's own rule, run without the store: what `loadDoc` sets. */
const defaults = { format: () => ({}), look: () => ({}) };
const pages = [{ id: "p1", name: "Home", path: "/", prompt: "", scroll: "inherit" }];
let s = { pages, nodes: [], groups: [], shapes: [], spaces: [], brief: {}, look: {}, motion: [], frameWidth: 1440 };
const load = (doc) => { s = { ...s, ...takeDoc(s, doc, defaults) }; return s.frameWidth; };
check("the store starts at the desktop width", s.frameWidth === 1440, String(s.frameWidth));
check("a published document designed at 390 lands at 390", load({ pages, nodes: [], frameWidth: 390 }) === 390, String(s.frameWidth));
check("and one at 834 at 834", load({ pages, nodes: [], frameWidth: 834 }) === 834, String(s.frameWidth));
check("a document with no width keeps the width there was", load({ pages, nodes: [] }) === 834, String(s.frameWidth));
check("and a width that is not one is not taken", load({ pages, nodes: [], frameWidth: 0 }) === 834 && load({ pages, nodes: [], frameWidth: "wide" }) === 834, String(s.frameWidth));
check("the store's loadDoc is this rule", /set\(\(s\) => takeDoc\(s, doc,/.test(["board/store.ts", ...readdirSync("src/features/studio/board/store").filter((f) => f.endsWith(".ts")).map((f) => `board/store/${f}`)].map((f) => readFileSync(`src/features/studio/${f}`, "utf8")).join("\n")));

check("publish writes the width into the document", /frameWidth: s\.frameWidth/.test(readFileSync("src/features/studio/agent.ts", "utf8")));
check("and the published page loads it with loadDoc", /loadDoc\(/.test(readFileSync("src/features/studio/live/PublishedPage.tsx", "utf8")));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
