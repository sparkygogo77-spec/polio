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
import { askingJob, doneJobs, failedJobs, nextJob, pendingJobs, typedSince, type DrawJob } from "./queue";
import { stillAsks, withAnswer } from "./oddness";
import { runDrawJob } from "./reshapeRun";
import { progressOf } from "./formation";
import { useStudio } from "./store";
import { PROCESS } from "./threads";
import { cn } from "@/core/lib/cn";
import { moltenKeyClass, moltenSeed } from "@/core/ui/molten";

/** The runner. Mounted once; everything else only looks at the queue. */
export function DrawQueue() {
  const queue = useStudio((s) => s.queue);
  const ctx = useActions();
  const running = React.useRef<string | null>(null);
  /*
   * A second look, asked for by a run that has just let go.
   *
   * A run that stops to ask marks its job `asking` before it returns, and
   * the queue changing re-runs this effect while the runner still looks
   * busy. Answered quickly — before the run had returned — the job went
   * back to `waiting` while the runner was still held, and nothing changed
   * the queue again: the answered drawing, and every one behind it, waited
   * for ever (`tests/draw-on-captured-part.mjs`, a scribble answered at
   * once). Letting go now always takes one more look.
   */
  const [look, lookAgain] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const job = nextJob(queue);
    if (!job || running.current) return;
    running.current = job.id;
    const store = useStudio.getState();
    store.updateJob(job.id, { status: "running", started: Date.now(), step: "Reading the drawing…" });
    void runDrawJob(job, {
      // A queued job is background work: it says what happened in the news
      // and on the counter, and does not throw a panel over whatever is
      // being drawn now, nor a toast: four of them stacked over the space's
      // panel after one Generate. Pressing the counter, or the key button,
      // is the person's move to make.
      publish: (n) => ctx.publish({ ...n, toast: false }),
      onNoKey: () => {},
      onStep: (step) => {
        const st = useStudio.getState();
        st.updateJob(job.id, { step });
        /*
         * The same words drive the box forming on the timeline: the step the
         * job is on is the real progress of the iteration it is making.
         *
         * The job's own thread, landed when it was queued — not whatever is
         * live, which is the last thread to land and stops being this one
         * the moment a second drawing is queued behind it.
         */
        st.noteProgress(job.threadId ?? st.liveThreadId, progressOf(step));
      },
    })
      .then((r) => {
        /*
         * Free the runner before the queue is told, not after. Telling the
         * queue re-runs this effect at once, and if the runner still looked
         * busy then, a drawing waiting behind this one was never started:
         * nothing changes the queue again to give it a second look. So the
         * first thing a finished job does is let go.
         */
        running.current = null;
        lookAgain();
        // Stopped to ask: the job is `asking` now, and the person's answer
        // puts it back on the queue. Nothing to write over.
        if (r.asked) return;
        useStudio.getState().updateJob(job.id, {
          status: r.ok ? "done" : "failed",
          note: r.note,
          madeId: r.madeId,
          step: undefined,
          ended: Date.now(),
        });
        /*
         * The box is complete when the job is, and not before.
         *
         * The run marks it itself on every road it knows; this is the one
         * that catches a road it does not — and it never cuts a formation
         * short, because a job whose later pass is still running says so
         * and finishes itself when that lands.
         */
        if (!r.pending && job.threadId) useStudio.getState().markThread(job.threadId, "done");
        /*
         * ONE SHORT MESSAGE, SEEN: WHAT LANDED AND WHERE.
         *
         * Everything above goes to the news only, so a drawing that turned a
         * part into something else did it in silence. The end of every job
         * that put something on the board is said once, on the board, under
         * one key so a Generate's four drawings replace each other rather
         * than stacking. `tests/draw-change-says-undo.mjs`.
         */
        if (r.madeId && r.said && !job.quiet) {
          ctx.publish({
            key: "studio:drawing-landed",
            title: r.ok ? "The drawing landed" : "The drawing landed, unread",
            body: `${r.said.charAt(0).toUpperCase()}${r.said.slice(1)}. One undo takes it back.`,
            level: r.ok ? "success" : "warn",
            source: "studio",
            toast: { durationMs: 6000 },
          });
        }
      })
      /*
       * THE ROAD THE RUN DOES NOT KNOW ABOUT.
       *
       * `runDrawJob` reports every failure it can see, and a reported
       * failure marks the job `failed` above and the queue goes on. What
       * there was no road for at all was a *throw* — anything outside the
       * run's own try, or anything in the handler above — because then this
       * promise rejects, nothing writes a status, and the job sits at
       * `running` for ever. `nextJob` will not start anything while a job is
       * running, so one unexpected error does not lose one drawing: it stops
       * the queue, and every drawing queued behind it waits for ever with no
       * sign of why. That is the shape of the bug two Make reals in a row
       * showed, and letting go of the runner does not fix it on its own —
       * the job has to be closed as well as released.
       *
       * So the job is failed here, the box it was making stops forming where
       * the work stopped rather than sitting half-formed for ever, and it is
       * said out loud, because a drawing that quietly did not happen is
       * worse than one that says it could not.
       */
      .catch((err: unknown) => {
        running.current = null;
        lookAgain();
        const note = err instanceof Error ? err.message : "The drawing could not be worked.";
        const st = useStudio.getState();
        st.updateJob(job.id, { status: "failed", note, step: undefined, ended: Date.now() });
        if (job.threadId) {
          st.noteThread([note], job.threadId);
          st.markThread(job.threadId, "done");
        }
        ctx.publish({
          key: `studio:queue:${job.id}`,
          title: "The drawing could not be worked",
          body: note,
          level: "error",
          source: "studio",
          toast: true,
        });
      })
      .finally(() => {
        running.current = null;
      });
  }, [queue, ctx, look]);

  /*
   * A question nobody needs any more is withdrawn.
   *
   * While a job waits to be answered, the person can go to the part it was
   * drawn on and say in words what it is — which is a better answer than
   * any of the choices, and makes the question a thing to dismiss rather
   * than a thing to answer. So the question is asked again of what is true
   * now, and when it would no longer be asked the job goes back on the
   * queue without it. `nodes` is watched because that is where the words
   * are; the body does nothing at all unless something is asking.
   */
  const nodes = useStudio((s) => s.nodes);
  React.useEffect(() => {
    const job = askingJob(queue);
    if (!job) return;
    const said = typedSince(job.question, job.nodeId ? nodes.find((n) => n.id === job.nodeId)?.prompt : "");
    if (stillAsks(job.question, job.sketch, said)) return;
    // The words go on with the drawing: the run reads them as what it is,
    // and a drawing with words is not asked about again. Without them the
    // run asked the same question on its next turn, and that one, counting
    // these words as already there, was never withdrawn.
    useStudio.getState().updateJob(job.id, { status: "waiting", question: null, sketch: withAnswer(job.sketch, said) });
  }, [queue, nodes]);

  const asking = askingJob(queue);
  return asking ? <QueueQuestion job={asking} /> : null;
}

