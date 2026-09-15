/**
 * WHAT THE TIMELINE COSTS WHILE NOTHING IS HAPPENING.
 *
 * Nobody is touching anything: whatever the number is, it is what the surface
 * costs to sit there. Trunk reported the timeline dropping 43 to 47 per cent
 * of its frames while idle, and the create space is measuring its own black
 * holes at the same time, so this measures the timeline *alone* — its own
 * page, its own constructs, nothing else on the screen — and says what each
 * layer of it is responsible for by taking that layer away and measuring
 * again.
 *
 * It reports rather than asserts. This container has no GPU and rasterises in
 * software, so the absolute numbers belong to this machine and nothing else;
 * what travels is the shape of the table, which is why every row is measured
 * on one build in one run against the row above it.
 *
 * It also answers the question a construct on a *button* raises: does the
 * cost go with how many construct surfaces are on the screen, or with how
 * much of the screen they cover? Those two have opposite consequences for
 * putting the texture on small chrome, so the last block holds the count
 * fixed and shrinks the constructs, then holds the size fixed and adds more.
 *
 *   node tests/idle-cost.mjs [url]        # default http://localhost:3000
 *   N=30 node tests/idle-cost.mjs         # how many boards (default 12)
 *
 * WHAT IT FOUND, AND WHAT WAS DONE ABOUT IT.
 *
 * At twelve boards the timeline dropped 43% of its frames with nobody
 * touching anything. It drops 0 to 4% now. The hunt is worth keeping,
 * because most of what looked like the answer was not.
 *
 * FIRST, WHAT IT IS NOT. The ground is not the culprit: the same page with
 * no boards on it at all drops nothing — 54 frames per 900ms, flat — however
 * much of it is moving. And the construct's own drifting layers are not the
 * culprit either: with the canvases quiet and the rim still, twelve cards
 * with both layers gliding also measured 54 and nothing dropped.
 *
 * It is the two of them together, and that is the whole shape of it. The
 * ground is a full-screen surface that never stops, so the viewport is
 * damaged on every frame; and every translucent layer stacked over a damaged
 * viewport is re-blended on every frame, whether or not it moved. A timeline
 * is a lot of translucent layers. Neither half is over budget and the two of
 * them together are, which is why every single-cause ablation only ever
 * moved the number a little:
 *
 *   the ground alone, no boards      54 /900ms    0% dropped
 *   the timeline alone, ground gone  43          20%
 *   the two of them                  31          43%
 *
 * So the cost is not "what moves". It is how much translucent area is
 * stacked over a viewport that is being repainted anyway — which is the same
 * law as the count-against-area finding below, seen from the other end.
 *
 * WHAT WAS CHANGED, each measured on its own at twelve boards:
 *
 *   the rim's breath, stopped                 43% → 36% dropped
 *   the clouds banded to where they show      38% → 14%
 *   the vine sheet drawn at the size it is
 *     shown rather than 2.2× it               about a tenth of the frames
 *   the closed cards' shadow tightened        three frames a second
 *
 * MEASURED OUT RATHER THAN KEPT, all of them tried: promoting the rim
 * instead of stopping it (worse than stopping it — it adds a layer per card
 * to a stack that is the problem); four quarter-height cloud layers so both
 * headings run in both bands (27% against the band's 14% — a layer costs
 * something beyond its area); taking the vignette to zero through the middle
 * instead of clipping (nothing at all — a masked pixel is still a pixel the
 * compositor multiplies, and only geometry is skipped); stepping any of the
 * animations (nothing, at every rate from fifteen a second down to one);
 * promoting the whole timeline onto one layer (nothing — its children are
 * already layers); and making the cards opaque, isolated or hard-contained
 * so the ground behind them could be culled (nothing, in any combination).
 *
 * WHERE IT STANDS, and read the pairs rather than the numbers: these are
 * software-rasterised frames on a shared container and the absolute figures
 * move with whatever else the box is doing. Every pair below is before and
 * after on one machine in one sitting.
 *
 *   on a quiet container
 *     12 boards, before                            43% dropped
 *     12 boards, after                             0–4%
 *
 *   on a loaded one (four samples each, means)
 *     12 boards, before                            44%
 *     12 boards, after                             28%
 *     12 boards, after, with the ground hidden      6%
 *     12 boards, after, ground and vines hidden     0%
 *
 * That last pair is the honest summary of what changed: the timeline's own
 * contribution went from 20% of frames to 6%, and what is left over is the
 * ground's per-frame damage passing through whatever translucent area still
 * stands over it. On a machine with headroom that residue disappears; on one
 * without, it is what you see.
 *
 *   30 boards, 31 constructs over 62% of the screen    63% → 50%
 *
 * THIRTY BOARDS, GONE AFTER PROPERLY, and the answer is that the biggest
 * thing on that screen is not what anyone thought. The vine *sheet* — the
 * canvas the ropes are painted on — is 95% empty and pays for all of it, so
 * it looked like the lever. It is not: at thirty boards it is worth four to
 * seven frames. The payer is the vines' own *cloud*, the nebula laid over
 * each rope, which costs thirteen: each light is the size of the whole gap
 * between two boards plus a period for its slide, and it is clipped to a
 * diagonal rope covering a twentieth of that. Taking the vine cloud away
 * entirely is 63% dropped to 42%, which is more than every card on the
 * screen is worth.
 *
 * Four ways at it were measured and three lost:
 *
 *   · **Clip the sheet to the tiles that have ink on them** (a `path()` of
 *     127 rectangles): nothing at all, 15.5 frames against 15.8. A complex
 *     clip is rasterised as a mask and a masked pixel is still a pixel. Only
 *     a rectangular inset culls — which is why the cards' band works.
 *   · **Tile the sheet into small canvases where the ink is**: worse. 162
 *     painted tiles covering a quarter of the field measured 22.0 against
 *     23.5 for one painted sheet covering all of it. An *empty* element is
 *     free — 166 of them measured identical to none — but a painted one has
 *     a cost beyond its area, and at that count it swamps the saving.
 *   · **Narrow the cards' band further at a far zoom** (26% → 18% → 12%):
 *     nothing, 17.6 against 16.4, inside the noise.
 *   · **One light a vine instead of two**, which is the one that stands: on
 *     a cable that is one temperature end to end — every vine in a chain of
 *     updates — the two lights were drawing the same tile at the same phase
 *     into complementary halves of the same rope. Merging them is pixel for
 *     pixel identical and takes about a quarter off what the vine cloud
 *     costs: the gap between "as it is" and "no vine cloud" goes from 13.0
 *     frames to 9.5. It does not move the headline number by more than this
 *     container's own drift, and it is kept because it is half the elements
 *     for the same picture, not because it is a win anyone can see.
 *
 * And one rejected on looks rather than on cost: dropping the vine cloud
 * below a zoom threshold, the way the cards drop theirs where the preview
 * covers it. At thirty boards a rope is 9.6px wide on screen and two crops
 * with and without are indistinguishable — but at twelve it is 10.9px and
 * the filaments crossing the ropes are plainly there. There is no threshold
 * that catches thirty without also catching twelve, and twelve is the case
 * that matters.
 *
 *   is it how many, or how big?                     12 boards    30 boards
 *     as it was                                      33 /900ms    21 /900ms
 *     the same constructs at a button's size         54           33
 *     half as many, still card-sized                 46           26
 *     a quarter of them, still card-sized            54           29
 *     one of them, card-sized                        54           39
 *
 * AREA, NOT COUNT, and it is not close. Twelve constructs shrunk to a
 * button's size — same twelve elements, same two animated layers each, over
 * 1% of the screen instead of 34% — cost exactly what removing them
 * altogether costs. Taking three quarters of them away while leaving them
 * card-sized does far less. The rasteriser here has no GPU, so what it pays
 * for is pixels re-blended per frame, and a construct's cost is its area.
 *
 * Which answers the question a construct on a 28px button raises: it is
 * cheap. Not "cheap if there are only a few" — twelve of them measured free.
 */
