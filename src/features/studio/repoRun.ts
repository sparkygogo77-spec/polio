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
import { MADE_HERE, MAX_REPO_BYTES, MAX_REPO_FILES, REPO_REFUSAL_SAYS, madeHere, noPageSays, pageAddress, pageIn, wanted, zipOf, type Repo, type RepoRefusal } from "./repoImport";

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

/**
 * A site made here, read whole: its document, exactly as published, and
 * the pictures it names, so a copy is the site and not a reading of it.
 */
export interface RepoCopy {
  document: Record<string, unknown>;
  /** What the site calls itself, from its brief, or the repository's name. */
  name: string;
  pages: number;
  parts: number;
  /** Each picture the document names that the repository holds, with its bytes. */
  pictures: { path: string; id: string; bytes: Uint8Array; type: string }[];
  /** Pictures the document names that the repository does not hold. */
  lost: string[];
  ref: string;
}

/**
 * Any other repository, deployed: read at that address, because that is
 * the site as it renders. `filesToo` says a page file is in the repository
 * as well, for the caller to fall back on and say so if the address
 * cannot be read.
 */
export interface RepoAt {
  at: string;
  why: "root" | "site";
  ref: string;
  filesToo: boolean;
}

export interface RepoNo {
  no: RepoRefusal;
  says: string;
  /**
   * For `no-page` only: the address GitHub's About line says the repository
   * is deployed at, so the caller can read the page there instead. Null when
   * the line is empty; the caller may know a better one of its own.
   */
  deployedAt?: string | null;
  /** For `no-page` only: the address of its PAGE, which for a site made here is /site of the deployment, not its root. */
  pageAt?: string | null;
  pageWhy?: "site" | "root" | "none";
  /** For `no-page` only: the repository carries the document a publish from here leaves. */
  madeHere?: boolean;
}

const isNo = (r: unknown): r is RepoNo => !!r && typeof r === "object" && "no" in (r as RepoNo);
export { isNo as refused };
export const isCopy = (r: unknown): r is RepoCopy => !!r && typeof r === "object" && "document" in (r as RepoCopy);
export const isAt = (r: unknown): r is RepoAt => !!r && typeof r === "object" && "at" in (r as RepoAt) && "filesToo" in (r as RepoAt);

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

/** How many pictures a copy brings across before the rest are named as left behind. */
const MOST_PICTURES = 40;

/**
 * The document, and the pictures it names.
 *
 * Null when the document is not there or is not a document, and the caller
 * falls through to reading the page. A picture the tree does not hold is
 * named rather than fetched blind; past `MOST_PICTURES` or the byte cap,
 * the rest are named too, so the copy says what it left behind.
 */
async function copyOf(repo: Repo, token: string, ref: string, blobs: { path: string; sha: string; size?: number }[], say: (line: string) => void): Promise<RepoCopy | null> {
  const at = blobs.find((e) => e.path === MADE_HERE);
  if (!at) return null;
  const blob = await gh(`/repos/${repo.owner}/${repo.name}/git/blobs/${at.sha}`, token);
  if (isNo(blob)) return null;
  const it = blob as { content?: string; encoding?: string };
  if (it.encoding !== "base64" || typeof it.content !== "string") return null;
  let document: Record<string, unknown>;
  try {
    document = JSON.parse(new TextDecoder().decode(unbase64(it.content))) as Record<string, unknown>;
  } catch {
    return null;
  }
  const pages = Array.isArray(document.pages) ? (document.pages as unknown[]).length : 0;
  const nodes = Array.isArray(document.nodes) ? (document.nodes as { picture?: { id?: unknown; path?: unknown; type?: unknown } }[]) : [];
  if (!pages || !Array.isArray(document.nodes)) return null;
  const brief = document.brief as { name?: unknown } | undefined;
  const name = (typeof brief?.name === "string" && brief.name.trim()) || repo.name;

  /* Each picture once, by id: two parts may show the same one. */
  const wanted = new Map<string, { id: string; path: string; type: string }>();
  for (const n of nodes) {
    const p = n.picture;
    if (p && typeof p.id === "string" && typeof p.path === "string" && !wanted.has(p.id)) wanted.set(p.id, { id: p.id, path: p.path, type: typeof p.type === "string" ? p.type : "image/png" });
  }
  const pictures: RepoCopy["pictures"] = [];
  const lost: string[] = [];
  let weight = 0;
  let i = 0;
  for (const p of wanted.values()) {
    const entry = blobs.find((e) => e.path === p.path);
    if (!entry) { lost.push(p.path); continue; }
    if (pictures.length >= MOST_PICTURES || weight + (entry.size ?? 0) > MAX_REPO_BYTES) { lost.push(p.path); continue; }
    say(`Fetching its pictures… ${++i} of ${wanted.size}`);
    const got = await gh(`/repos/${repo.owner}/${repo.name}/git/blobs/${entry.sha}`, token);
    if (isNo(got)) { lost.push(p.path); continue; }
    const g = got as { content?: string; encoding?: string };
    if (g.encoding !== "base64" || typeof g.content !== "string") { lost.push(p.path); continue; }
    const bytes = unbase64(g.content);
    weight += bytes.length;
    pictures.push({ ...p, bytes });
  }
  return { document, name, pages, parts: nodes.length, pictures, lost, ref };
}

