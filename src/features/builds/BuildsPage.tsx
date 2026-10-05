"use client";
/**
 * Builds — the first screen, and the only one that is about *which* site.
 *
 * What was here before was a changelog: a version badge, three lines of what
 * changed, and a door into the Builder. The changelog is retired, and the
 * question this screen should answer is the one the Builder cannot: there is
 * more than one thing being made, and only one of them is open.
 *
 * So the page is a list. Two sides of the same list, in fact, because a
 * project is two things at once — a document in this browser, and a
 * repository it publishes to — and swapping either is one press:
 *
 *   Sites  the documents. Press one and the Builder is on it.
 *   Repos  where each one publishes. Press one and the next publish goes there.
 *
 * SIDE BY SIDE, NEVER A TAB. His words: "the repos page should also be
 * available since there is much space". The two sides were a switch over one
 * narrow column with most of the screen empty beside it; now the sites take
 * the page, pictures first, and the repos sit in a column beside them.
 *
 * HIS LIST, NOT A FIELD. "I shouldn't have to type it in, it should access
 * my list since my token is in." With his GitHub key held, his repositories
 * are read once (`/api/studio/repo`, the same route the repo menu reads) and
 * offered under each site's field; typing owner/name stays as the fallback.
 *
 * The only call this page makes is that list. A project is local until it
 * is published.
 */
import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FolderGit2,
  Globe,
  KeyRound,
  LayoutTemplate,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import site from "@site";
import { BuildMark } from "./BuildMark";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Tooltip } from "@/core/ui/tooltip";
import { EmptyState } from "@/core/ui/empty-state";
import { cn } from "@/core/lib/cn";
import { fmtAge } from "@/core/lib/format";
import { ctxProps } from "@/core/context-menu/ctx";
import { useTour } from "@/features/tour/store";
import { docOf, docOfStored, shapeOf, repoLabel as labelOf, sharedTargetSays, sourceOf, sourceWords, targetKey, targetWords, useBuilds, type Project } from "./store";
import { SitePreview } from "@/features/studio/SitePreview";
import { Dialog } from "@/core/ui/dialog";
import { SiteThumb, ThumbMaker } from "./thumbs";
import { changeState } from "./publishState";
import { useActions } from "@/core/actions";
import { PublishLinks } from "@/features/studio/PublishLinks";
import { downloadBackup, pickAndLoadBackup } from "@/features/studio/backup";
import { LearnedButton, LearnedDialog } from "@/features/studio/LearnedPanel";
import { askRoute, token as githubToken } from "@/features/studio/RepoPicker";
import { keysReady, useKeys } from "@/features/keys/store";

/** "owner/name" if it looks like one, else nothing. */
function parseRepo(text: string): { owner: string; name: string } | null {
  const s = text.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(s);
  return m ? { owner: m[1]!, name: m[2]! } : null;
}

const repoLabel = (p: Project) => (p.repo ? `${p.repo.owner}/${p.repo.name}` : "");

/* ------------------------------------------------------------------ */
/* A row                                                               */
/* ------------------------------------------------------------------ */

/**
 * A site, as a card.
 *
 * It was a row: an icon, a name, and "4 pages · 21 parts". Counts say what is
 * in a project and nothing about *which* project — you know your own sites by
 * what they look like, so the card leads with the site itself, drawn live
 * (`SitePreview`), and the name and the things you can do to it sit under it.
 */
