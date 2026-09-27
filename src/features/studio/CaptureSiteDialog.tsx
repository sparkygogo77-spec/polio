"use client";
/**
 * "Capture a site": paste an address, and it is captured and brought in.
 *
 * Today he captures a site by hand in the sink repository, commits it,
 * and types owner/sink into the Builder. This is that, from the Builder:
 * an address and a name, the sink workflow run with his own token in his
 * own browser (`captureSite.ts`), its progress said as it goes, and when
 * the run ends, one press to bring `sites/<name>/` in beside every other
 * site he has captured. Nothing here touches the root `site/`.
 *
 * What is under "advanced" — the pages, the repository the workflow lives
 * in, and its branch — is there because the common case is an address and
 * nothing else (docs/DESIGN.md: options hidden under advanced).
 */
import * as React from "react";
import { Camera, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Dialog } from "@/core/ui/dialog";
import { Tooltip } from "@/core/ui/tooltip";
import { useActions } from "@/core/actions";
import { useRouter } from "next/navigation";
import { heldKeys, useKeys } from "@/features/keys/store";
import { staleBuild, staleSays } from "@/core/shell/BuildGuard";
import { bringRepoIn, type Bringing } from "./bringRepo";
import { activeSource } from "@/features/builds/store";
import { captureName, capturePlace, captureWant, nameFrom, startCapture, watchCapture, type Ended, type Progress } from "./captureSite";

/** Where the capturer lives: remembered in this browser, the sink repository by default. */
const CAPTURER = "builder.capturer";
const DEFAULT_CAPTURER = "sparkygogo77-spec/sink";
const rememberedCapturer = (): string => { try { return localStorage.getItem(CAPTURER) || DEFAULT_CAPTURER; } catch { return DEFAULT_CAPTURER; } };

/**
 * The importer with a path. `Bringing` has no `path` today; the lane
 * adding the sites/<name>/ setting to `repoRun.ts` is expected to read it
 * from here, as `Bringing.path?: string` → `readRepoSite(repo, token, say,
 * { path })`. Until then the root site of the branch is what is read.
 */
type BringingWithPath = Bringing & { path?: string };

type Stage = { at: "ask" } | { at: "running"; runId: number; htmlUrl: string; name: string; step: string } | { at: "done"; name: string; end: Ended };