import { chromium } from "playwright-core";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const N = Number(process.env.N ?? 12);
const MS = Number(process.env.MS ?? 1800);

/* All of it inside `seed`: a function sent into a page arrives without its
   closure, so nothing here may reach for anything outside itself. */
const seed = (n) => {
  const pages = [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }];
  const part = (id, featureId, label, x, y, w, h) => ({
    id, pageId: "p0", featureId, label, prompt: "", content: "", data: "", x, y, w, h,
    groupId: null, options: {}, priority: "must", custom: false, colour: null, font: null,
    anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null,
    code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, link: null,
  });
  const nodes = [
    part("n1", "sticky-header", "Top bar", 0, 0, 1440, 64),
    part("n2", "hero-split", "Hero", 40, 90, 1360, 420),
    part("n3", "feature-cards", "What it does", 40, 540, 1360, 300),
    part("n4", "cta-primary", "Join", 560, 880, 320, 64),
  ];
  const brief = { name: "Orbit", gimmick: "", master: "" };
  const doc = { pages, nodes, groups: [], shapes: [], format: {}, look: {}, motion: [], activePageId: "p0", frameWidth: 1440, brief };
  const threads = [], spots = {};
  for (let i = 0; i < n; i++) {
    threads.push({ id: `t${i}`, at: 0, mode: ["plan", "critique", "build"][i % 3], state: "done",
      ask: `Iteration ${i}`, answer: "A plan.", changes: [`changed ${i} things`], parentId: i ? `t${i - 1}` : null, doc });
    spots[`t${i}`] = { x: 60 + (i % 5) * 680, y: 60 + Math.floor(i / 5) * 300 };
  }
  localStorage.setItem("builder.studio", JSON.stringify({ state: {
    pages, nodes, groups: [], shapes: [], format: {}, look: {}, motion: [],
    activePageId: "p0", frameWidth: 1440, brief,
    threads, threadSpots: spots, openThreadId: null, trail: [], liveThreadId: `t${n - 1}`,
    pinnedThreads: [], bookPinned: false, hiddenFeatures: [], companion: null, draftPieces: [], sentPieces: {},
  }, version: 0 }));
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
await p.addInitScript(seed, N);
await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.locator("[data-finish]").first().click();
await p.waitForTimeout(2200);

