"use client";
/**
 * The repository, in the top bar.
 *
 * A link, and only a link. It opens the repository the server names
 * (`GITHUB_REPO`) or, failing that, the one `site.config.ts` names; with
 * neither it is not there at all. It never asks anyone to log in and never
 * opens the key vault: a browser cannot hold a GitHub token that would do
 * anything, so "connect it" from here was a door to nowhere. The tooltip
 * says whether Publish can push — that needs a token on the server — and
 * where to put one.
 *
 * It reads the same status route the vault reads, which reports whether a key
 * is set and never what it is. The repository name is not a secret and is the
 * one value that comes back.
 */
import * as React from "react";
import site from "@site";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { cn } from "@/core/lib/cn";

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

interface Status {
  set: Record<string, boolean>;
  repo: string | null;
  branch: string;
}

/** "owner/name" from a GitHub URL, for the tooltip. */
function nameOf(url: string): string {
  const m = /github\.com\/([^/]+\/[^/#?]+)/.exec(url);
  return m ? m[1]!.replace(/\.git$/, "") : url;
}

export function GithubButton() {
  const [status, setStatus] = React.useState<Status | null>(null);

  React.useEffect(() => {
    let alive = true;
    void fetch("/api/keys/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Status) => { if (alive) setStatus(s); })
      .catch(() => { if (alive) setStatus(null); });
    return () => { alive = false; };
  }, []);

  const serverRepo = status?.repo ?? null;
  const url = serverRepo ? `https://github.com/${serverRepo}` : (site.repository ?? null);
  if (!url) return null;
  const name = serverRepo ?? nameOf(url);
  const canPush = !!serverRepo && !!status?.set.GITHUB_TOKEN;

  const label = canPush
    ? `${name} · ${status?.branch ?? "main"}, Publish pushes here`
    : serverRepo
      ? `${name}, no GITHUB_TOKEN on the server, so Publish cannot push; download the files instead`
      : `${name}, to let Publish push, set GITHUB_TOKEN and GITHUB_REPO on the server`;

  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Open ${name} on GitHub`}
        className="relative"
        onClick={() => window.open(url, "_blank", "noopener")}
      >
        <GithubMark className={cn("size-3.5", canPush ? "text-fg" : "text-fg-muted")} />
        {canPush ? null : (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-fg-faint" />
        )}
      </Button>
    </Tooltip>
  );
}
