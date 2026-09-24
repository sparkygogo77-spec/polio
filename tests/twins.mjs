/**
 * The same box emitted twice, and the spare one taken out.
 *
 * HIS NUMBERS: 24 pairs across nine pages where one box contains another at
 * 88% or more of its area. Thirteen PIXEL IDENTICAL — the main content panel
 * of almost every page, twice, exactly on top of itself. Nine differing by
 * EXACTLY ONE PIXEL OF WIDTH and nothing else, 256 against 255: the sidebar,
 * on every page. Two that fit neither shape.
 *
 * NOT two box models, which was the standing hypothesis: his raw capture
 * holds six parent/child pairs with identical rects and they are two distinct
 * DOM elements every time — `div` in `div`, `button` in `div`, `img` in
 * `div`. The page really does wrap a row in a box the same size.
 *
 *   node tests/twins.mjs
 */
import { twins, twinSays } from "../src/features/studio/twins.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const at = (id, x, y, w, h, extra = {}) => ({ id, pageId: "p0", featureId: "box", x, y, w, h, content: "", ...extra });

/* ------------------------------------------------------------------ */
/* 1. His two shapes                                                   */
/* ------------------------------------------------------------------ */

const identical = twins([at("n_box_31", 1468, 393, 270, 26), at("n_box_32", 1468, 393, 270, 26)]);
check("a pixel-identical pair loses one copy", identical.length === 1, JSON.stringify(identical));
check("…and the one that stays is named, so the removal can be checked",
  identical[0]?.keeps === "n_box_31" && identical[0]?.of === 2, JSON.stringify(identical[0]));

const offByOne = twins([at("n_box_136", 0, 63, 256, 440), at("n_box_137", 0, 63, 255, 440)]);
check("the sidebar pair, differing by one pixel of width, loses one copy too",
  offByOne.length === 1, JSON.stringify(offByOne));
check("…and it is the wider, outermost one that stays, since neither says anything",
  offByOne[0]?.keeps === "n_box_136" && offByOne[0]?.why === "outermost", JSON.stringify(offByOne[0]));

/* ------------------------------------------------------------------ */
/* 2. The keep rule, which the easy answer gets wrong                  */
/* ------------------------------------------------------------------ */

/*
 * His `n_box_92` and `n_ctaprimary_93` are the same box: a div wrapping a
 * button. "Keep the first" throws away the button and leaves a bare box,
 * which looks fine in a count and is wrong on his screen.
 */
const button = twins([
  at("n_box_92", 489, 21, 123, 38),
  { ...at("n_ctaprimary_93", 489, 21, 123, 38), featureId: "cta-primary", content: "CMvC...wqer" },
]);
check("a div wrapping a button keeps the BUTTON and drops the bare box",
  button.length === 1 && button[0].id === "n_box_92" && button[0].keeps === "n_ctaprimary_93",
  JSON.stringify(button[0]));
check("…because it is the one that says something", button[0]?.why === "says");

/*
 * HIS WALLET BUTTON ONCE IT STOPS DRAWING WORDS THAT ARE NOT ITS OWN. The
 * capture keeps its address and age as parts of their own and the button
 * carries no words (sink, site/capture/check-button-words.mjs). It is still
 * the same box as the div wrapping it, and it is the one wearing his dark
 * fill and green edge: with neither saying anything, "the outermost, then the
 * first" kept the bare wrapper and took the button, and the edge round his
 * address went with it — on all eight pages. Values from page_tokens.
 */
const wallet = twins([
  at("n_box_246", 1224, 16, 153, 49),
  { ...at("n_ctaprimary_247", 1224, 16, 153, 49), featureId: "cta-primary",
    colour: { bg: "rgb(10, 14, 26)", accent: "rgb(10, 14, 26)" }, edge: { width: 1, style: "solid", colour: "rgb(0, 255, 0)" } },
]);
check("a div wrapping a button that carries no words still keeps the BUTTON",
  wallet.length === 1 && wallet[0].id === "n_box_246" && wallet[0].keeps === "n_ctaprimary_247",
  JSON.stringify(wallet[0]));
/* …and the rule it keeps it by is not "a button always wins": a bare button
   and a box that wears a fill are decided by what shows, the fill. */
const shown = twins([
  { ...at("bare-button", 0, 0, 200, 40), featureId: "cta-primary", options: { variant: "outline" }, edge: { style: "none" } },
  { ...at("painted", 0, 0, 200, 40), colour: { bg: "rgb(21, 25, 34)" } },
]);
check("between a painted box and a bare wordless control, what shows stays",
  shown.length === 1 && shown[0].keeps === "painted", JSON.stringify(shown[0]));

/*
 * AND IT IS ALREADY HAPPENING, before any capture change. His Documentation
 * header's search field is three boxes at the same place and size: a div, a
 * div inside it, and the input, which alone wears the dark fill, the blue
 * hairline and the 40px inset its icon sits in. Ranked only on words and
 * drawings all three tied, the outermost was kept, and the field lost its
 * fill and edge on his board. Values from sink's page_docs.
 */
