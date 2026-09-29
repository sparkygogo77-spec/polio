#!/usr/bin/env node
/**
 * ONE DRAWING IS ONE UNDO STEP, AND LATER TRACING CANNOT UNDO THE UNDO.
 *
 * The audit (A6): a drawing wrote its part two or three times, each its own
 * checkpoint, so a cube took two presses to take back; and the traced body,
 * arriving seconds later, wrote onto the board after an undo — a write that
 * took a checkpoint of its own and threw the redo away.
 *
 *   node tests/draw-one-undo.mjs http://127.0.0.1:3013
 */
import { board, checker, shapeOf, J, BOX, SCRIBBLE } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
/* The tracer, stood in and slow: it answers three seconds after it is asked. */
let traced = 0;
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 80 L30 40 L50 60 L70 20 L90 30" stroke="#000" fill="none"/></svg>`;
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013", {
  image: async (r) => { await new Promise((ok) => setTimeout(ok, 3000)); traced++; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kind: "vectorize", cost: 0, model: "stand-in", stripped: [], html: SVG }) }); },
});
const { leaf, ribbon } = b.parts;

/* A single item asked to become a cube: its size, then the cube, then what it does — one step. */
await b.load();
const before = shapeOf(await b.node(leaf.id));
await b.draw({ on: leaf.id, strokes: BOX, words: "make this a cube" });
check("the item became the cube it was asked to be", (await b.node(leaf.id))?.featureId === "cube-3d", J(shapeOf(await b.node(leaf.id))));
await b.undo();
check("one undo puts it back exactly", J(shapeOf(await b.node(leaf.id))) === J(before), `${J(before)} → ${J(shapeOf(await b.node(leaf.id)))}`);

/* A drawing made over the ribbon: one undo takes the new part away. */
await b.load();
const n0 = (await b.nodes()).length;
const job = await b.draw({ on: ribbon.id, strokes: BOX, words: "a 3d cube" });
await b.undo();
check("one undo takes a drawing made over a part away", (await b.nodes()).length === n0 && !(await b.node(job?.madeId)), `${n0} → ${(await b.nodes()).length}`);

/* A new part whose body is still being traced, undone before the tracer answers. */
await b.load();
const m0 = (await b.nodes()).length;
const drawing = b.draw({ at: { x: 700, y: 3000 }, drawn: { w: 300, h: 200 }, strokes: SCRIBBLE, words: "a wave" });
let madeId = null;
for (let i = 0; i < 40 && !madeId; i++) { await b.page.waitForTimeout(150); madeId = (await b.nodes()).length > m0 ? (await b.nodes()).at(-1).id : null; }
check("the new part is on the board while the tracer is still out", !!madeId && traced === 0, `made ${madeId}, traced ${traced}`);
await b.undo();
check("one undo takes it away", !(await b.node(madeId)), String(madeId));
await drawing;
await b.page.waitForTimeout(3500);
check("the tracer answered after the undo", traced >= 1, `${traced} answer(s)`);
check("…and wrote nothing: the part is still gone", !(await b.node(madeId)) && (await b.nodes()).length === m0, `${(await b.nodes()).length} parts, ${m0} before`);
await b.redo();
check("…and redo still brings the drawing back", !!(await b.node(madeId)), String(madeId));
check("no page error", b.errors.length === 0, b.errors.join(" / "));
await b.browser.close();
done();
