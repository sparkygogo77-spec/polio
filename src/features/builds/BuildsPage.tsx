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
 * Nothing here reaches a server. A project is local until it is published.
 */
import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Compass,
  Copy,
  ExternalLink,
  FolderGit2,
  LayoutTemplate,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import site from "@site";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";
import { EmptyState } from "@/core/ui/empty-state";
import { cn } from "@/core/lib/cn";
import { fmtAge } from "@/core/lib/format";
import { ctxProps } from "@/core/context-menu/ctx";
import { useTour } from "@/features/tour/store";
import { docOf, useBuilds, type Project } from "./store";
import { SitePreview } from "@/features/studio/SitePreview";

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
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(project.name);
  const box = React.useRef<HTMLButtonElement>(null);
  const [w, setW] = React.useState(0);

  // Read on every render rather than held: a switch changes what is in the
  // live key, and a document from before the switch is the wrong one.
  const doc = docOf(project.id, active);
  const shape = { pages: doc?.pages?.length ?? 0, parts: doc?.nodes?.length ?? 0 };

  // The preview is scaled to the card, so it has to know how wide the card
  // turned out — which is a grid's business, not this component's.
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const commit = () => {
    rename(project.id, draft);
    setEditing(false);
  };

  return (
    <li
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-lg border transition-colors",
        active ? "border-accent/45 bg-accent-soft/30" : "border-border bg-panel hover:border-border-strong",
      )}
      {...ctxProps("builds", "project", project.id)}
    >
      {/* The site. Pressing it is the same as pressing Open or Switch: the
          picture is the door, and a picture you cannot press is a poster. */}
      <button
        type="button"
        ref={box}
        onClick={() => (active ? undefined : open(project.id))}
        aria-label={active ? `${project.name}, the open site` : `Switch to ${project.name}`}
        className="relative block h-[168px] w-full cursor-pointer overflow-hidden border-b border-border bg-elevated/40 p-0 text-left"
      >
        <SitePreview doc={doc} width={w} height={168} />
        {project.live ? (
          <a
            href={project.live.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Live ${fmtAge(project.live.at)} ago`}
            className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border border-up/30 bg-panel/85 px-1.5 py-0.5 text-[10px] text-up backdrop-blur"
          >
            Live
            <ExternalLink className="size-2.5" />
          </a>
        ) : null}
        {active ? (
          <span className="absolute left-1.5 top-1.5 rounded-full border border-accent/40 bg-panel/85 px-1.5 py-0.5 text-[10px] text-accent backdrop-blur">
            open
          </span>
        ) : null}
      </button>

      {/* Its name, and what you can do to it. */}
      {/* `flex-1`, or `mt-auto` on the options bar has no room to work in
          and the bars sit wherever each card's own words happened to end. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
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
            className="block max-w-full truncate text-[13px] font-medium text-fg"
          >
            {project.name}
          </span>
        )}

        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-muted">
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
          <p className="flex min-w-0 items-center gap-1 truncate text-[10px] text-fg-faint">
            <FolderGit2 className="size-3 shrink-0" />
            {repoLabel(project)}
            <span className="text-fg-faint/70">· {project.repo.branch}</span>
          </p>
        ) : null}

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
          <span className="flex-1" />
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

/* ------------------------------------------------------------------ */
/* The repository side                                                 */
/* ------------------------------------------------------------------ */

function RepoRow({ project, active, serverRepo, serverBranch }: { project: Project; active: boolean; serverRepo: string | null; serverBranch: string }) {
  const { setRepo } = useBuilds();
  const [draft, setDraft] = React.useState(repoLabel(project));
  const [branch, setBranch] = React.useState(project.repo?.branch ?? serverBranch);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => { setDraft(repoLabel(project)); setBranch(project.repo?.branch ?? serverBranch); }, [project, serverBranch]);

  const parsed = parseRepo(draft);
  const changed = draft.trim() !== repoLabel(project) || branch.trim() !== (project.repo?.branch ?? serverBranch);
  const commit = () => {
    if (!draft.trim()) { setRepo(project.id, undefined); }
    else if (parsed) { setRepo(project.id, { ...parsed, branch: branch.trim() || "main" }); }
    else return;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <li className={cn("rounded-lg border px-3 py-2.5", active ? "border-accent/45 bg-accent-soft/40" : "border-border bg-panel")}>
      <div className="flex items-center gap-2">
        <FolderGit2 className={cn("size-3.5 shrink-0", active ? "text-accent" : "text-fg-faint")} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{project.name}</span>
        {active ? <span className="rounded-full border border-accent/35 bg-accent/12 px-1.5 py-px text-[10px] text-accent">open</span> : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          placeholder={serverRepo ?? "owner/name"}
          spellCheck={false}
          className="h-7 w-52 text-xs"
          aria-label={`Repository for ${project.name}`}
        />
        <span className="text-fg-faint">·</span>
        <Input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          placeholder="main"
          spellCheck={false}
          className="h-7 w-28 text-xs"
          aria-label={`Branch for ${project.name}`}
        />
        <Button size="xs" variant={changed ? "primary" : "outline"} disabled={!changed || (!!draft.trim() && !parsed)} onClick={commit}>
          {saved ? <Check /> : null}
          {saved ? "Set" : "Use this"}
        </Button>
        {project.repo ? (
          <a
            href={`https://github.com/${repoLabel(project)}/tree/${project.repo.branch}`}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Open on GitHub
            <ExternalLink className="size-2.5" />
          </a>
        ) : null}
      </div>

      <p className="mt-1.5 text-[11px] text-fg-muted">
        {draft.trim() && !parsed ? (
          <span className="text-down">A repository is owner/name.</span>
        ) : project.repo ? (
          <>Publish pushes this site to <span className="text-fg">{repoLabel(project)}</span> on <span className="text-fg">{project.repo.branch}</span>.</>
        ) : serverRepo ? (
          <>No repository of its own, so Publish uses the server&rsquo;s: <span className="text-fg">{serverRepo}</span> on {serverBranch}.</>
        ) : (
          <>Nothing set here and nothing on the server, so Publish can only hand you the files.</>
        )}
      </p>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function BuildsPage() {
  const { projects, activeId, adopt, create } = useBuilds();
  const [view, setView] = React.useState("sites");
  const [server, setServer] = React.useState<{ repo: string | null; branch: string } | null>(null);

  // The store persists itself, and the first visit has to take whatever the
  // Builder is already holding rather than list nothing beside it.
  React.useEffect(() => {
    void useBuilds.persist.rehydrate()?.then?.(() => useBuilds.getState().adopt());
    adopt();
  }, [adopt]);

  React.useEffect(() => {
    let alive = true;
    void fetch("/api/studio/publish", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: { github?: { repo?: string | null; branch?: string } }) => {
        if (alive) setServer({ repo: s.github?.repo ?? null, branch: s.github?.branch ?? "main" });
      })
      .catch(() => { if (alive) setServer(null); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10" {...ctxProps("builds", "page", null)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-3xl">Builds</h1>
          <p className="mt-1.5 max-w-lg text-balance text-[13px] leading-relaxed text-fg-muted">
            Every site {site.name} is holding, and where each one publishes. Switching is instant: the Builder
            re-reads the document you press and nothing is lost on the way out.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* The tour is offered where arriving happens, not buried in a menu. */}
          <Button size="md" variant="outline" onClick={() => useTour.getState().start()}>
            <Compass />
            Take the tour
          </Button>
          <Button size="md" variant="primary" onClick={() => create()}>
            <Plus />
            New site
          </Button>
        </div>
      </div>

      <div data-builds-views="" className="mt-6 flex items-center justify-between gap-3 border-b border-border pb-3">
        <Segmented
          value={view}
          onChange={setView}
          size="sm"
          aria-label="Sites or repositories"
          options={[
            { value: "sites", label: "Sites", icon: <Layers /> },
            { value: "repos", label: "Repos", icon: <FolderGit2 /> },
          ]}
        />
        <span className="text-[11px] text-fg-faint">
          <span className="num">{projects.length}</span> {projects.length === 1 ? "site" : "sites"} in this browser
        </span>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Layers}
          title="Nothing built yet"
          body="Start one and the Builder opens on it."
          action={<Button size="sm" variant="primary" onClick={() => create()}><Plus /> New site</Button>}
        />
      ) : view === "sites" ? (
        <ul data-builds-list="" className="mt-4 grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <SiteCard key={p.id} project={p} active={p.id === activeId} />
          ))}
        </ul>
      ) : (
        <ul className="mt-4 space-y-2">
          {projects.map((p) => (
            <RepoRow
              key={p.id}
              project={p}
              active={p.id === activeId}
              serverRepo={server?.repo ?? null}
              serverBranch={server?.branch ?? "main"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
