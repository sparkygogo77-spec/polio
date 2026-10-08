"use client";
import * as React from "react";
import { Brush, Pin } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { BODY, EDGE } from "../../boxGround";
import { type Point } from "../strand";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { SitePreview, type PreviewDoc } from "../../SitePreview";
import { processDone, type Thread } from "../threads";
import { formVars } from "../../formation";
import { useStudio } from "../../board/store";
import { BOX, PIECE, headlineOf } from "./layout";
import { ownParts } from "./IterationBox";
import { Card, Made } from "./cards";

/**
 * The site, as this update left it.
 *
 * The board's own preview renderer over the document the update carries, so
 * it is the site rather than a picture of one: the same parts, the same
 * theme, the same layout at the frame width the site is built at, scaled
 * down to the card. Inert, because a card is dragged; the whole site is one
 * press away on the board.
 *
 * **It is `SitePreview`, the same one the Builds page shows.** This had its
 * own take for a while — the frame slid down the page when everything an
 * update touched sat below the fold, and the card said how far — which was a
 * real answer to a real problem (two updates that both changed something low
 * on the page are otherwise the same picture twice) and was the wrong
 * answer, because it made a preview that had to be read rather than looked
 * at. A preview of a site is a preview of a site: the top of it, the whole
 * width, scaled down, the fold said with a fade. One definition, two places
 * that show it, and the card is the ordinary thing everywhere else is.
 *
 * **Only the parts that existed by this update.** Each update snapshots the
 * document it landed on, so what comes later simply is not in it — which is
 * the point of a chain of them: the elements that arrive after this one
 * arrive on the cards that made them.
 *
 * `live` is the newest card, the one the board stands on. Nothing has
 * happened since it, so it shows the board as it stands *now* rather than a
 * snapshot that is already behind the thing it is a picture of.
 *
 * Off-screen it costs nothing: `content-visibility` skips the layout and the
 * paint of a card that is not in view, which is what makes thirty of them
 * affordable at all.
 */
/** The Builds card's picture: 352 wide by 168 tall (`BuildsPage.tsx`). */
export const SHOT_RATIO = 352 / 168;

export function SiteShot({ thread, live }: { thread: Thread; live: boolean }) {
  /* One field at a time. A selector that builds an object returns a new one
     every call, so the store thinks it changed on every render and the
     component never stops rendering. */
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const activePageId = useStudio((s) => s.activePageId);
  const boardWidth = useStudio((s) => s.frameWidth);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const now = React.useMemo(() => ({ pages, nodes, activePageId, frameWidth: boardWidth, format, look }), [pages, nodes, activePageId, boardWidth, format, look]);
  /*
   * The newest card shows the board as it stands; every other one shows the
   * document it landed on. An update that kept no document shows nothing at
   * all rather than today's site: a card is a picture of where the site was
   * at that point, and today's site is not that, however convenient it is to
   * have to hand.
   *
   * The snapshot is the whole document — `snapshot()` takes all of it — and
   * `ThreadDoc` only ever named the few fields somebody had read, so what is
   * handed over is the rest of the same object rather than a hope about it.
   */
  const kept: PreviewDoc | null = live ? now : (thread.doc as PreviewDoc | undefined) ?? null;
  /*
   * A picture only where there is something in it. A site with nothing on
   * its page drew as its own empty backdrop, a dark field across the middle
   * of the box, which on a carried-out box was most of the box. He asked
   * for the box to look like the blue boxes, with a picture on top only
   * where there is a picture. So an empty site is a line and a note on the
   * texture, the way a kept-nothing update already is.
   */
  const pageOf = kept ? (kept.activePageId ?? kept.pages?.[0]?.id) : null;
  const stands = !!kept && (kept.nodes ?? []).some((n) => !pageOf || n.pageId === pageOf);
  const from = stands ? kept : null;
  /*
   * The same proportion as the picture on a Builds card, so the two read
   * as one object: that card's picture is 352 by 168, and this one is as
   * tall as the box's middle and as wide as that proportion makes it,
   * standing in the middle of the box with the texture either side. Across
   * the whole box it was four times as wide as it was tall, a strip of the
   * site's header, and he said so.
   */
  const H = BOX.h - 66;
  const W = Math.round(H * SHOT_RATIO);
  return (
    <div
      data-site-shot={thread.id}
      data-site-live={live ? "1" : "0"}
      aria-hidden
      inert
      className="grid shrink-0 place-items-start self-center overflow-hidden rounded-md border"
      style={{
        height: H,
        width: W,
        borderColor: "oklch(0.36 0.091 var(--box-hue, 152))",
        /* Nothing painted behind the picture: the picture is the site's own, on top of the texture, and an empty frame is a line. */
        background: "transparent",
        contentVisibility: "auto",
        containIntrinsicSize: `${W}px ${H}px`,
      }}
    >
      {from ? (
        <SitePreview doc={from} width={W} height={H} />
      ) : (
        <span className="grid h-full w-full place-items-center text-small font-semibold" style={{ color: BODY }}>
          {kept ? "nothing stands on the site yet" : "no picture of the site was kept with this one"}
        </span>
      )}
    </div>
  );
}

