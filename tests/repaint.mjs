/**
 * The active control gets back the tint the capture dropped.
 *
 * THE FAULT, which is the converter's: an active control is picked out by a
 * translucent tint of its own colour over whatever is behind it, his time
 * buttons using `oklab(0.86644 -0.233888 0.179499 / 0.1)`. The capture could
 * not read `oklab()`, dropped it, and the node arrived with its border colour
 * and no surface — an outline where the page had a solid. The reading is
 * fixed in the converter now, which reaches a new capture and nothing at all
 * on a board already written down.
 *
 * THE ARITHMETIC, CHECKED AGAINST A NUMBER ARRIVED AT THE OTHER WAY. His
 * "1W" carries accent `rgb(0, 255, 0)` and sits in a box surfaced
 * `rgb(21, 25, 34)`. Green at a tenth over that is `rgb(19, 48, 31)`, which
 * is what the other lane got by re-reading the capture and regenerating the
 * document. Two routes, one number.
 *
 *   node tests/repaint.mjs
 */
import { over, paintSays, repaintActive, TINT } from "../src/features/studio/repaint.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const box = (id, x, y, w, h, extra = {}) => ({ id, pageId: "p0", featureId: "box", x, y, w, h, content: "", ...extra });
/* A time button as his capture left it: its ink in BOTH text and accent. */
const chip = (id, x, y, w, h, ink, extra = {}) => ({
  id, pageId: "p0", featureId: "cta-primary", x, y, w, h, content: id,
  options: { shape: "square", variant: "outline", size: "medium" },
  colour: { text: ink, accent: ink }, ...extra,
});
/*
 * A SIDEBAR ENTRY AS HIS DOCS PAGE HAS IT, and it is the case that broke the
 * first version of this rule: no accent at all, its ink in `colour.text`
 * only, the inactive ones in `oklch()` which nothing here can parse, and not
 * one painted box anywhere behind it.
 */
const entry = (id, y, ink, extra = {}) => ({
  id, pageId: "p0", featureId: "cta-primary", x: 16, y, w: 223, h: 56, content: `${id} label`,
  options: { shape: "square", variant: "outline", size: "medium" },
  colour: { text: ink }, ...extra,
});
const MUTED = "oklch(0.707 0.022 261.325)";

/* ------------------------------------------------------------------ */
/* 1. The blend itself                                                 */
/* ------------------------------------------------------------------ */

check("a tenth of green over his card's surface is the value the other lane measured",
  over("rgb(0, 255, 0)", "rgb(21, 25, 34)") === "rgb(19, 48, 31)", over("rgb(0, 255, 0)", "rgb(21, 25, 34)"));
check("…and the tenth is named rather than buried, so it can be argued with", TINT === 0.1, String(TINT));
check("no tint at all leaves what is behind it exactly as it was",
  over("rgb(0, 255, 0)", "rgb(21, 25, 34)", 0) === "rgb(21, 25, 34)");
check("a colour nothing can read gives nothing back rather than a guess",
  over("oklab(0.86644 -0.233888 0.179499 / 0.1)", "rgb(21, 25, 34)") === null);
check("…in either position", over("rgb(0,255,0)", "color(display-p3 0 1 0)") === null);
check("hex is read as well as rgb, because a document may hold either",
  over("#00ff00", "#151922") === "rgb(19, 48, 31)", over("#00ff00", "#151922"));

/* ------------------------------------------------------------------ */
/* 2. HIS ROW OF TIME BUTTONS, at his own numbers                      */
/* ------------------------------------------------------------------ */

/* The card behind them, and the two layout boxes between, which paint
   nothing — so the blend must reach past them to the one that does. */
const DIM = "rgb(45, 55, 72)";
const chart = [
  box("n_box_28", 256, 211, 1507, 350, { colour: { bg: "rgb(21, 25, 34)", surface: "rgb(21, 25, 34)" } }),
  box("n_box_29", 281, 236, 1457, 28),
  box("n_box_31", 1475, 237, 263, 26),
  chip("n_ctaprimary_33", 1475, 237, 39, 26, DIM),
  chip("n_ctaprimary_34", 1519, 237, 39, 26, "rgb(0, 255, 0)", { options: { shape: "square", variant: "ghost", size: "medium" } }),  // the active one
  chip("n_ctaprimary_35", 1562, 237, 39, 26, DIM),
  chip("n_ctaprimary_36", 1605, 237, 39, 26, DIM),
  chip("n_ctaprimary_37", 1649, 237, 39, 26, DIM),
  chip("n_ctaprimary_38", 1692, 237, 46, 26, DIM),
];
const done = repaintActive(chart);
check("exactly one of the six is repainted, and it is the active one",
  done.length === 1 && done[0]?.id === "n_ctaprimary_34", JSON.stringify(done.map((d) => d.id)));
check("…to the colour the other lane measured",
  done[0]?.paint === "rgb(19, 48, 31)", done[0]?.paint);
check("…laid over the card behind it, not over the layout boxes that paint nothing",
  done[0]?.overId === "n_box_28" && done[0]?.over === "rgb(21, 25, 34)", `${done[0]?.overId} ${done[0]?.over}`);
