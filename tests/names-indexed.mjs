#!/usr/bin/env node
/**
 * A PAGE'S PART NAMES ARE WORKED OUT IN TIME THAT GROWS WITH THE PAGE, NOT ITS SQUARE.
 *
 * After every edit the board names every part on the page again
 * (`DesktopCanvas` -> `partNames.ts#partName`), for the tags over the parts
 * and the side panel. On sol face (800 parts) that was about 25ms of each
 * edit (a CPU profile of Enter, 2026-10-23): for every heading it asked
 * every part of the page which h1-h4 element it sat in, by a regular
 * expression, over and over.
 *
 *   1. names on a page of 5,000 parts with 1,000 headings in pieces, each
 *      read across its pieces, as before (a check of the words);
 *   2. worked out in well under the time the square of the page took
 *      (under 400ms here, where it was well over a second).
 *
 *   node tests/names-indexed.mjs
 *
 * Covers: src/features/studio/partNames.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { partName } = await jiti.import(join(here, "..", "src", "features", "studio", "partNames.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const part = (id, featureId, sel, x, y, w, h, content = "", label = "") => ({ id, pageId: "p0", featureId, label, content, prompt: "", x, y, w, h, from: { selector: sel } });
const all = [];
for (let s = 0; s < 1000; s++) {
  const S = `body > main > section:nth-of-type(${s + 1})`, y = s * 300;
  all.push(part(`sec${s}`, "box", S, 0, y, 1440, 300));
  /* A heading in two pieces, "PART" and the number, read across them. */
  all.push(part(`a${s}`, "value-prop", `${S} > h2 > span:nth-of-type(1)`, 100, y + 20, 200, 60, "PART"));
  all.push(part(`b${s}`, "value-prop", `${S} > h2 > span:nth-of-type(2)`, 300, y + 20, 200, 60, `N${s}`));
  all.push(part(`p${s}`, "prose", `${S} > p`, 100, y + 100, 600, 60, `words ${s}`));
  all.push(part(`i${s}`, "box", `${S} > div`, 800, y + 100, 200, 150));
}
const t0 = performance.now();
const names = new Map(all.map((n) => [n.id, partName(n, all, () => undefined)]));
const ms = performance.now() - t0;
check("1. each section is named for its heading, read across its pieces", names.get("sec7")?.includes("PART N7") && names.get("sec999")?.includes("PART N999"), `${names.get("sec7")} / ${names.get("sec999")}`);

check("2. 5,000 parts named in under 400ms", ms < 400, `${Math.round(ms)}ms`);
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
