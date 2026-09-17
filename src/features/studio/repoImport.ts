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
 * cannot be read this way, and the panel says so and names what it found
 * instead of quietly bringing in nothing.
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
    "There is no page in this repository to open. It is a project that has to be built before it is a website, and nothing here builds it — bring in the address it is deployed at instead.",
  "too-big": "That repository has more in it than this reads. It is meant for the site, not the whole project.",
  github: "GitHub would not hand over the files.",
};

export interface Repo {
  owner: string;
  name: string;
  /** A branch, tag or commit, when one was named. Otherwise the repository's own default. */
  ref: string | null;
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
    if (at === 2 && parts[3]) ref = decodeURIComponent(parts.slice(3).join("/"));
    text = `${parts[0]}/${parts[1]}`;
  }
  const cut = text.lastIndexOf("@");
  // An `@` that is part of a scoped owner is not a ref, so only one past the slash counts.
  if (cut > text.indexOf("/") && cut > 0) {
    ref = text.slice(cut + 1).trim() || ref;
    text = text.slice(0, cut);
  }
  const m = /^([A-Za-z0-9][\w.-]*)\/([\w.-]+?)(?:\.git)?$/.exec(text.trim());
  if (!m) return null;
  return { owner: m[1]!, name: m[2]!, ref: ref?.trim() || null };
}

/** How the repository is written for a person: what they typed, tidied. */
export function repoName(r: Repo): string {
  return `${r.owner}/${r.name}${r.ref ? `@${r.ref}` : ""}`;
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
