#!/usr/bin/env node
/**
 * THE WINDOW'S HEIGHT IS READ OFF THE PAGE AS IT OPENS, NEVER OFF A STATE.
 *
 * thesolface.site, published from a fresh import (the hand-edit pass,
 * 2026-10-22): its film grain is a fixed layer the window's size (0,0
 * 1440×900), and its pointer glow is a fixed 450×450 disc. On the board
 * both were right. On the published page the grain was 14px tall and the
 * glow 23px.
 *
 * The export reads the window's height off the foot of the lowest fixed part
 * (`fluidSite.ts#captureHeight`). The import also brings the states of the
 * page's fixed parts (the back-to-top button shown, captured with the page
 * scrolled 5,000px down), and those stand where the page was when they were
 * read. Counted, the window came out 5,454 tall. Then the grain touched only
 * the top of it, was a band at the top, and was cut to the 14px above the
 * header; the glow, short of half that window, was cut the same way.
 *
 * Held here, with `fluidParts` and `captureHeight` alone:
 *   1. a state of a fixed part far down the page does not change the window's height;
 *   2. the layer the window's size keeps both edges, with no height trim;
 *   3. a fixed disc half the window tall is not cut to the part below its top.
 *
 *   node tests/fluid-state-window.mjs
 *
 * Covers: src/features/studio/fluidSite.ts, src/features/studio/send-out/exportSite.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { fluidParts, captureHeight } = await jiti.import(join(here, "..", "src", "features", "studio", "fluidSite.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const parts = [
  { id: "grain", x: 0, y: 0, w: 1440, h: 900, selector: "body > div:nth-of-type(2)", position: "fixed" },
  { id: "glow", x: 466, y: 268, w: 450, h: 450, selector: "body > div:nth-of-type(3)", position: "fixed" },
  { id: "bar", x: 0, y: 14, w: 1440, h: 78, selector: "body > header", position: "fixed" },
  { id: "main", x: 0, y: 0, w: 1440, h: 9900, selector: "body > main" },
  { id: "hero", x: 0, y: 0, w: 1440, h: 991, selector: "body > main > section:nth-of-type(1)" },
  { id: "card", x: 400, y: 291, w: 600, h: 300, selector: "body > main > section:nth-of-type(1) > div" },
  /* The back-to-top button, shown: a state captured with the page scrolled down. */
  { id: "top-btn", x: 1370, y: 5404, w: 50, h: 50, selector: "body > button", position: "fixed", state: "s1:shown" },
];
const H = captureHeight(parts);
check("1. a state of a fixed part far down the page does not make the window taller: 900", H === 900, `${H}`);
const k = fluidParts(parts, 1440);
const grain = k.get("grain"), glow = k.get("glow");
check("2. the layer the window's size keeps both edges, with no height trim", grain?.fixed === "both" && !grain.height, JSON.stringify(grain));
check("3. the fixed glow is not cut to the part below its top", !glow?.height, JSON.stringify(glow));

console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
