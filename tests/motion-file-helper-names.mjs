#!/usr/bin/env node
/**
 * THE BUILDER'S MOTION FILE CALLS NONE OF A SITE'S HOOK HELPERS.
 *
 * A builder-ready site finds its parts with small helpers that take a hook
 * name (`show`, `setText`, `fromTemplate`, `$`, `el`, `part`, `drop`: the
 * kit's starter parts use them, and a site's hook map reads every call to
 * them as a hook it uses). The motion file every page loads
 * (`vendor/builder-motion.js`, kit rule 35) named its own inner functions
 * `show` (the loading film, moving frames, the turnable part) and `drop`
 * (the carried tilt). Copied into PonsStars, its hook map read
 * `show(frameAt(want))` as a hook name built in code and its check failed,
 * so the kit copy could not land. The inner functions now have their own
 * names, and nothing in the file calls a helper name.
 *
 *   node tests/motion-file-helper-names.mjs
 *
 * Covers: src/features/studio/shelf/library/behaviourScripts/effects.ts, src/features/studio/shelf/library/behaviourScripts/motion.ts, kit/starter/vendor/builder-motion.js
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* Read as a hook map reads it: the calls in the code, not words in its comments. */
const HELPERS = new Set(["show", "setText", "fromTemplate", "$", "el", "part", "drop"]);
const calls = (text) => {
  const sf = ts.createSourceFile("builder-motion.js", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const walk = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && HELPERS.has(n.expression.text)) out.push(`${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${n.getText(sf).slice(0, 40)}`);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
};

/* 1. The kit's copy, as every site gets it. */
const file = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
const inFile = calls(file);
check("the kit's motion file calls no hook helper (show, setText, fromTemplate, $, el, part, drop)", inFile.length === 0, inFile.slice(0, 4).join(" | "));

/* 2. The file as the builder makes it now: the kit's copy is not stale. */
const { kitMotionJs } = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));
const made = kitMotionJs();
check("…and the file the builder writes today calls none either", calls(made).length === 0, calls(made).slice(0, 4).join(" | "));
check("…and the kit's copy is that file (npm run kit:motion was run)", made.trim() === file.trim());

/* 3. The parts the renamed functions belong to still run their own steps. */
check("the loading film, moving frames and the turnable part keep their steps", /function showFilm\(src\)/.test(made) && /showFrame\(frameAt\(want\)\)/.test(made) && /function paint\(\)/.test(made));
check("…and the carried tilt keeps its own", /function settleDown\(\)/.test(made) && /settleDown\(\); \}\);/.test(made));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
