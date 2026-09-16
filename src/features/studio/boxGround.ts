/**
 * How the words on a box read on his texture.
 *
 * There is no ground under them. There was: a near-black plate in the
 * box's hue behind every run of words, and he asked for it to go, on the
 * red, the green and the blue alike, because it covered the texture. The
 * texture is his and shows edge to edge now, and the words read by what
 * they are: heavier, a little larger where they were small, and each
 * glyph casting its own dark edge, which lifts a letter off a bright
 * filament without putting anything behind the line. `BODY` is the
 * colour a body line is set in, near white, the same on all three hues.
 *
 * The hue comes off `--box-hue`, which every box sets on itself (152 for
 * an iteration, 210 for a lane's work, 18 for a drawing).
 */
export const BODY = "oklch(0.96 0.015 var(--box-hue, 152))";

/** The edge every glyph on a box casts: tight and dark, then a soft dark halo. Set once on the box; every word in it inherits it. */
export const EDGE = "0 1px 1px oklch(0.08 0.03 var(--box-hue, 152) / 0.95), 0 0 5px oklch(0.08 0.03 var(--box-hue, 152) / 0.85), 0 0 2px oklch(0.08 0.03 var(--box-hue, 152) / 0.9)";
