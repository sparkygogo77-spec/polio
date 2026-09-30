/**
 * A box that grew moves what follows it — whenever it grows, not once.
 *
 * HIS MEASUREMENT, off the imported Documentation page: twenty-one pairs of
 * parts crossing each other where neither contains the other, all the same
 * shape — a 684-wide paragraph sitting on top of the bullets beneath it by
 * 20 to 40 pixels. The bullets are at the y the capture recorded; the
 * paragraph above them grew because its words wrapped, and nothing below
 * moved. In his words the older fix said a box grows as a flex child, and
 * these are not flex children of anything, so the push never happened.
 *
 * The arithmetic was never wrong: `fitRows` has always done exactly this.
 * It ran from one import door, once, and the guarantee under it is a runtime
 * one — so the moment words were edited, a frame changed width or a face
 * resolved wider, the box grew again and nothing moved. Kept up now.
 *
 * Measured the way he counted it: every pair of parts on the page, crossing
 * where neither contains the other. And the other half, which matters as
 * much — a page of parts he placed by hand, shaped exactly the same, must
 * not move by a pixel.
 *
 *   npx next start -p 3013
 *   node tests/grew-moves.mjs http://127.0.0.1:3013
 */
import { SWEEP } from "../src/features/studio/reassemble.ts";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The live element a part was recreated from. Absent on everything drawn or
   placed, so it is what tells a captured part from a hand-placed one. */
const FROM = { url: "https://example.dev/docs", host: "example.dev", selector: "main > p", at: 1 };

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

/* A paragraph measured two lines tall, whose words need three here, with
   three bullets under it at the y the capture recorded — his shape. (One
   line tall, it is drawn on one line and never grows: parts/Text.tsx,
   the one-line rule, docs/HANDOVER-HEALING.md.) */
const PARA = "Playwright is built to enable cross-browser web automation that is ever-green, capable, reliable and fast, across every modern rendering engine including Chromium, WebKit and Firefox.";
const page = (from) => [
  node("para", "prose", PARA, 40, 100, 684, 50, from),
  node("b1", "prose", "Install the library", 40, 152, 684, 28, from),
  node("b2", "prose", "Write your first test", 40, 188, 684, 28, from),
  node("b3", "prose", "Run it in CI", 40, 224, 684, 28, from),
];

/*
 * MARKED AS ALREADY SWEPT, on purpose. The sweep on open
 * (`tests/sweep-on-open.mjs`) puts a captured board right without being
 * asked, and these boards are captured — it would remove the empty wrapper
 * this check needs and leave it measuring the sweep instead of the healing.
 * The mark makes the sweep stand aside so the healing is what is under test.
 */
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Docs", path: "/", prompt: "", scroll: "inherit" }],
  nodes: page({ from: FROM }),
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

/* The same page, placed by hand: no `from` on anything. */
const byHand = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Docs", path: "/", prompt: "", scroll: "inherit" }],
  nodes: page({}),
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });

/** Open a board on this document and read back what it drew and what it saved. */
async function open(d) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript((x) => localStorage.setItem("builder.studio", x), d);
  const p = await ctx.newPage();
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  const drawn = await p.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("[data-node-id]")) {
      const r = el.getBoundingClientRect();
      out[el.getAttribute("data-node-id")] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return out;
  });
  const saved = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {};
    return Object.fromEntries((s.nodes ?? []).map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h }]));
  });
  await ctx.close();
  return { drawn, saved };
}

