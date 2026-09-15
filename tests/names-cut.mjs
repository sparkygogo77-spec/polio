/**
 * A label cut to length is cut between characters, never through one.
 *
 * `slice(0, n)` counts UTF-16 units: an emoji or a rarer CJK character is
 * two, and a cut through one leaves a lone surrogate that renders as �.
 * Row C13. `cut` counts code points, and the three readers that shorten a
 * page's own words use it.
 *
 *   node tests/names-cut.mjs
 */
import { readFileSync } from "node:fs";
import { cut } from "../src/core/lib/format.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const lone = (s) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

const faces = "😀".repeat(50);
check("fifty faces cut to forty is forty faces, whole", cut(faces, 40) === "😀".repeat(40), `${Array.from(cut(faces, 40)).length} characters`);
check("and slice would have split one", lone(faces.slice(0, 41)) && !lone(cut(faces, 41)));
check("a short label is returned as it is", cut("Join", 40) === "Join");
check("plain text is cut at the count", cut("abcdefghij", 4) === "abcd");
check("a mixed label keeps every character whole", !lone(cut("Café 🍰 and 𝒜 script " .repeat(9), 61)));

const reshape = readFileSync("src/features/studio/reshape.ts", "utf8");
const recreate = readFileSync("src/features/studio/recreate.ts", "utf8");
check("the answer reader cuts with it", /cut\(v\.trim\(\), max\)/.test(reshape));
check("and the page reader's three shortenings do too", (recreate.match(/cut\((?:head\.words|after\.words)/g) ?? []).length === 3 && !/\.words\.slice\(0, \d+\)/.test(recreate), `${(recreate.match(/\.words[^\n]*\.slice\(0, \d+\)/g) ?? []).length} raw slices left`);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
