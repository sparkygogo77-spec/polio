/**
 * PRIVACY FOR SCREENSHOTS (Orbs 2, piece 5; the rules are
 * Pleo/handovers/open/privacy-rules.md, written by the console lane VEIL).
 *
 * J shares screenshots of the Builder's Agents dock. So: one switch,
 * "🫥 Private", on by default and kept per browser. While it is on, a
 * sensitive value (pid, port, address, path, command line, log line, model
 * name, session id, per-process memory, branch or commit) is drawn as the
 * soft word "hidden", and a chat's name is shortened to its badge (emoji and
 * code word). Every sensitive value sits inside a fold ("Details"), closed by
 * default, whether the switch is on or off. The switch changes drawing only.
 *
 * Pure, no imports. `helper/dock/privacy.ts` is the same file, byte for byte,
 * for the helper's own dock page (the helper is not part of the Next build);
 * tests/orbs-2.mjs checks the two agree. The patterns are the console's
 * (`polio-console/hooks/privacy.ts`), so all three hide the same things.
 */

export const HIDDEN = "hidden";
export const PRIVATE_KEY = "polio.private";

/** The switch as kept: on unless this browser turned it off. */
export function readPrivate(stored: string | null): boolean {
  return stored !== "off";
}

/** One sensitive value: "hidden" while private. */
export const veil = (on: boolean, value: string | number | null | undefined): string => (on ? HIDDEN : value === null || value === undefined ? "" : String(value));

/* Free text can carry a path, a port, a pid or an id: while private each becomes "hidden". Whole paths and addresses go before the bare numbers in them. */
const SCRUBS: RegExp[] = [
  /\b[A-Za-z]:[\\/][^\s"'`,;)]*/g,
  /\\\\[^\s"'`,;)]+/g,
  /(?:~|\.{1,2})?\/?(?:[\w.@-]+\/){2,}[\w.@-]+|(?:~|\.{1,2})?\/?(?:[\w.@-]+\/)+[\w@-]+\.\w{1,5}\b/g,
  /\b[\w-]+\.(?:json|log|mjs|js|ts|tsx|md|ps1|vbs|exe|jpg|png|lock|txt|blend|py)\b/g,
  /\b(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?\S*/gi,
  /\b(?:port|pid|ppid)\s*:?\s*\d+/gi,
  /\blocal_[0-9a-f-]{6,}/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /\b(?:claude|feat|fix|work)\/[\w./-]+/g,
  /\b(?:work|lane)-[a-z0-9][\w-]*/gi,
  /\b(?:Fable|Opus|Sonnet|Haiku)\s*\d+(?:\.\d+)?(?:\s+(?:low|medium|high|xhigh|max))?/g,
  /\b(?:npx|npm|node|next|powershell|pwsh|cmd|wscript|cscript)(?:\.exe)?\s+(?:-{1,2}\w|\/c\b|[\w.\\/-]+\.(?:m?js|ts|ps1|vbs|cmd|bat)\b|(?:run|ci|test|dev|build|start|exec)\b)[^\n·]*/gi,
];
export function scrub(on: boolean, text: string | null | undefined): string {
  const t = text ?? "";
  if (!on || !t) return t;
  let out = t;
  for (const re of SCRUBS) out = out.replace(re, HIDDEN);
  return out.replace(/\bhidden(?:[\s:/\\.-]*hidden)+\b/g, HIDDEN);
}

/** A chat's badge: its emoji and code word, or nothing when the feed gives neither. */
export const badgeOf = (x: { emoji?: string; code?: string }) => `${x.emoji ?? ""} ${(x.code ?? "").toUpperCase()}`.trim();
/** A chat's name while private: its badge, else "a chat". Off, the name. */
export const shortName = (on: boolean, badge: string, name: string): string => (on ? badge || "a chat" : name);
