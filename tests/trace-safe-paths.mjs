#!/usr/bin/env node
/**
 * NO FILE A FUNCTION TRACES RESOLVES A PATH THE BUNDLER CANNOT SEE (2026-11-08).
 *
 * Turbopack (what `next build` and Vercel run) reads every `path.resolve`,
 * `path.join` and `fs` call in a server module, and when the argument is
 * something it cannot know at build time, such as `process.argv`, it traces
 * the WHOLE PROJECT into that function: capture fixtures, public pictures,
 * every source file. One such line, the command-line guard at the foot of
 * `kit/tools/kit-check.mjs`, made `api/studio/kit-map` 37 MB (the limit is
 * 8) and the deployment 540 MB (the limit is 500), and held PR 439. Webpack
 * builds did not show it, which is why it went unnoticed.
 *
 * Held here, without a build: no `.mjs` or `.ts` under `kit/tools/`, `src/`
 * or `helper/` that a route could import resolves or joins `process.argv`,
 * and the command-line guards of the kit's tools (the one file of theirs a
 * route imports, and the six beside it that an export copies into every
 * site) use `pathToFileURL`, which a bundler leaves alone. The sizes
 * themselves are `tests/function-sizes.mjs`, after `npm run build`.
 *
 *   node tests/trace-safe-paths.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`); };
const files = [];
(function walk(d) {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, f.name);
    if (f.isDirectory()) { if (!/^(node_modules|\.next|\.git|test|tests|fixtures|starter)$/.test(f.name)) walk(p); }
    else if (/\.(mjs|ts|tsx)$/.test(f.name) && !/\.d\.ts$/.test(f.name)) files.push(p);
  }
})(join(root, "kit", "tools"));
for (const d of ["src", "helper"]) (function walk(dd) {
  for (const f of readdirSync(dd, { withFileTypes: true })) {
    const p = join(dd, f.name);
    if (f.isDirectory()) { if (!/^(node_modules|\.next)$/.test(f.name)) walk(p); }
    else if (/\.(mjs|ts|tsx)$/.test(f.name) && !/\.d\.ts$/.test(f.name)) files.push(p);
  }
})(join(root, d));
const rel = (p) => relative(root, p).split("\\").join("/");

/* A path function fed the command line, in any form the bundler cannot follow. */
const DYNAMIC = /\b(?:path\.)?(?:resolve|join|normalize)\(\s*(?:\/\*[^*]*\*\/\s*)?process\.argv\b/;
const dynamic = files.filter((p) => DYNAMIC.test(readFileSync(p, "utf8")));
check("no server-side file resolves or joins process.argv", dynamic.length === 0, dynamic.map(rel).join(", "));

/* The kit tools' command-line guards: `import.meta.url === pathToFileURL(process.argv[1] ?? '').href`. */
const tools = readdirSync(join(root, "kit", "tools")).filter((f) => f.endsWith(".mjs"));
const guarded = tools.filter((f) => /import\.meta\.url === /.test(readFileSync(join(root, "kit", "tools", f), "utf8")));
const wrong = guarded.filter((f) => !/import\.meta\.url === pathToFileURL\(process\.argv\[1\] \?\? ''\)\.href/.test(readFileSync(join(root, "kit", "tools", f), "utf8")));
check(`every kit tool's command-line guard uses pathToFileURL (${guarded.length} tools)`, guarded.length > 0 && wrong.length === 0, wrong.join(", "));

/* The embedded copy an export writes into a site (`npm run kit:files`) says the same. */
const embedded = readFileSync(join(root, "src", "features", "studio", "kitFiles.ts"), "utf8");
check("the kit's embedded copy (kitFiles.ts) carries the same guards", !/resolve\(process\.argv\[1\]/.test(embedded) && /pathToFileURL\(process\.argv\[1\]/.test(embedded));

/* The browser routes' trace leaves out playwright's web pages and type declarations (next.config.ts). */
const config = readFileSync(join(root, "next.config.ts"), "utf8");
check("next.config.ts excludes playwright-core/lib/vite and /types from the browser routes", /playwright-core\/lib\/vite\/\*\*/.test(config) && /playwright-core\/types\/\*\*/.test(config));

/*
 * The include names playwright-core folder by folder (Turbopack's glob has no
 * negation, and a bare `*` on a folder takes it whole), so the installed
 * package is checked against the list: every folder is carried or named as
 * left out, and every file beside the folders has a dot for `*.*` to catch,
 * except the three nothing loads.
 */
const PW = join(root, "node_modules", "playwright-core");
const LEFT_OUT = new Set(["types", "lib/vite"]);
const DOTLESS_OK = new Set(["LICENSE", "NOTICE", "lib/xdg-open"]);
const carried = new Set([...config.matchAll(/"((?:lib\/)?[a-z]+)\/\*\*"/g)].map((m) => m[1]));
const entries = (d) => { try { return readdirSync(join(PW, d), { withFileTypes: true }); } catch { return null; } };
const top = entries("");
if (!top) check("playwright-core is installed", false, "no node_modules/playwright-core");
else {
  const folders = [...top.filter((e) => e.isDirectory()).map((e) => e.name), ...(entries("lib") ?? []).filter((e) => e.isDirectory()).map((e) => `lib/${e.name}`)];
  const unnamed = folders.filter((f) => f !== "lib" && !carried.has(f) && !LEFT_OUT.has(f));
  check(`every folder of playwright-core is carried by the include or named as left out (${folders.length} folders)`, unnamed.length === 0, unnamed.join(", "));
  const files = [...top.filter((e) => e.isFile()).map((e) => e.name), ...(entries("lib") ?? []).filter((e) => e.isFile()).map((e) => `lib/${e.name}`)];
  const missed = files.filter((f) => !/\.[^/]+$/.test(f.split("/").pop()) && !DOTLESS_OK.has(f));
  check("every file beside those folders has an extension for *.* to carry, or is one nothing loads", missed.length === 0, missed.join(", "));
  const leftIn = [...LEFT_OUT].filter((f) => carried.has(f));
  check("neither left-out folder is also included", leftIn.length === 0, leftIn.join(", "));
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
