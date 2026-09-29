#!/usr/bin/env node
/**
 * A DRAWING ON ANY PART IS MADE OVER IT.
 *
 * The audit (A3, A10): a9d4474 held the hero, and only parts that wholly
 * hold another. A ribbon whose words run past its edges, a full-width strip,
 * the title, a button, the contract address and a container placed by hand
 * were all still resized, moved or re-kinded by a drawing made on them. Now
 * every part keeps its size, place, kind and words, and the drawing lands
 * as a new part at the drawing — unless the words typed with it ask for
 * this part to change. The redirected part is not written a drawing either.
 *
 *   node tests/draw-on-captured-part.mjs http://127.0.0.1:3013
 */
import { board, checker, shapeOf, J, BOX, CIRCLE, SCRIBBLE } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013");
const { ribbon, strip, title, leaf } = b.parts;

/* A container placed by hand: a box with two parts inside, not captured. */
const placed = async () => b.page.evaluate(() => {
  const d = window.__studioPublishDoc();
  const page = d.pages[0].id;
  const box = { ...d.nodes[0], id: "n_placed_box", pageId: page, featureId: "box", from: null, prompt: "", content: "", x: 200, y: 6200, w: 900, h: 400, sketch: null, kind: null, shape: null, outline: null };
  const a = { ...box, id: "n_placed_a", featureId: "prose", content: "One", x: 260, y: 6260, w: 300, h: 80 };
  const c = { ...box, id: "n_placed_c", featureId: "prose", content: "Two", x: 640, y: 6260, w: 300, h: 80 };
  window.__studioLoadDoc({ ...d, nodes: [...d.nodes, box, a, c] });
  return "n_placed_box";
});

const cases = [
  ["the full-width ribbon", ribbon, BOX, ""],
  ["a full-width strip", strip, CIRCLE, ""],
  ["the title", title, SCRIBBLE, ""],
  ["another single item", leaf, BOX, "a 3d cube"],
  ["the title, with words naming something new", title, SCRIBBLE, "a price chart"],
];
for (const [name, part, strokes, words] of cases) {
  await b.load();
  const before = shapeOf(await b.node(part.id));
  const n0 = (await b.nodes()).length;
  const job = await b.draw({ on: part.id, strokes, words });
  const after = shapeOf(await b.node(part.id));
  const n1 = (await b.nodes()).length;
  check(`${name}${words ? ` ("${words}")` : ""}: size, place, kind and words unchanged`, J(after) === J(before), `${J(before)} → ${J(after)}`);
  check(`…and the drawing is a new part`, n1 === n0 + 1 && !!job?.madeId && job.madeId !== part.id, `${n0} → ${n1}, made ${job?.madeId}`);
}

await b.load();
const id = await placed();
await b.page.waitForTimeout(800);
const before = shapeOf(await b.node(id));
const job = await b.draw({ on: id, strokes: BOX, words: "" });
check("a container placed by hand keeps its size, place and kind", J(shapeOf(await b.node(id))) === J(before), `${J(before)} → ${J(shapeOf(await b.node(id)))}`);
check("…and the drawing is a new part", !!job?.madeId && job.madeId !== id, String(job?.madeId));

/* Words that ask for this part to change still change it. */
await b.load();
const asked = await b.draw({ on: leaf.id, strokes: BOX, words: "make this a cube" });
const changed = await b.node(leaf.id);
check("\"make this a cube\" on a single item changes that item", changed?.featureId === "cube-3d" && asked?.madeId === leaf.id, J(shapeOf(changed)));
check("no page error", b.errors.length === 0, b.errors.join(" / "));
await b.browser.close();
done();
