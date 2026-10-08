"use client";
/**
 * Spaces on the board: the placeholder, the construct box, the black hole.
 *
 * A space is a closed line drawn with the space tool (`space.ts`). This
 * draws what each one is right now, in the page's own coordinates, under
 * the ink and the parts so that what is drawn or dropped inside sits on it:
 *
 *   · **undecided**: the line as drawn, dashed, with two keys at the middle
 *     of the area. Construct, or Black hole. Nothing else, because a
 *     placeholder is a promise about the layout and not about the feature.
 *   · **construct**: a lantern construct, the timeline's own language for a
 *     thing that holds work, cut to the line that was drawn. Green holds,
 *     red was drawn; a space is neither yet, so it wears the base set.
 *   · **hole**: the black hole grows from the centroid as the drawn shape
 *     itself until it reaches the line (`CONSUME_MS`), and the ground comes
 *     with it: dark matter cut to the same growing edge. Once it has
 *     consumed the area, the area is drawing space, with the horizon on the
 *     line, the photon ring on it and the beamed disc outside it.
 *
 * The light outside the line needs room (`HALO`), so every space's host is
 * its box grown by that on each side, and the boundary is shifted into the
 * host's own pixels once. The page layer it sits in is scaled by the board's
 * zoom, so the keys counter-scale the way the ink door does, and stay one
 * size under the hand.
 *
 * `SpaceSide` is the other half: the per-element panel at the right edge of
 * the board for whatever is picked inside an open hole (`SpacePanel.tsx`).
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { Box as BoxIcon, Circle, Sparkles } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { VOID } from "@/core/ui/void";
import { formVars, progressOf, stageOf, within } from "./formation";
import { PROCESS } from "./loop";
import { HALO, paintHoleAlong, paintRingAlong } from "./blackHole";
import { useGround } from "./ground";
import { boundaryBox, boundaryPath, centroid, consumed, CONSUME_MS, grownBoundary, isBoundary, isMade, openOf, spaceBox, spaceOf, spaceOfDrawing, type Space } from "./space";
import type { SketchPoint as Pt } from "./pictures";
import type { SketchPoint } from "./pictures";
import { nodeInSpace } from "./space";
import { pageNodes, pageShapes, pageSpaces, useStudio } from "./board/store";
import { inkGroups } from "./inkGroups";
import { SpaceInkPanel, SpaceOwnPanel, SpacePanel } from "./SpacePanel";
import { lockNow } from "./surfaceRun";
import { formFromJobs, isMade as made_, jobsInSpace } from "./space";
import { groupOf as groupOfStroke } from "./inkGroups";
import { QUEUED } from "./formation";
import { Move } from "lucide-react";

/** The placeholder's line, and the keys on it: the void's lit rim, because it is not yet anything. */
const PLACEHOLDER = "oklch(0.62 0.08 290)";

export function SpaceMarks({ zoom }: { zoom: number }) {
  const spaces = useStudio(useShallow(pageSpaces));
  if (!spaces.length) return null;
  /*
   * One open at a time. The open hole is the one opened most recently,
   * drawing counting as opening (`openOf`); every other unmade space is a
   * closed line with what it is for written on it, and costs nothing to
   * keep on the page. A surface already made is neither: it is its parts
   * on their ground.
   */
  const open = openOf(spaces);
  return (
    <>
      {spaces.map((sp) => (sp.id === open?.id || isMade(sp) ? <SpaceMark key={sp.id} space={sp} zoom={zoom} /> : <ClosedMark key={sp.id} space={sp} zoom={zoom} />))}
    </>
  );
}

/**
 * A space that is not the open one: its line, and what it is for.
 *
 * No ground, no light, no canvas: a thin line in the aura's colour and a
 * key at the middle of the area that says what the space is for, in the
 * words from its panel, or "This space" when nothing has been said yet.
 * Pressing it opens it, which closes whatever was open.
 */
