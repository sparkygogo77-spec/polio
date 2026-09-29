/**
 * RECAPTURE: a site brought in from a capture, captured again from its address.
 *
 * A capture keeps what it was asked in `sites/<name>/capture/run.json`: the
 * live address, the pages, the window. Recapture reads that, shows the
 * address so it can be changed, and runs sink's own capture workflow again
 * (`captureSite.ts`, the Capture dialog's road) with the same pages and the
 * site's own folder name, from the branch the site came from. When the run
 * ends, the repo menu offers the same Replace prompt Bring in again does.
 *
 * WHERE IT LANDS. sink's `capture.yml` takes an address, a name and pages,
 * and always commits `sites/<name>` to the branch `captures/<name>`,
 * whichever branch it was run from. Polio never writes to sink, so the
 * folder is the site's own and the branch is the workflow's; when that is
 * not the branch the site came from, it is said before the run starts, and
 * after a Replace the site's source is where the capture really is.
 *
 * GitHub is read no faster than every 10 s while the run goes.
 *
 * Pure apart from the pipes it is handed, so a test drives it with a stand-in.
 */
import { captureName, capturePlace, startCapture, watchCapture, workflowPermissionSays, type CaptureRepo, type Pipes, type Progress } from "./captureSite";

export { workflowPermissionSays };

/** The site's recorded source, as the builds store keeps it. */
export interface Source { owner: string; name: string; branch: string; dir?: string | null }
/** What a capture recorded about itself (`capture/run.json`). */
export interface CaptureRecord { url?: string; name?: string; pages?: string[] }

export interface Plan {
  url: string;
  /** As the workflow takes them: a comma list. */
  pages: string;
  name: string;
  /** The branch the workflow is run from: the one the site came from. */
  ref: string;
  /** Where sink commits it. */
  lands: { ref: string; path: string };
  /** Said when `lands.ref` is not the branch the site came from. */
  branchNote: string | null;
  /** Learn on click: the held presses to make, once each (`learn.ts`). Sent only to a capturer that says it can press. */
  learn?: unknown;
}

/** The slowest GitHub is asked while a run goes. */
export const EVERY_MS = 10_000;

/** A plan for a site brought in from a capture folder, or null for one that was not. */
export function recapturePlan(src: Source | null | undefined, record: CaptureRecord | null): Plan | null {
  if (!src?.dir) return null;
  const name = captureName(record?.name ?? src.dir.split("/").pop() ?? "") ?? captureName(src.dir.split("/").pop() ?? "");
  if (!name) return null;
  const lands = capturePlace(name);
  const pages = (record?.pages?.length ? record.pages : ["/"]).join(", ");
  return {
    url: record?.url ?? "",
    pages,
    name,
    ref: src.branch,
    lands,
    branchNote: lands.ref === src.branch ? null
      : `Sink's capture workflow commits ${lands.path} to ${lands.ref}, not to ${src.branch}: the new capture is brought in from there, and this site's source follows it.`,
  };
}

/** The record a capture left, read with his key: null when there is none to read. */
export async function readCaptureRecord(src: Source, token: string, pipes: Pipes = {}): Promise<CaptureRecord | null> {
  if (!src.dir) return null;
  const f = pipes.fetch ?? fetch;
  const path = `${src.dir.replace(/\/+$/, "")}/capture/run.json`.split("/").map(encodeURIComponent).join("/");
  try {
    const r = await f(`https://api.github.com/repos/${src.owner}/${src.name}/contents/${path}?ref=${encodeURIComponent(src.branch)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, cache: "no-store",
    } as RequestInit);
    if (!r.ok) return null;
    const j = (await r.json()) as { content?: string; encoding?: string };
    if (j.encoding !== "base64" || !j.content) return null;
    const text = typeof atob === "function" ? new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\s/g, "")), (c) => c.charCodeAt(0))) : Buffer.from(j.content, "base64").toString("utf8");
    const rec = JSON.parse(text) as CaptureRecord;
    return { url: typeof rec.url === "string" ? rec.url : undefined, name: typeof rec.name === "string" ? rec.name : undefined, pages: Array.isArray(rec.pages) ? rec.pages.filter((p) => typeof p === "string") : undefined };
  } catch {
    return null;
  }
}

export type Recaptured = { ok: true; ref: string; path: string; htmlUrl: string; note: string | null } | { ok: false; says: string; htmlUrl?: string };

/**
 * Run it: dispatch, find the run, watch it to its end. The workflow is run
 * from the site's branch; a branch without the workflow falls back to the
 * repository's default one, and says so.
 */
export async function runRecapture(o: {
  repo: CaptureRepo; token: string; plan: Plan;
  onProgress: (p: Progress) => void;
  onStarted?: (htmlUrl: string) => void;
} & Pipes): Promise<Recaptured> {
  const common = { repo: o.repo, token: o.token, url: o.plan.url, name: o.plan.name, pages: o.plan.pages, ...(o.plan.learn ? { learn: o.plan.learn } : {}), fetch: o.fetch, sleep: o.sleep, findEveryMs: EVERY_MS, findTries: 6 };
  let note: string | null = null;
  let started = await startCapture({ ...common, ref: o.plan.ref });
  if (!started.ok && started.status === 404 && o.plan.ref) {
    note = `${o.plan.ref} has no capture workflow, so it ran from the default branch.`;
    started = await startCapture({ ...common, ref: "" });
  }
  if (!started.ok) return { ok: false, says: started.says };
  o.onStarted?.(started.htmlUrl);
  const end = await watchCapture({ repo: o.repo, token: o.token, runId: started.runId, name: started.name, onProgress: o.onProgress, everyMs: EVERY_MS, fetch: o.fetch, sleep: o.sleep });
  if (!end.ok) return { ok: false, says: end.says, htmlUrl: end.htmlUrl };
  return { ok: true, ref: end.ref, path: end.path, htmlUrl: end.htmlUrl, note };
}
