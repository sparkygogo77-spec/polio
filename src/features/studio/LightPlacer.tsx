"use client";
/**
 * Putting the page's lamp down by hand.
 *
 * A lamp has a place in a room, and the honest way to say where is to point at
 * it. So this takes the board over for a moment: everything on the workspace
 * but the page goes dark, the pointer becomes the light itself — a small warm
 * ball with its own glow — and the page underneath it lights and shadows as
 * the ball moves, before anything is committed. Press on the page to put the
 * lamp down; press anywhere else and the lamp goes back to where it was.
 *
 * The press does not end it. Keep hold and drag: up for heavier shadows, down
 * for lighter, with the number showing under the ball. That is one gesture for
 * the two things you actually decide about a light — where it is and how hard
 * it is — and it ends when you let go.
 *
 * What it never does is turn the page's own light on. The lamp throws shadows;
 * whether any of it lands on the background is a separate setting, off by
 * default, because a warm pool under a palette someone chose is the fastest
 * way to make that palette look like a mistake.
 */
import * as React from "react";
import { play } from "@/core/audio/engine";
import { closeRadial } from "./RadialMenu";
import { useStudio } from "./store";

/** How far you drag for the shadows to go from nothing to as dark as they get. */
const DRAG_FOR_FULL = 260;

interface Rect { x: number; y: number; w: number; h: number }

const rectOf = (sel: string): Rect | null => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};

export function LightPlacer() {
  const placing = useStudio((s) => s.placingLight);
  const light = useStudio((s) => s.look.light);
  const [page, setPage] = React.useState<Rect | null>(null);
  const [board, setBoard] = React.useState<Rect | null>(null);
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  // Held: where the lamp was put down, and how dark the shadows were then.
  const held = React.useRef<{ y: number; strength: number } | null>(null);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number } | null>(null);

  // The page moves under pan and zoom, so it is measured again whenever either
  // changes as well as on the way in. Nothing can pan while this is up — the
  // board is behind the overlay — so that is every way it can move.
  const zoom = useStudio((s) => s.zoom);
  const pan = useStudio((s) => s.pan);
  React.useEffect(() => {
    if (!placing) return;
    const measure = () => {
      setPage(rectOf("[data-frame]"));
      setBoard(rectOf("[data-studio-scroll]"));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [placing, zoom, pan]);

  // The wheel goes away for the duration: it is a menu about the page and it
  // is sitting on top of the page you are about to point at.
  React.useEffect(() => {
    if (placing) closeRadial();
  }, [placing]);

  React.useEffect(() => {
    if (!placing) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      play("close");
      useStudio.getState().cancelPlacingLight();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [placing]);

  if (!placing) return null;

  const inside = (p: { x: number; y: number }) =>
    !!page && p.x >= page.x && p.x <= page.x + page.w && p.y >= page.y && p.y <= page.y + page.h;

  /** Where the pointer is on the page, as fractions, so the lamp keeps its place when the frame changes width. */
  const onPage = (p: { x: number; y: number }) => ({
    x: page ? Math.max(-1, Math.min(2, (p.x - page.x) / page.w)) : 0.5,
    y: page ? Math.max(-1, Math.min(2, (p.y - page.y) / page.h)) : 0.12,
  });

  const set = (patch: Partial<typeof light>) => {
    const st = useStudio.getState();
    st.setLook({ light: { ...st.look.light, ...patch } });
  };

  const move = (e: React.PointerEvent) => {
    const p = { x: e.clientX, y: e.clientY };
    setAt(p);
    const grip = held.current;
    if (grip) {
      // Up is heavier. The lamp itself stays where it was put down.
      const next = Math.max(0, Math.min(1, grip.strength + (grip.y - p.y) / DRAG_FOR_FULL));
      set({ strength: next });
      return;
    }
    // Before it is put down the page still lights up under the ball, so what
    // you are choosing is the thing you are looking at.
    if (inside(p)) set({ on: true, ...onPage(p) });
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = { x: e.clientX, y: e.clientY };
    if (!inside(p)) {
      play("close");
      useStudio.getState().cancelPlacingLight();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    play("confirm");
    set({ on: true, ...onPage(p) });
    held.current = { y: p.y, strength: useStudio.getState().look.light.strength };
    setAnchor(p);
  };

  const up = () => {
    if (!held.current) return;
    held.current = null;
    setAnchor(null);
    play("select");
    useStudio.getState().setPlacingLight(false);
  };

  const warm = Math.round(light.warmth);
  const ball = 12 + light.strength * 10;
  const glow = 26 + light.strength * 46;
  const ballAt = anchor ?? at;
  const dragging = !!anchor;

  return (
    <div
      data-light-placer=""
      role="application"
      aria-label="Put the light where you want it"
      className="fixed inset-0 z-[70] cursor-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => { e.preventDefault(); useStudio.getState().cancelPlacingLight(); }}
      style={{ touchAction: "none" }}
    >
      {/* The dark: the workspace, with the page cut out of it. Clipped to the
          board, so the panels and the bars stay lit and readable. */}
      {board ? (
        <div className="pointer-events-none absolute overflow-hidden" style={{ left: board.x, top: board.y, width: board.w, height: board.h }}>
          <div
            className="absolute rounded-[3px]"
            style={{
              left: (page?.x ?? board.x) - board.x,
              top: (page?.y ?? board.y) - board.y,
              width: page?.w ?? 0,
              height: page?.h ?? 0,
              boxShadow: "0 0 0 9999px oklch(0.05 0.01 280 / 0.86)",
              // A hairline round the hole, in the lamp's own colour: on a dark
              // board a dark dim is not much of a difference, and the point of
              // the moment is that the page is the thing being lit.
              outline: `1px solid oklch(0.85 0.12 ${warm} / 0.55)`,
              transition: "box-shadow 200ms ease-out",
            }}
          />
        </div>
      ) : null}

      {/* While the strength is being dragged the lamp stays where it was put
          down and a line runs to the hand, because the lamp is not the thing
          moving. */}
      {anchor && at ? (
        <svg className="pointer-events-none absolute inset-0 size-full">
          <line
            x1={anchor.x} y1={anchor.y} x2={at.x} y2={at.y}
            stroke={`oklch(0.85 0.12 ${warm} / 0.5)`}
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
        </svg>
      ) : null}

      {/* The light itself, under the hand. */}
      {ballAt ? (
        <div
          data-light-ball=""
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: ballAt.x,
            top: ballAt.y,
            width: ball,
            height: ball,
            background: `radial-gradient(circle at 38% 34%, oklch(1 0.05 ${warm}), oklch(0.88 0.17 ${warm}) 62%, oklch(0.74 0.19 ${warm}))`,
            boxShadow: `0 0 ${glow}px ${glow / 3}px oklch(0.9 0.17 ${warm} / 0.55), 0 0 2px 1px oklch(0.99 0.05 ${warm})`,
          }}
        />
      ) : null}

      {/* What it is doing, beside the hand rather than in a corner. */}
      {at ? (
        <div
          className="pointer-events-none absolute whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-semibold"
          style={{
            left: at.x + 16,
            top: at.y + 14,
            background: "oklch(0.16 0.02 280 / 0.9)",
            color: `oklch(0.92 0.06 ${warm})`,
            outline: "1px solid oklch(0.4 0.04 280)",
          }}
        >
          {dragging
            ? `Shadows ${Math.round(light.strength * 100)}% — drag up for more`
            : inside(at)
              ? "Press to put the light here"
              : "Press to leave it as it was"}
        </div>
      ) : null}
    </div>
  );
}
