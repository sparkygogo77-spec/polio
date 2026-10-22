/**
 * The board is as tall as the site, and exactly one thing scrolls.
 *
 * These are J's four assertions, in his words, and this file exists because
 * the version before it reported 36 of 36 while all four were false on the
 * deploy. Two things let that happen, and both are fixed here rather than
 * worked around:
 *
 *  1. IT NEVER SAID WHAT IT MEASURED. A suite pointed at a dev server on
 *     this machine and a browser pointed at a deployment are two different
 *     documents, and nothing in the output told them apart. It asks
 *     `/api/version` now and prints the commit, the branch and the URL at
 *     the top of every run. If the answer disagrees with the branch you
 *     think you are testing, that is on the screen before any check runs.
 *
 *  2. IT MEASURED AN IMPOVERISHED DOCUMENT. The fixture was parts and
 *     nothing else, and `frameHeight` counted parts and nothing else, so
 *     the two agreed with each other and neither agreed with a real page.
 *     One pen stroke below the page hid 138px behind the window's edge and
 *     no check could see it. The fixture has ink and a drawn space below
 *     the last part now, because that is what a person's page has.
 *
 * And it derives the board by walking OUT from the site frame to whichever
 * ancestor is a child of the pane — the way a person enumerates it in dev
 * tools — rather than by a class name or a guessed selector. A selector
 * that stops matching silently measures the wrong element; this cannot,
 * and says so if the walk fails.
 *
 *   node tests/full-page.mjs [url]        # default http://localhost:3000
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

/**
 * Ground above the page. There is none below it.
 *
 * It was 128 — 64 above and 64 below, the same as each side. J measured the
 * result and called it too much headroom: the gap above should be much
 * slimmer than the sides, and the website should have no underside gap at
 * all. So it is 20 above and nothing below, and the sides keep their 64,
 * which is the part he likes.
 */
const GUTTER = 20;
/** The shelf band: `BAND_H` is clamp(132px, 32vh, 248px). */
const bandOf = (h) => Math.min(248, Math.max(132, Math.round(h * 0.32)));

/**
 * A page like a person's: parts, and then the things they draw on it.
 *
 * The ink and the space sit below the last part *and* below the stock 900
 * the page floors at, which is the case that used to be invisible: the
 * window is sized from the page's height, so anything the height does not
 * count is drawn behind an edge that cannot be scrolled past.
 */
