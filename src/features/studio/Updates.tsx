"use client";
/**
 * What has landed, over the whole screen, from the bar.
 *
 * Not a page like Builds or Preview: a slide over, because knowing what
 * changed is something you do *while* you are working, not somewhere you
 * navigate to and come back from. Escape or a press outside puts it away and
 * the board is exactly where you left it.
 *
 * Two rules it is built on.
 *
 * - **Real history, not a written changelog.** Every line here came out of
 *   git through `npm run passes`. Nobody writes a changelog entry per commit
 *   — that chore was killed on purpose and stays dead — so the merges and the
 *   commits they carried are the record, and this reads it.
 * - **Features first, commits underneath.** A pass leads with the thing you
 *   can now do that you could not before, in the words it was done in. The
 *   rest of the pass is a line each, and the specifics — the body, what it
 *   touched, the sha — stay folded until someone asks. A minute's reading.
 *
 * It borrows the timeline's own card language (`FIELD`, `Row`) rather than
 * inventing a second way to show a list of things that happened.
 */
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { ChevronRight, History, Sparkles, Wrench, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { FIELD, Row, type Skin } from "./TimelineDetail";
import { KIND_MEANS, PASSES, leadOf, minutes, onlyUsable, sizeOf, type Change, type ChangeKind, type Pass } from "./passes.ts";

/**
 * The kinds, in the colours the rest of the Builder already uses for them.
 *
 * Each is a plate with near-black words on it, so the plate's own lightness
 * is the whole of whether the word can be read: dark ink at 0.13 needs a
 * ground above about 0.78 to clear 4.5:1, and three of these four sat under
 * that — "under it" worst at 2.9:1 and "better" at 3.7. They are all above
 * it now. `under` stays the quiet one by having almost no colour in it
 * rather than by being the dark one, which is the same move the second voice
 * of the text makes.
 */
const KIND_LIT: Record<ChangeKind, string> = {
  new: "oklch(0.81 0.16 300)",
  better: "oklch(0.82 0.15 158)",
  fixed: "oklch(0.85 0.14 85)",
  under: "oklch(0.8 0.03 158)",
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
  const [usableOnly, setUsableOnly] = React.useState(false);
  const passes = usableOnly ? onlyUsable(PASSES) : PASSES;
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
              <D.Description className="mt-0.5 text-[11px]" style={{ color: FIELD.dim }}>
                {passes.length} passes, {changes} changes, about {read} minute{read === 1 ? "" : "s"} to read. Newest first, read straight out of the history.
              </D.Description>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                data-updates-usable=""
                aria-pressed={usableOnly}
                onClick={() => { play("tick"); setUsableOnly((v) => !v); }}
                className="tactile rounded-md border px-2 py-1 text-[10px]"
                style={{
                  borderColor: FIELD.rim,
                  background: usableOnly ? FIELD.lit : FIELD.raised,
                  color: usableOnly ? FIELD.face : FIELD.dim,
                }}
              >
                Things I can use
              </button>
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
              <p className="p-6 text-center text-[12px]" style={{ color: FIELD.dim }}>
                Nothing has landed yet. The first merge will show up here on its own.
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
      <Row skin={skin} seed={pass.id} at={at} icon={<Sparkles className="size-3" />} title={`${pass.day} · one thing`}>
        <ChangeLine change={lead} skin={skin} lead />
      </Row>
    );
  }

  return (
    <Row skin={skin} seed={pass.id} at={at} icon={<Sparkles className="size-3" />} title={`${pass.day} · ${sizeOf(pass)}`}>
      <div className="flex flex-col gap-1">
        {/* The lead is the pass's headline and its first line at once: a
            heading that repeats the line under it is the shape of a
            changelog, which is the thing this is not. */}
        <ChangeLine change={lead} skin={skin} lead />
        {rest.map((c) => <ChangeLine key={c.id} change={c} skin={skin} />)}
      </div>
      {pass.more ? (
        <p className="pt-1 text-[10px]" style={{ color: skin.dim }}>and {pass.more} more in the same pass</p>
      ) : null}
    </Row>
  );
}

/** A line that says what it is; press it for the specifics. */
function ChangeLine({ change, skin, lead }: { change: Change; skin: Skin; lead?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const more = change.detail.length > 0 || change.areas.length > 0;
  return (
    <div className="rounded-md border" style={{ borderColor: open ? skin.rim : "transparent", background: open ? skin.raised : "transparent" }}>
      <button
        type="button"
        data-change=""
        data-change-kind={change.kind}
        disabled={!more}
        onClick={() => { play("tick"); setOpen((v) => !v); }}
        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left disabled:cursor-default"
      >
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
        {more ? (
          <ChevronRight className="mt-[2px] size-3 shrink-0 transition-transform" style={{ color: skin.dim, transform: open ? "rotate(90deg)" : "none" }} />
        ) : null}
      </button>
      {open ? (
        <div className="px-1.5 pb-1.5 pl-9">
          {change.detail.map((line, i) => (
            <p key={i} className="text-[10.5px] leading-relaxed" style={{ color: skin.dim }}>{line}</p>
          ))}
          <p className="pt-1 flex items-center gap-1.5 text-[9px]" style={{ color: skin.dim }}>
            <Wrench className="size-2.5" />
            {change.areas.length ? change.areas.join(", ") : "across the repo"} · {change.id}
          </p>
        </div>
      ) : null}
    </div>
  );
}
