#!/usr/bin/env node
/**
 * A CAPTURED STYLESHEET MARQUEE RUNS IN THE PREVIEW.
 *
 * sunkcoin.fun (J, 2026-10-11): "they also have their banner where ours
 * doesnt". The converter now reads the ticker's row as a marquee: one copy
 * of its words as runs, and a `behaviours.loops` record naming it a marquee
 * at the page's pace with the row's gap (capture/site/capture/
 * check-marquee-css.mjs). Here, the Builder's side:
 *
 *   1. The hand-over gives such a part the Marquee feature at that speed,
 *      running left, with the row's gap between loops, never pausing.
 *   2. The Preview runs it: the part's words are on a track that moves,
 *      copied enough times to fill the strip, and the strip stays a strip.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/marquee-captured.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/library/captured.ts, src/features/studio/shelf/library/behaviourScripts/motion.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, openPreview, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = join(here, "..", "src", "features", "studio", "shelf", "library");
const { attachCaptured } = await jiti.import(join(L, "captured.ts"));
const { usesOf } = await jiti.import(join(L, "works.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const runs = [{ text: "120 UNDERWATER" }, { text: " ", pad: [0, 21, 0, 21] }, { text: "POT " }, { text: "3.82 SOL", colour: "rgb(245, 217, 10)" }, { text: " ", pad: [0, 21, 0, 21] }, { text: "$SUNK · THE COIN THAT PAYS YOUR SUNK COST" }];
const font = { face: "monospace", size: 0.5625, px: 9, stack: "ui-monospace, monospace", weight: 400, spacing: 0.12, leading: 1 };
const strip = part("n_strip", 0, 960, 1440, 36, { ...captured("body > main > div"), colour: { bg: "rgb(5, 20, 42)" } });
const row = part("n_run", 0, 974, 1440, 9, { featureId: "prose", content: runs, font, colour: { text: "rgb(243, 238, 227)" }, ...captured("body > main > div > div") });

/* 1. */
const loop = { part: "n_run", selector: "body > main > div > div", kind: "marquee", css: true, name: "run", speed: 114.4, direction: "left", copies: 3, width: 1440, loopWidth: 480, gap: 48 };
const given = attachCaptured([structuredClone(strip), structuredClone(row)], { version: 1, loops: [loop] });
const use = usesOf(given[1].work).find((u) => u.id === "marquee");
check("1. The hand-over gives the row the Marquee feature at the page's pace, left, with the row's gap, never pausing", !!use && use.inputs.speed === "114" && use.inputs.direction === "left" && use.inputs.gap === "48" && use.inputs.pause === "no", JSON.stringify(given[1].work));
check("…and nothing to the strip round it", !usesOf(given[0].work).some((u) => u.id === "marquee"), JSON.stringify(given[0].work));

/* 2. */
const parts = [
  part("n_hero", 0, 0, 1440, 900, { ...captured("body > main > section:nth-of-type(1)"), colour: { bg: "rgb(7, 25, 47)" } }),
  strip,
  { ...row, work: { id: "marquee", inputs: { speed: "114", direction: "left", pause: "no", gap: "48" } } },
  part("n_after", 120, 1100, 1200, 800, { ...captured("body > main > section:nth-of-type(2)"), colour: { bg: "rgb(240, 240, 240)" } }),
];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, boardWith(parts));
  await openPreview(ui, URL_BASE);
  const seen = await ui.evaluate(async () => {
    const el = document.querySelector('[data-live-node="n_run"]');
    const track = el?.querySelector("[data-marquee-track]");
    if (!el || !track) return { found: false, el: !!el };
    const at = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
    const a = at();
    await new Promise((r) => setTimeout(r, 600));
    const b = at();
    const r = el.getBoundingClientRect();
    return { found: true, moved: +(a - b).toFixed(1), copies: track.children.length, words: (track.firstChild?.textContent ?? "").trim().slice(0, 40), box: [Math.round(r.left), Math.round(r.width), Math.round(r.height)], overflow: getComputedStyle(track.parentElement).overflow };
  });
  check("2. The Preview runs the row on a marquee track", seen.found === true, JSON.stringify(seen));
  check("…which moves left at about the page's pace (114px/s: 50 to 90px in 600ms)", seen.moved >= 50 && seen.moved <= 90, JSON.stringify(seen));
  check("…its words copied enough times to fill the strip, one copy of them each", seen.copies >= 2 && /120 UNDERWATER/.test(seen.words), JSON.stringify(seen));
  check("…inside the strip's own width, clipped there", seen.box?.[0] === 0 && seen.box[1] === 1440 && seen.overflow === "hidden", JSON.stringify(seen));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
