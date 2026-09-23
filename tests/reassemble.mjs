/**
 * A sentence a capture broke into parts, put back together.
 *
 * HIS TWO CASES, as he named them. "A Sol Works project" must come back as
 * ONE sentence where "Works" is its own run, and his price line — the figure
 * and the percentage, with a gap and a colour between them — must come back
 * as one rather than four.
 *
 * Pure: no browser, no build, no server.
 *   node --experimental-strip-types tests/reassemble.mjs
 */
import { emptyWrappers, sentences, saysWhat, slimSays, slimWrappers, WORDY } from "../src/features/studio/reassemble.ts";
import { plain } from "../src/features/studio/parts/spans.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

let n = 0;
const frag = (content, x, w, extra = {}) => ({
  id: `f${++n}`, pageId: "p0", featureId: "box", x, y: 100, w, h: 20, content, ...extra,
});

/* ------------------------------------------------------------------ */
/* 1. His header                                                       */
/* ------------------------------------------------------------------ */

/* "A Sol" ends at 40, "Works" starts at 45 — a five-pixel gap, which is a
   space at this size. "project" the same. */
const header = [
  frag("A Sol", 0, 40),
  frag("Works", 45, 42, { colour: { text: "rgb(34,197,94)" }, font: { face: "Georgia" } }),
  frag("project", 92, 48),
];
const h = sentences(header);
check("his header is one sentence", h.length === 1, `${h.length} sentences`);
check("…reading exactly as his site does", plain(h[0]?.spans ?? []) === "A Sol Works project", JSON.stringify(plain(h[0]?.spans ?? [])));
check("…with Works still its own run, carrying its face and colour", (() => {
  const w = (h[0]?.spans ?? []).find((s) => s.text === "Works");
  return !!w && w.face === "Georgia" && w.colour === "rgb(34,197,94)";
})(), JSON.stringify(h[0]?.spans ?? []));
check("…and the plain words around it saying nothing of their own", (() => {
  const first = (h[0]?.spans ?? [])[0];
  return !!first && first.colour === undefined && first.weight === undefined && first.face === undefined;
})());
check("…in one box spanning all three", h[0]?.x === 0 && h[0]?.w === 140, `${h[0]?.x} + ${h[0]?.w}`);
check("…keeping the first part and dropping the other two", h[0]?.drop.length === 2, `${h[0]?.drop.length} dropped`);

/* ------------------------------------------------------------------ */
/* 2. His price line: a gap means a space, no gap means none           */
/* ------------------------------------------------------------------ */

/*
 * The capture threw the whitespace away when it split the sentence, so the
 * gap is the only evidence a space belonged there. "$" butts against the
 * figure; the percentage stands off from it.
 */
n = 0;
const price = [
  frag("$", 0, 8),
  frag("118.35", 8, 50, { font: { weight: 600 } }),
  frag("-0.46%", 70, 44, { colour: { text: "rgb(239,68,68)" } }),
];
const p = sentences(price);
check("his price line is one sentence", p.length === 1, `${p.length} sentences`);
check("…with the currency joined to the figure and a space before the fall",
  plain(p[0]?.spans ?? []) === "$118.35 -0.46%", JSON.stringify(plain(p[0]?.spans ?? [])));
check("…the figure keeping its weight and the fall its colour", (() => {
  const ss = p[0]?.spans ?? [];
  return ss.some((s) => s.text === "118.35" && s.weight === 600) && ss.some((s) => s.text === "-0.46%" && s.colour === "rgb(239,68,68)");
})(), JSON.stringify(p[0]?.spans ?? []));

/* ------------------------------------------------------------------ */
/* 3. The contract rules, enforced here                                */
/* ------------------------------------------------------------------ */

/* Never emit a span that says nothing: three plain fragments are one run. */
n = 0;
const same = sentences([frag("for the builders,", 0, 60), frag("believers,", 65, 40), frag("and bold thinkers", 110, 70)]);
check("adjacent runs that say nothing of their own merge into one",
  (same[0]?.spans ?? []).length === 1, `${(same[0]?.spans ?? []).length} runs`);
check("…with the sentence intact and its commas its own",
  plain(same[0]?.spans ?? []) === "for the builders, believers, and bold thinkers", plain(same[0]?.spans ?? []));

/* A span never straddles a newline: a fragment already holding one is not a
   fragment of a line, so it is left alone rather than joined across. */
n = 0;
const multi = sentences([frag("one\ntwo", 0, 40), frag("three", 45, 40)]);
check("a part already holding a newline is never joined into a line", multi.length === 0, `${multi.length} sentences`);

/* ------------------------------------------------------------------ */
/* 4. What it must NOT do                                              */
/* ------------------------------------------------------------------ */

n = 0;
check("two parts far apart on a line are not one sentence",
  sentences([frag("left", 0, 40), frag("right", 600, 40)]).length === 0);
