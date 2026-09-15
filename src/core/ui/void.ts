/**
 * The void and the screen: one definition, every surface that wears them.
 *
 * The Builder's console is cut from a dark purple-blue with a thin *lighter*
 * rim, because on something that dark the edge has to be the lit line; and
 * anywhere words are typed is a screen — dark teal glass, scanlines, phosphor
 * lettering in a monospaced face. `docs/DESIGN.md` §1 is the long version.
 *
 * These lived in three places: the console defined them, the command palette
 * copied them (core cannot import a feature), and the keys panel imported the
 * console's. The copies had drifted — two "voids" three hundredths of a
 * lightness apart, which is not a colour anybody chose. They live in core
 * now, which everything may import, and the console's own numbers are the
 * ones kept: it is the oldest surface and the one the tests measure.
 *
 * A surface that is neither of these — a page, a panel, a card — uses the
 * shell's tokens (`--panel`, `--elevated`, `--border`). The void is for the
 * things that belong to the Builder's console: the wheel, the palette, the
 * keys panel, the blueprint.
 */

export const VOID = {
  /** A slab at rest. */
  face: "oklch(0.2 0.035 288)",
  /** …and under the hand. */
  faceLit: "oklch(0.26 0.045 288)",
  /** The lit line round it. */
  rim: "oklch(0.36 0.06 290)",
  /** A recess cut into a slab. */
  well: "oklch(0.14 0.03 288)",
  /** A small box on a slab — a chip, a key, a tick. */
  box: "oklch(0.27 0.04 286)",
  text: "oklch(0.92 0.02 285)",
  /** Lettering *on* something light, which on the void means on a lit key. */
  ink: "oklch(0.1 0.02 285)",
  muted: "oklch(0.62 0.03 285)",
  /** What the void casts onto whatever is behind it. */
  drop: "0 0 0 3px oklch(0.05 0.02 290), 0 24px 60px oklch(0 0 0 / 0.6)",
} as const;

export const SCREEN = {
  glass: "radial-gradient(ellipse at 50% 35%, oklch(0.2 0.05 195) 0%, oklch(0.135 0.04 200) 55%, oklch(0.09 0.03 205) 100%)",
  scan: "repeating-linear-gradient(0deg, oklch(0 0 0 / 0.26) 0 1px, transparent 1px 3px)",
  dots: "radial-gradient(circle, oklch(0.62 0.1 190 / 0.09) 0.55px, transparent 0.65px)",
  key: "oklch(0.2 0.045 200)",
  line: "oklch(0.36 0.07 195)",
  ink: "oklch(0.88 0.09 175)",
  dim: "oklch(0.6 0.06 180)",
} as const;

/** Everything that makes a box read as a screen, in one place. */
export const screenFace = {
  backgroundImage: `${SCREEN.scan}, ${SCREEN.glass}`,
  boxShadow: `inset 0 0 0 1px ${SCREEN.line}, inset 0 2px 9px oklch(0 0 0 / 0.75), inset 0 0 24px oklch(0.55 0.12 190 / 0.16)`,
} as const;
