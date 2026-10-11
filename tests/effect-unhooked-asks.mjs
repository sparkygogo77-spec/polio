#!/usr/bin/env node
/**
 * AN EFFECT THE STYLE LAYER CANNOT KEY STILL REACHES THE CODE CHAT.
 *
 * Float, Spin, Lift and the other effects that go out as CSS are written on
 * a part's data-hook. A part with no hook (on PST: the form labels and the
 * two ::marker arrows) has nothing to key them on, and on a builder-ready
 * site an id-only part has no data-hook either, so the layer leaves the
 * effect out. It used to be dropped there with no NEXT.md line; now the code
 * chat is asked, and the line names the part by its id or its words. Run on
 * the saved PST board's document (no browser, no server):
 *
 *   node tests/effect-unhooked-asks.mjs
 *
 * Covers: src/features/studio/codeAsks.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/send-out/motionCss.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const S = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const palette = doc.look.palette ?? {};
const home = doc.pages[0].id;
const coded = new Set(source.files.map((f) => f.pageId));
const float = { id: "float", inputs: {} };
const asksOf = (nodes, kit) => A.codeAsks({ nodes, pages: doc.pages, format: {}, switches: [], coded, effect: (id) => ({ name: id }), kit });
const floatAsks = (asks) => asks.filter((i) => i.key.startsWith("build-effect-") && i.key.endsWith("-float"));

/* A form label with no data-hook of its own ("Stake per player" on Play). */
const label = doc.nodes.find((n) => n.pageId === home && n.source?.was && !n.source.hook && n.label === "Stake per player");
check("The saved board has a part with no hook to try", !!label);
if (label) {
  const nodes = doc.nodes.map((n) => (n === label ? { ...n, work: float } : n));
  check("Float on it: the layer has no hook to write it on", !/pb-float/.test(S.buildLayer(nodes, palette, source, { kit: true }).css));
  const asked = floatAsks(asksOf(nodes, true));
  check("…so the code chat is asked to build it", asked.length === 1, asked.map((i) => i.key).join(", "));
  check("…and the line names the part by its words", /the part "Stake per player"/.test(asked[0]?.says ?? ""), asked[0]?.says);
}

/* A part with its own data-hook: the layer carries Float, so nothing is asked. */
const panel = doc.nodes.find((n) => n.pageId === home && n.source?.hook?.value === "wallet-panel");
const hooked = doc.nodes.map((n) => (n === panel ? { ...n, work: float } : n));
check("Float on a hooked part is in the layer", /pb-float/.test(S.buildLayer(hooked, palette, source, { kit: true }).css));
check("…and not asked of the code", floatAsks(asksOf(hooked, true)).length === 0);

/* An id-only part: a builder-ready site keys rules by data-hook only, so the code is asked there; any other site gets it as CSS on #id. */
const idOnly = { ...panel, id: "n_home_idonly", source: { ...panel.source, hook: { attr: "id", value: "x-banner" } }, work: float };
const withId = [...doc.nodes, idOnly];
check("Float on an id-only part of a builder-ready site is not in the layer", !/#x-banner[^{]*\{[^}]*pb-float/.test(S.buildLayer(withId, palette, source, { kit: true }).css));
const kitAsked = floatAsks(asksOf(withId, true));
check("…so the code chat is asked, naming its id", kitAsked.length === 1 && /id="x-banner"/.test(kitAsked[0].says), kitAsked[0]?.says);
check("On a site without the kit it goes out as CSS on its id", /#x-banner[^{]*\{[^}]*pb-float/.test(S.buildLayer(withId, palette, source, { kit: false }).css));
check("…and is not asked of the code", floatAsks(asksOf(withId, false)).length === 0);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
