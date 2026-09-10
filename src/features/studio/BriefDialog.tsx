"use client";
/**
 * The compiled brief, and everything Claude can do with it.
 *
 * The blueprint is what the canvas says, in words; the pictures are what it
 * looks like, taken by the server from the live preview the moment you
 * press the button, so Claude reads the site the way you see it. Seven
 * things can be asked, one is anything at all in your own words, and one
 * writes the code — which, with the document and the blueprint, can go to
 * GitHub in one commit from here, and from there to Vercel.
 *
 * Nothing needs a key to work: without one you copy or download the same
 * things and hand them to any agent, and the dialog says so where it matters.
 */
import * as React from "react";
import { Camera, Check, Download, ExternalLink, FileJson, GitBranch, Globe, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { briefPrefix, compileSpec, specToJson, specToMarkdown } from "./spec";
import { trailToMarkdown, useLanes } from "./PromptTrail";
import { ThreadTree, usePieces } from "./ThreadTree";
import { piecesToSend, threadsToMarkdown } from "./threads";
import { useStudio } from "./store";
import { askClaude, deploy, deployStatus, filesFromMarkdown, MODES, noKeyMessage, publish, publishStatus, screenshotPages, screenshotsAvailable, siteFiles, watchDeploy, type AskMode, type DeployStatus, type Device, type GeneratedFile, type Picture, type PublishStatus } from "./agent";
import { activeProject, useBuilds } from "@/features/builds/store";
import { cn } from "@/core/lib/cn";
import { useSettingValue } from "@/core/settings/useSetting";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Segmented } from "@/core/ui/segmented";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { Switch } from "@/core/ui/switch";
import { Badge } from "@/core/ui/badge";
import { Tooltip } from "@/core/ui/tooltip";
import { useActions } from "@/core/actions";

export function useCompiledBrief() {
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const groups = useStudio((s) => s.groups);
  const shapes = useStudio((s) => s.shapes);
  const format = useStudio((s) => s.format);
  const brief = useStudio((s) => s.brief);
  const frameWidth = useStudio((s) => s.frameWidth);
  const look = useStudio((s) => s.look);
  const motion = useStudio((s) => s.motion);
  const trail = useStudio((s) => s.trail);
  return React.useMemo(
    () => compileSpec({ pages, nodes, groups, shapes, format, brief, frameWidth, look, motion, trail }),
    [pages, nodes, groups, shapes, format, brief, frameWidth, look, motion, trail],
  );
}

