"use client";
/**
 * The queue, and the counter that watches it.
 *
 * `DrawQueue` is not a picture of anything: it is the one thing in the
 * Builder that runs jobs. It sits at the top of the Studio, takes the next
 * waiting drawing whenever nothing is running, and works it through
 * (`reshapeRun.ts`). One at a time, and never twice — a ref, not state,
 * guards the run, because two renders of the same tick would otherwise
 * both take the same job.
 *
 * `ProcessCounter` is what a person sees of it: a slab on the end of the
 * toolbar with what is pending and what has landed. It replaced the blue
 * Finish orb, which was a door dressed as a button and sat where the eye
 * looks for status. It is a purple key from the Builder's own console,
 * standing off the bar, and it goes *into* the bar when pressed — the one
 * control here that is meant to feel like a switch being thrown. Pressing
 * it opens the iteration book, where the queue is written out in full.
 */
import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { Tooltip } from "@/core/ui/tooltip";
import { doneJobs, failedJobs, nextJob, pendingJobs } from "./queue";
import { runDrawJob } from "./reshapeRun";
import { useStudio } from "./store";
import { PROCESS } from "./threads";
import { cn } from "@/core/lib/cn";
import { moltenClass, moltenSeed } from "@/core/ui/molten";

/** The runner. Mounted once; everything else only looks at the queue. */
export function DrawQueue() {
  const queue = useStudio((s) => s.queue);
  const ctx = useActions();
  const running = React.useRef<string | null>(null);

  React.useEffect(() => {
    const job = nextJob(queue);
    if (!job || running.current) return;
    running.current = job.id;
    const store = useStudio.getState();
    store.updateJob(job.id, { status: "running", started: Date.now(), step: "Reading the drawing…" });
    void runDrawJob(job, {
      publish: (n) => ctx.publish(n),
      // A queued job is background work: it says what happened in the news
      // and on the counter, and does not throw a panel over whatever is
      // being drawn now. Pressing the counter, or the key button, is the
      // person's move to make.
      onNoKey: () => {},
      onStep: (step) => useStudio.getState().updateJob(job.id, { step }),
    })
      .then((r) => {
        useStudio.getState().updateJob(job.id, {
          status: r.ok ? "done" : "failed",
          note: r.note,
          madeId: r.madeId,
          step: undefined,
          ended: Date.now(),
        });
      })
      .finally(() => {
        running.current = null;
      });
  }, [queue, ctx]);

  return null;
}

/**
 * A flag with a tick on it.
 *
 * Lucide has a flag and it has a check; it does not have the two together,
 * and the two together is what "finish" looks like. Drawn to the same 24-box
 * and the same 2px stroke as every other icon on the bar, so it sits in a row
 * with them without looking hand-made.
 */
function FlagCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 15V4.5a9 9 0 0 1 8 0 9 9 0 0 0 8 0V15a9 9 0 0 1-8 0 9 9 0 0 0-8 0Z" />
      <path d="M4 22v-7" />
      <path d="m8.5 9.5 2.5 2.5 4.5-4.5" />
    </svg>
  );
}

/**
 * Finish: the way out of the board and into the timeline, carrying the queue.
 *
 * Icon only — a green flag with a tick — because it is the one button on the
 * bar that ends something rather than changes something, and a word beside it
 * would put it in the same class as the tools. The numbers on it are the
 * make-real queue: how many drawings are on their way to being parts, and how
 * many landed. A count with a spinner beside it says everything a person
 * needs while they carry on drawing.
 */
