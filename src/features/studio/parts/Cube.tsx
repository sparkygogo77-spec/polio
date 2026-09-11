"use client";
/**
 * A cube, turning, with something written on every side.
 *
 * This is the part a vectoriser cannot make. A traced drawing is a picture,
 * and a picture of a cube does not turn; the six faces have to be six real
 * elements in a space, and what is written on them has to still be text
 * afterwards. So the drawing does what a drawing is good at — it says this
 * is a cube, how big, and in what proportion — and the element itself is
 * code.
 *
 * How it works, and why:
 *
 * - Six absolutely-placed faces inside a `preserve-3d` box, each rotated
 *   into place and pushed out half the cube's side. No library: the browser
 *   already has a 3D transform, and a part that shipped three.js would be a
 *   part no generated site could carry.
 * - Dragging turns it. Movement is converted at a fixed degrees-per-pixel
 *   so it feels the same at any size or zoom, and on release the last few
 *   pointer samples become spin that decays.
 * - When the spin falls under a threshold it **snaps to the nearest face**,
 *   easing to the closest right angle on both axes, so it is never left at
 *   an angle where nothing is readable.
 * - Arrow keys step a quarter turn. The cube is focusable and says what it
 *   is, because a thing you can turn with a pointer must be turnable
 *   without one.
 * - It takes the page's light like every other part: each face is shaded by
 *   how much it faces the lamp, so the cube sits in the same room as the
 *   rest of the page rather than glowing on its own.
 *
 * Board mode is one still frame, as the rule says: the angle stored on the
 * node, no rAF, no listeners. Live mode is the whole thing.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { withAlpha, type Theme } from "./theme";
import { facesFrom } from "./cubeFaces";
import { CUBE_SIDES, num, opt, type CubeFace, type PartProps } from "./types";

/** Degrees per pixel dragged. Slow enough to place a face, quick enough to spin. */
const PER_PX = 0.42;
/** How fast the spin dies, per frame at 60fps. */
const DECAY = 0.94;
/** Under this many degrees a frame, it is done spinning and settles. */
const SETTLE = 0.35;
/** How quickly it eases onto the nearest face. */
const SNAP = 0.16;

/** Where each face sits, and which way it looks. */
const PLACE: Record<string, { rx: number; ry: number; normal: [number, number, number] }> = {
  front: { rx: 0, ry: 0, normal: [0, 0, 1] },
  right: { rx: 0, ry: 90, normal: [1, 0, 0] },
  back: { rx: 0, ry: 180, normal: [0, 0, -1] },
  left: { rx: 0, ry: -90, normal: [-1, 0, 0] },
  top: { rx: 90, ry: 0, normal: [0, -1, 0] },
  bottom: { rx: -90, ry: 0, normal: [0, 1, 0] },
};

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * How much a face is turned toward the light, 0..1.
 *
 * The face's normal is rotated by the cube's own rotation and compared with
 * the lamp's direction. This is the only place the part does its own
 * lighting maths, and it is worth it: without it a turning cube is six flat
 * rectangles and reads as a folded net rather than a solid.
 */
function litness(normal: [number, number, number], rx: number, ry: number, from: { x: number; y: number }): number {
  const [nx0, ny0, nz0] = normal;
  const cy = Math.cos(rad(ry));
  const sy = Math.sin(rad(ry));
  const cx = Math.cos(rad(rx));
  const sx = Math.sin(rad(rx));
  // Y first, then X: the same order the transform applies them.
  const x1 = nx0 * cy + nz0 * sy;
  const z1 = -nx0 * sy + nz0 * cy;
  const y2 = ny0 * cx - z1 * sx;
  const z2 = ny0 * sx + z1 * cx;
  // The lamp: where the page says it is, pushed out in front of the page.
  const lx = (from.x - 0.5) * 2;
  const ly = (from.y - 0.5) * 2;
  const len = Math.hypot(lx, ly, 1) || 1;
  const dot = (x1 * lx + y2 * ly + z2 * 1) / len;
  return Math.max(0, Math.min(1, 0.5 + dot * 0.5));
}

/** The nearest right angle. */
const quarter = (d: number) => Math.round(d / 90) * 90;

