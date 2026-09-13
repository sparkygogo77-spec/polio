"use client";
/**
 * COLOUR MENU — what a colour menu is, said once.
 *
 * Six places in the Builder offer a colour, and each was its own small
 * design. Measured off the source before this file existed:
 *
 *  · **Six chip sizes.** Three written as numbers to `ArcChips`/`GridChips`
 *    — 16, 18, 24 over seven call sites in `BackgroundEditors` and
 *    `RingEditors` — and three more written as Tailwind classes elsewhere:
 *    18 on `RadialMenu`'s background chip, 20 and 24 on `ColourOverride`'s
 *    role swatches, 32 and 36 on `LookPanel`'s. Nothing said which was
 *    which; a slab picked one and its neighbour picked another.
 *  · **Five declarations of the same "nothing" chip.** Four an `X` (at two
 *    glyph sizes, 3 and 3.5) and one a `Ban`, over three different dark
 *    fills — `CONSOLE.well` three times, `CONSOLE.box` once, `SCREEN_KEY`
 *    once. Five words for it too: "From the accent", "Follow the site",
 *    "No texture", "No aura", "No entrance".
 *  · **Two independent builds of the same three controls.** `LookPanel`'s
 *    mixer is a 96px lightness-by-chroma field over a 12px hue strip;
 *    `MenuConsole` has no field at all — a row of 9px hue dots over a 12px
 *    lightness strip and a 12px chroma strip. They agree on 12 by accident
 *    and on nothing else.
 *
 * None of that was a decision. So this is the agreement, and the rule is the
 * one `molten.css` already lives by: **import from here, never write a chip
 * size or an empty swatch of your own.** A second answer that nearly matches
 * is the thing this exists to prevent.
 *
 * Nothing here draws anything. `RingConsole` owns the drawing (`ArcChips`,
 * `GridChips`, `ArcSlider`); this owns what it is drawing.
 */
import type { CSSProperties, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* A chip                                                              */
/* ------------------------------------------------------------------ */

/**
 * How big a colour chip is.
 *
 * `near` is for a band close to the hole, where the arc is short and chips
 * would collide at the full size; `far` is everywhere else, and is the size
 * a colour menu is. Two densities because the room genuinely differs, not
 * because two menus felt different — that was the old six.
 */
export const CHIP = {
  far: 24,
  near: 20,
  /** Between two of them, at either size. */
  gap: 6,
  /** A round menu's chips are discs; a square one's take the menu's corner. */
  radius: { round: "9999px", square: "6px" },
} as const;

/**
 * Where "near the hole" stops.
 *
 * Read off the two rows that were already inner rows: `hole + 18` for the
 * aura styles and `hole + 26` for the palette swatches. Everything else goes
 * out at `chipsAt(slab)`, which is `mid + (reach - mid) * 0.56` — far past
 * this on any slab. So the line sits above both inner rows and well below
 * the outer one, and neither is a close call.
 */
export const NEAR_OF_HOLE = 46;

/** The size to use on a band at this radius, given where the hole is. */
export function chipSize(radius: number, hole: number): number {
  return radius < hole + NEAR_OF_HOLE ? CHIP.near : CHIP.far;
}

/* ------------------------------------------------------------------ */
/* Nothing                                                             */
/* ------------------------------------------------------------------ */

/**
 * What no-colour looks like: the chequer under a transparent pixel.
 *
 * All five console declarations were a dark box with a glyph on it, which
 * reads as a very dark colour rather than as the absence of one — and on a
 * console whose every surface is already near-black, it read as nothing at
 * all. The glyph did not save it: an X over a swatch says "not allowed",
 * which is not what an empty swatch means.
 *
 * One place had already found the answer. `LookPanel`'s `CHECKS` puts a
 * chequer behind a texture swatch, so the chip shows the layer rather than
 * the layer over a ground it may not have — the same problem, solved. It
 * simply never reached the five menus on the console. This is that answer,
 * moved somewhere they can all reach it, at the same 10px pitch it chose.
 *
 * The two greys are mid-range on purpose. A chequer drawn from theme
 * variables follows the page, and the console does not follow the page; one
 * pair sitting between the two reads as transparent on a near-black slab and
 * on a light panel both.
 */
export const EMPTY = {
  /** Half the 10px pitch `CHECKS` already uses. Four across a 24px chip. */
  square: 5,
  light: "oklch(0.62 0.008 288)",
  dark: "oklch(0.34 0.008 288)",
} as const;

/** The chequer, as a background a chip can wear. */
export function emptyFill(): CSSProperties {
  const { square: s, light, dark } = EMPTY;
  return {
    backgroundColor: dark,
    backgroundImage:
      `linear-gradient(45deg, ${light} 25%, transparent 25%, transparent 75%, ${light} 75%),` +
      `linear-gradient(45deg, ${light} 25%, transparent 25%, transparent 75%, ${light} 75%)`,
    backgroundSize: `${s * 2}px ${s * 2}px`,
    backgroundPosition: `0 0, ${s}px ${s}px`,
  };
}

export interface Chip {
  id: string;
  label: string;
  style: CSSProperties;
  glyph?: ReactNode;
}

/**
 * The one "nothing" chip.
 *
 * It carries no glyph; the chequer says transparent on its own. Only the
 * label changes between menus, because only the label is different: "No
 * aura", "Follow the site" and "From the accent" are the same swatch saying
 * the same thing about different fields.
 */
export function emptyChip(label: string, id = ""): Chip {
  return { id, label, style: emptyFill() };
}

/** A chip wearing a colour. The only other kind there is. */
export function swatchChip(id: string, label: string, colour: string, glyph?: ReactNode): Chip {
  return { id, label, style: { background: colour }, ...(glyph ? { glyph } : {}) };
}

/* ------------------------------------------------------------------ */
/* A band                                                              */
/* ------------------------------------------------------------------ */

/**
 * A spectrum band: how thick, and how far from the next one.
 *
 * The lightness-by-chroma field is the one a person actually drags around,
 * so it gets the room; a hue or grey strip is one-dimensional and needs only
 * enough to hit. That ordering was already right in `LookPanel` and the
 * amounts were not: 96 over a 12px strip, with a 12px thumb on it, so the
 * thumb was the strip. `strip` is thick enough to aim at, and `surface` is
 * deeper than the 96 it was — which is J's wider Surface control.
 *
 * `MenuConsole`, which has the two strips and no field, gets the field.
 */
export const BAND = {
  /** The two-dimensional lightness and chroma field. */
  surface: 116,
  /** A one-dimensional strip: hue, or grey. */
  strip: 16,
  /** Between two bands. */
  gap: 8,
} as const;
