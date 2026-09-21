/**
 * NO PART OF THE COLUMN IS EVER OUTSIDE THE FRAME.
 *
 * HIS RULING, restated after he measured the column 215px off the right edge
 * of a 1267px frame and 636px right of its centre: "NO PART OF THE COLUMN IS
 * EVER OUTSIDE THE FRAME. Clipping the thing he is reading is worse than any
 * amount of the fan hanging off. This outranks everything else. Subject to
 * that, the column's centre sits as near the room's centre as it can."
 *
 * The fault was never the fit. The fit centres: measured at four sizes it
 * puts the column's centre within 6px of the room's, with nothing off either
 * edge. What had no floor under it was the way back IN. The view a person
 * moves is theirs and is kept across the mount that Finish tears down — and
 * it was handed straight back without anyone asking whether the column was
 * still on the screen. Wheel the board sideways and press Finish twice and
 * it came back 1887px off the left edge, every card of it, in silence.
 *
 * So this exercises the door rather than the arithmetic: open the timeline,
 * move the view by hand the way he does, leave and come back.
 *
 *   · THE FIT, at four sizes: nothing outside, centre within 12px.
 *   · THE WAY BACK IN, after a hand pan that strands it: nothing outside.
 *   · THE HAND, when it has NOT stranded anything: left exactly where he
 *     put it, because a floor that also tidies is a floor that fights.
 *
 *     npx next start -p 3013
 *     node tests/column-inside.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = (n) => JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  activePageId: "page_home", nodes: [], shapes: [], groups: [], spaces: [], selection: [],
  threads: Array.from({ length: n }, (_, i) => ({
    id: `t${i}`, parentId: i ? `t${i - 1}` : null, at: 1_700_000_000_000 + i * 1000,
    mode: i ? "critique" : "start", ask: `ask ${i}`, answer: `answer ${i}`,
    changes: [`changed ${i}`], state: "done", form: { p: 1, gen: 1 },
  })),
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

/** Where the column stands against the room it is in. */
const read = (page) => page.evaluate(() => {
  const pane = document.querySelector("[data-timeline]")?.getBoundingClientRect();
  if (!pane) return null;
  const band = document.querySelector("[data-studio-band]")?.getBoundingClientRect();
  const es = [...document.querySelectorAll("[data-box]")];
  const all = [...document.querySelectorAll("[data-box], [data-lane], [data-lane-box]")];
  if (!es.length) return null;
  let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
  for (const e of es) { const q = e.getBoundingClientRect(); l = Math.min(l, q.x); t = Math.min(t, q.y); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  /* The SET is what gets centred now — his own word, "lanes being
     disregarded during centering is problematic" — while the COLUMN is what
     may never leave the frame. Two different jobs, so two measurements. */
  let sl = 1e9, sr = -1e9, sb = -1e9;
  for (const e of all) { const q = e.getBoundingClientRect(); sl = Math.min(sl, q.x); sr = Math.max(sr, q.right); sb = Math.max(sb, q.bottom); }
  const floor = band && band.top > pane.top ? band.top : pane.bottom;
  const plot = document.querySelector("[data-timeline-plot]");
  const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(plot).transform);
  const n = m ? m[1].split(",").map(Number) : null;
  return {
    cards: es.length,
    zoom: n ? +n[0].toFixed(4) : null, panX: n ? Math.round(n[4]) : null, panY: n ? Math.round(n[5]) : null,
    off: {
      left: Math.round(Math.max(0, pane.left - l)), right: Math.round(Math.max(0, r - pane.right)),
      top: Math.round(Math.max(0, pane.top - t)), bottom: Math.round(Math.max(0, b - floor)),
    },
    offX: Math.round((sl + sr) / 2 - (pane.left + pane.right) / 2),
    colOffX: Math.round((l + r) / 2 - (pane.left + pane.right) / 2),
    /* Split, because the two sides are not the same thing. Rule 4 spends the
       RIGHT edge and only the right edge: a fan off the left is the column
       having been shoved out of the room, which is a fault. */
    fanRight: Math.round(Math.max(0, sr - pane.right)),
    fanLeft: Math.round(Math.max(0, pane.left - sl)),
    /* Rule 2, measured on the FAN as well as the column: furniture may
       overhang but may never disappear, and the band is what it disappears
       under. `off.bottom` reads the column alone. */
    setUnderBand: Math.round(Math.max(0, sb - floor)),
    room: `${Math.round(pane.width)}x${Math.round(pane.height)}`,
  };
});
const outside = (s) => s.off.left + s.off.right + s.off.top + s.off.bottom;

