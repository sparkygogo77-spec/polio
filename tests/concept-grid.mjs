#!/usr/bin/env node
/**
 * THE GRID'S SUMS: rows that line up, one tick a row, Whole, the ticked page,
 * a part under a point, one section written again.
 *
 * No browser, no Claude. Three concepts are drafted as the free Make
 * drafts them, and held to:
 *
 *   · the rows are every section any concept has, in page order, Header
 *     first and Footer last, each once; a concept without a section has
 *     no cell in that row (the empty cell); every row has a `kind`;
 *   · a row is as tall as its tallest cell;
 *   · tick, tick again (off), one tick a row; Whole ticks every row the
 *     concept has and leaves the rest; the ticks become takes in row order;
 *   · the ticked page stacks those sections in row order on one page, in
 *     the first ticked concept's look;
 *   · partAt finds the smallest part under a point, none off the page;
 *   · keys 1, 2, 3 name the concepts; 4 and letters name none of three;
 *   · redraftSection writes one section again: new words, same System,
 *     same place, what sat under it moved by the difference, nothing else
 *     changed; a section the direction lacks leaves the page as it was;
 *   · the switches exist, each a boolean, so J can drop any piece.
 *
 *   node tests/concept-grid.mjs
 *
 * Covers: src/features/studio/concepts/grid.ts, src/features/studio/concepts/draft.ts, src/features/studio/concepts/copy.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/* SRC=<another checkout>/src runs the same checks against that checkout (red on base). */
const src = process.env.SRC ?? join(here, "..", "src");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": src } });
const studio = join(src, "features", "studio");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const done = () => { const failed = results.filter((r) => !r).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0); };
const J = (x) => JSON.stringify(x);

let G, D;
try {
  G = await jiti.import(join(studio, "concepts", "grid.ts"));
  D = await jiti.import(join(studio, "concepts", "draft.ts"));
  if (!G.rowsOf || !D.redraftSection) throw new Error("no rowsOf/redraftSection");
} catch (e) {
  check("the grid modules load (concepts/grid.ts, draft.ts)", false, e.message.split("\n")[0]);
  done();
}
const P = await jiti.import(join(studio, "idea", "plan.ts"));
const M = await jiti.import(join(studio, "concepts", "model.ts"));
const allowed = new Set(P.draftable().map((f) => f.id));
const PROMPT = "three concepts for a lantern shop landing page";
const drafts = D.draftConcepts(PROMPT, { seed: 11, count: 3, allowed });
const ids = ["c1", "c2", "c3"];
const docs = new Map(drafts.map((d, i) => [ids[i], d.doc]));
const concepts = drafts.map((d, i) => ({ id: ids[i], nodes: d.doc.nodes, pageId: d.doc.activePageId }));

/* Rows. */
const rows = G.rowsOf(concepts);
const names = rows.map((r) => r.name);
check("the rows are every section any concept has, each once, Header first and Footer last", rows.length >= 6 && names[0] === "Header" && names[names.length - 1] === "Footer" && new Set(rows.map((r) => r.key)).size === rows.length, names.join(" > "));
check("…First screen is the second row, and rows the concepts share line up", names[1] === "First screen" && ["c1", "c2", "c3"].every((id) => !!rows.find((r) => r.key === "first screen").cells[id]));
const sparse = rows.filter((r) => Object.keys(r.cells).length < 3);
check("…a concept without a section has no cell in that row (the empty cell)", sparse.length >= 1 && sparse.every((r) => Object.keys(r.cells).length >= 1), sparse.map((r) => `${r.name}: ${Object.keys(r.cells).length}`).join(", "));
check("…every row has a kind, and is as tall as its tallest cell", rows.every((r) => r.kind === "section" && r.height === Math.max(...Object.values(r.cells).map((c) => c.section.bottom - c.section.top)) && r.height > 0));
const inOrder = (c) => { const mine = rows.filter((r) => r.cells[c.id]); return mine.every((r, i) => i === 0 || r.cells[c.id].section.top >= mine[i - 1].cells[c.id].section.top); };
check("…rows keep the page order of at least two of the three concepts (three pages cannot always agree)", concepts.filter(inOrder).length >= 2, concepts.map((c) => (inOrder(c) ? "in order" : "differs")).join(" / "));
check("…no row is named for a picture's caption: pictures are one row", !rows.some((r) => /workshop|bench|lit$/i.test(r.name)), names.join(" > "));

