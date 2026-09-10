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
        data-finish=""
        data-process-counter=""
        aria-label={`Finish — ${pending.length} drawings pending, ${done} done${failed ? `, ${failed} that could not be read` : ""}`}
        aria-pressed={mode === "book"}
        data-busy={busy ? "1" : "0"}
        onClick={() => {
          play("confirm");
          useStudio.getState().setMode(mode === "book" ? "design" : "book");
        }}
        className="process-key tactile ml-1 flex h-6 shrink-0 select-none items-center gap-1.5 rounded-md px-1.5 text-[10px] font-medium outline-none"
      >
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <FlagCheck className="size-3.5" />}
        <span className="num tabular-nums">
          {pending.length}
          <span style={{ opacity: 0.6 }}> / </span>
          {done}
          {/* A drawing that could not be read is not a drawing that landed:
              it is said here rather than hidden in the done count. */}
          {failed ? <span style={{ color: "oklch(0.86 0.14 30)" }}> · {failed}!</span> : null}
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
            {j.step ? ` — ${j.step}` : j.note ? ` — ${j.note}` : j.status === "waiting" ? " — waiting" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