/**
 * The one question a drawing raised, asked where the counter is.
 *
 * A drawing that could be two things stops before the first paid call and
 * asks (`oddness.ts`): the drawing itself, one line, and the answers as
 * keys — the likeliest first — with "make it anyway" for a person who would
 * rather have the guess. Under the bar, by the Finish key that carries the
 * queue, because that is where a person looks to see what the queue is
 * doing; not a dialog, because the board stays theirs while it waits.
 *
 * Clear of the whole bar, not merely below its first row. It sat at
 * `top-14`, which is under the header and straight over the toolbar
 * beneath it — over the Finish key itself, measured: the key at y 51–79
 * and the card from 56. So the one button you press to go and look at what
 * is being asked about could not be pressed.
 */
function QueueQuestion({ job }: { job: DrawJob }) {
  const q = job.question!;
  const answer = (a: string) => {
    play(a ? "confirm" : "tick");
    useStudio.getState().answerJob(job.id, a);
  };
  return (
    <div
      data-queue-question={job.id}
      role="group"
      aria-label={q.ask}
      className="fixed right-4 top-24 z-50 w-[300px] rounded-[4px] border p-2.5 text-plain shadow-panel backdrop-blur"
      style={{ background: "oklch(0.15 0.018 18 / 0.96)", borderColor: "oklch(0.46 0.157 18 / 0.7)", color: "oklch(0.92 0.02 18)" }}
    >
      <p className="mb-1.5 text-fine font-medium uppercase tracking-[0.18em]" style={{ color: "oklch(0.72 0.106 18)" }}>before anything is spent</p>
      <div className="flex items-start gap-2">
        {job.picture ? (
          <span className="shrink-0 rounded border p-1" style={{ borderColor: "oklch(0.46 0.157 18 / 0.7)", background: "oklch(0.15 0.04 18)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${job.picture}`} alt="" width={56} height={56} className="block size-14 object-contain" style={{ filter: "invert(0.9)" }} />
          </span>
        ) : null}
        <p className="min-w-0 flex-1 text-large font-medium leading-snug">{q.ask}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {q.choices.map((c) => (
          <button
            key={c}
            type="button"
            data-queue-answer={c}
            className="tactile rounded-sm border px-2 py-1 text-plain"
            style={{ borderColor: "oklch(0.46 0.157 18 / 0.7)", background: "oklch(0.2 0.03 18)", color: "oklch(0.92 0.02 18)" }}
            onClick={() => answer(c)}
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          data-queue-answer=""
          className="tactile rounded-sm px-2 py-1 text-small"
          style={{ color: "oklch(0.72 0.106 18)" }}
          onClick={() => answer("")}
        >
          make it anyway
        </button>
      </div>
    </div>
  );
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
  const asking = askingJob(queue);
  // Red is everything not finished, which is the waiting, the running and
  // the ones that were given up on. Green is what landed.
  const open = pending.length + failed;
  const told = busy
    ? `Finish · ${pending.length} drawing${pending.length === 1 ? "" : "s"} to make real${asking ? " · one has a question for you" : now?.step ? ` · ${now.step}` : ""}${done ? ` · ${done} done` : ""}`
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
         * The construct surface, at the setting built for a key.
         *
         * It wore this, went flat, and is wearing it again — and the reason
         * the flat version was wrong is the reason the first one was too.
         * `molten.css` is built for a card: its vignette masks the tile to
         * almost nothing through the middle so words stay readable over it,
         * and its face is a radial run with `--mo-core` at the centre, the
         * darkest thing on a card, deliberately. At 28px that calm dark
         * middle *is* the button, so the core shows through as a hole.
         *
         * `moltenKeyClass` is the second setting of the one definition:
         * the bright cut of the same render, a shorter period so filaments
         * read as filaments, a shallow vignette, an even face with no core,
         * and the drawn rim instead of the nine-pixel sprite — which on
         * something 28 tall would meet in the middle with no key left.
         *
         * I had tuned five of those by hand here before euler's landed. They
         * agreed on every one, including the rim arithmetic, so the hand
         * tuning is gone and the class is what says it.
         *
         * `.process-key` keeps the press: a key that did not go down under
         * the finger would be a picture of a key.
         */
        className={cn(
          moltenKeyClass("verdant"),
          "process-key tactile ml-1 flex h-7 shrink-0 select-none items-center gap-2 rounded-md pl-2 pr-2.5 text-small font-medium outline-none",
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
        <li key={j.id} className="flex items-start gap-2 text-plain leading-snug">
          <span
            className="mt-1 size-1.5 shrink-0 rounded-full"
            style={{
              background:
                j.status === "running" ? "oklch(0.7 0.22 300)"
                  : j.status === "asking" ? "oklch(0.75 0.16 60)"
                  : j.status === "waiting" ? "oklch(0.5 0.12 300)"
                    : j.status === "done" ? "oklch(0.72 0.22 148)"
                      : "oklch(0.62 0.2 25)",
            }}
          />
          <span className="min-w-0 flex-1 text-fg-muted">
            <span className="text-fg">{j.label}</span>
            {j.status === "asking" && j.question ? `, asking: ${j.question.ask}` : j.step ? `, ${j.step}` : j.note ? `, ${j.note}` : j.status === "waiting" ? ", waiting" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
