"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Coins, Copy, Flag, MapPin, Pin, PinOff, Scissors, Sparkles, Wand2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/tooltip";
import { LANE_MODE } from "../lanes";
import { strandBounds, strandReach, REACH_WIDTH, type Point, type VineEnd } from "../strand";
import { sayWhere, saySpend } from "../../spend";
import { diffDocs, type Thread } from "../threads";
import { pictureOf } from "../../reshapeRun";
import { useStudio } from "../../board/store";
import { Block, themeFrom } from "../../blocks";
import { resolvePalette } from "../../shelf/run";
import { GROW, isElement, headlineOf } from "./layout";
import { Drawn } from "./pieces";

/**
 * The card that grows out of the box.
 *
 * Up from the top edge: Input — the prompt, and the drawing when there
 * was one. Down from the bottom: Output — the answer, and
 * what it changed on the board. Both joined to the box by the connector
 * the strands are made of, so it reads as the box extending rather than a
 * panel arriving.
 */
export function Card({ thread, side }: { thread: Thread; side: "in" | "out" }) {
  const threads = useStudio((s) => s.threads);
  const parent = thread.parentId ? threads.find((t) => t.id === thread.parentId) ?? null : null;
  const changed = React.useMemo(() => diffDocs(parent?.doc, thread.doc), [parent, thread]);
  const element = isElement(thread);
  /*
   * The reading family, not the card family.
   *
   * These grew out of the box in the same red or green as the box, rounded
   * the same, lit the same, and read as two more cards. They are not cards:
   * they are where you read what went into one and what came out. So the
   * face is near-neutral dark with only a tint of the family, the colour
   * lives in a hairline rim and the headline, there is no lift and no glow,
   * and the corners are squarer than anything on the timeline that is a
   * thing. Same family, different member.
   */
  const hue = thread.mode === LANE_MODE ? 210 : 152;
  const skin = element
    ? { face: "oklch(0.15 0.018 18)", rim: "oklch(0.46 0.157 18 / 0.7)", text: "oklch(0.92 0.02 18)", dim: "oklch(0.72 0.106 18)" }
    : { face: `oklch(0.145 0.016 ${hue})`, rim: `oklch(0.42 0.118 ${hue} / 0.7)`, text: `oklch(0.92 0.02 ${hue})`, dim: `oklch(0.7 0.091 ${hue})` };
  return (
    <div
      data-card={side}
      data-card-of={thread.id}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute w-[min(420px,86vw)]"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        ...(side === "in" ? { bottom: `calc(100% + ${GROW}px)` } : { top: `calc(100% + ${GROW}px)` }),
      }}
    >
      <div
        data-reading=""
        className="relative rounded-[4px] border p-2.5"
        /* No entrance: a card that grows on arrival is a performance, and this is
   something you open fifty times an hour. No lift either: it is a page, not
   a thing standing on the ground. */
        style={{ background: skin.face, borderColor: skin.rim, color: skin.text }}
      >
        {/*
          One word. "What went in" and "what came out" were sentences about
          the two halves; the halves are Input and Output and that is all the
          headline says. The copy control sits off the headline, in the
          corner, because a headline with a button in it is a toolbar.
        */}
        <p data-reading-head={side} className="mb-1.5 text-fine font-medium uppercase tracking-[0.18em]" style={{ color: skin.dim }}>
          {side === "in" ? "Input" : "Output"}
        </p>
        <span className="absolute right-2 top-1.5">
          <CopyBit text={side === "in" ? thread.ask : thread.answer} />
        </span>
        {side === "in" ? (
          <WentIn thread={thread} skin={skin} element={element} />
        ) : (
          <div className="space-y-2">
            {/*
              THE OUTPUT IS THE ELEMENT.

              This began with a text box: four closed shapes described in
              prose, at the top of the card, with the part itself further
              down under a heading about the board. A sentence about a thing
              is not the output of making it — the thing is. So the part
              leads, live, at the size the card has room for; it takes its
              own presses and it is the part off the page, so changing it
              here changes it there.

              What Claude said is still kept, because it is the record of the
              call and sometimes says why something came out as it did. It is
              under the thing now rather than instead of it.
            */}
            <Made thread={thread} skin={skin} height={element ? 150 : 96} live />
            {changed.length ? (
              <ul className="max-h-24 space-y-0.5 overflow-auto font-mono text-small">{changed.map((l, i) => <li key={i}>{l}</li>)}</ul>
            ) : thread.changes.length ? (
              <ul className="space-y-0.5 text-small">{thread.changes.map((cx, i) => <li key={i}>{cx}</li>)}</ul>
            ) : (
              <p className="text-small" style={{ color: skin.dim }}>nothing on the board changed with this one</p>
            )}
            <Bill thread={thread} skin={skin} />
            <details className="border-t pt-1.5" style={{ borderColor: skin.rim }}>
              <summary data-said-head="" className="cursor-pointer text-fine uppercase tracking-[0.16em]" style={{ color: skin.dim }}>what was said</summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-small leading-relaxed">{thread.answer || "nothing came back"}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * What this iteration cost and how long it took, on the card.
 *
 * The card named the model and stopped there, so a person drawing on the
 * deploy had no way at all to find out what a drawing costs them — the only
 * place that number existed was the bench. Claude per token and the renderer
 * per press, added, with the wait measured rather than guessed, and who was
 * paid said out loud: that last part is the only way to tell from the
 * outside whether a drawing reached the renderer at all.
 */
export function Bill({ thread, skin }: { thread: Thread; skin: { rim: string; dim: string; text: string } }) {
  const u = thread.usage;
  if (!u || (!u.cost && !u.ms && !u.calls)) return null;
  const head = saySpend({ dollars: u.cost ?? 0, ms: u.ms ?? 0, calls: u.calls ?? 0 });
  const who = sayWhere({ dollars: u.cost ?? 0, ms: u.ms ?? 0, calls: u.calls ?? 0, claude: u.claude, renderer: u.renderer });
  return (
    <div data-bill={thread.id} className="border-t pt-1.5" style={{ borderColor: skin.rim }}>
      <p className="mb-0.5 flex items-center gap-1.5 text-fine uppercase tracking-[0.16em]" style={{ color: skin.dim }}>
        <Coins className="size-3" /> what it cost
      </p>
      <p className="num text-plain" style={{ color: skin.text }}>{head}</p>
      {who ? <p className="num text-small" style={{ color: skin.dim }}>{who}</p> : null}
      {/*
        And then each pass on its own line.

        A drawing lands twice — the pass that shows at once, and the model
        that refines it — and they are two charges. The total above cannot
        say which of them was expensive, and one of them routinely has no
        price at all, because Replicate publishes no rate for the models the
        second pass runs on. A line that says the cost was not reported is
        the true thing to put there.
      */}
      {u.passes?.length ? (
        <ul className="mt-1 space-y-0.5 border-t pt-1 num text-small" style={{ borderColor: skin.rim, color: skin.dim }}>
          {u.passes.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      ) : null}
      {thread.model ? <p className="mt-0.5 text-fine" style={{ color: skin.dim }}>{thread.model}</p> : null}
    </div>
  );
}

/**
 * What went in — and, where a part was drawn on more than once, every go.
 *
 * A part that was drawn, looked at, and drawn again has a history of inputs,
 * and the card showed only the one belonging to this iteration: the others
 * were on their own boards elsewhere on the timeline, so "which drawing led
 * to this" could not be answered from the thing it led to. They are paged
 * through here instead, oldest first, one to a page — stepping back through
 * the attempts on the same part rather than stacking them or replacing one
 * with the next.
 *
 * A part drawn once has no pager, because one page is not a sequence.
 */
export function WentIn({ thread, skin, element }: { thread: Thread; skin: { rim: string; dim: string; text: string }; element: boolean }) {
  const threads = useStudio((s) => s.threads);
  /*
   * The goes: every iteration that worked on the same part, in the order
   * they happened. Keyed on what each one made, which is the only thing that
   * says two drawings are about one part — the chain does not, because a go
   * can hang off anywhere.
   */
  const goes = React.useMemo(
    () => (thread.madeId ? threads.filter((t) => t.madeId === thread.madeId) : [thread]),
    [threads, thread],
  );
  const mine = Math.max(0, goes.findIndex((t) => t.id === thread.id));
  const [page, setPage] = React.useState(mine);
  // Opening a different iteration lands on that one's own go, not on
  // whichever page was last looked at.
  React.useEffect(() => setPage(mine), [mine, thread.id]);
  const at = goes[Math.min(page, goes.length - 1)] ?? thread;
  const many = goes.length > 1;
  const step = (by: number) => setPage((p) => Math.min(goes.length - 1, Math.max(0, p + by)));

  return (
    <div className="space-y-1.5">
      {many ? (
        <div data-goes={goes.length} className="flex items-center gap-1.5 text-fine" style={{ color: skin.dim }}>
          <button
            type="button"
            data-go-back=""
            disabled={page === 0}
            onClick={(e) => { e.stopPropagation(); play("tick"); step(-1); }}
            className="tactile grid size-4 place-items-center rounded-sm border disabled:opacity-35"
            style={{ borderColor: skin.rim }}
          >
            <ChevronLeft className="size-3" />
          </button>
          <span className="num">go {page + 1} of {goes.length}</span>
          {at.id === thread.id ? <span style={{ color: skin.text }}>· this one</span> : null}
          <button
            type="button"
            data-go-next=""
            disabled={page >= goes.length - 1}
            onClick={(e) => { e.stopPropagation(); play("tick"); step(1); }}
            className="tactile grid size-4 place-items-center rounded-sm border disabled:opacity-35"
            style={{ borderColor: skin.rim }}
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        {element || at.sketch ? (
          <span className="shrink-0 rounded border p-1" style={{ borderColor: skin.rim, background: "oklch(0.15 0.04 18)" }}>
            <Drawn sketch={at.sketch} size={72} tone="oklch(0.97 0.045 22)" />
          </span>
        ) : null}
        <p className="max-h-40 min-w-0 flex-1 overflow-auto whitespace-pre-wrap text-plain leading-relaxed">{at.ask || "nothing was typed"}</p>
      </div>
      {many && at.id !== thread.id ? (
        <p className="text-fine" style={{ color: skin.dim }}>what that one led to: {at.changes[0] ?? "nothing recorded"}</p>
      ) : null}
      {element && thread.madeId ? <EditHere id={thread.madeId} skin={skin} /> : null}
    </div>
  );
}

/**
 * Edit the element from its card.
 *
 * The card showed the element and offered two roads back to the board to
 * change it. The things a person most often wants to change — what it is
 * called and what it is meant to be — need no board: they are written on
 * the part from here, at once, and "draw it again with these words" puts
 * the same drawing back on the queue with the new words beside it, so the
 * part is reshaped rather than a second one made. The size is shown, not
 * edited: a size is set by hand on the board, where the hand is.
 */
export function EditHere({ id, skin }: { id: string; skin: { rim: string; dim: string; text: string } }) {
  const node = useStudio((s) => s.nodes.find((n) => n.id === id) ?? null);
  const frameWidth = useStudio((s) => s.frameWidth);
  const [label, setLabel] = React.useState(node?.label ?? "");
  const [prompt, setPrompt] = React.useState(node?.prompt ?? "");
  // Another card, or the part renamed on the board: the fields follow.
  React.useEffect(() => {
    setLabel(node?.label ?? "");
    setPrompt(node?.prompt ?? "");
  }, [node?.id, node?.label, node?.prompt]);
  if (!node) {
    return <p className="border-t pt-1.5 text-fine" style={{ borderColor: skin.rim, color: skin.dim }}>the part this made is no longer on the board</p>;
  }
  const commit = () => {
    const name = label.trim() || node.label;
    if (name === node.label && prompt === node.prompt) return;
    useStudio.getState().updateNode(node.id, { label: name, prompt });
  };
  const again = () => {
    commit();
    if (!node.sketch) return;
    const sketch = { ...node.sketch, words: prompt.trim() };
    play("confirm");
    useStudio.getState().enqueueDraw({
      nodeId: node.id,
      at: null,
      frameWidth,
      sketch,
      picture: pictureOf(sketch.strokes),
      // "Draw it again" redraws the part this drawing made: the one door that changes a part without words asking.
      reshape: true,
      label: `Reshaping ${label.trim() || node.label}`,
    });
  };
  const field = "w-full rounded-sm border bg-transparent px-1.5 py-0.5 text-plain leading-snug outline-none focus:ring-1";
  return (
    <div
      data-edit-here={node.id}
      className="space-y-1 border-t pt-1.5"
      style={{ borderColor: skin.rim }}
      // The card stops presses reaching the ground; the keys must not reach
      // the board's shortcuts either, or typing a name would delete a part.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <p className="text-fine uppercase tracking-[0.16em]" style={{ color: skin.dim }}>edit it here</p>
      <input
        data-edit-label=""
        aria-label="What it is called"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={field}
        style={{ borderColor: skin.rim, color: skin.text }}
      />
      <textarea
        data-edit-prompt=""
        aria-label="What it is meant to be"
        rows={2}
        value={prompt}
        placeholder="what it is meant to be"
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={commit}
        className={`${field} resize-none`}
        style={{ borderColor: skin.rim, color: skin.text }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-edit-again=""
          disabled={!node.sketch}
          onClick={again}
          className="tactile rounded-sm border px-2 py-0.5 text-small disabled:opacity-40"
          style={{ borderColor: skin.rim, color: skin.text }}
          title={node.sketch ? "The same drawing, back on the queue, with these words beside it" : "This part was not drawn, so there is nothing to draw again"}
        >
          Draw it again with these words
        </button>
        <span className="num text-fine" style={{ color: skin.dim }}>{node.w} × {node.h}</span>
      </div>
    </div>
  );
}

/**
 * The part this iteration made: the real one, off the page.
 *
 * The board's own renderer (`Block`), scaled to fit, following the palette
 * and the light because it **is** the part rather than a picture of one. A
 * card used to show the strokes that were drawn — the input echoed back,
 * which tells a person nothing they did not just draw — and the answer as
 * prose, which is a description of a thing rather than the thing.
 *
 * `live` is what makes it a surface rather than a photograph of one, and it
 * is not always on: a closed box is a token you drag around the timeline,
 * and a part that took presses inside it would fight the drag. Closed it is
 * `inert`; open — the card grown out of it, and the box while that card is
 * open — it is `mode="live"` and takes its own presses. Closed is a thing
 * you move, open is the thing itself.
 *
 * **And it is tied to the part still being there.** A part can be deleted
 * off the board after the iteration that made it; the card then says so,
 * which is the one thing that was already true of the editor below and was
 * not driving the picture.
 */
export function Made({ thread, skin, width = 380, height = 96, live = false, quiet = false }: {
  thread: Thread;
  skin: { rim: string; dim: string };
  /** The widest the part may draw. It shrinks to fit and never grows. */
  width?: number;
  height?: number;
  /** Takes its own presses, and the part runs. Never on a box being dragged. */
  live?: boolean;
  /** No surround: on a box the card's own ground is the surround, and the
      frame takes the part's own shape rather than a fixed band. */
  quiet?: boolean;
}) {
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const node = thread.madeId ? nodes.find((n) => n.id === thread.madeId) ?? null : null;
  const siteName = useStudio((s) => s.brief.name);
  const theme = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
  const palette = React.useMemo(() => resolvePalette(look?.palette), [look?.palette]);
  if (!node) {
    return (
      <p data-made-gone="" className="px-1 py-2 text-center text-fine leading-snug" style={{ color: skin.dim }}>
        {thread.madeId ? "the part this made is no longer on the board" : "this one made nothing on the board"}
      </p>
    );
  }
  const W = width;
  // Fit, never crop: a part twice the card's width shrinks rather than
  // showing its left half, which for most parts is an empty margin.
  const scale = Math.min(W / Math.max(1, node.w), height / Math.max(1, node.h), 1);
  /*
   * And on a box, the frame is the part's own shape rather than a fixed
   * band: most parts are wide and short, and a short one centred in a tall
   * frame is a part with two empty bars round it. `height` is the most it
   * may take, not what it takes.
   */
  const frame = quiet ? Math.max(34, Math.min(height, Math.round(node.h * scale))) : height;
  const inner = (
    <div
      data-made-preview={node.id}
      data-made-live={live ? "1" : "0"}
      {...(live ? {} : { "aria-hidden": true, inert: true })}
      /* A live part takes its own presses; the box under it does not get
         them, or opening a card would drag the box it grew out of. */
      {...(live ? { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClick: (e: React.MouseEvent) => e.stopPropagation() } : {})}
      className="grid place-items-center overflow-hidden rounded-sm border"
      style={{ height: frame, borderColor: skin.rim, background: theme.surface }}
    >
      <div style={{ width: node.w, height: node.h, transform: `scale(${scale})`, transformOrigin: "center" }}>
        <Block node={node} t={theme} palette={palette} page={{ w: node.w, h: node.h }} mode={live ? "live" : "board"} size={{ w: node.w, h: node.h }} />
      </div>
    </div>
  );
  if (quiet) return inner;
  /*
   * Inset, on a dark surround.
   *
   * The part keeps its own page surface, because that is how it really
   * looks and a repainted preview would be a lie about it — but a pale
   * rectangle edge to edge on a dark card was the loudest thing on the
   * card. Sitting it in from the edges with the card's own ground round it
   * makes it a picture *on* the card rather than a hole through it.
   */
  return <div className="mb-1.5 rounded-md p-1.5" style={{ background: "oklch(0.16 0.03 20 / 0.55)" }}>{inner}</div>;
}

export function CopyBit({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className="tactile flex items-center gap-1 rounded px-1 text-fine uppercase tracking-[0.12em] opacity-80 hover:opacity-100"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        play("tap");
        setDone(true);
        window.setTimeout(() => setDone(false), 1200);
      }}
    >
      <Copy className="size-3" /> {done ? "copied" : "copy"}
    </button>
  );
}

/**
 * The cut line on a vine: press it and the iteration goes.
 *
 * A vine has one line down its middle and this is what it is for. The line
 * itself is painted on the canvas with the rest of the vine, scored into
 * the groove at its axis; this is the part that takes a press — an element
 * clipped to the line's own shape, so a press lands on the line and not on
 * the board around it, and hovering it lights the line in the construct's
 * own white so what is about to happen is plain before it happens.
 *
 * It cuts the *later* of the two: a vine runs from what came before to what
 * came out of it, and what the line is between is the iteration at its far
 * end. Whatever hangs under that re-hangs from its parent (`threads.ts`), so
 * cutting one iteration out of the middle of a run keeps the rest of the
 * run.
 */
export function VineCut({ of, at, ends: pair, onTug, onCut }: {
  of?: Thread;
  at: [Point, Point];
  ends: [VineEnd, VineEnd];
  onTug: (id: string, held: boolean) => void;
  onCut: (id: string) => void;
}) {
  const id = of?.id;
  /* Let go on the way out, whatever took the element away — a drag
     starting, the box moving, this unmounting mid-hover. A vine left
     pulled by a pointer that is not there any more is a vine stuck. */
  React.useEffect(() => () => { if (id) onTug(id, false); }, [id, onTug]);
  if (!of || !id) return null;
  const [from, to] = at;
  /* The box is the band's, not the paint's: a target wider than the vine
     needs the room to be wider than the vine, or its far side is clipped. */
  const box = strandBounds(from, to, REACH_WIDTH);
  const d = strandReach({ x: from.x - box.x, y: from.y - box.y }, { x: to.x - box.x, y: to.y - box.y });
  if (!d) return null;
  return (
    <Tooltip content={`Cut it, and "${headlineOf(of)}" goes`}>
      <button
        type="button"
        data-vine-cut={id}
        onPointerDown={(e) => e.stopPropagation()}
        /*
         * A BAND ALONG THE WHOLE VINE, not the line down the middle of it.
         *
         * His words: "it seems to need to be super precisely the line in
         * the middle of the vine and easy to miss … a band along its whole
         * length, generous either side, so it catches a hand that is near
         * it rather than one that is exactly on it." The seam was 7px
         * across; this is `REACH_WIDTH`, 44, and it is measured off the
         * vine at rest so it does not move out from under the pointer the
         * moment the vine answers.
         *
         * The press is unchanged and lands on the same band, which is a
         * bigger thing to press by accident than it was — and it is one
         * undo, because `pruneThread` pushes history like every other
         * edit, and the vine visibly lifts under the hand before the press
         * as well as saying what will go.
         */
        onPointerEnter={() => onTug(id, true)}
        onPointerLeave={() => onTug(id, false)}
        onFocus={() => onTug(id, true)}
        onBlur={() => onTug(id, false)}
        onClick={(e) => { e.stopPropagation(); onCut(id); }}
        aria-label={`Cut the line, and "${headlineOf(of)}" goes`}
        className="vine-cut absolute"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h, clipPath: `path("${d}")` }}
      />
    </Tooltip>
  );
}

/** Right-press on a box: what can be done with this iteration. */
export function BoxMenu({ at, thread, onClose }: { at: { x: number; y: number }; thread: Thread; onClose: () => void }) {
  const pinned = useStudio((s) => s.pinnedThreads.includes(thread.id));
  const live = useStudio((s) => s.liveThreadId === thread.id);
  const current = useStudio((s) => s.currentThreadId === thread.id);
  React.useEffect(() => {
    const shut = () => onClose();
    window.addEventListener("pointerdown", shut);
    window.addEventListener("keydown", shut);
    return () => {
      window.removeEventListener("pointerdown", shut);
      window.removeEventListener("keydown", shut);
    };
  }, [onClose]);
  const item = (label: string, icon: React.ReactNode, run: () => void, danger = false, mark?: Record<string, string>) => (
    <button
      type="button"
      {...mark}
      onClick={() => { run(); onClose(); }}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-plain hover:bg-[oklch(0.3_0.07_152)]",
        danger ? "text-[oklch(0.8_0.14_25)]" : "text-[oklch(0.9_0.04_152)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div
      data-thread-menu=""
      data-box-menu=""
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 w-56 rounded-lg border p-1 shadow-pop"
      style={{ left: at.x, top: at.y, background: "oklch(0.21 0.059 152)", borderColor: "oklch(0.4 0.118 152)" }}
    >
      <p className="truncate px-2 py-1 text-small uppercase tracking-[0.14em] text-[oklch(0.66_0.08_152)]">{thread.mode}</p>
      {item("Open it below", <Wand2 className="size-3" />, () => useStudio.getState().openThread(thread.id))}
      {/*
        The flag, off the card and into the menu.

        It was a green square on every box — a second green mark on a red
        card, about neither the element nor the update's own state. What it
        does has not changed: it says which update the section below, the
        prompt area in it and the next ask all follow, and it survives a
        reload, because "where was I" is the question a timeline exists to
        answer. `data-current-for` is kept on it so it is still the one
        control that means this.
      */}
      {item(current ? "Stop working in this one" : "Work in this one", <Flag className="size-3" />,
        () => useStudio.getState().setCurrentThread(current ? null : thread.id), false,
        { "data-current-for": thread.id, "data-current": current ? "1" : "0" })}
      {item(live ? "The board is on this" : "Stand on it", <MapPin className="size-3" />, () => useStudio.getState().standOn(thread.id))}
      {item(pinned ? "Unpin it" : "Pin it", pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />, () => useStudio.getState().togglePinnedThread(thread.id))}
      {item("Copy the prompt", <Sparkles className="size-3" />, () => void navigator.clipboard?.writeText(thread.ask))}
      {item("Copy what came back", <Sparkles className="size-3" />, () => void navigator.clipboard?.writeText(thread.answer))}
      <div className="my-1 h-px bg-[oklch(0.32_0.06_152)]" />
      {item("Prune this update", <Scissors className="size-3" />, () => useStudio.getState().pruneThread(thread.id), true)}
    </div>
  );
}