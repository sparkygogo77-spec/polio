"use client";
/**
 * The repository, in the top bar.
 *
 * A link, and it says what it is linking to. Which repository that is comes
 * from the *site*, not the server: each build on the Builds page carries its
 * own `owner/name`, written there by the publish that made it. A site with
 * none yet has not been published, and the tooltip says what the first one
 * will do rather than asking for a name.
 *
 * "A browser cannot hold a GitHub token that would do anything" is what this
 * file used to say, and it was wrong — it is exactly where the token belongs,
 * for the same reason the Replicate one does: the account is the person's.
 * So the tooltip's advice is the Keys panel now, not the server's
 * environment, and `GITHUB_TOKEN` on the server is the fallback.
 *
 * It reads the same status route the vault reads, which reports whether a
 * token would be found and never what it is.
 */
import * as React from "react";
import site from "@site";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { cn } from "@/core/lib/cn";
import { publishStatus, type PublishStatus } from "@/features/studio/agent";
import { useBuilds } from "@/features/builds/store";

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
  const [status, setStatus] = React.useState<PublishStatus | null>(null);
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const project = projects.find((p) => p.id === activeId) ?? null;

  React.useEffect(() => {
    let alive = true;
    void publishStatus().then((s) => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, []);

  /* The site's own repository first, then the server's, then whatever
     `site.config.ts` says. The first is the one a publish actually uses. */
  const mine = project?.repo ? `${project.repo.owner}/${project.repo.name}` : null;
  const name = mine ?? status?.github.repo ?? null;
  const url = name ? `https://github.com/${name}` : (site.repository ?? null);
  const canPush = !!status?.github.configured;
  const where = status?.github.token;

  const label = !canPush
    ? name
      ? `${name} — no GitHub token, so Publish cannot push. Put one in the Keys panel, or set GITHUB_TOKEN on the server.`
      : "No GitHub token yet. Put one in the Keys panel and the first Publish makes this site a repository of its own."
    : name
      ? `${name} · ${project?.repo?.branch ?? status?.github.branch ?? "main"} — Publish pushes here, with ${where === "browser" ? "your own token" : "the server's token"}.`
      : `The first Publish makes a private repository named after this site and pushes to it, with ${where === "browser" ? "your own token" : "the server's token"}.`;

  /* Nothing to open and nothing yet to describe: before a site is published
     and with no token anywhere, this button has nothing to say. */
  if (!url && !canPush) return null;

  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon"
        /* "GitHub" stays in the name whatever state this is in: it is the
           GitHub button, and something looking for it by name — a screen
           reader, or the vault suite — should find it before a repository
           exists as readily as after. */
        aria-label={name ? `Open ${name} on GitHub` : "GitHub: this site has no repository yet"}
        data-github-button=""
        data-repo={name ?? ""}
        className="relative"
        /* `aria-disabled`, not `disabled`: a disabled button takes no pointer
           events, and with no repository yet the tooltip is the entire point
           of this control — it is the only place that says the first publish
           will make one. */
        aria-disabled={!url}
        onClick={() => { if (url) window.open(url, "_blank", "noopener"); }}
      >
        <GithubMark className={cn("size-3.5", canPush ? "text-fg" : "text-fg-muted")} />
        {canPush ? null : (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-fg-faint" />
        )}
      </Button>
    </Tooltip>
  );
}
