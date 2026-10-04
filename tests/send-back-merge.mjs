#!/usr/bin/env node
/**
 * A FILL PICKED ON THE BOARD SHOWS ON THE PAGE, AND A ROUND REPLACES ITS OWN RULE.
 *
 * J (2026-10-04) made PonsStars' next-step blue on the board and sent it
 * back twice; the page did not change. Its code paints next-step with a
 * linear-gradient (base.css), which is an image over the colour, so a layer
 * setting background-color alone never showed; and the second round added
 * a second copy of the same rule.
 *   1. `changedDeclarations`: a fill changed where the code paints an image
 *      also writes background-image: none (the board draws the fill alone);
 *      an image changed on purpose is left to its own slot.
 *   2. `mergeLayer`: a part's rule replaces its older rule (and copies), a
 *      new part's rule follows; the same design sent again changes nothing.
 *   3. A token the hooks map lists with no value is the layer's own
 *      variable, not a new token of the code.
 *
 *   node tests/send-back-merge.mjs
 *
 * Covers: src/features/studio/styleLayer.ts, src/features/studio/styleLayerRun.ts, src/features/studio/kitRun.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = await jiti.import(join(here, "..", "src", "features", "studio", "styleLayer.ts"));
const R = await jiti.import(join(here, "..", "src", "features", "studio", "styleLayerRun.ts"));
const K = await jiti.import(join(here, "..", "src", "features", "studio", "kitRun.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const was = { box: { x: 0, y: 0, w: 10, h: 10 }, words: "", art: { "background-image": "linear-gradient(160deg, rgb(255, 179, 107), rgb(239, 144, 67))" } };
const d = L.changedDeclarations(was, { ...was, background: "oklch(0.96 0.14 210)" }, { dx: 0, dy: 0 });
check("a fill picked over the code's gradient clears the gradient", d.includes("background-image: none") && d.some((x) => x.startsWith("background-color")), J(d));
const d2 = L.changedDeclarations(was, { ...was, background: "#123456", art: { "background-image": "linear-gradient(red, blue)" } }, { dx: 0, dy: 0 });
check("a gradient changed on purpose is written, not cleared", d2.includes("background-image: linear-gradient(red, blue)") && !d2.includes("background-image: none"), J(d2));
const plain = { box: was.box, words: "" };
check("a part with no image of its own gains no background-image", !L.changedDeclarations(plain, { ...plain, background: "#fff" }, { dx: 0, dy: 0 }).some((x) => x.startsWith("background-image")));

const head = "/*\n * Style layer.\n */\n\n";
const old = '[data-hook="next-step"] {\n  --next-step-background-color: blue;\n  background-color: var(--next-step-background-color);\n}';
const had = `${head}${old}\n\n/* From the Builder, 2026-10-03: this round's rules, after the ones already here, so they win. */\n${old}\n\n[data-hook="queue-join"] {\n  color: red;\n}\n`;
const fresh = '[data-hook="next-step"] {\n  --next-step-background-color: blue;\n  background-color: var(--next-step-background-color);\n  background-image: none;\n}\n\n[data-hook="balance-refresh"] {\n  color: green;\n}';
const out = R.mergeLayer(had, fresh, "2026-10-04");
check("a part's rule replaces its older rule and its copies", (out.match(/\[data-hook="next-step"\] \{/g) ?? []).length === 1 && /background-image: none/.test(out), out);
check("a rule for another part is kept, and a new part's rule follows", /queue-join/.test(out) && out.indexOf("balance-refresh") > out.indexOf("queue-join"));
check("the same design sent again changes nothing", R.mergeLayer(out, fresh, "later") === out);

const seen = K.seenOfKit({ pages: [] }, JSON.stringify({ hooks: {}, tokens: { "--pons-buy": { default: "#0f0" }, "--next-step-background-color": { default: null } } }), "main", "now");
check("the layer's own variable is not one of the code's tokens", J(seen.tokens) === J(["--pons-buy"]), J(seen.tokens));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
