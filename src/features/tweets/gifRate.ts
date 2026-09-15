/**
 * How fast a recording is written as a GIF, so that it keeps its length.
 *
 * The recorder thins frames to stay under a cap. It used to hold the rate
 * to at least 4 fps as well, and the cap then cut the recording short: a
 * five-minute recording at 4 fps is 1200 frames, the cap was 360, and the
 * GIF stopped at ninety seconds while the comment said the length was kept.
 * The rate now goes as low as the length needs. Pure, so a test can hold it.
 */
export function gifRate(duration: number, fps: number, maxFrames: number): { fps: number; frames: number } {
  const asked = Math.max(0.01, fps);
  const cap = Math.max(1, Math.round(maxFrames));
  if (!(duration > 0) || !Number.isFinite(duration)) return { fps: asked, frames: cap };
  const rate = Math.min(asked, cap / duration);
  return { fps: rate, frames: Math.min(cap, Math.max(1, Math.round(rate * duration))) };
}