function ClosedMark({ space, zoom }: { space: Space; zoom: number }) {
  const box = spaceBox(space);
  const local = React.useMemo<SketchPoint[]>(() => space.boundary.map(([x, y]) => [x - box.x, y - box.y]), [space.boundary, box.x, box.y]);
  const [mx, my] = React.useMemo(() => centroid(local), [local]);
  const says = purposeOf(space);
  const erasing = useStudio((s) => s.tool === "erase");
  return (
    <div data-space={space.id} data-space-closed="" className="pointer-events-none absolute" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      <svg className="absolute left-0 top-0 overflow-visible" width={Math.max(1, box.w)} height={Math.max(1, box.h)} aria-hidden>
        <path d={boundaryPath(local)} fill="oklch(0.86 0.16 72 / 0.04)" stroke="oklch(0.86 0.16 72 / 0.55)" strokeWidth={1.2 / zoom} strokeDasharray={`${5 / zoom} ${4 / zoom}`} />
      </svg>
      <button
        type="button"
        data-space-closed-key={space.id}
        title={says === "This space" ? "Open this space" : `Open this space: ${says}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          play("select");
          useStudio.getState().updateSpace(space.id, { opened: Date.now() });
          useStudio.getState().setSelection([space.id]);
        }}
        className={cn("tactile absolute z-30 max-w-[240px] truncate rounded-md border px-2 py-1 text-small font-medium", erasing ? "pointer-events-none" : "pointer-events-auto")}
        style={{
          left: mx, top: my,
          transform: `translate(-50%, -50%) scale(${Math.max(1, 1 / zoom)})`,
          borderColor: "oklch(0.86 0.16 72 / 0.45)", background: "oklch(0.09 0.02 290 / 0.85)", color: "oklch(0.9 0.06 78)",
        }}
      >
        {says}
      </button>
    </div>
  );
}

/** What a space is for, in the person's words: its name, else the first line of what it is for, else nothing yet. */
export function purposeOf(space: Space): string {
  const name = space.label.trim();
  if (name) return name;
  const line = (space.prompt.split("\n")[0] ?? "").trim();
  return line ? (line.length > 48 ? `${line.slice(0, 46)}…` : line) : "This space";
}

/**
 * Ink drawn inside an open hole, marked as belonging to it.
 *
 * A drawing knows its space the same way a part does — by where it is, not
 * by a pointer written on it — so this is read rather than stored, and a
 * stroke dragged out of a space stops belonging to it. Without the mark
 * the belonging was invisible: a person pressed Make real inside a space
 * they had steered and got an ordinary part, with nothing on the board to
 * say the space had any bearing on it. The part that lands does inherit
 * the space's plan (`store.addNode`); this is how you can see that coming.
 */
export function SpaceInk({ zoom }: { zoom: number }) {
  const spaces = useStudio(useShallow(pageSpaces));
  const shapes = useStudio(useShallow(pageShapes));
  const pageId = useStudio((s) => s.activePageId);
  const drawings = React.useMemo(() => inkGroups(shapes.filter((sh) => sh.kind === "pen")), [shapes]);
  const now = Date.now();
  /*
   * A closed shape inside a space is one element by construction.
   *
   * The ink grouping rule joins a stroke to a recent one nearby, which is
   * right for a gull of four strokes and wrong for J's create flow: he
   * draws a square and then a button beside it, and they came out as one
   * drawing with one prompt. So a closed stroke that lands inside an open
   * space is split off as its own drawing the moment it lands — the same
   * Split a person presses, pressed for them, because in a surface a box
   * means an element. Open strokes keep the usual rule: a gull drawn in a
   * space is still a gull.
   */
  React.useEffect(() => {
    if (!spaces.length) return;
    const own = shapes.filter((sh) => sh.kind === "pen" && !sh.group && sh.points.length >= 4 && isBoundary(sh.points)
      && spaceOfDrawing(spaces, { pageId, bounds: boundaryBox(sh.points) }, Date.now()));
    if (own.length) useStudio.getState().splitInk(own.map((sh) => sh.id));
  }, [shapes, spaces, pageId]);
  if (!spaces.length || !drawings.length) return null;
  return (
    <>
      {drawings.map((g) => {
        const space = spaceOfDrawing(spaces, { pageId, bounds: g.bounds }, now);
        if (!space) return null;
        return (
          <button
            key={`ink-space-${g.id}`}
            type="button"
            data-ink-space={g.id}
            data-ink-in={space.id}
            title="Say what this one is for"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); play("select"); useStudio.getState().setSelection([g.strokeIds[0]!]); }}
            /* A drawn line is a pixel wide at this zoom and a hand cannot
               land on it, so the badge is the way to pick the drawing: it
               is on the drawing, says which space it is in, and opens the
               drawing's own words. */
            className="tactile pointer-events-auto absolute z-20 whitespace-nowrap rounded px-1 py-0.5 text-fine font-medium"
            style={{
              left: g.bounds.x,
              top: g.bounds.y + g.bounds.h + 4,
              transform: `scale(${Math.max(1, 1 / zoom)})`,
              transformOrigin: "0 0",
              background: "oklch(0.06 0.01 290 / 0.85)",
              border: "1px solid oklch(0.86 0.16 72 / 0.55)",
              color: "oklch(0.92 0.09 78)",
            }}
          >
            in {space.label.trim() || "this space"}
            {space.plan?.steps?.length ? ", made its way" : ""}
          </button>
        );
      })}
    </>
  );
}

/**
 * Why a line did not become a space, said where the line was drawn.
 *
 * It was a toast at the bottom right of the window, truncated to about a
 * hundred and forty pixels: a person watching their own hand at the top of
 * the board never saw it, and J has toasts off altogether, which makes the
 * corner worse than useless. A refusal belongs at the gesture it refuses,
 * so this is drawn on the line the hand just let go of, and fades on its
 * own rather than needing to be dismissed.
 */
export function SpaceRefused({ at, zoom }: { at: { points: Pt[]; at: number; hand?: { x: number; y: number } } | null; zoom: number }) {
  const [gone, setGone] = React.useState(false);
  React.useEffect(() => {
    setGone(false);
    if (!at) return;
    const t = setTimeout(() => setGone(true), 3200);
    return () => clearTimeout(t);
  }, [at]);
  if (!at || gone) return null;
  const box = boundaryBox(at.points);
  const ends: Pt[] = [at.points[0]!, at.points[at.points.length - 1]!];
  return (
    <div className="pointer-events-none absolute z-30" style={{ left: box.x, top: box.y, width: Math.max(1, box.w), height: Math.max(1, box.h) }}>
      {/* The two ends that did not meet, ringed: the thing to fix, on the thing itself. */}
      <svg className="absolute overflow-visible" style={{ left: 0, top: 0 }} width={Math.max(1, box.w)} height={Math.max(1, box.h)} aria-hidden>
        {ends.map((p, i) => (
          <circle key={i} cx={p[0] - box.x} cy={p[1] - box.y} r={7 / zoom} fill="none" stroke="oklch(0.7 0.19 27)" strokeWidth={1.5 / zoom} />
        ))}
        <line
          x1={ends[0]![0] - box.x} y1={ends[0]![1] - box.y} x2={ends[1]![0] - box.x} y2={ends[1]![1] - box.y}
          stroke="oklch(0.7 0.19 27 / 0.5)" strokeWidth={1.2 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`}
        />
      </svg>
      {at.hand ? <RefusedNote hand={at.hand} /> : (
        <div data-space-refused="" role="status" className="absolute whitespace-nowrap rounded-md px-2 py-1 text-plain font-medium shadow-lg"
          style={{ left: box.w / 2, top: -6, transform: `translate(-50%, -100%) scale(${Math.max(1, 1 / zoom)})`, ...REFUSED_LOOK }}>
          {REFUSED_WORDS}
        </div>
      )}
    </div>
  );
}

