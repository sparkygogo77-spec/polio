/**
 * The timeline ends up looking at where the boxes actually are.
 *
 * Boxes are dragged anywhere, so the origin stops meaning anything within a
 * minute. What is checked here is the behaviour rather than the arithmetic
 * (`tests/timeline-view.mjs` has that): opening the timeline settles the
 * view, dropping a box settles it again, it animates rather than jumping,
 * the view holds still while a box is being carried, and none of it costs a
 * frame.
 *
 *   node tests/timeline-centre.mjs [url]      # default http://localhost:3000
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
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* Six iterations, parked well off to one side and a long way down: a board
   somebody has been moving things around on. */
const thread = (id, parentId, i) => ({
  id, parentId, at: 1_700_000_000_000 + i * 1000, mode: "critique",
  ask: `ask ${i}`, answer: `answer ${i}`, changes: [`changed thing ${i}`],
});
const THREADS = [
  thread("t0", null, 0), thread("t1", "t0", 1), thread("t2", "t0", 2),
  thread("t3", "t1", 3), thread("t4", "t1", 4), thread("t5", "t2", 5),
];
const SPOTS = {
  "box:t0": { x: 1800, y: 900 }, "box:t1": { x: 2100, y: 1100 }, "box:t2": { x: 1700, y: 1300 },
  "box:t3": { x: 2400, y: 1000 }, "box:t4": { x: 2050, y: 1450 }, "box:t5": { x: 1600, y: 1600 },
};
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [], groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], threads: THREADS, threadSpots: SPOTS,
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/** The plot's transform, read off the style it was given. */
const view = () => page.evaluate(() => {
  // Found by its handle, or by the transform it wears, so a timeline built
  // without the settle fails these checks with its own numbers rather than
  // stopping at "no plot".
  const el = document.querySelector("[data-timeline-plot]")
    ?? [...document.querySelectorAll("[data-timeline] div")].find((d) => /translate\(.+\)\s*scale\(/.test(d.getAttribute("style") ?? ""));
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(el?.getAttribute("style") ?? "");
  return m ? { x: +m[1], y: +m[2], zoom: +m[3] } : null;
});

/**
 * The way back to the middle.
 *
 * It used to be a "centre" button in the timeline's bottom-left corner,
 * beside an update count and a second copy of the zoom percentage. All
 * three are gone: the zoom readout in the bar is one number in one store,
 * shared with the board, so it is the one press that puts either surface
 * back — "the zoom percentage number should be the button doing that for
 * both since they do the same thing now".
 */
const centre = async () => page.locator("[data-fit-readout]").first().click();

/** Where every box sits on the screen right now, and how close it gets to an edge. */
const edges = () => page.evaluate(() => {
  const host = document.querySelector("[data-timeline]").getBoundingClientRect();
  const boxes = [...document.querySelectorAll("[data-box]")].map((el) => el.getBoundingClientRect());
  if (!boxes.length) return null;
  return {
    n: boxes.length,
    left: Math.min(...boxes.map((b) => b.left - host.left)),
    top: Math.min(...boxes.map((b) => b.top - host.top)),
    right: Math.max(...boxes.map((b) => host.right - b.right)),
    bottom: Math.max(...boxes.map((b) => host.bottom - b.bottom)),
    host: { w: Math.round(host.width), h: Math.round(host.height) },
  };
});

/* ------------------------------------------------------------------ */
/* 1. Opening the timeline settles it                                   */
/* ------------------------------------------------------------------ */
{
  /* Sampled across the arrival, so "it animated" is more than two numbers. */
  await page.locator("[data-finish]").click();
  const seen = [];
  for (let i = 0; i < 14; i++) {
    seen.push(await view());
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(700);
  const settled = await view();
  check("the timeline opens onto a view", !!settled, settled ? `${settled.x.toFixed(0)},${settled.y.toFixed(0)} at ${(settled.zoom * 100).toFixed(0)}%` : "no plot");
  // The boxes are parked around x 1600–2600, so the origin is nowhere near them.
  check("and it is not the origin", Math.hypot(settled.x, settled.y) > 200, `${settled.x.toFixed(0)},${settled.y.toFixed(0)}`);
  const moved = new Set(seen.filter(Boolean).map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.zoom.toFixed(3)}`));
  check("it animated there rather than jumping", moved.size >= 4, `${moved.size} distinct views across the arrival`);

  const e = await edges();
  check("every box landed on the screen", e && e.left > 0 && e.top > 0 && e.right > 0 && e.bottom > 0,
    e ? `${e.n} boxes · clear by ${e.left.toFixed(0)}/${e.top.toFixed(0)}/${e.right.toFixed(0)}/${e.bottom.toFixed(0)} in ${e.host.w}×${e.host.h}` : "no boxes");
  check("and none of them sits on an edge", e && Math.min(e.left, e.top, e.right, e.bottom) > 20,
    e ? `nearest edge ${Math.min(e.left, e.top, e.right, e.bottom).toFixed(0)}px` : "");
}

/* ------------------------------------------------------------------ */
/* 2. Carrying a box holds the view; putting it down settles again      */
/* ------------------------------------------------------------------ */
{
  const before = await view();
  const box = page.locator("[data-box]").first();
  const r = await box.boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  /* Carried a long way, in steps, watching the view the whole time. */
  const during = new Set();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(r.x + r.width / 2 + i * 40, r.y + r.height / 2 + i * 22);
    during.add(JSON.stringify(await view()));
  }
  check("the view holds still while a box is being carried", during.size === 1, `${during.size} views over eight moves`);
  check("and it is the view it had", JSON.parse([...during][0]).x === before.x);

  await page.mouse.up();
  await page.waitForTimeout(900);
  const after = await view();
  check("putting it down settles the view again", Math.hypot(after.x - before.x, after.y - before.y) > 8 || Math.abs(after.zoom - before.zoom) > 0.01,
    `${before.x.toFixed(0)},${before.y.toFixed(0)} → ${after.x.toFixed(0)},${after.y.toFixed(0)}`);
  const e = await edges();
  check("and the carried box is on the screen with the rest", e && e.left > 0 && e.top > 0 && e.right > 0 && e.bottom > 0,
    e ? `clear by ${e.left.toFixed(0)}/${e.top.toFixed(0)}/${e.right.toFixed(0)}/${e.bottom.toFixed(0)}` : "no boxes");
}

/* ------------------------------------------------------------------ */
/* 3. Centre means where the boxes are, and it costs nothing            */
/* ------------------------------------------------------------------ */
{
  /* Somewhere in the timeline with no box under it, to drag the ground by. */
  const empty = await page.evaluate(() => {
    const host = document.querySelector("[data-timeline]").getBoundingClientRect();
    const boxes = [...document.querySelectorAll("[data-box]")].map((el) => el.getBoundingClientRect());
    for (let y = host.top + 30; y < host.bottom - 30; y += 20) {
      for (let x = host.left + 30; x < host.right - 30; x += 20) {
        if (!boxes.some((b) => x > b.left - 12 && x < b.right + 12 && y > b.top - 12 && y < b.bottom + 12)) return { x, y };
      }
    }
    return null;
  });
  check("there is ground to take hold of", !!empty, empty ? `${empty.x},${empty.y}` : "every pixel is a box");

  const home0 = await view();
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await page.mouse.move(empty.x + 420, empty.y - 160, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const lost = await view();
  check("dragging the ground pans away from it", Math.hypot(lost.x - home0.x, lost.y - home0.y) > 200,
    `${home0.x.toFixed(0)},${home0.y.toFixed(0)} → ${lost.x.toFixed(0)},${lost.y.toFixed(0)}`);

  /* Frames measured across the settle and nothing else: the click is sent,
     then the loop starts, then it is read once the arrival is over. */
  const FRAMES = `window.__f=[];(function l(){window.__r=requestAnimationFrame((t)=>{window.__f.push(t);l();});})();`;
  const STATS = `cancelAnimationFrame(window.__r);(()=>{const f=window.__f,d=[];for(let i=1;i<f.length;i++)d.push(f[i]-f[i-1]);
    const beat=[...d].sort((a,b)=>a-b)[Math.floor(d.length*0.5)];
    return {beat:+beat.toFixed(1),late:d.filter(v=>v>beat*1.5).length,frames:d.length,max:+Math.max(...d).toFixed(1)};})()`;
  /* What the timeline costs sitting still, to measure the settle against:
     the ground and the strands are both running either way, so an absolute
     count would only be measuring them. */
  await page.evaluate(FRAMES);
  await page.waitForTimeout(900);
  const idle = await page.evaluate(STATS);

  await page.evaluate(FRAMES);
  await centre();
  await page.waitForTimeout(900);
  const s = await page.evaluate(STATS);
  const home = await view();
  check("centre goes to the boxes, not to the origin",
    Math.hypot(home.x - lost.x, home.y - lost.y) > 20 && Math.hypot(home.x, home.y) > 200,
    `${lost.x.toFixed(0)},${lost.y.toFixed(0)} → ${home.x.toFixed(0)},${home.y.toFixed(0)}`);
  /*
   * Against the rate the timeline already runs at, not against 16.7ms.
   *
   * A render a frame showed up as a doubled beat, which is what this is
   * here to catch, and comparing to idle catches it wherever this runs. An
   * absolute number would instead be measuring the nebula behind the boxes:
   * on a container with no GPU four window-sized layers set the beat before
   * the settle does anything at all.
   */
  /*
   * The rate is frames delivered, not the middle gap between them.
   *
   * This compared medians, and the median is the wrong statistic for what
   * the page does now: the gaps are bimodal, half at 16.7ms and half at
   * 33.3ms, so the median falls on whichever side holds the extra frame and
   * flips between the two on identical builds. Measured over three runs of
   * this sequence: idle read 16.7, 33.3 and 16.7 while settling read 33.2,
   * 33.3 and 33.3 — the same page, the check failing twice and passing once
   * on nothing but where the median landed. The late shares over the same
   * three runs say the opposite of the failure: settling dropped 8%, 6% and
   * 3% of its frames while sitting still dropped 47%, 3% and 43%.
   *
   * Frames delivered in a fixed window is stable under that, and it is what
   * the name claims: the rate the timeline runs at. A settle that costs a
   * frame delivers fewer; one that does not, does not.
   */
  const rate = (o) => o.frames;
  check("settling holds whatever rate the timeline already had", rate(s) >= rate(idle) * 0.8,
    `${rate(s)} frames settling against ${rate(idle)} sitting still · beats ${s.beat}ms and ${idle.beat}ms`);
  /*
   * A share of the frames, not a count of them.
   *
   * This was "three more late frames than idle", and three was about a
   * quarter of the window when it was written: the container had no frames
   * to spare and 900ms held thirteen of them. The ground rewrite gave the
   * page its 60fps back, so the same window now holds fifty-odd, the same
   * proportion of stutter is eight late frames rather than two, and a flat
   * three started failing a page that had got faster. A share holds the same
   * claim at whatever rate this ends up running at.
   *
   * The number is measured rather than picked. Over twenty-one runs of this
   * exact sequence at 60fps, sitting still drops 0-6 frames of ~52 and
   * settling drops 0-10 of ~45-57, and settling is never more than 17 points
   * worse than sitting still. They fall singly and scattered through the
   * window rather than in a run, which is the container's scheduler and not
   * the settle. 35 points is twice the worst honest gap.
   *
   * What this can and cannot see, injected a frame at a time into the settle
   * window to find out: a cost of 4-12ms a frame reads as 9-11% late with
   * the beat unchanged, which is inside the noise and invisible here; a cost
   * of 24ms a frame doubles the beat to 50ms and drops the late count to
   * ZERO, because once every frame is late none of them is late against the
   * median. So the check above is the one that catches a render a frame, and
   * this one is only here for stutter that comes and goes. Tightening it
   * would buy nothing but failures on a quiet page.
   */
  const share = (o) => (o.frames ? o.late / o.frames : 0);
  const pct = (o) => `${(share(o) * 100).toFixed(0)}%`;
  check("and drops no greater a share of its frames than sitting still does", share(s) <= share(idle) + 0.35,
    `${s.late} late of ${s.frames} settling (${pct(s)}) · ${idle.late} of ${idle.frames} idle (${pct(idle)}) · worst ${s.max}ms`);

  const e = await edges();
  check("everything is back on the screen", e && Math.min(e.left, e.top, e.right, e.bottom) > 20,
    e ? `nearest edge ${Math.min(e.left, e.top, e.right, e.bottom).toFixed(0)}px` : "no boxes");
}

/* ------------------------------------------------------------------ */
/* 4. Centring is centring in what you can SEE                          */
/* ------------------------------------------------------------------ */

/*
 * HIS WORDS: "centering on the timeline seems to be off while dragging,
 * stuff is toward the top".
 *
 * MEASURED, at 1440x900 with six updates: the pane the timeline stands in
 * scrolls, by design, so that carrying on scrolling reaches the prompt
 * section under it — 248px of travel, which is the band's height. The
 * settle never knew. It fits the boxes into the timeline's own box, less
 * the band, measured from the timeline's top — and with the pane at its
 * foot that top is 248px above the window, so the set was cut off 133px
 * above the top of the screen with 465px of nothing below it, and pressing
 * centre put it back to exactly the same place.
 *
 * So this measures what he measures: where the boxes are against the
 * WINDOW, which is the only frame a person has, after asking for the
 * middle. Nothing about the plot's own transform, which was always right.
 */
{
  const inWindow = () => page.evaluate(() => {
    const pane = document.querySelector("[data-studio-pane]");
    const band = document.querySelector("[data-studio-band]");
    const bandTop = band ? band.getBoundingClientRect().top : window.innerHeight;
    const bar = document.querySelector("[data-studio-pane]").getBoundingClientRect().top;
    /* The lanes hang off the last box and are part of what the fit holds,
       so they are part of what "between the two edges" is measured on. */
    const set = [...document.querySelectorAll("[data-box], [data-lane], [data-lane-box]")].map((e) => e.getBoundingClientRect());
    if (!set.length) return null;
    const top = Math.min(...set.map((b) => b.top));
    const bottom = Math.max(...set.map((b) => b.bottom));
    return {
      scroll: Math.round(pane.scrollTop),
      travel: Math.round(pane.scrollHeight - pane.clientHeight),
      above: Math.round(top - bar),
      below: Math.round(bandTop - bottom),
      cut: Math.round(Math.max(0, bar - top)),
    };
  });

  const before = await inWindow();
  check("the pane under the timeline has travel of its own, as it is meant to", before && before.travel > 40, `${before?.travel}px`);
  check("and the corner box that used to hold a second way back is gone",
    (await page.locator("[data-timeline-centre]").count()) === 0
    && !/\bcentre\b/.test(await page.locator("[data-timeline]").innerText().catch(() => "")),
    `${await page.locator("[data-timeline-centre]").count()} of them`);

  /* Put it where a wheel gesture or a press low in the pane puts it. */
  await page.evaluate(() => { const p = document.querySelector("[data-studio-pane]"); p.scrollTop = p.scrollHeight; });
  await page.waitForTimeout(500);
  const away = await inWindow();
  check("scrolled to its foot, the timeline's contents go off the top", away.cut > 20, `cut off ${away.cut}px above the window, ${away.below}px of nothing below`);

  /* And now ask for the middle, the way he would. */
  await centre().catch(() => {});
  await page.waitForTimeout(1200);
  const back = await inWindow();
  check("asking for the middle brings the pane back with it", back.cut === 0, `${back.cut}px still off the top, pane at ${back.scroll} of ${back.travel}`);
  check("and leaves the set between the two edges rather than against one",
    back.above > 8 && back.below > 8 && Math.abs(back.above - back.below) < Math.max(80, back.above * 0.75),
    `${back.above}px above, ${back.below}px below`);
}

/* ------------------------------------------------------------------ */
/* 5. The middle is the middle of what he is looking at                 */
/* ------------------------------------------------------------------ */

/*
 * HIS MEASUREMENT, off the deploy at 1546x1278: the frame at (228, 87)
 * 1318x1191, so its centre is (887, 683); the four update cards' box from
 * (81, 28) to (414, 175), so their centre is (248, 101). The cards sat
 * 639px left of the frame's centre and 582px above it, with their top edge
 * 59px ABOVE the frame's own top edge — part of the timeline outside the
 * timeline. The plot's transform read `matrix(0.683, 0, 0, 0.683, 0, 0)`:
 * the scale right and the translation NOTHING.
 *
 * Two faults behind that, and this holds both shut. The pan is the
 * component's own state and starts at zero on every mount while the zoom
 * is the store's and survives, so a settle that does not run leaves
 * exactly that matrix — and the settle was one attempt in one frame after
 * mount, which gives up silently if the pane has not laid out yet. And
 * what the fit centred was every box including the lane fan hanging off
 * the last one, so the cards a person is actually looking at were pushed
 * off to one side of their own middle.
 *
 * Measured at his size, on his shape of document.
 */
{
  await page.setViewportSize({ width: 1546, height: 1278 });
  await page.waitForTimeout(700);
  await centre();
  await page.waitForTimeout(1400);

  const seen = await page.evaluate(() => {
    const host = document.querySelector("[data-timeline]").getBoundingClientRect();
    const band = document.querySelector("[data-studio-band]");
    const bandH = band ? band.getBoundingClientRect().height : 0;
    const plot = document.querySelector("[data-timeline-plot]");
    const m = /matrix\(([-\d.]+), 0, 0, [-\d.]+, ([-\d.]+), ([-\d.]+)\)/.exec(getComputedStyle(plot).transform);
    const set = [...document.querySelectorAll("[data-box]")].map((e) => e.getBoundingClientRect());
    const x0 = Math.min(...set.map((r) => r.left)), x1 = Math.max(...set.map((r) => r.right));
    const y0 = Math.min(...set.map((r) => r.top)), y1 = Math.max(...set.map((r) => r.bottom));
    /* The room is the frame less the band that stands over its foot. */
    return {
      zoom: m ? Number(m[1]) : 1,
      pan: m ? [Number(m[2]), Number(m[3])] : [0, 0],
      offX: Math.round((x0 + x1) / 2 - (host.x + host.width / 2)),
      offY: Math.round((y0 + y1) / 2 - (host.y + (host.height - bandH) / 2)),
      room: [Math.round(host.width), Math.round(host.height - bandH)],
      aboveFrame: Math.round(Math.max(0, host.y - y0)),
      cards: set.length,
    };
  });

  check("the plot is translated, not merely scaled", Math.hypot(seen.pan[0], seen.pan[1]) > 1,
    `matrix(${seen.zoom.toFixed(3)}, 0, 0, ${seen.zoom.toFixed(3)}, ${seen.pan[0].toFixed(0)}, ${seen.pan[1].toFixed(0)})`);
  check("no update is above the frame's own top edge", seen.aboveFrame === 0, `${seen.aboveFrame}px outside it`);
  /*
   * A fifth of the room, not a few pixels. "Nothing sits on an edge" wins
   * over the middle where the two disagree (`timelineView.ts`), and the
   * lane fan hanging off the last box is part of what has to stay on
   * screen, so the updates are pulled a little off their own centre by
   * design — measured, about 12% down the room at this size. What this
   * rules out is his reading: 639px off on a 1318px frame, 582px up on a
   * 1191px one, with part of the set outside the frame altogether.
   */
  check("the updates sit at the middle across", Math.abs(seen.offX) < seen.room[0] * 0.2,
    `${seen.offX}px off the middle of a ${seen.room[0]}px room`);
  check("and at the middle down the room", Math.abs(seen.offY) < seen.room[1] * 0.2,
    `${seen.offY}px off the middle of a ${seen.room[1]}px room`);
}

/* ------------------------------------------------------------------ */
/* 6. The fit belongs to the room, so it follows the room               */
/* ------------------------------------------------------------------ */

/*
 * The fault behind his matrix, reproduced directly. The settle was one
 * attempt in one frame after mount: open the timeline while the pane is
 * small and it fits to that, and nothing ever runs it again — measured,
 * the view stayed at scale 0.28 with 126px of the set above the frame's
 * own top edge after the window went to 1546x1278.
 */
{
  /* A page of its own: `owns` is a module variable that remembers a view
     somebody moved, and every section above this one has moved it. This
     is about a timeline nobody has touched, opened into a small room. */
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 420, height: 240 });
  await fresh.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await fresh.waitForTimeout(1200);
  await fresh.locator("[data-finish]").first().click({ force: true });
  await fresh.waitForTimeout(2200);
  const small = await fresh.evaluate(() => {
    const plot = document.querySelector("[data-timeline-plot]");
    return /matrix\(([-\d.]+)/.exec(getComputedStyle(plot).transform)?.[1] ?? "1";
  });
  await fresh.setViewportSize({ width: 1546, height: 1278 });
  await fresh.waitForTimeout(2200);
  const big = await fresh.evaluate(() => {
    const host = document.querySelector("[data-timeline]").getBoundingClientRect();
    const plot = document.querySelector("[data-timeline-plot]");
    const z = /matrix\(([-\d.]+)/.exec(getComputedStyle(plot).transform)?.[1] ?? "1";
    const set = [...document.querySelectorAll("[data-box]")].map((r) => r.getBoundingClientRect());
    const y0 = Math.min(...set.map((r) => r.top));
    const x1 = Math.max(...set.map((r) => r.right));
    return { zoom: Number(z), above: Math.round(Math.max(0, host.y - y0)), past: Math.round(Math.max(0, x1 - (host.x + host.width))) };
  });
  check("given more room, the fit takes it", big.zoom > Number(small) * 1.2, `${Number(small).toFixed(3)} in a small window → ${big.zoom.toFixed(3)} in a large one`);
  check("and nothing is left outside the frame", big.above === 0 && big.past === 0, `${big.above}px above it, ${big.past}px past its right edge`);
  await fresh.close();
}

await context.close();
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
