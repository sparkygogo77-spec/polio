#!/usr/bin/env node
/**
 * THE FIRST FOUR DESIGN FLAWS, AND THE COLOUR SWATCHES (J, 2026-10-09).
 *
 *   · a part brought in from a site does not call its own data-hook
 *     "not shown" (the board's amber chip read `data-hook “page-title”`
 *     as words the part should draw);
 *   · the row of counts after an import says what each number counts;
 *   · near-black inks are one colour choice, not three.
 *
 *   node tests/design-flaws-fixes.mjs
 *
 * Covers: src/features/studio/promised.ts, src/features/studio/look/siteColours.ts, src/features/studio/bring-in/pageParts.ts, src/features/studio/ColourOverride.tsx, src/features/studio/ComponentFields.tsx, src/features/studio/panels/inspector/Panel.tsx, src/core/toasts/store.ts, src/features/studio/bring-in/fromasite/FromASite.tsx, src/features/studio/bring-in/fromasite/bring.tsx
 */
import { missingDrawnCopy, namesDrawnCopy } from "../src/features/studio/promised.ts";
import { distinctShades } from "../src/features/studio/look/index.ts";
import { reportChips } from "../src/features/studio/bring-in/pageParts.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const prompt = "Read from web/index.html as h1 > span: span, “PonsStars test page”. The box, the words, the colours and the type are the ones the browser drew. Its code finds it as data-hook “page-title-text”.";
check("an imported heading showing its words has nothing missing", missingDrawnCopy(prompt, "PonsStars test page").length === 0, JSON.stringify(missingDrawnCopy(prompt, "PonsStars test page")));
check("its words still count when they are not drawn", missingDrawnCopy(prompt, "").join() === "PonsStars test page");
check("a prompt naming only a data-hook names no copy", namesDrawnCopy("Its code finds it as data-hook “wallet-panel”.") === false);
check("a prompt quoting real copy still does", namesDrawnCopy("A pill reading “CONNECT WALLET”.") === true);

const inks = ["#fbf3e4", "#1c1712", "#221b15", "#6b5a4a", "#b6f25a", "#f0913c"];
const kept = distinctShades(inks, (c) => c);
check("two near-black inks are one swatch", kept.length === 5 && kept.includes("#1c1712") && !kept.includes("#221b15"), kept.join(" "));
check("a shade already shown is not offered again", distinctShades(["#1c1712", "#f0913c"], (c) => c, ["#221b15"]).join() === "#f0913c");
check("different colours all stay", distinctShades(["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000"], (c) => c).length === 5);

const chips = reportChips({ pages: [{ name: "Play", parts: 10 }, { name: "Profile", parts: 4 }], kinds: { text: 8, button: 3, heading: 2 }, hidden: 2, hooks: 9, pictures: 0, truncated: [] });
check("every count says what it counts", chips.length > 0 && chips.every((c) => typeof c.word === "string" && c.word.length > 1), chips.map((c) => `${c.n} ${c.word}`).join(", "));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
