/**
 * The Updates board holds where you left it, and fills the floor.
 *
 * Two things J found on screen, both measured before they were touched.
 *
 *   · The zoom reset every time Finish was pressed. Finish is the only door
 *     into this view and it is a toggle, so every trip to the board and back
 *     mounted the timeline again and refitted it. Measured: 1.85 back to 1
 *     with three updates, 0.77 back to 0.41 with eight.
 *   · The fit read far too small. Three updates covered 26% of a 1272x615
 *     board and eight covered 15% — because the ceiling was a flat 1, and
 *     because the chain ran straight down, so eight updates stood 1214 tall
 *     in a board 615 tall and the width went unused.
 *
 * Driven, not seeded: the view is what a person does with a wheel and a
 * button, so the checks press the button.
 *
 *   node tests/updates-view.mjs [url]
 */
import { createRequire } from "node:module";
import { SETTLE_MARGIN } from "../src/features/studio/timelineView.ts";

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

/** A document with this many finished updates on it. */
const doc = (n) => ({
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", nodes: [], shapes: [], groups: [], spaces: [], selection: [],
    threads: Array.from({ length: n }, (_, i) => ({
      id: `t${i}`, at: 1700000000000 + i * 1000, mode: "make", ask: `update ${i + 1}`,
      answer: `did the thing ${i + 1}`, changes: [], state: "done", model: "gpt-image-2", revisions: [],
    })),
  },
  version: 0,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });

/** Zoom, and how much of the board the chain covers. */
const state = () => page.evaluate(() => {
  const plot = document.querySelector("[data-timeline-plot]");
  const m = plot ? /scale\(([\d.]+)\)/.exec(plot.style.transform) : null;
  const cards = [...document.querySelectorAll("[data-box]")];
  const host = document.querySelector("[data-timeline]")?.getBoundingClientRect();
  if (!cards.length || !host) return { zoom: m ? Number(m[1]) : null, cards: cards.length, fill: 0 };
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const c of cards) { const q = c.getBoundingClientRect(); l = Math.min(l, q.x); t = Math.min(t, q.y); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  return {
    zoom: m ? Number(m[1]) : null, cards: cards.length,
    fill: Math.round(((r - l) * (b - t)) / (host.width * host.height) * 100),
    across: Math.round(r - l), down: Math.round(b - t),
    host: `${Math.round(host.width)}x${Math.round(host.height)}`,
  };
});

