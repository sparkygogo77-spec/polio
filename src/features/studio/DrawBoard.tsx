"use client";
/**
 * The drawing board: one dark disc over the whole part menu.
 *
 * Press Draw and the wheel is gone. In its place is a disc the size of the
 * whole menu, dark like empty space, with no hole in the middle — every
 * pixel of it is drawing surface, and the middle is where a shape naturally
 * starts. Draw the shape the part should be; add a few words under it if the
 * drawing alone would not say; press **Make real** and the drawing is read
 * and the part is reshaped to it — or, from the board's own menu, a new part
 * is made in that shape.
 *
 * Reading the drawing is Claude's job (`/api/studio/reshape`): it sees a
 * picture of the strokes and the numbers behind them, the part as it is now,
 * the whole library, and the words, and answers with what the part should
 * become — size, kind, contents, options. The lines drawn are the part's
 * barriers and its boundary: the outline is where the part ends, the part
 * fills it, nothing crosses it, and its proportion is the part's. Without a
 * key the board still works honestly: the part takes the boundary's
 * proportion (the one thing a drawing says without being read), the drawing
 * is kept on the part, and the
 * blueprint writes it out in words, so the shape reaches whoever builds the
 * site either way. A drawing is never lost to a missing key.
 *
 * The disc is the void: a dark purple-blue with something slower than
 * weather moving under it, and one warm point at the middle to start from.
 * Its edge is a black hole's: a hair of dim orange-red light right at the
 * rim, spreading thin for a few tens of pixels and gone — no lit line, no
 * caption, nothing that says "board". Nothing sits on its face but the way
 * back, on the rim, and the words in a thin strip in the bottom cap. Make
 * real and the eraser are in a tray under the disc that opens when the hand
 * goes to it, the same tray the wheel has.
 */