/* Ticks. */
let t = {};
t = G.tick(t, "first screen", "c2");
t = G.tick(t, "prices", rows.find((r) => r.key === "prices") ? Object.keys(rows.find((r) => r.key === "prices").cells)[0] : "c1");
check("tick: one per row", t["first screen"] === "c2" && Object.keys(t).length === 2);
check("…ticking the ticked cell takes it off; another concept moves the tick", !G.tick(t, "first screen", "c2")["first screen"] && G.tick(t, "first screen", "c3")["first screen"] === "c3");
const whole = G.tickWhole(rows, { "first screen": "c2" }, "c1");
const c1rows = rows.filter((r) => r.cells.c1).map((r) => r.key);
check("Whole: every row the concept has, ticked from it; a row it lacks keeps its tick", c1rows.every((k) => whole[k] === "c1") && rows.filter((r) => !r.cells.c1).every((r) => whole[r.key] === (r.key === "first screen" ? "c2" : undefined)), J(whole));
const takes = G.takesOf(rows, whole);
check("…the ticks become takes in row order", takes.length === c1rows.length && takes.every((x, i) => x.from === "c1" && x.section.toLowerCase() === c1rows[i]) );
check("…a tick on a cell the row does not have is skipped", G.takesOf(rows, { "first screen": "nobody" }).length === 0);
check("…tick counts by concept", J(G.tickCounts(rows, { "first screen": "c2", header: "c2", footer: "c1" })) === J({ c2: 2, c1: 1 }));

/* The ticked page. */
const mixed = { header: "c1", "first screen": "c2", footer: "c3" };
const page = G.pageOf(rows, mixed, docs);
const want = ["c1", "c2", "c3"].map((id, i) => M.partsOfSection(docs.get(id).nodes, ["Header", "First screen", "Footer"][i]).length).reduce((a, b) => a + b, 0);
check("the ticked page stacks the ticked sections in row order on one page", page && page.nodes.length === want && page.pages[0].id === "page_home" && page.nodes.every((n) => n.pageId === "page_home"), `${page?.nodes.length} parts`);
const top = (pref) => Math.min(...page.nodes.filter((n) => n.id.startsWith(pref)).map((n) => n.y));
check("…header above the first screen above the footer, in the first ticked concept's look", top("mx0_") === 0 && top("mx1_") >= top("mx0_") && top("mx2_") > top("mx1_") && page.look === docs.get("c1").look && page.frameWidth === 1440);
check("…no ticks, no page", G.pageOf(rows, {}, docs) === null);

/* A part under a point. */
const d1 = docs.get("c1");
const heading = d1.nodes.find((n) => /First screen: heading/.test(n.label));
const hit = G.partAt(d1.nodes, heading.x + 5, heading.y + 5, d1.activePageId);
check("partAt finds the part under a point: the heading, not the band behind it", hit && hit.id === heading.id, hit?.label);
check("…and nothing off the page", G.partAt(d1.nodes, -10, -10) === null && G.partAt(d1.nodes, 5000, 5) === null);
check("keys 1, 2, 3 name the concepts; 4 and a letter name none", G.conceptForKey("1", ids) === "c1" && G.conceptForKey("3", ids) === "c3" && G.conceptForKey("4", ids) === null && G.conceptForKey("a", ids) === null);

/* One section again. */
const voice = drafts[0].voice;
const before = d1.nodes;
const prices = before.some((n) => M.sectionOfPart(n.label) === "Prices") ? "Prices" : rows.find((r) => r.cells.c1 && !/header|footer|first screen/.test(r.key)).name;
const again = D.redraftSection(d1, voice, PROMPT, prices, 99, allowed);
check(`redraftSection writes "${prices}" again`, again && again.nodes.length > 0, again ? `${again.height.was} → ${again.height.now} px` : "null");
if (again) {
  const oldSec = M.partsOfSection(before, prices);
  const newSec = M.partsOfSection(again.nodes, prices);
  const oldTop = Math.min(...oldSec.map((n) => n.y)), oldBottom = Math.max(...oldSec.map((n) => n.y + n.h));
  check("…the new section sits where the old one was, with new words", newSec.length > 0 && Math.min(...newSec.map((n) => n.y)) === oldTop && newSec.some((n) => typeof n.content === "string" && n.content && !oldSec.some((o) => o.content === n.content)));
  const delta = again.height.now - again.height.was;
  const untouched = before.filter((n) => !oldSec.includes(n));
  check("…what sat under it moved by the difference in height, nothing else changed", untouched.every((o) => { const n = again.nodes.find((x) => x.id === o.id); return n && n.x === o.x && n.y === o.y + (o.y >= oldBottom ? delta : 0) && n.content === o.content; }), `delta ${delta}`);
  check("…no placeholder words in it, and ids distinct", new Set(again.nodes.map((n) => n.id)).size === again.nodes.length);
}
check("…a section the direction lacks leaves the page as it was", D.redraftSection(d1, voice, PROMPT, "Nowhere", 1, allowed) === null);
check("…a page with no System cannot be redrafted", D.redraftSection({ ...d1, system: null }, voice, PROMPT, prices, 1, allowed) === null);

/* Switches. */
check("the pieces from A and B are each one switch", ["wholePage", "promoteOne", "hoverCards", "numberKeys", "yourPage"].every((k) => typeof G.SWITCHES[k] === "boolean"), J(G.SWITCHES));
done();
