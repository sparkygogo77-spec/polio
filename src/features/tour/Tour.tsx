"use client";
/**
 * The tour, as a hole in the dark.
 *
 * Everything goes dim and two or three things do not. That is the whole
 * mechanism: one fixed layer over the app, an SVG mask with a hole cut for
 * each thing the step is about, and a card beside each hole saying what it
 * is, what it is for and where it lives. The app underneath is the real app,
 * in its real state — the step stages it first (see `steps.ts`), so what is
 * lit is the actual wheel, the actual board, the actual dialog.
 *
 * The layer takes every press, so nothing underneath can be clicked by
 * accident and nothing underneath closes: the wheel's own dismissal and the
 * dialog's outside-press both ask whether a tour is running before acting.
 *
 * Navigation is on screen the whole time — which step of how many, back,
 * next, and a way out — because a tour you cannot leave is a trap, and one
 * that hides its length is a longer trap.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MapPin, X } from "lucide-react";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { rectOf, STEPS, type Spot } from "./steps";
import { useTour } from "./store";

/** How far a card sits from the hole it belongs to. */
const GAP = 14;
const CARD_W = 268;
/**
 * What a card is assumed to be, before it exists.
 *
 * Placement has to happen before the card is on the page to measure, so this
 * is a generous guess: three lines of body and a line of place. Too small and
 * cards land on each other; too large and they wander off to the column.
 */
const CARD_H = 116;

interface Placed {
  spot: Spot;
  /** Null when the thing is not on this screen: the card stays, the hole does not. */
  box: DOMRect | null;
  card: { x: number; y: number };
  round: boolean;
}

/** A hole, grown a little so the thing inside it is not touching the dark. */
function holeOf(box: DOMRect, spot: Spot): DOMRect {
  const pad = spot.pad ?? 8;
  return new DOMRect(box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2);
}

/** The rectangle round everything in a set: what a card has to get clear of. */
function union(rects: DOMRect[]): DOMRect | null {
  if (!rects.length) return null;
  const l = Math.min(...rects.map((r) => r.left));
  const t = Math.min(...rects.map((r) => r.top));
  const rr = Math.max(...rects.map((r) => r.right));
  const b = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(l, t, rr - l, b - t);
}

/**
 * Where a card goes: beside its hole if there is room, and clear of every
 * other hole and card if not.
 *
 * The case that decides the shape of this is a small hole inside a big one —
 * the middle of the wheel inside the wheel — where all four sides of the
 * small hole are still inside the big one. So when nothing beside the hole
 * itself is free, the card goes beside *the whole of what it is stuck in*,
 * and only then falls back to a column down the side.
 */