/*
 * Frames, read from the page's own rAF rather than from a profiler: a frame
 * that never arrived is the thing being complained about, and a frame that
 * never arrived leaves no trace in a profiler's task list.
 */
const START = `window.__f = []; (function l(){ window.__r = requestAnimationFrame((t) => { window.__f.push(t); l(); }); })();`;
const STOP = `cancelAnimationFrame(window.__r); (() => {
  const f = window.__f, d = [];
  for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  const span = f.length > 1 ? f[f.length - 1] - f[0] : 0;
  const s = [...d].sort((a, b) => a - b);
  const at = (q) => s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(1) : NaN;
  return {
    per900: span ? +(d.length / span * 900).toFixed(1) : 0,
    p50: at(0.5), p90: at(0.9),
    /* Against the sixty a second the machine would like to give: the share
       of frames that never arrived, which is the number trunk reported. */
    dropped: span ? +((1 - d.length / (span / 16.67)) * 100).toFixed(0) : 0,
  };
})()`;

/*
 * Every row says what was actually on the screen while it was measured: how
 * many constructs, and how much of the viewport they covered. An ablation
 * whose selector missed would otherwise read as "removing this changed
 * nothing", which is the most expensive kind of wrong answer here.
 */
const ON = () => p.evaluate(() => {
  let area = 0, n = 0;
  for (const el of document.querySelectorAll(".molten")) {
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).display === "none") continue;
    const w = Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left));
    const h = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
    if (w <= 0 || h <= 0) continue;
    n++; area += w * h;
  }
  return { n, share: +(area / (innerWidth * innerHeight) * 100).toFixed(0) };
});

/* Keeping every nth board and hiding the rest is done by hand rather than by
   selector: the boards are absolutely placed inside a surface and there is no
   `nth-of-type` that means "every other board" reliably. */
const KEEP_EVERY = (every) => p.evaluate((k) => {
  const boxes = [...document.querySelectorAll("[data-box], [data-piece]")];
  boxes.forEach((el, i) => {
    const holder = el.parentElement?.matches("[style*=translate], [style*=left]") ? el.parentElement : el;
    holder.style.display = k > 1 && i % k !== 0 ? "none" : "";
  });
}, every);

let tag = null;
const row = async (label, css, note = "") => {
  if (tag) { await tag.evaluate((el) => el.remove()).catch(() => {}); tag = null; }
  if (typeof css === "number") await KEEP_EVERY(css);
  else if (css) tag = await p.addStyleTag({ content: css });
  await p.waitForTimeout(800);
  const on = await ON();
  await p.evaluate(START);
  await p.waitForTimeout(MS);
  const r = await p.evaluate(STOP);
  console.log(`  ${label.padEnd(38)}${String(r.per900).padStart(6)} /900ms   dropped ${String(r.dropped).padStart(3)}%   ${String(on.n).padStart(2)} constructs over ${String(on.share).padStart(3)}% of the screen${note ? `   ${note}` : ""}`);
  return { ...r, ...on };
};