export function CaptureSiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [typedName, setTypedName] = React.useState(false);
  const [pages, setPages] = React.useState("/");
  const [capturer, setCapturer] = React.useState(DEFAULT_CAPTURER);
  const [branch, setBranch] = React.useState("");
  const [stage, setStage] = React.useState<Stage>({ at: "ask" });
  const [said, setSaid] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const ctx = useActions();
  const router = useRouter();
  const unlocked = useKeys((s) => s.unlocked && !!s.values.GITHUB_TOKEN);
  const alive = React.useRef(true);

  React.useEffect(() => { if (open) { setCapturer(rememberedCapturer()); setSaid(null); } }, [open]);
  React.useEffect(() => () => { alive.current = false; }, []);
  /* The name follows the address until he types one himself. */
  React.useEffect(() => { if (!typedName) setName(nameFrom(url) ?? ""); }, [url, typedName]);

  const repo = (): { owner: string; name: string } | null => {
    const m = capturer.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
    return m && m[1] && m[2] ? { owner: m[1], name: m[2] } : null;
  };

  const start = async () => {
    if (starting) return;
    const r = repo();
    if (!r) { setSaid("The capturer wants to be owner/name, the repository sink's workflow lives in."); return; }
    try { localStorage.setItem(CAPTURER, capturer.trim()); } catch { /* not kept */ }
    setSaid(null);
    setStarting(true);
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    const started = await startCapture({ repo: r, token, url, name, pages, ref: branch });
    setStarting(false);
    if (!alive.current) return;
    if (!started.ok) { setSaid(started.says); return; }
    setStage({ at: "running", runId: started.runId, htmlUrl: started.htmlUrl, name: started.name, step: "Starting" });
    const end = await watchCapture({
      repo: r, token, runId: started.runId, name: started.name,
      onProgress: (p: Progress) => { if (alive.current) setStage((s) => (s.at === "running" ? { ...s, step: p.step || (p.status === "queued" ? "Waiting for a runner" : "Running") } : s)); },
    });
    if (!alive.current) return;
    setStage({ at: "done", name: started.name, end });
    ctx.publish({ key: `studio:capture:${started.name}`, title: end.ok ? `${started.name} is captured` : `${started.name} did not capture`, body: end.ok ? `It is at ${end.path} on ${end.ref}. Bring it in from the dialog.` : end.says, level: end.ok ? "info" : "warn", source: "studio", toast: { durationMs: 6000 } });
  };

  const bringIn = (siteName: string) => {
    const r = repo();
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
    const out = bringRepoIn(captureWant(r, siteName), o);
    if (out.ok) { onOpenChange(false); reset(); return; }
    setSaid(out.says ?? "It could not be brought in.");
  };

  const reset = () => { setStage({ at: "ask" }); setUrl(""); setName(""); setTypedName(false); setPages("/"); setSaid(null); };
  const nameOk = !name.trim() || captureName(name) !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v && stage.at === "done") reset(); }}
      title="Capture a site"
      description="Paste an address. It is captured page by page in your own repository and kept beside your other captures, ready to bring in."
      footer={
        stage.at === "ask" ? (
          <Button onClick={() => void start()} loading={starting} disabled={!url.trim() || !nameOk || !unlocked} data-capture-start="">
            <Camera /> Capture
          </Button>
        ) : stage.at === "done" && stage.end.ok ? (
          <Button onClick={() => bringIn(stage.name)} data-capture-import="">Bring {stage.end.path} in</Button>
        ) : stage.at === "done" ? (
          <Button variant="outline" onClick={reset}>Try again</Button>
        ) : null
      }
    >
      {stage.at === "ask" ? (
        <div className="flex flex-col gap-3">
          {!unlocked ? <p className="text-xs text-fg-muted">No GitHub token in this browser yet. Open Keys and put one in; the capture runs in your own repository with it.</p> : null}
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Address
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" autoFocus data-capture-url="" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Name <span className="text-fg-subtle">— the folder it is kept under, sites/{captureName(name) ?? "…"}</span>
            <Input value={name} onChange={(e) => { setTypedName(true); setName(e.target.value); }} placeholder={nameFrom(url) ?? "my-site"} data-capture-name="" />
          </label>
          {!nameOk ? <p className="text-xs text-warning">A name is letters, digits and dashes, and not a path.</p> : null}
          <details className="rounded-lg border border-border bg-elevated p-3">
            <summary className="cursor-pointer text-xs text-fg-muted">Advanced</summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs text-fg-muted">
                Pages <span className="text-fg-subtle">— paths, comma-separated</span>
                <Input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="/, /docs" mono />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-muted">
                Capturer <span className="text-fg-subtle">— the repository with the capture workflow</span>
                <Input value={capturer} onChange={(e) => setCapturer(e.target.value)} placeholder={DEFAULT_CAPTURER} mono />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-muted">
                Its branch <span className="text-fg-subtle">— empty means the repository&apos;s default</span>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" mono />
              </label>
            </div>
          </details>
          {said ? <p className="text-xs text-warning" role="status">{said}</p> : null}
        </div>
      ) : stage.at === "running" ? (
        <div className="flex flex-col gap-2 text-sm" data-capture-running="">
          <p className="flex items-center gap-2"><Loader2 className="animate-spin" /> Capturing into sites/{stage.name}/ — {stage.step}</p>
          <a className="inline-flex items-center gap-1 text-xs text-fg-muted underline" href={stage.htmlUrl} target="_blank" rel="noreferrer">Watch the run on GitHub <ExternalLink className="size-3" /></a>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm" data-capture-done="">
          {stage.end.ok ? (
            <p>Captured. It is at <code>{stage.end.path}/</code> on <code>{stage.end.ref}</code>, beside your other captures.</p>
          ) : (
            <p className="text-warning">{stage.end.says}</p>
          )}
          <a className="inline-flex items-center gap-1 text-xs text-fg-muted underline" href={stage.end.htmlUrl} target="_blank" rel="noreferrer">The run on GitHub <ExternalLink className="size-3" /></a>
          {said ? <p className="text-xs text-warning" role="status">{said}</p> : null}
        </div>
      )}
    </Dialog>
  );
}

/** The door in the bar, beside the one that brings a repository in. */
export function CaptureSiteDoor() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("studio:capture-site", on);
    return () => window.removeEventListener("studio:capture-site", on);
  }, []);
  return (
    <>
      <Tooltip content="Capture a site: paste an address, it is captured in your repository and brought in.">
        <Button variant="ghost" size="iconXs" data-capture-site="" aria-label="Capture a site" onClick={() => setOpen(true)}>
          <Camera />
        </Button>
      </Tooltip>
      <CaptureSiteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
