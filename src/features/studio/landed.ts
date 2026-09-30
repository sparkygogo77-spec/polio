/**
 * The lines of What has landed, shaped the same way wherever they came from
 * (`/api/updates`): GitHub's commits, `git log`, or the saved snapshot.
 * Pure, so `tests/updates-current.mjs` reads it directly.
 */
import { aboutTheSite } from "./aboutTheSite.ts";

export interface Landed {
  id: string;
  says: string;
  when: string;
}

export interface UpdatesAnswer {
  live: { commit: string | null; short: string | null; branch: string | null; builtAt: string | null };
  source: "github" | "git" | "saved";
  /** Said when the list is not the newest there is, and why. */
  note?: string;
  changes: Landed[];
  /** Lines about the making rather than the website, counted and not shown. */
  counted: number;
}

/** One line per change, newest first: merges, the making, a red check and repeats left out. */
export function shapeLines(rows: { id: string; says: string; when: string; parents?: number }[]): { changes: Landed[]; counted: number } {
  const seen = new Set<string>();
  let counted = 0;
  const changes: Landed[] = [];
  for (const r of rows) {
    const says = r.says.split("\n")[0]!.trim();
    if (!says || (r.parents ?? 1) > 1 || /^Merge (pull request|branch|remote)/.test(says)) continue;
    /* A check committed failing before its fix: the fix's own line says the change. */
    if (/:\s*the check(,\s*red)?\.?$/i.test(says) || /^(wip|fixup!|squash!)\b/i.test(says)) continue;
    if (!aboutTheSite(says)) { counted++; continue; }
    const key = says.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    changes.push({ id: r.id.slice(0, 7), says, when: r.when });
  }
  changes.sort((a, b) => Date.parse(b.when) - Date.parse(a.when));
  return { changes, counted };
}


const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "30 September": the day a change landed, as a person says it. */
export function dayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Undated" : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
