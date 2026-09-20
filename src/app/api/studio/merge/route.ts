import { NextResponse } from "next/server";

/**
 * THE MERGE BUTTON. Main moves here and nowhere else, and only by his hand.
 *
 * HIS DESIGN: a site that has a repository takes an edit branch the moment
 * it is edited, every Publish goes there, and a SEPARATE button merges it.
 * This is that button's other end: GitHub's own merge of the branch into
 * the default branch, with his token, then the branch is deleted so the next
 * edit opens a fresh one. Nothing here is automatic — there is no schedule,
 * no hook, no "merge after publish"; it runs when this route is called, and
 * the only caller is the button.
 *
 * Whose token: his, `x-github-token` from the Keys panel, with the server's
 * `GITHUB_TOKEN` as the silent fallback — exactly as publish and create do.
 * It rides with the call and is not stored.
 */
export const runtime = "nodejs";

const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";

function tokenFrom(request: Request): string | null {
  const supplied = request.headers.get("x-github-token")?.trim();
  if (supplied) return supplied;
  return process.env.GITHUB_TOKEN?.trim() || null;
}
const head = (token: string) => ({ authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" });

export async function POST(request: Request) {
  const token = tokenFrom(request);
  if (!token) return NextResponse.json({ ok: false, reason: "no-token", message: "No GitHub token. Put one in the Keys panel, or set GITHUB_TOKEN on the server." });
  let repo = "", branch = "";
  try {
    const body = (await request.json()) as { repo?: unknown; branch?: unknown };
    repo = typeof body.repo === "string" ? body.repo.trim() : "";
    branch = typeof body.branch === "string" ? body.branch.trim() : "";
  } catch { /* caught below */ }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return NextResponse.json({ ok: false, reason: "bad-repo", message: "Which repository? It wants to be owner/name." });
  if (!branch || branch === "main" || branch === "master") return NextResponse.json({ ok: false, reason: "bad-branch", message: "There is no edit branch open to merge." });

  try {
    const info = await fetch(`${API}/repos/${repo}`, { headers: head(token), cache: "no-store" });
    if (!info.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${info.status} when asked about ${repo}.` });
    const base = ((await info.json()) as { default_branch?: string }).default_branch || "main";

    const merged = await fetch(`${API}/repos/${repo}/merges`, {
      method: "POST",
      headers: { ...head(token), "content-type": "application/json" },
      body: JSON.stringify({ base, head: branch, commit_message: `Merge ${branch} into ${base}` }),
    });
    if (merged.status === 409) return NextResponse.json({ ok: false, reason: "conflict", message: `${branch} and ${base} have both changed the same files. Resolve it on GitHub, then merge again.` });
    if (merged.status === 404) return NextResponse.json({ ok: false, reason: "missing", message: `${branch} is not on GitHub yet. Publish once so there is something to merge.` });
    if (merged.status === 204) return NextResponse.json({ ok: true, base, branch, nothing: true, message: `${base} already has everything on ${branch}.` });
    if (!merged.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${merged.status} when asked to merge.` });

    /* The branch has done its job. Deleting it is what makes the next edit
       open a fresh one rather than piling onto a branch already merged. */
    await fetch(`${API}/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "DELETE", headers: head(token) }).catch(() => null);
    const sha = ((await merged.json()) as { sha?: string }).sha ?? null;
    return NextResponse.json({ ok: true, base, branch, sha, message: `Merged ${branch} into ${base}. The running site will pick it up on its next deploy.` });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "network", message: `Could not reach GitHub: ${error instanceof Error ? error.message : "unknown"}` });
  }
}