function place(hole: DOMRect | null, taken: DOMRect[], i: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (x: number, y: number) => ({
    x: Math.max(12, Math.min(vw - CARD_W - 12, x)),
    y: Math.max(12, Math.min(vh - CARD_H - 84, y)),
  });
  // Nothing to sit beside: down the right-hand side, in order.
  if (!hole) return clamp(vw - CARD_W - 20, 96 + i * (CARD_H + 12));

  const free = (x: number, y: number) => {
    if (x < 12 || x + CARD_W > vw - 12 || y < 12 || y + CARD_H > vh - 84) return false;
    return !taken.some((t) => overlaps(t, new DOMRect(x, y, CARD_W, CARD_H)));
  };
  /**
   * Beside the hole, and then up or down that side until it fits.
   *
   * Two things stacked in a narrow panel are closer together than a card is
   * tall, so "level with its hole" collides with the card above nine times
   * out of ten. Sliding down the same column keeps the card beside the thing
   * it names, which is the part that matters.
   */
  const beside = (x: number, r: DOMRect): { x: number; y: number } | null => {
    for (let d = 0; d <= 320; d += 12) {
      for (const y of d === 0 ? [r.top] : [r.top + d, r.top - d]) if (free(x, y)) return { x, y };
    }
    return null;
  };
  const sides = (r: DOMRect) => [
    () => beside(r.right + GAP, r),
    () => beside(r.left - CARD_W - GAP, r),
    () => (free(r.left, r.bottom + GAP) ? { x: r.left, y: r.bottom + GAP } : null),
    () => (free(r.left, r.top - CARD_H - GAP) ? { x: r.left, y: r.top - CARD_H - GAP } : null),
  ];
  const stuckIn = union(taken.filter((t) => overlaps(t, hole)));
  const candidates = [...sides(hole), ...(stuckIn ? sides(stuckIn) : [])];

  for (const c of candidates) {
    const hit = c();
    if (hit) return hit;
  }
  // Everything is crowded: the column, which is at least never on top of
  // what it is describing.
  return clamp(vw - CARD_W - 20, 96 + i * (CARD_H + 12));
}

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Where a line from the middle of a box towards a point leaves the box. */
function edge(r: DOMRect, to: { x: number; y: number }): { x: number; y: number } {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  // The smaller of the two crossings is the side it actually leaves by.
  const tx = dx ? (r.width / 2) / Math.abs(dx) : Infinity;
  const ty = dy ? (r.height / 2) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * The thread from a card to its hole.
 *
 * A card cannot always sit beside the thing it names — the board fills the
 * middle of the screen and its Make real button is at the foot of it — and a
 * card adrift is a card about nothing. The line is what makes the pairing
 * legible wherever placement had to put it.
 *
 * It was a dashed straight line, which is the diagram a spreadsheet draws. It
 * curves now — one bend, bowed a fixed share of its own length so a short
 * thread is nearly straight and a long one leans — and it fades out of the
 * card and arrives full strength at the hole, which is the end that matters.
 * That is the whole of the change: the restraint is the point, a tour that
 * draws attention to its own pointing is a tour about itself.
 */
function thread(card: DOMRect, hole: DOMRect): { d: string; from: { x: number; y: number }; to: { x: number; y: number } } | null {
  if (overlaps(card, hole)) return null;
  const holeMid = { x: hole.x + hole.width / 2, y: hole.y + hole.height / 2 };
  const cardMid = { x: card.x + card.width / 2, y: card.y + card.height / 2 };
  const a = edge(card, holeMid);
  const b = edge(hole, cardMid);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // The bend, at right angles to the run and always the same way round the
  // clock, so four threads on one step curve as a set rather than a scribble.
  const bow = Math.min(26, len * 0.16);
  const cx = (a.x + b.x) / 2 - (dy / len) * bow;
  const cy = (a.y + b.y) / 2 + (dx / len) * bow;
  return { d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`, from: a, to: b };
}

export function Tour() {
  const open = useTour((s) => s.open);
  const step = useTour((s) => s.step);
  const router = useRouter();
  const [placed, setPlaced] = React.useState<Placed[]>([]);
  /** What the cards turned out to be, once they exist: the thread starts at their real edge. */
  const [cardH, setCardH] = React.useState<number[]>([]);
  const [ready, setReady] = React.useState(false);
  const root = React.useRef<HTMLDivElement | null>(null);
  const current = STEPS[step];
  const stop = React.useCallback(() => { play("close"); useTour.getState().stop(); }, []);

  // Anything underneath that would otherwise close on an outside press asks
  // this flag first, so the wheel stays up and the dialog stays open.
  React.useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.tourOn = "1";
    return () => { delete document.documentElement.dataset.tourOn; };
  }, [open]);

  // Stage the step: put the screen where it needs to be, then measure.
  React.useEffect(() => {
    if (!open || !current) return;
    let alive = true;
    setReady(false);
    const run = async () => {
      if (window.location.pathname !== current.route) {
        router.push(current.route);
        // The route has to have drawn before anything can be staged on it.
        for (let i = 0; i < 120 && alive && window.location.pathname !== current.route; i++) {
          await new Promise((r) => requestAnimationFrame(() => r(null)));
        }
      }
      await current.arrive?.();
      if (!alive) return;
      setReady(true);
    };
    void run();
    return () => {
      alive = false;
      current.leave?.();
    };
  }, [open, current, router]);

  // Measure every frame while the tour is up: things move, panels animate in,
  // and a hole in the wrong place is worse than no hole at all.
  React.useEffect(() => {
    if (!open || !current || !ready) return;
    let raf = 0;
    const isRound = (spot: Spot) => (typeof spot.round === "function" ? spot.round() : !!spot.round);
    const measure = () => {
      // A modal dialog hides everything but itself from the page — aria-hidden
      // on the siblings, and `inert`, which really does stop the presses. The
      // tour is not part of that dialog and must not be inert while it is
      // pointing into one, so it takes the marks off itself as they land.
      const el = root.current;
      if (el) {
        if (el.hasAttribute("inert")) el.removeAttribute("inert");
        if (el.getAttribute("aria-hidden") === "true") el.removeAttribute("aria-hidden");
      }
      const holes = current.spots.map((spot) => {
        const box = rectOf(spot);
        return box && box.width > 0 && box.height > 0 ? holeOf(box, spot) : null;
      });
      // Every hole is an obstacle, not only the cards already placed: a card
      // laid over the next spot's hole hides the very thing it is about.
      const taken: DOMRect[] = holes.filter(Boolean) as DOMRect[];
      const next = current.spots.map((spot, i) => {
        const hole = holes[i] ?? null;
        const card = place(hole, taken, i);
        taken.push(new DOMRect(card.x, card.y, CARD_W, CARD_H));
        return { spot, box: hole, card, round: isRound(spot) };
      });
      setPlaced((prev) => (same(prev, next) ? prev : next));

      const heights = [...document.querySelectorAll<HTMLElement>("[data-tour-card]")].map((c) => c.offsetHeight);
      setCardH((prev) => (prev.length === heights.length && prev.every((h, i) => h === heights[i]) ? prev : heights));
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [open, current, ready]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); }
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); useTour.getState().next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); useTour.getState().back(); }
    };
    // Captured, so the wheel and the dialog do not see the Escape that ends
    // the tour and close themselves halfway through the last step.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, stop]);

  if (!open || !current) return null;

  const last = step === STEPS.length - 1;

  return createPortal(
    <div
      ref={root}
      data-tour=""
      data-tour-step={current.id}
      // pointer-events must be said out loud: a modal dialog underneath turns
      // them off for the whole body, and the tour is not part of that dialog.
      className="fixed inset-0 z-[85] select-none"
      style={{ pointerEvents: "auto" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* The dark, with the holes cut out of it. */}
      <svg className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <mask id="tour-holes">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {placed.map((p, i) =>
              p.box ? (
                <rect
                  key={i}
                  x={p.box.x}
                  y={p.box.y}
                  width={p.box.width}
                  height={p.box.height}
                  rx={p.round ? p.box.width / 2 : 10}
                  ry={p.round ? p.box.height / 2 : 10}
                  fill="black"
                />
              ) : null,
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="oklch(0.12 0.02 288 / 0.82)" mask="url(#tour-holes)" />

        {/* Card to hole, so a card that had to sit far off is still paired. */}
        {placed.map((p, i) => {
          if (!p.box) return null;
          const line = thread(new DOMRect(p.card.x, p.card.y, CARD_W, cardH[i] ?? CARD_H), p.box);
          if (!line) return null;
          return (
            <g key={`thread-${i}`}>
              <defs>
                <linearGradient id={`tour-thread-${i}`} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity="0.12" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              <path d={line.d} fill="none" stroke={`url(#tour-thread-${i})`} strokeWidth="1.25" strokeLinecap="round" />
              {/* It arrives at a ring rather than a blob: the hole is the
                  subject, and a filled dot on the edge of it reads as a
                  blemish on the thing being shown. */}
              <circle cx={line.to.x} cy={line.to.y} r="2.5" fill="none" stroke="var(--accent)" strokeWidth="1.25" opacity="0.75" />
            </g>
          );
        })}
        {placed.map((p, i) =>
          p.box ? (
            <rect
              key={`ring-${i}`}
              x={p.box.x}
              y={p.box.y}
              width={p.box.width}
              height={p.box.height}
              rx={p.round ? p.box.width / 2 : 10}
              ry={p.round ? p.box.height / 2 : 10}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              opacity="0.85"
            />
          ) : null,
        )}
      </svg>

      {/* One card per thing: its name, one line, and where it lives. */}
      {placed.map((p, i) => (
        <div
          key={p.spot.name}
          data-tour-card={p.spot.name}
          className="absolute w-[268px] rounded-lg border border-border bg-panel/95 p-2.5 shadow-pop backdrop-blur-sm animate-pop"
          style={{ left: p.card.x, top: p.card.y }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold num",
                p.box ? "bg-accent text-accent-fg" : "border border-border text-fg-faint",
              )}
            >
              {i + 1}
            </span>
            <span className="text-[12px] font-semibold text-fg">{p.spot.name}</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-fg-muted">{p.spot.line}</p>
          <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-snug text-fg-faint">
            <MapPin className="mt-px size-2.5 shrink-0" />
            {p.spot.where}
          </p>
        </div>
      ))}

      {/* Where you are, and the ways on and out. */}
      <div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
        <div className="flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-border bg-panel/95 px-3 py-2 shadow-pop backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-fg">{current.title}</span>
              <span className="num rounded-full border border-border px-1.5 py-px text-[10px] text-fg-muted">
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <p className="mt-0.5 max-w-md text-[11px] leading-snug text-fg-muted">{current.blurb}</p>
          </div>

          {/* One pip per step: the length of the thing, at a glance. */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to ${s.title}`}
                onClick={() => useTour.getState().go(i)}
                className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-accent" : "w-1.5 bg-border hover:bg-fg-faint")}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => useTour.getState().back()}>
              <ArrowLeft /> Back
            </Button>
            <Button variant="primary" size="sm" onClick={() => (last ? stop() : useTour.getState().next())}>
              {last ? <><Check /> Done</> : <>Next <ArrowRight /></>}
            </Button>
            <Button variant="ghost" size="sm" onClick={stop} aria-label="Skip the tour">
              <X /> Skip
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Frame-to-frame comparison, so a still screen does not re-render forever. */
function same(a: Placed[], b: Placed[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i]!;
    if (p.spot !== q.spot || p.round !== q.round) return false;
    if (!p.box !== !q.box) return false;
    if (p.box && q.box && (Math.abs(p.box.x - q.box.x) > 0.5 || Math.abs(p.box.y - q.box.y) > 0.5 || Math.abs(p.box.width - q.box.width) > 0.5 || Math.abs(p.box.height - q.box.height) > 0.5)) return false;
    return Math.abs(p.card.x - q.card.x) < 0.5 && Math.abs(p.card.y - q.card.y) < 0.5;
  });
}
