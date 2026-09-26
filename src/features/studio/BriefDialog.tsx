"use client";
/**
 * The iteration book: the brief, the JSON, and every thread, in one place.
 *
 * The blueprint is what the canvas says, in words; the pictures are what it
 * looks like, taken by the server from the live preview the moment you
 * press the button, so Claude reads the site the way you see it. Seven
 * things can be asked, one is anything at all in your own words, and one
 * writes the code — which, with the document and the blueprint, can go to
 * GitHub in one commit from here, and from there to Vercel.
 *
 * Every ask that comes back lands on the trail as a thread, so the book is
 * both the question and the record of every question before it. That is why
 * the brief, the JSON and the trail are one page rather than three tabs of a
 * box you dismiss: the last thread is read while the next ask is written.
 *
 * It wears three shapes and is one component in all of them. **Dialog** is
 * the quick way in, over the board. **Panel** is the same thing pinned open
 * down the side, so the board stays workable underneath. **Page** is the
 * book proper, beside Design and Preview, where the trail has the room a map
 * needs and the brief and the JSON sit next to it.
 *
 * Nothing needs a key to work: without one you copy or download the same
 * things and hand them to any agent, and the book says so where it matters.
 */
import * as React from "react";
import { BookOpen, Camera, Check, Copy, Download, ExternalLink, FileJson, GitBranch, Globe, Loader2, Pin, PinOff, Search, Sparkles, Wand2, X } from "lucide-react";
import { briefPrefix, compileSpec, specToJson, specToMarkdown } from "./spec";
import { trailToMarkdown, useLanes } from "./PromptTrail";
import { PinnedThreads, ThreadTree, usePieces } from "./ThreadTree";
import { QueueList } from "./DrawQueue";
import { doneJobs, pendingJobs } from "./queue";
import { piecesToSend, threadsToMarkdown } from "./threads";
import { buildScaffold, gapsOf, type ScaffoldResult } from "./scaffoldRun";
import { auditCounts, auditSite, sitePictures, staticSite, type PageAudit } from "./staticSite";
import { useStudio } from "./store";
import { askClaude, claudeReady, deploy, deployStatus, filesFromMarkdown, MODES, noKeyMessage, publish, publishStatus, screenshotPages, screenshotsAvailable, siteFiles, watchDeploy, type AskMode, type DeployState, type DeployStatus, type Device, type GeneratedFile, type Picture, type PublishStatus } from "./agent";
import { useKeys } from "@/features/keys/store";
import { activeProject, allSources, repoLabel, useBuilds } from "@/features/builds/store";
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
import { screenFace, SCREEN, VOID } from "@/core/ui/void";
import { claudeSpend } from "./spend";

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
/** Over the board, pinned beside it, or the page itself. */
type Layout = "dialog" | "panel" | "page";

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/**
 * One card of the book.
 *
 * The tour writes on cards — a rule, a small heading, the words under it, on
 * panel glass with a soft edge — and the book had a flatter idea of a section
 * of its own, which read as a different app. This is that same card, so
 * everything the Builder says is said in one voice.
 */
