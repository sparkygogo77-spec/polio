/**
 * Connecting a repository, so the website in it lands on the board.
 *
 * WHAT HE ASKED FOR, in his words: "connecting an existing repo website and
 * the subsequent website popping into my design board 1:1, and with a new
 * category specifically for the elements this repo imports".
 *
 * WHAT 1:1 MEANS HERE, in one line: every block of the page arrives as a
 * real, editable part of this library at the position, size, words, colours
 * and type the page actually had — measured in a browser, never described
 * to a model — and anything that cannot be matched to a part arrives saying
 * what it was and what was lost, rather than as a picture of it.
 *
 * WHY THE REPOSITORY RATHER THAN ITS ADDRESS. A deployed address would have
 * been less work and is already built (`FromASite`, the element route). It
 * is also the wrong thing to ask of somebody who has a repository: half the
 * repositories worth bringing in are private, or are not deployed anywhere
 * yet, or are deployed at an address nobody remembers. So the files are
 * fetched from GitHub **by the browser, with his own token**, packed into a
 * zip there, and handed to the zip route that already exists — which opens
 * the page with every request answered out of the zip and nothing reaching
 * the network. No new server capability, no key anywhere near our server,
 * and a private repository works exactly as a public one does.
 *
 * WHAT IS NOT DONE, said here rather than found out: a repository that has
 * no page in it to open — a framework project that has to be built first —
 * cannot be read from its files, and nothing here builds it. What CAN be
 * done for it is to read the address it is deployed at, which is the same
 * page a visitor sees: GitHub's own About line on the repository names it,
 * and so does this Builder for a site it published. `noPageSays` is the
 * sentence for the case where neither does, and it names what was found
 * and what he can do about it instead of quietly bringing in nothing.
 *
 * Pure: no fetch, no browser, no keys. `tests/repo-import.mjs` holds it.
 */
import { pageEntry } from "./zipImport.ts";

/** How many files of a repository are worth pulling. Past this it is a project, not a page. */
export const MAX_REPO_FILES = 80;
/** And how much of it, unpacked. The zip route's own cap is the one that matters; this is the fetch's. */
export const MAX_REPO_BYTES = 8 * 1024 * 1024;

export type RepoRefusal = "not-a-repo" | "no-token" | "no-page" | "too-big" | "github";

export const REPO_REFUSAL_SAYS: Record<RepoRefusal, string> = {
  "not-a-repo": "That is not a repository. It wants to be owner/name, or the address of one on GitHub.",
  "no-token": "This reads the repository with your own GitHub token, and there is not one saved yet. Add one under Keys (⌘⇧K).",
  "no-page":
    "There is no page in this repository to open. It is sources that have to be built before they are a website, and nothing here builds them. Put the address it is deployed at under About on GitHub, or type that address under Read the page, and it comes in from there.",
  "too-big": "That repository has more in it than this reads. It is meant for the site, not the whole project.",
  github: "GitHub would not hand over the files.",
};

/**
 * The sentence for a repository with no page in it.
 *
 * Three facts, in the order he needs them: which repository, what is in it
 * instead of a page, and what happens next. With a deployed address known
 * the next step is taken rather than described, so this only says where
 * the page is being read from; without one it says what would give it one.
 */
export function noPageSays(repo: Repo, kinds: readonly string[], at: string | null, isMadeHere = false): string {
  const found = kinds.length ? ` What is in it: ${kinds.slice(0, 8).join(", ")}.` : "";
  if (isMadeHere && at) return `${repoName(repo)} is a site made here, so it is read at its page: ${at}.`;
  if (isMadeHere) return `${repoName(repo)} is a site made here, published at /site of wherever it is deployed, and the repository does not say where. Put that address under About on GitHub, or type it with /site on the end under Read the page.`;
  if (at) return `There is no page in the sources of ${repoName(repo)}, so it is read at the address it is deployed at: ${at}.${found}`;
  return `${REPO_REFUSAL_SAYS["no-page"]}${found}`;
}

/**
 * THE MARK A PUBLISH FROM HERE LEAVES: the document the app renders at /site.
 *
 * A repository that carries it is a site made in this Builder, and the
 * root of wherever it is deployed is the Builder's own front, which is the
 * tool and not the site. Driven by hand: bringing this Builder's own
 * repository in read its root and landed two blocks of the Builds page,
 * while the site itself, thirty-odd parts, sat at /site. A newer publish
 * also writes an index page into the repository, and that comes in through
 * its files; this is for the ones that predate that.
 */
