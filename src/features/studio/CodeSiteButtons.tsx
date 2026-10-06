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
 *             the pull request open, linked, with why.
 *
 * The repo menu keeps the rest: the list, another repository, a new one.
 */
import * as React from "react";
import { Check, GitMerge, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Tooltip } from "@/core/ui/tooltip";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { heldKeys } from "@/features/keys/store";
import { activeProject } from "@/features/builds/store";
import { useStudio, useSteady } from "./store";
import { FAMILY } from "./parts/theme";
import { buildLayer, type LayerNode, type StyleSource } from "./styleLayer";
import { codeStatus, headOf, layerPrint, mergePull, type CodeStatus } from "./codePublish";
import { sendDesign } from "./codeSend";
import { checkThenPublish } from "./PublishCheck";
import { placeBring } from "./bringRepo";

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
  const nodes = useSteady(useStudio((s) => s.nodes));
  const palette = useStudio((s) => s.look.palette as Record<string, string>);
  const layer = React.useMemo(() => buildLayer(nodes as unknown as LayerNode[], palette, source, { family, kit: !!source.kit }), [nodes, palette, source]);
  const empty = !layer.rules.length && !layer.vars.length;
  const print = React.useMemo(() => layerPrint(layer.css), [layer.css]);
  const [head, setHead] = React.useState<string | null | undefined>(undefined);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [ask, setAsk] = React.useState<"refresh" | "publish" | null>(null);
  const status: CodeStatus | null = head === undefined ? null : codeStatus(source, head, print, empty);

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

  const refresh = () => {
    play("tap");
    /* Up to date or not, it asks and brings the code in again (J, 2026-10-06): the board can drift from the code without the code moving. */
    void read();
    setAsk("refresh");
  };
  const bringAgain = (keep: boolean) => {
    setAsk(null);
    placeBring(wantOf(source), keep);
    say("Bringing it in again", keep ? `Reading ${source.repo} as it is now, keeping what you changed on the board.` : `Reading ${source.repo} as it is now, from a clear board.`);
  };

  const publish = () => {
    play("tap");
    if (empty || status?.pending === false) { say("Nothing to publish", `The code already has this design: nothing on the board differs from ${source.repo}.`); return; }
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
      const sent = await sendDesign(nodes as unknown as LayerNode[], palette, source, token, { site, family, say: (t) => setBusy(t) });
      if (!sent.ok) { say("Not published", sent.says, "warn"); return; }
      if (!sent.pull) { say("Sent, not merged", sent.says, "warn"); return; }
      setBusy("Merging…");
      const merged = await mergePull(source.repo, sent.pull, token, { title: `Design from the Builder: ${site}` });
      if (!merged.ok) { say("Sent, not merged", merged.says, "warn"); return; }
      /* The code has the design now: what is published, and the commit it is at, so Refresh is green. */
      const st = useStudio.getState();
      const now = (st.look as { styleSource?: StyleSource | null }).styleSource;
      if (now) st.setLook({ styleSource: { ...now, sent: sent.print, commit: merged.sha } } as never);
      setHead(merged.sha);
      play("confirm");
      say("Published", `The design is merged into ${source.repo} (${merged.sha.slice(0, 7)}): ${sent.files.join(", ")}. Wherever the repository deploys from, it goes live from there.`, "success");
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
        footer={
          <div className="flex w-full items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAsk(null)}>Back to the board</Button>
            <span className="flex-1" />
            <Button variant="outline" size="sm" data-code-refresh-keep="" onClick={() => bringAgain(true)}>Keep my changes</Button>
            <Button variant="primary" size="sm" data-code-refresh-go="" onClick={() => bringAgain(false)}><RefreshCw /> Clear and bring in</Button>
          </div>
        }
      >
        <p data-code-refresh-says="" className="text-plain text-fg-muted">
          {status?.says ?? ""} The board is read again from the code as it is now. Keep my changes lays it over the board and keeps what you changed by hand; Clear and bring in starts from the code alone.
          {status?.pending ? " The design on the board is not published yet: Clear would lose it, so Publish it first or keep your changes." : " Everything already published is in the code, so it comes back with it."}
        </p>
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
          <p>{changes}. Only the look changes: the style layer{source.kit ? ", the hooks map made from it" : ""} and the design record. Its scripts, pages and every hook stay as they are.</p>
          <p>It goes on a new style/ branch and is merged into {source.ref || "the default branch"} at once. Wherever {source.repo} deploys from, the site updates from there.</p>
          {layer.rules.length ? <p className="text-small text-fg-faint">{layer.rules.slice(0, 6).map((r) => r.selector).join(", ")}{layer.rules.length > 6 ? ", …" : ""}</p> : null}
        </div>
      </Dialog>
    </span>
  );
}
