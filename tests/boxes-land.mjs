/**
 * A page's worth of boxes lands one after another, and undo still takes the
 * whole page back in one press.
 *
 * HIS RULE, already written for the timeline: "everything not seen yet is
 * all loaded in sequentially but each box starts maybe .2 seconds apart, not
 * once the previous is finished." A captured page is the other place boxes
 * arrive in a crowd, and there they all appeared in the same frame, which
 * reads as a picture being pasted rather than as a page being built.
 *
 * The important half of this suite is the LAST check. The boxes are not
 * added on a timer — every part lands in the same synchronous run it always
 * did, and it is only the painting that waits its turn — because a part
 * added on a timer takes its undo checkpoint on a timer, and "one undo
 * brings the old board back" after an import is a promise proved by hand.
 * A board that is half arrived when undo is pressed breaks it quietly.
 *
 * So: the parts are all there at once, the paint is not, and undo is
 * unharmed. Driven through the real import path with the reading route
 * stood in for, and measured off computed opacity, which is what a person
 * actually sees.
 *
 *   node tests/boxes-land.mjs [url]
 */
import { createRequire, registerHooks } from "node:module";

/* `boxEntry.ts` imports its neighbour the way the bundler lets it, with no
   extension, and node will not guess. One hook, so this reads the real
   numbers rather than a copy of them. */
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && !/\.[a-z]+$/i.test(spec)) {
      try { return next(`${spec}.ts`, ctx); } catch { /* fall through */ }
    }
    return next(spec, ctx);
  },
});
const { STAGGER_MS } = await import("../src/features/studio/timelineView.ts");
/* Absent on a tree without the stagger, which is exactly the tree this
   suite is sometimes run against to see what it was like before. */
const BOX_ENTRY_MS = await import("../src/features/studio/boxEntry.ts").then((m) => m.BOX_ENTRY_MS).catch(() => 260);

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
/* A page of eight blocks, stood in for where the app reads one        */
/* ------------------------------------------------------------------ */

const N = 8;
const PAGE = { width: 1280, height: 2400, shot: "" };
const blocks = Array.from({ length: N }, (_, i) => ({
  selector: `#b${i}`,
  what: "section",
  box: { x: 40, y: 80 + i * 260, w: 1200, h: 220 },
  words: `Block ${i + 1}, with a sentence of its own so it reads as prose.`,
}));
const reading = (sel, i) => ({
  from: { url: "https://example.test/", host: "example.test", selector: sel, at: Date.now() },
  box: blocks[i].box,
  down: (80 + i * 260) / PAGE.height,
  tag: "section",
  role: null,
  text: [{ words: blocks[i].words, px: 18, weight: 400, y: 0.3 }],
  links: [],
  buttons: [],
  images: [],
  paint: { bg: "rgb(255, 255, 255)", text: "rgb(20, 20, 20)", border: null, radius: 0, shadow: false, behind: "rgb(255, 255, 255)" },
  /* The whole shape, not the interesting half: `children` and `layout` are
     read for their length and their flow without being guarded, so a
     fixture missing them takes the Builder down with a TypeError rather
     than refusing the page. */
  type: { family: "Inter, sans-serif", face: "Inter", drew: true, px: 18, weight: 400, spacing: 0, leading: 26 },
  layout: { flow: "column", columns: 1, gap: 12 },
  children: [{ x: 0, y: 0, w: 1200, h: 100 }, { x: 0, y: 110, w: 1200, h: 100 }],
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
/* Landing, watched frame by frame                                     */
/* ------------------------------------------------------------------ */

/* First sight of each box, and how many are part way up at each look. */
const seen = new Map();
const counts = [];
const t0 = Date.now();
await panel.locator("[data-site-take-all]").click();
for (let i = 0; i < 120; i++) {
  const now = await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].map((el) => ({
    id: el.getAttribute("data-node-id"),
    o: Number(getComputedStyle(el).opacity),
  })));
  const ms = Date.now() - t0;
  for (const n of now) if (n.o > 0.02 && !seen.has(n.id)) seen.set(n.id, ms);
  counts.push({ ms, nodes: now.length, rising: now.filter((n) => n.o > 0.02 && n.o < 0.98).length });
  if (seen.size >= before + N && ms > STAGGER_MS * N + BOX_ENTRY_MS) break;
  await page.waitForTimeout(40);
}
await page.waitForTimeout(600);

