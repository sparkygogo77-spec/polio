/**
 * Every part in the library can be reached by browsing, and the library is
 * the size it says it is.
 *
 * The shelf browses category → sub-group → part, and the drawer lists only
 * the ids the sub-groups name (`Palette.tsx`, `subs.flatMap((g) => g.ids)`).
 * A part in no sub-group is on the shelf only for someone who already knows
 * its name and types it. Two were: Picture and Solid. And three places said
 * how many parts there are, with three different numbers, none of them the
 * count: 218 on the hero, 226 in the catalog's own comment, 229 in fact.
 *
 *   node tests/shelf-reach.mjs
 */
import { readFileSync } from "node:fs";
import { CATEGORIES, FEATURES, SUBGROUPS } from "../src/features/studio/catalog.ts";
import { REMOVED, VARIANT_OF } from "../src/features/studio/shelfPlan.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ids = new Set(FEATURES.map((f) => f.id));
const grouped = new Map();
for (const [category, subs] of Object.entries(SUBGROUPS)) {
  for (const g of subs) for (const id of g.ids) grouped.set(id, (grouped.get(id) ?? []).concat(`${category}/${g.id}`));
}

/*
 * Lane I: a near-copy is a version of the card that stands for it (its
 * detail card offers it), and what is not a part of a page was taken off
 * with a reason (`shelfPlan.ts`). Either way it is accounted for.
 */
const versionOf = (id) => VARIANT_OF.get(id);
const unreachable = [...ids].filter((id) => !grouped.has(id) && !(versionOf(id) && grouped.has(versionOf(id))) && !REMOVED[id]);
check("every part is in a sub-group, a version of a card that is, or taken off with a reason", unreachable.length === 0, `${ids.size} parts, ${unreachable.length} in none${unreachable.length ? `: ${unreachable.join(", ")}` : ""}`);

const twice = [...grouped].filter(([, where]) => where.length > 1);
check("and in one sub-group only", twice.length === 0, twice.map(([id, w]) => `${id} in ${w.join(" and ")}`).join("; "));

const phantom = [...grouped.keys()].filter((id) => !ids.has(id));
check("no sub-group names a part that does not exist", phantom.length === 0, phantom.join(", "));

const homeless = Object.keys(SUBGROUPS).filter((c) => !CATEGORIES.some((k) => k.id === c));
check("every sub-group's category is a category", homeless.length === 0, homeless.join(", "));

/* Where the size of the library is written down, it is the size of the library. */
const n = FEATURES.length;
const said = (file) => [...readFileSync(file, "utf8").matchAll(/\b(\d{3}) (?:common web features|parts|live previews)\b/g)].map((m) => Number(m[1]));
for (const file of ["site.config.ts", "src/features/studio/catalog.ts", "src/features/studio/PartPreview.tsx"]) {
  const counts = said(file);
  check(`${file} counts the parts as ${n}`, counts.length > 0 && counts.every((c) => c === n), counts.join(", ") || "no count");
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