const page_ = (n = 6, drawnOn = true) => {
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`, pageId: "page_home", featureId: "custom-idea", label: `part ${i}`, prompt: "", content: "", data: "",
    x: 120, y: 80 + i * 420, w: 900, h: 320, groupId: null, options: {}, priority: "must", custom: true,
    glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1,
    animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
    cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
  }));
  const floor = Math.max(900, nodes.length ? nodes[nodes.length - 1].y + nodes[nodes.length - 1].h : 0);
  return {
    state: {
      pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
      activePageId: "page_home", groups: [], selection: [], threads: [], nodes,
      shapes: drawnOn ? [{
        id: "ink0", pageId: "page_home", kind: "pen", hue: 200, width: 3, label: "", prompt: "",
        points: [[200, floor + 100], [400, floor + 180], [600, floor + 120]],
      }] : [],
      spaces: drawnOn ? [{
        id: "sp0", pageId: "page_home", since: null, prompt: "", label: "", plan: null, locked: null, placed: [],
        boundary: [[700, floor + 90], [980, floor + 90], [980, floor + 260], [700, floor + 260], [700, floor + 90]],
      }] : [],
    },
    version: 0,
  };
};

/**
 * Every number these checks need, read off the live document.
 *
 * `board` is found by walking out from the site frame, so it is whatever
 * element actually stands in the pane, whatever it is called.
 */
const LOOK = () => {
  const frames = [...document.querySelectorAll("[data-frame]")];
  const frame = frames[0];
  const pane = document.querySelector("[data-studio-pane]");
  let board = null;
  for (let el = frame; el && el.parentElement; el = el.parentElement) {
    if (el.parentElement === pane) { board = el; break; }
  }
  const chain = [];
  for (let el = frame, i = 1; el && i < 9; el = el.parentElement, i++) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    chain.push(`    ${i}. ${(el.className || "").toString().slice(0, 60) || "(no class)"} — rect ${Math.round(r.width)}x${Math.round(r.height)}, client ${el.clientHeight}, scroll ${el.scrollHeight}, overflowY ${cs.overflowY}`);
  }
  /*
   * Everything on the page that can scroll and has somewhere to go, split
   * into the ones that could move the SITE and the ones that cannot.
   *
   * J's third assertion is "exactly one element scrolls", written from a
   * document where his enumeration came back empty. Run against a narrow
   * window it is not one: `[data-look-panel]` in the side panel has 185px
   * at 1500x950 and 415px at 1280x720 (a long list of controls, which is
   * what a panel is), and `[data-shelf]` has 10px at 1280x720 (the
   * categories scrolling inside their own band, which is asked for
   * elsewhere and is not the site).
   *
   * So the rule is narrowed, deliberately and on the record: of the
   * elements that can move the site — its ancestors, and anything inside
   * it — exactly one scrolls, and it is the pane. Any other scroller on
   * the page is printed beside it rather than failing the run, because a
   * panel that scrolls its own contents was never the complaint.
   */
  const mine = [];
  const elsewhere = [];
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
    const row = {
      what: el.getAttribute("data-studio-pane") !== null ? "[data-studio-pane]" : (el.className || "").toString().slice(0, 34),
      travel: el.scrollHeight - el.clientHeight,
      isPane: el === pane,
    };
    /* Could this one move the site? Only if the site is inside it, or it is
       inside the site. */
    (frame && (el.contains(frame) || frame.contains(el)) ? mine : elsewhere).push(row);
  }
  const movers = mine;
  /* Anything between the site and the document that is holding content back. */
  const hiders = [];
  for (let el = frame; el; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "hidden" || oy === "clip") && el.scrollHeight > el.clientHeight + 1) {
      hiders.push(`${el.getAttribute("data-page-window") !== null ? "[data-page-window]" : (el.className || "").toString().slice(0, 34)} hides ${el.scrollHeight - el.clientHeight}px`);
    }
  }
  const search = document.querySelector("[data-parts-search]");
  return {
    frames: frames.length,
    siteH: frame ? Math.round(frame.getBoundingClientRect().height) : -1,
    board: !!board,
    boardH: board ? Math.round(board.getBoundingClientRect().height) : -1,
    paneH: pane ? pane.clientHeight : -1,
    paneTravel: pane ? pane.scrollHeight - pane.clientHeight : -1,
    movers, elsewhere, hiders, chain,
    searchY: search ? Math.round(search.getBoundingClientRect().y) : null,
  };
};

/* ------------------------------------------------------------------ */
/* Say what is being measured, before measuring it                     */
/* ------------------------------------------------------------------ */

let served = "no /api/version — an older build, or not this app";
try {
  const r = await fetch(`${URL_}/api/version`);
  const v = await r.json();
  if (v.commit) served = `${v.short ?? v.commit} on ${v.branch ?? "?"}`;
  else {
    /* A dev server has no build-time commit. Ask git instead, and say that
       is where the answer came from — a local tree can have uncommitted
       work in it, which the deployment never does. */
    const { execSync } = await import("node:child_process");
    const sha = execSync("git rev-parse --short HEAD").toString().trim();
    const br = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    const dirty = execSync("git status --porcelain").toString().trim() ? " + uncommitted changes" : "";
    /* Said this way on purpose: a dev server cannot name its commit, and the
       checkout this file was run from is NOT necessarily what that server is
       serving — a second dev server on another port is a different tree. It
       reports what it actually knows and does not pretend the two are one. */
    served = `unnamed (a dev server has no build commit); the tree this was run from is ${sha} on ${br}${dirty}`;
  }
} catch { /* left as the default */ }
console.log(`measuring ${URL_} — serving ${served}\n`);

const browser = await chromium.launch({ headless: true });
const seat = async (view, parts, drawnOn = true) => {
  const p = await browser.newPage({ viewport: view });
  await p.addInitScript(() => { try { localStorage.setItem("builder.shelf.folded", "0"); } catch { /* none */ } }); /* the shelf starts folded; this test looks at the open one */
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), page_(parts, drawnOn));
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1700);
  return p;
};

/* ------------------------------------------------------------------ */
/* 1. The four, at J's own window, on a page with things drawn on it   */
/* ------------------------------------------------------------------ */

const W = { width: 1267, height: 1278 };
const band = bandOf(W.height);
const page = await seat(W, 6);
let m = await page.evaluate(LOOK);

/* Before any of it: the suite has to be looking at the thing it thinks it
   is. One site frame, and a board found by walking out to the pane. */
check("there is exactly one site frame to measure", m.frames === 1, `${m.frames} matched [data-frame]`);
check("and the board is found by walking out from it to the pane", m.board,
  m.board ? "" : "no ancestor of the site frame is a child of [data-studio-pane]");
if (!m.frames || !m.board) { console.log(m.chain.join("\n")); }

check("1. the board's height is the site's rendered height plus its gutters",
  Math.abs(m.boardH - (m.siteH + GUTTER)) <= 4,
  `board ${m.boardH}, site ${m.siteH} + ${GUTTER} = ${m.siteH + GUTTER}`);
/* Its purpose, said as itself: the board is sized from the SITE and not
   clamped to the room it stands in. It used to be written as "taller than
   the pane by 100", which was the same thing while the page always overran
   — and stopped being the same thing when the fit started bringing the
   whole page inside the pane on purpose. A board that happened to equal the
   pane would be the fault; a board that is the site's height is not. */
check("   and it is the site's height, not the pane's", m.boardH !== m.paneH,
  `board ${m.boardH}, site ${m.siteH} + ${GUTTER}, pane ${m.paneH}`);
check("2. no ancestor of the site frame hides any of it", m.hiders.length === 0,
  m.hiders.join("; ") || "nothing hidden anywhere above the site");
/* At most one, because a page fitted into the pane in both directions has
   nothing to scroll and that is the point of it. What this has always been
   for is that the site is not inside a nested scrollbox; zero scrollers
   satisfies that better than one. The strict form — exactly one, and a
   gesture that has somewhere to go — is run below on a site long enough to
   overrun even at the zoom floor, which is where it still bites. */
check("3. at most one element that could move the site scrolls, and it is the pane",
  m.movers.length <= 1 && (m.movers.length === 0 || m.movers[0].isPane),
  (m.movers.map((x) => `${x.what} ${x.travel}px`).join("; ") || "NOTHING scrolls, in any direction")
    + (m.elsewhere.length ? `  (elsewhere, not the site: ${m.elsewhere.map((x) => `${x.what} ${x.travel}px`).join(", ")})` : ""));
/* J's review (d0943c6): the board stops above the shelf, which is the pane's sibling now, so the pane's travel is the site less the pane. */
check("   and its travel is the site less the pane (the shelf is under it, not in it)",
  Math.abs(m.paneTravel - (m.boardH - m.paneH)) <= 4,
  `${m.paneTravel}, wanted ${m.boardH - m.paneH}`);

const box = await page.locator("[data-studio-pane]").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 80);
/* Printed, not checked. It was a check while the page always overran, and
   J's rule that he must never load in unable to see the categories means
   the search box being on screen from the start is the good outcome, not a
   missing precondition. */
console.log(`       the search box starts at y ${m.searchY} in a ${W.height} window` +
  (m.searchY > W.height ? " — below it, so reaching it means something" : " — already on screen"));
/* Wheel to the END of the pane, not until the search box shows. The box is
   on screen from the first frame now, so "stop when you can see it" stopped
   before the first notch and then asked whether the page had gone by — it
   had not, and could not have. The end of the travel is the thing that was
   meant. */
for (let i = 0; i < 60; i++) {
  const done = await page.evaluate(() => {
    const pn = document.querySelector("[data-studio-pane]");
    return pn.scrollTop >= pn.scrollHeight - pn.clientHeight - 1;
  });
  if (done) break;
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(400);
const after = await page.evaluate(LOOK);
check("4. the shelf's search box is there, or one wheel gesture from the top brings it",
  after.searchY !== null && after.searchY + 37 <= W.height + 1,
  `y ${m.searchY} → y ${after.searchY}` + (m.searchY + 37 <= W.height + 1 ? " (it was already there)" : ` after ${after.paneTravel}px of travel`));
const end = await page.evaluate(() => {
  const last = [...document.querySelectorAll("[data-node-id]")].pop();
  const shelf = document.querySelector("[data-drawer]");
  return { foot: last ? Math.round(last.getBoundingClientRect().bottom) : null,
    shelfTop: shelf ? Math.round(shelf.getBoundingClientRect().top) : null };
});
check("   and the whole page is behind you at the end of the travel",
  end.foot !== null && end.shelfTop !== null && end.foot <= end.shelfTop + 2,
  `the last part ends at y ${end.foot}, the shelf starts at ${end.shelfTop}, over ${after.paneTravel}px of travel`);
if (results.includes(false)) console.log(m.chain.join("\n"));
await page.close();

/* ------------------------------------------------------------------ */
/* 1b. The strict form, on a site that overruns whatever the fit does  */
/* ------------------------------------------------------------------ */

/*
 * The fit brings the page inside the pane in both directions now, so at six
 * parts there is nothing to scroll and assertions 3 and 4 have no teeth
 * there. They still have teeth: the zoom has a floor, and past it a site is
 * longer than any amount of shrinking will fix. Ten parts is 4180 of page
 * against 923 of room, which wants 0.221 and is given 0.25, so the board is
 * 1285 in a 1191 pane and the gesture has 342px to go. That is where the
 * original wording belongs, and it is run there unchanged.
 */
{
  const long = await seat(W, 10);
  const lm = await long.evaluate(LOOK);
  check("3. (a site past the zoom floor) exactly one thing scrolls, and it is the pane",
    lm.movers.length === 1 && lm.movers[0].isPane,
    (lm.movers.map((x) => `${x.what} ${x.travel}px`).join("; ") || "NOTHING scrolls, in any direction")
      + (lm.elsewhere.length ? `  (elsewhere, not the site: ${lm.elsewhere.map((x) => `${x.what} ${x.travel}px`).join(", ")})` : ""));
  check("   its travel is the site less the pane",
    Math.abs(lm.paneTravel - (lm.boardH - lm.paneH)) <= 4,
    `${lm.paneTravel}, wanted ${lm.boardH - lm.paneH}`);
  /*
   * And here is the half of J's fourth assertion that does not survive his
   * own rule, said out loud rather than quietly dropped. It read "the search
   * box starts below the window, so reaching it means something", and past
   * the zoom floor the shelf is stuck to the pane's bottom precisely so that
   * it never starts below the window. The two cannot both be true. His rule
   * wins — he must never load in unable to see the categories — so what is
   * checked is the thing the gesture was really for: the end of the site is
   * reachable by scrolling, and the categories are there the whole time.
   */
  check("4. the categories are on screen from the first frame, with no gesture",
    lm.searchY + 37 <= W.height + 1, `the search box at y ${lm.searchY} in a ${W.height} window`);
  const lbox = await long.locator("[data-studio-pane]").boundingBox();
  await long.mouse.move(lbox.x + lbox.width / 2, lbox.y + 80);
  for (let i = 0; i < 45; i++) {
    const done = await long.evaluate(() => {
      const pn = document.querySelector("[data-studio-pane]");
      return pn.scrollTop >= pn.scrollHeight - pn.clientHeight - 1;
    });
    if (done) break;
    await long.mouse.wheel(0, 240);
    await long.waitForTimeout(30);
  }
  await long.waitForTimeout(400);
  const lafter = await long.evaluate(LOOK);
  const lend = await long.evaluate(() => {
    const last = [...document.querySelectorAll("[data-node-id]")].pop();
    const shelf = document.querySelector("[data-drawer]");
    return { foot: last ? Math.round(last.getBoundingClientRect().bottom) : null,
      shelfTop: shelf ? Math.round(shelf.getBoundingClientRect().top) : null };
  });
  check("   and one wheel gesture from the top carries the whole site past",
    lend.foot !== null && lend.shelfTop !== null && lend.foot <= lend.shelfTop + 2,
    `the last part ends at y ${lend.foot}, the shelf starts at ${lend.shelfTop}, over ${lafter.paneTravel}px of travel`);
  await long.close();
}

/* ------------------------------------------------------------------ */
/* 2. "At any zoom", and a page short enough to need no scroll         */
/* ------------------------------------------------------------------ */

const zoomed = await seat(W, 6);
const zbox = await zoomed.locator("[data-studio-pane]").boundingBox();
await zoomed.mouse.move(zbox.x + zbox.width / 2, zbox.y + 200);
await zoomed.keyboard.down("Control");
for (let i = 0; i < 6; i++) { await zoomed.mouse.wheel(0, -120); await zoomed.waitForTimeout(40); }
await zoomed.keyboard.up("Control");
await zoomed.waitForTimeout(500);
const z = await zoomed.evaluate(LOOK);
check("zoomed in, the board is still exactly the site plus its gutters",
  Math.abs(z.boardH - (z.siteH + GUTTER)) <= 4 && z.boardH > m.boardH,
  `${m.boardH} → ${z.boardH} for ${z.siteH} of site`);
check("and still nothing hides any of it", z.hiders.length === 0, z.hiders.join("; ") || "clean");
check("and still exactly one thing can move it", z.movers.length === 1 && z.movers[0].isPane,
  z.movers.map((x) => `${x.what} ${x.travel}px`).join("; ") || "nothing");
await zoomed.close();

/* A new project: one part, nothing drawn. Short enough that it all fits, so
   the right number of scrollers is none — and the categories are simply
   there, which is the other half of what J reported. */
const small = await seat(W, 1, false);
const s = await small.evaluate(LOOK);
check("a short page is a page, not a full-screen box",
  Math.abs(s.boardH - (s.siteH + GUTTER)) <= 4 && s.boardH < s.paneH,
  `${s.boardH}px of board in a ${s.paneH}px pane`);
check("nothing hides any of it either", s.hiders.length === 0, s.hiders.join("; ") || "clean");
check("nothing over the site scrolls, because there is nothing to scroll",
  s.movers.length === 0 && s.paneTravel === 0, `${s.movers.length} scroller(s) over the site`);
check("and the categories are on screen with no gesture at all",
  s.searchY !== null && s.searchY + 37 <= W.height + 1, `the search box at y ${s.searchY}`);
await small.close();

/* ------------------------------------------------------------------ */
/* 3. Ink below the page is part of the page                           */
/* ------------------------------------------------------------------ */

/*
 * The case the old fixture could not express. `frameHeight` counted parts,
 * the window was sized from it, and a stroke drawn under a stock page was
 * rendered behind an edge nothing could scroll past — 138px of it. The two
 * pages here differ by exactly one pen stroke and one drawn space.
 */
const bare = await seat(W, 1, false);
const bareH = (await bare.evaluate(LOOK)).siteH;
await bare.close();
const drawn = await seat(W, 1, true);
const d = await drawn.evaluate(LOOK);
check("ink drawn below the page makes the page taller", d.siteH > bareH + 40,
  `${bareH} → ${d.siteH} for one stroke and one space`);
check("and none of it is behind an edge", d.hiders.length === 0, d.hiders.join("; ") || "clean");
check("and the board grew with it", Math.abs(d.boardH - (d.siteH + GUTTER)) <= 4,
  `board ${d.boardH} for ${d.siteH} of site`);
await drawn.close();

/* ------------------------------------------------------------------ */
/* 4. The same at every width, and Updates has the same shape          */
/* ------------------------------------------------------------------ */

for (const [w, h] of [[1500, 950], [1280, 720], [1100, 800], [980, 820]]) {
  const p = await seat({ width: w, height: h }, 6);
  const b = bandOf(h);
  const r = await p.evaluate(LOOK);
  check(`${w}×${h}: the board is the site`, Math.abs(r.boardH - (r.siteH + GUTTER)) <= 4, `${r.boardH} for ${r.siteH}`);
  check(`${w}×${h}: nothing hides any of it`, r.hiders.length === 0, r.hiders.join("; ") || "clean");
  check(`${w}×${h}: one scroller over the site, travel is site − pane`,
    r.movers.length === 1 && r.movers[0].isPane && Math.abs(r.paneTravel - (r.boardH - r.paneH)) <= 4,
    `${r.movers.length} over the site, ${r.paneTravel} against ${r.boardH - r.paneH}`
      + (r.elsewhere.length ? `  (elsewhere: ${r.elsewhere.map((x) => `${x.what} ${x.travel}px`).join(", ")})` : ""));
  /* Edge to edge is what J saw on opening: a frame that leaves no ground is
     a frame with nothing else to look at, and bare ground is the handle. */
  const across = await p.evaluate(() => {
    const f = document.querySelector("[data-frame]").getBoundingClientRect();
    const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect();
    return Math.round((f.width / pane.width) * 100);
  });
  check(`${w}×${h}: the page does not take the whole board`, across > 0 && across <= 94, `${across}% across`);

  await p.locator('[aria-label^="Finish"]').first().click({ force: true });
  await p.waitForTimeout(1300);
  const detail = await p.evaluate(() => {
    const d2 = document.querySelector("[data-timeline-detail]");
    const pane = document.querySelector("[data-studio-pane]");
    return d2 && pane
      ? { inPane: pane.contains(d2), travel: pane.scrollHeight - pane.clientHeight, h: Math.round(d2.getBoundingClientRect().height) }
      : null;
  });
  check(`${w}×${h}: Updates keeps its band, in the same scroller`,
    !!detail && detail.inPane && detail.h > 100 && detail.travel > 0,
    detail ? `${detail.h}px, ${detail.travel}px of travel below the updates` : "gone");
  await p.close();
}

/* ------------------------------------------------------------------ */
/* 5. Updates hands the wheel over rather than sharing it              */
/* ------------------------------------------------------------------ */

const book = await seat(W, 6);
await book.locator('[aria-label^="Finish"]').first().click({ force: true });
await book.waitForTimeout(1400);
const bookBox = await book.locator("[data-studio-pane]").boundingBox();
await book.mouse.move(bookBox.x + bookBox.width / 2, bookBox.y + bookBox.height / 2);
const bookRead = () => book.evaluate(() => {
  const pane = document.querySelector("[data-studio-pane]");
  const plot = document.querySelector("[data-timeline-plot]");
  const host = document.querySelector("[data-timeline]");
  const d2 = document.querySelector("[data-timeline-detail]");
  /* The plot's pan in the timeline's OWN frame. Its `y` in the window also
     moves when the pane scrolls, because it is inside the pane — reading
     that called one surface moving "both moved", which is the very thing
     this is here to tell apart. */
  return {
    top: Math.round(pane.scrollTop), travel: pane.scrollHeight - pane.clientHeight,
    plot: plot && host ? Math.round(plot.getBoundingClientRect().y - host.getBoundingClientRect().y) : null,
    detailY: d2 ? Math.round(d2.getBoundingClientRect().y) : null,
  };
});
const b0 = await bookRead();
let shared = 0;
let last = b0;
for (let i = 0; i < 14; i++) {
  await book.mouse.wheel(0, 200);
  await book.waitForTimeout(90);
  const now = await bookRead();
  if (Math.abs(now.plot - last.plot) > 2 && Math.abs(now.top - last.top) > 2) shared++;
  last = now;
}
check("the updates and the pane never take the same notch", shared === 0, `${shared} notches moved both`);
check("and the prompt section under the updates is reached by carrying on",
  last.detailY !== null && last.detailY + 100 < W.height && last.top >= b0.travel - 2,
  `the band came to y ${last.detailY}, pane at ${last.top} of ${b0.travel}`);
await book.close();

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${URL_} (${served}) — ${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
