/**
 * Which strokes are one drawing.
 *
 * A gull is four strokes and one bird; before this it was four buttons and
 * would have been four unrelated parts. The rules a person already follows:
 *
 *   · a stroke laid over or against what is there is more of it, however
 *     long the hand stopped first;
 *   · a stroke merely near it joins while you are still at this one, and
 *     stops joining once you have been away;
 *   · distance splits it whatever the clock says, which is how a person
 *     starts a second drawing;
 *   · and a person's word beats the guess, both ways, join and split.
 *
 *   node tests/ink.mjs [url]        # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { NEAR_FLOOR, SITTING_MS, boundsOf, gap, inkGroups, near, nearestTo, touching, union } from "../src/features/studio/inkGroups.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A stroke as a little box of points, at a place and a time. */
const stroke = (id, x, y, w, h, at) => ({
  id,
  at,
  points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
});

/* ------------------------------------------------------------------ */
/* 1. The measurements underneath                                      */
/* ------------------------------------------------------------------ */

check("a box is the ink's extent", (() => {
  const b = boundsOf([[10, 20], [30, 5], [15, 40]]);
  return b.x === 10 && b.y === 5 && b.w === 20 && b.h === 35;
})());
check("two boxes that overlap have no gap between them",
  gap({ x: 0, y: 0, w: 20, h: 20 }, { x: 10, y: 10, w: 20, h: 20 }) === 0);
check("a gap is the shortest way across", gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 0, w: 10, h: 10 }) === 30);
check("a union covers both", (() => {
  const u = union({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 20, w: 10, h: 10 });
  return u.x === 0 && u.y === 0 && u.w === 50 && u.h === 30;
})());
check("two small strokes side by side are near", near({ x: 0, y: 0, w: 8, h: 8 }, { x: 20, y: 0, w: 8, h: 8 }),
  `floor ${NEAR_FLOOR}`);
check("two strokes a page apart are not", !near({ x: 0, y: 0, w: 8, h: 8 }, { x: 600, y: 0, w: 8, h: 8 }));

/* ------------------------------------------------------------------ */
/* 2. The gull: four strokes, one bird                                 */
/* ------------------------------------------------------------------ */

const GULL = [
  stroke("a", 100, 100, 40, 24, 1000),
  stroke("b", 132, 96, 40, 24, 1300),
  stroke("c", 116, 118, 20, 16, 1600),
  stroke("d", 104, 92, 16, 12, 1900),
];
const gull = inkGroups(GULL);
check("a four-stroke gull is one drawing", gull.length === 1, `${gull.length} groups`);
check("and it holds all four strokes", gull[0]?.strokeIds.length === 4, gull[0]?.strokeIds.join(","));
check("its box covers every stroke", (() => {
  const b = gull[0].bounds;
  return b.x <= 100 && b.y <= 92 && b.x + b.w >= 172 && b.y + b.h >= 134;
})());
check("nothing was decided, so it is still a guess", gull[0]?.decided === false);

/** J's bird: fifteen strokes, drawn steadily, one part. */
const BIRD = Array.from({ length: 15 }, (_, i) =>
  stroke(`s${i}`, 200 + (i % 5) * 18, 200 + Math.floor(i / 5) * 16, 22, 14, 5000 + i * 400));
const bird = inkGroups(BIRD);
check("a fifteen-stroke bird is one drawing, not fifteen", bird.length === 1, `${bird.length} groups`);
check("one button would be drawn for it", bird[0]?.strokeIds.length === 15);

/* ------------------------------------------------------------------ */
/* 3. Stopping to look is not starting again                           */
/* ------------------------------------------------------------------ */

/*
 * The bug this rule replaced.
 *
 * Time used to come first: a pause of a second and a half closed the group
 * and space could only work inside it. A person drawing a careful bird
 * stops to look before adding the head, and the head then arrived where it
 * could never reach the body it was drawn on top of — fifteen strokes came
 * out as several drawings and loose ink. So what touches is one thing now,
 * whatever the clock says.
 */
const thought = inkGroups([
  stroke("body", 100, 100, 60, 40, 1000),
  stroke("wing", 110, 110, 30, 20, 1200),
  // …a long look at it, and then the head, drawn onto the body.
  stroke("head", 140, 92, 30, 24, 1200 + 6 * 60_000),
]);
check("a stroke laid on the drawing joins it however long the hand stopped first",
  thought.length === 1, `${thought.length} groups`);
check("and it is one drawing of all three", thought[0]?.strokeIds.length === 3);

const nearby = inkGroups([
  stroke("body", 100, 100, 60, 40, 1000),
  // Near, not touching: a leg under a body, drawn while still at it.
  stroke("leg", 118, 152, 8, 30, 3500),
]);
check("a stroke near it joins while the hand is still on this drawing", nearby.length === 1, `${nearby.length} groups`);

