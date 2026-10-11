#!/usr/bin/env node
/**
 * BRINGING A SITE IN AGAIN MATCHES ITS PARTS BY data-hook, NOT BY WHERE THEY STAND.
 *
 * Dissect 2026-10-10 #3: the merge keyed every captured part by the path of
 * the element it was read from (`body > main > div:nth-of-type(3) > …`).
 * A code chat adding one panel before J's parts renumbered that path for
 * every part after it, so a "keep my changes" bring-in reported them all as
 * new and gone and laid none of his edits back. The builder contract gives
 * every visible part a unique, stable data-hook: that is the key now.
 *
 * On the saved PonsStars board (tests/fixtures/boards/pst.json.gz, 850-odd
 * parts, nearly all hooked):
 *
 *   1. keys: a hooked part keys by its page and hook; a text line or a
 *      pseudo-element with no hook of its own keys from its nearest hooked
 *      ancestor; a hook two parts share keys neither; a part drawn by hand
 *      keys by its id;
 *   2. a new section inserted before his parts in the code: every edit he
 *      made after it stands, the new part is the one part new, nothing is
 *      gone, and what he did not touch is the new reading's;
 *   3. a record from before hooks were the key (keyed by paths) is read by
 *      hooks against the board, so the same edits stand; only a part he had
 *      deleted after the renumbering point comes back, since its record was
 *      under a path the code renumbered and no part on the board names it;
 *   4. with no record, the careful merge keeps the part he moved.
 *
 *   node tests/reimport-hooks.mjs
 *
 * Covers: src/features/studio/bring-in/reimport.ts
 */
import { readBoard, boardDoc } from "./lib/board.mjs";
import { facets, fingerprint, keepOwnerEdits, keysOf, keptSays, print, rekeyed } from "../src/features/studio/bring-in/reimport.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const J = (v) => JSON.stringify(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const pick = (d) => ({ nodes: d.nodes, format: d.format ?? {}, brief: d.brief ?? {}, look: d.look ?? {} });

const was = pick(boardDoc(readBoard("pst")));
const hooked = was.nodes.filter((n) => n.hooks?.["data-hook"]);
check("the saved PonsStars board is there, nearly every part hooked", was.nodes.length > 500 && hooked.length > was.nodes.length * 0.9, `${hooked.length}/${was.nodes.length}`);

/* ------------------------------------------------ 1. the keys */
{
  const keys = keysOf(was.nodes);
  const byId = Object.fromEntries(was.nodes.map((n, i) => [n.id, keys[i]]));
  const nav = was.nodes.find((n) => n.hooks?.["data-hook"] === "nav");
  check("1. a hooked part keys by its page and hook", byId[nav.id] === `${nav.pageId}|@data-hook=nav`, byId[nav.id]);
  const line = was.nodes.find((n) => / ::line\(\d+\)$/.test(n.from?.selector ?? "") && !n.hooks?.["data-hook"]);
  const holder = was.nodes.find((n) => n.pageId === line.pageId && n.from?.selector === line.from.selector.replace(/ ::line\(\d+\)$/, "") && n.hooks?.["data-hook"]);
  check("…a text line with no hook keys from its holder's hook", !!holder && byId[line.id] === `${line.pageId}|@data-hook=${holder.hooks["data-hook"]}${line.from.selector.match(/ ::line\(\d+\)$/)[0]}`, J({ line: line.from.selector, key: byId[line.id], holder: holder?.hooks?.["data-hook"] }));
  const paths = was.nodes.filter((n, i) => n.from?.selector && !keys[i].includes("|@") && !keys[i].startsWith("#"));
  check("…every part of the board keys by a hook (no part falls back to its path)", paths.length === 0, J(paths.slice(0, 3).map((n) => n.from.selector)));
  check("…and no two parts share a key", new Set(keys).size === keys.length, `${new Set(keys).size} of ${keys.length}`);
  const twins = keysOf([
    { id: "a", pageId: "p", from: { selector: "body > ul > li:nth-of-type(1)" }, hooks: { "data-hook": "row" } },
    { id: "b", pageId: "p", from: { selector: "body > ul > li:nth-of-type(2)" }, hooks: { "data-hook": "row" } },
    { id: "c", pageId: "p", from: { selector: "body > ul > li:nth-of-type(2) > span" } },
    { id: "d", pageId: "p", byHand: true },
  ]);
  check("…a hook two parts share keys neither, their paths do; an unhooked child under them too; a part drawn by hand is its id", J(twins) === J(["p|body > ul > li:nth-of-type(1)", "p|body > ul > li:nth-of-type(2)", "p|body > ul > li:nth-of-type(2) > span", "#d"]), J(twins));
}

