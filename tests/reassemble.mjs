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
import { sentences, saysWhat, WORDY } from "../src/features/studio/reassemble.ts";
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

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
