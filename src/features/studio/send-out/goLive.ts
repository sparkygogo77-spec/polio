"use client";
/**
 * GO LIVE, ONCE, FOR EVERY BUTTON THAT SAYS IT.
 *
 * The book's publish row had Go live and nothing else did, and the owner
 * could not find it. The top bar has a Go live of its own now
 * (`GoLiveButton.tsx`), and both press this: one function from board to
 * address, and one record of how it is getting on (`useGoLive`), so either
 * place shows the same progress and the same link, whichever was pressed.
 *
 * What goes up is what the book sends: the pages written from the board at
 * this moment, the pictures out of this browser, the site's own document,
 * and whatever the caller adds (the book adds the code Claude wrote while it
 * was open).
 */
import { create } from "zustand";
import type { ToastInput } from "@/core/types";
import { activeProject, allSources, repoLabel, sharedTargetSays, useBuilds } from "@/features/builds/store";
import { flushEdits, lastEdit } from "@/features/builds/edits";
import { deploy, productionAddress, publish, siteFiles, watchDeploy, type DeployState, type GeneratedFile } from "../loop/run";
import { compileSpec, specToJson, specToMarkdown } from "../spec";
import { exportSite, publishedAt } from "./exportSite";
import { kitAfterPush, type KitSent } from "./kitPublish";
import { pagesRecord } from "./pagesRecord";
import { sitePictures } from "../staticSite";
import { sentBoard, useStudio } from "../board/store";
import { contractFiles } from "../shelf";
import { polioMd, POLIO_MD } from "../polioMd";
import { completeSite, fetchOwnFromBuilder, missingSays } from "../siteRefs";
import { homeFor } from "../homePage";
import { pageFile } from "../staticSite";
import { askStillCopy, codeSourceOf } from "../stillCopy";
import { plainFailure, type Failed, type PlainFailure, type PublishStep } from "../publishWords";

export interface LiveRun { state: string | null; url: string | null; inspectorUrl: string | null; done: boolean; message?: string }
export interface Pushed { url: string; files: number; deployed: boolean; hook: boolean; note?: string }

/**
 * What stopped the last Go live, in the words of whoever stopped it, and a
 * line on the likely fix. Shown on the top-bar button and in the book's row:
 * the first real Go live was refused by Vercel and nothing said so.
 */
export interface Refused {
  message: string;
  hint?: string;
  /**
   * The site it belongs to. A refusal stayed in the top bar after a later
   * publish went through and after switching to another site: parasite's
   * "5.1 MB even packed" was still there while gotchi published. It is shown
   * only on its own site, named, and cleared by the next publish that goes
   * through or a switch to another site (`tests/builds-publish-state.mjs`).
   */
  siteId?: string | null;
  site?: string;
  /** The same refusal in plain words (`publishWords.ts`): what the bar shows, with `message` behind "details". */
  plain?: PlainFailure;
}

/** The last refusal is over: a publish went through. */
export function clearRefused(): void {
  if (useGoLive.getState().refused) useGoLive.setState({ refused: null });
  /* An old failure's line goes with it: a later success never sits beside an earlier error. */
  if (useGoLive.getState().step?.at === "failed") useGoLive.setState({ step: null });
}

/** How the Go live in flight, or the last one, is getting on. */
export const useGoLive = create<{ busy: string | null; run: LiveRun | null; note: string | null; pushed: Pushed | null; refused: Refused | null;
  /** Files the last publish's pages point at that nothing provided: published anyway, and said (`siteRefs.ts`). */
  warned: { says: string; siteId: string | null } | null;
  /** Where the last publish got to, in the three steps a person follows (`publishWords.ts`), and whose site it was. */
  step: (PublishStep & { siteId?: string | null }) | null }>(() => ({
  busy: null,
  run: null,
  note: null,
  pushed: null,
  refused: null,
  warned: null,
  step: null,
}));

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
export const following = new Set<string>();
/** A deployment older than this is not waited on again: whatever it came to, the Vercel log has it. */
export const PENDING_FOR = 24 * 60 * 60_000;

export async function followDeployment(projectId: string, dep: { id: string; team: string | null }, onState?: (s: DeployState) => void): Promise<DeployState> {
  following.add(dep.id);
  const builds = useBuilds.getState();
  if (builds.projects.find((p) => p.id === projectId)?.pending?.id !== dep.id) builds.setPending(projectId, { id: dep.id, team: dep.team, at: Date.now() });
  try {
    const end = await watchDeploy(dep.id, { team: dep.team, onState });
    if (end.state === "READY" && end.url) useBuilds.getState().setLive(projectId, end.url, end.inspectorUrl);
    if (end.state === "READY" || end.state === "ERROR" || end.state === "CANCELED") useBuilds.getState().setPending(projectId, undefined);
    return end;
  } finally {
    following.delete(dep.id);
  }
}

