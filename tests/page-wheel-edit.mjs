/**
 * The page's wheel keeps nothing behind a slab it does not draw.
 *
 * The page's wheel stopped drawing Edit some time ago: the width it held
 * was the third copy of one control, and its other item said "soon". The
 * slot, the two choices under it ("Width" and "Per page (soon)", a tap and
 * nothing) and the width editor they opened were all still in the code,
 * 25 lines nobody could reach. Gone now, and held gone here with the
 * comments stripped first, so the sentence explaining the removal is not
 * what this matches.
 *
 *   node tests/page-wheel-edit.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const wheel = bare("src/features/studio/RadialMenu.tsx");
const editors = bare("src/features/studio/BackgroundEditors.tsx");
const slotsBg = wheel.slice(wheel.indexOf("const SLOTS_BG"), wheel.indexOf("};", wheel.indexOf("const SLOTS_BG")));
check("the page's slots hold no Edit", !/\bedit:\s*\{/.test(slotsBg), slotsBg.match(/^\s*(\w+):\s*\{/gm)?.map((s) => s.trim().replace(/:.*$/, "")).join(" "));
check("nothing on the page's wheel says soon", !/pages-soon/.test(wheel) && !/Per page \(soon\)/.test(wheel));
check("and the width editor those choices opened is gone with them", !/which === "width"/.test(editors));
check("the plate list does not name it either", !/"bg-glide", "width"\]/.test(wheel));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
