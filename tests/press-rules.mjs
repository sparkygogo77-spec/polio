#!/usr/bin/env node
/**
 * WHAT A PRESS STARTS: ONE CHECK PER ROW OF THE TABLE.
 *
 * J (2026-10-08): some parts would not move at all, and drag start was 300
 * lines of special cases in one handler. It is a table now
 * (`board/press.ts`): plain facts about the press in, the first rule that
 * holds out. Each row below is pressed once where it should win, and once
 * where the row just above or below it should.
 *
 *   node tests/press-rules.mjs
 *
 * Covers: src/features/studio/board/press.ts, src/features/studio/board/pressRead.ts, src/features/studio/board/DesktopCanvas.tsx
 */
import { PRESS_RULES, afterWordsDeclined, picksAfter, pressRule } from "../src/features/studio/board/press.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const part = (more = {}) => ({ handsOn: false, control: false, whole: false, holds: false, inner: false, words: false, link: false, locked: false, ...more });
const picked = (more = {}) => ({ ...part(), owner: false, alone: true, ...more });
/* A plain first press with the pointer tool on a leaf inside the page. */
const press = (more = {}) => ({
  button: 0, tool: "select", alt: false, shift: false, mod: false,
  groupHandle: false, resizeHandle: false, onPart: true, onPage: true, onShape: false, twice: false,
  hit: part(), picks: picked(), ...more,
});
const seen = new Set();
const is = (name, facts, want) => { seen.add(want); const got = pressRule(facts); check(name, got === want, `got ${got}, want ${want}`); };

/* ignore */
is("right button: the board takes nothing", press({ button: 2 }), "ignore");
/* group-resize */
is("a locked group's handle resizes the group", press({ groupHandle: true }), "group-resize");
is("a group handle under the pen is not a handle", press({ groupHandle: true, tool: "pen" }), "draw");
/* pan */
is("bare ground outside the page pans", press({ onPart: false, onPage: false, hit: null, picks: null }), "pan");
is("middle button pans over a part", press({ button: 1 }), "pan");
is("Alt pans over a part", press({ alt: true }), "pan");
is("a drawing outside the frame is not bare ground", press({ onPart: false, onPage: false, onShape: true, hit: null, picks: null }), "pick-shape");
/* resize */
is("a part's handle resizes it", press({ resizeHandle: true }), "resize");
is("a part's handle under the pen draws", press({ resizeHandle: true, tool: "pen" }), "draw");
/* go-in */
is("two presses on a part that holds others go in", press({ twice: true, hit: part({ holds: true, inner: true }) }), "go-in");
is("…not when nothing smaller is under the hand", press({ twice: true, hit: part({ holds: true }) }), "move");
is("…not on a control", press({ twice: true, hit: part({ holds: true, inner: true, control: true }) }), "move");
/* open-words */
is("two presses on words open them", press({ twice: true, hit: part({ words: true }) }), "open-words");
is("…not on a part that points somewhere", press({ twice: true, hit: part({ words: true, link: true }), picks: picked({ words: true, link: true }) }), "follow-link");
is("…and when no words open, the press is a first press", afterWordsDeclined(press({ twice: true, hit: part({ words: true }) })), "move");
check("declining keeps every other fact", JSON.stringify({ ...afterWordsDeclined(press({ twice: true, shift: true })), twice: true }) === JSON.stringify(press({ twice: true, shift: true })));
/* marquee-across */
is("Ctrl on a part that holds others draws the box", press({ mod: true, picks: picked({ holds: true }) }), "marquee-across");
is("a plain press on a part that holds others moves it (J: Always moves)", press({ picks: picked({ holds: true }) }), "move");
is("Ctrl on a control still grabs it", press({ mod: true, picks: picked({ holds: true, control: true }) }), "move");
is("Ctrl on a card grabbed whole still grabs it", press({ mod: true, picks: picked({ holds: true, whole: true }) }), "move");
/* hold-solid */
is("two presses on a solid open it for turning", press({ twice: true, hit: part({ handsOn: true }), picks: picked({ handsOn: true }) }), "hold-solid");
is("…not when locked", press({ twice: true, hit: part({ handsOn: true }), picks: picked({ handsOn: true, locked: true }) }), "move");
/* follow-link */
is("two presses on a link go where it points", press({ twice: true, hit: part({ link: true }), picks: picked({ link: true }) }), "follow-link");
is("…not when the press picked its owner", press({ twice: true, hit: part({ link: true }), picks: picked({ link: true, owner: true }) }), "move");
is("…not with others picked too", press({ twice: true, hit: part({ link: true }), picks: picked({ link: true, alone: false }) }), "move");
/* move */
is("one press on a part moves it", press(), "move");
is("a part the store does not know still moves by its id", press({ hit: null, picks: null }), "move");
/* pick-shape */
is("a drawing on the page is picked", press({ onPart: false, onShape: true, hit: null, picks: null }), "pick-shape");
/* marquee */
is("empty page draws a marquee", press({ onPart: false, hit: null, picks: null }), "marquee");
/* erase */
is("the eraser erases", press({ tool: "erase" }), "erase");
/* draw */
is("any other tool draws", press({ tool: "pen" }), "draw");

check("every row of the table is pressed above", PRESS_RULES.every((r) => seen.has(r.does)), PRESS_RULES.filter((r) => !seen.has(r.does)).map((r) => r.does).join());

/* The selection a press leaves */
check("a new part picks itself", JSON.stringify(picksAfter(["a"], "b", null, false)) === '["b"]');
check("a part in a group picks the group", JSON.stringify(picksAfter([], "b", ["b", "c"], false)) === '["b","c"]');
check("a picked part keeps the selection", JSON.stringify(picksAfter(["a", "b"], "b", null, false)) === '["a","b"]');
check("Shift adds and takes away", JSON.stringify(picksAfter(["a"], "b", null, true)) === '["a","b"]' && JSON.stringify(picksAfter(["a", "b"], "b", null, true)) === '["a"]');

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
