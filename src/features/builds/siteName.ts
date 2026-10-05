/**
 * A site brought in from a repository is called by that repository's name,
 * not the number it was given while blank ("Site 10"): J (2026-10-05) saw
 * the number in the Builder and in the branch names its style layers went
 * out on (`style/site-10-…`). A name someone gave it is kept.
 *
 * Pure: `tests/match-flow-steps.mjs` holds it.
 */
const PLACEHOLDER = /^Site \d+$/;
export function siteName(name: string, source: { name: string } | null | undefined): string {
  return source?.name && PLACEHOLDER.test(name.trim()) ? source.name : name;
}
