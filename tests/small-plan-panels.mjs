/**
 * A CAPTURED PAGE AT A SMALL WIDTH: A PANEL A PRESS SHOWS TAKES ONLY ITS OWN.
 *
 * thesolface.site at 834: the chart section's glow (`section::after`, a part
 * at rest with no box at 834: the widths read skips pseudo-elements) stood,
 * by what holds what, under the copy of its section a press shows (a
 * `state` part). Laying that panel out (`small.ts`, `panelBoxes`) placed
 * everything under it (its box a little smaller than the section at rest,
 * so the nearest holder), the glow too, 600 px tall at y 13 910: the tablet
 * page ran to 14 510 px where the site is 9 350.
 *
 * Planned directly (no browser), a section at rest with its box at 390, its
 * glow at rest with none, and a press's copy of the section holding it:
 *   (1) the glow is not placed: hidden, as a part at rest with no box is;
 *   (2) the page is as tall as what is at rest;
 *   (3) the press's copy is still placed (its press shows it).
 *
 *   node tests/small-plan-panels.mjs
 */
import { createJiti } from "jiti";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { node } from "./fixtures/small-sites.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { planFor } = await jiti.import(join(here, "..", "src/features/studio/live/smallRules.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const from = (selector) => ({ from: { selector, url: "https://standin.test/", host: "standin.test", at: 0 } });

const nodes = [
  node("top", "box", "", 0, 0, 1440, 900, { ...from("body > main > section:nth-of-type(1)"), widths: { phone: { x: 0, y: 0, w: 390, h: 1000 } } }),
  node("chart", "box", "", 0, 900, 1440, 1200, { ...from("body > main > section:nth-of-type(2)"), widths: { phone: { x: 0, y: 1000, w: 390, h: 900 } } }),
  node("chart_title", "prose", "STANDIN chart", 100, 950, 600, 60, { ...from("body > main > section:nth-of-type(2) > h2"), widths: { phone: { x: 16, y: 1020, w: 358, h: 60 } } }),
  node("glow", "box", "", 1000, 1000, 600, 600, { ...from("body > main > section:nth-of-type(2)::after") }),
  node("chart_pressed", "box", "", 0, 880, 1440, 1170, { ...from("body > main > section:nth-of-type(2)"), state: { group: "p0:g0", option: 0 } }),
  node("foot", "box", "", 0, 2100, 1440, 300, { ...from("body > footer"), widths: { phone: { x: 0, y: 1900, w: 390, h: 300 } } }),
];

const plan = planFor(nodes, "phone", 1440);
const at = (id) => plan.boxes.find((b) => b.node.id === id);
check("the site's own layout is used (site mode)", plan.mode === "site", plan.mode);
check("(1) the glow at rest with no box is hidden, not placed in the press's panel", !at("glow") && plan.hidden.includes("glow"), JSON.stringify(at("glow") ?? null));
check("(2) the page is as tall as what is at rest (2200)", plan.height === 2200, String(plan.height));
check("(3) the press's copy of the section is still placed", !!at("chart_pressed"), JSON.stringify(plan.boxes.map((b) => b.node.id)));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
