/**
 * HAS THIS SITE CHANGED SINCE IT WAS PUBLISHED, in words and in two times.
 *
 * Read off the site's own record (`Project`): when a person last changed the
 * board (`editedAt`), and what the last push carried (`published.editedAt`,
 * the board's edit time when its pages were written, and `published.at`).
 * Nothing here opens the document, so a Builds page of twenty sites costs
 * twenty comparisons. `tests/builds-changes.mjs`.
 *
 * Pure: no store, no React.
 */
export interface ChangeRecord {
  editedAt?: number;
  published?: { at: number; editedAt?: number; sha?: string; commitUrl?: string };
  live?: { url: string; at: number; inspectorUrl?: string | null };
}

export type ChangeKind = "unpublished" | "never" | "current" | "unknown";

export interface ChangeState {
  kind: ChangeKind;
  /** The one line the card shows. */
  says: string;
  /** Last change to the board, and last publish, when known. */
  editedAt: number | null;
  publishedAt: number | null;
}

/** "12:04" today, "2 October, 12:04" another day: the way a person reads a time on a card. */
export function timeWords(at: number, now = Date.now()): string {
  const d = new Date(at);
  const clock = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date(now).toDateString()) return clock;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "long" })}, ${clock}`;
}

export function changeState(p: ChangeRecord, now = Date.now()): ChangeState {
  const editedAt = p.editedAt ?? null;
  const publishedAt = p.published?.at ?? p.live?.at ?? null;
  if (!publishedAt) {
    return { kind: "never", editedAt, publishedAt, says: editedAt ? `Not published yet. Last change ${timeWords(editedAt, now)}.` : "Not published yet." };
  }
  /* What the push carried: the board as it was when its pages were written, or, for a push from before that was kept, the push's own time. */
  const carried = p.published?.editedAt ?? publishedAt;
  if (!editedAt) return { kind: "unknown", editedAt, publishedAt, says: `Published ${timeWords(publishedAt, now)}.` };
  if (editedAt > carried) {
    return { kind: "unpublished", editedAt, publishedAt, says: `Changes not published yet: last change ${timeWords(editedAt, now)}, last publish ${timeWords(publishedAt, now)}.` };
  }
  return { kind: "current", editedAt, publishedAt, says: `Everything is published: last publish ${timeWords(publishedAt, now)}.` };
}
