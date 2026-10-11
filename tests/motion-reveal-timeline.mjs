#!/usr/bin/env node
/**
 * A PART WITH REVEAL AND FLOAT (OR SPIN, BLINK, SWITCH ON) KEEPS FLOATING ON THE SITE.
 *
 * Audit 2026-10-11 (reveal-timeline-hijacks-float): Reveal wrote one
 * `animation-timeline: view()` for the whole `animation:` list, so a float on
 * the same part was tied to the scroll too: on the published site it moved
 * only while the part scrolled in, then stood still. Now each animation gets
 * its own timeline and range, in the shorthand's order: the scroll for
 * Reveal, the clock (`auto`, `normal`) for the rest. Run on the saved PST
 * board's document (no browser, no server):
 *
 *   node tests/motion-reveal-timeline.mjs
 *
 * Covers: src/features/studio/send-out/motionCss.ts, src/features/studio/send-out/styleLayer.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const S = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));
const M = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "motionCss.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const palette = { ...(doc.look.palette ?? {}), accent: "#e8ff6a" };
const home = doc.pages[0].id;
const byHook = (h) => doc.nodes.find((n) => n.pageId === home && n.source?.hook?.value === h);
const give = (hook, work) => doc.nodes.map((n) => (n === byHook(hook) ? { ...n, work } : n));
const decls = (work) => S.buildLayer(give("wallet-panel", work), palette, source, { kit: true }).rules.find((r) => r.selector === '[data-hook="wallet-panel"]')?.declarations ?? [];
const at = (d, k) => d.findIndex((x) => x.startsWith(`${k}:`));
const val = (d, k) => d[at(d, k)]?.slice(k.length + 1).trim();

/* Float with Reveal, through the style layer as Publish writes it. */
const both = decls({ id: "float", inputs: {}, also: [{ id: "reveal", inputs: {} }] });
check("The part plays the float first and the reveal second", /^pb-float-y-12 6s ease-in-out infinite, pb-reveal-up-32 linear both$/.test(val(both, "animation") ?? ""), both.join("; "));
check("…the float keeps time, the reveal follows the scroll", val(both, "animation-timeline") === "auto, view()", val(both, "animation-timeline"));
check("…and only the reveal has the entry range", val(both, "animation-range") === "normal, entry 0% entry 60%", val(both, "animation-range"));
check("…both after the shorthand, which would reset them", at(both, "animation") >= 0 && at(both, "animation") < at(both, "animation-timeline") && at(both, "animation") < at(both, "animation-range"), both.join("; "));
check("…each written once", both.filter((d) => /^animation(-timeline|-range)?:/.test(d)).length === 3, both.join("; "));

const alone = decls({ id: "reveal", inputs: {} });
check("Reveal alone is as before: view() and its entry range", val(alone, "animation-timeline") === "view()" && val(alone, "animation-range") === "entry 0% entry 60%", alone.join("; "));
const still = decls({ id: "float", inputs: {} });
check("Float alone names no timeline", at(still, "animation-timeline") < 0 && at(still, "animation-range") < 0, still.join("; "));

/* The order follows the animation list, whichever comes first. */
const own = (uses) => M.effectCss('[data-hook="x"]', uses).own;
const spun = own([{ id: "spin", inputs: {} }, { id: "reveal", inputs: {} }]);
check("Spin then Reveal: auto, view()", spun.includes("animation-timeline: auto, view()") && spun.includes("animation-range: normal, entry 0% entry 60%") && /^animation: pb-spin-cw .*, pb-reveal-/.test(spun[0]), spun.join("; "));
const blinked = own([{ id: "reveal", inputs: {} }, { id: "blink", inputs: {} }, { id: "switch-on", inputs: {} }]);
check("Reveal then Blink then Switch on: view(), auto, auto", blinked.includes("animation-timeline: view(), auto, auto") && blinked.includes("animation-range: entry 0% entry 60%, normal, normal") && /^animation: pb-reveal-.*, pb-blink .*, pb-switch-on /.test(blinked[0]), blinked.join("; "));
const lifted = own([{ id: "float", inputs: {} }, { id: "reveal", inputs: {} }, { id: "hover-lift", inputs: {} }]);
check("A hover lift beside them adds no animation, so the lists still line up", lifted.includes("animation-timeline: auto, view()") && lifted.some((d) => d.startsWith("transition:")), lifted.join("; "));
const off = own([{ id: "float", inputs: {} }, { id: "reveal", inputs: {}, off: true }]);
check("A reveal switched off leaves the float on the clock", !off.some((d) => d.startsWith("animation-timeline")), off.join("; "));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
