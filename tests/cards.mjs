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
import { existsSync, readFileSync } from "node:fs";

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
check("an update's board is wide, because it holds a site", ratio(bw, bh) >= 2, `${bw}×${bh} is ${ratio(bw, bh)}:1`);
check("a drawing's board is close to square, for a picture", ratio(pw, ph) <= 1.3, `${pw}×${ph} is ${ratio(pw, ph)}:1`);
check("and they are not the same shape", ratio(bw, bh) !== ratio(pw, ph));
/*
 * They used to be the same area, on purpose: neither was the lesser thing.
 * That was true while a green card was a line of prose beside a silhouette.
 * A green card is the site now — the preview as that update left it — so it
 * is the thing the red cards are steps against, and J drew the size: about
 * two and a half times the width it was and twice the height.
 */
check("a green card is the site, so it is much the bigger of the two",
  bw * bh >= pw * ph * 3, `${bw}×${bh} against ${pw}×${ph}`);
check("…at about the size J drew on it", bw >= 560 && bw <= 680 && bh >= 180 && bh <= 240, `${bw}×${bh}`);
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
  const drawn = timeline.slice(timeline.indexOf("export function Drawn("), timeline.indexOf("function Card("));
  /*
   * The two widths were pinned as fractions of the view — 0.095 under 0.04 —
   * and that is the part that had to go: a fraction of the view means the
   * more a drawing is scaled the fatter its ink, which is why a drawing with
   * any detail in it closed into a mesh once it was given the whole card.
   * They are pixels now, read in the viewport rather than in the drawing's
   * own units, so the pin is the relationship rather than the numbers: dark
   * first, light second, and the light line the thinner of the two.
   */
  check("the ink is drawn twice: a dark line under it, then the line itself", (() => {
    const dark = /stroke=\{shade\} strokeWidth=\{dark\}/.test(drawn);
    const lit = /stroke=\{tone\} strokeWidth=\{dark \* ([\d.]+)\}/.exec(drawn);
    return dark && !!lit && Number(lit[1]) < 1 && drawn.indexOf("stroke={shade}") < drawn.indexOf("stroke={tone}");
  })());
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
/* 3b. A green card is the site                                        */
/* ------------------------------------------------------------------ */

/*
 * It was a line of prose beside a silhouette of grey rectangles, which says
 * how many things are on a page and nothing about what they are. Every
 * update carries the whole document it landed on, so the card can show the
 * real site — and only the parts that existed by that update, because the
 * ones that come later arrive on the cards that made them.
 */
