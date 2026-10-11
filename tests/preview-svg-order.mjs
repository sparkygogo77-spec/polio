#!/usr/bin/env node
/**
 * A DRAWING'S OWN SHAPES PAINT WHERE THE PAGE PAINTED THEM.
 *
 * J (2026-10-11), PonsStars' redesign in the Preview: "the nav-rail dial
 * still renders as a plain yellow disc and the clock as an empty circle with
 * a dot; ticks, curved labels, pointer and hands are missing". The inline
 * svg was kept (`node.svg.markup`), but the importer makes each hooked plain
 * shape in it (the dial's face) a part of its own, hidden in the markup, and
 * that part was drawn after the drawing, over its ticks. Now a shape the
 * page painted before everything else in the svg is drawn before the
 * drawing's part (`live/svgUnder.ts`); one painted after (a hub over the
 * hands) stays after it.
 *
 * A seeded dial: the svg (a hidden hooked face, dashed ticks, a hand, a
 * hidden hooked hub), its face part (yellow), its hub part. Through the
 * board's own Preview switch:
 *   · the drawing is drawn, ticks dashed;
 *   · the face part comes before the drawing, the hub part after it;
 *   · at a tick, the topmost thing painted is the drawing, not the face.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/preview-svg-order.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/svgUnder.ts, src/features/studio/live/LiveSite.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const SVG = "body > div > svg";
const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">`
  + `<circle data-hook="dial-face" cx="60" cy="60" r="50" visibility="hidden"/>`
  + `<circle data-hook="dial-ticks" cx="60" cy="60" r="36" pathLength="100" style="fill:none;stroke:rgb(43, 29, 18);stroke-width:4px;stroke-dasharray:0.6px, 3.5666px"/>`
  + `<path data-hook="dial-hand" d="M60 60 L60 30" style="stroke:rgb(43, 29, 18);stroke-width:3px"/>`
  + `<circle data-hook="dial-hub" cx="60" cy="60" r="6" visibility="hidden"/></svg>`;
const parts = [
  part("n_page", 0, 0, 1440, 900, { ...captured("body > div"), colour: { bg: "rgb(240, 236, 220)" } }),
  part("n_dial", 100, 100, 120, 120, { ...captured(SVG), svg: { markup } }),
  part("n_face", 110, 110, 100, 100, { ...captured(`${SVG} > circle:nth-of-type(1)`), shape: "circle", colour: { bg: "rgb(216, 178, 60)" } }),
  part("n_hub", 154, 154, 12, 12, { ...captured(`${SVG} > circle:nth-of-type(3)`), shape: "circle", colour: { bg: "rgb(200, 40, 40)" } }),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, boardWith(parts));
  await ui.click("[data-preview-toggle]");
  for (let i = 0; i < 40; i++) {
    if (await ui.evaluate(() => !!document.querySelector('[data-studio-pane] [data-live-scroller] [data-live-node="n_dial"]'))) break;
    await ui.waitForTimeout(250);
  }
  await ui.waitForTimeout(800);
  const seen = await ui.evaluate(() => {
    const at = (id) => document.querySelector(`[data-studio-pane] [data-live-scroller] [data-live-node="${id}"]`);
    const dial = at("n_dial"), face = at("n_face"), hub = at("n_hub");
    if (!dial || !face || !hub) return { found: false };
    const ticks = dial.querySelector('[data-svg-art] circle[data-hook="dial-ticks"]');
    const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    /* The topmost painted thing at a tick: the svg is not pressable (its art takes no presses), so ask with presses let through it. */
    const art = dial.querySelector("[data-svg-art]");
    art.style.pointerEvents = "auto";
    for (const e of art.querySelectorAll("*")) e.style.pointerEvents = "visiblePainted";
    const r = ticks.getBoundingClientRect();
    const hits = [];
    for (let a = 0; a < 360; a += 3) {
      const x = r.left + r.width / 2 + Math.cos((a * Math.PI) / 180) * (r.width / 2 - 2), y = r.top + r.height / 2 + Math.sin((a * Math.PI) / 180) * (r.height / 2 - 2);
      const top = document.elementFromPoint(x, y);
      hits.push(top === ticks ? "ticks" : face.contains(top) ? "face" : "other");
    }
    return { found: true, dash: ticks ? getComputedStyle(ticks).strokeDasharray : null, faceFirst: before(face, dial), hubAfter: before(dial, hub), ticksOnTop: hits.filter((h) => h === "ticks").length, faceOnTop: hits.filter((h) => h === "face").length };
  });
  check("the Preview draws the dial's kept svg, its ticks dashed", seen.found === true && !!seen.dash && seen.dash !== "none", JSON.stringify(seen));
  check("the face the page painted first is drawn before the drawing", seen.faceFirst === true, JSON.stringify(seen));
  check("the hub the page painted last is drawn after it", seen.hubAfter === true, JSON.stringify(seen));
  check("round the ring the ticks are on top, never the face", seen.ticksOnTop > 0 && seen.faceOnTop === 0, JSON.stringify({ ticks: seen.ticksOnTop, face: seen.faceOnTop }));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
