/**
 * A box that holds words is never shorter than its words.
 *
 * HIS FAULT, found by driving an imported board: a text part carries the
 * width and height the capture measured, and every renderer treated that as
 * a ceiling. "PnL Over Time" came in at 143 by 41, its words needed more
 * than 41, and they were gone — not deleted, pushed into a scroll region on
 * a board nobody can scroll. He dragged the box one increment taller and it
 * was fine.
 *
 * So the rule: captured geometry is a starting size, never a ceiling. The
 * box grows to its words, and what sits below moves down by the growth, in
 * his words, "the texts should follow each other based on full size".
 *
 * The blocks below are measured SHORT on purpose — a sentence each in a box
 * 28px tall — which is the real fault with the arithmetic made obvious. What
 * is asserted is what a person can see: how much of the words is inside the
 * box that holds them, and whether the box under it was pushed down or left
 * to be sat on.
 *
 * WHAT THIS FIXTURE DOES NOT EXERCISE, said plainly so the next person does
 * not read a green run as more than it is: the reading route stood in for
 * here returns no `faces`, so the page carries no web font and every part
 * draws in whatever this machine already has. A real captured page that
 * brings its faces with it lays out differently — that is the whole point of
 * carrying them — and the heights below would change with it. They are
 * measured off the drawn part every time, so the floor holds either way;
 * it is the stored heights that a different face would make wrong, which is
 * why they are a convenience and not the guarantee.
 *
 *   node tests/words-fit.mjs [url]
 */
import { createRequire, registerHooks } from "node:module";

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && !/\.[a-z]+$/i.test(spec)) {
      try { return next(`${spec}.ts`, ctx); } catch { /* fall through */ }
    }
    return next(spec, ctx);
  },
});
const { fitRows } = await import("../src/features/studio/textFit.ts");

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The tidy itself, with no browser in it                           */
/* ------------------------------------------------------------------ */

/* One column: the middle box needs 60 where it was given 20. */
const column = [
  { id: "a", x: 0, y: 0, w: 300, h: 40, drew: 40 },
  { id: "b", x: 0, y: 50, w: 300, h: 20, drew: 60 },
  { id: "c", x: 0, y: 80, w: 300, h: 40, drew: 40 },
];
const fitted = fitRows(column);
const fit = (id) => fitted.find((f) => f.id === id);
check("a box that needs more room is given it", fit("b")?.h === 60, JSON.stringify(fit("b")));
check("and what is under it moves down by exactly the growth", fit("c")?.y === 120, `${fit("c")?.y ?? "not moved"}, was 80, grew 40`);
check("what is above it does not move", !fit("a") || fit("a").y === 0);

/* Side by side is one band: three cards grow the page once, by the tallest. */
const band = [
  { id: "l", x: 0, y: 0, w: 100, h: 30, drew: 50 },
  { id: "m", x: 110, y: 0, w: 100, h: 30, drew: 70 },
  { id: "r", x: 220, y: 0, w: 100, h: 30, drew: 30 },
  { id: "under", x: 0, y: 40, w: 320, h: 30, drew: 30 },
];
const bandFit = fitRows(band);
const atB = (id) => bandFit.find((f) => f.id === id);
check("a row grows by its tallest member, not by all of them", atB("under")?.y === 80, `${atB("under")?.y ?? "not moved"}, was 40, tallest grew 40`);
check("and each box in the row keeps its own height", atB("l")?.h === 50 && atB("m")?.h === 70 && (atB("r")?.h ?? 30) === 30);

/* A page that already fits comes back with nothing to do. */
check("a page whose boxes already hold their words is left alone",
  fitRows([{ id: "x", x: 0, y: 0, w: 100, h: 50, drew: 50 }, { id: "y", x: 0, y: 60, w: 100, h: 50, drew: 44 }]).length === 0);

/* ------------------------------------------------------------------ */
/* 2. On the board, through the real import                            */
/* ------------------------------------------------------------------ */

/* Four blocks, each holding a sentence in a box far too short for it: the
   fault as he met it, with the arithmetic made obvious. */
const N = 4;
const SHORT_H = 28;
/* A page about as wide as the surface it lands on, so the capture's own
   numbers survive the fit and the fault is the one he met rather than an
   artefact of scaling everything down. */
const PAGE = { width: 640, height: 1200, shot: "" };
const SENTENCE = " Cumulative, net of fees, across every account in the book, with the funding cost of holding each leg overnight and the breaches of the last trading week beside it.";
const WORDS = [
  `PnL Over Time.${SENTENCE}${SENTENCE}`,
  `Price tracker, live.${SENTENCE}${SENTENCE}`,
  `Exposure by venue, netted.${SENTENCE}${SENTENCE}`,
  `Risk limits, per desk and per book.${SENTENCE}${SENTENCE}`,
];
const blocks = Array.from({ length: N }, (_, i) => ({
  selector: `#b${i}`,
  what: "section",
  /* 200px apart, which is far enough that the importer reads them as four
     blocks rather than merging a run of small boxes into one, and close
     enough that a box needing 300px sits on the one below it unless the
     page follows its own words. */
  box: { x: 20, y: 80 + i * 130, w: 140, h: SHORT_H },
  words: WORDS[i],
}));
const reading = (sel, i) => ({
  from: { url: "https://example.test/", host: "example.test", selector: sel, at: Date.now() },
  box: blocks[i].box,
  down: (80 + i * 130) / PAGE.height,
  tag: "section",
  role: null,
  text: [{ words: WORDS[i], px: 16, weight: 400, y: 0.3 }],
  links: [],
  buttons: [],
  images: [],
  paint: { bg: "rgb(255, 255, 255)", text: "rgb(20, 20, 20)", border: null, radius: 0, shadow: false, behind: "rgb(255, 255, 255)" },
  type: { family: "Inter, sans-serif", face: "Inter", drew: true, px: 16, weight: 400, spacing: 0, leading: 24 },
  layout: { flow: "column", columns: 1, gap: 8 },
  children: [{ x: 0, y: 0, w: 140, h: 20 }],
});

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
/* The catch-all goes on FIRST: playwright tries the most recently added
   route first, and with these the other way round the reading route
   below never ran and the panel said the page could not be read. */
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.route("**/api/studio/element", async (route) => {
  let body = {};
  try { body = JSON.parse(route.request().postData() ?? "{}"); } catch { /* none */ }
  const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
  if (Array.isArray(body.selectors)) {
    const rs = body.selectors
      .map((s) => ({ s, i: blocks.findIndex((b) => b.selector === s) }))
      .filter(({ i }) => i >= 0)
      .map(({ s, i }) => reading(s, i));
    return json({ ok: true, page: PAGE, readings: rs });
  }
  return json({ ok: true, url: "https://example.test/", host: "example.test", page: PAGE, candidates: blocks });
});
/* A TypeError inside the import shows up here as an empty panel and eight
   missing parts, which is a long way to debug from. Said out loud instead. */
