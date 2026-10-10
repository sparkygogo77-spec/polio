#!/usr/bin/env node
/**
 * THE BUILDER'S MOTION, INTO THE KIT (J, 2026-10-10).
 *
 * Writes kit/starter/vendor/builder-motion.js from the effect scripts the
 * Builder's Preview runs (`send-out/kitMotion.ts`), so a builder-ready site
 * runs any motion the style layer names on any hook, with no code chat.
 * kit:check copies it into a site and makes every page load it.
 *
 *   npm run kit:motion            # write it
 *   npm run kit:motion -- --check # fail when it is stale
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const { kitMotionJs } = await jiti.import(join(root, "src", "features", "studio", "send-out", "kitMotion.ts"));
const out = join(root, "kit", "starter", "vendor", "builder-motion.js");
const js = kitMotionJs();
const now = existsSync(out) ? readFileSync(out, "utf8") : null;
if (process.argv.includes("--check")) {
  if (now !== js) { console.log("kit/starter/vendor/builder-motion.js is stale: run npm run kit:motion"); process.exit(1); }
  console.log("kit/starter/vendor/builder-motion.js is current");
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, js);
  console.log(`wrote kit/starter/vendor/builder-motion.js (${(js.length / 1024).toFixed(1)} KB)`);
}
