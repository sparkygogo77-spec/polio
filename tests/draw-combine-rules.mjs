#!/usr/bin/env node
/**
 * JOIN, CUT, WORDS ALONG A PATH, AND WHERE A DRAWN BUTTON MAY LEAD: the
 * rules, without a browser.
 *
 *   · two drawn shapes joined are one outline round everything either
 *     covered; apart, they stay two pieces of one shape;
 *   · one cut out of another leaves the rest, with a hole where the cut
 *     was wholly inside, and a point in the hole is outside the shape;
 *     a cut that takes everything leaves nothing, and says so (null);
 *   · the result keeps the first shape's kit, colour, lighting bar and
 *     motion, and its outline is drawn even-odd, ring by ring;
 *   · an open line becomes a line for words, in a box with room for the
 *     letters; a stroke too short for words is not one; words are sized
 *     to fit the line unless a size was picked;
 *   · a link's answer comes with its reason, in plain words: pump.fun is
 *     allowed; DEX Screener (dexscreener.com) is allowed except a page of
 *     one specific contract address; X (x.com, and twitter.com) profiles
 *     are refused; a page of the site is always allowed; an address no rule
 *     names is refused, and the reason says where the list is.
 *
 *   node --experimental-strip-types tests/draw-combine-rules.mjs
 */
import { combine, guideLength, insideOutline, lineFromStroke, pathWordsSize, piecesOf, wornPath, wordsGuide } from "../src/features/studio/wornShape.ts";
import { DEFAULT_OFFSITE, explainLink, linkAllowed, offsiteRules } from "../src/features/studio/shelf/parts/offsite.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const kit = { id: "k", name: "Test kit", role: "button", radius: 10, shadows: [{ dx: 0, dy: 8, blur: 0, spread: 0, colour: "rgb(0, 0, 0)" }], size: { w: 120, h: 40 }, fill: { kind: "solid", colour: "rgb(240, 200, 60)" }, border: { width: 2, style: "solid", colour: "rgb(20, 10, 10)" }, text: { px: 18, colour: "rgb(20, 10, 10)" }, swatches: [] };
const bar = { kind: "inset", dx: 0, dy: 6, blur: 0, size: 6, colour: "rgb(255, 255, 255)", opacity: 0.4 };
const base = (pts, smooth) => ({ pts, smooth, snap: null, raw: null, kit, fill: "rgb(10, 120, 200)", bar, motion: { id: "m", name: "Float", frames: [], duration: 1000, timing: "ease", speed: 1, strength: 1, size: { w: 10, h: 10 } }, hover: true, press: true, what: "button" });
const square = (x, y, w, h) => ({ worn: base([[0, 0], [1, 0], [1, 1], [0, 1]], false), box: { x, y, w, h } });
const circle = (cx, cy, r) => ({ worn: base(Array.from({ length: 24 }, (_, i) => [0.5 + 0.5 * Math.cos((i / 24) * Math.PI * 2), 0.5 + 0.5 * Math.sin((i / 24) * Math.PI * 2)]), true), box: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 } });

/* ------------------------------------------------------------ join */
const j = combine(square(0, 0, 100, 100), circle(110, 50, 40), "join");
check("joined: one piece round both", !!j && piecesOf(j.worn).pieces === 1 && piecesOf(j.worn).holes === 0, J(j && piecesOf(j.worn)));
check("…its box runs from the square's left to the circle's right", j?.box.x === 0 && j.box.w === 150 && j.box.h === 100, J(j?.box));
check("…a point in each of the two is inside it, and one past both is not", !!j && insideOutline(j.worn, j.box, [20, 20]) && insideOutline(j.worn, j.box, [140, 50]) && !insideOutline(j.worn, j.box, [140, 5]));
check("…it keeps the first one's kit, colour, lighting bar and motion", j?.worn.kit === kit && j.worn.fill === "rgb(10, 120, 200)" && j.worn.bar === bar && j.worn.motion?.id === "m");
check("…and its outline is the new edge, ring by ring, no longer a smooth line", !!j && j.worn.poly?.length === 1 && j.worn.smooth === false && wornPath(j.worn, 150, 100).startsWith("M") && (wornPath(j.worn, 150, 100).match(/Z/g) ?? []).length === 1);
const apart = combine(square(0, 0, 50, 50), square(200, 0, 50, 50), "join");
check("joined apart, they are two pieces of one shape", piecesOf(apart?.worn ?? {}).pieces === 2 && (wornPath(apart.worn, apart.box.w, apart.box.h).match(/Z/g) ?? []).length === 2, J(apart && piecesOf(apart.worn)));

