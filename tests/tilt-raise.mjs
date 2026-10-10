#!/usr/bin/env node
/**
 * A TILTED PANEL COMES UP OVER THE PANELS AROUND IT.
 *
 * J (2026-10-10): "the effect would be a lot more 3d if it didnt stay under
 * the other pieces and instead came over the panels". Two panels side by side,
 * the first one tilting, drawn before the second: while it tilts its corner is
 * on top at the overlap, and once it has settled the page's own order is back.
 * Runs the kit's vendor/builder-motion.js (the Tilt effect and the whole-site
 * hover tilt) in Chromium, plus the Preview's own lines:
 *
 *   node tests/tilt-raise.mjs
 *
 * Covers: src/features/studio/shelf/library/raiseJs.ts, src/features/studio/shelf/library/behaviourScripts/motion.ts, src/features/studio/shelf/library/siteMotion.ts, src/features/studio/live/LiveShell.tsx, scripts/kit-motion.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const K = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));
const { RAISE_JS } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "library", "raiseJs.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const file = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
check("vendor/builder-motion.js is current", file === K.kitMotionJs());
check("The kit file carries the raise", file.includes("function raiseOver("));

const page = (motion, site) => `<!doctype html><html><head><style>
  body { margin: 0; display: flex; gap: 0; padding: 40px; }
  .row { display: flex; }
  [data-hook] { width: 200px; height: 200px; background: #ccc; }
  [data-hook="b"] { margin-left: -20px; background: #888; }
  ${motion ? `[data-hook="a"] { --builder-motion: "${motion}"; }` : ""}
  ${site ? `:root { --builder-site-motion: "${site}"; }` : ""}
</style></head><body><div class="row"><div data-hook="a" data-panel></div><div data-hook="b" data-panel></div></div><script>${file}</script></body></html>`;

/* Who is drawn at the overlap: the strip where the first panel's right edge sits under the second. */
const top = (p) => p.evaluate(() => { const b = document.querySelector('[data-hook="b"]').getBoundingClientRect(); return document.elementFromPoint(b.left + 8, b.top + 100)?.getAttribute("data-hook"); });
const hover = (p) => p.mouse.move(150, 140, { steps: 4 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 800, height: 400 } });
  for (const [label, motion, site] of [["The Tilt effect", "tilt", ""], ["The whole-site hover tilt", "", "hover-tilt"]]) {
    await p.setContent(page(motion, site));
    await p.mouse.move(700, 380);
    await p.waitForTimeout(100);
    check(`${label}: standing still, the second panel is on top at the overlap`, (await top(p)) === "b");
    await hover(p);
    await p.waitForTimeout(80);
    const lean = await p.evaluate(() => document.querySelector('[data-hook="a"]').style.transform);
    check(`${label}: the first panel leans`, /rotate/.test(lean), lean);
    const over = await top(p);
    check(`${label}: while it leans it comes up over the second`, over === "a", over);
    await p.mouse.move(700, 380, { steps: 2 });
    await p.waitForTimeout(450);
    const z = await p.evaluate(() => { const a = document.querySelector('[data-hook="a"]'); return `${a.style.zIndex}|${a.style.position}`; });
    check(`${label}: once settled the page's order is back, nothing left behind`, (await top(p)) === "b" && z === "|", z);
  }

  /* Two tilts holding the same box: one settling late leaves it up while the other still holds it. */
  await p.setContent(`<!doctype html><div id="x"></div><script>${RAISE_JS}; window.raiseOver = raiseOver;</script>`);
  const held = await p.evaluate(() => {
    const x = document.getElementById("x");
    const one = window.raiseOver([x]), two = window.raiseOver([x]);
    one();
    const mid = x.style.zIndex;
    two();
    return `${mid !== "" && +mid > 1000}|${x.style.zIndex}`;
  });
  check("A box two tilts hold stays up until both let go", held === "true|", held);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
