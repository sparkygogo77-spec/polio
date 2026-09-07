"use client";
/**
 * The compiled brief: what the canvas actually says, in words. Copy it into any
 * agent, or — when an API key is configured — have Claude work on it in place.
 */
import * as React from "react";
import { Download, FileJson, Loader2, Sparkles, Wand2 } from "lucide-react";
import { compileSpec, specToJson, specToMarkdown } from "./spec";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Segmented } from "@/core/ui/segmented";
import { Badge } from "@/core/ui/badge";
import { useActions } from "@/core/actions";

type Mode = "plan" | "critique" | "expand";

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

export function BriefDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const spec = useCompiledBrief();
  const ctx = useActions();
  const [view, setView] = React.useState<"brief" | "json" | "result">("brief");
  const [mode, setMode] = React.useState<Mode>("plan");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const markdown = React.useMemo(() => specToMarkdown(spec), [spec]);
  const json = React.useMemo(() => specToJson(spec), [spec]);
  const body = view === "json" ? json : view === "result" ? (result ?? "") : markdown;

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
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown, mode }),
      });
      const data = (await res.json()) as { ok: boolean; text?: string; message?: string; usage?: { model?: string } };
      if (data.ok && data.text) {
        setResult(data.text);
        setView("result");
        ctx.publish({ key: "studio:generate", title: "Claude responded", body: data.usage?.model, level: "success", source: "studio", toast: true });
      } else {
        setNote(data.message ?? "Couldn't reach Claude.");
        ctx.publish({ key: "studio:generate", title: "Generation unavailable", body: data.message, level: "warn", source: "studio", toast: true });
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Blueprint"
      description={`${spec.stats.pages} pages · ${spec.stats.elements} elements · ${spec.stats.prompted} with their own prompt`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => download(view === "json" ? json : body, view === "json" ? "blueprint.json" : "brief.md", view === "json" ? "application/json" : "text/markdown")}>
            <Download />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={() => void ctx.copy(body, view === "json" ? "blueprint JSON" : "brief")}>
            Copy {view === "json" ? "JSON" : view === "result" ? "response" : "brief"}
          </Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void generate()}>
            <Sparkles />
            {mode === "plan" ? "Generate plan" : mode === "critique" ? "Critique it" : "Write missing prompts"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            size="xs"
            value={view}
            onChange={(v) => setView(v as typeof view)}
            options={[
              { value: "brief", label: "Brief" },
              { value: "json", label: "JSON" },
              ...(result ? [{ value: "result", label: "Response" }] : []),
            ]}
            aria-label="View"
          />
          <Segmented
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { value: "plan", label: "Plan" },
              { value: "critique", label: "Critique" },
              { value: "expand", label: "Fill prompts" },
            ]}
            aria-label="What Claude should do"
          />
        </div>

        {note ? (
          <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-[11px] text-fg">
            <Wand2 className="mt-0.5 size-3.5 shrink-0 text-warn" />
            <span>{note}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1">
          <Badge size="sm" variant="accent">{spec.stats.pages} pages</Badge>
          <Badge size="sm">{spec.stats.elements} elements</Badge>
          {spec.stats.groups ? <Badge size="sm">{spec.stats.groups} groups</Badge> : null}
          {spec.stats.connections ? <Badge size="sm">{spec.stats.connections} connections</Badge> : null}
          {spec.stats.sketches ? <Badge size="sm">{spec.stats.sketches} sketches</Badge> : null}
          <Badge size="sm" variant={spec.stats.prompted ? "up" : "warn"}>{spec.stats.prompted} prompted</Badge>
        </div>

        <pre
          className={cn(
            "max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-elevated p-3 font-mono text-[11px] leading-relaxed text-fg-muted",
            busy && "opacity-60",
          )}
        >
          {busy && view !== "result" ? null : body || "Nothing on the board yet."}
          {busy ? (
            <span className="flex items-center gap-2 text-accent">
              <Loader2 className="size-3.5 animate-spin" />
              Claude is working through the blueprint…
            </span>
          ) : null}
        </pre>

        <p className="flex items-center gap-1.5 text-[10px] text-fg-faint">
          <FileJson className="size-3" />
          The brief is self-contained — it explains its own conventions, so any agent can act on it without this app.
        </p>
      </div>
    </Dialog>
  );
}
