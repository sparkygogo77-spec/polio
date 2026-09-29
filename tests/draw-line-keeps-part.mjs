#!/usr/bin/env node
/**
 * A STRAIGHT LINE DRAWN ON A PART NEVER DELETES IT.
 *
 * The audit (A2): underlining trumpmorty.fun's hero title removed the title
 * and put an arrow between two of its neighbours — the "connector" reading
 * of a straight line replaced the part it was drawn on. A line on a part is
 * a line put on top; the part stays, whatever words are typed with it.
 *
 *   node tests/draw-line-keeps-part.mjs http://127.0.0.1:3013
 */
import { board, checker, shapeOf, J, LINE } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013");
const { title, leaf, ribbon } = b.parts;
for (const [name, part, words] of [["the title, underlined", title, ""], ["another single item, struck through", leaf, ""], ["the ribbon, with words asking to change it", ribbon, "make this a line"]]) {
  await b.load();
  const before = shapeOf(await b.node(part.id));
  const n0 = (await b.nodes()).length, s0 = (await b.shapes()).length;
  const job = await b.draw({ on: part.id, strokes: LINE, words });
  const after = shapeOf(await b.node(part.id));
  const n1 = (await b.nodes()).length, s1 = (await b.shapes()).length;
  check(`${name}: the part is still there`, !!after, `${part.id} ${after ? "kept" : "deleted"}`);
  check(`…exactly as it was`, J(after) === J(before), `${J(before)} → ${J(after)}`);
  check(`…and the line landed on top, as a part or a line`, n1 + s1 === n0 + s0 + 1, `parts ${n0}→${n1}, lines ${s0}→${s1}; ${J(job && { status: job.status, madeId: job.madeId })}`);
}
check("no page error", b.errors.length === 0, b.errors.join(" / "));
await b.browser.close();
done();
