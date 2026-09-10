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
import { shapeOf, useBuilds, type Project } from "./store";

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

function SiteRow({ project, active }: { project: Project; active: boolean }) {
  const { open, rename, duplicate, remove } = useBuilds();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(project.name);

  // Read on every render rather than held: a switch changes what is in the
  // live key, and a count from before the switch is the wrong one.
  const shape = shapeOf(project.id, active);

  const commit = () => {
    rename(project.id, draft);
    setEditing(false);
  };

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        active ? "border-accent/45 bg-accent-soft/40" : "border-border bg-panel hover:border-border-strong",
      )}
      {...ctxProps("builds", "project", project.id)}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md border",
          active ? "border-accent/40 bg-accent/15 text-accent" : "border-border bg-elevated text-fg-faint",
        )}
      >
        <Layers className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
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
            className="h-6 max-w-56 text-xs"
            aria-label="Name of this site"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => { setDraft(project.name); setEditing(true); }}
            className="block max-w-full truncate text-left text-[13px] font-medium text-fg"
          >
            {project.name}
          </button>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-muted">
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
          {project.repo ? (
            <>
              <span className="text-fg-faint">·</span>
              <span className="inline-flex items-center gap-1 text-fg-faint">
                <FolderGit2 className="size-3" />
                {repoLabel(project)}
              </span>
            </>
          ) : null}
        </p>
      </div>

      {project.live ? (
        <Tooltip content={`Live ${fmtAge(project.live.at)} ago`}>
          <a
            href={project.live.url}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 rounded-full border border-up/30 bg-up/12 px-2 py-0.5 text-[10px] text-up sm:inline-flex"
          >
            Live
            <ExternalLink className="size-2.5" />
          </a>
        </Tooltip>
      ) : null}

      <div className="flex shrink-0 items-center gap-1">
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
        {active ? (
          <Button asChild size="sm" variant="primary" className="ml-1">
            <Link href="/builder">
              <LayoutTemplate />
              Open
              <ArrowRight />
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="ml-1" onClick={() => open(project.id)}>
            Switch
          </Button>
        )}
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
        <ul data-builds-list="" className="mt-4 space-y-2">
          {projects.map((p) => (
            <SiteRow key={p.id} project={p} active={p.id === activeId} />
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