check("…and it knew it was one of six choices", done[0]?.among === 5, String(done[0]?.among));

/* ------------------------------------------------------------------ */
/* 2b. HIS DOCS SIDEBAR, which broke the first version of this rule     */
/* ------------------------------------------------------------------ */

/*
 * Thirteen labelled entries in a column, twelve sharing one muted `oklch()`
 * and one carrying the accent. NO accent field on any of them — the ink is in
 * `colour.text`. And NOT ONE painted box behind them: the three that contain
 * the entry all have no colour at all, so the tint went straight onto the
 * page. The first version of this rule required an accent field and a painted
 * backdrop, and would have skipped this in silence.
 */
const NAMES = ["Burn Tokens", "Why", "Swapping", "FAQ", "Cleanup", "Tokens", "NFTs", "cNFTs", "Domains", "LP", "Unknown", "Fees", "API"];
const docs = [
  box("n_box_652", 0, 63, 255, 700),
  box("n_box_653", 16, 79, 223, 176),
  box("n_box_654", 16, 79, 223, 176),
  ...NAMES.map((n, i) => entry(`e${i}`, 79 + i * 60, i === 0 ? "rgb(0, 255, 0)" : MUTED)),
];
const col = repaintActive(docs, "rgb(16, 21, 26)");
check("a column of thirteen entries gives up its one active entry",
  col.length === 1 && col[0]?.id === "e0", JSON.stringify(col.map((d) => d.id)));
check("…found with no accent field anywhere, because the ink is in its text",
  col[0]?.tint === "rgb(0, 255, 0)", col[0]?.tint);
check("…laid over the PAGE, because not one box behind it paints anything",
  col[0]?.overId === "the page" && col[0]?.over === "rgb(16, 21, 26)", `${col[0]?.overId} ${col[0]?.over}`);
check("…which gives the colour the other lane measured for the docs entry",
  col[0]?.paint === "rgb(14, 44, 23)", col[0]?.paint);
check("…and it knew it was one of thirteen", col[0]?.among === 12, String(col[0]?.among));

/*
 * AND THE PAGE IT WAS NOT FITTED TO. On his home page every sidebar entry is
 * the same grey and none is active. A rule that found one there would be
 * agreeing with nothing — this is the check that says it is reading his site
 * rather than reciting the one page it was built against.
 */
check("a column where every entry agrees has no active one, which is his home page",
  repaintActive([
    box("n_box_652", 0, 63, 255, 700),
    ...NAMES.map((n, i) => entry(`h${i}`, 79 + i * 60, MUTED)),
  ], "rgb(16, 21, 26)").length === 0);
check("and with no page colour either, there is nothing to lay it over and none is given",
  repaintActive(docs).length === 0);

/* ------------------------------------------------------------------ */
/* 3. What it must NOT repaint                                         */
/* ------------------------------------------------------------------ */

const swap = (id, patch) => chart.map((n) => (n.id === id ? { ...n, ...patch } : n));

check("a control his hand placed is left alone, whatever it looks like",
  repaintActive(swap("n_ctaprimary_34", { byHand: true })).length === 0);
check("a control that already paints a surface had nothing dropped",
  repaintActive(swap("n_ctaprimary_34", { colour: { accent: "rgb(0, 255, 0)", surface: "rgb(19, 48, 31)" } })).length === 0);
check("a control with no ink of its own has no tint colour to use",
  repaintActive(swap("n_ctaprimary_34", { colour: {} })).length === 0);
check("…and one whose ink is a colour nothing here can read is left alone rather than guessed at",
  repaintActive(swap("n_ctaprimary_34", { colour: { text: MUTED } })).length === 0);
check("a control standing on its own is not one of a set, so it is never active",
  repaintActive([chart[0], chip("alone", 400, 400, 80, 30, "rgb(0, 255, 0)")]).length === 0);
check("a set where every one is painted the same has no odd one out",
  repaintActive(chart.map((n) => (n.featureId === "cta-primary" ? { ...n, colour: { accent: DIM } } : n))).length === 0);
check("with nothing painted behind it the answer would be invented, so none is given",
  repaintActive(chart.filter((n) => n.id !== "n_box_28")).length === 0);
check("a part of another kind beside it is not one of its choices",
  repaintActive([chart[0], chip("only", 100, 300, 80, 30, "rgb(0, 255, 0)"), { ...box("b", 200, 300, 80, 30), colour: { accent: DIM } }]).length === 0);
check("and a control on another page is not in the row, however the coordinates line up",
  repaintActive([chart[0], chip("here", 100, 300, 80, 30, "rgb(0, 255, 0)"), { ...chip("there", 100, 300, 80, 30, DIM), pageId: "p1" }]).length === 0);

/*
 * WHICH ROLE THE COLOUR GOES IN. A control fills from its accent and needs
 * telling it is solid; a plain box fills from its surface and has no variant
 * to set. Getting this wrong paints the right colour into a field nothing
 * reads, which looks exactly like doing nothing.
 */