function SiteCard({ project, active }: { project: Project; active: boolean }) {
  const { open, rename, duplicate, remove } = useBuilds();
  const ctx = useActions();
  const sharedSays = useBuilds((s) => sharedTargetSays(s.projects, project.id));
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(project.name);
  const [preview, setPreview] = React.useState(false);

  // Read on every render rather than held: a switch changes what is in the
  // live key, and a document from before the switch is the wrong one.
  const quick = docOf(project.id, active);
  /*
   * A SITE TOO BIG FOR THE MIRROR IS STILL COUNTED AND DRAWN. Its mirror is
   * a pointer that carries its page and part counts, and its document is in
   * IndexedDB: the counts come off the pointer at once, and the document is
   * read for the picture. Reading only the mirror's document, these cards
   * said "nothing in it yet" over thousands of parts.
   */
  const pointed = quick ? null : shapeOf(project.id, active);
  const [stored, setStored] = React.useState<{ id: string; doc: ReturnType<typeof docOf> } | null>(null);
  React.useEffect(() => {
    if (quick || !pointed?.parts) return;
    let alive = true;
    void docOfStored(project.id, active).then((d) => { if (alive) setStored({ id: project.id, doc: d }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, active, project.updatedAt, !!quick, pointed?.parts]);
  const doc = quick ?? (stored?.id === project.id ? stored.doc : null);
  const shape = doc ? { pages: doc.pages?.length ?? 0, parts: doc.nodes?.length ?? 0 } : { pages: pointed?.pages ?? 0, parts: pointed?.parts ?? 0 };

  const commit = () => {
    rename(project.id, draft);
    setEditing(false);
  };
  const changes = changeState(project);
  const [backingUp, setBackingUp] = React.useState(false);
  const backup = async () => {
    setBackingUp(true);
    try {
      const r = await downloadBackup(project.id);
      ctx.publish({ key: "builds:backup", title: r.ok ? "Backup downloaded" : "No backup made", body: r.says, level: r.ok ? "success" : "warn", source: "builds", toast: true });
    } finally { setBackingUp(false); }
  };

  return (
    <li
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
        active
          ? "border-accent/55 bg-accent-soft/25 shadow-[0_0_0_1px_var(--accent-soft),0_0_36px_-14px_var(--accent)]"
          : "border-border bg-panel hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_22px_44px_-24px_rgb(0_0_0/0.75)] motion-reduce:hover:translate-y-0",
      )}
      {...ctxProps("builds", "project", project.id)}
    >
      {/* The site. Pressing it is the same as pressing Open or Switch: the
          picture is the door, and a picture you cannot press is a poster. */}
      <button
        type="button"
        onClick={() => (active ? undefined : open(project.id))}
        aria-label={active ? `${project.name}, the open site` : `Switch to ${project.name}`}
        className="relative block aspect-[15/7] w-full cursor-pointer overflow-hidden border-b border-border bg-elevated/40 p-0 text-left"
      >
        {/* A picture of the site, made once and kept (`thumbs.tsx`): one image, never a keyboard stop. The live render is Preview's. */}
        <SiteThumb id={project.id} doc={doc} />
        {active ? (
          <span className="absolute left-2 top-2 rounded-full border border-accent/40 bg-panel/85 px-2 py-0.5 text-small text-accent backdrop-blur">
            open
          </span>
        ) : null}
      </button>
      {/* Beside the picture's button, never inside it: a link in a button is two presses in one place, and the live site opens in a new tab with the Builder left where it was. */}
      {project.live ? (
        <a
          data-card-live=""
          href={project.live.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Live ${fmtAge(project.live.at)} ago, opens in a new tab`}
          className="absolute right-2 top-2 z-[1] inline-flex items-center gap-1 rounded-full border border-up/30 bg-panel/85 px-1.5 py-0.5 text-small text-up backdrop-blur"
        >
          Live
          <ExternalLink className="size-2.5" />
        </a>
      ) : null}

      {/* Its name, and what you can do to it. */}
      {/* `flex-1`, or `mt-auto` on the options bar has no room to work in
          and the bars sit wherever each card's own words happened to end. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(project.name); setEditing(false); }
            }}
            className="h-6 text-xs"
            aria-label="Name of this site"
          />
        ) : (
          <span
            onDoubleClick={() => { setDraft(project.name); setEditing(true); }}
            className="block max-w-full truncate text-sm font-semibold tracking-tight text-fg"
          >
            {project.name}
          </span>
        )}

        <p className="flex flex-wrap items-center gap-x-1.5 text-plain text-fg-muted">
          {/* A site nobody has opened yet has no document at all, which is not
              the same as a document with nothing in it. */}
          {shape.pages === 0 && shape.parts === 0 ? (
            <span>nothing in it yet</span>
          ) : (
            <>
              <span className="num">{shape.pages}</span> {shape.pages === 1 ? "page" : "pages"}
              <span className="text-fg-faint">·</span>
              <span className="num">{shape.parts}</span> {shape.parts === 1 ? "part" : "parts"}
            </>
          )}
          <span className="text-fg-faint">·</span>
          <span>{active ? "open now" : `${fmtAge(project.updatedAt)} ago`}</span>
        </p>

        {project.repo ? (
          <p className="flex min-w-0 items-center gap-1 truncate text-small text-fg-faint">
            <FolderGit2 className="size-3 shrink-0" />
            {repoLabel(project)}
            <span className="text-fg-faint/70">· {project.repo.branch}</span>
          </p>
        ) : null}
        {project.source ? (
          <p data-card-source="" className="min-w-0 truncate text-small text-fg-faint">from {labelOf(project.source)}</p>
        ) : null}
        {sharedSays ? <p data-card-shared="" title={sharedSays} className="line-clamp-2 text-small text-warning">{sharedSays}</p> : null}
        {/* Changed since it was published? Off the site's own record, never the document (`publishState.ts`). */}
        <p data-card-changes={changes.kind} title={changes.says} className={cn("line-clamp-2 text-small", changes.kind === "unpublished" ? "text-warning" : "text-fg-faint")}>
          {changes.says}
        </p>
        {/* The last publish's two pages, from what that publish answered. */}
        <PublishLinks deployment={project.live?.inspectorUrl} commit={project.published?.commitUrl} />

        {/* The options bar. Everything that can be done to this site, in one
            row under it, rather than appearing on hover somewhere else. Pushed
            to the foot, so the bars line up across a row of cards whatever
            each one had to say above them. */}
        <div data-card-options="" className="mt-auto flex items-center gap-1 border-t border-border pt-1.5">
          <Tooltip content="Rename">
            <Button variant="ghost" size="iconXs" aria-label="Rename this site" onClick={() => { setDraft(project.name); setEditing(true); }}>
              <Pencil />
            </Button>
          </Tooltip>
          <Tooltip content="Duplicate">
            <Button variant="ghost" size="iconXs" aria-label="Duplicate this site" onClick={() => duplicate(project.id)}>
              <Copy />
            </Button>
          </Tooltip>
          <Tooltip content={active ? "The open site cannot be deleted from under you" : "Delete"}>
            <Button
              variant="ghost"
              size="iconXs"
              aria-label="Delete this site"
              disabled={active}
              onClick={() => remove(project.id)}
              className="hover:text-down"
            >
              <Trash2 />
            </Button>
          </Tooltip>
          <Tooltip content="Download a backup: one file with this site and its pictures">
            <Button variant="ghost" size="iconXs" aria-label={`Download a backup of ${project.name}`} data-card-backup="" loading={backingUp} onClick={() => void backup()}>
              <Download />
            </Button>
          </Tooltip>
          <Tooltip content="Preview: the site drawn live, closed with Escape">
            <Button variant="ghost" size="iconXs" aria-label={`Preview ${project.name}`} data-card-preview="" disabled={!doc?.pages?.length} onClick={() => setPreview(true)}>
              <Eye />
            </Button>
          </Tooltip>
          <span className="flex-1" />
          {preview ? <PreviewDialog name={project.name} doc={doc} onClose={() => setPreview(false)} /> : null}
          {active ? (
            <Button asChild size="sm" variant="primary">
              <Link href="/builder">
                <LayoutTemplate />
                Open
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => open(project.id)}>
              Switch
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The site drawn live, on demand: the render the card used to carry all the
 * time, now only while someone is looking at it. Escape or a press outside
 * closes it, and it is gone from the page again.
 */
function PreviewDialog({ name, doc, onClose }: { name: string; doc: ReturnType<typeof docOf>; onClose: () => void }) {
  const [width] = React.useState(() => (typeof window === "undefined" ? 960 : Math.max(280, Math.min(990, window.innerWidth - 64))));
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }} size="xl" title={`Preview of ${name}`} description="The site as it is drawn now. Escape closes it.">
      <div data-site-preview-live="" className="max-h-[72vh] overflow-y-auto overflow-x-hidden rounded-md border border-border">
        <SitePreview doc={doc} width={width} height={Math.round(width * 0.6)} whole />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* The repository side                                                 */
/* ------------------------------------------------------------------ */

/*
 * THE SERVER'S REPOSITORY IS NOT THIS SITE'S, and this row never wears it.
 *
 * It used to sit in the empty field as the placeholder, with the server's
 * branch filled in beside it and a line saying Publish would push there. A
 * brand new site read as already aimed at the real repository, because it
 * was. A site with none says so now, and its first publish makes one of its
 * own. The field keeps an edit on blur as well as on Enter and the button:
 * a field that shows a value is that value.
 */
/** One of his repositories, as `/api/studio/repo` lists them. */
interface Mine { name: string; private: boolean; pushed?: string | null; branch?: string }

/** What the repo column knows about his list: still reading, read, or why not. */
type MyRepos =
  | { state: "reading" }
  | { state: "read"; repos: Mine[]; owner: string | null; withKey: boolean }
  | { state: "none"; says: string; locked: boolean };

/*
 * HIS LIST, READ ONCE FOR THE WHOLE PAGE.
 *
 * Read with his key when the browser holds it (`x-github-token`, as every
 * publish reads it), the server's token otherwise, exactly as the repo menu
 * reads it. The key relocks after five idle minutes; a list read with it is
 * taken down then, with the reason, rather than left standing under a key
 * that is locked.
 */
function useMyRepos(): MyRepos {
  const unlocked = useKeys((s) => s.unlocked && !!s.values.GITHUB_TOKEN);
  const stored = useKeys((s) => s.exists);
  const [mine, setMine] = React.useState<MyRepos>({ state: "reading" });
  const readWithKey = React.useRef(false);
  React.useEffect(() => {
    if (!unlocked && readWithKey.current) {
      readWithKey.current = false;
      setMine({ state: "none", locked: true, says: "Your key locked again after five minutes idle. Unlock it in Keys and your repos come back." });
      return;
    }
    let alive = true;
    setMine({ state: "reading" });
    void keysReady()
      .then(() => askRoute<{ repos?: Mine[]; owner?: string | null; reason?: string }>("/api/studio/repo", { headers: githubToken(), cache: "no-store" }))
      .then((a) => {
        if (!alive) return;
        const withKey = !!githubToken()["x-github-token"];
        if (a.ok && a.repos) { readWithKey.current = withKey; setMine({ state: "read", repos: a.repos, owner: a.owner ?? null, withKey }); }
        else setMine({ state: "none", locked: stored && !withKey && a.reason === "no-token", says: stored && !withKey && a.reason === "no-token" ? "Your GitHub key is saved but locked. Unlock it in Keys and your repos list here." : a.message ?? "GitHub did not answer with a list." });
      });
    return () => { alive = false; };
  }, [unlocked, stored]);
  return mine;
}

/*
 * THE SERVER'S REPOSITORY IS NOT THIS SITE'S, and this row never wears it.
 *
 * It used to sit in the empty field as the placeholder, with the server's
 * branch filled in beside it and a line saying Publish would push there. A
 * brand new site read as already aimed at the real repository, because it
 * was. A site with none says so now, and its first publish makes one of its
 * own. The field keeps an edit on blur as well as on Enter and the button:
 * a field that shows a value is that value.
 *
 * With his list read, the field is also a search over it: pressing into it
 * opens his repositories under it, newest first, and pressing one sets it
 * with its own default branch. Nothing to type.
 */
function RepoRow({ project, active, mine }: { project: Project; active: boolean; mine: Mine[] | null }) {
  const { setRepo } = useBuilds();
  const saveFailed = useBuilds((s) => s.saveFailed);
  const projects = useBuilds((s) => s.projects);
  const [draft, setDraft] = React.useState(repoLabel(project));
  const [branch, setBranch] = React.useState(project.repo?.branch ?? "main");
  const [saved, setSaved] = React.useState(false);
  const [listing, setListing] = React.useState(false);

  React.useEffect(() => { setDraft(repoLabel(project)); setBranch(project.repo?.branch ?? "main"); }, [project]);

  const parsed = parseRepo(draft);
  const shared = useBuilds((s) => sharedTargetSays(s.projects, project.id));
  /* A target another site already publishes to is refused here in words, as the store refuses it. */
  const takenBy = useBuilds((s) => {
    if (!parsed) return null;
    const key = targetKey({ ...parsed, branch: branch.trim() || "main" });
    return s.projects.find((p) => p.id !== project.id && targetKey(p.repo) === key) ?? null;
  });
  /* A repository a site was brought in from is never a publish target: the
     owner's ruling, polio never writes to a capture repository. Refused
     here in words, and by the store and the publish route behind it. */
  const from = parsed ? sourceOf(`${parsed.owner}/${parsed.name}`) : null;
  const changed = draft.trim() !== repoLabel(project) || branch.trim() !== (project.repo?.branch ?? "main");
  const commitWith = (name: string, br: string) => {
    if (name.trim() === repoLabel(project) && br.trim() === (project.repo?.branch ?? "main")) return;
    const want = parseRepo(name);
    if (!name.trim()) { setRepo(project.id, undefined); }
    else if (want && !sourceOf(`${want.owner}/${want.name}`)) {
      const key = targetKey({ ...want, branch: br.trim() || "main" });
      if (projects.some((p) => p.id !== project.id && targetKey(p.repo) === key)) return;
      if (!setRepo(project.id, { ...want, branch: br.trim() || "main" })) return;
    }
    else return;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };
  const commit = () => commitWith(draft, branch);
  const pick = (r: Mine) => {
    const br = r.branch || "main";
    setDraft(r.name);
    setBranch(br);
    setListing(false);
    commitWith(r.name, br);
  };

  /* His list, narrowed by what is typed, unless what is typed is already the one set. */
  const q = draft.trim().toLowerCase();
  const shown = mine ? (q && q !== repoLabel(project).toLowerCase() ? mine.filter((r) => r.name.toLowerCase().includes(q)) : mine) : [];
  /* Who already publishes to a repository, so the list says it before the press does. */
  const holder = (r: Mine) => projects.find((p) => p.id !== project.id && targetKey(p.repo) === targetKey({ ...parseRepo(r.name)!, branch: r.branch || "main" }));

  return (
    <li data-repo-row={project.id} className={cn("rounded-lg border px-3 py-2.5", active ? "border-accent/45 bg-accent-soft/30" : "border-border bg-elevated/30")}>
      <div className="flex items-center gap-2">
        <FolderGit2 className={cn("size-3.5 shrink-0", active ? "text-accent" : "text-fg-faint")} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{project.name}</span>
        {active ? <span className="rounded-full border border-accent/35 bg-accent/12 px-1.5 py-px text-small text-accent">open</span> : null}
        {project.repo ? (
          <Tooltip content="Open on GitHub">
            <a
              href={`https://github.com/${repoLabel(project)}/tree/${project.repo.branch}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${repoLabel(project)} on GitHub`}
              className="inline-flex size-6 items-center justify-center rounded-sm text-fg-faint hover:bg-hover hover:text-fg"
            >
              <ExternalLink className="size-3" />
            </a>
          </Tooltip>
        ) : null}
      </div>

      <div className="relative mt-2 flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setListing(true); }}
            onFocus={() => setListing(!!mine?.length)}
            onBlur={() => { setListing(false); commit(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { const only = shown.length === 1 && !parsed ? shown[0] : null; if (only) pick(only); else { setListing(false); commit(); } }
              if (e.key === "Escape") setListing(false);
            }}
            placeholder={mine?.length ? "Pick a repo, or owner/name" : "owner/name"}
            spellCheck={false}
            className="h-7 w-full text-xs"
            aria-label={`Publish ${project.name} to this repository`}
            aria-expanded={listing}
            aria-autocomplete="list"
          />
        </div>
        <Input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          placeholder="main"
          spellCheck={false}
          className="h-7 w-20 shrink-0 text-xs"
          aria-label={`Publish ${project.name} to this branch`}
        />
        <Button size="xs" variant={changed ? "primary" : "outline"} className="h-7 shrink-0" disabled={!changed || (!!draft.trim() && (!parsed || !!from || !!takenBy))} onClick={commit}>
          {saved ? <Check /> : null}
          {/* IT IS NOT THE ATTACH CONTROL AND MUST STOP READING LIKE ONE.
              "Use this" on a field called Repos is what he pressed expecting
              the repository to come in; it bound where Publish pushes and
              brought nothing, and the site stayed empty with no word said.
              Bringing a repository in is its own control now, in the
              Builder, where the board it lands on is. */}
          {saved ? "Set" : "Publish here"}
        </Button>
        {listing && shown.length ? (
          /* Pressed with the mouse down, so the field's blur does not commit half a name first. */
          <ul data-repo-row-list="" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-border-strong bg-panel p-1 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8)]">
            {shown.map((r) => {
              const barred = sourceOf(r.name);
              const held = holder(r);
              const here = r.name === repoLabel(project);
              return (
                <li key={r.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={here}
                    data-repo-row-pick={r.name}
                    disabled={!!barred || !!held}
                    title={barred ? "A site was brought in from this one, and Publish never writes back into it." : held ? `${held.name} already publishes here.` : undefined}
                    onMouseDown={(e) => { e.preventDefault(); pick(r); }}
                    className={cn("flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45", here && "bg-accent-soft/40")}
                  >
                    {r.private ? <Lock className="size-3 shrink-0 text-fg-faint" /> : <Globe className="size-3 shrink-0 text-fg-faint" />}
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    {held ? <span className="shrink-0 text-small text-fg-faint">{held.name}</span> : barred ? <span className="shrink-0 text-small text-fg-faint">brought in</span> : r.pushed ? <span className="num shrink-0 text-small text-fg-faint">{fmtAge(Date.parse(r.pushed))}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <p className="mt-1.5 text-plain text-fg-muted">
        {draft.trim() && !parsed && !listing ? (
          <span className="text-down">A repository is owner/name.</span>
        ) : from && changed ? (
          <span data-repo-refused="" className="text-down">{labelOf(from.source)} is where {from.id === project.id ? "this site" : from.name} was brought in from, and Publish never writes back into that. Name a repository of its own, or leave it empty and the first Publish makes one.</span>
        ) : takenBy && changed ? (
          <span data-repo-taken="" className="text-down">{takenBy.name} already publishes to {parsed!.owner}/{parsed!.name} on {branch.trim() || "main"}. Two sites on one repository and branch replace each other&apos;s live site: choose another.</span>
        ) : saveFailed ? (
          <span className="text-down">This browser would not keep the change: its storage is full. Remove a site or its pictures, then set it again.</span>
        ) : project.repo ? (
          <span data-repo-line="">{targetWords(project)}</span>
        ) : (
          <span data-repo-none="">{targetWords(project)} Or {mine?.length ? "pick one of yours above" : "set one here"}.</span>
        )}
        {project.source ? (
          <span data-repo-source="" className="block text-fg-faint">{sourceWords(project)}</span>
        ) : null}
        {shared ? <span data-repo-shared="" className="mt-1 block text-warning">{shared}</span> : null}
      </p>
    </li>
  );
}

/*
 * HIS REPOSITORIES, ON GITHUB, AS A LIST HE CAN READ AT A GLANCE.
 *
 * Which ones he has, which are private, when each was last pushed, and
 * which of his sites publish to each. A row opens the repository on GitHub
 * in a new tab; choosing one for a site is the site's own field above, so
 * there is one place that binds.
 */
function MyRepoList({ mine }: { mine: MyRepos }) {
  const ctx = useActions();
  const projects = useBuilds((s) => s.projects);
  const [q, setQ] = React.useState("");
  if (mine.state === "reading") {
    return (
      <p data-my-repos-reading="" className="flex items-center gap-1.5 text-plain text-fg-faint">
        <Loader2 className="size-3 animate-spin" /> Reading your repos from GitHub…
      </p>
    );
  }
  if (mine.state === "none") {
    return (
      <div data-my-repos-said="" className="rounded-lg border border-dashed border-border px-3 py-3 text-plain text-fg-muted">
        <p>{mine.says}</p>
        <Button size="xs" variant="outline" className="mt-2" onClick={() => ctx.openPanel("keys")}>
          <KeyRound />
          {mine.locked ? "Unlock in Keys" : "Open Keys"}
        </Button>
      </div>
    );
  }
  const shown = q.trim() ? mine.repos.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())) : mine.repos;
  return (
    <div data-my-repos="" className="flex flex-col gap-2">
      {mine.repos.length > 6 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-fg-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${mine.repos.length} repos`} spellCheck={false} className="h-7 pl-6 text-xs" aria-label="Search your repos" />
        </div>
      ) : null}
      {mine.repos.length === 0 ? (
        <p className="text-plain text-fg-faint">GitHub lists no repositories for {mine.owner ?? "this token"} yet. The first Update live site makes one.</p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto rounded-lg border border-border bg-elevated/20">
          {shown.map((r) => {
            const sites = projects.filter((p) => repoLabel(p).toLowerCase() === r.name.toLowerCase());
            const [owner, name] = r.name.split("/");
            return (
              <li key={r.name} className="border-b border-border last:border-b-0">
                <a
                  data-my-repo={r.name}
                  href={`https://github.com/${r.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-hover"
                >
                  {r.private ? <Lock className="size-3 shrink-0 text-fg-faint" aria-label="private" /> : <Globe className="size-3 shrink-0 text-fg-faint" aria-label="public" />}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-fg-faint">{owner}/</span>
                    <span className="font-medium text-fg">{name}</span>
                  </span>
                  {sites.length ? (
                    <span className="max-w-[45%] shrink-0 truncate rounded-full border border-accent/35 bg-accent/10 px-1.5 py-px text-small text-accent" title={`${sites.map((p) => p.name).join(", ")} publish${sites.length === 1 ? "es" : ""} here`}>
                      {sites.map((p) => p.name).join(", ")}
                    </span>
                  ) : r.pushed ? (
                    <span className="num shrink-0 text-small text-fg-faint" title={`Last pushed ${fmtAge(Date.parse(r.pushed))} ago`}>{fmtAge(Date.parse(r.pushed))}</span>
                  ) : null}
                </a>
              </li>
            );
          })}
          {shown.length === 0 ? <li className="px-3 py-2 text-plain text-fg-faint">None of your repos match.</li> : null}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function BuildsPage() {
  const { projects, activeId, adopt, create } = useBuilds();
  const [loaded, setLoaded] = React.useState<{ ok: boolean; says: string } | null>(null);
  const mine = useMyRepos();
  const loadOne = async () => {
    const r = await pickAndLoadBackup();
    if (r) setLoaded(r);
  };

  // The store persists itself, and the first visit has to take whatever the
  // Builder is already holding rather than list nothing beside it.
  React.useEffect(() => {
    void useBuilds.persist.rehydrate()?.then?.(() => useBuilds.getState().adopt());
    adopt();
  }, [adopt]);

  const heading = "flex items-center gap-2 text-small font-medium uppercase tracking-[0.12em] text-fg-faint";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-10" {...ctxProps("builds", "page", null)}>
      {/* Where the card pictures are drawn, one site at a time, off screen (`thumbs.tsx`). */}
      <ThumbMaker />
      <LearnedDialog />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-3xl">Builds</h1>
          <p className="mt-1.5 max-w-xl text-balance text-[13px] leading-relaxed text-fg-muted">
            Every site {site.name} is holding, and where each one publishes. Switching is instant: the Builder
            re-reads the document you press and nothing is lost on the way out.
          </p>
          {/* Which build of the Builder this is: a site three days behind trunk used to look exactly like a current one. */}
          <BuildMark className="mt-2 inline-block text-plain text-fg-faint" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The tour is offered where arriving happens, not buried in a menu. */}
          <Button size="md" variant="outline" onClick={() => useTour.getState().start()}>
            <Compass />
            Take the tour
          </Button>
          {/* What every imported site taught the Builder (`studio/LearnedPanel.tsx`). */}
          <LearnedButton />
          <Tooltip content="Load a backup file as a new site beside these">
            <Button size="md" variant="outline" data-builds-load-backup="" onClick={() => void loadOne()}>
              <Upload />
              Load a backup
            </Button>
          </Tooltip>
          {/* New site opens on a sample page in a theme of its own; a blank one is for bringing a repository in, or starting from nothing. */}
          <Tooltip content="An empty board: for bringing a repository in, or starting from nothing">
            <Button size="md" variant="outline" data-builds-blank="" onClick={() => create()}>
              Blank site
            </Button>
          </Tooltip>
          <Button size="md" variant="primary" onClick={() => create(undefined, { starter: true })}>
            <Plus />
            New site
          </Button>
        </div>
      </div>
      {loaded ? <p data-builds-loaded="" role="status" className={cn("mt-2 text-plain", loaded.ok ? "text-up" : "text-down")}>{loaded.says}</p> : null}

      {projects.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={Layers}
          title="Nothing built yet"
          body="Start one and the Builder opens on it."
          action={<Button size="sm" variant="primary" onClick={() => create(undefined, { starter: true })}><Plus /> New site</Button>}
        />
      ) : (
        /* Sites take the page, pictures first; the repos sit in a column beside them, under them on a narrow screen. */
        <div data-builds-views="" className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="builds-sites" className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="builds-sites" className={heading}>
                <Layers className="size-3.5" />
                Sites
              </h2>
              <span className="text-plain text-fg-faint" title="Sites are kept in this browser only: clearing its data loses them. Download a backup from a card to keep a copy anywhere.">
                <span className="num">{projects.length}</span> {projects.length === 1 ? "site" : "sites"} in this browser
              </span>
            </div>
            <ul data-builds-list="" className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <SiteCard key={p.id} project={p} active={p.id === activeId} />
              ))}
            </ul>
          </section>

          <aside data-builds-repos="" aria-labelledby="builds-repos" className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-panel/60 p-4 lg:sticky lg:top-6">
            <div>
              <h2 id="builds-repos" className={heading}>
                <FolderGit2 className="size-3.5" />
                Repos
              </h2>
              <p className="mt-1 text-plain text-fg-muted">
                Where each site publishes.
                {mine.state === "read" ? ` Press a field to pick from your ${mine.repos.length} repos.` : null}
              </p>
            </div>
            <ul className="space-y-2">
              {projects.map((p) => (
                <RepoRow key={p.id} project={p} active={p.id === activeId} mine={mine.state === "read" ? mine.repos : null} />
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <h3 className={heading}>
                Your repos on GitHub
              </h3>
              <MyRepoList mine={mine} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
