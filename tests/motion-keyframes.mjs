#!/usr/bin/env node
/**
 * EVERY MOTION THE BUILDER NAMES IS ONE IT HAS, AND THE PREVIEW DOES WHAT THE CARD SAYS.
 *
 * J (2026-10-09): shelf effects that say "Works when published" must work in
 * the preview too. The shelf audit (/mnt/project-files/polio/shelf-audit.md)
 * found the board's motion scenes and the preview's opening cover and burst
 * all named `mo-*` keyframes that were never defined, so they stood still;
 * the Appear on scroll Style was read nowhere; Page transitions was called
 * "described, not simulated" while the preview ran it; and the small
 * companion preview ran no effects at all. Pure: reads the source.
 *
 *   node tests/motion-keyframes.mjs
 *
 * Covers: src/app/globals.css, src/features/studio/shelf/parts/Motion.tsx, src/features/studio/live/LiveShell.tsx, src/features/studio/live/behaviours.ts, src/features/studio/shelf/library/siteMotion.ts, src/features/studio/Preview.tsx
 */
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const css = read("src/app/globals.css");
const used = new Set();
for (const f of ["src/features/studio/shelf/parts/Motion.tsx", "src/features/studio/live/LiveShell.tsx"]) {
  const src = read(f);
  for (const m of src.matchAll(/(?:loop\("|animation: ?[`"])(mo-[a-z-]+)/g)) used.add(m[1]);
}
const missing = [...used].filter((k) => !new RegExp(`@keyframes ${k}\\b`).test(css));
check("every mo-* animation the motion scenes and the preview use is defined", used.size >= 15 && missing.length === 0, missing.join(", ") || `${used.size} used`);

const live = read("src/features/studio/live/behaviours.ts");
check("Page transitions is not called described-only: the preview runs it", !/DESCRIBE_ONLY = new Set\([^)]*"page-transitions"/.test(live));
check("Appear on scroll carries its Style to the preview", /revealStyle = o\.style/.test(live) && /data-reveal-style=/.test(read("src/features/studio/live/LiveShell.tsx")) && /\[data-reveal-style="blur"\]/.test(css));
check("…and to the published page", /c\.revealStyle/.test(read("src/features/studio/shelf/library/siteMotion.ts")) && /revealStyle: b\.revealStyle/.test(read("src/features/studio/send-out/exportSite.ts")));
check("the small companion preview runs the parts' effects", /<LiveSite features /.test(read("src/features/studio/Preview.tsx")));
check("parallax moves the page element, not the shell that has no box", /root\.parentElement\.style\.backgroundPositionY/.test(read("src/features/studio/live/LiveShell.tsx")));

const bad = results.filter((r) => !r).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
