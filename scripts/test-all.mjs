#!/usr/bin/env node
/**
 * The whole suite, run the same way by everyone.
 *
 * Each file in tests/ says in its own header how it wants to be run: the
 * server it needs (`GITHUB_API=… VERCEL_API=… npx next start -p 3013`, with
 * `env -u GITHUB_TOKEN …` when it must have no token of its own) and the
 * arguments it takes (`node tests/x.mjs http://127.0.0.1:3013 <path to a
 * capture folder>`). This reads those headers rather than keeping a second
 * list that drifts: tests that want the same server share one, every server
 * starts without any real GitHub or Vercel token, and each test is handed
 * its server's address and, where it asks for one, the capture folder.
 *
 *   npm run build                           # once; --build does it for you
 *   node scripts/test-all.mjs               # everything, then the table
 *   node scripts/test-all.mjs oddness coded # just these (names or globs)
 *   node scripts/test-all.mjs --changed     # only what the change touches, and the smoke set
 *
 *   --build        run `npm run build` first (also done when there is no build)
 *   --jobs N       how many run at once in the parallel batch (default 4, or the
 *                  machine's cores when fewer); each has its own browser and temp dir
 *   --timeout S    seconds before a test is stopped and counted failed (default 600);
 *                  a test still running after two minutes is named once a minute
 *   --changed [R]  only the tests that touch a file changed since R (default: where
 *                  this branch left trunk), tests changed themselves, and the smoke set
 *   --no-smoke     with --changed, leave the smoke set out
 *   --out FILE     also write the table and the summary, as Markdown, to FILE
 *   --json FILE    also write every result, with its time, as JSON
 *   --list         say which server, arguments and phase each test gets, and run nothing
 *   SINK=path      the capture folder, laid out as sink was (default
 *                  capture/versions/sink-0ee06fa, the captures the tests were
 *                  written against; unpacked first from capture/fixtures);
 *                  fluid-site alone is handed the newest, capture/ (SINK_NEWEST);
 *                  tests are given its sites/trumpmorty-fun as SINK, which
 *                  is what they read
 *
 * HOW A RUN GOES, AND WHY (owner's note R15). The whole suite took about
 * 103 minutes three at a time, and a run under load reported 46 failures
 * that mostly passed when run alone: a table nobody could trust, slowly.
 *
 *   1. The parallel batch. Every test not tagged to run alone, longest
 *      first (the times the last runs took, `scripts/test-timings.json`, so
 *      the long ones do not start last and hold the run open). Tests that
 *      share a server share one; a test that serves a stand-in of its own
 *      (GitHub on 4333, Vercel on 4334, …) gets a fresh server, and runs
 *      beside the others but never beside another such test, since two of
 *      them would want the same port.
 *   2. Again, alone. A test that failed in the batch runs once more on its
 *      own. Passing then, it is FLAKY: it holds on a quiet machine and not
 *      beside others, which is worth knowing and is not a pass. Failing
 *      again, it failed. No check is loosened for this; only the load moves.
 *   3. The ones tagged to run alone. A header line starting `Runs alone:`
 *      (and saying why) keeps a test out of the batch: it measures time or
 *      motion, and a busy machine changes what it measures. These run one
 *      at a time after the batch, where their result is the result.
 *
 * At the end: the table (every test, its result, its checks, its time) and
 * a short summary: passed, failed, flaky, timed out, skipped, the wall
 * time, and the slowest ten. The times go into `.test-timings.json`
 * (untracked) so the next run orders by them.
 *
 * --changed reads what changed (commits since R, the working tree and new
 * files), and picks every test whose own file changed, or whose source names
 * a changed file: by its path, its import path, or its name (a route by its
 * address, `index.ts` and `route.ts` by their folder). A header line
 * `Covers: path, path` adds files a test exercises without naming them. The
 * smoke set (SMOKE below) always runs as well, as a quick check that the
 * Builder as a whole still comes up.
 *
 * Exit code 0 when no test failed or timed out. A flaky test is named in the
 * summary, every time, but does not fail the run: it passed when given the
 * machine to itself, as the old pass* did.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = join(ROOT, "tests");

/* ------------------------------------------------------------ options */
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); if (i < 0) return dflt; const v = argv[i + 1]; argv.splice(i, 2); return v; };
/* An option whose value may be left off: `--changed` alone, or `--changed REF`. */
const optMaybe = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v !== undefined && !v.startsWith("--") && !existsSync(join(TESTS, `${v}.mjs`)) && gitOk(["rev-parse", "--verify", "--quiet", `${v}^{commit}`])) { argv.splice(i, 2); return v; }
  argv.splice(i, 1);
  return null;
};
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };
function gitOk(args) { try { execFileSync("git", args, { cwd: ROOT, stdio: "ignore" }); return true; } catch { return false; } }
const JOBS = Math.max(1, Number(opt("--jobs", process.env.JOBS ?? Math.min(4, availableParallelism()))));
const TIMEOUT = Math.max(10, Number(opt("--timeout", process.env.TEST_TIMEOUT ?? 600))) * 1000;
const OUT = opt("--out", null);
const JSON_OUT = opt("--json", null);
const CHANGED = optMaybe("--changed");
const NO_SMOKE = flag("--no-smoke");
const BUILD = flag("--build");
const LIST = flag("--list");
/* The captures the tests were written against (sink 0ee06fa); the newest (sink 75a7bcc, what the folded capturer makes) are at capture/ itself, for the few tests that want them. */
const SINK = resolve(ROOT, process.env.SINK ?? "capture/versions/sink-0ee06fa");
const NEWEST = resolve(ROOT, process.env.SINK_NEWEST ?? "capture");
const only = argv.filter((a) => !a.startsWith("--"));