const REFUSED_WORDS = "A space is a closed line. Come back to where you started.";
const REFUSED_LOOK: React.CSSProperties = { background: "oklch(0.16 0.04 25)", border: "1px solid oklch(0.7 0.19 27)", color: "oklch(0.95 0.06 30)" };

/**
 * The refusal beside the hand that let go, in the window's own pixels.
 *
 * Centred over the line's box, it ran off the right edge of the window
 * whenever the line was drawn near it ("A space is a closed line. Come back
 * to st…"). Beside the pointer, and turned to the other side of it when the
 * window's edge is near, it is always whole and always where the eye is.
 */
function RefusedNote({ hand }: { hand: { x: number; y: number } }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [place, setPlace] = React.useState<{ left: number; top: number } | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 14;
    const room = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = hand.x + gap;
    if (left + w > vw - room) left = hand.x - gap - w;
    left = Math.max(room, Math.min(vw - room - w, left));
    let top = hand.y + gap;
    if (top + h > vh - room) top = hand.y - gap - h;
    top = Math.max(room, Math.min(vh - room - h, top));
    setPlace({ left, top });
  }, [hand.x, hand.y]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      data-space-refused=""
      role="status"
      className="pointer-events-none fixed z-[80] w-max max-w-[calc(100vw-16px)] rounded-md px-2 py-1 text-plain font-medium shadow-lg"
      style={{ left: place?.left ?? hand.x + 14, top: place?.top ?? hand.y + 14, visibility: place ? "visible" : "hidden", ...REFUSED_LOOK }}
    >
      {REFUSED_WORDS}
    </div>,
    document.body,
  );
}