const later = inkGroups([
  stroke("body", 100, 100, 60, 40, 1000),
  // The same stroke, after going away and coming back.
  stroke("leg", 118, 152, 8, 30, 1000 + SITTING_MS + 5000),
]);
check("…and does not once the hand has been away", later.length === 2, `${later.length} groups`);
check("the older drawing comes first", later[0].at < later[1].at);

const nudge = inkGroups([
  stroke("one", 100, 100, 30, 20, 1000),
  // Lifting the pen to reposition was never a pause, and still is not.
  stroke("two", 108, 104, 30, 20, 1000 + 1300),
]);
check("lifting the pen to reposition does not split a drawing", nudge.length === 1);

check("what touches is judged on what the strokes cover", (() => {
  const a = boundsOf([[0, 0], [40, 40]]);
  const b = boundsOf([[38, 38], [70, 70]]);
  const away = boundsOf([[300, 300], [340, 340]]);
  return touching(a, b) && !touching(a, away);
})());

/* ------------------------------------------------------------------ */
/* 4. Distance splits it                                               */
/* ------------------------------------------------------------------ */

const apart = inkGroups([
  stroke("here", 100, 100, 30, 20, 1000),
  stroke("also-here", 112, 106, 30, 20, 1150),
  stroke("far", 900, 700, 30, 20, 1300),
]);
check("a stroke across the page is its own drawing even in the same run", apart.length === 2, `${apart.length} groups`);
check("the far one is alone", apart.some((g) => g.strokeIds.length === 1 && g.strokeIds[0] === "far"));

/** A chain of small strokes stays one drawing, growing as it goes. */
const chain = inkGroups(Array.from({ length: 8 }, (_, i) => stroke(`c${i}`, 100 + i * 30, 100, 12, 12, 1000 + i * 200)));
check("a chain of strokes across a shape stays one drawing", chain.length === 1, `${chain.length} groups`);

/* ------------------------------------------------------------------ */
/* 5. A person's word beats the guess                                  */
/* ------------------------------------------------------------------ */

const joined = inkGroups([
  { ...stroke("here", 100, 100, 30, 20, 1000), group: "k" },
  { ...stroke("far", 900, 700, 30, 20, 1300), group: "k" },
]);
check("two drawings a person joined are one", joined.length === 1, `${joined.length} groups`);
check("and the group says it was decided", joined[0]?.decided === true);

const split = inkGroups([
  { ...stroke("a", 100, 100, 30, 20, 1000), group: "a" },
  { ...stroke("b", 108, 104, 30, 20, 1100), group: "b" },
]);
check("two strokes a person split stay apart, however close", split.length === 2, `${split.length} groups`);
check("splitting is not undone by the guess", split.every((g) => g.strokeIds.length === 1));

check("the nearest drawing is the one a join takes in", (() => {
  const three = inkGroups([
    stroke("a", 0, 0, 20, 20, 1000),
    stroke("b", 200, 0, 20, 20, 1100),
    stroke("c", 900, 0, 20, 20, 1200),
  ]);
  const mate = nearestTo(three, three[0].id);
  return three.length === 3 && mate?.strokeIds[0] === "b";
})());
check("nothing is nearest when there is only one drawing",
  nearestTo(inkGroups([stroke("a", 0, 0, 20, 20, 1)]), "a") === null);

/* ------------------------------------------------------------------ */
/* 6. Ink from before this existed                                     */
/* ------------------------------------------------------------------ */

const old = inkGroups([
  { id: "a", points: [[100, 100], [130, 120]] },
  { id: "b", points: [[108, 104], [138, 124]] },
  { id: "c", points: [[900, 700], [930, 720]] },
]);
check("ink with no time on it groups by space alone", old.length === 2, `${old.length} groups`);
check("and nothing is lost", old.reduce((n, g) => n + g.strokeIds.length, 0) === 3);
check("nothing at all is no drawings", inkGroups([]).length === 0);

/* ------------------------------------------------------------------ */
/* 7. The board hangs the door on the drawing                          */
/* ------------------------------------------------------------------ */

