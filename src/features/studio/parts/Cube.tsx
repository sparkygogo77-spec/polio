"use client";
/**
 * A cube, turning, with something written on every side.
 *
 * This is the part a vectoriser cannot make. A traced drawing is a picture,
 * and a picture of a cube does not turn; the six faces have to be six real
 * elements in a space, and what is written on them has to still be text
 * afterwards. So the drawing does what a drawing is good at — it says this
 * is a box, how big, and in what proportion — and the element itself is
 * code.
 *
 * How it works, and why:
 *
 * - Six absolutely-placed faces inside a `preserve-3d` box, each rotated
 *   into place and pushed out half the depth. No library: the browser
 *   already has a 3D transform, and a part that shipped three.js would be a
 *   part no generated site could carry.
 * - **It is the proportion it was drawn at.** A square box is a cube; a box
 *   drawn twice as wide as it is tall is a box twice as wide as it is tall,
 *   as deep as its shorter side. The part's own box sets the width and the
 *   height, so resizing it by the handle reproportions the object, exactly
 *   as it reproportions a flat part.
 * - Dragging turns it. Movement is converted at a fixed degrees-per-pixel
 *   so it feels the same at any size or zoom, and on release the last few
 *   pointer samples become spin that decays.
 * - **It cannot be tumbled into nonsense.** Yaw is free; pitch is held
 *   within `PITCH_LIMIT` of level, so it is never upside down.
 * - **It has a resting pose it returns to.** When the spin dies it eases to
 *   the nearest rest: the three-quarter view from a little above that shows
 *   a cube is a cube, turned a quarter at a time round the yaw, or tipped
 *   to look down on the top or up at the bottom. Whatever it is left at is
 *   a pose where one face reads and two others show, never a flat square
 *   and never an edge.
 * - Arrow keys step between rests: left and right round the sides, up to
 *   the top, down to the bottom. The cube is focusable and says what it is,
 *   because a thing you can turn with a pointer must be turnable without
 *   one.
 * - **A face can be pointed at.** A press that does not become a drag says
 *   which face was under it (`cube-face`), so the board can pick that face
 *   and the panel can edit it; the picked face wears the board's mark.
 *   Pointing at a face from elsewhere (`pick`) turns the cube to show it.
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
import { CUBE_SIDES, REST, num, opt, type CubeFace, type CubeSide, type PartProps } from "./types";
import { clampPitch, cubeDims, facing, foldYaw, nearestRest, PLACE, restFor, REST_PITCHES } from "./cubePose";

const rad = (d: number) => (d * Math.PI) / 180;

export { cubeDims, facing, nearestRest, restFor, restPitch, restYaw, PITCH_LIMIT, REST_PITCHES } from "./cubePose";

/** Degrees per pixel dragged. Slow enough to place a face, quick enough to spin. */
const PER_PX = 0.42;
/** How fast the spin dies, per frame at 60fps. */
const DECAY = 0.94;
/** Under this many degrees a frame, it is done spinning and settles. */
const SETTLE = 0.35;
/** How quickly it eases onto the nearest rest. */
const SNAP = 0.16;
/** A press that moves less than this is a point at a face, not a turn. */
const POINT_PX = 4;

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

