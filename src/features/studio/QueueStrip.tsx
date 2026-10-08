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
 * **Newest on the LEFT.** HIS WORDS: "every action queued should be added to
 * the left until it turns green". The row is packed left, so a task arriving
 * appears at the near end and pushes the older ones away.
 *
 * **One bar, whole, that fills.** It used to carry progress in its own WIDTH,
 * and he was right about what that looked like: "the bar should stay the full
 * size and not two distinct pieces, initially red until it fills up (it
 * doesn't have a filling up or loading bar animation at all) and turns in to
 * a full green one". A half-done job was a stub, two jobs were two stubs of
 * different lengths, and there was nothing to read as loading. A bar is now
 * one constant-width piece per queued action: ember underneath, verdant
 * running across it as the work goes, whole and green when the work lands.
 * The number is still real — `progressOf` reads a drawing job's own step
 * strings, a running iteration carries its `form.p` — so a fill that has
 * stopped moving is a task that has stopped progressing, which is worth
 * being able to see.
 *
 * **A green one stays until he opens the timeline.** A bar that vanished the
 * instant the work landed was the only thing that said the work landed, and
 * it took itself away before he looked. Now it waits, and going to the place
 * that shows what happened is what clears it.
 *
 * The first version of this grew on a timer instead, easing a bar out over
 * ninety seconds because nothing here knew any better. It looked the same and
 * said nothing true. The model arrived on the sibling branch; this reads it
 * rather than keeping a second answer to the same question.
 */
import * as React from "react";
import { moltenBarClass, moltenSeed } from "@/core/ui/molten";
import { formOf, progressOf } from "./formation";
import { doneJobs, pendingJobs } from "./queue";
import { processDone } from "./threads";
import { useStudio } from "./board/store";
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
/**
 * One bar's size. Constant, both of them.
 *
 * The width no longer says anything — the fill does — so every bar is the
 * same piece whatever stage its work is at. Ten tall rather than six: at six
 * the construct is all rim and no face, and each bar read as an outlined
 * capsule waiting to be filled, which is the one thing this was not to look
 * like.
 */
const BAR_W = 34;
const BAR_H = 10;

/** More than this at once and the strip would be the header. */
const MOST = 7;

interface Bar {
  id: string;
  /** When it started, for the order they sit in. */
  from: number;
  /** How far the work has got, 0..1, off the shared formation model. */
  p: number;
  /** Landed, and waiting to be looked at. */
  done: boolean;
}

export function QueueStrip() {
  const queue = useStudio((s) => s.queue);
  const threads = useStudio((s) => s.threads);
  const mode = useStudio((s) => s.mode);
  const seenAt = useStudio((s) => s.queueSeenAt);
  const markSeen = useStudio((s) => s.markQueueSeen);

  /*
   * Opening the timeline is him looking, so the green ones go.
   *
   * Written to the store rather than kept here, because it has to survive the
   * strip being unmounted by a layout change — and a reload is not him
   * looking, so it is persisted.
   */
  React.useEffect(() => {
    if (mode === "book") markSeen();
  }, [mode, markSeen]);

  /*
   * A board that has never been looked at reads as "since this page loaded"
   * rather than as 1970, or every iteration it has ever run would come back
   * sitting green in the header.
   */
  const floor = React.useRef(Date.now());
  const since = seenAt || floor.current;

  const bars = React.useMemo<Bar[]>(() => {
    const drawing: Bar[] = pendingJobs(queue).map((j) => ({
      id: `job:${j.id}`,
      from: j.started ?? j.queued,
      // A job that has not said anything yet is either waiting its turn or
      // has only just started; either way nothing has happened to show.
      p: (j.status === "running" ? progressOf(j.step) ?? 0.08 : 0),
      done: false,
    }));
    /* …and the ones that landed since he last looked, whole and green. */
    const landed: Bar[] = doneJobs(queue)
      .filter((j) => (j.ended ?? j.queued) > since)
      .map((j) => ({ id: `job:${j.id}`, from: j.started ?? j.queued, p: 1, done: true }));
    const board: Bar[] = threads
      .filter((t) => t.state === "running" || (processDone(t.state) && t.at > since))
      .map((t) => ({ id: `thread:${t.id}`, from: t.at, p: formOf(t).p, done: t.state !== "running" }));
    // Newest first, so it sits at the left-hand end.
    return [...drawing, ...landed, ...board].sort((a, b) => b.from - a.from).slice(0, MOST);
  }, [queue, threads, since]);

  if (!bars.length) return null;

  const going = bars.filter((b) => !b.done).length;
  const done = bars.length - going;

  return (
    <div
      data-queue-strip=""
      /* Left-packed: a new bar lands at the near end and pushes the rest
         away, which is the direction he asked for. */
      className="flex shrink-0 items-center justify-start gap-1 px-1"
      /* No words on it, so the only thing a screen reader could read is a
         count — which is what a person gets from it too. */
      role="status"
      aria-label={
        [going ? `${going} working` : "", done ? `${done} done` : ""].filter(Boolean).join(", ")
      }
    >
      {bars.map((b, i) => {
        const p = Math.max(0, Math.min(1, b.done ? 1 : b.p));
        return (
          <div
            key={b.id}
            data-queue-bar={b.id}
            data-queue-done={b.done ? "" : undefined}
            /* The bar itself: the ember ground, whole, at one size. The rim
               and the face are the construct's; only what is over it moves. */
            className={cn(moltenBarClass("ember"), "relative overflow-hidden rounded-[3px]")}
            style={{ ...moltenSeed(b.id, i), height: BAR_H, width: BAR_W }}
          >
            <span data-molten="" />
            {/*
              The fill: the same construct in its other temperature, clipped
              to how far the work has got. At 1 it covers the bar and the
              whole thing reads green, which is his "turns in to a full green
              one" — one piece, not a second bar beside the first.
            */}
            <div
              data-queue-fill=""
              className={cn(moltenBarClass("verdant"), "rounded-[3px]")}
              /*
               * Placed from here rather than from classes, and a div rather
               * than a span: the construct's own class carries `position:
               * relative`, which beat an `absolute` utility, and an inline
               * box ignores a width — so the fill measured zero wide at
               * every stage while looking like it had been written.
               */
              style={{
                ...moltenSeed(`${b.id}:fill`, i),
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: `${p * 100}%`,
                /* Eased rather than jumping: the steps a job reports are a
                   handful of points, and a fill that snapped between them
                   would read as a glitch rather than as loading. */
                transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              <span data-molten="" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
