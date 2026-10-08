/**
 * Where a cube can stand, and which face that shows.
 *
 * The maths of the cube's pose, kept out of the part so it can be read by
 * anything without React: the catalogue, the scaffold, a test. Every
 * number here is in degrees.
 */
import { REST, type CubeSide } from "./types.ts";

/** How far over the top or under it may be tilted, in degrees. Past this it is upside down. */
export const PITCH_LIMIT = 85;

/**
 * The pitches it can rest at: looking down on the top, the ordinary view
 * from a little above, and looking up at the bottom. Yaw rests at every
 * quarter turn, offset by the rest pose's own three-quarter angle.
 */
export const REST_PITCHES: readonly number[] = [REST.x - 54, REST.x, REST.x + 90];


/** Where each face sits, and which way it looks. */
export const PLACE: Record<CubeSide, { rx: number; ry: number; normal: [number, number, number] }> = {
  front: { rx: 0, ry: 0, normal: [0, 0, 1] },
  right: { rx: 0, ry: 90, normal: [1, 0, 0] },
  back: { rx: 0, ry: 180, normal: [0, 0, -1] },
  left: { rx: 0, ry: -90, normal: [-1, 0, 0] },
  top: { rx: 90, ry: 0, normal: [0, -1, 0] },
  bottom: { rx: -90, ry: 0, normal: [0, 1, 0] },
};


/** The nearest yaw at rest: a quarter turn plus the rest pose's own angle. */
export const restYaw = (y: number) => Math.round((y - REST.y) / 90) * 90 + REST.y;
/** The nearest pitch at rest. */
export const restPitch = (x: number) => REST_PITCHES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
/** The nearest pose it can come to rest at. */
export const nearestRest = (t: { x: number; y: number }) => ({ x: restPitch(t.x), y: restYaw(t.y) });

/**
 * The rest pose that shows one face, from where the cube is now.
 *
 * Yaw is taken the short way round from the current angle, so asking for
 * the back face from the front turns half a turn, not one and a half.
 */
export function restFor(side: CubeSide, from: { x: number; y: number }): { x: number; y: number } {
  if (side === "top") return { x: REST_PITCHES[0]!, y: restYaw(from.y) };
  if (side === "bottom") return { x: REST_PITCHES[2]!, y: restYaw(from.y) };
  const k = { front: 0, left: 1, back: 2, right: 3 }[side];
  const now = restYaw(from.y);
  const kNow = ((Math.round((now - REST.y) / 90) % 4) + 4) % 4;
  let d = k - kNow;
  if (d > 2) d -= 4;
  if (d < -2) d += 4;
  return { x: REST.x, y: now + d * 90 };
}


export const clampPitch = (x: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, x));
/** The same yaw inside one turn, (-180, 180]. Four quarter turns are no turn. */
export const foldYaw = (y: number) => { const f = ((y + 180) % 360 + 360) % 360 - 180; return f === -180 ? 180 : f; };

/**
 * The object's three dimensions from the part's box.
 *
 * Width and height are the box's, scaled by the size option so the corners
 * have room to swing; depth is the shorter of the two, so a square box is a
 * cube and a wide one is a slab.
 */
export function cubeDims(w: number, h: number, size: number): { W: number; H: number; D: number } {
  const W = Math.max(24, Math.round(w * size));
  const H = Math.max(24, Math.round(h * size));
  return { W, H, D: Math.min(W, H) };
}


/**
 * Which face is looking at you, from the angle it is turned to.
 *
 * Judged against the rest poses: tipped to the top's rest it is the top,
 * tipped to the bottom's it is the bottom, and otherwise the yaw says which
 * of the four sides. Yaw turns the cube, so a positive quarter turn brings
 * the left face round to the front, not the right.
 */
export function facing(turn: { x: number; y: number }): number {
  const x = restPitch(turn.x);
  if (x === REST_PITCHES[0]) return 4;
  if (x === REST_PITCHES[2]) return 5;
  const k = ((Math.round((turn.y - REST.y) / 90) % 4) + 4) % 4;
  return [0, 3, 2, 1][k]!;
}
