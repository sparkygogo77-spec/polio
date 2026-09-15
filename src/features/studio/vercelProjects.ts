/**
 * Finding one Vercel project among all of an account's.
 *
 * Vercel lists projects a page at a time and hands back `pagination.next`,
 * a cursor for the next page's `until`. The deploy route read one page of a
 * hundred and looked no further, so an account with more projects than that
 * was told the project was not there. This walks the pages until it has the
 * one it wants, and no further; pure, so it can be held to that with a fake
 * pager and no token.
 */
export interface VercelProject {
  id: string;
  name: string;
  link?: { type?: string; org?: string; repo?: string; repoId?: number };
  targets?: { production?: { alias?: string[] } };
}

export type ProjectPage = { projects: VercelProject[]; next: string | number | null };

/** How many pages to read before deciding a cursor is going round in circles. */
export const MAX_PAGES = 20;

export async function findVercelProject(
  page: (until: string | null) => Promise<ProjectPage>,
  match: (p: VercelProject) => boolean,
  maxPages = MAX_PAGES,
): Promise<VercelProject | null> {
  let until: string | null = null;
  const seen = new Set<string>();
  for (let n = 0; n < maxPages; n++) {
    const got = await page(until);
    const hit = got.projects.find(match);
    if (hit) return hit;
    const next = got.next === null || got.next === undefined ? null : String(got.next);
    if (!next || seen.has(next)) return null;
    seen.add(next);
    until = next;
  }
  return null;
}
