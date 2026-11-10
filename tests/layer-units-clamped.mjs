#!/usr/bin/env node
/**
 * A SHARE THE PAGE CLAMPED IS PUBLISHED AT THE SIZE THE PAGE DREW (EDIT-ISSUES #5).
 *
 * Sol face's splash under section 2 (n_picture_238) is written `left: -7%;
 * bottom: -10%; width: 115%` with `max-width: 100%`. The capture measured it
 * 1440 wide in its 1440 section and the board draws 1440, but the published
 * page took the written 115% and drew it 1656 wide, its height following its
 * width and its foot placing it, 20px lower. `layerUnits.ts#drawnShares`
 * says a share that does not give back the measured box as the share that
 * does. Held:
 *
 *   1. pure: the splash's units give a width of 100% of its block (not 115%),
 *      and a top that puts it where the capture measured it; a share the box
 *      gives back (`-7%` left, a 75% sticker) and anything not a plain share
 *      (`min(62vw, 860px)`) stand as written;
 *   2. with a capture folder: on its own document, every part placed in units
 *      is published at its measured width in its block at the capture's
 *      width (the share said, worked against the block's box).
 *
 *   node tests/layer-units-clamped.mjs [capture/sites/thesolface3]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { drawnShares, layerStyle } from "../src/features/studio/layerUnits.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/** A CSS length of px, `calc`, `*`, `+`, `-` and `n%` (of `pct`), worked out. */
const px = (css, pct = 0) => {
  if (css == null) return null;
  const e = css.replace(/calc\(/g, "(").replace(/(-?\d*\.?\d+)px/g, "$1").replace(/(-?\d*\.?\d+)%/g, (_m, n) => String((Number(n) / 100) * pct));
  if (/[^\d\s.+\-*/()e]/.test(e)) return NaN;
  return Function(`return (${e});`)();
};

/* 1. Pure, on the splash as the capture holds it. */
const box = [0, 1080, 1440, 1103];
const splash = { left: "-7%", bottom: "-10%", width: "115%", of: { by: "block", part: "n_box_10", box } };
const said = drawnShares(splash, 1440, 165, box);
check("the clamped 115% is said as the 100% the page drew", said.width === "100%", said.width);
check("…its left (-7%, which the box gives back) stands", said.left === "-7%" && said.bottom === "-10%");
const block = { left: "0px", top: "1080px", width: "1440px", height: "1103px" };
const st = layerStyle(said, block, 1440, 165, 165 / 1440, { x: -101, y: 1048 });
const w = px(st?.width), left = px(st?.left);
check("…published 1440 wide at x -101, as on the board", Math.abs(w - 1440) < 0.5 && Math.abs(left + 100.8) < 0.5, `${st?.width} → ${w}, left ${left}`);
const before = layerStyle(splash, block, 1440, 165, 165 / 1440, { x: -101, y: 1048 });
const block100 = { left: "0px", top: "1080px", width: "100%", height: "1103px" };
const fl = layerStyle(said, block100, 1440, 165, 165 / 1440, { x: -101, y: 1048 });
const top = px(fl?.top, 1440);
check("…anchored at its foot, it keeps the 165 it was measured at and stands at y 2128, in a block whose width is 100% of the page", !fl?.height && !fl?.aspectRatio && Math.abs(top - 2128) < 0.6, `top ${fl?.top} → ${top}, height ${fl?.height ?? "(its own)"}`);
check("…where the written share alone gave 1656 (the red this holds)", Math.abs(px(before?.width) - 1656) < 0.5, `${px(before?.width)}`);
const sticker = { width: "75%", of: { by: "block", box: [0, 0, 240, 240] } };
const dialog = { width: "100%", of: { by: "viewport", box: [0, 0, 1440, 900] } };
check("a share of the window stands (a 520 dialog at width 100% with a max-width of its own)", drawnShares(dialog, 520, 266, dialog.of.box) === dialog);
check("a share the box gives back stands (a 75% sticker, 180 of 240)", drawnShares(sticker, 180, 180, sticker.of.box) === sticker);
const planet = { left: "-16vw", width: "min(62vw, 860px)", of: { by: "window" } };
check("anything not a plain share stands", drawnShares(planet, 860, 860, [0, 0, 1440, 900]) === planet);
check("no box: nothing to read against, stands", drawnShares(splash, 1440, 165, null) === splash);

/* 2. A capture's own parts. */
const SINK = process.argv[2];
if (SINK && existsSync(join(SINK, "site/document.json"))) {
  const raw = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
  const nodes = (raw.state ?? raw).nodes;
  let n = 0;
  const off = [];
  for (const p of nodes) {
    const u = p.units, b = u?.of?.box;
    if (!u || !b || b.length < 4 || !/^\s*-?\d*\.?\d+%\s*$/.test(u.width ?? "")) continue;
    n++;
    const got = px(drawnShares(u, p.w, p.h, b).width, b[2]);
    if (Math.abs(got - p.w) > 1.5) off.push(`${p.id} ${got} vs ${p.w}`);
  }
  check(`${SINK.split(/[\\/]/).filter(Boolean).pop()}: every part placed by a share of its block is said at its measured width (${n} parts)`, off.length === 0, off.slice(0, 4).join(", "));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
