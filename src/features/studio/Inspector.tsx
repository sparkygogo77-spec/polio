"use client";
/**
 * The per-element prompt panel — the point of the whole exercise. Whatever is
 * selected gets its own instructions, and those instructions travel with its
 * position on the canvas into the brief.
 *
 * The panel lives in `inspector/`, split by topic (see inspector/README.md).
 * This file re-exports what it always exported, so no import elsewhere changes.
 */
export { Inspector } from "./inspector/Panel";
export { GLYPHS, HuePicker, OptionRange } from "./inspector/fields";
