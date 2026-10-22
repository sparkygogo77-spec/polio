#!/usr/bin/env node
/**
 * EVERY SLIDER THAT WRITES THE BOARD IS UNDER THE HAND-ON-SLIDER RULE.
 *
 * J (2026-10-10, polio/next-issues.md item 7): the wheel's plates, the Look
 * hue strip and Theme's Familiar to Original were plain `<input type="range">`,
 * so a drag took one undo step and one save per tick, lagged on PonsStars and
 * Undo walked back tick by tick. `HandSlider.tsx#HandRange` is the plain range
 * under the rule: preview once a frame, one gesture from the first move to the
 * release (pointer up, key up, blur or the input's own `change`).
 *
 *   node tests/hand-range.mjs
 *
 * Covers: src/features/studio/HandSlider.tsx, src/features/studio/PlateEditors.tsx, src/features/studio/PartFields.tsx, src/features/studio/look/LookPanel.tsx, src/features/studio/ThemePanel.tsx
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const studio = join(here, "..", "src", "features", "studio");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const hand = readFileSync(join(studio, "HandSlider.tsx"), "utf8");
check("HandRange previews each move once a frame", /export function HandRange/.test(hand) && /onInput=\{[^}]*gestureFrame\(\(\) => onChange\(v\)\)/s.test(hand));
check("…and ends the gesture on release: pointer up, key up, blur and the input's own change", /addEventListener\("pointerup", up, true\)/.test(hand) && /onKeyUp=/.test(hand) && /onBlur=\{\(e\) => \{ settle\.current\(\)/.test(hand) && /el\.addEventListener\("change", done\)/.test(hand));
check("…and the thumb follows the hand while the panel stands still", /value=\{held \?\? value\}/.test(hand));

/* The four J named, by what they are for. */
for (const [file, what, marker] of [
  ["PlateEditors.tsx", "the wheel's plates", /<HandRange[^>]*aria-label=\{opt\.label\}/s],
  ["PartFields.tsx", "a part's range options", /<HandRange[^>]*min=\{f\.range\.min\}/s],
  ["look/LookPanel.tsx", "the Look hue strip", /<HandRange[^>]*aria-label="Hue"/s],
  ["ThemePanel.tsx", "Theme's Familiar to Original", /<HandRange[^>]*data-theme-originality=""/s],
]) {
  const s = readFileSync(join(studio, file), "utf8");
  check(`${what} is a HandRange`, marker.test(s) && /import \{[^}]*HandRange[^}]*\} from "\.{1,2}\/HandSlider"/.test(s));
}
check("a range option's pick sound is not played every frame of a drag", /if \(!inGesture\(\)\) play\("select"\)/.test(readFileSync(join(studio, "PartFields.tsx"), "utf8")));

/* No slider that writes the board is a plain range any more: the ones left keep local state (a picture's tolerance, the import scrubber, a shelf part's own control on the page). */
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) ? [p] : []; });
const plain = walk(studio).filter((p) => /type="range"/.test(readFileSync(p, "utf8")) && !/HandSlider\.tsx$/.test(p)).map((p) => p.slice(studio.length + 1).replaceAll("\\", "/"));
const allowed = new Set(["ClearBackground.tsx", "ImportFlow.tsx", "shelf/parts/Interact.tsx"]);
check("the only plain ranges left keep local state, not the board", plain.every((p) => allowed.has(p)), plain.join(", "));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} ok`);
process.exit(failed ? 1 : 0);
