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
import { Eraser, LoaderCircle, Magnet, PenLine, Sparkles, Spline, Undo2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { Input } from "@/core/ui/input";
import { useSetting } from "@/core/settings/useSetting";
import { FEATURES, getFeature } from "./catalog";
import { BOARD_R } from "./menuGeometry";
import { CONSOLE, HoverTray } from "./RingConsole";
import { describeSketch, fitToSketch, isBlankSketch, readBoundary, refineStroke, tidyStroke, type DrawMode, type Sketch, type SketchPoint } from "./sketch";
import { keyHeader, noKeyMessage } from "./agent";
import { checkAnswer, clamp, type KindInfo, type ReshapePatch } from "./reshape";
import { useStudio, type StudioNode } from "./store";

/** The blue the wheel's first level wears; the strokes are drawn in it. */
const INK_HUE = 205;
/** How far under the disc's edge the tray hangs. */
const TRAY_DROP = 22;
/** How often the void moves. Slow enough to be nothing, often enough to be smooth. */
const DRIFT_MS = 110;

/** The catalog as the answer check reads it: the entry without its icon. */
const kindInfo = (id: string): KindInfo | null => {
  const f = getFeature(id);
  if (!f) return null;
  return {
    id: f.id, name: f.name, w: f.w ?? 132, h: f.h ?? 76,
    options: (f.options ?? []).map((o) => ({ id: o.id, values: o.values, kind: o.kind, range: o.range ? { min: o.range.min, max: o.range.max } : undefined })),
  };
};

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
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
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
    paintSpace(c, size, (performance.now() - born.current) / 1000);
    for (const s of strokes) paintStroke(c, s, size);
    if (live.current) paintStroke(c, live.current, size);
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
    if (e.button !== 0 || busy) return;
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

  const makeReal = async () => {
    if (blank || busy) return;
    const drawn = sketch();
    setBusy(true);
    setNote(null);
    play("confirm");
    const s = useStudio.getState();
    const feature = node ? getFeature(node.featureId) : null;
    try {
      const res = await fetch("/api/studio/reshape", {
        method: "POST",
        headers: { "content-type": "application/json", ...keyHeader() },
        body: JSON.stringify({
          sketch: drawn,
          picture: pictureOf(drawn.strokes),
          frameWidth,
          node: node
            ? {
                featureId: node.featureId,
                feature: feature?.name ?? node.label,
                label: node.label,
                w: node.w,
                h: node.h,
                prompt: node.prompt,
                content: node.content,
                data: node.data,
                options: node.options,
                optionsAllowed: (feature?.options ?? []).map((o) => ({
                  id: o.id, label: o.label, kind: o.kind ?? "one",
                  // A range has no list of values to offer: it has two ends.
                  values: o.kind === "range" && o.range ? [`${o.range.min}\u2013${o.range.max}${o.range.unit ?? ""}`] : o.values,
                })),
                contentLabel: feature?.content?.label ?? null,
              }
            : null,
          candidates: FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category, w: f.w, h: f.h, blurb: f.blurb })),
        }),
      });
      const data = (await res.json()) as { ok: boolean; patch?: ReshapePatch; message?: string; reason?: string; usage?: { model?: string } };
      if (data.ok && data.patch) {
        const made = apply(data.patch, drawn);
        // A drawing read is an API call that landed, so it is a thread too:
        // the words that went with the drawing, the note that came back, and
        // what it did to the part.
        s.landThread({
          mode: "drawing",
          model: data.usage?.model,
          ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
          answer: data.patch.note ?? "",
          changes: [`${node ? "reshaped" : "drew"} ${made.label} at ${made.w} × ${made.h}`, ...(made.kindChanged ? [`now a ${made.kind}`] : [])],
        });
        ctx.publish({
          key: `studio:reshape:${made.id}`,
          title: node ? `Reshaped ${made.label}` : `Drew ${made.label}`,
          body: [
            `${made.w} × ${made.h}`,
            made.kindChanged ? `now ${made.kind}` : null,
            made.reproportioned ? "held to the drawing's proportion" : null,
            data.patch.note,
          ].filter(Boolean).join(" · "),
          level: "success",
          source: "studio",
          toast: true,
        });
        onDone();
        return;
      }
      // No key, a refusal, a bad reply: the drawing still shapes the part.
      const made = applyProportion(drawn);
      if (data.reason === "no-key") ctx.openPanel("keys");
      ctx.publish({
        key: `studio:reshape:${made.id}`,
        title: node ? `Reshaped ${made.label} from the drawing` : `Drew ${made.label} from the drawing`,
        body:
          data.reason === "no-key"
            ? noKeyMessage("For now the part took the drawing's proportion and the drawing went into the blueprint.")
            : data.message ?? "Claude couldn't read it, so the part took the drawing's proportion.",
        level: "warn",
        source: "studio",
        toast: true,
      });
      onDone();
    } catch (err) {
      // The request itself failed. Keep the drawing on the part and stay.
      if (node) s.updateNode(node.id, { sketch: drawn });
      setNote(err instanceof Error ? err.message : "Couldn't reach the reshape route.");
      play("deny");
    } finally {
      setBusy(false);
    }
  };

  /** Claude answered: hold every field to the catalog, the frame and the drawing (`reshape.ts`), then apply it. */
  const apply = (patch: ReshapePatch, drawn: Sketch) => {
    const s = useStudio.getState();
    // The proportion held is the boundary's: the outline the author drew round
    // the part, not the box round every mark that fell outside it.
    const made = checkAnswer({ patch, node, drawn, aspect: readBoundary(drawn)?.aspect ?? 1, frameWidth, kind: kindInfo });
    const { featureId, label, w, h, options, kindChanged, reproportioned } = made;
    const shared: Partial<StudioNode> = {
      featureId,
      label,
      w,
      h,
      options,
      sketch: drawn,
      ...(made.content != null ? { content: made.content } : {}),
      ...(made.prompt != null ? { prompt: made.prompt } : {}),
      // A part that became another kind is a custom idea exactly when `addNode` would say so.
      ...(kindChanged ? { custom: made.custom } : {}),
    };
    const kind = getFeature(featureId)?.name ?? label;
    if (node) {
      s.updateNode(node.id, { ...shared, x: clamp(node.x, 0, Math.max(0, frameWidth - w)) });
      return { id: node.id, label, w, h, kind, kindChanged, reproportioned };
    }
    const where = at ?? { x: frameWidth / 2, y: 200 };
    const id = s.addNode(featureId, clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w)), Math.max(0, where.y - h / 2), shared);
    return { id, label, w, h, kind, kindChanged, reproportioned };
  };

  /** No reader: the drawing's proportion is the reshape, and the drawing is kept. */
  const applyProportion = (drawn: Sketch) => {
    const s = useStudio.getState();
    if (node) {
      const { w, h } = fitToSketch(drawn, node.w, node.h, frameWidth);
      s.updateNode(node.id, { w, h, sketch: drawn, x: clamp(node.x, 0, Math.max(0, frameWidth - w)) });
      return { id: node.id, label: node.label, w, h };
    }
    // A new part with nothing to keep the area of: the board is read as the
    // page, so a boundary across a third of it is a part across a third of
    // the frame.
    const b = readBoundary(drawn);
    const w = clamp(Math.round((b?.box.w ?? 0.3) * frameWidth), 80, frameWidth);
    const h = clamp(Math.round(w / (b?.aspect ?? 1)), 24, 1600);
    const label = text(drawn.words, 40) || "Drawn part";
    const where = at ?? { x: frameWidth / 2, y: 200 };
    const id = s.addNode("custom-idea", clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w)), Math.max(0, where.y - h / 2), {
      w, h, label, prompt: drawn.words, sketch: drawn,
    });
    return { id, label, w, h };
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
          cursor: busy ? "progress" : "crosshair",
          // The horizon: a black hole's ring, small and dim. A hair of
          // orange-red right at the edge, and past it the same light spread
          // thin and thinner, gone within a few tens of pixels. No lit rim,
          // no dark bands: the disc is the hole and the glow is the only
          // thing that says where it ends.
          boxShadow: [
            "0 0 0 1px oklch(0.58 0.17 38 / 0.55)",
            "0 0 5px 1.5px oklch(0.62 0.19 35 / 0.32)",
            "0 0 16px 5px oklch(0.52 0.17 30 / 0.2)",
            "0 0 36px 12px oklch(0.42 0.14 26 / 0.12)",
            "0 12px 40px oklch(0 0 0 / 0.45)",
          ].join(", "),
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
          disabled={busy}
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
        lit={!blank && !busy}
        icon={busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        label={blank ? "Draw something first" : "Make real"}
        items={[
          { id: "make", label: busy ? "Making…" : "Make real", icon: busy ? <LoaderCircle className="size-3 animate-spin" /> : <Sparkles className="size-3" />, primary: true, disabled: blank || busy, onClick: () => void makeReal() },
          { id: "clear", label: "Clear the board", icon: <Eraser className="size-3" />, disabled: !strokes.length || busy, onClick: clear },
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

/**
 * The void, at a moment `t` seconds after the board opened.
 *
 * A dark purple-blue over the whole face; under it, four wide clouds of
 * slightly different dark violets and blues, each on its own very slow orbit
 * — the fastest takes about a minute and a half to go round — so the surface
 * moves the way deep water does, without ever being seen to move. No stars:
 * a scatter of points on a drawing surface is a scatter of things to draw
 * round. One warm point at the middle, small and bright, in a little glow
 * that breathes over half a minute — the one place to start from. And the
 * edge is dark: the last sixth of the radius falls off to near black, so
 * the disc reads as a hole in the screen rather than a plate on it.
 */
function paintSpace(c: CanvasRenderingContext2D, size: number, t: number) {
  const r = size / 2;
  c.clearRect(0, 0, size, size);
  c.save();
  c.beginPath();
  c.arc(r, r, r, 0, Math.PI * 2);
  c.clip();

  // The ground.
  const ground = c.createRadialGradient(r, r, r * 0.05, r, r, r);
  ground.addColorStop(0, "oklch(0.19 0.05 288)");
  ground.addColorStop(0.55, "oklch(0.155 0.045 290)");
  ground.addColorStop(1, "oklch(0.12 0.04 292)");
  c.fillStyle = ground;
  c.fillRect(0, 0, size, size);

  // The dark matter: four clouds on slow orbits.
  const cloud = (cx: number, cy: number, rad: number, colour: string) => {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, colour);
    g.addColorStop(0.55, colour.replace(/\/ [\d.]+\)$/, "/ 0.1)"));
    g.addColorStop(1, "oklch(0 0 0 / 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  };
  const TAU = Math.PI * 2;
  const clouds: [number, number, number, number, number, string][] = [
    // [orbit centre x, y, orbit radius, period in seconds, phase, colour]
    [0.62, 0.38, 0.22, 96, 0.0, "oklch(0.3 0.1 300 / 0.3)"],
    [0.36, 0.66, 0.2, 128, 0.35, "oklch(0.27 0.09 262 / 0.28)"],
    [0.5, 0.5, 0.3, 160, 0.7, "oklch(0.22 0.07 320 / 0.26)"],
    [0.7, 0.72, 0.16, 110, 0.15, "oklch(0.28 0.08 240 / 0.22)"],
  ];
  for (const [ox, oy, orbit, period, phase, colour] of clouds) {
    const a = (t / period + phase) * TAU;
    cloud(size * (ox + Math.cos(a) * orbit * 0.5), size * (oy + Math.sin(a) * orbit * 0.35), r * 0.85, colour);
  }

  // The middle: one warm point in a little glow that breathes.
  {
    const breath = 0.8 + 0.2 * Math.sin((t / 32) * TAU);
    const glow = c.createRadialGradient(r, r, 0, r, r, 8);
    glow.addColorStop(0, `oklch(0.85 0.16 70 / ${(0.45 * breath).toFixed(2)})`);
    glow.addColorStop(1, "oklch(0.85 0.16 70 / 0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(r, r, 8, 0, TAU);
    c.fill();
    c.fillStyle = `oklch(0.9 0.15 70 / ${(0.7 + 0.3 * breath).toFixed(2)})`;
    c.beginPath();
    c.arc(r, r, 1.4, 0, TAU);
    c.fill();
  }

  // The horizon: the edge falls off to near black.
  const edge = c.createRadialGradient(r, r, r * 0.8, r, r, r);
  edge.addColorStop(0, "oklch(0 0 0 / 0)");
  edge.addColorStop(0.7, "oklch(0.03 0.015 290 / 0.45)");
  edge.addColorStop(1, "oklch(0.02 0.01 290 / 0.85)");
  c.fillStyle = edge;
  c.fillRect(0, 0, size, size);
  c.restore();
}

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

/**
 * The drawing as a picture for the reader: black lines on white, small.
 * Cleaner to read than the starry board, and a few kilobytes.
 */
function pictureOf(strokes: SketchPoint[][], px = 384): string | null {
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = px;
  el.height = px;
  const c = el.getContext("2d");
  if (!c) return null;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, px, px);
  c.strokeStyle = "#111111";
  c.lineWidth = 4;
  c.lineCap = "round";
  c.lineJoin = "round";
  // The board's edge, faintly, so a shape's place on the disc can be read.
  c.save();
  c.strokeStyle = "#d0d0d0";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  for (const s of strokes) {
    if (!s.length) continue;
    c.beginPath();
    c.moveTo(s[0]![0] * px, s[0]![1] * px);
    if (s.length === 1) c.lineTo(s[0]![0] * px + 0.01, s[0]![1] * px);
    for (let i = 1; i < s.length; i++) c.lineTo(s[i]![0] * px, s[i]![1] * px);
    c.stroke();
  }
  try {
    return el.toDataURL("image/png").split(",")[1] ?? null;
  } catch {
    return null;
  }
}

/** A trimmed string of at most `max` characters, or nothing. */
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
