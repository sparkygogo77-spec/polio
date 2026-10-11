#!/usr/bin/env node
/**
 * AN IMPORT KEEPS A SITE'S VISUAL THEME.
 *
 * PonsStars' redesign (J, 2026-10-11) came in with its dial's dashed ticks
 * drawn as a solid ring, its clock's hands still, its sticky rail scrolling
 * away, and nothing to say what was lost. The read now carries: an inline
 * svg as real svg markup (dashes, CSS turns, animations and their
 * keyframes, nothing that runs), a sticky or fixed part's pin and inset, a
 * positioned part's z-index, the page's own background layers on <html> /
 * an unhooked <body> and their ::before/::after, and the import report's
 * fidelity check of every hooked part against the live page.
 *
 *   node tests/import-keeps-theme.mjs
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc, reportChips, reportSays } from "../src/features/studio/bring-in/pageParts.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
await page.setContent(`<!doctype html><html><head><style>
html { background: radial-gradient(circle at 20% 0, #fc0, transparent 60%), repeating-conic-gradient(#0002 0 6deg, transparent 6deg 12deg), #eee; }
html::before { content: ""; position: fixed; inset: 0; background: linear-gradient(transparent, #0003); pointer-events: none; }
body { margin: 0; font: 16px Arial; display: grid; grid-template-columns: 180px 1fr; }
@keyframes spin { to { rotate: 360deg; } }
@keyframes pulse { 50% { opacity: .5; } }
[data-hook="rail"] { position: sticky; top: 0; height: 300px; background: #321; }
[data-hook="ticks"] { fill: none; stroke: #000; stroke-width: 4; stroke-dasharray: .6 3.5; }
[data-hook="hand"] { stroke: red; transform-box: view-box; transform-origin: 40px 40px; animation: spin 60s steps(60) infinite; }
[data-hook="seal"] { position: absolute; left: 400px; top: 80px; width: 80px; height: 80px; rotate: -8deg; z-index: 2; border: 3px double olive; border-radius: 50%; animation: pulse 2s infinite; }
</style></head><body>
<nav data-hook="rail"><svg data-hook="clock" viewBox="0 0 80 80" width="80" height="80" onclick="alert(1)"><circle data-hook="ticks" cx="40" cy="40" r="30" pathLength="12"/><line data-hook="hand" x1="40" y1="40" x2="40" y2="12"/><script>1</script></svg></nav>
<main data-hook="main" style="height:1200px"><span data-hook="seal">SEAL</span><p data-hook="words">Hello</p><p data-hook="pot-line">Pot: <span data-hook="pot" style="display:inline-block;animation:pulse 1s 1 forwards">0.5</span> SOL.</p></main>
</body></html>`);
const read = await page.evaluate(PARTS, 1500);
const by = (h) => read.parts.find((p) => p.hooks?.["data-hook"] === h);
const clock = by("clock");
check("the svg is kept as markup", typeof clock?.svg === "string" && clock.svg.startsWith("<svg"), (clock?.svg ?? "").slice(0, 40));
check("its dashed ticks keep their dashes", /data-hook="ticks"[^>]*stroke-dasharray/.test(clock?.svg ?? "") && !/data-hook="ticks"[^>]*visibility="hidden"/.test(clock?.svg ?? ""));
check("its hand keeps its animation and the keyframes ride inside", /data-hook="hand"[^>]*animation:\s*spin/.test(clock?.svg ?? "") && /@keyframes spin/.test(clock?.svg ?? ""));
check("nothing in it runs", !/<script|onclick/i.test(clock?.svg ?? ""));
const rail = by("rail");
check("a sticky rail is read as sticky, with its inset", rail?.position === "sticky" && rail?.inset?.top === 0, JSON.stringify({ p: rail?.position, i: rail?.inset }));
const seal = by("seal");
check("a seal turned by rotate: keeps its turn", !!seal?.turn, seal?.turn);
check("a positioned part keeps its z-index", seal?.style.z === 2, String(seal?.style.z));
check("the page's layered background is kept", read.layers?.some((l) => l.from === "html" && /radial-gradient.*repeating-conic-gradient/.test(l.art.background ?? "")), JSON.stringify(read.layers?.map((l) => l.from)));
check("html::before is kept, pinned", read.layers?.some((l) => l.from === "html::before" && l.position === "fixed"));
const { doc, report } = pagesToDoc([{ file: "index.html", read }], { byHook: true });
const node = (h) => doc.nodes.find((n) => n.hooks?.["data-hook"] === h);
check("the board gets svg markup", typeof node("clock")?.svg?.markup === "string");
check("the board gets the pin", node("rail")?.from?.position === "sticky" && node("rail")?.from?.inset?.top === 0);
check("the board gets the turn and z", !!node("seal")?.art?.transform && node("seal")?.art?.z === 2);
check("the board gets the animation and its keyframes", node("seal")?.motion?.animation?.[0]?.name === "pulse" && doc.keyframes.some((k) => k.name === "pulse"));
check("the board gets the page layers", (doc.ground.layers ?? []).length >= 2);
check("the fidelity check ran over the hooked parts", (report.fidelity?.checked ?? 0) >= 4, JSON.stringify(report.fidelity));
check("and found nothing lost here", report.fidelity?.mismatches.length === 0, JSON.stringify(report.fidelity?.mismatches));
/* A loss is named: drop the seal's turn and animation from what the board was handed, and check again. */
const { fidelityOf } = await import("../src/features/studio/bring-in/pageParts.ts");
const nodes = doc.nodes.map((n) => (n.hooks?.["data-hook"] === "seal" ? { ...n, art: {}, motion: null } : n));
const out = { checked: 0, mismatches: [] };
fidelityOf("Home", read.parts, nodes, doc.keyframes, out);
check("a dropped turn and animation are listed", out.mismatches.some((m) => m.hook === "seal" && m.what === "transform") && out.mismatches.some((m) => m.hook === "seal" && m.what === "animation"), JSON.stringify(out.mismatches));
check("the report says it", reportChips(report).some((c) => c.k === "fidelity") && /Checked against the live page/.test(reportSays(report, { scripts: false, from: "x" })));
check("an inline box that animates is a part of its own, with its animation", by("pot")?.style.animation?.[0]?.name === "pulse", JSON.stringify(by("pot")?.style.animation));
const c = read.census;
check("the live count is taken over every element", c?.live.animated >= 2 && c?.live.svg === 1 && c?.live.svgShapes === 2 && c?.live.sticky === 1 && c?.live.layered >= 1 && c?.live.pseudo >= 1, JSON.stringify(c?.live));
check("and everything counted live is kept", c && Object.keys(c.live).every((k) => c.kept[k] === c.live[k]), JSON.stringify(c));
check("the report shows kept against live per page", reportChips(report).some((x) => x.k === "kept:Home" && /animated \d+\/\d+/.test(x.label)) && /Kept against live/.test(reportSays(report, { scripts: false, from: "x" })));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
