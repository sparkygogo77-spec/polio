/**
 * THE FILES BUILD WROTE, KEPT IN THE SITE'S REPOSITORY.
 *
 * Build's code runs on the live site (J, 2026-10-12: "Run it"), so every Go
 * live of a site Build made writes Build's files again from the board, the
 * way it writes the pages again: the app is the site, and the site is the
 * board as it is now. But a code chat working in the repository changes
 * those same files (that is what it is for), and writing them again from
 * the board would throw its work away at the next press.
 *
 * So each push of the app carries `site/build.json`: every file Build wrote,
 * by the git blob sha of what Build wrote there. The next push reads the one
 * on the branch and, for each of Build's files:
 *
 * - the branch still holds what Build last wrote there (or nothing): written
 *   again from the board;
 * - the branch holds something else, a code chat's change: kept as it is;
 * - Build no longer writes it (a part or a page gone from the board) and
 *   nobody changed it: taken off. Changed, it is left.
 *
 * A file Claude wrote in the book over one of Build's goes up as written:
 * this push carries it on purpose. A branch with no record (the push that
 * makes the site an app) has everything written as sent and nothing taken
 * off. `tests/build-runs.mjs`.
 *
 * Pure: the browser writes the record, the route reads it.
 */

/** Where the record is kept in the site's repository; a branch that holds it is an app Build made. */
export const BUILD_RECORD = "site/build.json";

/** Each file Build wrote, by path, to the git blob sha of what it wrote there. */
export type Built = Record<string, string>;

const ABOUT = "The files the Builder's Build wrote here, by the git blob sha of what it wrote. Each Go live writes them again from the board, except one changed here since: that one is kept as it is (delete it to have Build write it again). A file this list does not name is never touched.";

const SHA = /^[0-9a-f]{40}$/;

/** The record of a push of the app, its files in order. */
export function buildRecordFile(built: Built): { path: string; content: string } {
  const files = Object.fromEntries(Object.keys(built).sort().map((p) => [p, built[p]!]));
  return { path: BUILD_RECORD, content: `${JSON.stringify({ about: ABOUT, files }, null, 2)}\n` };
}

/** The files a record names; null when the text is not one. */
export function builtIn(text: string): Built | null {
  try {
    const files = (JSON.parse(text) as { files?: unknown } | null)?.files;
    if (!files || typeof files !== "object" || Array.isArray(files)) return null;
    const out: Built = {};
    for (const [path, sha] of Object.entries(files as Record<string, unknown>)) {
      if (typeof sha === "string" && SHA.test(sha) && path && !path.startsWith("/") && !path.split("/").includes("..")) out[path] = sha;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * What a push of the app leaves as it is on the branch (`keep`) and what it
 * takes off (`gone`). `was` is the branch's record (null for none), `now`
 * this push's, `onBranch` the branch's files by blob sha, and `sent` what
 * this push writes at each path by blob sha.
 */
export function buildKeeps(was: Built | null, now: Built, onBranch: ReadonlyMap<string, string>, sent: ReadonlyMap<string, string>): { keep: string[]; gone: string[] } {
  if (!was) return { keep: [], gone: [] };
  const keep: string[] = [];
  for (const [path, own] of Object.entries(now)) {
    const going = sent.get(path);
    const there = onBranch.get(path);
    /* Not in this push, or not Build's own words (Claude's file in the book, sent on purpose), or nothing to keep. */
    if (going === undefined || going !== own || there === undefined || there === going) continue;
    /* What Build last wrote, unchanged since: written again. Anything else is somebody's change. */
    if (there !== was[path]) keep.push(path);
  }
  const gone = Object.entries(was)
    .filter(([path, sha]) => !(path in now) && !sent.has(path) && onBranch.get(path) === sha)
    .map(([path]) => path);
  return { keep: keep.sort(), gone: gone.sort() };
}

/**
 * The site's own files (its pages, their stylesheets and scripts, its
 * pictures) as an app serves them: in public/, at the same addresses, so
 * every link and picture on the pages still finds them. The export's own
 * vercel.json gives way to the app's, which says what the repository is.
 */
export function intoPublic<T extends { path: string }>(site: readonly T[]): T[] {
  return site.filter((f) => f.path !== "vercel.json").map((f) => ({ ...f, path: `public/${f.path}` }));
}