/* ------------------------------------------------------------------ */
/* 0. IS THIS INSTRUMENT SAYING ANYTHING?                              */
/* ------------------------------------------------------------------ */

/*
 * IT HAS A FLOOR, AND FOR MOST OF THIS FILE'S LIFE THE FLOOR WAS THE ANSWER.
 *
 * Everything below counts frames on a page that is animating, and subtracts
 * one surface at a time. That only ranks surfaces if taking a surface away
 * can move the number. On this container it cannot, past a certain amount of
 * content, and here is the proof — thirty boards, nothing on the page moving
 * except one bare element in the corner:
 *
 *   nothing moves at all                       53.7 /900ms    0% dropped
 *   + one 1x1 TRANSPARENT div sliding          54.0           0%   free
 *   + one 10x10 TRANSPARENT div sliding        54.0           0%   free
 *   + one 10x10 RED div sliding                20.3          62%
 *   + the same, promoted                       19.9          63%
 *   + the same, fading instead of sliding      20.3          62%
 *   + one 1x1 red div that exists, but still   54.0           0%   free
 *   the whole application as it is             20.6          62%
 *
 * One hundred painted pixels in motion cost exactly what the whole
 * application costs. The bill is not for what moves; it is for what is on
 * the page, and it falls due on every frame in which anything anywhere
 * moves at all:
 *
 *   boards   nothing moves   one 10x10 red square   the page as it is
 *      0        53.8            53.8   ( 0%)          53.9   ( 0%)
 *      6        54.0            29.6   (45%)          29.9   (45%)
 *     12        54.0            37.0   (31%)          32.4   (40%)
 *     30        54.0            21.6   (60%)          21.0   (61%)
 *
 * So at thirty boards this instrument reads about 20 whatever you take away,
 * and its ceiling only opens when literally nothing moves. Ablations run
 * there are comparing 20.3 against 20.6, which is noise against noise. That
 * is the honest reason every lever in this file's history came back worth
 * two or three frames.
 *
 * The block below measures the floor before the tables run and says in words
 * whether the tables can be believed. Nothing here asserts; a saturated run
 * is not a failure, it is a run whose ranking must be thrown away.
 */

const KF = "@keyframes probe { to { transform: translate3d(40px,0,0); } }";
/*
 * One 10x10 painted element, sliding: enough to force a full re-raster.
 *
 * `animation-play-state: running` is not decoration. This probe rides on
 * `body::after` and `QUIET` pauses `*::after`, both `!important`, so without
 * it the square is frozen by the very rule it is meant to be measured
 * against and the row reads a perfect 54 while claiming a square is moving.
 * `body::after` outranks `*::after` on specificity, so this wins. That row
 * lied once before anybody noticed.
 */
const SQUARE = `${KF} body::after{content:"";position:fixed;left:0;top:0;width:10px;height:10px;background:red;pointer-events:none;animation:probe 3s linear infinite;animation-play-state:running!important}`;
/*
 * Nothing moving at all — and that is harder than it sounds.
 *
 * `animation-play-state` stops CSS animations and nothing else. The ground's
 * embers are not a CSS animation: they are a rAF loop repainting a
 * full-pane canvas thirty times a second (`SPARK_MS`), so a "nothing moves"
 * row that only pauses animations still has the sparks going and reads
 * 24 rather than 54. It took a wrong verdict to notice. The canvas goes too.
 *
 * `.molten-key` is named because the Finish button lives outside the
 * timeline and outside the ground, and one 65x28 button is on its own
 * enough to hold the whole page at 61% dropped.
 */
const QUIET = "*,*::before,*::after{animation-play-state:paused!important}[data-ground-sparks]{display:none!important}";

const seen = await p.evaluate(() => ({
  constructs: document.querySelectorAll(".molten").length,
  onScreen: [...document.querySelectorAll(".molten")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }).length,
  holes: document.querySelectorAll("[data-space], [data-hole]").length,
}));

