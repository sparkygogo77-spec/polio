"use client";
/**
 * A SITE MADE HERE: REFRESH AND PUBLISH, BESIDE GO LIVE.
 *
 * The owner's words: "it should have both because the pipeline will require
 * a code chat utilizing this repo that was just created and the design site
 * will need to be able to do the refresh and publish both."
 *
 * Both work on the repository Go live made for the site (`Project.repo`):
 *
 *   Publish   the first time, the board goes in as the builder-ready kit,
 *             on a branch, merged (`kitPublish.ts`), so a code chat can
 *             work there. Again later, the kit again, as long as nobody has
 *             pushed since; once a code chat has, it waits for Refresh, so
 *             the chat's work is never written over.
 *   Refresh   green while the repository is where this board left it. Once
 *             a code chat has pushed, it asks, then brings the repository
 *             in: the kit's builder.json is read first, and the site is a
 *             site from code from then on, with the code site's own Refresh
 *             and Publish (`CodeSiteButtons.tsx`).
 *
 * Go live stays beside them, for the still site it has always put up.
 */
import * as React from "react";
import { Check, GitMerge, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Tooltip } from "@/core/ui/tooltip";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { heldKeys } from "@/features/keys/store";
import { useBuilds } from "@/features/builds/store";
import { useStudio } from "./board/store";
import { headOf } from "./codePublish";
import { kitStatus, publishKit, type KitSent } from "./kitPublish";
import { checkThenPublish } from "./PublishCheck";
import { placeBring } from "./bringRepo";

