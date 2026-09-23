/**
 * A node's words as runs, and the two rules that keep a sentence one thing.
 *
 * HIS PAGE. One line reads a Solana mark, "$118.35", a down arrow, "-0.46%"
 * — one sentence, several colours, inline. The board showed "$" and "116.59"
 * stacked on one side, "-1.94" and "%" on the other, the arrow adrift. His
 * header reads "A Sol Works project" where "Works" is a different face; the
 * board made three parts of it and "A Sol" wrapped inside a box too short
 * for it. His own diagnosis and it is right: the words disconnect because of
 * the colour difference, and the boxes touching is what shortens the one
 * before. Sizing cannot fix it — centring is a property of a line, and four
 * fragments sitting near each other are not a line.
 *
 * Pure, so it can be run red without a browser or a build:
 *   node tests/spans-hold.mjs
 */
import { alike, isSpans, lines, merged, plain, spansOf } from "../src/features/studio/parts/spans.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------------------ */
/* 1. A plain string stays valid, permanently                          */
/* ------------------------------------------------------------------ */

check("a plain string reads back as itself", plain("A Sol Works project") === "A Sol Works project");
check("…and becomes one run carrying nothing of its own",
  same(spansOf("A Sol Works project"), [{ text: "A Sol Works project" }]));
check("…and is not mistaken for runs", isSpans("A Sol") === false && isSpans([{ text: "A Sol" }]) === true);
check("nothing at all is no runs and no words", spansOf(null).length === 0 && plain(undefined) === "");
check("an empty string is no runs, not one empty run", spansOf("").length === 0);

/* ------------------------------------------------------------------ */
/* 2. His sentence, held as one thing                                  */
/* ------------------------------------------------------------------ */

const price = [
  { text: "$118.35", weight: 600 },
  { text: " " },
  { text: "-0.46%", colour: "rgb(239, 68, 68)" },
];
check("a sentence with a colour in the middle is one part's words", spansOf(price).length === 3);
check("…and reads back character for character, spacing included",
  plain(price) === "$118.35 -0.46%", JSON.stringify(plain(price)));
/* The reconstruction rule: joined with nothing between, because a span
   carries its own spacing. A join that inserted anything, or a trim on the
   way in, would silently rewrite his line. */
check("…so the words are never rewritten by being stored as runs",
  plain(spansOf(price)) === plain(price));

/* ------------------------------------------------------------------ */
/* 3. A run that says nothing belongs to the run beside it             */
/* ------------------------------------------------------------------ */

/*
 * Not tidiness. A capture that emits one span per text node turns "for the
 * builders, believers, and bold thinkers" into eleven runs of identical ink,
 * and every boundary is a chance for a renderer to break the line where a
 * browser would not.
 */
const eleven = "for the builders, believers, and bold thinkers".split(" ").map((w, i, a) => ({ text: i === a.length - 1 ? w : w + " " }));
check("eleven runs of the same ink become one", merged(eleven).length === 1, `${merged(eleven).length} runs`);
check("…with the sentence intact", plain(merged(eleven)) === "for the builders, believers, and bold thinkers");
check("but a run that differs is kept apart", merged(price).length === 3);
check("…and only the fields a reader can see decide it",
  alike({ text: "a" }, { text: "b" }) === true
  && alike({ text: "a", colour: "red" }, { text: "b" }) === false
  && alike({ text: "a", weight: 600 }, { text: "b", weight: 400 }) === false
  && alike({ text: "a", italic: true }, { text: "b" }) === false
  && alike({ text: "a", face: "Inter" }, { text: "b", face: "Inter" }) === true);
check("…two links to the same place are one run, to different places are two",
  alike({ text: "a", link: { kind: "page", target: "p1" } }, { text: "b", link: { kind: "page", target: "p1" } }) === true
  && alike({ text: "a", link: { kind: "page", target: "p1" } }, { text: "b", link: { kind: "page", target: "p2" } }) === false);
check("merging three that agree with one that does not leaves two",
  same(merged([{ text: "A " }, { text: "Sol " }, { text: "Works", face: "Mono" }, { text: " project" }]).map((s) => s.text),
       ["A Sol ", "Works", " project"]));

/* ------------------------------------------------------------------ */
/* 4. A run never straddles a newline                                  */
/* ------------------------------------------------------------------ */

/*
 * The other rule of the contract. `items` splits a node's content on
 * newlines, and a span boundary is not a line boundary: a run crossing one
 * would put half a coloured word on each of two lines, and a part that
 * splits its own content would lose the ink on everything after the first.
 */
const twoLines = [{ text: "SPL Token accounts\nstorage ", colour: "rgb(1,2,3)" }, { text: "costs" }];
const cut = lines(twoLines);
check("a run carrying a newline is cut at it", cut.length === 2, `${cut.length} lines`);
/* Indexed defensively: run against a tree where the cut does not happen,
   this suite must report the reds rather than die on an undefined line and
   leave every check after it unrun. */
const ink = (i) => cut[i]?.[0]?.colour ?? null;
check("…each line keeping its own ink", ink(0) === "rgb(1,2,3)" && ink(1) === "rgb(1,2,3)", `${ink(0)} / ${ink(1)}`);
check("…and no run anywhere still holds a newline",
  cut.every((l) => l.every((s) => !s.text.includes("\n"))));
check("…with the words unchanged across the cut",
  cut.map((l) => plain(l)).join("\n") === plain(twoLines));
check("one line in, one line out", lines("A Sol Works project").length === 1);
check("a plain string with newlines cuts the same way",
  same(lines("one\ntwo").map((l) => plain(l)), ["one", "two"]));
/* Lines only. Commas are a part's own business: prose splits on lines, the
   details table on lines and then commas, and a paragraph that happens to
   contain commas is one paragraph. */
check("commas are never a line break here", lines("a, b, c").length === 1);
check("and each line comes back merged, not in fragments",
  lines([{ text: "A " }, { text: "Sol\nWorks" }, { text: " project" }]).every((l) => l.length === 1));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
