#!/usr/bin/env node
/**
 * BRINGING A SITE IN AGAIN KEEPS WHAT THE OWNER CHANGED (`reimport.ts`).
 *
 * trumpmorty.fun was never brought in again after the capture got better,
 * because bringing it in replaced the board whole and with it his ribbons'
 * "Centre in its band" and text size. Here, on trumpmorty.fun's own
 * documents from sink: an earlier conversion is the board he was given; he
 * centres both ribbons' words and sizes them, moves a button, rewrites a
 * line, adds a part, deletes a part and renames the site; the current
 * conversion is brought in over it.
 *
 *   · with the board's record of itself as brought in, every one of those
 *     stands, the part he deleted stays deleted, and everything he did not
 *     touch is the new capture's (the loader's switch-off time, a sticker's
 *     shadow, a part new to this capture);
 *   · with no record (a board brought in before records were kept), the
 *     careful merge keeps the ribbons' settings, the moved button and the
 *     part he added, and says what it could not tell;
 *   · a board nobody changed comes back exactly as the new capture.
 *
 *   node --experimental-strip-types tests/reimport-keeps.mjs [the capture folder] [older ref]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { takeDoc } from "../src/features/studio/docTake.ts";
import { fingerprint, keepOwnerEdits, keptSays, facets, print } from "../src/features/studio/bring-in/reimport.ts";
import { usesOf, withWork } from "../src/features/studio/shelf/library/works.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SINK = process.argv[2] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
const OLD = process.argv[3] ?? "7b7ee04";
const FILE = "sites/trumpmorty-fun/site/document.json";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const J = (v) => JSON.stringify(v);
if (!existsSync(join(SINK, FILE))) { console.log(`no capture folder with ${FILE} at ${SINK}`); process.exit(1); }

const defaults = { format: () => ({}), look: () => ({}) };
const prev = { pages: [{ id: "page_home" }], nodes: [], groups: [], shapes: [], spaces: [], brief: {}, look: {}, motion: [], frameWidth: 1440 };
const taken = (raw) => { const t = takeDoc(prev, raw, defaults); return { nodes: t.nodes, format: t.format, brief: t.brief, look: t.look }; };
const oldRaw = JSON.parse(existsSync(join(SINK, "history", OLD, FILE)) ? readFileSync(join(SINK, "history", OLD, FILE), "utf8") : execFileSync("git", ["-C", SINK, "show", `${OLD}:${FILE}`], { encoding: "utf8", maxBuffer: 1 << 28 }));
const newRaw = JSON.parse(readFileSync(join(SINK, FILE), "utf8"));
const was = taken(oldRaw), next = taken(newRaw);
check("both conversions are taken in", was.nodes.length > 100 && next.nodes.length > 100, `${was.nodes.length} → ${next.nodes.length}`);

/* ------------------------------------------------ his board, edited by hand */
const clone = (v) => JSON.parse(JSON.stringify(v));
const edit = (doc) => {
  const d = clone(doc);
  const ribbons = d.nodes.filter((n) => usesOf(n.work).some((u) => u.id === "marquee"));
  for (const n of ribbons) { const u = usesOf(n.work).find((x) => x.id === "marquee"); n.work = withWork(n.work, { ...u, inputs: { ...u.inputs, middle: "yes", size: "40" } }); }
  const sel = (re) => d.nodes.find((n) => re.test(n.from?.selector ?? ""));
  const button = sel(/section:nth-of-type\(1\).*> a:nth-of-type\(1\)$/) ?? d.nodes.find((n) => n.featureId === "cta-primary");
  button.x += 50; button.byHand = true;
  const line = d.nodes.find((n) => n.featureId === "prose" && typeof n.content === "string" && n.content.length > 20 && !usesOf(n.work).length && n.from?.selector);
  line.content = "Words the owner wrote himself.";
  d.nodes.push({ id: "n_hand_1", pageId: "page_home", featureId: "box", label: "his own box", x: 40, y: 40, w: 120, h: 80, byHand: true });
  const gone = d.nodes.find((n, i) => i > 20 && n.featureId === "picture" && next.nodes.some((m) => m.from?.selector === n.from?.selector));
  d.nodes = d.nodes.filter((n) => n !== gone);
  d.brief = { ...d.brief, name: "TRORTY, as he named it" };
  return { d, ribbons: ribbons.map((n) => n.from.selector), button: button.from.selector, line: line.from.selector, gone: gone.from.selector };
};
const board = edit(was);
check("the stand-in edits land on the old board: two ribbons, a button, a line, a picture deleted", board.ribbons.length >= 2 && !!board.button && !!board.line && !!board.gone, J({ ribbons: board.ribbons.length, button: board.button, line: board.line, gone: board.gone }));