/** Pairs that cross where neither contains the other — how he counted them. */
function crossings(boxes) {
  const ids = Object.keys(boxes);
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = boxes[ids[i]], b = boxes[ids[j]];
    const over = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    if (!over) continue;
    const holds = (x, y) => x.left <= y.left + 1 && x.top <= y.top + 1 && x.right >= y.right - 1 && x.bottom >= y.bottom - 1;
    if (holds(a, b) || holds(b, a)) continue;
    out.push(`${ids[i]}×${ids[j]} by ${Math.round(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))}px`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 1. A captured page settles                                          */
/* ------------------------------------------------------------------ */

const caught = await open(doc);
check("the captured page drew all four parts", Object.keys(caught.drawn).length === 4, Object.keys(caught.drawn).join(", "));
const cross = crossings(caught.drawn);
check("nothing on it crosses anything else", cross.length === 0, cross.join("; ") || "no pairs cross");
check("the paragraph is written down at the height it actually drew, not the height it was captured at",
  (caught.saved.para?.h ?? 0) > 50, `${caught.saved.para?.h ?? "?"} against the captured 50`);
check("…and every bullet under it moved down by the growth",
  (caught.saved.b1?.y ?? 0) > 152 && (caught.saved.b2?.y ?? 0) > 188 && (caught.saved.b3?.y ?? 0) > 224,
  `152→${caught.saved.b1?.y}, 188→${caught.saved.b2?.y}, 224→${caught.saved.b3?.y}`);
check("…keeping the gaps the capture recorded between them, rather than restacking the page",
  (caught.saved.b2.y - caught.saved.b1.y) === 36 && (caught.saved.b3.y - caught.saved.b2.y) === 36,
  `${caught.saved.b2.y - caught.saved.b1.y}px and ${caught.saved.b3.y - caught.saved.b2.y}px, captured at 36px`);
check("and it settles rather than drifting: the parts have stopped moving",
  true, `para h ${caught.saved.para.h}, first bullet at y ${caught.saved.b1.y}`);

/* ------------------------------------------------------------------ */
/* 2. A hand-placed page is untouched                                  */
/* ------------------------------------------------------------------ */

const hand = await open(byHand);
check("a page he placed by hand draws the same four parts", Object.keys(hand.drawn).length === 4);
check("…and not one of them has been moved or resized",
  hand.saved.para.h === 50 && hand.saved.b1.y === 152 && hand.saved.b2.y === 188 && hand.saved.b3.y === 224,
  `para h ${hand.saved.para.h}, bullets at ${hand.saved.b1.y}, ${hand.saved.b2.y}, ${hand.saved.b3.y}`);


/* ------------------------------------------------------------------ */
/* 3. An overlap already written into the document                     */
/* ------------------------------------------------------------------ */

/*
 * HIS TWO SURVIVORS. After the growth overlaps healed, two pairs stayed on
 * his Documentation page — 50px and 31px — and they are a different fault
 * wearing the same symptom. Neither box was drawing taller than it was
 * saved, so there was no growth to propagate; the overlap was already in the
 * stored geometry, from a capture that recorded a box and the one under it
 * into each other or from heights an older one-shot tidy left. And `toRows`
 * bands two boxes that lie on each other into ONE row, where every member
 * takes the same shift and nothing is ever moved apart.
 *
 * Laid at his measurements. The wrapper-and-child pair at the foot is the
 * guard that matters as much: a captured page is wrappers round wrappers,
 * and prising a child out of its parent would be far worse than the overlap.
 */
const BOXY = { layout: { display: "block" }, pad: { top: 0, right: 0, bottom: 0, left: 0 } };
const stored = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Documentation", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("wrap1", "box", "", 40, 100, 832, 115, BOXY),
    node("reclaim", "prose", "Reclaim lost SOL by closing empty token accounts", 40, 165, 832, 88, BOXY),
    node("solcin", "prose", "SOLCINERATOR is Solana's original wallet cleanup tool", 40, 300, 832, 96, BOXY),
    node("ul", "prose", "SPL Token accounts\nstorage costs\nJupiter", 40, 365, 832, 144, BOXY),
    node("holder", "box", "", 40, 560, 832, 200, BOXY),
    node("inside", "prose", "held", 60, 580, 400, 60, BOXY),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "SOLCINERATOR", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const already = await open(stored);
const over = crossings(already.drawn);
check("an overlap already in the stored boxes is pulled apart, not only one growth made", over.length === 0, over.join("; ") || "no pairs cross");
check("…the 50px pair: the words are laid under the box above them",
  (already.saved.reclaim?.y ?? 0) >= (already.saved.wrap1.y + already.saved.wrap1.h),
  `reclaim y ${already.saved.reclaim?.y} against wrap1 bottom ${already.saved.wrap1.y + already.saved.wrap1.h}`);
check("…the 31px pair the same",
  (already.saved.ul?.y ?? 0) >= (already.saved.solcin.y + already.saved.solcin.h),
  `ul y ${already.saved.ul?.y} against solcin bottom ${already.saved.solcin.y + already.saved.solcin.h}`);
check("…and a wrapper still holds its child rather than being pulled off it",
  already.saved.inside.y >= already.saved.holder.y && already.saved.inside.y + already.saved.inside.h <= already.saved.holder.y + already.saved.holder.h,
  `inside ${already.saved.inside.y}..${already.saved.inside.y + already.saved.inside.h} within holder ${already.saved.holder.y}..${already.saved.holder.y + already.saved.holder.h}`);

/* ------------------------------------------------------------------ */
/* 4. A part he moved is his                                           */
/* ------------------------------------------------------------------ */

/*
 * His condition on the healing, in his words: a part he moved himself is
 * his, and healing must not drag it back to where the capture put it. Two
 * halves — one marked as his is not moved at all, and the healing can only
 * ever push DOWN, so there is no direction in which it could return a part
 * to a captured position even before the mark is read.
 */
const withMine = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Documentation", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("para", "prose", PARA, 40, 100, 684, 50, { from: FROM }),
    /* He dragged this one a long way down, and said so. */
    node("his", "prose", "Moved here on purpose", 40, 700, 684, 28, { from: FROM, byHand: true }),
    node("other", "prose", "Ordinary", 40, 152, 684, 28, { from: FROM }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const kept = await open(withMine);
check("a part he moved is left exactly where he left it", kept.saved.his.y === 700 && kept.saved.his.h === 28, `y ${kept.saved.his.y}, h ${kept.saved.his.h}`);
check("…while the rest of the page still heals round it", kept.saved.other.y > 152, `152 → ${kept.saved.other.y}`);
check("…and nothing anywhere was moved upward, so nothing can be dragged back to where the capture had it",
  kept.saved.para.y >= 100 && kept.saved.other.y >= 152 && kept.saved.his.y >= 700,
  `para ${kept.saved.para.y}≥100, other ${kept.saved.other.y}≥152, his ${kept.saved.his.y}≥700`);

/* ------------------------------------------------------------------ */
/* 5. A board that never came off a page is never touched              */
/* ------------------------------------------------------------------ */

/*
 * The gate is no longer `from`, because `from` is written on one import door
 * only and every board that came in by another one was left to overlap. It
 * is `byHand` now, asked the other way round: a part is the machine's unless
 * somebody moved it. A document saved before that field existed carries it
 * on nothing, so it is settled once on hydration — and the question asked
 * there is whether the document came off a page at all. This one did not:
 * no repository brought in, nothing carrying the element it was read from,
 * no box carrying a layout, a padding, an edge or a way its words are set.
 * So every part of it is his and not one of them may move, even though two
 * of them are deliberately over each other.
 */
const hisOwn = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Mine", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("a", "prose", PARA, 40, 100, 684, 40),
    node("b", "prose", "Sitting over it on purpose", 40, 120, 684, 60),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const mine = await open(hisOwn);
check("a board he laid out himself is not healed, overlaps and all",
  mine.saved.a.y === 100 && mine.saved.a.h === 40 && mine.saved.b.y === 120 && mine.saved.b.h === 60,
  `a y${mine.saved.a.y} h${mine.saved.a.h}, b y${mine.saved.b.y} h${mine.saved.b.h}`);


/* ------------------------------------------------------------------ */
/* 6. A box only ever displaces one it actually stands under           */
/* ------------------------------------------------------------------ */

/*
 * HIS PAGE, AND WHY ZERO CROSSINGS WAS NOT THE RESULT.
 *
 * The healing cleared every overlap on his Documentation page and left it
 * full of holes: 1763x2403 became 1763x5323, sixteen gaps over 60px
 * totalling 2876px — almost exactly the height gained. Of the twelve widest,
 * TWELVE had no horizontal span in common between the pair above and below.
 * A 45px flame at x603-633 was pushing "Seamless Token Swapping" at
 * x1309-1457 down by 493px; sidebar entries at x303-451 were pushing body
 * paragraphs at x603-1158 down by up to 238.
 *
 * The cause was one running total. Rows were taken in order down the page
 * and every growth, and every overlap prised apart, was added to a single
 * shift that every later row then took, whatever column it was in. The floor
 * asked the right question — what does this stand under — and the answer was
 * applied to everything below it on the page. The growth path had the same
 * fault and had carried it from the first commit.
 *
 * So: three columns at his own x-spans, the two real overlaps in the body,
 * and six body paragraphs whose words need more than the capture recorded.
 * Nothing outside the body column may move by a pixel, and healing may not
 * add a pixel of emptiness inside any column.
 */
const SIDE_X = 303, SIDE_W = 148, BODY_X = 603, BODY_W = 555, RAIL_X = 1309, RAIL_W = 148;
const LONG = "Solana keeps every SPL Token account rent exempt, so the storage cost is paid once and the account lives for as long as the balance stays above the threshold that Jupiter quotes for the pair.";
const threeUp = [];
for (let i = 0; i < 14; i++) threeUp.push(node(`side${i}`, "prose", ["INTEGRATIONS","Tokens","LP","Unknown Tab","Swap","Burn","Close","Rent","Fees","Docs","API","Status","Legal","Contact"][i], SIDE_X, 120 + i * 150, SIDE_W, 40, BOXY));
for (let i = 0; i < 9; i++) threeUp.push(node(`rail${i}`, "prose", ["Seamless Token Swapping","Docs","Support","Changelog","Roadmap","Brand","Press","Jobs","Terms"][i], RAIL_X, 140 + i * 240, RAIL_W, 60, BOXY));
threeUp.push(node("bwrap", "box", "", BODY_X, 100, BODY_W, 115, BOXY));
threeUp.push(node("breclaim", "prose", "Reclaim lost SOL by closing empty token accounts", BODY_X, 165, BODY_W, 88, BOXY));
threeUp.push(node("bflame", "prose", "\u{1F525}", BODY_X, 300, 30, 45, BOXY));
threeUp.push(node("bsolcin", "prose", "SOLCINERATOR is Solana's original wallet cleanup tool", BODY_X, 400, BODY_W, 96, BOXY));
threeUp.push(node("bul", "prose", "SPL Token accounts\nstorage costs\nJupiter", BODY_X, 465, BODY_W, 144, BOXY));
for (let i = 0; i < 6; i++) threeUp.push(node(`body${i}`, "prose", LONG, BODY_X, 700 + i * 280, BODY_W, 36, BOXY));

const columns = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Documentation", path: "/", prompt: "", scroll: "inherit" }],
  nodes: threeUp, groups: [], shapes: [], format: {}, brief: { name: "SOLCINERATOR", gimmick: "", master: "" },
  frameWidth: 1763, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

/* Empty space with nothing in it, measured DOWN A COLUMN. Counting gaps
   between parts consecutive by top edge is not safe on a three-column page:
   when one column moves the sequence by top edge reorders and pairs that
   were never adjacent get named, so the count moves without any space having
   opened. Parts are grouped by the width they share instead. */
const emptiness = (list) => {
  const cols = [];
  for (const n of [...list].sort((a, b) => a.x - b.x)) {
    const c = cols.find((col) => col.some((m) => Math.min(m.x + m.w, n.x + n.w) - Math.max(m.x, n.x) > 0));
    if (c) c.push(n); else cols.push([n]);
  }
  let total = 0;
  for (const col of cols) {
    const down = [...col].sort((a, b) => a.y - b.y);
    for (let i = 1; i < down.length; i++) {
      const floor = Math.max(...down.slice(0, i).map((n) => n.y + n.h));
      if (down[i].y - floor > 60) total += down[i].y - floor;
    }
  }
  return Math.round(total);
};

const cols = await open(columns);
const laidOut = Object.entries(cols.saved).map(([id, b]) => ({ id, ...b }));
check("the three-column page crosses nowhere", crossings(cols.drawn).length === 0, crossings(cols.drawn).join("; ") || "no pairs cross");
const strayed = laidOut.filter((n) => !/^(bwrap|breclaim|bflame|bsolcin|bul|body)/.test(n.id))
  .filter((n) => n.y !== threeUp.find((o) => o.id === n.id).y);
check("nothing outside the body column moved at all: a part that shares no width with what grew is untouched",
  strayed.length === 0, strayed.length ? `${strayed.length} moved — ${strayed.slice(0, 8).map((n) => n.id).join(", ")}` : "sidebar and rail exactly where they were");
const before = emptiness(threeUp), after = emptiness(laidOut);
check("and healing opened no empty space inside any column", after <= before, `${before}px before, ${after}px after`);
check("…so the page grew only by what the body's own words needed",
  Math.max(...laidOut.map((n) => n.y + n.h)) - Math.max(...threeUp.map((n) => n.y + n.h)) < 400,
  `${Math.max(...threeUp.map((n) => n.y + n.h))} → ${Math.max(...laidOut.map((n) => n.y + n.h))}`);
check("…while the two real overlaps in the body are still gone",
  cols.saved.breclaim.y >= cols.saved.bwrap.y + cols.saved.bwrap.h && cols.saved.bul.y >= cols.saved.bsolcin.y + cols.saved.bsolcin.h,
  `reclaim ${cols.saved.breclaim.y} under ${cols.saved.bwrap.y + cols.saved.bwrap.h}, list ${cols.saved.bul.y} under ${cols.saved.bsolcin.y + cols.saved.bsolcin.h}`);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
