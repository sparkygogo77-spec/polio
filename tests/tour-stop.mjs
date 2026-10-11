/**
 * ONE STEP THROUGH A KIND'S PARTS (J, 2026-10-11): "the scroll feature also
 * makes me scroll once for every thing on the page ... if they are all in view
 * then it should go to the next immediately instead of individually by order".
 *
 *   1. a step passes every part already in view and lands on the next one that is not;
 *   2. backwards too;
 *   3. hidden parts are passed;
 *   4. when every part left is in view, it steps to the plain next one rather than doing nothing.
 *
 *   node tests/tour-stop.mjs
 *
 * Covers: src/features/studio/tourStop.ts, src/features/studio/SiteColours.tsx
 */
import { nextStop } from "../src/features/studio/tourStop.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const no = () => false;
/* Eight parts: 0 is where the board is, 1–4 are on screen with it (a card's fields), 5–7 further down. */
const view = new Set([0, 1, 2, 3, 4]);
check("1. passes the four fields in view and lands below them", nextStop(8, 0, 1, no, (i) => view.has(i)) === 5);
check("2. backwards too", nextStop(8, 4, -1, no, (i) => view.has(i)) === 7);
check("3. hidden parts are passed", nextStop(8, 4, 1, (i) => i === 5, no) === 6);
check("4. all in view: the plain next one, not nothing", nextStop(5, 2, 1, no, () => true) === 3);
check("…and with nothing else to go to, it stays put", nextStop(1, 0, 1, no, () => true) === 0);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
