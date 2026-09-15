/**
 * The plan for a recorded tour: what it will do with the time it has, and
 * with the width it was asked for. Pure, so a test can hold it.
 *
 * The route has `maxDuration` seconds and used to spend them blind: a slow
 * tour looped four times over a long page ran past them, then ffmpeg had a
 * flat two minutes of its own, and the platform killed the function with
 * no response at all. The plan splits the time three ways, launch, tour and
 * ffmpeg, so the tour has a deadline it stops at and ffmpeg an allowance
 * that fits after it. A width that is not one the recorder takes was made
 * 960 with nothing said; the plan says so.
 */

export interface TourAsk {
  speed?: string;
  loops?: number;
  width?: number;
}

export interface TourPlan {
  pxPerSec: number;
  loops: number;
  width: number;
  /** The width asked for was not one the recorder takes, and `width` is the one used instead. */
  coerced: boolean;
  /** What to tell the caller about the width, or nothing. */
  note: string | null;
  /** The time the tour itself may take, once the page is up. */
  tourMs: number;
  /** What ffmpeg may take after it. */
  ffmpegMs: number;
  /** What opening the browser and the page is allowed before the tour starts. */
  launchMs: number;
}

/** The widths the recorder takes. */
export const TOUR_WIDTHS = [640, 960, 1280] as const;
/** What the browser and the page get to come up. */
export const LAUNCH_MS = 20_000;
/** The most ffmpeg gets, whatever the route's time; a GIF of a two-minute tour does not need more. */
export const FFMPEG_MAX_MS = 60_000;

export function tourPlan(ask: TourAsk, maxDuration: number): TourPlan {
  const pxPerSec = ask.speed === "slow" ? 160 : ask.speed === "fast" ? 540 : 300;
  const loops = Math.max(1, Math.min(4, Math.round(Number(ask.loops) || 1)));
  const asked = typeof ask.width === "number" && Number.isFinite(ask.width) ? ask.width : null;
  const width = asked !== null && (TOUR_WIDTHS as readonly number[]).includes(asked) ? asked : 960;
  const coerced = asked !== null && width !== asked;
  const note = coerced ? `width ${asked} is not one of ${TOUR_WIDTHS.join(", ")}; ${width} used` : null;
  const total = Math.max(30, maxDuration) * 1000;
  const ffmpegMs = Math.min(FFMPEG_MAX_MS, Math.round(total * 0.3));
  const launchMs = Math.min(LAUNCH_MS, Math.round(total * 0.15));
  const tourMs = total - ffmpegMs - launchMs;
  return { pxPerSec, loops, width, coerced, note, tourMs, ffmpegMs, launchMs };
}
