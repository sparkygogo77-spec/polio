/**
 * Who owns which files: `handovers/owners.json` (proposal, section 3).
 *
 * The map is built from two places, so it stays true without anyone keeping
 * it by hand:
 * - the lane handovers (`handovers/<lane>.md`): which lane each branch
 *   belongs to (its branches table or "Branch:" line), and the PR numbers
 *   MERGE-QUEUE.md gives them;
 * - git history: every remote `claude/*` branch's files against the base
 *   (or against the open branch it is stacked on), and whether it merged.
 *
 * A branch that hasn't merged and was pushed lately is "open": its files
 * are busy, and a new lane that touches one waits. A merged lane has given
 * its files up. A folder that is new on the branch, with two or more files
 * added, is owned as `folder/*`, so a new file there belongs to the same
 * lane (the proposal's `shelf/parts/*`).
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";

/**
 * open: not merged and worked on lately; its files are busy.
 * merged: in the base (an ancestor, or its PR's merge is there and it has no
 * commits since); its files are given up.
 * stale: not merged, not queued, and untouched for `staleDays`: its session
 * is gone. Listed, never waited on.
 *
 * An open owner is either still pushing (its tip is recent: a new lane on its
 * files waits) or idle (pushed a while ago, most likely queued for merge: a
 * new lane stacks on its branch instead of waiting). `pushedAt` tells them
 * apart; the queue draws the line.
 */
export type OwnerState = "open" | "merged" | "stale";

export type Owner = {
  lane: string;
  branch: string;
  state: OwnerState;
  /** Exact paths and `folder/*` (one level) or `folder/**` (any depth). */
  owns: string[];
  /** When its tip was committed (ISO). */
  pushedAt: string;
  /** Named as an item in MERGE-QUEUE.md: it will merge, however old. */
  queued: boolean;
};

export type Owners = { v: 1; base: string; built: string; owners: Owner[] };

export const OWNERS_FILE = "owners.json";