export function Cube({ id, label, content, w, h, theme: t, mode, cube, pick, options, emit }: PartProps) {
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
  const start = cube?.turn ?? { ...REST };
  const { W, H, D } = cubeDims(w, h, num(options, "size", 74, 30, 100) / 100);
  const live = mode === "live";
  const showEmpty = opt(options, "empty faces", "hold their place") === "hold their place";

  const [turn, setTurn] = React.useState(start);
  // The angle as of the last render, for the handlers: a state updater
  // must stay pure (React runs it twice in development), so anything that
  // decides where to go next reads this rather than deciding inside one.
  const turnRef = React.useRef(start);
  turnRef.current = turn;
  const spin = React.useRef({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; at: number; fromX: number; fromY: number; on: CubeSide | null } | null>(null);
  const frame = React.useRef(0);
  const held = React.useRef(false);
  /** Where it is being sent, when a face was asked for; null means the nearest rest. */
  const goal = React.useRef<{ x: number; y: number } | null>(null);
  /*
   * Nothing snaps until it has been turned.
   *
   * The angle it is left standing at is a three-quarter view, which is the
   * one that shows a cube is a cube; snapping on arrival would move it
   * before anyone touched it.
   */
  const touched = React.useRef(false);
  const said = React.useRef(`${start.x},${start.y}`);
  React.useEffect(() => { if (!live) { touched.current = false; goal.current = null; setTurn(start); } }, [live, start.x, start.y]);

  /*
   * A face pointed at from elsewhere — the panel, the wheel — is shown.
   * Only when it is not already the one in front: turning a cube that is
   * showing the face you asked for would be answering a question with a
   * flourish.
   */
  const picked = (pick?.id ?? "") as CubeSide | "";
  React.useEffect(() => {
    if (!live || !picked || !(picked in PLACE)) return;
    const v = turnRef.current;
    if (CUBE_SIDES[facing(v)] === picked) return;
    touched.current = true;
    spin.current = { x: 0, y: 0 };
    goal.current = restFor(picked, v);
  }, [live, picked]);

  /* The one loop: spin down, then ease onto the nearest rest. */
  React.useEffect(() => {
    if (!live) return;
    const tick = () => {
      frame.current = requestAnimationFrame(tick);
      if (held.current || !touched.current) return;
      const s = spin.current;
      if (Math.abs(s.x) > SETTLE || Math.abs(s.y) > SETTLE) {
        const v = turnRef.current;
        // The limit is a wall: spin into it and the spin is spent, so it
        // does not sit pinned there while a spin it cannot use dies down.
        if (clampPitch(v.x + s.x) !== v.x + s.x) s.x = 0;
        setTurn((w) => ({ x: clampPitch(w.x + s.x), y: w.y + s.y }));
        s.x *= DECAY;
        s.y *= DECAY;
        return;
      }
      s.x = 0;
      s.y = 0;
      setTurn((v) => {
        const want = goal.current ?? nearestRest(v);
        const dx = want.x - v.x;
        const dy = want.y - v.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
          goal.current = null;
          // Settled, and the yaw folded back into one turn: four quarter
          // turns are the same pose as none, and the number kept says so.
          const rest = { x: want.x, y: foldYaw(want.y) };
          // Where it was left is worth keeping, so it is said once and the
          // board draws that angle from then on.
          const key = `${rest.x},${rest.y}`;
          if (key !== said.current) {
            said.current = key;
            emit?.({ type: "cube", turn: rest });
          }
          return rest.x === v.x && rest.y === v.y ? v : rest;
        }
        return { x: v.x + dx * SNAP, y: v.y + dy * SNAP };
      });
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [live, emit]);

  const down = (e: React.PointerEvent) => {
    // Only the hand that turns: a right press is the board's, and opens
    // the wheel about the part as it does on every other part.
    if (!live || e.button !== 0) return;
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
    const on = ((e.target as HTMLElement).closest?.("[data-face]") as HTMLElement | null)?.dataset.face as CubeSide | undefined;
    drag.current = { x: e.clientX, y: e.clientY, at: performance.now(), fromX: e.clientX, fromY: e.clientY, on: on && on in PLACE ? on : null };
    spin.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!live || !d) return;
    e.stopPropagation();
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { ...d, x: e.clientX, y: e.clientY, at: performance.now() };
    if (Math.hypot(e.clientX - d.fromX, e.clientY - d.fromY) >= POINT_PX) {
      touched.current = true;
      goal.current = null;
    }
    // A drag left turns the cube left: y follows x, x follows y inverted.
    const v = turnRef.current;
    const pinned = clampPitch(v.x - dy * PER_PX) !== v.x - dy * PER_PX;
    spin.current = { x: pinned ? 0 : -dy * PER_PX, y: dx * PER_PX };
    setTurn((w) => ({ x: clampPitch(w.x - dy * PER_PX), y: w.y + dx * PER_PX }));
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    if (live && d) e.stopPropagation();
    held.current = false;
    drag.current = null;
    if (live) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    // A press that never became a drag is a point at the face under it.
    if (live && d && Math.hypot(e.clientX - d.fromX, e.clientY - d.fromY) < POINT_PX) {
      spin.current = { x: 0, y: 0 };
      if (d.on) emit?.({ type: "cube-face", side: d.on });
    }
  };
  const key = (e: React.KeyboardEvent) => {
    if (!live) return;
    const step = { ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!step) return;
    e.preventDefault();
    // The board nudges the selected part with the arrows; while the cube has
    // the keys, they turn it instead of moving it.
    e.stopPropagation();
    touched.current = true;
    spin.current = { x: 0, y: 0 };
    const at = goal.current ?? nearestRest(turnRef.current);
    if (step[1]) {
      goal.current = { x: at.x, y: at.y + step[1] };
    } else {
      // Up looks down on the top, down looks up at the bottom; at either
      // end it stays where it is rather than going over.
      const i = REST_PITCHES.indexOf(at.x);
      const next = REST_PITCHES[Math.max(0, Math.min(REST_PITCHES.length - 1, (i < 0 ? 1 : i) + step[0]!))]!;
      goal.current = { x: next, y: at.y };
    }
  };

  const from = t.lightFrom ?? { x: 0.3, y: 0.2 };
  const filled = faces.filter((f) => f.heading.trim() || f.body.trim()).length;
  const mark = pick?.colour ?? t.accent;

  return (
    <Fill t={t} data-part={id}>
      <div
        data-cube=""
        data-cube-turn={`${Math.round(turn.x)},${Math.round(turn.y)}`}
        data-cube-face={CUBE_SIDES[facing(turn)]}
        data-cube-faces={filled}
        data-cube-dims={`${W}×${H}×${D}`}
        data-cube-pick={picked || undefined}
        role="img"
        tabIndex={live ? 0 : -1}
        aria-label={`${label}, a cube of ${filled} face${filled === 1 ? "" : "s"}. Drag to turn it, or use the arrow keys. Press a face to pick it.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        style={{
          width: "100%", height: "100%", display: "grid", placeItems: "center",
          perspective: `${Math.round(Math.max(W, H) * 3.4)}px`,
          cursor: live ? "grab" : "default",
          touchAction: "none",
          outline: "none",
        }}
      >
        <div
          style={{
            width: W, height: H, position: "relative",
            transformStyle: "preserve-3d",
            transform: `translateZ(${-D / 2}px) rotateX(${turn.x}deg) rotateY(${turn.y}deg)`,
          }}
        >
          {CUBE_SIDES.map((name, i) => {
            const place = PLACE[name];
            const face = faces[i]!;
            const bare = !face.heading.trim() && !face.body.trim();
            if (bare && !showEmpty) return null;
            const lit = litness(place.normal, turn.x, turn.y, from);
            const ground = faceColour(face, t);
            // Each face's own size and how far out it sits: the front and
            // back are the box's face, the sides are as wide as it is deep,
            // the top and bottom as tall as it is deep.
            const fw = name === "left" || name === "right" ? D : W;
            const fh = name === "top" || name === "bottom" ? D : H;
            const out = name === "left" || name === "right" ? W / 2 : name === "top" || name === "bottom" ? H / 2 : D / 2;
            const side = Math.min(fw, fh);
            const isPicked = picked === name;
            return (
              <div
                key={name}
                data-face={name}
                data-face-empty={bare ? "" : undefined}
                data-face-picked={isPicked ? "" : undefined}
                style={{
                  position: "absolute", left: "50%", top: "50%", width: fw, height: fh,
                  transform: `translate(-50%, -50%) rotateX(${place.rx}deg) rotateY(${place.ry}deg) translateZ(${out}px)`,
                  background: ground,
                  border: `1px solid ${withAlpha(t.line, 0.9)}`,
                  // The pick is drawn as the board draws a selection: a thin
                  // line in the mark's colour, inside the edge.
                  outline: isPicked ? `2px solid ${mark}` : undefined,
                  outlineOffset: isPicked ? -3 : undefined,
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

