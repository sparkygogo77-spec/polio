#!/usr/bin/env node
/**
 * WITHOUT A KEY, A DRAWING THAT LANDED IS DONE, AND SAYS WHAT HAPPENED.
 *
 * The audit (A8): with no key the queue marked a landed drawing "failed"
 * and said "the part took the drawing's proportion" even when the part was
 * untouched and a new part was made over it.
 *
 *   node tests/draw-no-key-wording.mjs http://127.0.0.1:3013
 */
import { board, checker, J, SCRIBBLE } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013");
const { ribbon, leaf } = b.parts;
await b.load();
const job = await b.draw({ on: ribbon.id, strokes: SCRIBBLE, words: "a wave" });
check("the job is done, not failed", job?.status === "done", J(job && { status: job.status }));
check("…and it does not say the part took the drawing's proportion", !/the part took the drawing's proportion/.test(job?.note ?? ""), job?.note);
check("…it says the drawing was made as a new part on top, and the part left as it was", /new part on top of/.test(job?.note ?? "") && /was left as it was/.test(job?.note ?? ""), job?.note);
await b.load();
const own = await b.draw({ on: leaf.id, strokes: SCRIBBLE, words: "reshape this" });
check("a part the words asked to reshape is named as the one that took the proportion", own?.status === "done" && new RegExp(`${leaf.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} took the drawing's proportion`).test(own?.note ?? ""), own?.note);
await b.browser.close();
done();