type View = "brief" | "json" | "trail" | "result" | "files";

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function BriefDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const spec = useCompiledBrief();
  const master = useStudio((s) => s.brief.master);
  const siteName = useStudio((s) => s.brief.name);
  const trailCount = useStudio((s) => s.trail.filter((e) => e.stage === "critique").length);
  // The Trail is the threads now; the tab counts them, and the findings from
  // before threads were kept are still reachable underneath the tree.
  const threads = useStudio((s) => s.threads);
  const draftPieces = useStudio((s) => s.draftPieces);
  const sentPieces = useStudio((s) => s.sentPieces);
  const pieces = usePieces();
  const lanes = useLanes();
  const ctx = useActions();
  const wantShots = useSettingValue<boolean>("studio.screenshots");
  const shotPages = useSettingValue<number>("studio.screenshotPages");
  const deployDefault = useSettingValue<boolean>("studio.publishDeploy");

  const [view, setView] = React.useState<View>("brief");
  const [mode, setMode] = React.useState<AskMode>("plan");
  const [prompt, setPrompt] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ text: string; mode: AskMode; model?: string; pictures: number; truncated: boolean } | null>(null);
  const [files, setFiles] = React.useState<GeneratedFile[]>([]);
  const [openFile, setOpenFile] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [canShoot, setCanShoot] = React.useState<boolean | null>(null);
  const [sendShots, setSendShots] = React.useState(true);
  const [device, setDevice] = React.useState<Device>("desktop");
  const [shots, setShots] = React.useState<Picture[]>([]);
  const [pub, setPub] = React.useState<PublishStatus | null>(null);
  const [pubMessage, setPubMessage] = React.useState("");
  const [pubDeploy, setPubDeploy] = React.useState(true);
  const [pubResult, setPubResult] = React.useState<{ url: string; files: number; deployed: boolean; hook: boolean; note?: string } | null>(null);
  const [live, setLive] = React.useState<DeployStatus | null>(null);
  const [liveRun, setLiveRun] = React.useState<{ state: string; url: string | null; inspectorUrl: string | null; done: boolean; message?: string } | null>(null);
  const abort = React.useRef<AbortController | null>(null);

  const markdown = React.useMemo(() => specToMarkdown(spec), [spec]);
  const json = React.useMemo(() => specToJson(spec), [spec]);
  const body = view === "json" ? json : view === "result" ? (result?.text ?? "") : view === "trail" ? (threads.length ? threadsToMarkdown(threads) : trailToMarkdown(lanes)) : markdown;

  React.useEffect(() => { setSendShots(wantShots); }, [wantShots]);
  React.useEffect(() => { setPubDeploy(deployDefault); }, [deployDefault]);
  React.useEffect(() => {
    if (!open) return;
    void screenshotsAvailable().then(setCanShoot);
    void publishStatus().then(setPub);
    void deployStatus().then(setLive);
    setPubMessage(`Builder: publish ${siteName.trim() || "the site"}`);
  }, [open, siteName]);
  React.useEffect(() => () => abort.current?.abort(), []);

  const download = (text: string, filename: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    ctx.publish({ key: "studio:download", title: `Saved ${filename}`, level: "success", source: "studio", toast: true });
  };

  const generate = async () => {
    if (busy) return;
    setNote(null);
    setPubResult(null);
    const ac = new AbortController();
    abort.current = ac;
    try {
      let pictures: Picture[] = [];
      if (sendShots && canShoot) {
        setBusy("Photographing the pages…");
        pictures = await screenshotPages(shotPages, device, (done, total) => setBusy(`Photographing page ${done} of ${total}…`), ac.signal);
        setShots(pictures);
        if (!pictures.length) setNote("The server could not photograph the pages, so the words went alone.");
      }
      setBusy(mode === "build" ? "Claude is writing the files…" : "Claude is working through the blueprint…");
      /*
       * What goes up. With pieces vined to this thread the brief goes as the
       * cached prefix and only those pieces follow it — and only the ones
       * whose fingerprint has moved since this thread last sent them. With
       * nothing vined the whole blueprint goes, exactly as before.
       */
      const { send, skipped } = piecesToSend(pieces, draftPieces, sentPieces);
      const vined = draftPieces.length > 0;
      const r = await askClaude(
        {
          markdown: vined ? "" : markdown,
          brief: vined ? briefPrefix(markdown) : "",
          pieces: vined ? send : [],
          skipped: vined ? skipped.length : 0,
          mode,
          prompt: prompt.trim(),
          pictures,
        },
        { signal: ac.signal },
      );
      if (ac.signal.aborted) return;
      if (r.ok) {
        setResult({ text: r.text, mode, model: r.model, pictures: r.pictures, truncated: r.truncated });
        // The call landed, so it is a thread: what was asked, what came back,
        // and the board as it stood. Everything the answer goes on to do —
        // a finding taken, a file written — is recorded against it.
        const threadId = useStudio.getState().landThread({
          mode,
          model: r.model,
          ask: [MODES.find((m) => m.value === mode)?.blurb ?? mode, prompt.trim()].filter(Boolean).join("\n"),
          answer: r.text,
          changes: [
            r.revisions.length ? `${r.revisions.length} finding${r.revisions.length === 1 ? "" : "s"}` : "",
            r.files.length ? `${r.files.length} file${r.files.length === 1 ? "" : "s"} written` : "",
            r.pictures ? `${r.pictures} page${r.pictures === 1 ? "" : "s"} seen` : "",
            vined ? `${send.length} piece${send.length === 1 ? "" : "s"} sent${skipped.length ? `, ${skipped.length} unchanged` : ""}` : "",
          ].filter(Boolean),
        });
        // What went, and what the cache gave back. The second call of a
        // thread reads its brief rather than sending it, and that number is
        // the whole point of splitting the two apart.
        if (vined) {
          useStudio.getState().recordSent(
            threadId,
            Object.fromEntries(send.map((x) => [x.id, x.fingerprint])),
            { sent: send.length, skipped: skipped.length, cached: r.cached, input: r.input },
          );
          if (r.cached) setNote(`The brief was read from the cache: ${r.cached.toLocaleString()} tokens not sent again.`);
        }
        // Each finding goes on the trail beside the prompt it was about, so
        // the map is where a critique is read and acted on, not the box.
        if (r.revisions.length) useStudio.getState().recordAsk({ mode, model: r.model, revisions: r.revisions });
        if (mode === "build") {
          setFiles(r.files);
          setView(r.files.length ? "files" : "result");
          if (!r.files.length) setNote("Claude answered, but no files could be read out of it. The response is shown as it came.");
        } else setView(r.revisions.length ? "trail" : "result");
        if (r.truncated) setNote("Claude ran out of room before the end. Ask for less at once, or split the site into pages.");
        ctx.publish({ key: "studio:generate", title: "Claude responded", body: [r.model, r.pictures ? `${r.pictures} picture${r.pictures === 1 ? "" : "s"} seen` : "words only"].filter(Boolean).join(" · "), level: "success", source: "studio", toast: true });
      } else if (r.reason !== "stopped") {
        const why = r.reason === "no-key" ? noKeyMessage("Or copy the blueprint into any agent — it is written to stand alone.") : r.message;
        setNote(why);
        if (r.reason === "no-key") ctx.openPanel("keys");
        ctx.publish({ key: "studio:generate", title: "Generation unavailable", body: why, level: "warn", source: "studio", toast: true });
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setNote(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  const publishFiles = React.useMemo(() => [...siteFiles(markdown, json), ...files], [markdown, json, files]);

  const doPublish = async () => {
    if (busy) return;
    setNote(null);
    setBusy(`Pushing ${publishFiles.length} files to GitHub…`);
    try {
      const project = activeProject();
      const r = await publish({
        files: publishFiles,
        message: pubMessage.trim() || "Builder: publish the site",
        deploy: pubDeploy,
        repo: project?.repo ? `${project.repo.owner}/${project.repo.name}` : undefined,
        branch: project?.repo?.branch,
      });
      if (r.ok) {
        setPubResult({ url: r.commitUrl, files: r.files, deployed: r.deployed, hook: r.hook, note: r.deployNote });
        ctx.publish({ key: "studio:publish", title: `Published to ${r.repo}`, body: `${r.files} files on ${r.branch}${r.deployed ? " · Vercel deploy started" : ""}`, level: "success", source: "studio", toast: true, href: r.commitUrl });
      } else {
        setNote(r.message);
        ctx.publish({ key: "studio:publish", title: "Publish failed", body: r.message, level: "error", source: "studio", toast: true });
      }
    } finally {
      setBusy(null);
    }
  };

  /**
   * One button: the files go up, and the address comes back.
   *
   * Push and deploy are one act — a commit nobody deployed is not published —
   * so this does both and waits, rather than leaving someone to guess whether
   * a connected project noticed. The project's own repository wins over the
   * server's, so each site goes where the Builds page says it goes, and the
   * address is written back to the project when it is live.
   */
  const goLive = async () => {
    if (busy) return;
    setNote(null);
    setLiveRun(null);
    const project = activeProject();
    const repo = project?.repo ? `${project.repo.owner}/${project.repo.name}` : undefined;
    const branch = project?.repo?.branch;
    try {
      setBusy(`Pushing ${publishFiles.length} files to GitHub…`);
      const pushed = await publish({ files: publishFiles, message: pubMessage.trim() || "Builder: publish the site", deploy: false, repo, branch });
      if (!pushed.ok) {
        setNote(pushed.message);
        ctx.publish({ key: "studio:publish", title: "Publish failed", body: pushed.message, level: "error", source: "studio", toast: true });
        return;
      }
      setPubResult({ url: pushed.commitUrl, files: pushed.files, deployed: false, hook: pushed.hook });

      setBusy("Asking Vercel to build it…");
      const started = await deploy({ repo: repo ?? pushed.repo, branch: branch ?? pushed.branch });
      if (!started.ok) {
        setNote(started.message);
        ctx.publish({ key: "studio:live", title: "Not deployed", body: started.message, level: "warn", source: "studio", toast: true });
        return;
      }
      setLiveRun({ state: started.state, url: started.url, inspectorUrl: started.inspectorUrl, done: false });

      setBusy("Building…");
      const end = await watchDeploy(started.id, {
        team: started.team,
        onState: (st) => {
          setLiveRun({ state: st.state, url: st.url, inspectorUrl: st.inspectorUrl ?? started.inspectorUrl, done: st.done, message: st.message });
          setBusy(st.state === "BUILDING" ? "Building…" : st.state === "QUEUED" ? "Queued…" : "Finishing…");
        },
      });
      if (end.state === "READY" && end.url) {
        const id = project?.id;
        if (id) useBuilds.getState().setLive(id, end.url);
        ctx.publish({ key: "studio:live", title: "The site is live", body: end.url, level: "success", source: "studio", toast: true, href: end.url });
      } else {
        ctx.publish({ key: "studio:live", title: `The build ${end.state.toLowerCase()}`, body: end.message ?? "The Vercel log says why.", level: "error", source: "studio", toast: true, href: end.inspectorUrl ?? undefined });
      }
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = () => {
    for (const f of publishFiles) download(f.content, f.path.split("/").pop() ?? f.path, "text/plain");
  };

  const current = MODES.find((m) => m.value === mode)!;
  const github = pub?.github;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) abort.current?.abort(); onOpenChange(v); }}
      size="xl"
      title="Blueprint"
      description={`${spec.stats.pages} pages · ${spec.stats.elements} elements · ${spec.stats.prompted} with their own prompt`}
      footer={
        <>
          {busy ? (
            <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}><X /> Stop</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => (view === "files" ? downloadAll() : download(view === "json" ? json : body, view === "json" ? "blueprint.json" : view === "result" ? "response.md" : view === "trail" ? "threads.md" : "brief.md", view === "json" ? "application/json" : "text/markdown"))}>
              <Download />
              {view === "files" ? "Download all" : "Download"}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void ctx.copy(view === "files" ? publishFiles.map((f) => `# ${f.path}\n\n${f.content}`).join("\n\n") : body, view === "json" ? "blueprint JSON" : view === "result" ? "response" : view === "files" ? "files" : view === "trail" ? "prompt trail" : "brief")}>
            Copy {view === "json" ? "JSON" : view === "result" ? "response" : view === "files" ? "files" : view === "trail" ? "trail" : "brief"}
          </Button>
          <Button variant="primary" size="sm" loading={!!busy} disabled={mode === "ask" && !prompt.trim()} onClick={() => void generate()}>
            <Sparkles />
            {current.verb}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">What this should be</span>
          <Textarea
            autoGrow
            rows={2}
            aria-label="Master prompt"
            placeholder="Say what you want this to be — everything on the board is the context"
            value={master}
            onChange={(e) => useStudio.getState().setBrief({ master: e.target.value })}
          />
        </label>

        {/* what to ask */}
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-elevated/50 p-2">
          <Segmented
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as AskMode)}
            options={MODES.map((m) => ({ value: m.value, label: m.label }))}
            aria-label="What Claude should do"
            className="w-full"
          />
          <p className="text-[10px] text-fg-faint">{current.blurb}</p>
          <Textarea
            autoGrow
            rows={mode === "ask" ? 3 : 1}
            aria-label={mode === "ask" ? "Your question" : "Anything to add"}
            placeholder={mode === "ask" ? "Ask anything about the site, or say what to do with it…" : "Anything to add to the ask (optional)"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate(); } }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Switch size="sm" checked={sendShots && canShoot !== false} disabled={canShoot === false} onCheckedChange={setSendShots} aria-label="Send screenshots" />
            <Camera className="size-3.5 text-fg-muted" />
            <span className="text-[11px] text-fg-muted">
              {canShoot === null ? "Checking whether the server can photograph the pages…" : canShoot ? `Send a screenshot of ${shotPages === 1 ? "the first page" : `the first ${shotPages} pages`}, as the live preview shows them` : "This server cannot photograph the pages (no Playwright), so the words go alone: anything Claude says about layout, colour or overflow is inferred from the brief, not seen."}
            </span>
            {canShoot ? (
              <Segmented size="xs" value={device} onChange={(v) => setDevice(v as Device)} options={[{ value: "desktop", label: "Desktop" }, { value: "tablet", label: "Tablet" }, { value: "phone", label: "Phone" }]} aria-label="Screenshot device" />
            ) : null}
          </div>
          {shots.length ? (
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {shots.map((s) => (
                <Tooltip key={s.pageId} content={s.label.replace(/, top to bottom:$/, "")}>
                  <img src={s.preview} alt="" className="h-16 w-auto shrink-0 rounded-sm border border-border object-cover object-top" />
                </Tooltip>
              ))}
              <span className="self-center text-[10px] text-fg-faint">{result?.pictures ? `${result.pictures} sent with the last ask` : "taken for the last ask"}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            size="xs"
            value={view}
            onChange={(v) => setView(v as View)}
            options={[
              { value: "brief", label: "Brief" },
              { value: "json", label: "JSON" },
              { value: "trail", label: threads.length ? `Trail (${threads.length})` : trailCount ? `Trail (${trailCount})` : "Trail" },
              ...(result ? [{ value: "result", label: "Response" }] : []),
              ...(files.length ? [{ value: "files", label: `Files (${files.length})` }] : []),
            ]}
            aria-label="View"
          />
          <div className="flex flex-wrap gap-1">
            <Badge size="sm" variant="accent">{spec.stats.pages} pages</Badge>
            <Badge size="sm">{spec.stats.elements} elements</Badge>
            {spec.stats.groups ? <Badge size="sm">{spec.stats.groups} groups</Badge> : null}
            {spec.stats.connections ? <Badge size="sm">{spec.stats.connections} connections</Badge> : null}
            {spec.stats.sketches ? <Badge size="sm">{spec.stats.sketches} sketches</Badge> : null}
            <Badge size="sm" variant={spec.stats.prompted ? "up" : "warn"}>{spec.stats.prompted} prompted</Badge>
          </div>
        </div>

        {note ? (
          <div data-brief-note="" role="status" className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-[11px] text-fg">
            <Wand2 className="mt-0.5 size-3.5 shrink-0 text-warn" />
            <span>{note}</span>
          </div>
        ) : null}

        {view === "trail" ? (
          <ThreadTree />
        ) : view === "files" ? (
          <div className="max-h-[40vh] overflow-auto rounded-md border border-border bg-elevated">
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.path}>
                  <button type="button" onClick={() => setOpenFile(openFile === f.path ? null : f.path)} className="tactile flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-hover">
                    <span className="num min-w-0 flex-1 truncate font-mono text-[11px] text-fg">{f.path}</span>
                    <span className="num text-[10px] text-fg-faint">{fmtBytes(f.content.length)}</span>
                    <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); void ctx.copy(f.content, f.path); }}>Copy</Button>
                  </button>
                  {openFile === f.path ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border bg-panel p-3 font-mono text-[10.5px] leading-relaxed text-fg-muted">{f.content}</pre> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <pre className={cn("max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-elevated p-3 font-mono text-[11px] leading-relaxed text-fg-muted", busy && "opacity-60")}>
            {busy && view !== "result" ? null : body || "Nothing on the board yet."}
            {busy ? (
              <span className="flex items-center gap-2 text-accent">
                <Loader2 className="size-3.5 animate-spin" />
                {busy}
              </span>
            ) : null}
          </pre>
        )}
        {result && view === "result" ? (
          <p className="text-[10px] text-fg-faint">
            {MODES.find((m) => m.value === result.mode)?.label} · {result.model ?? "Claude"} · {result.pictures ? `${result.pictures} picture${result.pictures === 1 ? "" : "s"} seen` : "words only"}
          </p>
        ) : null}

        {/* publish */}
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-elevated/50 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="size-3.5 text-fg-muted" />
            <span className="text-[11px] font-medium text-fg">Publish</span>
            {github === undefined ? (
              <Badge size="sm">checking…</Badge>
            ) : github.configured ? (
              <Badge size="sm" variant="up"><Check className="size-3" /> {github.repo} · {github.branch}</Badge>
            ) : (
              <Tooltip content={`Set ${github.missing.join(" and ")} on the server. See .env.example.`}>
                <Badge size="sm" variant="warn">no GitHub token · download instead</Badge>
              </Tooltip>
            )}
            {live?.configured ? (
              <Badge size="sm" variant="info">Vercel: {live.source === "server" ? "the server's token" : "your token"}</Badge>
            ) : pub?.vercel.hook ? (
              <Badge size="sm" variant="info">Vercel hook set</Badge>
            ) : null}
            <span className="flex-1" />
            <span className="text-[10px] text-fg-faint">{publishFiles.length} files: the document the app renders at /site, the blueprint, {files.length ? `and ${files.length} generated` : "no generated code yet"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input inputSize="sm" value={pubMessage} onChange={(e) => setPubMessage(e.target.value)} placeholder="Commit message" className="min-w-40 flex-1" disabled={!!busy} />
            {pub?.vercel.hook ? (
              <label className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                <Switch size="sm" checked={pubDeploy} onCheckedChange={setPubDeploy} /> deploy
              </label>
            ) : null}
            <Button variant="outline" size="sm" disabled={!!busy || !github?.configured} onClick={() => void doPublish()}>
              <GitBranch /> Push to GitHub
            </Button>
            <Tooltip content={
              live?.configured
                ? "Push the files, build the site on Vercel, and hand back the address."
                : "Needs a Vercel token: put one in the vault (⌘⇧K) or set VERCEL_TOKEN on the server."
            }>
              <span>
                <Button variant="primary" size="sm" disabled={!!busy || !github?.configured || !live?.configured} onClick={() => void goLive()}>
                  <Globe /> Go live
                </Button>
              </span>
            </Tooltip>
          </div>
          {liveRun ? (
            <p className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", liveRun.state === "READY" ? "text-up" : liveRun.state === "ERROR" || liveRun.state === "CANCELED" ? "text-down" : "text-fg-muted")}>
              {liveRun.done ? liveRun.state === "READY" ? <Check className="size-3" /> : <X className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
              {liveRun.state === "READY" ? "Live at" : liveRun.state === "ERROR" ? "The build failed." : liveRun.state === "CANCELED" ? "The build was cancelled." : `${liveRun.state.toLowerCase()}…`}
              {liveRun.state === "READY" && liveRun.url ? (
                <a className="underline underline-offset-2" href={liveRun.url} target="_blank" rel="noopener noreferrer">
                  {liveRun.url.replace(/^https:\/\//, "")} <ExternalLink className="inline size-3" />
                </a>
              ) : liveRun.inspectorUrl ? (
                <a className="underline underline-offset-2 text-fg-faint" href={liveRun.inspectorUrl} target="_blank" rel="noopener noreferrer">
                  watch the build <ExternalLink className="inline size-3" />
                </a>
              ) : null}
              {liveRun.message ? <span className="text-fg-faint">{liveRun.message}</span> : null}
            </p>
          ) : null}
          {pubResult ? (
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-up">
              <Check className="size-3" /> {pubResult.files} files committed.
              <a className="underline underline-offset-2" href={pubResult.url} target="_blank" rel="noopener noreferrer">Open the commit <ExternalLink className="inline size-3" /></a>
              {pubResult.deployed ? <span>· Vercel deploy started</span> : pubResult.hook ? <span className="text-warn">· {pubResult.note ?? "the deploy hook was not called"}</span> : <span className="text-fg-faint">· a connected Vercel project deploys on its own</span>}
            </p>
          ) : null}
        </div>

        <p className="flex items-center gap-1.5 text-[10px] text-fg-faint">
          <FileJson className="size-3" />
          The brief is self-contained — it explains its own conventions, so any agent can act on it without this app.
        </p>
      </div>
    </Dialog>
  );
}

export { filesFromMarkdown };
