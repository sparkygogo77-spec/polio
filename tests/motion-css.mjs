#!/usr/bin/env node
/**
 * EFFECTS AND WHOLE-SITE MOTION REACH A SITE FROM CODE AS CSS.
 *
 * J (2026-10-10, polio/shelf-items-audit.md fix 3): an effect from the shelf
 * on a PonsStars part, or a whole-site motion switched on, reached the site
 * only as a NEXT.md line. The style layer now writes what CSS can carry, and
 * Push on press left at its defaults presses the way the site's own buttons
 * do. Run on the saved PST board's document and PST's own pages (no browser):
 *
 *   node tests/motion-css.mjs
 *
 * Covers: src/features/studio/send-out/motionCss.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/styleLayerRun.ts, src/features/studio/codeAsks.ts
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const S = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));
const RUN = await jiti.import(join(here, "..", "src", "features", "studio", "styleLayerRun.ts"));
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const palette = { ...(doc.look.palette ?? {}), accent: "#e8ff6a" };
const home = doc.pages[0].id;
const byHook = (h) => doc.nodes.find((n) => n.pageId === home && n.source?.hook?.value === h);
const give = (hook, work) => doc.nodes.map((n) => (n === byHook(hook) ? { ...n, work } : n));
const layer = (nodes) => S.buildLayer(nodes, palette, source, { kit: true });
const rule = (l, sel) => l.rules.find((r) => r.selector === sel);
const before = layer(doc.nodes);
check("The saved board untouched writes no motion", !/Motion from the Builder/.test(before.css));

const lifted = layer(give("wallet-panel", { id: "hover-lift", inputs: {} }));
check("Lift on hover on a panel: its :hover rises 4px", rule(lifted, '[data-hook="wallet-panel"]:hover')?.declarations.includes("translate: 0px -4px"), JSON.stringify(rule(lifted, '[data-hook="wallet-panel"]:hover')));
check("…easing in, on the panel's own rule", /transition: translate 200ms ease/.test(rule(lifted, '[data-hook="wallet-panel"]')?.declarations.join("; ") ?? ""));

const pressed = layer(give("wallet-panel", { id: "push", inputs: {} }));
const pushed = layer(give("wallet-panel", { id: "press-push", inputs: {} }));
const act = rule(pushed, '[data-hook="wallet-panel"]:active')?.declarations ?? [];
check("Push on press at its defaults presses as PST's own buttons do (3px, no shadow)", act.includes("transform: translate(3px, 3px)") && act.includes("box-shadow: none"), act.join("; "));
check("…an unknown effect writes nothing", !/Motion from the Builder/.test(pressed.css));
const set = layer(give("wallet-panel", { id: "press-push", inputs: { down: "5" } }));
check("…set by hand, it presses as set", rule(set, '[data-hook="wallet-panel"]:active')?.declarations.includes("translate: 0px 5px"));

const floated = layer(give("wallet-panel", { id: "float", inputs: {} }));
check("Float writes its keyframes and plays them on the part", /@keyframes pb-float-y-12 \{\n  50% \{ translate: 0px -12px; \}\n\}/.test(floated.css) && /animation: pb-float-y-12 6s ease-in-out infinite/.test(floated.css));
check("…and holds it still for a visitor who asks for less motion", /prefers-reduced-motion: reduce\) \{\n  \[data-hook="wallet-panel"\]/.test(floated.css));
const revealed = layer(give("wallet-panel", { id: "reveal", inputs: {} }));
const rd = rule(revealed, '[data-hook="wallet-panel"]')?.declarations ?? [];
check("Reveal on scroll is a scroll-driven animation, the timeline after the shorthand", rd.findIndex((d) => d.startsWith("animation:")) < rd.indexOf("animation-timeline: view()") && rd.includes("animation-timeline: view()"), rd.join("; "));

/* Whole-site motions, as their parts on every page. */
const site = (ids, opts = {}) => [...doc.nodes, ...ids.map((id, i) => ({ id: `n_site_${i}`, pageId: home, featureId: id, x: 0, y: 5000 + i * 80, w: 420, h: 64, options: opts[id] ?? {} }))];
const png = "data:image/png;base64,iVBORw0KGgo=";
const whole = layer(site(["smooth-scroll", "reveal-on-scroll", "scroll-progress", "page-load", "cursor-effects", "back-to-top"], { "cursor-effects": { style: "picture", picture: png } }));
check("Smooth scrolling and a picture cursor go on :root", rule(whole, ":root")?.declarations.includes("scroll-behavior: smooth") && whole.rules.some((r) => r.selector === ":root" && r.declarations.some((d) => d.startsWith(`cursor: url("${png}")`))));
check("Appear on scroll reveals each panel with what it holds", /\[data-panel\] \{ animation: pb-site-reveal/.test(whole.css));
check("The progress bar follows the scroll, in the accent, as a custom property", /body::before \{[^}]*--builder-progress: #e8ff6a; background: var\(--builder-progress\)[^}]*animation-timeline: scroll\(root\)/.test(whole.css));
check("The opening fades the page in", rule(whole, "body")?.declarations.includes("animation: pb-open 0.6s ease-out both"));

/* What CSS carries is not asked again; what it cannot is. */
const coded = new Set(source.files.map((f) => f.pageId));
const asks = A.codeAsks({ nodes: [...give("wallet-panel", { id: "hover-lift", inputs: {}, also: [{ id: "tilt", inputs: {} }] }), ...site(["smooth-scroll", "back-to-top"]).slice(doc.nodes.length)], pages: doc.pages, format: {}, switches: [], coded, siteMotions: new Set(["smooth-scroll", "back-to-top"]), effect: (id) => ({ name: id }) });
check("Lift and smooth scrolling are not asked of the code; tilt and back to top are", asks.length === 2 && asks.some((i) => /"tilt"/.test(i.says)) && asks.some((i) => i.key === "build-site-back-to-top"), asks.map((i) => i.key).join(", "));

/* Merged into a layer already there, the keyframes stay whole, and the same round twice changes nothing. */
const rules = floated.css.slice(floated.css.indexOf("*/") + 2).trim();
const had = '[data-hook="nav"] {\n  color: var(--x);\n}\n';
const merged = RUN.mergeLayer(had, rules, "2026-10-10");
check("Merged, the @keyframes keep their name round their frames", /@keyframes pb-float-y-12 \{\n  50%/.test(merged) && /@media \(prefers-reduced-motion: reduce\) \{\n  \[data-hook="wallet-panel"\]/.test(merged), merged.slice(-300));
check("…and merging the same round again leaves the file as it was", RUN.mergeLayer(merged, rules, "2026-10-10") === merged);

/* PST's pages with that layer pass the kit's own check, as Publish requires. */
const dir = mkdtempSync(join(tmpdir(), "motion-css-"));
cpSync(join(here, "fixtures", "pst-tv"), dir, { recursive: true });
const manifest = JSON.parse(readFileSync(join(dir, "builder.json"), "utf8"));
const kit = (css) => { writeFileSync(join(dir, manifest.styleLayer), css); try { execFileSync("node", [join(here, "..", "kit", "tools", "kit-check.mjs"), join(dir, "builder.json"), "--write"], { stdio: "pipe" }); return []; } catch (e) { return String(e.stdout).split("\n").filter((l) => /^\s*-|problem/i.test(l)); } };
const base = kit("");
const all = layer(site(["smooth-scroll", "scroll-snap", "reveal-on-scroll", "scroll-progress", "page-load"]).map((n) => (n === byHook("wallet-panel") ? { ...n, work: { id: "press-push", inputs: {}, also: [{ id: "float", inputs: {} }, { id: "hover-lift", inputs: {} }] } } : n)));
const now = kit(all.css).filter((l) => !base.includes(l));
check("The kit's check finds nothing new in the layer", now.length === 0, now.slice(0, 4).join(" | "));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
