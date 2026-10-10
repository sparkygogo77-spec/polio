/**
 * Create space, driven by a hand rather than seeded.
 *
 * Every check written about spaces until hypatia's entry points landed put
 * the space in the store and then looked at it. That is how the space tool
 * shipped unable to draw at all: `Canvas.tsx` kept a trail of points only
 * for the pen, so a hand-drawn loop arrived as a straight two-point line,
 * and no seeded check could have said so.
 *
 * So this one draws. Three things a seed never produces, because a seed is
 * a tidy array of points written by a program:
 *
 *   1. **A slow loop with a pause in the middle.** A hand stops to look.
 *      Every frame of that pause is another point on the boundary.
 *   2. **A loop whose ends do not quite meet.** Nobody lands back on the
 *      pixel they started from.
 *   3. **A loop drawn round a part that is already there.** The press
 *      starts on somebody else's element.
 *
 *   node tests/space-by-hand.mjs [url]
 *   SHOTS=1 node tests/space-by-hand.mjs   # writes docs/shots/space-by-hand-*.png
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const SHOTS = !!process.env.SHOTS;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const note = (line) => console.log(`  note  ${line}`);

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
/* The shelf opens folded to its "+ Add" strip (J, 2026-10-05); these checks use its search, so it is open. */
await page.addInitScript(() => { try { localStorage.setItem("builder.shelf.folded", "0"); } catch { /* private window */ } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (SHOTS) mkdirSync("docs/shots", { recursive: true });
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `docs/shots/space-by-hand-${n}.png` }); };

/**
 * The board pane, measured once.
 *
 * The first run of this file failed three checks and all three were the
 * file's own fault: a loop sized off a part was 348px across and started
 * above the window, and an "open line" was drawn at y=760, which is the
 * parts shelf and not the board at all. A gesture that leaves the pane is
 * not a gesture the board ever sees. Everything below is kept inside it.
 */
const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
const inPane = (x, y) => x > PANE.x + 20 && x < PANE.x + PANE.width - 20 && y > PANE.y + 20 && y < PANE.y + PANE.height - 20;

/** What is on screen, counted on screen. */
const spaces = () => page.locator("[data-space]").count();
/** What the store kept, for the things a rectangle cannot show: how many points a boundary holds. */
const kept = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  return (s.spaces ?? []).map((sp) => ({ id: sp.id, kind: sp.kind, points: sp.boundary.length }));
});
const toolSaid = async () => ((await page.locator("[data-tool-picker]").getAttribute("aria-label")) ?? "").replace(/^Tool:\s*/, "");
const pickSpace = async () => {
  await page.mouse.move(750, 480);
  await page.keyboard.press("s");
  await page.waitForTimeout(350);
  return /space/i.test(await toolSaid());
};

/**
 * A hand: press, move along the points, let go. `pause` stops in the middle
 * the way a person does, and every frame of that stop is a real move event
 * at the same place, which is what a real hand sends.
 */
const draw = async (pts, { pause = 0, step = 12 } = {}) => {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  const half = Math.floor(pts.length / 2);
  for (const [i, [x, y]] of pts.entries()) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(step);
    if (pause && i === half) {
      // Stopping to look. The pointer does not move; the clock runs.
      for (let k = 0; k < pause / 100; k++) { await page.mouse.move(x, y); await page.waitForTimeout(100); }
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
};

/** A loop of `n` points about a middle, with a wobble, optionally left open by `gap` degrees. */
const loop = (cx, cy, r, n = 30, gap = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * (Math.PI * 2 - (gap * Math.PI) / 180) - Math.PI / 2;
    const wob = 1 + Math.sin(i * 1.9) * 0.05;
    return [Math.round(cx + Math.cos(a) * r * wob), Math.round(cy + Math.sin(a) * r * wob)];
  });

check("the key picks the space tool up", await pickSpace(), await toolSaid());

/* ------------------------------------------------------------------ */
/* 1. Slowly, with a pause in the middle                               */
/* ------------------------------------------------------------------ */

const before = await spaces();
await draw(loop(560, 430, 150, 34), { pause: 1400, step: 22 });
const slow = await spaces();
check("a loop drawn slowly, stopping to look halfway, lands one space", slow === before + 1, `${before} → ${slow}`);
const slowKept = (await kept()).at(-1);
check("stopping did not split it into two", slow === before + 1 && (await kept()).length === before + 1);

