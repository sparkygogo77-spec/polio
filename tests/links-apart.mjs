/**
 * LINKS SIDE BY SIDE ARE A ROW OF LINKS, NOT A SENTENCE IN PIECES; HEADINGS
 * IN DIFFERENT CARDS ARE DIFFERENT TITLES; A PILL ON ITS OWN GROUND IS ITS OWN.
 *
 * The sweep joins words that sit on one line close together (`reassemble.ts
 * #sentences`), which puts back a sentence the capture read in pieces. On the
 * two sites captured since, the pieces it joined were menus:
 *
 *   · trumpmorty.fun's nav pill, four links (Lore, How to buy, Chart,
 *     Roadmap), each `nav > a` with 16px of its own padding a side, became
 *     one run of underlined words with single spaces, jammed at the pill's
 *     left;
 *   · share.xyz's category row, fourteen tabs (`nav > div > a > span`),
 *     became one 1077px run: the gaps and the grey of the tabs not chosen gone.
 *
 * Each piece was read from an anchor of its own. Pieces inside DIFFERENT
 * anchors are separate controls and are never joined; a sentence with one
 * link inside it, or one link read in pieces, still is.
 *
 *   node tests/links-apart.mjs
 */
import { sentences } from "../src/features/studio/reassemble.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const p = (id, text, sel, x, w, extra = {}) => ({ id, pageId: "p0", featureId: "prose", x, y: 23, w, h: 38, content: text, from: { selector: sel }, ...extra });
const link = { kind: "page", target: "page_home" };

const nav = [
  p("lore", "Lore", "body > header > nav > a:nth-of-type(1)", 541, 63, { link }),
  p("buy", "How to buy", "body > header > nav > a:nth-of-type(2)", 610, 108, { link }),
  p("chart", "Chart", "body > header > nav > a:nth-of-type(3)", 724, 70, { link }),
  p("road", "Roadmap", "body > header > nav > a:nth-of-type(4)", 800, 95, { link }),
];
const j1 = sentences(nav);
check("trumpmorty.fun's four nav links stay four links", j1.length === 0, JSON.stringify(j1.map((r) => [r.keep, ...r.drop])));

const T = "body > div > div > nav > div";
const tabs = ["Trending", "Sports", "Politics", "Crypto"].map((t, i) => ({ ...p(`t${i}`, t, `${T} > a:nth-of-type(${i + 1}) > span`, 60 + i * 80, 68), y: 83, h: 20 }));
const j2 = sentences(tabs);
check("share.xyz's category tabs stay separate tabs", j2.length === 0, JSON.stringify(j2.map((r) => [r.keep, ...r.drop])));

/*
 * AND HEADINGS IN DIFFERENT CARDS. trumpmorty.fun's roadmap: card 3's title
 * "The Graduation" and card 4's "Renewed for S2", each an `article > h3`,
 * stand on one line 73px apart; joined, card 3's title ran over card 4 and
 * card 4 lost its own. Pieces in different headings are never joined.
 */
const E = "body > main > section:nth-of-type(5) > div > div:nth-of-type(2)";
const titles = [
  { ...p("t3", "The Graduation", `${E} > article:nth-of-type(3) > h3`, 756, 229), y: 4174, h: 66, featureId: "value-prop" },
  { ...p("t4", "Renewed for S2", `${E} > article:nth-of-type(4) > h3`, 1058, 229), y: 4199, h: 64, featureId: "value-prop" },
];
const j5 = sentences(titles);
check("trumpmorty.fun's two roadmap titles, in different cards, stay two titles", j5.length === 0, JSON.stringify(j5.map((r) => [r.keep, ...r.drop])));

/*
 * AND PILLS SET APART. Sink now captures trumpmorty.fun's CA button as three
 * parts: "CA" on navy (Luckiest Guy, padded), the address (VT323), "COPY" on
 * yellow (Luckiest Guy, padded). They touch on one line and were joined back
 * into one run, the three grounds gone. A piece that paints a ground of its
 * own (a fill, padding or an edge), or is set in another face or size, is not
 * a word in someone else's sentence; share.xyz's "Save 71×" badge beside
 * each match title and its Unified / Polymarket / Hyperliquid tabs were
 * joined the same way. A colour alone still joins ("A SolWorks project").
 */
