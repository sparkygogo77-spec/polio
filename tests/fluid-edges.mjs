/**
 * A NARROW GRID COLUMN KEEPS ITS WIDTH; A BOX AGAINST A BORDER IS AGAINST THE EDGE.
 *
 * parasiteonsol.fun's hero is a grid of two columns, an 82px sidebar
 * ("SLIDE NO.", "SPECIMEN", "STAIN", "MAG") beside the stage, and the stat
 * bar under it is a flex row whose last box (the contract address, CA) is
 * pushed to the right, 3px from the bar's right edge, which is its border.
 * At 2000 wide the export gave each grid column half of the extra width, so
 * the sidebar's words slid 140px right, behind the stage; and it kept the CA
 * where it stood at 1440, mid-bar. Now a grid's columns are read off where
 * its children stand (the widest take the growth, a narrow one keeps its
 * width), and a box's border is part of its inner edge. STANDIN geometry,
 * shaped like the capture.
 *
 *   node --experimental-strip-types tests/fluid-edges.mjs
 */
import { fluidParts, css } from "../src/features/studio/fluidSite.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`);
};
const W = 1425, D = 575;
const S = "body > main > section:nth-of-type(1)";
const parts = [
  { id: "hero", x: 0, y: 64, w: 1425, h: 840, selector: S, pad: { left: 28, right: 28 } },
  { id: "frame", x: 28, y: 82, w: 1369, h: 732, selector: `${S} > div:nth-of-type(1)`, layout: { display: "grid", direction: "row", columns: 2 }, pad: { left: 10, right: 10 }, edge: 3 },
  { id: "side", x: 41, y: 95, w: 82, h: 706, selector: `${S} > div:nth-of-type(1) > div:nth-of-type(1)`, layout: { display: "flex", direction: "column", gap: 3 }, pad: { left: 10, right: 10 }, edge: 2 },
  { id: "slide", x: 53, y: 111, w: 58, h: 44, selector: `${S} > div:nth-of-type(1) > div:nth-of-type(1) > span:nth-of-type(1)` },
  { id: "stage", x: 133, y: 95, w: 1251, h: 706, selector: `${S} > div:nth-of-type(1) > div:nth-of-type(2)`, edge: 2 },
  { id: "canvas", x: 135, y: 97, w: 1247, h: 702, selector: `${S} > div:nth-of-type(1) > div:nth-of-type(2) > canvas` },
  { id: "bar", x: 28, y: 826, w: 1369, h: 78, selector: `${S} > div:nth-of-type(2)`, layout: { display: "flex", direction: "row", gap: 0 }, edge: 3 },
  { id: "hosts", x: 31, y: 829, w: 74, h: 72, selector: `${S} > div:nth-of-type(2) > span:nth-of-type(1)` },
  { id: "chain", x: 685, y: 829, w: 177, h: 72, selector: `${S} > div:nth-of-type(2) > span:nth-of-type(6)` },
  { id: "ca", x: 1260, y: 829, w: 134, h: 72, selector: `${S} > div:nth-of-type(2) > span:nth-of-type(7)` },
  { id: "caWords", x: 1278, y: 839, w: 98, h: 10, selector: `${S} > div:nth-of-type(2) > span:nth-of-type(7) > b` },
];
const k = fluidParts(parts, W);
/* Where a part's left edge and width land D past the capture's width. */
const at = (id) => { const f = k.get(id); const v = (l) => (l.css ? NaN : l.c + l.k * D); return { left: v(f.left), width: v(f.width), css: css(f.left, W) }; };
const side = at("side"), slide = at("slide"), stage = at("stage"), canvas = at("canvas");
check("the narrow grid column (the sidebar) keeps its place and width", side.left === 41 && side.width === 82, JSON.stringify(side));
check("…and its words stay in it", slide.left === 53, JSON.stringify(slide));
check("the wide column (the stage) takes all the growth, and what it holds with it", stage.left === 133 && stage.width === 1251 + D && canvas.width === 1247 + D, JSON.stringify({ stage, canvas }));
const ca = at("ca"), caWords = at("caWords"), chain = at("chain"), hosts = at("hosts");
check("the box against the bar's right border (the CA) moves with the right edge", ca.left === 1260 + D && caWords.left === 1278 + D, JSON.stringify({ ca, caWords }));
check("…while the boxes packed from the left stay at the left", hosts.left === 31 && chain.left === 685, JSON.stringify({ hosts, chain }));
{
  /* Control: a grid of equal columns still shares the growth evenly. */
  const even = fluidParts([
    { id: "g", x: 0, y: 0, w: 1200, h: 100, selector: "body > div", layout: { display: "grid", columns: 3 } },
    { id: "a", x: 0, y: 0, w: 400, h: 100, selector: "body > div > div:nth-of-type(1)" },
    { id: "b", x: 400, y: 0, w: 400, h: 100, selector: "body > div > div:nth-of-type(2)" },
    { id: "c", x: 800, y: 0, w: 400, h: 100, selector: "body > div > div:nth-of-type(3)" },
  ], 1200);
  const b = even.get("b");
  check("control: equal columns share the growth evenly", Math.abs(b.left.k - 1 / 3) < 1e-9 && Math.abs(b.width.k - 1 / 3) < 1e-9, JSON.stringify(b));
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