/* ------------------------------------------------------------------ */
/* 1. The fit, at four sizes                                           */
/* ------------------------------------------------------------------ */

for (const [w, h, n] of [[1495, 1365, 3], [1280, 900, 3], [1920, 1400, 8], [1100, 820, 5]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((d) => localStorage.setItem("builder.studio", d), doc(n));
  const page = await ctx.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(5200);
  const s = await read(page);
  check(`${w}x${h}, ${n} updates: no part of the column is outside the frame`,
    s && outside(s) === 0, s ? `room ${s.room}, off L${s.off.left} R${s.off.right} T${s.off.top} B${s.off.bottom}` : "no timeline");
  /*
   * RULE 2, AND THEN RULE 3 OR RULE 4 — whichever of the two is the one in
   * force at this size.
   *
   * This asked for the SET's centre to be the room's, full stop, and it was
   * right for exactly as long as the set was also what decided the zoom.
   * That reading cost him 21 percent of his text: sized on the set, the fan
   * bought its own room out of the size he reads at, 0.7939 down to 0.6234,
   * and the set's width came to the room's width to the pixel at every
   * count measured because the fan was always the wider thing. The zoom is
   * the column's now and the fan takes the overhang, which is rule 4, and
   * rule 4 firing is the set's centre no longer being the room's. A check
   * that demanded otherwise was demanding the fault back.
   *
   * So it asks the order instead, which is the thing that is actually true
   * at every size: nothing is ever under the band; the fan spends the RIGHT
   * edge and never the left; and where the set does fit, it is centred as
   * before. The fan overhanging is not a pass by itself — the column is
   * held inside the frame by the check above it, on the same reading.
   */
  check(`…and nothing of the set is under the band`, s && s.setUnderBand === 0,
    s ? `${s.setUnderBand}px of it below the band's top edge` : "-");
  check(`…and the fan spends the right edge, never the left`, s && s.fanLeft === 0,
    s ? `${s.fanLeft}px off the left, ${s.fanRight}px off the right` : "-");
  check(`…and where the whole set fits, the set's centre is the room's`,
    s && (s.fanRight > 0 || Math.abs(s.offX) <= 12),
    s ? `set ${s.offX}px off centre, column ${s.colOffX}px off it, fan ${s.fanRight}px past the right` : "-");
  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 2. The way back in, after a hand has moved it off the screen        */
/* ------------------------------------------------------------------ */

{
  const ctx = await browser.newContext({ viewport: { width: 1495, height: 1365 } });
  await ctx.addInitScript((d) => localStorage.setItem("builder.studio", d), doc(3));
  const page = await ctx.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(5200);
  const fitted = await read(page);
  check("it starts fitted and inside", fitted && outside(fitted) === 0, `off ${outside(fitted)}px`);

  /* His own gesture: the wheel over the board, which pans it. */
  const pane = await page.locator("[data-timeline]").boundingBox();
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(220, 0); await page.waitForTimeout(60); }
  await page.waitForTimeout(700);
  const moved = await read(page);
  check("a hand moves it, and it really is stranded", moved && outside(moved) > 200,
    `off L${moved?.off.left} R${moved?.off.right}, ${moved?.offX}px off centre`);

  /* Out and back in: Finish is the only door, and it tears the mount down. */
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(1200);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(5200);
  const back = await read(page);
  /*
   * WHAT IS ACTUALLY TRUE NOW, and it is two things rather than one.
   *
   * This used to assert that coming back in never hands back a view with the
   * column off the screen, which was the old reading of rule 1 — that the
   * builder tidies up after a hand. HIS RULING, relayed: rule 1 binds the
   * FIT, not the hand. He made it when the fit was pushing the column out of
   * the frame on its own, and he separately said the builder must stop
   * overruling what he does by hand. So a view he moved comes back exactly as
   * he left it, stranded or not — and what stops that being a trap is that
   * the way back is ON SCREEN, not merely available to somebody who knows a
   * control exists.
   */
  check("a view he moved himself comes back exactly as he left it",
    back && Math.abs(back.panX - moved.panX) <= 2 && Math.abs(back.panY - moved.panY) <= 2,
    `left at ${moved?.panX},${moved?.panY} — handed back ${back?.panX},${back?.panY}`);
  check("…and because the column is off the screen, the way back is on it",
    (await page.locator("[data-timeline-lost]").count()) === 1,
    `${await page.locator("[data-timeline-lost]").count()} on screen, column off by ${outside(back)}px`);
  /* And it is a way back, not a label: pressing it fits. */
  await page.locator("[data-timeline-lost]").first().click({ force: true });
  await page.waitForTimeout(1400);
  const rescued = await read(page);
  check("…pressing it brings the whole set back", rescued && outside(rescued) === 0,
    rescued ? `off L${rescued.off.left} R${rescued.off.right} T${rescued.off.top} B${rescued.off.bottom}` : "no timeline");
  /* The middle, read the same way as above: the column in the room, the fan
     free to hang off the right, and nothing under the band. */
  check("…and what it hands back is the middle", rescued && rescued.fanLeft === 0 && rescued.setUnderBand === 0
    && (rescued.fanRight > 0 || Math.abs(rescued.offX) <= 12),
    `set ${rescued?.offX}px off centre, column ${rescued?.colOffX}px off it, fan ${rescued?.fanRight}px past the right`);
  check("…and once the set is back, the way back is not on screen any more",
    (await page.locator("[data-timeline-lost]").count()) === 0,
    `${await page.locator("[data-timeline-lost]").count()} of them`);
  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 3. A hand that stranded nothing is not tidied up after              */
/* ------------------------------------------------------------------ */

{
  const ctx = await browser.newContext({ viewport: { width: 1495, height: 1365 } });
  await ctx.addInitScript((d) => localStorage.setItem("builder.studio", d), doc(3));
  const page = await ctx.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(5200);
  const fitted0 = await read(page);
  const pane = await page.locator("[data-timeline]").boundingBox();
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  /* One notch: it moves. */
  await page.mouse.wheel(60, 0);
  await page.waitForTimeout(700);
  const nudged = await read(page);
  /*
   * A NUDGE IS HIS, AND IT IS NOT MEASURED AGAINST A TOLERANCE AT ALL.
   *
   * This asked whether a hand pan had strayed further than the builder would
   * put up with — 24px — and a single wheel notch strays 32, so the builder
   * put his board back and undid the notch. Widening the tolerance only buys
   * until the next notch; the fault was asking the question. A view he moved
   * is his, however far he moved it.
   */
  check("a small move by hand moves it, and nothing is measured against a tolerance",
    nudged && fitted0 && Math.abs(nudged.panX - fitted0.panX) > 2,
    `${outside(nudged)}px of the column over the edge, and that is his business`);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(1200);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(5200);
  const kept = await read(page);
  check("…so coming back in leaves it exactly where he put it",
    kept && Math.abs(kept.panX - nudged.panX) <= 2 && Math.abs(kept.panY - nudged.panY) <= 2,
    `pan ${nudged?.panX},${nudged?.panY} → ${kept?.panX},${kept?.panY}`);
  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 4. Anything that changes the board re-fits the board                */
/* ------------------------------------------------------------------ */

{
  /*
   * His words after deleting a box: "the lanes went to the green as they
   * should but it didnt recenter again automatically" — and then, having
   * pressed the key by hand, "pressing the button worked, just had to
   * manually do it". One missing trigger, not a broken fit. Arrival had one
   * and a drag had one; deleting changes the set as much as either.
   */
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript((d) => localStorage.setItem("builder.studio", d), doc(3));
  const page = await ctx.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(5200);
  const view = () => page.evaluate(() => {
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(document.querySelector("[data-timeline-plot]")).transform)[1].split(",").map(Number);
    return { zoom: +m[0].toFixed(4), pan: `${Math.round(m[4])},${Math.round(m[5])}`, boxes: document.querySelectorAll("[data-box]").length };
  });
  const was = await view();
  check("three updates are on the board to begin with", was.boxes === 3, `${was.boxes}`);

  await page.evaluate(() => {
    const el = [...document.querySelectorAll("[data-box]")].find((e) => e.dataset.box === "t1");
    el?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 200 }));
  });
  await page.waitForTimeout(500);
  await page.locator("[data-box-menu] button", { hasText: "Prune" }).first().click();
  await page.waitForTimeout(3000);

  const now = await view();
  check("deleting one takes it off the board", now.boxes === 2, `${now.boxes} left`);
  check("…and the board re-fits itself, without the key being pressed",
    now.zoom !== was.zoom || now.pan !== was.pan,
    `zoom ${was.zoom} → ${now.zoom}, pan ${was.pan} → ${now.pan}`);
  const after = await read(page);
  check("…and what is left is still inside the frame", after && outside(after) === 0,
    after ? `off L${after.off.left} R${after.off.right} T${after.off.top} B${after.off.bottom}` : "no timeline");
  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 4. RULE 2, WITH A BAND ACTUALLY STANDING OVER THE PANE              */
