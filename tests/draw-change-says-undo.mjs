#!/usr/bin/env node
/**
 * A FINISHED DRAWING SAYS, ON THE BOARD, WHAT LANDED AND WHERE.
 *
 * The audit (A5): a queued drawing's result went to the news only, so a
 * drawing that turned a part into a cube did it in silence. Every job that
 * put something on the board ends in one short visible message.
 *
 *   node tests/draw-change-says-undo.mjs http://127.0.0.1:3013
 */
import { board, checker, BOX } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013");
const { ribbon, leaf } = b.parts;
await b.load();
await b.draw({ on: ribbon.id, strokes: BOX, words: "a 3d cube" });
await b.page.waitForTimeout(400);
let seen = await b.toasts();
check("a message is on screen when the drawing lands", /The drawing landed/.test(seen), seen.match(/The drawing landed[^\n]*\n?[^\n]*/)?.[0] ?? "none");
check("…saying it is a new part, on top of the part it was drawn on", new RegExp(`on top of ${ribbon.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(seen), ribbon.label);
check("…and that one undo takes it back", /One undo takes it back/.test(seen));
await b.load();
await b.draw({ on: leaf.id, strokes: BOX, words: "make this a cube" });
await b.page.waitForTimeout(400);
seen = await b.toasts();
check("a part changed because the words asked says so, by name", new RegExp(`${leaf.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} changed, as the words asked`).test(seen), leaf.label);
await b.browser.close();
done();
