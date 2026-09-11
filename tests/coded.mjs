/**
 * The catalogue of coded parts, and the road that is no longer the only one.
 *
 * Interpretation used to have one answer for every drawing: trace it and
 * clip the part to the line. This holds the second road open and keeps the
 * first one honest.
 *
 *   · a catalogue entry declares what it is, what it needs and what a
 *     drawing has to look like to mean it, so the next one is a file;
 *   · a drawing that plainly is one of them picks it, for nothing, the
 *     same way every time;
 *   · a drawing that is not leaves the catalogue alone and goes the way it
 *     always did, to the reader and then to the vectorizer;
 *   · and no matcher may call anything.
 *
 *   node tests/coded.mjs [url]      # default http://localhost:3000
 */
import { CODED, SURE_ENOUGH, codedLines, isCoded, pickCoded } from "../src/features/studio/coded.ts";
import { FEATURES } from "../src/features/studio/catalog.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const sketch = (strokes, words = "") => ({ strokes, words });
const ctx = (strokes, words = "", prompt = "", node = null) => ({ sketch: sketch(strokes, words), prompt, node });

const RECT = [[0.24, 0.26], [0.76, 0.26], [0.76, 0.74], [0.24, 0.74], [0.24, 0.26]];
const ISO = (() => {
  const c = [0.5, 0.5], up = [0.5, 0.2], dl = [0.22, 0.36], dr = [0.78, 0.36], bl = [0.22, 0.68], br = [0.78, 0.68], dn = [0.5, 0.82];
  const q = (a, b, cc, d) => [a, b, cc, d, a];
  return [q(c, dl, up, dr), q(c, dl, bl, dn), q(c, dr, br, dn)];
})();
const HELIX = [(() => {
  const out = [];
  for (let i = 0; i <= 90; i++) { const t = i / 90; out.push([0.5 + Math.sin(t * Math.PI * 6) * 0.16, 0.2 + t * 0.6]); }
  for (let i = 90; i >= 0; i--) { const t = i / 90; out.push([0.5 + Math.sin(t * Math.PI * 6) * 0.07, 0.2 + t * 0.6]); }
  return out;
})()];
const STAR = [Array.from({ length: 11 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 ? 0.13 : 0.32;
  return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r];
})];

/* ------------------------------------------------------------------ */
/* 1. Every entry declares itself                                      */
/* ------------------------------------------------------------------ */

check("the catalogue has parts in it", CODED.length >= 1, `${CODED.length}`);
for (const p of CODED) {
  check(`${p.id} says what it is, what it needs and what it looks like`,
    p.what.length > 20 && p.needs.length > 20 && p.looksLike.length > 20);
  check(`${p.id} becomes a part the library actually has`, FEATURES.some((f) => f.id === p.featureId), p.featureId);
  check(`${p.id} answers with a number between nothing and certain`, [0, 1].every((_, i) => {
    const v = p.match(ctx(i ? ISO : HELIX));
    return typeof v === "number" && v >= 0 && v <= 1;
  }));
  check(`${p.id} is reachable from isCoded`, isCoded(p.featureId));
}
check("ids are unique", new Set(CODED.map((p) => p.id)).size === CODED.length);
check("the catalogue can be read out in lines", codedLines().length === CODED.length && codedLines()[0].includes("→"));
check("the bar is a real bar, not zero", SURE_ENOUGH > 0 && SURE_ENOUGH <= 1, String(SURE_ENOUGH));

/* ------------------------------------------------------------------ */
/* 2. What picks, and what does not                                    */
/* ------------------------------------------------------------------ */

check("an isometric box picks the cube", pickCoded(ctx(ISO))?.part.id === "cube");
check("a rectangle with the word picks it too", pickCoded(ctx([RECT], "make this a cube"))?.part.id === "cube");
check("and the element's own prompt counts as the word", pickCoded(ctx([RECT], "", "a rotating box of our three pillars"))?.part.id === "cube");
check("a bare rectangle picks nothing", pickCoded(ctx([RECT], "the offer")) === null);
check("a helix picks nothing, and goes to be traced", pickCoded(ctx(HELIX, "a helix of sentences")) === null);
check("a star picks nothing either", pickCoded(ctx(STAR, "a star of five claims")) === null);
check("nothing drawn picks nothing", pickCoded(ctx([], "a cube")) === null);
check("the words alone are not enough without a shape", pickCoded(ctx([[[0.2, 0.5], [0.8, 0.5]]], "a cube")) === null);

