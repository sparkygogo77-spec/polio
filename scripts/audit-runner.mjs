#!/usr/bin/env node
/**
 * AUDIT AND OPTIMIZE, THE RUNNER (queue 72, 2026-11-08). No UI: this is what
 * the button will call.
 *
 * J (8 Nov), after one line in kit-check made every build pack the whole
 * project into one function (540 MB against a 500 MB limit): "stuff like
 * this should maybe be a one button check somewhere in the feature timeline
 * of the website as an audit and optimize that gives me the option to know
 * what I'm changing or optimizing/shortcutting on the feature or iteration".
 *
 * So, from the last `next build` (Turbopack, as Vercel builds; a webpack build
 * hides the problem this was written for):
 *
 *   1. MEASURE. Every function's size and what makes it big, through
 *      `scripts/function-sizes.mjs`, and the whole deployment against 500 MB.
 *   2. FIND. Each thing worth cutting, as one finding with a kind:
 *        cut       nothing is lost (a guard line that makes the bundler trace
 *                  the project; browser web pages no code opens; tests or
 *                  docs in a trace);
 *        shortcut  something is given up, said in words (one browser function
 *                  for the five routes);
 *        look      a function over its limit that no rule here explains.
 *      Every finding carries before → after bytes, the files, and what Apply
 *      would do. The runner never applies anything.
 *   3. PIN. Each finding is pinned to the feature and the date that brought
 *      it in, from git: the first commit that added the offending line, and
 *      the merge that carried that commit (`claude/<name>` → the feature's
 *      plain name). History that is not here says so instead of guessing.
 *   4. RECEIPT. `receipt.json` (for the page or the console) and `receipt.md`
 *      (short lines for J: before → after, each cut, what each shortcut
 *      gives up).
 *
 *   npm run build && node scripts/audit-runner.mjs [--root <checkout>] [--git <checkout>] [--out <dir>] [--json]
 *
 * `--root` audits another checkout's build (the base worktree, say); `--git`
 * reads history from a checkout that has it all when the built one is
 * shallow; `--out` defaults to `<root>/.next/audit`. `tests/audit-runner.mjs`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const root = resolve(arg("--root") ?? ".");
const out = resolve(arg("--out") ?? join(root, ".next", "audit"));
const MB = 1048576;
const mb = (b) => `${(b / MB).toFixed(1)} MB`;
const LIMIT = 500 * MB;
const SMALL = 8 * MB;
export const BROWSER = ["api/studio/element", "api/studio/preview-video", "api/studio/render", "api/studio/screenshot", "api/studio/zip"];

/* ------------------------------------------------------------------ */
/* 1. Measure                                                          */
/* ------------------------------------------------------------------ */

if (!existsSync(join(root, ".next", "server", "app"))) {
  console.error(`No build at ${root}: run next build first (Turbopack, as Vercel builds).`);
  process.exit(2);
}
const sizes = JSON.parse(execFileSync(process.execPath, [join(here, "function-sizes.mjs"), "--json", root], { encoding: "utf8", maxBuffer: 1 << 26 }));

