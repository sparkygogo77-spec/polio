"use client";
/**
 * What is running, as bars, in the header beside the bell.
 *
 * J has toasts turned off, so this and the timeline are how work is watched.
 * It is a glance, not a panel: one small bar per task, no words, nothing to
 * press, and when a task finishes its bar goes. An empty queue is an empty
 * strip and the header looks as it always did.
 *
 * **Two kinds, and they are the app's own two.** A drawing being read is
 * `ember`, red; an iteration working on the board is `verdant`, green. Those
 * are not colours chosen here — they are the two temperatures of the shared
 * construct in `core/ui/molten.css`, whose own doc says `ember` is "a
 * drawing, and the pieces that came off one" and `verdant` is "an iteration".
 * The timeline's boxes and the Finish key are made of the same two, so a red
 * bar up here and a red box down there are the same thing.
 *
 * **Newest on the right.** The row is packed to the right, so a task arriving
 * appears at the end and pushes the older ones left — the direction reading
 * already goes, and the direction each bar grows in.
 *
 * **A bar grows, it does not fill.** Its width is how far the work has
 * actually got, off the same model the timeline's boxes form from
 * (`formation.ts`): `progressOf` reads a drawing job's own step strings as
 * milestones, and a running iteration carries its `form.p`. There is no
 * outline behind a bar saying how much is left, so it grows rather than
 * fills — and because the number is real, a bar that has stopped growing is
 * a task that has stopped progressing, which is worth being able to see.
 *
 * The first version of this grew on a timer instead, easing a bar out over
 * ninety seconds because nothing here knew any better. It looked the same and
 * said nothing true. The model arrived on the sibling branch; this reads it
 * rather than keeping a second answer to the same question.
 */
import * as React from "react";
import { moltenBarClass, moltenSeed, type MoltenKind } from "@/core/ui/molten";
import { formOf, progressOf } from "./formation";
import { pendingJobs } from "./queue";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";

/**
 * How wide a bar gets, and how tall it is.
 *
 * Ten tall, not six. At six the construct is all rim and no face — the bright
 * edge is the only part with room to show, so each bar read as an outlined
 * capsule waiting to be filled, which is the one thing this was not to look
 * like. Ten gives the face enough height to be a surface, and the rim goes
 * back to being an edge on something rather than the whole of it.
 */
const BAR_W = 30;
const BAR_H = 10;
/** A task that exists but has not reported anything yet still has to be seen. */
const BAR_MIN = 5;

/** More than this at once and the strip would be the header. */
const MOST = 7;

interface Bar {
  id: string;
  kind: MoltenKind;
  /** When it started, for the order they sit in. */
  from: number;
  /** How far the work has got, 0..1, off the shared formation model. */
  p: number;
}

export function QueueStrip() {
  const queue = useStudio((s) => s.queue);
  const threads = useStudio((s) => s.threads);

  const bars = React.useMemo<Bar[]>(() => {
    const drawing: Bar[] = pendingJobs(queue).map((j) => ({
      id: `job:${j.id}`,
      kind: "ember",
      from: j.started ?? j.queued,
      // A job that has not said anything yet is either waiting its turn or
      // has only just started; either way nothing has happened to show.
      p: (j.status === "running" ? progressOf(j.step) ?? 0.08 : 0),
    }));
    const board: Bar[] = threads
      .filter((t) => t.state === "running")
      .map((t) => ({ id: `thread:${t.id}`, kind: "verdant", from: t.at, p: formOf(t).p }));
    // Oldest first, so the newest is last and sits at the right-hand end.
    return [...drawing, ...board].sort((a, b) => a.from - b.from).slice(-MOST);
  }, [queue, threads]);

  if (!bars.length) return null;

  const red = bars.filter((b) => b.kind === "ember").length;
  const green = bars.length - red;

  return (
    <div
      data-queue-strip=""
      /* Right-packed: a new bar lands at the end and shoulders the rest
         leftwards, rather than the row growing off to the right. */
      className="flex shrink-0 items-center justify-end gap-1 px-1"
      /* No words on it, so the only thing a screen reader could read is a
         count — which is what a person gets from it too. */
      role="status"
      aria-label={
        [red ? `${red} drawing${red === 1 ? "" : "s"} being read` : "", green ? `${green} iteration${green === 1 ? "" : "s"} working` : ""]
          .filter(Boolean)
          .join(", ")
      }
    >
      {bars.map((b) => {
        const w = Math.round(BAR_MIN + (BAR_W - BAR_MIN) * Math.max(0, Math.min(1, b.p)));
        return (
          <div
            key={b.id}
            data-queue-bar={b.kind === "ember" ? "drawing" : "board"}
            className={cn(moltenBarClass(b.kind), "rounded-[3px]")}
            style={{
              ...moltenSeed(b.id),
              height: BAR_H,
              width: w,
              /* Eased between milestones rather than jumping: the steps a job
                 reports are a handful of points, and a bar that snapped
                 between them would read as a glitch rather than as growth. */
              transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            {/* The construct's own edge, flare and ember. */}
            <span data-molten="" />
          </div>
        );
      })}
    </div>
  );
}
