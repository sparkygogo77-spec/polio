/**
 * PUBLISH TO A SITE WHOSE SCENES AND SAMPLES SIT OUTSIDE ITS PAGES' FOLDER.
 *
 * PonsStars keeps its pages, hooks, tokens and style layer in web/, and the
 * scene file and samples file builder.json names in kit/ (kit/scenes.json,
 * kit/samples.json). Before a design is sent, the Builder fetches the files
 * the kit's check reads (`kitRun.ts kitFiles`) and runs the check on them
 * (`kitMap.ts`); it used to fetch only the pages' folders, so the check said
 * "builder.json: kit/scenes.json does not exist" and every Publish to
 * PonsStars was refused with nothing written.
 *
 * Here the repository is kit/ as a git repository of its own, with the
 * scenes and samples moved to data/ (beside an unrelated README the check
 * does not need), and GitHub is a stand-in over it. No server, no browser.
 *
 *   1. kitFiles fetches data/scenes.json and data/samples.json, and nothing
 *      else from data/;
 *   2. the real kit check on those files finds nothing missing;
 *   3. preparing the design (`prepareLayer`, real check) is not refused;
 *   4. a parts file named outside the pages brings its own folder, where
 *      its css and js are named from.
 *
 *   node tests/kit-files-outside.mjs
 *
 * Covers: src/features/studio/kitRun.ts, src/features/studio/kitMap.ts, src/features/studio/styleLayerRun.ts
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kitFiles, readKit } from "../src/features/studio/kitRun.ts";
import { kitMap } from "../src/features/studio/kitMap.ts";
import { prepareLayer } from "../src/features/studio/styleLayerRun.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The repository: kit/, with its scenes and samples moved out of starter/, as PonsStars keeps them in kit/. */
const REPO_DIR = mkdtempSync(join(tmpdir(), "kit-outside-"));
cpSync("kit", REPO_DIR, { recursive: true });
mkdirSync(join(REPO_DIR, "data"));
renameSync(join(REPO_DIR, "starter/scenes.json"), join(REPO_DIR, "data/scenes.json"));
renameSync(join(REPO_DIR, "starter/samples.json"), join(REPO_DIR, "data/samples.json"));
writeFileSync(join(REPO_DIR, "data/README.md"), "Not named in builder.json.\n");
mkdirSync(join(REPO_DIR, "shelf/parts"), { recursive: true });
writeFileSync(join(REPO_DIR, "shelf/parts.json"), "{}\n");
writeFileSync(join(REPO_DIR, "shelf/parts/x.css"), "/* a part */\n");
const manifestFile = join(REPO_DIR, "builder.json");
const written = JSON.parse(readFileSync(manifestFile, "utf8"));
writeFileSync(manifestFile, `${JSON.stringify({ ...written, scenes: "data/scenes.json", samples: "data/samples.json" }, null, 2)}\n`);
const git = (...args) => execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
git("init", "-q", "-b", "main");
git("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "scenes and samples outside the pages");
const at = (ref, path) => { try { return execFileSync("git", ["show", `${ref}:${path}`], { cwd: REPO_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }); } catch { return null; } };

/* GitHub, stood in over that repository (reads only). */
const stand = async (url) => {
  const u = new URL(url);
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (!u.pathname.startsWith("/repos/j/site")) return j({ message: "Not Found" }, 404);
  const p = u.pathname.replace("/repos/j/site", "");
  if (p === "") return j({ default_branch: "main" });
  if (p.startsWith("/contents/")) { const t = at(u.searchParams.get("ref") ?? "main", decodeURIComponent(p.slice(10))); return t === null ? j({ message: "Not Found" }, 404) : j({ content: Buffer.from(t).toString("base64") }); }
  if (p.startsWith("/git/trees/")) {
    const ref = decodeURIComponent(p.slice(11));
    return j({ tree: git("ls-tree", "-r", ref).split("\n").filter(Boolean).map((l) => { const [meta, path] = l.split("\t"); const [, type, sha] = meta.split(" "); return { path, type, sha }; }) });
  }
  if (p.startsWith("/git/blobs/")) return j({ content: execFileSync("git", ["cat-file", "blob", p.slice(11)], { cwd: REPO_DIR }).toString("base64") });
  return j({ message: "no" }, 404);
};

/* 1. The files the check needs, wherever builder.json names them. */
const kit = await readKit("j/site", "main", "tok", { fetch: stand });
check("builder.json is read, naming scenes and samples in data/", kit?.ok === true && kit.manifest.scenes === "data/scenes.json" && kit.manifest.samples === "data/samples.json");
const got = await kitFiles("j/site", "main", "tok", kit.manifest, { fetch: stand });
const paths = got.ok ? Object.keys(got.files) : [];
check("kitFiles fetches data/scenes.json and data/samples.json", got.ok && paths.includes("data/scenes.json") && paths.includes("data/samples.json"), got.ok ? "" : got.says);
check("and nothing else outside the pages' folder", got.ok && !paths.includes("data/README.md") && !paths.some((p) => p.startsWith("shelf/") || p.startsWith("tools/")), JSON.stringify(paths.filter((p) => !p.startsWith("starter/"))));

/* 2. The real check on them: nothing missing. */
const map = got.ok ? kitMap(got.files) : { problems: ["no files"] };
const missing = map.problems.filter((p) => /does not exist/.test(p));
check("the kit's check finds no file missing", missing.length === 0, missing.join("; "));
check("the kit's check passes on the files as fetched", map.problems.length === 0, map.problems.slice(0, 3).join("; "));

/* 3. Preparing a design, with the real check: not refused. */
const source = { repo: "j/site", ref: "main", dir: "starter/", files: [], seen: kit.seen, kit: kit.manifest };
const prepared = await prepareLayer([], null, source, "tok", { fetch: stand, when: "2026-10-11", kitMap: async (files) => kitMap(files) });
check("preparing a design is not refused", prepared.ok === true, prepared.ok ? "" : prepared.says);

/* 4. A parts file outside the pages brings its folder: the check reads its css and js from there. */
const withParts = await kitFiles("j/site", "main", "tok", { ...kit.manifest, parts: "shelf/parts.json" }, { fetch: stand });
check("a parts file named in shelf/ brings shelf/'s files", withParts.ok && "shelf/parts.json" in withParts.files && "shelf/parts/x.css" in withParts.files, withParts.ok ? "" : withParts.says);

rmSync(REPO_DIR, { recursive: true, force: true });
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