/**
 * The site's own feature list, under it.
 *
 * What stands on the page at this update, named, with whatever this update
 * put there or changed lit — so the card says what the site is made of and
 * which part of that is this update's doing. The headline the box used to
 * lead with is the first line of it: a receipt belongs under the thing it is
 * a receipt for.
 */
export function Features({ thread }: { thread: Thread }) {
  const threads = useStudio((s) => s.threads);
  const parent = thread.parentId ? threads.find((t) => t.id === thread.parentId) ?? null : null;
  /* The same rule the preview frames by, so the list and the picture cannot
     disagree about which parts are this update's. */
  const { parts, mine } = React.useMemo(() => ownParts(thread, parent), [thread, parent]);
  return (
    <div className="flex min-h-0 shrink-0 flex-col gap-1 px-0.5 py-0.5">
      {/* The body line, straight on the texture: 12px and semibold, near white, with the edge every glyph on a box casts. */}
      <span data-headline="" className="line-clamp-1 block text-large font-semibold leading-snug" style={{ color: BODY }}>
        {headlineOf(thread)}
        {thread.changes.length > 1 ? ` · and ${thread.changes.length - 1} more` : ""}
      </span>
      {parts.length ? (
        <ul data-features="" className="flex flex-wrap gap-1 overflow-hidden text-fine" style={{ maxHeight: 34 }}>
          {parts.slice(0, 14).map((n) => (
            <li
              key={n.id}
              data-feature-new={mine.has(n.id) ? "1" : "0"}
              className="rounded-sm border px-1 py-px"
              /*
               * Both kinds stand on a ground of their own.
               *
               * A chip is an object, not a sentence, and it already carries a
               * border — so the one thing it was missing was a floor. The
               * unlit one had none, which put nine-pixel words straight onto
               * the render: fine over the dark between the filaments, and
               * 3.8:1 over a bright one, which is the note. A near-opaque
               * plate makes its face one value instead of a moving one — and it
               * is opaque rather than nearly so, because six per cent of a
               * bright filament coming through was still enough to put the
               * worst pixels of a chip at 4.1:1 — and
               * then the ink can stay the family's green rather than being
               * driven to white to survive the brightest pixel under it.
               * Lit is still the loud one: brighter plate, brighter edge.
               */
              style={mine.has(n.id)
                ? { borderColor: "oklch(0.7 0.17 var(--box-hue, 152))", background: "oklch(0.3 0.09 var(--box-hue, 152))", color: "oklch(0.95 0.07 var(--box-hue, 152))" }
                : { borderColor: "oklch(0.4 0.09 var(--box-hue, 152))", background: "oklch(0.17 0.03 var(--box-hue, 152))", color: "oklch(0.92 0.05 var(--box-hue, 152))" }}
            >
              {n.label}
            </li>
          ))}
          {parts.length > 14 ? <li className="px-1 py-px" style={{ color: "oklch(0.88 0.045 var(--box-hue, 152))" }}>and {parts.length - 14} more</li> : null}
        </ul>
      ) : (
        <span className="text-small font-semibold" style={{ color: BODY }}>nothing stands on the site yet</span>
      )}
    </div>
  );
}

