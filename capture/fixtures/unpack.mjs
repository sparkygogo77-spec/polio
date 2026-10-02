/**
 * THE CAPTURES THE TESTS READ, LAID OUT AS SINK LAID THEM.
 *
 * The capture tool came over from sink (sink 3538c80, the script-built page
 * fixes included); the sites it had captured did not, because a capture is a
 * site document and site documents are not kept in git. The tests still read
 * them, so frozen copies of what they read are packed beside this file, one
 * pack per capture version, and unpacked into `capture/` (git-ignored) the
 * first time a test needs them. Nothing reads sink any more.
 *
 * Two versions, because the tests were written against two:
 *
 *   sink-3538c80.tar.xz → capture/                       (sink main 75a7bcc's captures)
 *     what the folded capturer makes today: its own checks convert these
 *     byte for byte (`run-checks.mjs`), and fluid-site reads them.
 *   sink-0ee06fa.tar.xz → capture/versions/sink-0ee06fa/  (the older captures)
 *     what every other polio test was written against: test-all hands this
 *     folder to them (`TESTS_ROOT`), and their own defaults name it.
 *     It also holds history/7b7ee04/ (an earlier trumpmorty.fun conversion,
 *     which sink's re-import tests read with `git show`).
 *
 * Each pack holds only what a test or a capture check opens:
 *   site/document.json, site/capture/{routes/, ledger.txt, ccc-capture.json},
 *   assets/  (SOLCINERATOR's pictures and sources)
 *   sites/<every site>/site/document.json and api/
 *   sites/trumpmorty-fun/ whole; sites/share-xyz/{capture, assets}
 *   sites/{gotchi-gg, stonkfun-xyz, trendtrader-pro}/assets/pictures
 *
 *   node capture/fixtures/unpack.mjs          unpack when missing or changed
 *   node capture/fixtures/unpack.mjs --force  unpack again over what is there
 *
 * Exit 0 with the folders ready, 1 when they could not be unpacked (no `tar`
 * with xz on the path).
 */
import { existsSync, readdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
/** The folded copy's root, where sink's root was: the newest captures, which the capturer's own checks read. */
export const CAPTURE_ROOT = join(here, "..");
/** The older captures the polio tests were written against (sink 0ee06fa), laid out the same way. */
export const TESTS_ROOT = join(CAPTURE_ROOT, "versions", "sink-0ee06fa");

/** Every pack beside this file. */
export function packFiles() {
  return readdirSync(here).filter((f) => /^sink-[0-9a-f]+\.tar\.xz$/.test(f)).sort().map((f) => join(here, f));
}

const STAMP = join(CAPTURE_ROOT, ".fixtures");

/** Unpack every pack into capture/ unless the same packs are there already. Returns the root, or null when it could not. */
export function ensureFixtures({ force = false, quiet = false } = {}) {
  const packs = packFiles();
  if (!packs.length) { if (!quiet) console.error("no fixture pack in capture/fixtures"); return null; }
  const names = packs.map((p) => `${p.split(/[\\/]/).pop()} ${statSync(p).size}`).join("\n");
  const have = existsSync(STAMP) ? readFileSync(STAMP, "utf8").trim() : "";
  if (!force && have === names && existsSync(join(CAPTURE_ROOT, "site", "document.json")) && existsSync(join(TESTS_ROOT, "site", "document.json"))) return CAPTURE_ROOT;
  for (const pack of packs) {
    if (!quiet) console.log(`Unpacking ${pack.split(/[\\/]/).pop()} into capture/ …`);
    const r = spawnSync("tar", ["-xJf", pack, "-C", CAPTURE_ROOT], { stdio: quiet ? "ignore" : "inherit" });
    if (r.status !== 0) { if (!quiet) console.error("tar could not unpack the fixtures (it needs xz)"); return null; }
  }
  writeFileSync(STAMP, `${names}\n`);
  return CAPTURE_ROOT;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(ensureFixtures({ force: process.argv.includes("--force") }) ? 0 : 1);
}