for (const n of [3, 8]) {
  await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc(n));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const finish = page.locator('[aria-label^="Finish"]').first();
  await finish.click({ force: true });
  /* Long enough for the whole run to arrive. The boxes come in `STAGGER_MS`
     apart — his number, 200 — so eight of them is 1.6s of arriving before
     the last one exists, and 1400ms read the board mid-run and called it
     "7 of 8". A wait calibrated before the stagger landed. */
  await page.waitForTimeout(1400 + n * 300);

  const open = await state();
  check(`${n} updates are all on the board`, open.cards === n, `${open.cards} of ${n}`);
  /*
   * The fit is allowed to stop for exactly two reasons, and "the cards are
   * adrift in the middle" is neither of them: either the column fills the
   * room it is given, or it stopped because one card had grown to its share
   * of the width.
   *
   * MEASURED ON THE BINDING AXIS, not as an area. Checking the area alone
   * was calibrated against a 615-tall board and went red the moment the
   * board became a whole screen — with the cards *bigger* than when it
   * passed. It is wrong again now, and for a better reason: the column
   * decides the zoom, so it fills the room in the direction that runs out
   * first, and the other direction is slack by exactly as much as the
   * column's shape differs from the room's. Eight updates fill 103% of the
   * room's height and 63% of its width, which is 34% of the area and is the
   * fit doing its job perfectly. The area was measuring the column's aspect
   * ratio and calling it a fault.
   */
  const room = await page.evaluate((margin) => {
    const host = document.querySelector("[data-timeline]").getBoundingClientRect();
    /*
     * Only a band that STANDS OVER the pane is a floor.
     *
     * The timeline's strip is a block below now, in the same travel, so it
     * takes no room from the fit — and measuring against it measured a room
     * the fit was never given.
     */
    const band = document.querySelector("[data-studio-band][data-band-over]")?.getBoundingClientRect();
    const floor = band && band.top > host.top ? band.top : host.bottom;
    /*
     * BOTH AXES OFF THE SAME SET, because that is what the fit sizes.
     *
     * `across` read the column alone while `down` read everything, fan
     * included. `settleView` aims at the SET on both axes and only
     * guarantees the column stays in frame, so measuring the column across
     * measured a subset of what was fitted: with the width now the axis that
     * runs out first, the set filled it to the margin while the column alone
     * came to 70% and this called that adrift.
     */
    const es = [...document.querySelectorAll("[data-box]")];
    const all = [...document.querySelectorAll("[data-box], [data-lane], [data-lane-box]")];
    if (!es.length) return null;
    let l = 1e9, r = -1e9;
    for (const e of all) { const q = e.getBoundingClientRect(); l = Math.min(l, q.x); r = Math.max(r, q.right); }
    let t = 1e9, b = -1e9;
    for (const e of all) { const q = e.getBoundingClientRect(); t = Math.min(t, q.y); b = Math.max(b, q.bottom); }
    const c = es[0].getBoundingClientRect();
    /* The room is the pane less the margin either side — the fit's own
       margin, read from the source rather than written in here, so moving it
       moves this too. It was 112, which was twice a margin that has since
       halved, and that alone put the fill 20 points under. */
    return {
      across: Math.round(((r - l) / (host.width - margin * 2)) * 100),
      down: Math.round(((b - t) / (floor - host.top - margin * 2)) * 100),
      card: Math.round(c.width), share: Math.round((c.width / host.width) * 100),
    };
  }, SETTLE_MARGIN);
  /* On the BINDING axis, which is whichever of the two fills more: with the
     strip no longer standing over the pane the width runs out first, so
     reading the vertical read the slack side. */
  check(`and they are not adrift in the middle of it`,
    Math.max(room.across, room.down) >= 90 || room.share >= 30,
    `fills ${room.across}% of the room across and ${room.down}% down — ${room.across >= room.down ? "across" : "down"} binds — a card ${room.card}px, ${room.share}% of the board`);
  /* A board is landscape; a chain that runs off the bottom cannot fill one. */
  check(`and the chain runs across rather than down`, open.across > open.down,
    `${open.across} across, ${open.down} down`);

  /* Now the person takes hold of it. A plain wheel pans; ctrl+wheel zooms. */
  await page.mouse.move(750, 500);
  await page.keyboard.down("Control");
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(70); }
  await page.keyboard.up("Control");
  await page.waitForTimeout(700);
  const mine = await state();
  check(`${n}: zooming in moves it`, mine.zoom > open.zoom + 0.05, `${open.zoom?.toFixed(2)} → ${mine.zoom?.toFixed(2)}`);

  await finish.click({ force: true });            // out to the board
  await page.waitForTimeout(700);
  await finish.click({ force: true });            // and back in
  await page.waitForTimeout(1400);
  const back = await state();
  check(`${n}: and Finish leaves it where it was`, Math.abs(back.zoom - mine.zoom) < 0.01,
    `${mine.zoom?.toFixed(3)} → ${back.zoom?.toFixed(3)}`);

  /* The zoom readout is how a person asks for the fit back. The little
     centre-and-count box this used to press was removed at his word — "remove
     the little centre and updates amount box in the bottom left" — and the
     readout took the job over, so this pressed an element that had not
     existed for two days and timed out rather than failing. A check that
     cannot run is not a check that passes. */
  await page.locator("[data-fit-readout]").click({ force: true });
  await page.waitForTimeout(900);
  const fitted = await state();
  check(`${n}: centre hands it back to the fit`, Math.abs(fitted.zoom - open.zoom) < 0.02,
    `${back.zoom?.toFixed(3)} → ${fitted.zoom?.toFixed(3)}, fit was ${open.zoom?.toFixed(3)}`);
}

