#!/usr/bin/env node
/**
 * MAKE ALL LIKE THIS CARRIES ONLY WHAT THE PART HAS, FROM THE WHEEL AS FROM THE PANEL.
 *
 * The wheel's tray "All like this" carried every facet the stored keys held,
 * even ones the picked part has nothing of, so a plain button wiped the fill,
 * corners and font J had set on every other button; the panel's button for
 * the same job carried only the facets the part has. Pure, on a made-up page
 * of buttons (any site has them):
 *
 *   1. a plain button carries nothing: no facets, no part reached, nothing
 *      changed, whichever list of keys is held;
 *   2. a button with only a fill carries only the fill: the others keep their
 *      corners and font, and take its fill;
 *   3. the panel's count (its facets, then the reach) and the tray's (the
 *      stored keys as they are) are the same, and so is what each changes;
 *   4. the stored keys to start carry every facet the part has but motion.
 *
 *   node tests/make-all-facets.mjs
 *
 * Covers: src/features/studio/look/partLookApply.ts, src/features/studio/MakeAllLike.tsx, src/features/studio/radial/RadialMenu.tsx
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
await jiti.import("@/features/studio/board/store"); // the store door first: through jiti on Windows its create/builds/heldView cycle only forms when this loads first
const A = await jiti.import(join(here, "..", "src", "features", "studio", "look", "partLookApply.ts"));
const L = await jiti.import(join(here, "..", "src", "features", "studio", "look", "partLook.ts"));
const { useStudio } = await jiti.import(join(here, "..", "src", "features", "studio", "board", "store.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const btn = (id, extra = {}) => ({ id, pageId: "p", label: "button", content: "Play", hooks: { "data-hook": id }, x: 0, y: 0, w: 120, h: 40, ...extra });
const styled = (id) => btn(id, { colour: { bg: "#ff0000" }, radius: 12, font: { size: 1.4 } });
const seed = (nodes) => useStudio.setState({ nodes: nodes.map((n) => ({ ...n })) });
const node = (id) => useStudio.getState().nodes.find((n) => n.id === id);
const all = [...L.FACETS];
const start = A.useMakeAll.getState().chosen;

/* The two ways in, as each is written: the panel narrows the keys and counts its reach; the tray hands the stored keys over as they are. */
const panel = (src, chosen) => { const on = A.makeAllFacets(src, chosen); return { on, reach: A.makeAllReach(src, on, {}).length, n: on.length ? A.makeAllLike(src, on, {}) : 0 }; };
const tray = (src, chosen) => ({ on: A.makeAllFacets(src, chosen), n: A.makeAllLike(src, chosen, {}) });

/* 1 */
const page1 = [btn("plain"), styled("a"), styled("b"), styled("c")];
seed(page1);
check("1. a plain button carries no facet", J(A.makeAllFacets(node("plain"), all)) === "[]" && J(A.makeAllFacets(node("plain"), start)) === "[]", J(A.makeAllFacets(node("plain"), all)));
check("1. and reaches no part", A.makeAllReach(node("plain"), all, {}).length === 0, J(A.makeAllReach(node("plain"), all, {})));
const n1 = A.makeAllLike(node("plain"), start, {});
check("1. All like this from it changes nothing", n1 === 0 && ["a", "b", "c"].every((id) => node(id).colour?.bg === "#ff0000" && node(id).radius === 12 && node(id).font?.size === 1.4), J(useStudio.getState().nodes.slice(1).map((n) => [n.colour, n.radius, n.font])));

/* 2 */
const page2 = [btn("filled", { colour: { bg: "#00ff00" } }), btn("x", { radius: 12, font: { size: 1.4 } }), btn("y", { radius: 8, font: { face: "Inter" } })];
seed(page2);
check("2. a button with only a fill carries only the fill", J(A.makeAllFacets(node("filled"), start)) === J(["fill"]), J(A.makeAllFacets(node("filled"), start)));
const n2 = A.makeAllLike(node("filled"), start, {});
check("2. both others are restyled", n2 === 2, String(n2));
check("2. they take its fill", node("x").colour?.bg === "#00ff00" && node("y").colour?.bg === "#00ff00", J([node("x").colour, node("y").colour]));
check("2. and keep their own corners and font", node("x").radius === 12 && node("x").font?.size === 1.4 && node("y").radius === 8 && node("y").font?.face === "Inter", J([node("x"), node("y")].map((n) => [n.radius, n.font])));

/* 3 */
for (const [what, page, src] of [["plain", page1, "plain"], ["fill only", page2, "filled"], ["fill, corners, font", [styled("s"), btn("t"), btn("u", { radius: 3 })], "s"]]) {
  seed(page); const p = panel(node(src), start); const afterPanel = J(useStudio.getState().nodes);
  seed(page); const t = tray(node(src), start); const afterTray = J(useStudio.getState().nodes);
  check(`3. ${what}: the tray and the panel carry the same facets`, J(p.on) === J(t.on), `${J(p.on)} vs ${J(t.on)}`);
  check(`3. ${what}: and restyle the same count (the panel's count is what it does)`, p.n === t.n && p.reach === p.n, `panel ${p.reach}/${p.n}, tray ${t.n}`);
  check(`3. ${what}: and leave the site the same`, afterPanel === afterTray);
}

/* 4 */
const full = btn("full", { colour: { bg: "#123456" }, radius: 6, font: { size: 1.2 }, motion: { animation: "spin 1s infinite" } });
const has = L.lookHas(L.lookOf(full));
check("4. the keys to start carry all it has but motion", has.includes("motion") && J(A.makeAllFacets(full, start)) === J(has.filter((f) => f !== "motion")), `${J(has)} → ${J(A.makeAllFacets(full, start))}`);
check("4. narrowing twice is narrowing once", J(A.makeAllFacets(full, A.makeAllFacets(full, start))) === J(A.makeAllFacets(full, start)));

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