/*
 * Not tests. Measurements answer a question and pass nothing (ground-growth
 * runs for twelve minutes by design); deploy-check asks the live production
 * site, which is not this checkout. Listed, so the table says why they did
 * not run.
 */
const SKIP = {
  "deploy-check": "asks the live production site: npm run check:deploy",
  "ground-cost": "a measurement, not a pass or fail",
  "ground-growth": "a measurement, not a pass or fail (twelve minutes)",
  "ground-readback": "a measurement, not a pass or fail",
  "pan-cost": "a measurement, not a pass or fail",
};
/* Arguments a header names in words the rules below do not read. */
const ARGS = {
  "sticky-in-section": (url) => [url, join(SINK, "sites", "gotchi-gg")],
  "motion-sampled": (url) => [url, SINK],
  /* Written against the newest capture: the footer's edge recorded on its top only (sink 98d5b91, 1b93cf4). */
  "fluid-site": (url) => [url, NEWEST],
};
/*
 * THE SMOKE SET: always run by --changed. Quick, and between them they open
 * the Builder, its bar and panels, the Builds page, publishing's words and
 * its key handling, so a change that breaks the app as a whole is caught
 * whatever it touched.
 */
const SMOKE = ["bar-survives", "cards", "publish-words", "site-refs", "go-live-keys-ready", "builds-publish-state", "no-plain-key"];

/* Never a real token: a test that needs one serves a stand-in and says so. */
const UNSET = ["GITHUB_TOKEN", "GH_TOKEN", "OPENAI_API_KEY", "GITHUB_REPO", "GITHUB_BRANCH", "VERCEL_TOKEN", "VERCEL_PROJECT", "VERCEL_TEAM", "REPLICATE_API_TOKEN", "ANTHROPIC_API_KEY"];