/* ------------------------------------------------------------------ */

/*
 * A check that passes for any input measures nothing, and until this section
 * existed that is what rule 2 had. Every case above runs on the iteration
 * tab, where the strip below the timeline is an ordinary block in the same
 * travel and no band stands over the pane at all — so "nothing is under the
 * band" was true of a board with no band, which is not the claim.
 *
 * The backend is the one tab that keeps a band of its own, and it cannot be
 * opened before the first fit because the tabs do not exist until a thing
 * has been finished. So the order is the real one: finish, open the
 * backend, and only then ask for a fit, which is the fit that has to honour
 * a band that already stands.
 *
 * MEASURED, the three sizes below: nothing of the set under it at any of
 * them, at a zoom of 0.28 to 0.34 — the band takes better than half the
 * room and the fit pulls out until the set clears it, which is rule 2
 * outranking the zoom exactly as he ordered.
 */
for (const [w, h, n] of [[1600, 1000, 8], [1600, 1000, 5], [1280, 900, 3]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((d) => localStorage.setItem("builder.studio", d), doc(n));
  const page = await ctx.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(3000);
  await page.getByText("The backend", { exact: true }).first().click({ force: true });
  await page.waitForTimeout(1500);
  const stood = await page.locator("[data-studio-band][data-band-over]").count();
  check(`${w}x${h}, ${n} updates: the backend's band stands over the pane`, stood === 1,
    `${stood} band over the pane — without one the rule below measures nothing`);
  /*
   * NOTHING IS PRESSED HERE, and that is the point of it.
   *
   * The band standing up is the room halving, so the board re-fits itself
   * on it the way it re-fits itself on a window resize. It did not: the
   * band was looked up once at mount, there is none to find on the
   * iteration tab, and the backend's band takes better than half the room
   * without changing the pane's own height by a pixel — so nothing
   * observed it and nothing ran. MEASURED before the fix, at this exact
   * sequence: 512px of the set and 401px of the column under the band at
   * 1600x1000 with eight updates, in silence, and it stayed there.
   *
   * Asking for a fit by hand hid it. This asks for nothing.
   */
  await page.waitForTimeout(2500);
  const s = await read(page);
  check(`…and the board re-fits itself on it, with nothing pressed`, s && s.setUnderBand === 0,
    s ? `${s.setUnderBand}px below the band's top edge, column ${s.off.bottom}px, at zoom ${s.zoom}` : "-");
  check(`…and no part of the column is outside the frame either`, s && outside(s) === 0,
    s ? `off L${s.off.left} R${s.off.right} T${s.off.top} B${s.off.bottom}` : "-");
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
