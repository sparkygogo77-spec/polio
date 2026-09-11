/**
 * A cube's faces, worked out from what the author already typed.
 *
 * No model is asked what goes on the sides. The board's own content field
 * is a list — "Comma-separated. The board draws exactly this." — and a
 * prompt written as a list is a list too, so a cube with three pillars in
 * it gets one pillar a face and three blank faces. Blank is the right
 * answer for a face nobody has written: inventing filler for it is the
 * thing that makes a generated page read as generated.
 *
 * Pure, and tested by `tests/cube.mjs`.
 */
import { CUBE_SIDES, emptyCube, emptyFace, type CubeData, type CubeFace } from "./types.ts";

export { CUBE_SIDES, emptyCube, emptyFace };
export type { CubeData, CubeFace };

/** Words that mean "this is a cube" rather than being something to write on one. */
const CUBE_WORDS = /\b(cube|cuboid|box|3d box|hexahedron)\b/i;

export function saysCube(words: string): boolean {
  return CUBE_WORDS.test(words ?? "");
}

/**
 * Split what was typed into one item a face.
 *
 * Newlines first, then semicolons, then commas: a person writing a list of
 * three things separates them the way they separate them, and the coarsest
 * separator present is the one they meant. A single run-on sentence is one
 * item, which is one face, which is correct.
 */
export function faceItems(text: string): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  const on = raw.includes("\n") ? /\n+/ : raw.includes(";") ? /;+/ : /,/;
  return raw
    .split(on)
    .map((v) => v.replace(/^[\s\-•·*\d.)]+/, "").trim())
    .filter(Boolean);
}

/** A heading and a line under it, from one item: "Speed: under a second". */
export function faceOf(item: string): CubeFace {
  const cut = /^([^:—–]{1,48})\s*[:—–]\s*(.+)$/.exec(item.trim());
  if (cut) return { heading: cut[1]!.trim(), body: cut[2]!.trim(), colour: "" };
  return { heading: item.trim().slice(0, 64), body: "", colour: "" };
}

/**
 * The six faces for a cube, from the part's content and its prompt.
 *
 * Content wins, because it is the field whose whole job is "what this part
 * shows". The prompt is only read when there is no content, and only when
 * it reads as a list — a sentence about a cube is a description of the
 * cube, not the writing on it, and putting it on the front face would be
 * exactly the filler this avoids.
 */
export function facesFrom(content: string, prompt: string): CubeFace[] {
  let items = faceItems(content);
  if (!items.length) {
    /*
     * "A cube with our three pillars: Speed, Proof, Reach" is a lead-in and
     * then a list. The lead-in is the bit that says cube, so it is dropped
     * only when it actually does; anything else keeps its colon, because
     * "Speed: under a second" is a heading and a line, not a lead-in.
     */
    let text = (prompt ?? "").trim();
    const colon = text.indexOf(":");
    if (colon > 0 && saysCube(text.slice(0, colon))) text = text.slice(colon + 1);
    const said = faceItems(text);
    // One item from a prompt is a sentence about the cube, not a face.
    items = said.length >= 2 ? said : [];
  }
  const faces = items.slice(0, CUBE_SIDES.length).map(faceOf);
  while (faces.length < CUBE_SIDES.length) faces.push(emptyFace());
  return faces;
}

/** How many faces have anything on them. */
export function written(cube: CubeData | null | undefined): number {
  return (cube?.faces ?? []).filter((f) => f.heading.trim() || f.body.trim()).length;
}
