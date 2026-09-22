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
 * It borrows the timeline's own card language (`FIELD`, `Row`) rather than
 * inventing a second way to show a list of things that happened.
 */
import * as React from "react";
import { BuildMark } from "@/features/builds/BuildMark";
import { Dialog as D } from "radix-ui";
import { History, Sparkles, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { FIELD, Row, type Skin } from "./TimelineDetail";
import { KIND_MEANS, PASSES, leadOf, minutes, sizeOf, versionOf, type Change, type ChangeKind, type Pass } from "./passes.ts";

/**
 * The kinds, in the colours the rest of the Builder already uses for them.
 *
 * Each is a plate with near-black words on it, so the plate's own lightness
 * is the whole of whether the word can be read: dark ink at 0.13 needs a
 * ground above about 0.78 to clear 4.5:1, and three of these sat under that
 * — "better" worst at 3.7:1. They are all above it now.
 */
const KIND_LIT: Record<ChangeKind, string> = {
  new: "oklch(0.81 0.16 300)",
  better: "oklch(0.82 0.15 158)",
  fixed: "oklch(0.85 0.14 85)",
};

/** The words on a plate, dark enough that the plate's own lightness carries them. */
const KIND_INK = "oklch(0.13 0.02 150)";

/**
 * A press outside or Escape closes it, and it stands over nearly everything.
 *
 * Nearly, not everything: the bar it was opened from stays visible above it,
 * so the way out is where the way in was.
 */
export function UpdatesPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const passes = PASSES;
  const read = minutes(passes);
  const changes = passes.reduce((n, p) => n + p.changes.length, 0);

  return (
    <D.Root open={open} onOpenChange={(v) => { play(v ? "open" : "close"); onOpenChange(v); }}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[75] bg-overlay animate-fade-in backdrop-blur-[2px]" />
        <D.Content
          data-updates-panel=""
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
              <D.Description className="mt-0.5 text-plain" style={{ color: FIELD.dim }}>
                {passes.length} passes, {changes} changes, about {read} minute{read === 1 ? "" : "s"} to read. Newest first.
              </D.Description>
              {/* Which build is answering: the same mark the Builds page wears. */}
              <BuildMark className="mt-1 block text-small" style={{ color: FIELD.dim }} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {/* "Things I can use" stood here and hid the fourth kind. Every
                  line is a change to the website now, so it removed nothing,
                  and a control that removes nothing is a control that lies. */}
              <D.Close asChild>
                <Button variant="ghost" size="iconXs" aria-label="Close">
                  <X />
                </Button>
              </D.Close>
            </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {passes.length ? (
              <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2.5">
                {passes.map((pass, i) => <PassCard key={pass.id} pass={pass} skin={FIELD} at={i} />)}
              </div>
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

/**
 * One pass: the thing it brought, and everything else in it a line each.
 *
 * A pass that carried one change is that one change — a heading repeating the
 * only line under it is the shape of a changelog, which is what this is not.
 */
function PassCard({ pass, skin, at }: { pass: Pass; skin: Skin; at: number }) {
  const lead = leadOf(pass);
  if (!lead) return null;
  const rest = pass.changes.filter((c) => c.id !== lead.id);

  if (!rest.length) {
    return (
      <Row skin={skin} seed={pass.id} at={at} icon={<Sparkles className="size-3" />} title={`${versionOf(pass)} · one thing`}>
        <ChangeLine change={lead} skin={skin} lead />
      </Row>
    );
  }

  return (
    <Row skin={skin} seed={pass.id} at={at} icon={<Sparkles className="size-3" />} title={`${versionOf(pass)} · ${sizeOf(pass)}`}>
      <div className="flex flex-col gap-1">
        {/* The lead is the pass's headline and its first line at once: a
            heading that repeats the line under it is the shape of a
            changelog, which is the thing this is not. */}
        <ChangeLine change={lead} skin={skin} lead />
        {rest.map((c) => <ChangeLine key={c.id} change={c} skin={skin} />)}
      </div>
      {pass.more ? (
        <p className="pt-1 text-small" style={{ color: skin.dim }}>and {pass.more} more in the same pass</p>
      ) : null}
    </Row>
  );
}

/**
 * A line: what changed about the website, and nothing under it.
 *
 * It used to be a button that unfolded the body, the corners of the tree it
 * touched and the name it landed under. All three were the making talking,
 * so all three are gone, and with nothing to unfold the button, the chevron
 * and the open state go with them. `data-change` and `data-change-kind` stay
 * where they were so the checks still have something to read.
 */
function ChangeLine({ change, skin, lead }: { change: Change; skin: Skin; lead?: boolean }) {
  return (
    <div className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left" data-change="" data-change-kind={change.kind}>
      <span
        className="mt-[3px] shrink-0 rounded-sm px-1 text-[8.5px] uppercase tracking-[0.1em]"
        style={{ background: KIND_LIT[change.kind], color: KIND_INK }}
      >
        {KIND_MEANS[change.kind]}
      </span>
      <span
        className={lead ? "min-w-0 flex-1 text-[13px] font-medium leading-snug" : "min-w-0 flex-1 text-[11.5px] leading-snug"}
        style={{ color: skin.text }}
      >
        {change.says}
      </span>
    </div>
  );
}
