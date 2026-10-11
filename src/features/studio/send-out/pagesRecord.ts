/**
 * THE PAGES A PUSH OF THE SITE WROTE, KEPT IN ITS REPOSITORY.
 *
 * Go live only ever added or overwrote files, so a page deleted or renamed
 * on the board kept its old index.html on the branch, and its old address
 * stayed live with the old content after the Builder and the Preview had
 * long dropped it. So each push of the site carries `site/pages.json`, the
 * page files it wrote (`collectFiles`), and the publish route takes off the
 * branch each page file the record already there names and the new one does
 * not. Only those: a file no record named (the owner's, a code chat's, a
 * picture) is never removed, and a push with no record removes nothing.
 * `tests/golive-removes-pages.mjs`.
 *
 * Pure: the browser writes the record, the route reads it.
 */

/** Where the record is kept in the site's repository. */
export const PAGES_RECORD = "site/pages.json";

/** A page's file as the export writes it: index.html, at the root or in a folder of its own (`homeFor`). */
const isPage = (path: string) => /(^|\/)index\.html$/.test(path);

const ABOUT = "The page files the Builder's Go live wrote here. The next Go live takes off the site each one that is no longer a page on the board; it never removes a file this list does not name.";

/** The record of a push: the page files among what goes up. Null when no page goes up, so a push without pages takes nothing off. */
export function pagesRecord(files: readonly { path: string }[]): { path: string; content: string } | null {
  const pages = [...new Set(files.map((f) => f.path).filter(isPage))].sort();
  return pages.length ? { path: PAGES_RECORD, content: `${JSON.stringify({ about: ABOUT, pages }, null, 2)}\n` } : null;
}

/** The page files a record names; none when the text is not one. */
function pagesIn(text: string): string[] {
  try {
    const pages = (JSON.parse(text) as { pages?: unknown } | null)?.pages;
    return Array.isArray(pages) ? pages.filter((p): p is string => typeof p === "string" && isPage(p)) : [];
  } catch {
    return [];
  }
}

/**
 * What a push takes off the branch: each page file the branch's record
 * (`was`) names that this push's record (`now`) does not and that this push
 * does not write anyway. Nothing when this push's record names no page.
 */
export function pagesGone(was: string, now: string, writing: ReadonlySet<string>): string[] {
  const kept = new Set(pagesIn(now));
  if (!kept.size) return [];
  return [...new Set(pagesIn(was))].filter((p) => !kept.has(p) && !writing.has(p));
}
