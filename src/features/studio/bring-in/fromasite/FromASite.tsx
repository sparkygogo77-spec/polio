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
import { FileArchive, GitBranch, LayoutTemplate, Loader2, Search, Globe } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { cn } from "@/core/lib/cn";
import { SCREEN, VOID, screenFace } from "@/core/ui/void";
import { Input } from "@/core/ui/input";
import { SCREEN_FIELD } from "../../PlateEditors";
import { recreateFrom, type ElementReading } from "../../recreate";
import { facesSays, genericsOf, genericSays, type FacesCarried } from "../../look";
import { categoryFor, noPageSays, pageAddress, readRepo, repoName, REPO_REFUSAL_SAYS, thinSays, type Repo } from "../repoImport";
import { isCopy, readRepoSite, refused, type RepoCopy } from "../../repoRun";
import { runOf } from "../../captureArtifact";
import { keepAll, put as putPicture } from "../../pictures";
import { stillAlt, type StillsAsk, type StillTaken } from "../../stills";
import { activeProject, repoFrom, useBuilds } from "@/features/builds/store";
import { heldKeys } from "@/features/keys/store";
import { readKit, seenOfSource } from "../../kitRun";
import { headOf } from "../../codePublish";
import { hooksOnBoard } from "../../designBranch";
import { oneAddress, withoutJoinedAddress } from "../captureSite";
import { kitLinksToOffsite } from "../../parts/offsite";
import { FAMILY } from "../../parts/theme";
import { baselineAsLanded, type LayerNode, type StyleSource } from "../../styleLayer";
import { checkRepoFeatures } from "../../library/repoFeatures";
import { allowed } from "../../siteFetch";
import { boundaryBox, centroid, type Space } from "../../space";
import { takeImportMark, useStudio, type StudioNode } from "../../board/store";
import { idless } from "../../partNames";
import { fingerprint, isTaken, keepOwnerEdits, keptShort, keptSays } from "../reimport";
import { sourceNote } from "../../polioMd";
import { holdIncoming } from "../../boxEntry";
import { lockNow } from "../../surfaceRun";
import { drawnOnBoard, tidyToWords } from "../../textFit";
import { fine, fitToSurface, mergeReadings, offered, pageBlocks, saidOf, scaledType, selectorsOf, type Block } from "../zipImport";
import { pagesToDoc, reportSays, reportChips, type FileRead } from "../pageParts";
import type { BuilderManifest } from "../../builderManifest";
import { SWEEP } from "../../reassemble";
import { askSite, askZip, nameOf, repoOf, deployedBy, NOTHING, stageOf, latest, putStage, subscribeStages, STEP_PATIENCE_MS, isHeadless, readPicturesOf, readScreensOf, landAsBrought, boardNow } from "./bring";
import type { Source, Picking, Stage, KeepFrom } from "./bring";
import { Brought, Details, Waiting } from "./bits";
import { followsStateRules, readSamples, readScenes, sceneScreens } from "../../states";

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
    const keep = !!handed.keep;
    useStudio.getState().setBringRepo(null);
    setRepoText(handed.repo);
    /* An exception anywhere in the read is an ending too, said by name. */
    void readRepository(r, keep).catch((err: unknown) => refuse(`stopped before it could finish: ${err instanceof Error ? err.message : String(err)}`, r));
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
  const readRepository = async (given?: Repo | null, keep = false) => {
    const r = given ?? repo;
    if (!r) return;
    bringing.current = r;
    play("tick");
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (!token) { refuse(REPO_REFUSAL_SAYS["no-token"], r); return; }
    busy(`Opening ${repoName(r)}…`);
    /* Reading one of the owner's repositories is when the features a code chat built there are offered back (`library/repoFeatures.ts`). */
    /* Not for a capture run's artifact (`@run:<id>`): a run is no branch to read features/ on. */
    if (runOf(r.ref) === null) void checkRepoFeatures({ owner: r.owner, name: r.name, ref: r.ref ?? null }, token);
    const got = await readRepoSite(r, token, (says) => busy(says));
    if (isCopy(got) && keep) {
      /*
       * KEEPING WHAT HE CHANGED (`reimport.ts`). The board's own record of
       * itself as brought in, else the document it was brought in from, read
       * at the commit it was read at; with neither, the careful merge.
       */
      const st = useStudio.getState();
      const taken = isTaken(st.taken) ? st.taken : null;
      const src = sourceNote((st.look as { capture?: { source?: unknown } }).capture?.source);
      let base: RepoCopy | null = null;
      if (!taken && src?.commit) {
        const [owner, name] = src.repo.split("/");
        const was = await readRepoSite({ owner: owner!, name: name!, ref: src.commit, dir: src.dir ?? null }, token, (says) => busy(`As this board was first brought in: ${says}`));
        if (isCopy(was)) base = was;
      }
      copySite(got, r, { taken, base, from: src ? `${src.repo}${src.dir ? `/${src.dir}` : ""}@${src.commit ?? src.branch ?? ""}` : null });
      return;
    }
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
    /* Element by element first (`pageParts.ts`): each heading, line, button, field and checkbox a part of its own, every page of it a page. */
    if (await landParts(r, got)) return;
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
  const copySite = (copy: RepoCopy, of: Repo, keep?: KeepFrom | null) => {
    const st = useStudio.getState();
    /* One undo takes the whole import back: the spaces cleared, the document
       loaded, the sweep and the palette are one step, not three. */
    const mark = takeImportMark() ?? st.historyMark();
    /* Every space goes, not only the one made for the hand-off: the
       document loaded next carries none of its own, and a space left from
       an earlier import would sit on the copied site as a hole. */
    st.removeSpaces(st.spaces.map((sp) => sp.id));
    const builds = useBuilds.getState();
    const here = activeProject();
    if (!here) { builds.adopt(); }
    const id = activeProject()?.id ?? null;
    /* Kept first, the board as it stands and its record, when the owner asked to keep what he changed (`reimport.ts`). */
    const board = keep ? boardNow() : null;
    let taken = keep ? keep.taken : null;
    /* No record on the board: the document it was brought in from, taken in the same way, is the record. */
    if (keep && !taken && keep.base) {
      landAsBrought(keep.base.document);
      taken = fingerprint(boardNow(), keep.from);
    }
    landAsBrought(copy.document);
    /* The board as brought in, recorded; and, keeping, the owner's changes laid back over it. */
    const src = sourceNote((copy.document as { source?: unknown }).source);
    const brought = boardNow();
    const record = fingerprint(brought, src ? `${src.repo}${src.dir ? `/${src.dir}` : ""}@${src.commit ?? src.branch ?? copy.ref}` : `${of.owner}/${of.name}@${copy.ref}`);
    let keptLine = "";
    let keptDetails = "";
    if (board) {
      const { doc, kept } = keepOwnerEdits(board, taken, brought);
      type S = ReturnType<typeof useStudio.getState>;
      useStudio.setState({ nodes: doc.nodes, format: doc.format as S["format"], brief: doc.brief as S["brief"], look: doc.look as S["look"] });
      /* One short line with no names in it; the part-by-part account is the strip's "details". */
      keptLine = ` Brought in again over your board: ${keptShort(kept)}`;
      keptDetails = `Brought in again over your board: ${keptSays(kept)}`;
    }
    useStudio.setState({ taken: record });
    useStudio.getState().oneStepSince(mark);
    const sweptSays = useStudio.getState().sweepNote ?? "";
    useStudio.setState({ sweepNote: null });
    /* The source whole: the repository, the branch it was read on, and the
       folder the site is kept in. The folder was dropped, so "Bring it in
       again" read the repository's root on its default branch: SOLCINERATOR
       over a trumpmorty.fun board (tests/bring-again.mjs). */
    const at = repoFrom(`${of.owner}/${of.name}`, copy.ref);
    const repo = at ? { ...at, dir: of.dir ?? null } : at;
    /* Brought in from it: that is where the site came from, and only that.
       It is never where the site publishes (the owner's ruling: polio never
       writes to a capture repository), so a publish target that was this
       same repository is taken off, and said below. */
    const aimedHere = id ? useBuilds.getState().projects.find((p) => p.id === id)?.repo : undefined;
    const tookOff = !!aimedHere && !!repo && `${aimedHere.owner}/${aimedHere.name}`.toLowerCase() === `${repo.owner}/${repo.name}`.toLowerCase();
    if (id && repo) builds.setSource(id, repo);
    const publishesTo = id ? useBuilds.getState().projects.find((p) => p.id === id)?.repo : undefined;
    if (id && copy.name) builds.rename(id, withoutJoinedAddress(copy.name));
    void (async () => {
      /* All in one transaction: one at a time behind a big board took minutes (`keepAll`). */
      const kept = await keepAll(copy.pictures.map((p) => ({ pic: { id: p.id, path: p.path, type: p.type, w: 0, h: 0, bytes: p.bytes.length, alt: "", from: "upload" }, blob: new Blob([p.bytes as BlobPart], { type: p.type }) })));
      const behind = copy.pictures.length - kept + copy.lost.length;
      const parts = `${copy.parts} part${copy.parts === 1 ? "" : "s"} on ${copy.pages} page${copy.pages === 1 ? "" : "s"}`;
      /* Said out loud, and by name where a part he had moved was replaced:
         that naming is how he checks the ruling was read right. */
      /* Short, with no internal ids: the sweep's counts, and the whole of it in "details". */
      const sweptShort = sweptSays ? idless(sweptSays) : "";
      const sentencesSaid = `${sweptShort ? ` ${sweptShort.length > 180 ? "Some parts were tidied as they arrived; one undo takes it back." : sweptShort}` : ""}${keptLine}`;
      const saidDetails = [sweptShort !== sweptSays || sweptShort.length > 180 ? sweptSays : "", keptDetails].filter(Boolean).join("\n\n");
      ctx.publish({
        key: `studio:repo:${of.name}`,
        title: `This site is ${copy.name} now, copied whole from ${repoName(of)}`,
        body: `${parts}, every position, colour, motion and prompt as published${kept ? `, and ${kept} picture${kept === 1 ? "" : "s"}` : ""}. Brought in from ${of.owner}/${of.name} on ${copy.ref}, which Publish never writes to: ${publishesTo ? `it goes to ${publishesTo.owner}/${publishesTo.name}` : `the first Publish makes this site a repository of its own`}.${tookOff ? ` ${of.owner}/${of.name} was this site's publish target, and is not any more.` : ""}${behind ? ` ${behind} picture${behind === 1 ? " is" : "s are"} named by the site but not in the repository, and ${behind === 1 ? "says" : "say"} so on the board.` : ""}${sentencesSaid}`,
        level: behind ? "warn" : "success",
        source: "studio",
        toast: { durationMs: 10000 },
      });
      /* THE COPY ENDS ITS OWN STAGE. It did not: the space was gone, the
         stage stayed "busy", and ninety seconds later the patience rule
         ended a step that had long finished, with a refusal on the strip
         naming this repository under whatever came next. */
      if (patience.current) { window.clearTimeout(patience.current); patience.current = null; }
      setStage({ at: "said", says: `${repoName(of)}: this site is ${copy.name} now, copied whole: ${parts}.${sentencesSaid}${behind ? ` ${behind} picture${behind === 1 ? " is" : "s are"} named by the site but not in the repository.` : ""}`, ...(saidDetails ? { details: saidDetails } : {}) });
      play("confirm");
    })();
  };

  /*
   * A REPOSITORY'S PAGE, ELEMENT BY ELEMENT (`pageParts.ts`).
   *
   * Read by blocks, PST's plain test page came in as seven bands of words,
   * its hidden panels as tall blank boxes. Read by parts, every heading,
   * line, button, link, field and checkbox is its own part under its
   * section, keeping the hooks its code finds it by; what is hidden as the
   * page opens is kept hidden and takes no room; and each other page of the
   * site beside it comes in as a page. It lands as a capture lands
   * (`landAsBrought`): the document replaced, one undo back. The sweep is
   * not run over it: it reads a capture's fragments and joins them, and
   * these parts were read whole.
   *
   * False when nothing could be read this way, so the reading by blocks
   * runs as before and says its own ending.
   */
  const landParts = async (of: Repo, got: { file: File; ref: string; entry: string; code?: { path: string; text: string }[]; manifest?: BuilderManifest; screensFile?: File; stills?: { file: File; ask: StillsAsk } }): Promise<boolean> => {
    const st0 = useStudio.getState();
    /*
     * READ AT HIS WINDOW'S WIDTH (J, 2026-10-04): PonsStars on his ~2000px
     * screen looked like the board only zoomed to 150%, because the board
     * read it at 1440. A site from code is read at the width of the window
     * he is looking from, so the board is the site 1:1 as he sees it.
     */
    const seen = typeof window === "undefined" ? 0 : Math.round(window.innerWidth);
    const readAt = seen >= 1280 ? Math.min(2560, seen) : st0.frameWidth || 1440;
    /* A builder.json says which pages, in which order, and where its tokens are (`builderManifest.ts`). */
    const m = got.manifest ?? null;
    const zr = await askZip(got.file, {
      parts: "1",
      width: String(readAt),
      ...(m?.pages.length ? { entry: m.pages[0]!.file, pages: JSON.stringify(m.pages.slice(1).map((p) => p.file)) } : {}),
      ...(m?.tokens ? { tokens: m.tokens } : {}),
    });
    const files = Array.isArray(zr.pages) ? (zr.pages as (FileRead & { scripts?: boolean })[]) : [];
    if (!zr.ok || !files.length || !files[0]!.read?.parts?.some((p) => !p.hidden)) return false;
    const { doc, report } = pagesToDoc(files, { code: got.code, ...(m ? { names: Object.fromEntries(m.pages.filter((p) => p.name).map((p) => [p.file, p.name!])), byHook: true, hooksFile: m.hooks, manifestDir: m.file.includes("/") ? m.file.slice(0, m.file.lastIndexOf("/") + 1) : "" } : {}) });
    /*
     * THE STILLS ITS builder.json ASKS FOR (`stills.ts`): what its code draws
     * into a part (PST's chart in the TV), taken on its preview page, put on
     * that part as its picture, so the owner designs round a chart and not
     * an empty screen. One that cannot be taken is said, and nothing else
     * waits on it.
     */
    let stillsSaid = "";
    if (got.stills) {
      busy(`Taking a still of what its code draws into ${got.stills.ask.shots.map((x) => x.hook).join(", ")}…`);
      const sr = await askZip(got.stills.file, { still: JSON.stringify(got.stills.ask), width: String(readAt) }).catch(() => ({ ok: false }) as Record<string, unknown>);
      const taken = Array.isArray(sr.stills) ? (sr.stills as StillTaken[]) : [];
      const put: string[] = [];
      for (const t of taken) {
        const on = (doc.nodes as unknown as StudioNode[]).filter((n) => n.hooks?.["data-hook"] === t.hook);
        if (!on.length) continue;
        try {
          const pic = await putPicture(await (await fetch(t.src)).blob(), { alt: stillAlt(t.hook, got.stills.ask.page, t.query), from: "upload" });
          /* Under what covers it as the page opens (PST's static and "Tuning in"): the board shows what the page shows, and the still is there where the cover goes (tv-idle). */
          for (const n of on) (n as unknown as Record<string, unknown>).picture = pic;
          put.push(t.hook);
        } catch { /* no file storage here: the part stays as its code leaves it */ }
      }
      const missed = got.stills.ask.shots.map((x) => x.hook).filter((h) => !put.includes(h));
      stillsSaid = `${put.length ? ` ${put.join(", ")} show${put.length === 1 ? "s" : ""} a still of what ${put.length === 1 ? "its" : "their"} code draws, from ${got.stills.ask.page}, as ${put.length === 1 ? "its" : "their"} picture.` : ""}${missed.length ? ` No still of ${missed.join(", ")} could be taken from ${got.stills.ask.page}.` : ""}`;
    }
    const st = useStudio.getState();
    const mark = takeImportMark() ?? st.historyMark();
    /* Every other space goes; the one this panel runs on stays, so what landed is said where it was asked for. */
    st.removeSpaces(st.spaces.filter((sp) => sp.id !== space.id).map((sp) => sp.id));
    /* The page's own ground and ink are the palette's page colour and text: a plain page is white with black words, whatever the buttons are filled with. */
    /* What its code is written against, with where it came from: the style layer goes back there (`styleLayer.ts`). */
    const entryDir = got.entry.includes("/") ? got.entry.slice(0, got.entry.lastIndexOf("/") + 1) : "";
    const styleSource: StyleSource = {
      repo: `${of.owner}/${of.name}`, ref: got.ref || of.ref || "", dir: entryDir, ...doc.styleSource,
      ...(m ? { layerFile: m.styleLayer, ...(m.tokens ? { tokensFile: m.tokens } : {}), manifest: { file: m.file, kit: m.kit, previews: m.screens, gallery: m.gallery } } : {}),
    };
    /* A builder-ready repository (kit/PIPELINE.md): its builder.json and hooks map are the baseline each design round is compared with, and its link rules become the site's. */
    let format = st.format;
    const kit = await readKit(styleSource.repo, styleSource.ref || "HEAD", heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "").catch(() => null);
    if (kit?.ok) {
      styleSource.seen = kit.seen;
      styleSource.kit = kit.manifest;
      styleSource.scenes = readScenes(kit.scenes);
      styleSource.samples = readSamples(kit.samples);
      if (kit.manifest.links) format = { ...format, "links.offsite": kitLinksToOffsite(kit.manifest.links) };
    } else styleSource.seen = seenOfSource(styleSource, new Date().toISOString());
    /* The commit it was read at: Refresh is green while its branch is still there (`codePublish.ts`). */
    styleSource.commit = await headOf(styleSource.repo, styleSource.ref || "HEAD", heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "").catch(() => null);
    styleSource.sent = null;
    /* The hooks it came in with on the board: a design sent back to a branch keeps every one, and says what changed against them. */
    styleSource.onBoard = hooksOnBoard(doc.nodes as unknown as StudioNode[]);
    /* A site that follows the state rules: its scenes are the board's screens from the start, drawn from its markup (`stateRules.ts`). */
    if (styleSource.scenes?.length && followsStateRules(doc.nodes as unknown as StudioNode[])) styleSource.screens = sceneScreens(doc.nodes as unknown as StudioNode[], styleSource.files ?? [], styleSource.scenes);
    landAsBrought({ pages: doc.pages, nodes: doc.nodes, frameWidth: doc.frameWidth, format, brief: st.brief, look: { ...st.look, palette: { ...st.look.palette, bg: doc.ground.bg, text: doc.ground.text }, styleSource, ...(doc.keyframes.length ? { keyframes: doc.keyframes } : {}) }, swept: SWEEP });
    /* What the landing itself changed (the sweep's repaint, the palette's roles) is no design: the board as landed is what the style layer is measured from (`baselineAsLanded`). */
    {
      const now = useStudio.getState();
      useStudio.setState({ nodes: baselineAsLanded(now.nodes as unknown as LayerNode[], now.look.palette as Record<string, string>, { family: (name) => FAMILY[name] }) as unknown as typeof now.nodes });
    }
    /* The elements, in the shelf under the repository's own name: what shows as the page opens, on its first page. */
    const cat = categoryFor(of);
    const shows = (doc.nodes as unknown as StudioNode[]).filter((n) => !n.state && n.pageId === doc.pages[0]!.id);
    /* Those with words first: a section's box is where they sit, and the least of what to drop again. */
    const kept = [...shows.filter((n) => n.featureId !== "box"), ...shows.filter((n) => n.featureId === "box")].slice(0, 120);
    useStudio.getState().bringIn(
      { id: cat.id, label: cat.label, hue: cat.hue, from: got.file.name, page: got.entry, at: Date.now() },
      kept.map((n, i) => ({ id: `${cat.id}:${i + 1}`, categoryId: cat.id, label: String(n.label || `Element ${i + 1}`), basedOn: n.featureId, blurb: n.prompt, w: n.w, h: n.h, content: typeof n.content === "string" ? n.content : n.content.map((x) => x.text).join(""), options: n.options, colour: n.colour, font: n.font, prompt: n.prompt })),
    );
    const here = activeProject();
    const cameAt = repoFrom(`${of.owner}/${of.name}`, got.ref || of.ref || "main");
    const came = cameAt ? { ...cameAt, dir: of.dir ?? null } : cameAt;
    if (here && came && !here.source) useBuilds.getState().setSource(here.id, came);
    useStudio.getState().oneStepSince(mark);
    /* Its preview screens, read in the background as its own code builds them: the States control lists them when they land (`boardStates.ts`). */
    if (m?.previewPage || m?.screenPages.length) void readScreensOf(got.screensFile ?? got.file, { page: m.previewPage, list: m.screenPages.map((x) => ({ name: x.name, src: `${x.page}${(m.previewQuery ?? "?still=1&screen=<name>").replace("<name>", encodeURIComponent(x.name))}` })) }, styleSource.repo, doc.frameWidth || st0.frameWidth || 1440);
    /* The pictures its scripts draw, read in the background with its scripts on, onto the stand-ins they fill. */
    if (files.some((f) => f.scripts)) void readPicturesOf(got.file, (styleSource.files ?? []).map((f) => f.file), styleSource.repo);
    /* Locked as the page had it, when it landed in a space: the layout is the specification. */
    if (!isHeadless(space)) lockNow(space.id);
    /* The space this panel runs on stays picked, so its line is read where it was asked for; a repository's import has none (`BringHost`). */
    useStudio.getState().setSelection(isHeadless(space) ? [] : [space.id]);
    if (patience.current) { window.clearTimeout(patience.current); patience.current = null; }
    const anyScripts = files.some((f) => f.scripts);
    const left = Number(zr.left) || 0;
    const failed = Number(zr.failed) || 0;
    /* Thin is still said: a page that shows two parts or fewer as it opens has little on it. */
    const showing = (doc.nodes as unknown as StudioNode[]).filter((n) => !n.state && n.pageId === doc.pages[0]!.id && n.featureId !== "box").length;
    const fromManifest = m ? ` Read from its ${m.file}${m.name || m.kit ? ` (${[m.name, m.kit ? `kit ${m.kit}` : null].filter(Boolean).join(", ")})` : ""}: its pages in its order, its code view from ${m.hooks ?? "a reading of its scripts"}, ${m.tokens ? `its tokens in ${m.tokens} as variables you can set` : "no tokens file"}, and the style layer goes back to ${m.styleLayer ?? `${entryDir}style-layer.css`}.${m.screens.length ? ` It lists ${m.screens.length} preview screen${m.screens.length === 1 ? "" : "s"} (${m.screens.slice(0, 6).join(", ")}${m.screens.length > 6 ? ", …" : ""}), each at ${m.previewPage ?? "its page"}${m.previewQuery ?? "?still=1&screen=<name>"}; the States control on the page strip shows them on the board once they are read.` : ""}${m.gallery ? ` Its gallery is ${m.gallery}.` : ""}` : "";
    const says = `${reportSays(report, { scripts: anyScripts, from: repoName(of) })}${fromManifest}${stillsSaid}${thinSays(showing, { url: null, why: "none", isMadeHere: false })}${left ? ` ${left} more page${left === 1 ? "" : "s"} in it ${left === 1 ? "was" : "were"} not read: this reads twelve.` : ""}${failed ? ` ${failed} page${failed === 1 ? "" : "s"} would not open and ${failed === 1 ? "is" : "are"} not here.` : ""} One undo takes it all back.`;
    const total = report.pages.reduce((n, p) => n + p.parts, 0);
    ctx.publish({ key: `studio:repo:${of.name}`, title: `${total} part${total === 1 ? "" : "s"} from ${repoName(of)} landed on the board`, body: says, level: "success", source: "studio", toast: { durationMs: 9000 } });
    /* The counts as chips, a short line beside them, and the whole account under "details" (J, 2026-10-06: too much text to read). */
    const notes = [anyScripts ? "scripts not run" : "", report.truncated.length ? `${report.truncated.join(", ")} cut short` : "", left ? `${left} more page${left === 1 ? "" : "s"} not read` : "", failed ? `${failed} page${failed === 1 ? "" : "s"} would not open` : ""].filter(Boolean);
    const short = `${total} part${total === 1 ? "" : "s"} from ${repoName(of)} landed${notes.length ? ` (${notes.join(", ")})` : ""}. One undo takes it all back.`;
    setStage({ at: "said", says: short, details: says, chips: reportChips(report) });
    play("confirm");
    return true;
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
    /*
     * The boxes come up one after another rather than all at once. The run
     * below is unchanged and still synchronous — one undo still brings the
     * old board back — and it is the painting of each box that waits its
     * turn. `boxEntry.ts` holds the reasoning and the number.
     */
    holdIncoming(readings.length);
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
    /* A page brought in from a repository is where the site came from,
       when it had come from nowhere yet. Never where it publishes. */
    if (from) {
      const here = activeProject();
      const cameAt = repoFrom(`${from.owner}/${from.name}`, from.ref ?? "main");
      const came = cameAt ? { ...cameAt, dir: (from as { dir?: string | null }).dir ?? null } : cameAt;
      if (here && came && !here.source) useBuilds.getState().setSource(here.id, came);
    }
    // Locked as the page had it: the layout is the specification.
    lockNow(space.id);
    // Adding picks what was added, which would swap this panel for the
    // last part's. The space stays picked, so the line under this is read
    // where it was asked for, with the parts on the board beside it. A
    // repository's import has no space (`BringHost`): nothing is picked.
    useStudio.getState().setSelection(isHeadless(space) ? [] : [space.id]);
    play("confirm");
    /* Thin is said, with the better address when one is known. */
    const thin = thinSays(landed.length, source.kind === "site"
      ? { url: source.url, why: source.read?.why ?? "hand", isMadeHere: source.read?.isMadeHere ?? false }
      : { url: null, why: "none", isMadeHere: false });
    if (of) ctx.publish({ key: `studio:repo:${of.name}`, title: `${landed.length} block${landed.length === 1 ? "" : "s"} from ${repoName(of)} landed on the board`, body: `${isHeadless(space) ? "On the page" : "In the space named after it"}, and in the shelf under “${categoryFor(of).label}”.${thin}`, level: thin ? "warn" : "success", source: "studio", toast: { durationMs: thin ? 10000 : 7000 } });
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
          onChange={(e) => { setUrl(oneAddress(e.target.value).url); if (stage.at === "said") setStage({ at: "nothing" }); }}
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
          {stage.details ? <Details text={stage.details} /> : null}
        </div>
      ) : null}
    </section>
  );
}

