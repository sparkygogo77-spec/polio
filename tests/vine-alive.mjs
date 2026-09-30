/**
 * A VINE IS A ROPE BEING PICKED UP, AND IT IS EASY TO CATCH.
 *
 * HIS WORDS, both faults in one breath: "the hover on the vines is
 * unsatisfactory and it seems to need to be super precisely the line in the
 * middle of the vine and easy to miss, and the animation just makes it
 * immediately flex, the hover should make it almost like kind of pulse and
 * almost like a rope being picked up on hover then dropped back down.
 * instead of immediately flexing to a new position."
 *
 * Neither can be read off a resting frame, so nothing here reads one.
 *
 *   · THE REACH is measured the way a browser measures it: perpendicular
 *     offsets out from the vine's own axis, asking `elementFromPoint` at
 *     each one, until the vine stops answering. Against the seam it
 *     replaced that number was about three and a half pixels either side.
 *   · THE MOTION is measured off the canvas the vine is painted on, over
 *     time, as the height of the box round its ink: a vine picked up comes
 *     straighter and the box gets shorter, a vine swinging past where it
 *     hangs bows deeper and the box gets taller. A pulse is both, in that
 *     order, ending back where it started while the pointer is still on it.
 *     A flex to a new position is one step and a hold, and this fails it.
 *
 * And the physics is pure, so the feel is numbers rather than a matter of
 * opinion: the swing count, the overshoot, the time to quiet and the
 * no-stacking rule all come straight out of `tugSpring.ts`.
 *
 *     npx next start -p 3013
 *     node --experimental-strip-types tests/vine-alive.mjs http://127.0.0.1:3013
 *
 * Runs alone: photographs the vine over six frames to see it still; under load the frames differed.
 */
import { createRequire } from "node:module";
import { DROP, PICK, REST, letGo, pickUp, step, still } from "../src/features/studio/tugSpring.ts";
import { REACH_WIDTH, SEAM_WIDTH, strandPath, strandReach, strandSeam } from "../src/features/studio/strand.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The rope: a kick, a swing, and quiet                             */
/* ------------------------------------------------------------------ */

/** Run it at 60Hz and keep every position. */
const run = (r, secs) => {
  const out = [];
  for (let t = 0; t < secs; t += 1 / 60) { r = step(r, 1 / 60); out.push(r.x); }
  return out;
};
/** Every turning point, in order, so a swing is a thing that can be counted. */
const peaks = (xs) => {
  const out = [];
  for (let i = 1; i < xs.length - 1; i++) {
    const p = xs[i];
    if ((p > xs[i - 1] && p > xs[i + 1]) || (p < xs[i - 1] && p < xs[i + 1])) out.push(p);
  }
  return out;
};
const quietAt = (xs) => xs.findIndex((_, i) => xs.slice(i).every((x) => Math.abs(x) < 0.004)) / 60;

const lift = run(pickUp(REST), 3);
const lp = peaks(lift);
check("picked up, it lifts", lp[0] > 0.8, `peaks at ${lp[0].toFixed(2)}`);
check("…and carries past where it hangs rather than stopping there", lp[1] < -0.2, `swings back to ${lp[1].toFixed(2)}`);
check("…and back again, smaller", lp[2] > 0.05 && lp[2] < lp[0], `${lp[2].toFixed(2)}`);
/* The count first: `[].every()` is true, so an unmoving rope would pass this
   for having no swings at all to be bigger than each other. */
check("…each swing smaller than the one before, so it can only quieten",
  lp.length >= 3 && lp.every((p, i) => i === 0 || Math.abs(p) < Math.abs(lp[i - 1])), `${lp.length} turns`);
check("…and it is quiet while the hand is still on it, not held taut",
  quietAt(lift) > 0.6 && quietAt(lift) < 2, `quiet at ${quietAt(lift).toFixed(2)}s, ending at ${lift.at(-1).toFixed(4)}`);

const fall = run(letGo(REST), 3);
const fp = peaks(fall);
check("let go, it drops rather than merely returning", fp[0] < -0.35, `sags to ${fp[0].toFixed(2)}`);
check("…and settles instead of ringing: the fall is one swing, not three",
  Math.abs(fp[1]) < Math.abs(fp[0]) * 0.2, `${fp[0].toFixed(2)} then ${fp[1].toFixed(2)}, ${Math.round(Math.abs(fp[1] / fp[0]) * 100)}% of it`);