/** Every function with its traced files resolved, deduplicated as function-sizes counts them. */
const functions = [];
(function walk(d) {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/[/\\](route|page)\.js\.nft\.json$/.test(p)) {
      const own = p.replace(/\.nft\.json$/, "");
      const fn = relative(join(root, ".next", "server", "app"), own).replaceAll("\\", "/").replace(/\/(route|page)\.js$/, "") || "/";
      const seen = new Set(); const files = [];
      for (const rel of JSON.parse(readFileSync(p, "utf8")).files) {
        const abs = resolve(dirname(p), rel);
        let real = abs; try { real = realpathSync(abs); } catch { /* gone */ }
        if (seen.has(real)) continue; seen.add(real);
        let size = 0; try { const s = statSync(abs); size = s.isFile() ? s.size : 0; } catch { /* gone */ }
        files.push({ rel: relative(root, abs).replaceAll("\\", "/"), size });
      }
      functions.push({ fn, bytes: sizes.functions.find((s) => s.fn === fn)?.bytes ?? files.reduce((s, f) => s + f.size, 0), files });
    }
  }
})(join(root, ".next", "server", "app"));
const total = sizes.total;
const carries = (f) => f.files.some((x) => /node_modules\/(@sparticuz\/chromium|playwright-core)\//.test(x.rel));
const sum = (fs) => fs.reduce((s, f) => s + f.size, 0);

/* ------------------------------------------------------------------ */
/* 3. Pin (used by 2)                                                  */
/* ------------------------------------------------------------------ */

/* `--git <checkout>`: pin from another checkout of the same repository when the built one is shallow. */
const gitRoot = resolve(arg("--git") ?? root);
const gitIn = (cwd, args) => { try { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
const git = (args) => gitIn(gitRoot, args);
const plainName = (branch) => branch.replace(/^.*\//, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The feature and date that brought a line (or a file) in. `-S` finds the
 * commit whose diff first added the text; the merge above it names the lane.
 * When the history kept here ends before that, say so rather than guess.
 */
export function pinOf(file, text) {
  const log = text
    ? git(["log", "--format=%H%x09%ad%x09%s", "--date=short", "-S", text, "--", file])
    : git(["log", "--format=%H%x09%ad%x09%s", "--date=short", "--diff-filter=A", "--follow", "--", file]);
  const first = log.split("\n").filter(Boolean).at(-1);
  if (!first) {
    const oldest = git(["log", "--reverse", "--format=%ad", "--date=short", "-1"]);
    return { feature: "before the history kept here", date: oldest ? `before ${oldest}` : "unknown", commit: null, certain: false };
  }
  const [commit, date, subject] = first.split("\t");
  /*
   * In a shallow clone the oldest kept commits are roots whose whole tree
   * reads as "added", so a line first seen there may be older. Say so.
   */
  const roots = new Set(git(["rev-list", "--max-parents=0", "HEAD"]).split("\n").filter(Boolean));
  if (roots.has(commit)) {
    return { feature: "before the history kept here (git fetch --unshallow to pin it)", date: `on or before ${date}`, commit: commit.slice(0, 7), certain: false };
  }
  /* The commit itself may be the merge that brought a lane in. */
  const own = /from \S+\/(claude\/\S+)/.exec(subject)?.[1];
  /*
   * Otherwise the merge that carried it: the first merge on the base line
   * (first parents of HEAD) that descends from it. Without --first-parent a
   * base-into-lane merge inside the lane would be found first.
   */
  const merge = own ? null : git(["log", "--first-parent", "--merges", "--ancestry-path", "--reverse", "--format=%ad%x09%s", "--date=short", `${commit}..HEAD`]).split("\n").filter(Boolean)[0];
  const branch = own ?? /from \S+\/(claude\/\S+)/.exec(merge ?? "")?.[1];
  return {
    feature: branch ? plainName(branch) : subject.slice(0, 80),
    date,
    merged: merge ? merge.split("\t")[0] : own ? date : null,
    commit: commit.slice(0, 7),
    certain: true,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Find                                                             */
/* ------------------------------------------------------------------ */

const findings = [];
const add = (f) => findings.push({ id: `f${findings.length + 1}`, ...f });

/* A guard that resolves process.argv makes a bundler trace the whole project. */
{
  const ARGV = /\b(resolve|join|dirname)\([^)\n]*process\.argv/;
  const hits = [];
  (function scan(d) {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      /* Folders no function carries (next.config.ts excludes tests, docs, scripts, shots) are not scanned: a guard there costs nothing. */
      if (/^(node_modules|\.next|\.git|tests|docs|scripts|public|capture|shots?|\.screenshots)$/.test(f.name)) continue;
      const p = join(d, f.name);
      if (f.isDirectory()) scan(p);
      else if (/\.(mjs|cjs|js|ts|tsx)$/.test(f.name)) {
        const src = readFileSync(p, "utf8");
        if (ARGV.test(src)) hits.push(relative(root, p).replaceAll("\\", "/"));
      }
    }
  })(root);
  if (hits.length) {
    /* Which functions carry one of these files, and what of the project rode in with it. */
    const carrying = functions.filter((fn) => fn.files.some((x) => hits.includes(x.rel)));
    const rode = (fn) => fn.files.filter((x) => x.size > 0 && !x.rel.startsWith("node_modules/") && x.rel !== "node_modules" && !x.rel.startsWith(".next/") && !x.rel.startsWith("src/") && !x.rel.startsWith("..") && !hits.includes(x.rel));
    const before = sum(carrying.flatMap((fn) => fn.files));
    const gone = carrying.reduce((s, fn) => s + sum(rode(fn)), 0);
    const pin = pinOf(hits[0], "process.argv[1]");
    const folders = [...new Set(carrying.flatMap((fn) => rode(fn).map((x) => x.rel.split("/")[0])))];
    add({
      kind: "cut",
      what: `Change how ${hits.length} tool${hits.length > 1 ? "s" : ""} spot "run from the command line" (one line each): \`import.meta.url === pathToFileURL(process.argv[1] ?? '').href\`.`,
      why: carrying.length
        ? `The old line reads a path from process.argv, which the build treats as "could be any file" and copies ${folders.join(", ")} (${mb(gone)}) into ${carrying.map((fn) => fn.fn).join(", ")}.`
        : "The old line reads a path from process.argv, which a build treats as \"could be any file\"; no function carries these tools in this build, so it costs nothing today and would cost everything the day one does.",
      loses: null,
      /* A ceiling: the packages the stray files pulled in go with them, so the real function lands lower (8 Nov: 37.2 → 1.9 MB). */
      bytes: { before, after: before - gone, ceiling: true },
      files: hits,
      functions: carrying.map((fn) => fn.fn),
      apply: "Edit the guard line in each file; regenerate src/features/studio/kitFiles.ts if kit/tools changed (npm run kit:files).",
      pin,
    });
  }
}

/* Browser tools carrying web pages no code opens. */
{
  const WEB = /^node_modules\/playwright-core\/(lib\/vite|types)\//;
  const hit = functions.map((fn) => ({ fn, pages: fn.files.filter((x) => WEB.test(x.rel)) })).filter((h) => h.pages.length);
  if (hit.length) {
    const each = sum(hit[0].pages);
    const before = sum(hit.flatMap((h) => h.fn.files));
    const gone = hit.reduce((s, h) => s + sum(h.pages), 0);
    add({
      kind: "cut",
      what: "Leave playwright's recorder, trace viewer, report pages and type files out of the browser routes (next.config.ts: include playwright-core folder by folder, exclude lib/vite/** and types/**).",
      why: `${mb(each)} in each of ${hit.length} function${hit.length > 1 ? "s" : ""} that no require ever reaches: they are web pages served only by show-trace and codegen.`,
      loses: null,
      bytes: { before, after: before - gone },
      files: ["next.config.ts"],
      functions: hit.map((h) => h.fn.fn),
      apply: "Narrow outputFileTracingIncludes for the five browser routes and add the two excludes; a test checks the installed package against the list.",
      pin: pinOf("next.config.ts", "playwright-core/**"),
    });
  }
}

/* Tests, docs, scripts or shots in a trace. */
{
  const REPO = /^(tests|docs|scripts|\.screenshots|screenshots)\//;
  const hit = functions.map((fn) => ({ fn, files: fn.files.filter((x) => REPO.test(x.rel)) })).filter((h) => h.files.length);
  if (hit.length) {
    const before = sum(hit.flatMap((h) => h.fn.files));
    const gone = hit.reduce((s, h) => s + sum(h.files), 0);
    add({
      kind: "cut",
      what: "Keep the repository's tests, docs, scripts and shots out of every function (next.config.ts outputFileTracingExcludes).",
      why: `${mb(gone)} of repository files a visitor never needs, in ${hit.map((h) => h.fn.fn).join(", ")}.`,
      loses: null,
      bytes: { before, after: before - gone },
      files: [...new Set(hit.flatMap((h) => h.files.map((x) => x.rel.split("/")[0])))],
      functions: hit.map((h) => h.fn.fn),
      apply: "Add the folders to the \"*\" exclude list.",
      pin: pinOf("next.config.ts"),
    });
  }
}

/* One browser function for the routes that open one. */
{
  const browsers = functions.filter(carries);
  if (browsers.length > 1) {
    const each = Math.round(sum(browsers.flatMap((b) => b.files)) / browsers.length);
    add({
      kind: "shortcut",
      what: `One function opens the browser for all ${browsers.length} routes (one handler; rewrites() keep the addresses).`,
      why: `Each of ${browsers.map((b) => b.fn).join(", ")} carries its own ${mb(each)} browser. One copy ends this kind of hold for good.`,
      loses: `${browsers.length} features share one door, so a slow one can queue the others; and one handler to keep ${browsers.length} routes' behaviour straight.`,
      bytes: { before: total, after: total - (browsers.length - 1) * each },
      files: browsers.map((b) => `src/app/${b.fn}/route.ts`),
      functions: browsers.map((b) => b.fn),
      apply: "A lane of its own: one route, a dispatcher by path, rewrites in next.config.ts, the five tests kept.",
      pin: pinOf("next.config.ts", "outputFileTracingIncludes"),
    });
  }
}

/* A function over its limit that no rule above explains. */
for (const fn of functions) {
  const explained = findings.some((f) => f.kind === "cut" && f.functions.includes(fn.fn));
  if (!carries(fn) && fn.bytes >= SMALL && !explained) {
    const by = new Map();
    for (const x of fn.files) { const k = x.rel.startsWith("node_modules/") ? x.rel.split("/").slice(0, x.rel.split("/")[1]?.startsWith("@") ? 3 : 2).join("/") : x.rel.split("/").slice(0, 2).join("/"); by.set(k, (by.get(k) ?? 0) + x.size); }
    const heaviest = [...by].sort((a, b) => b[1] - a[1]).slice(0, 3);
    add({
      kind: "look",
      what: `${fn.fn} is ${mb(fn.bytes)}; a function that opens no browser should be under ${mb(SMALL)}.`,
      why: `Heaviest: ${heaviest.map(([k, b]) => `${k} ${mb(b)}`).join(", ")}.`,
      loses: null,
      bytes: { before: fn.bytes, after: null },
      files: [`src/app/${fn.fn}/route.ts`],
      functions: [fn.fn],
      apply: "Nothing yet: look at what it imports.",
      pin: pinOf(`src/app/${fn.fn}/route.ts`),
    });
  }
}

/* ------------------------------------------------------------------ */
/* 4. Receipt                                                          */
/* ------------------------------------------------------------------ */

const cuts = findings.filter((f) => f.kind === "cut");
const afterCuts = total - cuts.reduce((s, f) => s + (f.bytes.before - f.bytes.after), 0);

/*
 * The features on one dated line: every lane merged onto the base line
 * (first parents, newest 150), plus any commit a finding is pinned to that
 * is not one of those. Each carries how many findings point at it and the
 * bytes its cuts would save, so a screen can draw the line with the
 * findings hanging off the feature that brought them in.
 */
const features = git(["log", "--first-parent", "--merges", "--format=%H%x09%ad%x09%s", "--date=short", "-150"]).split("\n").filter(Boolean).map((l) => {
  const [h, d, s] = l.split("\t");
  const b = /from \S+\/(claude\/\S+)/.exec(s)?.[1];
  return { name: b ? plainName(b) : s.slice(0, 60), date: d, commit: h.slice(0, 7) };
});
for (const f of findings) {
  if (!f.pin.commit || features.some((x) => x.name === f.pin.feature)) continue;
  features.push({ name: f.pin.feature, date: f.pin.date.replace(/^on or before /, ""), commit: f.pin.commit, uncertain: !f.pin.certain });
}
for (const x of features) {
  const mine = findings.filter((f) => f.pin.feature === x.name);
  x.found = mine.length;
  x.saves = mine.filter((f) => f.kind === "cut").reduce((s, f) => s + (f.bytes.before - f.bytes.after), 0);
  x.findings = mine.map((f) => f.id);
}
features.sort((a, b) => a.date.localeCompare(b.date));
const receipt = {
  kind: "polio-audit-receipt",
  version: 1,
  when: new Date().toISOString(),
  root,
  /* The built checkout's own commit and branch, whichever checkout pinned the history. */
  commit: gitIn(root, ["rev-parse", "--short", "HEAD"]) || null,
  branch: gitIn(root, ["rev-parse", "--abbrev-ref", "HEAD"]) || null,
  limit: LIMIT,
  before: { total, functions: functions.length, over: total > LIMIT },
  afterCuts: { total: afterCuts, over: afterCuts > LIMIT },
  functions: sizes.functions.map((f) => ({ fn: f.fn, bytes: f.bytes, heaviest: f.heaviest })),
  features,
  findings,
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "receipt.json"), JSON.stringify(receipt, null, 1));

const lines = [];
lines.push(`# Audit · ${receipt.branch ?? "this build"} · ${receipt.when.slice(0, 10)}`);
lines.push("");
lines.push(`Polio today: **${mb(total)}** of 500 MB (${functions.length} functions)${total > LIMIT ? " — **over the limit**" : ""}.`);
const ceiling = cuts.some((f) => f.bytes.ceiling);
if (cuts.length) lines.push(`With the ${cuts.length} safe cut${cuts.length > 1 ? "s" : ""}: ${ceiling ? "at most " : ""}**${mb(afterCuts)}**${afterCuts > LIMIT ? (ceiling ? " by this count; a cut that stops the build tracing stray files also drops the packages they pulled in, so it lands lower" : " — still over") : " — under"}.`);
else lines.push("Nothing to cut.");
const section = (title, kind) => {
  const list = findings.filter((f) => f.kind === kind);
  if (!list.length) return;
  lines.push("", `## ${title}`);
  for (const f of list) {
    lines.push("", `- [${kind === "cut" ? "x" : " "}] **${f.what}**`);
    lines.push(`  Why: ${f.why}`);
    if (f.loses) lines.push(`  Gives up: ${f.loses}`);
    if (f.bytes.after != null) lines.push(`  ${mb(f.bytes.before)} → ${f.bytes.ceiling ? "at most " : ""}${mb(f.bytes.after)}`);
    lines.push(`  Came in with: ${f.pin.feature}, ${f.pin.date}${f.pin.commit ? ` (${f.pin.commit})` : ""}`);
  }
};
section("Cuts · nothing lost", "cut");
section("Shortcuts · you give something up", "shortcut");
section("To look at", "look");
lines.push("", `Measured from the build at ${root}. Nothing here changed anything; ticked lines are the safe cuts.`);
writeFileSync(join(out, "receipt.md"), lines.join("\n") + "\n");

if (process.argv.includes("--json")) console.log(JSON.stringify(receipt, null, 1));
else console.log(lines.join("\n") + `\nWritten: ${join(out, "receipt.json")}, receipt.md`);
