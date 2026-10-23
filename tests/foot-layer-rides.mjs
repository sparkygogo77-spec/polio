#!/usr/bin/env node
/**
 * A LAYER PLACED FROM ITS SECTION'S FOOT RIDES THAT FOOT WHEN THE SECTION GROWS.
 *
 * thesolface.site, a fresh import (the hand-edit pass, 2026-10-22): the splash
 * under section 2 is `position: absolute; bottom: -10%` of the section. A
 * longer heading grew the section by 731px and everything under the heading
 * moved down with it, but the splash stayed where it was, over the heading.
 * The tidy (`textFit.ts#fitRows`) reads a part out of the flow as nobody's
 * sibling: nothing moves it but its holder's own move. One placed from its
 * holder's foot moves with that foot.
 *
 *   1. the section grows by its heading's growth (control);
 *   2. the splash placed from the section's foot moves down by that growth;
 *   3. a layer placed from the section's top (an out-of-flow badge) stays.
 *
 *   node tests/foot-layer-rides.mjs
 *
 * Covers: src/features/studio/textFit.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { fitRows } = await jiti.import(join(here, "..", "src", "features", "studio", "textFit.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const S = "body > main > section:nth-of-type(2)";
const boxes = [
  { id: "sec", x: 0, y: 1080, w: 1440, h: 1103, drew: 1103, path: S, words: false },
  { id: "head", x: 778, y: 1377, w: 612, h: 364, drew: 364 + 731, path: `${S} > div > h2`, words: true },
  { id: "para", x: 778, y: 1800, w: 612, h: 100, drew: 100, path: `${S} > div > p`, words: true },
  { id: "splash", x: -101, y: 2128, w: 1440, h: 165, drew: 165, path: `${S} > img`, words: false, out: true, foot: true },
  { id: "badge", x: 50, y: 1100, w: 80, h: 80, drew: 80, path: `${S} > span`, words: false, out: true },
  { id: "next", x: 0, y: 2183, w: 1440, h: 900, drew: 900, path: "body > main > section:nth-of-type(3)", words: false },
];
const got = new Map(fitRows(boxes).map((f) => [f.id, f]));
const y = (id) => got.get(id)?.y ?? boxes.find((b) => b.id === id).y;
const h = (id) => got.get(id)?.h ?? boxes.find((b) => b.id === id).h;
check("1. the section grows by its heading's 731px (control)", h("sec") === 1103 + 731, `${h("sec")}`);
check("2. the splash placed from the section's foot moves down 731 with it", y("splash") === 2128 + 731, `${y("splash")}`);
check("3. a layer placed from the section's top stays", y("badge") === 1100, `${y("badge")}`);
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
