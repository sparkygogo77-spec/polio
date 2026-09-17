#!/usr/bin/env node
/**
 * What changed about the website, read out of the history rather than written
 * by hand.
 *
 * Nobody writes a changelog line per commit here — that chore was killed on
 * purpose and stays dead. This reads the same thing a person would read if
 * they went looking, and then throws most of it away, because of the one
 * absolute rule in `aboutTheSite.ts`: the website in its entirety never
 * mentions him, me, the chats, the models, or how the work is made. Only the
 * changes to the website itself.
 *
 * So what survives to the panel is one line per change and nothing else. The
 * body of a commit is the making talking to itself and never leaves here; so
 * are the corners of the tree it touched and the name of the thing it landed
 * as. A subject that is about the making rather than about the website —
 * a record regenerated, a note carried, one lane folded into another — is
 * not a change to the website and is counted out rather than shown.
 *
 * That costs real lines: a handful of true changes were written in the words
 * of the making and go with the rest. Rewriting them here would make this
 * file their author, which is the one thing it must never be, so they are
 * counted instead and the fix is upstream — a subject says what changed
 * about the website.
 *
 * The deployed build has no .git, so the answer is generated into a checked
 * in file: `npm run passes`.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { aboutTheSite } from "../src/features/studio/aboutTheSite.ts";

/** Text markers, not control characters: they survive every shell in between. */
const F = "~;~";
const R = "~@~";

const PASS_LIMIT = 24;
const CHANGE_LIMIT = 12;

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** One commit, as the fields we can say something about. */
function readCommits(range) {
  const out = git("log", range, "--no-merges", `--format=${["%h", "%aI", "%s"].join(F)}${R}`);
  return out
    .split(R)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((row) => {
      const [id, when, says] = row.split(F);
      return { id, when, says: (says ?? "").trim() };
    })
    .filter((c) => c.says && !c.says.startsWith("Merge "));
}

/**
 * What sort of change it is, from the words it uses about itself.
 *
 * Three kinds, because that is as fine as a subject line can honestly be cut
 * and because the fourth — the work under the floor — was never a change to
 * the website. Ten of the sixty-four lines the panel used to carry were that:
 * rulings recorded, notes carried, checks added. They are gone.
 */
function kindOf(says) {
  const s = says.toLowerCase();
  if (/\b(fix|fixes|fixed|broken|no longer|stops|regression|bug)\b/.test(s)) return "fixed";
  if (/\b(faster|quicker|smoother|settles|quieter|cheaper|instead of|rather than)\b/.test(s)) return "better";
  return "new";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayOf(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** One line about the website, or nothing at all. */
function shape(c) {
  if (!aboutTheSite(c.says)) return null;
  return { id: c.id, says: c.says, when: c.when, kind: kindOf(c.says) };
}

/** The first-parent spine: every merge is a pass, every direct commit a day. */
function passes() {
  const spine = git("log", "--first-parent", "--format=%h" + F + "%p" + F + "%aI" + F + "%s")
    .split("\n").map((s) => s.trim()).filter(Boolean)
    .map((row) => { const [id, parents, when, says] = row.split(F); return { id, parents: parents.split(" "), when, says }; });

  const out = [];
  let run = null; // consecutive direct commits, gathered into their day

  const flush = () => {
    if (run && (run.changes.length || run.cut)) out.push(run);
    run = null;
  };

  // What a line said that was about the making rather than the website. The
  // number is kept and shown; it is the one thing about the making the panel
  // is allowed to know, because a count is not a mention.
  const took = (list) => {
    const kept = list.map(shape).filter(Boolean);
    return { kept, cut: list.length - kept.length };
  };

  for (const node of spine) {
    if (out.length >= PASS_LIMIT) break;
    if (node.parents.length > 1) {
      flush();
      const { kept, cut } = took(readCommits(`${node.parents[0]}..${node.parents[1]}`));
      if (!kept.length && !cut) continue;
      out.push({ id: node.id, when: node.when, day: dayOf(node.when), changes: kept, cut });
    } else {
      const day = dayOf(node.when);
      if (!run || run.day !== day) { flush(); run = { id: node.id, when: node.when, day, changes: [], cut: 0 }; }
      const { kept, cut } = took(readCommits(`${node.id}~1..${node.id}`).slice(0, 1));
      run.changes.push(...kept);
      run.cut += cut;
    }
  }
  flush();

  // A pass with nothing but the same change twice is noise; keep each once.
  const told = new Set();
  return out.slice(0, PASS_LIMIT).map((p) => {
    const changes = p.changes.filter((c) => !told.has(c.says) && told.add(c.says));
    const over = Math.max(0, changes.length - CHANGE_LIMIT);
    return { id: p.id, when: p.when, day: p.day, changes: changes.slice(0, CHANGE_LIMIT), more: over + (p.cut ?? 0) };
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
const shown = found.reduce((n, p) => n + p.changes.length, 0);
const counted = found.reduce((n, p) => n + p.more, 0);
console.log(`passes: ${found.length} passes, ${shown} changes to the website, ${counted} lines counted out`);
