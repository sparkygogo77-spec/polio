/**
 * THE BUILDER'S MOTION FILE GOES OUT WITH A DESIGN WHEN THE SITE'S COPY IS BEHIND.
 *
 * A motion J drops on a part (Scroll depths, Moving frames, Loader film) is
 * written to the style layer as `--builder-motion` and run on the live site
 * by the site's `vendor/builder-motion.js`, which kit-check copies from the
 * kit. A site whose copy predates a motion did nothing with it, and Publish
 * never sent a newer file. Here a repository made from kit/, with its kit
 * kept in kit/ as PonsStars does, and GitHub stood in over it:
 *
 *   1. its motion file up to date: Publish sends no motion file;
 *   2. its motion file, and its kit's copy, behind (no scroll-depths): the
 *      kit's check hands back the fresh file, and Publish sends both
 *      copies fresh, saying why in the pull request;
 *   3. on that branch, `kit:check` and `kit:diff --style-only` pass.
 *
 * No browser and no server:
 *
 *   node tests/kit-motion-file.mjs
 *
 * Covers: src/features/studio/kitMap.ts, src/features/studio/kitRun.ts, src/features/studio/styleLayerRun.ts, kit/tools/kit-diff.mjs
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kitMap } from "../src/features/studio/kitMap.ts";
import { prepareLayer, publishLayer } from "../src/features/studio/styleLayerRun.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const FRESH = readFileSync("kit/starter/vendor/builder-motion.js", "utf8");
const STALE = FRESH.replace(/scroll-depths/g, "scroll-gone");
const MOTION = "starter/vendor/builder-motion.js";
const KIT_COPY = "kit/starter/vendor/builder-motion.js";

/* The repository: kit/ as a repo of its own on main, with its kit also kept in kit/ (kit-check and the motion file). */
const REPO_DIR = mkdtempSync(join(tmpdir(), "kit-motion-"));
cpSync("kit", REPO_DIR, { recursive: true });
mkdirSync(join(REPO_DIR, "kit/tools"), { recursive: true });
mkdirSync(join(REPO_DIR, "kit/starter/vendor"), { recursive: true });
cpSync("kit/tools/kit-check.mjs", join(REPO_DIR, "kit/tools/kit-check.mjs"));
writeFileSync(join(REPO_DIR, KIT_COPY), FRESH);
const git = (...args) => execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const gitIn = (input, ...args) => execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] }).trim();
const commit = (m) => { git("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A"); git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", m); };
git("init", "-q", "-b", "main");
git("config", "core.autocrlf", "false"); /* the scratch repo must hand the motion file back byte for byte, whatever the machine converts */
commit("the starter");

/* GitHub, stood in over that repository: every write is a real git object. */
const pulls = [];
const stand = async (url, init = {}) => {
  const u = new URL(url);
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const p = u.pathname.replace("/repos/j/starter", "");
  if (!u.pathname.startsWith("/repos/j/starter")) return j({ message: "Not Found" }, 404);
  if (p === "") return j({ default_branch: "main" });
  if (p.startsWith("/contents/")) { try { return j({ content: Buffer.from(execFileSync("git", ["show", `${u.searchParams.get("ref") ?? "main"}:${decodeURIComponent(p.slice(10))}`], { cwd: REPO_DIR, stdio: ["pipe", "pipe", "pipe"] })).toString("base64") }); } catch { return j({ message: "Not Found" }, 404); } }
  if (p.startsWith("/git/trees/") && method === "GET") {
    const tree = git("ls-tree", "-r", decodeURIComponent(p.slice(11))).split("\n").filter(Boolean).map((l) => { const [meta, path] = l.split("\t"); const [, type, sha] = meta.split(" "); return { path, type, sha }; });
    return j({ tree });
  }
  if (p.startsWith("/git/blobs/") && method === "GET") return j({ content: execFileSync("git", ["cat-file", "blob", p.slice(11)], { cwd: REPO_DIR }).toString("base64") });
  if (p.startsWith("/git/ref/heads/")) { try { return j({ object: { sha: git("rev-parse", `refs/heads/${decodeURIComponent(p.slice(15))}`) } }); } catch { return j({}, 404); } }
  if (p.startsWith("/git/commits/") && method === "GET") return j({ tree: { sha: git("rev-parse", `${p.slice(13)}^{tree}`) } });
  if (p === "/git/blobs") return j({ sha: gitIn(body.content, "hash-object", "-w", "--stdin") }, 201);
  if (p === "/git/trees") {
    const env = { ...process.env, GIT_INDEX_FILE: join(REPO_DIR, ".git", "stand-index") };
    const g = (...args) => execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8", env }).trim();
    g("read-tree", body.base_tree);
    for (const e of body.tree) g("update-index", "--add", "--cacheinfo", `${e.mode},${e.sha},${e.path}`);
    return j({ sha: g("write-tree") }, 201);
  }
  if (p === "/git/commits") return j({ sha: git("-c", "user.name=b", "-c", "user.email=b@b", "commit-tree", body.tree, "-p", body.parents[0], "-m", body.message) }, 201);
  if (p === "/git/refs") { try { git("rev-parse", "--verify", body.ref); return j({ message: "Reference already exists" }, 422); } catch { git("update-ref", body.ref, body.sha); return j({ ref: body.ref }, 201); } }
  if (p === "/pulls" && method === "POST") { pulls.push(body); return j({ number: pulls.length, html_url: `https://github.com/j/starter/pull/${pulls.length}` }, 201); }
  return j({ message: "no" }, 404);
};

/* One token restyled: the design. */
const accent = { name: "--color-accent", value: "#2f6fde", file: "starter/tokens.css", line: 1, token: true };
const source = { repo: "j/starter", ref: "main", dir: "starter/", files: [{ file: "starter/index.html", pageId: "home", hooks: [], vars: [accent] }], varsSet: { "--color-accent": "#c2410c" } };
const send = () => prepareLayer([], null, source, "tok", { fetch: stand, when: "2026-10-11", kitMap: async (files) => kitMap(files) });
const motionOut = (prepared) => (prepared.ok ? prepared.files.filter((f) => f.path.endsWith("builder-motion.js")).map((f) => f.path).sort() : []);

/* 1. Up to date: no motion file goes out. */
const upToDate = await send();
check("a site whose motion file is the Builder's: prepared by the kit's contract", upToDate.ok && upToDate.kit, upToDate.says ?? "");
check("and only the style layer, with the token, is sent: no motion file", upToDate.ok && upToDate.files.map((f) => f.path).join() === "starter/style-layer.css" && /--color-accent:\s*#c2410c/.test(upToDate.files[0].content), upToDate.ok ? upToDate.files.map((f) => f.path).join() : "");

/* 2. Behind: the site's copy and its kit's copy predate scroll-depths. */
writeFileSync(join(REPO_DIR, MOTION), STALE);
writeFileSync(join(REPO_DIR, KIT_COPY), STALE);
commit("an old kit");
const files = Object.fromEntries(git("ls-tree", "-r", "--name-only", "main").split("\n").filter((f) => f === "builder.json" || f.startsWith("starter/") || f === KIT_COPY).filter((f) => /\.(html?|css|m?js|json)$/.test(f)).map((f) => [f, readFileSync(join(REPO_DIR, f), "utf8")]));
const map = kitMap(files);
check("the kit's check hands back the fresh motion file beside the tokens", map.problems.length === 0 && map.made[MOTION] === FRESH, map.problems.join("; "));
check("and the fresh file for the kit's own copy of it", map.made[KIT_COPY] === FRESH);
const behind = await send();
check("a site whose motion file is behind: both copies are sent", behind.ok && motionOut(behind).join() === `${KIT_COPY},${MOTION}`, motionOut(behind).join());
const sentMotion = behind.ok ? behind.files.find((f) => f.path === MOTION)?.content : "";
check("fresh, with scroll-depths in it", sentMotion === FRESH && /scroll-depths/.test(sentMotion) && behind.files.find((f) => f.path === KIT_COPY)?.content === FRESH);

/* 3. On the branch: the kit's own tools pass. */
const sent = behind.ok ? await publishLayer(behind, source, "tok", { site: "Starter", date: new Date("2026-10-11T10:00:00Z"), fetch: stand }) : { ok: false };
check("it goes to a new style/ branch and a pull request", sent.ok && pulls.length === 1, JSON.stringify(sent).slice(0, 300));
check("the pull request says the motion file was behind", /motion file was behind/.test(pulls[0]?.body ?? ""));
git("checkout", "-q", sent.branch ?? "main");
const run = (...args) => { try { return { ok: true, out: execFileSync("node", args, { cwd: REPO_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; } };
const kc = run("tools/kit-check.mjs", "builder.json");
check("kit:check passes on the branch", kc.ok, kc.out.trim().split("\n").slice(-3).join(" | "));
const kd = run("tools/kit-diff.mjs", "builder.json", "--base", "main", "--style-only");
check("kit:diff --style-only passes on the branch, the motion file and its kit copy among the design's files", kd.ok, kd.out.trim().split("\n").slice(-3).join(" | "));
check("the site's motion file on the branch has scroll-depths", readFileSync(join(REPO_DIR, MOTION), "utf8") === FRESH);

rmSync(REPO_DIR, { recursive: true, force: true });
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