/* ------------------------------------------------ the code adds a section before his parts */
/* The home page's main column: a new section:nth-of-type(2) is put in, so every later section and everything inside it is renumbered. */
const MAIN = was.nodes.find((n) => n.pageId === "page_home" && /^body > div:nth-of-type\(1\) > main$/.test(n.from?.selector ?? ""))?.from.selector
  ?? was.nodes.find((n) => n.pageId === "page_home" && / > main$/.test(n.from?.selector ?? ""))?.from.selector;
const AT = 2;
const renumber = (sel) => {
  const re = new RegExp(`^(${MAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} > section:nth-of-type\\()(\\d+)(\\))`);
  const m = sel.match(re);
  return m && Number(m[2]) >= AT ? sel.replace(re, (_, a, n, c) => `${a}${Number(n) + 1}${c}`) : sel;
};
const next = clone(was);
let moved = 0;
for (const n of next.nodes) { if (n.pageId !== "page_home" || !n.from?.selector) continue; const s = renumber(n.from.selector); if (s !== n.from.selector) { n.from.selector = s; moved++; } }
const fresh = { id: "n_home_section_new", pageId: "page_home", featureId: "box", label: "offer-panel", x: 100, y: 400, w: 800, h: 120, from: { url: "zip:web/index.html", host: "web/index.html", selector: `${MAIN} > section:nth-of-type(${AT})`, at: 1 }, hooks: { "data-hook": "offer-panel" } };
next.nodes.splice(next.nodes.findIndex((n) => n.from?.selector === `${MAIN} > section:nth-of-type(${AT + 1})`), 0, fresh);
/* And the code moved on elsewhere: a later hooked part's words changed. */
const reworded = next.nodes.find((n) => n.pageId === "page_home" && n.from?.selector.startsWith(`${MAIN} > section:nth-of-type(${AT + 2})`) && typeof n.content === "string" && n.content.length > 3 && n.hooks?.["data-hook"]);
reworded.content = "Words the code writes now.";
check("the stand-in code change renumbers the parts after the new section", !!MAIN && moved > 20 && !!reworded, J({ main: MAIN, moved, reworded: reworded?.hooks }));

/* His board: edits on parts after the insertion point, by hook. */
const after = (d) => d.nodes.filter((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] && n.from?.selector.startsWith(`${MAIN} > section:nth-of-type(`) && Number(n.from.selector.match(/section:nth-of-type\((\d+)\)/)[1]) >= AT);
const board = clone(was);
const his = after(board);
const coloured = his.find((n) => n.colour && n.featureId !== "box");
coloured.colour = { ...coloured.colour, bg: "#ff00aa" };
const movedPart = his.find((n) => n !== coloured && n.featureId === "cta-primary") ?? his.find((n) => n !== coloured);
movedPart.x += 77; movedPart.byHand = true;
const lineOf = board.nodes.find((n) => n.pageId === "page_home" && / ::line\(\d+\)$/.test(n.from?.selector ?? "") && !n.hooks?.["data-hook"] && his.some((h) => n.from.selector.startsWith(`${h.from.selector} `)) && typeof n.content === "string");
lineOf.content = "A line the owner rewrote.";
const deleted = his.find((n) => ![coloured, movedPart].includes(n) && n.featureId === "box" && !board.nodes.some((c) => c !== n && c.from?.selector.startsWith(`${n.from.selector} `)));
board.nodes = board.nodes.filter((n) => n !== deleted);
board.nodes.push({ id: "n_hand_1", pageId: "page_home", featureId: "box", label: "his own box", x: 40, y: 40, w: 120, h: 80, byHand: true });
check("his edits land after the insertion point: a colour, a moved part, a rewritten line, a deleted part, a part added", !!coloured && !!movedPart && !!lineOf && !!deleted, J({ coloured: coloured?.hooks?.["data-hook"], moved: movedPart?.hooks?.["data-hook"], line: lineOf?.from?.selector, deleted: deleted?.hooks?.["data-hook"] }));

