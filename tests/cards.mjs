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
/*
 * THE ELEMENT, NOT THE DRAWING OF IT.
 *
 * The card carried the strokes played back: two circles and a square drawn,
 * two circles and a square returned, which tells a person nothing they did
 * not just draw. What belongs on it is the thing the drawing became, as it
 * exists on the page — the board's own renderer, the real node, the site's
 * palette and light. The drawing stands in only while the part is still
 * being made, because at that moment it is honestly all there is.
 */
check("the card shows the part it made, not the strokes it was drawn from",
  /<Made thread=\{thread\} skin=\{\{ rim: "oklch\(0\.46 0\.157 18 \/ 0\.7\)"/.test(pieceBlock));
check("…and the drawing only while there is no part yet", (() => {
  const i = pieceBlock.indexOf("forming < 1 && !thread.madeId");
  const j = pieceBlock.indexOf("<Drawn sketch=", i);
  const k = pieceBlock.indexOf("<Made thread=", i);
  return i > 0 && j > i && k > j;
})());
check("…and it is live when the card is open, and inert when it is not, so a closed box can be dragged",
  /live=\{open\}/.test(pieceBlock));
check("the card is a surface rather than a button, because an element inside a button cannot be used",
  /<div\n\s+role="button"/.test(pieceBlock) && /tabIndex=\{0\}/.test(pieceBlock) && !/<button\n\s+type="button"\n\s+data-box=/.test(pieceBlock));
check("and it is centred, not tucked beside the words", /items-stretch justify-center/.test(pieceBlock) && /grid flex-1 place-items-center/.test(pieceBlock));
/*
 * AND IT READS AGAINST ITS OWN CARD.
 *
 * The face is J's render now, and a render is not one value — dark between
 * the filaments, near white along them — so no single ink colour lands on
 * both. A red line at 0.9 lightness sat at nearly the value of the card it
 * was on and the drawing sank into it, which was the note off a screenshot.
 * The answer is the construct's own: light with the material's dark behind
 * it, so each stroke is drawn twice.
 */
{
  const drawn = timeline.slice(timeline.indexOf("export function Drawn("), timeline.indexOf("export function Drawn(") + 1400);
  check("the ink is drawn twice: a dark line under it, then the line itself", (() => (
    /stroke=\{shade\} strokeWidth=\{0\.095\}/.test(drawn) && /stroke=\{tone\} strokeWidth=\{0\.04\}/.test(drawn)
      && drawn.indexOf("stroke={shade}") < drawn.indexOf("stroke={tone}")
  ))());
  check("…and the ink itself is near white, not a red on a red", (() => {
    const tones = [...timeline.matchAll(/<Drawn sketch=[^>]*tone="oklch\(([\d.]+)/g)].map((m) => Number(m[1]));
    return tones.length > 0 && tones.every((l) => l >= 0.95);
  })(), [...timeline.matchAll(/<Drawn sketch=[^>]*tone="oklch\(([\d.]+)/g)].map((m) => m[1]).join(", "));
}
check("the name sits under it", (() => {
  const mark = pieceBlock.indexOf("<Made thread=");
  const name = pieceBlock.indexOf('data-headline=""');
  return mark > 0 && name > mark;
})());
/* "made real" was a caption under every red card saying the one thing a red
   card cannot help saying by existing. It is gone; what is left under the
   name is the count, and only when there is one. */
check("and nothing under that but the count, when there is one",
  !/made real/.test(pieceBlock) && /and \{thread\.changes\.length - 1\} more/.test(pieceBlock));

/* ------------------------------------------------------------------ */
/* 3. What changed shows the thing                                     */
/* ------------------------------------------------------------------ */

check("the card renders the part it made", /<Made thread=\{thread\} skin=\{skin\} height=\{element \? 150 : 96\} live \/>/.test(timeline));
check("with the board's own renderer, so it is the part and not a second drawing of it",
  /<Block node=\{node\}[\s\S]{0,220}mode=\{live \? "live" : "board"\}/.test(timeline));
check("live where there is room for it, and inert where the thing under it is dragged",
  /\{\.\.\.\(live \? \{\} : \{ "aria-hidden": true, inert: true \}\)\}/.test(timeline));
check("…and a live one keeps its own presses off the box it sits on",
  /onPointerDown: \(e: React\.PointerEvent\) => e\.stopPropagation\(\)/.test(timeline));
check("it fits rather than crops", /Math\.min\(W \/ Math\.max\(1, node\.w\), height \/ Math\.max\(1, node\.h\), 1\)/.test(timeline));
/*
 * TIED TO THE PART STILL BEING THERE.
 *
 * A part can be deleted off the board after the update that made it. The
 * link was in the data all along — the editor underneath already said so —
 * and it was not driving the picture; the card showed the strokes either
 * way, which is a picture of something that is not there.
 */
check("and when the part has been deleted since, the card says so rather than showing anything",
  /data-made-gone=""/.test(timeline) && /the part this made is no longer on the board/.test(timeline));
check("…and an update that made nothing says that instead", /this one made nothing on the board/.test(timeline));
check("the line of text is under it, not instead of it", (() => {
  const made = timeline.indexOf("<Made thread={thread} skin={skin} height=");
  const list = timeline.indexOf("changed.map((l, i)", made);
  return made > 0 && list > made;
})());
/*
 * AND THE OUTPUT IS THE ELEMENT.
 *
 * It began with a text box: four closed shapes described in prose at the top
 * of the card, with the part itself further down under a heading about the
 * board. A sentence about a thing is not the output of making it. What
 * Claude said is kept, because it is the record of the call — under the
 * thing rather than instead of it.
 */
check("the output side leads with the part", (() => {
  const out = timeline.indexOf('side === "in" ? (');
  const made = timeline.indexOf("<Made thread={thread} skin={skin} height=", out);
  const said = timeline.indexOf("{thread.answer || \"nothing came back\"}", out);
  return made > 0 && said > made;
})());
check("…and what was said is folded away under it", /<summary data-said-head=""/.test(timeline));

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
/* 4b. The cards, as J asked: no label, one-word headlines, a panel     */
/* ------------------------------------------------------------------ */

check("the red box no longer says \"drawing\" across its top", (() => {
  const head = pieceBlock.slice(0, pieceBlock.indexOf("<Made thread="));
  return !/>\s*drawing\s*</.test(head) && !/<Brush className="size-3" \/>\s*drawing/.test(head);
})());
/*
 * AND NOTHING GREEN ON IT.
 *
 * There was a green flag and a green dot on every card: the flag marked the
 * update being worked in, the dot said whether the process had finished.
 * Two green marks on a red card, neither about the element the card is for.
 * The flag is in the box's own menu now, where the rest of what can be done
 * to an update lives; the dot is gone, because a card still working is
 * visibly forming, one that was given up on hangs off a grey vine, and
 * "finished" was a mark on nearly every card nearly all of the time.
 */
check("no flag and no state dot on any card, red or green",
  !/<CurrentButton/.test(timeline) && !/<StateMark/.test(timeline)
  && !/function StateMark\(/.test(timeline) && !/function CurrentButton\(/.test(timeline));
check("…and the flag is in the menu instead, still the one control that means it", (() => {
  const menu = timeline.slice(timeline.indexOf("function BoxMenu("));
  return /Work in this one/.test(menu) && /setCurrentThread\(current \? null : thread\.id\)/.test(menu)
    && /"data-current-for": thread\.id/.test(menu);
})());
check("but the pin stays on the card, because it is about the card", /\{pinned \? \(/.test(pieceBlock));

const cardBlock = timeline.slice(timeline.indexOf("function Card("), timeline.indexOf("function Bill("));
// The words a person sees, not the comments explaining why they changed.
const cardShown = cardBlock.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
check("a detail box headlines exactly Input or Output and nothing more",
  /\{side === "in" \? "Input" : "Output"\}/.test(cardShown) && !/what went in/.test(cardShown) && !/what came out/.test(cardShown));
check("the copy control is off the headline, in the corner", (() => {
  const head = cardBlock.indexOf('data-reading-head={side}');
  const copy = cardBlock.indexOf("<CopyBit");
  const headEnd = cardBlock.indexOf("</p>", head);
  return head > 0 && copy > headEnd;
})());
check("a detail box is the reading family, not another card: no lift, squarer, near-neutral face",
  /data-reading=""/.test(cardBlock) && !/shadow-pop/.test(cardBlock) && /rounded-\[4px\]/.test(cardBlock)
  && /face: "oklch\(0\.15 0\.018 18\)"/.test(cardBlock) && /face: "oklch\(0\.145 0\.016 152\)"/.test(cardBlock));
check("its colour lives in a hairline rim rather than a filled face", /rim: "oklch\([\d. ]+ 18 \/ 0\.7\)"/.test(cardBlock));

const studio = readFileSync("src/features/studio/StudioPage.tsx", "utf8");
check("the side panel stays up in the timeline", /\{book && libraryOpen \? \(/.test(studio) && /data-side-panel-timeline=""/.test(studio));
check("and in the timeline it carries the card you clicked", /<TimelinePanel \/>/.test(studio));
const detail = readFileSync("src/features/studio/TimelineDetail.tsx", "utf8");
check("that panel reads the open card, and only it", /const open = threads\.find\(\(t\) => t\.id === openId\) \?\? null;/.test(detail.slice(detail.indexOf("export function TimelinePanel"))));
check("with its own Input and Output, distinctly",
  /head="Input"\n\s+text=\{open\.ask\}/.test(detail) && /head="Output"\n\s+text=\{open\.answer\}/.test(detail));
/*
 * And each of them leads with the thing. The drawing sat above both blocks
 * on its own and the output was a paragraph — "four closed shapes, two of
 * them circles" — with the element itself two inches away on the board.
 */
check("…the drawing inside Input, because the drawing is what went in",
  /show=\{open\.sketch\?\.strokes\?\.length \? \(/.test(detail));
check("…and the part inside Output, live, because the part is what came out",
  /show=\{open\.madeId \? <Made thread=\{open\} skin=\{skin\} width=\{186\} height=\{120\} live \/> : null\}/.test(detail));
check("and says what to do when nothing is open", /data-timeline-panel-empty=""/.test(detail));

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
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