console.log("\ndoes this run mean anything? the floor first\n");
const ceiling = await row("nothing on the page moves at all", QUIET);
const floor = await row("…and one 10x10 red square slides", `${QUIET} ${SQUARE}`);
const asIs = await row("the page as it is", null);
{
  /*
   * Three verdicts, and the order matters.
   *
   * The ceiling first: "nothing moves" should read about 54 on an idle
   * container. If it does not, something else on the machine is eating the
   * frames — another suite, another browser — and NOTHING in this run can be
   * compared to anything, including the rows below it. I got this wrong
   * once by running the suites beside it, and the check told me there was
   * room when the floor had simply fallen with the ceiling.
   *
   * Then saturation: if one bare square alone costs what the whole page
   * costs, the page's surfaces are invisible behind it and cannot be ranked.
   */
  const gap = asIs.per900 - floor.per900;
  console.log(
    ceiling.per900 < 48
      ? `\n  THE MACHINE IS BUSY. With nothing on the page moving this should read\n` +
        `  about 54 and it reads ${ceiling.per900}. Something else is taking the frames —\n` +
        `  another suite, another browser, a build. Nothing in this run can be\n` +
        `  compared to anything. Run it on a quiet machine.\n`
      : Math.abs(gap) < 3
        ? `\n  SATURATED. One 10x10 square alone reads ${floor.per900} and the whole page\n` +
          `  reads ${asIs.per900} — ${Math.abs(gap).toFixed(1)} frames apart, which is noise. Every surface on the\n` +
          `  page together is adding nothing to what a single painted square already\n` +
          `  costs, so the tables below CANNOT rank them. Read block 3 instead, or\n` +
          `  run this on a machine with a GPU.\n`
        : `\n  There is room: the ceiling is ${ceiling.per900}, one square alone reads ${floor.per900},\n` +
          `  and the page reads ${asIs.per900} — ${Math.abs(gap).toFixed(1)} frames of range below the square. The\n` +
          `  tables below can rank.\n`,
  );
}

console.log(`\nthe timeline alone, idle — ${N} boards, ${seen.constructs} constructs (${seen.onScreen} of them on screen), ${seen.holes} of the create space's own\n`);
const CONSTRUCT = ".molten::before,.molten::after{display:none!important}[data-molten]{animation:none!important}";
const VINES = "canvas{display:none!important}";
await row("as it is");
await row("without the construct's own layers", CONSTRUCT);
await row("without the vines", VINES);
await row("without either", `${CONSTRUCT}${VINES}`);
await row("with nothing on the surface moving at all", "*{animation:none!important;transition:none!important}");

/*
 * COUNT OR AREA?
 *
 * The question a construct on a 28px button raises. If the cost goes with the
 * number of composited surfaces then a button is as expensive as a card and
 * putting the texture on chrome is dear; if it goes with how much of the
 * screen they cover then a button is nearly free. So: the same constructs
 * shrunk to a button's height, and then the same constructs at full size with
 * most of them taken away. One of those two moves the number.
 */
console.log("\nis it how many, or how big?\n");
const SMALL = "[data-box],[data-piece]{width:96px!important;height:28px!important;min-height:0!important;overflow:hidden!important}[data-box] > *:not([data-molten]),[data-piece] > *:not([data-molten]){display:none!important}";
await row("as it is", null, "the row above, again");
await row("the same constructs, at a button's size", SMALL);
await row("half as many, still card-sized", 2);
await row("a quarter of them, still card-sized", 4);
await row("one of them, card-sized", 99);
await KEEP_EVERY(1);

/* ------------------------------------------------------------------ */
/* 3. THE SAME QUESTION, ON AN INSTRUMENT WITH ROOM IN IT              */
/* ------------------------------------------------------------------ */

/*
 * If the page's own motion saturates the machine, stop the page's own motion
 * and bring your own. One 10x10 square forces the same full re-raster every
 * frame, and what the number then reports is the cost of the CONTENT — which
 * is the thing worth reducing, and which the square does not hide, because
 * the square is the same in every row.
 *
 * Measured range at thirty boards: 20.0 with the boards there against 31.5
 * with them hidden, so about eleven frames to work in where the table above
 * has one. Read this table for ranking and the tables above for history.
 */
console.log("\nthe same surfaces, driven by one 10x10 square instead of by themselves\n");
for (const [label, css] of [
  ["as it is", ""],
  ["without the construct's own layers", CONSTRUCT],
  ["without the vines", VINES],
  ["the boards hidden", "[data-box],[data-piece]{visibility:hidden!important}"],
]) await row(label, `${QUIET} ${SQUARE} ${css}`);

await b.close();
