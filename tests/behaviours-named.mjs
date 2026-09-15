/**
 * Every behaviour on the board is run or named in the preview, never dropped.
 *
 * Seventeen parts are behaviours (tier B): placed on the board, they are
 * not boxes on the live page but things the page does. Ten the preview
 * runs, six it names in a corner note as described only, and one, page
 * transitions, it dropped: removed from the layout with the rest of the
 * tier and in neither the switch nor the note. This holds every tier-B id
 * to one of the two.
 *
 *   node tests/behaviours-named.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const parts = bare("src/features/studio/parts/index.ts");
const tierB = [...parts.matchAll(/ids: \[([^\]]*)\], tier: "B"/g)].flatMap((m) => [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]));
check("the tier-B behaviours are listed", tierB.length >= 15, `${tierB.length} ids`);

const live = bare("src/features/studio/live/behaviours.ts");
/* Only the switch over the part's id: the page's own scroll setting has cases of its own. */
const sw = live.slice(live.indexOf("switch (n.featureId)"), live.indexOf("default:", live.indexOf("switch (n.featureId)")));
const run = [...sw.matchAll(/case "([a-z0-9-]+)":/g)].map((m) => m[1]);
const named = [...(/DESCRIBE_ONLY = new Set\(\[([^\]]*)\]\)/.exec(live)?.[1] ?? "").matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
check("some are run and some are named", run.length >= 8 && named.length >= 5, `${run.length} run, ${named.length} named`);
const dropped = tierB.filter((id) => !run.includes(id) && !named.includes(id));
check("and none is dropped on the way to the preview", dropped.length === 0, dropped.length ? `dropped: ${dropped.join(", ")}` : `${tierB.length} accounted for`);
const both = run.filter((id) => named.includes(id));
check("none is both run and named", both.length === 0, both.join(", "));
const stray = [...run, ...named].filter((id) => !tierB.includes(id));
check("and the preview names no behaviour the library lacks", stray.length === 0, stray.join(", "));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