function SpaceMark({ space, zoom }: { space: Space; zoom: number }) {
  const box = spaceBox(space);
  const pad = HALO;
  // The boundary in the host's own pixels, once.
  const local = React.useMemo<SketchPoint[]>(() => space.boundary.map(([x, y]) => [x - box.x + pad, y - box.y + pad]), [space.boundary, box.x, box.y, pad]);
  const [mx, my] = React.useMemo(() => centroid(local), [local]);
  const made = isMade(space);
  const form = space.form?.p ?? 1;
  /*
   * The forming is shown until what is shown has caught up with the work,
   * not until the work is over: the last jobs land in a moment on a fast
   * road, and the driver goes to one, and the sheen closing in from the
   * line would never be seen. So the mark stays forming until the drawn
   * value has eased all the way, and only then is the surface simply there.
   */
  const [settled, setSettled] = React.useState(!space.form || form >= 1);
  React.useEffect(() => { if (space.form && form < 1) setSettled(false); }, [space.form, form]);
  return (
    <div
      data-space={space.id}
      data-space-made={made ? "" : undefined}
      data-space-form={space.form ? String(Math.round(form * 100) / 100) : undefined}
      className="pointer-events-none absolute"
      style={{
        left: box.x - pad,
        top: box.y - pad,
        width: box.w + pad * 2,
        height: box.h + pad * 2,
        /*
         * Forming on the timeline's own driver, not a second one: the
         * boundary and its edge arrive first and the middle fills after
         * (`formation.ts`, `FORM`). Euler owns that sequence on the cards,
         * so these are their numbers, read rather than reinvented.
         */
        ...(space.form && form < 1 ? (formVars(form) as React.CSSProperties) : {}),
      }}
    >
      <Hole space={space} local={local} pad={pad} box={box} zoom={zoom} form={space.form ? form : 1} />
      {space.form && !settled ? <Forming local={local} at={form} zoom={zoom} onDone={() => setSettled(true)} /> : null}
      <FillKey space={space} zoom={zoom} at={[mx, my]} />
      {made ? <SurfaceHandles space={space} zoom={zoom} pad={pad} box={box} /> : null}
    </div>
  );
}