const landed = await page.locator("[data-node-id]").count();
check("every block became a part", landed === before + N, `${landed - before} of ${N}`);

/*
 * The parts are all here at once. This is the half that protects undo: if
 * they were added on a timer this count would climb over a second and a half
 * rather than arriving whole.
 */
/*
 * Measured from the FIRST part appearing rather than from the press, because
 * the press is followed by a round trip to read the page and that is not
 * what is being timed. What matters is that the run lands whole: the sample
 * that first sees any new part sees all of them.
 */
const firstSeen = counts.findIndex((c) => c.nodes > before);
const filled = counts.findIndex((c) => c.nodes >= before + N);
check("the parts are all on the board in one go, however they are painted",
  firstSeen >= 0 && filled === firstSeen,
  firstSeen < 0 ? "no part ever arrived"
    : `first sample with any: ${counts[firstSeen].nodes}, with all: ${filled >= 0 ? counts[filled].nodes : "never"}${filled > firstSeen ? ` ${counts[filled].ms - counts[firstSeen].ms}ms later` : ""}`);

const starts = [...seen.values()].sort((a, b) => a - b).slice(-N);
const gaps = starts.slice(1).map((v, i) => v - starts[i]);
const typical = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
check("they are not all painted in the same frame", gaps.length === N - 1 && gaps.filter((g) => g > 20).length >= N - 3,
  `gaps ${gaps.join(", ")}ms`);
check(`they come up about ${STAGGER_MS}ms apart`, typical >= STAGGER_MS * 0.4 && typical <= STAGGER_MS * 2.6,
  `middle gap ${typical}ms`);
/* Apart, not after: one comes up while the one before it is still coming. */
check("a box does not wait for the one before it to finish", counts.some((c) => c.rising >= 2),
  `most part way up at once: ${Math.max(0, ...counts.map((c) => c.rising))}`);

/* ------------------------------------------------------------------ */
/* And the cost this was built to avoid adding                         */
/* ------------------------------------------------------------------ */

/*
 * THE STAGGER ADDS NO UNDO STEP OF ITS OWN, which is the whole reason the
 * parts are added together and only their painting waits.
 *
 * What this pins is a ceiling, not a wish: one press per part, and at most
 * two more — one for the surface the run landed on, and one for the tidy
 * that follows an import whose boxes did not hold their words. Measured on
 * this tree and on one without the stagger, it is the same number either
 * way, which is the property: the arriving costs nothing per box.
 *
 * The blocks below fit their words, so no tidy runs and the count here is
 * the bare one. A real page usually does need it. Said out loud because the
 * ceiling would otherwise be a trap for the next fixture that does.
 *
 * It is worth saying plainly that the number is not one. `FromASite` says
 * above the run that "one undo brings the old board back", and on this path
 * it does not: `addNode` takes a checkpoint per part, so eight blocks cost
 * eight presses and a ninth for the surface. That is older than this change
 * and unaffected by it, and making it one press is somebody's separate
 * piece of work — so this is a ceiling that keeps passing when they fix it,
 * rather than a pin that turns red the day they do.
 */
await page.mouse.click(PANE.x + 60, PANE.y + PANE.height - 60);
await page.waitForTimeout(300);
let presses = 0;
while (presses < N + 7 && (await page.locator("[data-node-id]").count()) > before) {
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await page.waitForTimeout(220);
  presses++;
}
const after = await page.locator("[data-node-id]").count();
check("undo takes the import back off the board", after === before, `${after} parts, was ${before} before it`);
check("and the arriving costs no undo step of its own", after === before && presses <= N + 2,
  `${presses} presses for ${N} parts${presses > 1 ? ` (one per part, one for the surface${presses > N + 1 ? ", one for the tidy" : ""}, as it was before this change)` : ""}`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
