import { NextResponse } from "next/server";
import { nameRefusal } from "@/features/studio/repoName";

/**
 * HIS REPOSITORIES: the one this site points at, and making a new one.
 *
 * HIS WORDS: "how do i create a new repo from the site, it should be
 * apparent to connect repo". The connecting existed and was unreachable; the
 * MAKING did not exist at all. Publishing pushes to a repository named by
 * `GITHUB_REPO` and fails when that repository is not there — nothing in the
 * product had ever created one, so the honest answer to his question was no.
 * This is what makes it yes.
 *
 * **Whose token.** His. `x-github-token`, typed into the Keys panel and held
 * in his browser, exactly as the publish route takes it; `GITHUB_TOKEN` on
 * the server is the silent fallback for a deployment that has one. No key of
 * his is stored here: it rides with the call and is gone when it returns.
 *
 * **Whose account.** His. A repository is made under the token's own owner,
 * read back from `/user`, rather than under a name this file chooses.
 *
 * Two things it does:
 *
 *   GET   what the token can see: who it belongs to, and their repositories,
 *         newest first, so the panel can offer him a list to connect to
 *         rather than asking him to type a name he has to remember.
 *   POST  make one, with the name he typed. Private by default, because a
 *         site that has not been published is not his to have published for
 *         him, and `auto_init` so the first push has something to push onto.
 */
export const runtime = "nodejs";

/**
 * `GITHUB_API` is unset everywhere but a test run, where it points at a stub.
 * The same seam the publish route uses, so both are exercised the same way.
 */
const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";

function tokenFrom(request: Request): { token: string; source: "browser" | "server" } | null {
  const supplied = request.headers.get("x-github-token")?.trim();
  if (supplied) return { token: supplied, source: "browser" };
  const own = process.env.GITHUB_TOKEN?.trim();
  return own ? { token: own, source: "server" } : null;
}

const head = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
});

/** No token is not an error: it is the panel's first sentence. */
const NO_TOKEN = {
  ok: false as const,
  reason: "no-token" as const,
  message: "No GitHub token yet. Put one in the Keys panel and this can list your repositories and make new ones.",
};

export async function GET(request: Request) {
  const t = tokenFrom(request);
  if (!t) return NextResponse.json(NO_TOKEN);
  try {
    const who = await fetch(`${API}/user`, { headers: head(t.token), cache: "no-store" });
    if (who.status === 401) return NextResponse.json({ ok: false, reason: "auth", message: "GitHub rejected that token. Check it is copied whole and still active." });
    if (!who.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${who.status} when asked who the token belongs to.` });
    const me = (await who.json()) as { login?: string };
    const list = await fetch(`${API}/user/repos?per_page=100&sort=pushed`, { headers: head(t.token), cache: "no-store" });
    const repos = list.ok ? ((await list.json()) as { full_name?: string; private?: boolean; pushed_at?: string }[]) : [];
    return NextResponse.json({
      ok: true,
      source: t.source,
      owner: me.login ?? null,
      repos: repos.map((r) => ({ name: r.full_name ?? "", private: r.private === true, pushed: r.pushed_at ?? null })).filter((r) => r.name),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "network", message: `Could not reach GitHub: ${error instanceof Error ? error.message : "unknown"}` });
  }
}

export async function POST(request: Request) {
  const t = tokenFrom(request);
  if (!t) return NextResponse.json(NO_TOKEN);
  let name = "";
  let priv = true;
  try {
    const body = (await request.json()) as { name?: unknown; private?: unknown };
    name = typeof body.name === "string" ? body.name.trim() : "";
    priv = body.private !== false;
  } catch { /* no body: caught by the refusal below */ }

  const refusal = nameRefusal(name);
  if (refusal) return NextResponse.json({ ok: false, reason: "name", message: refusal });

  try {
    const made = await fetch(`${API}/user/repos`, {
      method: "POST",
      headers: { ...head(t.token), "content-type": "application/json" },
      /* `auto_init` so there is a commit to push onto: a repository with no
         branch takes no push, and the first thing he does after making one
         is publish to it. */
      body: JSON.stringify({ name, private: priv, auto_init: true, description: "Made from the builder." }),
    });
    if (made.status === 401) return NextResponse.json({ ok: false, reason: "auth", message: "GitHub rejected that token. Check it is copied whole and still active." });
    if (made.status === 403) return NextResponse.json({ ok: false, reason: "scope", message: "That token is not allowed to make repositories. It needs the `repo` scope." });
    if (made.status === 422) return NextResponse.json({ ok: false, reason: "taken", message: `You already have a repository called ${name}. Connect to it instead, or pick another name.` });
    if (!made.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${made.status} when asked to make it.` });
    const repo = (await made.json()) as { full_name?: string; default_branch?: string; private?: boolean };
    return NextResponse.json({
      ok: true,
      name: repo.full_name ?? name,
      branch: repo.default_branch ?? "main",
      private: repo.private !== false,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "network", message: `Could not reach GitHub: ${error instanceof Error ? error.message : "unknown"}` });
  }
}