/**
 * The repository's site, as a zip this app can open.
 *
 * `say` is called with a line as each stage begins, because this is a
 * dozen calls over somebody's connection and a spinner with no words is
 * how a minute feels like a failure.
 */
export async function readRepoSite(repo: Repo, token: string, say: (line: string) => void, opts: { alsoAt?: string | null; filesOnly?: boolean } = {}): Promise<RepoRead | RepoCopy | RepoAt | RepoNo> {
  if (!token) return { no: "no-token", says: REPO_REFUSAL_SAYS["no-token"] };

  /* Asked every time, not only when no ref was named: the About line's
     address is what a repository of sources is read at, whichever branch
     was asked for. */
  say(repo.ref ? `Asking GitHub about ${repo.owner}/${repo.name}…` : "Asking GitHub which branch is the default…");
  const info = await gh(`/repos/${repo.owner}/${repo.name}`, token);
  if (isNo(info)) return info;
  const it = info as { default_branch?: string; homepage?: string };
  const ref = repo.ref || it.default_branch || "main";
  const homepage = (it.homepage ?? "").trim();

  say(`Reading what is in ${repo.owner}/${repo.name}…`);
  const tree = await gh(`/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
  if (isNo(tree)) return tree;
  const entries = ((tree as { tree?: unknown[] }).tree ?? []).filter(
    (e): e is { path: string; type: string; sha: string; size?: number } =>
      !!e && typeof e === "object" && typeof (e as { path?: unknown }).path === "string",
  );
  const blobs = entries.filter((e) => e.type === "blob");
  const paths = blobs.map((e) => e.path);

  /*
   * A SITE MADE HERE IS COPIED, NOT READ. The document a publish leaves in
   * the repository is the site exactly: every part, position, colour and
   * prompt. Fidelity first: it is taken whole, ahead of any page in the
   * repository and ahead of any address, and the pictures it names come
   * with it from the same tree. Only a document that cannot be read falls
   * through to the page or the address, and says so.
   */
  if (madeHere(paths)) {
    say(`Reading the site itself out of ${repo.owner}/${repo.name}…`);
    const copy = await copyOf(repo, token, ref, blobs, say);
    if (copy) return copy;
    say("Its document could not be read, so the page is read instead…");
  }

  const page = pageIn(paths);

  /*
   * ADDRESS BEFORE FILES. A deployed page is the site as it actually
   * renders, styles cascaded and fonts applied; the files are what it was
   * built from. So a repository that says where it is deployed is read
   * there, and the files are the fallback, said as such, when that read
   * fails. `filesOnly` is that fallback asking.
   */
  if (!opts.filesOnly) {
    const deployed = pageAddress(homepage || opts.alsoAt || null, false);
    if (deployed.at) return { at: deployed.at, why: deployed.why === "site" ? "site" : "root", ref, filesToo: !!page };
  }

  if (!page) {
    /*
     * No page in it. That is not a failure to hide: it is a project that
     * has to be built before it is a website, and the honest answer names
     * what was actually found. The address it is deployed at goes back with
     * the answer so the caller can read the page there, which is what he
     * meant by bringing the repository in.
     */
    const kinds = [...new Set(paths.map((p) => (p.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase()).filter(Boolean))];
    const made = madeHere(paths);
    const page = pageAddress(homepage || null, made);
    return { no: "no-page", says: noPageSays(repo, kinds, page.at, made), deployedAt: homepage || null, pageAt: page.at, pageWhy: page.why, madeHere: made };
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
