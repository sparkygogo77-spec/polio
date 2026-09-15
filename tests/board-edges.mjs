/**
 * What is drawn outside the page shows on the ground, on all four sides.
 *
 * THE FAULT. The page's box clipped to itself. The page grows *downward* to
 * meet what is drawn — `frameHeight` takes the lowest thing on it — so ink
 * below the last part pushed the box out and stayed visible. Nothing grows
 * it upward or sideways, and nothing should: the page's origin is the
 * site's top-left, and moving it would renumber every coordinate in the
 * document. So anything at a negative coordinate fell outside the box and
 * was thrown away.
 *
 * WHY NOTHING CAUGHT IT. The check that was meant to was
 * `scrollHeight > clientHeight`, and that can only ever see overflow below
 * and to the right — a box with content above it reports `scrollHeight`
 * equal to `clientHeight`, in every browser. Measured with a stroke at
 * y -34 on a stock page: 900 against 900, while 28px of a drawn line sat
 * above the edge, unreachable by any gesture. Two of the four sides were
 * invisible to the instrument, so the instrument is not used here.
 *
 * WHAT IS READ INSTEAD. The drawn things themselves. For each one, walk its
 * ancestors up to the board and ask whether any of them, having a clip on,
 * cuts a piece off it. That sees all four sides because it compares two
 * rectangles rather than trusting a scroll height. Above the board is fair
 * game — the pane and the window clip whatever is off-screen, which is what
 * panning and scrolling are for.
 *
 *   node tests/board-edges.mjs [url]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A stock page is 900 tall and the desktop frame 1440 across. */
const PAGE_H = 900;
const PAGE_W = 1440;
const line = (id, pts) => ({ id, pageId: "page_home", kind: "pen", hue: 200, width: 4, label: "", prompt: "", points: pts });

/*
 * One stroke off each side, and one safely inside as the control. Each is
 * clear of the page by more than any rounding could explain.
 */
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [],
    nodes: [{
      id: "n0", pageId: "page_home", featureId: "custom-idea", label: "part", prompt: "", content: "", data: "",
      x: 300, y: 300, w: 600, h: 200, groupId: null, options: {}, priority: "must", custom: true,
      glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1,
      animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
      cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
    }],
    shapes: [
      /* J's own case: a stroke above the page's top. */
      line("above", [[300, -34], [520, -14], [740, -44]]),
      line("left", [[-90, 300], [-40, 340], [-70, 380]]),
      line("right", [[PAGE_W + 40, 300], [PAGE_W + 140, 340], [PAGE_W + 80, 380]]),
      /* Below is the side that already worked, because the page grows to it.
         It is here so the run says whether that is still true. */
      line("below", [[300, PAGE_H + 120], [520, PAGE_H + 160], [740, PAGE_H + 130]]),
      line("inside", [[300, 700], [520, 740], [740, 710]]),
      /* Far above, not just over the edge. The gutter above the page is 64px
         of ground, so a stroke a little over the top still lands on the
         board; one well above it has to be reachable too, or "it shows on
         the ground" only holds for the first inch of ground. */
      line("far", [[300, -520], [520, -480], [740, -510]]),
    ],
  },
  version: 0,
};

/**
 * Is any of this drawn thing cut off by something between it and the board?
 *
 * Two rectangles compared, on all four sides. Ancestors above the board are
 * skipped on purpose: the pane scrolls and the board pans, so a thing off
 * the edge of those is reachable, not lost.
 */