import * as React from "react";
import { Eraser, Magnet, PenLine, Sparkles, Spline, Undo2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { Input } from "@/core/ui/input";
import { useSetting } from "@/core/settings/useSetting";
import { BOARD_R } from "./menuGeometry";
import { CONSOLE, HoverTray } from "./RingConsole";
import { DRIFT_MS as GROUND_MS, paintDarkMatter, resizeField, sparkField, type SparkField } from "./darkMatter";
import { HALO, paintBlackHole, paintHorizonShadow } from "./blackHole";
import { describeSketch, isBlankSketch, refineStroke, tidyStroke, type DrawMode, type Sketch, type SketchPoint } from "./sketch";
import { pictureOf } from "./reshapeRun";
import { useStudio, type StudioNode } from "./store";

/** The blue the wheel's first level wears; the strokes are drawn in it. */
const INK_HUE = 205;
/** How far under the disc's edge the tray hangs. */
const TRAY_DROP = 22;
/** How often the ground moves: the same clock the add disc's own weather keeps. */
const DRIFT_MS = GROUND_MS;

export interface DrawBoardProps {
  /** The part being reshaped, or null when the board is drawing a new one. */
  node: StudioNode | null;
  /** Where a new part lands, in canvas space. Only read when there is no part. */
  at: { x: number; y: number } | null;
  /** Leave the board: back to the wheel's first level, or away entirely. */
  onBack: () => void;
  /** The drawing has been made real; the menu can go. */
  onDone: () => void;
}

export function DrawBoard({ node, at, onBack, onDone }: DrawBoardProps) {
  const ctx = useActions();
  const frameWidth = useStudio((s) => s.frameWidth);
  const [strokes, setStrokes] = React.useState<SketchPoint[][]>(() => node?.sketch?.strokes ?? []);
  const [words, setWords] = React.useState(() => node?.sketch?.words ?? "");
  // Snap, smooth or raw: a setting, so the board remembers, and a switch on the rim, so it is one press away.
  const [drawMode, setDrawMode] = useSetting<DrawMode>("studio.drawMode");
  const [read, setRead] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const halo = React.useRef<HTMLCanvasElement>(null);
  const field = React.useRef<SparkField | null>(null);
  const live = React.useRef<SketchPoint[] | null>(null);
  const frame = React.useRef(0);
  // When the board was opened: the void's clock starts from there.
  const born = React.useRef(0);
  if (!born.current) born.current = typeof performance !== "undefined" ? performance.now() : 0;
  const size = BOARD_R * 2;

  /* ---------------------------------------------------------- painting */
  const paint = React.useCallback(() => {
    frame.current = 0;
    const el = canvas.current;
    const c = el?.getContext("2d");
    if (!el || !c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== size * dpr || el.height !== size * dpr) {
      el.width = size * dpr;
      el.height = size * dpr;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = (performance.now() - born.current) / 1000;
    /*
     * The face is the hub's own ground — the same clouds and embers the add
     * disc opens into (`darkMatter.ts`), the same generator, drawn as a
     * disc. The board and the hole you pull parts out of are one place.
     */
    field.current = field.current && field.current.w === size ? field.current : sparkField("disc", size, size);
    field.current = resizeField(field.current, size, size);
    // A little further off than the add disc's own weather: this is a
    // surface to draw on, and the strokes have to be the brightest thing on
    // it. The clouds still pass and the embers still cross.
    paintDarkMatter(c, { field: field.current, t, vignette: false, dim: 0.7 });
    for (const s of strokes) paintStroke(c, s, size);
    if (live.current) paintStroke(c, live.current, size);
    // The horizon, over everything: the surface falls to black at the rim.
    paintHorizonShadow(c, size);

    // And outside the disc, the light that got away.
    const hl = halo.current;
    const hc = hl?.getContext("2d");
    if (hl && hc) {
      const box = size + HALO * 2;
      if (hl.width !== box * dpr || hl.height !== box * dpr) {
        hl.width = box * dpr;
        hl.height = box * dpr;
      }
      hc.setTransform(dpr, 0, 0, dpr, 0, 0);
      hc.clearRect(0, 0, box, box);
      paintBlackHole(hc, { cx: box / 2, cy: box / 2, r: size / 2, t });
    }
  }, [strokes, size]);

  React.useEffect(paint, [paint]);
  const schedule = () => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  };
  // The void moves on its own, a frame every tenth of a second or so. The
  // latest paint is read through a ref, so the ticker is set up once and
  // never repaints a stale set of strokes.
  const latest = React.useRef(paint);
  latest.current = paint;
  React.useEffect(() => {
    const t = window.setInterval(() => {
      if (document.hidden) return;
      if (!frame.current) frame.current = requestAnimationFrame(() => latest.current());
    }, DRIFT_MS);
    return () => window.clearInterval(t);
  }, []);

  /* ---------------------------------------------------------- drawing */
  const toBoard = (e: React.PointerEvent<HTMLCanvasElement>): SketchPoint => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height)];
  };
  const begin = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = [toBoard(e)];
    schedule();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!live.current) return;
    live.current.push(toBoard(e));
    schedule();
  };
  const end = () => {
    const s = live.current;
    live.current = null;
    if (!s) return;
    const tidy = tidyStroke(s);
    if (!tidy.length) { schedule(); return; }
    const kept = refineStroke(tidy, drawMode ?? "snap");
    setStrokes((prev) => [...prev, kept.points]);
    setRead(kept.kind && kept.kind !== "dot" ? kept.kind : null);
  };
  const clear = () => {
    if (!strokes.length) return;
    play("close");
    setStrokes([]);
    setNote(null);
    setRead(null);
  };

  /* ---------------------------------------------------------- make real */
  const sketch = (): Sketch => ({ strokes, words: words.trim() });
  const blank = isBlankSketch({ strokes, words });

  /*
   * Make real: the drawing goes on the queue and the board closes.
   *
   * It used to hold the board open for the whole call — half a minute of a
   * disc you could not draw on. A drawing is a request, not a modal: the
   * queue runs them one at a time (`DrawQueue`), the counter on the toolbar
   * says how many are on their way, and the board is yours again.
   */
  const makeReal = () => {
    if (blank) return;
    const drawn = sketch();
    play("confirm");
    const label = (drawn.words.trim().slice(0, 40) || (node ? node.label : describeSketch({ strokes: drawn.strokes, words: "" }))) || "a drawing";
    useStudio.getState().enqueueDraw({
      nodeId: node?.id ?? null,
      at,
      frameWidth,
      sketch: drawn,
      picture: pictureOf(drawn.strokes),
      label: node ? `Reshaping ${label}` : `Making ${label}`,
    });
    // The drawing is on the part the moment it is queued, so nothing is lost
    // if the read never comes back and the blueprint has it either way.
    if (node) useStudio.getState().updateNode(node.id, { sketch: drawn });
    ctx.publish({
      key: "studio:queued",
      title: node ? `${node.label} is on the queue` : "The drawing is on the queue",
      body: "The board is yours again; the counter on the toolbar says when it lands.",
      level: "info",
      source: "studio",
      toast: true,
    });
    onDone();
  };

  /* ---------------------------------------------------------- the disc */
  // Where the rim buttons sit: on the circle, half outside it.
  const rimAt = (deg: number, r = BOARD_R): React.CSSProperties => ({
    left: BOARD_R + Math.cos((deg * Math.PI) / 180) * r,
    top: BOARD_R + Math.sin((deg * Math.PI) / 180) * r,
  });

  return (
    <div
      data-draw-board=""
      className="pointer-events-auto absolute"
      style={{ left: -BOARD_R, top: -BOARD_R, width: size, height: size, animation: "el-grow 160ms ease-out" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/*
        The light outside the hole: a wider canvas behind the disc, so the
        photon ring and the beamed disc have somewhere to be. It takes no
        presses — every pixel of the board itself is drawing surface.
      */}
      <canvas
        ref={halo}
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: -HALO, top: -HALO, width: size + HALO * 2, height: size + HALO * 2 }}
      />

      {/* the disc */}
      <canvas
        ref={canvas}
        data-draw-surface=""
        aria-label={node ? `Drawing board for ${node.label}` : "Drawing board for a new part"}
        role="img"
        className="absolute inset-0 touch-none rounded-full"
        style={{
          width: size,
          height: size,
          cursor: "crosshair",
          // The edge is painted, not shadowed: the photon ring, the beamed
          // disc and the bent slivers are all on the canvas behind this one
          // (`blackHole.ts`). All that is left here is what the hole does to
          // the screen behind it.
          boxShadow: "0 18px 60px oklch(0 0 0 / 0.75)",
        }}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      />

      {/* a hint where the first stroke goes, gone once there is one; it sits just under the middle point, not over it */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-[10px] leading-snug transition-opacity"
        style={{ color: "oklch(0.62 0.03 285)", opacity: strokes.length || live.current ? 0 : 1, textShadow: "0 1px 3px oklch(0 0 0 / 0.8)", paddingTop: 44 }}
      >
        <span className="max-w-[150px]">{node ? "Draw the shape it should be" : "Draw the shape of a new part"}</span>
      </div>

      {/* the way back, on the top of the rim */}
      <RimButton at={rimAt(225)} label={node ? "Back to the wheel" : "Close the board"} onClick={() => { play("close"); onBack(); }} testId="draw-back">
        <Undo2 className="size-3.5" />
      </RimButton>

      {/* snap, smooth or raw: three icon keys on the top of the rim, in the void's colours */}
      <div
        data-draw-mode=""
        role="radiogroup"
        aria-label="How strokes are kept"
        className="absolute flex h-[24px] -translate-x-1/2 -translate-y-1/2 items-center gap-[2px] rounded-full p-[2px]"
        style={{ ...rimAt(270), background: CONSOLE.face, border: `1px solid ${CONSOLE.rim}`, boxShadow: "0 0 0 3px oklch(0.05 0.02 290), 0 2px 6px oklch(0 0 0 / 0.6)" }}
      >
        {(
          [
            { id: "snap", icon: <Magnet className="size-3" />, title: "Snap to the shape you nearly drew: lines, boxes, circles, triangles" },
            { id: "smooth", icon: <Spline className="size-3" />, title: "Smooth the line, keep its shape" },
            { id: "raw", icon: <PenLine className="size-3" />, title: "Keep every wobble" },
          ] as { id: DrawMode; icon: React.ReactNode; title: string }[]
        ).map((m) => {
          const on = (drawMode ?? "snap") === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={m.id}
              data-draw-mode-option={m.id}
              title={m.title}
              onClick={() => { play("select"); setDrawMode(m.id); }}
              className="flex size-[18px] items-center justify-center rounded-full outline-none transition-colors"
              style={{ background: on ? `oklch(0.66 0.155 ${INK_HUE})` : "transparent", color: on ? "oklch(0.99 0 0)" : CONSOLE.muted }}
            >
              {m.icon}
            </button>
          );
        })}
      </div>

      {/* the words, in the bottom cap */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: size - 66, width: 178 }}>
        <Input
          inputSize="sm"
          data-draw-words=""
          value={words}
          aria-label="Words to go with the drawing"
          placeholder="Words, if the drawing isn't enough"
          className="h-6 border-[oklch(0.36_0.06_290)] bg-[oklch(0.13_0.03_288/0.85)] text-[10px] text-[oklch(0.92_0.02_285)] placeholder:text-[oklch(0.55_0.03_285)]"
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void makeReal(); }
            // The wheel's own Escape steps back a level; from a text field the
            // first Escape should only leave the field.
            if (e.key === "Escape") { e.stopPropagation(); (e.target as HTMLInputElement).blur(); }
          }}
        />
        {note ? <p className="mt-1 text-center text-[9px]" style={{ color: CONSOLE.on }}>{note}</p> : read ? <p className="mt-1 text-center text-[9px]" style={{ color: CONSOLE.muted }}>snapped to {/^[aeiou]/.test(read) ? "an" : "a"} {read}</p> : null}
      </div>

      {/*
        The tray, under the disc: Make real and the eraser. It is the same
        tab the wheel hangs under itself, in the same place, and it lights
        blue as soon as there is something on the board to make real.
      */}
      <HoverTray
        testId="draw"
        at={[BOARD_R, size + TRAY_DROP]}
        lit={!blank}
        icon={<Sparkles className="size-3.5" />}
        label={blank ? "Draw something first" : "Make real"}
        items={[
          { id: "make", label: "Make real", icon: <Sparkles className="size-3" />, primary: true, disabled: blank, onClick: makeReal },
          { id: "clear", label: "Clear the board", icon: <Eraser className="size-3" />, disabled: !strokes.length, onClick: clear },
        ]}
      />
    </div>
  );
}

