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
const chip = (id, x, y, w, h, accent, extra = {}) => ({
  id, pageId: "p0", featureId: "cta-primary", x, y, w, h, content: id,
  options: { shape: "square", variant: "outline", size: "medium" },
  colour: { text: "rgb(255,255,255)", accent }, ...extra,
});

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

/* The same fault down a column, which is what a sidebar is. */
const side = [
  box("shell", 0, 0, 240, 400, { colour: { surface: "rgb(16, 21, 26)" } }),
  chip("s1", 0, 0, 240, 40, DIM),
  chip("s2", 0, 44, 240, 40, "rgb(0, 255, 0)"),
  chip("s3", 0, 88, 240, 40, DIM),
];
const col = repaintActive(side);
check("a column of choices is a set too, so a sidebar's active entry is found",
  col.length === 1 && col[0]?.id === "s2", JSON.stringify(col.map((d) => d.id)));
check("…over its own surface, which gives its own colour and not the chart's",
  col[0]?.paint === "rgb(14, 44, 23)", col[0]?.paint);

/* ------------------------------------------------------------------ */
/* 3. What it must NOT repaint                                         */
/* ------------------------------------------------------------------ */

const swap = (id, patch) => chart.map((n) => (n.id === id ? { ...n, ...patch } : n));

check("a control his hand placed is left alone, whatever it looks like",
  repaintActive(swap("n_ctaprimary_34", { byHand: true })).length === 0);
check("a control that already paints a surface had nothing dropped",
  repaintActive(swap("n_ctaprimary_34", { colour: { accent: "rgb(0, 255, 0)", surface: "rgb(19, 48, 31)" } })).length === 0);
check("a control with no accent has no tint colour to use",
  repaintActive(swap("n_ctaprimary_34", { colour: { text: "rgb(255,255,255)" } })).length === 0);
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
check("a control takes the colour in its accent, and is told it is solid now",
  done[0]?.role === "accent" && done[0]?.solid === true, `${done[0]?.role} solid=${done[0]?.solid}`);
check("a plain box takes it in its surface, and has no variant to set",
  (() => {
    const b = repaintActive([
      box("shell", 0, 0, 240, 400, { colour: { surface: "rgb(16, 21, 26)" } }),
      { ...box("e1", 0, 0, 240, 40), content: "Overview", colour: { accent: DIM } },
      { ...box("e2", 0, 44, 240, 40), content: "Burn Tokens", colour: { accent: "rgb(0, 255, 0)" } },
      { ...box("e3", 0, 88, 240, 40), content: "Stats", colour: { accent: DIM } },
    ]);
    return b.length === 1 && b[0].id === "e2" && b[0].role === "surface" && b[0].solid === false && b[0].paint === "rgb(14, 44, 23)";
  })());

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
    { ...box("i1", 1660, 614, 20, 20), colour: { accent: DIM } },
    { ...box("i2", 1690, 614, 20, 20), colour: { accent: "rgb(0, 255, 0)" } },
    { ...box("i3", 1718, 614, 20, 20), colour: { accent: DIM } },
  ]).length === 0);
check("…and the same three with labels on them ARE",
  repaintActive([
    box("card0b", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    { ...box("j1", 1660, 614, 20, 20), content: "A", colour: { accent: DIM } },
    { ...box("j2", 1690, 614, 20, 20), content: "B", colour: { accent: "rgb(0, 255, 0)" } },
    { ...box("j3", 1718, 614, 20, 20), content: "C", colour: { accent: DIM } },
  ]).length === 1);

check("an unlabelled mark among labelled choices is not itself one of them",
  repaintActive([
    box("card0c", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    { ...box("k1", 1660, 614, 20, 20), content: "A", colour: { accent: DIM } },
    { ...box("k2", 1690, 614, 20, 20), colour: { accent: "rgb(0, 255, 0)" } },
    { ...box("k3", 1718, 614, 20, 20), content: "C", colour: { accent: DIM } },
  ]).length === 0);
check("a labelled choice among unlabelled marks is not one either, since they are no set",
  repaintActive([
    box("card0d", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    { ...box("m1", 1660, 614, 20, 20), colour: { accent: DIM } },
    { ...box("m2", 1690, 614, 20, 20), content: "B", colour: { accent: "rgb(0, 255, 0)" } },
    { ...box("m3", 1718, 614, 20, 20), colour: { accent: DIM } },
  ]).length === 0);

check("two icon marks beside each other are not a set of choices",
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
  { ...box("c1", 400, 614, 60, 20), content: "Live", colour: { accent: "rgb(0, 255, 0)" } },
  { ...box("c2", 470, 614, 60, 20), content: "Paused", colour: { accent: DIM } },
  ...(n > 2 ? [{ ...box("c3", 540, 614, 60, 20), content: "Off", colour: { accent: DIM } }] : []),
]);
check("two choices painted differently are ambiguous, so neither is touched", pairOrTrio(2).length === 0,
  JSON.stringify(pairOrTrio(2).map((d) => d.id)));
check("…and with a third that agrees with one of them, the other is the active one",
  pairOrTrio(3).length === 1 && pairOrTrio(3)[0].id === "c1", JSON.stringify(pairOrTrio(3).map((d) => d.id)));
check("a set whose others disagree among themselves says nothing rather than guessing",
  repaintActive([
    box("card3", 300, 600, 1440, 200, { colour: { surface: "rgb(21, 25, 34)" } }),
    { ...box("d1", 400, 614, 60, 20), content: "A", colour: { accent: "rgb(0, 255, 0)" } },
    { ...box("d2", 470, 614, 60, 20), content: "B", colour: { accent: DIM } },
    { ...box("d3", 540, 614, 60, 20), content: "C", colour: { accent: "rgb(255, 0, 0)" } },
  ]).length === 0);

check("and the line a person reads names the colour it painted",
  /rgb\(19, 48, 31\)/.test(paintSays(done)) && /repainted/.test(paintSays(done)), paintSays(done));
check("with nothing to repaint, it says that instead", /No control/.test(paintSays([])), paintSays([]));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
