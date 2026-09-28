/**
 * A PART THAT RUNS OFF SIDEWAYS IS OVERFLOW, AND SIZES NOTHING THAT HOLDS IT.
 *
 * The sweep grows a wrapper to hold what it owns (`owns.ts#grownTo`). Every
 * fault that rule was built on escaped UP or DOWN (his banner's logo, his
 * Your Tokens panel), and across his nine pages its sideways growth is 1px of
 * rounding. On the two sites captured since, sideways escape is the other
 * thing: content the page CLIPPED or SCROLLED, which the capture does not
 * record as such.
 *
 *   · share.xyz: each league row is a carousel 916 wide holding six 350px
 *     cards, three past its right edge. Grown to hold them, every row, every
 *     section and the main column became 2192 wide, and the published page
 *     drew the cards across the sidebar (101 boxes grown sideways).
 *   · trumpmorty.fun: the ticker ribbon is 1586 wide round a 5657px marquee
 *     track, turned 2.5°. Grown to hold the track's turned box, the ribbon
 *     went to x -1255, 5657 wide, and 122px up the page into the hero.
 *
 * So a part that reaches more than 8px past its wrapper's left or right edge,
 * level with it, is out of the flow for this purpose, as a positioned one
 * already is: the wrapper keeps the box the page gave it, on every side. A
 * part wholly below it (his split link, wrapped onto the next line) is not.
 *
 *   node tests/owns-sideways.mjs
 */
import { grown, grownTo } from "../src/features/studio/owns.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const n = (id, sel, x, y, w, h) => ({ id, pageId: "p0", featureId: "box", x, y, w, h, content: "", from: { url: "u", host: "h", selector: sel, at: 1 } });

/* share.xyz's NFL row, at its measured geometry. */
const M = "body > div > main";
const share = [
  n("main", M, 76, 419, 892, 5950),
  n("section", `${M} > section`, 64, 443, 916, 238),
  n("row", `${M} > section > div`, 64, 443, 916, 238),
  ...[76, 442, 808, 1174, 1540, 1906].map((x, i) => n(`card${i}`, `${M} > section > div > article:nth-of-type(${i + 1})`, x + 12, 491, 350, 178)),
];
const rowGrown = grown(share, share[2]);
check("a carousel row keeps its width: the cards past its edge were scrolled out of sight, not adrift",
  rowGrown === null, JSON.stringify(rowGrown));
const g = grownTo(share);
check("…and nothing above it grows sideways on their account: not the section, not the main column",
  g.every((x) => x.x === x.was.x && x.w === x.was.w), JSON.stringify(g.map((x) => [x.id, x.was.w, x.w])));
check("…the main column stays 892 wide, which is what keeps it off share.xyz's sidebar",
  !g.some((x) => x.id === "main" && x.w !== 892));

/* trumpmorty.fun's ticker ribbon. */
const R = "body > main > div > div:nth-of-type(1)";
const trump = [n("ribbon", R, -73, 823, 1586, 141), n("track", `${R} > div`, -1255, 701, 5657, 311)];
check("a ribbon round a marquee track stays where it was: not lifted, not widened",
  grown(trump, trump[0]) === null, JSON.stringify(grown(trump, trump[0])));

/* Controls: what the grow step is for still happens. */
const H = "body > div > header";
const header = [n("banner", H, 0, 0, 1763, 82), n("logo", `${H} > a > img`, 700, -11, 112, 112)];
const up = grown(header, header[0]);
check("control: a logo escaping above its banner still grows the banner up (his fault, unchanged)",
  !!up && up.y === -11 && up.h === 112 && up.w === 1763, JSON.stringify(up));
const W = "body > div > header > div";
const chip = [n("wrap", W, 1032, 16, 489, 49), n("kid", `${W} > button`, 1040, 16, 482, 49)];
const r1 = grown(chip, chip[0]);
check("control: a part a pixel past its wrapper's side (rounding) still counts, as on his nine pages",
  !!r1 && r1.w === 490, JSON.stringify(r1));
const tilt = [n("sticker", "body > div", 100, 156, 635, 578), n("tag", "body > div > span", 92, 150, 270, 109)];
const r2 = grown(tilt, tilt[0]);
check("control: a turned sticker 8px past its box's side still counts",
  !!r2 && r2.x === 92 && r2.y === 150, JSON.stringify(r2));
const P = "body > div > main > p";
const split = [n("sent", P, 40, 3600, 700, 30), n("link", `${P} > a`, 743, 3635, 80, 20)];
const r3 = grown(split, split[0]);
check("control: his split link, wrapped onto the line below and past the sentence's right edge, still grows the sentence down",
  !!r3 && r3.h === 55, JSON.stringify(r3));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
