/**
 * Which page is Home, and which file each page is published as.
 *
 * THE DECISION: Home is the page whose route is "/". When no page has "/",
 * it is the first page. The export used to take "the first page" and Preview
 * "the page on /", so moving About above Home made About the published
 * index.html while Preview's "/" still opened Home. Everything that has to
 * know asks here: the export, the static site, the contract, Preview, and
 * a link that says "home" or "/".
 *
 * And no two pages are ever written to one file. Two pages typed onto the
 * same route, or a second page on "/", used to be written to the same
 * `…/index.html`, the second over the first; each later one is now given
 * the next free name (`docs-2/index.html`).
 */

/** What a page has to say for this: every page shape in the studio fits. */
export interface Routed {
  id: string;
  name?: string;
  path?: string;
}

const bare = (path: string | undefined) => (path ?? "").trim().replace(/^\/+|\/+$/g, "");

/** Home: the page on "/", else the first page. */
export function homeOf<P extends Routed>(pages: readonly P[]): P | undefined {
  return pages.find((p) => p.path != null && bare(p.path) === "") ?? pages[0];
}

/** Home, and every page's file, worked out once for a list of pages. */
export interface Home {
  /** Home's id, or null when there are no pages. */
  id: string | null;
  /** The file this page is published as: `index.html` for Home, `<route>/index.html` for the rest. */
  file: (page: Routed) => string;
}

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/^-+|-+$/g, "");

export function homeFor(pages: readonly Routed[]): Home {
  const home = homeOf(pages)?.id ?? null;
  const files = new Map<string, string>();
  const used = new Set<string>();
  if (home) { files.set(home, "index.html"); used.add("index.html"); }
  for (const page of pages) {
    if (page.id === home) continue;
    /* A page on "/" that is not Home has no route of its own: it goes by its name. */
    const base = slugOf(bare(page.path) || bare(page.name) || page.id) || page.id;
    let file = `${base}/index.html`;
    for (let k = 2; used.has(file); k++) file = `${base}-${k}/index.html`;
    files.set(page.id, file);
    used.add(file);
  }
  return {
    id: home,
    file: (page) => files.get(page.id) ?? `${slugOf(bare(page.path) || page.id) || page.id}/index.html`,
  };
}
