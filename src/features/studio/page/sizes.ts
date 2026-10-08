import * as React from "react";
import { Eraser, Link, MousePointer2, Pencil, TriangleDashed } from "lucide-react";
import { type Tool } from "../board/store";
import type { Device } from "../live/layout";

/**
 * How much of the window the bottom band keeps — the parts shelf under the
 * board, and "This update" under the timeline.
 *
 * Enough for the round buttons and a second row of them, and no more: the
 * board is the subject and the shelf is where you reach. It is a clamp rather
 * than a number because the rule is that the band is *always* there: on a
 * window dragged down to a letterbox it gives ground rather than going off
 * the bottom of the screen, and it never takes more than a third of what
 * there is.
 */
export const BAND_H = "clamp(132px, 32vh, 248px)";
/*
 * And the band when a category is open, which is a different job.
 *
 * Shut, the band is a row of planets to pick from and 248 is plenty. Open,
 * it is a list to read: 1745px of cards in a 209px strip, with a twelve-span
 * element drawn the whole shelf's width, so exactly one tile is on screen at
 * a time. The same shape as the backend's `WORK_H` and for the same reason —
 * a surface you work at rather than a strip you glance at.
 *
 * It takes the room from the site's *visible* height and none from the
 * site: the board is as tall as the page either way and the pane scrolls
 * over it, so nothing is lost, only moved behind the fold. The preview
 * window is a sibling of the pane rather than a child, so it does not move
 * when this changes — which is checked rather than assumed.
 */
/*
 * Now about a third of the canvas: an open category that took half of it
 * (54% of the window) left the page being built as the smaller thing on
 * screen. The canvas is the window less the bar; the grip and the wheel
 * stop at the same share (`SHELF_SHARE` in `Palette.tsx`).
 */
/* Never shorter than the band shut: on a phone-sized window a third of the
   canvas (242px at 400×800) was less than the 248 the row of planets takes,
   so opening a category gave the cards less room than none open. */
export const SHELF_OPEN_H = "max(clamp(132px, 32vh, 248px), calc((100vh - 88px) * 0.34))";
/** The shelf folded down to its strip (`Palette.tsx`, `useShelfFolded`). */
export const SHELF_STRIP_H = "30px";
/** The band when the backend is up: room for a transcript worth reading. */
export const WORK_H = "clamp(320px, 54vh, 640px)";

/**
 * Four tools, in one control.
 *
 * Six buttons became four in a dropdown that wears whichever is in your hand.
 * Two left the bar and for different reasons:
 *
 *  · **Pan.** The cursor pans. A press on the bare ground outside the page
 *    drags the view, a press on a part moves the part, and a press on empty
 *    space *inside* the page still draws a marquee — the nebula is the ground
 *    you push, the page is the surface you select on. Alt-drag and the middle
 *    button still pan anywhere, as they always did.
 *  · **Draw a region.** Worth being exact about, because it was not what it
 *    looked like: it is not a selection tool and never was. It draws a
 *    rectangle *annotation*, a `frame` shape, sibling to a pen stroke and an
 *    arrow. So marquee-plus-shift-click does not replace it — they were never
 *    doing the same job. What it is, is a third way to draw on a board that
 *    already has two, and it costs a permanent slot in the bar to get it.
 *    It is off the bar; the shape kind stays, so every frame already drawn
 *    still renders and no board loses anything.
 *
 * Selecting several at once needs neither of them and needed no change:
 * dragging a box on empty page already worked, and so did shift-clicking.
 */
export const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2; shortcut: string }[] = [
  { id: "select", label: "Select & move", icon: MousePointer2, shortcut: "v" },
  { id: "pen", label: "Draw freehand", icon: Pencil, shortcut: "d" },
  { id: "erase", label: "Erase", icon: Eraser, shortcut: "e" },
  { id: "arrow", label: "Connect two elements", icon: Link, shortcut: "a" },
  /*
   * The fifth. A closed line drawn with it is a space — an area of the page
   * set aside before anything is in it (`space.ts`). It takes no ink hue: a
   * space is not a drawn line that stays on the page, it is a boundary that
   * becomes a part.
   *
   * HIS WORDS: "the circle button shouldnt just open a circle like 'draw'
   * does it should allow me to create the shape, make it a triangle with
   * dashes lines." The mark was a dashed RING, and a ring is a picture of
   * the thing it makes — so it read as a button that drops a circle rather
   * than one you draw a shape with. A dashed triangle is a shape nothing
   * here makes on its own, which is the point: the outline is the idea, and
   * what it ends up as is whatever his hand draws.
   */
  { id: "space", label: "Draw a space", icon: TriangleDashed, shortcut: "s" },
];


/**
 * Is the window narrower than the panel column can share it with?
 *
 * Below 768 px the Builder used to hide its whole side panel and seven of
 * the bar's controls with nothing in their place (inventory A21). The
 * width is read here once, off the same breakpoint the classes use, so
 * what the panel becomes and what the bar folds away agree with the CSS.
 */
export const NARROW = "(max-width: 767px)";

/** Does the window match a media query? False until it is read, and read on the client only. */
export function useMedia(query: string): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const read = () => setOn(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, [query]);
  return on;
}

export const useNarrow = () => useMedia(NARROW);

/** Below the desktop breakpoint the bar folds Fit, Wires, the readout, Search and Updates away. */
export const FOLDING = "(max-width: 1023px)";

/**
 * The device the board's own Preview shows: the one the window is.
 *
 * It was hard-coded to desktop, so a phone-wide window showed a 1440 px
 * site in a 390 px pane. A window under 768 is a phone, under 1024 a
 * tablet, and the right-click menu's Device entries still change it after.
 */
export function useViewportDevice(): Device {
  const [device, setDevice] = React.useState<Device>("desktop");
  React.useEffect(() => {
    const phone = window.matchMedia(NARROW);
    const tablet = window.matchMedia("(max-width: 1023px)");
    const read = () => setDevice(phone.matches ? "phone" : tablet.matches ? "tablet" : "desktop");
    read();
    phone.addEventListener("change", read);
    tablet.addEventListener("change", read);
    return () => { phone.removeEventListener("change", read); tablet.removeEventListener("change", read); };
  }, []);
  return device;
}