/** A face's own colour, or the site's surface. */
function faceColour(face: CubeFace | undefined, t: Theme): string {
  const own = (face?.colour ?? "").trim();
  if (!own) return t.surface;
  if (own === "accent") return t.accent;
  if (own === "highlight") return t.highlight;
  if (own === "bg") return t.bg;
  if (own === "surface") return t.surface;
  if (own === "muted") return withAlpha(t.muted, 0.3);
  return own;
}

export function Cube({ id, label, content, w, h, theme: t, mode, cube, options, emit }: PartProps) {
  /*
   * The faces on the node win, and they are what the panel edits. A cube
   * that has never been edited — dropped straight off the shelf — reads its
   * content field instead, like every other part in the library, and falls
   * back to three examples so the shelf shows a cube rather than a blank
   * box. The moment a face is written the node holds all six.
   */
  const faces = React.useMemo<CubeFace[]>(() => {
    const own = cube?.faces;
    if (own?.some((f) => f.heading.trim() || f.body.trim())) return CUBE_SIDES.map((_, i) => own[i] ?? { heading: "", body: "", colour: "" });
    const typed = facesFrom(content, "");
    if (typed.some((f) => f.heading.trim())) return typed;
    return facesFrom("Overview, How it works, Proof", "");
  }, [cube, content]);
  const start = cube?.turn ?? { x: -18, y: -32 };
  const side = Math.round(Math.min(w, h) * (num(options, "size", 74, 30, 100) / 100));
  const live = mode === "live";
  const showEmpty = opt(options, "empty faces", "hold their place") === "hold their place";

  const [turn, setTurn] = React.useState(start);
  const spin = React.useRef({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; at: number } | null>(null);
  const frame = React.useRef(0);
  const held = React.useRef(false);
  /*
   * Nothing snaps until it has been turned.
   *
   * The angle it is left standing at is a three-quarter view, which is the
   * one that shows a cube is a cube; snapping on arrival would square it up
   * to a flat face before anyone touched it and every cube on the page
   * would read as a card.
   */
  const touched = React.useRef(false);
  const said = React.useRef(`${start.x},${start.y}`);
  React.useEffect(() => { if (!live) { touched.current = false; setTurn(start); } }, [live, start.x, start.y]);

  /* The one loop: spin down, then ease onto the nearest face. */
  React.useEffect(() => {
    if (!live) return;
    const tick = () => {
      frame.current = requestAnimationFrame(tick);
      if (held.current || !touched.current) return;
      const s = spin.current;
      if (Math.abs(s.x) > SETTLE || Math.abs(s.y) > SETTLE) {
        setTurn((v) => ({ x: v.x + s.x, y: v.y + s.y }));
        s.x *= DECAY;
        s.y *= DECAY;
        return;
      }
      s.x = 0;
      s.y = 0;
      setTurn((v) => {
        const wantX = quarter(v.x);
        const wantY = quarter(v.y);
        const dx = wantX - v.x;
        const dy = wantY - v.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
          // Settled. Where it was left is worth keeping, so it is said once
          // and the board draws that angle from then on.
          const key = `${wantX},${wantY}`;
          if (key !== said.current) {
            said.current = key;
            emit?.({ type: "cube", turn: { x: wantX, y: wantY } });
          }
          return wantX === v.x && wantY === v.y ? v : { x: wantX, y: wantY };
        }
        return { x: v.x + dx * SNAP, y: v.y + dy * SNAP };
      });
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [live, emit]);

  const down = (e: React.PointerEvent) => {
    if (!live) return;
    /*
     * The press stops here.
     *
     * The board's own surface takes the pointer on every press and captures
     * it, which is right for a part you are moving and wrong for the one
     * part you are handling. Without this the cube's capture is overridden
     * a moment later and the drag turns into a drag of the whole element.
     */
    e.stopPropagation();
    e.preventDefault();
    held.current = true;
    touched.current = true;
    drag.current = { x: e.clientX, y: e.clientY, at: performance.now() };
    spin.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!live || !d) return;
    e.stopPropagation();
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY, at: performance.now() };
    // A drag left turns the cube left: y follows x, x follows y inverted.
    spin.current = { x: -dy * PER_PX, y: dx * PER_PX };
    setTurn((v) => ({ x: v.x - dy * PER_PX, y: v.y + dx * PER_PX }));
  };
  const up = (e: React.PointerEvent) => {
    if (live && drag.current) e.stopPropagation();
    held.current = false;
    drag.current = null;
    if (live) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };
  const key = (e: React.KeyboardEvent) => {
    if (!live) return;
    const step = { ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [90, 0], ArrowDown: [-90, 0] }[e.key];
    if (!step) return;
    e.preventDefault();
    // The board nudges the selected part with the arrows; while the cube has
    // the keys, they turn it instead of moving it.
    e.stopPropagation();
    touched.current = true;
    spin.current = { x: 0, y: 0 };
    setTurn((v) => ({ x: quarter(v.x) + step[0]!, y: quarter(v.y) + step[1]! }));
  };

  const from = t.lightFrom ?? { x: 0.3, y: 0.2 };
  const filled = faces.filter((f) => f.heading.trim() || f.body.trim()).length;

  return (
    <Fill t={t} data-part={id}>
      <div
        data-cube=""
        data-cube-turn={`${Math.round(turn.x)},${Math.round(turn.y)}`}
        data-cube-face={CUBE_SIDES[facing(turn)]}
        data-cube-faces={filled}
        role="img"
        tabIndex={live ? 0 : -1}
        aria-label={`${label}, a cube of ${filled} face${filled === 1 ? "" : "s"}. Drag to turn it, or use the arrow keys.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        style={{
          width: "100%", height: "100%", display: "grid", placeItems: "center",
          perspective: `${Math.round(side * 3.4)}px`,
          cursor: live ? "grab" : "default",
          touchAction: "none",
          outline: "none",
        }}
      >
        <div
          style={{
            width: side, height: side, position: "relative",
            transformStyle: "preserve-3d",
            transform: `translateZ(${-side / 2}px) rotateX(${turn.x}deg) rotateY(${turn.y}deg)`,
          }}
        >
          {CUBE_SIDES.map((name, i) => {
            const place = PLACE[name]!;
            const face = faces[i]!;
            const bare = !face.heading.trim() && !face.body.trim();
            if (bare && !showEmpty) return null;
            const lit = litness(place.normal, turn.x, turn.y, from);
            const ground = faceColour(face, t);
            return (
              <div
                key={name}
                data-face={name}
                data-face-empty={bare ? "" : undefined}
                style={{
                  position: "absolute", inset: 0,
                  transform: `rotateX(${place.rx}deg) rotateY(${place.ry}deg) translateZ(${side / 2}px)`,
                  background: ground,
                  border: `1px solid ${withAlpha(t.line, 0.9)}`,
                  borderRadius: Math.min(t.radius, side * 0.08),
                  boxSizing: "border-box",
                  padding: Math.round(side * 0.1),
                  display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(side * 0.03),
                  // The lamp, on the face rather than behind it: a wash that
                  // lightens what is turned toward it and darkens what is not.
                  boxShadow: `inset 0 0 ${Math.round(side * 0.9)}px ${withAlpha(t.light ? "#000000" : "#ffffff", (1 - lit) * (t.light ? 0.22 : 0.14))}`,
                  backfaceVisibility: "hidden",
                  overflow: "hidden",
                }}
              >
                {face.heading.trim() ? (
                  <span style={{ fontFamily: t.headingFamily, fontWeight: 650, fontSize: Math.max(11, Math.round(side * 0.11)), lineHeight: 1.15, color: t.text, letterSpacing: "-0.01em" }}>
                    {face.heading}
                  </span>
                ) : null}
                {face.body.trim() ? (
                  <span style={{ fontFamily: t.bodyFamily, fontSize: Math.max(9, Math.round(side * 0.062)), lineHeight: 1.35, color: withAlpha(t.text, 0.72) }}>
                    {face.body}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </Fill>
  );
}

/** Which face is looking at you, from the angle it is turned to. */
export function facing(turn: { x: number; y: number }): number {
  const x = ((Math.round(turn.x / 90) * 90) % 360 + 360) % 360;
  const y = ((Math.round(turn.y / 90) * 90) % 360 + 360) % 360;
  if (x === 90) return 4;
  if (x === 270) return 5;
  return { 0: 0, 90: 3, 180: 2, 270: 1 }[y as 0 | 90 | 180 | 270] ?? 0;
}