/* ------------------------------------------------------------ cut */
const c = combine(square(0, 0, 200, 160), circle(100, 80, 40), "cut");
check("cut from the middle: one piece with a hole", piecesOf(c?.worn ?? {}).pieces === 1 && piecesOf(c.worn).holes === 1, J(c && piecesOf(c.worn)));
check("…the hole is outside the shape, the frame round it inside", !!c && !insideOutline(c.worn, c.box, [100, 80]) && insideOutline(c.worn, c.box, [20, 20]) && insideOutline(c.worn, c.box, [100, 20]));
check("…drawn as two rings, so even-odd makes the hole", (wornPath(c.worn, c.box.w, c.box.h).match(/Z/g) ?? []).length === 2);
const bite = combine(square(0, 0, 200, 100), circle(200, 50, 60), "cut");
check("a cut across an edge takes a bite, no hole", piecesOf(bite?.worn ?? {}).holes === 0 && bite.box.w < 200 && !insideOutline(bite.worn, bite.box, [180, 50]) && insideOutline(bite.worn, bite.box, [20, 50]), J(bite?.box));
check("a cut that covers everything leaves nothing", combine(square(20, 20, 40, 40), square(0, 0, 100, 100), "cut") === null);

/* ------------------------------------------------------------ words along a path */
const wave = Array.from({ length: 40 }, (_, i) => [100 + i * 10, 300 + Math.sin(i / 5) * 40]);
const line = lineFromStroke(wave);
check("an open line becomes a line for words, in a box with room for the letters", !!line && line.box.x < 100 && line.box.y < 260 && line.box.w > 390 && line.pts.length >= 2, J(line?.box));
check("a stroke too short for words is not one", lineFromStroke([[0, 0], [10, 2], [20, 0]]) === null);
const pw = { ...base(line.pts, true), open: true, what: "path", pathWords: { size: null, font: null, start: 0, flip: false } };
const guide = wordsGuide(pw, line.box.w, line.box.h);
check("the words' line is open (it does not come back to its start)", /^M/.test(guide) && !/Z\s*$/.test(guide));
check("…and the shape draws no outline round it (its path is the open line)", !/Z/.test(wornPath(pw, line.box.w, line.box.h)));
const len = guideLength(pw, line.box.w, line.box.h);
check("its length is the line's", len > 390 && len < 600, `${Math.round(len)}px`);
check("words are sized to fit the line", pathWordsSize(pw, line.box.w, line.box.h, "A".repeat(80)) < pathWordsSize(pw, line.box.w, line.box.h, "Short"), `${pathWordsSize(pw, line.box.w, line.box.h, "A".repeat(80))} < ${pathWordsSize(pw, line.box.w, line.box.h, "Short")}`);
check("…unless a size was picked", pathWordsSize({ ...pw, pathWords: { ...pw.pathWords, size: 40 } }, line.box.w, line.box.h, "A".repeat(80)) === 40);
const flipped = wordsGuide({ ...pw, pathWords: { ...pw.pathWords, flip: true } }, line.box.w, line.box.h);
check("run the other way, the line starts at its other end", flipped !== guide && flipped.split(" ").slice(0, 2).join(" ") !== guide.split(" ").slice(0, 2).join(" "));
const round = { ...base(Array.from({ length: 24 }, (_, i) => [0.5 + 0.5 * Math.cos((i / 24) * Math.PI * 2), 0.5 + 0.5 * Math.sin((i / 24) * Math.PI * 2)]), true), what: "path" };
check("on a closed shape the words run round its outline", /Z\s*$/.test(wordsGuide(round, 200, 200)));

/* ------------------------------------------------------------ where a button may lead */
const rules = offsiteRules(DEFAULT_OFFSITE);
const says = (href) => explainLink(href, rules);
const cases = [
  ["https://pump.fun/coin/STANDIN_MINT", true, /pump\.fun is on the site's list/],
  ["https://dexscreener.com/", true, /dexscreener\.com is on the site's list/],
  ["https://dexscreener.com/solana/STANDIN_PAIR", false, /one specific contract address/],
  ["https://x.com/STANDIN_PROFILE", false, /refuses links to x\.com, including profiles/],
  ["https://twitter.com/STANDIN_PROFILE", false, /twitter\.com/],
  ["https://example.org/", false, /not on the site's list.*Format, Pages and navigation/],
  ["/about", true, /A page of this site/],
  ["javascript:alert(1)", false, /web addresses/],
];
for (const [href, ok, why] of cases) {
  const s = says(href);
  check(`${href}: ${ok ? "allowed" : "refused"}, and says why`, s.allowed === ok && why.test(s.why) && s.allowed === linkAllowed(href, rules), J(s));
}
check("every reason is plain words, no rule syntax shown", cases.every(([h]) => !/[!*]/.test(says(h).why)), J(cases.map(([h]) => says(h).why)));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