const CUT = () => {
  const board = document.querySelector("[data-studio-pane]")?.firstElementChild;
  const out = {};
  for (const el of document.querySelectorAll("[data-shape-id]")) {
    const id = el.getAttribute("data-shape-id");
    const r = el.getBoundingClientRect();
    let lost = null;
    for (let a = el.parentElement; a && a !== board; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) continue;
      const b = a.getBoundingClientRect();
      const cut = {
        top: Math.round(b.top - r.top), left: Math.round(b.left - r.left),
        right: Math.round(r.right - b.right), bottom: Math.round(r.bottom - b.bottom),
      };
      const worst = Object.entries(cut).filter(([, v]) => v > 1);
      if (worst.length) {
        lost = `${a.getAttribute("data-page-window") !== null ? "[data-page-window]" : (a.className || "").toString().slice(0, 30)} takes ${worst.map(([k, v]) => `${v}px off the ${k}`).join(" and ")}`;
        break;
      }
    }
    out[id] = { cut: lost, w: Math.round(r.width), h: Math.round(r.height) };
  }
  return out;
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1267, height: 1354 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc);
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const seen = await page.evaluate(CUT);
check("all six drawn lines are on the board", Object.keys(seen).length === 6, Object.keys(seen).join(", "));
for (const side of ["above", "left", "right", "below"]) {
  check(`a line off the ${side} of the page is not cut`, seen[side] && !seen[side].cut,
    seen[side]?.cut ?? `${seen[side]?.w}×${seen[side]?.h}, whole`);
}
check("and one drawn inside is untouched, as it always was",
  seen.inside && !seen.inside.cut, seen.inside?.cut ?? "whole");

/*
 * The page keeps its origin, and grows only downward.
 *
 * This is the other half of the decision and it matters as much: the fix is
 * that the page stops clipping, NOT that it grows to swallow whatever is
 * drawn near it. y=0 is the site's top; a stroke above it must not move the
 * page or renumber the part below.
 *
 * Measured by difference rather than against a constant, because a constant
 * got it wrong the first time: the page *is* 1220 here, and correctly so —
 * the stroke below the page pushes it out to meet it, which is what growing
 * downward means. The question is only whether the one ABOVE changes
 * anything, so the same document is loaded twice, with it and without.
 */
const heightOf = async (withAbove) => {
  const p2 = await browser.newPage({ viewport: { width: 1267, height: 1354 } });
  const d = JSON.parse(JSON.stringify(doc));
  if (!withAbove) d.state.shapes = d.state.shapes.filter((x) => x.id !== "above");
  await p2.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p2.evaluate((x) => localStorage.setItem("builder.studio", JSON.stringify(x)), d);
  await p2.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(1600);
  const out = await p2.evaluate(() => {
    const f = document.querySelector("[data-frame]");
    const n = [...document.querySelectorAll("[data-node-id]")][0];
    const fr = f.getBoundingClientRect();
    return {
      pageH: f.clientHeight,
      /* Where the part sits inside the page, which is the number that must
         not move: the site's own coordinates. */
      partFromTop: n ? Math.round(n.getBoundingClientRect().top - fr.top) : null,
    };
  });
  await p2.close();
  return out;
};

const withIt = await heightOf(true);
const without = await heightOf(false);
check("a line above the page does not grow the page",
  withIt.pageH === without.pageH, `${without.pageH} without it, ${withIt.pageH} with it`);
check("and does not shift what is on the page",
  withIt.partFromTop === without.partFromTop && withIt.partFromTop !== null,
  `the part sits ${withIt.partFromTop}px below the page's top either way`);
/* The side that always worked, restated as a number rather than assumed:
   the page reaches past the ink below it. */
check("the page still grows downward to hold what is drawn below it",
  withIt.pageH > PAGE_H + 200, `${withIt.pageH} tall for ink at ${PAGE_H + 160}`);

/*
 * And reachable, not merely uncut. A thing can be whole and still be
 * somewhere no gesture reaches: above the board's own top, the pane cannot
 * scroll to it, because a scroller only ever travels down and right.
 */
const reach = await page.evaluate(() => {
  const pane = document.querySelector("[data-studio-pane]");
  const board = pane.firstElementChild;
  const out = {};
  for (const el of document.querySelectorAll("[data-shape-id]")) {
    const r = el.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    out[el.getAttribute("data-shape-id")] = {
      aboveBoard: Math.round(b.top - r.top),
      belowBoard: Math.round(r.bottom - b.bottom),
    };
  }
  return out;
});
for (const side of ["above", "far"]) {
  check(`a line ${side} the page is on the board's own surface`,
    reach[side] && reach[side].aboveBoard <= 1,
    reach[side] ? `${reach[side].aboveBoard}px above the board's top` : "-");
}

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
