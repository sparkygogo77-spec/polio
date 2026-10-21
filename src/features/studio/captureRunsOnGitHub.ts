/**
 * THE CAPTURE RUNS GITHUB HAS, WHEREVER THEY WERE STARTED.
 *
 * This browser remembers the runs it started (`captureRuns.ts`), but only
 * those, and only once the run was found: a capture started from the
 * Actions tab, from another browser, or one whose page was closed before
 * the run showed up, was never written down here, and its capture could be
 * brought in only by downloading the zip by hand (J, 2026-10-21). So the
 * Capture dialog also asks GitHub for the workflow's own runs and for the
 * repository's `capture-*` artifacts, two calls, and lists every run of the
 * last 30 days beside the remembered ones, each finished one with Bring into
 * a new site.
 *
 * A run's name is its artifact's (`capture-<name>`), else the address its
 * title carries (`run-name: Capture <url>`). A run that ended badly but
 * still handed a capture back can be brought in too: what it kept is there.
 *
 * Pure apart from the `fetch` it is handed, so a check stands GitHub in.
 */
import { capturePlace, handsBack, nameFrom, WORKFLOW } from "./bring-in/index.ts";
import { runRef } from "./captureArtifact.ts";
import { KEEP_DAYS, type CaptureRun } from "./captureRuns.ts";

const API = "https://api.github.com";
/** Runs asked for at a time. */
export const RUNS_PAGE = 30;
const DAY = 24 * 60 * 60 * 1000;

interface GhRun { id: number; status?: string | null; conclusion?: string | null; html_url?: string; display_title?: string; head_branch?: string | null; created_at?: string; run_started_at?: string; updated_at?: string }
interface GhArtifact { id: number; name: string; expired?: boolean; size_in_bytes?: number; workflow_run?: { id?: number } | null }

export type Listed = { ok: true; runs: CaptureRun[]; more: boolean } | { ok: false; says: string };

/** The address a run's title names (`Capture https://…`), or "". */
export function addressOf(title: string | undefined): string {
  const m = /^Capture\s+(\S+)/.exec(String(title ?? "").trim());
  return m?.[1] ?? "";
}

/** One of GitHub's runs as a line of the list: its state, its name, and where its capture is when there is one. */
export function runFromGitHub(run: GhRun, art: GhArtifact | undefined, capturer: string): CaptureRun {
  const url = addressOf(run.display_title);
  const name = art ? art.name.replace(/^capture-/, "") : nameFrom(url) ?? `run-${run.id}`;
  const startedAt = Date.parse(run.run_started_at ?? run.created_at ?? "") || 0;
  const base: CaptureRun = { capturer, runId: run.id, name, url, pages: "/", htmlUrl: run.html_url ?? "", startedAt, ...(run.head_branch ? { ranOn: run.head_branch } : {}), at: "running" };
  if (run.status !== "completed") return base;
  const endedAt = Date.parse(run.updated_at ?? "") || startedAt;
  const place = capturePlace(name);
  if (art && !art.expired) return { ...base, at: "done", endedAt, ref: runRef(run.id), path: place.path, ...(run.conclusion !== "success" ? { says: `It ended ${run.conclusion ?? "badly"}, but handed back what it had captured.` } : {}) };
  if (art?.expired) return { ...base, at: "failed", endedAt, says: "Its capture has expired: GitHub keeps one 30 days." };
  /* A capturer that commits (sink) hands nothing back: a run that succeeded left the site on its branch. */
  if (run.conclusion === "success" && !handsBack(capturer)) return { ...base, at: "done", endedAt, ref: place.ref, path: place.path };
  if (run.conclusion === "success") return { ...base, at: "failed", endedAt, says: "It handed nothing back." };
  return { ...base, at: "failed", endedAt, says: `It ended ${run.conclusion ?? "without a conclusion"}; its log says why.` };
}

/**
 * The capture workflow's runs on GitHub, newest first, `RUNS_PAGE` a page,
 * none past GitHub's 30 days; `more` when an older page may follow.
 */
export async function listCaptureRuns(o: { capturer: string; token: string; page?: number; fetch?: typeof fetch; now?: number }): Promise<Listed> {
  const m = o.capturer.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return { ok: false, says: "The capturer wants to be owner/name, the repository the capture workflow lives in." };
  if (!o.token) return { ok: false, says: "No GitHub token in this browser yet. Open Keys and put one in to list the runs." };
  const f = o.fetch ?? fetch;
  const now = o.now ?? Date.now();
  const base = `${API}/repos/${m[1]}/${m[2]}`;
  const h = { Authorization: `Bearer ${o.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const page = Math.max(1, o.page ?? 1);
  try {
    const [r, a] = await Promise.all([
      f(`${base}/actions/workflows/${WORKFLOW}/runs?per_page=${RUNS_PAGE}&page=${page}`, { headers: h, cache: "no-store" } as RequestInit),
      f(`${base}/actions/artifacts?per_page=100&page=${page}`, { headers: h, cache: "no-store" } as RequestInit),
    ]);
    if (!r.ok) return { ok: false, says: r.status === 401 ? "GitHub does not know this token: it is expired, revoked or pasted wrong. Put a fresh one in Keys." : r.status === 404 ? `GitHub found no capture workflow on ${m[1]}/${m[2]} that this token can see: it needs Actions: Read there.` : `GitHub answered ${r.status} when asked for the capture runs.` };
    const runs = ((await r.json()) as { workflow_runs?: GhRun[] }).workflow_runs ?? [];
    /* The artifacts are a help, not a need: without them a run is named from its title and checked when brought in. */
    const arts = a.ok ? (((await a.json()) as { artifacts?: GhArtifact[] }).artifacts ?? []) : [];
    const byRun = new Map<number, GhArtifact>();
    for (const x of arts) if (/^capture-/.test(x.name) && x.workflow_run?.id && !byRun.has(x.workflow_run.id)) byRun.set(x.workflow_run.id, x);
    const listed = runs
      .filter((x) => x && typeof x.id === "number")
      .map((x) => runFromGitHub(x, byRun.get(x.id), o.capturer.trim()))
      .filter((x) => now - x.startedAt < KEEP_DAYS * DAY);
    return { ok: true, runs: listed, more: runs.length === RUNS_PAGE && listed.length === runs.length };
  } catch {
    return { ok: false, says: "GitHub could not be reached from this browser." };
  }
}

/**
 * The remembered runs and GitHub's, one line per run, newest first. A run
 * this browser saw end keeps its own line (it knows the pages it asked
 * for); otherwise GitHub's line is the fresher, and GitHub's own wins.
 */
export function mergeRuns(mine: CaptureRun[], theirs: CaptureRun[]): CaptureRun[] {
  const out = new Map<string, CaptureRun>();
  for (const r of theirs) out.set(`${r.capturer.toLowerCase()}#${r.runId}`, r);
  for (const r of mine) {
    const k = `${r.capturer.toLowerCase()}#${r.runId}`;
    const gh = out.get(k);
    const asked = { name: r.name, url: r.url || gh?.url || "", pages: r.pages, ...(r.look ? { look: true } : {}) };
    /* Seen to end here and not bettered by GitHub (a failed run that still handed a capture back is): this browser's line. */
    if (!gh || (r.at !== "running" && !(r.at === "failed" && gh.at === "done"))) out.set(k, r);
    else out.set(k, { ...gh, ...asked });
  }
  return [...out.values()].sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
}
