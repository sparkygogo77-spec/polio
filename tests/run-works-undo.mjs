#!/usr/bin/env node
/**
 * A FEATURE PLAYED ON THE BOARD STOPS WHEN ITS PLAY IS OVER.
 *
 * The Motion tab's play button runs one feature on one part for four
 * seconds ("Playing for four seconds: move the pointer over it"), and a
 * hover-try does the same. The undo put the part's style back, but the
 * script's listeners stayed on the window: a part played with Follow the
 * pointer went on following the cursor on the board after its four seconds,
 * and each play added another listener. `runWorks` now notes every listener
 * and observer a script starts while it runs and lets them go on undo.
 *
 *   1. Follow the pointer moves the part while it plays;
 *   2. after the undo, a pointer move leaves it where it was drawn;
 *   3. played and undone twice, a pointer move writes nothing to it;
 *   4. Tilt (one part): after the undo, a pointer move over it tilts nothing;
 *   5. Tilt on scroll (parallax): after the undo, a scroll moves nothing;
 *   6. Follow as a layer: after the undo, its frame loop has stopped;
 *   7. the window's own addEventListener and observers are put back after a run.
 *
 * The real runWorks.ts, its runtime and the features' real scripts, run in
 * a browser page on a board-shaped part; needs no server.
 *
 *   node tests/run-works-undo.mjs
 *
 * Covers: src/features/studio/live/runWorks.ts, src/features/studio/panels/MotionPanel.tsx, src/features/studio/tryLook.ts, src/features/studio/shelf/library/behaviourScripts/motion.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import ts from "typescript";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "features", "studio");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const shelf = await jiti.import(join(src, "shelf", "index.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/*
 * runWorks.ts as the page runs it, its imports handed in: the shelf's own
 * values, and `pageFeatures` worked out here for each run below. The parts
 * carry no boxes, so no riders, and `carriers` is never asked for any.
 */
const code = ts.transpileModule(readFileSync(join(src, "live", "runWorks.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const runs = {
  follow: [{ id: "p1", work: { id: "follow-pointer", inputs: {} } }],
  layer: [{ id: "p1", work: { id: "follow-pointer", inputs: { how: "layer" } } }],
  tilt: [{ id: "p1", work: { id: "tilt", inputs: {} } }],
  parallax: [{ id: "p1", work: { id: "tilt", inputs: { mode: "scroll", strength: "40" } } }],
};
const feats = Object.fromEntries(Object.entries(runs).map(([k, nodes]) => [k, shelf.pageFeatures(nodes)]));
const scripts = Object.fromEntries(["follow-pointer", "tilt"].map((id) => [id, shelf.getWork(id).script]));
const given = { RUNTIME_JS: shelf.RUNTIME_JS, ON_BOARD: shelf.ON_BOARD, NOT_ON_COPIES: shelf.NOT_ON_COPIES, scripts, feats, runs };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.setContent(`<!doctype html><body style="margin:0;height:3000px">
  <div data-node-id="p1" style="position:absolute;left:300px;top:300px;width:100px;height:100px"><div data-part-drawn style="width:100px;height:100px;background:red"></div></div>
</body>`);
await page.evaluate(({ code, given }) => {
  const shelf = {
    RUNTIME_JS: given.RUNTIME_JS, ON_BOARD: given.ON_BOARD, NOT_ON_COPIES: given.NOT_ON_COPIES,
    getWork: (id) => (given.scripts[id] ? { script: given.scripts[id] } : undefined),
    pageFeatures: (nodes) => given.feats[Object.keys(given.runs).find((k) => JSON.stringify(given.runs[k]) === JSON.stringify(nodes))],
  };
  const mods = { "../shelf": shelf, "./carry": { carriers: () => new Map() } };
  const module = { exports: {} };
  new Function("require", "exports", "module", code)((m) => mods[m], module.exports, module);
  window.__runWorks = module.exports.runWorks;
  window.__native = { add: EventTarget.prototype.addEventListener, io: window.IntersectionObserver, ro: window.ResizeObserver, mo: window.MutationObserver };
  window.__el = () => document.querySelector('[data-node-id="p1"] > [data-part-drawn]');
  window.__play = (k) => {
    const n = given.runs[k][0];
    window.__stop = window.__runWorks(document.body, given.runs[k], { board: true, only: { part: n.id, feature: n.work.id } });
  };
}, { code, given });

const play = (k) => page.evaluate((k) => window.__play(k), k);
const stop = () => page.evaluate(() => window.__stop());
const moveTo = (x, y, on = "window") => page.evaluate(([x, y, on]) => (on === "el" ? window.__el() : window).dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true })), [x, y, on]);
const style = (p) => page.evaluate((p) => window.__el().style[p], p);
const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; (function f() { if (++i > n) r(); else requestAnimationFrame(f); })(); }), n);

/* 1–3. Follow the pointer, played from the Motion tab. */
await play("follow");
await moveTo(700, 350);
const playing = await style("translate");
check("1. Follow the pointer moves the part while it plays", playing !== "" && playing !== "none", JSON.stringify(playing));
await stop();
await moveTo(100, 100);
const after = await style("translate");
check("2. after the undo, a pointer move leaves it where it was drawn", after === "", JSON.stringify(after));
await play("follow"); await stop();
await play("follow"); await stop();
const writes = await page.evaluate(() => {
  const el = window.__el(), seen = new MutationObserver(() => {});
  seen.observe(el, { attributes: true, attributeFilter: ["style"] });
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: 800, clientY: 700 }));
  const n = seen.takeRecords().length;
  seen.disconnect();
  return n;
});
check("3. played and undone twice, a pointer move writes nothing to it", writes === 0, `${writes} writes`);

/* 4. Tilt over one part: it listens on the part itself, which stays on the board. */
await play("tilt");
await moveTo(330, 330, "el");
const tilted = await style("transform");
await stop();
await moveTo(380, 370, "el");
const untilted = await style("transform");
check("4. Tilt: after the undo, a pointer move over it tilts nothing", /rotate/.test(tilted) && untilted === "", `${JSON.stringify(tilted)} then ${JSON.stringify(untilted)}`);

/* 5. Tilt on scroll: parallax listens to the window's scroll and size. */
await play("parallax");
await stop();
await page.evaluate(() => window.scrollTo(0, 600));
await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
await frames(3);
const drift = await style("translate");
check("5. Tilt on scroll: after the undo, a scroll moves nothing", drift === "", JSON.stringify(drift));
await page.evaluate(() => window.scrollTo(0, 0));

/* 6. Follow as a layer keeps a frame loop of its own. */
await play("layer");
await moveTo(950, 750);
await frames(10);
const layered = await style("translate");
await stop();
await frames(3);
const still1 = await style("translate");
await moveTo(10, 10);
await frames(5);
const still2 = await style("translate");
check("6. Follow as a layer: after the undo, its frame loop has stopped", /px/.test(layered) && still1 === "" && still2 === "", `${JSON.stringify(layered)} then ${JSON.stringify(still1)}, ${JSON.stringify(still2)}`);

/* 7. Nothing of the noting is left on the page. */
const native = await page.evaluate(() => EventTarget.prototype.addEventListener === window.__native.add && window.IntersectionObserver === window.__native.io && window.ResizeObserver === window.__native.ro && window.MutationObserver === window.__native.mo);
check("7. the window's own addEventListener and observers are put back after a run", native === true);
check("…and the page threw nothing", errors.length === 0, errors.join(" | "));

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
