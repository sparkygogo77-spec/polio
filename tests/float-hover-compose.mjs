#!/usr/bin/env node
/**
 * A PART THAT FLOATS STILL LIFTS ON HOVER AND SINKS WHEN PRESSED.
 *
 * Audit 2026-10-11: a part given Float and Lift on hover (or Push on press)
 * floated but never lifted, and pressing it did not push it down. The float's
 * animation owned `translate`, which outranks `:hover` / `:active` and the
 * inline translate the Preview scripts set. Now the float adds to the
 * translate whenever the part also lifts or pushes, so the two sum: a 4px
 * lift on a 12px float sits 4px up at rest and 16px up at the float's peak.
 * Checked on the published CSS (`effectCss`) and on the Preview scripts, in
 * a plain headless Chromium page (no server, no board):
 *
 *   node tests/float-hover-compose.mjs
 *
 * Covers: src/features/studio/send-out/motionCss.ts, src/features/studio/shelf/library/behaviourScripts/effects.ts, src/features/studio/shelf/library/effects.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const M = await jiti.import(join(root, "src", "features", "studio", "send-out", "motionCss.ts"));
const W = await jiti.import(join(root, "src", "features", "studio", "shelf", "library", "works.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The published CSS. */
const SEL = '[data-hook="x"]';
const both = M.effectCss(SEL, [{ id: "float", inputs: {} }, { id: "hover-lift", inputs: {} }]);
const frames = [...both.frames.values()].join("\n");
check("Published: Float with Lift on hover adds to the translate", both.own.includes("animation-composition: add"), both.own.join("; "));
check("…with its rest written out, so the add starts from where the part is", frames.includes("0%, 100% { translate: 0px 0px; }"), frames);
const pushed = M.effectCss(SEL, [{ id: "float", inputs: {} }, { id: "press-push", inputs: {} }]);
check("Published: Float with Push on press adds too", pushed.own.includes("animation-composition: add"), pushed.own.join("; "));
const three = M.effectCss(SEL, [{ id: "spin", inputs: {} }, { id: "float", inputs: {} }, { id: "hover-lift", inputs: {} }]);
check("…and only the float adds when the part also spins", three.own.includes("animation-composition: replace, add"), three.own.join("; "));
const alone = M.effectCss(SEL, [{ id: "float", inputs: {} }]);
check("Published: Float alone still replaces (no composition, no written rest)", !alone.own.some((d) => d.startsWith("animation-composition")) && ![...alone.frames.values()].join("").includes("0%, 100%"), alone.own.join("; "));
const lift = M.effectCss(SEL, [{ id: "hover-lift", inputs: {} }]);
check("Published: Lift on hover alone writes no composition", !lift.own.some((d) => d.startsWith("animation-composition")));
const offLift = M.effectCss(SEL, [{ id: "float", inputs: {} }, { id: "hover-lift", inputs: {}, off: true }]);
check("Published: a Lift that is switched off leaves the float replacing", !offLift.own.some((d) => d.startsWith("animation-composition")));

const css = (fx) => `${SEL} { ${fx.own.join("; ")}; }\n${fx.rules.map((r) => `${r.selector} { ${r.declarations.join("; ")}; }`).join("\n")}\n${[...fx.frames.values()].join("\n")}`;
/* The part's translate with its looping motion held at `t` ms (its own transitions left to finish). */
const at = (p, t) => p.evaluate((t) => {
  const el = document.querySelector('[data-hook="x"]');
  el.getAnimations().filter((a) => !(a instanceof CSSTransition) && !(a.effect && a.effect.getKeyframes().some((k) => "rotate" in k))).forEach((a) => { a.pause(); a.currentTime = t; });
  return getComputedStyle(el).translate;
}, t);
const PAGE = '<!doctype html><html><body style="margin:0"><div data-hook="x" style="width:120px;height:40px;margin:80px;background:#c33"></div></body></html>';

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* Published: the style layer's CSS on a plain part. */
  const p = await browser.newPage();
  await p.setContent(PAGE.replace("</body>", `<style>${css(both)}</style></body>`));
  await p.mouse.move(5, 5);
  const still = [await at(p, 0), await at(p, 3000)];
  await p.hover(SEL, { force: true }); await p.waitForTimeout(400);
  const hovered = [await at(p, 0), await at(p, 3000)];
  check("Live: unhovered it floats 0 → 12px up", still[0] === "0px" && still[1] === "0px -12px", still.join(" / "));
  check("Live: hovered it lifts 4px on top of the float (4px, then 16px up)", hovered[0] === "0px -4px" && hovered[1] === "0px -16px", hovered.join(" / "));
  await p.close();

  const q = await browser.newPage();
  await q.setContent(PAGE.replace("</body>", `<style>${css(pushed)}</style></body>`));
  await q.hover(SEL, { force: true }); await q.mouse.down(); await q.waitForTimeout(300);
  const down = [await at(q, 0), await at(q, 3000)];
  await q.mouse.up();
  check("Live: pressed it sinks 2px under the float (2px down, then 10px up)", down[0] === "0px 2px" && down[1] === "0px -10px", down.join(" / "));
  await q.close();

  /* Preview: the shelf's scripts, Float started first, on one part. */
  const run = (ids) => `(() => { var el = document.querySelector('[data-hook="x"]'); var siteFeatures = { define: function (id, fn) { fn(el, {}); } };
    ${ids.map((id) => `new Function("siteFeatures", ${JSON.stringify(W.getWork(id).script)})(siteFeatures);`).join("\n")} })()`;
  const r = await browser.newPage();
  await r.setContent(PAGE);
  await r.mouse.move(5, 5);
  await r.evaluate(run(["float", "hover-lift"]));
  const pStill = [await at(r, 0), await at(r, 3000)];
  await r.hover(SEL, { force: true }); await r.waitForTimeout(400);
  const pHover = [await at(r, 0), await at(r, 3000)];
  check("Preview: unhovered it floats 0 → 12px up", /^0px( 0px)?$/.test(pStill[0]) && pStill[1] === "0px -12px", pStill.join(" / "));
  check("Preview: hovered it lifts 4px on top of the float", pHover[0] === "0px -4px" && pHover[1] === "0px -16px", pHover.join(" / "));
  await r.close();

  const s = await browser.newPage();
  await s.setContent(PAGE);
  await s.evaluate(run(["float", "press-push"]));
  await s.hover(SEL, { force: true }); await s.mouse.down(); await s.waitForTimeout(300);
  const pDown = [await at(s, 0), await at(s, 3000)];
  await s.mouse.up();
  check("Preview: pressed it sinks 2px under the float", pDown[0] === "0px 2px" && pDown[1] === "0px -10px", pDown.join(" / "));
  await s.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
