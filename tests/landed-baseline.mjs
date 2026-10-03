#!/usr/bin/env node
/**
 * A SITE FROM CODE: THE COUNTS IN SEND THE DESIGN BACK ARE THE CODE'S, AND
 * ONLY THE OWNER'S CHANGES ARE A DESIGN.
 *
 *   1. The board as landed is the baseline (`baselineAsLanded`): a fill the
 *      import's own sweep put on a button (`repaint.ts`) is not a restyle, so
 *      a fresh import sends 0 parts; a change made after it is 1.
 *   2. "Take these in" brings the code's tokens with their values
 *      (`takeTokens`, values from builder-hooks.json "default"): new tokens
 *      are added, a changed value updated, what the owner set kept; so the
 *      panel's token count is the code's, and a new token's slot shows.
 *
 *   node tests/landed-baseline.mjs
 *
 * Covers: src/features/studio/styleLayer.ts, src/features/studio/kitRun.ts, src/features/studio/FromASite.tsx, src/features/studio/StyleLayerPanel.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = await jiti.import(join(here, "..", "src", "features", "studio", "styleLayer.ts"));
const K = await jiti.import(join(here, "..", "src", "features", "studio", "kitRun.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* ------------------------------------------------ 1. the board as landed */
const tokensVar = (name, value) => ({ name, value, file: "web/tokens.css", line: 1, token: true });
const source = { repo: "them/site", ref: "main", dir: "web/", tokensFile: "web/tokens.css", files: [{ file: "web/index.html", pageId: "page_home", hooks: [], vars: [tokensVar("--a", "1"), tokensVar("--pons-duel-r", "50px")] }] };
const read = { id: "n1", pageId: "page_home", featureId: "cta-primary", x: 10, y: 10, w: 95, h: 40, colour: { bg: "#ffffff", text: "#111111" }, hooks: { "data-hook": "balance-refresh" } };
read.source = { file: "web/index.html", hook: { attr: "data-hook", value: "balance-refresh" }, was: L.lookOf(read, null, { base: 16 }) };
const swept = { ...read, colour: { ...read.colour, bg: "rgb(184, 255, 106)" } };
const before = L.buildLayer([swept], {}, source, { kit: true });
check("without it, the sweep's fill on a button counts as a restyle (what the panel said)", before.rules.length === 1, `${before.rules.length} rules`);
const [landed] = L.baselineAsLanded([swept], {});
check("the board as landed is the baseline: a fresh import restyles nothing", L.buildLayer([landed], {}, source, { kit: true }).rules.length === 0);
const changed = { ...landed, colour: { ...landed.colour, bg: "#123456" } };
const after = L.buildLayer([changed], {}, source, { kit: true });
check("a change made after landing is one part restyled, from the landed look", after.rules.length === 1 && /#123456|rgb\(18, 52, 86\)/.test(after.css), after.css.split("\n").filter((l) => /background/.test(l)).join(" "));
const plain = { id: "n2", pageId: "page_home", featureId: "prose", x: 0, y: 0, w: 1, h: 1 };
check("a part not read from code is left as it is", L.baselineAsLanded([plain], {})[0] === plain);

/* ------------------------------------------------ 2. take these in, with values */
const hooksJson = JSON.stringify({ hooks: {}, tokens: { "--a": { default: "2", usedBy: [] }, "--pons-duel-r": { default: "50px" }, "--pons-marker-gap": { default: "30" }, "--pons-only-script": { default: null } } });
const seen = K.seenOfKit({ pages: [{ file: "web/index.html" }] }, hooksJson, "main", "now");
check("the map's token values are read, a null default left out", seen.values?.["--pons-marker-gap"] === "30" && !("--pons-only-script" in (seen.values ?? {})), JSON.stringify(seen.values));
const took = K.takeTokens({ ...source, varsSet: { "--a": "9" } }, seen);
const vars = took.files.flatMap((f) => f.vars);
check("a new token is added, as a token of the tokens file", vars.some((v) => v.name === "--pons-marker-gap" && v.value === "30" && v.token && v.file === "web/tokens.css"));
check("a value the code changed is updated", vars.find((v) => v.name === "--a")?.value === "2");
check("what the owner set by hand stays", took.varsSet?.["--a"] === "9");
const layer = L.buildLayer([], {}, took, { kit: true });
check("the panel's token count is the code's", layer.tokens.length === 3, `${layer.tokens.length}`);
const slotted = L.partSlots("trade-pictures", { ...took, kit: { rules: { slots: [{ token: "--pons-marker-gap", hook: "trade-pictures", label: "Marker distance", kind: "number" }] } } });
check("and a new token's slot shows in its part's Settings", slotted.length === 1 && slotted[0].value === "30");
check("taken twice, nothing doubles", K.takeTokens(took, seen).files.flatMap((f) => f.vars).length === vars.length);
check("Take these in uses it (source read)", /takeTokens\(now, round\.seen\)/.test(readFileSync(join(here, "..", "src", "features", "studio", "StyleLayerPanel.tsx"), "utf8")));
check("an import re-baselines what landed (source read)", /baselineAsLanded\(now\.nodes/.test(readFileSync(join(here, "..", "src", "features", "studio", "FromASite.tsx"), "utf8")));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
