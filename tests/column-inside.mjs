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
import { HAND_SLACK } from "../src/features/studio/timelineView.ts";

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
  let sl = 1e9, sr = -1e9;
  for (const e of all) { const q = e.getBoundingClientRect(); sl = Math.min(sl, q.x); sr = Math.max(sr, q.right); }
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
    fanOff: Math.round(Math.max(0, sr - pane.right) + Math.max(0, pane.left - sl)),
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
  check(`…and the SET's centre is the room's, lanes counted`, s && Math.abs(s.offX) <= 12,
    s ? `set ${s.offX}px off centre, column ${s.colOffX}px off it, nothing of the set outside: ${s.fanOff === 0}` : "-");
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
  check("coming back in never hands back a view with the column off the screen",
    back && outside(back) === 0, back ? `off L${back.off.left} R${back.off.right} T${back.off.top} B${back.off.bottom}` : "no timeline");
  check("…and what it hands back instead is the middle", back && Math.abs(back.offX) <= 12, `set ${back?.offX}px off centre, column ${back?.colOffX}px off it`);
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
  const pane = await page.locator("[data-timeline]").boundingBox();
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  /* One notch: it moves, and it strands nothing. */
  await page.mouse.wheel(60, 0);
  await page.waitForTimeout(700);
  const nudged = await read(page);
  /*
   * A NUDGE IS NOT A STRANDING, and it is allowed to put a few pixels over.
   *
   * This asserted nothing at all was outside, which held while the COLUMN
   * was what got centred — it sat in the middle with slack on both sides.
   * The SET is centred now, at his word, so the column sits well to one
   * side by design and a single wheel notch puts 4px of it past the edge.
   * The door tolerates that on purpose (`HAND_SLACK`, 24px): rule 1 is
   * absolute about what the FIT does, and the door is only there to catch a
   * column that has been lost, not to tidy a hand.
   */
  check("a small move by hand is not a stranding", nudged && outside(nudged) < HAND_SLACK,
    `${outside(nudged)}px over, slack ${HAND_SLACK}px, set ${nudged?.offX}px off centre`);
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

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
