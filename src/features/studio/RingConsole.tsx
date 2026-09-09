"use client";
/**
 * Things that sit on a quadrant of the wheel.
 *
 * The editor that opens off a green choice is not a panel: it is the three
 * quadrants the green level is not using, cut with the same `piece()` as the
 * rest of the wheel, each one a slab like Delete. What goes *on* a slab is
 * built from these — chips along an arc, a slider bent round the band, a
 * sector cut out as a button, a word glued to a spot.
 *
 * Everything is drawn in the wheel's own local coordinates inside the same
 * rotated group as the slab, so it moves with the slab, never after it. Words
 * are counter-rotated inside that group so they move rigidly *and* stay
 * upright — a word that trails its button on a turn reads as a bug, and a word
 * bent round a curve reads as a logo.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { play } from "@/core/audio/engine";
import { arcPath, fmt, onCircle, piece, spun, type Pt, type Rings, type Shape } from "./menuGeometry";

export const CONSOLE_HUE = 285;

/**
 * The console's colours: the void.
 *
 * The slabs are the same dark purple-blue as the drawing board's surface —
 * near black, a little violet — with a thin lit rim, the way the first
 * level's pieces have a darker rim round a flat face, only inverted: on
 * something this dark the edge has to be the lighter line. There is no
 * aura; the slab drops straight off into the board. Red is kept for the one
 * thing on a slab that is *on*, and for nothing else. Grey went: a grey slab
 * with red controls read as mud next to the blue and green above it.
 */
export const CONSOLE = {
  face: "oklch(0.2 0.035 288)",
  faceLit: "oklch(0.26 0.045 288)",
  rim: "oklch(0.36 0.06 290)",
  well: "oklch(0.14 0.03 288)",
  /** A small box on a slab — a chip, a key, a tick. */
  box: "oklch(0.27 0.04 286)",
  aura: `oklch(0.64 0.23 ${27})`,
  on: `oklch(0.64 0.23 ${27})`,
  text: "oklch(0.92 0.02 285)",
  ink: "oklch(0.1 0.02 285)",
  muted: "oklch(0.62 0.03 285)",
} as const;

/**
 * What a slab casts: not an aura, a shadow. The slab sits on the board and
 * the board goes darker under its edge, which is what makes it read as a
 * thing with a top rather than a shape with a glow.
 */
export const SLAB_AURA = `drop-shadow(0 3px 5px oklch(0 0 0 / 0.55))`;
/** How much smaller than the green level the console's slabs are cut, per edge. */
export const SHRINK = 5;
/** The small red aura on whichever chip is picked. */
export const PICKED = `0 0 0 2px ${CONSOLE.on}, 0 0 8px 1px oklch(0.64 0.23 27 / 0.7)`;

/**
 * The screen: a small console display set into a slab.
 *
 * Words are typed on a screen, and settings are worked on one: dark teal
 * glass recessed into the slab, scanlines across it, a faint dot matrix
 * under them, a lit bezel, phosphor lettering in a monospaced face. Nothing
 * on it is a control of its own kind — its keys are the same boxes as
 * everywhere else, in the screen's colours; its sliders the same arcs, lit
 * in phosphor. A slab that carries settings is painted as one (`ScreenFace`);
 * the plate the typing happens on is one (`PlateQuad`).
 */
export const SCREEN = {
  glass: "radial-gradient(ellipse at 50% 35%, oklch(0.2 0.05 195) 0%, oklch(0.135 0.04 200) 55%, oklch(0.09 0.03 205) 100%)",
  scan: "repeating-linear-gradient(0deg, oklch(0 0 0 / 0.26) 0 1px, transparent 1px 3px)",
  dots: "radial-gradient(circle, oklch(0.62 0.1 190 / 0.09) 0.55px, transparent 0.65px)",
  key: "oklch(0.2 0.045 200)",
  line: "oklch(0.36 0.07 195)",
  ink: "oklch(0.88 0.09 175)",
  dim: "oklch(0.6 0.06 180)",
} as const;
/** A key on the screen: the same box as everywhere else, in the screen's colours. */
export const SCREEN_KEY: React.CSSProperties = { background: SCREEN.key, color: SCREEN.ink };
/** A slider's phosphor: dim at one end, lit at the other. */
export const phosphorAt = (f: number) => `oklch(${(0.3 + f * 0.44).toFixed(3)} ${(0.05 + f * 0.06).toFixed(3)} 180)`;

