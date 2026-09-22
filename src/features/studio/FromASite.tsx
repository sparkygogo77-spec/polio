"use client";
/**
 * From a site, or from a zip: point at something real and recreate it here.
 *
 * The way in for phase two, and it lives on the space's own panel because
 * a black hole is space not yet decided and recreating something real is
 * one way of deciding it.
 *
 * Two sources, one flow. **Read the page** opens an address in the browser
 * the server already has (`api/studio/element`); **a zip** is unpacked and
 * its page opened by the same browser with every request answered out of
 * the zip (`api/studio/zip`). Either way what comes back is a picture of
 * the page and a list of what is worth pointing at, and nothing has been
 * recreated or asked of a model at that stage.
 *
 * Then either one thing or the whole page. Pressing a candidate measures
 * it exactly and turns the measurements into a real library part
 * (`recreate.ts`), which lands in this space and is an ordinary node from
 * that moment. **Take the whole page** does that for every block the page
 * is made of, lays them on the surface in the proportion they had, and
 * locks the layout, so a page somebody else made arrives the way a page
 * drawn here does: as parts, in a surface, movable and promptable. The
 * line it ends with says which blocks reached that bar and which arrived
 * as something less, because the difference is the point.
 *
 * **The deadline is at both ends.** The routes answer themselves inside
 * their own budgets; this keeps a longer one of its own for the case where
 * nothing arrives at all, and the spinner always stops with a sentence.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { FileArchive, GitBranch, LayoutTemplate, Loader2, Search, X, Globe } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { cn } from "@/core/lib/cn";
import { SCREEN, VOID, screenFace } from "@/core/ui/void";
import { Input } from "@/core/ui/input";
import { SCREEN_FIELD } from "./PlateEditors";
import { recreateFrom, type ElementReading } from "./recreate";
import { facesSays, genericsOf, genericSays, type FacesCarried } from "./fonts";
import { categoryFor, noPageSays, pageAddress, readRepo, repoName, REPO_REFUSAL_SAYS, thinSays, type Repo } from "./repoImport";
import { isCopy, readRepoSite, refused, type RepoCopy } from "./repoRun";
import { keep } from "./pictures";
import { activeProject, repoFrom, useBuilds } from "@/features/builds/store";
import { heldKeys } from "@/features/keys/store";
import { allowed, READ_DEADLINE_MS } from "./siteFetch";
import { boundaryBox, centroid, type Space } from "./space";
import { useStudio, type StudioNode } from "./store";
import { lockNow } from "./surfaceRun";
import { drawnOnBoard, tidyToWords } from "./textFit";
import { fine, fitToSurface, mergeReadings, offered, pageBlocks, saidOf, scaledType, selectorsOf, type Block } from "./zipImport";

type Source =
  /* A site read at its address. `repo` is set when the address stood in
     for a repository of sources, so what lands goes into that
     repository's own category exactly as its files would have. */
  | { kind: "site"; url: string; host: string; repo?: Repo; read?: { why: "site" | "root"; isMadeHere: boolean } }
  | { kind: "zip"; file: File; name: string; entry: string }
  /* A repository is a zip once it is here: its files were fetched by this
     browser with his own token and packed on the way in, so everything
     past that point is the zip path, unchanged. What it keeps beyond a
     zip is which repository it was, because its elements go into a
     category named after it. */
  | { kind: "repo"; repo: Repo; file: File; name: string; entry: string };

type Picking = { at: "picking"; source: Source; page: { width: number; height: number; shot: string }; candidates: Block[]; scripts: boolean };
type Stage =
  | { at: "nothing" }
  | { at: "busy"; says: string }
  | Picking
  | { at: "said"; says: string };

/** Ask a route, with a deadline of our own and a sentence for every ending. */
async function ask(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), READ_DEADLINE_MS);
  try {
    const res = await fetch(url, { ...init, signal: stop.signal });
    // A gateway's own error page is not JSON. Read it as the status it is.
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, message: `The server answered ${res.status} rather than an answer.` };
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, message: aborted ? `Nothing came back within ${Math.round(READ_DEADLINE_MS / 1000)} seconds.` : "The page could not be reached from here." };
  } finally {
    clearTimeout(timer);
  }
}

