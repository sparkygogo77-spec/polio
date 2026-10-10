#!/usr/bin/env node
/**
 * PUSH ON PRESS MAKES A PART PRESSABLE.
 *
 * J (2026-10-10): "push on press works well but it doesnt make the cursor the
 * click hand like it should, I would also expect that motion to make it a
 * button maybe or linkable". A part given Push on press (or Glide to a part)
 * takes the pointing hand in Preview, in the kit's motion file and in the
 * published style layer; it is offered "When pressed, go to"; and on a site
 * from code Publish asks the code to make it a real link, or a button when
 * no place is picked. Run on the saved PST board's document (no browser):
 *
 *   node tests/press-pointer.mjs
 *
 * Covers: src/features/studio/send-out/motionCss.ts, src/features/studio/codeAsks.ts, src/features/studio/shelf/library/effects.ts, src/features/studio/shelf/library/behaviourScripts/interactions.ts, src/features/studio/panels/inspector/Panel.tsx, src/features/studio/panels/inspector/solid.tsx, src/features/studio/blocks.tsx
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const M = await jiti.import(join(root, "src", "features", "studio", "send-out", "motionCss.ts"));
const A = await jiti.import(join(root, "src", "features", "studio", "codeAsks.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The pointing hand, everywhere the press runs. */
const css = M.effectCss('[data-hook="x"]', [{ id: "press-push", inputs: {} }], { press: ["translate: 0 3px"] });
check("Published: Push on press writes cursor: pointer on the part", css.own.includes("cursor: pointer"), css.own.join("; "));
const lift = M.effectCss('[data-hook="x"]', [{ id: "hover-lift", inputs: {} }]);
check("Published: Lift on hover alone does not", !lift.own.includes("cursor: pointer"));
const effects = readFileSync(join(root, "src", "features", "studio", "shelf", "library", "effects.ts"), "utf8");
const push = effects.slice(effects.indexOf('siteFeatures.define("press-push"'));
check("Preview: the Push on press script sets the pointer where the page has none", /cur === "auto" \|\| cur === "default"\) s\.cursor = "pointer"/.test(push));
const kit = readFileSync(join(root, "kit", "starter", "vendor", "builder-motion.js"), "utf8");
const glide = kit.slice(kit.indexOf('define("glide"'), kit.indexOf('define("glide"') + 600);
check("Kit motion file: Glide to a part takes the pointing hand", /el\.style\.cursor = "pointer"/.test(glide));

check("pushedOnPress reads a press-push, also one under also, and not one switched off",
  M.pushedOnPress({ id: "press-push" }) && M.pushedOnPress({ id: "float", also: [{ id: "press-push" }] }) && !M.pushedOnPress({ id: "press-push", off: true }) && !M.pushedOnPress(null));

/* "When pressed, go to" on the part panel, and a press that goes in Preview. */
const panel = readFileSync(join(root, "src", "features", "studio", "panels", "inspector", "Panel.tsx"), "utf8");
const solid = readFileSync(join(root, "src", "features", "studio", "panels", "inspector", "solid.tsx"), "utf8");
const blocks = readFileSync(join(root, "src", "features", "studio", "blocks.tsx"), "utf8");
check("Part panel: a part with Push on press is asked where a press goes", /pushedOnPress\(node\.work\)\);/.test(panel) && /pressed=\{pressOnly\}/.test(panel) && /"When pressed, go to"/.test(solid));
check("Preview: a pushed part with a place to go is the link, whole", /def\.linkWhole \|\| \(!def\.linkable && pushedOnPress\(node\.work\)\)/.test(blocks));

/* Publish on PST: a line for the code. */
const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const nodes = doc.nodes, pages = doc.pages;
const coded = new Set(doc.look.styleSource.files.map((f) => f.pageId));
const base = { nodes, pages, format: {}, switches: [], coded, effect: () => null };
const ask = (patch) => A.codeAsks({ ...base, nodes: nodes.map((n) => (n.id === patch.id ? { ...n, ...patch } : n)) }).filter((i) => i.key.startsWith("build-press-"));
check("Untouched PST board: no press lines", ask({ id: "none" }).length === 0);
const tv = nodes.find((n) => n.source?.hook?.value === "chart-tv-panel");
const queue = nodes.find((n) => n.source?.hook?.value === "queue-join");
const bare = ask({ id: tv.id, work: { id: "press-push", inputs: {} } });
check("Push on press with no place: one \"make this a button\" line on its hook", bare.length === 1 && bare[0].hook === "chart-tv-panel" && /Make this a button/.test(bare[0].says), bare.map((i) => i.says).join(" | "));
const linked = ask({ id: tv.id, work: { id: "press-push", inputs: {} }, link: { kind: "page", target: "page_leaderboard" } });
check("Push on press going to a page: a real-link line naming the page", linked.length === 1 && /real link/.test(linked[0].says) && /Leaderboard page/.test(linked[0].says) && /Tab/.test(linked[0].says), linked.map((i) => i.says).join(" | "));
check("A link to an X profile is not asked (the publish check turns it down)", ask({ id: tv.id, work: { id: "press-push", inputs: {} }, link: { kind: "url", target: "https://x.com/someone" } }).length === 0);
check("pump.fun is asked as a link", ask({ id: tv.id, work: { id: "press-push", inputs: {} }, link: { kind: "url", target: "https://pump.fun" } }).length === 1);
check("A part the code already has as a button is left alone", ask({ id: queue.id, work: { id: "press-push", inputs: {} } }).length === 0);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
