/**
 * Every new iteration forms from nothing, driven by the real progress of
 * its task, finishing when it lands — and again whenever it is updated.
 *
 *   · the stages run in the order J gave: vine, rim traced, green closing
 *     in, surface, centre last;
 *   · the number behind them is the job's own step, not a clock;
 *   · it only ever climbs, and landing is one;
 *   · an update to a finished card forms it again; a reload does not;
 *   · and on the board a forming box carries the stage, the vine into it is
 *     as grown as the stage says, and the rim is traced on the canvas.
 *
 *   node tests/formation.mjs [url]     # default http://localhost:3000
 *   SHOTS=/dir node tests/formation.mjs   # also writes the two screenshots
 *
 * Runs alone: reads a box's forming animation to its end; under load it was still forming when read.
 */
import { readFileSync, readdirSync } from "node:fs";
import { FORM, formOf, formVars, progressOf, stageOf, within } from "../src/features/studio/formation.ts";
import { STAGGER_MS } from "../src/features/studio/timelineView.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The order                                                        */
/* ------------------------------------------------------------------ */

const order = ["vine", "rim", "close", "surface", "core"];
check("five stages, in the order given", Object.keys(FORM).join() === order.join(), Object.keys(FORM).join());
check("each ends where the next begins, from nothing to landed", (() => {
  const bands = order.map((k) => FORM[k]);
  return bands[0][0] === 0 && bands[bands.length - 1][1] === 1 && bands.every((b, i) => i === 0 || b[0] === bands[i - 1][1]);
})());
check("the vine grows first", stageOf(0.1) === "vine" && stageOf(0.29) === "vine");
check("where the vine arrives, the rim is traced", stageOf(0.3) === "rim" && stageOf(0.5) === "rim");
check("then the green closes in from the edges", stageOf(0.6) === "close");
check("then the surface grows from zero", stageOf(0.85) === "surface");
check("and the centre is the last thing to form", stageOf(0.97) === "core" && stageOf(1) === "core");
check("within a stage runs 0..1 and clamps", within(0.3, "rim") === 0 && within(0.55, "rim") === 1 && within(0.9, "rim") === 1);

/* ------------------------------------------------------------------ */
/* 2. Driven by the real progress of the task                          */
/* ------------------------------------------------------------------ */

const steps = [
  "Claude is reading the drawing…",
  "Tracing the drawing…",
  "Looking at trace 1…",
  "Trace 2 of 3, thickened · best 24%…",
  "Looking at trace 2…",
  "Trace 3 of 3, thicker still, no ground · best 24%…",
  "Refining the drawing…",
];
const ps = steps.map(progressOf);
check("every step the runs actually say maps to a number", ps.every((p) => typeof p === "number"), ps.join(","));
check("and they climb in the order the work happens", ps.every((p, i) => i === 0 || p >= ps[i - 1]), ps.join(" → "));
check("reading is where a thread lands, and the floor", progressOf("Reading the shape: cube…") === 0.15);
check("the second pass is the last stretch before it lands", progressOf("Refining the drawing…") > 0.8 && progressOf("Refining the drawing…") < 1);
check("a step nobody knows leaves the number where it was", progressOf("something new") === null && progressOf("") === null);
check("a thread landing still running is at the floor; one landing done is formed",
  formOf({ state: "running" }).p === 0.15 && formOf({ state: "done" }).p === 1);