page.on("pageerror", (e) => console.log(`  ..   the page threw: ${String(e).slice(0, 160)}`));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* ------------------------------------------------------------------ */
/* A space to bring it into                                            */
/* ------------------------------------------------------------------ */

const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
const B = { x: 280, y: 90, w: 620, h: 300 };
const at = { x: PANE.x + B.x, y: PANE.y + B.y, w: B.w, h: B.h };
const pts = [[at.x, at.y], [at.x + at.w, at.y], [at.x + at.w, at.y + at.h], [at.x, at.y + at.h], [at.x, at.y]];
await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height / 2);
await page.keyboard.press("s");
await page.waitForTimeout(300);
await page.mouse.move(pts[0][0], pts[0][1]);
await page.mouse.down();
for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(12); }
await page.mouse.up();
await page.waitForTimeout(450);
await page.keyboard.press("v");
await page.waitForTimeout(1800);
/* Picking the surface, if it is not already picked: the panel is what this
   needs, and drawing one opens it. */
if (await page.locator("[data-space-fill]").count()) {
  await page.locator("[data-space-fill]").first().click({ force: true });
  await page.waitForTimeout(400);
}

const panel = page.locator("[data-space-panel]").first();
check("the space's panel asks for a page", (await panel.locator("[data-site-url]").count()) === 1);
const before = await page.locator("[data-node-id]").count();

await panel.locator("[data-site-url]").fill("https://example.test/");
await panel.locator("[data-site-read]").click();
await panel.locator("[data-site-take-all]").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
check("the page opens, with its blocks to take", (await panel.locator("[data-site-take-all]").count()) === 1,
  (await panel.locator("[data-site-said]").innerText().catch(() => "")).slice(0, 120));

/* ------------------------------------------------------------------ */
/* What a person can see                                               */
/* ------------------------------------------------------------------ */

await panel.locator("[data-site-take-all]").click();
/* Long enough for the parts to land, the page to lay out, and the tidy that
   follows it to write the heights down. */
await page.waitForTimeout(3500);

const boxes = await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].map((el) => {
  const part = el.querySelector("[data-part]");
  const inner = part ? [...part.children].filter((c) => getComputedStyle(c).position === "static" || getComputedStyle(c).position === "relative") : [];
  const need = inner.reduce((m, c) => Math.max(m, c.offsetTop + c.offsetHeight), 0);
  const r = el.getBoundingClientRect();
  return { id: el.getAttribute("data-node-id"), box: el.offsetHeight, need, top: r.top, bottom: r.bottom, words: (el.textContent ?? "").trim().length };
}).sort((a, b) => a.top - b.top));

check("every block became a part", boxes.length === N, `${boxes.length} of ${N}`);
const some = boxes.length === N;
check("the boxes are taller than the capture measured them", some && boxes.every((b) => b.box > SHORT_H),
  boxes.map((b) => b.box).join(", ") + `px, captured at ${SHORT_H}px`);
/* The fault itself: words that do not fit inside the box that holds them. */
const cut = boxes.filter((b) => b.need > b.box + 1);
check("no box holds more words than it has room for", some && cut.length === 0,
  cut.length ? cut.map((b) => `${b.id} needs ${b.need} has ${b.box}`).join("; ") : `tallest needed ${Math.max(...boxes.map((b) => b.need))}px`);
check("and the words are still there to be read", some && boxes.every((b) => b.words > 20), boxes.map((b) => b.words).join(", ") + " characters");

/* And the half he asked for in the same breath: what is under it moves. */
/*
 * And the half he asked for in the same breath: what is under a box that
 * grew has moved down by the growth.
 *
 * The air between the boxes is what says so. The capture put 102px of it
 * under each one (130 apart, 28 tall) and every box here needs two or three
 * times the height it was given, so a page that does not follow its own
 * words closes that gap to nothing and eventually sits on the box below.
 * Overlap is the loud failure; the gap closing is the same fault one step
 * earlier, and it is what actually fires.
 */
const gaps = boxes.slice(1).map((b, i) => Math.round(b.top - boxes[i].bottom));
check("nothing below is sat on", some && boxes.slice(1).every((b, i) => b.top >= boxes[i].bottom - 1),
  `tops and bottoms: ${boxes.map((b) => `${Math.round(b.top)}..${Math.round(b.bottom)}`).join("  ")}`);
check("and the air the page had under each box is still there", some && gaps.every((g) => g >= 90),
  `gaps ${gaps.join(", ")}px, the capture gave 102`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
