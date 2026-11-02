/**
 * THE SIZE A PART'S WORDS ARE DRAWN AT, IN PIXELS.
 *
 * A part stores a multiplier of the site's base size (`font.size`), or, with
 * none, an exact size (`font.px`, `theme.ts#applyFont`); a captured part also
 * keeps `font.px`, the size its page set, which is not what is drawn once it
 * has been changed. A heading is drawn 1.6 times what it stores. Pure, so the
 * panel's Size field and the agents' `setFont` (`features/agents/siteSteps.ts`)
 * read and write one meaning.
 */

/** The parts whose words are drawn larger than the size they store, and by how much (`shelf/parts/Hero.tsx#ValueProp`). */
export const DRAWN_LARGER: ReadonlySet<string> = new Set(["value-prop", "gimmick"]);
export const HEADING_DRAWN = 1.6;

/** The range `applyFont` holds a part to that was not read off a page, as multiples of the base. */
const HAND_RANGE = [0.6, 2] as const;

type FontLike = { size?: number; px?: number; face?: string; stack?: string; family?: string; weight?: number; [k: string]: unknown };
type PartLike = { featureId: string; font?: FontLike | null; from?: unknown };

const larger = (n: PartLike) => (DRAWN_LARGER.has(n.featureId) ? HEADING_DRAWN : 1);
const captured = (n: PartLike) => !!(n.from as { selector?: unknown } | null | undefined)?.selector;

/** What the part's words are drawn at, by what it stores. */
export function drawnPx(n: PartLike, base: number): number {
  const f = n.font;
  if (typeof f?.size === "number") {
    const held = captured(n) ? f.size : Math.max(HAND_RANGE[0], Math.min(HAND_RANGE[1], f.size));
    return base * held * larger(n);
  }
  return (typeof f?.px === "number" && f.px > 0 ? f.px : base) * larger(n);
}

/**
 * The font that draws the words at `px`. A captured part takes the multiplier
 * and keeps the size its page set, which its rows are counted at
 * (`Text.tsx#heldToOne`). Any other part outside the multiplier's range takes
 * the exact size instead, or a 48 would be drawn at 32.
 */
export function fontAtPx(n: PartLike, px: number, base: number): FontLike {
  const { size: _size, px: _px, ...rest } = (n.font ?? {}) as FontLike;
  void _size; void _px;
  const stored = px / larger(n);
  if (captured(n)) return { ...rest, ...(typeof n.font?.px === "number" ? { px: n.font.px } : {}), size: stored / base };
  const times = stored / base;
  return times >= HAND_RANGE[0] && times <= HAND_RANGE[1] ? { ...rest, size: times } : { ...rest, px: stored };
}

/** The font with another face: whatever named the old one goes, or it would still be drawn. */
export function fontInFace(font: FontLike | null | undefined, face: string): FontLike {
  const { stack: _stack, family: _family, ...rest } = (font ?? {}) as FontLike;
  void _stack; void _family;
  return { ...rest, face };
}
