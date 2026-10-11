import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { keyFor } from "@/app/api/keyFor";
import { shapeLines, type UpdatesAnswer } from "@/features/studio/landed";
import { PASSES } from "@/features/studio/passes.generated";
import site from "@site";

/**
 * WHAT HAS LANDED, CURRENT WITHOUT ANYONE REGENERATING A FILE.
 *
 * The panel read `passes.generated.ts`, written by `npm run passes` from the
 * history and checked in, because a Vercel build has no `.git` to read. Nobody
 * ran it after 21 September, so the panel stopped at "V1.6" while trunk moved
 * on by hundreds of changes. A file someone has to remember is a file that
 * goes stale.
 *
 * So the list is asked for when the panel opens, newest first, one line per
 * change that reached trunk, in the change's own words, from:
 *
 *   1. GitHub's commits API, from the very commit this deployment was built
 *      from (`VERCEL_GIT_COMMIT_SHA`), so the list is exactly what is live and
 *      no deeper or shallower than trunk's own history, whatever depth Vercel
 *      cloned at. The answer for one commit never changes, so it is kept in
 *      this function's memory for as long as it lives, and the CDN may keep it
 *      for ten minutes; a list asked by branch name is kept ten minutes.
 *   2. `git log` where there is a `.git` (a laptop, a test run).
 *   3. The saved snapshot, `passes.generated.ts`, flattened, and said to be
 *      the saved one with its date, when neither can answer.
 *
 * The browser's key (`x-github-token`) is used when it offers one, else the
 * server's `GITHUB_TOKEN` (`keyFor`), else none, which a public repository
 * needs. No token ever comes back. The line filter is the one the snapshot
 * always used (`aboutTheSite`): a subject about the making, not the
 * website, is counted rather than shown.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";
const PAGES = 3;
const FOR = 10 * 60_000;

const env = (name: string) => process.env[name]?.trim() || null;

/** The repository this Builder was built from: Vercel says, or `UPDATES_REPO`, or the site's own. */
function builderRepo(): string | null {
  const owner = env("VERCEL_GIT_REPO_OWNER");
  const slug = env("VERCEL_GIT_REPO_SLUG");
  if (owner && slug) return `${owner}/${slug}`;
  const named = env("UPDATES_REPO");
  if (named && /^[\w.-]+\/[\w.-]+$/.test(named)) return named;
  const m = /github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(String((site as { repository?: string }).repository ?? ""));
  return m?.[1] ?? null;
}

const kept = new Map<string, { at: number; forever: boolean; rows: { id: string; says: string; when: string; parents: number }[] }>();

async function fromGitHub(repo: string, from: string, token: string | null, pinned: boolean) {
  const key = `${repo}@${from}`;
  const hit = kept.get(key);
  if (hit && (hit.forever || Date.now() - hit.at < FOR)) return hit.rows;
  const rows: { id: string; says: string; when: string; parents: number }[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const res = await fetch(`${API}/repos/${repo}/commits?sha=${encodeURIComponent(from)}&per_page=100&page=${page}`, {
      headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      if (page > 1) break;
      throw new Error(`GitHub answered ${res.status}${res.status === 404 ? " (the repository is private or unknown to this key)" : res.status === 403 || res.status === 429 ? " (its limit on questions without a key is used up)" : ""}`);
    }
    const list = (await res.json()) as { sha: string; parents?: unknown[]; commit?: { message?: string; committer?: { date?: string }; author?: { date?: string } } }[];
    for (const c of list) rows.push({ id: c.sha, says: c.commit?.message ?? "", when: c.commit?.committer?.date ?? c.commit?.author?.date ?? "", parents: c.parents?.length ?? 1 });
    if (list.length < 100) break;
  }
  kept.set(key, { at: Date.now(), forever: pinned, rows });
  return rows;
}

function fromGit(): { id: string; says: string; when: string; parents: number }[] {
  const out = execFileSync("git", ["log", "-300", "--format=%H%x1f%P%x1f%cI%x1f%s%x1e"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 });
  return out.split("\x1e").map((s) => s.trim()).filter(Boolean).map((row) => {
    const [id, parents, when, says] = row.split("\x1f");
    return { id: id!, parents: (parents ?? "").split(" ").filter(Boolean).length, when: when!, says: says ?? "" };
  });
}

function fromSaved(): { id: string; says: string; when: string }[] {
  return PASSES.flatMap((p) => p.changes.map((c) => ({ id: c.id, says: c.says, when: c.when })));
}

export async function GET(request: Request) {
  const commit = env("VERCEL_GIT_COMMIT_SHA") ?? env("GIT_COMMIT_SHA");
  const branch = env("VERCEL_GIT_COMMIT_REF") ?? env("GIT_BRANCH");
  const live = { commit, short: commit ? commit.slice(0, 7) : null, branch, builtAt: process.env.BUILD_TIME ?? null };
  const repo = builderRepo();
  const picked = keyFor(request, "x-github-token");
  const token = picked?.key ?? null;
  let note: string | undefined;

  /* A test run's GitHub is a stand-in; a real one is asked only where the deployment says which commit it is, or a branch is named. */
  const from = commit ?? branch;
  if (repo && from) {
    try {
      const rows = await fromGitHub(repo, from, token, !!commit);
      const shaped = shapeLines(rows);
      const body: UpdatesAnswer = { live, source: "github", changes: shaped.changes, counted: shaped.counted };
      return NextResponse.json(body, { headers: { "cache-control": picked?.source === "browser" ? "private, max-age=600" : "public, s-maxage=600, stale-while-revalidate=86400" } });
    } catch (err) {
      note = `GitHub could not be asked for the newest changes (${err instanceof Error ? err.message : "no answer"}).`;
    }
  }
  try {
    const shaped = shapeLines(fromGit());
    if (shaped.changes.length) {
      const body: UpdatesAnswer = { live: { ...live, commit: live.commit ?? null }, source: "git", changes: shaped.changes, counted: shaped.counted, ...(note ? { note } : {}) };
      return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
    }
  } catch { /* no .git here: a deployed build */ }
  const shaped = shapeLines(fromSaved());
  const saved = PASSES[0]?.day;
  const body: UpdatesAnswer = {
    live,
    source: "saved",
    changes: shaped.changes,
    counted: shaped.counted,
    note: `${note ? `${note} ` : ""}Showing the list saved${saved ? ` on ${saved}` : ""}, which may be missing the newest changes.`,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
