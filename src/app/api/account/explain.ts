/**
 * WHY A SAVE OR LOAD FAILED, IN PLAIN WORDS.
 *
 * Whatever the store throws (Vercel Blob, GitHub, the disk) is turned into a
 * short reason the Account page can show, and one line on what to do where
 * there is something to do. Only fixed sentences leave here: the error's own
 * text is read to tell the cases apart and is never sent, so a token, a URL
 * or a stack trace cannot ride along.
 *
 * No framework imports: `tests/account-errors.mjs` drives it directly.
 */

export interface Reason { status: number; code: string; says: string; todo?: string }

/** A failure with a reason already worked out (GitHub's answers, see `github.ts`). */
export class Explained extends Error {
  reason: Reason;
  constructor(reason: Reason) { super(reason.says); this.reason = reason; }
}

export const REASONS = {
  suspended: { status: 503, code: "store-suspended", says: "Vercel has suspended this server's Blob store.", todo: "Sign in with your GitHub key instead: it keeps your work in a private GitHub repository." },
  full: { status: 507, code: "store-full", says: "The server's Blob store is over its plan's limit.", todo: "Sign in with your GitHub key instead, or free some space in the Blob store on Vercel." },
  storeKey: { status: 503, code: "store-key", says: "The server's Blob store did not accept the server's access token.", todo: "Check the store's connection in the Vercel project, or sign in with your GitHub key instead." },
  missing: { status: 404, code: "not-found", says: "What was asked for is not in the store." },
  unreachable: { status: 502, code: "store-unreachable", says: "The server could not reach its store.", todo: "Try again in a moment." },
  down: { status: 503, code: "store-down", says: "The account's store did not answer.", todo: "Try again in a moment." },
} as const satisfies Record<string, Reason>;

/** The reason for anything a store threw. */
export function explain(err: unknown): Reason {
  if (err instanceof Explained) return err.reason;
  const m = err instanceof Error ? `${err.name} ${err.message}` : "";
  if (/suspended/i.test(m)) return REASONS.suspended;
  if (/quota|over (its|the) (plan|limit)|limit exceeded|exceeded.*(limit|quota)|storage limit|ENOSPC|no space/i.test(m)) return REASONS.full;
  if (/token|unauthori[sz]ed|forbidden|BlobAccessError/i.test(m)) return REASONS.storeKey;
  if (/not.?found|ENOENT|BlobNotFound/i.test(m)) return REASONS.missing;
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(m)) return REASONS.unreachable;
  return REASONS.down;
}

/** What a reply says to the browser: the reason and what to do, nothing else. */
export const bodyOf = (r: Reason) => ({ ok: false, code: r.code, says: r.says, ...(r.todo ? { todo: r.todo } : {}) });