export const MADE_HERE = "site/document.json";
/** A path inside the site's folder of the repository, when the control named one (`owner/sink/sites/share-xyz`); at the root otherwise. */
export function pathIn(dir: string | null | undefined, path: string): string {
  return dir ? `${dir}/${path}` : path;
}
/** Where the document is: `site/document.json` at the root, or inside the site's folder. */
export function docPathIn(dir: string | null | undefined): string {
  return pathIn(dir, MADE_HERE);
}
/** The same repository, read inside a folder of it (`sites/<name>`): what the Capture dialog hands the door as `path`. An empty path is the repository as it was. */
export function withPath(repo: Repo, path: string | null | undefined): Repo {
  const dir = (path ?? "").trim().replace(/^\/+|\/+$/g, "");
  return dir ? { ...repo, dir } : repo;
}
export function madeHere(paths: readonly string[], dir?: string | null): boolean {
  return paths.includes(docPathIn(dir));
}

/**
 * Where a repository's page is, given where it is deployed.
 *
 * A site made here keeps its page at /site of its deployment. Anything
 * else is read at the root, because nothing in the repository says
 * otherwise, and `why` carries which of the two it was so the landing
 * can say the right thing if it comes back thin. No address is no guess.
 */
export function pageAddress(deployedAt: string | null | undefined, isMadeHere: boolean): { at: string | null; why: "site" | "root" | "none" } {
  const base = (deployedAt ?? "").trim().replace(/\/+$/, "");
  if (!base) return { at: null, why: "none" };
  if (isMadeHere) return { at: `${base.replace(/\/site$/i, "")}/site`, why: "site" };
  return { at: base, why: "root" };
}

/**
 * WHEN WHAT LANDED IS THIN, one or two blocks, say so and say what to try.
 *
 * Two blocks from a root address is what a front page or an app gives, and
 * he should not have to work out that he aimed at the wrong page. What can
 * be said depends on what is known: a site made here has its page at
 * /site, and that is named; a repository nothing is known about is said to
 * be unknown, with where to type another address; a page read from files
 * is simply a small page.
 */
export function thinSays(n: number, from: { url: string | null; why: "site" | "root" | "none" | "hand"; isMadeHere: boolean }): string {
  if (n > 2) return "";
  const only = `Only ${n} block${n === 1 ? "" : "s"} came from`;
  if (!from.url) return ` ${only} it: the page in the repository has little on it.`;
  if (from.why === "site") return ` ${only} ${from.url}: the published page there has little on it.`;
  if (from.why === "root" && from.isMadeHere) return ` ${only} ${from.url}, which is the Builder's own front. The site is at ${pageAddress(from.url, true).at}: type that under Read the page.`;
  if (from.why === "root") return ` ${only} ${from.url}. That may be a front page or an app rather than the page you meant, and nothing in the repository says where its page is. If it is elsewhere on that site, type its address under Read the page.`;
  return ` ${only} ${from.url}. If the page you meant is elsewhere on that site, type its address here; a site made here keeps its page at /site of its address.`;
}

export interface Repo {
  owner: string;
  name: string;
  /** A branch, tag or commit, when one was named. Otherwise the repository's own default. */
  ref: string | null;
  /**
   * A folder inside the repository holding the site (`sites/share-xyz`), so a
   * sink holds one site at its root and others under `sites/`, each with its
   * own `site/document.json` and `assets/pictures`. Null is the root.
   */
  dir?: string | null;
}

/**
 * A repository, from what somebody typed.
 *
 * `owner/name`, `owner/name@branch`, and any github.com address including
 * the `/tree/<ref>` one people copy out of the branch dropdown. A `.git`
 * suffix is dropped, because that is what a clone line ends with and it is
 * the line most likely to be pasted.
 */
export function readRepo(raw: string): Repo | null {
  let text = (raw ?? "").trim();
  if (!text || text.length > 400) return null;
  text = text.replace(/^git\+/, "").replace(/^git@github\.com:/, "github.com/");
  let ref: string | null = null;
  let dir: string | null = null;
  if (/^https?:\/\//i.test(text) || /^github\.com\//i.test(text)) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      return null;
    }
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const at = parts.indexOf("tree");
    /* `/tree/<ref>/<folder…>`: the ref is one segment, and what follows is the site's folder. */
    if (at === 2 && parts[3]) { ref = decodeURIComponent(parts[3]); dir = parts.slice(4).map(decodeURIComponent).join("/") || null; }
    text = `${parts[0]}/${parts[1]}`;
  }
  const cut = text.lastIndexOf("@");
  // An `@` that is part of a scoped owner is not a ref, so only one past the slash counts.
  if (cut > text.indexOf("/") && cut > 0) {
    ref = text.slice(cut + 1).trim() || ref;
    text = text.slice(0, cut);
  }
  /* `owner/name`, or `owner/name/<folder>` for a site kept in a folder of the repository. */
  const m = /^([A-Za-z0-9][\w.-]*)\/([\w.-]+?)(?:\.git)?(?:\/([\w.-]+(?:\/[\w.-]+)*))?\/?$/.exec(text.trim());
  if (!m) return null;
  if (m[3]) dir = m[3];
  return { owner: m[1]!, name: m[2]!, ref: ref?.trim() || null, dir: dir?.replace(/^\/+|\/+$/g, "") || null };
}