/**
 * The surface forming, on the timeline's own driver, so it can be watched.
 *
 * The same bands a card forms in (`FORM`), read with the same `within`,
 * drawn on a boundary rather than a box: while the vine arrives nothing
 * shows but the hole; then the rim is traced round the line; then a sheen
 * closes in from the line to the middle of the area, which is the
 * boundary first and the middle filling after; then the sheen becomes the
 * surface and fades as the parts land. The driver's value steps as the
 * jobs step, so what is shown eases toward it rather than jumping, and a
 * person sees it move.
 */
/** How fast the shown forming may move, in whole surfaces a second: about three seconds from nothing to made. */
const FORM_PACE = 0.34;

function Forming({ local, at, zoom, onDone }: { local: SketchPoint[]; at: number; zoom: number; onDone: () => void }) {
  const [shown, setShown] = React.useState(Math.min(at, QUEUED));
  const done = React.useRef(onDone);
  done.current = onDone;
  React.useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's stamp can precede the clock read when the loop began: never a step backwards.
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      setShown((v) => {
        if (v >= at) return v;
        // No faster than a pace a person can follow: the whole way in three seconds.
        const next = Math.min(at, v + dt * FORM_PACE);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [at]);
  React.useEffect(() => { if (at >= 1 && shown >= 1) done.current(); }, [at, shown]);
  const p = shown;
  const rim = within(p, "rim");
  const close = within(p, "close");
  const surface = within(p, "surface");
  const core = within(p, "core");
  const outline = React.useMemo(() => boundaryPath(local), [local]);
  // The sheen: the area between the line and the line shrunk toward the middle.
  const inner = close > 0 ? boundaryPath(grownBoundary(local, 1 - close)) : null;
  const stage = stageOf(p);
  return (
    <svg data-space-forming={stage} data-space-form-shown={String(Math.round(p * 100) / 100)} className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} aria-hidden>
      {/* The rim, traced round the line as the work reaches it: in the
          process's own red, because the ring under it is already lit and a
          trace in the ring's colour is a trace nobody sees. */}
      {rim > 0 && close < 1 ? (
        <path d={outline} fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - rim} stroke={PROCESS.open} strokeWidth={3 / zoom} strokeLinecap="round" opacity={1 - close} />
      ) : null}
      {/* The green closing in from the line to the middle, the cards' own
          word for the work arriving, then thinning to the surface. */}
      {inner ? (
        <path d={`${outline} ${inner}`} fillRule="evenodd" fill={PROCESS.done} opacity={0.28 * (1 - surface) + 0.08 * surface * (1 - core)} />
      ) : null}
    </svg>
  );
}

/**
 * The one key an empty hole carries: the way to its own panel.
 *
 * A hole with something in it is steered through that thing — pick it and
 * its panel opens. A hole with nothing in it had no way in at all, which
 * is where a recreation from a real site would land, so the space had to
 * be reachable as itself. One key, at the middle of the area, and only
 * while the hole is both open and empty.
 */
function FillKey({ space, zoom, at }: { space: Space; zoom: number; at: [number, number] }) {
  const nodes = useStudio(useShallow(pageNodes));
  const picked = useStudio((s) => s.selection.includes(space.id));
  const [open, setOpen] = React.useState(() => consumed(space, Date.now()) >= 1);
  /* The eraser goes through the key to the space under it: a hand erasing
     a box presses the middle of it as often as its line, and the middle
     of an empty hole is where this key sits. */
  const erasing = useStudio((s) => s.tool === "erase");
  React.useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setOpen(true), Math.max(0, CONSUME_MS - (Date.now() - (space.since ?? 0))) + 60);
    return () => clearTimeout(t);
  }, [open, space.since]);
  if (!open || picked || made_(space)) return null;
  if (nodes.some((n) => nodeInSpace(space, n))) return null;
  return (
    <button
      type="button"
      data-space-fill={space.id}
      title="What this space is for, and how to fill it"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); play("select"); useStudio.getState().setSelection([space.id]); }}
      className={cn("tactile absolute z-30 flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-small font-medium shadow-sm", erasing ? "pointer-events-none" : "pointer-events-auto")}
      style={{
        left: at[0], top: at[1],
        transform: `translate(-50%, -50%) scale(${Math.max(1, 1 / zoom)})`,
        borderColor: "oklch(0.86 0.16 72 / 0.7)", background: "oklch(0.09 0.02 290 / 0.9)", color: "oklch(0.95 0.08 80)",
      }}
    >
      <Sparkles className="size-3" />
      This space
    </button>
  );
}

