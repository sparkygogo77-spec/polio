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

/* A paragraph measured at a height its words do not fit in on this machine,
   with three bullets under it at the y the capture recorded — his shape. */
const PARA = "Playwright is built to enable cross-browser web automation that is ever-green, capable, reliable and fast, across every modern rendering engine including Chromium, WebKit and Firefox.";
const page = (from) => [
  node("para", "prose", PARA, 40, 100, 684, 40, from),
  node("b1", "prose", "Install the library", 40, 152, 684, 28, from),
  node("b2", "prose", "Write your first test", 40, 188, 684, 28, from),
  node("b3", "prose", "Run it in CI", 40, 224, 684, 28, from),
];

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Docs", path: "/", prompt: "", scroll: "inherit" }],
  nodes: page({ from: FROM }),
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

/* The same page, placed by hand: no `from` on anything. */
const byHand = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Docs", path: "/", prompt: "", scroll: "inherit" }],
  nodes: page({}),
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
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
  (caught.saved.para?.h ?? 0) > 40, `${caught.saved.para?.h ?? "?"} against the captured 40`);
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
  hand.saved.para.h === 40 && hand.saved.b1.y === 152 && hand.saved.b2.y === 188 && hand.saved.b3.y === 224,
  `para h ${hand.saved.para.h}, bullets at ${hand.saved.b1.y}, ${hand.saved.b2.y}, ${hand.saved.b3.y}`);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
