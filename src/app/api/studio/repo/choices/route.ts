import { NextResponse } from "next/server";

/**
 * What a repository offers to be brought in from: its branches, the default
 * one first, and the sites kept in its `sites/<name>` folders on the branch
 * asked about. The repo menu shows these as choices, so nobody has to type
 * `owner/name@branch/sites/name`.
 *
 * Read with the person's own token when the browser holds one, the server's
 * otherwise, exactly as the repository list next door is.
 */
export const runtime = "nodejs";

const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";
const REPO = /^[\w.-]+\/[\w.-]+$/;

function tokenFrom(request: Request): string | null {
  const supplied = request.headers.get("x-github-token")?.trim();
  if (supplied) return supplied;
  return process.env.GITHUB_TOKEN?.trim() || null;
}
const head = (token: string) => ({ authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" });

export async function GET(request: Request) {
  const token = tokenFrom(request);
  if (!token) return NextResponse.json({ ok: false, reason: "no-token", message: "No GitHub token yet. Put one in the Keys panel." });
  const q = new URL(request.url).searchParams;
  const repo = q.get("repo")?.trim() ?? "";
  if (!REPO.test(repo)) return NextResponse.json({ ok: false, reason: "bad-repo", message: "Which repo? It wants to be owner/name." });
  try {
    const info = await fetch(`${API}/repos/${repo}`, { headers: head(token), cache: "no-store" });
    if (info.status === 404) return NextResponse.json({ ok: false, reason: "missing", message: `No repo called ${repo}, or this token cannot see it.` });
    if (!info.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${info.status} about ${repo}.` });
    const base = ((await info.json()) as { default_branch?: string }).default_branch || "main";
    const ref = q.get("ref")?.trim() || base;
    const [listed, folder] = await Promise.all([
      fetch(`${API}/repos/${repo}/branches?per_page=100`, { headers: head(token), cache: "no-store" }),
      fetch(`${API}/repos/${repo}/contents/sites?ref=${encodeURIComponent(ref)}`, { headers: head(token), cache: "no-store" }),
    ]);
    const names = listed.ok ? ((await listed.json()) as { name?: string }[]).map((b) => b.name ?? "").filter(Boolean) : [];
    const branches = [base, ...names.filter((n) => n !== base)];
    const entries = folder.ok ? ((await folder.json()) as { type?: string; name?: string }[]) : [];
    const sites = Array.isArray(entries) ? entries.filter((e) => e.type === "dir" && e.name).map((e) => `sites/${e.name}`) : [];
    return NextResponse.json({ ok: true, base, ref, branches, sites });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable", message: "GitHub could not be reached." });
  }
}