/* ------------------------------------------------------------ reading a header */
function headerOf(src) {
  const m = /^(?:#!.*\n)?\s*\/\*\*?([\s\S]*?)\*\//.exec(src);
  return (m?.[1] ?? "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "")).join("\n").replace(/\\\n\s*/g, " ");
}

/** The server a test asks for: the env on its `next start` line. */
function serverOf(header) {
  const line = header.split("\n").find((l) => /\bnpx next (start|dev)\b/.test(l));
  const env = {};
  if (!line) return env;
  const before = line.slice(0, line.search(/\bnpx next (start|dev)\b/)).replace(/^.*&&/, "");
  for (const [, k, v] of before.matchAll(/\b([A-Z][A-Z0-9_]*)=(\S+)/g)) env[k] = v;
  return env;
}

/** The arguments a test takes, from its usage line, filled in for this run. */
function argsOf(name, header, src, url) {
  if (ARGS[name]) return ARGS[name](url);
  const usage = header.split("\n").find((l) => l.includes(`node tests/${name}.mjs`));
  if (usage) {
    const rest = usage.slice(usage.indexOf(`${name}.mjs`) + name.length + 4).replace(/#.*$/, "").trim();
    const tokens = rest.match(/<[^>]*>|\[[^\]]*\]|\S+/g) ?? [];
    const out = [];
    for (const t of tokens) {
      if (/^https?:\/\//.test(t) || /^[<[](url|builder url|base url)[>\]]$/.test(t)) out.push(url);
      else if (/capture folder/.test(t)) out.push(SINK);
      else if (t.startsWith("[")) break; // optional, and nothing here to give it
      else if (t.startsWith("<")) return { needs: t };
      else if (t.startsWith("--") || t.startsWith("(")) break;
      else out.push(t);
    }
    if (out.length) return out;
  }
  /* No usage line that says: a URL when it reads one, the sink when that is its first argument. */
  if (/process\.argv\[2\]\s*(\?\?|\|\|)\s*(process\.env\.SINK|join\(|"\.\.\/sink"|"capture)/.test(src)) return [SINK];
  if (/process\.argv\[2\]/.test(src)) return [url];
  return [];
}


/** A header line `Runs alone: why` keeps a test out of the parallel batch. */
const aloneOf = (header) => /^\s*Runs alone\s*:\s*(.+)$/mi.exec(header)?.[1]?.trim() ?? null;
/** A header line `Covers: path, path` names files a test exercises without naming them in its source. */
const coversOf = (header) => (/^\s*Covers\s*:\s*(.+)$/mi.exec(header)?.[1] ?? "").split(/[,\s]+/).map((s) => s.replace(/[`.]+$/, "").replace(/^`/, "")).filter(Boolean);

/* ------------------------------------------------------------ what changed */
const TRUNK = "origin/claude/template-ui-website-builder-11bfgl";
function git(args) { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
/** Every file changed since `ref` (default: where this branch left trunk): commits, the working tree, and new files. */
function changedSince(ref) {
  let base = ref;
  if (!base) {
    try { base = git(["merge-base", "HEAD", TRUNK]).trim(); } catch { base = "HEAD~1"; }
    if (base && git(["rev-parse", "HEAD"]).trim() === base) base = "HEAD~1";
  }
  const tracked = git(["diff", "--name-only", base]).split("\n").filter(Boolean);
  const fresh = git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  return { base, files: [...new Set([...tracked, ...fresh])] };
}
/* A stem this common names nothing on its own: `store.ts` is read as `studio/store`, a route by its address. */
const GENERIC = new Set(["index", "route", "store", "page", "layout", "types", "utils", "util", "theme", "constants", "helpers", "main", "config"]);
/* Files that shape every page: a change to one is a change to the whole Builder, so everything runs. */
const EVERYTHING = /^(next\.config\.[a-z]+|tsconfig\.json|postcss\.config\.[a-z]+|site\.config\.[a-z]+|package-lock\.json)$/;

/*
 * WHAT A TEST EXERCISES (owner's note on test speed). The old reading looked
 * for each changed file's stem anywhere in a test, so `builder.json` in a
 * fixture picked every test that opens /builder (246 of them) and Task 28's
 * change ran 406 of 460. Now each test is mapped to the files it reaches:
 *
 *   · what it imports, from src/, capture/ or kit/ (also through jiti, and
 *     through a fixture module it imports), and everything those import in
 *     turn: a unit test is picked by any file its code actually runs;
 *   · the API routes it calls by address, and what each route imports;
 *   · the window hooks it drives (`window.__studioExport`): every source
 *     file that names the hook, the one that sets it and the one behind it;
 *   · files it names by path, import path or (for source) by a stem that
 *     is not a common word, as before; and its `Covers:` line;
 *   · a fixture is picked only by the tests that name its folder or file.
 *
 * A change to the build's own setup (next.config, tsconfig, the lockfile,
 * a dependency's version in package.json) runs everything.
 */
const SRC_EXT = [".ts", ".tsx", ".mjs", ".js", ".jsx", ".cjs", ".json", ".css"];
const resolved = new Map();
function resolveFrom(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(fromFile), spec);
  else return null;
  base = base.replace(/\\/g, "/");
  for (const cand of [base, ...SRC_EXT.map((e) => base + e), ...SRC_EXT.map((e) => `${base}/index${e}`)]) {
    try { if (existsSync(join(ROOT, cand)) && !readdirSafe(cand)) return cand; } catch { /* next */ }
  }
  return null;
}
function readdirSafe(rel) { try { readdirSync(join(ROOT, rel)); return true; } catch { return false; } }
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+|jiti\([^)]*\)\s*\(\s*|\bimport\s*\(\s*)["'`]([^"'`]+)["'`]/g;
/** The repo files a source file imports, resolved. */
function importsOf(file) {
  if (resolved.has(file)) return resolved.get(file);
  const out = new Set();
  resolved.set(file, out);
  if (!/\.(m?[jt]sx?|cjs)$/.test(file)) return out;
  let src = "";
  try { src = readFileSync(join(ROOT, file), "utf8"); } catch { return out; }
  for (const m of src.matchAll(SPEC)) { const r = resolveFrom(file, m[1]); if (r) out.add(r); }
  /* A path handed to a loader as a string: `"../src/features/studio/x.ts"`. */
  for (const m of src.matchAll(/["'`]((?:\.\.?\/)+(?:src|capture|kit)\/[^"'`\s]+)["'`]/g)) { const r = resolveFrom(file, m[1]); if (r) out.add(r); }
  return out;
}
/** Everything a file reaches through its imports, itself included. */
function closureOf(files) {
  const seen = new Set();
  const stack = [...files];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const g of importsOf(f)) if (!seen.has(g)) stack.push(g);
  }
  return seen;
}
/** Every file under src/ (for the hooks a test drives). */
let srcIndex;
function srcFiles() {
  if (srcIndex) return srcIndex;
  srcIndex = new Map();
  const walk = (rel) => {
    for (const e of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (/\.(m?[jt]sx?)$/.test(e.name)) srcIndex.set(r, readFileSync(join(ROOT, r), "utf8"));
    }
  };
  walk("src");
  return srcIndex;
}
const filesNaming = new Map();
function filesWith(token) {
  if (!filesNaming.has(token)) filesNaming.set(token, [...srcFiles()].filter(([, src]) => src.includes(token)).map(([f]) => f));
  return filesNaming.get(token);
}
/** The files a test reaches, with why, for --changed. */
function reachOf(f, src) {
  const reach = new Map();
  const add = (file, why) => { if (!reach.has(file)) reach.set(file, why); };
  /* Its imports, and theirs. Its fixture modules count as its own code. */
  for (const file of closureOf([`tests/${f}`])) if (file !== `tests/${f}`) add(file, file.startsWith("tests/") ? "uses" : "imports");
  /* The API routes it calls, and what they import. */
  for (const m of src.matchAll(/\/api\/[A-Za-z0-9_\-/[\]]+/g)) {
    const parts = m[0].replace(/\/+$/, "").split("/").filter(Boolean);
    for (let n = parts.length; n >= 2; n--) {
      const route = resolveFrom("x", `@/app/${parts.slice(0, n).join("/")}/route`);
      if (route) { for (const file of closureOf([route])) add(file, `calls ${m[0]}`); break; }
    }
  }
  /* The window hooks it drives. */
  for (const m of new Set([...src.matchAll(/\b__studio[A-Za-z0-9_]+/g)].map((x) => x[0]))) for (const file of filesWith(m)) add(file, `drives ${m}`);
  return reach;
}
/** The words a test would use for a changed file, if it names it. */
function namesOf(file) {
  const noExt = file.replace(/\.[^./]+$/, "");
  const parts = noExt.split("/");
  const stem = parts.at(-1);
  const dir = parts.at(-2) ?? "";
  /* A fixture is named by its folder (or its own name, at the top of fixtures/), never by a stem. */
  const fx = /^tests\/fixtures\/([^/]+)/.exec(file);
  if (fx) return [file, `fixtures/${fx[1]}`];
  const out = [file, noExt, noExt.replace(/^src\//, "@/")];
  const route = /^src\/app\/(api\/.+)\/route$/.exec(noExt);
  if (route) out.push(`/${route[1]}`);
  /* Only source is named by its stem, and not as a page address (`/builder`) or a file name (`builder.json`). */
  if (/^(src|capture|kit)\//.test(file) && /\.(m?[jt]sx?|css)$/.test(file)) {
    if (stem && !GENERIC.has(stem) && stem.length >= 4) out.push(stem);
    else if (dir) out.push(`${dir}/${stem}`);
  }
  return out;
}
const named = (src, n) => new RegExp(`(^|[^\\w\\-/.])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w\\-.]|\\.(?:m?[jt]sx?)\\b|$)`).test(src)
  || (n.includes("/") && src.includes(n));
/** A dependency's version moved in package.json (scripts alone do not reach the app). */
function depsMoved(base) {
  try { return /^[+-]\s*"[^"]+":\s*"[\^~]?\d/m.test(git(["diff", base, "--", "package.json"])); } catch { return false; }
}
/** The tests a change reaches, and why each was picked. */
function pickChanged(all, changed, base) {
  const why = new Map();
  const everything = changed.find((c) => EVERYTHING.test(c)) ?? (changed.includes("package.json") && depsMoved(base) ? "package.json (a dependency)" : null);
  for (const f of all) {
    const name = f.replace(/\.mjs$/, "");
    if (everything) { why.set(name, `${everything} shapes every page`); continue; }
    const src = readFileSync(join(TESTS, f), "utf8");
    const covers = coversOf(headerOf(src));
    let reach;
    for (const c of changed) {
      if (c === `tests/${f}`) { why.set(name, "the test itself changed"); break; }
      if (!/^(src|tests|scripts|public|capture|kit)\//.test(c)) continue;
      if (c.startsWith("scripts/test-all") || c === "scripts/test-timings.json") continue;
      /* Another test's file is that test's business. */
      if (/^tests\/[^/]+\.mjs$/.test(c)) continue;
      if (covers.some((p) => c.startsWith(p))) { why.set(name, `covers ${c}`); break; }
      reach ??= reachOf(f, src);
      if (reach.has(c)) { why.set(name, `${reach.get(c)} → ${c}`); break; }
      const hit = namesOf(c).find((n) => named(src, n));
      if (hit) { why.set(name, `names ${c}`); break; }
    }
  }
  return why;
}

/* ------------------------------------------------------------ the plan */
const files = readdirSync(TESTS).filter((f) => f.endsWith(".mjs")).sort();
const glob = (p) => new RegExp(`^${p.replace(/\.mjs$/, "").replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
let picked = only.length ? files.filter((f) => only.some((p) => glob(basename(p)).test(f.replace(/\.mjs$/, "")))) : files;
const pickedWhy = new Map();
if (CHANGED !== undefined) {
  const { base, files: changed } = changedSince(CHANGED);
  const why = pickChanged(picked, changed, base);
  if (!NO_SMOKE) for (const s of SMOKE) if (!why.has(s) && files.includes(`${s}.mjs`)) why.set(s, "smoke set");
  for (const [k, v] of why) pickedWhy.set(k, v);
  picked = picked.filter((f) => why.has(f.replace(/\.mjs$/, "")));
  console.log(`--changed since ${base.slice(0, 9)}: ${changed.length} file${changed.length === 1 ? "" : "s"} changed, ${picked.length} test${picked.length === 1 ? "" : "s"} picked (${[...why.values()].filter((v) => v === "smoke set").length} of them the smoke set)`);
}
if (!picked.length) { console.error(only.length ? `No test matches ${only.join(" ")}` : "No test to run."); process.exit(only.length ? 2 : 0); }

const plan = picked.map((f) => {
  const name = f.replace(/\.mjs$/, "");
  const src = readFileSync(join(TESTS, f), "utf8");
  const header = headerOf(src);
  const env = serverOf(header);
  return { name, src, header, env, standIn: /\bcreateServer\(/.test(src), ports: portsOf(src, env), alone: aloneOf(header) };
});

/*
 * The fixed ports a test listens on itself: its GitHub or Vercel stand-in
 * (4333, 4334, …) and a site it serves. Two tests that want the same port
 * never run together; tests whose ports differ do (they used to wait for
 * every other stand-in test, whatever its port). A test that serves on
 * port 0 wants none.
 */
function portsOf(src, env) {
  const out = new Set();
  for (const m of src.matchAll(/\b(?:[A-Z_]*PORT|SERVE|STUB)\s*=\s*(?:Number\([^)]*\?\?\s*)?(\d{4,5})\b/g)) out.add(Number(m[1]));
  for (const m of src.matchAll(/\.listen\(\s*(?:Number\([^)]*\?\?\s*)?(\d{4,5})\b/g)) out.add(Number(m[1]));
  for (const v of Object.values(env)) for (const m of String(v).matchAll(/:(\d{4,5})\b/g)) out.add(Number(m[1]));
  return [...out].filter((p) => p >= 4000);
}

/* ------------------------------------------------------------ how long each took last time */
const TIMINGS = join(ROOT, "scripts", "test-timings.json");
const LOCAL_TIMINGS = join(ROOT, ".test-timings.json");
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; } };
const timings = { ...readJson(TIMINGS), ...readJson(LOCAL_TIMINGS) };
/* A test never timed is guessed at a minute: long enough to start early, not so long it jumps the real long ones. */
const est = (name) => timings[name] ?? 60;
const envKey = (env) => JSON.stringify(Object.entries(env).sort());
const clean = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

const running = new Map();
/* A hang is seen while it happens: every minute, the tests running past two minutes, by name. */
const beat = setInterval(() => {
  const long = [...running].filter(([, t0]) => Date.now() - t0 > 120000).map(([n, t0]) => `${n} ${Math.round((Date.now() - t0) / 1000)}s`);
  if (long.length) process.stdout.write(`   ...  still running: ${long.join(", ")}\n`);
}, 60000);
beat.unref();
/* Windows: npm and npx are .cmd shims (a shell finds them), there are no process groups to signal (taskkill takes the whole tree), and a detached child would open a console window. */
const WIN = process.platform === "win32";
function launch(cmd, args, opts) {
  return spawn(cmd, args, WIN ? { ...opts, detached: false, windowsHide: true, shell: /^np[mx]$/.test(cmd) } : { ...opts, detached: true });
}
function killTree(child, signal) {
  if (!WIN) { process.kill(-child.pid, signal); return; }
  execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
}
function run(cmd, args, { env, timeout, cwd = ROOT, name } = {}) {
  return new Promise((done) => {
    const started = Date.now();
    if (name) running.set(name, started);
    const child = launch(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => {
      out += `\n[stopped after ${timeout / 1000}s]`;
      if (name) process.stdout.write(` TIMEOUT  ${name} stopped after ${timeout / 1000}s; its last line: ${clean(out).trim().split("\n").filter(Boolean).slice(-2, -1)[0]?.slice(0, 140) ?? "(none)"}\n`);
      try { killTree(child, "SIGKILL"); } catch { /* gone */ } }, timeout);
    child.on("close", (code, signal) => { clearTimeout(timer); if (name) running.delete(name); done({ code: signal ? 124 : code, out: clean(out), ms: Date.now() - started }); });
  });
}

function baseEnv() {
  /*
   * SINK, to a test, is the trumpmorty.fun capture's folder (the drawing
   * fixture and site-colours read it so); the few that want the checkout
   * itself are handed it as an argument.
   */
  const env = { ...process.env, SINK: join(SINK, "sites", "trumpmorty-fun"), NODE_NO_WARNINGS: "1" };
  for (const k of UNSET) delete env[k];
  /* The browser that is here, for the suites that take one by name: without
     it they ask Playwright for its own build, which may not be installed. */
  const here = ["/opt/pw-browsers/chromium"].find((p) => existsSync(p));
  if (here) { env.PLAYWRIGHT_CHROMIUM ??= here; env.CHROMIUM ??= here; }
  return env;
}

async function startServer(port, extra) {
  const env = { ...baseEnv(), ...extra, PORT: String(port) };
  const child = launch("npx", ["next", "start", "-p", String(port)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => { log += d; });
  child.stderr.on("data", (d) => { log += d; });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${url}/builder`, { signal: AbortSignal.timeout(5000) })).ok) return { url, stop: () => { try { killTree(child, "SIGTERM"); } catch { /* gone */ } } }; } catch { /* not yet */ }
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  try { killTree(child, "SIGKILL"); } catch { /* gone */ }
  throw new Error(`the server on ${port} did not answer:\n${log.slice(-2000)}`);
}

/** "12/14", "all good — 14/14", "3 failed of 45", "27/29 passed": what the test said it counted. */
function countOf(out) {
  const lines = out.trim().split("\n").reverse();
  for (const l of lines) {
    let m = /(\d+) failed of (\d+)/.exec(l);
    if (m) return `${Number(m[2]) - Number(m[1])}/${m[2]}`;
    m = /\b(\d+)\s*\/\s*(\d+)\b/.exec(l);
    if (m && /pass|good|ok|fail|checks?|—|-/i.test(l)) return `${m[1]}/${m[2]}`;
  }
  const ok = (out.match(/^\s*ok\b/gm) ?? []).length;
  const fail = (out.match(/^\s*FAIL\b/gm) ?? []).length;
  return ok + fail ? `${ok}/${ok + fail}` : "";
}


/* ------------------------------------------------------------ one test */
const results = [];
async function runOnce(t, url) {
  const args = argsOf(t.name, t.header, t.src, url);
  if (!Array.isArray(args)) return { name: t.name, result: "skip", count: "", s: 0, note: `needs ${args.needs}` };
  /* Its own temp dir, so two tests side by side never write over each other's files. */
  const tmp = mkdtempSync(join(tmpdir(), `polio-${t.name}-`));
  const r = await run(process.execPath, [join("tests", `${t.name}.mjs`), ...args], { env: { ...baseEnv(), TMPDIR: tmp, TMP: tmp, TEMP: tmp }, timeout: TIMEOUT, name: t.name });
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* kept */ }
  const result = r.code === 0 ? "pass" : r.code === 124 ? "timeout" : "FAIL";
  const firstFail = r.code === 0 ? "" : (/^\s*FAIL\b.*$/m.exec(r.out)?.[0].trim().replace(/^FAIL\s+/, "") ?? r.out.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "");
  if (result !== "pass" && process.env.VERBOSE) process.stdout.write(r.out.split("\n").map((l) => `        ${l}`).join("\n") + "\n");
  return { name: t.name, result, count: countOf(r.out), s: Math.round(r.ms / 1000), note: firstFail.slice(0, 140) };
}
let done = 0;
let toRun = 0;
const say = (rec, where) => process.stdout.write(`[${String(++done).padStart(String(toRun).length)}/${toRun}] ${rec.result === "pass" ? "  pass" : ` ${rec.result.padStart(5)}`}  ${rec.name}${rec.count ? ` (${rec.count})` : ""} ${rec.s}s${where ? `  [${where}]` : ""}\n`);

/* ------------------------------------------------------------ servers */
/* Clear of every port a suite claims for itself (3011–3018, 3101, 4319–4345). */
let nextPort = 3200;
const shared = new Map();
/** The server every test with this env shares, started the first time one asks. */
function sharedServer(env) {
  const key = envKey(env);
  if (!shared.has(key)) shared.set(key, startServer(nextPort++, env));
  return shared.get(key);
}
/*
 * A test with a stand-in of its own gets a server of its own. The server
 * remembers what GitHub answered (under the one placeholder token every
 * suite uses), so a stand-in served by the test before it answered for
 * this one: repo-menu passed alone and failed after publish-empty.
 */
async function runOwn(t) {
  let own;
  try { own = await startServer(nextPort++, t.env); } catch (e) {
    console.error(String(e.message ?? e));
    return { name: t.name, result: "FAIL", count: "", s: 0, note: "its server did not start" };
  }
  try { return await runOnce(t, own.url); } finally { own.stop(); await new Promise((r) => setTimeout(r, 500)); }
}
async function runShared(t) {
  let server;
  try { server = await sharedServer(t.env); } catch (e) {
    console.error(String(e.message ?? e));
    return { name: t.name, result: "FAIL", count: "", s: 0, note: "its server did not start" };
  }
  return runOnce(t, server.url);
}
const runIt = (t) => (t.standIn ? runOwn(t) : runShared(t));

/* ------------------------------------------------------------ the list */
if (LIST) {
  const batch = plan.filter((t) => !SKIP[t.name] && !t.alone).sort((a, b) => est(b.name) - est(a.name));
  const alone = plan.filter((t) => !SKIP[t.name] && t.alone);
  const named = (t) => Object.entries(t.env).map(([k, v]) => `${k}=${v}`).join(" ") || "no stand-ins";
  console.log(`\n1. The parallel batch, ${JOBS} at a time, longest first — ${batch.length} tests, about ${Math.round(batch.reduce((n, t) => n + est(t.name), 0) / 60)} min of work`);
  for (const t of batch) { const a = argsOf(t.name, t.header, t.src, "<url>"); console.log(`  ${String(est(t.name)).padStart(4)}s  ${t.name}${t.standIn ? " (its own server)" : ""} — ${named(t)}${Array.isArray(a) ? "" : `; needs ${a.needs}`}${pickedWhy.has(t.name) ? `; ${pickedWhy.get(t.name)}` : ""}`); }
  console.log(`\n2. Any that failed in the batch, again, alone`);
  console.log(`\n3. Tagged to run alone — ${alone.length} tests`);
  for (const t of alone) console.log(`  ${String(est(t.name)).padStart(4)}s  ${t.name} — ${t.alone}`);
  for (const t of plan) if (SKIP[t.name]) console.log(`  skip ${t.name}: ${SKIP[t.name]}`);
  process.exit(0);
}

/* ------------------------------------------------------------ go */
function treeState() {
  try { return new Set(execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean)); } catch { return new Set(); }
}
const before = treeState();
/* The captures the tests read, unpacked from capture/fixtures when they are not there yet (never kept in git). */
if (!process.env.SINK) {
  const { ensureFixtures } = await import("../capture/fixtures/unpack.mjs");
  if (!ensureFixtures({ quiet: true })) console.warn("The capture fixtures could not be unpacked (tar with xz): tests that read them will fail.");
}
if (!existsSync(join(SINK, "site", "document.json"))) console.warn(`No captures at ${SINK}: tests that read them will fail. Set SINK, or run npm run capture:fixtures.`);
if (BUILD || !existsSync(join(ROOT, ".next", "BUILD_ID"))) {
  console.log("Building (npm run build)…");
  const b = await run("npm", ["run", "build"], { env: baseEnv(), timeout: 15 * 60 * 1000 });
  if (b.code !== 0) { console.error(b.out.slice(-4000)); console.error("The build failed; nothing was run."); process.exit(1); }
}

for (const t of plan) if (SKIP[t.name]) results.push({ name: t.name, result: "skip", count: "", s: 0, note: SKIP[t.name] });
toRun = plan.filter((t) => !SKIP[t.name]).length;
const started = Date.now();
const phase = {};

/* 1. The parallel batch: longest first, a stand-in test never beside another. */
{
  const t0 = Date.now();
  const queue = plan.filter((t) => !SKIP[t.name] && !t.alone).sort((a, b) => est(b.name) - est(a.name));
  console.log(`\n1. The parallel batch — ${queue.length} tests, ${JOBS} at a time, longest first`);
  const busy = new Set();
  const worker = async () => {
    for (;;) {
      const i = queue.findIndex((t) => !t.ports.some((p) => busy.has(p)));
      if (i < 0) { if (!queue.length) return; await new Promise((r) => setTimeout(r, 300)); continue; }
      const [t] = queue.splice(i, 1);
      for (const p of t.ports) busy.add(p);
      let rec;
      try { rec = await runIt(t); } finally { for (const p of t.ports) busy.delete(p); }
      results.push({ ...rec, where: "batch" });
      say(rec);
    }
  };
  await Promise.all(Array.from({ length: JOBS }, worker));
  phase.batch = Date.now() - t0;
}

/*
 * 2. A test that failed beside others runs again, alone, once. Passing now it
 * is FLAKY: it holds on a quiet machine and not in company. Failing again, the
 * failure alone is the one reported.
 */
{
  const t0 = Date.now();
  const failed = results.filter((r) => r.where === "batch" && (r.result === "FAIL" || r.result === "timeout"));
  if (JOBS > 1 && failed.length) {
    console.log(`\n2. Again, alone — ${failed.length} that failed in the batch`);
    toRun += failed.length;
    for (const crowded of failed) {
      const t = plan.find((p) => p.name === crowded.name);
      const alone = await runIt(t);
      results.splice(results.indexOf(crowded), 1);
      const rec = alone.result === "pass"
        ? { ...alone, result: "flaky", crowded: crowded.s, note: `failed beside others (${crowded.result === "timeout" ? "timed out" : crowded.note}), passed alone`.slice(0, 140) }
        : alone;
      results.push({ ...rec, where: "again alone" });
      say(rec, "alone");
    }
  }
  phase.again = Date.now() - t0;
}

/* 3. The ones tagged to run alone, one at a time. */
{
  const t0 = Date.now();
  const alone = plan.filter((t) => !SKIP[t.name] && t.alone);
  if (alone.length) {
    console.log(`\n3. Tagged to run alone — ${alone.length} tests`);
    for (const t of alone) {
      const rec = await runIt(t);
      results.push({ ...rec, where: "alone (tagged)" });
      say(rec, "alone");
    }
  }
  phase.alone = Date.now() - t0;
}
for (const p of shared.values()) { try { (await p).stop(); } catch { /* never started */ } }
const wall = Date.now() - started;

/* ------------------------------------------------------------ the table */
results.sort((a, b) => a.name.localeCompare(b.name));
const tally = (r) => results.filter((x) => x.result === r).length;
const rows = results.map((r) => [r.name, r.result, r.count, r.result === "skip" ? "" : `${r.s}s${r.crowded !== undefined ? ` (${r.crowded}s beside others)` : ""}`, r.where ?? "", r.result === "pass" ? "" : r.note]);
const head = ["test", "result", "checks", "time", "run", "first failure / why skipped"];
const widths = head.map((h, i) => Math.min(i === 5 ? 90 : 60, Math.max(h.length, ...rows.map((r) => String(r[i]).length))));
const line = (cells) => cells.map((c, i) => String(c).slice(0, widths[i]).padEnd(widths[i])).join("  ").trimEnd();
console.log(`\n${line(head)}\n${widths.map((w) => "-".repeat(w)).join("  ")}`);
for (const r of rows) console.log(line(r));

const min = (ms) => `${(ms / 60000).toFixed(1)} min`;
const ran = results.filter((r) => r.result !== "skip");
const slowest = [...ran].sort((a, b) => b.s - a.s).slice(0, 10);
const names = (r) => results.filter((x) => x.result === r).map((x) => x.name);
const summary = [
  `SUMMARY: ${tally("pass")} passed, ${tally("FAIL")} failed, ${tally("flaky")} flaky (failed beside others, passed alone), ${tally("timeout")} timed out, ${tally("skip")} skipped — ${results.length} tests in ${min(wall)}`,
  `  batch ${min(phase.batch)} (${JOBS} at a time), again alone ${min(phase.again)}, tagged to run alone ${min(phase.alone)}; ${Math.round(ran.reduce((n, r) => n + r.s, 0) / 60)} min of test time in all`,
  ...(tally("FAIL") + tally("timeout") ? [`  failed: ${[...names("FAIL"), ...names("timeout")].join(", ")}`] : []),
  ...(tally("flaky") ? [`  flaky: ${names("flaky").join(", ")} (tag one "Runs alone:" in its header if it measures time or motion)`] : []),
  `  slowest ten: ${slowest.map((r) => `${r.name} ${r.s}s`).join(", ")}`,
].join("\n");
console.log(`\n${summary}`);

if (OUT) {
  const md = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`), "", "```", summary, "```", ""].join("\n");
  writeFileSync(resolve(OUT), md);
}
if (JSON_OUT) writeFileSync(resolve(JSON_OUT), `${JSON.stringify({ wall: Math.round(wall / 1000), jobs: JOBS, phases: Object.fromEntries(Object.entries(phase).map(([k, v]) => [k, Math.round(v / 1000)])), results }, null, 2)}\n`);
/* The times, for the next run's order: untracked, so a run never changes the tree. */
{
  const next = readJson(LOCAL_TIMINGS);
  for (const r of ran) if (r.s > 0) next[r.name] = r.s;
  try { writeFileSync(LOCAL_TIMINGS, `${JSON.stringify(next, null, 1)}\n`); } catch { /* not kept */ }
}

const after = treeState();
const changedTree = [...after].filter((l) => !before.has(l));
if (changedTree.length) console.log(`\nThe run changed the tree (a test should not):\n${changedTree.join("\n")}`);

process.exit(tally("FAIL") + tally("timeout") ? 1 : 0);
