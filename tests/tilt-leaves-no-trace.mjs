#!/usr/bin/env node
/**
 * A TILTED PANEL LEAVES NOTHING BEHIND ONCE THE POINTER HAS GONE.
 *
 * The whole-site hover tilt lifts a leaning panel (z-index 1000+) and gives it a
 * clear rim (outline) while it leans, and takes both back once it has settled.
 * In Chromium the pointer's leave was not always sent to a panel it had been
 * turned in 3D under, so the lift and the rim stayed on, on the published
 * page: the panel kept z-index 1002 and an 8px transparent outline, drawn over
 * its neighbour for good. Now the pointer moving anywhere outside the panel
 * ends the lean as well.
 *
 * Runs the kit's vendor/builder-motion.js in Chromium and holds, for the site
 * hover tilt and for the Tilt effect: after the pointer has left, no inline
 * z-index, position, outline or transform is left on either panel, and the
 * page is drawn pixel for pixel as it was before the pointer came.
 *
 *   node tests/tilt-leaves-no-trace.mjs
 *
 * Covers: src/features/studio/shelf/library/siteMotion.ts, src/features/studio/shelf/library/raiseJs.ts, src/features/studio/send-out/kitMotion.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const file = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");

const page = (motion, site) => `<!doctype html><html><head><style>
  body { margin: 0; display: flex; gap: 0; padding: 40px; }
  .row { display: flex; }
  [data-hook] { width: 200px; height: 200px; background: #ccc; box-shadow: 6px 6px 0 #222; }
  [data-hook="b"] { margin-left: -20px; background: #888; }
  ${motion ? `[data-hook="a"] { --builder-motion: "${motion}"; }` : ""}
  ${site ? `:root { --builder-site-motion: "${site}"; }` : ""}
</style></head><body><div class="row"><div data-hook="a" data-panel></div><div data-hook="b" data-panel></div></div><script>${file}</script></body></html>`;

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 800, height: 400 } });
  for (const [label, motion, site] of [["The Tilt effect", "tilt", ""], ["The whole-site hover tilt", "", "hover-tilt"]]) {
    await p.setContent(page(motion, site));
    await p.mouse.move(700, 380);
    await p.waitForTimeout(150);
    const before = await p.screenshot();
    /* Over the second panel, onto the first, and out the other side to the page. */
    await p.mouse.move(150, 140, { steps: 4 });
    await p.waitForTimeout(200);
    await p.mouse.move(700, 380, { steps: 2 });
    let left = "";
    for (let i = 0; i < 16; i++) {
      await p.waitForTimeout(250);
      left = await p.evaluate(() => [...document.querySelectorAll("[data-hook]")].map((e) => `${e.style.zIndex}|${e.style.position}|${e.style.outline}|${e.style.outlineOffset}|${e.style.transform}`).join(" ; "));
      if (left === "|||| ; ||||") break;
    }
    check(`${label}: once the pointer has gone, no z-index, position, outline or transform is left on either panel`, left === "|||| ; ||||", left);
    await p.waitForTimeout(400);
    const after = await p.screenshot();
    check(`${label}: and the page is drawn pixel for pixel as it was before the pointer came`, Buffer.compare(before, after) === 0, `${before.length} bytes before, ${after.length} after`);
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} of ${results.length} checks failed` : `${results.length} of ${results.length} checks passed`}`);
process.exit(failed ? 1 : 0);
