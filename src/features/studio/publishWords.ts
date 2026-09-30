/**
 * WHAT THE TOP BAR SAYS ABOUT A PUBLISH, IN PLAIN WORDS.
 *
 * The bar used to show whatever the provider said, whole: "Resource is
 * limited - try again in 24 hours (more than 100, code:
 * "api-deployments-free-per-day")". The owner could not tell from that
 * whether the change was saved, lost, or waiting. So a publish is three steps
 * a person can follow, and a failure is one sentence saying what happened to
 * the change and what to do; what the provider said stays behind a
 * "details" fold (`GoLiveButton.tsx`).
 *
 *   Saving to GitHub…
 *   Saved to GitHub ✓, waiting for Vercel…
 *   Live ✓ (time, open link)
 *
 * Pure: no React, no store, so `tests/publish-words.mjs` reads it directly.
 */

export type PublishStep =
  | { at: "saving"; site?: string }
  | { at: "waiting"; site?: string; saved?: { repo: string; branch: string } }
  | { at: "live"; site?: string; url: string; when: number;
      /** Vercel's page for this deployment, and GitHub's page for the commit it built: both what the publish itself answered. */
      deployment?: string | null; commit?: string | null }
  | { at: "failed"; site?: string; failure: PlainFailure };

export type FailureKind = "vercel-limit" | "server" | "no-key" | "github-unreachable" | "github" | "vercel" | "build" | "not-started" | "blocked";

export interface PlainFailure {
  kind: FailureKind;
  /** The one sentence a person reads. */
  says: string;
  /** Whether the change is already on GitHub, so nothing typed is lost. */
  saved: boolean;
  /** What the provider or the server said, word for word, for the "details" fold. */
  detail?: string;
}

/** What a failed step brought back, from whichever call failed. */
export interface Failed {
  /** Which step: pushing to GitHub, asking Vercel, or the build itself. */
  stage: "github" | "vercel" | "build";
  message?: string;
  reason?: string;
  /** The HTTP status the Builder's own server answered with, when it was not a normal answer. */
  serverStatus?: number;
  /** The status the provider answered with, when the route passed it on. */
  status?: number;
  /** The provider's own code, e.g. "api-deployments-free-per-day". */
  code?: string;
  /** When the provider's limit resets: seconds or milliseconds since 1970, as Vercel sends it. */
  reset?: number;
  /** Which key is missing, when that is the trouble. */
  missing?: string[];
  /** Where the change was saved, when it was. */
  saved?: { repo: string; branch: string };
  /** The Builder's own line on the likely fix, when the route has one: said, never folded away. */
  hint?: string;
}

/** Reasons whose message the Builder wrote itself, in plain words, rather than passing on what a provider said. */
const OWN_WORDS = new Set(["too-big", "too-many", "bound", "source", "capture", "capture-unknown", "bad-repo", "no-repo", "empty", "elsewhere", "no-project", "name-taken", "github-access"]);

const LIMIT = /api-deployments-free-per-day|deployments?[- ]per[- ]day|rate[- ]limit|resource is limited|too many deployments/i;
const UNREACHABLE = /could not be reached|could not reach|failed to fetch|fetch failed|networkerror|network error|load failed|ENOTFOUND|ECONNRE|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket hang up/i;

/** A time a person reads: "about 3:40 pm tomorrow", or "about 24 hours from now" when no clock time is known. */
export function aboutWhen(reset: number | undefined, now = Date.now(), message = ""): string {
  let at = reset && reset > 0 ? (reset < 1e12 ? reset * 1000 : reset) : NaN;
  if (Number.isNaN(at)) {
    const m = /try again in (\d+) (minute|hour|day)s?/i.exec(message);
    if (m) at = now + Number(m[1]) * (m[2]!.toLowerCase() === "minute" ? 60_000 : m[2]!.toLowerCase() === "hour" ? 3_600_000 : 86_400_000);
  }
  if (Number.isNaN(at)) return "about 24 hours after the limit was reached";
  const d = new Date(at);
  const today = new Date(now);
  const clock = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(now + 86_400_000).toDateString() === d.toDateString();
  const day = sameDay ? "today" : tomorrow ? "tomorrow" : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return `about ${clock} ${day}`;
}

/**
 * One failed step, said plainly. The order matters: a missing key and the
 * Builder's own server failing are said before anything the provider said,
 * because they are what a person can act on first.
 */