/*
 * How many points a hand puts on a boundary, against what a seed does.
 *
 * This is the measurement the seeded checks could not take: my own seeds
 * are 40 tidy points, and a hand sends one on every pointer move for as
 * long as it is down.
 */
note(`the hand left ${slowKept?.points} points on that boundary; the seeded checks use 40`);
await shot("slow");

/*
 * And a long careful one, which is the shape of the question rather than
 * the pause: nothing tidies a boundary on the way in, so however many
 * points the pointer sent are the points kept, persisted, and written into
 * a `clip-path: path(…)` string that the compositor re-parses on every
 * frame while the hole consumes. A drawn stroke is tidied before it is
 * stored (`tidyStroke`); a boundary is not.
 */
await pickSpace();
const many = await spaces();
await draw(loop(560, 430, 120, 200), { step: 1 });
const longKept = (await kept()).at(-1);
check("a long careful loop still lands one space", (await spaces()) === many + 1);
note(`a 200-move loop was kept as ${longKept?.points} points`);
check("and its boundary is thinned rather than kept at pointer resolution",
  (longKept?.points ?? 999) <= 120, `${longKept?.points} points, each one written into a clip-path re-parsed every frame while it consumes`);

/* ------------------------------------------------------------------ */
/* 2. Ends that do not quite meet                                       */
/* ------------------------------------------------------------------ */

await pickSpace();
const was = await spaces();
// About 40px short of closing on a 150px loop: a person aiming for the start and missing.
await draw(loop(1050, 430, 150, 26, 16), { step: 14 });
const nearly = await spaces();
check("a loop whose ends do not quite meet is still a space", nearly === was + 1, `${was} → ${nearly}`);
const news = page.locator("text=A space is a closed line");
check("and the board does not tell the person off for it", (await news.count()) === 0);
await shot("nearly");

// And one that really is open says so, rather than landing something odd.
await pickSpace();
const had = await spaces();
// Inside the pane. At y=760 this was on the parts shelf and the board never saw it.
await draw([[420, 300], [520, 360], [620, 300], [720, 380]], { step: 20 });
await page.waitForTimeout(400);
check("a line that is not a loop lands nothing", (await spaces()) === had, `${had} → ${await spaces()}`);
check("and says why, in the person's own terms", (await page.locator("text=A space is a closed line").count()) > 0);
const said = await page.locator("text=A space is a closed line").first().boundingBox().catch(() => null);
if (said) note(`the message is a toast at ${Math.round(said.x)},${Math.round(said.y)}, ${Math.round(said.width)}px wide and truncated`);

/* ------------------------------------------------------------------ */
/* 3. Round a part that is already there                                */
/* ------------------------------------------------------------------ */

// Put a real part on the board the way a person does: search the shelf, click it.
await page.locator("[data-shelf-search], [data-palette-search], input[placeholder*='Search parts']").first().fill("main button");
await page.waitForTimeout(700);
/* A card's name sits under its picture now, beside the button that is the picture (ShelfCards.tsx). */
const tile = page.locator("[data-shelf-card]").filter({ hasText: /Main button/i }).locator("[data-tile]").first();
if (await tile.count()) {
  /* Carried onto the middle of the board, which places it where it is let
     go in one move. A press opens the card's detail card and Add to page
     puts the part at the page's top edge, too near the pane's edge to draw
     a loop round it (ShelfCards.tsx). */
  const frame = page.locator("[data-frame]").first();
  const fb = await frame.boundingBox();
  await tile.dragTo(frame, { targetPosition: { x: Math.round(fb.width * 0.5), y: Math.round(Math.min(fb.height, PANE.height) * 0.45) } });
  await page.waitForTimeout(900);
}
const parts = await page.locator("[data-node-id]").count();
check("a part is on the board to draw round", parts > 0, `${parts} parts`);

