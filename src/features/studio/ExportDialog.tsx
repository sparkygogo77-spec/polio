"use client";
/**
 * THE EXPORT DIALOG (create-system "(d) Export", as J approved it; J
 * 2026-10-24: both ways, each complete).
 *
 *   Code      (o) Exact look   ( ) Clean code      — both Next.js + Tailwind
 *   Include   [x] Tokens as files  [x] Component library  [x] Pages  [ ] A component gallery page
 *   Send to   (o) GitHub repo: the site's own   ( ) Download a zip
 *             [x] Deploy on Vercel after the push
 *   Last export: 2 days ago. 1 file was edited in the repo: kept.
 *                                                   [Cancel] [Export]
 *
 * Exact look goes live looking exactly as the board does; Clean code is the
 * board as flex and grid, sections and a component library, for a person or
 * a code chat to keep working on. Tokens and pages are in every export;
 * the library and the gallery are Clean code's. To a repository it goes
 * through Go live, and a file edited there since the last export is kept
 * (`send-out/exportSync.ts`). Nothing else is new here.
 */
import * as React from "react";
import { create } from "zustand";
import { Download, GitBranch } from "lucide-react";
import { Dialog } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { useStudio } from "./board/store";
import { siteSlug, saveZip } from "./exportForCode";
import { buildExport, exportTarget, exportToRepo, exportZip, planExport, readBranch } from "./send-out/run";
import { lastExportSays, type ExportMode } from "./send-out";

const useExportDialog = create<{ open: boolean }>(() => ({ open: false }));
export const openExportDialog = () => useExportDialog.setState({ open: true });

type Say = Parameters<typeof exportToRepo>[2]["say"];

export function ExportDialog() {
  const say: Say = useActions().publish;
  const open = useExportDialog((s) => s.open);
  const name = useStudio((s) => s.brief.name?.trim()) || "this site";
  const [mode, setMode] = React.useState<ExportMode>("exact");
  const [library, setLibrary] = React.useState(true);
  const [gallery, setGallery] = React.useState(false);
  const [to, setTo] = React.useState<"repo" | "zip">("repo");
  const [deploy, setDeploy] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [line, setLine] = React.useState<string | null>(null);
  const target = React.useMemo(() => (open ? exportTarget() : { repo: null, branch: null }), [open]);
  const close = () => { if (!busy) useExportDialog.setState({ open: false }); };
  const clean = mode === "clean";

  /* The last export's line, read from the repository when the dialog opens: when it was, and what this one would keep. */
  React.useEffect(() => {
    if (!open || to !== "repo" || !target.repo) { setLine(null); return; }
    let live = true;
    setLine("Reading the repository…");
    void (async () => {
      try {
        const { onBranch, record } = await readBranch(target.repo!, target.branch ?? "main");
        if (!record) { if (live) setLine(lastExportSays(null, null)); return; }
        const ex = await buildExport({ mode, library: clean && library, gallery: clean && gallery });
        const plan = await planExport(ex, onBranch, record);
        if (live) setLine(lastExportSays(record, plan));
      } catch { if (live) setLine(null); }
    })();
    return () => { live = false; };
  }, [open, to, target.repo, target.branch, mode, clean, library, gallery]);

  const go = async () => {
    setBusy(true);
    try {
      const ex = await buildExport({ mode, library: clean && library, gallery: clean && gallery });
      if (to === "zip") {
        saveZip(await exportZip(ex), `${siteSlug()}-${mode === "exact" ? "exact-look" : "clean-code"}.zip`);
        play("confirm");
        say({ key: "studio:export", title: "Exported", body: `${ex.files.length} files in a zip: ${mode === "exact" ? "Exact look" : "Clean code"}, Next.js + Tailwind${ex.report ? `. ${ex.report.placed.length} part${ex.report.placed.length === 1 ? " is" : "s are"} still placed by hand (POLIO.md lists them)` : ""}.`, level: "success", source: "studio", toast: true });
      } else {
        const { onBranch, record } = target.repo ? await readBranch(target.repo, target.branch ?? "main") : { onBranch: new Map<string, string>(), record: null };
        const plan = await planExport(ex, onBranch, record);
        useExportDialog.setState({ open: false });
        await exportToRepo(ex, plan, { deploy, say });
      }
      useExportDialog.setState({ open: false });
    } catch (e) {
      play("deny");
      setLine(`The export stopped: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const row = "flex items-start gap-2 text-plain text-fg-muted";
  const hint = "text-fg-subtle";
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) close(); }}
      title={`Export "${name}"`}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="sm" data-export-go="" loading={busy} onClick={() => void go()}>
            {to === "zip" ? <Download /> : <GitBranch />} Export
          </Button>
        </div>
      }
    >
      <div data-export-dialog="" className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-4">
        <span className="text-small font-medium text-fg">Code</span>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Code">
          <label className={row}><input type="radio" name="export-code" data-export-mode="exact" checked={mode === "exact"} onChange={() => setMode("exact")} className="mt-1" /><span>Exact look <span className={hint}>— Next.js + Tailwind, goes live looking exactly as the board does</span></span></label>
          <label className={row}><input type="radio" name="export-code" data-export-mode="clean" checked={mode === "clean"} onChange={() => setMode("clean")} className="mt-1" /><span>Clean code <span className={hint}>— Next.js + Tailwind laid out with flex and grid, for you or a code chat to keep working on</span></span></label>
        </div>

        <span className="text-small font-medium text-fg">Include</span>
        <div className="flex flex-col gap-1.5">
          <label className={row}><input type="checkbox" checked disabled className="mt-1" /><span>Tokens as files</span></label>
          <label className={row}><input type="checkbox" data-export-library="" checked={clean && library} disabled={!clean} onChange={(e) => setLibrary(e.target.checked)} className="mt-1" /><span>Component library{!clean ? <span className={hint}> — with Clean code</span> : null}</span></label>
          <label className={row}><input type="checkbox" checked disabled className="mt-1" /><span>Pages</span></label>
          <label className={row}><input type="checkbox" data-export-gallery="" checked={clean && library && gallery} disabled={!clean || !library} onChange={(e) => setGallery(e.target.checked)} className="mt-1" /><span>A component gallery page</span></label>
        </div>

        <span className="text-small font-medium text-fg">Send to</span>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Send to">
          <label className={row}><input type="radio" name="export-to" data-export-to="repo" checked={to === "repo"} onChange={() => setTo("repo")} className="mt-1" /><span>GitHub repo{target.repo ? <>: <span className="font-mono text-fg">{target.repo}</span></> : <span className={hint}> — a new one, named after the site</span>}</span></label>
          <label className={row}><input type="radio" name="export-to" data-export-to="zip" checked={to === "zip"} onChange={() => setTo("zip")} className="mt-1" /><span>Download a zip</span></label>
          <label className={`${row} ml-5`}><input type="checkbox" data-export-deploy="" checked={to === "repo" && deploy} disabled={to !== "repo"} onChange={(e) => setDeploy(e.target.checked)} className="mt-1" /><span>Deploy on Vercel after the push</span></label>
        </div>
      </div>
      {line ? <p data-export-line="" className="mt-4 text-small text-fg-muted" role="status">{line}</p> : null}
    </Dialog>
  );
}