/* A card opens beside its box, so a box near an edge puts its card over the
   edge — and the further in the board is zoomed, the further out it lands.
   Raising the ceiling is what made this visible, so it is checked here. */
{
  const boxes = page.locator("[data-box]");
  const n = await boxes.count();
  let worst = null;
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).click({ force: true });
    await page.waitForTimeout(600);
    const out = await page.evaluate(() => {
      const card = document.querySelector("[data-card][data-card-of]");
      const host = document.querySelector("[data-timeline]");
      if (!card || !host) return null;
      const c = card.getBoundingClientRect(), v = host.getBoundingClientRect();
      return Math.round(Math.max(0, v.left - c.left, c.right - v.right, v.top - c.top, c.bottom - v.bottom));
    });
    if (out !== null && (worst === null || out > worst)) worst = out;
  }
  check("a card opened on any box comes fully into view", worst === 0,
    worst === null ? "no card opened" : `worst was ${worst}px outside the board`);
}

/* The models, reachable from where a person is when they want them.
   Until this, changing the model meant leaving the timeline, finding the
   part on the board and opening its Element tab. */
{
  await page.locator("[data-box]").first().click({ force: true });
  await page.waitForTimeout(700);
  const side = page.locator("[data-side-panel-timeline]");
  check("the timeline has a panel on its left", (await side.count()) === 1);
  /* The block is his second line now — "pick what makes it, and tell me what
     it costs before i press anything" — so the route choice lives under the
     mark `make` rather than `route`, and the price rides with it. The panel's
     whole shape is held by `tests/finish-panel.mjs`; this asks only that the
     choice is still reachable from the timeline's own panel. */
  const route = side.locator('[data-panel-block="make"]');
  check("and it says what makes the next one, and what that costs", (await route.count()) === 1,
    (await route.count()) ? (await route.innerText()).split("\n")[0] : "not there");
  /* These updates made no part, so there is nothing to hold a setting and
     the panel says so rather than offering a control that writes nowhere. */
  const readout = await side.locator("[data-audit-readout]").count();
  const full = await side.locator("[data-audit-panel]").count();
  check("an update with no part of its own gets the readout, not a control",
    readout + full === 1, `${full} panels, ${readout} readouts`);
}

/* And the half that matters: an update that made a part offers that part's
   models, right there, without leaving the timeline. */
{
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("builder.studio"));
    const st = d.state;
    st.nodes = [{
      id: "d1", pageId: "page_home", featureId: "custom-idea", label: "a peak", prompt: "a peak drawn as one line",
      content: "", x: 200, y: 200, w: 200, h: 120, groupId: null, options: {}, priority: "must", custom: true,
      glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null,
      animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null,
      role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow",
      texture: null, sketch: null, plan: null,
    }];
    st.threads = [{ id: "e1", at: 1, mode: "drawing", state: "done", ask: "a peak", answer: "drew a peak",
      changes: [], parentId: null, madeId: "d1" }];
    st.threadSpots = { "box:e1": { x: 200, y: 160 } };
    st.openThreadId = null;
    localStorage.setItem("builder.studio", JSON.stringify(d));
  });
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  await page.locator('[aria-label^="Finish"]').first().click({ force: true });
  await page.waitForTimeout(1300);
  await page.locator('[data-box="e1"]').click({ force: true });
  await page.waitForTimeout(800);
  const side = page.locator("[data-side-panel-timeline]");
  check("an update that made a part offers that part's models here",
    (await side.locator("[data-audit-panel]").count()) === 1);
  const keys = side.locator("[data-model-key]");
  const n = await keys.count();
  check("with the models that serve it", n > 0, `${n} to choose from`);
  check("and the route's own marked", (await side.locator("[data-model-default]").count()) === 1);
  if (n > 1) {
    await keys.nth(1).click({ force: true });
    await page.waitForTimeout(600);
    const chosen = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes[0].plan?.model ?? null);
    check("choosing one from the timeline writes the part's plan", !!chosen, chosen ?? "nothing written");
    check("and the panel says the choice is the person's", (await side.locator("[data-model-mine]").count()) === 1);
  }
}

/* J's word. "Iterations" is not what he calls them. */
const words = await page.locator("[data-timeline]").innerText().catch(() => "");
check("the board calls them updates", /update/i.test(words) && !/iteration/i.test(words),
  /iteration/i.test(words) ? "it still says iterations" : "updates");

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
