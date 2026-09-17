"use client";
/**
 * Fetching a repository's website, in the browser, with his own token.
 *
 * WHY THE BROWSER. The token is his and it is never to reach our server —
 * that rule is older than this feature and this is the first place it
 * would have been tempting to break, because a server could have cloned
 * the repository in one call. So the browser asks GitHub directly, the way
 * `tryHere.ts` already proves it can, and what our own route receives is a
 * zip and nothing else. A private repository works exactly as a public one
 * does, and there is nothing to leak because nothing was sent.
 *
 * WHY THE FILES RATHER THAN THE ZIPBALL. GitHub's zipball redirects to
 * codeload, which sends no CORS headers, so a browser cannot read it. The
 * tree and the blobs are ordinary API calls that a browser can read, and
 * they let this take only what a browser would ask for while drawing the
 * page — the HTML, the stylesheets, the pictures, the faces — instead of
 * the whole project. The zip is then written here (`zipOf`) and handed to
 * the route that already opens zips.
 *
 * Every ending is a sentence. A repository with no page in it, a token
 * that is not there, a repository too big to be a page: each is said,
 * named, and nothing is half-brought.
 */
import { MAX_REPO_BYTES, MAX_REPO_FILES, REPO_REFUSAL_SAYS, pageIn, wanted, zipOf, type Repo, type RepoRefusal } from "./repoImport";

const API = "https://api.github.com";

export interface RepoRead {
  /** The repository's site, packed the way the zip route reads one. */
  file: File;
  /** Which file in the repository is the page. */
  entry: string;
  /** What came, and what it weighs. */
  files: number;
  bytes: number;
  /** The branch, tag or commit actually read. */
  ref: string;
}

export interface RepoNo {
  no: RepoRefusal;
  says: string;
}

const isNo = (r: unknown): r is RepoNo => !!r && typeof r === "object" && "no" in (r as RepoNo);
export { isNo as refused };

/** One GitHub call, with his token, answering with the shape or a reason. */
async function gh(path: string, token: string): Promise<unknown | RepoNo> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    });
  } catch {
    return { no: "github", says: "GitHub could not be reached from this browser." };
  }
  if (res.status === 404) return { no: "github", says: "GitHub has no such repository, or this token cannot see it." };
  if (res.status === 401 || res.status === 403) return { no: "github", says: "GitHub refused that token. Check it under Keys (⌘⇧K)." };
  if (!res.ok) return { no: "github", says: `GitHub answered ${res.status}.` };
  try {
    return (await res.json()) as unknown;
  } catch {
    return { no: "github", says: "GitHub's answer was not readable." };
  }
}

/** Base64 to bytes, without a round trip through a data URL. */
function unbase64(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * The repository's site, as a zip this app can open.
 *
 * `say` is called with a line as each stage begins, because this is a
 * dozen calls over somebody's connection and a spinner with no words is
 * how a minute feels like a failure.
 */
export async function readRepoSite(repo: Repo, token: string, say: (line: string) => void): Promise<RepoRead | RepoNo> {
  if (!token) return { no: "no-token", says: REPO_REFUSAL_SAYS["no-token"] };

  let ref = repo.ref;
  let homepage = "";
  if (!ref) {
    say("Asking GitHub which branch is the default…");
    const info = await gh(`/repos/${repo.owner}/${repo.name}`, token);
    if (isNo(info)) return info;
    const it = info as { default_branch?: string; homepage?: string };
    ref = it.default_branch || "main";
    homepage = (it.homepage ?? "").trim();
  }

  say(`Reading what is in ${repo.owner}/${repo.name}…`);
  const tree = await gh(`/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
  if (isNo(tree)) return tree;
  const entries = ((tree as { tree?: unknown[] }).tree ?? []).filter(
    (e): e is { path: string; type: string; sha: string; size?: number } =>
      !!e && typeof e === "object" && typeof (e as { path?: unknown }).path === "string",
  );
  const blobs = entries.filter((e) => e.type === "blob");
  const paths = blobs.map((e) => e.path);

  const page = pageIn(paths);
  if (!page) {
    /*
     * No page in it. That is not a failure to hide: it is a project that
     * has to be built before it is a website, and the honest answer names
     * what was actually found and where the built one probably lives.
     */
    const kinds = [...new Set(paths.map((p) => (p.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase()).filter(Boolean))];
    return {
      no: "no-page",
      says: `${REPO_REFUSAL_SAYS["no-page"]}${kinds.length ? ` What is in it: ${kinds.slice(0, 8).join(", ")}.` : ""}${homepage ? ` Its own page says it is deployed at ${homepage} — read that address instead.` : ""}`,
    };
  }

  const keep = wanted(paths);
  const want = new Map(blobs.filter((e) => keep.includes(e.path)).map((e) => [e.path, e]));
  // The page itself always comes, whatever the filter thought of its name.
  if (!want.has(page)) {
    const it = blobs.find((e) => e.path === page);
    if (it) want.set(page, it);
  }
  if (want.size > MAX_REPO_FILES) return { no: "too-big", says: `${REPO_REFUSAL_SAYS["too-big"]} It has ${want.size} files a page would ask for, and this reads ${MAX_REPO_FILES}.` };
  const weight = [...want.values()].reduce((n, e) => n + (e.size ?? 0), 0);
  if (weight > MAX_REPO_BYTES) return { no: "too-big", says: `${REPO_REFUSAL_SAYS["too-big"]} Its page and what it uses come to ${Math.round(weight / 1024 / 1024)} MB.` };

  const list = [...want.values()];
  const got: { name: string; bytes: Uint8Array }[] = [];
  const AT_ONCE = 6;
  for (let i = 0; i < list.length; i += AT_ONCE) {
    say(`Fetching the page and what it uses… ${Math.min(i + AT_ONCE, list.length)} of ${list.length}`);
    const batch = await Promise.all(
      list.slice(i, i + AT_ONCE).map(async (e) => {
        const blob = await gh(`/repos/${repo.owner}/${repo.name}/git/blobs/${e.sha}`, token);
        if (isNo(blob)) return blob;
        const it = blob as { content?: string; encoding?: string };
        if (it.encoding !== "base64" || typeof it.content !== "string") return { no: "github" as const, says: `GitHub would not hand over ${e.path}.` };
        return { name: e.path, bytes: unbase64(it.content) };
      }),
    );
    for (const one of batch) {
      if (isNo(one)) return one;
      got.push(one);
    }
  }

  say("Packing it…");
  const zip = zipOf(got);
  const name = `${repo.owner}-${repo.name}.zip`;
  return {
    file: new File([zip as BlobPart], name, { type: "application/zip" }),
    entry: page,
    files: got.length,
    bytes: zip.length,
    ref,
  };
}
