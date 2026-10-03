/**
 * THE BUILDER RULES GO WITH EVERY EXPORT, AND A PART'S SLOTS SHOW IN ITS SETTINGS.
 *
 * PST's kit/BUILDER-RULES.md is what every code chat follows; the kit's
 * builder.json carries the same list as "rules". The Builder embeds both
 * (`npm run kit:files`, `kitFiles.ts`) and writes them into every Export for
 * code (`kitExport.ts`: BUILDER-RULES.md and builder.json "rules"; a branch
 * export carries them under design/). Rule 4: when code needs a look or a
 * setting the builder lacks, it adds a slot (a token, listed in
 * rules.slots); the Builder shows each slot by its label in that part's
 * Settings (`partSlots`, `StyleLayerPanel.tsx`).
 *
 * Covers: src/features/studio/kitFiles.ts, src/features/studio/kitExport.ts, src/features/studio/StyleLayerPanel.tsx, src/features/studio/live/smallCss.ts
 *
 *   node tests/builder-rules.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { KIT_FILES, KIT_RULES } = await import("../src/features/studio/kitFiles.ts");
const { partSlots } = await import("../src/features/studio/styleLayer.ts");
const doc = readFileSync("kit/BUILDER-RULES.md", "utf8");
const kitJson = JSON.parse(readFileSync("kit/builder.json", "utf8"));

check("the Builder carries BUILDER-RULES.md exactly as the kit has it", KIT_FILES["BUILDER-RULES.md"] === doc);
check("and the rules list exactly as the kit's builder.json has it", JSON.stringify(KIT_RULES) === JSON.stringify(kitJson.rules));
const headings = [...doc.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1]);
check("one rule in the list for each rule in the doc, in order", JSON.stringify(KIT_RULES.list.map((r) => r.title)) === JSON.stringify(headings), `${KIT_RULES.list.length} listed, ${headings.length} in the doc`);
check("rule 2 is states inside parts, with J's example", KIT_RULES.list[1]?.id === "states-inside-parts" && /Connecting to the game server/.test(KIT_RULES.list[1].rule));
check("rule 3 keeps states in their frame, rule 4 says add a slot", KIT_RULES.list[2]?.id === "states-in-frame" && KIT_RULES.list[3]?.id === "add-a-slot" && /never to drop the design or to work around the builder/.test(doc));
check("J's two exceptions are listed: the DexScreener embed and script-set positions", KIT_RULES.embeds?.[0]?.hosts?.includes("dexscreener.com") && Array.isArray(KIT_RULES.scriptPositions?.properties) && KIT_RULES.scriptPositions.properties.includes("left"));

const src = readFileSync("src/features/studio/kitExport.ts", "utf8");
check("Export for code writes BUILDER-RULES.md and builder.json \"rules\" (source read)", /"BUILDER-RULES\.md"/.test(src) && /rules: \{ \.\.\.KIT_RULES, slots: \[\], outsideParts: \[\] \}/.test(src));

/* A part's slots: the starter lists "Card shadow" on list-item, a token its stylesheet uses. */
const source = {
  files: [{ file: "starter/tokens.css", vars: [{ name: "--shadow", value: "0 1px 3px oklch(0 0 0 / 0.12)", file: "starter/tokens.css", line: 12, token: true }, { name: "--radius", value: "8px", file: "starter/tokens.css", line: 11, token: true }] }],
  kit: { ...kitJson },
};
const slots = partSlots("list-item", source);
check("a part's slot shows by its label, with the token's value", slots.length === 1 && slots[0].label === "Card shadow" && slots[0].name === "--shadow" && slots[0].kind === "shadow" && slots[0].why === "slot", JSON.stringify(slots));
check("another part shows none", partSlots("page-title", source).length === 0);
check("a slot whose token the code does not have is not shown", partSlots("list-item", { ...source, files: [] }).length === 0);
check("a repository without rules has no slots", partSlots("list-item", { ...source, kit: { ...kitJson, rules: undefined } }).length === 0);

/* Rule 7 holds for the Builder's own export: the small-screen menu's glyphs are real elements, not ::before. */
const small = readFileSync("src/features/studio/live/smallCss.ts", "utf8");
check("the menu key's glyphs are real elements, not drawn by ::before", !/sm-glyph::before/.test(small) && /sm-glyph-open/.test(readFileSync("src/features/studio/live/LiveSite.tsx", "utf8")));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
