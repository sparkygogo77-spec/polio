#!/usr/bin/env node
/**
 * A STICKY BAND'S OWN PARTS STICK WITH IT.
 *
 * sunkcoin.fun (J, 2026-10-11): "its missing the header". The header is
 * `position: sticky; top: 0` with its logo, nav, ticker and button inside
 * it. In the Preview the band itself stuck (`fluidStyle`), but the parts
 * it owns were left as flow parts at their measured place, so once scrolled
 * the band was an empty bar and its words were 2000px up the page. Now, in
 * the Preview (`exportSite.ts`, live), each part a sticky band owns is made
 * sticky at its own offset inside the band, as the published page nests
 * them, so the header keeps its contents at every scroll.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/sticky-band-parts.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/send-out/exportSite.ts, src/features/studio/fluidSite.ts, src/features/studio/live/previewWindow.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, openPreview, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const parts = [
  part("n_header", 0, 0, 1440, 60, { ...captured("body > header", "sticky", { top: 0 }), colour: { bg: "rgb(5, 20, 42)" } }),
  part("n_logo", 64, 21, 80, 18, { featureId: "prose", content: "$SUNK", ...captured("body > header > a > span"), colour: { text: "rgb(245, 217, 10)" }, font: { face: "monospace", size: 1, px: 16, stack: "monospace", weight: 400, leading: 1 } }),
  part("n_button", 1260, 14, 120, 32, { featureId: "prose", content: "Find my wallet", ...captured("body > header > button"), colour: { bg: "rgb(245, 217, 10)", text: "rgb(5, 20, 42)" } }),
  part("n_s1", 120, 100, 1200, 800, { ...captured("body > main > section:nth-of-type(1)"), colour: { bg: "rgb(240, 240, 240)" } }),
  part("n_s2", 120, 1000, 1200, 800, { ...captured("body > main > section:nth-of-type(2)"), colour: { bg: "rgb(240, 240, 240)" } }),
  part("n_s3", 120, 1900, 1200, 1000, { ...captured("body > main > section:nth-of-type(3)"), colour: { bg: "rgb(240, 240, 240)" } }),
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
    const band = document.querySelector('[data-live-node="n_header"]');
    const scroller = band?.closest("[data-live-scroller]");
    if (!band || !scroller) return { found: false };
    const out = [];
    for (const to of [0, 1500, 0]) {
      scroller.scrollTop = to;
      await new Promise((r) => setTimeout(r, 150));
      const s = scroller.getBoundingClientRect(), b = band.getBoundingClientRect();
      const row = { to, at: scroller.scrollTop, bandTop: Math.round(b.top - s.top), parts: {} };
      for (const id of ["n_logo", "n_button"]) {
        const el = document.querySelector(`[data-live-node="${id}"]`);
        const r = el.getBoundingClientRect();
        const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        row.parts[id] = { top: Math.round(r.top - b.top), left: Math.round(r.left - b.left), inside: r.top >= b.top - 1 && r.bottom <= b.bottom + 1, seen: !!mid && el.contains(mid) };
      }
      out.push(row);
    }
    return { found: true, out };
  });
  check("the Preview draws the sticky header", seen.found === true, JSON.stringify(seen));
  check("as the page opens, the header is at the top with its logo 21px down and 64px in, and its button at the right", seen.out?.[0]?.bandTop === 0 && seen.out[0].parts.n_logo.top === 21 && seen.out[0].parts.n_logo.left === 64 && seen.out[0].parts.n_button.left === 1260 && seen.out[0].parts.n_button.top === 14, JSON.stringify(seen.out?.[0]));
  check("scrolled 1500px down, the header is still at the top of the view", seen.out?.[1]?.at >= 1400 && seen.out[1].bandTop === 0, JSON.stringify(seen.out?.[1]));
  check("…and its logo and button are still inside it, where they were, in front", seen.out?.[1] && Object.values(seen.out[1].parts).every((p) => p.inside && p.seen) && seen.out[1].parts.n_logo.top === 21 && seen.out[1].parts.n_logo.left === 64 && seen.out[1].parts.n_button.top === 14, JSON.stringify(seen.out?.[1]));
  check("back at the top, the same", seen.out?.[2]?.bandTop === 0 && seen.out[2].parts.n_logo.top === 21 && seen.out[2].parts.n_button.inside, JSON.stringify(seen.out?.[2]));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
