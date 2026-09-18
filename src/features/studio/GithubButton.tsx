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
import { useBuilds } from "@/features/builds/store";
import { useStudio } from "@/features/studio/store";
import { nameRefusal, repoNameFor } from "@/features/studio/repoName";
import { heldKeys } from "@/features/keys/store";

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

  React.useEffect(() => {
    let alive = true;
    void publishStatus().then((s) => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, []);

  /* The site's own repository first, then the server's, then whatever
     `site.config.ts` says. The first is the one a publish actually uses. */
  const mine = project?.repo ? `${project.repo.owner}/${project.repo.name}` : null;
  /* Through `github`, not into it. `status?.github.repo` guards the reply and
     not the field inside it, which is a crash for any answer that is an
     object without a `github` on it. `publishStatus` will not hand one over
     any more, but a control in the top bar is the wrong place to find out
     that something upstream was wrong about that. */
  const name = mine ?? status?.github?.repo ?? null;
  const url = name ? `https://github.com/${name}` : (site.repository ?? null);
  const canPush = status?.github?.configured === true;
  const where = status?.github?.token ?? null;

  const label = !canPush
    ? name
      ? `${name} — no GitHub token, so Publish cannot push. Put one in the Keys panel, or set GITHUB_TOKEN on the server.`
      : "No GitHub token yet. Put one in the Keys panel and the first Publish makes this site a repository of its own."
    : name
      ? `${name} · ${project?.repo?.branch ?? status?.github?.branch ?? "main, assumed"} — Publish pushes here, with ${where === "browser" ? "your own token" : "the server's token"}.`
      : `The first Publish makes a private repository named after this site and pushes to it, with ${where === "browser" ? "your own token" : "the server's token"}.`;

  /* Nothing to open and nothing yet to describe: before a site is published
     and with no token anywhere, this button has nothing to say. */
  if (!url && !canPush) return null;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      content={<RepoPanel pointsAt={name} branch={project?.repo?.branch ?? status?.github?.branch ?? null} canPush={canPush} onDone={() => setOpen(false)} />}
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
function RepoPanel({ pointsAt, branch, canPush, onDone }: { pointsAt: string | null; branch: string | null; canPush: boolean; onDone: () => void }) {
  const chosen = useStudio((s) => s.siteRepo);
  const siteName = useStudio((s) => s.brief?.name ?? "");
  const [mine, setMine] = React.useState<{ name: string; private: boolean }[] | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const [making, setMaking] = React.useState(false);
  const [bring, setBring] = React.useState("");
  const [pulling, setPulling] = React.useState(false);
  const [name, setName] = React.useState(() => repoNameFor(siteName));

  /* His own token if the Keys panel is holding one, and nothing otherwise —
     the route falls back to the server's, exactly as a publish does. */
  const token = (): Record<string, string> => {
    const held = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
    return held ? { "x-github-token": held } : {};
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

  const make = async () => {
    const refusal = nameRefusal(name);
    if (refusal) { setSaid(refusal); return; }
    setMaking(true);
    setSaid(null);
    try {
      const res = await fetch("/api/studio/repo", { method: "POST", headers: { "content-type": "application/json", ...token() }, body: JSON.stringify({ name }) });
      const a = await res.json();
      if (!a.ok) { setSaid(a.message ?? "GitHub would not make it."); return; }
      useStudio.getState().setSiteRepo(a.name);
      setSaid(`Made ${a.name}. This site points at it now.`);
    } catch {
      setSaid("Could not reach GitHub from here.");
    } finally {
      setMaking(false);
    }
  };

  /**
   * Bring one of his other sites in.
   *
   * The same control, because it is the same question: which repository are
   * we talking about. What comes back is a page and the things it needs, in
   * the shape the zip path already understands, and the recreate flow turns
   * it into ordinary parts from there.
   *
   * A repository with no page in it is told so in words \u2014 and told WHICH
   * kind of nothing it is, because "it is sources rather than a built site"
   * is a different answer from "it is empty" and only one of them has an
   * obvious next move.
   */
  const bringIn = async () => {
    const want = bring.trim();
    if (!want || pulling) return;
    setPulling(true);
    setSaid(null);
    try {
      const res = await fetch(`/api/studio/repo?repo=${encodeURIComponent(want)}`, { method: "PUT", headers: token(), cache: "no-store" });
      const r = (await res.json()) as { ok?: boolean; entry?: string; files?: { name: string }[]; message?: string; reason?: string };
      if (!r.ok) { setSaid(r.message ?? "That repo could not be read."); return; }
      setSaid(`${want}: ${r.entry}, with ${(r.files ?? []).length - 1} file${(r.files ?? []).length === 2 ? "" : "s"} it needs. Opening it\u2026`);
      window.dispatchEvent(new CustomEvent("studio:bring-repo", { detail: r }));
    } catch (err) {
      setSaid(`Could not reach GitHub: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPulling(false);
    }
  };

  const row = "flex items-center gap-1.5 text-[11px]";
  return (
    <div data-repo-panel="" className="flex w-[260px] flex-col gap-2">
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">The repo this site goes to</p>
        <p data-repo-points="" className="truncate text-[12px] font-medium text-fg">
          {chosen ?? pointsAt ?? "No repo yet"}
        </p>
        <p className="text-[10px] text-fg-muted">
          {chosen ?? pointsAt ? `on ${branch ?? "main"}${canPush ? "" : " — no token, so a publish cannot push"}` : "A publish goes wherever the server says, until you pick a repo."}
        </p>
      </div>

      <div className="h-px bg-border" />

      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">Connect a different repo</p>
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
                onClick={() => { useStudio.getState().setSiteRepo(r.name); onDone(); }}
                className={cn("tactile flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-[11px]", (chosen ?? pointsAt) === r.name ? "text-fg" : "text-fg-muted hover:text-fg")}
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
        <p className="mt-0.5 text-[10px] text-fg-muted">A site with a page in it comes in as ordinary parts. A repo of unbuilt sources has no page to open, and says so.</p>
      </div>

      {said ? <p data-repo-said="" className="text-[10px] text-fg">{said}</p> : null}
    </div>
  );
}
