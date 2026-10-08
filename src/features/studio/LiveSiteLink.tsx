"use client";
/**
 * THE OPEN SITE'S LIVE WEBSITE, ONE PRESS FROM THE TOP BAR.
 *
 * J (2026-10-05): "add a single button link to the header for the open
 * associated website link found in github to open in another tab, it was
 * previously there". It was: beside Go live, as the live address. A site
 * from code has Refresh and Publish in Go live's place (`CodeSiteButtons.tsx`)
 * and lost it with that.
 *
 * So this sits beside the GitHub button and opens, in a new tab, the
 * address the site's repository names as its website on GitHub (the About
 * box's homepage). A site made here that has already gone live keeps the
 * address beside Update live site (`GoLiveButton.tsx`), so this stays out of
 * its way: one link, never two. With no website on the repository it draws
 * nothing.
 */
import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { useBuilds } from "@/features/builds/store";
import { heldKeys, useKeys } from "@/features/keys/store";
import type { StyleSource } from "./send-out";
import { useStudio } from "./board/store";
import { websiteOf } from "./liveSite";

/** Each repository's website, asked once per page load (and again when the keys change). */
const asked = new Map<string, Promise<string | null>>();

function homepageOf(repo: string): Promise<string | null> {
  const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
  const key = `${repo}|${token ? "t" : ""}`;
  let p = asked.get(key);
  if (!p) {
    p = fetch(`https://api.github.com/repos/${repo}`, {
      headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => websiteOf((j as { homepage?: unknown } | null)?.homepage))
      .catch(() => null);
    asked.set(key, p);
  }
  return p;
}

export function LiveSiteLink() {
  const project = useBuilds((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
  const fromCode = useStudio((s) => (s.look as { styleSource?: StyleSource | null }).styleSource?.repo?.trim() || null);
  const repo = fromCode ?? (project?.repo ? `${project.repo.owner}/${project.repo.name}` : null);
  /* A site made here and already live has its address beside Update live site. */
  const goLiveHasIt = !fromCode && !!project?.live?.url;
  const keysAt = useKeys((s) => (s.unlocked && s.values.GITHUB_TOKEN ? "t" : ""));
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUrl(null);
    if (!repo || goLiveHasIt) return;
    let alive = true;
    void homepageOf(repo).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [repo, goLiveHasIt, keysAt]);

  if (!url || goLiveHasIt) return null;
  const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <Tooltip content={`Open ${host}, in a new tab`}>
      <Button asChild variant="ghost" size="icon">
        <a data-live-site="" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open the live site, ${host}`}>
          <ExternalLink />
        </a>
      </Button>
    </Tooltip>
  );
}
