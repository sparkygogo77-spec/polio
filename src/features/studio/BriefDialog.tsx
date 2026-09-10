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
import { Camera, Check, Download, ExternalLink, FileJson, GitBranch, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { compileSpec, specToJson, specToMarkdown } from "./spec";
import { useStudio } from "./store";
import { askClaude, filesFromMarkdown, MODES, noKeyMessage, publish, publishStatus, screenshotPages, screenshotsAvailable, siteFiles, type AskMode, type Device, type GeneratedFile, type Picture, type PublishStatus } from "./agent";
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
  return React.useMemo(
    () => compileSpec({ pages, nodes, groups, shapes, format, brief, frameWidth, look, motion }),
    [pages, nodes, groups, shapes, format, brief, frameWidth, look, motion],
  );
}

type View = "brief" | "json" | "result" | "files";

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function BriefDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const spec = useCompiledBrief();
  const master = useStudio((s) => s.brief.master);
  const siteName = useStudio((s) => s.brief.name);
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
  const abort = React.useRef<AbortController | null>(null);

  const markdown = React.useMemo(() => specToMarkdown(spec), [spec]);
  const json = React.useMemo(() => specToJson(spec), [spec]);
  const body = view === "json" ? json : view === "result" ? (result?.text ?? "") : markdown;

  React.useEffect(() => { setSendShots(wantShots); }, [wantShots]);
  React.useEffect(() => { setPubDeploy(deployDefault); }, [deployDefault]);
  React.useEffect(() => {
    if (!open) return;
    void screenshotsAvailable().then(setCanShoot);
    void publishStatus().then(setPub);
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
      const r = await askClaude({ markdown, mode, prompt: prompt.trim(), pictures });
      if (ac.signal.aborted) return;
      if (r.ok) {
        setResult({ text: r.text, mode, model: r.model, pictures: r.pictures, truncated: r.truncated });
        if (mode === "build") {
          setFiles(r.files);
          setView(r.files.length ? "files" : "result");
          if (!r.files.length) setNote("Claude answered, but no files could be read out of it. The response is shown as it came.");
        } else setView("result");
        if (r.truncated) setNote("Claude ran out of room before the end. Ask for less at once, or split the site into pages.");
        ctx.publish({ key: "studio:generate", title: "Claude responded", body: [r.model, r.pictures ? `${r.pictures} picture${r.pictures === 1 ? "" : "s"} seen` : "words only"].filter(Boolean).join(" · "), level: "success", source: "studio", toast: true });
      } else {
        const why = r.reason === "no-key" ? noKeyMessage("Or copy the blueprint into any agent — it is written to stand alone.") : r.message;
        setNote(why);
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
      const r = await publish({ files: publishFiles, message: pubMessage.trim() || "Builder: publish the site", deploy: pubDeploy });
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

  const downloadAll = () => {
    for (const f of publishFiles) download(f.content, f.path.split("/").pop() ?? f.path, "text/plain");
  };

  const current = MODES.find((m) => m.value === mode)!;
  const github = pub?.github;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) abort.current?.abort(); onOpenChange(v); }}
      size="lg"
      title="Blueprint"
      description={`${spec.stats.pages} pages · ${spec.stats.elements} elements · ${spec.stats.prompted} with their own prompt`}
      footer={
        <>
          {busy ? (
            <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}><X /> Stop</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => (view === "files" ? downloadAll() : download(view === "json" ? json : body, view === "json" ? "blueprint.json" : view === "result" ? "response.md" : "brief.md", view === "json" ? "application/json" : "text/markdown"))}>
              <Download />
              {view === "files" ? "Download all" : "Download"}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void ctx.copy(view === "files" ? publishFiles.map((f) => `# ${f.path}\n\n${f.content}`).join("\n\n") : body, view === "json" ? "blueprint JSON" : view === "result" ? "response" : view === "files" ? "files" : "brief")}>
            Copy {view === "json" ? "JSON" : view === "result" ? "response" : view === "files" ? "files" : "brief"}
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
              {canShoot === null ? "Checking whether the server can photograph the pages…" : canShoot ? `Send a screenshot of ${shotPages === 1 ? "the first page" : `the first ${shotPages} pages`}, as the live preview shows them` : "This server cannot photograph the pages (no Playwright), so the words go alone."}
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
          <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-[11px] text-fg">
            <Wand2 className="mt-0.5 size-3.5 shrink-0 text-warn" />
            <span>{note}</span>
          </div>
        ) : null}

        {view === "files" ? (
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
            {pub?.vercel.hook ? <Badge size="sm" variant="info">Vercel hook set</Badge> : null}
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
            <Button variant={github?.configured ? "primary" : "outline"} size="sm" disabled={!!busy || !github?.configured} onClick={() => void doPublish()}>
              <GitBranch /> Push to GitHub
            </Button>
          </div>
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
