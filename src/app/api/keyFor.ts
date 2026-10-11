/**
 * Whose key a call uses: the one typed into Keys, then the server's.
 *
 * Every route that takes a key picks it here, so every route picks it the
 * same way. They used not to. The Claude routes (generate, body, reshape),
 * Go live and the updates list took the server's key first and the one in
 * the Keys panel only when the server had none, while Publish, the renderer
 * and the remake took the browser's first. So a Claude key he pasted to use
 * his own limit or his own billing did nothing at all on a server that had
 * one, Try it said his key worked, and nothing said why it made no
 * difference.
 *
 * The rule now, for every key: the one in the Keys panel, riding on this
 * request in its own header, wins; the server's variable of the same name
 * is the silent fallback when the browser offers none. A key of eight
 * characters or fewer is not one and is dropped, as if none were offered,
 * rather than sent anywhere. Whatever is picked is used for the call and
 * nothing else: never stored, never logged, never echoed back.
 *
 * Tested by `tests/key-precedence.mjs`.
 */

/** Each header a browser sends a key on, and the server's variable for the same key. */
export const KEY_ENV = {
  "x-anthropic-key": "ANTHROPIC_API_KEY",
  "x-replicate-key": "REPLICATE_API_TOKEN",
  "x-openai-key": "OPENAI_API_KEY",
  "x-github-token": "GITHUB_TOKEN",
  "x-vercel-token": "VERCEL_TOKEN",
} as const;

export type KeyHeader = keyof typeof KEY_ENV;

/** What the routes hand in: `process.env`, or a test's own few names. */
type Env = { [name: string]: string | undefined };

/** The key this call uses and whose it is; null when neither side has one. */
export function keyFor(request: Request, header: KeyHeader, env: Env = process.env): { key: string; source: "browser" | "server" } | null {
  const supplied = request.headers.get(header)?.trim();
  if (supplied && supplied.length > 8) return { key: supplied, source: "browser" };
  const own = env[KEY_ENV[header]]?.trim();
  return own ? { key: own, source: "server" } : null;
}
