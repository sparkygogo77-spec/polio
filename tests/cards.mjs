/**
 * The two cards a board opens into.
 *
 * Four things were wrong with them, all the same mistake in different places:
 * words standing in for the thing they describe.
 *
 *   · "what changed on the board" said "drew Bird at 300 × 140", which is a
 *     receipt. It shows the part now, still, with the line underneath;
 *   · a part drawn on more than once had one input on its card and the rest
 *     scattered on other boards, so "which drawing led to this" could not be
 *     answered from the thing it led to. The goes are paged through;
 *   · a drawing's board led with its name and illustrated it with a
 *     thumbnail. The drawing is the subject now, large and central;
 *   · and the two kinds of board are different shapes, because one holds a
 *     line of prose and the other holds a picture.
 *
 *   node tests/cards.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");

/* ------------------------------------------------------------------ */
/* 1. Two shapes, one weight                                           */
/* ------------------------------------------------------------------ */

const box = /const BOX = \{ w: (\d+), h: (\d+) \}/.exec(timeline);
const piece = /const PIECE = \{ w: (\d+), h: (\d+) \}/.exec(timeline);
check("both shapes are declared", !!box && !!piece);
const bw = +box[1], bh = +box[2], pw = +piece[1], ph = +piece[2];
const ratio = (w, h) => +(w / h).toFixed(2);
check("an iteration's board is wide, for a line of prose", ratio(bw, bh) >= 2, `${bw}×${bh} is ${ratio(bw, bh)}:1`);
check("a drawing's board is close to square, for a picture", ratio(pw, ph) <= 1.3, `${pw}×${ph} is ${ratio(pw, ph)}:1`);
check("and they are not the same shape", ratio(bw, bh) !== ratio(pw, ph));
check("neither is the lesser thing: the areas are within a tenth", (() => {
  const a = bw * bh, c = pw * ph;
  return Math.abs(a - c) / Math.max(a, c) <= 0.1;
})(), `${bw * bh} against ${pw * ph}`);
check("which shape a board takes follows what it holds", /isElement\(t\) \? PIECE : BOX/.test(timeline));

/* ------------------------------------------------------------------ */
/* 2. The drawing is the subject of its own board                      */
/* ------------------------------------------------------------------ */

const pieceBlock = timeline.slice(timeline.indexOf("function ElementPiece("), timeline.indexOf("function thin("));
check("the mark is big rather than a thumbnail", /<Drawn sketch=\{thread\.sketch\} size=\{62\}/.test(pieceBlock),
  /size=\{(\d+)\}/.exec(pieceBlock)?.[1]);
check("and it is centred, not tucked beside the words", /items-center justify-center/.test(pieceBlock));
check("the name sits under it", (() => {
  const mark = pieceBlock.indexOf("<Drawn sketch");
  const name = pieceBlock.indexOf('data-headline=""');
  return mark > 0 && name > mark;
})());
check("and the small line under that", (() => {
  const name = pieceBlock.indexOf('data-headline=""');
  return pieceBlock.indexOf("made real", name) > name;
})());

/* ------------------------------------------------------------------ */
/* 3. What changed shows the thing                                     */
/* ------------------------------------------------------------------ */

check("the card renders the part it made", /<Made thread=\{thread\} skin=\{skin\} \/>/.test(timeline));
check("with the board's own renderer, so it is the part and not a second drawing of it",
  /<Block node=\{node\}[\s\S]{0,200}mode="board"/.test(timeline));
check("still, and untouchable", /aria-hidden\s+inert/.test(timeline));
check("it fits rather than crops", /Math\.min\(W \/ Math\.max\(1, node\.w\), H \/ Math\.max\(1, node\.h\), 1\)/.test(timeline));
check("nothing is shown when the part has been deleted since", /if \(!node\) return null;/.test(timeline));
check("the line of text is under it, not instead of it", (() => {
  const made = timeline.indexOf("<Made thread=");
  const list = timeline.indexOf("changed.map((l, i)", made);
  return made > 0 && list > made;
})());

/* ------------------------------------------------------------------ */
/* 4. Paging the goes                                                  */
/* ------------------------------------------------------------------ */

check("what went in knows about every go at the same part", /threads\.filter\(\(t\) => t\.madeId === thread\.madeId\)/.test(timeline));
check("it pages rather than stacking or replacing", /data-go-back=""/.test(timeline) && /data-go-next=""/.test(timeline));
check("it opens on the go belonging to the iteration you opened", /React\.useEffect\(\(\) => setPage\(mine\)/.test(timeline));
check("a part drawn once gets no pager, because one page is not a sequence", /\{many \? \(/.test(timeline));
check("and stepping off this one says what that go led to", /what that one led to/.test(timeline));
check("the pager cannot run off either end", /disabled=\{page === 0\}/.test(timeline) && /disabled=\{page >= goes\.length - 1\}/.test(timeline));

/* ------------------------------------------------------------------ */
/* 5. Nothing else moved                                               */
/* ------------------------------------------------------------------ */

check("an iteration is still the green construct", /moltenClass\("verdant"\)/.test(timeline));
check("a drawing is still the red one", /moltenClass\("ember"\)/.test(timeline));
check("still no clock anywhere", !/toLocaleTimeString/.test(timeline));

/* ------------------------------------------------------------------ */
/* 6. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
