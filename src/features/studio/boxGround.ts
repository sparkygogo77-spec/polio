/**
 * The ground the words on a box sit on.
 *
 * His render is busy and high in contrast, and words set straight on it
 * lost: nine and ten pixel lines in a colour a shade off the surface. The
 * texture is his and stays. What changed is the reading: every run of
 * body words on a box, green, red or blue, sits on this ground, a near
 * black in the box's own hue at four fifths, so the filaments show
 * through the edges of it and the words stand on something calm. `BODY`
 * is the colour the body line is set in on that ground: near white, and
 * the same on all three hues.
 *
 * The hue comes off `--box-hue`, which every box sets on itself (152 for
 * an iteration, 210 for a lane's work, 18 for a drawing), so one ground
 * follows the three surfaces without knowing which it is on.
 */
export const GROUND = "oklch(0.1 0.015 var(--box-hue, 152) / 0.82)";
export const BODY = "oklch(0.96 0.015 var(--box-hue, 152))";
