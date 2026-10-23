#!/usr/bin/env node
/**
 * EVERY HOOK THE TOUR POINTS AT STILL EXISTS.
 *
 * The Look panel's texture row moved (1d680d3f), and the tour kept scrolling
 * to and ringing `[data-look-texture]`, which no component renders any more:
 * the ring had nothing to land on. Each `[data-…]` selector in
 * `src/features/tour/steps.ts` must be written as an attribute by some
 * other source file.
 *
 *   node tests/tour-hooks-exist.mjs
 *
 * Covers: src/features/tour/steps.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const stepsPath = join(root, "features", "tour", "steps.ts");
const steps = readFileSync(stepsPath, "utf8");
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) && p !== stepsPath && files.push(p); } })(root);
const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
const hooks = [...new Set([...steps.matchAll(/\[(data-[a-z0-9-]+)\]/g)].map((m) => m[1]))];
let bad = 0;
for (const h of hooks) {
  const ok = new RegExp(`${h}(=|\\b[^-])`).test(source) || source.includes(`"${h}"`);
  if (!ok) bad++;
  console.log(`${ok ? "  ok  " : " FAIL "} the tour's [${h}] is rendered somewhere`);
}
process.exit(bad ? 1 : 0);
