/**
 * WORDS IN DIFFERENT CARDS OF ONE ROW ARE DIFFERENT CARDS' WORDS.
 *
 * gotchi.gg's "pick your starter": nine cards, each a `button` holding its
 * own description (`button:nth-of-type(1) > p`, `button:nth-of-type(2) > p`,
 * …), three to a row; and under the detail panel's stage pictures, one
 * `figure > figcaption > b` label each ("baby", "child", "teen"…). The
 * sweep's sentence join (`reassemble.ts#sentences`) read each row as one
 * sentence in pieces: the first card's description was widened across the
 * row, 150 → 515px, and the others deleted, so it ran under its neighbours;
 * the five labels became one line, "baby child teen dango scorch".
 *
 * Two pieces each inside their own copy of a repeated element (the same tag,
 * a different place among its siblings) are items in a row, never one
 * sentence. Pieces that ARE the siblings (`h1 > span:nth-of-type(1)` and
 * `span:nth-of-type(2)`: "A Sol" + "Works") still join.
 *
 *   node --experimental-strip-types tests/items-apart.mjs
 */
import { sentences } from "../src/features/studio/reassemble.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`);
};
const p = (id, text, sel, x, w, y = 2001, h = 35, size = 0.8125) => ({ id, pageId: "p0", featureId: "prose", x, y, w, h, content: text, font: { face: "M PLUS Rounded 1c", size }, from: { selector: sel } });
const GRID = "body > main > div > section:nth-of-type(3) > div > div:nth-of-type(1)";
const cards = [
  p("mochi", "a rice cake blob. squishes when you pat it.", `${GRID} > button:nth-of-type(1) > p`, 155, 150, 2001, 52),
  p("pup", "a small dog. waits by the screen for you.", `${GRID} > button:nth-of-type(2) > p`, 337, 151),
  p("kit", "a cat. likes you on its own schedule.", `${GRID} > button:nth-of-type(3) > p`, 520, 150),
];
const FIGS = "body > main > div > section:nth-of-type(3) > div > div:nth-of-type(2) > div:nth-of-type(2)";
const labels = ["baby", "child", "teen", "dango", "scorch"].map((w, i) => p(`l${i}`, w, `${FIGS} > figure:nth-of-type(${i + 1}) > figcaption > b`, 728 + 111 * i, 101, 2088, 17, 0.9375));
const joined = (list) => sentences(list).filter((r) => r.drop.length);

const a = joined(cards);
check("three starter cards' descriptions, side by side in one row, are not joined", a.length === 0, JSON.stringify(a.map((r) => [r.keep, r.drop, r.w])));
const b = joined(labels);
check("five stage labels, one under each picture, are not joined into one line", b.length === 0, JSON.stringify(b.map((r) => [r.keep, r.drop, r.w])));

/* Controls: a sentence the capture read in pieces is still put back. */
const H = "body > header > a > h1";
const sol = [p("s1", "A Sol", `${H} > span:nth-of-type(1)`, 100, 40, 20, 26, 1), p("s2", "Works", `${H} > span:nth-of-type(2)`, 140, 48, 20, 26, 1), p("s3", " project", `${H} > span:nth-of-type(3)`, 188, 60, 20, 26, 1)];
const c = joined(sol);
check("control: \"A Sol\" + \"Works\" + \" project\", sibling pieces of one heading, are still one sentence", c.length === 1 && c[0].drop.length === 2, JSON.stringify(c));
const P = "body > main > p";
const run = [p("r1", "hold $gotchi, hatch a", `${P} > span:nth-of-type(1)`, 200, 150, 500, 20, 1), p("r2", "pixel pet", `${P} > b`, 352, 70, 500, 20, 1)];
check("control: words and a bold word inside one paragraph are still one sentence", joined(run).length === 1, JSON.stringify(joined(run)));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
