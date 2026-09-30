/**
 * No part makes a see-through colour by gluing hex digits onto a colour.
 *
 * `${t.accent}22` is a colour only when t.accent is six hex digits. The
 * palette is written as oklch(), a captured one as rgb(), a person can type a
 * name or a var(): glued onto any of those it is not a colour, the browser
 * drops the whole declaration, and the wash, border or background it was in
 * disappears without a word. There were 84 of them. Every tint goes through
 * `tint(colour, alpha)` in `parts/tint.ts` now (color-mix with transparent).
 *
 *   1. no source file builds a colour by gluing two hex digits onto a value,
 *      in a template (`${x}22`) or by adding a string (`x + "22"`);
 *   2. in a real browser, tint() is a colour for every way a colour is
 *      written, and the glued form is not (so the check guards a real fault).
 *
 *   node tests/tint-glue.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { tint } from "../src/features/studio/parts/tint.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ 1 */
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
};
walk("src");
/* Comments say what went wrong and may quote it; only code is held to it. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const GLUED = [
  /\$\{[^{}]+\}[0-9a-fA-F]{2}(?![0-9A-Za-z])/g,          // `${colour}22`
  /\+\s*(["'`])[0-9a-fA-F]{2}(?=[\s,;)"'`]|\1)/g,         // colour + "22"
];
const found = [];
for (const f of files) {
  const lines = code(readFileSync(f, "utf8")).split("\n");
  lines.forEach((line, i) => {
    for (const re of GLUED) for (const m of line.matchAll(re)) found.push(`${f}:${i + 1} ${m[0]}`);
  });
}
check("1. no source file glues hex digits onto a colour", found.length === 0, found.slice(0, 8).join(" | ") || `${files.length} files read`);
const parts = readdirSync("src/features/studio/parts").filter((n) => n.endsWith(".tsx")).map((n) => readFileSync(join("src/features/studio/parts", n), "utf8"));
const users = parts.filter((s) => /\btint\(/.test(s)).length;
check("1. the parts make their tints with tint()", users >= 14, `${users} part files use it`);

/* ------------------------------------------------------------ 2 */
const WRITTEN = ["oklch(0.55 0.17 265)", "#3a7bd5", "rgb(58, 123, 213)", "rgba(58, 123, 213, 0.9)", "tomato", "var(--accent)", "hsl(210 60% 50%)"];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
await page.setContent("<style>:root{--accent:#3a7bd5}</style><div id=d></div>");
const read = await page.evaluate(({ tinted, glued }) => {
  const d = document.getElementById("d");
  const paints = (v) => { d.style.background = ""; d.style.background = v; return d.style.background !== "" && getComputedStyle(d).backgroundColor !== "rgba(0, 0, 0, 0)"; };
  return { tinted: tinted.map(paints), glued: glued.map(paints) };
}, { tinted: WRITTEN.map((c) => tint(c, 0.13)), glued: WRITTEN.map((c) => `${c}22`) });
check("2. tint() paints for every way a colour is written", read.tinted.every(Boolean), WRITTEN.map((c, i) => `${c}: ${read.tinted[i] ? "paints" : "DROPPED"}`).join(", "));
const dropped = WRITTEN.filter((_, i) => !read.glued[i]);
check("2. and the glued form paints nothing for all but six-digit hex (the fault this guards)", dropped.length === WRITTEN.length - 1 && read.glued[1] === true, `dropped: ${dropped.join(", ")}`);
check("2. a full-strength tint is the colour itself", tint("#3a7bd5", 1) === "#3a7bd5");
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
