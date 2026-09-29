#!/usr/bin/env node
/**
 * THE READER WITH A KEY FOLLOWS THE SAME RULE.
 *
 * The audit (A4): with a Claude key, the reader's answer was applied to the
 * part the drawing was made on, so a scribble and "a price chart" on the
 * contract address turned the address into a 420 × 260 chart. The reader is
 * stood in here with that very answer. It lands as a new part; only words
 * asking for this part to change let it change the part.
 *
 *   node tests/draw-reader-keeps-kind.mjs http://127.0.0.1:3013
 */
import { board, checker, shapeOf, J, SCRIBBLE } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
const asked = [];
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013", {
  reader: (body) => { asked.push(body.node ? body.node.label : null); return { ok: true, patch: { featureId: "charts", label: "Price chart", w: 420, h: 260, note: "a chart (stood in)" }, usage: { model: "stand-in", input: 1, output: 1 } }; },
});
const { leaf } = b.parts;
await b.load();
const before = shapeOf(await b.node(leaf.id));
const job = await b.draw({ on: leaf.id, strokes: SCRIBBLE, words: "a price chart" });
check("the reader was asked, about a new part rather than the address", asked.length === 1 && asked[0] === null, J(asked));
check("the part the drawing was made on is exactly as it was", J(shapeOf(await b.node(leaf.id))) === J(before), `${J(before)} → ${J(shapeOf(await b.node(leaf.id)))}`);
const made = await b.node(job?.madeId);
check("…and the chart is a new part", !!made && made.id !== leaf.id && made.featureId === "charts", J(shapeOf(made)));

await b.load();
const again = await b.draw({ on: leaf.id, strokes: SCRIBBLE, words: "turn this into a price chart" });
check("\"turn this into a price chart\" changes that part, as asked", again?.madeId === leaf.id && (await b.node(leaf.id))?.featureId === "charts", J(shapeOf(await b.node(leaf.id))));
check("no page error", b.errors.length === 0, b.errors.join(" / "));
await b.browser.close();
done();
