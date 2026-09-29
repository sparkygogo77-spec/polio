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
import { handoffFrom } from "./polioMd";
import { docPathIn, pathIn, withPath, MAX_REPO_BYTES, MAX_REPO_FILES, REPO_REFUSAL_SAYS, madeHere, noPageSays, pageAddress, pageIn, wanted, zipOf, type Repo, type RepoRefusal } from "./repoImport";
import { namedPictures } from "./siteHead";
import { MAX_SOURCE_BYTES, MAX_SOURCE_FILES, findPage, neededBy, readSource, type SourceNotes } from "./sourceSite";

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
  /** Set when the page was built from the repository's source rather than found in it: which file, and what the reading did. */
  source?: { page: string; notes: SourceNotes };
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
/** How many pictures a document may name before the rest are only named: share.xyz's three pages name 218, a site's worth is hundreds. */
const MOST_PICTURES = 600;
/** And their bytes together, a budget of the pictures' own: the document's own size is not counted against it. */
const MAX_PICTURE_BYTES = 64 * 1024 * 1024;

type Blob = { path: string; sha: string; size?: number };

/** One file's bytes out of the tree, or the reason it did not come. */
async function bytesOf(repo: Repo, token: string, e: Blob): Promise<Uint8Array | RepoNo> {
  const blob = await gh(`/repos/${repo.owner}/${repo.name}/git/blobs/${e.sha}`, token);
  if (isNo(blob)) return blob;
  const it = blob as { content?: string; encoding?: string };
  if (it.encoding !== "base64" || typeof it.content !== "string") return { no: "github", says: `GitHub would not hand over ${e.path}.` };
  return unbase64(it.content);
}

/**
 * HIS OWN REPOSITORIES ARE READ FROM THEIR SOURCE.
 *
 * A v0 or Next app has no page in it, only the source a page is built
 * from: `app/page.tsx`, the components it imports, its `globals.css`, its
 * pictures under `public/`. Reading that source is reading the site as
 * he wrote it: its words, its classes, its colours, banded as the file is
 * banded. The page is fetched first, then what it imports, in rounds,
 * until nothing more is wanted or the cap is met; then the pictures the
 * reading named. Null when the repository has no such page, so the caller
 * falls through to a page in the files or the address it is deployed at.
 */
