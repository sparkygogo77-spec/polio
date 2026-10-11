"use client";
/**
 * A SITE FROM A CODE REPOSITORY: REFRESH AND PUBLISH, IN THE TOP BAR.
 *
 * J (2026-10-04): "Go live" on a site from code put up a still copy without
 * its scripts, which is not the site. Its code is the site, so the two
 * buttons are about the code (`codePublish.ts`):
 *
 *   Refresh   reads the repository it was brought in from. Green while the
 *             board is up to date with it; when the code has moved on, it
 *             asks, then brings it in again (a design not yet published is
 *             said first, because the board is read anew).
 *   Publish   the design into the code: the board's check list first
 *             (`PublishCheck.tsx`), then what changes, said in words, and on
 *             his yes the style layer goes on a new style/ branch and is
 *             merged into the default branch. A merge GitHub refuses leaves
 *             the pull request open, linked, with why. Issues ticked on the
 *             timeline's lanes ride along in polio/NEXT.md (`fixLoop.ts`),
 *             and Refresh reads that file back to mark the fixed ones.
 *
 * The repo menu keeps the rest: the list, another repository, a new one.
 */
import * as React from "react";
import { Check, GitMerge, Loader2, RefreshCw, RotateCcw, ScanSearch } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Tooltip } from "@/core/ui/tooltip";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useActions } from "@/core/actions";
import { heldKeys } from "@/features/keys/store";
import { activeProject } from "@/features/builds/store";
import { useStudio, useSteady } from "./board/store";
import { FAMILY, resolvePalette } from "./shelf/run";
import { wornPaint } from "./look";
import { buildLayer, wearTextures, type LayerNode, type StyleSource } from "./send-out";
import { codeStatus, commitAfterPublish, headOf, layerPrint, mergePull, parentOf, type CodeStatus } from "./send-out";
import { sendDesign } from "./codeSend";
import { checkThenPublish } from "./PublishCheck";
import { placeBring } from "./bringRepo";
import { olderBuilder, readLastBring, resetToLastBring, useLastBring } from "./lastBring";
import { fileAt } from "./kitRun";
import { LANE_MODE } from "./loop";
import { NEXT_PATH, asksToSend, fixedIn, promotePending, sentMerged, sentUnmerged } from "./fixLoop";
import { asksNow, gatherAsks } from "./publishAsks";
import { fixLoopOf, setFixLoop } from "./useFixLoop";

const family = (name: string) => FAMILY[name];

/** The repository, its folder and branch, as "Bring it in" takes them. */
function wantOf(source: StyleSource): string {
  const file = (source as { manifest?: { file?: string } }).manifest?.file ?? "";
  const dir = file.includes("/") ? `/${file.slice(0, file.lastIndexOf("/"))}` : "";
  return `${source.repo}${dir}${source.ref ? `@${source.ref}` : ""}`;
}

