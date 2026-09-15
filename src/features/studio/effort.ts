/**
 * The effort the backend was set to, for every route that asks Claude.
 *
 * The backend surface has an effort setting (low, medium, high) and keeps it
 * in local storage across a close. It reached one route; the body and the
 * reshape routes decided "medium" for themselves and never read what was
 * asked. Every call reads it from here now, so the setting is one setting.
 */
export const EFFORT_KEY = "builder.backend.effort";

/**
 * How long the browser waits for a route that asks Claude before it stops
 * on its own. Longer than any route's own budget (they answer themselves
 * within their `maxDuration`, 180s), so this fires only when nothing
 * arrives at all: a deployment that killed the function with no reply.
 */
export const CALL_DEADLINE_MS = 210_000;
export const EFFORT_IDS = ["low", "medium", "high"] as const;
export type EffortId = (typeof EFFORT_IDS)[number];

export function isEffort(v: unknown): v is EffortId {
  return EFFORT_IDS.includes(v as EffortId);
}

/** What the backend is set to, or high, which is what it starts at. */
export function heldEffort(): EffortId {
  try {
    const v = localStorage.getItem(EFFORT_KEY);
    return isEffort(v) ? v : "high";
  } catch {
    return "high";
  }
}
