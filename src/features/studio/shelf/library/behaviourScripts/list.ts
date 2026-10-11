/**
 * The behaviour features: working parts that move, copy and show.
 *
 * Same shape as the price features in `works.ts` — a manifest and a few
 * lines of plain browser JavaScript calling `siteFeatures.define` — and the
 * same rule: no look of their own. Each works on whatever part it is
 * attached to, in the published site, through the part's own element:
 *
 *   · Reveal on scroll — fades / slides the part in as it comes into view;
 *   · Copy with toast — a click (or Enter) copies the part's words, or the
 *     text it was given, and says so in one small toast;
 *   · Tilt — the part leans toward the mouse, or drifts as the page scrolls;
 *   · Follow the pointer — the part (an eye's pupil) moves or turns toward
 *     the cursor, never further than its travel;
 *   · Marquee loop — the part's contents run round, a hidden copy behind;
 *   · Embed — another page in a sandboxed frame at the part's size;
 *   · CRT loader and Dust — the owner's own two, from trumpmorty.fun: the
 *     tuning screen that switches off like an old set, and specks drifting
 *     up through the part.
 *
 * Motion lives in the individual `translate` / `rotate` properties where it
 * can, so a part's own `transform` is left as designed. Everything that
 * moves holds still when the visitor asked for less motion.
 *
 * Pure: no imports, so the tests run it as written.
 */
import type { Work } from "../works.ts";
import { REVEAL, COPY, TILT, FOLLOW, MARQUEE } from "./motion.ts";
import { EMBED, CRT, DUST, SCROLL_HEADER, STICKY_BAR, BLINK, SPIN, FLOAT, HOVER_LIFT, SCROLL_GROW, PLANET, TURN_3D } from "./effects.ts";
import { PRESS_SHOWS, GLIDE, WORLD_DIALOGS, COMPARE } from "./interactions.ts";

export const BEHAVIOURS: Work[] = [REVEAL, COPY, TILT, FOLLOW, MARQUEE, EMBED, CRT, DUST, SCROLL_HEADER, STICKY_BAR, BLINK, SPIN, FLOAT, HOVER_LIFT, SCROLL_GROW, PRESS_SHOWS, GLIDE, WORLD_DIALOGS, PLANET, TURN_3D, COMPARE];

/** The ones that move on their own, with nobody touching anything: the only ones the board plays (live/runWorks.ts). */
export const AMBIENT = ["spin", "float", "dust-canvas"] as const;
/** What the board plays: the ambient ones, and the top bar that rides the board's own scroll (`sticky-bar`, on its drawn layer). */
export const ON_BOARD: readonly string[] = [...AMBIENT, "sticky-bar"];
