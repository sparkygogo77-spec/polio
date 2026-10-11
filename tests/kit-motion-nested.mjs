#!/usr/bin/env node
/**
 * THE SAME MOTION ON A PART AND ON A PART INSIDE IT RUNS ON BOTH.
 *
 * On the published site the kit's motion file used to skip a part whose
 * motion was the same as the part right around it, taking it for an
 * inherited value: Tilt on a card and on its button tilted only the card,
 * while the Preview tilted both. The file now registers `--builder-motion`
 * and `--builder-scroll` as not inherited. A part with no motion of its own
 * still does not run its panel's again. Runs kitMotionJs() in one real page
 * in Chromium, no server:
 *
 *   node tests/kit-motion-nested.mjs
 *
 * Covers: src/features/studio/send-out/kitMotion.ts, kit/starter/vendor/builder-motion.js
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const K = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const js = K.kitMotionJs();
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await p.setContent(`<!doctype html><html><head><style>
    [data-hook="card"] { --builder-motion: "tilt"; width: 300px; height: 200px; margin: 40px; }
    [data-hook="card-button"] { --builder-motion: "tilt"; display: block; width: 100px; height: 60px; }
    [data-hook="strip"] { --builder-motion: "marquee"; width: 400px; overflow: hidden; }
    [data-hook="strip-line"] { --builder-motion: "marquee"; width: 300px; overflow: hidden; }
  </style></head><body data-hook="page">
  <div data-hook="card"><span data-hook="card-title">Title</span><button data-hook="card-button">Go</button></div>
  <div data-hook="strip"><div data-hook="strip-line"><span>One line of words that runs along</span></div></div>
  <script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
  await p.waitForTimeout(100);
  const tilt = (hook) => p.evaluate((h) => {
    const d = document.querySelector(`[data-hook="${h}"]`);
    const r = d.getBoundingClientRect();
    d.dispatchEvent(new PointerEvent("pointermove", { clientX: r.left + 5, clientY: r.top + 5, bubbles: true }));
    return d.style.transform;
  }, hook);
  const button = await tilt("card-button");
  const card = await tilt("card");
  const title = await p.evaluate(() => document.querySelector('[data-hook="card-title"]').style.transform);
  check("The card tilts", /rotateY/.test(card), card);
  check("…the button inside it, with the same Tilt, tilts too", /rotateY/.test(button), button);
  check("…the title, with no motion of its own, does not tilt again", title === "", title);
  const tracks = await p.evaluate(() => ["strip", "strip-line"].map((h) => [...document.querySelector(`[data-hook="${h}"]`).children].some((c) => c.hasAttribute("data-marquee-track"))));
  check("The strip and the line inside it, both with Marquee, each run it", tracks[0] && tracks[1], JSON.stringify(tracks));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
