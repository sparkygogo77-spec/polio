/**
 * A LINE OF A STACKED BLOCK IS NOT ONE SENTENCE WITH WHAT STANDS BESIDE THE BLOCK.
 *
 * mochi.trade's leaderboard: each row is a link laid out as a flex row of
 * rank, picture, a column of two lines (the name, "Freddy", over
 * "$0.00 · no closed trades") and a score ("n/a"). The sweep's sentence join
 * (`reassemble.ts#sentences`) read "Freddy" and "n/a", 12px apart on one
 * band, as one sentence: Freddy was widened 225 → 260 and grew 21 → 30,
 * "n/a" was deleted, and every row of the board moved the page down by 9.
 *
 * A piece inside a block that stacks more than its own line (the column, 39
 * tall against Freddy's 21) is a line of that block, not a line with what
 * stands beside it. A piece inside an inline wrapper its own height ("p >
 * span > em") still joins.
 *
 *   node --experimental-strip-types tests/stack-apart.mjs
 */
import { sentences } from "../src/features/studio/reassemble.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`);
};
const part = (id, featureId, text, sel, x, y, w, h, size = 0.875) => ({ id, pageId: "p0", featureId, x, y, w, h, content: text, font: { face: "Geist", size }, from: { selector: sel } });
const ROW = "body > div > div > main > div > section:nth-of-type(4) > div:nth-of-type(3) > div:nth-of-type(2) > ol > li:nth-of-type(5) > a";
const row = [
  part("col", "box", "", `${ROW} > span:nth-of-type(3)`, 1034, 3575, 225, 39),
  part("name", "prose", "Freddy", `${ROW} > span:nth-of-type(3) > span:nth-of-type(1)`, 1034, 3575, 225, 21),
  part("sub", "prose", "$0.00 · no closed trades", `${ROW} > span:nth-of-type(3) > span:nth-of-type(2)`, 1034, 3596, 225, 18, 0.75),
  part("score", "prose", "n/a", `${ROW} > span:nth-of-type(4)`, 1271, 3584, 23, 21),
];
const joined = (list) => sentences(list).filter((r) => r.drop.length);

const a = joined(row);
check("a leaderboard name, a line of its two-line column, is not joined to the score beside the column", a.length === 0, JSON.stringify(a.map((r) => [r.keep, r.drop, r.w])));

/* Controls: sentences the capture read in pieces are still put back. */
const P = "body > main > p";
const nested = [
  part("n0", "box", "", `${P} > span:nth-of-type(2)`, 352, 500, 70, 20, 1),
  part("n1", "prose", "hold $gotchi, hatch a", `${P} > span:nth-of-type(1)`, 200, 500, 150, 20, 1),
  part("n2", "prose", "pixel pet", `${P} > span:nth-of-type(2) > em`, 352, 500, 70, 20, 1),
];
check("control: words and an emphasised word in an inline wrapper its own height are still one sentence", joined(nested).length === 1, JSON.stringify(joined(nested)));
const H = "body > header > a > h1";
const sol = [part("s1", "prose", "A Sol", `${H} > span:nth-of-type(1)`, 100, 20, 40, 26, 1), part("s2", "prose", "Works", `${H} > span:nth-of-type(2)`, 140, 20, 48, 26, 1)];
check("control: \"A Sol\" + \"Works\" are still one sentence", joined(sol).length === 1, JSON.stringify(joined(sol)));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