/**
 * A shade either way, never a bevel — the amount the reader asked for. Which
 * way it leans depends on the family, because the same pair of white and black
 * lines reads differently against a warm face and a cool one.
 */
export function litEdge(hue: number, strong = false): string {
  const warm = hue < 60 || hue > 320;
  const green = hue > 100 && hue < 190;
  const top = green ? 0.34 : warm ? 0.2 : 0.22;
  const bottom = green ? 0.16 : warm ? 0.3 : 0.28;
  const k = strong ? 1.35 : 1;
  return [
    `inset 0 1px 0 oklch(1 0 0 / ${(top * k).toFixed(3)})`,
    `inset 0 -1px 0 oklch(0 0 0 / ${(bottom * k).toFixed(3)})`,
    `inset 1px 0 0 oklch(1 0 0 / ${(top * k * 0.35).toFixed(3)})`,
    `inset -1px 0 0 oklch(0 0 0 / ${(bottom * k * 0.4).toFixed(3)})`,
  ].join(", ");
}

/** One quadrant the console has been given, and the wheel it sits on. */
export interface Slab {
  from: number;
  to: number;
  rings: Rings;
  shape: Shape;
  spin: number;
}

/**
 * Something upright at a point on the wheel, moving rigidly with it.
 *
 * A `foreignObject` inside the rotated group, with its contents turned back by
 * the same amount. Positioned HTML with a transition on `left`/`top` is what
 * made every word trail its button round a turn.
 */
export function Glued({
  at, spin, w = 120, h = 30, children, className,
}: {
  at: Pt;
  spin: number;
  w?: number;
  h?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <foreignObject x={at[0] - w / 2} y={at[1] - h / 2} width={w} height={h} className="pointer-events-none overflow-visible">
      <div
        className={className ?? "flex h-full w-full items-center justify-center"}
        style={{ transform: `rotate(${(-spin * 360).toFixed(2)}deg)`, transformOrigin: "center" }}
      >
        {children}
      </div>
    </foreignObject>
  );
}

/* ------------------------------------------------------------------ */
/* Chips along an arc                                                  */
/* ------------------------------------------------------------------ */

export interface ArcItem {
  id: string;
  label: string;
  style: React.CSSProperties;
  glyph?: React.ReactNode;
}

/**
 * The choices, sitting on the band.
 *
 * HTML squares placed at points on the arc rather than sectors cut out of it,
 * because a swatch has to show a colour or a tile honestly and a wedge
 * distorts both. They take the room they need — the chip plus a gap, as an
 * angle at this radius — and sit centred in the sweep, so a pair clusters and
 * seven still fit.
 */