/*
 * THE ROLE, MEASURED. Seeded four ways at 60x30 against a production build:
 * `accent` + `variant: solid` has the button paint 35x15 of a 35x18 box, and
 * `colour.bg` has the wrapper paint the whole 35x18 — which is the fault the
 * chrome lane fixed as "a box's fill reaches its edge". So the colour goes in
 * `bg`, and the variant is deliberately left alone: with `bg` set the button
 * paints nothing either way, and forcing `solid` would flip the text of any
 * node that never named a colour onto the accent's contrast.
 */
check("the colour goes in bg, which is the role that fills the box to its edge",
  done[0]?.role === "bg", String(done[0]?.role));
check("a part with no variant is not a control, so a coloured line in a list is never painted",
  repaintActive([
    box("shell2", 0, 0, 240, 400, { colour: { surface: "rgb(16, 21, 26)" } }),
    { ...box("p1", 0, 0, 240, 40), content: "one", colour: { text: DIM } },
    { ...box("p2", 0, 44, 240, 40), content: "two", colour: { text: "rgb(0, 255, 0)" } },
    { ...box("p3", 0, 88, 240, 40), content: "three", colour: { text: DIM } },
  ]).length === 0);

/*
 * AND THE ONE THIS NEARLY GOT WRONG. Two 20x20 `svg` marks in his own
 * document carry accent green and no surface and sit beside each other, so
 * every geometric condition held and both would have been given a green
 * square the page never drew. A choice a person can pick has a LABEL; an
 * icon does not, and that is the whole difference.
 */
check("three icon marks in a row, one picked out in green, are still not choices",
  repaintActive([
    box("card0", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    { ...chip("i1", 1660, 614, 20, 20, DIM), content: "" },
    { ...chip("i2", 1690, 614, 20, 20, "rgb(0, 255, 0)"), content: "" },
    { ...chip("i3", 1718, 614, 20, 20, DIM), content: "" },
  ]).length === 0);
check("…and the same three, labelled and marked up as controls, ARE",
  repaintActive([
    box("card0b", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    chip("j1", 1660, 614, 20, 20, DIM),
    chip("j2", 1690, 614, 20, 20, "rgb(0, 255, 0)"),
    chip("j3", 1718, 614, 20, 20, DIM),
  ]).length === 1);

check("an unlabelled control among labelled choices is not itself one of them",
  repaintActive([
    box("card0c", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    chip("k1", 1660, 614, 20, 20, DIM),
    { ...chip("k2", 1690, 614, 20, 20, "rgb(0, 255, 0)"), content: "" },
    chip("k3", 1718, 614, 20, 20, DIM),
  ]).length === 0);
check("a labelled choice among unlabelled marks is not one either, since they are no set",
  repaintActive([
    box("card0d", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    { ...chip("m1", 1660, 614, 20, 20, DIM), content: "" },
    chip("m2", 1690, 614, 20, 20, "rgb(0, 255, 0)"),
    { ...chip("m3", 1718, 614, 20, 20, DIM), content: "" },
  ]).length === 0);

check("the two 20x20 svg marks from his own document are not a set of choices",
  repaintActive([
    box("card", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    { ...box("n_box_44", 1718, 614, 20, 20), colour: { accent: "rgb(0, 255, 0)" } },
    { ...box("n_box_45", 1690, 614, 20, 20), colour: { accent: DIM } },
  ]).length === 0);
/*
 * A PAIR IS LEFT ALONE, because it cannot be read. Of two choices painted
 * differently, each is the odd one out of the other and neither is more
 * active than the other. Three is the smallest set where "the rest agree"
 * means anything, and that is what makes the active one findable.
 */
const pairOrTrio = (n) => repaintActive([
  box("card2", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
  chip("c1", 400, 614, 60, 20, "rgb(0, 255, 0)"),
  chip("c2", 470, 614, 60, 20, DIM),
  ...(n > 2 ? [chip("c3", 540, 614, 60, 20, DIM)] : []),
]);
check("two choices painted differently are ambiguous, so neither is touched", pairOrTrio(2).length === 0,
  JSON.stringify(pairOrTrio(2).map((d) => d.id)));
check("…and with a third that agrees with one of them, the other is the active one",
  pairOrTrio(3).length === 1 && pairOrTrio(3)[0].id === "c1", JSON.stringify(pairOrTrio(3).map((d) => d.id)));
check("a set whose others disagree among themselves says nothing rather than guessing",
  repaintActive([
    box("card3", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    chip("d1", 400, 614, 60, 20, "rgb(0, 255, 0)"),
    chip("d2", 470, 614, 60, 20, DIM),
    chip("d3", 540, 614, 60, 20, "rgb(255, 0, 0)"),
  ]).length === 0);

check("and the line a person reads names the colour it painted",
  /rgb\(19, 48, 31\)/.test(paintSays(done)) && /repainted/.test(paintSays(done)), paintSays(done));
check("with nothing to repaint, it says that instead", /No control/.test(paintSays([])), paintSays([]));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
