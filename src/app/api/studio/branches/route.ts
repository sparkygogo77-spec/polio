import { NextResponse } from "next/server";

/**
 * THE BRANCH LIST, and the one thing on it that cannot be undone.
 *
 * He cleans branches up by hand today: every edit opens one, every merge
 * closes one, and a branch that was opened and abandoned stays on GitHub
 * until somebody goes there. This lists them with the two facts the
 * decision is made on, whether main already has their work and how much of
 * it there is, and deletes the one he names.
 *
 * WHAT EACH BRANCH CARRIES is asked of GitHub's compare, base to branch:
 * the updates (commits) main has not got, and the lines those add and
 * remove. A branch with no updates ahead of main is one main already has,
 * whether it was merged or never touched, and it reads as such. Nothing is
 * counted here; GitHub counts, this passes it on.
 *
 * Whose token: his, `x-github-token` from the Keys panel, with the server's
 * `GITHUB_TOKEN` as the silent fallback, exactly as merge and publish do.
 * It rides with the call and is not stored.
 *
 * The default branch is never deleted from here, whatever the call says.
 */
export const runtime = "nodejs";

const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";
/** Past this many the list is a chore GitHub's own page is better at. */
const MOST = 40;
const AT_ONCE = 6;
/** Pages of a hundred read from GitHub's branch list; past that "N more" is a floor. */
const PAGES = 10;

function tokenFrom(request: Request): string | null {
  const supplied = request.headers.get("x-github-token")?.trim();
  if (supplied) return supplied;
  return process.env.GITHUB_TOKEN?.trim() || null;
}
const head = (token: string) => ({ authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" });
const NO_TOKEN = { ok: false, reason: "no-token", message: "No GitHub token. Put one in the Keys panel, or set GITHUB_TOKEN on the server." };
const REPO = /^[\w.-]+\/[\w.-]+$/;

export interface BranchRow {
  name: string;
  /** Commits main has not got. Zero means main already has everything here. */
  updates: number;
  added: number;
  removed: number;
  /** Commits main has that this branch has not: how stale it is. */
  behind: number;
}

export async function GET(request: Request) {
  const token = tokenFrom(request);
  if (!token) return NextResponse.json(NO_TOKEN);
  const repo = new URL(request.url).searchParams.get("repo")?.trim() ?? "";
  if (!REPO.test(repo)) return NextResponse.json({ ok: false, reason: "bad-repo", message: "Which repository? It wants to be owner/name." });
  try {
    const info = await fetch(`${API}/repos/${repo}`, { headers: head(token), cache: "no-store" });
    if (info.status === 404) return NextResponse.json({ ok: false, reason: "missing", message: `No repository called ${repo}, or this token cannot see it.` });
    if (info.status === 401) return NextResponse.json({ ok: false, reason: "auth", message: "GitHub rejected that token. Check it is copied whole and still active." });
    if (!info.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${info.status} when asked about ${repo}.` });
    const base = ((await info.json()) as { default_branch?: string }).default_branch || "main";

    /* GitHub hands branches out a hundred at a time, in name order: every
       page is read (up to PAGES), or "N more" stops counting at a hundred. */
    const names: string[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const list = await fetch(`${API}/repos/${repo}/branches?per_page=100&page=${page}`, { headers: head(token), cache: "no-store" });
      if (!list.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${list.status} for the branches of ${repo}.` });
      const got = (await list.json()) as { name?: string }[];
      names.push(...got.map((b) => b.name ?? "").filter((n) => n && n !== base));
      if (got.length < 100) break;
    }
    /* The branch Update live site writes to always gets a row, wherever it
       sorts: its row is the only place Merge into main is offered. */
    const own = new URL(request.url).searchParams.get("branch")?.trim() ?? "";
    const asked = names.includes(own) ? [own, ...names.filter((n) => n !== own).slice(0, MOST - 1)] : names.slice(0, MOST);
    const more = names.length - asked.length;

    const rows: BranchRow[] = [];
    for (let i = 0; i < asked.length; i += AT_ONCE) {
      const batch = await Promise.all(
        asked.slice(i, i + AT_ONCE).map(async (name): Promise<BranchRow> => {
          const cmp = await fetch(`${API}/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(name)}`, { headers: head(token), cache: "no-store" });
          if (!cmp.ok) return { name, updates: -1, added: 0, removed: 0, behind: 0 };
          const c = (await cmp.json()) as { ahead_by?: number; behind_by?: number; files?: { additions?: number; deletions?: number }[] };
          const files = c.files ?? [];
          return {
            name,
            updates: c.ahead_by ?? 0,
            behind: c.behind_by ?? 0,
            added: files.reduce((n, f) => n + (f.additions ?? 0), 0),
            removed: files.reduce((n, f) => n + (f.deletions ?? 0), 0),
          };
        }),
      );
      rows.push(...batch);
    }
    /* Unmerged work first, most of it at the top: that is the order he decides in. */
    rows.sort((a, b) => b.updates - a.updates || a.name.localeCompare(b.name));
    return NextResponse.json({ ok: true, base, branches: rows, more });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "network", message: `Could not reach GitHub: ${error instanceof Error ? error.message : "unknown"}` });
  }
}

export async function DELETE(request: Request) {
  const token = tokenFrom(request);
  if (!token) return NextResponse.json(NO_TOKEN);
  let repo = "", branch = "";
  try {
    const body = (await request.json()) as { repo?: unknown; branch?: unknown };
    repo = typeof body.repo === "string" ? body.repo.trim() : "";
    branch = typeof body.branch === "string" ? body.branch.trim() : "";
  } catch { /* caught below */ }
  if (!REPO.test(repo)) return NextResponse.json({ ok: false, reason: "bad-repo", message: "Which repository? It wants to be owner/name." });
  if (!branch) return NextResponse.json({ ok: false, reason: "bad-branch", message: "Which branch? None was named." });
  try {
    const info = await fetch(`${API}/repos/${repo}`, { headers: head(token), cache: "no-store" });
    if (!info.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${info.status} when asked about ${repo}.` });
    const base = ((await info.json()) as { default_branch?: string }).default_branch || "main";
    /* Main is the running site. It is not a branch to clean up, and no
       call from anywhere removes it here. */
    if (branch === base) return NextResponse.json({ ok: false, reason: "is-main", message: `${base} is the running site and is never deleted from here.` });

    const gone = await fetch(`${API}/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "DELETE", headers: head(token) });
    if (gone.status === 404 || gone.status === 422) return NextResponse.json({ ok: false, reason: "missing", message: `${branch} is not on GitHub any more.` });
    if (gone.status === 403) return NextResponse.json({ ok: false, reason: "protected", message: `GitHub would not delete ${branch}: it is protected, or the token cannot write here.` });
    if (!gone.ok && gone.status !== 204) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${gone.status} when asked to delete ${branch}.` });
    return NextResponse.json({ ok: true, base, branch, message: `Deleted ${branch}.` });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "network", message: `Could not reach GitHub: ${error instanceof Error ? error.message : "unknown"}` });
  }
}