check("…so leaving does not look like arriving",
  Math.sign(fp[0]) !== Math.sign(lp[0]) && Math.abs(Math.abs(fp[0]) - Math.abs(lp[0])) > 0.2
  && Math.abs(quietAt(fall) - quietAt(lift)) > 0.15,
  `pick ${lp[0].toFixed(2)} quiet ${quietAt(lift).toFixed(2)}s · drop ${fp[0].toFixed(2)} quiet ${quietAt(fall).toFixed(2)}s`);

/* Hovered and hovered again: no stack, no jerk. */
let r = pickUp(REST);
for (let i = 0; i < 12; i++) r = step(r, 1 / 60);
const again = pickUp(r);
check("a second hand on it starts from wherever the rope actually is",
  again.x === r.x, `${r.x.toFixed(3)} → ${again.x.toFixed(3)}`);
check("…and adds to the swing rather than replacing it", again.v === r.v + PICK.kick, `${r.v.toFixed(2)} → ${again.v.toFixed(2)}`);
const stacked = run(again, 3);
check("…and it still comes to rest, however many hands there have been",
  still({ x: stacked.at(-1), v: 0, which: "pick" }), `ends at ${stacked.at(-1).toFixed(4)}`);

check("a frame that took a second does not throw it off the board",
  Math.abs(step({ x: 0.9, v: 12, which: "pick" }, 1).x) < 1.2, `${step({ x: 0.9, v: 12, which: "pick" }, 1).x.toFixed(2)}`);
check("nothing sets a position: an event is a kick and only a kick",
  pickUp({ x: 0.31, v: -2, which: "drop" }).x === 0.31 && letGo({ x: 0.31, v: -2, which: "drop" }).x === 0.31);
check("the two characters are told apart by their damping, not by a sign",
  PICK.c / (2 * Math.sqrt(PICK.k)) < 0.35 && DROP.c / (2 * Math.sqrt(DROP.k)) > 0.45,
  `pick ζ ${(PICK.c / (2 * Math.sqrt(PICK.k))).toFixed(2)}, drop ζ ${(DROP.c / (2 * Math.sqrt(DROP.k))).toFixed(2)}`);

/* ------------------------------------------------------------------ */
/* 2. The shape answers a signed rope, both ways                       */
/* ------------------------------------------------------------------ */

const A = { x: 0, y: 0 };
const B = { x: 300, y: 90 };
/** How far the curve's middle sits off the straight line between its ends. */
const bowOf = (tug) => {
  const [p0, c1, c2, p3] = strandPath(A, B, tug);
  const m = {
    x: 0.125 * p0.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p3.x,
    y: 0.125 * p0.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p3.y,
  };
  const dx = p3.x - p0.x, dy = p3.y - p0.y;
  return Math.abs((m.x - p0.x) * dy - (m.y - p0.y) * dx) / Math.hypot(dx, dy);
};
const restBow = bowOf(0);
check("the curve bows when nothing is on it", restBow > 8, `${restBow.toFixed(1)}px`);
check("picked up, it comes straighter", bowOf(0.94) < restBow - 4, `${restBow.toFixed(1)} → ${bowOf(0.94).toFixed(1)}px`);
check("and swung past, it bows DEEPER — which the old clamp threw away",
  bowOf(-0.51) > restBow + 4, `${restBow.toFixed(1)} → ${bowOf(-0.51).toFixed(1)}px`);
check("…and the whole swing is more travel than the old step to a new place",
  bowOf(-0.51) - bowOf(0.94) > restBow - bowOf(0.94),
  `${(bowOf(-0.51) - bowOf(0.94)).toFixed(1)}px of swing against a ${(restBow - bowOf(0.94)).toFixed(1)}px step`);

/* ------------------------------------------------------------------ */
/* 3. The band is far wider than the paint                             */
/* ------------------------------------------------------------------ */