n = 0;
check("two parts on different lines are not one sentence",
  sentences([frag("top", 0, 40), { ...frag("under", 0, 40), y: 300 }]).length === 0);
n = 0;
check("a part that is not words is never absorbed",
  sentences([frag("Buy", 0, 40, { featureId: "cta-primary" }), frag("now", 45, 40)]).length === 0);
n = 0;
check("one part alone is not a sentence in pieces", sentences([frag("alone", 0, 40)]).length === 0);
n = 0;
check("parts on different pages are never joined",
  sentences([frag("here", 0, 40), { ...frag("there", 45, 40), pageId: "p1" }]).length === 0);
check("a button is not in the wordy set, and a box is", !WORDY.has("cta-primary") && WORDY.has("box"));

/* ------------------------------------------------------------------ */
/* 5. His ruling: merge everything, and name what was taken            */
/* ------------------------------------------------------------------ */

n = 0;
const mine = sentences([frag("A Sol", 0, 40), frag("Works", 45, 42, { byHand: true }), frag("project", 92, 48)]);
check("a part he moved by hand IS merged, by his ruling", mine.length === 1 && mine[0].drop.length === 2);
check("…and is named, which is how he checks the ruling was read right",
  (mine[0]?.tookByHand ?? []).length === 1, (mine[0]?.tookByHand ?? []).join(", ") || "named nothing");
check("…and the line a person reads says so plainly",
  /moved or stretched by hand/.test(saysWhat(mine)) && /f2/.test(saysWhat(mine)), saysWhat(mine));
check("with nothing in pieces, it says that instead", /No sentence/.test(saysWhat([])), saysWhat([]));


/* ------------------------------------------------------------------ */
/* 6. His header, with the space the page actually had                 */
/* ------------------------------------------------------------------ */

/*
 * HIS SITE READS "A SolWorks project". Not "A Sol Works project" — "SolWorks"
 * is the name — so one boundary takes a space and the other does not, both
 * are letter against letter, and both pairs of boxes BUTT because the space
 * is inside a run's own text rather than between two boxes. No rule reading
 * only the words or only the geometry can tell those two boundaries apart.
 * Only the page knew, and the reader now keeps it: the whitespace rides on
 * the run that carries it, which is the contract's rule four.
 */
n = 0;
const real = sentences([
  frag("A Sol", 0, 40),
  frag("Works", 40, 42),
  frag(" project", 82, 50),
]);
check("his header comes back exactly as his site reads it",
  plain(real[0]?.spans ?? []) === "A SolWorks project", JSON.stringify(plain(real[0]?.spans ?? [])));
check("…and the sentence round-trips character for character",
  plain(real[0]?.spans ?? []) === "A Sol" + "Works" + " project");

/* Both ends of a boundary, which is what he asked to see proved. */
n = 0;
const bothEnds = sentences([frag("one ", 0, 40), frag(" two", 40, 40), frag("three", 80, 40)]);
check("a space at either end of a boundary is kept once, never doubled",
  plain(bothEnds[0]?.spans ?? []) === "one  twothree", JSON.stringify(plain(bothEnds[0]?.spans ?? [])));
check("…and a carried space stops a second being inferred from the gap", (() => {
  n = 0;
  const carried = sentences([frag("left ", 0, 40), frag("right", 46, 40)]);
  return plain(carried[0]?.spans ?? []) === "left right";
})(), (() => { n = 0; return JSON.stringify(plain(sentences([frag("left ", 0, 40), frag("right", 46, 40)])[0]?.spans ?? [])); })());

/* ------------------------------------------------------------------ */
/* 7. His price line, at the distance it actually sits                 */
/* ------------------------------------------------------------------ */

n = 0;
const his = sentences([
  { id: "n_prose_92", pageId: "p0", featureId: "prose", x: 1084, y: 65, w: 59, h: 40, content: "$ 116.59" },
  { id: "n_prose_95", pageId: "p0", featureId: "prose", x: 1165, y: 65, w: 43, h: 32, content: "-1.94 %" },
]);
check("his price line merges at the 22px gap it actually has", his.length === 1, `${his.length} sentences, gap 22px`);
check("…into one sentence", plain(his[0]?.spans ?? []) === "$ 116.59 -1.94 %", JSON.stringify(plain(his[0]?.spans ?? [])));
/* And the limit is still a limit: a control on the same line is not swept in. */
n = 0;
check("a button four hundred pixels along the same line is still not swept in",
  sentences([
    { id: "a", pageId: "p0", featureId: "prose", x: 0, y: 0, w: 60, h: 40, content: "words" },
    { id: "b", pageId: "p0", featureId: "prose", x: 400, y: 0, w: 90, h: 40, content: "Connect" },
  ]).length === 0);