export function CodeSiteButtons({ source }: { source: StyleSource }) {
  const ctx = useActions();
  /* Held still under the hand: the whole style layer is rebuilt from it (`store/hold.ts`). */
  /* Parts wearing a texture carry it: a living background as their own living picture, any other as their own background pictures (`wearTextures`). */
  const textures = useStudio((s) => s.look.texture);
  const steady = useSteady(useStudio((s) => s.nodes));
  /* Every other texture a part wears is painted as the board paints it, over its own fill (`wornPaint`). */
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const full = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const nodes = React.useMemo(() => wearTextures(steady, textures, (l, o) => wornPaint(l, full, o)), [steady, textures, full]);
  const palette = useStudio((s) => s.look.palette as Record<string, string>);
  const layer = React.useMemo(() => buildLayer(nodes as unknown as LayerNode[], palette, source, { family, kit: !!source.kit }), [nodes, palette, source]);
  const empty = !layer.rules.length && !layer.vars.length;
  const print = React.useMemo(() => layerPrint(layer.css), [layer.css]);
  const [head, setHead] = React.useState<string | null | undefined>(undefined);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [ask, setAsk] = React.useState<"refresh" | "publish" | null>(null);
  const status: CodeStatus | null = head === undefined ? null : codeStatus(source, head, print, empty);
  const last = useLastBring();

  const read = React.useCallback(async () => {
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    setHead(await headOf(source.repo, source.ref || "HEAD", token).catch(() => null));
  }, [source.repo, source.ref]);
  /* Read on opening, when the window comes back, and every two minutes: one request each. */
  React.useEffect(() => {
    void read();
    const t = window.setInterval(() => void read(), 120_000);
    const back = () => void read();
    window.addEventListener("focus", back);
    return () => { window.clearInterval(t); window.removeEventListener("focus", back); };
  }, [read]);

  const say = (title: string, body: string, level: "info" | "success" | "warn" = "info") => ctx.publish({ key: "studio:code-site", title, body, level, source: "studio", toast: { durationMs: 9000 } });

  /* The fix loop's last step: the lines the code chat ticked or deleted in polio/NEXT.md become blue boxes. */
  const readFixed = async () => {
    const was = fixLoopOf(useStudio.getState().look);
    if (!was.sent.length && !was.pending?.length) return;
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    const md = await fileAt(fetch, token, source.repo, source.ref || "HEAD", NEXT_PATH).catch(() => null);
    /* Lines from a pull request not merged count only once the default branch has them: until then their absence is not a fix. */
    const loop = promotePending(was, md);
    const fixed = fixedIn(loop.sent, md);
    if (!fixed.length) { if (loop !== was) setFixLoop(loop); return; }
    for (const i of fixed) useStudio.getState().landThread({ mode: LANE_MODE, ask: i.says, answer: `Fixed by a code chat from polio/NEXT.md: ${i.hook ?? "a part"} on ${i.page}.`, changes: [`${i.hook ?? "A part"} on ${i.page} fixed`], state: "done" });
    const gone = new Set(fixed.map((i) => i.key));
    /* A board change the code built is done: the board still holds it, so it is never asked for again. */
    const built = fixed.filter((i) => i.kind === "build").map((i) => i.key);
    setFixLoop({ ...loop, ticked: loop.ticked.filter((k) => !gone.has(k)), sent: loop.sent.filter((i) => !gone.has(i.key)), done: [...new Set([...(loop.done ?? []), ...built])] });
    say("Fixed in the code", `${fixed.length} issue${fixed.length === 1 ? "" : "s"} from polio/NEXT.md ${fixed.length === 1 ? "is" : "are"} done: ${fixed.map((i) => i.hook ?? i.page).join(", ")}. ${fixed.length === 1 ? "It is" : "They are"} on the timeline in blue.`, "success");
  };

  const refresh = () => {
    play("tap");
    void readFixed();
    /* Up to date or not, it asks and brings the code in again (J, 2026-10-06): the board can drift from the code without the code moving. */
    void read();
    setAsk("refresh");
  };
  const bringAgain = (keep: boolean) => {
    setAsk(null);
    placeBring(wantOf(source), keep);
    say("Bringing it in again", keep ? `Reading ${source.repo} as it is now, keeping what you changed on the board.` : `Reading ${source.repo} as it is now, from a clear board.`);
  };

  /*
   * THE SAME CODE, READ AGAIN BY THIS BUILDER (J, 2026-10-11: a builder fix
   * with no new code should not need the whole Clear and bring in). The
   * files are read at the commit the board came in from, so nothing new
   * comes from the code, and this build's reader makes the parts again;
   * keeping, his changes are laid back over them as "Keep my changes" does.
   */
  const readAgain = (keep: boolean) => {
    setAsk(null);
    placeBring(wantOf(source), keep, source.commit ?? null);
    const at = source.commit ? `at ${source.commit.slice(0, 7)}, the commit it came in from` : "as it is now";
    say("Reading it again with this builder", `Reading the same code of ${source.repo} ${at}, with the latest builder${keep ? ", keeping what you changed on the board" : ", from a clear board"}.`);
  };

  /* Back to the board as the last bring-in left it, from the copy kept then: nothing is read (`lastBring.ts`). */
  const resetBack = async () => {
    setAsk(null);
    /* A copy another build read is that build's reading: the same code is read again with this one instead (`olderBuilder`). */
    const kept = await readLastBring();
    if (kept && olderBuilder(kept)) { readAgain(false); return; }
    const copy = await resetToLastBring();
    if (!copy) { say("Nothing kept to reset to", "This site has no bring-in kept yet: Clear and bring in once, and Reset goes back to that from then on.", "warn"); return; }
    play("confirm");
    say("Reset to the last bring-in", `The board is back as ${copy.repo ?? source.repo} came in, ${new Date(copy.at).toLocaleString()}. Nothing was read again. One undo brings your changes back.`, "success");
  };

  const publish = () => {
    play("tap");
    const l = fixLoopOf(useStudio.getState().look);
    const queued = l.ticked.some((k) => !l.sent.some((i) => i.key === k)) || asksToSend(l, asksNow(source)).length > 0;
    if (!queued && (empty || status?.pending === false)) { say("Nothing to publish", `The code already has this design: nothing on the board differs from ${source.repo}.`); return; }
    /* The board's check list first; then what changes, and his yes. */
    void checkThenPublish(() => setAsk("publish"));
  };
  const publishNow = async () => {
    setAsk(null);
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (!token) { say("Publish needs your GitHub key", "It writes to the repository with your own key: add one under Keys.", "warn"); return; }
    setBusy("Publishing…");
    try {
      const site = activeProject()?.name || source.repo.split("/")[1] || "site";
      /* Ticked issues not yet queued go in polio/NEXT.md, with what he set that CSS cannot carry and each part made in the Builder (`publishAsks.ts`). */
      const { fresh, adding, extra, nodes: withHooks, says } = await gatherAsks(nodes as unknown as LayerNode[], source, token, site);
      if (says) { say("Not published", says, "warn"); return; }
      const sent = await sendDesign(withHooks as unknown as LayerNode[], palette, source, token, { site, family, say: (t) => setBusy(t), extra, fresh });
      if (!sent.ok) { say("Not published", sent.says, "warn"); return; }
      /* Not merged: its NEXT.md lines are pending, so Refresh neither forgets them nor reads them as fixed. */
      const unmerged = (says: string) => { if (adding.length) setFixLoop(sentUnmerged(fixLoopOf(useStudio.getState().look), adding)); say("Sent, not merged", says, "warn"); };
      if (!sent.pull) { unmerged(sent.says); return; }
      setBusy("Merging…");
      const merged = await mergePull(source.repo, sent.pull, token, { title: `Design from the Builder: ${site}` });
      if (!merged.ok) { unmerged(merged.says); return; }
      /*
       * The code has the design now: what is published, and the commit it is at, so Refresh is green.
       * Only when the merge sat on the commit the board was read at: a code chat's change merged in
       * between is not on the board, so the board keeps its commit and Refresh stays orange.
       */
      const st = useStudio.getState();
      const now = (st.look as { styleSource?: StyleSource | null }).styleSource;
      const parent = await parentOf(source.repo, merged.sha, token).catch(() => null);
      const commit = commitAfterPublish(now?.commit ?? source.commit, parent, merged.sha);
      if (now) st.setLook({ styleSource: { ...now, sent: sent.print, commit } } as never);
      if (adding.length) setFixLoop(sentMerged(fixLoopOf(useStudio.getState().look), adding));
      if (commit === merged.sha) setHead(merged.sha); else void read();
      play("confirm");
      const moved = commit === merged.sha ? "" : " The code had moved on since this board read it: Refresh (Keep my changes) brings in what changed.";
      say("Published", `The design is merged into ${source.repo} (${merged.sha.slice(0, 7)}): ${sent.files.join(", ")}. Wherever the repository deploys from, it goes live from there.${moved}`, "success");
    } finally {
      setBusy(null);
    }
  };

  const green = status?.at === "current" && !status.pending;
  const changes = `${layer.rules.length} part${layer.rules.length === 1 ? "" : "s"} restyled and ${layer.vars.length} design token${layer.vars.length === 1 ? "" : "s"} set`;
  return (
    <span className="flex items-center gap-1.5" data-code-site="">
      <Tooltip content={status?.says ?? `Reading ${source.repo}…`}>
        <span>
          <Button variant="outline" size="sm" data-code-refresh="" data-code-status={status ? (green ? "current" : status.at) : "reading"} disabled={!!busy} onClick={refresh}
            className={green ? "border-[oklch(0.72_0.17_150)] text-[oklch(0.82_0.17_150)]" : status?.at === "behind" ? "border-warning text-warning" : undefined}>
            {green ? <Check /> : <RefreshCw />} {green ? "Up to date" : "Refresh"}
          </Button>
        </span>
      </Tooltip>
      <Tooltip content={empty || status?.pending === false ? "Nothing to publish: the code has this design." : `Publish ${changes} into ${source.repo}: a style branch, merged.`}>
        <span>
          <Button variant={status?.pending ? "primary" : "outline"} size="sm" data-code-publish="" disabled={!!busy} onClick={publish}>
            {busy ? <Loader2 className="animate-spin" /> : <GitMerge />} {busy ?? "Publish"}
          </Button>
        </span>
      </Tooltip>
      <Dialog
        open={ask === "refresh"}
        onOpenChange={(v) => { if (!v) setAsk(null); }}
        title={`Bring ${source.repo} in again?`}
        footer={<Button variant="ghost" size="sm" onClick={() => setAsk(null)}>Back to the board</Button>}
      >
        {/*
          THREE WAYS BACK, ONE ROW EACH (J, 2026-10-09: with Reset added the
          footer's four buttons no longer fit and one was pushed out). Each
          choice is a row as wide as the dialog with what it does under its
          name, so the paragraph that used to explain all three is gone and
          no width of dialog crowds them.
        */}
        <p data-code-refresh-says="" className="text-plain text-fg-muted">
          {status?.says ?? ""} {status?.pending ? "The design on the board is not published yet: Clear would lose it, so Publish it first or keep your changes." : "Everything already published is in the code, so it comes back with it."}
        </p>
        <div data-code-refresh-choices="" className="mt-3 flex flex-col gap-2">
          <Choice hook={{ "data-code-refresh-go": "" }} primary icon={<RefreshCw />} title="Clear and bring in" says="Reads the code as it is now and starts the board from it alone." onClick={() => bringAgain(false)} />
          <Choice hook={{ "data-code-refresh-keep": "" }} title="Keep my changes" says="Reads the code as it is now and lays it over the board, keeping what you changed by hand." onClick={() => bringAgain(true)} />
          <Choice hook={{ "data-code-refresh-reread": "" }} icon={<ScanSearch />} title="Read again with the latest builder"
            says={`Reads the same code again${source.commit ? `, at the commit it came in from (${source.commit.slice(0, 7)})` : ""}, with the builder's newest fixes, keeping what you changed by hand. Nothing new comes from the code.`}
            onClick={() => readAgain(true)} />
          <Choice hook={{ "data-code-refresh-reset": "" }} icon={<RotateCcw />} disabled={!last} title="Reset to last bring-in"
            says={!last ? "Nothing kept yet: the next bring-in is kept, and this goes back to it."
              : olderBuilder(last) ? `The builder has changed since it came in, ${new Date(last.at).toLocaleString()}: reads the same code again with it, on a clear board. Nothing new comes from the code.`
              : `Puts the board back as it came in, ${new Date(last.at).toLocaleString()}, at once, without reading anything.`}
            onClick={() => void resetBack()} />
        </div>
      </Dialog>
      <Dialog
        open={ask === "publish"}
        onOpenChange={(v) => { if (!v) setAsk(null); }}
        title={`Publish into ${source.repo}?`}
        footer={
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAsk(null)}>Back to the board</Button>
            <span className="flex-1" />
            <Button variant="primary" size="sm" data-code-publish-go="" onClick={() => void publishNow()}><GitMerge /> Publish and merge</Button>
          </div>
        }
      >
        <div data-code-publish-says="" className="space-y-2 text-plain text-fg-muted">
          <FixNote source={source} />
          {status?.at === "behind" ? <p data-code-publish-behind="" className="text-warning">{status.says} Publishing first is fine: the code keeps its changes, and Refresh stays orange until they are on the board.</p> : null}
          <p>{changes}. Only the look changes: the style layer{source.kit ? ", the hooks map made from it" : ""} and the design record. Its scripts, pages and every hook stay as they are.</p>
          <p>It goes on a new style/ branch and is merged into {source.ref || "the default branch"} at once. Wherever {source.repo} deploys from, the site updates from there.</p>
          {layer.rules.length ? <p className="text-small text-fg-faint">{layer.rules.slice(0, 6).map((r) => r.selector).join(", ")}{layer.rules.length > 6 ? ", …" : ""}</p> : null}
        </div>
      </Dialog>
    </span>
  );
}