const byHook = (doc, h) => doc.nodes.find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === h);
const lineNow = (doc) => doc.nodes.find((n) => n.pageId === "page_home" && n.from?.selector === renumber(lineOf.from.selector));
/* `returns`: the part he deleted comes back as new, where nothing records that he deleted it (a path-keyed record after a renumbering, or no record). */
const expect = (doc, kept, how, { returns = false } = {}) => {
  check(`${how}: the colour he set stands, on the part with that hook`, byHook(doc, coloured.hooks["data-hook"])?.colour?.bg === "#ff00aa", J(byHook(doc, coloured.hooks["data-hook"])?.colour));
  const m = byHook(doc, movedPart.hooks["data-hook"]);
  check("…the part he moved stays where he put it, with the board's id", m?.x === movedPart.x && m?.byHand === true && m?.id === movedPart.id, J({ x: m?.x, his: movedPart.x, id: m?.id }));
  check("…the line he rewrote under a hooked part keeps his words", lineNow(doc)?.content === "A line the owner rewrote.", J(lineNow(doc)?.content));
  check(`…the new section is ${returns ? "new" : "the one part new"}, nothing is gone`, kept.fresh === (returns ? 2 : 1) && kept.gone === 0 && doc.nodes.some((n) => n.hooks?.["data-hook"] === "offer-panel"), J({ fresh: kept.fresh, gone: kept.gone }));
  if (returns) check("…the part he deleted comes back: its record was under a path the code renumbered", !!byHook(doc, deleted.hooks["data-hook"]) && kept.stayDeleted === 0, J({ stayDeleted: kept.stayDeleted }));
  else check("…the part he deleted stays deleted", !byHook(doc, deleted.hooks["data-hook"]) && kept.stayDeleted === 1, J({ stayDeleted: kept.stayDeleted }));
  check("…his own box is kept", doc.nodes.some((n) => n.id === "n_hand_1") && kept.added.includes("n_hand_1"));
  check("…the words the code changed are the code's", byHook(doc, reworded.hooks["data-hook"])?.content === "Words the code writes now.", J(byHook(doc, reworded.hooks["data-hook"])?.content));
  const touched = new Set([coloured.id, movedPart.id, lineOf.id, deleted.id]);
  const untouched = next.nodes.filter((n) => n.from?.selector && !touched.has(n.id) && n !== fresh);
  const same = untouched.filter((n) => { const m2 = doc.nodes.find((x) => x.id === n.id); return m2 && [...facets(n)].every(([p, v]) => print(v) === print(facets(m2).get(p))) && [...facets(m2)].every(([p]) => facets(n).has(p)); });
  check("…every part he did not touch is exactly the new reading's", same.length === untouched.length, `${same.length}/${untouched.length}; first different: ${J(untouched.find((n) => !same.includes(n))?.from?.selector)}`);
  check("…and the line says what was kept", /kept your changes on 3 parts/.test(keptSays(kept)) && /1 part you added/.test(keptSays(kept)), keptSays(kept));
};

/* ------------------------------------------------ 2. with the record, keyed by hooks */
{
  const record = fingerprint(was, "sparkygogo77-spec/PST@old");
  check("2. the record is keyed by hooks", record.keys === "hook" && Object.keys(record.nodes).every((k) => k.includes("|@") || k.startsWith("#")), Object.keys(record.nodes).find((k) => !k.includes("|@")));
  const { doc, kept } = keepOwnerEdits(board, record, next);
  expect(doc, kept, "with the record");
}

/* ------------------------------------------------ 3. with a record from before: keyed by paths */
{
  const old = fingerprint(was, "sparkygogo77-spec/PST@old");
  const paths = keysOf(was.nodes, "selector"), hooks = keysOf(was.nodes);
  old.nodes = Object.fromEntries(Object.entries(old.nodes).map(([k, v]) => [paths[hooks.indexOf(k)], v]));
  delete old.keys;
  check("3. the old record keys every part by its path", Object.keys(old.nodes).every((k) => !k.includes("|@")) && Object.keys(old.nodes).length === was.nodes.length, Object.keys(old.nodes).length);
  const re = rekeyed(old, board);
  check("…re-keyed against the board, it is by hooks, and the deleted part's record stays under its path", re.keys === "hook" && Object.keys(re.nodes).filter((k) => !k.includes("|@") && !k.startsWith("#")).length === 1, J(Object.keys(re.nodes).filter((k) => !k.includes("|@"))));
  const { doc, kept } = keepOwnerEdits(board, old, next);
  expect(doc, kept, "with the old record", { returns: true });
}

/* ------------------------------------------------ 4. with no record */
{
  const { doc, kept } = keepOwnerEdits(board, null, next);
  const m = byHook(doc, movedPart.hooks["data-hook"]);
  check("4. careful: the part he moved stays where he put it", m?.x === movedPart.x && m?.byHand === true, J({ x: m?.x, his: movedPart.x }));
  check("…his own box is kept, the new section is new (and so is the part he deleted: nothing records that)", doc.nodes.some((n) => n.id === "n_hand_1") && kept.fresh === 2 && kept.by === "careful", J({ fresh: kept.fresh, by: kept.by }));
}

/* ------------------------------------------------ nobody changed anything */
{
  const { doc, kept } = keepOwnerEdits(clone(was), fingerprint(was), was);
  check("a board nobody changed comes back as the reading, part for part", J(doc.nodes) === J(was.nodes) && !kept.edited.length && !kept.added.length && !kept.fresh && !kept.gone, J(kept).slice(0, 300));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
