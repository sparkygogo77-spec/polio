/** The address a repository names as its website on GitHub, as a link (`LiveSiteLink.tsx`). */

/** A homepage as a link: an address with no scheme gets https, anything that is not http(s) is no link. */
export function websiteOf(homepage: unknown): string | null {
  const s = typeof homepage === "string" ? homepage.trim() : "";
  if (!s) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
