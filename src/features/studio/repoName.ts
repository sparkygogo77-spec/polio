/**
 * WHAT GITHUB WILL TAKE AS A REPOSITORY NAME, and what to say when it will not.
 *
 * Its own module with no imports, so the check can read it without the app's
 * path aliases and without pulling a route's `next/server` in behind it —
 * the same shape as `aboutTheSite.ts` and `drawKinds.ts`.
 *
 * Checked before the call rather than only after it, so he is told what is
 * wrong with a name in his own words instead of reading an API's 422. The
 * rules are GitHub's, not invented here: a hundred characters, and letters,
 * numbers, dots, dashes and underscores.
 */
export function nameRefusal(name: string): string | null {
  const n = name.trim();
  if (!n) return "A repository needs a name.";
  if (n.length > 100) return "That name is longer than GitHub allows (100 characters).";
  if (!/^[A-Za-z0-9._-]+$/.test(n)) return "Letters, numbers, dots, dashes and underscores only — no spaces.";
  if (/^\.+$/.test(n)) return "A name of only dots is not a name.";
  return null;
}

/** What a site should be called on GitHub, from what he called the site. */
export function repoNameFor(siteName: string): string {
  const slug = siteName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return slug || "site";
}
