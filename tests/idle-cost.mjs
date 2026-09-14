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
 * WHAT IT SAID, the first time it was run, on this container:
 *
 *   12 boards, 12 constructs over 34% of the screen
 *     as it is                          32 /900ms   40% dropped
 *     without the construct's layers     54          0%
 *     without the vines                  54          0%
 *     without either                     54          0%
 *
 *   30 boards, 30 constructs over 62% of the screen
 *     as it is                          20 /900ms   63% dropped
 *     without the construct's layers     32         41%
 *     without the vines                  27         50%
 *     without either                     54          0%
 *
 * So the 43 to 47 per cent trunk reported is the timeline on its own: no
 * black hole is on this screen at all, and the two things paying for it are
 * the construct surface and the vine canvas. At twelve boards either one
 * alone fits inside the frame and the two together do not, which is why
 * taking away either recovers the whole of it; at thirty they are separately
 * over budget and the split shows.
 *
 *   is it how many, or how big?                     12 boards    30 boards
 *     as it is                                       33 /900ms    21 /900ms
 *     the same constructs at a button's size         54           33
 *     half as many, still card-sized                 46           26
 *     a quarter of them, still card-sized            54           29
 *     one of them, card-sized                        54           39
 *
 * AREA, NOT COUNT, and it is not close. Twelve constructs shrunk to a
 * button's size — same twelve elements, same two animated layers each, 1% of
 * the screen instead of 34% — cost exactly what removing them altogether
 * costs: 54 and nothing dropped at twelve boards, 33 against 32 at thirty.
 * Taking three quarters of them away while leaving them card-sized does far
 * less. The rasteriser here has no GPU, so what it pays for is pixels
 * repainted per frame, and a construct's cost is its area.
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

const seen = await p.evaluate(() => ({
  constructs: document.querySelectorAll(".molten").length,
  onScreen: [...document.querySelectorAll(".molten")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }).length,
  holes: document.querySelectorAll("[data-space], [data-hole]").length,
}));

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

await b.close();