n = 0;
check("…and a gap wider than the shorter box is tall is still two things",
  sentences([
    { id: "a", pageId: "p0", featureId: "prose", x: 0, y: 0, w: 60, h: 20, content: "words" },
    { id: "b", pageId: "p0", featureId: "prose", x: 100, y: 0, w: 60, h: 20, content: "apart" },
  ]).length === 0);


/*
 * WHERE THE NEW LIMIT ACTUALLY FALLS, at his scale, so it is a number and
 * not a feeling. Two 32-tall boxes: three quarters of 32 is 24, and the
 * sentence rule allows 1.8 of that, so 43 joins and 44 does not. His pair
 * sits at 22, which is inside it with room to spare — and that is the point,
 * because the old limit put the cut between one and eight pixels away from
 * a gap that was plainly a word space.
 */
const atGap = (g) => {
  n = 0;
  return sentences([
    { id: "l", pageId: "p0", featureId: "prose", x: 0, y: 0, w: 60, h: 32, content: "left" },
    { id: "r", pageId: "p0", featureId: "prose", x: 60 + g, y: 0, w: 60, h: 32, content: "right" },
  ]).length;
};
check("at his scale the limit falls at 43 pixels, and 43 is one sentence", atGap(43) === 1);
check("…and 44 is two separate things", atGap(44) === 0);
check("…so his 22-pixel pair is inside it with room, not one pixel from the cut", atGap(22) === 1);

/*
 * AND THE NEIGHBOUR THE COORDINATOR WARNED ABOUT. `n_ctaprimary_59` sits
 * 139px BELOW the fall and does not share its band of the page, so it is a
 * column jump rather than a gap in a sentence — and it is a button, which is
 * not in the wordy set either. Two reasons, and it needs only one.
 */
n = 0;
check("the control below his price line is not dragged into it",
  sentences([
    { id: "n_prose_92", pageId: "p0", featureId: "prose", x: 1084, y: 65, w: 59, h: 40, content: "$ 116.59" },
    { id: "n_prose_95", pageId: "p0", featureId: "prose", x: 1165, y: 65, w: 43, h: 32, content: "-1.94 %" },
    { id: "n_ctaprimary_59", pageId: "p0", featureId: "cta-primary", x: 1400, y: 236, w: 150, h: 44, content: "Connect" },
  ]).every((r) => !r.drop.includes("n_ctaprimary_59") && r.keep !== "n_ctaprimary_59"));

/* ------------------------------------------------------------------ */
/* 8. Wrappers fitted to what they hold — HIS OWN NUMBERS              */
/* ------------------------------------------------------------------ */

/*
 * Measured on the page he screenshotted: 45 wrappers among 114 parts, five
 * holding nothing and worth 293px, three claiming two children and holding
 * one. And the banner, which is why "drop the empty ones" is the wrong rule:
 * n_box_75 is 1763x82, claims one child and holds exactly one — n_box_76,
 * the 1280x49 box that claims three and holds nothing. A chain: banner, into
 * an empty div, into nothing. The banner is not empty, so a drop-empties
 * rule walks straight past the part he actually clicked on.
 */
const box = (id, x, y, w, h, extra = {}) => ({ id, pageId: "p0", featureId: "box", x, y, w, h, content: "", ...extra });
const leaf = (id, x, y, w, h) => ({ id, pageId: "p0", featureId: "prose", x, y, w, h, content: "words" });

const chain = [
  box("n_box_75", 0, 0, 1763, 82),      // the banner: holds one thing, 33px of nothing under it
  box("n_box_76", 0, 0, 1280, 49),      // the empty div inside it
];
const slim = slimWrappers(chain);
/*
 * NOTHING IS REMOVED ANY MORE, and the reason is measured rather than
 * cautious. Both empty wrappers on his home page are real surfaces that slid
 * BELOW the content they own: the banner at y 147 with its whole header above
 * it at -11..105, and the Your Tokens panel at y 1247 with its heading at
 * 1056. Deleting those takes them off the page for good. They are misplaced,
 * not junk, and the correction is to put them back round what they own.
 */
check("the empty box inside the banner is reported, and NOT removed",
  !slim.some((d) => d.id === "n_box_76") && emptyWrappers(chain).some((f) => f.id === "n_box_76"),
  JSON.stringify(slim.map((d) => d.id)));
check("and the BANNER is fitted, because it does hold something — which a drop-empties rule would miss",
  slim.some((d) => d.id === "n_box_75" && d.h === 49 && d.holds === 1), JSON.stringify(slim));
check("…recovering exactly the 33px of dead space he measured under its only child",
  (slim.find((d) => d.id === "n_box_75")?.was ?? 0) - (slim.find((d) => d.id === "n_box_75")?.h ?? 0) === 33);