/*
 * WHERE A PUSH GOES, AND WHAT A NEW REPOSITORY IS CALLED.
 *
 * Every button that pushes asks this rather than working it out. Go live
 * used to send no `create` at all, so the first press of it on a site with
 * no repository yet came back "nothing to name a new one after: give the
 * site a name in the brief", on a site whose brief plainly says BLACKORB.
 * Nothing was wrong with the name; the button never sent it.
 */
export function pushTo(siteName: string) {
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
      /* Held here as well as on the button: a press from any door stops before anything is sent. */
      : sharedTargetSays(useBuilds.getState().projects, project?.id),
    /* No repository yet: what to call the one this publish will make.
       Nobody is asked for a name — the site already has one. */
    create: repo ? undefined : (siteName.trim() || project?.name?.trim() || "site"),
  };
}

/*
 * A TARGET THE ROUTE SAYS IS A CAPTURE, OR A SOURCE, IS TAKEN OFF.
 *
 * It is refused either way; left on, every press would be refused again
 * and the Builds page would go on saying Publish pushes there. Taken off
 * and said, the next press makes the site a repository of its own.
 */
export function refusedTarget(project: ReturnType<typeof activeProject>, r: { reason?: string; message?: string }): string {
  const message = r.message ?? "";
  if (!project?.repo || (r.reason !== "capture" && r.reason !== "source")) return message;
  useBuilds.getState().setRepo(project.id, undefined);
  return `${message} It is no longer this site's publish target: the next Publish makes a repository of its own.`;
}

/*
 * A repository the push made is written on the site the moment it exists,
 * whether or not the push that followed it worked. It used to be written
 * only on success, so a first publish that made the repository and then
 * failed left the site not knowing about it — and the next press made
 * another one, with a suffix, because the name was taken.
 */
export function remember(project: ReturnType<typeof activeProject>, made: string | undefined, branch: string | undefined): void {
  if (!made || !project) return;
  const [owner, name] = made.split("/");
  if (owner && name) useBuilds.getState().setRepo(project.id, { owner, name, branch: branch ?? "main" });
}

/** The site's own document and blueprint, compiled from the board as it is now. */
export function documentFiles(): GeneratedFile[] {
  const s = sentBoard(useStudio.getState());
  const spec = compileSpec({ pages: s.pages, nodes: s.nodes, groups: s.groups, shapes: s.shapes, format: s.format, brief: s.brief, frameWidth: s.frameWidth, look: s.look, motion: s.motion, trail: s.trail });
  return siteFiles(specToMarkdown(spec), specToJson(spec));
}

/*
 * WHAT ACTUALLY GOES UP: the site, and then everything that describes it.
 *
 * A publish used to carry the document and the blueprint and nothing a
 * browser can open, so the repository imported at Vercel had nothing at
 * its root and answered NOT_FOUND at every address. The pages are written
 * here, at the moment of pressing, by rendering each one the way the
 * preview does and reading its markup back (`exportSite`, which also makes
 * every link the document holds a real `<a href>`; `staticSite` shipped
 * them as buttons with nothing behind them). No key, no
 * model, nothing asked of anybody: pressing publish is now enough to have
 * a website.
 */