let overlap = { before: 0, after: 0 };
if (parts > 0) {
  /* Brought into view before it is measured. The workspace scrolls again,
     so the first part can sit above the top of the pane — measured here at
     y -76 — and a ring drawn round a rectangle that is off the screen is a
     gesture the board never receives. Scrolling to it is what a person does
     before drawing round it. */
  await page.locator("[data-node-id]").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);
  const box = await page.locator("[data-node-id]").first().boundingBox();
  await pickSpace();
  overlap.before = await spaces();
  /* The press lands ON the part and the loop goes round it, which is the
     gesture: a person circling something already on the page. Sized to the
     part but clamped to the pane, because a loop that leaves the window is
     a loop the board never receives. */
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const room = Math.min(cx - PANE.x, PANE.x + PANE.width - cx, cy - PANE.y, PANE.y + PANE.height - cy) - 24;
  const r = Math.max(60, Math.min(Math.max(box.width, box.height) * 0.7 + 40, room));
  const ring = loop(cx, cy, r, 26);
  check("the press lands on the part, not beside it", inPane(cx, cy) && (await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return !!el?.closest("[data-node-id]");
  }, [cx, cy])), `pressing at ${Math.round(cx)},${Math.round(cy)} with a radius of ${Math.round(r)}`);
  /* Out from the part to the ring, round it, and back to where the hand
     started. Pressing in the middle and letting go on the rim is a line
     with a tail on it, and the board rightly calls that open. */
  await draw([[cx, cy], ...ring, [cx, cy]], { step: 12 });
  overlap.after = await spaces();
  check("a loop drawn round a part, starting on top of it, lands a space", overlap.after === overlap.before + 1, `${overlap.before} → ${overlap.after}`);
  check("and the part is still there: drawing a space did not take it", (await page.locator("[data-node-id]").count()) === parts);

  await shot("over-a-part");
  /* No keys any more: a space drawn is a black hole from that instant, and
     it consumes the area round the part on its own. */
  await page.waitForTimeout(1800);
  const open = await page.locator("[data-space-horizon][data-space-open]").count();
  check("it consumes the area round the part on its own, with nothing to choose", open > 0, `${open} open`);
  {
    // And the part that was inside is now a part inside a space: its own panel.
    const node = page.locator("[data-node-id]").first();
    const nb = await node.boundingBox();
    await page.keyboard.press("v");
    await page.waitForTimeout(250);
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await page.waitForTimeout(500);
    check("and the part inside it now has a panel of its own", (await page.locator("[data-space-panel]").count()) > 0);
    await shot("panel-over-a-part");
  }
}

/* ------------------------------------------------------------------ */
/* 4. "That area becomes drawing space"                                 */
/* ------------------------------------------------------------------ */

/*
 * The one claim in J's sentence that no check has ever asked about. The
 * hole consumes the area and the area becomes drawing space; every seeded
 * check so far has looked at the ground and the ring and stopped there.
 * So: pick the pen up and draw inside an open one.
 */
const open = page.locator("[data-space-horizon][data-space-open]").first();
if (await open.count()) {
  const ob = await open.boundingBox();
  const ix = ob.x + ob.width / 2;
  const iy = ob.y + ob.height / 2;
  if (inPane(ix, iy)) {
    await page.mouse.move(ix, iy);
    await page.keyboard.press("d");
    await page.waitForTimeout(300);
    const inkBefore = await page.locator("[data-make-real]").count();
    await draw([[ix - 40, iy - 20], [ix - 10, iy + 14], [ix + 22, iy - 16], [ix + 48, iy + 10]], { step: 18 });
    const inkAfter = await page.locator("[data-make-real]").count();
    check("a pen draws inside an open hole", inkAfter === inkBefore + 1, `${inkBefore} → ${inkAfter} drawings`);
    note("a drawing inside a hole now belongs to it, by geometry: see section 6");
  }
}

/* ------------------------------------------------------------------ */
/* 5. Said where the hand was                                          */
/* ------------------------------------------------------------------ */

/*
 * The refusal used to be a toast at the bottom right, truncated to about
 * a hundred and forty pixels. A person watching their own hand at the top
 * of the board never saw it, and with toasts off it was not said at all.
 */
