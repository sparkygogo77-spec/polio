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
import { publishStatus, type PublishStatus } from "@/features/studio/loop/run";
import { useBuilds } from "@/features/builds/store";
import { useKeys } from "@/features/keys/store";
import { openRepoPicker } from "@/features/studio/RepoPicker";

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
  /*
   * ONE ANSWER ABOUT THE TOKEN. The button used to take a snapshot: the
   * server asked once, the held key read at that moment. The Keys panel
   * relocks itself after five idle minutes, the button re-asked and heard
   * "no token", and the list fetched earlier stayed on screen above it,
   * so the same panel gave two answers. The browser's key is read live
   * here, and the panel below reads the same value.
   */
  const mineNow = useKeys((s) => s.unlocked && !!s.values.GITHUB_TOKEN);
  const serverHas = status?.github?.token === "server";
  const canPush = mineNow || serverHas;
  const where = mineNow ? "browser" : serverHas ? "server" : null;

  const label = !canPush
    ? name
      ? `${name} — no GitHub token, so Publish cannot push. Put one in the Keys panel, or set GITHUB_TOKEN on the server.`
      : "No GitHub token yet. Put one in the Keys panel and the first Publish makes this site a repository of its own."
    : name
      ? `${name} · ${project?.repo?.branch ?? "main"} — Publish pushes here, with ${where === "browser" ? "your own token" : "the server's token"}.`
      : `No repo of its own yet. The first Update live site makes a private repository named after this site and pushes to it, with ${where === "browser" ? "your own token" : "the server's token"}.`;

  /* Always drawn: it is the one way to bring a repository in, so a fresh
     site with no repository and no token still needs it. The cubes door that
     used to stand in for it in the board's bar opened the same picker, and
     was removed as a duplicate. */

  return (
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
        data-bring-repo=""
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
        onClick={openRepoPicker}
      >
        <GithubMark className={cn("size-3.5", canPush ? "text-fg" : "text-fg-muted")} />
        {canPush ? null : (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-fg-faint" />
        )}
      </Button>
    </Tooltip>
  );
}
