#!/usr/bin/env node
/**
 * THE PANELS RAIL PUTS THE BOARD BACK AS IT WAS (J, 2026-10-11).
 *
 * J hovered "Duel circles" in the Panels rail, clicked it, clicked it again
 * to switch it off, and the chart, Level, Same again and Replay stayed over
 * the TV: hovering had snapped the page state to the scene that draws it and
 * letting go only dropped the isolate key. Pure, on any site's keys:
 *
 *   1. hover snaps the scene, click isolates, click again: statesOn is exactly as before;
 *   2. hovered and left without a click: as before;
 *   3. a hidden part switched on meanwhile elsewhere stays on; a scene stepped
 *      meanwhile from the Show bar is kept, not doubled with the old one;
 *   4. the rail writes through the hold and gives it back on hover-out and let go (source read).
 *
 *   node tests/panels-let-go.mjs
 *
 * Covers: src/features/studio/states/railHold.ts, src/features/studio/states/PanelsPage.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const H = await jiti.import(join(here, "..", "src", "features", "studio", "states", "railHold.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const same = (a, b) => J([...a].sort()) === J([...b].sort());

/* 1 */
const start = ["screen:start", "hidden:intro-tour"];
let on = start, hold = null;
const write = (next) => { hold = H.holdWrite(hold, on, next); on = next; };
write([...on.filter((k) => k !== "screen:start"), "screen:result"]);              // hover: snapped to the scene drawing duel circles
write([...on, "isolate:duel-circles|level|"]);                                     // click: isolated
write([...on.filter((k) => !k.startsWith("isolate:")), "isolate:duel-circles|lead|"]); // a state stepped
on = H.holdGiveBack(hold, on); hold = null;                                        // click again: let go
check("1. switched off, the board is exactly as before", same(on, start), J(on));

/* 2 */
on = start; hold = null;
write([...on.filter((k) => k !== "screen:start"), "screen:result"]);
write([...on, "isolate:sign-panel|open|"]);
on = H.holdGiveBack(hold, on); hold = null;
check("2. hovered and left: as before", same(on, start), J(on));

/* 3 */
on = start; hold = null;
write([...on.filter((k) => k !== "screen:start"), "screen:result"]);
write([...on, "isolate:duel-circles|level|"]);
on = [...on, "hidden:match-panel"];                                                // switched on at the rail's foot
let back = H.holdGiveBack(hold, on);
check("3. a hidden part switched on meanwhile stays; the rail's own go", same(back, [...start, "hidden:match-panel"]), J(back));
on = start; hold = null;
write([...on.filter((k) => k !== "screen:start"), "screen:result"]);
write([...on, "isolate:duel-circles|level|"]);
on = [...on.filter((k) => !k.startsWith("screen:") && !k.startsWith("isolate:")), "screen:mid"]; // stepped from the Show bar
back = H.holdGiveBack(hold, on);
check("3. a scene stepped meanwhile is kept, one scene only", same(back, ["hidden:intro-tour", "screen:mid"]), J(back));

/* 4 */
const src = readFileSync(join(here, "..", "src", "features", "studio", "states", "PanelsPage.tsx"), "utf8");
const raw = (src.match(/\.setStatesOn\(/g) ?? []).length;
check("4. every rail write goes through the hold", /function railWrite[\s\S]{0,160}holdWrite\(/.test(src) && raw === 2, `raw setStatesOn calls: ${raw}`);
check("4. hover-out and let go give it back", /if \(was && !keep\) railGiveBack\(\)/.test(src) && /const letGo = React\.useCallback\(\(\) => railGiveBack\(\)/.test(src) && /unhover\(true\); if \(lit\) letGo\(\)/.test(src));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