/** An M/L/Z path as rings of points. */
const rings = (d) => d.split("M").filter(Boolean).map((r) => r.replace(/Z$/, "").split("L").map((q) => {
  const [x, y] = q.trim().split(/\s+/).map(Number);
  return { x, y };
}));
const inside = (d, p) => rings(d).some((ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
});
/** The furthest a pointer can stand off the axis and still be on the target. */
const reachOf = (d) => {
  const [p0, c1, c2, p3] = strandPath(A, B, 0);
  const m = {
    x: 0.125 * p0.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p3.x,
    y: 0.125 * p0.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p3.y,
  };
  const dx = p3.x - p0.x, dy = p3.y - p0.y, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  let far = 0;
  for (let o = 0.5; o < 60; o += 0.5) {
    if (inside(d, { x: m.x + nx * o, y: m.y + ny * o })) far = o; else break;
  }
  return far;
};
const wasReach = reachOf(strandSeam(A, B, {}));
const nowReach = reachOf(strandReach(A, B));
check("the line's own shape was a target a few pixels wide", wasReach < 6, `${wasReach}px either side (SEAM_WIDTH ${SEAM_WIDTH})`);
check("the band is far wider than the paint", nowReach >= 18, `${nowReach}px either side (REACH_WIDTH ${REACH_WIDTH})`);
check("…several times the reach it replaces", nowReach > wasReach * 4, `${(nowReach / wasReach).toFixed(1)}× as far`);
check("…and generous rather than huge, so two vines do not fight over one pointer", REACH_WIDTH <= 60, `${REACH_WIDTH}px across`);

/* ------------------------------------------------------------------ */
/* 4. On the screen, with a hand on it                                 */
/* ------------------------------------------------------------------ */

