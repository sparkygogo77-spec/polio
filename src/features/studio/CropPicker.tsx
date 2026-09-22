"use client";
/**
 * Which part of a picture the texture is taken from.
 *
 * A photograph of a surface is almost never a tile. The useful patch is
 * somewhere in the middle of it and everything round that patch is a lamp, a
 * hand, or the edge of the table — so dropped in whole it repeats as a grid of
 * photographs with a hand in every one of them. Cutting to the patch is the
 * step that turns a photograph into something that tiles.
 *
 * It is the selection everyone already knows: drag anywhere to draw a new one,
 * drag inside it to move it, drag a corner to resize it, and everything
 * outside it goes dark. Nothing about it is clever, on purpose — the hand
 * knows this one already and should not have to learn a version of it.
 */
import * as React from "react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import type { Crop } from "./look";

/** Nothing smaller than this, in fractions: below it the tile is a smear. */
const MIN = 0.04;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Two corners, whichever way round they were dragged, as a rectangle. */
function rectOf(ax: number, ay: number, bx: number, by: number): Crop {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  return { x, y, w: Math.max(MIN, Math.abs(bx - ax)), h: Math.max(MIN, Math.abs(by - ay)) };
}

const WHOLE: Crop = { x: 0, y: 0, w: 1, h: 1 };

type Grip =
  | { kind: "draw"; ax: number; ay: number }
  | { kind: "move"; dx: number; dy: number; from: Crop }
  | { kind: "corner"; ax: number; ay: number };

/** A picture taller than this many times its width is shown squashed into a box this tall, rather than at its own height. */
const SQUASH_PAST = 2;

export function CropPicker({ src, crop, onChange }: { src: string; crop?: Crop; onChange: (next: Crop | undefined) => void }) {
  const box = React.useRef<HTMLDivElement>(null);
  const grip = React.useRef<Grip | null>(null);
  const [aspect, setAspect] = React.useState(3 / 2);
  // A picture the browser cannot decode is said, not left as an empty 3:2 box.
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); setAspect(3 / 2); }, [src]);
  // The box is held to a height. A picture far taller than the column is
  // shown squashed into it rather than running ten times the panel: the
  // patch is picked in fractions of the box, which are fractions of the
  // picture either way, and the squash is said.
  const squashed = aspect < 1 / SQUASH_PAST;
  const c = crop ?? WHOLE;
  const whole = !crop || (c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.999 && c.h >= 0.999);

  /** Where the pointer is on the picture, in fractions of it. */
  const at = (e: React.PointerEvent | PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return { x: 0.5, y: 0.5 };
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };

  const start = (e: React.PointerEvent, g: Grip) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    grip.current = g;
  };

  const move = (e: React.PointerEvent) => {
    const g = grip.current;
    if (!g) return;
    const p = at(e);
    if (g.kind === "draw") onChange(rectOf(g.ax, g.ay, p.x, p.y));
    else if (g.kind === "corner") onChange(rectOf(g.ax, g.ay, p.x, p.y));
    else {
      // Moving keeps the size and stops at the edges, rather than shrinking
      // against them — a selection that changes size when you slide it is the
      // single most annoying thing one of these can do.
      const x = clamp01(p.x - g.dx);
      const y = clamp01(p.y - g.dy);
      onChange({ ...g.from, x: Math.min(x, 1 - g.from.w), y: Math.min(y, 1 - g.from.h) });
    }
  };

  const end = () => {
    if (!grip.current) return;
    grip.current = null;
    play("select");
  };

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  /** The four corners, as a place and which two edges each one drags. */
  const corners: { key: string; left: number; top: number; ax: number; ay: number; cursor: string }[] = [
    { key: "nw", left: c.x, top: c.y, ax: c.x + c.w, ay: c.y + c.h, cursor: "nwse-resize" },
    { key: "ne", left: c.x + c.w, top: c.y, ax: c.x, ay: c.y + c.h, cursor: "nesw-resize" },
    { key: "sw", left: c.x, top: c.y + c.h, ax: c.x + c.w, ay: c.y, cursor: "nesw-resize" },
    { key: "se", left: c.x + c.w, top: c.y + c.h, ax: c.x, ay: c.y, cursor: "nwse-resize" },
  ];

  if (failed) {
    return (
      <p data-crop-refused="" className="rounded-md border border-dashed border-border p-2 text-small leading-snug text-fg-muted">
        This picture could not be shown, so there is no patch to pick. Replace it with one the browser can open.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        ref={box}
        data-crop-picker=""
        role="application"
        aria-label="Which part of the picture the texture comes from"
        className="relative w-full cursor-crosshair overflow-hidden rounded-md border border-border bg-bg select-none"
        style={{ aspectRatio: String(Math.max(aspect, 1 / SQUASH_PAST)), touchAction: "none" }}
        onPointerDown={(e) => { const p = at(e); start(e, { kind: "draw", ax: p.x, ay: p.y }); onChange({ x: p.x, y: p.y, w: MIN, h: MIN }); }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full object-fill"
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth && el.naturalHeight) setAspect(el.naturalWidth / el.naturalHeight);
            else setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
        {squashed ? (
          <span data-crop-squashed="" className="pointer-events-none absolute inset-x-0 top-0 bg-[oklch(0.05_0.01_280/0.6)] px-1 py-0.5 text-center text-fine text-fg-muted">
            Shown squashed to fit; the patch is picked in the picture's own proportions
          </span>
        ) : null}

        {/*
          Nothing is drawn while there is no selection, and that matters: an
          overlay covering the whole picture is an overlay you cannot draw
          through, so the first drag would slide a full-size selection around
          instead of making one.
        */}
        {whole ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[oklch(0.05_0.01_280/0.6)] px-1 py-0.5 text-center text-fine text-fg-muted">
            Drag to pick the patch
          </span>
        ) : null}

        {/* Everything outside the selection goes dark. One element, four sides. */}
        {whole ? null : <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: pct(c.x),
            top: pct(c.y),
            width: pct(c.w),
            height: pct(c.h),
            boxShadow: "0 0 0 9999px oklch(0.05 0.01 280 / 0.62)",
            outline: "1px solid var(--accent)",
          }}
        />}

        {/* Drag inside to slide it. */}
        {whole ? null : <div
          data-crop-body=""
          className="absolute cursor-move"
          style={{ left: pct(c.x), top: pct(c.y), width: pct(c.w), height: pct(c.h) }}
          onPointerDown={(e) => { const p = at(e); start(e, { kind: "move", dx: p.x - c.x, dy: p.y - c.y, from: c }); }}
        />}

        {(whole ? [] : corners).map((k) => (
          <div
            key={k.key}
            data-crop-corner={k.key}
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-white bg-accent"
            style={{ left: pct(k.left), top: pct(k.top), cursor: k.cursor }}
            onPointerDown={(e) => start(e, { kind: "corner", ax: k.ax, ay: k.ay })}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-small text-fg-faint">
          {whole ? "The whole picture" : `${Math.round(c.w * 100)}% × ${Math.round(c.h * 100)}% of it`}
        </span>
        <Button variant="outline" size="xs" disabled={whole} onClick={() => { play("tap"); onChange(undefined); }}>
          Whole picture
        </Button>
      </div>
    </div>
  );
}