function Card({ title, note, right, children, className }: { title?: React.ReactNode; note?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-panel/95 p-2.5 shadow-pop", className)}>
      {title || right ? (
        <div className="mb-1.5 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {title ? <h3 className="text-large font-semibold leading-snug text-fg">{title}</h3> : null}
            {note ? <p className="mt-0.5 text-plain leading-snug text-fg-muted">{note}</p> : null}
          </div>
          {right ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** The small capital label the whole Builder uses over a field. */
/**
 * What the publish will leave out, said here and nowhere else.
 *
 * THE RULING THIS EXISTS FOR: fail loudly in the Builder, never on the
 * published site. The audit used to print itself at the foot of his live
 * page — "nothing has been built for it yet", in a dashed border, to
 * anybody who visited — which is both scaffolding a visitor should never
 * see and a sentence about how the work is made, which his site never
 * mentions at all. The page now shows what was built and omits what was
 * not, and this is where the same information goes, at the same volume,
 * beside the button that would send it.
 *
 * Read on demand, because it renders every page of the site to find out:
 * pressing asks, and the answer stands until it is asked again.
 */
function LeftBehind() {
  const [audit, setAudit] = React.useState<PageAudit[] | null>(null);
  const [looking, setLooking] = React.useState(false);
  const look = () => {
    setLooking(true);
    /* A frame, so the button has drawn as pressed before the render of
       every page blocks the thread. */
    requestAnimationFrame(() => {
      try {
        setAudit(auditSite());
      } finally {
        setLooking(false);
      }
    });
  };
  const total = audit ? auditCounts(audit) : 0;
  return (
    <div data-left-behind="" className="rounded-md border border-border bg-elevated/40 p-2">
      <div className="flex items-center gap-2">
        <span className="text-small uppercase tracking-wider text-fg-faint">What will not go out</span>
        <span className="flex-1" />
        <Button variant="outline" size="sm" data-left-behind-look="" disabled={looking} onClick={look}>
          {looking ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
          {audit ? "Check again" : "Check"}
        </Button>
      </div>
      {audit === null ? (
        <p className="mt-1 text-small leading-snug text-fg-faint">
          The published page shows what was built and says nothing about what was not — no notes, no placeholders, nothing about how it
          was made. This is where you find out what that leaves out.
        </p>
      ) : total === 0 ? (
        <p data-left-behind-clean="" className="mt-1 text-plain text-up">Everything on the board reaches the page.</p>
      ) : (
        <ul data-left-behind-list="" className="mt-1 space-y-1.5">
          {audit.filter((a) => auditCounts([a]) > 0).map((a) => (
            <li key={a.page} data-left-behind-page={a.page}>
              <div className="text-plain font-medium text-fg">{a.page}</div>
              <Left what="in your layout, with no part built for it" names={a.sections} />
              <Left what="showing words nobody has written" names={a.unwritten} />
              <Left what="asked for in a prompt and not on the page" names={a.unsaid.map((u) => `${u.part}: ${u.words.join(" \u00b7 ")}`)} />
              <Left what="drawing nothing at all" names={a.blank} />
              <Left what="on the board, but on no page" names={a.unplaced} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Left({ what, names }: { what: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="mt-0.5 text-small leading-snug text-fg-muted">
      <span className="text-fg-faint">{names.length} {what}: </span>
      {names.join(", ")}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-small font-medium uppercase tracking-wider text-fg-faint">{children}</span>;
}

/*
 * A DEPLOYMENT IS FOLLOWED TO ITS END, WHATEVER HAPPENS TO THE PAGE.
 *
 * Go live starts a deployment and follows it from this page. The dialog
 * closing does not stop that; a reload or a closed tab did, and the address
 * never landed (`tests/live-resume.mjs`). So the deployment is written on
 * the site as `pending` the moment it starts, and cleared only when Vercel
 * says it ended: READY records the address, ERROR or CANCELED end it with
 * nothing to record. A wait with no Vercel key, a lost connection, or the
 * ten-minute patience running out leaves it pending, to be picked up again.
 * `following` keeps one page from following the same deployment twice.
 */
const following = new Set<string>();
/** A deployment older than this is not waited on again: whatever it came to, the Vercel log has it. */
const PENDING_FOR = 24 * 60 * 60_000;

async function followDeployment(projectId: string, dep: { id: string; team: string | null }, onState?: (s: DeployState) => void): Promise<DeployState> {
  following.add(dep.id);
  const builds = useBuilds.getState();
  if (builds.projects.find((p) => p.id === projectId)?.pending?.id !== dep.id) builds.setPending(projectId, { id: dep.id, team: dep.team, at: Date.now() });
  try {
    const end = await watchDeploy(dep.id, { team: dep.team, onState });
    if (end.state === "READY" && end.url) useBuilds.getState().setLive(projectId, end.url);
    if (end.state === "READY" || end.state === "ERROR" || end.state === "CANCELED") useBuilds.getState().setPending(projectId, undefined);
    return end;
  } finally {
    following.delete(dep.id);
  }
}

/**
 * On the Builder, every site's pending deployment is picked up: after the
 * list hydrates, after a new one is written, and again when a Vercel key is
 * unlocked, since without one there is nothing to ask Vercel with.
 */
function useResumeLive() {
  const ctx = useActions();
  const waiting = useBuilds((s) => s.projects.filter((p) => p.pending).map((p) => `${p.id}:${p.pending!.id}`).join(","));
  const keyed = useKeys((s) => s.unlocked && !!s.values.VERCEL_TOKEN);
  React.useEffect(() => {
    for (const p of useBuilds.getState().projects) {
      const dep = p.pending;
      if (!dep || following.has(dep.id)) continue;
      if (Date.now() - dep.at > PENDING_FOR) { useBuilds.getState().setPending(p.id, undefined); continue; }
      void followDeployment(p.id, dep).then((end) => {
        if (end.state === "READY" && end.url) {
          ctx.publish({ key: "studio:live", title: "The site is live", body: `${p.name} at ${end.url}`, level: "success", source: "studio", toast: true, href: end.url });
        } else if (end.state === "ERROR" || end.state === "CANCELED") {
          ctx.publish({ key: "studio:live", title: `The build ${end.state.toLowerCase()}`, body: end.message ?? "The Vercel log says why.", level: "error", source: "studio", toast: true, href: end.inspectorUrl ?? undefined });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, keyed]);
}

export function BriefDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  useResumeLive();
  const pinned = useStudio((s) => s.bookPinned);
  const spec = useCompiledBrief();

  /*
   * Pinned, it is not a dialog at all: no overlay, nothing trapped, the board
   * carries on underneath. That is the whole point of the pin — a long run is
   * watched, and a box you must dismiss to see what you are talking about is
   * not a place to watch it from.
   */
  if (pinned && open) {
    return (
      <aside
        data-book-panel=""
        aria-label="The book of updates"
        className="fixed right-0 top-[var(--topbar-h)] z-[60] flex h-[calc(100dvh-var(--topbar-h))] w-[min(520px,96vw)] flex-col border-l border-border bg-panel shadow-panel"
      >
        <Book layout="panel" onClose={() => onOpenChange(false)} />
      </aside>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      // The Builder's own surfaces are the void — the wheel, the console, the
      // command palette, the keys panel — and this was the one that stayed a
      // plain shell panel, which made the thing you press Finish to see look
      // like it belonged to a different program. The pinned panel is not this:
      // docked beside the Inspector, it is one of the shell's panels and wears
      // the shell's tokens.
      className="border-[color:var(--void-rim)] bg-[color:var(--void-face)] shadow-[var(--void-drop)]"
      style={{ "--void-face": VOID.face, "--void-rim": VOID.rim, "--void-drop": VOID.drop } as React.CSSProperties}
      title="The book of updates"
      description={`${spec.stats.pages} pages · ${spec.stats.elements} elements · ${spec.stats.prompted} with their own prompt`}
    >
      <Book layout="dialog" onClose={() => onOpenChange(false)} />
    </Dialog>
  );
}

/** The book as the Builder's third screen, beside Design and Preview. */
export function IterationBook() {
  return <Book layout="page" />;
}

/** What a card asks the book to do: the mode it was made in, the words, and whether to run. */
export interface AskDetail { mode?: string; prompt?: string; run?: boolean }

/** An ask that was made while the book under the timeline was not on screen. */
let parked: AskDetail | null = null;

/**
 * Hand the book an ask from anywhere. Opens the book's tab, then either the
 * mounted book hears the event, or, when the tab was elsewhere and the book
 * is a render away, it finds the ask parked here as it mounts. One door for
 * the card's Re-iterate, so the press works from wherever it was pressed.
 */
export function askTheBook(detail: AskDetail): void {
  parked = detail;
  window.dispatchEvent(new CustomEvent("studio:book"));
  window.dispatchEvent(new CustomEvent("studio:ask", { detail }));
}

function Book({ layout, onClose }: { layout: Layout; onClose?: () => void }) {
  const spec = useCompiledBrief();
  const master = useStudio((s) => s.brief.master);
  const siteName = useStudio((s) => s.brief.name);
  const trailCount = useStudio((s) => s.trail.filter((e) => e.stage === "critique").length);
  // The Trail is the threads now; the tab counts them, and the findings from
  // before threads were kept are still reachable underneath the tree.
  const threads = useStudio((s) => s.threads);
  const draftPieces = useStudio((s) => s.draftPieces);
  const sentPieces = useStudio((s) => s.sentPieces);
  const bookPinned = useStudio((s) => s.bookPinned);
  const queue = useStudio((s) => s.queue);
  const pieces = usePieces();
  const lanes = useLanes();
  const ctx = useActions();
  const wantShots = useSettingValue<boolean>("studio.screenshots");
  const shotPages = useSettingValue<number>("studio.screenshotPages");
  const deployDefault = useSettingValue<boolean>("studio.publishDeploy");
  const page = layout === "page";

  const [view, setView] = React.useState<View>("brief");
  const [mode, setMode] = React.useState<AskMode>("plan");
  const [prompt, setPrompt] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ text: string; mode: AskMode; model?: string; pictures: number; dropped: number; droppedWhy: string; truncated: boolean } | null>(null);
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
  const [liveRun, setLiveRun] = React.useState<{ state: string | null; url: string | null; inspectorUrl: string | null; done: boolean; message?: string } | null>(null);
  /* The address the open site went live at, the last time it did. */
  const liveAt = useBuilds((s) => s.projects.find((p) => p.id === s.activeId)?.live?.url ?? null);
  const abort = React.useRef<AbortController | null>(null);

  const markdown = React.useMemo(() => specToMarkdown(spec), [spec]);
  const json = React.useMemo(() => specToJson(spec), [spec]);
  const trailText = React.useMemo(() => (threads.length ? threadsToMarkdown(threads) : trailToMarkdown(lanes)), [threads, lanes]);
  const body = view === "json" ? json : view === "result" ? (result?.text ?? "") : view === "trail" ? trailText : markdown;

  React.useEffect(() => { setSendShots(wantShots); }, [wantShots]);
  React.useEffect(() => { setPubDeploy(deployDefault); }, [deployDefault]);
  React.useEffect(() => {
    void screenshotsAvailable().then(setCanShoot);
    void publishStatus().then(setPub);
    void deployStatus().then(setLive);
    setPubMessage(`Builder: publish ${siteName.trim() || "the site"}`);
  }, [siteName]);
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

  /*
   * RE-ITERATE, FROM A CARD.
   *
   * A green card is the site, and running the prompt that made it again —
   * with a word changed or without — is what a card of a site is for. There
   * is one pipeline for asking Claude and this is it, so the card does not
   * grow a second one: it hands over the mode the update was made in and the
   * prompt as it stands, the book opens on the ask with both in place, and
   * `run` fires the same call the Ask button fires.
   *
   * The run is fired from an effect rather than from the handler so it sees
   * the mode and the prompt that were just set rather than the ones that
   * were there before.
   */
  const [runWanted, setRunWanted] = React.useState(0);
  const fire = React.useRef(0);
  React.useEffect(() => {
    const take = (d: AskDetail) => {
      parked = null;
      if (d.mode && MODES.some((m) => m.value === d.mode)) setMode(d.mode as AskMode);
      if (typeof d.prompt === "string") setPrompt(d.prompt);
      setView("brief");
      if (d.run) setRunWanted((n) => n + 1);
    };
    const on = (e: Event) => take((e as CustomEvent<AskDetail>).detail ?? {});
    /*
     * Only the book that lives under the timeline answers. The dialog and
     * the panel are the same component and would otherwise each run the
     * same call — one press, three bills.
     */
    if (layout !== "page") return;
    /*
     * An ask that arrived before this book was on screen. The card's
     * Re-iterate fires `studio:book` and then the ask in the same handler;
     * the tab switch is a render away, so from any tab but the book the
     * event had nobody to hear it and the press did nothing. `askTheBook`
     * parks the ask first; the book takes it the moment it mounts.
     */
    if (parked) take(parked);
    window.addEventListener("studio:ask", on);
    return () => window.removeEventListener("studio:ask", on);
  }, [layout]);

  const generate = async () => {
    if (busy) return;
    setNote(null);
    setPubResult(null);
    const ac = new AbortController();
    abort.current = ac;
    /*
     * The banner, in the order a reader needs it. A missing or locked key is
     * why nothing was asked at all, so it goes first and stays there: the
     * pictures failing is a detail underneath it, not the headline, and the
     * old order left a locked keys panel reading as a broken camera.
     */
    const said: { key?: string; run?: string; shots?: string } = {};
    const say = () => setNote([said.key, said.run, said.shots].filter(Boolean).join(" ") || null);
    // The keys panel takes the focus, and a dialog closes when it loses it —
    // which lets go of whatever request is in flight. So the panel is opened
    // when the run is over, never during it.
    let openKeys = false;
    try {
      // Asked before the camera, so the reason reaches the banner even if
      // everything after this is let go of. It does not stop the run: the
      // call is still made and the route's own answer still wins.
      if (!(await claudeReady())) {
        said.key = noKeyMessage("Or copy the blueprint into any agent, it is written to stand alone.");
        openKeys = true;
        say();
      }
      let pictures: Picture[] = [];
      if (sendShots && canShoot) {
        setBusy("Photographing the pages…");
        const shot = await screenshotPages(shotPages, device, (done, total) => setBusy(`Photographing page ${done} of ${total}…`), ac.signal);
        pictures = shot.pictures;
        setShots(pictures);
        if (!pictures.length) {
          said.shots = shot.timedOut
            ? "The server never answered for the photographs, so the words went alone."
            : "The server could not photograph the pages, so the words went alone.";
          say();
        }
      }
      /*
       * Build writes the site's looks itself, from the document, before
       * anything is asked: the tokens, a component per part carrying the
       * markup that part actually renders, and the pages that place them.
       * Claude is then asked only for what a document cannot hold. This is
       * why a rebuild does not drift — the half that used to drift is not
       * generated any more.
       */
      let built: ScaffoldResult | null = null;
      if (mode === "build") {
        setBusy("Writing the site from the document…");
        try {
          built = buildScaffold();
          setFiles(built.files.map((f) => ({ path: f.path, content: f.content })));
          setView("files");
          said.run = `${built.files.length} files written from the document in ${built.stats.ms < 1000 ? `${built.stats.ms}ms` : `${(built.stats.ms / 1000).toFixed(1)}s`}, ${built.stats.parts} parts, ${built.stats.clipped} cut to a drawn line, ${built.stats.bodies} with a written body. Claude is being asked only for what is left.`;
          say();
        } catch (err) {
          said.run = `The scaffold could not be written: ${err instanceof Error ? err.message : "unknown"}. Claude was asked for the whole site instead.`;
          say();
        }
      }
      setBusy(mode === "build" ? "Claude is filling in what the document cannot hold…" : "Claude is working through the blueprint…");
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
          ...(built
            ? {
                scaffold: {
                  files: built.files.map((f) => ({ path: f.path, bytes: f.content.length })),
                  gaps: gapsOf(built),
                  stats: built.stats,
                },
              }
            : {}),
        },
        { signal: ac.signal },
      );
      // The camera step is over the moment there is an answer, whatever the
      // answer is. Leaving it to the end left a failure that returns at once
      // — no key, most of all — showing "Photographing the pages…" until Stop
      // was pressed, because everything after this can be interrupted and
      // this cannot.
      setBusy(null);
      if (ac.signal.aborted) return;
      if (r.ok) {
        // The call went through, so whatever was said about the key before it
        // was wrong — the server had one after all.
        said.key = undefined;
        say();
        setResult({ text: r.text, mode, model: r.model, pictures: r.pictures, dropped: r.dropped, droppedWhy: r.droppedWhy, truncated: r.truncated });
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
            r.dropped ? `${r.dropped} left out (${r.droppedWhy})` : "",
            vined ? `${send.length} piece${send.length === 1 ? "" : "s"} sent${skipped.length ? `, ${skipped.length} unchanged` : ""}` : "",
          ].filter(Boolean),
        });
        // What went, and what the cache gave back. The second call of a
        // thread reads its brief rather than sending it, and that number is
        // the whole point of splitting the two apart.
        /*
         * What the call cost and how long it took, on the iteration.
         *
         * Not only when pieces were vined: a call is a call, and an
         * iteration with no bill on it reads as a free one. `recordSent`
         * writes what went; `noteSpend` adds the money and the wait, so the
         * card carries both however the call was made.
         */
        useStudio.getState().noteSpend(claudeSpend(
          { input: r.input, output: r.output, cached: r.cached, written: r.written },
          r.ms,
        ));
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
          // The scaffold is the site; what came back is added to it, and a
          // file Claude names on purpose replaces the one the document
          // wrote. Nothing silently disappears either way.
          const scaffolded = built?.files.map((f) => ({ path: f.path, content: f.content })) ?? [];
          const merged = [...scaffolded];
          for (const f of r.files) {
            const at = merged.findIndex((x) => x.path === f.path);
            if (at >= 0) merged[at] = f;
            else merged.push(f);
          }
          setFiles(merged);
          setView(merged.length ? "files" : "result");
          if (built) {
            said.run = `${built.files.length} files written from the document, ${r.files.length} from Claude${r.files.filter((f) => scaffolded.some((x) => x.path === f.path)).length ? ` (${r.files.filter((f) => scaffolded.some((x) => x.path === f.path)).length} replacing a scaffolded file)` : ""}.`;
            say();
          } else if (!r.files.length) setNote("Claude answered, but no files could be read out of it. The response is shown as it came.");
        } else setView(r.revisions.length ? "trail" : "result");
        if (r.truncated) setNote("Claude ran out of room before the end. Ask for less at once, or split the site into pages.");
        ctx.publish({ key: "studio:generate", title: "Claude responded", body: [r.model, r.pictures ? `${r.pictures} picture${r.pictures === 1 ? "" : "s"} seen` : "words only", r.dropped ? `${r.dropped} left out: ${r.droppedWhy}` : ""].filter(Boolean).join(" · "), level: "success", source: "studio", toast: true });
      } else if (r.reason !== "stopped") {
        const why = r.reason === "no-key" ? noKeyMessage("Or copy the blueprint into any agent, it is written to stand alone.") : r.message;
        if (r.reason === "no-key") {
          said.key = why;
          openKeys = true;
        } else said.run = why;
        say();
        ctx.publish({ key: "studio:generate", title: "Generation unavailable", body: why, level: "warn", source: "studio", toast: true });
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        said.run = err instanceof Error ? err.message : "Request failed.";
        say();
      }
    } finally {
      setBusy(null);
      abort.current = null;
      if (openKeys) ctx.openPanel("keys");
    }
  };

  /* And the card's Re-iterate runs it, once the mode and the prompt it sent
     are actually in. `fire` keeps a second render from asking twice. */
  React.useEffect(() => {
    if (!runWanted || fire.current === runWanted) return;
    fire.current = runWanted;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runWanted]);

  const publishFiles = React.useMemo(() => [...siteFiles(markdown, json), ...files], [markdown, json, files]);

  /*
   * WHAT ACTUALLY GOES UP: the site, and then everything that describes it.
   *
   * A publish used to carry the document and the blueprint and nothing a
   * browser can open, so the repository imported at Vercel had nothing at
   * its root and answered NOT_FOUND at every address. The pages are written
   * here, at the moment of pressing, by rendering each one the way the
   * preview does and reading its markup back (`staticSite`). No key, no
   * model, nothing asked of anybody: pressing publish is now enough to have
   * a website.
   *
   * Not in the memo above on purpose. Writing the pages mounts and unmounts
   * a React root per page; that is work to do when somebody presses a
   * button, not on every render of a dialog.
   */
  const everything = async (): Promise<GeneratedFile[]> => {
    let pages: GeneratedFile[] = [];
    try {
      pages = staticSite();
    } catch (err) {
      /* The description still goes up, and the banner says the pages did
         not — rather than a publish that silently carries half of it. */
      setNote(`The pages could not be written out (${err instanceof Error ? err.message : "unknown"}), so only the document went up.`);
      return publishFiles;
    }
    /*
     * And the pictures, as real files. The document holds only their paths,
     * so this is the one moment their bytes are read out of this browser's
     * storage. One this browser has lost is named rather than skipped: the
     * page that points at it already says it is missing, and so should the
     * person pressing publish.
     */
    let shots: GeneratedFile[] = [];
    try {
      const { files, lost } = await sitePictures();
      shots = files;
      if (lost.length) setNote(`${lost.length} picture${lost.length === 1 ? " is" : "s are"} no longer in this browser, so ${lost.length === 1 ? "it" : "they"} could not be published. Add ${lost.length === 1 ? "it" : "them"} again on the board.`);
    } catch (err) {
      setNote(`The pictures could not be read out of this browser (${err instanceof Error ? err.message : "unknown"}), so the pages went up without them.`);
    }
    return [...pages, ...shots, ...publishFiles];
  };

  /*
   * WHERE A PUSH GOES, AND WHAT A NEW REPOSITORY IS CALLED.
   *
   * Both buttons push, so both ask this rather than each working it out.
   * Go live used to send no `create` at all, so the first press of it on a
   * site with no repository yet came back "nothing to name a new one after:
   * give the site a name in the brief" — on a site whose brief plainly says
   * BLACKORB. Nothing was wrong with the name; the button never sent it.
   */
  const pushTo = () => {
    const project = activeProject();
    /* WHERE IT PUBLISHES, never where it came from: `repo` is the publish
       target alone, and `source` (what Bring read) is not read here. */
    const repo = repoLabel(project?.repo) ?? undefined;
    const sources = allSources();
    return {
      project,
      repo,
      /* A site with no target yet gets a new repository, on main. The
         document's edit branch was opened against a target, and a
         repository made this moment has none of that history. */
      branch: project?.repo?.branch ?? (repo ? undefined : "main"),
      /* The lock, said to the route: this site publishes to the repository
         it is bound to and nowhere else, whatever else the call says. */
      boundTo: repo,
      /* Every repository a site here was brought in from: the route refuses
         each, whatever the call names. */
      sources,
      /* Said here too, before anything is sent: the target is where a site
         came from. `settle` keeps that from happening; this is the words
         for it if it ever does. */
      refused: repo && sources.some((r) => r.toLowerCase() === repo.toLowerCase())
        ? `${repo} is where a site here was brought in from, and Publish never writes back into that. Clear it on the Builds page and the next Publish makes this site a repository of its own.`
        : null,
      /* No repository yet: what to call the one this publish will make.
         Nobody is asked for a name — the site already has one. */
      create: repo ? undefined : (siteName.trim() || project?.name?.trim() || "site"),
    };
  };

  /*
   * A TARGET THE ROUTE SAYS IS A CAPTURE, OR A SOURCE, IS TAKEN OFF.
   *
   * It is refused either way; left on, every press would be refused again
   * and the Builds page would go on saying Publish pushes there. Taken off
   * and said, the next press makes the site a repository of its own.
   */
  const refusedTarget = (project: ReturnType<typeof activeProject>, r: { reason?: string; message?: string }): string => {
    const message = r.message ?? "";
    if (!project?.repo || (r.reason !== "capture" && r.reason !== "source")) return message;
    useBuilds.getState().setRepo(project.id, undefined);
    return `${message} It is no longer this site's publish target: the next Publish makes a repository of its own.`;
  };

  /*
   * A repository the push made is written on the site the moment it exists,
   * whether or not the push that followed it worked. It used to be written
   * only on success, so a first publish that made the repository and then
   * failed left the site not knowing about it — and the next press made
   * another one, with a suffix, because the name was taken.
   */
  const remember = (project: ReturnType<typeof activeProject>, made: string | undefined, branch: string | undefined) => {
    if (!made || !project) return;
    const [owner, name] = made.split("/");
    if (owner && name) useBuilds.getState().setRepo(project.id, { owner, name, branch: branch ?? "main" });
  };

  const doPublish = async () => {
    if (busy) return;
    setNote(null);
    const { project, repo, branch, create, boundTo, sources, refused } = pushTo();
    if (refused) {
      setNote(refused);
      ctx.publish({ key: "studio:publish", title: "Not published", body: refused, level: "error", source: "studio", toast: true });
      return;
    }
    const going = await everything();
    setBusy(`Pushing ${going.length} files to GitHub…`);
    try {
      const r = await publish({
        files: going,
        message: pubMessage.trim() || "Builder: publish the site",
        deploy: pubDeploy,
        repo,
        branch,
        create,
        boundTo,
        sources,
      });
      remember(project, r.created, r.ok ? r.branch : branch);
      if (r.ok) {
        setPubResult({ url: r.commitUrl, files: r.files, deployed: r.deployed, hook: r.hook, note: r.deployNote });
        // Written on the live thread's card, because this is what that
        // iteration came to: the card says what was made of the answer.
        useStudio.getState().noteThread([
          `${r.files} files pushed to ${r.repo} on ${r.branch}`,
          r.deployed ? "Vercel deploy started by the hook" : "",
        ]);
        ctx.publish({ key: "studio:publish", title: r.created ? `Made ${r.repo} and published to it` : `Published to ${r.repo}`, body: `${r.files} files on ${r.branch}${r.deployed ? " · Vercel deploy started" : ""}`, level: "success", source: "studio", toast: true, href: r.commitUrl });
      } else {
        const says = refusedTarget(project, r);
        setNote(says);
        ctx.publish({ key: "studio:publish", title: "Publish failed", body: says, level: "error", source: "studio", toast: true });
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
    const { project, repo, branch, create, boundTo, sources, refused } = pushTo();
    if (refused) {
      setNote(refused);
      ctx.publish({ key: "studio:publish", title: "Not published", body: refused, level: "error", source: "studio", toast: true });
      return;
    }
    const going = await everything();
    try {
      setBusy(`Pushing ${going.length} files to GitHub…`);
      const pushed = await publish({ files: going, message: pubMessage.trim() || "Builder: publish the site", deploy: false, repo, branch, create, boundTo, sources });
      remember(project, pushed.created, pushed.ok ? pushed.branch : branch);
      if (!pushed.ok) {
        const says = refusedTarget(project, pushed);
        setNote(says);
        ctx.publish({ key: "studio:publish", title: "Publish failed", body: says, level: "error", source: "studio", toast: true });
        return;
      }
      setPubResult({ url: pushed.commitUrl, files: pushed.files, deployed: false, hook: pushed.hook });
      useStudio.getState().noteThread([`${pushed.files} files pushed to ${pushed.repo} on ${pushed.branch}`]);

      setBusy("Asking Vercel to build it…");
      /* A repository with no Vercel project gets one on the way, named after
         the site, so this press is the only one needed from board to address. */
      const started = await deploy({ repo: repo ?? pushed.repo, branch: branch ?? pushed.branch, name: siteName.trim() || project?.name?.trim() || undefined, sources });
      if (!started.ok) {
        setNote(started.message);
        useStudio.getState().noteThread([`Vercel would not build it: ${started.message}`]);
        ctx.publish({ key: "studio:live", title: "Not deployed", body: started.message, level: "warn", source: "studio", toast: true });
        return;
      }
      if (started.created) useStudio.getState().noteThread([`Made the Vercel project ${started.created}, connected to ${started.repo}: every push to it deploys on its own now`]);
      if (started.note) setNote(started.note);
      setLiveRun({ state: started.state, url: started.url, inspectorUrl: started.inspectorUrl, done: false });

      setBusy("Building…");
      const follow = (onState: (s: DeployState) => void) =>
        project?.id ? followDeployment(project.id, { id: started.id, team: started.team }, onState) : watchDeploy(started.id, { team: started.team, onState });
      const end = await follow(
        (st) => {
          setLiveRun({ state: st.state, url: st.url, inspectorUrl: st.inspectorUrl ?? started.inspectorUrl, done: st.done, message: st.message });
          setBusy(st.state === "BUILDING" ? "Building…" : st.state === "QUEUED" ? "Queued…" : st.state === null ? "Waiting for Vercel to say…" : "Finishing…");
        },
      );
      if (end.state === "READY" && end.url) {
        useStudio.getState().noteThread([`Live on Vercel at ${end.url.replace(/^https:\/\//, "")}`]);
        ctx.publish({ key: "studio:live", title: "The site is live", body: end.url, level: "success", source: "studio", toast: true, href: end.url });
      } else {
        const ended = end.state ? end.state.toLowerCase() : "ended without a state";
        useStudio.getState().noteThread([`The Vercel build ${ended}`]);
        ctx.publish({ key: "studio:live", title: `The build ${ended}`, body: end.message ?? "The Vercel log says why.", level: "error", source: "studio", toast: true, href: end.inspectorUrl ?? undefined });
      }
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    for (const f of await everything()) download(f.content, f.path.split("/").pop() ?? f.path, "text/plain");
  };

  const current = MODES.find((m) => m.value === mode)!;
  const github = pub?.github;

  /* ---------------------------------------------------------------- */
  /* The parts of the book, arranged differently in each shape         */
  /* ---------------------------------------------------------------- */

  const idea = (
    <label className="flex flex-col gap-1">
      <Label>What this should be</Label>
      <Textarea
        autoGrow
        rows={2}
        aria-label="Master prompt"
        placeholder="Say what you want this to be, everything on the board is the context"
        value={master}
        onChange={(e) => useStudio.getState().setBrief({ master: e.target.value })}
      />
    </label>
  );

  const ask = (
    <Card title="Ask Claude" note={current.blurb}>
      <div data-brief-modes="" className="flex flex-col gap-1.5">
        <Segmented
          size="xs"
          value={mode}
          onChange={(v) => setMode(v as AskMode)}
          options={MODES.map((m) => ({ value: m.value, label: m.label }))}
          aria-label="What Claude should do"
          className="w-full"
        />
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
          <span className="min-w-0 flex-1 text-plain leading-snug text-fg-muted">
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
            <span className="self-center text-small text-fg-faint">{result?.pictures ? `${result.pictures} sent with the last ask` : "taken for the last ask"}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
          {busy ? (
            <>
              <span className="mr-auto flex items-center gap-1.5 text-plain text-accent"><Loader2 className="size-3.5 animate-spin" /> {busy}</span>
              <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}><X /> Stop</Button>
            </>
          ) : null}
          <Button variant="primary" size="sm" loading={!!busy} disabled={mode === "ask" && !prompt.trim()} onClick={() => void generate()}>
            <Sparkles />
            {current.verb}
          </Button>
        </div>
      </div>
    </Card>
  );

  /*
   * The counts — except where they have already been said.
   *
   * The dialog carries pages, elements and prompted in its subtitle, two
   * inches above this, and printing the same three numbers twice on one
   * screen is the thing the news feed has a whole rule about. The panel and
   * the page have no subtitle, so there they are the only place.
   */
  const said = layout === "dialog";
  /** The make-real queue: what the counter on the toolbar is counting. */
  const queued = queue.length ? (
    <Card
      title={`Making real · ${pendingJobs(queue).length} pending, ${doneJobs(queue).length} done`}
      note="Drawings are read one at a time so the board is never held; each one that lands is a thread below."
      right={pendingJobs(queue).length ? null : <Button variant="ghost" size="xs" onClick={() => useStudio.getState().clearFinishedJobs()}>Clear</Button>}
    >
      <QueueList />
    </Card>
  ) : null;

  const stats = (
    <div className="flex flex-wrap gap-1">
      {said ? null : <Badge size="sm" variant="accent">{spec.stats.pages} pages</Badge>}
      {said ? null : <Badge size="sm">{spec.stats.elements} elements</Badge>}
      {spec.stats.groups ? <Badge size="sm">{spec.stats.groups} groups</Badge> : null}
      {spec.stats.connections ? <Badge size="sm">{spec.stats.connections} connections</Badge> : null}
      {spec.stats.sketches ? <Badge size="sm">{spec.stats.sketches} sketches</Badge> : null}
      {said ? null : <Badge size="sm" variant={spec.stats.prompted ? "up" : "warn"}>{spec.stats.prompted} prompted</Badge>}
    </div>
  );

  const banner = note ? (
    <div data-brief-note="" role="status" className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-plain leading-snug text-fg shadow-pop">
      <Wand2 className="mt-0.5 size-3.5 shrink-0 text-warn" />
      <span>{note}</span>
    </div>
  ) : null;

  /** One text of the book — the brief, the JSON, an answer — as its own card. */
  const text = (label: string, what: string, filename: string, type: string, height: string) => (
    <Card
      title={label}
      right={
        <>
          <Button variant="ghost" size="xs" onClick={() => void ctx.copy(what, label.toLowerCase())}><Copy className="size-3" /> Copy</Button>
          <Button variant="ghost" size="xs" onClick={() => download(what, filename, type)} aria-label={`Download ${label}`}><Download className="size-3" /></Button>
        </>
      }
    >
      <pre className={cn("overflow-auto whitespace-pre-wrap rounded-md p-2.5 font-mono text-plain leading-relaxed", height)} style={{ ...screenFace, color: SCREEN.ink }}>
        {what || "Nothing on the board yet."}
      </pre>
    </Card>
  );

  const filesCard = files.length ? (
    <Card title={`Files (${files.length})`} right={<Button variant="ghost" size="xs" onClick={downloadAll}><Download className="size-3" /> All</Button>}>
      <ul className="max-h-[40vh] divide-y divide-border overflow-auto rounded-md border border-border bg-elevated">
        {files.map((f) => (
          <li key={f.path}>
            <button type="button" onClick={() => setOpenFile(openFile === f.path ? null : f.path)} className="tactile flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-hover">
              <span className="num min-w-0 flex-1 truncate font-mono text-plain text-fg">{f.path}</span>
              <span className="num text-small text-fg-faint">{fmtBytes(f.content.length)}</span>
              <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); void ctx.copy(f.content, f.path); }}>Copy</Button>
            </button>
            {openFile === f.path ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border bg-panel p-3 font-mono text-[10.5px] leading-relaxed text-fg-muted">{f.content}</pre> : null}
          </li>
        ))}
      </ul>
    </Card>
  ) : null;

  const publishCard = (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <GitBranch className="size-3.5 text-fg-muted" /> Publish
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
            <Badge size="sm" variant="info">Vercel: {live.source === "server" ? "the server’s token" : "your token"}</Badge>
          ) : pub?.vercel.hook ? (
            <Badge size="sm" variant="info">Vercel hook set</Badge>
          ) : null}
        </span>
      }
      note={`${publishFiles.length} files: the site's document with its prompts and capture taken out, ${files.length ? `and ${files.length} generated` : "no generated code yet"}, and the pages when it goes up. The blueprint stays here. What this does is written on the live thread's card.`}
    >
      <div data-brief-publish="" className="flex flex-col gap-1.5">
        <LeftBehind />
        <div className="flex flex-wrap items-center gap-2">
          <Input inputSize="sm" value={pubMessage} onChange={(e) => setPubMessage(e.target.value)} placeholder="Commit message" className="min-w-40 flex-1" disabled={!!busy} />
          {pub?.vercel.hook ? (
            <label className="flex items-center gap-1.5 text-plain text-fg-muted">
              <Switch size="sm" checked={pubDeploy} onCheckedChange={setPubDeploy} /> deploy
            </label>
          ) : null}
          <Button variant="outline" size="sm" disabled={!!busy || !github?.configured} onClick={() => void doPublish()}>
            <GitBranch /> Push to GitHub
          </Button>
          <Tooltip content={
            live?.configured
              ? "Push the files, build the site on Vercel, and hand back the address."
              : "Needs a Vercel token: put one in the keys panel (⌘⇧K) or set VERCEL_TOKEN on the server."
          }>
            <span>
              <Button variant="primary" size="sm" disabled={!!busy || !github?.configured || !live?.configured} onClick={() => void goLive()}>
                <Globe /> Go live
              </Button>
            </span>
          </Tooltip>
        </div>
        {liveRun ? (
          <p className={cn("flex flex-wrap items-center gap-1.5 text-plain", liveRun.state === "READY" ? "text-up" : liveRun.state === "ERROR" || liveRun.state === "CANCELED" ? "text-down" : "text-fg-muted")}>
            {liveRun.done ? liveRun.state === "READY" ? <Check className="size-3" /> : <X className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
            {liveRun.state === "READY" ? "Live at" : liveRun.state === "ERROR" ? "The build failed." : liveRun.state === "CANCELED" ? "The build was cancelled." : liveRun.state ? `${liveRun.state.toLowerCase()}…` : "waiting for Vercel to say…"}
            {liveRun.state === "READY" && liveRun.url ? (
              <a data-live-address="" className="underline underline-offset-2" href={liveRun.url} target="_blank" rel="noopener noreferrer">
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
        {/* WHERE IT LIVES, from the last time it went live, on every later
            visit and after a plain push: a connected project deploys each
            push to the same address. */}
        {liveAt && liveRun?.state !== "READY" ? (
          <p className="flex flex-wrap items-center gap-1.5 text-plain text-fg-muted">
            <Globe className="size-3" /> Live at
            <a data-live-address="" className="underline underline-offset-2 text-fg" href={liveAt} target="_blank" rel="noopener noreferrer">
              {liveAt.replace(/^https:\/\//, "")} <ExternalLink className="inline size-3" />
            </a>
          </p>
        ) : null}
        {pubResult ? (
          <p className="flex flex-wrap items-center gap-1.5 text-plain text-up">
            <Check className="size-3" /> {pubResult.files} files committed.
            <a className="underline underline-offset-2" href={pubResult.url} target="_blank" rel="noopener noreferrer">Open the commit <ExternalLink className="inline size-3" /></a>
            {pubResult.deployed ? <span>· Vercel deploy started</span> : pubResult.hook ? <span className="text-warn">· {pubResult.note ?? "the deploy hook was not called"}</span> : <span className="text-fg-faint">· a connected Vercel project deploys on its own</span>}
          </p>
        ) : null}
      </div>
    </Card>
  );

  const foot = (
    <p className="flex items-center gap-1.5 text-small text-fg-faint">
      <FileJson className="size-3" />
      The brief is self-contained, it explains its own conventions, so any agent can act on it without this app.
    </p>
  );

  /** Pin: the same control in every shape, and the only way between them. */
  const pin = (
    <Tooltip content={bookPinned ? "Let the book be a dialog again" : "Keep the book open beside the board"}>
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={bookPinned}
        onClick={() => useStudio.getState().setBookPinned(!bookPinned)}
        aria-label={bookPinned ? "Unpin the book" : "Pin the book open"}
      >
        {bookPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
        {bookPinned ? "Unpin" : "Pin open"}
      </Button>
    </Tooltip>
  );

  /* ---------------------------------------------------------------- */
  /* The page: everything at once, the trail with the room it needs    */
  /* ---------------------------------------------------------------- */

  if (page) {
    return (
      <div data-iteration-book="" className="flex h-full min-h-0 w-full gap-3 overflow-hidden p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
          {banner}
          <Card title="The idea" note="Everything on the board is the context; this is what it is all for.">{idea}</Card>
          {ask}
          {queued}
          <PinnedThreads />
          {/*
            No trail here: the page's timeline is above this, and drawing
            the same history twice on one screen is the wall this replaced.
            The dialog and the panel keep their Trail tab, there is no
            timeline over those.
          */}
          {result ? text(`The answer · ${MODES.find((m) => m.value === result.mode)?.label} · ${result.model ?? "Claude"}`, result.text, "response.md", "text/markdown", "max-h-[50vh]") : null}
          {filesCard}
        </div>
        <aside className="hidden w-[420px] shrink-0 flex-col gap-3 overflow-y-auto lg:flex">
          <Card
            title="The book of updates"
            note="The brief, the JSON and the trail are one page: the last thread is read while the next ask is written."
            right={pin}
          >
            <div className="flex flex-wrap items-center gap-1">{stats}</div>
          </Card>
          {text("The brief", markdown, "brief.md", "text/markdown", "max-h-[42vh]")}
          {text("The JSON", json, "blueprint.json", "application/json", "max-h-[30vh]")}
          {publishCard}
          {foot}
        </aside>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Over the board, or pinned beside it                               */
  /* ---------------------------------------------------------------- */

  const stackedBody = (
    <div className="flex flex-col gap-2">
      {layout === "panel" ? (
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <BookOpen className="size-3.5 text-accent" />
          <h2 className="flex-1 text-sm font-semibold text-fg">The book of updates</h2>
          {pin}
          <Button variant="ghost" size="iconXs" aria-label="Close the book" onClick={onClose}><X /></Button>
        </div>
      ) : null}
      {idea}
      {ask}
      {queued}
      <PinnedThreads />

      <div data-brief-views="" className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex flex-wrap items-center gap-2">
          {layout === "dialog" ? pin : null}
          {stats}
        </div>
      </div>

      {banner}

      {view === "trail" ? (
        <div data-brief-body=""><ThreadTree /></div>
      ) : view === "files" ? (
        <div data-brief-body="">{filesCard}</div>
      ) : (
        <pre
          data-brief-body=""
          // A screen, like every other surface in this app where words are
          // read or typed: the same glass, scanlines and phosphor as the
          // palette's field and the plate's prompt.
          className={cn("max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md p-3 font-mono text-plain leading-relaxed", busy && "opacity-60")}
          style={{ ...screenFace, color: SCREEN.ink }}
        >
          {body || "Nothing on the board yet."}
        </pre>
      )}
      {result && view === "result" ? (
        <p className="text-small text-fg-faint">
          {MODES.find((m) => m.value === result.mode)?.label} · {result.model ?? "Claude"} · {result.pictures ? `${result.pictures} picture${result.pictures === 1 ? "" : "s"} seen` : "words only"}{result.dropped ? ` · ${result.dropped} left out: ${result.droppedWhy}` : ""}
        </p>
      ) : null}

    </div>
  );

  /*
   * What stays put.
   *
   * Publish, the note under it and the two ways out are not reading matter,
   * so they do not scroll with it: the book's middle scrolls under them.
   * They used to be the last rows of one long column inside the scroller,
   * which put Publish half over the fold on open — a row sliced through the
   * middle by the dialog's own edge, with nothing to say there was more.
   */
  const stackedFoot = (
    <div className="flex flex-col gap-2">
      {publishCard}
      {foot}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
        <Button variant="ghost" size="sm" onClick={() => (view === "files" ? downloadAll() : download(view === "json" ? json : body, view === "json" ? "blueprint.json" : view === "result" ? "response.md" : view === "trail" ? "threads.md" : "brief.md", view === "json" ? "application/json" : "text/markdown"))}>
          <Download />
          {view === "files" ? "Download all" : "Download"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void ctx.copy(view === "files" ? publishFiles.map((f) => `# ${f.path}\n\n${f.content}`).join("\n\n") : body, view === "json" ? "blueprint JSON" : view === "result" ? "response" : view === "files" ? "files" : view === "trail" ? "prompt trail" : "brief")}>
          Copy {view === "json" ? "JSON" : view === "result" ? "response" : view === "files" ? "files" : view === "trail" ? "trail" : "brief"}
        </Button>
      </div>
    </div>
  );

  return layout === "panel" ? (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{stackedBody}</div>
      <div className="shrink-0 border-t border-border p-3 pt-2">{stackedFoot}</div>
    </div>
  ) : (
    <div className="flex max-h-[74vh] flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{stackedBody}</div>
      <div className="shrink-0 pr-0.5">{stackedFoot}</div>
    </div>
  );
}

export { filesFromMarkdown };