const bySel = (doc, s) => doc.nodes.filter((n) => n.from?.selector === s);
const input = (n, k) => usesOf(n?.work).find((u) => u.id === "marquee")?.inputs?.[k];

/* ------------------------------------------------ with the record */
{
  const record = fingerprint(was, "sparkygogo77-spec/sink/sites/trumpmorty-fun@old");
  const { doc, kept } = keepOwnerEdits(board.d, record, next);
  const says = keptSays(kept);
  check("with the record: both ribbons stay centred in their band at 40px", board.ribbons.every((s) => bySel(doc, s).every((n) => input(n, "middle") === "yes" && input(n, "size") === "40")), J(board.ribbons.map((s) => bySel(doc, s).map((n) => usesOf(n.work)))));
  check("…the rest of the ribbons' settings are the new capture's", board.ribbons.every((s) => { const a = bySel(doc, s)[0], b = bySel(next, s)[0]; return input(a, "speed") === input(b, "speed") && input(a, "direction") === input(b, "direction"); }));
  const moved = bySel(doc, board.button)[0], movedWas = bySel(board.d, board.button)[0];
  check("…the button stays where he moved it", moved?.x === movedWas?.x && moved?.byHand === true, J({ now: moved?.x, his: movedWas?.x }));
  check("…the line keeps his words", bySel(doc, board.line)[0]?.content === "Words the owner wrote himself.", J(bySel(doc, board.line)[0]?.content));
  check("…his own box is kept", doc.nodes.some((n) => n.id === "n_hand_1") && kept.added.includes("n_hand_1"));
  check("…the picture he deleted stays deleted", !bySel(doc, board.gone).length && kept.stayDeleted >= 1, J({ stayDeleted: kept.stayDeleted }));
  check("…the site keeps his name", doc.brief?.name === "TRORTY, as he named it", J(doc.brief));
  /* What he did not touch is the new capture's. */
  const untouched = next.nodes.filter((n) => n.from?.selector && ![...board.ribbons, board.button, board.line, board.gone].includes(n.from.selector));
  const same = untouched.filter((n) => { const m = bySel(doc, n.from.selector)[0]; return m && [...facets(n)].every(([p, v]) => print(v) === print(facets(m).get(p))) && [...facets(m)].every(([p]) => facets(n).has(p)); });
  check("…every part he did not touch is exactly the new capture's", same.length === untouched.length, `${same.length}/${untouched.length}; first different: ${J(untouched.find((n) => !same.includes(n))?.from?.selector)}`);
  const crtNext = next.nodes.find((n) => usesOf(n.work).some((u) => u.id === "crt-loader"));
  const crtNow = crtNext && doc.nodes.find((n) => n.from?.selector === crtNext.from?.selector);
  check("…the loader's settings are the new capture's (its switch-off time among them, when recorded)", J(usesOf(crtNow?.work)) === J(usesOf(crtNext?.work)), J([usesOf(crtNow?.work), usesOf(crtNext?.work)]));
  check("…parts keep the board's ids, so what names them still does", bySel(doc, board.button)[0]?.id === bySel(board.d, board.button)[0]?.id);
  check("…and the line says what was kept", /kept your changes on \d+ parts?/.test(says) && /1 part you added/.test(says) && /deleted/.test(says), says);
}

/* ------------------------------------------------ with no record */
{
  const { doc, kept } = keepOwnerEdits(board.d, null, next);
  const says = keptSays(kept);
  check("careful: both ribbons stay centred in their band at 40px", board.ribbons.every((s) => bySel(doc, s).every((n) => input(n, "middle") === "yes" && input(n, "size") === "40")));
  check("…the button he moved stays", bySel(doc, board.button)[0]?.x === bySel(board.d, board.button)[0]?.x);
  check("…his own box is kept", doc.nodes.some((n) => n.id === "n_hand_1"));
  check("…the rest is the new capture's (the line's words among it: nothing records that he wrote them)", bySel(doc, board.line)[0]?.content === bySel(next, board.line)[0]?.content);
  check("…and the line says the merge was careful", kept.by === "careful" && /no record/.test(says), says);
}

/* ------------------------------------------------ nobody changed anything */
{
  const { doc, kept } = keepOwnerEdits(clone(next), fingerprint(next), next);
  check("a board nobody changed comes back as the new capture, part for part", J(doc.nodes) === J(next.nodes) && !kept.edited.length && !kept.added.length, J(kept).slice(0, 300));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
