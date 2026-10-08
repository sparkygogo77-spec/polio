"use client";
/**
 * IS MY WORK SAVED? A QUIET LINE IN THE TOP BAR THAT SAYS.
 *
 * A board lives in this browser and nothing said so, or whether the last
 * change had been kept. The line reads "Saved in this browser, 12:04" once
 * the document store has written the board (`docStore.ts`, `onSave`),
 * "Saving…" while it writes, and in red when this browser would not keep
 * it. A press opens what that means and the two things to do about it:
 * Download a backup (one file holding the site and its pictures,
 * `backup.ts`) and Load a backup (always as a new site beside the others).
 *
 * Once per site, when it has been worked on and has never been backed up or
 * published, a small bubble under the line says so, with Download a backup
 * and Not now. It takes no focus, so whatever is being typed goes on being
 * typed, and it is never shown twice for one site (`Project.nudged`).
 *
 * Only in the Builder: elsewhere there is no board open to be saved.
 * `tests/board-backup.mjs`, `tests/save-line.mjs`.
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { Download, HardDrive, Loader2, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Popover } from "@/core/ui/popover";
import { useActions } from "@/core/actions";
import { cn } from "@/core/lib/cn";
import { useBuilds } from "@/features/builds/store";
import { lastEdit } from "@/features/builds/edits";
import { timeWords } from "@/features/builds/publishState";
import { onSave, saveStateOf, type SaveState } from "./docStore";
import { downloadBackup, pickAndLoadBackup } from "./backup";
import { onBoardEdit } from "./board/store";

const LIVE = "builder.studio";
/** Edits to one site in one visit before the one reminder may show. */
export const NUDGE_AFTER = 10;

/*
 * Quiet: a write takes a tenth of a second and happens on every edit, so a
 * line that said "Saving…" each time would flicker through every drag. It
 * says "Saving…" only before anything has been saved this visit; after
 * that it keeps the last time until the next save lands.
 */
function useSaveState(): SaveState | null {
  const [st, setSt] = React.useState<SaveState | null>(() => saveStateOf(LIVE));
  React.useEffect(() => onSave(() => {
    const now = saveStateOf(LIVE);
    setSt((was) => (now?.state === "saving" && was && was.state !== "saving" ? was : now));
  }), []);
  return st;
}

export function SaveLine() {
  const path = usePathname() ?? "";
  if (!/^\/(builder|studio)(\/|$)/.test(path) || /\/preview\//.test(path)) return null;
  return <SaveLineInner />;
}

function SaveLineInner() {
  const ctx = useActions();
  const st = useSaveState();
  const project = useBuilds((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
  const [open, setOpen] = React.useState(false);
  const [nudge, setNudge] = React.useState(false);
  const [busy, setBusy] = React.useState<"down" | "up" | null>(null);
  const [said, setSaid] = React.useState<{ says: string; ok: boolean; id?: string } | null>(null);

  /* THE ONE REMINDER. Counted per site and per visit; shown once, ever, for a site never backed up or published. */
  const edits = React.useRef<{ id: string | null; n: number }>({ id: null, n: 0 });
  React.useEffect(() => onBoardEdit(() => {
    const { activeId, projects, setNudged } = useBuilds.getState();
    if (edits.current.id !== activeId) edits.current = { id: activeId, n: 0 };
    edits.current.n++;
    const p = projects.find((x) => x.id === activeId);
    if (!p || p.nudged || p.backedUpAt || p.published || p.live || edits.current.n < NUDGE_AFTER) return;
    /* Written first, so a second edit before the render never shows it twice. */
    setNudged(p.id);
    /* A bubble under the line, never a popover: it takes no focus, so a person typing keeps typing. */
    setTimeout(() => setNudge(true), 0);
  }), []);

  const at = st?.at ?? lastEdit() ?? project?.updatedAt ?? null;
  const failed = st?.state === "failed";
  const saving = st?.state === "saving";
  const words = failed
    ? "Not saved: this browser would not keep it"
    : saving
      ? "Saving…"
      : `Saved in this browser${at ? `, ${timeWords(at)}` : ""}`;

  const download = async () => {
    if (!project) return;
    setBusy("down");
    try {
      const r = await downloadBackup(project.id);
      setSaid(r);
      ctx.publish({ key: "studio:backup", title: r.ok ? "Backup downloaded" : "No backup made", body: r.says, level: r.ok ? "success" : "warn", source: "studio" });
      if (r.ok) setNudge(false);
      return r;
    } finally { setBusy(null); }
  };
  const load = async () => {
    setBusy("up");
    try {
      const r = await pickAndLoadBackup();
      if (!r) return;
      setSaid(r);
      ctx.publish({ key: "studio:backup-load", title: r.ok ? "Backup loaded" : "Not loaded", body: r.says, level: r.ok ? "success" : "warn", source: "studio" });
    } finally { setBusy(null); }
  };

  const lastBackup = project?.backedUpAt ? `Last backup downloaded ${timeWords(project.backedUpAt)}.` : "No backup of this site has been downloaded yet.";

  return (
    <span className="relative flex shrink-0 items-center">
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (v) setNudge(false); else setSaid(null); }}
      align="end"
      className="w-[min(340px,92vw)] p-3"
      content={
        <div data-save-card="" className="flex flex-col gap-2 text-small">
          <p className="text-plain text-fg">{failed ? "This browser would not keep the latest change: its storage may be full. Download a backup now so nothing is lost." : words}.</p>
          <p className="text-fg-muted">
            Sites are kept in this browser only. Clearing the browser&apos;s data, or opening the Builder in another browser, loses them. {lastBackup}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="primary" data-backup-download="" loading={busy === "down"} disabled={!project} onClick={() => void download()}>
              <Download /> Download a backup
            </Button>
            <Button size="sm" variant="outline" data-backup-load="" loading={busy === "up"} onClick={() => void load()}>
              <Upload /> Load a backup
            </Button>
          </div>
          {said ? (
            <p data-backup-said="" role="status" className={said.ok ? "text-up" : "text-down"}>
              {said.says}
              {said.ok && said.id ? (
                <button type="button" className="tactile ml-1 underline underline-offset-2" onClick={() => { void useBuilds.getState().open(said.id!); setOpen(false); }}>Open it</button>
              ) : null}
            </p>
          ) : null}
        </div>
      }
    >
      <button
        type="button"
        data-save-line={st?.state ?? "idle"}
        aria-label={words}
        title={`${words}. Press for backups.`}
        className={cn(
          "tactile hidden h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-small sm:inline-flex",
          failed ? "text-down" : "text-fg-faint hover:text-fg-muted",
        )}
      >
        {failed ? <TriangleAlert className="size-3.5" /> : saving ? <Loader2 className="size-3.5 animate-spin" /> : <HardDrive className="size-3.5" />}
        <span className="hidden max-w-[220px] truncate lg:inline">{words}</span>
      </button>
    </Popover>
    {nudge ? (
      <div
        data-save-reminder=""
        role="status"
        className="absolute right-0 top-full z-50 mt-1.5 flex w-[min(320px,90vw)] flex-col gap-2 rounded-lg border border-border bg-panel p-3 text-small shadow-lg"
      >
        <p className="text-plain text-fg">This site is only in this browser, and it has never been backed up or published. A backup is one file you can keep anywhere and load again.</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="primary" data-reminder-download="" loading={busy === "down"} onClick={() => void download()}>
            <Download /> Download a backup
          </Button>
          <Button size="sm" variant="ghost" data-reminder-dismiss="" onClick={() => setNudge(false)}>Not now</Button>
        </div>
      </div>
    ) : null}
    </span>
  );
}