/** A small round button straddling the rim, in the void's own colours. The add disc borrows it. */
export function RimButton({ at, label, onClick, disabled, children, testId }: { at: React.CSSProperties; label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      data-draw-button={testId}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="absolute flex size-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none transition-[background,transform] enabled:hover:scale-[1.06] enabled:hover:brightness-125 enabled:active:scale-[0.96] disabled:opacity-50"
      style={{
        ...at,
        background: CONSOLE.face,
        color: CONSOLE.text,
        border: `1px solid ${CONSOLE.rim}`,
        boxShadow: "0 0 0 3px oklch(0.05 0.02 290), 0 2px 6px oklch(0 0 0 / 0.6)",
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Paint                                                               */
/* ------------------------------------------------------------------ */

/** A stroke: a soft blue glow under a thin white line. */
function paintStroke(c: CanvasRenderingContext2D, s: SketchPoint[], size: number) {
  if (!s.length) return;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  const path = () => {
    c.beginPath();
    const [x0, y0] = s[0]!;
    c.moveTo(x0 * size, y0 * size);
    if (s.length === 1) c.lineTo(x0 * size + 0.01, y0 * size);
    for (let i = 1; i < s.length; i++) c.lineTo(s[i]![0] * size, s[i]![1] * size);
  };
  path();
  c.strokeStyle = `oklch(0.78 0.16 ${INK_HUE} / 0.38)`;
  c.lineWidth = 7;
  c.stroke();
  path();
  c.strokeStyle = `oklch(0.97 0.02 ${INK_HUE})`;
  c.lineWidth = 2.4;
  c.stroke();
  c.restore();
}

