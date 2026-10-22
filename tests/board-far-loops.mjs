#!/usr/bin/env node
/**
 * LOOPS FAR FROM THE VIEW REST, AND RUN AGAIN BEFORE THEY ARE SEEN.
 *
 * A part that moves for ever keeps a compositing layer, and every frame the
 * browser arranges every layer against everything on the board. On the sol
 * face board six loops sat screens below the view, and a frame at rest spent
 * 11–14 ms arranging layers at 4× CPU; with them cancelled, 3.3 ms
 * (`board/restFar.ts`).
 *
 *   1. at the top, no loop runs in a part more than a view below it;
 *   2. every loop in a part on screen runs;
 *   3. scrolled to the foot, the loops there run, and the top's rest (but a
 *      part pinned to the window, which rides down with the view);
 *   4. back at the top, the top's loops run again;
 *   5. a frame at rest arranges its layers in under 8 ms at 4× CPU (measured
 *      11–17 before, 3–6 after).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-far-loops.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/restFar.ts, src/features/studio/board/DesktopCanvas.tsx
 */
import { heavyBoard, msIn } from "./lib/heavy.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const h = await heavyBoard(URL_BASE);
const { page } = h;
const pane = page.locator("[data-studio-pane]").first();

/** Loops by where their part stands: on screen, near (within a view) or far, and how many of each run. */
const loops = () => page.evaluate(() => {
  const vh = innerHeight, out = { on: [0, 0], far: [0, 0], onIds: [], farIds: [] };
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const r = el.getBoundingClientRect();
    const where = r.bottom > 0 && r.top < vh ? "on" : r.top > 2.2 * vh || r.bottom < -1.2 * vh ? "far" : null;
    if (!where) continue;
    /* What the rules ask to loop, read from the style, not from the animations (a rested one has none). */
    const asked = [el, ...el.querySelectorAll("*")].some((x) => { const c = getComputedStyle(x); return c.animationName !== "none" && c.animationIterationCount.split(",").some((s) => s.trim() === "infinite"); });
    if (!asked) continue;
    const running = el.getAnimations({ subtree: true }).some((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity);
    out[where][0]++; if (running) out[where][1]++;
    (where === "on" ? out.onIds : out.farIds).push(el.getAttribute("data-node-id"));
  }
  return out;
});
const scrollTo = async (top) => { await pane.evaluate((el, t) => { el.scrollTop = t < 0 ? el.scrollHeight : t; }, top); await page.waitForTimeout(900); };

await page.mouse.move(5, 795);
await scrollTo(0);
let l = await loops();
check("1. at the top, no loop runs in a part far below", l.far[0] > 0 && l.far[1] === 0, `${l.far[1]} of ${l.far[0]} far parts' loops running`);
check("2. every loop in a part on screen runs", l.on[0] > 0 && l.on[1] === l.on[0], `${l.on[1]} of ${l.on[0]} running`);
const topOn = l.onIds;

await scrollTo(-1);
l = await loops();
/* A part pinned to the window rides down with the view: on screen at the foot too, it runs there. */
const gone = topOn.filter((id) => !l.onIds.includes(id));
const restedTop = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-node-id="${id}"]`)?.getAnimations({ subtree: true }).some((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity)).length, gone);
check("3. at the foot, the loops there run", l.on[0] === 0 || l.on[1] === l.on[0], `${l.on[1]} of ${l.on[0]} running`);
check("…and the top's rest, except a part pinned to the window", gone.length > 0 && restedTop === 0, `${restedTop} of ${gone.length} still running (${topOn.length - gone.length} pinned, on screen at both ends)`);

await scrollTo(0);
l = await loops();
check("4. back at the top, its loops run again", l.on[1] === l.on[0] && l.on[0] === topOn.length, `${l.on[1]} of ${l.on[0]} running (were ${topOn.length})`);

await h.slow(4);
const { events } = await h.trace(() => page.waitForTimeout(3000));
await h.slow(1);
const frames = events.filter((e) => e.name === "Layerize").length;
const per = msIn(events, ["Layerize"]) / Math.max(1, frames);
check("5. a frame at rest arranges its layers in under 8 ms at 4× CPU", per < 8, `${per.toFixed(1)} ms over ${frames} frames`);
check("…and nothing threw", h.errors.length === 0, h.errors[0] ?? "");

await h.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
