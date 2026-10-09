#!/usr/bin/env node
/**
 * THE ELEMENT LIST NAMES PST'S PARTS AS A PERSON READS THEM.
 *
 * J (2026-10-09), on the Play page's list: the title came as three rows (an
 * empty "Heading", its words, its drawing) while the badges were one; the
 * balance "?" read as "Words"; and the count said 510 for a list of about
 * 210 rows. Read on the saved PST board (tests/lib/board.mjs), pure:
 *
 *   1. the title is one row, "Heading: PonsStars test page", standing for its
 *      words and its TV drawing; neither is a row of its own;
 *   2. the "?" is "Toggle: More about the balance", with the text it opens
 *      listed right under it, shown after a press;
 *   3. a line of words read off a section is Words, not "Section";
 *   4. painted bars fold into one row only with neighbours in the same
 *      holder: the TV's static and a knob's notch are two rows;
 *   5. a component with no words is named by its name in the code
 *      ("Badge: chart tv knob volume"), never a bare "Badge";
 *   6. no part is in two rows.
 *
 *   node tests/element-list-labels.mjs
 *
 * Covers: src/features/studio/partList.ts, src/features/studio/partNames.ts, src/features/studio/panels/PartTreePanel.tsx, src/features/studio/panels/inspector/Panel.tsx
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { boardDoc, readBoard } from "./lib/board.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { partList, foldComponentRows } = await src("partList.ts");
const { componentsOf, KIND_WORD } = await src("components.ts");
const { resolvePalette } = await src("shelf/run.ts");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const doc = boardDoc(readBoard("pst"));
const nodes = doc.nodes.filter((n) => n.pageId === "page_home");
const byHook = (h) => nodes.find((n) => n.hooks?.["data-hook"] === h);
const hookWords = (n) => (n?.hooks?.["data-hook"] ? n.hooks["data-hook"].replace(/[-_]+/g, " ") : undefined);
const comps = componentsOf(nodes, resolvePalette(doc.format, doc.look));
const rows = foldComponentRows(partList(nodes, { siteName: "PonsStars" }), comps.list.filter((c) => c.layers.length).map((c) => ({ id: c.id, kindWord: KIND_WORD[c.kind], name: c.name, parts: c.parts, hookName: hookWords(nodes.find((n) => n.id === c.id)) })));
const rowOf = (id) => rows.findIndex((r) => r.ids.includes(id));
console.log(`  ${nodes.length} parts, ${rows.length} rows`);

/* 1. */
const title = byHook("page-title"), words = byHook("page-title-text"), icon = byHook("page-title-icon");
const t = rows[rowOf(title.id)];
check("1. the title is one row named by its words", t?.name === "Heading: PonsStars test page" && t.id === title.id, JSON.stringify(t));
check("…standing for its words and its drawing, neither a row of its own", rowOf(words.id) === rowOf(title.id) && rowOf(icon.id) === rowOf(title.id) && !rows.some((r) => r.name === "Heading" && !r.after), JSON.stringify(t?.ids));

/* 2. */
const toggle = byHook("balance-note-more-toggle"), more = byHook("balance-note-more-text");
const at = rowOf(toggle.id);
check("2. the balance \"?\" is a toggle named for what it opens", rows[at]?.name === "Toggle: More about the balance", rows[at]?.name);
check("…with the text it opens right under it, after a press", rowOf(more.id) === at + 1 && rows[at + 1].after && rows[at + 1].control === toggle.id, JSON.stringify(rows[at + 1]));

/* 3. */
const line = nodes.find((n) => /::line\(/.test(n.from?.selector ?? "") && /One escrow balance/.test(JSON.stringify(n.content)));
check("3. a line of words read off a section is Words", rows[rowOf(line.id)]?.name.startsWith("Words: One escrow balance"), rows[rowOf(line.id)]?.name);

/* 4. */
const staticId = byHook("chart-tv-static").id, notch = byHook("chart-tv-knob-channel-notch").id;
check("4. the TV's static and a knob's notch are not folded into one row", rowOf(staticId) !== rowOf(notch), `${rowOf(staticId)} / ${rowOf(notch)}`);

/* 5. */
const knob = rows[rowOf(byHook("chart-tv-knob-volume").id)];
check("5. a component with no words is named by its name in the code", knob?.name === "Badge: chart tv knob volume", knob?.name);
check("…and no row is a bare \"Badge\"", !rows.some((r) => r.name === "Badge"), rows.filter((r) => r.name === "Badge").map((r) => r.id).join());

/* 6. */
const ids = rows.flatMap((r) => r.ids);
check("6. no part is in two rows", ids.length === new Set(ids).size, `${ids.length} ids, ${new Set(ids).size} distinct`);

const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
