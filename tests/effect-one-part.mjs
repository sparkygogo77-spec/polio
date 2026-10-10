#!/usr/bin/env node
/**
 * AN EFFECT GOES ON THE ONE PART IT WAS PUT ON.
 *
 * J (2026-10-10): "I only picked one part for appear on scroll ... I only
 * selected the find a match box, all white panels seem to be affected". PST's
 * 14 white panels share `data-group="panel"`, and a style group is edited once
 * (rule 24), so the effect went to all 14: on the board, in Preview and on
 * Publish (14 NEXT.md lines, 14 `--builder-motion` rules). A group shares its
 * look; an effect and an animation stay the part's own.
 *
 *   node tests/effect-one-part.mjs
 *
 * Covers: src/features/studio/states/stateEdits.ts, src/features/studio/board/store/nodes.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const E = await jiti.import(join(here, "..", "src", "features", "studio", "states", "stateEdits.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (v) => JSON.stringify(v);

/* PST's play page: the Find a match box and 13 other white panels, one group. */
const hooks = ["queue-panel", "wallet-panel", "rules-panel", "help-panel", "stats-panel", "history-panel", "board-panel", "player-panel", "rival-panel", "chart-panel", "result-panel", "rematch-panel", "profile-panel", "fees-panel"];
const nodes = hooks.map((h, i) => ({ id: `p${i}`, hooks: { "data-hook": h, "data-group": "panel" } }));

check("1. Appear on scroll on the Find a match box goes to no other panel", E.groupTwins(nodes, "p0", { work: { id: "reveal", inputs: {} } }) === null);
check("2. any shelf effect stays on its part (Tilt with inputs)", E.groupTwins(nodes, "p0", { work: { id: "tilt", inputs: { strength: "12" } } }) === null);
check("3. an animation and its timing stay on its part", E.groupTwins(nodes, "p0", { anim: "float", animSpeed: 2, animDelay: 0.5, animEase: "bouncy" }) === null);
const both = E.groupTwins(nodes, "p0", { colour: { bg: "#fff" }, work: { id: "reveal", inputs: {} } });
check("4. a look still goes to the whole group, without the effect", both?.ids.length === 13 && J(both.patch) === J({ colour: { bg: "#fff" } }), J(both));

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
