#!/usr/bin/env node
/**
 * A RAIL THAT ENDS WITHIN A WINDOW IS ITS WINDOW: ITS PARTS STAY WHERE THEY WERE READ.
 *
 * sink's Docs page has no fixed band, only a header and two side rails that
 * stick (63..1433). Exported, 17 parts of the rails landed 678 and 1291px
 * lower than captured, x and width exact (tests/fluid-site.mjs, page_docs,
 * TEST-PRIORITIES group A). With no fixed band to read the window from,
 * `fluidSite.ts#fromRailFoot` took the window to end at the rail's lowest
 * part (749 of a 1370 rail), so half its nav was "low in the window" and was
 * hung from the rail's foot, which on the published page is a whole view
 * further down.
 *
 *   1. a rail 1370 tall, no fixed band, its nav in its top half: nothing is hung from its foot;
 *   2. its part low in the rail is hung from the rail's foot by the 621px
 *      that were under it (the export now draws the rail the window less its
 *      sticky inset, 1370, so that foot is where it was read);
 *   3. a rail as long as a 3000px page (read to the page's foot) keeps the old
 *      reading: a part at its lowest is hung from its foot.
 *
 *   node tests/rail-window.mjs
 *
 * The export side, the rail drawn the window less its sticky inset, is held by
 * tests/fluid-site.mjs (page_docs, 69 parts at their captured place).
 *
 * Covers: src/features/studio/fluidSite.ts, src/features/studio/send-out/exportSite.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { fromRailFoot } = await jiti.import(join(here, "..", "src", "features", "studio", "fluidSite.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const rail = { id: "rail", x: 0, y: 63, w: 256, h: 1370, selector: "body > div > div > aside", position: "sticky" };
const kids = [
  { id: "a", x: 16, y: 303, w: 223, h: 276, selector: "body > div > div > aside > nav > div:nth-of-type(2)" },
  { id: "b", x: 16, y: 543, w: 223, h: 36, selector: "body > div > div > aside > nav > div > button" },
  { id: "c", x: 0, y: 763, w: 255, h: 49, selector: "body > div > div > aside > div" },
];
const hung = kids.map((k) => fromRailFoot(k, rail, kids, 0));
check("1. a rail that ends within a window, no fixed band: none of its nav is hung from its foot", hung.slice(0, 2).every((v) => v === null), JSON.stringify(hung));
check("2. its part low in the rail (700..749 of 1370) is hung from the rail's foot by what was under it there, 621", hung[2] === 621, JSON.stringify(hung[2]));
const long = { ...rail, y: 0, h: 3000 };
const clock = { id: "clock", x: 24, y: 600, w: 170, h: 40, selector: "body > div > div > aside > div" };
const link = { id: "link", x: 24, y: 40, w: 170, h: 24, selector: "body > div > div > aside > a" };
check("3. a rail as long as its 3000px page keeps the lowest-part reading: the clock at its lowest is hung from its foot", fromRailFoot(clock, long, [link, clock], 0) === 0 && fromRailFoot(link, long, [link, clock], 0) === null, `${fromRailFoot(clock, long, [link, clock], 0)} / ${fromRailFoot(link, long, [link, clock], 0)}`);
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
