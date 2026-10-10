#!/usr/bin/env node
/**
 * NEXT.md ASKS ONLY FOR WHAT J DID, ONCE.
 *
 * The shelf audit (polio/shelf-items-audit.md, fixes 4 and 5) found that an
 * untouched PonsStars board already sent four lines saying J "switched on"
 * page transitions, search listing, accessibility and speed bars, which
 * are only Format's defaults; and that one effect dropped on one panel,
 * which every panel of its kind takes, wrote fourteen lines. Run on the
 * saved PST board's document (no browser):
 *
 *   node tests/asks-only-his.mjs
 *
 * Covers: src/features/studio/codeAsks.ts, src/features/studio/CodeSiteButtons.tsx
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const F = await jiti.import(join(here, "..", "src", "features", "studio", "shelfFacts.ts"));
const { FORMAT_FIELDS } = await jiti.import(join(here, "..", "src", "features", "studio", "format.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const def = new Map(FORMAT_FIELDS.map((f) => [f.id, f.default]));
const switches = F.formatSwitches().map((s) => ({ ...s, label: s.key, def: def.get(s.key) }));
const base = { nodes: doc.nodes, pages: doc.pages, format: doc.format, switches, coded: new Set(doc.look.styleSource.files.map((f) => f.pageId)), effect: (id) => ({ name: id === "screen-filter" ? "Screen filter" : id }) };

const none = A.codeAsks(base);
check("The saved PST board, untouched, with Format's real switches, asks for nothing", none.length === 0, none.map((i) => i.says).join(" | "));
const changed = A.codeAsks({ ...base, format: { ...doc.format, "pages.transition": "slide", "build.darkLight": true } });
check("A switch J changed is still asked (dark and light on, transition set to slide)", changed.length === 2 && changed.some((i) => /slide/.test(i.says)) && changed.some((i) => /darkLight/.test(i.says)), changed.map((i) => i.key).join(", "));

const panels = doc.nodes.filter((n) => n.pageId === doc.pages[0].id && /^(queue|wallet|balance|sign)-panel$/.test(n.source?.hook?.value ?? ""));
const spun = doc.nodes.map((n) => (panels.includes(n) ? { ...n, work: { id: "screen-filter", inputs: {} } } : n));
const asks = A.codeAsks({ ...base, nodes: spun });
check(`One effect on ${panels.length} panels is one line`, asks.length === 1 && panels.every((p) => asks[0].says.includes(`\`${p.source.hook.value}\``)), asks.map((i) => i.says).join(" | "));
const one = A.codeAsks({ ...base, nodes: doc.nodes.map((n) => (n === panels[0] ? { ...n, work: { id: "screen-filter", inputs: {} } } : n)) });
check("…and one part alone keeps its own line, by its hook", one.length === 1 && one[0].hook === panels[0].source.hook.value && /this part/.test(one[0].says));
const two = A.codeAsks({ ...base, nodes: spun.map((n) => (n.id === panels[0].id ? { ...n, work: { id: "screen-filter", inputs: { speed: "2" } } } : n)) });
check("Set differently on one of them, it is a line of its own", two.length === 2);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
