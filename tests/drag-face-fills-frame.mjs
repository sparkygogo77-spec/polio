#!/usr/bin/env node
/**
 * A FACE AS BIG AS ITS FRAME STILL DRAGS.
 *
 * J (2026-10-08): some PonsStars parts would not move at all. A state's face
 * shown on the board fills the box round it, and `clampMove` kept it inside
 * that box, so it had no room and the drag went nowhere. Now the drag lifts
 * to the frame, which carries every face; a smaller face still moves inside.
 *
 *   node tests/drag-face-fills-frame.mjs
 *
 * Covers: src/features/studio/stateFrames.ts, src/features/studio/canvas/DesktopCanvas.tsx
 */
import { clampMove, frameRiders, liftToFrame } from "../src/features/studio/stateFrames.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const part = (id, selector, [x, y, w, h], more = {}) => ({ id, pageId: "p", x, y, w, h, from: { selector }, ...more });
const hidden = (g) => ({ state: { group: `hidden:${g}`, option: 0 } });
const nodes = [
  part("main", "body > main", [0, 0, 1440, 900]),
  part("box", "body > main > div > section", [100, 100, 400, 160], { hooks: { "data-hook": "chart-tv-box" } }),
  part("load", "body > main > div > section > div", [100, 100, 400, 160], { hooks: { "data-hook": "chart-tv-loading" } }),
  part("idle", "body > main > div > section > div:nth-of-type(2)", [100, 100, 400, 160], { hooks: { "data-hook": "chart-tv-idle" }, ...hidden("chart-tv-idle") }),
  part("idle-t", "body > main > div > section > div:nth-of-type(2) > p", [120, 120, 200, 20], hidden("chart-tv-idle")),
];
const o = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h }]));

check("before: a face that fills its frame had no room to move", JSON.stringify(clampMove(nodes, ["idle"], o, 300, 200)) === JSON.stringify({ dx: 0, dy: 0 }));
const lifted = liftToFrame(nodes, ["idle"]);
check("a drag on a face that fills its frame lifts to the frame", lifted.join() === "box", lifted.join());
const carried = [...new Set([...lifted, ...frameRiders(nodes, lifted)])];
check("the frame carries its faces", ["box", "load", "idle", "idle-t"].every((id) => carried.includes(id)), carried.join());
check("and is not held back", JSON.stringify(clampMove(nodes, carried, o, 300, 200)) === JSON.stringify({ dx: 300, dy: 200 }));
check("a smaller part of a face still moves on its own, inside the frame", liftToFrame(nodes, ["idle-t"]).join() === "idle-t");
check("a locked frame is not lifted to", liftToFrame(nodes.map((n) => (n.id === "box" ? { ...n, locked: true } : n)), ["idle"]).join() === "idle");

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
