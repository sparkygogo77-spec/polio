"use client";
/**
 * The third level, as a ring.
 *
 * It has been a box three times now — a tooltip beside the ring, then a slab
 * over it, then a slab exactly the size of it — and a box is wrong for the
 * same reason each time: the first two levels are geometry you throw a pointer
 * at, and a rectangle full of form controls is a different program wearing the
 * same colours.
 *
 * So the editor is an annulus wrapped **around** the green level, taking the
 * three quarters the green is not using. The green stays where it is, so you
 * can still see which choice you are inside and step sideways to another. Two
 * bands: the outer one carries the choices, the inner one carries the
 * continuous controls — a spectrum, a lightness, a strength — each an arc you
 * drag along rather than a slider in a list.
 *
 * Everything is drawn in the wheel's own local coordinates and turned by
 * `spin` at the end, exactly like the wheel, so the console turns with it.
 * Labels are HTML and stay upright: a word bent round a curve is a logo, not
 * an interface.
 */
import * as React from "react";
import { play } from "@/core/audio/engine";

export type Pt = [number, number];

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const TURN = (t: number) => t * Math.PI * 2 - Math.PI / 2;

export const onCircle = (t: number, r: number): Pt => {
  const a = TURN(t);
  return [Math.cos(a) * r, Math.sin(a) * r];
};

