"use client";
/**
 * "Capture a site": paste an address, and it is captured and brought in.
 *
 * An address and a name, polio's own capture workflow run with his own
 * token in his own browser (`captureSite.ts`), its progress said as it
 * goes, and when the run ends, one press to bring the capture in. polio's
 * workflow commits nothing: the capture comes back as the run's artifact
 * and lands in the Builder's own store (`captureArtifact.ts`). A capturer
 * that commits (sink, typed under advanced) lands `sites/<name>/` on a
 * branch made for it, as before.
 *
 * What is under "advanced" — the pages, the repository the workflow lives
 * in, and its branch — is there because the common case is an address and
 * nothing else (docs/DESIGN.md: options hidden under advanced).
 *
 * Every run is remembered in this browser (`captureRuns.ts`): one still
 * going when the page is loaded again is watched again, and the finished
 * ones are listed under "Recent captures" for GitHub's 30 days, each with
 * Bring into a new site, so a capture is never lost to a reload or to
 * another site being open.
 *
 * The list also holds the runs GitHub has, wherever they were started
 * (`captureRunsOnGitHub.ts`): one from the Actions tab, another browser, or a
 * page closed before its run showed up is picked from here, not downloaded
 * by hand.
 */
import * as React from "react";
import { Camera, ExternalLink, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { startAsked } from "@/features/builds/start";
import { Dialog } from "@/core/ui/dialog";
import { Tooltip } from "@/core/ui/tooltip";
import { useActions } from "@/core/actions";
import { useRouter } from "next/navigation";
import { heldKeys, useKeys } from "@/features/keys/store";
import { staleBuild, staleSays } from "@/core/shell/BuildGuard";
import { bringRepoIn, type Bringing } from "./bringRepo";
import { activeSource, useBuilds } from "@/features/builds/store";
import { agoWords, daysLeft, keepRun, readRuns, type CaptureRun } from "./captureRuns";
import { listCaptureRuns, mergeRuns } from "./captureRunsOnGitHub";
import { DEFAULT_CAPTURER, oneAddress, captureBranch, captureName, capturePlace, captureWant, handsBack, isMainBranch, nameFrom, startCapture, watchCapture, type Ended, type Progress } from "./bring-in";

/**
 * Where the capturer lives: remembered in this browser, polio itself by
 * default. A capturer remembered from before the fold (sink, the old
 * default) is not kept: it was a default, not a choice.
 */
const CAPTURER = "builder.capturer.v2";
const rememberedCapturer = (): string => { try { return localStorage.getItem(CAPTURER) || DEFAULT_CAPTURER; } catch { return DEFAULT_CAPTURER; } };

/**
 * The importer with a path. `Bringing` has no `path` today; the lane
 * adding the sites/<name>/ setting to `repoRun.ts` is expected to read it
 * from here, as `Bringing.path?: string` → `readRepoSite(repo, token, say,
 * { path })`. Until then the root site of the branch is what is read.
 */
type BringingWithPath = Bringing & { path?: string };

type Stage = { at: "ask" } | { at: "running"; runId: number; htmlUrl: string; name: string; step: string } | { at: "done"; name: string; end: Ended; capturer: string };

const repoOf = (capturer: string): { owner: string; name: string } | null => {
  const m = capturer.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  return m && m[1] && m[2] ? { owner: m[1], name: m[2] } : null;
};

/* The runs being watched in this page, so a run is followed once however often the dialog mounts. */
const watching = new Set<string>();

/**
 * Follow a run to its end and write the end down. Every run started here
 * goes through this, and so does one found still running after a reload.
 */
async function follow(run: CaptureRun, onProgress?: (p: Progress) => void): Promise<Ended | null> {
  const key = `${run.capturer}#${run.runId}`;
  const r = repoOf(run.capturer);
  if (!r || watching.has(key)) return null;
  watching.add(key);
  try {
    /* Read at each poll: a run picked up as the page loads is followed before the keys have opened. */
    const token = () => heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    const end = await watchCapture({ repo: r, token, runId: run.runId, name: run.name, ranOn: run.ranOn, onProgress: onProgress ?? (() => {}) });
    keepRun(end.ok ? { ...run, at: "done", endedAt: Date.now(), ref: end.ref, path: end.path, htmlUrl: end.htmlUrl || run.htmlUrl } : { ...run, at: "failed", endedAt: Date.now(), says: end.says, htmlUrl: end.htmlUrl || run.htmlUrl });
    return end;
  } finally {
    watching.delete(key);
  }
}

/** The runs this browser remembers, kept fresh as they change. */
function useRuns(): CaptureRun[] {
  const [runs, setRuns] = React.useState<CaptureRun[]>([]);
  React.useEffect(() => {
    const read = () => setRuns(readRuns());
    read();
    window.addEventListener("studio:capture-runs", read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener("studio:capture-runs", read); window.removeEventListener("storage", read); };
  }, []);
  return runs;
}

type OnGitHub = { runs: CaptureRun[]; more: boolean; page: number; loading: boolean; says: string | null };

/**
 * The capture workflow's runs on GitHub, asked for when the dialog opens
 * with a key in hand, and again on Refresh. A run GitHub has still going
 * that this browser never saw start is written down and followed, so its
 * end lands in the list like one started here.
 */
function useRunsOnGitHub(capturer: string, on: boolean): OnGitHub & { refresh: () => void; older: () => void } {
  const [got, setGot] = React.useState<OnGitHub>({ runs: [], more: false, page: 0, loading: false, says: null });
  const asked = React.useRef(0);
  const ask = React.useCallback(async (page: number) => {
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    const n = ++asked.current;
    setGot((g) => ({ ...g, loading: true, says: null }));
    const out = await listCaptureRuns({ capturer, token, page });
    if (n !== asked.current) return;
    if (!out.ok) { setGot((g) => ({ ...g, loading: false, says: out.says })); return; }
    setGot((g) => ({ runs: page === 1 ? out.runs : mergeRuns(g.runs, out.runs), more: out.more, page, loading: false, says: null }));
    const known = new Set(readRuns().map((r) => `${r.capturer.toLowerCase()}#${r.runId}`));
    for (const run of out.runs.filter((r) => r.at === "running" && !known.has(`${r.capturer.toLowerCase()}#${r.runId}`))) {
      keepRun(run);
      void follow(run).then((end) => { if (end) void ask(1); });
    }
  }, [capturer]);
  /* A moment after the capturer stops changing, so typing one under Advanced is not a call a key. */
  React.useEffect(() => { if (!on || !repoOf(capturer)) return; const t = window.setTimeout(() => void ask(1), 300); return () => window.clearTimeout(t); }, [on, capturer, ask]);
  return { ...got, refresh: () => void ask(1), older: () => void ask(got.page + 1) };
}

export function CaptureSiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [typedName, setTypedName] = React.useState(false);
  const [pages, setPages] = React.useState("/");
  /* Look only, no presses: the pages as they open, nothing pressed (polio's own capturer). */
  const [look, setLook] = React.useState(false);
  const [capturer, setCapturer] = React.useState(DEFAULT_CAPTURER);
  /* The branch a capture lands on: its own, made for it, until someone types another (`captureBranch`). */
  const [branch, setBranch] = React.useState("");
  const [typedBranch, setTypedBranch] = React.useState(false);
  /* Main changes only with the owner's say-so, ticked here, never by default. */
  const [mainOk, setMainOk] = React.useState(false);
  const [stage, setStage] = React.useState<Stage>({ at: "ask" });
  const [said, setSaid] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const ctx = useActions();
  const router = useRouter();
  const unlocked = useKeys((s) => s.unlocked && !!s.values.GITHUB_TOKEN);
  const alive = React.useRef(true);
  const mine = useRuns();
  const onGitHub = useRunsOnGitHub(capturer, open && unlocked);
  const runs = React.useMemo(() => mergeRuns(mine, onGitHub.runs), [mine, onGitHub.runs]);
  const ids = React.useId();
  const urlField = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (open) { setCapturer(rememberedCapturer()); setSaid(null); } }, [open]);
  React.useEffect(() => () => { alive.current = false; }, []);
  /* The address takes the keys when the dialog opens, and only then: a press on another field keeps them there. */
  React.useEffect(() => { if (open && stage.at === "ask") { const t = window.setTimeout(() => { if (!(document.activeElement instanceof HTMLInputElement)) urlField.current?.focus(); }, 0); return () => window.clearTimeout(t); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  /* A run still going when the page was loaded (or another site opened) is watched again; its end is written down and said. */
  React.useEffect(() => {
    for (const run of readRuns().filter((x) => x.at === "running")) {
      void follow(run).then((end) => {
        if (!end) return;
        ctx.publish({ key: `studio:capture:${run.name}`, title: end.ok ? `${run.name} is captured` : `${run.name} did not capture`, body: end.ok ? "It is under Recent captures in the Capture dialog, ready to bring into a new site." : end.says, level: end.ok ? "info" : "warn", source: "studio", toast: { durationMs: 6000 } });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* The name follows the address until he types one himself. */
  React.useEffect(() => { if (!typedName) setName(nameFrom(url) ?? ""); }, [url, typedName]);
  /* A capturer that hands the capture back writes no branch: it runs on its default one. */
  const back = handsBack(capturer);
  /* The branch follows the name until he types one himself; for a capturer that commits, a new one made for the capture. */
  React.useEffect(() => { if (!typedBranch) setBranch(back ? "" : captureBranch(name || nameFrom(url) || "site")); }, [name, url, typedBranch, back]);
  const onMain = !back && isMainBranch(branch);

  const repo = (): { owner: string; name: string } | null => repoOf(capturer);

  const start = async () => {
    if (starting) return;
    const r = repo();
    if (!r) { setSaid("The capturer wants to be owner/name, the repository the capture workflow lives in."); return; }
    try { localStorage.setItem(CAPTURER, capturer.trim()); } catch { /* not kept */ }
    setSaid(null);
    setStarting(true);
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (onMain && !mainOk) { setStarting(false); setSaid(`Capturing on ${branch.trim() || "the default branch"} changes ${capturer.trim()}'s main line. Tick that the owner said yes, or use a new branch.`); return; }
    const started = await startCapture({ repo: r, token, url, name, pages, ref: branch.trim(), makeBranch: !back && !onMain, look: back && look });
    setStarting(false);
    if (!alive.current) return;
    if (!started.ok) { setSaid(started.says); return; }
    setStage({ at: "running", runId: started.runId, htmlUrl: started.htmlUrl, name: started.name, step: "Starting" });
    const run: CaptureRun = { capturer: capturer.trim(), runId: started.runId, name: started.name, url: oneAddress(url).url.trim(), pages: pages.trim() || "/", ...(back && look ? { look: true } : {}), htmlUrl: started.htmlUrl, startedAt: Date.now(), ranOn: started.ref, at: "running" };
    keepRun(run);
    const end = await follow(run, (p: Progress) => { if (alive.current) setStage((s) => (s.at === "running" ? { ...s, step: p.step || (p.status === "queued" ? "Waiting for a runner" : "Running") } : s)); });
    if (!alive.current || !end) return;
    setStage({ at: "done", name: started.name, end, capturer: run.capturer });
    ctx.publish({ key: `studio:capture:${started.name}`, title: end.ok ? `${started.name} is captured` : `${started.name} did not capture`, body: end.ok ? `${end.ref.startsWith("run:") ? "It came back from the run" : `It is at ${end.path} on ${end.ref}`}. Bring it in from the dialog.` : end.says, level: end.ok ? "info" : "warn", source: "studio", toast: { durationMs: 6000 } });
  };

  const bringIn = (siteName: string, ref?: string, from: string = capturer) => {
    const r = repoOf(from);
    if (!r) return;
    const place = capturePlace(siteName);
    const o: BringingWithPath = {
      own: activeSource(),
      path: place.path,
      say: (n) => ctx.publish({ ...n, level: "info", source: "studio", toast: { durationMs: 5000 } }),
      toBoard: () => router.push("/builder"),
      stale: () => !!staleBuild(),
      staleSays,
      hasToken: () => !!heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN,
    };
    const out = bringRepoIn(captureWant(r, siteName, ref), o);
    if (out.ok) { onOpenChange(false); reset(); return; }
    setSaid(out.says ?? "It could not be brought in.");
  };

  /**
   * A new site for the capture: the open site keeps its parts and its
   * source, and the capture comes into a site of its own, named for it.
   * (A site that came from one capture brings in that one only.)
   */
  const intoNewSite = (siteName: string, ref: string | undefined, from: string) => {
    setSaid(null);
    const id = useBuilds.getState().create(siteName);
    let done = false;
    const go = () => { if (done) return; done = true; off(); window.setTimeout(() => bringIn(siteName, ref, from), 60); };
    const off = useBuilds.subscribe((s) => { if (s.activeId === id) go(); });
    window.setTimeout(go, 4000);
  };

  const reset = () => { setStage({ at: "ask" }); setUrl(""); setName(""); setTypedName(false); setTypedBranch(false); setMainOk(false); setPages("/"); setLook(false); setSaid(null); };
  const nameOk = !name.trim() || captureName(name) !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v && stage.at === "done") reset(); }}
      title="Capture a site"
      description="Paste an address. It is captured page by page by your own repository's workflow, ready to bring in."
      footer={
        stage.at === "ask" ? (
          <Button onClick={() => void start()} loading={starting} disabled={!url.trim() || !nameOk || !unlocked || (onMain && !mainOk)} data-capture-start="">
            <Camera /> Capture
          </Button>
        ) : stage.at === "done" && stage.end.ok ? (
          <>
            <Button variant="outline" onClick={() => intoNewSite(stage.name, stage.end.ok ? stage.end.ref : undefined, stage.capturer)} data-capture-import-new=""><Plus /> Bring into a new site</Button>
            <Button onClick={() => bringIn(stage.name, stage.end.ok ? stage.end.ref : undefined, stage.capturer)} data-capture-import="">{stage.end.ref.startsWith("run:") ? `Bring ${stage.name} in` : `Bring ${stage.end.path} in`}</Button>
          </>
        ) : stage.at === "done" ? (
          <Button variant="outline" onClick={reset}>Try again</Button>
        ) : null
      }
    >
      {stage.at === "ask" ? (
        <div className="flex flex-col gap-3">
          {!unlocked ? <p className="text-xs text-fg-muted">No GitHub token in this browser yet. Open Keys and put one in; the capture runs in your own repository with it.</p> : null}
          {/* Each label names its own field (htmlFor), and a press on a field gives it the keys: the address is focused when the dialog opens, never again. */}
          <div className="flex flex-col gap-1 text-xs text-fg-muted">
            <label htmlFor={`${ids}-url`}>Address</label>
            <Input id={`${ids}-url`} ref={urlField} value={url} onChange={(e) => { const a = oneAddress(e.target.value); setUrl(a.url); if (a.joined) { setTypedName(false); setSaid(`Two addresses had run together, so only the last one is kept: ${a.url}`); } }} onPointerDown={(e) => e.currentTarget.focus()} placeholder="https://example.com" autoComplete="off" spellCheck={false} data-capture-url="" />
          </div>
          <div className="flex flex-col gap-1 text-xs text-fg-muted">
            <label htmlFor={`${ids}-name`}>Name <span className="text-fg-subtle">— the folder it is kept under, sites/{captureName(name) ?? "…"}</span></label>
            <Input id={`${ids}-name`} value={name} onChange={(e) => { setTypedName(true); setName(e.target.value); }} onPointerDown={(e) => e.currentTarget.focus()} placeholder={nameFrom(url) ?? "my-site"} autoComplete="off" spellCheck={false} data-capture-name="" />
          </div>
          {!nameOk ? <p className="text-xs text-warning">A name is letters, digits and dashes, and not a path.</p> : null}
          {back ? (
            <p data-capture-where="" className="text-xs text-fg-muted">
              It runs in <span className="font-mono">{capturer.trim()}</span> and comes back as the run&apos;s artifact, kept 30 days; nothing is committed. Bring it in when it ends.
            </p>
          ) : (
            <p data-capture-where="" className="text-xs text-fg-muted">
              It lands on {onMain ? "" : "a new branch, "}<span className="font-mono">{branch.trim() || "the default branch"}</span>, in {capturer.trim() || "the capturer"}. Changes to its main line need the owner&apos;s OK.
            </p>
          )}
          <details className="rounded-lg border border-border bg-elevated p-3">
            <summary className="cursor-pointer text-xs text-fg-muted">Advanced</summary>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-col gap-1 text-xs text-fg-muted">
                <label htmlFor={`${ids}-pages`}>Pages <span className="text-fg-subtle">— paths, comma-separated; <span className="font-mono">?screen=*</span> takes every screen a page lists, one page each</span></label>
                <Input id={`${ids}-pages`} value={pages} onChange={(e) => setPages(e.target.value)} onPointerDown={(e) => e.currentTarget.focus()} placeholder="/, /docs" autoComplete="off" spellCheck={false} mono data-capture-pages="" />
              </div>
              {back ? (
                <label data-capture-look="" className="flex items-start gap-2 text-xs text-fg-muted">
                  <input type="checkbox" checked={look} onChange={(e) => setLook(e.target.checked)} className="mt-0.5" />
                  <span>Look only, no presses <span className="text-fg-subtle">— each page as it opens, nothing pressed; much faster on a page of many buttons. Still screens are always read this way.</span></span>
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-xs text-fg-muted">
                Capturer <span className="text-fg-subtle">— the repository with the capture workflow</span>
                <Input value={capturer} onChange={(e) => setCapturer(e.target.value)} onPointerDown={(e) => e.currentTarget.focus()} placeholder={DEFAULT_CAPTURER} autoComplete="off" spellCheck={false} mono data-capture-capturer="" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-muted">
                {back ? <>Branch it runs on <span className="text-fg-subtle">: the default one when empty</span></> : <>Branch it lands on <span className="text-fg-subtle">: a new branch, made for this capture</span></>}
                <Input value={branch} onChange={(e) => { setTypedBranch(true); setMainOk(false); setBranch(e.target.value); }} placeholder={back ? "the default branch" : captureBranch(name || "site")} mono data-capture-branch="" />
              </label>
              {onMain ? (
                <label data-capture-main-ok="" className="flex items-start gap-2 text-xs text-warning">
                  <input type="checkbox" checked={mainOk} onChange={(e) => setMainOk(e.target.checked)} className="mt-0.5" />
                  <span>This changes {capturer.trim() || "the capturer"}&apos;s main line. The owner said yes to that.</span>
                </label>
              ) : null}
            </div>
          </details>
          {said ? <p className="text-xs text-warning" role="status">{said}</p> : null}
          <RecentRuns runs={runs} onGitHub={unlocked ? onGitHub : null} bring={(run) => intoNewSite(run.name, run.ref, run.capturer)} />
        </div>
      ) : stage.at === "running" ? (
        <div className="flex flex-col gap-2 text-sm" data-capture-running="">
          <p className="flex items-center gap-2"><Loader2 className="animate-spin" /> Capturing {stage.name} — {stage.step}</p>
          <a className="inline-flex items-center gap-1 text-xs text-fg-muted underline" href={stage.htmlUrl} target="_blank" rel="noopener noreferrer">Watch the run on GitHub <ExternalLink className="size-3" /></a>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm" data-capture-done="">
          {stage.end.ok ? (
            stage.end.ref.startsWith("run:")
              ? <p>Captured. It came back from the run, ready to bring in; GitHub keeps it 30 days.</p>
              : <p>Captured. It is at <code>{stage.end.path}/</code> on <code>{stage.end.ref}</code>, beside your other captures.</p>
          ) : (
            <p className="text-warning">{stage.end.says}</p>
          )}
          <a className="inline-flex items-center gap-1 text-xs text-fg-muted underline" href={stage.end.htmlUrl} target="_blank" rel="noopener noreferrer">The run on GitHub <ExternalLink className="size-3" /></a>
          {said ? <p className="text-xs text-warning" role="status">{said}</p> : null}
        </div>
      )}
    </Dialog>
  );
}

/**
 * The runs this browser remembers and the ones GitHub has: the finished ones
 * to bring into a new site, the running ones to watch. Refresh asks GitHub
 * again; Show older asks for the page before.
 */
function RecentRuns({ runs, onGitHub, bring }: { runs: CaptureRun[]; onGitHub: (OnGitHub & { refresh: () => void; older: () => void }) | null; bring: (run: CaptureRun) => void }) {
  if (!runs.length && !onGitHub) return null;
  return (
    <section data-capture-recent="" className="flex flex-col gap-1.5 border-t border-border pt-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-medium text-fg">Recent captures <span className="font-normal text-fg-subtle">— every run of the last 30 days, wherever it was started</span></p>
        {onGitHub ? (
          <Tooltip content="Ask GitHub again for the capture runs">
            <Button size="iconXs" variant="ghost" aria-label="Refresh the capture runs" onClick={onGitHub.refresh} disabled={onGitHub.loading} data-capture-runs-refresh="">
              {onGitHub.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            </Button>
          </Tooltip>
        ) : null}
      </div>
      {onGitHub?.says ? <p className="text-fine text-warning" data-capture-runs-says="">{onGitHub.says}</p> : null}
      {!runs.length && onGitHub && !onGitHub.loading && !onGitHub.says ? <p className="text-fine text-fg-muted">No capture runs in the last 30 days.</p> : null}
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {runs.map((run) => (
          <li key={`${run.capturer}#${run.runId}`} data-capture-run={run.runId} data-capture-run-at={run.at} className="flex items-center gap-2 rounded-md border border-border bg-elevated px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-fg">{run.name} <span className="text-fg-subtle">· {run.url || "no address said"}</span></p>
              <p className="truncate text-fine text-fg-muted" title={run.says}>
                {run.at === "running" ? "Still running" : run.at === "failed" ? run.says ?? "Did not capture; its log says why" : `Captured ${agoWords(run.endedAt ?? run.startedAt)}, ${daysLeft(run)} days left${run.says ? `. ${run.says}` : ""}`}
              </p>
            </div>
            {run.htmlUrl ? <a href={run.htmlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-fine text-fg-muted hover:text-fg">run <ExternalLink className="size-3" /></a> : null}
            {run.at === "done" ? (
              <Button size="xs" variant="outline" onClick={() => bring(run)} data-capture-recent-bring="">Bring into a new site</Button>
            ) : run.at === "running" ? <Loader2 className="size-3 shrink-0 animate-spin text-fg-muted" /> : null}
          </li>
        ))}
      </ul>
      {onGitHub?.more ? <Button size="xs" variant="ghost" className="self-start" onClick={onGitHub.older} loading={onGitHub.loading} data-capture-runs-older="">Show older runs</Button> : null}
    </section>
  );
}

/** The door in the bar, beside the one that brings a repository in. */
/** `hidden`: no key in the bar, only the dialog; the bar's More opens it (`StudioPage.tsx#MoreTools`). */
export function CaptureSiteDoor({ hidden = false }: { hidden?: boolean } = {}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const on = () => setOpen(true);
    /* Builds' "Import a site" opens the Builder with `?start=capture` (`builds/start.ts`). */
    if (startAsked("capture")) on();
    window.addEventListener("studio:capture-site", on);
    return () => window.removeEventListener("studio:capture-site", on);
  }, []);
  return (
    <>
      {hidden ? null : (
        <Tooltip content="Capture a site: paste an address, it is captured in your repository and brought in.">
          <Button variant="ghost" size="iconXs" data-capture-site="" aria-label="Capture a site" onClick={() => setOpen(true)}>
            <Camera />
          </Button>
        </Tooltip>
      )}
      <CaptureSiteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