async function sourceOf(repo: Repo, token: string, ref: string, blobs: Blob[], say: (line: string) => void): Promise<RepoRead | RepoNo | null> {
  const paths = blobs.map((e) => e.path);
  const page = findPage(paths);
  if (!page) return null;
  const have = new Set(paths);
  const byPath = new Map(blobs.map((e) => [e.path, e]));
  const texts = new Map<string, string>();
  let weight = 0;
  const decoder = new TextDecoder();
  const take = async (list: string[], line: string): Promise<RepoNo | null> => {
    const AT_ONCE = 6;
    for (let i = 0; i < list.length; i += AT_ONCE) {
      say(`${line} ${Math.min(i + AT_ONCE, list.length)} of ${list.length}`);
      const batch = await Promise.all(list.slice(i, i + AT_ONCE).map(async (path) => ({ path, got: await bytesOf(repo, token, byPath.get(path)!) })));
      for (const { path, got } of batch) {
        if (isNo(got)) return got;
        weight += got.length;
        texts.set(path, decoder.decode(got));
      }
    }
    return null;
  };
  say(`Reading the source of ${repo.owner}/${repo.name}: ${page}…`);
  const first = [page, ...["app/globals.css", "src/app/globals.css", "styles/globals.css"].filter((p) => have.has(p))];
  /* A source this token cannot fetch is a source that cannot be seen: the page in the files or at the address is read instead, and the line says why. */
  const no = await take(first, "Reading the page…");
  if (no) { say(`Its source could not be read: ${no.says} Its page is looked for instead…`); return null; }
  /* What the page imports, then what those import, until nothing more is wanted or the cap is met. */
  for (let round = 0; round < 4; round++) {
    const want = neededBy(texts, have).filter((p) => byPath.has(p)).slice(0, Math.max(0, MAX_SOURCE_FILES - texts.size));
    if (!want.length || weight > MAX_SOURCE_BYTES) break;
    const no = await take(want, "Opening the parts it is made of…");
    if (no) { say(`One part could not be fetched: ${no.says} The page is read with what came.`); break; }
  }
  const publicNames = paths.filter((p) => /^public\//.test(p));
  const read = readSource([...texts].map(([path, text]) => ({ path, text })), publicNames);
  if (!read) { say(`No page could be built from ${page}: it does not return markup this can read. Its page is looked for instead…`); return null; }
  /* The pictures it names, from the same tree, at the names the page asks for them by. */
  const pictures: { name: string; bytes: Uint8Array }[] = [];
  const named = read.notes.pictures.filter((p) => byPath.has(p)).slice(0, MOST_PICTURES);
  for (let i = 0; i < named.length; i++) {
    say(`Fetching its pictures… ${i + 1} of ${named.length}`);
    const got = await bytesOf(repo, token, byPath.get(named[i]!)!);
    if (isNo(got)) return got;
    pictures.push({ name: named[i]!.replace(/^public\//, ""), bytes: got });
  }
  say("Packing it…");
  const zip = zipOf([{ name: "index.html", bytes: new TextEncoder().encode(read.html) }, ...pictures]);
  const name = `${repo.owner}-${repo.name}.zip`;
  return {
    file: new File([zip as BlobPart], name, { type: "application/zip" }),
    entry: "index.html",
    files: texts.size + pictures.length,
    bytes: zip.length,
    ref,
    source: { page: read.entry, notes: read.notes },
  };
}

/**
 * The document, and the pictures it names.
 *
 * Null when the document is not there or is not a document, and the caller
 * falls through to reading the page. A picture the tree does not hold is
 * named rather than fetched blind; past `MOST_PICTURES` or the byte cap,
 * the rest are named too, so the copy says what it left behind.
 */
async function copyOf(repo: Repo, token: string, ref: string, blobs: { path: string; sha: string; size?: number }[], say: (line: string) => void): Promise<RepoCopy | null> {
  const at = blobs.find((e) => e.path === docPathIn(repo.dir));
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
  const nodes = Array.isArray(document.nodes) ? (document.nodes as unknown[]) : [];
  if (!pages || !Array.isArray(document.nodes)) return null;
  /* Where it came from, to the commit, and the capture's hand-off when its
     repository keeps a report beside it (sink `docs/fidelity/<site>.md`):
     both ride on the site into POLIO.md at every Go live (`polioMd.ts`). */
  document.source = { repo: `${repo.owner}/${repo.name}`, dir: repo.dir ?? null, branch: ref, commit: await commitOf(repo, token, ref) };
  const report = await handoffOf(repo, token, blobs);
  if (report) document.handoff = report;
  const brief = document.brief as { name?: unknown } | undefined;
  const name = (typeof brief?.name === "string" && brief.name.trim()) || repo.name;

  /* Each picture once, by id: two parts may show the same one. And the ones its head names, the share picture and the icons (`namedPictures`). */
  const wanted = new Map<string, { id: string; path: string; type: string }>();
  for (const p of namedPictures(document)) wanted.set(p.id, { id: p.id, path: p.path, type: typeof p.type === "string" ? p.type : "image/png" });
  const pictures: RepoCopy["pictures"] = [];
  const lost: string[] = [];
  let weight = 0;
  let i = 0;
  for (const p of wanted.values()) {
    const entry = blobs.find((e) => e.path === pathIn(repo.dir, p.path));
    if (!entry) { lost.push(p.path); continue; }
    if (pictures.length >= MOST_PICTURES || weight + (entry.size ?? 0) > MAX_PICTURE_BYTES) { lost.push(p.path); continue; }
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

/** The commit a ref names now, or null when GitHub will not say. */
async function commitOf(repo: Repo, token: string, ref: string): Promise<string | null> {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  const got = await gh(`/repos/${repo.owner}/${repo.name}/commits/${encodeURIComponent(ref)}`, token);
  const sha = isNo(got) ? null : (got as { sha?: unknown }).sha;
  return typeof sha === "string" && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/** The "Functions not captured" hand-off of the capture's report, when the repository has one for this site's folder. */
async function handoffOf(repo: Repo, token: string, blobs: { path: string; sha: string; size?: number }[]): Promise<string | null> {
  const site = repo.dir?.split("/").filter(Boolean).pop();
  const at = site ? blobs.find((e) => e.path === `docs/fidelity/${site}.md`) : undefined;
  if (!at || (at.size ?? 0) > 512 * 1024) return null;
  const blob = await gh(`/repos/${repo.owner}/${repo.name}/git/blobs/${at.sha}`, token);
  if (isNo(blob)) return null;
  const it = blob as { content?: string; encoding?: string };
  if (it.encoding !== "base64" || typeof it.content !== "string") return null;
  return handoffFrom(new TextDecoder().decode(unbase64(it.content)));
}

/**
 * The repository's site, as a zip this app can open.
 *
 * `say` is called with a line as each stage begins, because this is a
 * dozen calls over somebody's connection and a spinner with no words is
 * how a minute feels like a failure.
 */
export async function readRepoSite(repo: Repo, token: string, say: (line: string) => void, opts?: { path?: string | null }): Promise<RepoRead | RepoCopy | RepoNo> {
  if (!token) return { no: "no-token", says: REPO_REFUSAL_SAYS["no-token"] };
  /* A folder named beside the repository (the Capture dialog's `sites/<name>`) is where the site is read: its own site/document.json and pictures. */
  if (opts?.path) repo = withPath(repo, opts.path);

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
  if (madeHere(paths, repo.dir)) {
    say(`Reading the site itself out of ${repo.owner}/${repo.name}…`);
    const copy = await copyOf(repo, token, ref, blobs, say);
    if (copy) return copy;
    say("Its document could not be read, so the page is read instead…");
  }

  /*
   * His own repositories are read from their source: the page file, the
   * components it opens, the classes and colours as written. Only a
   * repository with no page source falls through to a page in its files,
   * and from there to the address it is deployed at.
   */
  const fromSource = await sourceOf(repo, token, ref, blobs, say);
  if (fromSource) return fromSource;

  const page = pageIn(paths);
  if (!page) {
    /*
     * No page in it. That is not a failure to hide: it is a project that
     * has to be built before it is a website, and the honest answer names
     * what was actually found. The address it is deployed at goes back with
     * the answer so the caller can read the page there, which is what he
     * meant by bringing the repository in.
     */
    const kinds = [...new Set(paths.map((p) => (p.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase()).filter(Boolean))];
    const made = madeHere(paths, repo.dir);
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
