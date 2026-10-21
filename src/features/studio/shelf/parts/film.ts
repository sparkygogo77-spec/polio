/**
 * A film (the capture's pictures of a part that moved, laid by `captured.ts`
 * as a part of its own over the part it was filmed on) and when it is held
 * back. Plain TypeScript, no JSX: `shelf/run.ts` exports `filmPic` to the
 * board, and every check that reads `run.ts` in Node reads this file with it
 * (`tests/element-list-labels.mjs` could not parse `primitives.tsx`).
 */

/** How far past its frames' own size a film may be stretched before it is held back. */
export const FILM_STRETCH = 1.5;

/**
 * A film's picture as a part draws it: marked `pinned` when the part it was
 * filmed on is itself fixed to the window. Such a part has no one place on
 * the page to film, and it draws itself already: thesolface's cursor glow
 * (a radial gradient, `n_box_306`) came with a film of itself 450×450 at
 * y 293, only 1.32× its frames, a second glow standing still (J, 2026-10-21).
 * A pinned film is held back like a stretched one (tests/film-stretch.mjs).
 */
export function filmPic<P extends { moving?: { kind: string; pinned?: boolean } | null }>(node: { picture?: P | null; from?: { position?: string } | null }): P | null | undefined {
  const pic = node.picture;
  if (!pic?.moving || node.from?.position !== "fixed") return pic;
  return { ...pic, moving: { ...pic.moving, pinned: true } };
}