/**
 * The hole: the ground cut to the growing edge, and the horizon painted
 * along it on a canvas over the ground.
 *
 * One loop per hole while it is consuming, so the growth is smooth, and one
 * paint when it is open. The ground's own clip is the whole boundary and
 * never changes, so the weather is generated once; the growth is a second
 * clip on the wrapper, written straight to the element.
 */
/**
 * How much of the opening is the ring going round the line, and how much is
 * the middle filling in behind it. His order: the ring first, closed, and
 * only then the centre.
 */
const TRACE = 0.55;

function Hole({ space, local, pad, box, zoom, form }: { space: Space; local: SketchPoint[]; pad: number; box: { w: number; h: number }; zoom: number; form: number }) {
  const host = React.useRef<HTMLDivElement>(null);
  const clouds = React.useRef<HTMLDivElement>(null);
  const embers = React.useRef<HTMLCanvasElement>(null);
  const grow = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = React.useState(() => consumed(space, Date.now()) >= 1);
  // The boundary in the ground's own pixels: the host sits `pad` in from the mark.
  const inBox = React.useMemo<SketchPoint[]>(() => local.map(([x, y]) => [x - pad, y - pad]), [local, pad]);
  const clip = React.useMemo(() => `path("${boundaryPath(inBox)}")`, [inBox]);
  useGround(host, clouds, embers, { dim: 0.7, clip });

  const w = box.w + pad * 2;
  const h = box.h + pad * 2;

  /*
   * The zoom settled, not the zoom: the ring is a hair on the screen at
   * any zoom, so it is repainted when the zoom stops changing, and not on
   * every wheel tick of the way there.
   */
  const [zoomSettled, setZoomSettled] = React.useState(zoom);
  React.useEffect(() => {
    const t = setTimeout(() => setZoomSettled(zoom), 160);
    return () => clearTimeout(t);
  }, [zoom]);

  React.useEffect(() => {
    let raf = 0;
    /*
     * Painted every frame while it is consuming, so the growth is smooth,
     * and once when it is open, then left. It was repainted thirty times a
     * second for ever for a breathing nobody could see, and five open holes
     * put the board at six frames a second; nothing in the light moves now,
     * so nothing is repainted until the line, the size or the zoom changes.
     */
    const paint = () => {
      const p = consumed(space, Date.now());
      if (p < 1) raf = requestAnimationFrame(paint);
      if (document.hidden && p < 1) return;
      const el = canvas.current;
      const c = el?.getContext("2d");
      if (!el || !c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      /*
       * A PORTAL: the ring goes round the line he drew, and then the middle
       * forms inside it.
       *
       * HIS WORDS: "the black hole should animate like a dr strange portal
       * tracing the outline as i drew it with the ring and then the center
       * forms, remove the blac edges on the inside."
       *
       * It used to grow its whole edge out of the middle of the area, so the
       * ring was complete from the first frame at a small size and swelled
       * outward — measured, no light at all where his hand started until the
       * edge got there, which is the opposite of tracing. Two phases now, in
       * his order: the ring is laid along the REAL line, from his first point
       * round to his last, and only when it has closed does the ground start
       * to fill the middle.
       */
      const t = Math.min(1, p / TRACE);
      const fill = p <= TRACE ? 0 : (p - TRACE) / (1 - TRACE);
      // The page layer is scaled by the zoom, so a one-pixel ring is drawn 1/zoom wide to land as one pixel.
      const hair = Math.max(1, 1 / zoomSettled);

      /* Nothing inside until the ring is closed; then the middle grows out to
         meet it, which is the half of the old animation that was right. */
      if (grow.current) {
        grow.current.style.clipPath = fill <= 0
          ? 'path("M 0 0 Z")'
          : fill >= 1
            ? "none"
            : `path("${boundaryPath(grownBoundary(local, 0.04 + 0.96 * fill).map(([x, y]) => [x - pad, y - pad]))}")`;
      }

      /* No shadow inside the line, at any stage: the surface used to fall to
         black as it neared the horizon — measured at 98% coverage right at
         the line — and that is the black edge he asked to have taken off. */
      if (t < 1) paintRingAlong(c, { path: local, hair, upTo: t });
      else paintHoleAlong(c, { path: local, hair });
      if (p >= 1) setOpen((o) => o || true);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [space, local, pad, w, h, zoomSettled]);

  return (
    <>
      {/* The ground, cut to the line, and to the growing edge while it is consuming. */}
      <div ref={grow} className="absolute" style={{ left: pad, top: pad, width: box.w, height: box.h }}>
        <div ref={host} data-space-ground="" className="absolute inset-0">
          <div ref={clouds} data-ground-clouds="" className="absolute inset-0" />
          <canvas ref={embers} data-ground-sparks="" className="absolute left-0 top-0" />
        </div>
      </div>
      {/* The horizon: the shadow inside the line and the light outside it. */}
      <canvas
        ref={canvas}
        data-space-horizon=""
        data-space-open={open ? "" : undefined}
        aria-hidden
        className="absolute left-0 top-0"
        style={{ width: w, height: h }}
      />
    </>
  );
}

/**
 * The surfaces being made, formed from the work.
 *
 * One watcher for all of them, on the queue: a surface is as far along as
 * the jobs that belong to it (`formFromJobs`), which is what euler's cards
 * do, on euler's own numbers. When the last job a surface started is over,
 * the layout is locked from where its parts landed, and the form completes.
 * Nothing renders; it writes the store and the marks draw from it.
 */
export function SpaceForming() {
  const queue = useStudio((s) => s.queue);
  const spaces = useStudio(useShallow(pageSpaces));
  React.useEffect(() => {
    for (const sp of spaces) {
      if (!sp.form || sp.form.p >= 1) continue;
      const jobs = jobsInSpace(queue, sp);
      const over = jobs.length > 0 && jobs.every((j) => j.status === "done" || j.status === "failed");
      if (over) { lockNow(sp.id); continue; }
      useStudio.getState().formSpace(sp.id, formFromJobs(jobs, QUEUED, progressOf));
    }
  }, [queue, spaces]);
  return null;
}

/**
 * A made surface can be moved and resized as one thing.
 *
 * The rim carries a grip and the bottom-right corner a handle, both in this
 * layer, so the board's own drag never has to know about spaces. What they
 * write is `resizeSpace`, which carries every locked element with the
 * boundary: that is what locked means.
 */
function SurfaceHandles({ space, zoom, pad, box }: { space: Space; zoom: number; pad: number; box: { x: number; y: number; w: number; h: number } }) {
  const start = React.useRef<{ x: number; y: number; box: { x: number; y: number; w: number; h: number }; mode: "move" | "size" } | null>(null);
  const begin = (mode: "move" | "size") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, box, mode };
    // Taking hold of the surface picks it, so its panel (Make it again, the
    // order) is a press away after a part in it was picked: a made space
    // has no fill and no key, and nothing else on the board picked it.
    useStudio.getState().setSelection([space.id]);
  };
  const move = (e: React.PointerEvent) => {
    const st = start.current;
    if (!st) return;
    const dx = (e.clientX - st.x) / zoom;
    const dy = (e.clientY - st.y) / zoom;
    const next = st.mode === "move"
      ? { ...st.box, x: st.box.x + dx, y: st.box.y + dy }
      : { ...st.box, w: Math.max(40, st.box.w + dx), h: Math.max(40, st.box.h + dy) };
    useStudio.getState().resizeSpace(space.id, next);
  };
  const end = () => { start.current = null; };
  const counter = Math.max(1, 1 / zoom);
  return (
    <>
      <button
        type="button"
        data-space-grip={space.id}
        title="Move the surface, and everything in it"
        onPointerDown={begin("move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="tactile pointer-events-auto absolute z-30 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-fine font-medium"
        style={{
          left: pad, top: pad - 8, transform: `translateY(-100%) scale(${counter})`, transformOrigin: "0 100%",
          borderColor: "oklch(0.86 0.16 72 / 0.6)", background: "oklch(0.09 0.02 290 / 0.9)", color: "oklch(0.95 0.08 80)", cursor: "grab",
        }}
      >
        <Move className="size-2.5" />
        {space.label.trim() || "Surface"}
      </button>
      <span
        data-space-size={space.id}
        title="Resize the surface; what is in it keeps its proportions"
        onPointerDown={begin("size")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="pointer-events-auto absolute z-30 block rounded-sm"
        style={{
          left: pad + box.w - 5, top: pad + box.h - 5, width: 10 / zoom, height: 10 / zoom,
          background: "oklch(0.86 0.16 72)", boxShadow: "0 0 0 1.5px oklch(0.06 0.01 290)", cursor: "nwse-resize",
        }}
      />
    </>
  );
}

/**
 * The right-side panel for the one part picked inside an open hole.
 *
 * Mounted at the board's edge rather than in the chrome: the panel belongs
 * to the space the part landed in, and the column on the left stays what it
 * is. Nothing when nothing inside a hole is picked.
 */
export function SpaceSide() {
  const selection = useStudio((s) => s.selection);
  const nodes = useStudio(useShallow(pageNodes));
  const spaces = useStudio(useShallow(pageSpaces));
  // Time is read when the selection or the spaces change, not on a clock:
  // a hole that is still consuming is not a place yet, and the frame after
  // it opens the selection is re-read by the first press inside it.
  const now = Date.now();
  const picked = selection.length === 1 ? nodes.find((n) => n.id === selection[0]) : undefined;
  const space = picked ? spaceOf(spaces, picked, now) : null;
  // A space picked as itself: an empty hole, steered before anything is in it.
  const own = !picked && selection.length === 1 ? spaces.find((sp) => sp.id === selection[0]) : undefined;
  // A drawing picked inside a space: its own words, before it is made.
  const shapes = useStudio(useShallow(pageShapes));
  const pageId = useStudio((s) => s.activePageId);
  const ink = !picked && !own && selection.length === 1 ? shapes.find((sh) => sh.id === selection[0] && sh.kind === "pen") : undefined;
  const inkGroup = ink ? groupOfStroke(inkGroups(shapes.filter((sh) => sh.kind === "pen")), ink.id) : null;
  const inkSpace = ink && inkGroup ? spaceOfDrawing(spaces, { pageId, bounds: inkGroup.bounds }, now) : null;
  if ((!picked || !space) && !own && !(ink && inkSpace)) return null;
  return (
    <aside
      data-space-panel={picked?.id ?? own?.id ?? ink!.id}
      className="absolute bottom-3 right-3 top-3 z-30 flex w-[248px] flex-col overflow-hidden rounded-lg"
      style={{ background: VOID.face, border: `1px solid ${VOID.rim}`, boxShadow: VOID.drop, color: VOID.text }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {picked && space
        ? <SpacePanel node={picked} space={space} />
        : own
          ? <SpaceOwnPanel space={own} />
          : <SpaceInkPanel shape={ink!} space={inkSpace!} strokeIds={inkGroup!.strokeIds} />}
    </aside>
  );
}
