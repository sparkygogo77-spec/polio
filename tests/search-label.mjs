/**
 * The toolbar's search says what it searches.
 *
 * Its tooltip said "Search the tools, the parts and every command", and it
 * opens the command palette, which lists commands and settings and none of
 * the 229 parts: the parts search is the shelf's own. A promise about parts
 * belongs on a box that finds parts.
 *
 *   node tests/search-label.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Every source file under src/, read once. */
const walk = (dir, out = []) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|css)$/.test(f)) out.push(p); } return out; };
const SRC = walk("src").map((p) => [p, readFileSync(p, "utf8")]);

const studio = ["StudioPage.tsx", ...["sizes.ts", "head.tsx", "toolbar.tsx", "side.tsx", "StudioPage.tsx"].map((f) => `page/${f}`)].map((f) => `src/features/studio/${f}`).map(bare).join("\n");
const palette = bare("src/core/commands/CommandPalette.tsx");
const listsParts = /FEATURES|catalog/.test(palette);
const tip = /<Tooltip content="([^"]*[Ss]earch[^"]*)" shortcut="mod\+k">/.exec(studio)?.[1] ?? "";
check("the search key has a tooltip", !!tip, tip);
check("the palette it opens lists commands and settings", /commands/.test(palette) && /toggles/.test(palette));
check(listsParts ? "and it lists the parts, so the tooltip may say so" : "it does not list the parts, so the tooltip does not say so", listsParts || !/\bparts?\b/.test(tip), tip);
check("and says what it does search", /command/.test(tip) && /setting/.test(tip), tip);
check("the short label agrees", /Search commands…/.test(studio), studio.match(/>Search [^<]*…</)?.[0] ?? "no short label");

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
