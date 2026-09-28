"use client";
/**
 * The Recapture panel in the repo menu, and the run behind it.
 *
 * The run lives in a small store, not in the panel: a capture takes minutes,
 * and closing the menu must not lose it. When it ends the store holds what
 * to bring in, and the menu's Bring in section offers it through its own
 * Replace prompt (`RepoPicker.tsx`) the next time it is open — at once, if
 * it is open already. `recapture.ts` holds the rules; this only shows them.
 */
import * as React from "react";
import { create } from "zustand";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { heldKeys } from "@/features/keys/store";
import { readCaptureRecord, recapturePlan, runRecapture, type Plan, type Source } from "./recapture";

type Stage =
  | { at: "idle" }
  | { at: "reading" }
  | { at: "asking"; plan: Plan }
  | { at: "running"; plan: Plan; step: string; htmlUrl: string }
  | { at: "refused"; plan: Plan | null; says: string }
  | { at: "ready"; plan: Plan; want: string; path: string; note: string | null };

interface RecaptureState {
  stage: Stage;
  set: (s: Stage) => void;
}
export const useRecapture = create<RecaptureState>()((set) => ({ stage: { at: "idle" }, set: (stage) => set({ stage }) }));

const token = () => heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";

/** Open the panel: read what the capture recorded, and plan the run. */
export async function openRecapture(src: Source): Promise<void> {
  const st = useRecapture.getState();
  if (st.stage.at === "running") return;
  st.set({ at: "reading" });
  const record = await readCaptureRecord(src, token());
  /* No record to read (an older capture, or no key yet): the address is typed instead, and the pages are the home page. */
  const plan = recapturePlan(src, record);
  if (!plan) { st.set({ at: "refused", plan: null, says: "This site was not brought in from a capture folder, so there is no address to capture again." }); return; }
  st.set({ at: "asking", plan });
}

async function start(src: Source, plan: Plan, say: (title: string, body: string) => void) {
  const st = useRecapture.getState();
  st.set({ at: "running", plan, step: "Starting", htmlUrl: "" });
  const out = await runRecapture({
    repo: { owner: src.owner, name: src.name },
    token: token(),
    plan,
    onStarted: (htmlUrl) => { const s = useRecapture.getState().stage; if (s.at === "running") st.set({ ...s, htmlUrl }); },
    onProgress: (p) => { const s = useRecapture.getState().stage; if (s.at === "running") st.set({ ...s, step: p.step || (p.status === "queued" ? "Waiting for a runner" : "Running"), htmlUrl: p.htmlUrl || s.htmlUrl }); },
  });
  if (!out.ok) { st.set({ at: "refused", plan, says: out.says }); return; }
  st.set({ at: "ready", plan, want: `${src.owner}/${src.name}@${out.ref}`, path: out.path, note: out.note });
  say(`${plan.url} is captured again`, `It is at ${out.path} on ${out.ref}. Open the repo menu to bring it in.`);
}

export function RecapturePanel({ source, say }: { source: Source; say: (title: string, body: string) => void }) {
  const stage = useRecapture((s) => s.stage);
  const set = useRecapture((s) => s.set);
  const [url, setUrl] = React.useState("");
  const plan = stage.at === "asking" || stage.at === "running" || stage.at === "ready" ? stage.plan : stage.at === "refused" ? stage.plan : null;
  React.useEffect(() => { if (stage.at === "asking") setUrl(stage.plan.url); }, [stage]);
  if (stage.at === "idle") return null;
  let address: URL | null = null;
  try { address = new URL(url.trim()); } catch { address = null; }
  const ok = !!address && /^https?:$/.test(address.protocol);
  return (
    <div data-recapture="" className="mt-1.5 flex flex-col gap-1.5 rounded-md border border-border bg-bg-subtle/40 px-2 py-2">
      {stage.at === "reading" ? <p className="flex items-center gap-1.5 text-small text-fg-muted"><Loader2 className="size-3 animate-spin" /> Reading what the capture recorded…</p> : null}
      {stage.at === "asking" ? (
        <>
          <label className="flex flex-col gap-1 text-small text-fg-muted">
            The address to capture again
            <Input inputSize="sm" data-recapture-url="" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="h-7 font-mono text-plain" spellCheck={false} />
          </label>
          <p className="text-small text-fg-muted">
            Pages <span className="font-mono text-fg">{stage.plan.pages}</span>, as before. It lands in <span className="font-mono text-fg">{source.owner}/{source.name}/{stage.plan.lands.path}</span> on <span className="font-mono text-fg">{stage.plan.lands.ref}</span>.
          </p>
          {stage.plan.branchNote ? <p data-recapture-branch="" className="text-small text-fg-muted">{stage.plan.branchNote}</p> : null}
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" data-recapture-start="" disabled={!ok} onClick={() => void start(source, { ...stage.plan, url: url.trim() }, say)}>
              <RefreshCw /> Capture it again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => set({ at: "idle" })}>Not now</Button>
          </div>
        </>
      ) : null}
      {stage.at === "running" ? (
        <p data-recapture-progress="" className="flex items-center gap-1.5 text-small text-fg">
          <Loader2 className="size-3 shrink-0 animate-spin" />
          <span className="min-w-0 flex-1">Capturing {stage.plan.url}: {stage.step}. Checked every 10 seconds; the menu can be closed.</span>
          {stage.htmlUrl ? <a href={stage.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-fg-muted hover:text-fg">run <ExternalLink className="size-3" /></a> : null}
        </p>
      ) : null}
      {stage.at === "refused" ? (
        <>
          <p data-recapture-refused="" className="text-small text-fg">{stage.says}</p>
          <div className="flex gap-1.5">
            {plan ? <Button size="sm" variant="outline" onClick={() => set({ at: "asking", plan })}>Try again</Button> : null}
            <Button size="sm" variant="ghost" onClick={() => set({ at: "idle" })}>Close</Button>
          </div>
        </>
      ) : null}
      {stage.at === "ready" ? (
        <p data-recapture-ready="" className="text-small text-fg">
          Captured again: {stage.path} on {stage.want.split("@")[1]}.{stage.note ? ` ${stage.note}` : ""} Below: bring it in, or keep this board.
        </p>
      ) : null}
    </div>
  );
}
