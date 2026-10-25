/**
 * The GitHub way of merging, used only when the helper holds a token for
 * `sparkygogo77-spec/polio` (J hasn't chosen this yet; see route.ts).
 *
 * - Opens the PR if there isn't one for the branch.
 * - Merges only when every check on the head commit passed and GitHub says
 *   the PR is mergeable. Never by force, never a squash, never on a failed
 *   or missing check: a "merge" merge, keeping the branch.
 * - `fetch` is passed in so tests answer for GitHub; nothing here prints
 *   the token.
 */

export const REPO = "sparkygogo77-spec/polio";
export const BASE = "claude/template-ui-website-builder-11bfgl";

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export type GithubDeps = { token: string; fetch: Fetch; api?: string };

export type MergeOutcome =
  | { done: "merged"; pr: number; sha: string }
  | { done: "waiting-ci"; pr: number; why: string }
  | { done: "held"; pr: number | null; why: string };

function client(d: GithubDeps) {
  const api = d.api ?? "https://api.github.com";
  return async (path: string, method = "GET", body?: unknown) => {
    const r = await d.fetch(`${api}${path}`, {
      method,
      headers: { Authorization: `Bearer ${d.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
  };
}

/** The open PR for the branch, opened now if there isn't one. */
export async function prFor(d: GithubDeps, branch: string, title: string, body: string): Promise<number | null> {
  const gh = client(d);
  const owner = REPO.split("/")[0];
  const open = await gh(`/repos/${REPO}/pulls?state=open&head=${owner}:${encodeURIComponent(branch)}`);
  if (open.ok && Array.isArray(open.data) && open.data[0]) return open.data[0].number;
  const made = await gh(`/repos/${REPO}/pulls`, "POST", { title, body, head: branch, base: BASE });
  return made.ok ? made.data.number : null;
}

/** Every check on the commit: "passed", "pending", or "failed" with the first name that failed. */
export async function checksOf(d: GithubDeps, sha: string): Promise<{ state: "passed" | "pending" | "failed"; name?: string }> {
  const gh = client(d);
  const runs = await gh(`/repos/${REPO}/commits/${sha}/check-runs?per_page=100`);
  const list: any[] = runs.ok ? runs.data?.check_runs ?? [] : [];
  if (!list.length) return { state: "pending" };
  const bad = list.find((c) => c.status === "completed" && !["success", "neutral", "skipped"].includes(c.conclusion));
  if (bad) return { state: "failed", name: bad.name };
  if (list.some((c) => c.status !== "completed")) return { state: "pending" };
  return { state: "passed" };
}

/** Merge the PR if, and only if, its checks passed and GitHub calls it mergeable. */
export async function mergeOnGreen(d: GithubDeps, pr: number): Promise<MergeOutcome> {
  const gh = client(d);
  const got = await gh(`/repos/${REPO}/pulls/${pr}`);
  if (!got.ok) return { done: "held", pr, why: `GitHub answered ${got.status} for PR #${pr}` };
  const head: string = got.data.head.sha;
  const checks = await checksOf(d, head);
  if (checks.state === "failed") return { done: "held", pr, why: `check "${checks.name}" failed` };
  if (checks.state === "pending") return { done: "waiting-ci", pr, why: "checks still running" };
  if (got.data.mergeable === false || got.data.mergeable_state === "dirty") return { done: "held", pr, why: "it conflicts with the base branch" };
  if (got.data.mergeable == null) return { done: "waiting-ci", pr, why: "GitHub is still working out if it merges cleanly" };
  const m = await gh(`/repos/${REPO}/pulls/${pr}/merge`, "PUT", { merge_method: "merge", sha: head });
  if (!m.ok) return { done: "held", pr, why: `the merge was refused (${m.status})` };
  return { done: "merged", pr, sha: m.data?.sha ?? head };
}
