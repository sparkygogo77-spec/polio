"use client";
/**
 * The repository, in the top bar.
 *
 * A link, and it says what it is linking to. Which repository that is comes
 * from the *site*, not the server: each build on the Builds page carries its
 * own `owner/name`, written there by a connect, a make, or the publish that
 * made it, and read from there by everything. A site with none yet says so,
 * and the tooltip says what the first publish will do rather than asking
 * for a name.
 *
 * "A browser cannot hold a GitHub token that would do anything" is what this
 * file used to say, and it was wrong — it is exactly where the token belongs,
 * for the same reason the Replicate one does: the account is the person's.
 * So the tooltip's advice is the Keys panel now, not the server's
 * environment, and `GITHUB_TOKEN` on the server is the fallback.
 *
 * It reads the same status route the keys panel reads, which reports whether a
 * token would be found and never what it is.
 */
import * as React from "react";
import site from "@site";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { cn } from "@/core/lib/cn";
import { Popover } from "@/core/ui/popover";
import { Input } from "@/core/ui/input";
import { publishStatus, type PublishStatus } from "@/features/studio/agent";
import { activeProject, importedBy, repoFrom, useBuilds } from "@/features/builds/store";
import { useStudio } from "@/features/studio/store";
import { nameRefusal, repoNameFor } from "@/features/studio/repoName";
import { heldKeys, useKeys } from "@/features/keys/store";
import { readRepo, repoName, REPO_REFUSAL_SAYS } from "@/features/studio/repoImport";
import { boardIsHere, keepBringForBoard, placeBring } from "@/features/studio/bringRepo";
import { staleBuild, staleSays } from "@/core/shell/BuildGuard";
import { useActions } from "@/core/actions";
import { useRouter } from "next/navigation";
import type { BranchRow } from "@/app/api/studio/branches/route";

/**
 * The GitHub mark.
 *
 * Drawn here because the icon set this project uses dropped brand marks, and
 * a button meant to be recognised at a glance has to wear the real one — a
 * generic branch glyph is not the same button.
 */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function GithubButton() {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<PublishStatus | null>(null);
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const project = projects.find((p) => p.id === activeId) ?? null;

  /*
   * WHETHER A PUBLISH CAN PUSH is asked again whenever the keys change.
   *
   * It was asked once, when the bar mounted. A token put in the Keys panel
   * after that left this saying "no token, so a publish cannot push" while
   * the panel below it listed his private repositories with that very
   * token: both read the same held key, one of them a page load too early.
   */
  React.useEffect(() => {
    let alive = true;
    const ask = () => { void publishStatus().then((s) => { if (alive) setStatus(s); }); };
    ask();
    const off = useKeys.subscribe(ask);
    return () => { alive = false; off(); };
  }, []);

  /* THE SITE'S OWN REPOSITORY, AND NOTHING ELSE. The server's used to stand
     in here when the site had none, so a scratch site read as aimed at the
     real repository, and it was. A site with none says so, and its first
     publish makes one of its own. */
  const mine = project?.repo ? `${project.repo.owner}/${project.repo.name}` : null;
  const name = mine;
  const url = name ? `https://github.com/${name}` : (site.repository ?? null);
  const canPush = status?.github?.configured === true;
  const where = status?.github?.token ?? null;

  const label = !canPush
    ? name
      ? `${name} — no GitHub token, so Publish cannot push. Put one in the Keys panel, or set GITHUB_TOKEN on the server.`
      : "No GitHub token yet. Put one in the Keys panel and the first Publish makes this site a repository of its own."
    : name
      ? `${name} · ${project?.repo?.branch ?? "main"} — Publish pushes here, with ${where === "browser" ? "your own token" : "the server's token"}.`
      : `No repo of its own yet. The first Publish makes a private repository named after this site and pushes to it, with ${where === "browser" ? "your own token" : "the server's token"}.`;

  /* Nothing to open and nothing yet to describe: before a site is published
     and with no token anywhere, this button has nothing to say. */
  if (!url && !canPush) return null;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      content={<RepoPanel own={mine} branch={project?.repo?.branch ?? null} canPush={canPush} onDone={() => setOpen(false)} />}
    >
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon"
        /* "GitHub" stays in the name whatever state this is in: it is the
           GitHub button, and something looking for it by name — a screen
           reader, or the keys suite — should find it before a repository
           exists as readily as after. */
        aria-label={name ? `Open ${name} on GitHub` : "GitHub: this site has no repository yet"}
        data-github-button=""
        data-repo={name ?? ""}
        className="relative"
        /* `aria-disabled`, not `disabled`: a disabled button takes no pointer
           events, and with no repository yet the tooltip is the entire point
           of this control — it is the only place that says the first publish
           will make one. */
        /*
         * IT OPENS THE REPOSITORY CONTROL, it does not leave the product.
         *
         * His words: "this should be what the github icon does in the top
         * instead of taking me to my profile". It was a link to
         * `github.com/${name}`, and with no name resolved it fell back to
         * `site.repository` — which is how pressing it landed him on a
         * profile page. Connecting a repository existed and was unreachable;
         * making one did not exist at all. Both are here now, and the repo
         * this site points at is the first line of it.
         */
        onClick={() => setOpen((v) => !v)}
      >
        <GithubMark className={cn("size-3.5", canPush ? "text-fg" : "text-fg-muted")} />
        {canPush ? null : (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-fg-faint" />
        )}
      </Button>
    </Tooltip>
    </Popover>
  );
}

