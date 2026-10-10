#!/usr/bin/env node
/**
 * EVERY MOTION SNAPS ONTO ANY PART OF A CODE SITE, WITH NO CODE CHAT.
 *
 * J (2026-10-10): "what's stopping a code chat from making it in a way that
 * the builder can export and preview within the builder, snapping onto any
 * panel". The kit now ships the Preview's own effect scripts as one file
 * (`vendor/builder-motion.js`), every page loads it, and Publish only names
 * the motion on the hook in the style layer. Run on the saved PST board and
 * PST's pages, and one real page in Chromium:
 *
 *   node tests/kit-motion.mjs
 *
 * Covers: src/features/studio/send-out/kitMotion.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/codeAsks.ts, src/features/studio/shelf/library/siteMotion.ts, kit/tools/kit-check.mjs, scripts/kit-motion.mjs
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const S = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));
const K = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const palette = { ...(doc.look.palette ?? {}), accent: "#e8ff6a", surface: "#101010" };
const home = doc.pages[0].id;
const byHook = (h) => doc.nodes.find((n) => n.pageId === home && n.source?.hook?.value === h);
const give = (hook, work, nodes = doc.nodes) => nodes.map((n) => (n.id === byHook(hook).id ? { ...n, work } : n));
const site = (ids, nodes = doc.nodes, opts = {}) => [...nodes, ...ids.map((id, i) => ({ id: `n_site_${i}`, pageId: home, featureId: id, x: 0, y: 5000 + i * 80, w: 420, h: 64, options: opts[id] ?? {} }))];
const layer = (nodes) => S.buildLayer(nodes, palette, source, { kit: true });
const rule = (l, sel) => l.rules.find((r) => r.selector === sel);

/* Publish names the motion on the hook. */
const tilted = layer(give("wallet-panel", { id: "tilt", inputs: { strength: "12" }, also: [{ id: "marquee", inputs: {} }] }));
const own = rule(tilted, '[data-hook="wallet-panel"]')?.declarations ?? [];
check("Tilt and a marquee on a panel: its rule names both, with only what was changed", own.includes('--builder-motion: "tilt?strength=12 marquee"'), own.join("; "));
check("Without a kit, nothing is named (the site has no file to run it)", !/--builder-motion/.test(S.buildLayer(give("wallet-panel", { id: "tilt", inputs: {} }), palette, source, { kit: false }).css));
check("A motion switched off is not named", !/--builder-motion/.test(layer(give("wallet-panel", { id: "tilt", inputs: {}, off: true })).css));
check("A motion CSS carries stays CSS, not named", !/--builder-motion/.test(layer(give("wallet-panel", { id: "hover-lift", inputs: {} })).css));
const whole = layer(site(["back-to-top", "parallax", "hover-tilt", "smooth-scroll"], doc.nodes, { parallax: { strength: "strong" } }));
const root = whole.rules.filter((r) => r.selector === ":root").flatMap((r) => r.declarations);
check("Whole-site back to top, parallax and leaning cards are named on :root", root.includes('--builder-site-motion: "back-to-top parallax?strength=0.32 hover-tilt"'), root.join("; "));
check("…with the accent and the surface they draw in", root.includes("--builder-motion-accent: #e8ff6a") && root.includes("--builder-motion-surface: #101010"));
check("…and smooth scrolling still as CSS", root.includes("scroll-behavior: smooth"));

/* NEXT.md asks for none of it on a kit site. */
const ask = (nodes, kit) => A.codeAsks({ nodes, pages: doc.pages, format: {}, switches: [], coded: new Set(source.files.map((f) => f.pageId)), effect: (id) => ({ name: id }), siteMotions: new Set(["back-to-top", "parallax", "hover-tilt", "confetti"]), kit });
const tiltNodes = give("wallet-panel", { id: "tilt", inputs: {} });
check("A kit site asks no code chat for a tilt", !ask(tiltNodes, true).some((i) => /tilt/.test(i.key)));
check("…a site without the kit still does", ask(tiltNodes, false).some((i) => /tilt/.test(i.key)));
const siteAsks = ask(site(["back-to-top", "confetti"]), true).map((i) => i.key);
check("Back to top is not asked for; confetti, which no file runs, still is", !siteAsks.includes("build-site-back-to-top") && siteAsks.includes("build-site-confetti"), siteAsks.join());

/* The file. */
let fresh = true;
try { execFileSync("node", [join(here, "..", "scripts", "kit-motion.mjs"), "--check"], { stdio: "pipe" }); } catch { fresh = false; }
check("The kit's motion file is current with the Preview's scripts", fresh);
const js = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
let parses = true;
try { new Function(js); } catch { parses = false; }
check("…and is valid JavaScript", parses);

