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

/**
 * Bringing one of his other sites in.
 *
 * "i want to be able to import a repo of my other site pretty soon to see how
 * existing repos are handled." So the repo control that connects and creates
 * also imports, and it is the same control because they are the same
 * question: which repository are we talking about.
 *
 * WHAT CAN BE BROUGHT IN, PLAINLY. The importer opens a *rendered page* and
 * measures what is on it; it has never read source code, and it does not
 * start now. So a repository with an `index.html` in it \u2014 which is what this
 * Builder publishes \u2014 comes in whole. A repository of unbuilt sources has no
 * page to open, and that is said in words rather than failing somewhere
 * further down with something obscure about a zip.
 *
 * Nothing is fetched twice: the tree is asked for once, the page and the
 * things it needs are fetched, and what comes back is the same shape the zip
 * path already understands.
 */
const PAGE = /(^|\/)index\.html?$/i;
/** What a page is allowed to bring with it, so a repository of photographs is not downloaded whole. */
const CARRIES = /\.(css|js|mjs|svg|png|jpe?g|webp|avif|gif|ico|woff2?)$/i;
const MOST = 60;

export async function PUT(request: Request) {
  const found = tokenFrom(request);
  if (!found) return NextResponse.json(NO_TOKEN);
  const { token } = found;
  const asked = new URL(request.url).searchParams.get("repo")?.trim() ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(asked)) {
    return NextResponse.json({ ok: false, reason: "name", message: "A repository is owner/name." });
  }
  try {
    const info = await fetch(`${API}/repos/${asked}`, { headers: head(token), cache: "no-store" });
    if (info.status === 404) return NextResponse.json({ ok: false, reason: "missing", message: `No repository called ${asked}, or this token cannot see it.` });
    if (info.status === 401) return NextResponse.json({ ok: false, reason: "auth", message: "GitHub rejected that token. Check it is copied whole and still active." });
    if (!info.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${info.status} for ${asked}.` });
    const branch = ((await info.json()) as { default_branch?: string }).default_branch ?? "main";

    const treeRes = await fetch(`${API}/repos/${asked}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: head(token), cache: "no-store" });
    if (!treeRes.ok) return NextResponse.json({ ok: false, reason: "upstream", message: `GitHub answered ${treeRes.status} for the file list of ${asked}.` });
    const tree = ((await treeRes.json()) as { tree?: { path: string; type: string; size?: number }[] }).tree ?? [];
    const paths = tree.filter((t) => t.type === "blob").map((t) => t.path);

    /* The page nearest the root, the way the zip path picks one. */
    const pages = paths.filter((p) => PAGE.test(p)).sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length);
    const entry = pages[0] ?? paths.filter((p) => /\.html?$/i.test(p)).sort((a, b) => a.split("/").length - b.split("/").length)[0];
    if (!entry) {
      /* Named rather than guessed at: he is owed the reason, and "it is
         sources rather than a site" is a different answer from "it is empty". */
      const source = paths.some((p) => /\.(tsx?|jsx?|vue|svelte|astro)$/i.test(p)) || paths.includes("package.json");
      return NextResponse.json({
        ok: false,
        reason: source ? "sources" : "no-page",
        message: source
          ? `${asked} is a repository of sources, not a built site: there is no HTML page in it to open. Build it first and import what the build makes, or point this at the repository a build publishes to.`
          : `There is no HTML page in ${asked} to open.`,
        files: paths.length,
      });
    }

    const dir = entry.includes("/") ? `${entry.slice(0, entry.lastIndexOf("/"))}/` : "";
    const wanted = [entry, ...paths.filter((p) => p !== entry && p.startsWith(dir) && CARRIES.test(p)).slice(0, MOST - 1)];
    const files: { name: string; body: string; base64: boolean }[] = [];
    for (const path of wanted) {
      const one = await fetch(`${API}/repos/${asked}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`, { headers: head(token), cache: "no-store" });
      if (!one.ok) continue;
      const got = (await one.json()) as { content?: string; encoding?: string };
      if (typeof got.content !== "string") continue;
      files.push({ name: path.slice(dir.length), body: got.content.replace(/\n/g, ""), base64: true });
    }
    return NextResponse.json({ ok: true, repo: asked, branch, entry: entry.slice(dir.length), files });
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