/** True when `path` is `pattern`, or sits under a `folder/*` or `folder/**` one. */
export function matches(pattern: string, path: string): boolean {
  const p = norm(pattern), f = norm(path);
  if (p.endsWith("/**")) return f.startsWith(p.slice(0, -2));
  if (p.endsWith("/*")) {
    const dir = p.slice(0, -1);
    return f.startsWith(dir) && !f.slice(dir.length).includes("/");
  }
  return p === f;
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");

/** The open lanes that own `path`, other than `except`. */
export function busyOwners(owners: Owners, path: string, except?: string): Owner[] {
  return owners.owners.filter((o) => o.state === "open" && o.lane !== except && o.owns.some((p) => matches(p, path)));
}

export function loadOwners(file: string): Owners {
  if (!existsSync(file)) return { v: 1, base: "", built: "", owners: [] };
  const o = JSON.parse(readFileSync(file, "utf8")) as Owners;
  if (o.v !== 1 || !Array.isArray(o.owners)) throw new Error(`${file} isn't an owners map this helper knows`);
  return o;
}

export function saveOwners(file: string, o: Owners) {
  writeFileSync(file, JSON.stringify(o, null, 2) + "\n");
}

const BRANCH = /claude\/[A-Za-z0-9._/-]*[A-Za-z0-9]/g;

/**
 * The branches a handover claims as its own: those in the first two cells
 * of a table row (the branches table), and the first on a "Branch:" line.
 * Branches it only mentions (a base, another lane's) aren't claimed.
 */
export function branchesIn(handover: string): string[] {
  const out: string[] = [];
  const add = (b: string | undefined) => { if (b && !out.includes(b)) out.push(b); };
  for (const line of handover.split(/\r?\n/)) {
    if (line.trimStart().startsWith("|")) {
      for (const cell of line.split("|").slice(1, 3)) for (const m of cell.matchAll(BRANCH)) add(m[0]);
    } else if (/^\W*branch(es)?\b[^:]{0,20}:/i.test(line)) add(line.match(BRANCH)?.[0]);
  }
  return out;
}

/** Folders new on the branch with two or more files added become `folder/*`; the rest stay exact. */
export function ownedPatterns(changed: string[], added: string[], isNewDir: (dir: string) => boolean = () => true): string[] {
  const perDir = new Map<string, number>();
  for (const f of added) {
    const i = f.lastIndexOf("/");
    if (i > 0) perDir.set(f.slice(0, i), (perDir.get(f.slice(0, i)) ?? 0) + 1);
  }
  const dirs = [...perDir].filter(([d, n]) => n >= 2 && isNewDir(d)).map(([d]) => `${d}/*`);
  const exact = changed.filter((f) => !dirs.some((d) => matches(d, f)));
  return [...dirs, ...exact].sort();
}

export type Git = (...args: string[]) => string;

export function gitIn(repo: string): Git {
  return (...args) => execFileSync("git", ["-C", repo, ...args], { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }).toString();
}

/**
 * Builds the map from the repo's remote `claude/*` branches and the
 * handovers in `handoversDir`. A branch belongs to the lane whose handover
 * claims it (the handover named after the branch first), else to a lane
 * named after the branch. A branch stacked on another open branch owns
 * only its own files, counted from that branch, not the ones under it.
 */
export function buildOwners({ handoversDir, git, base, now = () => new Date(), staleDays = 3 }: {
  handoversDir: string; git: Git; base: string; now?: () => Date; staleDays?: number;
}): Owners {
  const claims = new Map<string, string>();
  const files = readdirSync(handoversDir).filter((f) => f.endsWith(".md") && !f.endsWith("-pr-body.md")).sort();
  const prOf = new Map<number, string>();
  const queued = new Set<string>();
  for (const f of files) {
    const lane = basename(f, ".md");
    const text = readFileSync(join(handoversDir, f), "utf8");
    for (const b of branchesIn(text)) {
      if (!claims.has(b) || b === `claude/${lane}`) claims.set(b, lane);
    }
    // "`claude/x` (fd8529f5, PR #398)" in MERGE-QUEUE.md and the handovers.
    for (const m of text.matchAll(/`(claude\/[A-Za-z0-9._/-]*[A-Za-z0-9])`[^`\n]{0,40}?\bPR #(\d+)/g)) prOf.set(Number(m[2]), m[1]!);
    // "12. `claude/x` (abc123). **P2 ...": a numbered item in MERGE-QUEUE.md.
    if (f === "MERGE-QUEUE.md") for (const m of text.matchAll(/^\d+\.\s+`(claude\/[A-Za-z0-9._/-]*[A-Za-z0-9])`/gm)) queued.add(m[1]!);
  }
  const baseName = base.replace(/^origin\//, "");
  const branches = lines(git("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin/claude/"))
    .map((r) => r.replace(/^origin\//, "")).filter((b) => b !== baseName);
  const merged = new Set(lines(git("for-each-ref", "--format=%(refname:short)", `--merged=${base}`, "refs/remotes/origin/claude/")).map((r) => r.replace(/^origin\//, "")));
  // A branch merged through a PR and pushed again since (a rebase), or
  // squashed, is no ancestor: the PR's commit in the base says when it went
  // in. A squash names only the PR number, which the handovers map to a branch.
  const prMerged = new Map<string, number>();
  for (const l of lines(git("log", "--first-parent", "--format=%cI %s", base))) {
    const m = l.match(/^(\S+) Merge pull request #\d+ from [^/\s]+\/(claude\/\S+)/);
    const sq = l.match(/^(\S+) .*\(#(\d+)\)$/);
    const branch = m?.[2] ?? (sq ? prOf.get(Number(sq[2])) : undefined);
    const at = m?.[1] ?? sq?.[1];
    if (branch && at && !prMerged.has(branch)) prMerged.set(branch, Date.parse(at));
  }
  const ahead = (b: string) => Number(git("rev-list", "--count", `${base}..origin/${b}`).trim());
  const owners: Owner[] = [];
  for (const branch of branches) {
    const remote = `origin/${branch}`;
    const tip = Date.parse(git("log", "-1", "--format=%cI", remote).trim());
    const isMerged = merged.has(branch) || tip <= (prMerged.get(branch) ?? -Infinity);
    const old = now().getTime() - tip > staleDays * 864e5;
    const state: OwnerState = isMerged ? "merged" : old && !queued.has(branch) ? "stale" : "open";
    // The open branch this one is stacked on: the closest open one inside it.
    let from = base;
    if (!isMerged) {
      const under = lines(git("for-each-ref", "--format=%(refname:short)", `--merged=${remote}`, "refs/remotes/origin/claude/"))
        .map((r) => r.replace(/^origin\//, "")).filter((b) => b !== branch && b !== baseName && !merged.has(b));
      const closest = under.map((b) => [b, ahead(b)] as const).sort((x, y) => y[1] - x[1])[0];
      if (closest && closest[1] < ahead(branch)) from = `origin/${closest[0]}`;
    }
    let changed: string[], added: string[];
    try {
      changed = lines(git("diff", "--name-only", `${from}...${remote}`));
      added = lines(git("diff", "--name-only", "--diff-filter=A", `${from}...${remote}`));
    } catch { continue; }
    if (!changed.length) continue;
    const isNewDir = (d: string) => lines(git("ls-tree", "-d", "--name-only", from, d)).length === 0;
    const lane = claims.get(branch) ?? branch.slice("claude/".length).replace(/\//g, "-");
    owners.push({ lane, branch, state, owns: ownedPatterns(changed, added, isNewDir), pushedAt: new Date(tip).toISOString(), queued: queued.has(branch) });
  }
  return { v: 1, base, built: now().toISOString(), owners };
}

const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Reads owners.json again only when the file changed (the queue asks often). */
export function ownersReader(file: string): () => Owners {
  let at = -1, cached: Owners | null = null;
  return () => {
    let m = -1;
    try { m = statSync(file).mtimeMs; } catch { /* missing: an empty map */ }
    if (!cached || m !== at) { at = m; cached = loadOwners(file); }
    return cached;
  };
}