export function plainFailure(f: Failed, now = Date.now()): PlainFailure {
  const detail = [f.message, f.code && !(f.message ?? "").includes(f.code) ? `code: ${f.code}` : "", f.status ? `status ${f.status}` : ""].filter(Boolean).join(" · ") || undefined;
  const savedWhere = f.saved ? `Your change is saved on GitHub (${f.saved.repo} on ${f.saved.branch})` : "Your change is saved on GitHub";
  const gitSaved = f.stage !== "github";

  /* Held back by the Builder itself before anything was sent: its own sentence is already the plain one. */
  if (f.reason === "blocked") return { kind: "blocked", saved: false, says: f.message ?? "Update live site is off for this site.", detail: undefined };
  if (f.missing?.length || f.reason === "no-token" || f.reason === "no-github") {
    const which = f.missing?.length ? f.missing : [f.stage === "github" || f.reason === "no-github" ? "GitHub" : "Vercel"];
    return { kind: "no-key", saved: gitSaved, says: `Needs a ${which.join(" and a ")} key. Put ${which.length > 1 ? "them" : "it"} in the Keys panel (Ctrl+Shift+K), then press Update live site again.${gitSaved ? ` ${savedWhere}.` : ""}`, detail };
  }
  /* The browser never reached the Builder's own server: GitHub and Vercel were not asked at all. */
  if (f.reason === "builder-unreachable") {
    return { kind: "server", saved: gitSaved, says: `The Builder's own server could not be reached from this browser, so ${f.stage === "github" ? "nothing was saved" : "Vercel was not asked to build it"}. Check the connection and press Update live site again.${gitSaved ? ` ${savedWhere}.` : ""}`, detail };
  }
  if (f.serverStatus && f.serverStatus >= 500) {
    return { kind: "server", saved: gitSaved, says: `The Builder's own server failed (status ${f.serverStatus}) while ${f.stage === "github" ? "saving to GitHub, so nothing was saved" : "asking Vercel to build it"}. Press Update live site again in a minute.${gitSaved ? ` ${savedWhere}.` : ""}`, detail };
  }
  if (LIMIT.test(`${f.code ?? ""} ${f.message ?? ""}`) || f.status === 429) {
    if (f.stage === "github") {
      return { kind: "github", saved: false, says: `GitHub is limiting how often this key can save right now, so nothing was saved. Try again ${aboutWhen(f.reset, now, f.message)}.`, detail };
    }
    return { kind: "vercel-limit", saved: true, says: `Vercel's daily limit on builds is used up. ${savedWhere} and goes live when Vercel allows, ${aboutWhen(f.reset, now, f.message)}.`, detail };
  }
  if (f.reason === "network" || UNREACHABLE.test(f.message ?? "")) {
    if (f.stage === "github") return { kind: "github-unreachable", saved: false, says: "GitHub could not be reached, so nothing was saved. Check the connection and press Update live site again.", detail };
    return { kind: "vercel", saved: true, says: `Vercel could not be reached. ${savedWhere}; press Update live site again to build it.`, detail };
  }
  /* The Builder's own refusals are its own plain sentences: shown, not hidden behind "details". */
  if (f.reason && OWN_WORDS.has(f.reason) && f.message) {
    const m = f.message.replace(/^GitHub: /, "");
    return f.stage === "github"
      ? { kind: "github", saved: false, says: `Nothing was saved: ${m}`, detail: undefined }
      : { kind: "vercel", saved: true, says: `${savedWhere}, but it was not built: ${m}`, detail: undefined };
  }
  if (f.stage === "github") return { kind: "github", saved: false, says: "GitHub would not take the change, so nothing was saved. Open details for what GitHub said.", detail };
  if (f.reason === "not-started") return { kind: "not-started", saved: true, says: `${savedWhere}, but Vercel has not started building it after five minutes. It may be over its daily limit; it goes live when Vercel builds it.`, detail };
  if (f.stage === "build") return { kind: "build", saved: true, says: `${savedWhere}, but Vercel's build of it failed. Open details for what Vercel said.`, detail };
  return { kind: "vercel", saved: true, says: `${savedWhere}, but Vercel would not build it. ${f.hint ?? "Open details for what Vercel said."}`, detail };
}

/** The line the top bar shows for a step. */
export function stepWords(s: PublishStep, now = Date.now()): string {
  switch (s.at) {
    case "saving": return "Saving to GitHub…";
    case "waiting": return "Saved to GitHub ✓, waiting for Vercel…";
    case "live": return `Live ✓ ${clockOf(s.when, now)}`;
    case "failed": return s.failure.says;
  }
}

/** "at 3:41 pm" today, "on 2 October at 3:41 pm" otherwise. */
export function clockOf(when: number, now = Date.now()): string {
  const d = new Date(when);
  const clock = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date(now).toDateString() ? `at ${clock}` : `on ${d.toLocaleDateString(undefined, { day: "numeric", month: "long" })} at ${clock}`;
}
