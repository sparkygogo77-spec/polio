#!/usr/bin/env node
/**
 * EXPORT FOR CODE SHIPS THE BUILDER'S MOTION FILE.
 *
 * A site made with Export for code is a builder-ready repo, so a motion J
 * later puts on a part (tilt, marquee, a 3D shape) is published only as
 * `--builder-motion` on its hook, and the kit's motion file
 * (`site/vendor/builder-motion.js`, BUILDER-RULES.md rule 35) is what runs
 * it. So the export carries that file, every page loads it, its source goes
 * along under `starter/vendor/` for the repo's own check, and the check and
 * rules it ships are kit/'s current ones:
 *
 *   · the embedded kit files and the kit's motion file are current
 *     (`kit:files --check`, `kit:motion --check`);
 *   · toKit writes site/vendor/builder-motion.js and
 *     starter/vendor/builder-motion.js, both the kit's file, and every
 *     page loads it, at its own depth;
 *   · the exported repo's own `npm run kit:check` passes, run from its
 *     folder with hooks.json made as the server makes it (`kitMap.ts`);
 *   · a page that stops loading the file, or a stale copy of it, fails
 *     that check.
 *
 * No server, no browser:
 *
 *   node tests/kit-export-motion.mjs
 *
 * Covers: src/features/studio/kitExport.ts, src/features/studio/kitFiles.ts, scripts/kit-files.mjs, scripts/kit-motion.mjs, kit/tools/kit-check.mjs
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const X = await jiti.import(join(root, "src", "features", "studio", "kitExport.ts"));
const M = await jiti.import(join(root, "src", "features", "studio", "kitMap.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const run = (args, cwd = root) => { try { return { ok: true, out: execFileSync("node", args, { cwd, encoding: "utf8" }) }; } catch (e) { return { ok: false, out: String(e.stdout ?? "") + String(e.stderr ?? e.message) }; } };

const files = run(["scripts/kit-files.mjs", "--check"]);
check("the kit files the export writes match kit/", files.ok, files.out.trim());
const motion = run(["scripts/kit-motion.mjs", "--check"]);
check("kit/starter/vendor/builder-motion.js is current", motion.ok, motion.out.trim());

const want = readFileSync(join(root, "kit", "starter", "vendor", "builder-motion.js"), "utf8");
const page = (h1) => `<!doctype html><html><head><title>t</title><link rel="stylesheet" href="${h1 === "Home" ? "" : "../"}assets/site.css"></head><body><main><h1>${h1}</h1><p>Hi there</p></main></body></html>`;
const raw = X.toKit({
  name: "Tiny",
  pages: [{ file: "index.html", title: "Home" }, { file: "about/index.html", title: "About" }],
  files: [
    { path: "index.html", content: page("Home") },
    { path: "about/index.html", content: page("About") },
    { path: "assets/site.css", content: "body{color:#111;background:#fff}" },
  ],
});
const at = (p) => raw.files.find((f) => f.path === p);
check("the export carries site/vendor/builder-motion.js, the kit's file", at("site/vendor/builder-motion.js")?.content === want);
check("and its source under starter/vendor/, where the repo's own check looks", at("starter/vendor/builder-motion.js")?.content === want);
check("each written once", raw.files.filter((f) => /builder-motion\.js$/.test(f.path)).length === 2);
check("the home page loads it", at("site/index.html")?.content.includes('<script src="vendor/builder-motion.js" defer></script>'));
check("a page one folder down loads it from there", at("site/about/index.html")?.content.includes('<script src="../vendor/builder-motion.js" defer></script>'));
check("the shipped check knows rule 35", at("tools/kit-check.mjs")?.content.includes("builder-motion.js"));
check("the shipped rules carry rule 35", /The builder's motion file/.test(at("BUILDER-RULES.md")?.content ?? ""));

/* As the server finishes it: hooks.json made by the kit's own check. */
const kit = await X.finishKit(raw, async (text) => M.kitMap(text));
check("the server's check passes on it", kit.problems.length === 0, kit.problems.slice(0, 3).join("; "));

const dir = mkdtempSync(join(tmpdir(), "kit-export-motion-"));
try {
  for (const f of kit.files) { const p = join(dir, f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.content, f.encoding === "base64" ? "base64" : "utf8"); }
  const own = run(["tools/kit-check.mjs", "builder.json"], dir);
  check("the exported repo's own kit:check passes", own.ok, own.ok ? "" : own.out.trim().split("\n").slice(-4).join(" | "));

  const home = join(dir, "site", "index.html");
  const was = readFileSync(home, "utf8");
  writeFileSync(home, was.replace('<script src="vendor/builder-motion.js" defer></script>', ""));
  const gone = run(["tools/kit-check.mjs", "builder.json"], dir);
  check("a page that stops loading it fails the check", !gone.ok && gone.out.includes("does not load vendor/builder-motion.js"), gone.out.trim().split("\n").slice(-2).join(" | "));
  writeFileSync(home, was);

  mkdirSync(join(dir, "site", "vendor"), { recursive: true });
  writeFileSync(join(dir, "site", "vendor", "builder-motion.js"), "// edited\n");
  const stale = run(["tools/kit-check.mjs", "builder.json"], dir);
  check("a changed copy of it fails the check as stale", !stale.ok && /motion file is stale/.test(stale.out), stale.out.trim().split("\n").slice(-2).join(" | "));
  run(["tools/kit-check.mjs", "builder.json", "--write"], dir);
  check("and kit:hooks puts the kit's file back", readFileSync(join(dir, "site", "vendor", "builder-motion.js"), "utf8") === want);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
