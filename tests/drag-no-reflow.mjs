#!/usr/bin/env node
/**
 * DRAGGING A PART DOES NOT LAY THE WHOLE BOARD OUT ON EVERY MOVE.
 *
 * The board checked the pane's width after every render by reading
 * `clientWidth` in a layout effect (DesktopCanvas, "the same comparison at
 * render time"). A read straight after React writes the DOM is a forced,
 * synchronous layout of everything on the board: on the sol face board,
 * 800 parts and 13,500 elements, that was 3.9 s of a 5.5 s twenty-move drag
 * unthrottled. Most of what that layout paid for was the style work the
 * frame does anyway (the motion sheet's), so this saves a second layout a
 * move, not the whole cost. The pane's width is now compared as last read
 * where reading is cheap.
 *
 *   1. twenty moves of one part force at most two layouts outside an animation
 *      frame (was one a move: React's commit, then the frame's own);
 *   2. twenty more moves are timed and shown, not held (wall time on a shared
 *      machine is no budget; the motion sheet's cost is held elsewhere);
 *   3. the part moved, and nothing threw.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/drag-no-reflow.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx, tests/lib/heavy.mjs, tests/fixtures/boards/solface.json.gz
 */
import { heavyBoard } from "./lib/heavy.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const h = await heavyBoard(URL_BASE);
const { page } = h;
const drag = async (t, from) => {
  for (let i = 1; i <= 20; i++) await page.mouse.move(t.x + (from + i) * 3, t.y + Math.sin(i / 4) * 20);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

const t = await h.grabbable();
const left0 = await page.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`)?.getBoundingClientRect().left, t.id);
await page.mouse.move(t.x, t.y);
await page.mouse.down();
await page.mouse.move(t.x + 4, t.y); // past the two-pixel dead zone, so the moves below are all drag
/* 1. Forced layouts are the Layout events that carry the script stack that asked for them. */
const { events } = await h.trace(() => drag(t, 1), "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack");
/* One read inside an animation frame is the frame's own layout taken early (the edge scroll reads the pane there); one anywhere else is a second layout in the same frame. */
const frames = events.filter((e) => e.name === "FireAnimationFrame" && e.ph === "X");
const inFrame = (e) => frames.some((f) => f.tid === e.tid && e.ts >= f.ts && e.ts <= f.ts + f.dur);
const forced = events.filter((e) => e.name === "Layout" && e.ph === "X" && e.args?.beginData?.stackTrace?.length && !inFrame(e));
if (process.env.WHY) for (const e of forced.slice(0, 3)) console.log(JSON.stringify(e.args.beginData.stackTrace.slice(0, 6).map((f) => `${f.functionName}@${f.url.split("/").pop()}:${f.lineNumber}:${f.columnNumber}`)));
check("1. twenty moves force at most two layouts outside an animation frame", forced.length <= 2, `${forced.length} forced layouts, ${Math.round(forced.reduce((a, e) => a + e.dur, 0) / 1000)} ms`);

/* 2. */
const t0 = Date.now();
await drag(t, 21);
console.log(`  ..   2. twenty more moves, ${((Date.now() - t0) / 20).toFixed(0)} ms a move (shown, not held)`);
await page.mouse.up();

/* 3. */
await page.waitForTimeout(500);
const moved = await page.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`)?.getBoundingClientRect().left, t.id);
check("3. the part moved with the hand, and nothing threw", moved > left0 + 60 && h.errors.length === 0, `left ${Math.round(left0)} → ${Math.round(moved)}; ${h.errors[0] ?? "no errors"}`);

await h.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
