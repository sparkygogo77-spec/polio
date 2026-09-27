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
import { activeProject, allSources, repoLabel, useBuilds } from "@/features/builds/store";
import { deploy, publish, siteFiles, watchDeploy, type DeployState, type GeneratedFile } from "./agent";
import { compileSpec, specToJson, specToMarkdown } from "./spec";
import { sitePictures, staticSite } from "./staticSite";
import { useStudio } from "./store";

export interface LiveRun { state: string | null; url: string | null; inspectorUrl: string | null; done: boolean; message?: string }
export interface Pushed { url: string; files: number; deployed: boolean; hook: boolean; note?: string }

/**
 * What stopped the last Go live, in the words of whoever stopped it, and a
 * line on the likely fix. Shown on the top-bar button and in the book's row:
 * the first real Go live was refused by Vercel and nothing said so.
 */
export interface Refused { message: string; hint?: string }

/** How the Go live in flight, or the last one, is getting on. */
export const useGoLive = create<{ busy: string | null; run: LiveRun | null; note: string | null; pushed: Pushed | null; refused: Refused | null }>(() => ({
  busy: null,
  run: null,
  note: null,
  pushed: null,
  refused: null,
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
    if (end.state === "READY" && end.url) useBuilds.getState().setLive(projectId, end.url);
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
      : null,
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
  const s = useStudio.getState();
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
 * preview does and reading its markup back (`staticSite`). No key, no
 * model, nothing asked of anybody: pressing publish is now enough to have
 * a website.
 */
export async function collectFiles(described: GeneratedFile[], say: (note: string) => void): Promise<GeneratedFile[]> {
  let pages: GeneratedFile[] = [];
  try {
    pages = staticSite();
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
  try {
    const { files, lost } = await sitePictures();
    shots = files;
    if (lost.length) say(`${lost.length} picture${lost.length === 1 ? " is" : "s are"} no longer in this browser, so ${lost.length === 1 ? "it" : "they"} could not be published. Add ${lost.length === 1 ? "it" : "them"} again on the board.`);
  } catch (err) {
    say(`The pictures could not be read out of this browser (${err instanceof Error ? err.message : "unknown"}), so the pages went up without them.`);
  }
  return [...pages, ...shots, ...described];
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
export async function goLive(o: { extra?: GeneratedFile[]; message: string; siteName: string; say: (t: ToastInput) => void }): Promise<void> {
  if (useGoLive.getState().busy) return;
  const set = useGoLive.setState;
  const setNote = (note: string | null) => set({ note });
  const setBusy = (busy: string | null) => set({ busy });
  set({ busy: "Writing the pages…", note: null, run: null, pushed: null, refused: null });
  /* A refusal is said once, on the row and the top bar (`refused`), not again in the book's note. */
  const refuse = (message: string, hint?: string) => set({ refused: { message, ...(hint ? { hint } : {}) } });
  const { say, siteName } = o;
  try {
    const { project, repo, branch, create, boundTo, sources, refused } = pushTo(siteName);
    if (refused) {
      refuse(refused);
      say({ key: "studio:publish", title: "Not published", body: refused, level: "error", source: "studio", toast: true });
      return;
    }
    const going = await collectFiles([...documentFiles(), ...(o.extra ?? [])], setNote);
    setBusy(`Pushing ${going.length} files to GitHub…`);
    const pushed = await publish({ files: going, message: o.message, deploy: false, repo, branch, create, boundTo, sources });
    remember(project, pushed.created, pushed.ok ? pushed.branch : branch);
    if (!pushed.ok) {
      const says = refusedTarget(project, pushed);
      refuse(`GitHub: ${says}`);
      say({ key: "studio:publish", title: "Publish failed", body: says, level: "error", source: "studio", toast: true });
      return;
    }
    set({ pushed: { url: pushed.commitUrl, files: pushed.files, deployed: false, hook: pushed.hook } });
    useStudio.getState().noteThread([`${pushed.files} files pushed to ${pushed.repo} on ${pushed.branch}`]);

    setBusy("Asking Vercel to build it…");
    /* A repository with no Vercel project gets one on the way, named after
       the site, so this press is the only one needed from board to address. */
    const started = await deploy({ repo: repo ?? pushed.repo, branch: branch ?? pushed.branch, name: siteName.trim() || project?.name?.trim() || undefined, sources });
    if (!started.ok) {
      refuse(started.message, started.hint);
      useStudio.getState().noteThread([`Vercel would not build it: ${started.message}`]);
      say({ key: "studio:live", title: "Not deployed", body: started.hint ? `${started.message} ${started.hint}` : started.message, level: "error", source: "studio", toast: true });
      return;
    }
    if (started.created) useStudio.getState().noteThread([`Made the Vercel project ${started.created}, connected to ${started.repo}: every push to it deploys on its own now`]);
    if (started.note) setNote(started.note);
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
      useStudio.getState().noteThread([`Live on Vercel at ${end.url.replace(/^https:\/\//, "")}`]);
      say({ key: "studio:live", title: "The site is live", body: end.url, level: "success", source: "studio", toast: true, href: end.url });
    } else {
      const ended = end.state ? end.state.toLowerCase() : "ended without a state";
      refuse(`The Vercel build ${ended}: ${end.message ?? "the Vercel log says why."}`);
      useStudio.getState().noteThread([`The Vercel build ${ended}`]);
      say({ key: "studio:live", title: `The build ${ended}`, body: end.message ?? "The Vercel log says why.", level: "error", source: "studio", toast: true, href: end.inspectorUrl ?? undefined });
    }
  } finally {
    setBusy(null);
  }
}