export async function collectFiles(described: GeneratedFile[], say: (note: string) => void, address?: string | null, /** Where a warning about files the pages point at and nothing provides goes; `say` when none. */ warn?: (says: string) => void): Promise<GeneratedFile[]> {
  let pages: GeneratedFile[] = [];
  try {
    pages = (await exportSite(undefined, { pictures: false, address })) as GeneratedFile[];
  } catch (err) {
    /* The description still goes up, and the line says the pages did not,
       rather than a publish that silently carries half of it. */
    say(`The pages could not be written out (${err instanceof Error ? err.message : "unknown"}), so only the document went up.`);
    return described;
  }
  /*
   * And the pictures, as real files. The document holds only their paths,
   * so this is the one moment their bytes are read out of this browser's
   * storage. One this browser has lost is named rather than skipped: the
   * page that points at it already says it is missing, and so should the
   * person pressing publish.
   */
  let shots: GeneratedFile[] = [];
  let lostCount = 0;
  try {
    const { files, lost } = await sitePictures();
    shots = files;
    lostCount = lost.length;
  } catch (err) {
    say(`The pictures could not be read out of this browser (${err instanceof Error ? err.message : "unknown"}), so the pages went up without them.`);
  }
  /*
   * And what the code chat working in the repository reads: TASKS.md, the
   * feature contract in AGENTS.md and CLAUDE.md (merged into the owner's own
   * by the route), and a features/<name>/ folder per feature in use
   * (`library/contract.ts`). What a code chat builds there comes back.
   */
  const st = sentBoard(useStudio.getState());
  const contract = contractFiles(st.nodes, st.pages).filter((f) => !described.some((d) => d.path === f.path));
  /*
   * And POLIO.md: what the site is and what still needs code, for a backend
   * chat opened on the repository later (`polioMd.ts`). In this same push,
   * so one press is still one deployment.
   */
  const came = activeProject()?.source;
  const polio: GeneratedFile = {
    path: POLIO_MD,
    content: polioMd({
      brief: st.brief, pages: st.pages, nodes: st.nodes, format: st.format as Record<string, unknown>, look: st.look, frameWidth: st.frameWidth,
      source: came ? { repo: `${came.owner}/${came.name}`, dir: came.dir ?? null, branch: came.branch, commit: null } : null,
      address: address ?? null,
    }),
  };
  /* And the page files this push writes: a page deleted or renamed on the board since the last push comes off the site (`pagesRecord.ts`). */
  const record = pagesRecord(pages);
  const all = [...pages, ...(record ? [record] : []), ...shots, ...contract, ...(described.some((d) => d.path === POLIO_MD) ? [] : [polio]), ...described];
  /*
   * NOTHING A PAGE POINTS AT IS LEFT BEHIND (`siteRefs.ts`). What the
   * Builder serves itself (its `public/` files: the construct faces, the
   * picture an empty part shows) is copied in at the same path; anything
   * else a page points at and nothing provides, a picture this browser has
   * lost among them, is said as a warning with the list; the publish still
   * goes, as it always did, so the owner is never kept from going live.
   */
  const { added, missing } = await completeSite(all as { path: string; content: string; encoding?: string }[], { fetchOwn: fetchOwnFromBuilder, liveAddress: address ?? null });
  if (missing.length) {
    const home = homeFor(st.pages);
    const names = new Map(st.pages.map((p) => [pageFile(p, home), p.name?.trim() || p.path || "a page"]));
    const says = missingSays(missing, (f) => names.get(f) ?? f);
    (warn ?? say)(says);
  }
  /* A lost picture no page points at is still said, and goes up without it. */
  else if (lostCount) say(`${lostCount} picture${lostCount === 1 ? " is" : "s are"} no longer in this browser and no page uses ${lostCount === 1 ? "it" : "them"}, so ${lostCount === 1 ? "it was" : "they were"} left out.`);
  if (added.length) say(`${added.length} file${added.length === 1 ? "" : "s"} the pages use from the Builder itself went up with the site: ${added.map((f) => f.path).join(", ")}.`);
  return [...all, ...(added as GeneratedFile[])];
}

/**
 * One press: the files go up, and the address comes back.
 *
 * Push and deploy are one act — a commit nobody deployed is not published —
 * so this does both and waits, rather than leaving someone to guess whether
 * a connected project noticed. The project's own repository wins over the
 * server's, so each site goes where the Builds page says it goes, and the
 * address is written back to the project when it is live.
 */