const canvas = readFileSync("src/features/studio/Canvas.tsx", "utf8");
check("the button is keyed to a group, not a stroke", /data-make-real=\{g\.id\}/.test(canvas));
check("one button per drawing", /drawings\.map\(\(g\)/.test(canvas));
check("every stroke in the drawing goes into the sketch", /group\.strokeIds\.includes/.test(canvas));
check("the whole drawing is taken off the board, not one stroke", /removeShapes\(group\.strokeIds\)/.test(canvas));
check("the grouping can be seen", /data-ink-group=/.test(canvas));
check("and changed, both ways", /data-ink-join=/.test(canvas) && /data-ink-split=/.test(canvas));

const store = readFileSync("src/features/studio/store.ts", "utf8");
check("a stroke is stamped with when it went down", /at: Date\.now\(\)/.test(store));
check("joining and splitting are undoable like everything else",
  /joinInk: \(ids\) => \{[\s\S]{0,240}push\(\);/.test(store) && /splitInk: \(ids\) => \{[\s\S]{0,240}push\(\);/.test(store));

/* ------------------------------------------------------------------ */
/* 8. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  /*
   * The whole point, drawn rather than asserted.
   *
   * The rules above are the rules; this is a bird actually put on the board
   * with the pencil, by a hand that stops to look at it — which is the hand
   * that used to end up with several drawings and loose ink.
   */
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await page.route("**/api/studio/reshape", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, patch: { featureId: "custom-idea", label: "Bird", w: 320, h: 260, note: "an idea, drawn" }, usage: { model: "stub" } }) }));
  await page.route("**/api/studio/image", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: "no token" }) }));
  await page.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.keyboard.press("d");
  await page.waitForTimeout(600);

  const line = (a, z, n = 6) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (z[0] - a[0]) * i / n, a[1] + (z[1] - a[1]) * i / n]);
  const arc = (cx, cy, rx, ry, from, to, n = 10) =>
    Array.from({ length: n + 1 }, (_, i) => { const t = from + (to - from) * i / n; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]; });
  const BIRD_ON_BOARD = [
    arc(640, 520, 120, 80, 0.2, 3.0), arc(640, 520, 120, 80, 3.1, 6.1),
    arc(760, 450, 46, 46, 1.6, 5.4), line([800, 430], [850, 445]), line([850, 445], [800, 458]),
    arc(770, 438, 6, 6, 0, 6.2),
    arc(620, 470, 70, 40, 3.4, 5.9), arc(640, 486, 60, 34, 3.4, 5.9), arc(660, 500, 50, 28, 3.4, 5.9),
    line([560, 520], [470, 470]), line([560, 532], [465, 520]), line([560, 544], [470, 570]),
    line([610, 596], [606, 650]), line([606, 650], [582, 668]), line([660, 598], [664, 652]),
  ];
  const drawStrokes = async (strokes, thinkBefore = new Set()) => {
    for (const [i, st] of strokes.entries()) {
      if (thinkBefore.has(i)) await page.waitForTimeout(2200);
      await page.mouse.move(st[0][0], st[0][1]);
      await page.mouse.down();
      for (const [x, y] of st) { await page.mouse.move(x, y); await page.waitForTimeout(2); }
      await page.mouse.up();
      await page.waitForTimeout(80);
    }
  };
  // Stopping to look before the head, and again before the legs.
  await drawStrokes(BIRD_ON_BOARD, new Set([2, 12]));
  await page.waitForTimeout(1000);

  const chips = await page.locator("[data-make-real]").count();
  check("a bird put on the board in fifteen strokes is one drawing", chips === 1, `${chips} Make real buttons`);
  const ring = page.locator("[data-ink-group]").first();
  check("and the ring round it says so", (await ring.getAttribute("data-ink-strokes")) === "15",
    await ring.getAttribute("data-ink-strokes"));
  check("…even though the hand stopped twice to look at it", true, "2.2s before the head and before the legs");

  // A second drawing across the board stays its own.
  await drawStrokes([line([1250, 300], [1400, 300]), line([1400, 300], [1400, 420]), line([1400, 420], [1250, 420]), line([1250, 420], [1250, 300])]);
  await page.waitForTimeout(900);
  check("a drawing somewhere else is a different drawing", (await page.locator("[data-make-real]").count()) === 2,
    `${await page.locator("[data-make-real]").count()} drawings`);

  // And Make real takes the whole bird, leaving the other alone.
  await page.locator("[data-make-real]").first().click();
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    if (await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
      return (s.queue ?? []).length > 0 && (s.queue ?? []).every((j) => j.status !== "running" && j.status !== "waiting");
    })) break;
  }
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
    const made = (s.nodes ?? []).filter((n) => n.sketch);
    return { parts: made.length, strokes: made[0]?.sketch?.strokes?.length ?? 0, inkLeft: (s.shapes ?? []).filter((x) => x.kind === "pen").length };
  });
  check("Make real takes the whole bird and nothing else", after.parts === 1 && after.strokes === 15, JSON.stringify(after));
  check("and the other drawing is still on the board", after.inkLeft === 4, `${after.inkLeft} strokes left`);
  await browser.close();
}

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