const boxBlock = timeline.slice(timeline.indexOf("function IterationBox("), timeline.indexOf("function ElementPiece("));
check("the silhouette is gone", !/function Snippet\(/.test(timeline) && !/<Snippet /.test(timeline));
check("and the card carries the site, by the one definition of a site shown small",
  /<SiteShot thread=\{thread\} live=\{live\} \/>/.test(boxBlock) && /<SitePreview doc=/.test(timeline));
check("…off the document that update landed on, so what came later is not in it",
  /\(thread\.doc as PreviewDoc \| undefined\)/.test(timeline) && /data-site-live=\{live \? "1" : "0"\}/.test(timeline));
check("…and a card that is not in view costs nothing to have", /contentVisibility: "auto"/.test(timeline));
check("the prompting that made it sits above the site", (() => {
  const asked = boxBlock.indexOf("<Asked thread=");
  const site = boxBlock.indexOf("<SiteShot thread=");
  return asked > 0 && site > asked;
})());
check("…with a second page of it, to change the words before running them again",
  /data-asked-page=""/.test(timeline) && /data-asked-edit=""/.test(timeline));
check("…and Re-iterate is on the card itself, not in a menu", (() => {
  const at = timeline.indexOf("function BoxMenu(");
  const menu = at > 0 ? timeline.slice(at) : "";
  return at > 0 && /data-reiterate=\{thread\.id\}/.test(timeline) && !/Re-iterate/.test(menu);
})());
check("…which runs the book's own ask rather than a second pipeline of its own", (() => {
  const brief = readFileSync("src/features/studio/BriefDialog.tsx", "utf8");
  // The card goes through the book's one door, `askTheBook`, which parks
  // the ask until the book under the timeline is mounted: from the default
  // tab the event alone fired before anyone could hear it.
  return /askTheBook\(\{ mode: thread\.mode, prompt: words\.trim\(\), run: true \}\)/.test(timeline)
    && /new CustomEvent\("studio:ask"/.test(brief)
    && /if \(parked\) take\(parked\);/.test(brief)
    && /window\.addEventListener\("studio:ask", on\);/.test(brief)
    && /if \(layout !== "page"\) return;/.test(brief)
    && /void generate\(\);/.test(brief);
})());
/*
 * AND IT IS THE ORDINARY PREVIEW, NOT A TAKE ON ONE.
 *
 * This had its own: a site is taller than a card, so the frame showed a
 * band, and when everything an update touched sat below that band the frame
 * slid down to it and the card said how far. That answered a real problem —
 * two updates that both changed something low on the page are otherwise the
 * same picture twice — and it was the wrong answer, because it made a
 * preview that had to be read rather than looked at, and a card that was a
 * different kind of thing from every other preview of a site in the app.
 *
 * So: the same `SitePreview` the Builds page shows, given the snapshot the
 * update kept. One definition of what a site looks like small, in `studio`
 * because everything it is built from is, imported by both. A private copy
 * of a shared thing is the bug this repo names most often; two takes on one
 * are the same bug with better manners.
 */
check("the green card shows the site the way Builds shows it, from one definition", (() => {
  const site = timeline.slice(timeline.indexOf("function SiteShot("), timeline.indexOf("function Features("));
  return /<SitePreview doc=\{from\} width=\{W\} height=\{H\} \/>/.test(site)
    && /import \{ SitePreview, type PreviewDoc \} from ".\/SitePreview";/.test(timeline);
})());
check("…and there is only one of it: Builds imports the same file", (() => {
  const builds = readFileSync("src/features/builds/BuildsPage.tsx", "utf8");
  return /from "@\/features\/studio\/SitePreview"/.test(builds)
    && !existsSync("src/features/builds/SitePreview.tsx");
})());
check("…with no take of its own left on the card: no moving band, no chip about one", (() => {
  const site = timeline.slice(timeline.indexOf("function SiteShot("), timeline.indexOf("function Features("));
  return !/data-site-at/.test(timeline) && !/where it changed/.test(timeline)
    && !/translateY/.test(site) && !/const band =/.test(site);
})());
check("the newest card is the board as it stands; every other one is the document it landed on", (() => {
  const site = timeline.slice(timeline.indexOf("function SiteShot("), timeline.indexOf("function Features("));
  return /live \? now : \(thread\.doc as PreviewDoc \| undefined\) \?\? null/.test(site);
})());
check("…and one that kept no document says so rather than borrowing today's site",
  /no picture of the site was kept with this one/.test(timeline));
check("the feature list sits under the site", (() => {
  const site = boxBlock.indexOf("<SiteShot thread=");
  const feat = boxBlock.indexOf("<Features thread=");
  return site > 0 && feat > site;
})());
check("…naming the parts on it, with this update's own lit", (() => {
  const f = timeline.slice(timeline.indexOf("function Features("));
  return /data-feature-new=\{mine\.has\(n\.id\) \? "1" : "0"\}/.test(f) && /const first = !parent\?\.doc;/.test(timeline);
})());
check("…worked out from the two documents rather than parsed back out of a sentence", (() => {
  const at = timeline.indexOf("function ownParts(");
  if (at < 0) return false;
  const f = timeline.slice(at, at + 1600);
  // `diffDocs` writes sentences — "+ Top bar placed", "~ Hero: 240×80 → 240×120"
  // — and picking a name back out of one is a parser waiting to be wrong
  // about a part called "placed". Nothing here calls it.
  return !/diffDocs\(/.test(f);
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
check("the Builder answers (a liveness probe: this suite has no live half, the wiring above is held by source pins)", live, live ? url : `${url} did not answer`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