await pickSpace();
await draw([[430, 250], [530, 310], [630, 250], [730, 330]], { step: 20 });
const at = page.locator("[data-space-refused]");
check("a line that is not a loop says so on the board", (await at.count()) > 0);
if (await at.count()) {
  const rb = await at.boundingBox();
  check("where the hand was, not in the corner of the window",
    rb.x > 380 && rb.x < 800 && rb.y > PANE.y && rb.y < 420, `the message is at ${Math.round(rb.x)},${Math.round(rb.y)}; the corner is 1203,899`);
  check("and it is not cut off", (await at.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)), `${rb.width}px wide`);
  await shot("refused");
}
/* It goes on its own: the message is timed, and the next open line raises
   a fresh one. The old form drew the next line at once and asked for "at
   most one", which is what the component can draw at most anyway. */
await page.waitForTimeout(3600);
check("it goes on its own", (await page.locator("[data-space-refused]").count()) === 0, `${await page.locator("[data-space-refused]").count()} still up after 3.6s`);
await draw([[460, 560], [560, 600]], { step: 20 });
check("and the next open line raises a fresh one", (await page.locator("[data-space-refused]").count()) === 1);

/* ------------------------------------------------------------------ */
/* 6. A drawing knows the space it was drawn in                        */
/* ------------------------------------------------------------------ */

const hole = page.locator("[data-space-horizon][data-space-open]").first();
if (await hole.count()) {
  const hb = await hole.boundingBox();
  const hx = hb.x + hb.width / 2;
  const hy = hb.y + hb.height / 2;
  if (inPane(hx, hy)) {
    await page.mouse.move(hx, hy);
    await page.keyboard.press("d");
    await page.waitForTimeout(300);
    await draw([[hx - 30, hy - 14], [hx - 4, hy + 12], [hx + 24, hy - 12], [hx + 44, hy + 8]], { step: 18 });
    const marked = page.locator("[data-ink-space]");
    check("a drawing made inside a hole says which space it is in", (await marked.count()) > 0,
      (await marked.first().innerText().catch(() => "")).replace(/\n/g, " "));
    // And one drawn outside does not claim a space it is not in: the count
    // is taken before the outside drawing, not re-read beside itself.
    const markedBefore = await marked.count();
    await draw([[PANE.x + 60, PANE.y + 60], [PANE.x + 110, PANE.y + 90], [PANE.x + 160, PANE.y + 60]], { step: 18 });
    check("and one drawn outside every space claims none",
      (await marked.count()) === markedBefore, `${markedBefore} marked before, ${await marked.count()} after`);
    await shot("ink-in-a-space");
  }
}

/* ------------------------------------------------------------------ */
/* 7. An empty hole can be steered before anything is in it            */
/* ------------------------------------------------------------------ */

/* A fresh one, with nothing in it: the only open hole so far has the part
   this drew round inside it, and a hole with something in it is rightly
   steered through that thing rather than through a key of its own. */
await pickSpace();
const spot = [PANE.x + 250, PANE.y + PANE.height - 150];
await draw(loop(spot[0], spot[1], 90, 26), { step: 12 });
await page.waitForTimeout(1800);
await page.keyboard.press("v");
await page.waitForTimeout(300);
/* HIS WORDS (Canvas.tsx, `madeASpace`): a space he has just drawn skips the
   "This space" press and is picked at once, so its panel is already open. */
check("a hole just drawn opens its own panel without a press", (await page.locator("[data-space-panel]").count()) > 0);
/* The key is for a space he comes back to: let go of it, and it is there. */
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
if (await page.locator("[data-space-panel]").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
const fill = page.locator("[data-space-fill]").first();
check("an empty hole offers one key: the way to its own panel", (await fill.count()) > 0);
if (await fill.count()) {
  await fill.click({ force: true });
  await page.waitForTimeout(500);
  const panel = page.locator("[data-space-panel]");
  check("pressing it opens the space's own panel", (await panel.count()) > 0);
  check("which is about the space, not about a part in it", (await panel.locator("[data-space-name]").count()) > 0);
  check("and it carries the way to point at something real", (await panel.locator("[data-site-url]").count()) > 0);
  // The bounds, said before anything is opened.
  await panel.locator("[data-site-url]").fill("http://127.0.0.1/");
  await page.waitForTimeout(300);
  check("an address that will not be opened says so before it is opened",
    (await panel.locator("[data-site-refused]").count()) > 0, (await panel.locator("[data-site-refused]").innerText().catch(() => "")));
  check("and Read is not offered for it", await panel.locator("[data-site-read]").isDisabled());
  await shot("space-panel");
}

/* ------------------------------------------------------------------ */

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