/**
 * An element prompt: the drawing, small, in purple.
 *
 * No headline. A drawing made real on one part is not news about the
 * site, it is a piece of it, and the line that was drawn says more than
 * any sentence about the line would.
 */
export function ElementPiece({
  thread, at, forming, open, pinned, dragging, onOpen, onDragStart, onMenu,
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
  const name = (thread.changes[0] ?? thread.ask ?? "a drawing").replace(/^(drew|reshaped)\s+/i, "").split(" at ")[0]!.slice(0, 28);
  return (
    <div className="absolute" style={{ left: at.x, top: at.y, width: PIECE.w, zIndex: open ? 40 : dragging ? 30 : 12 }}>
      {open ? <Card thread={thread} side="in" /> : null}
      {/*
        A surface, not a button.

        It carries a live element now, and an element inside a `<button>` is
        both invalid and unusable — every press inside it would be a press on
        the button. So the card is a div that takes a press, a drag and a
        right-press, reachable from the keyboard, and the element inside it
        stops its own presses from reaching the card.
      */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`the update that made ${name}`}
        data-box={thread.id}
        data-piece=""
        data-open={open ? "1" : "0"}
        /* No dot, and the state is still said: what a card is in the middle of
           is what the board and the suite ask it, and the picture of it is the
           formation while it works and a grey vine when it was given up on. */
        data-state={processDone(thread.state) ? "done" : thread.state}
        onPointerDown={onDragStart}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        onContextMenu={onMenu}
        /* The same construct at the ember temperature: `core/ui/molten.css`. */
        className={cn(
          moltenClass("ember"),
          "flex w-full cursor-grab flex-col gap-1 rounded-lg p-2 text-left transition-[box-shadow,transform] active:cursor-grabbing",
        )}
        data-forming={forming < 1 ? "" : undefined}
        style={{
          minHeight: PIECE.h,
          ...moltenSeed(thread.id),
          textShadow: EDGE,
          ...(forming < 1 ? (formVars(forming) as React.CSSProperties) : {}),
          /* No band here, and that is the measurement rather than an
             oversight: a red card's middle is a drawing or a rendered part,
             and both are line and glass rather than a plate — banding it put
             a visible dark stripe across the waist of every one. It is also
             where there is least to win: a red card is a fifth of a green
             one's area, and the green ones are what the timeline is made of. */
          color: "oklch(0.95 0.05 22)",
          boxShadow: open ? "0 10px 28px oklch(0 0 0 / 0.55)" : "0 3px 6px oklch(0 0 0 / 0.5)",
          filter: open ? "brightness(1.14)" : "none",
          transform: dragging ? "scale(1.03)" : "none",
        }}
      >
        <span data-molten="" />
        {/*
          The element is the subject.

          It was a thumbnail beside a line of text, then the drawing large and
          central; it is the part itself now, and the name and the small line
          sit under it, supporting it.
        */}
        {/*
          No label either. The red box used to say "drawing" across its top,
          and the thing is right there under it — a caption for a picture you
          are already looking at.
        */}
        {/*
          Nothing but the pin.

          There was a green flag and a green dot up here on every card. The
          flag marked the update being worked in and the dot said whether the
          process behind it had finished — two green marks on a red card,
          neither of which is about the element the card is *for*. The flag
          moved to the box's own menu, where the rest of what can be done to
          an update lives; the dot went, because a card that is still working
          is visibly forming and one that was given up on hangs off a grey
          vine, and a green dot saying "finished" on every finished card is a
          mark that is on almost all of them almost all of the time.
        */}
        {pinned ? (
          <span className="flex items-center justify-end text-[8px] text-[oklch(0.9_0.07_18)]"><Pin className="size-2.5 fill-current" /></span>
        ) : null}
        {/*
          THE ELEMENT, NOT THE DRAWING OF IT.

          This was the strokes played back — two circles and a square drawn,
          two circles and a square returned, which tells a person nothing
          they did not just draw. What belongs on the card is the thing the
          drawing became, as it exists on the page: the board's own renderer,
          the real node, the site's own palette and light, live when the card
          is open. And while it is still being made there is no element yet,
          so the drawing stands in for it until there is one — that is
          honestly all there is at that moment.
        */}
        <span className="flex min-h-0 flex-1 items-stretch justify-center py-0.5">
          {forming < 1 && !thread.madeId ? (
            <span className="grid flex-1 place-items-center">
              {/* The room the element gets when there is one, so the drawing
                  standing in for it is the same size as the thing it stands
                  in for rather than a stamp in the middle of an empty card. */}
              <Drawn sketch={thread.sketch} size={62} width={PIECE.w - 22} height={PIECE.h - 66} tone="oklch(0.97 0.045 24)" />
            </span>
          ) : (
            <span className="block w-full">
              <Made thread={thread} skin={{ rim: "oklch(0.46 0.157 18 / 0.7)", dim: "oklch(0.72 0.106 18)" }} width={PIECE.w - 18} height={PIECE.h - 62} live={open} quiet />
            </span>
          )}
        </span>
        <span className="block px-0.5 py-0.5 text-center" style={{ "--box-hue": 18 } as React.CSSProperties}>
          <span data-headline="" className="line-clamp-1 block text-[13px] font-semibold leading-snug" style={{ color: BODY }}>{name}</span>
          {thread.changes.length > 1 ? (
            /* 0.93, up from 0.9. At nine pixels on the ember face this was the
               worst run of words anywhere on the timeline and it sat exactly on
               its bar: 4.48, 4.53, 4.55, 4.57 on four runs of one build, so the
               suite failed about one time in four and passed the other three on
               nothing but where the drift happened to be sampled. A hairline is
               not a contrast. Still under the name above it at 0.95, so the two
               keep their order. Measured by `ink-on-cards`, which reports the
               worst mark by name now rather than only its number. */
            <span className="mt-0.5 block text-small font-semibold text-[oklch(0.95_0.04_18)]">and {thread.changes.length - 1} more</span>
          ) : null}
        </span>
      </div>
      {open ? <Card thread={thread} side="out" /> : null}
    </div>
  );
}

/**
 * The line that was drawn, as a mark.
 *
 * Straight off the strokes the board kept, so a piece carries the actual
 * drawing rather than an icon standing in for one.
 */
/**
 * Enough points to be the line, at a thumbnail's size.
 *
 * A helix is two hundred points and every other one is plenty. A box is
 * five, and every other one is a diagonal: dropping points from a short
 * stroke does not simplify it, it draws something else. So the step is
 * worked out from the length, and the last point is always kept, because
 * that is the one that closes the shape.
 */
export function thin(stroke: [number, number][], most = 64): [number, number][] {
  if (stroke.length <= most) return stroke;
  const step = Math.ceil(stroke.length / most);
  const out = stroke.filter((_, k) => k % step === 0);
  const last = stroke[stroke.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * The ink is drawn twice: a dark line under it, then the line itself.
 *
 * A card's face is J's render now, and a render is not one value — it is
 * dark between the filaments and near white along them, so any single ink
 * colour lands on both. A red line at 0.9 lightness sat at nearly the value
 * of the face it was on and the drawing disappeared into the card, which is
 * the note. A near-white line over a near-black one of its own temperature
 * reads against either: where the face is dark the ink carries it, where a
 * filament is bright the shade under it carries it, and it is the same
 * trick the construct already uses — light with the material's own dark
 * behind it.
 *
 * Twice the polylines, over a points budget rather than a stroke count, so
 * the whole drawing is on the card and the cost is bounded by how much line
 * there is rather than by how many times the hand lifted; a card repaints
 * this when its drawing changes and not otherwise.
 */
export function Drawn({ sketch, size, width, height, tone, shade = "oklch(0.1 0.02 24 / 0.92)" }: { sketch?: { strokes: [number, number][][] } | null; size: number; width?: number; height?: number; tone: string; shade?: string }) {
  if (!sketch?.strokes?.length) return <Brush className="size-3.5 shrink-0 opacity-70" />;
  const W = width ?? size;
  const H = height ?? size;
  /*
   * ALL OF THEM. A bird put on the board in fifteen strokes is one drawing
   * everywhere else in this app — the ink groups it as one, the ring round
   * it counts fifteen, one Make real is drawn for it — and it was twelve
   * here, so the same bird lost its legs on the card that is meant to be a
   * picture of it. The budget is points rather than strokes now: the whole
   * drawing gets about six hundred of them and each stroke takes its share,
   * which is what the thinning was always for.
   */
  const strokes = sketch.strokes.filter((st) => st.length > 1);
  const each = Math.max(8, Math.floor(600 / Math.max(1, strokes.length)));
  const drawn = strokes.map((stroke) => thin(stroke, each));
  const lines = drawn.map((stroke) => stroke.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(" "));
  /*
   * THE DRAWING FILLS THE ROOM IT IS GIVEN.
   *
   * The box was the unit square on the reasoning that the strokes are
   * normalised into it, and they are not: a line drawn across the middle of
   * a board normalises to a band through the middle of that square, so the
   * mark arrived as a small clump in the centre of a card with air all round
   * it. The view is the drawing's own bounds with a margin now, so whatever
   * was drawn is as large as the space allows — which is the whole of the
   * note, a drawing on a card has to read at card size.
   *
   * A margin of a twelfth, and a floor under the extent so a straight line
   * or a single dot — zero high or zero wide — is not divided by nothing and
   * blown up to infinity.
   */
  const xs = drawn.flat().map(([x]) => x);
  const ys = drawn.flat().map(([, y]) => y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = Math.max(0.04, x1 - x0, y1 - y0);
  const pad = span / 12;
  const vw = Math.max(span / 6, x1 - x0) + pad * 2;
  const vh = Math.max(span / 6, y1 - y0) + pad * 2;
  const vx = (x0 + x1) / 2 - vw / 2;
  const vy = (y0 + y1) / 2 - vh / 2;
  /*
   * And the line's weight is in pixels, not in the drawing's own units.
   *
   * It was a fraction of the unit square, so the more the drawing was scaled
   * up the fatter its ink went: at a thumbnail's size the dark line under it
   * was six pixels wide and a drawing of any detail closed into a mesh. With
   * `non-scaling-stroke` the width is read in the viewport instead, so a
   * stroke is the same weight however far the view is zoomed and detail
   * survives being made large. Slightly heavier on a bigger drawing, because
   * a hairline across 150px reads as a scratch.
   */
  const dark = Math.max(2.1, Math.min(3.6, Math.min(W, H) / 40));
  return (
    <svg width={W} height={H} viewBox={`${vx.toFixed(4)} ${vy.toFixed(4)} ${vw.toFixed(4)} ${vh.toFixed(4)}`} preserveAspectRatio="xMidYMid meet" aria-hidden className="shrink-0">
      {lines.map((points, i) => (
        <polyline key={`u${i}`} points={points} fill="none" stroke={shade} strokeWidth={dark} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {lines.map((points, i) => (
        <polyline key={i} points={points} fill="none" stroke={tone} strokeWidth={dark * 0.42} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