export const spun = (p: Pt, turns: number): Pt => {
  const a = turns * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

const fmt = (v: Pt) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;

/**
 * An annulus sector: out along one seam, round the outside, back down the
 * other, round the inside. Split at the halfway point so no single arc is ever
 * a full circle, which SVG cannot draw in one command.
 */
export function ringPath(from: number, to: number, rIn: number, rOut: number): string {
  const mid = from + (to - from) / 2;
  // Split at the halfway point and both halves are under half a turn, so the
  // large-arc flag is always 0. Passing 1 because the *whole* span is over half
  // a turn sends each half the long way round instead, and the plate comes out
  // inside out — which is exactly what it did.
  let d = `M ${fmt(onCircle(from, rIn))}`;
  d += ` L ${fmt(onCircle(from, rOut))}`;
  d += ` A ${rOut} ${rOut} 0 0 1 ${fmt(onCircle(mid, rOut))}`;
  d += ` A ${rOut} ${rOut} 0 0 1 ${fmt(onCircle(to, rOut))}`;
  d += ` L ${fmt(onCircle(to, rIn))}`;
  d += ` A ${rIn} ${rIn} 0 0 0 ${fmt(onCircle(mid, rIn))}`;
  d += ` A ${rIn} ${rIn} 0 0 0 ${fmt(onCircle(from, rIn))}`;
  return `${d} Z`;
}

/** Where the console sits: two bands, just outside the green level. */
export interface Bands {
  /** Inner edge of the inner band — the green level's outer edge plus a gap. */
  in: number;
  /** The two bands, as [inner start, inner end, outer start, outer end]. */
  a0: number;
  a1: number;
  b0: number;
  b1: number;
}

export function bandsFrom(greenReach: number): Bands {
  const a0 = greenReach + 8;
  const a1 = a0 + 36;
  const b0 = a1 + 8;
  const b1 = b0 + 44;
  return { in: a0, a0, a1, b0, b1 };
}

/* ------------------------------------------------------------------ */
/* The shell                                                           */
/* ------------------------------------------------------------------ */

export const CONSOLE_HUE = 18;

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

export interface RingSpan {
  from: number;
  to: number;
  bands: Bands;
  spin: number;
}

/**
 * The plate the whole console is drawn on: one annulus, grey, with a red aura.
 *
 * The bare ring is also the handle. The console covers what it is editing and
 * the lock is gone while it is up, so without this there is no way to shove it
 * aside — and press-and-drag on the background of a panel is what everyone
 * tries first anyway. Chips and arcs sit above it and take their own presses.
 */
export function RingPlate({ span, onGrip }: { span: RingSpan; onGrip?: (e: React.PointerEvent) => void }) {
  const { from, to, bands, spin } = span;
  return (
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <g transform={`rotate(${(spin * 360).toFixed(2)})`}>
        <path
          data-ring-plate=""
          onPointerDown={onGrip}
          className="pointer-events-auto cursor-grab active:cursor-grabbing"
          d={ringPath(from, to, bands.a0 - 6, bands.b1 + 6)}
          // Light enough to read as a surface the controls are standing on.
          // At a quarter of the screen across, the grey that worked on a small
          // panel disappeared into the board.
          fill="oklch(0.36 0.024 20)"
          fillOpacity={0.97}
          stroke={`oklch(0.62 0.21 ${CONSOLE_HUE})`}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 18px oklch(0.6 0.22 ${CONSOLE_HUE} / 0.5)) drop-shadow(0 10px 26px oklch(0 0 0 / 0.55))` }}
        />
      </g>
    </svg>
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
 * They are HTML squares placed at points on the arc rather than sectors cut
 * out of it, because a swatch has to show a colour or a tile honestly and a
 * wedge distorts both. The arc is what they are *on*; it is not what they are.
 */
export function ArcChips({
  items, value, onPick, span, radius, size = 30,
}: {
  items: ArcItem[];
  value: string | null;
  onPick: (id: string) => void;
  span: RingSpan;
  radius: number;
  size?: number;
}) {
  const n = Math.max(1, items.length);
  const { from, to, spin } = span;
  /*
   * Spread, but not to the horizon.
   *
   * Filling the whole sweep whatever the count put two chips a quarter turn
   * apart with nothing between them, which reads as two unrelated buttons
   * rather than a choice of two. They take the room they need — the chip plus
   * a gap, as an angle at this radius — and sit centred in the sweep, so a
   * pair clusters and a dozen still fits.
   */
  const room = (to - from) / n;
  const want = (size + 16) / (Math.PI * 2 * Math.max(24, radius));
  // Up to about twice a chip's own width of air before it stops spreading:
  // enough that seven fill most of the sweep and two still read as a pair.
  const step = Math.min(room, want * 1.9);
  const first = (from + to) / 2 - (step * n) / 2;
  return (
    <>
      {items.map((item, i) => {
        const t = first + step * (i + 0.5);
        const at = spun(onCircle(t, radius), spin);
        const on = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={on}
            data-arc-chip={item.id}
            title={item.label}
            onClick={() => { play("select"); onPick(item.id); }}
            className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[7px] transition-transform"
            style={{
              width: size,
              height: size,
              left: at[0],
              top: at[1],
              transform: `translate(-50%, -50%) scale(${on ? 1.18 : 1})`,
              ...item.style,
              boxShadow: `${litEdge(CONSOLE_HUE, on)}, 0 2px 5px oklch(0 0 0 / 0.45)`,
              outline: on ? "2px solid oklch(0.98 0.05 20)" : "1px solid oklch(0.3 0.04 20)",
              outlineOffset: on ? 1 : 0,
            }}
          >
            {item.glyph}
          </button>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* A control you drag along the arc                                    */
/* ------------------------------------------------------------------ */

/**
 * A slider bent round the ring.
 *
 * The gradient is painted as a run of small sectors rather than as a real
 * gradient, because SVG has no conic one and a linear gradient across a curve
 * lies about where the colours are. Twenty-four steps across a quarter turn is
 * past the point where the seams show.
 */
export function ArcSlider({
  span, from, to, rIn, rOut, value, onChange, colourAt, label,
}: {
  span: RingSpan;
  from: number;
  to: number;
  rIn: number;
  rOut: number;
  /** 0..1 along the arc. */
  value: number;
  onChange: (v: number) => void;
  colourAt: (f: number) => string;
  label: string;
}) {
  const { spin } = span;
  const steps = 26;
  const grab = (e: React.PointerEvent<SVGGElement>) => {
    const host = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const read = (cx: number, cy: number) => {
      // Back out of the wheel's own turn, then read the angle off the arc.
      const p = spun([cx - host.left, cy - host.top], -spin);
      const t = ((Math.atan2(p[1], p[0]) / (Math.PI * 2) + 0.25) % 1 + 1) % 1;
      // The arc may cross the seam at 1; unwrap so the reading is monotonic.
      let u = t;
      while (u < from) u += 1;
      onChange(Math.max(0, Math.min(1, (u - from) / (to - from))));
    };
    read(e.clientX, e.clientY);
    const move = (m: PointerEvent) => read(m.clientX, m.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const markAt = from + (to - from) * Math.max(0, Math.min(1, value));
  return (
    <g
      data-arc-slider={label}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={grab}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(Math.max(0, value - 0.04));
        if (e.key === "ArrowRight") onChange(Math.min(1, value + 0.04));
      }}
      className="pointer-events-auto cursor-pointer outline-none"
    >
      {Array.from({ length: steps }, (_, i) => {
        const a = from + ((to - from) * i) / steps;
        // A hair of overlap, or the seams between the steps show as hairlines.
        const b = from + ((to - from) * (i + 1)) / steps + 0.0006;
        return <path key={i} d={ringPath(a, b, rIn, rOut)} fill={colourAt((i + 0.5) / steps)} />;
      })}
      <path d={ringPath(from, to, rIn, rOut)} fill="none" stroke="oklch(0.2 0.04 20)" strokeWidth={1.5} />
      {/* where you are on it */}
      <path
        d={`M ${fmt(onCircle(markAt, rIn - 2))} L ${fmt(onCircle(markAt, rOut + 2))}`}
        stroke="oklch(0.99 0 0)"
        strokeWidth={3.5}
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 2px oklch(0 0 0 / 0.7))" }}
      />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* A button cut out of the arc                                         */
/* ------------------------------------------------------------------ */

export function ArcButton({
  span, from, to, rIn, rOut, label, icon, on, onClick, hue = CONSOLE_HUE,
}: {
  span: RingSpan;
  from: number;
  to: number;
  rIn: number;
  rOut: number;
  label: string;
  icon?: React.ReactNode;
  on?: boolean;
  onClick: () => void;
  hue?: number;
}) {
  const { spin } = span;
  const at = spun(onCircle((from + to) / 2, (rIn + rOut) / 2), spin);
  return (
    <>
      <path
        data-arc-button={label}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={on}
        d={ringPath(from, to, rIn, rOut)}
        transform={`rotate(${(spin * 360).toFixed(2)})`}
        onClick={() => { play("select"); onClick(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        className="pointer-events-auto cursor-pointer outline-none"
        fill={on ? `oklch(0.68 0.2 ${hue})` : "oklch(0.26 0.03 20)"}
        stroke="oklch(0.2 0.04 20)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <foreignObject x={at[0] - 76} y={at[1] - 15} width={152} height={30} className="pointer-events-none">
        <div
          className="flex h-full w-full items-center justify-center gap-1 text-[10px] font-semibold leading-tight"
          style={{ color: on ? "oklch(0.16 0.05 20)" : "oklch(0.95 0.03 20)" }}
        >
          {icon}
          <span className="truncate">{label}</span>
        </div>
      </foreignObject>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* A word on the ring                                                  */
/* ------------------------------------------------------------------ */

/** A label sitting on the band, upright. */
export function ArcLabel({
  span, at, radius, children, width = 120,
}: {
  span: RingSpan;
  at: number;
  radius: number;
  children: React.ReactNode;
  width?: number;
}) {
  const p = spun(onCircle(at, radius), span.spin);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-center text-[9px] font-semibold uppercase leading-tight tracking-wider"
      style={{ left: p[0], top: p[1], width, color: "oklch(0.93 0.05 20)", textShadow: "0 1px 2px oklch(0 0 0 / 0.7)" }}
    >
      {children}
    </span>
  );
}