const search = twins([
  at("n_box_647", 1259, 12, 448, 38),
  at("n_box_648", 1259, 12, 448, 38),
  { ...at("n_box_649", 1259, 12, 448, 38),
    colour: { bg: "rgb(10, 14, 26)", surface: "rgb(10, 14, 26)", text: "oklch(0.872 0.01 258.338)" },
    edge: { width: 1, style: "solid", colour: "rgb(30, 58, 95)" }, pad: { top: 8, right: 16, bottom: 8, left: 40 } },
]);
check("his docs search field keeps the box that wears its fill and edge, and loses the two bare ones",
  search.length === 2 && search.every((t) => t.keeps === "n_box_649"), JSON.stringify(search));

const logo = twins([
  at("n_box_94", 826, -11, 112, 112),
  { ...at("n_picture_95", 826, -11, 112, 112), featureId: "picture", picture: { id: "p" } },
]);
check("a div wrapping his logo keeps the PICTURE and drops the bare box",
  logo.length === 1 && logo[0].id === "n_box_94" && logo[0].keeps === "n_picture_95" && logo[0].why === "draws",
  JSON.stringify(logo[0]));

const three = twins([
  at("outer", 0, 0, 500, 100),
  at("middle", 0, 0, 499, 100),
  { ...at("inner", 1, 1, 498, 99), content: "the words" },
]);
check("a stack of three leaves exactly one, and it is the one that speaks",
  three.length === 2 && three.every((t) => t.keeps === "inner"), JSON.stringify(three));
check("…and it says how many were stacked there", three[0]?.of === 3, String(three[0]?.of));

/* ------------------------------------------------------------------ */
/* 3. WHERE THE TWINS DISAGREE ON HEIGHT — his page_home column        */
/* ------------------------------------------------------------------ */

/*
 * On page_tokens his two column boxes are 255x440 and 256x440: the same box,
 * and one goes. On page_home they are 255x431 and 256x528 at the same x and
 * y — and those are NOT the same box. Removing one would be choosing a HEIGHT
 * as well as a node, and nothing here knows which height is right: neither
 * draws anything, and the two disagree by 97px.
 *
 * So the tolerance decides it rather than a special case. Two pixels is
 * `pageBlocks`' own, it covers all thirteen identical pairs and all nine
 * off-by-one pairs, and it declines the ones that disagree on size. Declining
 * is the right answer: a duplicate is only safe to remove because an
 * identical twin remains, and a twin 97px shorter is not identical.
 */
check("his page_tokens column pair, 255x440 and 256x440, is one box and loses a copy",
  twins([at("n_box_207", 0, 63, 256, 440), at("n_box_208", 0, 63, 255, 440)]).length === 1);
check("his page_home column pair, 255x431 against 256x528, is NOT and keeps both",
  twins([at("n_box_136", 0, 63, 256, 528), at("n_box_137", 0, 63, 255, 431)]).length === 0,
  "removing one would be choosing a height nothing here knows");

/* ------------------------------------------------------------------ */
/* 4. What it must never touch                                         */
/* ------------------------------------------------------------------ */

/*
 * AND THE ONE THAT MATTERS MOST. An empty wrapper that has slid below its
 * contents — his banner, his Your Tokens panel — must be REPOSITIONED and
 * must never be removed. It has no twin, so this never sees it; that is
 * asserted here rather than left to be true by luck, because losing his
 * banner by a second route would be the same mistake twice.
 */
check("a lone empty wrapper is invisible to this, whatever else is on the page",
  twins([at("n_box_75", 0, 147, 1763, 65), at("header", 0, -11, 1763, 116), at("n_box_46", 256, 1247, 1507, 172)]).length === 0);
check("a box his hand touched is left, and so is everything stacked with it",
  twins([at("a", 0, 0, 300, 50, { byHand: true }), at("b", 0, 0, 300, 50)]).length === 0);
check("two boxes at the same place on different pages are not copies of each other",
  twins([at("here", 0, 0, 300, 50), { ...at("there", 0, 0, 300, 50), pageId: "p1" }]).length === 0);
check("a smaller box genuinely inside a larger one is a real part and is kept",
  twins([at("card", 0, 0, 400, 400), { ...at("inside", 20, 20, 360, 100), content: "words" }]).length === 0);
check("…even when it fills most of it, because most is not the same",
  twins([at("card2", 0, 0, 400, 400), at("nearly", 0, 0, 400, 360)]).length === 0);
check("one box on its own is never a copy of anything", twins([at("only", 0, 0, 300, 50)]).length === 0);

/*
 * THE PROOF, rather than the assumption: nothing is removed whose keeper is
 * itself on the removal list. The grouping makes that impossible, and this
 * says so out loud so it stays impossible.
 */
check("no copy is removed whose twin is also being removed",
  (() => {
    const all = twins([at("x", 0, 0, 300, 50), at("y", 1, 1, 299, 49), at("z", 2, 2, 298, 48)]);
    const going = new Set(all.map((t) => t.id));
    return all.length === 2 && all.every((t) => !going.has(t.keeps));
  })());

check("and the line a person reads names each copy and the twin it left",
  /→/.test(twinSays(button)) && /twin left in place/.test(twinSays(button)), twinSays(button));
check("with nothing doubled, it says that instead", /No box/.test(twinSays([])), twinSays([]));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
