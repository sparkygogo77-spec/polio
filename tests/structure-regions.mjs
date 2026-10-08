#!/usr/bin/env node
/**
 * THE STRUCTURE VIEW READS A SITE'S DECLARED REGIONS (kit rule 32), AND A
 * PART CAN MOVE INTO ANOTHER REGION.
 *
 * Pure, on PonsStars' play page in small, its columns marked with
 * data-region as PST's markup has them:
 *
 *   1. the outline comes from the markup: the three columns are regions,
 *      each listing its own parts; a block that only holds a panel (the
 *      chart stage) is one part of its column, not a region of its own;
 *   2. moving the match panel into the side column moves it (and what is
 *      inside it) to the end of that column on the board, and the outline
 *      shows it there;
 *   3. the move is a polio/NEXT.md line for the code chat: hook, region,
 *      what it follows, and its fix key; read back inside that region, it is
 *      no longer listed;
 *   4. a page with no regions keeps the old outline.
 *
 *   node tests/structure-regions.mjs
 *
 * Covers: src/features/studio/states/structure.ts, src/features/studio/states/StructureView.tsx, src/features/studio/useFixLoop.ts, src/features/studio/fixLoop.ts, kit/tools/kit-check.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src") } });
const studio = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const S = await studio("states/structure.ts");
const F = await studio("fixLoop.ts");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const LAY = "body > div";
const C = `${LAY} > main`;
const node = (id, hook, sel, x, y, w, h, extra = {}) => ({
  id, pageId: "play", x, y, w, h, from: { selector: sel },
  hooks: { "data-hook": hook, ...(extra.panel ? { "data-panel": hook, "data-states": "off on", "data-label": extra.label ?? hook } : {}), ...(extra.region ? { "data-region": extra.region, "data-label": extra.label ?? extra.region } : {}) },
});
const nodes = [
  node("lay", "play-layout", LAY, 0, 0, 1200, 1000),
  node("side", "play-side-player", `${LAY} > aside:nth-of-type(1)`, 0, 0, 200, 600, { region: "player-column", label: "Player column" }),
  node("card", "player-card", `${LAY} > aside:nth-of-type(1) > section`, 0, 0, 200, 300, { panel: true }),
  node("ctr", "play-center", C, 220, 0, 760, 1000, { region: "centre", label: "Centre" }),
  node("next", "next-step", `${C} > section:nth-of-type(1)`, 220, 0, 760, 60, { panel: true }),
  node("stage", "chart-stage", `${C} > section:nth-of-type(2)`, 220, 80, 760, 400),
  node("tv", "chart-tv", `${C} > section:nth-of-type(2) > div`, 220, 80, 760, 400, { panel: true }),
  node("match", "match-panel", `${C} > section:nth-of-type(3)`, 220, 500, 760, 260, { panel: true }),
  node("mtitle", "match-title", `${C} > section:nth-of-type(3) > h2`, 230, 510, 200, 30),
  node("money", "play-side-money", `${LAY} > aside:nth-of-type(2)`, 1000, 0, 200, 600, { region: "money-column", label: "Money column" }),
  node("bal", "balance-panel", `${LAY} > aside:nth-of-type(2) > section`, 1000, 0, 200, 300, { panel: true }),
];

/* 1. The outline, from the markup. */
const out = S.structureOf(nodes, "play");
const lay = out[0];
const cols = lay?.children ?? [];
check("1a. the layout holds three regions side by side, named from data-region", out.length === 1 && lay.axis === "across" && J(cols.map((x) => x.region)) === J(["player-column", "centre", "money-column"]), J(cols.map((x) => [x.hook, x.region])));
const ctr = cols.find((x) => x.region === "centre");
check("1b. the centre lists its own parts; the chart stage is one part, not a region", J(ctr?.children.map((x) => x.hook)) === J(["next-step", "chart-stage", "match-panel"]) && ctr.children.find((x) => x.hook === "chart-stage").children.length === 0, J(ctr?.children.map((x) => [x.hook, x.children.length])));
check("1c. every region is listed as a place to move to", J(S.regionList(out).map((r) => r.region)) === J(["player-column", "centre", "money-column"]));

/* 2. Moving the match panel into the player column. */
const moves = S.moveToRegion(nodes, "play", "match", "player-column");
check("2a. the panel goes to the end of the column, under the player card", J(moves.get("match")) === J({ x: 0, y: 316 }), J(moves.get("match")));
check("2b. what is inside it goes with it", J(moves.get("mtitle")) === J({ x: 10, y: 326 }) && moves.size === 2, J([...moves]));
const after = nodes.map((n) => (moves.has(n.id) ? { ...n, ...moves.get(n.id) } : n)).map((n) => (n.id === "match" ? { ...n, place: { region: "player-column" } } : n));
const out2 = S.structureOf(after, "play");
const cols2 = out2[0].children;
check("2c. the outline shows it in the player column, gone from the centre", J(cols2[0].children.map((x) => x.hook)) === J(["player-card", "match-panel"]) && !cols2[1].children.some((x) => x.hook === "match-panel"), J(cols2.map((c) => c.children.map((x) => x.hook))));
check("2d. moving it where it already is changes nothing", S.moveToRegion(after, "play", "match", "player-column").size === 0);

/* 3. The move, queued for the code chat. */
const queued = S.regionMoves(after, "play");
check("3a. one move: hook, region, what it follows", J(queued) === J([{ id: "match", hook: "match-panel", region: "player-column", regionLabel: "Player column", after: "player-card" }]), J(queued));
const key = S.regionKey("match-panel", "player-column");
const issue = { key, kind: "region", hook: "match-panel", page: "Play", says: 'Move it into the "Player column" region (data-region="player-column"), just after `player-card`.' };
const line = F.nextLine(issue);
check("3b. its NEXT.md line names the hook, the region, done-when and the fix key", line.startsWith("- [ ] `match-panel` on Play: Move it into") && line.includes('data-region="player-column"') && line.includes("Done when the element sits inside that data-region") && line.endsWith(`<!-- fix:${key} -->`), line);
const readBack = after.map((n) => (n.id === "match" ? { ...n, from: { selector: `${LAY} > aside:nth-of-type(1) > section:nth-of-type(2)` } } : n.id === "mtitle" ? { ...n, from: { selector: `${LAY} > aside:nth-of-type(1) > section:nth-of-type(2) > h2` } } : n));
check("3c. read back inside that region, it is no longer queued", S.regionMoves(readBack, "play").length === 0);

/* 4. No regions declared: the outline is as before. */
const plain = nodes.map((n) => { const { "data-region": _r, ...h } = n.hooks; return { ...n, hooks: h }; });
const out4 = S.structureOf(plain, "play");
check("4. a page with no data-region keeps the outline from where panels sit", J(S.regionList(out4)) === "[]" && J(out4[0].children.map((x) => x.hook)) === J(["play-side-player", "play-center", "play-side-money"]) && S.moveToRegion(plain, "play", "match", "player-column").size === 0);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