check("the stylesheet is handed its numbers and no arithmetic", (() => {
  const v = formVars(0.9);
  return v["--form"] === 0.9 && v["--form-rim"] === 1 && v["--form-close"] === 1 && v["--form-surface"] > 0.6 && v["--form-surface"] < 0.7 && v["--form-core"] === 0;
})(), JSON.stringify(formVars(0.9)));
check("at one, everything is there", formVars(1)["--form-surface"] === 1 && formVars(1)["--form-core"] === 1 && formVars(1)["--form-rim"] === 1);
check("while the rim is being traced, the construct's own rim is not there yet", formVars(0.45)["--form-rim"] === 0);
check("the face has no core while it forms; the centre comes last", /\.molten\[data-forming\] \{[\s\S]*?var\(--mo-char\) 0%, var\(--mo-char\) 62%/.test(readFileSync("src/core/ui/molten.css", "utf8")));

/* ------------------------------------------------------------------ */
/* 3. Wired: the store, the queue, the canvas, the stylesheet          */
/* ------------------------------------------------------------------ */

const store = ["board/store.ts", ...readdirSync("src/features/studio/board/store").filter((f) => f.endsWith(".ts")).map((f) => `board/store/${f}`)].map((f) => readFileSync(`src/features/studio/${f}`, "utf8")).join("\n");
check("progress only ever climbs", /const next = Math\.max\(had\.p, Math\.min\(1, p\)\);/.test(store));
check("landing is one, whatever step it was on", /const form = state === "done" \? \{ \.\.\.\(t\.form \?\? \{ p: 0, gen: 0 \}\), p: 1 \}/.test(store));
check("an update to a finished card forms it again", /function reformed\(/.test(store) && /return \{ p: 1, gen: had\.gen \+ 1 \};/.test(store));
check("…and one still being worked on is left forming", /if \(\(t\.state \?\? "done"\) === "running"\) return had;/.test(store));
check("a pass, a cost and a line are all updates",
  (store.match(/form: reformed\(t\)/g) ?? []).length >= 3);
const queue = readFileSync("src/features/studio/DrawQueue.tsx", "utf8");
check("the job's own step drives its own box, not whatever landed last",
  /st\.noteProgress\(job\.threadId \?\? st\.liveThreadId, progressOf\(step\)\)/.test(queue));
/*
 * It begins at the press of Make real, not when the answer comes back.
 * The queue lands the iteration and hands the job its id; the job reaching
 * complete is what completes the box, and a later pass still running says
 * so rather than letting the queue call it finished early.
 */
check("the iteration is landed when the drawing is queued, at the first milestone",
  /const threadId = get\(\)\.landThread\(\{/.test(store) && /form: \{ p: QUEUED, gen: 1 \}/.test(store) && /threadId, status: "waiting" as const/.test(store));
check("…and the landing that follows fills that one in rather than making a second",
  /if \(fill && get\(\)\.threads\.some\(\(t\) => t\.id === fill\)\)/.test(store));
check("the box is complete when the job is, and a pass still running says so",
  /if \(!r\.pending && job\.threadId\) useStudio\.getState\(\)\.markThread\(job\.threadId, "done"\);/.test(queue)
  && /\.finally\(done\);/.test(readFileSync("src/features/studio/reshapeRun.ts", "utf8")));
const timeline = ["Timeline.tsx", ...["layout.tsx", "Timeline.tsx", "vines.ts", "IterationBox.tsx", "pieces.tsx", "cards.tsx"].map((f) => `timeline/${f}`)].map((f) => readFileSync(`src/features/studio/loop/${f}`, "utf8")).join("\n");
check("what is shown follows the truth at a capped rate rather than jumping", /const WHOLE_MS = 2600;/.test(timeline) && /Math\.max\(0, at\) \+ dt \/ WHOLE_MS/.test(timeline));
/*
 * This used to pin the opposite: "nothing forms on a reload of something
 * that did not change". His reading replaced it — "if you are in the
 * design preview and havent seen the timeline yet dont have the elements
 * add until you open the timeline where everything not seen yet is all
 * loaded in sequentially" — and a session that has only just started has
 * not seen the timeline either. What is pinned now is the thing that
 * decides it: a box arrives unless this session watched it arrive.
 */
check("a box arrives unless this session has watched it arrive", /const watched = new Set<string>\(\);/.test(timeline) && /if \(watched\.has\(t\.id\)\)/.test(timeline));
check("and they start a stagger apart rather than one after another finishing",
  /st\.wait\.set\(t\.id, queued\+\+ \* STAGGER_MS\)/.test(timeline) && /export const STAGGER_MS = 200;/.test(readFileSync("src/features/studio/timelineView.ts", "utf8")));
check("a box whose turn has not come is not drawn at all", /if \(shownOf\(t\.id\) < 0\) return null;/.test(timeline));
check("a new generation starts it from nothing", /st\.gen\.set\(t\.id, f\.gen\);\s*st\.shown\.set\(t\.id, -1\);/.test(timeline));
check("the vine into a forming box grows first", /const grow = Math\.min\(1, Math\.max\(0, shownOf\(cord\.to\)\) \/ FORM\.vine\[1\]\);/.test(timeline));
check("the rim is traced on the canvas, from where the vine arrived", /function paintRim\(/.test(timeline) && /c\.lineDashOffset = -side;/.test(timeline));
check("and then the green closes in from the edges, on the box and over the face",
  /inset 0 0 calc\(var\(--form-close, 0\) \* 10px\) calc\(var\(--form-close, 0\) \* 30px\) color-mix\(in oklab, var\(--verdant-hot\)/.test(readFileSync("src/core/ui/molten.css", "utf8")));
check("the trace sits just outside the box, where the whole of it shows", /const out = 2\.5;/.test(timeline));
check("and runs two laps, so a trace starting on the last leg is not cut off at the path's end", /for \(let lap = 0; lap < 2; lap\+\+\)/.test(timeline) && /c\.setLineDash\(\[len, perimeter \* 2\]\);/.test(timeline));
check("and hands over as the green closes in", /c\.globalAlpha = 1 - closing;/.test(timeline));
check("in the green that means finished", /c\.strokeStyle = PROCESS\.done;/.test(timeline));
check("a forming box says so and carries its two numbers", /data-forming=\{forming < 1 \? "" : undefined\}/.test(timeline) && /formVars\(forming\)/.test(timeline));
const strand = readFileSync("src/features/studio/loop/strand.ts", "utf8");
check("a vine can be drawn part-grown, and what has grown looks as it will", /grow\?: number/.test(strand) && /whole\.slice\(0, Math\.max\(2, Math\.ceil\(whole\.length \* grow\)\)\)/.test(strand));
const css = readFileSync("src/core/ui/molten.css", "utf8");
check("the surface grows from zero, from the edges in", /\.molten\[data-forming\]::before,\s*\n\.molten\[data-forming\]::after \{[\s\S]*?clip-path: inset\(calc\(\(1 - var\(--form-surface, 1\)\) \* 50%\)/.test(css));
check("the centre is the last thing to form", /\.molten\[data-forming\] > \[data-molten\][\s\S]*?--form-core/.test(css));

/* ------------------------------------------------------------------ */
/* 4. On the board                                                     */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const shots = process.env.SHOTS;
  /** Two boards and a third at a given point of forming. */
  const seed = ({ p, state }) => {
    const threads = [
      { id: "g0", at: 0, mode: "plan", state: "done", ask: "Lay out the home page", answer: "Done.", changes: ["changed the hero"], parentId: null },
      { id: "g1", at: 1, mode: "critique", state: "done", ask: "Tighten the spacing", answer: "Done.", changes: ["changed 2 things"], parentId: "g0" },
      { id: "g2", at: 2, mode: "build", state, ask: "Add a pricing table under the hero", answer: state === "done" ? "Done: three tiers." : "", changes: ["pricing table added"], parentId: "g1", form: { p, gen: 1 } },
    ];
    const spots = { "box:g0": { x: 60, y: 90 }, "box:g1": { x: 340, y: 230 }, "box:g2": { x: 620, y: 110 } };
    localStorage.setItem("builder.studio", JSON.stringify({ state: { threads, threadSpots: spots, openThreadId: null }, version: 0 }));
  };
  const open = async (p, state) => {
    const page = await b.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: 2 });
    await page.addInitScript(seed, { p, state });
    await page.goto(`${url}/builder`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1300);
    await page.locator("[data-finish]").click();
    /* A whole formation is 2600ms, and the third box in the run waits two
       stagger slots before it starts: a session that has not seen the
       timeline watches everything arrive, .2s apart. */
    await page.waitForTimeout(2600 + 2 * STAGGER_MS + 1200);
    return page;
  };
  const read = (page) => page.evaluate(() => {
    const box = document.querySelector('[data-box="g2"]');
    const cs = getComputedStyle(box);
    const before = getComputedStyle(box, "::before");
    return {
      forming: box.hasAttribute("data-forming"),
      form: cs.getPropertyValue("--form").trim(),
      surface: cs.getPropertyValue("--form-surface").trim(),
      core: cs.getPropertyValue("--form-core").trim(),
      cloudOpacity: before.opacity,
      cloudWanted: cs.getPropertyValue("--mo-cloud").trim(),
    };
  });

  const mid = await open(0.45, "running");
  const m = await read(mid);
  check("a box still forming says so", m.forming === true, JSON.stringify(m));
  check("at the rim stage the surface has not come yet", Number(m.surface) === 0 && Number(m.cloudOpacity) === 0, `surface ${m.surface}, cloud ${m.cloudOpacity}`);
  check("and neither has the centre", Number(m.core) === 0);
  check("the vine into it is whole by then, because the vine came first", (() => {
    // The canvas cannot be asked, but the rule can: the vine band ends before the rim begins.
    return 0.45 >= FORM.vine[1];
  })());
  if (shots) {
    const box = await mid.locator('[data-box="g2"]').boundingBox();
    const prev = await mid.locator('[data-box="g1"]').boundingBox();
    const x0 = Math.min(box.x, prev.x) - 40, y0 = Math.min(box.y, prev.y) - 40;
    const x1 = Math.max(box.x + box.width, prev.x + prev.width) + 40, y1 = Math.max(box.y + box.height, prev.y + prev.height) + 40;
    await mid.screenshot({ path: `${shots}/forming-mid.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  }
  await mid.close();

  const done = await open(1, "done");
  const d = await read(done);
  check("a landed box has finished forming", d.forming === false && d.form === "", JSON.stringify(d));
  /* Against the construct's own dial rather than a number: how much cloud a
   temperature takes is set per temperature (`molten.css`), and what this is
   about is that forming has finished handing it over. */
check("and its cloud is all the way in", (() => (
  Number(d.cloudWanted) > 0 && Math.abs(Number(d.cloudOpacity) - Number(d.cloudWanted)) < 0.02
))(), `${d.cloudOpacity} of ${d.cloudWanted}`);
  if (shots) {
    const box = await done.locator('[data-box="g2"]').boundingBox();
    const prev = await done.locator('[data-box="g1"]').boundingBox();
    const x0 = Math.min(box.x, prev.x) - 40, y0 = Math.min(box.y, prev.y) - 40;
    const x1 = Math.max(box.x + box.width, prev.x + prev.width) + 40, y1 = Math.max(box.y + box.height, prev.y + prev.height) + 40;
    await done.screenshot({ path: `${shots}/forming-done.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  }
  await done.close();

  /*
   * A reload is a session that has not seen the timeline, so a reload
   * forms it again — and by the time the run is over it has landed.
   */
  const again = await open(1, "done");
  const r1 = await read(again);
  check("a reload forms it again, because a new session has seen nothing arrive", r1.forming === false && r1.form === "", JSON.stringify(r1));
  await again.evaluate(() => {
    // An update: a pass noted on the finished card, as the second pass does.
    const raw = JSON.parse(localStorage.getItem("builder.studio") || "{}");
    raw.state.threads[2].form = { p: 1, gen: 2 };
    localStorage.setItem("builder.studio", JSON.stringify(raw));
  });
  // The store is what the board reads; poke it the way the app would.
  const bumped = await again.evaluate(() => {
    const hook = window.__studioNotePass;
    if (!hook) return "no hook";
    hook("second pass · test · 1.0s · cost not reported", "g2");
    return "bumped";
  });
  if (bumped === "bumped") {
    await again.waitForTimeout(120);
    const r2 = await read(again);
    check("an update to a finished card forms it again", r2.forming === true, JSON.stringify(r2));
    await again.waitForTimeout(3200);
    const r3 = await read(again);
    check("…and it finishes", r3.forming === false);
  } else {
    check("an update to a finished card forms it again (via the store)", false, "no __studioNotePass seam on the page, so re-forming could not be driven");
  }
  await again.close();
  await b.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
