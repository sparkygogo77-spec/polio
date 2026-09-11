#!/usr/bin/env node
/**
 * What landed, read out of the history rather than written by hand.
 *
 * Nobody writes a changelog line per commit here — that chore was killed on
 * purpose and stays dead. This reads the same thing a person would read if
 * they went looking: the merges into this branch, and the commits each one
 * brought with it. A merge is a **pass**; the commits inside it are the
 * **features**, because the merge subjects themselves say nothing you could
 * use ("Merge remote-tracking branch ..."). Commits that landed straight on
 * the branch are grouped by the day they landed, which is the same shape.
 *
 * The deployed build has no .git, so the answer is generated into a checked
 * in file: `npm run passes`.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

/** Text markers, not control characters: they survive every shell in between. */
const F = "~;~";
const R = "~@~";

const PASS_LIMIT = 24;
const CHANGE_LIMIT = 12;
const DETAIL_LINES = 4;

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** One commit, as the fields we can say something about. */
function readCommits(range) {
  const out = git("log", range, "--no-merges", `--format=${["%h", "%an", "%aI", "%s", "%b"].join(F)}${R}`);
  return out
    .split(R)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((row) => {
      const [id, who, when, says, body] = row.split(F);
      return { id, who, when, says: (says ?? "").trim(), body: (body ?? "").trim() };
    })
    .filter((c) => c.says && !c.says.startsWith("Merge "));
}

/** Which corners of the repo a commit touched, in names a person uses. */
function areasOf(id) {
  const files = git("show", "--name-only", "--format=", id).split("\n").map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  for (const f of files) {
    const feature = f.match(/^src\/features\/([^/]+)/);
    if (feature) { seen.add(feature[1]); continue; }
    if (f.startsWith("src/core/")) { seen.add("core"); continue; }
    if (f.startsWith("tests/")) { seen.add("tests"); continue; }
    if (f.startsWith("scripts/")) { seen.add("scripts"); continue; }
    if (f.startsWith("docs/") || f.endsWith(".md")) { seen.add("docs"); continue; }
    if (f.startsWith("src/app/")) { seen.add("pages"); continue; }
  }
  return [...seen].sort();
}

/**
 * What sort of change it is, from the words it uses about itself.
 *
 * Four kinds, because that is as fine as a subject line can honestly be cut:
 * something new you can do, something that got better, something that was
 * broken and is not, and the work under the floor.
 */
function kindOf(says, areas) {
  const s = says.toLowerCase();
  if (/\b(fix|fixes|fixed|broken|no longer|stops|regression|bug)\b/.test(s)) return "fixed";
  if (areas.length && areas.every((a) => a === "docs" || a === "tests" || a === "scripts")) return "under";
  if (/\b(agents\.md|readme|audit|docs|typecheck|lint|refactor|rename)\b/.test(s)) return "under";
  if (/\b(faster|quicker|smoother|settles|quieter|cheaper|instead of|rather than)\b/.test(s)) return "better";
  return "new";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayOf(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * The body, as whole thoughts rather than the lines a terminal wrapped it to.
 *
 * Commit bodies are hard wrapped at 72 columns, so slicing by line cuts
 * sentences in half. Paragraphs are the unit a person reads; a blank line or
 * a bullet starts a new one.
 */
function paragraphs(body) {
  const out = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const trailer = !line
      || /^(Co-Authored-By|Claude-Session|Signed-off-by)\b/i.test(line)
      || line.startsWith("https://claude.ai/code")
      || /^Generated with /i.test(line);
    if (trailer) { if (!line) out.push(null); continue; }
    const bullet = /^[-*·]\s+/.test(line);
    const last = out[out.length - 1];
    if (bullet || last == null) out.push(line.replace(/^[-*·]\s+/, ""));
    else out[out.length - 1] = `${last} ${line}`;
  }
  return out.filter(Boolean).slice(0, DETAIL_LINES);
}

function shape(c) {
  const areas = areasOf(c.id);
  return { id: c.id, says: c.says, when: c.when, detail: paragraphs(c.body), areas, kind: kindOf(c.says, areas) };
}

/** The first-parent spine: every merge is a pass, every direct commit a day. */
function passes() {
  const spine = git("log", "--first-parent", "--format=%h" + F + "%p" + F + "%aI" + F + "%s")
    .split("\n").map((s) => s.trim()).filter(Boolean)
    .map((row) => { const [id, parents, when, says] = row.split(F); return { id, parents: parents.split(" "), when, says }; });

  const out = [];
  let run = null; // consecutive direct commits, gathered into their day

  const flush = () => {
    if (run && run.changes.length) out.push(run);
    run = null;
  };

  for (const node of spine) {
    if (out.length >= PASS_LIMIT) break;
    if (node.parents.length > 1) {
      flush();
      const brought = readCommits(`${node.parents[0]}..${node.parents[1]}`).map(shape);
      if (!brought.length) continue;
      out.push({ id: node.id, when: node.when, day: dayOf(node.when), changes: brought });
    } else {
      const day = dayOf(node.when);
      if (!run || run.day !== day) { flush(); run = { id: node.id, when: node.when, day, changes: [] }; }
      const commits = readCommits(`${node.id}~1..${node.id}`);
      if (commits.length) run.changes.push(shape(commits[0]));
    }
  }
  flush();

  // A pass with nothing but the same change twice is noise; keep each once.
  const told = new Set();
  return out.slice(0, PASS_LIMIT).map((p) => {
    const changes = p.changes.filter((c) => !told.has(c.says) && told.add(c.says));
    return { ...p, more: Math.max(0, changes.length - CHANGE_LIMIT), changes: changes.slice(0, CHANGE_LIMIT) };
  }).filter((p) => p.changes.length);
}

const found = passes();
const file = `// Generated by \`npm run passes\` from the history itself. Do not edit by hand.
// Regenerate after a merge; the deployed build has no .git to read.
import type { Pass } from "./passes.ts";

export const GENERATED_AT = ${JSON.stringify(new Date().toISOString())};

export const PASSES: Pass[] = ${JSON.stringify(found, null, 2)};
`;
writeFileSync("src/features/studio/passes.generated.ts", file);
console.log(`passes: ${found.length} passes, ${found.reduce((n, p) => n + p.changes.length, 0)} changes`);