export function BuilderSiteButtons() {
  const ctx = useActions();
  const project = useBuilds((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
  const repo = project?.repo ? `${project.repo.owner}/${project.repo.name}` : null;
  const sent = useStudio((s) => ((s.look as { kitSent?: KitSent | null }).kitSent ?? null));
  const [head, setHead] = React.useState<string | null | undefined>(undefined);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [ask, setAsk] = React.useState<"refresh" | "publish" | null>(null);
  const status = repo && head !== undefined ? kitStatus(repo, sent, head) : null;

  const read = React.useCallback(async () => {
    if (!repo) return;
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    setHead(await headOf(repo, "HEAD", token).catch(() => null));
  }, [repo]);
  /* Read on opening, when the window comes back, and every two minutes: one request each. */
  React.useEffect(() => {
    void read();
    const t = window.setInterval(() => void read(), 120_000);
    const back = () => void read();
    window.addEventListener("focus", back);
    return () => { window.clearInterval(t); window.removeEventListener("focus", back); };
  }, [read]);

  const say = (title: string, body: string, level: "info" | "success" | "warn" = "info") => ctx.publish({ key: "studio:builder-site", title, body, level, source: "studio", toast: { durationMs: 9000 } });
  const noRepo = "Go live once first: it makes the site's repository, which Refresh reads and Publish writes to.";

  const refresh = () => {
    play("tap");
    if (!repo) { say("No repository yet", noRepo, "warn"); return; }
    if (!status || status.at === "unknown") { void read(); say("Reading the repository", `Asking GitHub for ${repo}…`); return; }
    if (status.at === "none") { say("Nothing to bring in yet", `${repo} has no builder kit from this board: Publish puts it in, so a code chat can work there. Refresh brings the chat's work back.`); return; }
    if (status.at === "current") { say("Up to date", status.says, "success"); void read(); return; }
    setAsk("refresh");
  };
  const bringIn = () => {
    setAsk(null);
    if (!repo) return;
    placeBring(repo);
    say("Bringing it in", `Reading ${repo} as the code chat left it. From now on this site's Refresh and Publish work on its code.`);
  };

  const publish = () => {
    play("tap");
    if (!repo) { say("No repository yet", noRepo, "warn"); return; }
    if (status?.at === "moved") { say("Refresh first", `${status.says} Publishing now would write over that work.`, "warn"); return; }
    void checkThenPublish(() => setAsk("publish"));
  };
  const publishNow = async () => {
    setAsk(null);
    if (!repo) return;
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (!token) { say("Publish needs your GitHub key", "It writes to the repository with your own key: add one under Keys.", "warn"); return; }
    setBusy("Publishing…");
    try {
      const site = project?.name || repo.split("/")[1] || "site";
      const done = await publishKit(repo, token, { site, sent, say: (t) => setBusy(t) });
      if (!done.ok) { say("Not published", done.says, "warn"); return; }
      /* A record of where the code is, not an edit: kept without an undo step, so Undo never forgets that the kit went in. */
      useStudio.setState((st) => ({ look: { ...st.look, kitSent: { repo, sha: done.sha, at: Date.now() } } as typeof st.look }));
      setHead(done.sha);
      play("confirm");
      say("Published", `The site is in ${repo} as a builder-ready kit (${done.files} files, merged at ${done.sha.slice(0, 7)}). A code chat can work there now; Refresh brings its work back.`, "success");
    } finally {
      setBusy(null);
    }
  };

  const green = status?.at === "current";
  const refreshSays = !repo ? noRepo : status?.says ?? `Reading ${repo}…`;
  const publishSays = !repo ? noRepo
    : status?.at === "moved" ? "A code chat has pushed since: Refresh first, so its work is brought in rather than written over."
      : `Publish the site into ${repo} as a builder-ready kit, on a branch, merged: a code chat can then work there.`;
  return (
    <span className="flex items-center gap-1.5" data-builder-site="">
      <Tooltip content={refreshSays}>
        <span>
          <Button variant="outline" size="sm" data-builder-refresh="" data-builder-status={!repo ? "no-repo" : status?.at ?? "reading"} disabled={!!busy || !repo} onClick={refresh}
            className={green ? "border-[oklch(0.72_0.17_150)] text-[oklch(0.82_0.17_150)]" : status?.at === "moved" ? "border-warning text-warning" : undefined}>
            {green ? <Check /> : <RefreshCw />} {green ? "Up to date" : "Refresh"}
          </Button>
        </span>
      </Tooltip>
      <Tooltip content={publishSays}>
        <span>
          <Button variant="outline" size="sm" data-builder-publish="" disabled={!!busy || !repo || status?.at === "moved"} onClick={publish}>
            {busy ? <Loader2 className="animate-spin" /> : <GitMerge />} {busy ?? "Publish"}
          </Button>
        </span>
      </Tooltip>
      <Dialog
        open={ask === "refresh"}
        onOpenChange={(v) => { if (!v) setAsk(null); }}
        title={`Bring ${repo} in?`}
        footer={
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAsk(null)}>Back to the board</Button>
            <span className="flex-1" />
            <Button variant="primary" size="sm" data-builder-refresh-go="" onClick={bringIn}><RefreshCw /> Bring it in</Button>
          </div>
        }
      >
        <div data-builder-refresh-says="" className="space-y-2 text-plain text-fg-muted">
          <p>{status?.says}</p>
          <p>The board is read again from the code as it is now, and the site becomes its code site: from then on Publish sends only your design (the style layer) and never touches the code chat's files.</p>
          <p>Anything you have changed on the board since you last published is replaced by what is in the code.</p>
        </div>
      </Dialog>
      <Dialog
        open={ask === "publish"}
        onOpenChange={(v) => { if (!v) setAsk(null); }}
        title={`Publish into ${repo}?`}
        footer={
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAsk(null)}>Back to the board</Button>
            <span className="flex-1" />
            <Button variant="primary" size="sm" data-builder-publish-go="" onClick={() => void publishNow()}><GitMerge /> Publish and merge</Button>
          </div>
        }
      >
        <div data-builder-publish-says="" className="space-y-2 text-plain text-fg-muted">
          <p>The site goes into {repo} as a builder-ready kit: its pages with a hook on every part, its tokens, an empty style layer, builder.json, and the kit&apos;s checks and CLAUDE.md that tell a code chat how to work there.</p>
          <p>It goes on a new kit/ branch and is merged at once. Go live&apos;s own files in the repository stay as they are.</p>
          <p className="text-small text-fg-faint">Then point a code chat at {repo}. When it has pushed, Refresh here brings its work onto the board.</p>
        </div>
      </Dialog>
    </span>
  );
}