/* Five empty wrappers at his sizes: the 293px is the number he measured. */
const empties = [
  box("n_box_53", 0, 0, 1457, 148), box("n_box_76b", 0, 200, 1280, 49),
  box("n_box_80", 0, 300, 216, 16), box("n_box_110", 0, 400, 1280, 40),
  box("n_box_111", 0, 500, 96, 40),
];
check("empty wrappers are never fitted and never dropped, only reported",
  slimWrappers(empties).length === 0 && emptyWrappers(empties).length === 5, `${slimWrappers(empties).length} changed`);
check("…and the report names them, so he can see what was left alone",
  /hold nothing and were left alone/.test(slimSays([], emptyWrappers(empties))), slimSays([], emptyWrappers(empties)));

/* Only the bottom is trimmed: a box is never lifted off what sits above it. */
const padded = [box("w", 0, 0, 100, 100, { pad: { top: 10, bottom: 8 } }), leaf("k", 10, 30, 60, 20)];
const fit = slimWrappers(padded);
check("a wrapper is fitted to its lowest child plus the foot the capture recorded",
  fit[0]?.h === 58, `${fit[0]?.h} (child ends at 50, foot 8)`);
check("…and its top never moves, so nothing is lifted off what is above it",
  !("y" in (fit[0] ?? {})));

/* And what it must not touch. */
/*
 * A WRAPPER IS A BOX. Every one of the 75 wordless parts in his captured
 * document is a `box`; a part of any other kind holding nothing is something
 * else. A `picture` with no picture is a stand-in by design, and removing it
 * takes a slot off the page that somebody meant to fill.
 */
check("a picture part holding no picture is a stand-in, not an empty wrapper",
  slimWrappers([{ ...box("standin", 900, 300, 112, 112), featureId: "picture" }]).length === 0);
check("…and neither is any other kind of part that happens to hold nothing",
  slimWrappers([{ ...box("tiles", 0, 0, 400, 200), featureId: "stat-tiles" }]).length === 0);

check("a box that draws something of its own is not a wrapper",
  slimWrappers([box("pic", 0, 0, 100, 100, { picture: { id: "p" } })]).length === 0);
check("a box carrying words is not a wrapper",
  slimWrappers([{ ...box("w2", 0, 0, 100, 100), content: "hello" }]).length === 0);
check("a wrapper that already fits is left alone",
  slimWrappers([box("snug", 0, 0, 100, 50), leaf("in", 0, 0, 100, 50)]).length === 0);
/*
 * TWO THINGS THAT ARE NEVER REMOVED, both for the same reason: removing a
 * box is the one direction that cannot be undone by looking at the page.
 *
 * A wrapper HIS HAND placed or resized is his answer about its size, so it
 * is not touched at all — not fitted, not removed — exactly as with the
 * button and the healing.
 *
 * A wrapper that shows a SURFACE of its own — a background, an edge, a
 * texture, an aura — looks empty only because its contents sit outside it.
 * Dropping it takes a coloured band off the page. Fitting one is still fine,
 * because that only gives back height nothing occupies.
 */
check("a wrapper his hand placed is not touched, even though it holds nothing",
  slimWrappers([box("mine", 0, 0, 800, 90, { byHand: true })]).length === 0
  && emptyWrappers([box("mine", 0, 0, 800, 90, { byHand: true })]).length === 0);
check("…nor fitted, even though it is taller than what it holds",
  slimWrappers([box("mine2", 0, 0, 800, 90, { byHand: true }), leaf("kid", 0, 0, 800, 20)]).length === 0);
check("an empty wrapper carrying a background is left where it is",
  slimWrappers([box("band", 0, 0, 1763, 60, { colour: { surface: "rgb(17,17,17)" } })]).length === 0);
check("and a wrapper that SHOWS something is still fitted, which is the banner",
  (() => {
    const d = slimWrappers([box("lit", 0, 0, 1763, 82, { colour: { surface: "rgb(17,17,17)" } }), leaf("only", 0, 0, 1280, 49)]);
    return d.length === 1 && d[0].id === "lit" && d[0].h === 49;
  })());

/*
 * EVERY PAGE STARTS AT 0,0 AGAIN, so containment is only ever within one
 * page. Without that, a box on page two sitting where a box on page one sits
 * makes each of them look full, and both are left as they are — or worse, a
 * wrapper is fitted to a child that is not on its page at all.
 */
check("a box on another page is not inside this one, however the coordinates line up",
  (() => {
    const both = [box("here", 0, 0, 800, 90), { ...leaf("there", 0, 0, 800, 20), pageId: "p1" }];
    return slimWrappers(both).length === 0 && emptyWrappers(both).some((f) => f.id === "here");
  })());

check("and the line a person reads says what was fitted",
  /fitted/.test(slimSays(slim)) && /px of empty box/.test(slimSays(slim)), slimSays(slim));
check("with nothing oversized, it says that instead", /No box/.test(slimSays([])), slimSays([]));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
