"use client";
/**
 * Reading the features a code chat built back out of the site's repository.
 *
 * Asked of GitHub from this browser, with the owner's own token, the way
 * `repoRun.ts` reads a site: nothing reaches our server. Only the owner's
 * own repositories are read: GitHub is asked who the token belongs to, and a
 * repository whose owner is anybody else is refused before a single file of
 * it is fetched. Only `features/<id>/manifest.json`, `script.js` and
 * `README.md` are fetched, as text, and handed to `roundTrip.ts`, which
 * compares them with the library. Nothing is run.
 */
import { allWorks } from "./works";
import { foundIn, isFeatureFile, offersFrom, type Offer } from "./roundTrip";
import { useLibrary } from "./useLibrary";

const API = "https://api.github.com";
/** A feature is a few small files; more folders than this is not a features/ tree. */
const MOST_FILES = 90;

export interface RepoFeatures { ok: boolean; offers: Offer[]; says: string }

async function gh(path: string, token: string): Promise<unknown | { no: string }> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
    if (res.status === 404) return { no: "GitHub has no such repository, or this token cannot see it." };
    if (res.status === 401 || res.status === 403) return { no: "GitHub refused that token. Check it under Keys." };
    if (!res.ok) return { no: `GitHub answered ${res.status}.` };
    return (await res.json()) as unknown;
  } catch {
    return { no: "GitHub could not be reached from this browser." };
  }
}
const no = (v: unknown): v is { no: string } => !!v && typeof v === "object" && "no" in (v as object);

function text(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function readRepoFeatures(repo: { owner: string; name: string; ref?: string | null }, token: string): Promise<RepoFeatures> {
  const full = `${repo.owner}/${repo.name}`;
  if (!token) return { ok: false, offers: [], says: "No GitHub token in this browser, so the repository could not be read. Add one under Keys." };
  const me = await gh("/user", token);
  if (no(me)) return { ok: false, offers: [], says: me.no };
  const login = String((me as { login?: unknown }).login ?? "");
  const info = await gh(`/repos/${repo.owner}/${repo.name}`, token);
  if (no(info)) return { ok: false, offers: [], says: info.no };
  const owner = String((info as { owner?: { login?: unknown } }).owner?.login ?? repo.owner);
  if (!login || owner.toLowerCase() !== login.toLowerCase()) {
    return { ok: false, offers: [], says: `${full} belongs to ${owner}. Features are taken back only from your own repositories.` };
  }
  const ref = repo.ref || String((info as { default_branch?: unknown }).default_branch ?? "main");
  const tree = await gh(`/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
  if (no(tree)) return { ok: false, offers: [], says: tree.no };
  const entries = ((tree as { tree?: { path?: unknown; type?: unknown; sha?: unknown }[] }).tree ?? [])
    .filter((e) => e.type === "blob" && typeof e.path === "string" && typeof e.sha === "string" && isFeatureFile(e.path))
    .slice(0, MOST_FILES) as { path: string; sha: string }[];
  const files: { path: string; content: string }[] = [];
  for (const e of entries) {
    const blob = await gh(`/repos/${repo.owner}/${repo.name}/git/blobs/${e.sha}`, token);
    if (no(blob)) continue;
    const b = blob as { content?: string; encoding?: string };
    if (b.encoding === "base64" && typeof b.content === "string") files.push({ path: e.path, content: text(b.content) });
  }
  const offers = offersFrom(foundIn(files), allWorks());
  const folders = new Set(files.map((f) => f.path.split("/")[1])).size;
  const says = offers.length
    ? `${offers.length} feature${offers.length === 1 ? "" : "s"} in ${full} to review.`
    : folders ? `${full}: every feature in it is already in the library.` : `${full} has no features/ folders yet.`;
  return { ok: true, offers, says };
}

/** Read a repository and put what it offers in front of the owner. */
export async function checkRepoFeatures(repo: { owner: string; name: string; ref?: string | null }, token: string): Promise<RepoFeatures> {
  const lib = useLibrary.getState();
  lib.setSays(`Reading features/ in ${repo.owner}/${repo.name}…`, true);
  const got = await readRepoFeatures(repo, token);
  if (got.ok) lib.setOffers(`${repo.owner}/${repo.name}`, got.offers, got.says);
  else lib.setSays(got.says);
  return got;
}
