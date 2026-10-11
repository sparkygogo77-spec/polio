#!/usr/bin/env node
/**
 * A DRAG READS THE STATE FRAMES ONCE, WHEN THE HAND GOES DOWN.
 *
 * Dragging or resizing a part on PonsStars stuttered: every pointer move
 * worked out all the state frames again (5-30 ms each on the PST board),
 * because each move makes a new nodes array and the frames are cached on it.
 * Now `moveDrag` and `resizeDrag` keep the frames on the drag and `clampMove`
 * uses the ones it is given; the answer is the same as reading them afresh.
 *
 *   node tests/drag-frames-read-once.mjs
 *
 * Covers: src/features/studio/states/stateFrames.ts, src/features/studio/board/pressRead.ts, src/features/studio/board/helpers.ts, src/features/studio/board/DesktopCanvas.tsx
 */
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { clampMove, stateFrames } from "../src/features/studio/states/stateFrames.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const part = (id, selector, [x, y, w, h], more = {}) => ({ id, pageId: "p", x, y, w, h, from: { selector }, ...more });
const hidden = (g) => ({ state: { group: `hidden:${g}`, option: 0 } });
/* A frame with a face smaller than it, so the face has room to move but stops at the frame's edge. */
const nodes = [
  part("main", "body > main", [0, 0, 1440, 900]),
  part("box", "body > main > div > section", [100, 100, 400, 160], { hooks: { "data-hook": "chart-tv-box" } }),
  part("load", "body > main > div > section > div", [100, 100, 400, 160], { hooks: { "data-hook": "chart-tv-loading" } }),
  part("idle", "body > main > div > section > div:nth-of-type(2)", [100, 100, 200, 80], { hooks: { "data-hook": "chart-tv-idle" }, ...hidden("chart-tv-idle") }),
];
const o = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h }]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const frames = stateFrames(nodes);
check("the face sits in its frame", frames.frameOf.get("idle") === "box", String(frames.frameOf.get("idle")));
const fresh = clampMove(nodes, ["idle"], o, 300, 200);
check("a face stops at its frame's edge", same(fresh, { dx: 200, dy: 80 }), JSON.stringify(fresh));
const given = clampMove(nodes, ["idle"], o, 300, 200, frames);
check("frames passed in give the same answer as frames read afresh", same(given, fresh), JSON.stringify(given));

/* Each move hands clampMove a new array; with the frames from drag start it must not read them again. */
const moved = nodes.map((n) => (n.id === "idle" ? { ...n, x: 150, y: 120, state: undefined } : { ...n }));
check("read afresh, the changed array has no frame for the face", !stateFrames(moved).frameOf.has("idle"));
const kept = clampMove(moved, ["idle"], o, 300, 200, frames);
check("clampMove uses the frames it is given: the face still stops at the edge", same(kept, { dx: 200, dy: 80 }), JSON.stringify(kept));

/* moveDrag/resizeDrag (pressRead.ts) import the app's folder modules, which plain node cannot load, so check the wiring in the source. */
const src = (f) => readFileSync(new URL(`../src/features/studio/${f}`, import.meta.url), "utf8");
const press = src("board/pressRead.ts"), canvas = src("board/DesktopCanvas.tsx");
check("a move keeps the frames on its drag", /kind: "node",[^\n]*frames: stateFrames\(st\.nodes\)/.test(press));
check("a resize keeps the frames on its drag", /kind: "resize",[^\n]*frames: stateFrames\(st\.nodes\)/.test(press));
check("each move passes the drag's frames to clampMove", /clampMove\([^\n]*, d\.frames\)/.test(canvas));
check("a resize reads its frame from the drag's frames", canvas.includes("(drag.frames ?? stateFrames(store.nodes)).frameOf.get(drag.nodeId)"));

/* Timing on the PST board, printed only: the machine may be shared, so it is not a pass/fail check. */
const board = new URL("./fixtures/boards/pst.json.gz", import.meta.url);
if (existsSync(board)) {
  try {
    const raw = JSON.parse(gunzipSync(readFileSync(board)).toString("utf8"));
    const docs = raw.idb?.["builder.docs"]?.stores?.docs ?? [];
    const all = JSON.parse(docs.find((e) => e.key === "builder.studio")?.value ?? "{}").state?.nodes;
    if (Array.isArray(all) && all.length) {
      const pst = stateFrames(all);
      const id = [...pst.frameOf.keys()][0];
      if (id) {
        const n = all.find((m) => m.id === id), oo = { [id]: { x: n.x, y: n.y, w: n.w, h: n.h } };
        const time = (pass) => {
          let arr = all, ms = 0;
          for (let i = 1; i <= 30; i++) {
            arr = arr.map((m) => (m.id === id ? { ...m, x: n.x + i } : m));
            const t = performance.now();
            clampMove(arr, [id], oo, i, 0, pass ? pst : undefined);
            ms += performance.now() - t;
          }
          return (ms / 30).toFixed(2);
        };
        console.log(`  ..   PST board (${all.length} parts): clampMove per move ${time(false)} ms read afresh, ${time(true)} ms with the drag's frames`);
      }
    }
  } catch (e) {
    console.log(`  ..   PST timing skipped: ${e.message}`);
  }
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