const B = "body > main > section:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(1) > button";
const ca = [
  p("ca", "CA", `${B} > span:nth-of-type(1)`, 104, 51, { y: 681, h: 49, colour: { bg: "rgb(41, 47, 68)", text: "rgb(243, 212, 64)" }, pad: { top: 12, right: 14, bottom: 8, left: 14 }, font: { face: "Luckiest Guy", size: 1.25 } }),
  p("addr", "AezYBzTYAUw5gFN8vyzt6H9hL7gMvMv14n4VbYrqpump", `${B} > span:nth-of-type(2)`, 155, 415, { y: 682, h: 48, colour: { text: "rgb(26, 15, 11)" }, font: { face: "VT323", size: 1.38 } }),
  p("copy", "COPY", `${B} > span:nth-of-type(3)`, 570, 78, { y: 681, h: 49, colour: { bg: "rgb(243, 212, 64)", text: "rgb(26, 15, 11)" }, pad: { top: 12, right: 16, bottom: 8, left: 20 }, font: { face: "Luckiest Guy", size: 1.13 } }),
];
const j6 = sentences(ca);
check("trumpmorty.fun's CA pill stays three parts, each on its own ground", j6.length === 0, JSON.stringify(j6.map((r) => [r.keep, ...r.drop])));
const M = "body > main > article > div > div > a";
const badge = [
  p("title", "Eagles vs Bears", `${M} > h3 > span:nth-of-type(1)`, 60, 150, { font: { face: "interLatin", size: 1.01 } }),
  p("save", "Save 71×", `${M} > span`, 214, 70, { colour: { bg: "rgb(150, 240, 220)", text: "rgb(7, 39, 35)" }, pad: { left: 6, right: 6 }, font: { face: "interLatin", size: 0.75 } }),
];
check("share.xyz's \"Save 71×\" badge is not joined to the match title", sentences(badge).length === 0);
const sizes = [p("s0", "0", `${M} > div > span:nth-of-type(1)`, 60, 12, { font: { size: 1.6 } }), p("s1", "Map 1 of 3", `${M} > div > span:nth-of-type(2)`, 76, 70, { font: { size: 0.8 } })];
check("words set in different sizes (a score beside its label) are not joined", sentences(sizes).length === 0);

/* Controls: what the join is for. */
const S = "body > main > p";
const inline = [
  p("a", "Launch your first token on", `${S} > span:nth-of-type(1)`, 100, 240),
  p("b", "pump.fun", `${S} > a`, 344, 70, { link: { kind: "url", target: "https://pump.fun/" } }),
  p("c", "to see PnL tracking here", `${S} > span:nth-of-type(2)`, 418, 200),
];
const j3 = sentences(inline);
check("control: a sentence with one link in it is still put back together", j3.length === 1 && j3[0].drop.length === 2, JSON.stringify(j3.map((r) => [r.keep, ...r.drop])));
const A = "body > header > a";
const one = [p("w1", "A Sol", `${A} > span:nth-of-type(1)`, 82, 50, { link }), p("w2", "Works", `${A} > span:nth-of-type(2)`, 132, 60, { link })];
const j4 = sentences(one);
check("control: one link read in pieces is still one link", j4.length === 1, JSON.stringify(j4.map((r) => [r.keep, ...r.drop])));
const H = "body > main > h1";
const title = [p("h1a", "Trump", `${H} > span:nth-of-type(1)`, 100, 200), p("h1b", "&", `${H} > span:nth-of-type(2)`, 304, 30)];
check("control: one heading read in pieces is still one heading", sentences(title).length === 1);
const sol = [
  p("sol1", "A Sol", "body > header > div > p > span:nth-of-type(1)", 82, 60, { colour: { text: "rgb(0, 255, 0)" }, font: { face: "Press Start 2P", size: 0.8 } }),
  p("sol2", "Works", "body > header > div > p > span:nth-of-type(2)", 142, 70, { colour: { text: "rgb(255, 255, 255)" }, font: { face: "Press Start 2P", size: 0.8 } }),
];
check("control: words differing only in colour still join (\"A SolWorks project\")", sentences(sol).length === 1);
const plain = [p("x1", "Total", "body > div > p > span:nth-of-type(1)", 100, 40), p("x2", "Earned", "body > div > p > span:nth-of-type(2)", 146, 60)];
check("control: words with no anchor join as before", sentences(plain).length === 1);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