/** In the Publish dialog: how many ticked issues, and how many board changes CSS cannot carry, go to polio/NEXT.md with it. */
function FixNote({ source }: { source: StyleSource }) {
  const loop = fixLoopOf(useStudio((s) => s.look));
  /* Read again when what the asks come from changes. */
  const nodes = useStudio((s) => s.nodes);
  const pages = useStudio((s) => s.pages);
  const format = useStudio((s) => s.format);
  const n = loop.ticked.filter((k) => !loop.sent.some((i) => i.key === k)).length;
  const asks = React.useMemo(() => asksToSend(loop, asksNow(source)), [loop, source, nodes, pages, format]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {n ? <p data-code-publish-fixes="">{n} ticked issue{n === 1 ? "" : "s"} go{n === 1 ? "es" : ""} into polio/NEXT.md, for the next code chat to fix first.</p> : null}
      {asks.length ? <p data-code-publish-asks="">{asks.length} change{asks.length === 1 ? "" : "s"} CSS cannot carry ({asks.slice(0, 3).map((i) => (/"([^"]+)"/.exec(i.says)?.[1] ?? i.kind)).join(", ")}{asks.length > 3 ? ", …" : ""}) go{asks.length === 1 ? "es" : ""} into polio/NEXT.md, for the code chat to build.</p> : null}
    </>
  );
}

/** One way to bring the site in again: its name, and what it does under it, as wide as the dialog. */
function Choice({ hook, title, says, icon, primary, disabled, onClick }: { hook: Record<string, string>; title: string; says: string; icon?: React.ReactNode; primary?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" {...hook} disabled={disabled} onClick={onClick}
      className={cn("tactile flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50",
        primary ? "border-accent bg-accent-soft hover:bg-hover" : "border-border hover:border-border-strong hover:bg-hover")}>
      <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-fg [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-semibold text-fg">{title}</span>
        <span className="block text-small text-fg-muted">{says}</span>
      </span>
    </button>
  );
}