/* A builder-ready site (the kit's own starter, as a site would have it, without the file): kit:check copies the file in and every page loads it. */
const dir = mkdtempSync(join(tmpdir(), "kit-motion-"));
cpSync(join(here, "..", "kit"), dir, { recursive: true, filter: (f) => !/node_modules|[\\/]vendor([\\/]|$)/.test(f) });
const manifest = JSON.parse(readFileSync(join(dir, "builder.json"), "utf8"));
for (const pg of manifest.pages) { const f = join(dir, pg.file); writeFileSync(f, readFileSync(f, "utf8").replace(/<script src="[^"]*builder-motion\.js" defer><\/script>\n/g, "")); }
const kitCheck = (write) => { try { execFileSync("node", [join(here, "..", "kit", "tools", "kit-check.mjs"), join(dir, "builder.json"), ...(write ? ["--write"] : [])], { stdio: "pipe" }); return []; } catch (e) { return String(e.stdout).split("\n").filter((l) => /✗/.test(l)); } };
const before = kitCheck(false);
check("Before: kit:check says the file is missing and a page does not load it", before.some((l) => /builder-motion\.js: the builder's motion file is missing/.test(l)) && before.some((l) => /does not load vendor\/builder-motion\.js/.test(l)), before.slice(0, 2).join(" | "));
const after = kitCheck(true);
const page = readFileSync(join(dir, manifest.pages[0].file), "utf8");
check("--write copies the file and adds its script to every page; the check passes", after.length === 0 && readFileSync(join(dirname(join(dir, manifest.tokens)), "vendor", "builder-motion.js"), "utf8") === js && /<script src="vendor\/builder-motion\.js" defer><\/script>\n<\/body>/.test(page), after.slice(0, 2).join(" | "));
const someHook = /data-hook="([^"]+)"/.exec(page.slice(page.indexOf("<body")))[1];
writeFileSync(join(dir, manifest.styleLayer), `[data-hook="${someHook}"] {\n  --builder-motion: "tilt?strength=12 marquee";\n}\n:root {\n  --builder-site-motion: "back-to-top";\n  --builder-motion-accent: #e8ff6a;\n}\n`);
const named = kitCheck(true);
check("A layer naming motions passes the kit's check", named.length === 0, named.slice(0, 3).join(" | "));

/* In a real page: any hook named in the layer moves, its children do not run it again, a part added later runs it. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await p.setContent(`<!doctype html><html><head><style>
    [data-hook="card"] { --builder-motion: "tilt?strength=20"; width: 300px; height: 200px; margin: 40px; }
    [data-hook="later"] { --builder-motion: "tilt"; width: 100px; height: 100px; }
    :root { --builder-site-motion: "back-to-top"; --builder-motion-accent: #e8ff6a; }
  </style></head><body data-hook="page"><div data-hook="card"><span data-hook="card-title">Title</span></div><div data-hook="spacer" style="height:3000px"></div>
  <script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
  await p.mouse.move(60, 60);
  await p.mouse.move(80, 70);
  await p.waitForTimeout(350);
  const card = await p.evaluate(() => document.querySelector('[data-hook="card"]').style.transform);
  const title = await p.evaluate(() => document.querySelector('[data-hook="card-title"]').style.transform);
  check("The card named in the layer tilts under the pointer", /rotateY/.test(card), card);
  check("…its title rides inside it and does not tilt again", title === "", title);
  await p.evaluate(() => { const d = document.createElement("div"); d.setAttribute("data-hook", "later"); document.body.appendChild(d); });
  await p.waitForTimeout(50);
  const later = await p.evaluate(async () => { const d = document.querySelector('[data-hook="later"]'); const r = d.getBoundingClientRect(); d.dispatchEvent(new PointerEvent("pointermove", { clientX: r.left + 10, clientY: r.top + 10, bubbles: true })); return d.style.transform; });
  check("A part a script adds later runs its motion too", /rotateY/.test(later), later);
  await p.evaluate(() => window.scrollTo(0, 800));
  await p.waitForTimeout(100);
  const back = await p.evaluate(() => { const b = document.querySelector('button[aria-label="Back to top"]'); return b ? getComputedStyle(b).display + " " + b.style.background : ""; });
  check("The whole site's back-to-top shows once scrolled, in the accent", /^block .*(232, 255, 106|#e8ff6a)/.test(back), back);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