const URL_ = process.argv[2];
if (!URL_) {
  console.log("\n  --  the screen leg needs a url; skipped");
} else {
  const req = createRequire(import.meta.url);
  const { chromium } = (() => {
    for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
      try { return req(c); } catch { /* next */ }
    }
    throw new Error("No Playwright found.");
  })();

  const thread = (i) => ({
    id: `t${i}`, parentId: i ? `t${i - 1}` : null, at: 1_700_000_000_000 + i * 1000,
    mode: i ? "critique" : "start", ask: `ask ${i}`, answer: `answer ${i}`, changes: [`changed ${i}`],
    state: "done", form: { p: 1, gen: 1 },
  });
  const doc = JSON.stringify({ state: {
    pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes: [], groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "p0", trail: [],
    threads: [thread(0), thread(1)], threadSpots: { "box:t0": { x: 200, y: 200 }, "box:t1": { x: 700, y: 380 } },
  }, version: 0 });

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
  const page = await context.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(4200);

  check("there is a vine with a target on it", (await page.locator("[data-vine-cut]").count()) === 1);

  /*
   * HOW MUCH INK THE VINE IS PUTTING ON THE CANVAS.
   *
   * The signal is the curve's own length. A rope pulled straighter is a
   * shorter curve and lays down less of it; a rope sagging past where it
   * hangs is longer and lays down more. It is monotone in the bow, it needs
   * no idea of where the vine is, and at rest it is exactly repeatable —
   * three readings of an untouched vine came back 2157, 2157, 2157 — so a
   * change of ten is a change rather than noise.
   *
   * The box round the ink was tried first and was the wrong instrument: it
   * read the same 155px through the whole swing, because the canvas carries
   * the vine's shadow and its ends, whose extremes do not move when the
   * middle does. Recorded here because a metric that cannot see the thing
   * it is pointed at looks exactly like a feature that does not work.
   */
  const sampler = (frames) => page.evaluate((n) => new Promise((done) => {
    const el = document.querySelector("[data-timeline-vines]");
    const c = el.getContext("2d", { willReadFrequently: true });
    const out = [];
    const tick = () => {
      const { data } = c.getImageData(0, 0, el.width, el.height);
      let on = 0;
      for (let i = 3; i < data.length; i += 8) if (data[i] > 24) on++;
      out.push(on);
      if (out.length < n) requestAnimationFrame(tick); else done(out);
    };
    requestAnimationFrame(tick);
  }), frames);

  /*
   * The hit point and the reach, found the way the browser finds them:
   * out along the normal from a point that is really on the vine, asking
   * who is there at each step.
   */
  const found = await page.evaluate(() => {
    const el = document.querySelector("[data-vine-cut]");
    const r = el.getBoundingClientRect();
    let on = null;
    for (let j = 0; j <= 60 && !on; j++) {
      for (let i = 0; i <= 60 && !on; i++) {
        const x = r.left + (r.width * i) / 60;
        const y = r.top + (r.height * j) / 60;
        if (document.elementFromPoint(x, y) === el) on = { x, y };
      }
    }
    if (!on) return null;
    /* Straight down from a point on it until it stops answering: half the
       band, measured through the browser rather than off the path. */
    let down = 0;
    for (let o = 1; o < 80; o++) {
      if (document.elementFromPoint(on.x, on.y + o) === el) down = o; else break;
    }
    return { on, down };
  });
  check("a pointer can find the vine at all", !!found, found ? `${Math.round(found.on.x)},${Math.round(found.on.y)}` : "nowhere on it answers");
  check("and it keeps answering well away from its own line", found && found.down >= 14, `${found?.down}px of band below the first point that answered`);

  const settled = await sampler(6);
  const rest = settled.at(-1);
  check("the vine is painted, and it is still while nothing is on it",
    rest > 400 && new Set(settled).size === 1, `${rest} pixels of ink, ${new Set(settled).size} distinct reading${new Set(settled).size === 1 ? "" : "s"} over six frames`);

  /* Eighty frames is about one and a third seconds: the whole of a pick-up
     with the hand left where it is, so "it does not stay lifted" is read off
     the same run that says it lifted. */
  const pickSeries = sampler(80);
  await page.mouse.move(found.on.x, found.on.y);
  const picked = await pickSeries;
  const low = Math.min(...picked);
  const high = Math.max(...picked);
  check("a hand on it picks the vine up: the curve comes straighter and lays down less",
    low <= rest - 20, `${rest} → ${low} at its straightest`);
  check("…and carries past where it hangs on the way back, which a flex to a new position cannot do",
    high >= rest + 8, `${rest} → ${high} at its deepest`);
  check("…and it goes quiet with the hand still on it, rather than being held there",
    Math.abs(picked.at(-1) - rest) <= 6 && Math.abs(picked.at(-2) - rest) <= 6,
    `ends at ${picked.at(-1)} against ${rest} at rest`);
  check("…so it is a pulse: it visits both sides of where it hangs and comes back",
    low < rest && high > rest, `${low} … ${rest} … ${high}`);

  /*
   * AND THE TEXTURE TRAVELS WITH IT.
   *
   * The cloud over a vine is a DOM element clipped to the ribbon's own
   * outline, and that outline was computed at the resting curve however far
   * the vine had swung — so the geometry moved and the weather on it sat
   * still. His words: "it bounces out properly but it does it while leaving
   * the texture in place because it doesnt seem to want to move with it".
   *
   * Read off the clip path itself rather than off pixels: it is the thing
   * that was wrong, it is exact, and a cloud tile drifting on its own
   * twenty-second loop would make a pixel reading lie in both directions.
   */
  /* Measured during a pick-up, not after one: the first version of this
     sampled once the rope had already gone quiet and reported one outline
     over fifty frames, which is true of a still vine and says nothing. */
  await page.mouse.move(10, 10);
  await page.waitForTimeout(1400);
  const clipRun = page.evaluate(() => new Promise((done) => {
    const out = [];
    const tick = () => {
      const el = document.querySelector(".molten-vine");
      out.push(el ? getComputedStyle(el).clipPath.slice(0, 120) : "none");
      /* Past the settle: the pick-up is quiet at 1.32s, so fifty frames
         ends mid-swing and the tail says "still moving" about a rope that
         simply had not finished yet. */
      if (out.length < 110) requestAnimationFrame(tick); else done(out);
    };
    requestAnimationFrame(tick);
  }));
  await page.mouse.move(found.on.x, found.on.y);
  const clips = await clipRun;
  const moved = new Set(clips).size;
  check("the texture travels with the vine rather than sitting under it",
    moved > 3, `${moved} distinct outlines over 110 frames`);
  check("…and comes back to one when the rope is quiet",
    clips.slice(-6).every((c) => c === clips.at(-1)), `last six frames ${new Set(clips.slice(-6)).size === 1 ? "agree" : "still moving"}`);

  const dropSeries = sampler(80);
  await page.mouse.move(10, 10);
  const dropped = await dropSeries;
  check("taking the hand away drops it: its own motion, not the pick-up backwards",
    Math.max(...dropped) >= rest + 8, `${rest} → ${Math.max(...dropped)} as it falls`);
  check("…and it settles", Math.abs(dropped.at(-1) - rest) <= 6, `ends at ${dropped.at(-1)}`);

  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
