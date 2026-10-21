"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Pin, RotateCcw } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { EDGE } from "../../boxGround";
import { LANE_MODE } from "../lanesModel";
import { type Point } from "../strand";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { processDone, type Thread, type ThreadDoc } from "../threads";
import { formVars } from "../../formation";
import { GENERATION } from "../threads";
import { askTheBook } from "../../BriefDialog";
import { BOX, isElement, GENERATION_HUE, kindOf, headlineOf } from "./layout";
import { SiteShot, Features, ElementPiece } from "./pieces";
import { Card } from "./cards";

/* ------------------------------------------------------------------ */
/* One box                                                             */
/* ------------------------------------------------------------------ */

/** A chain prompt is a box; an element prompt is a piece. Both open the same card. */
export function Standing(props: {
  thread: Thread;
  at: Point;
  /** How far it has formed, as shown: 0..1. One is formed. */
  forming: number;
  live: boolean;
  open: boolean;
  pinned: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  return isElement(props.thread) ? <ElementPiece {...props} /> : <IterationBox {...props} />;
}

/**
 * A chain prompt: a box with a headline and a thumbnail of what it left.
 *
 * The thumbnail is the point of it. "3 findings" is a receipt; the shape
 * of the page the iteration produced is the thing you recognise from
 * across the screen, which is what a timeline is for.
 */
export function IterationBox({
  thread, at, forming, live, open, pinned, dragging, onOpen, onDragStart, onMenu,
}: {
  thread: Thread;
  at: Point;
  forming: number;
  live: boolean;
  open: boolean;
  pinned: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const { icon, kind } = kindOf(thread);
  /*
   * One hue for everything on the box. A lane's work stands here in the
   * azure construct and every tint on it, the label, the ask, the site's
   * frame, the feature chips, follows the same hue, so the blue box is the
   * green box with the hue turned and nothing else.
   */
  const lane = thread.mode === LANE_MODE;
  /*
   * A picture generated is its own kind, and it is orange.
   *
   * HIS WORDS: "these image generations should appear in my timeline ... it
   * should appear in a orange colored timeline box." The box is one hue with
   * everything on it following, so this is the whole of it: the construct,
   * the label, the frame and the chips all turn together, and an orange box
   * is a green box with the hue turned, exactly as the azure lane box is.
   */
  const generated = thread.mode === GENERATION;
  return (
    <div className="absolute" style={{ left: at.x, top: at.y, width: BOX.w, zIndex: open ? 40 : dragging ? 30 : 10, "--box-hue": generated ? GENERATION_HUE : lane ? 210 : 152 } as React.CSSProperties}>
      {open ? <Card thread={thread} side="in" /> : null}
      {/* A surface, not a button: it carries the site, and a site inside a
          `<button>` is both invalid and unusable. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`the update: ${headlineOf(thread)}`}
        data-box={thread.id}
        data-open={open ? "1" : "0"}
        /* No dot, and the state is still said: what a card is in the middle of
           is what the board and the suite ask it, and the picture of it is the
           formation while it works and a grey vine when it was given up on. */
        data-state={processDone(thread.state) ? "done" : thread.state}
        onPointerDown={onDragStart}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        onContextMenu={onMenu}
        /*
         * A construct of molten light, not a box with a red border and a glow
         * behind it. The stops, the veining and the five animations are the
         * shared surface in `core/ui/molten.css` — the same one the element
         * cards use, so the two are one language rather than two reds that
         * nearly match. Everything here is which one and how deep.
         */
        className={cn(
          moltenClass(lane ? "azure" : "verdant"),
          "flex w-full cursor-grab flex-col gap-1 rounded-lg p-2 text-left transition-[box-shadow,transform] active:cursor-grabbing",
        )}
        data-forming={forming < 1 ? "" : undefined}
        style={{
          minHeight: BOX.h,
          ...moltenSeed(thread.id),
          ...(forming < 1 ? (formVars(forming) as React.CSSProperties) : {}),
          /*
           * The whole face moves. The cloud was banded to the top and bottom
           * quarters because the site's picture covered the middle edge to
           * edge; the picture stands in the middle now at the Builds card's
           * proportion, with the texture showing either side of it, and a
           * banded face put a bare dark stripe across the waist of every green
           * box. His words: nothing dark covering the texture. It costs
           * frames, which `molten.css` counts; the stripe cost more.
           */
          color: "oklch(0.93 0.055 var(--box-hue, 150))",
          textShadow: EDGE,
          // Depth is the shadow under it and the lift when it is picked up;
          // the light in it comes from the surface, not from here.
          // The weight under it, and the heat it throws: the construct's own
          // shadow, because paint containment clips anything inside it.
          // Weight under it and nothing thrown outward: the rim is self-lit
          // and the reference has no glow past it.
          /* Tight rather than wide when it is closed. A shadow is a
             translucent band the whole way round a card, and every one of
             them is re-blended on every frame that anything on the page
             moves; eighteen pixels of blur across thirty cards is a lot of
             screen to pay for a lift nobody is looking at. Six pixels reads
             as the same lift and measured three frames a second back at
             twelve boards. The open one keeps its full throw: there is one
             of it. */
          boxShadow: open ? "0 10px 30px oklch(0 0 0 / 0.55)" : "0 3px 6px oklch(0 0 0 / 0.5)",
          filter: open ? "brightness(1.14)" : live ? "brightness(1.06)" : "none",
          transform: dragging ? "scale(1.02)" : "none",
        }}
      >
        {/* The edge, the flare and the ember, all on one node. */}
        <span data-molten="" />
        {/*
          The line above the headline is a label, and it is sized like one:
          what the iteration made is the biggest thing on the box.
        */}
        <span className="flex items-center gap-1.5 text-fine font-semibold uppercase tracking-[0.14em] text-[oklch(0.95_0.03_var(--box-hue,152))]">
          {icon}
          {kind}
          {/* Nothing else on this row. The flag that marked the update being
              worked in is in the box's own menu now, and the dot that said
              whether the process had finished is gone: a card still working
              is visibly forming, one that was given up on hangs off a grey
              vine, and "finished" was a mark on nearly every card nearly all
              of the time. */}
          {pinned ? <span className="ml-auto"><Pin className="size-2.5 fill-current" /></span> : null}
        </span>
        {/*
          THE PROMPTING THAT MADE IT, ABOVE THE SITE.

          What a green card says about itself is what was asked of it, so the
          ask is at the top in the card's own type, and the headline it used
          to lead with — "3 findings", a receipt — is one line under the
          site with the rest of the list. A second page of it holds the same
          words to edit before running them again.
        */}
        <Asked thread={thread} />
        {/*
          THE SITE, AS THIS UPDATE LEFT IT.

          It was a silhouette: grey rectangles where the parts stood, which
          says how many things there are and nothing about what they are.
          Every update carries the whole document it landed on, so what this
          shows is the real site, rendered by the same renderer the preview
          uses — and *only* the parts that existed by this update, because
          the ones that come later arrive on the cards that made them. The
          newest card is the exception: nothing has happened since it, so it
          shows the board as it stands now rather than a snapshot that is
          already out of date.
        */}
        <SiteShot thread={thread} live={live} />
        {/*
          …AND THE FEATURE LIST UNDER IT.

          The parts standing on the site at this update, the ones it put
          there lit. It is the site's own contents rather than a line about
          them.
        */}
        <Features thread={thread} />
      </div>
      {open ? <Card thread={thread} side="out" /> : null}
    </div>
  );
}

/**
 * Which parts on the site are this update's own doing.
 *
 * Worked out from the two documents rather than from the sentences
 * `diffDocs` writes about them: those read "+ Top bar placed" and
 * "~ Hero: 240×80 → 240×120", and picking a name back out of a sentence is a
 * parser waiting to be wrong about a part called "placed". The first update
 * has nothing before it, so all of it is its own.
 *
 * Two things read this: the feature list, which lights them, and the preview,
 * which frames them when they are not at the top of the page.
 */
export function ownParts(thread: Thread, parent: Thread | null): { parts: NonNullable<ThreadDoc["nodes"]>; mine: Set<string> } {
  const parts = (thread.doc?.nodes ?? []).filter((n) => n.label);
  const before = new Map((parent?.doc?.nodes ?? []).map((n) => [n.id, n]));
  const first = !parent?.doc;
  const mine = new Set(parts.filter((n) => {
    if (first || !before.has(n.id)) return true;
    const b = before.get(n.id)!;
    return b.w !== n.w || b.h !== n.h || b.x !== n.x || b.y !== n.y || (b.prompt ?? "") !== (n.prompt ?? "") || b.featureId !== n.featureId;
  }).map((n) => n.id));
  return { parts, mine };
}

/**
 * The prompting that made this update, above the site it made.
 *
 * Two pages, and the second is the point of the first. Page one is what was
 * asked, as it was asked. Page two is the same words in a field and a
 * button: sometimes a thing is acceptable and just wants another go at it,
 * and sometimes the prompt wants a word changed first. **Re-iterate is on
 * the card both times**, because it is what a card of a site is for and a
 * thing you do that often does not belong in a menu.
 */
export function Asked({ thread }: { thread: Thread }) {
  const [page, setPage] = React.useState(0);
  const [words, setWords] = React.useState(thread.ask);
  React.useEffect(() => setWords(thread.ask), [thread.id, thread.ask]);
  const again = () => {
    play("confirm");
    /*
     * The book's own ask, with these words in it. Running an update is one
     * pipeline (`BriefDialog`) and there is no second one here: the card
     * hands it the mode this update was made in and the prompt as it stands,
     * and it runs the same call the Ask button runs.
     */
    askTheBook({ mode: thread.mode, prompt: words.trim(), run: true });
  };
  return (
    <div data-asked={page} className="flex shrink-0 items-start gap-2 px-0.5 py-0.5">
      <span className="min-w-0 flex-1">
        {page === 0 ? (
          <span data-asked-said="" className="line-clamp-2 block text-[13px] font-semibold leading-snug text-[oklch(0.97_0.03_var(--box-hue,150))]">
            {thread.ask || headlineOf(thread)}
          </span>
        ) : (
          <textarea
            data-asked-edit=""
            value={words}
            rows={2}
            onChange={(e) => setWords(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Say what to do differently, and run it again"
            className="block w-full resize-none rounded-sm border bg-transparent px-1.5 py-1 text-large leading-snug outline-none focus:ring-1"
            style={{ borderColor: "oklch(0.42 0.118 var(--box-hue, 152) / 0.7)", color: "oklch(0.95 0.05 var(--box-hue, 150))" }}
          />
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          data-asked-page=""
          title={page === 0 ? "Change the words before running it again" : "What was asked"}
          aria-label={page === 0 ? "Change the words before running it again" : "What was asked"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); play("tick"); setPage(page === 0 ? 1 : 0); }}
          className="tactile grid size-5 place-items-center rounded-sm border"
          style={{ borderColor: "oklch(0.58 0.14 var(--box-hue, 152))", background: "oklch(0.26 0.07 var(--box-hue, 152))", color: "oklch(0.95 0.03 var(--box-hue, 152))" }}
        >
          {page === 0 ? <ChevronRight className="size-3.5" strokeWidth={2.75} /> : <ChevronLeft className="size-3.5" strokeWidth={2.75} />}
        </button>
        {/* A lane's work was not a prompt to the book, so there is nothing to run again. */}
        {thread.mode === LANE_MODE ? null : (
        <button
          type="button"
          data-reiterate={thread.id}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); again(); }}
          title="Run this prompt again"
          className="tactile flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-small"
          style={{ borderColor: "oklch(0.58 0.14 var(--box-hue, 152))", background: "oklch(0.26 0.07 var(--box-hue, 152))", color: "oklch(0.97 0.03 var(--box-hue, 152))" }}
        >
          {/* Heavier than the words beside it: at the zoom a timeline settles to this is seven pixels across, and a thin stroke there is a blur. */}
          <RotateCcw className="size-3.5" strokeWidth={2.75} />
          Re-iterate
        </button>
        )}
      </span>
    </div>
  );
}
