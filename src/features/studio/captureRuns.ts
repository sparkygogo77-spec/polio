/**
 * THE CAPTURES RUN FROM THIS BROWSER, REMEMBERED.
 *
 * A capture takes minutes, and the Capture dialog used to hold its run only
 * in its own state: a reload, or opening another site, and a finished
 * capture was gone from the Builder although GitHub keeps its artifact 30
 * days. So every run started here is written down in this browser as it
 * starts, and again as it ends; a run still going when the page is loaded
 * again is watched again, and the finished ones are listed in the dialog
 * with a button to bring each into a new site.
 *
 * Only what names the run is kept (repository, run id, the site's name,
 * address and pages, where it landed); never a token.
 */

export const RUNS_KEY = "builder.captureRuns.v1";
/** GitHub keeps a run's artifact this long; a run older than this has nothing left to bring in. */
export const KEEP_DAYS = 30;
/** The most runs listed. */
export const RUNS_MOST = 12;

export interface CaptureRun {
  /** The repository the workflow ran in, `owner/name`. */
  capturer: string;
  runId: number;
  /** The site's folder name, `sites/<name>`. */
  name: string;
  url: string;
  pages: string;
  /** Look only, no presses. */
  look?: boolean;
  htmlUrl: string;
  startedAt: number;
  /** The branch it was started on, to look on when it ends. */
  ranOn?: string;
  at: "running" | "done" | "failed";
  endedAt?: number;
  /** Where it landed, when done: `run:<id>` for an artifact, else a branch. */
  ref?: string;
  path?: string;
  /** Why it failed, when it did. */
  says?: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** The runs worth listing: not past GitHub's 30 days, newest first, one line per run, at most RUNS_MOST. */
export function keptRuns(list: CaptureRun[], now = Date.now()): CaptureRun[] {
  const seen = new Set<string>();
  return list
    .filter((r) => r && typeof r.runId === "number" && typeof r.capturer === "string" && now - (r.startedAt ?? 0) < KEEP_DAYS * DAY)
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
    .filter((r) => { const k = `${r.capturer}#${r.runId}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, RUNS_MOST);
}

/** The list with this run written in: a run already there is replaced by its newer state. */
export function withRun(list: CaptureRun[], run: CaptureRun, now = Date.now()): CaptureRun[] {
  return keptRuns([run, ...list.filter((r) => !(r.capturer === run.capturer && r.runId === run.runId))], now);
}

/** How long ago, in plain words. */
export function agoWords(at: number, now = Date.now()): string {
  const m = Math.round((now - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** Days left before GitHub lets the artifact go. */
export function daysLeft(run: CaptureRun, now = Date.now()): number {
  return Math.max(0, Math.ceil((run.startedAt + KEEP_DAYS * DAY - now) / DAY));
}

type Store = Pick<Storage, "getItem" | "setItem">;
const store = (): Store | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

export function readRuns(s: Store | null = store(), now = Date.now()): CaptureRun[] {
  try {
    const raw = s?.getItem(RUNS_KEY);
    const list = raw ? (JSON.parse(raw) as CaptureRun[]) : [];
    return Array.isArray(list) ? keptRuns(list, now) : [];
  } catch {
    return [];
  }
}

/** Write one run in. Returns the list as it now stands. */
export function keepRun(run: CaptureRun, s: Store | null = store(), now = Date.now()): CaptureRun[] {
  const list = withRun(readRuns(s, now), run, now);
  try { s?.setItem(RUNS_KEY, JSON.stringify(list)); } catch { /* not kept: the list still shows for this page */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("studio:capture-runs"));
  return list;
}