export async function goLive(o: { extra?: GeneratedFile[]; message: string; siteName: string; say: (t: ToastInput) => void; /** The owner said yes to a still copy of a site from code (`stillCopy.ts`). */ still?: boolean }): Promise<void> {
  if (useGoLive.getState().busy) return;
  /* A site from a code repository goes up only as a still copy, without its scripts: asked every press, here, so no button can skip it. */
  const fromCode = codeSourceOf(useStudio.getState().look);
  if (fromCode && !o.still) { askStillCopy(fromCode, () => void goLive({ ...o, still: true })); return; }
  /*
   * Said inside the press, before anything is awaited: a module that wants to
   * follow the publish with something only a press may start (the tweet
   * console's tour clip, `tweets/afterPublish.ts`) asks for it now. The
   * Builder knows nothing of who listens.
   */
  window.dispatchEvent(new CustomEvent("studio:publish-start"));
  const set = useGoLive.setState;
  const setNote = (note: string | null) => set({ note });
  const setBusy = (busy: string | null) => set({ busy });
  const here0 = activeProject();
  set({ busy: "Writing the pages…", note: null, run: null, pushed: null, refused: null, warned: null, step: { at: "saving", siteId: here0?.id ?? null } });
  /* A refusal is said once, on the row and the top bar (`refused`), not again in the book's note. */
  const here = activeProject();
  const refuse = (message: string, hint?: string, failed?: Failed) => {
    const plain = plainFailure(failed ?? { stage: "vercel", message });
    set({ refused: { message, ...(hint ? { hint } : {}), siteId: here?.id ?? null, site: here?.name?.trim() || o.siteName.trim() || undefined, plain },
      step: { at: "failed", failure: plain, siteId: here?.id ?? null } });
    return plain.says;
  };
  const { say, siteName } = o;
  try {
    const { project, repo, branch, create, boundTo, sources, refused } = pushTo(siteName);
    if (refused) {
      refuse(refused, undefined, { stage: "github", message: refused, reason: "blocked" });
      say({ key: "studio:publish", title: "Not published", body: refused, level: "error", source: "studio", toast: true });
      return;
    }
    /*
     * THE ADDRESS, BEFORE THE PAGES ARE WRITTEN. A link preview names full
     * addresses on the one the site is published at, and one press is one
     * deployment (tests/go-live-once.mjs), so a site not yet live asks
     * Vercel where its repository's project publishes (tests/go-live-head.mjs).
     * No project yet, no address: the pages go up with relative pictures and
     * no og:url, and the next publish, once live, fills them.
     */
    const address = publishedAt() ? null : await productionAddress({ repo, sources });
    /* The board's last change as the pages are written: an edit after this is not in the push (`builds/publishState.ts`). */
    flushEdits();
    const carried = lastEdit() ?? Date.now();
    /* Files the pages point at that nothing provides: a warning beside the status, never a stop (`siteRefs.ts`). */
    const going = await collectFiles([...documentFiles(), ...(o.extra ?? [])], setNote, address, (says) => {
      set({ warned: { says, siteId: here?.id ?? null } });
      say({ key: "studio:publish-missing", title: "Some files will be missing", body: says, level: "warn", source: "studio", toast: { durationMs: 12000 } });
    });
    setBusy(`Pushing ${going.length} files to GitHub…`);
    const pushed = await publish({ files: going, message: o.message, deploy: false, repo, branch, create, boundTo, sources });
    remember(project, pushed.created, pushed.ok ? pushed.branch : branch);
    if (!pushed.ok) {
      const says = refusedTarget(project, pushed);
      const plainly = refuse(`GitHub: ${says}`, undefined, { stage: "github", message: says, reason: pushed.reason, serverStatus: pushed.serverStatus, status: pushed.status });
      say({ key: "studio:publish", title: "Not saved", body: plainly, level: "error", source: "studio", toast: true });
      return;
    }
    if (project) useBuilds.getState().setPublished(project.id, pushed.repo, pushed.branch, { sha: pushed.sha, commitUrl: pushed.commitUrl, editedAt: carried });
    /* A kit the board published is still current after this push on top of it: a record, kept without an undo step (`BuilderSiteButtons.tsx`). */
    const kitNow = kitAfterPush((useStudio.getState().look as { kitSent?: KitSent | null }).kitSent, pushed);
    if (kitNow) useStudio.setState((st) => ({ look: { ...st.look, kitSent: kitNow } as typeof st.look }));
    set({ pushed: { url: pushed.commitUrl, files: pushed.files, deployed: false, hook: pushed.hook }, step: { at: "waiting", saved: { repo: pushed.repo, branch: pushed.branch }, siteId: here?.id ?? null } });
    const saved = { repo: pushed.repo, branch: pushed.branch };
    /* How much of it went up: only what changed is sent (`tests/publish-changed.mjs`). */
    const gone = pushed.removed?.length ?? 0;
    if (typeof pushed.changed === "number" && typeof pushed.total === "number") say({ key: "studio:publish", title: `${pushed.changed} of ${pushed.total} files changed`, body: `Pushed to ${pushed.repo} on ${pushed.branch}${gone ? `, and took off ${gone} page${gone === 1 ? "" : "s"} no longer on the board` : ""}; building next.`, level: "info", source: "studio", toast: true, href: pushed.commitUrl });
    useStudio.getState().noteThread([`${pushed.files} files pushed to ${pushed.repo} on ${pushed.branch}`]);

    setBusy("Asking Vercel to build it…");
    /* A repository with no Vercel project gets one on the way, named after
       the site, so this press is the only one needed from board to address. */
    /* The commit just pushed goes too: a connected project deploys it by
       itself, and that deployment is followed rather than a second made. */
    const started = await deploy({ repo: repo ?? pushed.repo, branch: branch ?? pushed.branch, name: siteName.trim() || project?.name?.trim() || undefined, sources, sha: pushed.sha });
    if (!started.ok) {
      const plainly = refuse(started.message, started.hint, { stage: "vercel", message: started.message, hint: started.hint, reason: started.reason, status: started.status, code: started.code, reset: started.reset, serverStatus: started.serverStatus, saved });
      useStudio.getState().noteThread([`Vercel would not build it: ${started.message}`]);
      say({ key: "studio:live", title: "Saved, not live yet", body: plainly, level: "error", source: "studio", toast: true });
      return;
    }
    if (started.created) useStudio.getState().noteThread([`Made the Vercel project ${started.created}, connected to ${started.repo}: every push to it deploys on its own now`]);
    /* What the deploy route says about the project, a site left protected among it: a card too, since the top bar shows no note. */
    if (started.note) {
      setNote(started.note);
      say({ key: "studio:live-note", title: "The Vercel project", body: started.note, level: "warn", source: "studio", toast: { durationMs: 12000 } });
    }
    set({ run: { state: started.state, url: started.url, inspectorUrl: started.inspectorUrl, done: false } });

    setBusy("Building…");
    const onState = (st: DeployState) => set({
      run: { state: st.state, url: st.url, inspectorUrl: st.inspectorUrl ?? started.inspectorUrl, done: st.done, message: st.message },
      busy: st.state === "BUILDING" ? "Building…" : st.state === "QUEUED" ? "Queued…" : st.state === null ? "Waiting for Vercel to say…" : "Finishing…",
    });
    const end = project?.id
      ? await followDeployment(project.id, { id: started.id, team: started.team }, onState)
      : await watchDeploy(started.id, { team: started.team, onState });
    if (end.state === "READY" && end.url) {
      set({ refused: null, step: { at: "live", url: end.url, when: Date.now(), deployment: end.inspectorUrl ?? started.inspectorUrl ?? null, commit: pushed.commitUrl ?? null, siteId: here?.id ?? null } });
      useStudio.getState().noteThread([`Live on Vercel at ${end.url.replace(/^https:\/\//, "")}`]);
      say({ key: "studio:live", title: "The site is live", body: end.url, level: "success", source: "studio", toast: true, href: end.url });
      window.dispatchEvent(new CustomEvent("studio:went-live", { detail: { url: end.url, site: siteName.trim() || project?.name?.trim() || "" } }));
    } else {
      const ended = end.state ? end.state.toLowerCase() : "ended without a state";
      const plainly = refuse(`The Vercel build ${ended}: ${end.message ?? "the Vercel log says why."}`, undefined, { stage: end.state === "NOT_STARTED" ? "vercel" : "build", reason: end.reason ?? (end.state === "NOT_STARTED" ? "not-started" : undefined), message: end.message ?? `The Vercel build ${ended}.`, saved });
      useStudio.getState().noteThread([`The Vercel build ${ended}`]);
      say({ key: "studio:live", title: "Saved, not live yet", body: plainly, level: "error", source: "studio", toast: true, href: end.inspectorUrl ?? undefined });
    }
  } finally {
    setBusy(null);
    window.dispatchEvent(new CustomEvent("studio:publish-end"));
  }
}

/* A switch to another site ends the last site's refusal here: it is that site's, not this one's. And a push that went through, from any door, ends it. */
if (typeof window !== "undefined") {
  window.addEventListener("studio:published", clearRefused);
  let was = useBuilds.getState().activeId;
  useBuilds.subscribe((st) => {
    if (st.activeId === was) return;
    was = st.activeId;
    const r = useGoLive.getState().refused;
    if (r && r.siteId !== st.activeId) useGoLive.setState({ refused: null });
    const step = useGoLive.getState().step;
    if (step && step.siteId !== st.activeId && !useGoLive.getState().busy) useGoLive.setState({ step: null });
    const warned = useGoLive.getState().warned;
    if (warned && warned.siteId !== st.activeId) useGoLive.setState({ warned: null });
  });
}
