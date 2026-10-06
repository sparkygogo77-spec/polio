#!/usr/bin/env node
/**
 * The kit's files the Builder's "Export for code" writes into every export
 * (`src/features/studio/kitExport.ts`), embedded as text so the browser has
 * them. kit/ is the source of the kit and its rules (kit/FROM.md); sites
 * take their copy from it with npm run kit:copy. Run this after changing it:
 *
 *   npm run kit:files            # rewrite src/features/studio/kitFiles.ts
 *   npm run kit:files -- --check # fail when it is stale (tests/export-for-code.mjs runs this)
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "BUILDER-CONTRACT.md",
  "BUILDER-RULES.md",
  "PIPELINE.md",
  "AGENTS.md",
  "CLAUDE.md",
  "RETROFIT.md",
  "tools/kit-check.mjs",
  "tools/kit-diff.mjs",
  ".github/workflows/kit-check.yml",
  "starter/js/hooks.js",
  "starter/js/preview.js",
  "starter/scenes.json",
  "starter/samples.json",
];
const OUT = "src/features/studio/kitFiles.ts";
const manifest = JSON.parse(readFileSync("kit/builder.json", "utf8"));
const version = manifest.kit;
const body = [
  "/* Made by scripts/kit-files.mjs from kit/ (npm run kit:files). Do not edit by hand. */",
  "/* The builder kit's files, as text, for Export for code (kitExport.ts). */",
  `export const KIT_VERSION = ${JSON.stringify(version)};`,
  "/* The design and build rules every code chat follows (BUILDER-RULES.md), as builder.json carries them. */",
  `export const KIT_RULES = ${JSON.stringify(manifest.rules)} as const;`,
  "export const KIT_FILES: Record<string, string> = {",
  ...FILES.map((f) => `  ${JSON.stringify(f)}: ${JSON.stringify(readFileSync(`kit/${f}`, "utf8"))},`),
  "};",
  "",
].join("\n");
if (process.argv.includes("--check")) {
  let now = "";
  try { now = readFileSync(OUT, "utf8"); } catch { /* none yet */ }
  if (now !== body) { console.log(`${OUT} is stale: run npm run kit:files`); process.exit(1); }
  console.log(`${OUT} matches kit/`);
} else {
  writeFileSync(OUT, body);
  console.log(`wrote ${OUT} (${FILES.length} files, kit ${version})`);
}