/* The second entry: a stack of bars, gated so a plain list stays a list. */
const BARS = [
  [[0.30, 0.32], [0.70, 0.32]],
  [[0.26, 0.50], [0.74, 0.50]],
  [[0.22, 0.68], [0.78, 0.68]],
];
const FRAMED = [RECT, [[0.30, 0.38], [0.70, 0.38]], [[0.30, 0.50], [0.70, 0.50]], [[0.30, 0.62], [0.70, 0.62]]];

check("a plain stack of bars is still a list, not an accordion", pickCoded(ctx(BARS, "a 3 stack")) === null);
check("the same bars with the word pick the accordion", pickCoded(ctx(BARS, "an accordion: How it works, Pricing, Support"))?.part.id === "accordion");
check("so does FAQ", pickCoded(ctx(BARS, "the faq"))?.part.id === "accordion");
check("and bars drawn inside a box need no word at all", pickCoded(ctx(FRAMED, "questions"))?.part.id === "accordion");
check("two bars are not a stack", pickCoded(ctx(BARS.slice(0, 2), "an accordion")) === null);
{
  const c = ctx(BARS, "an accordion: How it works, Pricing: from nothing, Support");
  const { patch, did } = pickCoded(c).part.configure(c);
  check("the lead-in goes and each row is a row", patch.content === "How it works, Pricing: from nothing, Support", patch.content);
  check("a colon inside a row is left alone", patch.content.includes("Pricing: from nothing"));
  check("it says how many rows", /3 rows/.test(did), did);
  check("and it replaces the cutout rather than keeping one", patch.outline === null && patch.featureId === "accordion");
}
check("the catalogue is proven by two, not one", CODED.length >= 2, CODED.map((p) => p.id).join(" · "));

/* ------------------------------------------------------------------ */
/* 3. What it configures                                               */
/* ------------------------------------------------------------------ */

{
  const pick = pickCoded(ctx(ISO, "a cube with our three pillars: Speed, Proof, Reach"));
  const { patch, did } = pick.part.configure(ctx(ISO, "a cube with our three pillars: Speed, Proof, Reach"));
  check("it configures the part it declared", patch.featureId === pick.part.featureId, patch.featureId);
  check("the drawing's words become the faces", patch.cube.faces.slice(0, 3).map((f) => f.heading).join(",") === "Speed,Proof,Reach",
    patch.cube.faces.map((f) => f.heading || "-").join(" · "));
  check("the faces nobody wrote stay blank", patch.cube.faces.slice(3).every((f) => !f.heading && !f.body));
  check("it gives up the clip, because a solid that turns cannot keep one", patch.outline === null && patch.shape === null);
  check("it comes out square", patch.w === patch.h, `${patch.w}×${patch.h}`);
  check("and it says what it did", /3 of 6 faces written/.test(did), did);
}
{
  const node = { w: 300, h: 300, content: "A, B", prompt: "" };
  const { patch } = CODED[0].configure({ sketch: sketch(ISO, "a cube"), prompt: "", node });
  check("the content field beats the drawing's words", patch.cube.faces[0].heading === "A" && patch.cube.faces[1].heading === "B");
}

/* ------------------------------------------------------------------ */
/* 4. No matcher may call anything                                     */
/* ------------------------------------------------------------------ */

{
  const real = globalThis.fetch;
  let called = 0;
  globalThis.fetch = () => { called++; return Promise.reject(new Error("no")); };
  for (const p of CODED) { p.match(ctx(ISO, "a cube")); p.match(ctx(HELIX)); p.match(ctx([RECT], "the offer")); }
  globalThis.fetch = real;
  check("deciding costs nothing and reaches nothing", called === 0, `${called} calls`);
}
{
  // Twice over the same drawing is twice the same answer.
  const a = pickCoded(ctx(ISO, "a cube"));
  const b = pickCoded(ctx(ISO, "a cube"));
  check("and it decides the same way every time", a?.part.id === b?.part.id && a?.score === b?.score, `${a?.score}`);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
