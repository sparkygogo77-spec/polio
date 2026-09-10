"use client";
/**
 * The repository, in the top bar.
 *
 * Two states and no ambiguity. Connected: the mark is lit, the tooltip names
 * the repository and branch, and a press opens it. Not connected: the mark is
 * dim with a dot on it, and a press opens the keys panel at the place where
 * a token goes — because "connect it" is the only useful thing an
 * unconnected button can do.
 *
 * It reads the same status route the vault reads, which reports whether a key
 * is set and never what it is. The repository name is not a secret and is the
 * one value that comes back, so the tooltip can say where a push would land.
 */
import * as React from "react";
import { useActions } from "@/core/actions";
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

export function GithubButton() {
  const ctx = useActions();
  const [status, setStatus] = React.useState<Status | null>(null);

  React.useEffect(() => {
    let alive = true;
    void fetch("/api/keys/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Status) => { if (alive) setStatus(s); })
      .catch(() => { if (alive) setStatus(null); });
    return () => { alive = false; };
  }, []);

  const repo = status?.repo ?? null;
  const token = !!status?.set.GITHUB_TOKEN;
  const connected = !!repo && token;
  const url = repo ? `https://github.com/${repo}` : null;

  const label = connected
    ? `${repo} · ${status?.branch ?? "main"}`
    : repo
      ? `${repo} — no token, so Publish cannot push yet`
      : "No repository connected. Set a token and a repository in Keys.";

  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={connected ? `Open ${repo} on GitHub` : "Connect GitHub"}
        className="relative"
        onClick={() => {
          if (connected && url) window.open(url, "_blank", "noopener");
          else ctx.openPanel("keys");
        }}
      >
        <GithubMark className={cn("size-3.5", connected ? "text-fg" : "text-fg-faint")} />
        {connected ? null : (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warn shadow-[0_0_6px_var(--warn)]"
          />
        )}
      </Button>
    </Tooltip>
  );
}