export function ArcChips({
  slab, items, value, onPick, radius, size = 28, tone = "slab",
}: {
  slab: Slab;
  items: ArcItem[];
  value: string | null;
  onPick: (id: string) => void;
  radius: number;
  size?: number;
  /** On a slab, or keys set into a screen. */
  tone?: "slab" | "screen";
}) {
  const n = Math.max(1, items.length);
  const { from, to, spin } = slab;
  const screen = tone === "screen";
  /*
   * Rows, when they are needed.
   *
   * A quadrant's arc at this radius holds about five chips before the ones at
   * the ends are sitting on the seams and hanging over the next slab. Past
   * that they wrap on to a second, inner row — the same way a row of buttons
   * wraps in a panel — rather than shrinking until they are not swatches.
   */
  const sweep = (to - from) * 0.8;
  const fits = (r: number) => Math.max(1, Math.floor((sweep * Math.PI * 2 * r) / (size + 9)));
  const rows: { r: number; items: ArcItem[] }[] = [];
  if (n <= fits(radius)) rows.push({ r: radius, items });
  else {
    const outer = Math.min(fits(radius), Math.ceil(n / 2));
    rows.push({ r: radius, items: items.slice(0, outer) });
    // Just inside the first row — and no further, or it lands on the caption
    // that sits by the hole.
    rows.push({ r: radius - (size + 8), items: items.slice(outer) });
  }
  const place = (r: number, count: number) => {
    const want = (size + 9) / (Math.PI * 2 * Math.max(24, r));
    const step = Math.min(sweep / count, want * 1.4);
    return { step, first: (from + to) / 2 - (step * count) / 2 };
  };
  return (
    <>
      {rows.flatMap((row) => row.items.map((item, i) => {
        const { step, first } = place(row.r, row.items.length);
        const t = first + step * (i + 0.5);
        const at = onCircle(t, row.r);
        const on = value === item.id;
        return (
          <foreignObject
            key={item.id}
            x={at[0] - size / 2 - 4}
            y={at[1] - size / 2 - 4}
            width={size + 8}
            height={size + 8}
            className="overflow-visible"
          >
            <div className="flex h-full w-full items-center justify-center" style={{ transform: `rotate(${(-spin * 360).toFixed(2)}deg)` }}>
              <button
                type="button"
                aria-label={item.label}
                aria-pressed={on}
                data-arc-chip={item.id}
                title={item.label}
                onClick={() => { play("select"); onPick(item.id); }}
                className="pointer-events-auto flex items-center justify-center rounded-[6px] transition-transform"
                style={{
                  width: size,
                  height: size,
                  transform: on ? "scale(1.18)" : undefined,
                  ...(screen ? SCREEN_KEY : {}),
                  ...item.style,
                  // A chip that wears a shadow of its own (an aura, say) keeps it under the pick.
                  boxShadow: [
                    on ? PICKED : screen ? "inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.5)" : `${litEdge(CONSOLE_HUE, on)}, 0 2px 5px oklch(0 0 0 / 0.45)`,
                    item.style.boxShadow,
                  ].filter(Boolean).join(", "),
                  outline: on ? "none" : `1px solid ${screen ? SCREEN.line : CONSOLE.ink}`,
                }}
              >
                {item.glyph}
              </button>
            </div>
          </foreignObject>
        );
      }))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Chips packed into a slab                                            */
/* ------------------------------------------------------------------ */

/**
 * Colour boxes filling a slab, not riding an arc.
 *
 * A quadrant is mostly square, and an arc through it leaves the corner
 * empty. These are laid on a grid in the slab's own frame — rows and columns
 * from the outer corner in, pitch one chip and a gap — and kept where the
 * slab is: clear of the hole, inside the outer edge (the square's, or the
 * circle's when the wheel is swept round). Then they are dealt out nearest
 * the pointer first, so the first few things in the list are the first few
 * things your hand reaches.
 *
 * The grid is worked out for the quadrant that starts straight up and turned
 * to wherever this slab is, so every slab packs the same way.
 */
export function GridChips({
  slab, items, value, values, onPick, size = 22, gap = 6,
}: {
  slab: Slab;
  items: ArcItem[];
  value: string | null;
  /** Several on at once — the page's texture layers, say — instead of one. */
  values?: ReadonlySet<string>;
  onPick: (id: string) => void;
  size?: number;
  gap?: number;
}) {
  const { from, spin, rings, shape } = slab;
  const pitch = size + gap;
  // The slab is cut back by SHRINK and its edge grown out by the rounding;
  // the chips stay a few pixels inside what is drawn.
  const half = rings.reach - SHRINK - 8;
  const inner = rings.hole + 16 + size / 2;
  const spots: Pt[] = [];
  // Columns in from the right edge, rows down from the top edge, of the
  // quadrant up-and-right of the pointer.
  for (let cx = half - size / 2; cx > size / 2; cx -= pitch) {
    for (let cy = -(half - size / 2); cy < -size / 2; cy += pitch) {
      const r = Math.hypot(cx, cy);
      if (r < inner) continue;
      if (shape === "round" && Math.hypot(Math.abs(cx) + size / 2, Math.abs(cy) + size / 2) > rings.reach - SHRINK - 4) continue;
      spots.push([cx, cy]);
    }
  }
  spots.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  return (
    <>
      {items.slice(0, spots.length).map((item, i) => {
        const at = spun(spots[i]!, from);
        const on = values ? values.has(item.id) : value === item.id;
        return (
          <foreignObject key={item.id} x={at[0] - size / 2 - 4} y={at[1] - size / 2 - 4} width={size + 8} height={size + 8} className="overflow-visible">
            <div className="flex h-full w-full items-center justify-center" style={{ transform: `rotate(${(-spin * 360).toFixed(2)}deg)` }}>
              <button
                type="button"
                aria-label={item.label}
                aria-pressed={on}
                data-arc-chip={item.id}
                title={item.label}
                onClick={() => { play("select"); onPick(item.id); }}
                className="pointer-events-auto flex items-center justify-center rounded-[5px] transition-transform"
                style={{
                  width: size,
                  height: size,
                  transform: on ? "scale(1.12)" : undefined,
                  ...item.style,
                  boxShadow: [on ? PICKED : `${litEdge(CONSOLE_HUE)}, 0 1px 3px oklch(0 0 0 / 0.45)`, item.style.boxShadow].filter(Boolean).join(", "),
                  outline: on ? "none" : `1px solid ${CONSOLE.ink}`,
                }}
              >
                {item.glyph}
              </button>
            </div>
          </foreignObject>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* A control you drag along the arc                                    */
/* ------------------------------------------------------------------ */

/**
 * A slider bent round the band.
 *
 * The gradient is painted as a run of small sectors rather than as a real
 * gradient, because SVG has no conic one and a linear gradient across a curve
 * lies about where the colours are. Twenty steps across a quarter turn is
 * past the point where the seams show.
 */
export function ArcSlider({
  slab, from, to, rIn, rOut, value, onChange, onCommit, colourAt, label, live = true, tone = "slab",
}: {
  slab: Slab;
  from: number;
  to: number;
  rIn: number;
  rOut: number;
  /** 0..1 along the arc. */
  value: number;
  onChange: (v: number) => void;
  /** The hand has let go: what it settled on is worth remembering. */
  onCommit?: () => void;
  colourAt: (f: number) => string;
  label: string;
  /**
   * Whether every frame of the drag is written out, or only where the hand
   * lets go. Colour wants to be seen as it moves; an entrance that replays
   * on every change does not want sixty replays a second.
   */
  live?: boolean;
  /** On a slab, or set into a screen. */
  tone?: "slab" | "screen";
}) {
  const { spin } = slab;
  const steps = 22;
  /*
   * Smooth: while the hand is on it, the mark follows the hand from *here* —
   * one read per animation frame, kept in local state — rather than waiting
   * for the number to go out to the store and come back through the whole
   * menu. The pointer is captured by the slider itself, so a hand that
   * strays off the band keeps hold of it, and the read wraps the short way
   * round, so a hand that goes past the start does not jump to the end.
   */
  const [held, setHeld] = React.useState<number | null>(null);
  const frame = React.useRef(0);
  const pending = React.useRef<number | null>(null);
  const sent = React.useRef<number | null>(null);
  const shown = Math.max(0, Math.min(1, held ?? value));
  const grab = (e: React.PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const host = (el.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    try { el.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer; the window still delivers the moves */ }
    const span = to - from;
    const read = (cx: number, cy: number) => {
      // Back out of the wheel's own turn, then read the angle off the arc.
      const p = spun([cx - host.left, cy - host.top], -spin);
      const t = ((Math.atan2(p[1], p[0]) / (Math.PI * 2) + 0.25) % 1 + 1) % 1;
      let u = t;
      while (u < from) u += 1;
      if (u - to > (1 - span) / 2) u -= 1;
      return Math.max(0, Math.min(1, (u - from) / span));
    };
    const settle = () => {
      frame.current = 0;
      const v = pending.current;
      if (v === null) return;
      setHeld(v);
      if (live) { sent.current = v; onChange(v); }
    };
    const queue = (cx: number, cy: number) => {
      pending.current = read(cx, cy);
      if (!frame.current) frame.current = requestAnimationFrame(settle);
    };
    queue(e.clientX, e.clientY);
    const move = (m: PointerEvent) => queue(m.clientX, m.clientY);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; }
      const v = pending.current;
      pending.current = null;
      setHeld(null);
      if (v !== null && v !== sent.current) onChange(v);
      sent.current = null;
      onCommit?.();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const markAt = from + (to - from) * shown;
  // The mark is drawn once at the start of the arc and turned to where the
  // value is, so it can ease between values it did not see the hand set.
  const a = onCircle(from, rIn - 2);
  const b = onCircle(from, rOut + 2);
  const screen = tone === "screen";
  return (
    <g
      data-arc-slider={label}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={grab}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(Math.max(0, value - 0.04));
        if (e.key === "ArrowRight") onChange(Math.min(1, value + 0.04));
      }}
      onKeyUp={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") onCommit?.(); }}
      className="pointer-events-auto cursor-pointer outline-none"
      style={{ touchAction: "none" }}
    >
      {Array.from({ length: steps }, (_, i) => {
        const s0 = from + ((to - from) * i) / steps;
        // A hair of overlap, or the seams between the steps show as hairlines.
        const s1 = from + ((to - from) * (i + 1)) / steps + 0.0006;
        return <path key={i} d={arcPath(s0, s1, rIn, rOut)} fill={colourAt((i + 0.5) / steps)} />;
      })}
      <path d={arcPath(from, to, rIn, rOut)} fill="none" stroke={screen ? SCREEN.line : CONSOLE.ink} strokeWidth={screen ? 1 : 1.5} />
      <g
        data-arc-mark=""
        style={{
          transform: `rotate(${((markAt - from) * 360).toFixed(3)}deg)`,
          transformOrigin: "0 0",
          transition: held === null ? "transform 110ms ease-out" : "none",
        }}
      >
        <line
          x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={screen ? SCREEN.ink : "oklch(0.99 0 0)"}
          strokeWidth={3.5}
          strokeLinecap="round"
          style={{ filter: screen ? `drop-shadow(0 0 3px ${SCREEN.ink})` : "drop-shadow(0 0 2px oklch(0 0 0 / 0.7))" }}
        />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* A screen set into a slab                                            */
/* ------------------------------------------------------------------ */

/**
 * The slab's face painted as a screen: the same shape, a few pixels in from
 * the slab's own edge, in the screen's glass with the scanlines and the dot
 * matrix over it and the bezel round it. What a slab full of settings sits
 * on, so the sliders and keys on it read as one console rather than as
 * boxes on a plate.
 */
export function ScreenFace({ slab, inset = 6 }: { slab: Slab; inset?: number }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const { from, to, rings, shape } = slab;
  const d = piece(from, to, rings.hole + inset, "edge", shape, rings, SHRINK + inset);
  return (
    <g data-screen-face="" className="pointer-events-none">
      <defs>
        <radialGradient id={`${id}g`} cx="45%" cy="40%" r="80%">
          <stop offset="0%" stopColor="oklch(0.2 0.05 195)" />
          <stop offset="55%" stopColor="oklch(0.135 0.04 200)" />
          <stop offset="100%" stopColor="oklch(0.09 0.03 205)" />
        </radialGradient>
        <pattern id={`${id}s`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="oklch(0 0 0 / 0.26)" />
          <circle cx="1.5" cy="2" r="0.55" fill="oklch(0.62 0.1 190 / 0.09)" />
        </pattern>
      </defs>
      <path d={d} fill={`url(#${id}g)`} stroke={SCREEN.line} strokeWidth={3} strokeLinejoin="round" />
      <path d={d} fill={`url(#${id}s)`} />
      <path d={d} fill="none" stroke="oklch(0.5 0.08 290 / 0.35)" strokeWidth={1} strokeLinejoin="round" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* A readout with arrows                                               */
/* ------------------------------------------------------------------ */

export interface StepItem {
  id: string;
  label: string;
  /** How the readout is set when this one is showing — a family in its own face, say. */
  style?: React.CSSProperties;
}

/**
 * One setting with a handful of values, as a readout between two arrows.
 *
 * For the values that are words — a top bar's on-scroll, a type family —
 * where a row of word-boxes read as a row of buttons. On a screen the value
 * is *shown*, in phosphor, and the arrows step through the rest; the whole
 * list is one press away in either direction and never sprawls across the
 * slab.
 */
export function ArcStepper({
  slab, radius, items, value, onChange, label, w = 104,
}: {
  slab: Slab;
  radius: number;
  items: StepItem[];
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  w?: number;
}) {
  const { from, to, spin } = slab;
  const at = onCircle((from + to) / 2, radius);
  const n = items.length;
  const i = Math.max(0, items.findIndex((it) => it.id === value));
  const go = (d: number) => {
    if (!n) return;
    play("select");
    onChange(items[(((i + d) % n) + n) % n]!.id);
  };
  const keyStyle: React.CSSProperties = { ...SCREEN_KEY, outline: `1px solid ${SCREEN.line}`, boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.5)" };
  return (
    <Glued at={at} spin={spin} w={w} h={26}>
      <div
        data-arc-stepper={label}
        className="flex h-[22px] w-full items-center gap-0.5 rounded-[4px] p-0.5"
        style={{ background: "oklch(0.1 0.03 200 / 0.75)", outline: `1px solid ${SCREEN.line}`, boxShadow: "inset 0 1px 6px oklch(0 0 0 / 0.6)" }}
      >
        <button type="button" aria-label={`Previous ${label}`} data-step="prev" onClick={() => go(-1)} className="pointer-events-auto flex size-[18px] shrink-0 items-center justify-center rounded-[3px]" style={keyStyle}>
          <ChevronLeft className="size-3" />
        </button>
        <span
          data-stepper-value={items[i]?.id ?? ""}
          title={items[i]?.label}
          className="min-w-0 flex-1 truncate text-center font-mono text-[8.5px] font-semibold uppercase tracking-wider"
          style={{ color: SCREEN.ink, textShadow: `0 0 5px ${SCREEN.ink}`, ...items[i]?.style }}
        >
          {items[i]?.label ?? "—"}
        </span>
        <button type="button" aria-label={`Next ${label}`} data-step="next" onClick={() => go(1)} className="pointer-events-auto flex size-[18px] shrink-0 items-center justify-center rounded-[3px]" style={keyStyle}>
          <ChevronRight className="size-3" />
        </button>
      </div>
    </Glued>
  );
}

/* ------------------------------------------------------------------ */
/* A button cut out of a slab                                          */
/* ------------------------------------------------------------------ */

export function SectorButton({
  d, at, spin, label, icon, on, onClick, hue = CONSOLE_HUE, disabled,
}: {
  /** The sector, already cut with `piece()`. */
  d: string;
  at: Pt;
  spin: number;
  label: string;
  icon?: React.ReactNode;
  on?: boolean;
  onClick: () => void;
  hue?: number;
  disabled?: boolean;
}) {
  const [hot, setHot] = React.useState(false);
  const lit = hot && !disabled;
  // The button is the slab, so at rest it wears the slab's own grey; it
  // brightens under the hand and goes red when it is on. Disabled is a
  // duller, *opaque* face — a translucent one showed the slab's rim through
  // it as a second outline.
  const fill = disabled ? "oklch(0.16 0.03 288)" : on ? `oklch(0.64 0.23 ${hue})` : lit ? CONSOLE.faceLit : CONSOLE.face;
  return (
    <>
      <path
        data-arc-button={label}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={on}
        aria-disabled={disabled}
        d={d}
        onClick={() => { if (disabled) return; play("select"); onClick(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        onPointerEnter={() => setHot(true)}
        onPointerLeave={() => setHot(false)}
        className={disabled ? "pointer-events-auto" : "pointer-events-auto cursor-pointer outline-none"}
        fill={fill}
        stroke={CONSOLE.rim}
        strokeWidth={2 * 5 + 2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: "fill 120ms ease-out", filter: SLAB_AURA }}
      />
      <path
        d={d}
        className="pointer-events-none"
        fill={fill}
        stroke={fill}
        strokeWidth={2 * 5}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: "fill 120ms ease-out, stroke 120ms ease-out" }}
      />
      <Glued at={at} spin={spin} w={100} h={34}>
        <div
          className="flex flex-col items-center gap-0.5 text-[9px] font-semibold leading-tight"
          style={{
            color: on ? "oklch(0.16 0.04 27)" : disabled ? CONSOLE.muted : CONSOLE.text,
            textShadow: on ? undefined : "0 1px 2px oklch(0 0 0 / 0.6)",
          }}
        >
          {icon}
          <span className="whitespace-nowrap">{label}</span>
        </div>
      </Glued>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* A tray under the wheel                                              */
/* ------------------------------------------------------------------ */

export interface TrayItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** The one action the tray is really for, in the first level's blue. */
  primary?: boolean;
  disabled?: boolean;
}

/**
 * A small tab under the wheel that opens, on hover, into a row of actions.
 *
 * For the things a part's menu needs that are not worth a piece of the
 * wheel: seeing the part live, moving it forward or back among the others,
 * carrying its looks to another part. Under the wheel rather than on it, so
 * the wheel stays the wheel; a tab rather than a row, so it is not chrome
 * until it is wanted.
 */
export function HoverTray({ at, icon, label, items, testId, lit }: { at: Pt; icon: React.ReactNode; label: string; items: TrayItem[]; testId: string; lit?: boolean }) {
  return (
    <div
      data-tray={testId}
      data-lit={lit ? "" : undefined}
      className="group/tray pointer-events-auto absolute flex -translate-x-1/2 items-center rounded-md transition-[box-shadow,border-color]"
      style={{
        left: at[0],
        top: at[1],
        background: CONSOLE.face,
        // Lit, the tab wears the first level's blue: something in it is ready.
        border: `1px solid ${lit ? "oklch(0.6 0.14 205)" : CONSOLE.rim}`,
        boxShadow: lit ? "0 0 10px oklch(0.7 0.16 205 / 0.45), 0 3px 8px oklch(0 0 0 / 0.55)" : "0 3px 8px oklch(0 0 0 / 0.55)",
      }}
    >
      <span className="flex h-5 w-8 items-center justify-center group-hover/tray:hidden" title={label} style={{ color: lit ? "oklch(0.82 0.13 205)" : CONSOLE.muted }}>
        {icon}
      </span>
      <div className="hidden items-center gap-0.5 p-0.5 group-hover/tray:flex">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            data-tray-item={it.id}
            aria-label={it.label}
            title={it.label}
            disabled={it.disabled}
            onClick={() => { play(it.primary ? "confirm" : "tap"); it.onClick(); }}
            className="flex h-6 items-center gap-1 whitespace-nowrap rounded-[4px] px-1.5 text-[9px] font-semibold transition-[filter] enabled:hover:brightness-125 disabled:opacity-40"
            style={{
              background: it.primary ? "oklch(0.66 0.155 205)" : CONSOLE.box,
              color: it.primary ? "oklch(0.99 0 0)" : CONSOLE.text,
              boxShadow: litEdge(it.primary ? 205 : CONSOLE_HUE),
              outline: it.primary ? "1px solid oklch(0.44 0.14 205)" : `1px solid ${CONSOLE.ink}`,
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A word on a slab                                                    */
/* ------------------------------------------------------------------ */

/**
 * A slab's caption, engraved along its inner arc.
 *
 * The one word on a slab that is not upright. It ran straight at first, glued
 * to a spot by the hole, and that was fine until the wheel was turned so the
 * slab pointed sideways: then the word ran *along* the slab instead of across
 * it, straight into the chips. Bent round the arc it always takes the same
 * band — just outside the hole, just inside the chips — whichever way the
 * slab points. Two or three words; the arc holds about thirteen letters.
 *
 * On the lower half of the screen the arc is walked the other way and the
 * letters hang from it instead of standing on it, so they are the right way
 * up wherever the wheel has been turned to.
 */
export function Caption({ slab, children }: { slab: Slab; children: React.ReactNode }) {
  const id = React.useId();
  const { from, to, spin, rings } = slab;
  // Where the slab is pointing on screen, once the wheel's turn is added.
  const facing = (((from + to) / 2 + spin) % 1 + 1) % 1;
  const low = facing > 0.25 && facing < 0.75;
  const r = rings.hole + (low ? 20 : 13);
  const d = low
    ? `M ${fmt(onCircle(to, r))} A ${r} ${r} 0 0 0 ${fmt(onCircle(from, r))}`
    : `M ${fmt(onCircle(from, r))} A ${r} ${r} 0 0 1 ${fmt(onCircle(to, r))}`;
  return (
    <g className="pointer-events-none" data-arc-caption="">
      <defs>
        <path id={id} d={d} fill="none" />
      </defs>
      <text
        fontSize={7.5}
        fontWeight={700}
        letterSpacing={0.7}
        fill={CONSOLE.text}
        stroke={CONSOLE.ink}
        strokeWidth={2}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {children}
        </textPath>
      </text>
    </g>
  );
}
