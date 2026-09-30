"use client";
/**
 * What changed about the website, over the whole screen, from the bar.
 *
 * Not a page like Builds or Preview: a slide over, because knowing what
 * changed is something you do *while* you are working, not somewhere you
 * navigate to and come back from. Escape or a press outside puts it away and
 * the board is exactly where you left it.
 *
 * Two rules it is built on.
 *
 * - **Real record, not a written changelog.** Every line here was read out of
 *   the history by `npm run passes`. Nobody writes a changelog entry by hand
 *   — that chore was killed on purpose and stays dead.
 * - **Only the changes to the website itself.** The absolute rule, kept in
 *   `aboutTheSite.ts`: nothing here mentions him, me, the chats, the models,
 *   or how the work is made. That took the whole of what used to hang off a
 *   line — the folded body, the corners it touched, the name it landed under
 *   — and a fourth kind of change that was never a change to the website.
 *   10,075 words became 916, and there is nothing left to unfold, so a line
 *   is a line and the list is the whole of it.
 *
 * IT IS CURRENT ON ITS OWN NOW. It read a snapshot that someone had to
 * regenerate by hand, and nobody did after 21 September: it stopped at
 * "V1.6", in boxes numbered like releases that were not releases. It asks
 * `/api/updates` when it opens (GitHub's list from the very build that is
 * live, `git log` where there is one, the snapshot last), and shows one
 * plain line per change, newest first, under the day it landed, with the
 * live version and when it was built on top. The snapshot is drawn at once
 * and replaced when the answer comes, so the panel is never empty.
 *
 * It keeps the timeline's colours (`FIELD`) rather than inventing a second
 * way to show a list of things that happened.
 */
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { CalendarDays, History, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { VirtualList } from "@/core/ui/virtual-list";
import { heldKeys } from "@/features/keys/store";
import { ageOf } from "@/features/builds/BuildMark";
import { FIELD, Row } from "./TimelineDetail";
import { PASSES } from "./passes.ts";
import { dayOf, shapeLines, type Landed, type UpdatesAnswer } from "./landed";

/** The snapshot, shaped as the route shapes it: what shows before the answer comes. */
const SAVED: UpdatesAnswer = (() => {
  const shaped = shapeLines(PASSES.flatMap((p) => p.changes.map((c) => ({ id: c.id, says: c.says, when: c.when }))));
  return { live: { commit: null, short: null, branch: null, builtAt: null }, source: "saved", changes: shaped.changes, counted: shaped.counted };
})();

/** Asked once per page load, again only when the panel is opened after ten minutes. */
let asked: { at: number; answer: Promise<UpdatesAnswer | null> } | null = null;
function askUpdates(): Promise<UpdatesAnswer | null> {
  if (asked && Date.now() - asked.at < 10 * 60_000) return asked.answer;
  const key = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
  const answer = fetch("/api/updates", { cache: "no-store", headers: key ? { "x-github-token": key } : {} })
    .then((r) => (r.ok ? (r.json() as Promise<UpdatesAnswer>) : null))
    .catch(() => null);
  asked = { at: Date.now(), answer };
  return answer;
}

/** One day's changes: a card of its own, the timeline's own material, one line each. */
type Day = { day: string; changes: Landed[] };
const PER_CARD = 6;

/**
 * A press outside or Escape closes it, and it stands over nearly everything.
 *
 * Nearly, not everything: the bar it was opened from stays visible above it,
 * so the way out is where the way in was.
 */
export function UpdatesPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [answer, setAnswer] = React.useState<UpdatesAnswer>(SAVED);
  const [asking, setAsking] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setAsking(true);
    void askUpdates().then((a) => { if (!alive) return; if (a) setAnswer(a); setAsking(false); });
    return () => { alive = false; };
  }, [open]);

  /* Newest first, one line each, under the day it landed. */
  const rows = React.useMemo(() => {
    /* A busy day is several cards of at most PER_CARD lines, never one wall: the old boxes stopped at twelve for the same reason. */
    const out: (Day & { key: string; more: boolean })[] = [];
    for (const c of answer.changes) {
      const d = dayOf(c.when);
      const last = out.at(-1);
      if (!last || last.day !== d || last.changes.length >= PER_CARD) out.push({ day: d, changes: [], key: `${d}:${out.length}`, more: last?.day === d });
      out.at(-1)!.changes.push(c);
    }
    return out;
  }, [answer]);
  const { live } = answer;
  const built = live.builtAt ? new Date(live.builtAt) : null;

  return (
    <D.Root open={open} onOpenChange={(v) => { play(v ? "open" : "close"); onOpenChange(v); }}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[75] bg-overlay animate-fade-in backdrop-blur-[2px]" />
        <D.Content
          data-updates-panel=""
          data-updates-source={answer.source}
          aria-label="What has landed"
          // Nearly the whole screen, not a dialog: the width is the window's,
          // less a margin that keeps the bar it was opened from in sight. The
          // lines inside stay in a column a person can read — a 2560px wide
          // sentence is not more of the screen used, it is a worse read.
          className="fixed left-1/2 top-[var(--topbar-h)] z-[76] flex h-[calc(100dvh-var(--topbar-h)-1rem)] w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col overflow-hidden rounded-lg border shadow-panel outline-none animate-pop"
          style={{ borderColor: FIELD.rim, background: FIELD.face }}
        >
          <header className="shrink-0 border-b px-4 py-3" style={{ borderColor: FIELD.rim }}>
            <div className="mx-auto flex w-full max-w-[1100px] items-start justify-between gap-4">
              <div className="min-w-0">
                <D.Title className="flex items-center gap-2 text-sm font-semibold" style={{ color: FIELD.text }}>
                  <History className="size-4" style={{ color: FIELD.lit }} />
                  What has landed
                </D.Title>
                {/* Which build is live, and when it was built: the first thing asked of a list like this. */}
                <p data-updates-live="" className="mt-0.5 text-plain" style={{ color: FIELD.text }}>
                  {live.short ? <>Live version <span className="font-mono">{live.short}</span></> : "Live version not named by this build"}
                  {built && !Number.isNaN(built.getTime()) ? <>, {ageOf(live.builtAt)} ({built.toLocaleString(undefined, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })})</> : null}
                </p>
                <D.Description className="mt-0.5 text-plain" style={{ color: FIELD.dim }}>
                  {answer.changes.length} changes, newest first, one line each.{asking ? " Asking for the newest…" : ""}
                </D.Description>
                {answer.note ? <p data-updates-note="" className="mt-0.5 text-small" style={{ color: FIELD.dim }}>{answer.note}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <D.Close asChild>
                  <Button variant="ghost" size="iconXs" aria-label="Close">
                    <X />
                  </Button>
                </D.Close>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 p-3">
            {rows.length ? (
              <VirtualList
                className="mx-auto w-full max-w-[1100px]"
                items={rows}
                estimateSize={120}
                getKey={(r) => r.key}
                renderItem={(r, i) => (
                  <div data-updates-day={r.more ? undefined : r.day} className="pb-2.5">
                    <Row skin={FIELD} seed={r.key} at={i} icon={<CalendarDays className="size-3" />} title={r.more ? `${r.day}, continued` : r.day}>
                      <div className="flex flex-col gap-0.5">
                        {r.changes.map((c) => (
                          <p key={c.id} data-change="" className="rounded-md px-1.5 py-0.5 text-[12.5px] leading-snug" style={{ color: FIELD.text }}><span>{c.says}</span></p>
                        ))}
                      </div>
                    </Row>
                  </div>
                )}
              />
            ) : (
              <p className="p-6 text-center text-large" style={{ color: FIELD.dim }}>
                Nothing has landed yet. The first change to the site will show up here on its own.
              </p>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
