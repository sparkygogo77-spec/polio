#!/usr/bin/env node
/**
 * THE KIT, FROM HERE INTO A SITE'S REPOSITORY (J, 2026-10-06).
 *
 * Polio's kit/ is the single source of the builder kit: BUILDER-RULES.md
 * (the state rules among them), the contract, kit:check and its starter
 * files. A site keeps a copy in its own kit/ folder (PonsStars: PST kit/),
 * made by this script, so the two never drift:
 *
 *   npm run kit:copy -- ../PST/kit           # write the copy
 *   npm run kit:copy -- ../PST/kit --check   # fail when the copy differs
 *
 * Only the kit's own files are written (FROM.md and anything the site keeps
 * in its kit/ beside them, such as PonsStars' scenes.json, are left alone);
 * a file the source no longer has is listed, not deleted.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const SRC = "kit";
const SKIP = new Set(["FROM.md", "node_modules"]);
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const check = args.includes("--check");
if (!target) { console.log("usage: npm run kit:copy -- <site>/kit [--check]"); process.exit(2); }

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const at = join(dir, name);
    if (statSync(at).isDirectory()) walk(at);
    else files.push(relative(SRC, at));
  }
};
walk(SRC);
files.sort();

const differs = [];
for (const f of files) {
  const from = readFileSync(join(SRC, f), "utf8");
  const to = join(target, f);
  const now = existsSync(to) ? readFileSync(to, "utf8") : null;
  if (now === from) continue;
  differs.push(f);
  if (!check) { mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, from); }
}
if (check) {
  if (differs.length) { console.log(`${target} differs from polio's kit in ${differs.length} file(s):\n${differs.map((f) => `  ${f}`).join("\n")}\nrun npm run kit:copy -- ${target}`); process.exit(1); }
  console.log(`${target} matches polio's kit (${files.length} files)`);
} else console.log(`copied polio's kit into ${target}: ${differs.length} of ${files.length} files changed`);
