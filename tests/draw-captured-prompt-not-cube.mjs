#!/usr/bin/env node
/**
 * A PART'S OWN SAVED DESCRIPTION NEVER ASKS FOR A SHAPE.
 *
 * The audit (docs/audits/drawing-and-import-sequence.md, A1): every part
 * sink captures says "…The box, the words, the colours and the type are the
 * ones measured on the page." That bare "box" was read beside every drawing
 * made on the part, and "box" is how a cube is asked for, so any closed
 * shape drawn on any captured part became a 3D cube with nothing typed —
 * the ticker ribbon cut to 349px on the published page. Only the words
 * typed with the drawing ask for a kind.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/draw-captured-prompt-not-cube.mjs http://127.0.0.1:3013
 */
import { board, checker, shapeOf, J, BOX, CIRCLE } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013");
const { ribbon, strip, title } = b.parts;
check("the capture's parts are there, and their saved description says \"box\"", !!ribbon && !!strip && !!title && /\bbox\b/i.test(ribbon.prompt ?? ""), J({ ribbon: ribbon?.id, strip: strip?.id, title: title?.id }));

for (const [name, part, strokes] of [["a circle on a full-width strip", strip, CIRCLE], ["a box on the ribbon", ribbon, BOX], ["a box on the title", title, BOX]]) {
  await b.load();
  const before = await b.nodes();
  /* A box drawn over a part is asked about ("Is this box a cube?", a032b888): nothing is made until it is answered, and "A flat box" makes no cube. */
  const standing = await b.draw({ on: part.id, strokes, words: "", answer: false });
  const cubesStanding = (await b.nodes()).filter((n) => n.featureId === "cube-3d").length - before.filter((n) => n.featureId === "cube-3d").length;
  check(`${name}, nothing typed: no cube is made before anything is answered`, cubesStanding === 0, `${cubesStanding} new cube(s); job ${J(standing && { status: standing.status, asked: standing.asked })}`);
  await b.load();
  const job = await b.draw({ on: part.id, strokes, words: "", answer: "A flat box" });
  const after = await b.nodes();
  const cubes = after.filter((n) => n.featureId === "cube-3d").length - before.filter((n) => n.featureId === "cube-3d").length;
  check(`${name}, nothing typed: no cube is made`, cubes === 0, `${cubes} new cube(s); job ${J(job && { status: job.status, note: job.note })}`);
  if (strokes === BOX) check(`${name}: it asks whether the box is a cube, rather than making one from the part's saved description`, /Is this box a cube/.test(job?.asked ?? ""), job?.asked ?? "no question");
  check(`…and the part is not a cube`, (await b.node(part.id))?.featureId !== "cube-3d", J(shapeOf(await b.node(part.id))));
}

/* The words typed with the drawing still ask: a box and "a 3d cube" is a cube. */
await b.load();
const before = await b.nodes();
const job = await b.draw({ on: ribbon.id, strokes: BOX, words: "a 3d cube" });
const made = (await b.nodes()).find((n) => n.id === job?.madeId);
check("a box with \"a 3d cube\" typed beside it is still a cube", made?.featureId === "cube-3d", J(shapeOf(made)));
check("…made as a new part, the ribbon as it was", J(shapeOf(await b.node(ribbon.id))) === J(shapeOf(before.find((n) => n.id === ribbon.id))), J(shapeOf(await b.node(ribbon.id))));
check("no page error", b.errors.length === 0, b.errors.join(" / "));
await b.browser.close();
done();
