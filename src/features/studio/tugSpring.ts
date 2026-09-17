/**
 * A VINE IS A ROPE BEING PICKED UP, NOT A SHAPE BEING SET.
 *
 * HIS WORDS, which are the spec: "the animation just makes it immediately
 * flex … the hover should make it almost like kind of pulse and almost like
 * a rope being picked up on hover then dropped back down. instead of
 * immediately flexing to a new position."
 *
 * So hovering is an **event**, not a state. What was here before was a
 * boolean: the pointer arrives, `tug` becomes 1, the curve is redrawn taut
 * and stays taut for as long as the hand sits there. That is a second
 * resting position, which is the thing he is describing and not wanting.
 *
 * This is a mass on a spring instead. An impulse goes into its velocity and
 * nothing else is set: it lifts, carries past where it started, swings back,
 * and quiets — while the pointer is still on it. The rest position is zero
 * whatever the hand is doing, so nothing is ever held taut.
 *
 * **Arriving and leaving are different motions, deliberately.** A rope
 * picked up rings; a rope let go falls and stops. Two characters rather
 * than one impulse with its sign flipped: the pick is light and springy
 * (about two and a half swings before it is quiet), the drop is heavy and
 * damped (one sag and done). Leaving looks different from arriving because
 * it is different, not because it is the same motion backwards.
 *
 * **And a second hand on it does not stack or jerk.** An impulse is added
 * to whatever velocity the rope already has, and `x` is never assigned. A
 * rope picked up while it is still swinging carries on from where it
 * actually is, which is what a rope does.
 *
 * Pure, because the numbers below are the whole of the feel and a feel that
 * can only be checked by looking at it is a feel nobody can keep:
 * `tests/vine-alive.mjs` runs this and reads the swing count, the overshoot
 * and the time to quiet straight out of it.
 */

/** Where the rope is, how fast, and which motion it is in the middle of. */
export interface Rope {
  /**
   * Displacement, at rest 0.
   *
   * Positive is picked up — the bow comes out of the curve and it draws
   * taut. Negative is sagging past where it hangs, which is the swing back
   * and the fall. `strandPath` takes it signed and clamps to ±1.
   */
  x: number;
  /** How fast it is moving, in displacement per second. */
  v: number;
  which: "pick" | "drop";
}

/** One character of motion: a stiffness, a damping, and the kick that starts it. */
export interface Character {
  /** Stiffness. Sets how fast it swings: 2π√k⁻¹ seconds a swing. */
  k: number;
  /** Damping. Against 2√k it sets how many swings there are before quiet. */
  c: number;
  /** What goes into the velocity when the event happens. */
  kick: number;
}

/**
 * Picked up: light, springy, about two and a half swings.
 *
 * ζ = c / 2√k = 0.28, so each swing is 40% of the one before — a clear lift,
 * a clear pass back under the resting line, a smaller one, quiet. ω₀ = 13.8
 * rad/s is a swing every 0.46s, which is a rope of this length rather than a
 * guitar string or a hawser.
 */
export const PICK: Character = { k: 190, c: 7.7, kick: 21 };

/**
 * Let go: heavier, and it does not ring.
 *
 * ζ = 0.51 and a slower swing, so it falls past the line once and settles,
 * quiet in 1.03s. The kick is half the pick's because a rope dropped falls
 * under its own weight rather than being thrown: it sags to -0.51, which is
 * 79.3px of bow on that same run, and comes back up to rest without ringing.
 */
export const DROP: Character = { k: 86, c: 9.4, kick: -10 };

export const REST: Rope = { x: 0, v: 0, which: "drop" };

/** Below these it is quiet enough to stop drawing it. */
const STILL_X = 0.004;
const STILL_V = 0.02;

/** A hand arrives: add the lift to whatever it is already doing. */
export function pickUp(r: Rope): Rope {
  return { x: r.x, v: r.v + PICK.kick, which: "pick" };
}

/** And leaves: the fall is its own motion, from wherever the rope actually is. */
export function letGo(r: Rope): Rope {
  return { x: r.x, v: r.v + DROP.kick, which: "drop" };
}

/**
 * One frame of it.
 *
 * Semi-implicit Euler — the velocity is stepped first and the position with
 * the new velocity — because it does not gain energy the way the plain kind
 * does, and a rope that grows louder the longer you watch it is a bug that
 * only shows up on a slow machine. `dt` is capped at a fiftieth of a second
 * so a tab coming back from the background does not integrate one enormous
 * step and throw the vine off the board.
 */
export function step(r: Rope, dt: number): Rope {
  const m = r.which === "pick" ? PICK : DROP;
  const h = Math.max(0, Math.min(0.02, dt));
  const v = r.v + (-m.k * r.x - m.c * r.v) * h;
  return { x: r.x + v * h, v, which: r.which };
}

/** Quiet enough to stop: the loop drops it and the vine is drawn at rest. */
export function still(r: Rope): boolean {
  return Math.abs(r.x) < STILL_X && Math.abs(r.v) < STILL_V;
}