const askSite = (body: Record<string, unknown>) =>
  ask("/api/studio/element", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** The zip goes with every call: the route keeps nothing between them. */
const askZip = (file: File, extra: Record<string, string> = {}) => {
  const form = new FormData();
  form.set("zip", file, file.name);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return ask("/api/studio/zip", { method: "POST", body: form });
};

const nameOf = (s: Source) => (s.kind === "site" ? (s.repo ? repoName(s.repo) : s.host.replace(/^www\./, "")) : s.name);
/** The repository a source stands for, whether its files or its address were read. */
const repoOf = (s: Source): Repo | null => (s.kind === "repo" ? s.repo : s.kind === "site" ? (s.repo ?? null) : null);

/**
 * Where this Builder itself put that repository, if it did.
 *
 * A site published from here records the address it went live at, beside
 * the repository it went to. Bringing that repository back in, this
 * Builder's own included, reads the page there when GitHub's About line
 * does not say.
 */
function deployedBy(r: Repo): string | null {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return useBuilds.getState().projects.find((p) => p.repo && same(p.repo.owner, r.owner) && same(p.repo.name, r.name) && p.live?.url)?.live?.url ?? null;
}

/*
 * THE STAGE LIVES OUTSIDE THE PANEL, keyed by the space it belongs to.
 *
 * It was component state, and component state dies with the component:
 * anything that re-mounts this panel mid-import, a pick, a re-fit, a
 * layout change, threw away the line that said what was happening, and
 * the import ended in silence on a panel that read "nothing in it yet".
 * Kept here, the line is there whenever the panel is, and the same line
 * is what the toast from the board says.
 */
const NOTHING: Stage = { at: "nothing" };
const STAGES = new Map<string, Stage>();
const stageListeners = new Set<() => void>();
const stageOf = (spaceId: string): Stage => STAGES.get(spaceId) ?? NOTHING;
/** The most recent import anywhere on the board, for the strip that is never hidden. */
let latest: { spaceId: string; stage: Stage; when: number } | null = null;
const putStage = (spaceId: string, stage: Stage) => {
  STAGES.set(spaceId, stage);
  latest = stage.at === "nothing" ? (latest?.spaceId === spaceId ? null : latest) : { spaceId, stage, when: Date.now() };
  for (const l of stageListeners) l();
};
const subscribeStages = (l: () => void) => { stageListeners.add(l); return () => { stageListeners.delete(l); }; };
/**
 * A NEW PRESS CLEARS THE STRIP. Driven by hand: the strip kept the previous
 * press's line, naming the wrong repository, through the whole of the next
 * press, which read as silence. Every Bring it starts from a clear strip.
 */
export function clearImportLine(): void {
  latest = null;
  for (const l of stageListeners) l();
}
/** How long one step may go without a word before the import is told to stop and say so. */
const STEP_PATIENCE_MS = 90_000;

/**
 * THE IMPORT'S LINE, WHERE IT CANNOT BE HIDDEN.
 *
 * Driven by hand, three times: a repository brought in, a space named
 * after it, and "nothing". Reproduced: the ending fired within a second,
 * the no-page refusal, and sat in this panel's import section, which the
 * space's aside keeps below its fold on a short window, 736 pixels down
 * in a 640 pixel one, with nothing saying to scroll. With toasts off, that
 * was every word there was. So the latest import's line is drawn here
 * too, across the top of the board, in the same words, until he dismisses
 * it or starts another.
 */
export function ImportStrip() {
  const it = React.useSyncExternalStore(subscribeStages, () => latest, () => null);
  if (!it || it.stage.at === "nothing" || it.stage.at === "picking") return null;
  const busyNow = it.stage.at === "busy";
  const says = it.stage.says;
  const refused = /^[\w.-]+\/[\w.-]+: /.test(says) && !busyNow && !/landed|carried|copied|real parts|arrived/.test(says);
  return (
    <div
      data-import-strip={busyNow ? "busy" : refused ? "refused" : "done"}
      role="status"
      className="flex shrink-0 items-start gap-2 border-b px-3 py-1.5 text-plain"
      style={{ borderColor: refused ? "oklch(0.72 0.17 18 / 0.6)" : VOID.rim, background: refused ? "oklch(0.72 0.17 18 / 0.08)" : VOID.box, color: VOID.text }}
    >
      {busyNow ? <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin" /> : null}
      <span className="min-w-0 flex-1">{says}</span>
      {!busyNow ? (
        <button type="button" data-import-strip-dismiss="" aria-label="Dismiss" onClick={() => putStage(it.spaceId, NOTHING)} className="tactile shrink-0 rounded px-1" style={{ color: VOID.muted }}>
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export function FromASite({ space }: { space: Space }) {
  const [url, setUrl] = React.useState("");
  const [repoText, setRepoText] = React.useState("");
  const stage = React.useSyncExternalStore(subscribeStages, () => stageOf(space.id), () => NOTHING);
  const setStage = React.useCallback((next: Stage) => putStage(space.id, next), [space.id]);
  /* Which repository is being brought in, so a busy line can also be a
     toast from the board, and a step that goes quiet can be ended by name. */
  const bringing = React.useRef<Repo | null>(null);
  const patience = React.useRef<number | null>(null);
  const gate = url.trim() ? allowed(url) : null;
  const repo = repoText.trim() ? readRepo(repoText) : null;
  const working = stage.at === "busy";

  /**
   * A repository, brought in whole.
   *
   * The files are fetched here, by this browser, with his own token —
   * nothing about the token reaches our server — packed into a zip on the
   * way in, and handed to the route that already opens zips. From that
   * line down it is the zip path exactly, which is why this is short.
   */
  /*
   * A repository handed over by the GitHub control.
   *
   * That control makes the surface and names the repository; this picks it
   * up, fills the box in and starts, so pressing "Bring it" up there is the
   * whole gesture rather than the first half of one. Cleared as it is taken,
   * because it is a handover and not a setting: opening this panel again
   * must not re-import anything.
   */
  const handed = useStudio((st) => st.bringRepo);
  React.useEffect(() => {
    if (!handed || handed.space !== space.id) return;
    /*
     * NO TIMER, AND NO CLEANUP. This used to put the read on a 0ms timer
     * "after the paint", and return a cleanup that cleared the timer. But
     * the first thing it does is set `bringRepo` to null — which is its own
     * dependency — so React ran the cleanup for the previous pass before the
     * timer had fired, and the read was cancelled by the effect that asked
     * for it. Measured: panel on screen, box filled, 0 requests, nothing
     * said. The repository is passed by value now, so there is nothing to
     * wait for: it runs at once.
     */
    const r = readRepo(handed.repo);
    useStudio.getState().setBringRepo(null);
    setRepoText(handed.repo);
    /* An exception anywhere in the read is an ending too, said by name. */
    void readRepository(r).catch((err: unknown) => refuse(`stopped before it could finish: ${err instanceof Error ? err.message : String(err)}`, r));
  }, [handed, space.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * A REFUSAL IS NEVER INVISIBLE. Whatever the reason this declines, it says
   * which repository, why, and what he can do instead — on this panel, and
   * as a toast, because this panel is inside a space and a refusal that only
   * shows where nobody is looking is the same as doing nothing. The refusal
   * texts already carry the "instead" (add a key, bring the deployed address
   * in); the repository's name is put in front so the line stands alone.
   */
  const ctx = useActions();
  /**
   * EVERY STEP IS SAID, ON THE PANEL AND FROM THE BOARD.
   *
   * Driven by hand: a repository was brought in, a space appeared, and for
   * twenty seconds nothing was said anywhere while a page was being read.
   * A busy line on a narrow aside is not enough; the same line is a toast
   * now, updated in place as the steps go by. And a step that says nothing
   * for `STEP_PATIENCE_MS` is ended, by name, rather than left spinning.
   */
  const busy = (says: string) => {
    setStage({ at: "busy", says });
    const of = bringing.current;
    if (of) ctx.publish({ key: `studio:repo:${of.name}`, title: `${repoName(of)}: ${says}`, level: "info", source: "studio", toast: { durationMs: STEP_PATIENCE_MS } });
    if (patience.current) window.clearTimeout(patience.current);
    patience.current = window.setTimeout(() => {
      const now = stageOf(space.id);
      if (now.at !== "busy" || now.says !== says) return;
      /* A later press owns the strip now: this one's silence is not news. */
      if (latest && latest.spaceId !== space.id) return;
      const line = `Nothing came back within ${Math.round(STEP_PATIENCE_MS / 1000)} seconds while: ${says.replace(/…$/, "")}. Stopped.`;
      if (of) refuse(line, of); else setStage({ at: "said", says: line });
    }, STEP_PATIENCE_MS);
  };
  const refuse = (says: string, of?: Repo | null) => {
    const which = of ?? repo;
    const line = `${which ? repoName(which) : "That repository"}: ${says}`;
    setStage({ at: "said", says: line });
    /* Long enough to read: a refusal that leaves in under two seconds,
       while the panel it also sits on is a narrow aside he may not have
       open, is the same as no refusal. */
    ctx.publish({ key: `studio:repo:${which?.name ?? "?"}`, title: "Could not bring the repository in", body: line, level: "error", source: "studio", toast: { durationMs: 9000 } });
    play("deny");
  };

  /*
   * TAKES THE REPOSITORY IT IS GIVEN, and only falls back to the one in the
   * box. The hand-off from the GitHub panel put the name in the box and
   * called this on a 0ms timer — before the box's state had committed — so
   * `repo` was still null, this returned on its first line, and the import
   * silently did not happen even once the panel was on screen. Measured:
   * panel mounted, 0 requests, nothing said. A function that reads its
   * input from state it has just set is a function that runs once too early.
   */
  const readRepository = async (given?: Repo | null) => {
    const r = given ?? repo;
    if (!r) return;
    bringing.current = r;
    play("tick");
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (!token) { refuse(REPO_REFUSAL_SAYS["no-token"], r); return; }
    busy(`Opening ${repoName(r)}…`);
    const got = await readRepoSite(r, token, (says) => busy(says));
    if (isCopy(got)) { copySite(got, r); return; }
    if (refused(got)) {
      /*
       * SOURCES ARE READ AT THE ADDRESS THEY ARE DEPLOYED AT.
       *
       * He brought this Builder's own repository in and expected its page
       * to land, editable. Its files are sources with no page in them, and
       * the answer used to be a sentence telling him to type the deployed
       * address instead: a thing the software can do itself. So a
       * repository with no page falls through to the address GitHub's About
       * line names, or to the address this Builder published that same
       * repository to, and comes in from there as the page a visitor sees.
       * Only with no address anywhere does it say so and stop.
       */
      /* Its PAGE, not its root: a site made here keeps its page at /site of
         wherever it is deployed, and the root there is the Builder's own
         front. The same rule is applied to the address this Builder itself
         published the repository to. */
      const made = got.no === "no-page" && !!got.madeHere;
      const mine = got.no === "no-page" ? pageAddress(deployedBy(r), made).at : null;
      const at = got.no === "no-page" ? [got.pageAt, mine].map((a) => (a ? allowed(a) : null)).find((a) => a?.ok) : null;
      if (!at?.ok) { refuse(got.says, r); return; }
      busy(noPageSays(r, [], at.url, made));
      const read = await askSite({ url: at.url });
      if (!read.ok) { refuse(`${noPageSays(r, [], at.url, made)} That page could not be read: ${String(read.message ?? "no answer")}`, r); return; }
      await landWhole({
        at: "picking",
        source: { kind: "site", url: String(read.url), host: String(read.host), repo: r, read: { why: made ? "site" : "root", isMadeHere: made } },
        page: read.page as { width: number; height: number; shot: string },
        candidates: (read.candidates as Block[]) ?? [],
        scripts: false,
      });
      return;
    }
    /* A page built from source says so, and what the reading did: which parts opened, which stayed closed on a first view. */
    if (got.source) {
      const n = got.source.notes;
      const opened = [...new Set(n.opened)];
      busy(`From its source, ${got.source.page}: ${n.bands.length} bands${opened.length ? `, opened ${opened.join(", ")}` : ""}${n.closed.length ? `; ${[...new Set(n.closed)].join(", ")} closed on a first view` : ""}.`);
    } else busy(`Reading the page in ${r.name}…`);
    const zr = await askZip(got.file);
    if (!zr.ok) { refuse(String(zr.message ?? "The page in that repository could not be read."), r); return; }
    await landWhole({
      at: "picking",
      source: { kind: "repo", repo: { ...r, ref: got.ref }, file: got.file, name: repoName({ ...r, ref: got.ref }), entry: got.source?.page ?? String(zr.entry) },
      page: zr.page as { width: number; height: number; shot: string },
      candidates: (zr.candidates as Block[]) ?? [],
      scripts: !!zr.scripts,
    });
  };

  /*
   * A SITE MADE HERE BECOMES A NEW SITE, WHOLE.
   *
   * HIS WORDS: he wants the site imported with what can be copied exactly.
   * For a site made here, everything can: the document in the repository
   * is the site, so it is loaded as a new site in the switcher, named from
   * its brief, every part where it was with its colour, its type, its
   * motion and its prompt, and connected to the repository it came from so
   * the next edit opens a branch there. Its pictures are put into this
   * browser's file storage under the ids the parts already name. The space
   * this panel was opened on is taken away again: nothing landed in it,
   * and it belongs to the site he was on, not the one he is now.
   */
  /*
   * AN IMPORT REPLACES WHAT IS ON THE PAGE. HIS WORDS: "polio would at
   * least be somewhat imported into my site but it never changes". A copy
   * used to open a second site and leave the one he was on as it was,
   * which read as nothing happening. It replaces this site now: the
   * document becomes the repository's, whole, the site takes its name and
   * its repository, and one undo brings the old board back.
   */
  const copySite = (copy: RepoCopy, of: Repo) => {
    const st = useStudio.getState();
    /* Every space goes, not only the one made for the hand-off: the
       document loaded next carries none of its own, and a space left from
       an earlier import would sit on the copied site as a hole. */
    st.removeSpaces(st.spaces.map((sp) => sp.id));
    const builds = useBuilds.getState();
    const here = activeProject();
    if (!here) { builds.adopt(); }
    const id = activeProject()?.id ?? null;
    useStudio.getState().loadDoc(copy.document as Parameters<typeof st.loadDoc>[0]);
    const repo = repoFrom(`${of.owner}/${of.name}`, copy.ref);
    /* Brought in from it: the site is bound to this repository, and the
       repository belongs to this site from now on. */
    if (id && repo) builds.setRepo(id, repo, "import");
    if (id && copy.name) builds.rename(id, copy.name);
    void (async () => {
      let kept = 0;
      for (const p of copy.pictures) {
        try { await keep({ id: p.id, path: p.path, type: p.type, w: 0, h: 0, bytes: p.bytes.length, alt: "", from: "upload" }, new Blob([p.bytes as BlobPart], { type: p.type })); kept++; } catch { /* named below by count */ }
      }
      const behind = copy.pictures.length - kept + copy.lost.length;
      const parts = `${copy.parts} part${copy.parts === 1 ? "" : "s"} on ${copy.pages} page${copy.pages === 1 ? "" : "s"}`;
      ctx.publish({
        key: `studio:repo:${of.name}`,
        title: `This site is ${copy.name} now, copied whole from ${repoName(of)}`,
        body: `${parts}, every position, colour, motion and prompt as published${kept ? `, and ${kept} picture${kept === 1 ? "" : "s"}` : ""}. Connected to ${of.owner}/${of.name} on ${copy.ref}: the next edit opens a branch there.${behind ? ` ${behind} picture${behind === 1 ? " is" : "s are"} named by the site but not in the repository, and ${behind === 1 ? "says" : "say"} so on the board.` : ""}`,
        level: behind ? "warn" : "success",
        source: "studio",
        toast: { durationMs: 10000 },
      });
      /* THE COPY ENDS ITS OWN STAGE. It did not: the space was gone, the
         stage stayed "busy", and ninety seconds later the patience rule
         ended a step that had long finished, with a refusal on the strip
         naming this repository under whatever came next. */
      if (patience.current) { window.clearTimeout(patience.current); patience.current = null; }
      setStage({ at: "said", says: `${repoName(of)}: this site is ${copy.name} now, copied whole: ${parts}.${behind ? ` ${behind} picture${behind === 1 ? " is" : "s are"} named by the site but not in the repository.` : ""}` });
      play("confirm");
    })();
  };

  /*
   * BRINGING A REPOSITORY IN IS THE WHOLE GESTURE, not the first half of one.
   *
   * Driven by hand on the live site: Bring it read the repository, fell
   * through to the address it is deployed at, opened the page there, and
   * then stood at the picking stage on this panel waiting for "Take the
   * whole page", which he had no reason to know about. What he saw was
   * nothing on the board, no refusal and no question. A repository named
   * on the GitHub control is a page asked for whole, so it is taken whole
   * here, and the panel is left saying what landed. A page read by its
   * address or a zip opened by hand still offers the choice, because those
   * were pointed at one thing as often as at the whole.
   */
  const landWhole = async (picking: Picking) => {
    /* Straight to the landing, never through the picking stage: showing
       that stage renders its controls, and a render is no place to find
       out a page's candidates are unusable. The landing says every
       ending itself. */
    await takeAll(picking);
  };

  const read = async () => {
    if (!gate?.ok) return;
    play("tick");
    busy("Opening the page…");
    const r = await askSite({ url: gate.url });
    if (!r.ok) { setStage({ at: "said", says: String(r.message ?? "That page could not be read.") }); return; }
    setStage({
      at: "picking",
      source: { kind: "site", url: String(r.url), host: String(r.host) },
      page: r.page as { width: number; height: number; shot: string },
      candidates: (r.candidates as Block[]) ?? [],
      scripts: false,
    });
  };

  const readZip = async (file: File | null) => {
    if (!file) return;
    play("tick");
    busy(`Opening ${file.name}…`);
    const r = await askZip(file);
    if (!r.ok) { setStage({ at: "said", says: String(r.message ?? "That zip could not be read.") }); return; }
    setStage({
      at: "picking",
      source: { kind: "zip", file, name: String(r.name), entry: String(r.entry) },
      page: r.page as { width: number; height: number; shot: string },
      candidates: (r.candidates as Block[]) ?? [],
      scripts: !!r.scripts,
    });
  };

  /** Those elements, measured in full, from whichever source the page came. */
  const measure = async (source: Source, selectors: string[]): Promise<{ readings: ElementReading[]; width: number; faces: FacesCarried } | string> => {
    const r = source.kind === "site"
      ? await askSite({ url: source.url, selectors })
      : await askZip(source.file, { selectors: JSON.stringify(selectors) });
    if (!r.ok || !Array.isArray(r.readings)) return String(r.message ?? "That could not be measured.");
    const page = r.page as { width: number } | undefined;
    const faces = (r.faces && typeof r.faces === "object" && Array.isArray((r.faces as FacesCarried).fonts) ? r.faces : { fonts: [], named: [] }) as FacesCarried;
    return { readings: r.readings as ElementReading[], width: page?.width ?? 1280, faces };
  };

  /**
   * The faces a page came with go into the site's look, beside the
   * textures, one entry per face and weight; a face brought twice is one
   * entry, the newer reading winning. What could not be carried is kept
   * too, with its reason, so the board can say why a part is not drawing
   * in the face its node names.
   */
  const carry = (faces: FacesCarried) => {
    if (!faces.fonts.length) return;
    const had = useStudio.getState().look.fonts ?? [];
    const ids = new Set(faces.fonts.map((f) => f.id));
    useStudio.getState().setLook({ fonts: [...had.filter((f) => !ids.has(f.id)), ...faces.fonts] });
  };

  const take = async (c: Block) => {
    if (stage.at !== "picking") return;
    play("tick");
    const { source } = stage;
    busy("Measuring it…");
    // A block that is a run of small boxes is measured member by member
    // and read as one, the same as when the whole page is taken.
    const got = await measure(source, selectorsOf(c));
    if (typeof got === "string" || !got.readings[0]) { setStage({ at: "said", says: typeof got === "string" ? got : "That element is not on the page any more." }); return; }

    /*
     * Measured, and now a real part. Nothing was asked of a model to get
     * here: which part it becomes is decided off the measurements
     * (`recreate.ts`), and the words, the colours and the type are the
     * page's own.
     */
    const made = recreateFrom(mergeReadings(got.readings));
    carry(got.faces);
    const store = useStudio.getState();
    /*
     * Landed at the middle of the space, fitted to it, so it is inside it
     * and inherits the space's plan the way anything that lands inside
     * does. Fitted, because a list of sixteen links measured 841 tall
     * landed at its own size in a space 380 tall: the board clamped it to
     * the top of the page, its middle fell outside the line, and it was a
     * part with no space, no plan and no panel. It keeps its proportion
     * and takes at most nine tenths of the space either way.
     */
    const [cx, cy] = centroid(space.boundary);
    const room = boundaryBox(space.boundary);
    const w0 = Number(made.patch.w) || 320;
    const h0 = Number(made.patch.h) || 120;
    const fit = Math.min(1, (room.w * 0.9) / w0, (room.h * 0.9) / h0);
    const w = Math.max(24, fine(w0 * fit));
    const h = Math.max(16, fine(h0 * fit));
    store.addNode(String(made.patch.featureId), fine(cx - w / 2), fine(cy - h / 2), { ...made.patch, w, h, font: scaledType(made.patch.font, fit) });
    // Adding picks what was added, which would swap this panel for the
    // part's. The space stays picked, so the line under this is read where
    // it was asked for; the part is on the board, a press away.
    store.setSelection([space.id]);
    play("confirm");
    setStage({
      at: "said",
      says: `${made.did}. It is a part of the library now: change its words, its colour and its type like any other.${made.wantsPicture ? " Its picture stays a placeholder: this part has no picture of its own to show, and the grounded step runs on drawings only." : ""}${made.face && !made.face.drew && !got.faces.fonts.some((f) => f.carried && f.family.toLowerCase() === made.face?.name.toLowerCase()) ? ` It is set in ${made.face.name}, which did not travel with the page: the name is on the part, and it shows in the nearest face this machine has.` : ""}${facesSays(got.faces) ? ` ${facesSays(got.faces)}` : ""}${genericSays(genericsOf(got.readings.map((r) => r.type.family))) ? ` ${genericSays(genericsOf(got.readings.map((r) => r.type.family)))}` : ""}`,
    });
  };

  /**
   * The whole page: its blocks, measured, made into parts, and laid on
   * the surface in the proportion they had; then the layout locked, so
   * this surface is the page, the way a surface drawn here is its
   * drawing.
   */
  const takeAll = async (given?: Picking) => {
    const picked = given ?? stage;
    if (picked.at !== "picking") return;
    const { source, scripts } = picked;
    const blocks = pageBlocks(picked.candidates);
    /* Every ending of a repository's import is a toast as well as a line
       on this panel: this panel is a narrow aside, and the toast is what
       he sees from the board. A page the importer can find no blocks on
       is usually an app rather than a page of content, so that is said. */
    const of = repoOf(source);
    const tell = (says: string) => { if (of) refuse(says, of); else setStage({ at: "said", says }); };
    if (!blocks.length) { tell(`Nothing on the page in ${nameOf(source)} could be made into a part.${source.kind === "site" ? ` The page at ${source.url} may be an app rather than a page of content. Try the address of a published page instead.` : ""}`); return; }
    play("tick");
    busy(`Measuring ${blocks.length} block${blocks.length === 1 ? "" : "s"}…`);
    const got = await measure(source, blocks.flatMap(selectorsOf));
    if (typeof got === "string") { tell(got); return; }
    /* A block is one reading, or a run of small boxes read together and
       merged into one: the page's own sections, where the page gave them
       no box of their own. */
    const bySelector = new Map(got.readings.map((r) => [r.from.selector, r]));
    const readings = blocks
      .map((b) => selectorsOf(b).map((sel) => bySelector.get(sel)).filter((r): r is ElementReading => !!r))
      .filter((rs) => rs.length > 0)
      .map((rs) => mergeReadings(rs));
    if (!readings.length) { tell(`Nothing on the page in ${nameOf(source)} could be measured.`); return; }
    carry(got.faces);

    const store = useStudio.getState();
    /*
     * A REPOSITORY REPLACES THE PAGE. It used to land inside a space beside
     * whatever was already there, and with a page full of his own parts
     * that read as nothing happening. Everything on this page goes, the
     * space takes the whole width from the top, and the page comes in as
     * the page; one undo brings the old board back. A page read by its
     * address or a zip opened by hand still lands in the space it was
     * pointed at, because those were pointed at a place.
     */
    if (repoOf(source)) {
      const pageId = space.pageId;
      const others = store.spaces.filter((sp) => sp.pageId === pageId && sp.id !== space.id).map((sp) => sp.id);
      const gone = store.nodes.filter((n) => n.pageId === pageId).map((n) => n.id);
      if (gone.length) store.removeNodes(gone);
      if (others.length) useStudio.getState().removeSpaces(others);
      const fw = useStudio.getState().frameWidth || 1440;
      useStudio.getState().resizeSpace(space.id, { x: 0, y: 0, w: fw, h: Math.round(fw * 0.625) });
    }
    const live = useStudio.getState().spaces.find((sp) => sp.id === space.id) ?? space;
    const fit = fitToSurface(boundaryBox(live.boundary), got.width, readings.map((r) => r.box));
    // The surface takes the page's proportion at the width it was drawn.
    useStudio.getState().resizeSpace(space.id, fit.surface);
    const ids: string[] = [];
    const landed = readings.map((reading, i) => {
      const made = recreateFrom(reading);
      const at = fit.places[i]!;
      ids.push(useStudio.getState().addNode(String(made.patch.featureId), at.x, at.y, { ...made.patch, w: at.w, h: at.h, font: scaledType(made.patch.font, fit.scale) }));
      return made;
    });
    /*
     * THE PAGE FOLLOWS ITS OWN WORDS. A captured box carries the height the
     * page it came from measured, and the words need what they need here:
     * a box grows on screen already (the floor in `parts/primitives.tsx`),
     * and this writes those heights down and moves what is under them down
     * by the growth, so he is not extending every box by hand. His words:
     * the texts should follow each other based on full size.
     *
     * Not awaited: the import is finished, and the tidy lands a moment
     * later as one undo step of its own.
     */
    void tidyToWords(
      ids,
      (id) => { const n = useStudio.getState().nodes.find((x) => x.id === id); return n ? drawnOnBoard(n) : null; },
      (f) => useStudio.getState().fitToWords(f),
    );
    /*
     * A repository leaves its elements behind.
     *
     * That was the second half of the ask: "a new category specifically
     * for the elements this repo imports". Each block is kept as a preset
     * of the real part it became — the words, the colours, the type and
     * the layout measured off the page — in a category named after the
     * repository. They are in the shelf from this moment, droppable again
     * anywhere on the board, and they are saved with the site.
     */
    const from = repoOf(source);
    if (from) {
      const cat = categoryFor(from);
      const parts = landed.map((made, i) => {
        const at = fit.places[i]!;
        const patch = made.patch;
        return {
          id: `${cat.id}:${i + 1}`,
          categoryId: cat.id,
          label: String(patch.label ?? `Block ${i + 1}`),
          basedOn: String(patch.featureId),
          blurb: made.did,
          w: at.w,
          h: at.h,
          content: String(patch.content ?? ""),
          options: (patch.options ?? {}) as Record<string, string>,
          colour: (patch.colour ?? null) as StudioNode["colour"],
          font: scaledType(patch.font, fit.scale) as StudioNode["font"],
          prompt: String(patch.prompt ?? ""),
        };
      });
      useStudio.getState().bringIn(
        /* Read from its files: the zip and the page in it. Read at its
           address: that address, and the page is the address too. */
        { id: cat.id, label: cat.label, hue: cat.hue, from: source.kind === "site" ? source.url : source.name, page: source.kind === "site" ? source.url : source.entry, at: Date.now() },
        parts,
      );
    }
    /* A page brought in from a repository binds the site to it, when the
       site had none: the site is that repository's now. */
    if (from) {
      const here = activeProject();
      const bound = repoFrom(`${from.owner}/${from.name}`, from.ref ?? "main");
      const same = here?.repo && `${here.repo.owner}/${here.repo.name}`.toLowerCase() === `${from.owner}/${from.name}`.toLowerCase();
      if (here && bound && (!here.repo || same)) useBuilds.getState().setRepo(here.id, same ? here.repo : bound, "import");
    }
    // Locked as the page had it: the layout is the specification.
    lockNow(space.id);
    // Adding picks what was added, which would swap this panel for the
    // last part's. The space stays picked, so the line under this is read
    // where it was asked for, with the parts on the board beside it.
    useStudio.getState().setSelection([space.id]);
    play("confirm");
    /* Thin is said, with the better address when one is known. */
    const thin = thinSays(landed.length, source.kind === "site"
      ? { url: source.url, why: source.read?.why ?? "hand", isMadeHere: source.read?.isMadeHere ?? false }
      : { url: null, why: "none", isMadeHere: false });
    if (of) ctx.publish({ key: `studio:repo:${of.name}`, title: `${landed.length} block${landed.length === 1 ? "" : "s"} from ${repoName(of)} landed on the board`, body: `In the space named after it, and in the shelf under “${categoryFor(of).label}”.${thin}`, level: thin ? "warn" : "success", source: "studio", toast: { durationMs: thin ? 10000 : 7000 } });
    setStage({
      at: "said",
      says: `${saidOf(landed, nameOf(source), scripts)}${
        source.kind === "repo" && /\.(tsx|jsx)$/.test(source.entry)
          ? ` From its source, ${source.entry}: the page was built as a first view of the site, before anything is clicked or connected.`
          : ""
      }${
        from
          ? ` Its ${landed.length} element${landed.length === 1 ? " is" : "s are"} in the shelf now, under “${categoryFor(from).label}” — drop any of them anywhere, as many times as you like.`
          : ""
      }${thin}${facesSays(got.faces) ? ` ${facesSays(got.faces)}` : ""}${genericSays(genericsOf(readings.map((r) => r.type.family))) ? ` ${genericSays(genericsOf(readings.map((r) => r.type.family)))}` : ""}`,
    });
  };

  return (
    <section data-from-a-site="">
      <div className="mb-1 text-fine uppercase tracking-[0.14em]" style={{ color: VOID.muted }}>From a repository, a site, or a zip</div>

      {/*
        A repository first, because it is the one that needs nothing
        remembered: owner/name is on every page of GitHub and in every
        clone line. The files are fetched by this browser with his own
        token and never touch our server.
      */}
      <div className="mb-1 flex items-center gap-1">
        <Input
          aria-label="A GitHub repository to bring in"
          data-repo-name=""
          placeholder="owner/repo"
          value={repoText}
          onChange={(e) => { setRepoText(e.target.value); if (stage.at === "said") setStage({ at: "nothing" }); }}
          onKeyDown={(e) => { if (e.key === "Enter") void readRepository(); }}
          className={cn("h-7 flex-1 text-plain", SCREEN_FIELD)}
        />
        <button
          type="button"
          data-repo-read=""
          disabled={!repo || working}
          onClick={() => void readRepository()}
          title="Bring the website in this repository onto the board, with its elements in a category of their own"
          className="tactile flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-small disabled:opacity-40"
          style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
        >
          {working ? <Loader2 className="size-3 animate-spin" /> : <GitBranch className="size-3" />}
          Connect
        </button>
      </div>
      {repoText.trim() && !repo ? (
        <div data-repo-refused="" className="mb-1 text-small" style={{ color: "oklch(0.72 0.16 30)" }}>{REPO_REFUSAL_SAYS["not-a-repo"]}</div>
      ) : null}

      <Brought />

      <div className="flex items-center gap-1">
        <Input
          aria-label="A web address to read"
          data-site-url=""
          placeholder="https://…"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (stage.at === "said") setStage({ at: "nothing" }); }}
          onKeyDown={(e) => { if (e.key === "Enter") void read().catch((err: unknown) => setStage({ at: "said", says: `Stopped before it could finish: ${err instanceof Error ? err.message : String(err)}` })); }}
          className={cn("h-7 flex-1 text-plain", SCREEN_FIELD)}
        />
        <button
          type="button"
          data-site-read=""
          disabled={!gate?.ok || working}
          onClick={() => void read().catch((err: unknown) => setStage({ at: "said", says: `Stopped before it could finish: ${err instanceof Error ? err.message : String(err)}` }))}
          title="Open the page and list what is worth pointing at"
          className="tactile flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-small disabled:opacity-40"
          style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
        >
          {working && stage.says.startsWith("Opening the page") ? <Loader2 className="size-3 animate-spin" /> : <Globe className="size-3" />}
          Read
        </button>
      </div>

      {/* Why an address will not be opened, before anything is opened. */}
      {gate && !gate.ok ? (
        <div data-site-refused="" className="mt-1 text-small" style={{ color: "oklch(0.72 0.16 30)" }}>{gate.says}</div>
      ) : null}

      {/*
        Or a zip. A file well rather than a second address field: the page
        is on this machine, and it never leaves it. The label is the
        button; the input under it is how a browser takes a file.
      */}
      <label
        data-zip-well=""
        className={cn("tactile mt-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-small", working && "pointer-events-none opacity-40")}
        style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
        title="A zip with a page in it: index.html and what it uses"
      >
        <FileArchive className="size-3" />
        <span className="truncate">{stage.at === "picking" && stage.source.kind === "zip" ? stage.source.name : "Or a zip of a page"}</span>
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          data-zip-file=""
          className="sr-only"
          disabled={working}
          onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void readZip(f).catch((err: unknown) => setStage({ at: "said", says: `Stopped before it could finish: ${err instanceof Error ? err.message : String(err)}` })); }}
        />
      </label>

      {working ? <Waiting says={stage.says} /> : null}

      {stage.at === "picking" ? (
        <div className="mt-2">
          <div className="mb-1 text-small" style={{ color: VOID.muted }}>
            {stage.candidates.length} things to point at on {nameOf(stage.source)}
            {stage.source.kind === "zip" ? `, opened at ${stage.source.entry}` : ""}
          </div>
          {/* The page as it really looks, the whole of it, so a person points at what they can see: it scrolls, because a page is taller than a panel. */}
          <div className="relative mb-1.5 max-h-[260px] overflow-y-auto rounded" style={{ border: `1px solid ${VOID.rim}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-site-shot="" alt={`${nameOf(stage.source)} as it looks`} src={`data:image/png;base64,${stage.page.shot}`} className="block w-full" />
          </div>
          <button
            type="button"
            data-site-take-all=""
            onClick={() => void takeAll()}
            title="Every block of the page, as parts, laid on this surface in the proportion they had"
            className="tactile mb-1.5 flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-small"
            style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
          >
            <LayoutTemplate className="size-3" />
            Take the whole page, {pageBlocks(stage.candidates).length} block{pageBlocks(stage.candidates).length === 1 ? "" : "s"}
          </button>
          {/* The page's own blocks first, top to bottom, then the rest biggest first: the bar across the top is on the list. */}
          <ul data-site-candidates="" className="max-h-[220px] space-y-1 overflow-y-auto">
            {offered(stage.candidates).map((c) => (
              <li key={c.selector}>
                <button
                  type="button"
                  data-site-take={c.selector}
                  onClick={() => void take(c)}
                  className="tactile flex w-full items-start gap-1 rounded px-1.5 py-1 text-left"
                  style={{ ...screenFace, color: SCREEN.ink }}
                >
                  <Search className="mt-[2px] size-2.5 shrink-0" style={{ color: SCREEN.dim }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-small">{c.what}</span>
                    {c.words ? <span className="block truncate text-fine" style={{ color: SCREEN.dim }}>{c.words}</span> : null}
                  </span>
                  <span className="shrink-0 font-mono text-fine" style={{ color: SCREEN.dim }}>{c.box.w}×{c.box.h}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stage.at === "said" ? (
        <div data-site-said="" className="mt-1.5 rounded px-2 py-1 text-small" style={{ background: VOID.box, border: `1px solid ${VOID.rim}`, color: VOID.text }}>
          {stage.says}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The repositories this site has connected, and the way to let one go.
 *
 * Shown here rather than only in the shelf because this is where they
 * were brought in: a category that appeared in the menu with no way back
 * to where it came from is a category nobody can account for. Letting one
 * go takes its elements out of the shelf and leaves anything already on
 * the board exactly where it is — those are parts of this site now.
 */
function Brought() {
  const brought = useStudio(useShallow((s) => s.brought));
  const parts = useStudio(useShallow((s) => s.broughtParts));
  if (!brought.length) return null;
  return (
    <ul data-brought-repos="" className="mb-1.5 space-y-1">
      {brought.map((r) => {
        const n = parts.filter((p) => p.categoryId === r.id).length;
        return (
          <li
            key={r.id}
            data-brought-repo={r.id}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-small"
            style={{ background: VOID.box, border: `1px solid ${VOID.rim}`, color: VOID.text }}
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: `oklch(0.72 0.15 ${r.hue})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.from}</span>
              <span className="block truncate text-fine" style={{ color: VOID.muted }}>
                {n} element{n === 1 ? "" : "s"} in the shelf, read from {r.page}
              </span>
            </span>
            <button
              type="button"
              data-brought-drop={r.id}
              aria-label={`Let ${r.from} go`}
              title="Take its elements out of the shelf. Anything already on the board stays."
              onClick={() => { play("close"); useStudio.getState().sendBack(r.id); }}
              className="tactile shrink-0 rounded-sm p-0.5"
              style={{ color: VOID.muted }}
            >
              <X className="size-3" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Waiting({ says }: { says: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-1 text-small" style={{ color: VOID.muted }}>
      <Loader2 className="size-3 animate-spin" />
      {says}
    </div>
  );
}
