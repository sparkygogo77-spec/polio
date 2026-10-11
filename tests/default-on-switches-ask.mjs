#!/usr/bin/env node
/**
 * A WHOLE-SITE SWITCH THAT STARTS ON ASKS THE CODE WHEN J SWITCHES IT.
 *
 * Audit 2026-10-11 (default-on-switches-never-reach-next-md): search
 * listing, the accessibility bar, the performance bar and page transitions
 * start on, and a switch was asked only when it was on and not at its
 * start. So switched off it was not on, and switched back on it was at its
 * start: J could move them as he liked and no polio/NEXT.md line ever said
 * so. The page transitions line also sent the code chat to "the Builder's
 * Format tab", which no longer shows them (they come from the Motion shelf).
 * Now a switch asks whichever way it moved from where the site came in, on
 * or off, and names no tab; an untouched board still asks for nothing.
 * Run on the saved PST board's document (no browser):
 *
 *   node tests/default-on-switches-ask.mjs
 *
 * Covers: src/features/studio/codeAsks.ts, src/features/studio/publishAsks.ts, src/features/studio/shelfFacts.ts, src/features/studio/format.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const F = await jiti.import(join(here, "..", "src", "features", "studio", "shelfFacts.ts"));
const { FORMAT_FIELDS } = await jiti.import(join(here, "..", "src", "features", "studio", "format.ts"));
const read = (f) => readFileSync(join(here, "..", f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
/* Format's real switches, labelled and with their starting values, as Publish hands them over (`publishAsks.ts#asksNow`). */
const field = new Map(FORMAT_FIELDS.map((f) => [f.id, f]));
const switches = F.formatSwitches().map((s) => ({ key: s.key, on: s.on, off: s.off, label: field.get(s.key)?.label ?? s.key, def: field.get(s.key)?.default }));
const base = { nodes: doc.nodes, pages: doc.pages, format: doc.format, switches, coded: new Set(doc.look.styleSource.files.map((f) => f.pageId)), effect: () => null };
const asksWith = (patch) => A.codeAsks({ ...base, format: { ...doc.format, ...patch } });
const says = (xs) => xs.map((i) => i.says).join(" | ");

check("The saved PST board, untouched, asks for nothing", A.codeAsks(base).length === 0, says(A.codeAsks(base)));
const startsOn = switches.filter((s) => s.def !== undefined && F.formatSwitchOn(s, s.def));
check("Four of Format's switches start on: search listing, the accessibility and performance bars, page transitions", ["build.seo", "build.a11y", "build.perf", "pages.transition"].every((k) => startsOn.some((s) => s.key === k)), startsOn.map((s) => s.key).join(", "));

/* 1. Each one switched off, as the Format tab and the shelf switch it (to its off value). */
for (const s of startsOn) {
  const got = asksWith({ [s.key]: s.off });
  check(`${s.label} switched off asks the code to take it out`, got.length === 1 && got[0].key === `build-format-${s.key}~off` && got[0].page === "every page" && got[0].says.includes(`J switched off "${s.label}"`) && /Take it out of the code\./.test(got[0].says), says(got));
}

/* 2. A choice moved to another of its on values is asked with the value. */
const aaa = asksWith({ "build.a11y": "WCAG AAA" });
check("The accessibility bar set to WCAG AAA asks for it, saying which", aaa.length === 1 && /switched on "Accessibility bar[^"]*" \(WCAG AAA\)/.test(aaa[0].says) && /Build it in the code\./.test(aaa[0].says), says(aaa));
const slide = asksWith({ "pages.transition": "slide" });
check("Page transitions set to slide asks for slide", slide.length === 1 && /switched on "Page transition" \(slide\)/.test(slide[0].says), says(slide));

/* 3. One that starts off still asks when switched on, and the lines name no tab. */
const dark = asksWith({ "build.darkLight": true });
check("Dark and light versions switched on still asks for them", dark.length === 1 && /switched on "Dark and light versions" for the whole site/.test(dark[0].says), says(dark));
const all = asksWith({ "pages.transition": "none", "build.seo": false, "build.darkLight": true });
check("No line sends the code chat to the Format tab (page transitions are dropped from the Motion shelf)", all.length === 3 && all.every((i) => !/Format tab/.test(i.says)), says(all));
check("…and back where the site came in, a switch asks nothing again", asksWith({ "build.seo": true, "pages.transition": "fade" }).length === 0);

/* 4. Wiring (source read): Publish gives each switch the value a new board starts at. */
const asks = read("src/features/studio/publishAsks.ts");
check("Publish hands codeAsks Format's switches with their starting values", /switches: formatSwitches\(\)\.map\(\(s\) => \(\{[^}]*def: def\.get\(s\.key\)/.test(asks) && /const def = new Map\(FORMAT_FIELDS\.map\(\(f\) => \[f\.id, f\.default\]\)\)/.test(asks));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
