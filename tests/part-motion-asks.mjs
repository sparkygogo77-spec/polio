#!/usr/bin/env node
/**
 * AN ORB, A 3D SHAPE OR A BEFORE / AFTER SLIDER: THE NEXT.md LINE AND RULE 35 AGREE.
 *
 * The audit (2026-10-11, ask-contradicts-rule-35): the NEXT.md line for one of
 * these parts told the code chat to write `--builder-motion` "in the CSS",
 * while kit rule 35 and kit/CLAUDE.md said never to write it by hand, and
 * Publish names no motion for these parts. Now the line says where the value
 * goes (the page's own stylesheet, never the style layer) and the rules carry
 * the same exception. Run on the saved PST board's document (no browser):
 *
 *   node tests/part-motion-asks.mjs
 *
 * Covers: src/features/studio/codeAsks.ts, kit/BUILDER-RULES.md, kit/CLAUDE.md, src/features/studio/kitFiles.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const { KIT_FILES } = await jiti.import(join(here, "..", "src", "features", "studio", "kitFiles.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const coded = new Set(source.files.map((f) => f.pageId));
const taken = source.files.flatMap((f) => f.hooks.map((h) => h.value));
const home = doc.pages[0];

/* A before / after slider and a cube from the shelf, dropped on the home page. */
const slider = { id: "n_ba", pageId: home.id, featureId: "before-after", label: "Before / after", content: "", x: 120, y: 4000, w: 800, h: 480 };
const cube = { id: "n_cube", pageId: home.id, featureId: "shape-cube", label: "Cube", content: "", x: 120, y: 4600, w: 320, h: 320 };
const nodes = [...doc.nodes, slider, cube];
const names = { "before-after": "Before / after", "shape-cube": "Cube" };
const part = (id) => names[id] ?? null;
const fresh = A.freshHooks(nodes, coded, taken, { part, pages: doc.pages });
const asks = A.codeAsks({ nodes, pages: doc.pages, format: {}, switches: [], coded, fresh, part, kit: true, effect: () => null, lookCss: () => [] });

const ba = asks.find((i) => i.key.startsWith("build-part-n_ba~"))?.says ?? "";
check("The slider's line gives the exact motion value", ba.includes('`--builder-motion: "compare"`'), ba);
check("…and says it goes in the page's own stylesheet, never the style layer", ba.includes(`"compare"\` ${A.OWN_CSS}`) && /page's own stylesheet on that hook/.test(ba) && !/(?<!never )in the style layer/.test(ba));
check("…with the two pictures the motion file splits", /data-compare-after/.test(ba) && /data-compare-before/.test(ba));
const cu = asks.find((i) => i.key.startsWith("build-part-n_cube~"))?.says ?? "";
check("The cube's line gives planet?shape=cube, in the page's own stylesheet", cu.includes('`--builder-motion: "planet?shape=cube"`') && cu.includes(A.OWN_CSS), cu);

/* The rules a code chat reads must allow exactly what the line asks, next to the "never by hand". */
const rules = readFileSync(join(here, "..", "kit", "BUILDER-RULES.md"), "utf8");
const claude = readFileSync(join(here, "..", "kit", "CLAUDE.md"), "utf8");
const flat = (s) => s.replace(/\s+/g, " ");
check("Rule 35 makes the NEXT.md exception right after \"write `--builder-motion` by hand\"", /write `--builder-motion` by hand, except where a polio\/NEXT\.md line for a new part \(an orb, a 3D shape, a before \/ after slider\) gives the exact value: then write that value on its hook in the page's own stylesheet, never in the style layer\./.test(flat(rules)));
check("kit/CLAUDE.md carries the same exception after \"write `--builder-motion` yourself\"", /write `--builder-motion` yourself;[^.]*\. The one exception: a polio\/NEXT\.md line for a new part \(an orb, a 3D shape, a before \/ after slider\) gives the exact value; write that value on its hook in the page's own stylesheet, never in the style layer\./.test(flat(claude)));
check("The Builder's embedded kit copies are current (npm run kit:files)", KIT_FILES["BUILDER-RULES.md"] === rules && KIT_FILES["CLAUDE.md"] === claude);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