/**
 * Is this the repository, and the folder of it, a site was brought in from?
 *
 * A site brought in from one place is brought in again only from that
 * place: `owner/sink` is not `owner/sink/sites/share-xyz`, and bringing
 * the second into the first's site would put share.xyz's pages on the
 * SOLCINERATOR board and aim its Go live at SOLCINERATOR's repository.
 * The ref is not part of it: a branch of the same place is the same place.
 */
export function sameSource(own: string | null | undefined, repo: Repo): boolean {
  if (!own) return true;
  const was = readRepo(own);
  if (!was) return false;
  const path = (r: Repo) => `${r.owner}/${r.name}${r.dir ? `/${r.dir}` : ""}`.toLowerCase();
  return path(was) === path(repo);
}

/** How the repository is written for a person: what they typed, tidied. */
export function repoName(r: Repo): string {
  return `${r.owner}/${r.name}${r.dir ? `/${r.dir}` : ""}${r.ref ? `@${r.ref}` : ""}`;
}

/** Folders that are never part of a website, however the repository is arranged. */
const SKIP = /(^|\/)(node_modules|\.git|\.github|\.next|dist\/cache|coverage|test|tests|__tests__|\.vercel|\.turbo)(\/|$)/i;

/** What a browser would ask for: the page, what dresses it, and what it shows. */
const WANTED = /\.(html?|css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf)$/i;

/**
 * Which of a repository's paths are worth pulling.
 *
 * Scripts are left behind on purpose: the zip route takes them out before
 * it opens the page anyway (`sansScripts`), so fetching them would be
 * paying for bytes that are thrown away. Everything else a browser would
 * ask for while drawing the page comes, and nothing else does.
 */
export function wanted(paths: string[]): string[] {
  return paths.filter((p) => !SKIP.test(p) && WANTED.test(p));
}

/**
 * The page to open, out of what the repository holds.
 *
 * Not a second rule: `pageEntry` is what the zip route itself opens, so
 * this asks that. Two rules for "which file is the page" would disagree
 * one day, and the disagreement would read as the repository being brought
 * in and then showing a different page than the panel said it would.
 * Null means there is no page here, which is a sentence on screen.
 */
export function pageIn(paths: string[]): string | null {
  return pageEntry(paths.filter((p) => !SKIP.test(p)));
}

/* ------------------------------------------------------------------ */
/* A category of its own                                               */
/* ------------------------------------------------------------------ */

/** FNV-1a, so a repository always gets the same colour. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The shelf category this repository's elements live in.
 *
 * Its own, named after the repository, because that was the ask: the
 * elements a repository brought in are findable as a group and droppable
 * again, rather than scattered through twelve categories where nobody
 * could tell them from the library's own. The hue is off the name, so two
 * repositories are two colours and the same repository is the same colour
 * every time it is brought in.
 */
export function categoryFor(r: Repo): { id: string; label: string; hue: number } {
  const key = `${r.owner}/${r.name}`.toLowerCase();
  return { id: `repo:${key}`, label: r.name, hue: hash(key) % 360 };
}

/* ------------------------------------------------------------------ */
/* Writing a zip, in the browser                                       */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * A zip, stored rather than deflated.
 *
 * Forty lines for the same reason the reader beside it is forty lines: the
 * format is short, the one method needed is the one that packs nothing, and
 * a writer whose bounds can be read is worth more here than a dependency.
 * Every name is written with the UTF-8 flag set, so a path with an accent
 * in it comes back as itself. The bytes are bigger than a deflated zip and
 * never leave this machine's own request, so the size buys nothing to save.
 */
export function zipOf(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let at = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.bytes);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);          // version needed
    lv.setUint16(6, 0x0800, true);      // names are UTF-8
    lv.setUint16(8, 0, true);           // stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.bytes.length, true);
    lv.setUint32(22, f.bytes.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, f.bytes);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);          // version made by
    dv.setUint16(6, 20, true);          // version needed
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);          // stored
    dv.setUint32(16, crc, true);
    dv.setUint32(20, f.bytes.length, true);
    dv.setUint32(24, f.bytes.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, at, true);         // where its local header is
    dir.set(name, 46);
    central.push(dir);

    at += local.length + f.bytes.length;
  }

  const dirBytes = central.reduce((n, b) => n + b.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, dirBytes, true);
  ev.setUint32(16, at, true);

  const total = at + dirBytes + end.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const b of [...locals, ...central, end]) {
    out.set(b, o);
    o += b.length;
  }
  return out;
}