/**
 * THE ONE PLACE FOR REPOSITORIES: the one this points at, another, or a new one.
 *
 * Three things, in the order he asked for them and in his own word for them.
 * He calls them repos, so this says repos.
 *
 *   · **Where this site goes.** The repository a publish pushes to, and the
 *     branch. Null means the server's own, which is what every publish used
 *     before there was a choice, and it says so rather than looking empty.
 *   · **Connect a different one.** His repositories, newest pushed first,
 *     read with his own token. A list rather than a box to type in, because
 *     the name is something he has rather than something he remembers.
 *   · **Make a new one.** The thing that was not possible. Private, with a
 *     first commit so the next publish has something to push onto, under the
 *     token's own owner — his account, not one this file picked.
 *
 * No key of his is stored here. The token rides with the call out of the
 * Keys panel, in his browser, exactly as it does for a publish.
 */
function RepoPanel({ own, branch, canPush, onDone }: { own: string | null; branch: string | null; canPush: boolean; onDone: () => void }) {
  /* The site's own, or nothing: there is no other repository a publish goes to. */
  const pointsAt = own;
  const siteName = useStudio((s) => s.brief?.name ?? "");
  const [mine, setMine] = React.useState<{ name: string; private: boolean; branch?: string }[] | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const [making, setMaking] = React.useState(false);
  const [bring, setBring] = React.useState("");
  const [pulling, setPulling] = React.useState(false);
  const [name, setName] = React.useState(() => repoNameFor(siteName));
  const siteBranch = useStudio((s) => s.siteBranch);
  const [merging, setMerging] = React.useState(false);
  const ctx = useActions();
  const router = useRouter();
  const [branches, setBranches] = React.useState<{ base: string; rows: BranchRow[]; more: number } | null>(null);
  const [branchSaid, setBranchSaid] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  /*
   * MAIN MOVES HERE AND NOWHERE ELSE, by his hand on this button. The
   * merge route does GitHub's own merge of the edit branch into the
   * default branch and deletes the branch; the document then forgets it,
   * so the next edit opens a fresh one. Confirmed first, because it is the
   * one thing on this panel that cannot be undone.
   */
  const merge = async () => {
    const repo = pointsAt;
    if (!repo || !siteBranch || merging) return;
    setMerging(true);
    setSaid(null);
    try {
      const res = await fetch("/api/studio/merge", { method: "POST", headers: { "content-type": "application/json", ...token() }, body: JSON.stringify({ repo, branch: siteBranch }) });
      const a = await res.json();
      if (!a.ok) { setSaid(a.message ?? "GitHub would not merge it."); return; }
      useStudio.getState().setSiteBranch(null);
      setSaid(a.message ?? `Merged ${siteBranch}.`);
      void listBranches();
    } catch {
      setSaid("Could not reach GitHub from here.");
    } finally {
      setMerging(false);
    }
  };

  /* His own token if the Keys panel is holding one, and nothing otherwise —
     the route falls back to the server's, exactly as a publish does. */
  const token = (): Record<string, string> => {
    const held = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
    return held ? { "x-github-token": held } : {};
  };

  /*
   * THE BRANCH LIST. He cleans branches up by hand today, on GitHub. Every
   * edit opens one and every merge closes one, so the ones left are the
   * ones opened and walked away from, and the question about each is the
   * same: does main already have its work, and if not, how much is there.
   * That is what each row shows, in numbers, and nothing is counted here.
   */
  const listBranches = React.useCallback(async () => {
    if (!pointsAt) { setBranches(null); return; }
    setBranchSaid(null);
    try {
      const res = await fetch(`/api/studio/branches?repo=${encodeURIComponent(pointsAt)}`, { headers: token(), cache: "no-store" });
      const a = await res.json();
      if (!a.ok) { setBranches(null); setBranchSaid(a.message ?? "GitHub would not list the branches."); return; }
      setBranches({ base: String(a.base ?? "main"), rows: (a.branches ?? []) as BranchRow[], more: Number(a.more ?? 0) });
    } catch {
      setBranches(null);
      setBranchSaid("Could not reach GitHub from here.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsAt]);
  React.useEffect(() => { void listBranches(); }, [listBranches]);

  /*
   * DELETE IS THE ONE THING HERE THAT CANNOT BE UNDONE, so it wears the
   * same red ring the Merge button does, and the question it asks names
   * the branch and what goes with it: nothing, when main already has its
   * work, or the updates and lines that were never merged. Deleting the
   * branch this site's edits are on closes it here too, so the next edit
   * opens a fresh one rather than publishing to a branch that is gone.
   */
  const remove = async (row: BranchRow) => {
    if (!pointsAt || removing) return;
    const asks = row.updates > 0
      ? `Delete ${row.name}? Its ${row.updates} update${row.updates === 1 ? "" : "s"} (+${row.added} −${row.removed}) are not in ${branches?.base ?? "main"} and go with it.`
      : `Delete ${row.name}? Everything in it is already in ${branches?.base ?? "main"}.`;
    if (!window.confirm(asks)) return;
    setRemoving(row.name);
    setBranchSaid(null);
    try {
      const res = await fetch("/api/studio/branches", { method: "DELETE", headers: { "content-type": "application/json", ...token() }, body: JSON.stringify({ repo: pointsAt, branch: row.name }) });
      const a = await res.json();
      if (!a.ok) { setBranchSaid(a.message ?? `GitHub would not delete ${row.name}.`); return; }
      if (row.name === siteBranch) useStudio.getState().setSiteBranch(null);
      setBranches((b) => (b ? { ...b, rows: b.rows.filter((r) => r.name !== row.name) } : b));
      setBranchSaid(a.message ?? `Deleted ${row.name}.`);
    } catch {
      setBranchSaid("Could not reach GitHub from here.");
    } finally {
      setRemoving(null);
    }
  };

  React.useEffect(() => {
    let live = true;
    void fetch("/api/studio/repo", { headers: token(), cache: "no-store" })
      .then((r) => r.json())
      .then((a) => { if (!live) return; if (a.ok) setMine(a.repos ?? []); else setSaid(a.message ?? null); })
      .catch(() => { if (live) setSaid("Could not reach GitHub from here."); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * CONNECTING WRITES THE BUILDS STORE, and nothing else.
   *
   * It used to write `siteRepo` on the document, which nothing that shows
   * a site's repository read: the Sites list, the Builds page and Publish
   * all read `project.repo`, so a connected site said "no repository" and
   * its first publish made a second repository named after the site. One
   * place now, with the branch, so every surface agrees the moment this
   * lands. A Builder with no site adopted yet takes one first.
   */
  /*
   * THE LOCK. A site is bound to one repository. Pointing a bound site at
   * another is deliberate: a confirmation naming both, never a click on a
   * list. A repository another site was brought in from belongs to that
   * site, and no other site may be pointed at it: an existing design must
   * never overwrite a repository he imported.
   */
  const connect = (full: string, onBranch: string, how: "connected" | "made" = "connected"): boolean => {
    const repo = repoFrom(full, onBranch);
    if (!repo) { setSaid(`${full} is not an owner/name, so it cannot be connected.`); return false; }
    let project = activeProject();
    if (!project) { useBuilds.getState().adopt(); project = activeProject(); }
    if (!project) { setSaid("There is no site open to connect it to."); return false; }
    const theirs = importedBy(full, project.id);
    if (theirs) { setSaid(`${full} belongs to the site ${theirs.name}, which was brought in from it. Open that site to publish to it.`); return false; }
    const current = project.repo ? `${project.repo.owner}/${project.repo.name}` : null;
    if (current && current.toLowerCase() !== full.toLowerCase()) {
      if (!window.confirm(`Move this site from ${current} to ${full}? Publishes go to ${full} from now on, and ${current} is left as it is.`)) return false;
    }
    useBuilds.getState().setRepo(project.id, repo, how);
    return true;
  };

  const make = async () => {
    const refusal = nameRefusal(name);
    if (refusal) { setSaid(refusal); return; }
    setMaking(true);
    setSaid(null);
    try {
      const res = await fetch("/api/studio/repo", { method: "POST", headers: { "content-type": "application/json", ...token() }, body: JSON.stringify({ name }) });
      const a = await res.json();
      if (!a.ok) { setSaid(a.message ?? "GitHub would not make it."); return; }
      if (connect(String(a.name), String(a.branch ?? "main"), "made")) setSaid(`Made ${a.name}. This site points at it now.`);
    } catch {
      setSaid("Could not reach GitHub from here.");
    } finally {
      setMaking(false);
    }
  };

  /**
   * Bring one of his other sites in.
   *
   * THIS DOES NOT FETCH ANYTHING ITSELF, and the first version of it did,
   * which was a mistake worth naming. `repoImport.ts` and `repoRun.ts`
   * already do this, and they do it a better way: the files are fetched
   * **by the browser, with his own token**, packed into a zip there, and
   * handed to the zip route \u2014 so nothing about the token ever reaches our
   * server. A second copy that fetched them server-side would have sent his
   * token across for no gain.
   *
   * What was actually missing was not the import. It was the way IN: the
   * importer lives on a drawn space's panel, so the only way to reach it was
   * to draw a space first. So this is a door. It checks the name, makes the
   * surface the site will land on, and opens the importer on it with the
   * repository already filled in.
   */
  const bringIn = () => {
    const want = bring.trim();
    if (!want || pulling) return;
    /* Never quietly on a stale page: a press on an older build than the
       server loads code the server no longer has, and ends in nothing. */
    if (staleBuild()) { setSaid(staleSays()); return; }
    const repo = readRepo(want);
    /* A bound site brings in its own repository and no other. */
    if (repo && own && `${repo.owner}/${repo.name}`.toLowerCase() !== own.toLowerCase()) { setSaid(`This site belongs to ${own}. Make a new site to bring ${repo.owner}/${repo.name} in.`); return; }
    if (!repo) { setSaid(REPO_REFUSAL_SAYS["not-a-repo"]); return; }
    if (!heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN) { setSaid(REPO_REFUSAL_SAYS["no-token"]); return; }
    setPulling(true);
    try {
      /* The surface it lands on, made here so he does not have to draw one
         first. The importer resizes it to the page's own proportion. */
      /*
       * ON THE BOARD, OR ON THE WAY TO IT. This control is on every page's
       * top bar, the Builds page included, and pressed there it used to put
       * a space into a store that was not loaded, with no board to show it
       * and no panel to run the import: nothing landed and nothing was
       * said. Now the request is placed when the board is here, and kept
       * for the board and the Builder opened when it is not. Said as a
       * toast either way, because this panel closes and the space's own
       * panel is a narrow aside he may not be looking at.
       */
      if (boardIsHere()) {
        placeBring(want);
        ctx.publish({ key: `studio:repo:${repo.name}`, title: `Reading ${repoName(repo)}`, body: "It lands in a space on the board, and the space's panel says how it is going.", level: "info", source: "studio", toast: { durationMs: 5000 } });
      } else {
        keepBringForBoard(want);
        ctx.publish({ key: `studio:repo:${repo.name}`, title: `Opening the board to bring ${repoName(repo)} in`, body: "It lands in a space there, and the space's panel says how it is going.", level: "info", source: "studio", toast: { durationMs: 5000 } });
        router.push("/builder");
      }
      onDone();
    } finally {
      setPulling(false);
    }
  };

  const row = "flex items-center gap-1.5 text-[11px]";
  return (
    <div data-repo-panel="" className="flex w-[260px] flex-col gap-2">
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">The repo this site goes to</p>
        {/* A site with none says so in words. It never wears the server's
            name as if it were its own, and never shows a blank. */}
        <p data-repo-points="" data-repo-own={own ?? ""} className={cn("truncate text-[12px] font-medium", own ? "text-fg" : "text-fg-muted")}>
          {own ?? "No repo of its own yet"}
        </p>
        <p className="text-[10px] text-fg-muted">
          {own
            ? `on ${branch ?? "main"}${canPush ? "" : " — no token, so a publish cannot push"}`
            : "The first publish makes a private one named after this site, unless you pick a repo below."}
        </p>
      </div>

      {siteBranch && pointsAt ? (
        <div data-repo-branch={siteBranch} className="rounded-md border px-2 py-1.5" style={{ borderColor: "oklch(0.7 0.15 18 / 0.45)", background: "oklch(0.7 0.15 18 / 0.08)" }}>
          <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">Edits are on a branch</p>
          <p className="truncate font-mono text-[11px] text-fg" title={siteBranch}>{siteBranch}</p>
          <p className="mt-0.5 text-[10px] text-fg-muted">
            The running site stays on main until you merge. Look first:{" "}
            <a className="text-accent underline-offset-2 hover:underline" href={`https://github.com/${pointsAt}/tree/${encodeURIComponent(siteBranch)}`} target="_blank" rel="noreferrer">the branch on GitHub</a>
            {" "}— and Vercel deploys it at a preview address of its own on every publish.
          </p>
          <Button
            size="sm"
            variant="outline"
            data-repo-merge=""
            disabled={merging}
            className="mt-1.5 w-full"
            style={{ borderColor: "oklch(0.72 0.17 18)", color: "oklch(0.8 0.16 18)" }}
            onClick={() => { if (window.confirm(`Merge ${siteBranch} into main? The running site changes.`)) void merge(); }}
          >
            {merging ? "Merging…" : "Merge into main"}
          </Button>
        </div>
      ) : null}

      {pointsAt ? (
        <>
          <div className="h-px bg-border" />
          <div data-repo-branches="">
            <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">Branches besides {branches?.base ?? "main"}</p>
            {branches === null ? (
              <p className="text-[10px] text-fg-muted">{branchSaid ?? "Asking GitHub…"}</p>
            ) : branches.rows.length === 0 ? (
              <p className="text-[10px] text-fg-muted">None. Every edit branch has been merged or removed.</p>
            ) : (
              <ul className="max-h-[152px] overflow-y-auto">
                {branches.rows.map((r) => {
                  const unmerged = r.updates > 0;
                  const here = r.name === siteBranch;
                  return (
                    <li key={r.name} data-repo-branch-row={r.name} data-repo-branch-unmerged={unmerged ? "1" : "0"} className="flex items-center gap-1.5 py-0.5">
                      {/* The mark is the decision: amber for work main has not got, faint for a branch main already holds. */}
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: unmerged ? "oklch(0.8 0.15 75)" : "oklch(0.6 0.02 260 / 0.5)" }} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate font-mono text-[10px]", unmerged ? "text-fg" : "text-fg-muted")} title={r.name}>{r.name}{here ? " · open here" : ""}</span>
                        <span className="block text-[10px] text-fg-faint">
                          {r.updates < 0
                            ? "GitHub would not compare it"
                            : unmerged
                              ? <>{r.updates} update{r.updates === 1 ? "" : "s"} not in {branches.base} · <span style={{ color: "oklch(0.78 0.16 145)" }}>+{r.added}</span> <span style={{ color: "oklch(0.75 0.17 25)" }}>−{r.removed}</span></>
                              : `everything in ${branches.base}`}
                        </span>
                      </span>
                      <Button
                        size="xs"
                        variant="outline"
                        data-repo-branch-delete={r.name}
                        disabled={removing !== null}
                        className="shrink-0"
                        style={{ borderColor: "oklch(0.72 0.17 18)", color: "oklch(0.8 0.16 18)" }}
                        onClick={() => void remove(r)}
                      >
                        {removing === r.name ? "Deleting…" : "Delete"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {branches && branches.more > 0 ? <p className="text-[10px] text-fg-faint">And {branches.more} more on GitHub.</p> : null}
            {branches !== null && branchSaid ? <p data-repo-branch-said="" className="text-[10px] text-fg">{branchSaid}</p> : null}
          </div>
        </>
      ) : null}

      <div className="h-px bg-border" />

      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">{own ? "Move to a different repo" : "Connect a repo"}</p>
        {own ? <p data-repo-bound="" className="mb-0.5 text-[10px] text-fg-muted">This site belongs to {own}. Moving it asks first.</p> : null}
        {mine === null ? (
          <p className="text-[10px] text-fg-muted">{said ?? "Asking GitHub…"}</p>
        ) : mine.length === 0 ? (
          <p className="text-[10px] text-fg-muted">No repos on this account yet.</p>
        ) : (
          <div className="max-h-[128px] overflow-y-auto">
            {mine.map((r) => (
              <button
                key={r.name}
                type="button"
                data-repo-connect={r.name}
                onClick={() => { if (connect(r.name, r.branch ?? "main")) onDone(); }}
                className={cn("tactile flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-[11px]", own === r.name ? "text-fg" : "text-fg-muted hover:text-fg")}
              >
                <span className="truncate">{r.name}</span>
                {r.private ? <span className="shrink-0 text-[9px] text-fg-faint">private</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">Make a new repo</p>
        <div className={row}>
          <Input
            inputSize="sm"
            data-repo-new=""
            value={name}
            aria-label="Name for the new repo"
            placeholder="a-name"
            className="h-6 text-[11px]"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void make(); } }}
          />
          <Button size="sm" variant="primary" data-repo-make="" disabled={making} onClick={() => void make()}>
            {making ? "Making…" : "Make"}
          </Button>
        </div>
        <p className="mt-0.5 text-[10px] text-fg-muted">Private, on your own account, with a first commit so a publish has somewhere to land.</p>
      </div>

      <div className="h-px bg-border" />

      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">Bring a repo in</p>
        <div className={row}>
          <Input
            inputSize="sm"
            data-repo-bring=""
            value={bring}
            aria-label="The repo to bring in"
            placeholder="owner/name"
            className="h-6 text-[11px]"
            onChange={(e) => setBring(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void bringIn(); } }}
          />
          <Button size="sm" variant="outline" data-repo-pull="" disabled={pulling || !bring.trim()} onClick={() => void bringIn()}>
            {pulling ? "Reading\u2026" : "Bring it"}
          </Button>
        </div>
        <p className="mt-0.5 text-[10px] text-fg-muted">A repo with a page in it comes in as ordinary parts. A repo of sources is read at the address it is deployed at, from About on GitHub or from a publish made here, and says so if it has none.</p>
      </div>

      {said ? <p data-repo-said="" className="text-[10px] text-fg">{said}</p> : null}
    </div>
  );
}
