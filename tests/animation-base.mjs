#!/usr/bin/env node
/**
 * AN ANIMATED PART KEEPS WHAT ITS ANCESTORS ADD, EVERY FRAME.
 *
 * sunkcoin.fun (J, 2026-10-11, "the arrow is not the same motion"): the
 * "scroll to dive" arrow is `rotate(45deg)` inside a cue shifted
 * `translateX(-50%)`, nudged by a keyframe `rotate(45deg) translate(4px,
 * 4px)` at 50%. The part's transform carries the cue's shift too, and the
 * keyframe replaced the whole of it: at 50% the arrow jumped 62px sideways,
 * twice a second. The capture now carries the ancestors' part as `base` on
 * the animation (capture/site/capture/check-animation-base.mjs), and the
 * Builder plays the part a copy of the keyframes of its own with every
 * transform frame composed on it.
 *
 *   1. `keyframesCss`: a part with a base gets its own rule, `cap-nudge--id`,
 *      each transform frame prefixed by the base; the plain rule stays.
 *   2. `motionCss` names that rule on the part's box.
 *   3. The Preview: sampled over a second and a half, the arrow's centre
 *      stays within 2px across (it only nods down and back).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/animation-base.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/parts/capturedMotion.ts, src/features/studio/send-out/exportSite.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { openBoard, readBoard } from "./lib/board.mjs";
import { boardWith, captured, openPreview, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { keyframesCss, motionCss } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "capturedMotion.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const keyframes = [{ name: "nudge", frames: [{ key: "50%", style: { transform: "rotate(45deg) translate(4px, 4px)" } }] }, { name: "bob", frames: [{ key: "50%", style: { transform: "translateY(-6px)" } }] }];
const nudge = { name: "nudge", duration: "1.2s", timing: "ease-in-out", delay: "0s", iterations: "infinite", direction: "normal", fill: "none", base: "matrix(1, 0, 0, 1, -61.5, 0)" };
const arrow = part("n_arrow", 777, 928, 10, 10, {
  ...captured("body > main > section > div:nth-of-type(2) > i"),
  art: { transform: "matrix(0.7071, 0.7071, -0.7071, 0.7071, -61.5, 0.3)", origin: "5px 5px", animation: "nudge" },
  motion: { animation: [nudge] },
  edge: { width: 0, style: "none", shadow: "inset -3px 0 0 0 rgb(245, 217, 10), inset 0 -3px 0 0 rgb(245, 217, 10)" },
});
const bob = part("n_bob", 100, 100, 40, 40, { ...captured("body > main > section > div:nth-of-type(1)"), art: { animation: "bob" }, motion: { animation: [{ name: "bob", duration: "2s", iterations: "infinite" }] }, colour: { bg: "rgb(245, 217, 10)" } });

/* 1. */
const css = keyframesCss(keyframes, [arrow, bob]);
check("1. The part with a base gets its own copy of the rule, each transform frame composed on the base", /@keyframes cap-nudge--n_arrow \{\s*50% \{ transform: matrix\(1, 0, 0, 1, -61\.5, 0\) rotate\(45deg\) translate\(4px, 4px\) \}/.test(css), css);
check("…the plain rule stays for everyone else, and a part without a base gets no copy", /@keyframes cap-nudge \{\s*50% \{ transform: rotate\(45deg\) translate\(4px, 4px\) \}/.test(css) && !/cap-bob--/.test(css), css);
/* 2. */
const rules = motionCss([arrow, bob], keyframes, (id) => `[data-live-node="${id}"]`);
check("2. The part's box plays its own copy; the other its plain rule", /\.mo-n_arrow \{ animation: 1\.2s ease-in-out 0s infinite normal none cap-nudge--n_arrow; \}/.test(rules) && /\.mo-n_bob \{ animation: 2s infinite cap-bob; \}/.test(rules), rules.split("\n").filter((l) => /\.mo-/.test(l)).join(" | "));

/* 3. */
const saved = readBoard("pst");
const parts = [part("n_hero", 0, 0, 1440, 900, { ...captured("body > main > section"), colour: { bg: "rgb(7, 25, 47)" } }), bob, arrow, part("n_after", 0, 900, 1440, 900, captured("body > main > footer"))];
const board = boardWith(parts);
/* The page's own keyframes ride on the look, where the import puts them. */
const put = (raw) => { const v = JSON.parse(raw); v.state.look = { ...(v.state.look ?? {}), keyframes }; return JSON.stringify(v); };
if (board.local["builder.studio"] && JSON.parse(board.local["builder.studio"]).state?.nodes) board.local["builder.studio"] = put(board.local["builder.studio"]);
const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
if (row) row.value = put(row.value);
void saved;
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  await openPreview(ui, URL_BASE);
  const seen = await ui.evaluate(async () => {
    const el = document.querySelector('[data-live-node="n_arrow"]');
    const mo = el?.querySelector(".mo") ?? el;
    if (!el) return { found: false };
    const xs = [], ys = [];
    for (let i = 0; i < 8; i++) {
      const r = mo.getBoundingClientRect();
      xs.push(+(r.left + r.width / 2).toFixed(1)); ys.push(+(r.top + r.height / 2).toFixed(1));
      await new Promise((r) => setTimeout(r, 180));
    }
    return { found: true, anim: getComputedStyle(mo).animationName, across: +(Math.max(...xs) - Math.min(...xs)).toFixed(1), down: +(Math.max(...ys) - Math.min(...ys)).toFixed(1), x: xs[0] };
  });
  check("3. The Preview plays the arrow its own copy of the nudge", seen.found === true && seen.anim === "cap-nudge--n_arrow", JSON.stringify(seen));
  check("…and over a second and a half its centre stays put across (within 2px) while it nods down and back", seen.across <= 2 && seen.down >= 3 && seen.down <= 8, JSON.stringify(seen));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
