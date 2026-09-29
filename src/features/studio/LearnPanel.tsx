"use client";
/**
 * Learn on click, on screen: a row in the part's green menu, and the
 * "Learn (n)" badge on the board. What they read and write is `learn.ts`.
 *
 * The row shows only on a part the capture held a server call on, never for
 * a wallet; the menu's other options are untouched. The badge sends one
 * request for the whole queue through the Recapture path, within the
 * owner's daily cap, and until the capturer says it can press, it sends
 * nothing and says it is waiting (`tests/learn-on-click.mjs`).
 */
import * as React from "react";
import { SCREEN } from "@/core/ui/void";
import { play } from "@/core/audio/engine";
import { useBuilds } from "@/features/builds/store";
import { useStudio, type StudioNode } from "./store";
import { afterSend, heldOn, isLearned, keyOf, LEARN_DEFAULT, learnable, learnRequest, leftToday, queued, WAITING } from "./learn";
import { readCaptureRecord, recapturePlan, runRecapture } from "./recapture";
import { heldKeys } from "@/features/keys/store";

const key = "rounded-sm border px-1.5 py-0.5 text-small";
const keyStyle = { borderColor: SCREEN.line, color: SCREEN.ink, background: SCREEN.key };

export function LearnRow({ node }: { node: StudioNode }) {
  const learn = useStudio((s) => s.learn ?? LEARN_DEFAULT);
  const pageId = useStudio((s) => s.activePageId);
  const mine = heldOn(learn, node.id).filter(learnable);
  const [asking, setAsking] = React.useState<string | null>(null);
  if (!mine.length) return null;
  const set = useStudio.getState().setLearn;
  const onPage = learn.held.filter((h) => h.page === pageId && learnable(h) && !isLearned(learn, h) && !learn.queue.includes(keyOf(h)));
  return (
    <div data-learn-row={node.id} className="mt-1 flex flex-col gap-1 border-t pt-1" style={{ borderColor: SCREEN.line }}>
      {mine.map((h) => {
        const k = keyOf(h);
        const inQueue = learn.queue.includes(k);
        const done = isLearned(learn, h);
        return (
          <div key={k} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-mono text-fine" style={{ color: SCREEN.dim }} title={h.hook ?? h.selector}>held: {h.why}{h.control ? ` · ${h.control}` : ""}</span>
              {done ? (
                <button type="button" data-learn-again={k} className={key} style={keyStyle} onClick={() => { play("tick"); set((s) => queued(s, [h], true)); }}>Learn again</button>
              ) : inQueue ? (
                <span data-learn-queued={k} className="text-fine" style={{ color: SCREEN.dim }}>queued</span>
              ) : (
                <button type="button" data-learn={k} className={key} style={keyStyle} onClick={() => { play("tick"); if (h.form) setAsking(k); else set((s) => queued(s, [h])); }}>Learn</button>
              )}
            </div>
            {asking === k ? (
              <div data-learn-values={k} className="flex flex-col gap-1">
                <p className="text-fine" style={{ color: SCREEN.dim }}>It sends a form. The values to send, one name=value a line:</p>
                <textarea
                  data-learn-values-input=""
                  rows={3}
                  defaultValue={learn.values[k] ?? ""}
                  className="rounded-sm border bg-transparent p-1 font-mono text-small outline-none"
                  style={{ borderColor: SCREEN.line, color: SCREEN.ink }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onChange={(e) => { const v = e.target.value; set((s) => ({ ...s, values: { ...s.values, [k]: v } })); }}
                />
                <button type="button" data-learn-values-go={k} className={key} style={keyStyle} onClick={() => { setAsking(null); set((s) => queued(s, [h])); }}>Learn with these</button>
              </div>
            ) : null}
          </div>
        );
      })}
      {onPage.length ? (
        <button type="button" data-learn-page="" className={key} style={keyStyle} onClick={() => { play("tick"); set((s) => queued(s, onPage)); }}>
          Learn all on this page ({onPage.length})
        </button>
      ) : null}
    </div>
  );
}

/** The queue, on the board: one press sends it all. */
export function LearnBadge() {
  const learn = useStudio((s) => s.learn ?? LEARN_DEFAULT);
  const source = useBuilds((s) => s.projects.find((p) => p.id === s.activeId)?.source ?? null);
  const [said, setSaid] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (!learn.queue.length) return null;
  const set = useStudio.getState().setLearn;
  const send = async () => {
    if (!learn.supported) { setSaid(WAITING); return; }
    const req = learnRequest(learn);
    if (!req) { setSaid(leftToday(learn) ? "Nothing in the queue can be learned." : "Today's presses are used up."); return; }
    if (!source?.dir) { setSaid("This site was not brought in from a capture folder, so there is nothing to capture again."); return; }
    setBusy(true);
    try {
      const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
      const plan = recapturePlan(source, await readCaptureRecord(source, token));
      if (!plan) { setSaid("There is no address to capture again."); return; }
      const out = await runRecapture({ repo: { owner: source.owner, name: source.name }, token, plan: { ...plan, learn: req.learn }, onProgress: (p) => setSaid(p.step || "Capturing…") });
      if (!out.ok) { setSaid(out.says); return; }
      set((s) => afterSend(s, req));
      setSaid(`Asked for ${req.learn.targets.length}: bring the new capture in to see what they do.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-learn-badge={learn.queue.length} className="pointer-events-auto absolute bottom-3 left-3 z-30 flex max-w-[320px] flex-col gap-1 rounded-md border px-2 py-1.5 text-small" style={{ background: SCREEN.key, borderColor: SCREEN.line, color: SCREEN.ink }}>
      <div className="flex items-center gap-1.5">
        <button type="button" data-learn-send="" disabled={busy} className={key} style={keyStyle} onClick={() => void send()}>Learn ({learn.queue.length})</button>
        <label className="flex items-center gap-1 text-small" style={{ color: SCREEN.dim }}>
          at most
          <input
            data-learn-cap=""
            type="number"
            min={0}
            max={500}
            value={learn.cap}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => { const n = Math.max(0, Math.min(500, Math.round(Number(e.target.value) || 0))); set((s) => ({ ...s, cap: n })); }}
            className="w-10 rounded-sm border bg-transparent px-1 text-small"
            style={{ borderColor: SCREEN.line, color: SCREEN.ink }}
          />
          a day
        </label>
        <button type="button" data-learn-clear="" className="text-small" style={{ color: SCREEN.dim }} onClick={() => { set((s) => ({ ...s, queue: [] })); setSaid(null); }}>clear</button>
      </div>
      {!learn.supported ? <p data-learn-waiting="" className="text-small" style={{ color: SCREEN.dim }}>{WAITING}</p> : null}
      {said && said !== WAITING ? <p data-learn-said="" className="text-small">{said}</p> : null}
    </div>
  );
}