export function ProcessCounter() {
  const queue = useStudio((s) => s.queue);
  const mode = useStudio((s) => s.mode);
  const pending = pendingJobs(queue);
  const done = doneJobs(queue).length;
  const failed = failedJobs(queue).length;
  const busy = pending.length > 0;

  const now = pending.find((j) => j.status === "running");
  // Red is everything not finished, which is the waiting, the running and
  // the ones that were given up on. Green is what landed.
  const open = pending.length + failed;
  const told = busy
    ? `Finish · ${pending.length} drawing${pending.length === 1 ? "" : "s"} to make real${now?.step ? ` · ${now.step}` : ""}${done ? ` · ${done} done` : ""}`
    : done || failed
      ? `Finish · ${done} made real${failed ? `, ${failed} that could not be read` : ""}`
      : mode === "book"
        ? "Back to the board"
        : "Finish: the timeline, the brief and everything asked of Claude";

  return (
    <Tooltip content={told}>
      <button
        type="button"
        // One Finish, not two. The sibling branch grew a second flag beside
        // this one — a ghost icon carrying the thread count — and two buttons
        // that both say "finish" is worse than either. This is the one J
        // asked for: a green key, a flag with a tick, and the make-real queue
        // on it; `data-finish` is the handle everything holds it by.
        data-finish=""
        data-process-counter=""
        aria-label={`Finish, ${open} unfinished, ${done} done${failed ? `, of which ${failed} could not be read` : ""}`}
        aria-pressed={mode === "book"}
        data-busy={busy ? "1" : "0"}
        onClick={() => {
          play("confirm");
          useStudio.getState().setMode(mode === "book" ? "design" : "book");
        }}
        /*
         * A live green light construct, not a green slab.
         *
         * It is the key that opens the red boxes, so it is made of the same
         * thing they are: the shared surface in `core/ui/molten.css` at its
         * verdant temperature — the same five stops, the same veining, the
         * same slow boil and breathing edge — rather than a green button
         * that happens to sit near them. Quieter than the reds, because this
         * one carries words and a count and has to stay readable while it
         * moves. `.process-key` keeps the press: a key that did not go down
         * under the finger would be a picture of a key.
         */
        className={cn(
          moltenClass("verdant"),
          "process-key tactile ml-1 flex h-7 shrink-0 select-none items-center gap-2 rounded-md pl-2 pr-2.5 text-[10px] font-medium outline-none",
        )}
        style={moltenSeed("finish") as React.CSSProperties}
      >
        <span data-molten="" />
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FlagCheck className="size-4" />}
        {/*
          The process, on the right where the count lives, and lit.
          
          It was one small line of near-black digits on a green slab, which
          is the half of this button J could not read. Red for every process
          unfinished or abandoned, green for every one that completed — the
          same pair the timeline's boxes wear (`PROCESS` in `threads.ts`),
          because a person should not have to learn two vocabularies for one
          idea. Bigger, and glowing in their own colour, so the numbers are
          what carries the key rather than the key carrying them.
        */}
        {/*
          Two numbers and nothing between them.
          
          There was a slash, and a glow behind each digit, on a key that is
          now made of light itself: a construct does not need decoration
          painted on top of it to look lit, and the slash was a third thing
          to read where the colour had already said which number was which.
          Red is unfinished, green is done, and the light under them is the
          key's own.
        */}
        <span className="num flex items-baseline gap-1.5 text-[13px] leading-none tabular-nums">
          <span style={{ color: PROCESS.open }}>{open}</span>
          <span style={{ color: PROCESS.done }}>{done}</span>
        </span>
      </button>
    </Tooltip>
  );
}

/**
 * The queue in words, for the book: what is waiting, what is running, what
 * came of the ones that are over.
 */
export function QueueList() {
  const queue = useStudio((s) => s.queue);
  if (!queue.length) return null;
  return (
    <ul className="space-y-1">
      {[...queue].reverse().map((j) => (
        <li key={j.id} className="flex items-start gap-2 text-[11px] leading-snug">
          <span
            className="mt-1 size-1.5 shrink-0 rounded-full"
            style={{
              background:
                j.status === "running" ? "oklch(0.7 0.22 300)"
                  : j.status === "waiting" ? "oklch(0.5 0.12 300)"
                    : j.status === "done" ? "oklch(0.72 0.22 148)"
                      : "oklch(0.62 0.2 25)",
            }}
          />
          <span className="min-w-0 flex-1 text-fg-muted">
            <span className="text-fg">{j.label}</span>
            {j.step ? `, ${j.step}` : j.note ? `, ${j.note}` : j.status === "waiting" ? ", waiting" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
