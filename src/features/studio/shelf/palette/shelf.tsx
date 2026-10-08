"use client";
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { getFeature, type FeatureDef } from "../catalog";
import { useStudio } from "../../board/store";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";

/** Where a right-click "add here" lands when no cursor is involved. */
export function dropPoint() {
  const { pan, zoom } = useStudio.getState();
  return { x: (420 - pan.x) / zoom, y: (240 - pan.y) / zoom };
}

/**
 * The middle of the page as it is on screen now, in the page's own pixels,
 * or null when the page is not drawn (Preview, the timeline).
 *
 * Read off the drawn page window rather than off the pan and zoom, so it
 * holds whatever scrolled or zoomed: the part lands where the person is
 * looking, not at the foot of a long page two screens down.
 */
export function visibleMiddle(): { x: number; y: number } | null {
  if (typeof document === "undefined") return null;
  const win = document.querySelector<HTMLElement>("[data-page-window]");
  const pane = document.querySelector<HTMLElement>("[data-studio-pane]");
  if (!win) return null;
  const r = win.getBoundingClientRect();
  const fw = useStudio.getState().frameWidth;
  const scale = r.width / Math.max(1, fw);
  if (!scale) return null;
  /* What of the pane is not under the shelf that stands over its foot. */
  const p = pane?.getBoundingClientRect() ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  const band = document.querySelector<HTMLElement>("[data-studio-band]")?.getBoundingClientRect();
  const bottom = band && band.top > p.top ? Math.min(p.bottom, band.top) : p.bottom;
  const left = Math.max(p.left, r.left);
  const right = Math.min(p.right, r.right);
  const top = Math.max(p.top, r.top);
  const foot = Math.min(bottom, r.bottom);
  const cx = right > left ? (left + right) / 2 : r.left + r.width / 2;
  const cy = foot > top ? (top + foot) / 2 : r.top;
  return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
}

/**
 * Click-to-add places the part inside the frame the way a page grows: full-width
 * parts span the frame, everything else is centred, and it lands just below
 * whatever is lowest so the page stacks downward.
 *
 * A NEW IDEA IS THE EXCEPTION, and `at` for anything placed on purpose. On a
 * captured page of 259 parts the foot is screens away, so pressing New idea
 * made part 260 somewhere nobody was looking and nothing on the canvas moved.
 * An idea lands centred where the person is looking (or on `at`, the point
 * they right-clicked), picked, so its outline says where it went.
 */
export function addFeatureToCanvas(featureId: string, opts?: { at?: { x: number; y: number } }) {
  const state = useStudio.getState();
  const feature = getFeature(featureId);
  const fw = state.frameWidth;
  const w = Math.min(feature?.w ?? 420, fw);
  const h = feature?.h ?? 88;
  const aim = opts?.at ?? (featureId === "custom-idea" ? visibleMiddle() : null);
  if (aim) {
    const x = Math.round(Math.max(0, Math.min(fw - w, aim.x - w / 2)));
    const y = Math.round(Math.max(0, aim.y - h / 2));
    const id = state.addNode(featureId, x, y, { w, h });
    play("confirm");
    return id;
  }
  const onPage = state.nodes.filter((n) => n.pageId === state.activePageId);
  const bottom = onPage.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  const x = w >= fw ? 0 : Math.round((fw - w) / 2);
  const y = onPage.length ? bottom + 24 : 0;
  const id = state.addNode(featureId, x, y, { w, h });
  play("confirm");
  return id;
}

/* ------------------------------------------------------------------ */
/* One part                                                            */
/* ------------------------------------------------------------------ */

/** A part taken out of the library, shown under "removed" so it can be put back. */
export function RemovedCard({ feature, width }: { feature: FeatureDef; width: number }) {
  return (
    <button
      type="button"
      {...ctxProps("studio-palette", feature.id, feature)}
      onClick={() => { play("confirm"); useStudio.getState().restoreFeature(feature.id); }}
      aria-label={`Put ${feature.name} back in the library`}
      style={{ width, height: 72 }}
      className="tactile flex shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border p-2 opacity-50 hover:opacity-100"
    >
      <RotateCcw className="size-3.5 text-fg-faint" />
      <span className="line-clamp-1 text-center text-small text-fg-muted">{feature.name}</span>
      <span className="text-fine text-fg-faint">removed, press to put back</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The crumbs                                                          */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* The shelf                                                           */
/**
 * How many categories may be open at once.
 *
 * ONE. It was two, on the reasoning that you might want to hold a hero next
 * to a text block and choose between them. In a 209px strip that is not what
 * two open categories give you: the first one's cards are 208 tall on their
 * own, so the second never arrives on screen beside the first — it arrives
 * below the fold, and the only way to see the pair the argument was about is
 * to scroll one of them out of sight. Two was a comparison that could not
 * actually be made.
 *
 * One also makes the planets row honest. With a single category open the row
 * can shrink to a rail (see `PLANET_DISC`), which is what puts the open
 * category on screen without the shelf having to scroll itself — the thing
 * that made pressing a planet move the view.
 */
export const OPEN_AT_MOST = 1;

/** The narrowest a card on the shelf is drawn: wide enough for its preview to be read and its one line to fit on two. */
export const CARD_MIN = 232;

/**
 * The planets, full size and shrunk to a rail.
 *
 * Closed, they are the shelf: big lit discs with their names and their counts
 * under them, which is the way in. Open, they are navigation past the thing
 * you are actually looking at, so they give the room back — half the disc, no
 * name, no count, the tooltip still carrying both. The mark stays the same
 * drawing at both sizes.
 */
export const PLANET_DISC = { open: 30, shut: 52 } as const;
export const PLANET_MARK = { open: 22, shut: 38 } as const;
/* Open, a cell is as wide as its name: the rail shrinks the disc, never the word (`tests/shelf-cards.mjs`). */
export const PLANET_CELL = { open: 72, shut: 86 } as const;

/* ------------------------------------------------------------------ */

/*
 * Whether any category is open, for the band the shelf stands in.
 *
 * The shelf is a 209px strip inside a 248px band, and it was that whether
 * or not there was anything in it. Opening one category puts 1745px of
 * cards in it — a twelve-span element is given the whole shelf width by
 * `sizeFor`, so a card is 1820 across and 208 down, and one of them fills
 * the strip end to end. 1536 of travel inside 209 of box, and a person
 * looking at one tile at a time.
 *
 * The band cannot ask the shelf how tall it would like to be — it is the
 * parent — so the shelf says when it has something open, on the same
 * pattern as the timeline's tab, and the band answers with a height.
 */
export let shelfOpen = false;
const shelfWatchers = new Set<() => void>();
export function setShelfOpen(v: boolean) {
  if (shelfOpen === v) return;
  shelfOpen = v;
  /* The height he dragged it to is his, kept across categories and reloads
     (`SHELF_KEY`): closing a category no longer gives it back. */
  shelfWatchers.forEach((w) => w());
}
/** True while at least one category is open on the parts shelf. */
export function useShelfOpen(): boolean {
  return React.useSyncExternalStore(
    (w) => { shelfWatchers.add(w); return () => { shelfWatchers.delete(w); }; },
    () => shelfOpen,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* How much of the screen the categories take                          */
/* ------------------------------------------------------------------ */

/**
 * HIS WORDS: "i cant scroll up and force the categories back down like i
 * wanted to, it stays up no matter what and my preview is pretty small while
 * its open but i should be able to choose which dominates the screen view
 * scrolling down on the category section".
 *
 * So the wheel over the shelf is not only a scroll. It is the divider
 * between the categories and the preview, and he drives it without having to
 * find a handle:
 *
 *   · wheel DOWN over the shelf — the categories take more room, up to
 *     `SHELF_MAX` of the window, and once there the wheel goes back to
 *     scrolling the cards, which is what it did before;
 *   · wheel UP over the shelf — the cards scroll back to their top first,
 *     and from the top the shelf gives its room back, all the way down to
 *     `SHELF_MIN`, which is the closed band. That is the half that did not
 *     exist: there was no gesture that made the shelf smaller.
 *
 * Nothing here touches the preview's own wheel. Over the preview the wheel
 * navigates the site being designed and does nothing else, which is his
 * other half of the same sentence.
 */
export const SHELF_MIN = 132;
/*
 * A THIRD OF THE CANVAS BY DEFAULT, MOST OF IT ON PURPOSE.
 *
 * It was 72% of the window, and opening a category took half the canvas
 * before anyone asked for more: the page being built is the subject and the
 * shelf is where you reach. So it opens at about a third, and the wheel over
 * the cards grows it no further than that before it scrolls them. Then the
 * owner, capped there: "the shelf no longer stretches up". The grip on its
 * top edge is the deliberate gesture, so it goes up to most of the canvas
 * (`SHELF_GRIP_SHARE`), and where he leaves it is kept in this browser
 * (`tests/shelf-strip.mjs`).
 */
export const SHELF_SHARE = 0.34;
export const SHELF_GRIP_SHARE = 0.85;
const SHELF_KEY = "builder.shelf.height";
const canvasHeight = () => {
  if (typeof window === "undefined") return 812;
  const pane = document.querySelector<HTMLElement>("[data-studio-pane]");
  /* The board and the shelf under it: the shelf is the pane's sibling now (the board stops above it), so the canvas is the column they share. */
  return pane?.parentElement?.clientHeight || pane?.clientHeight || window.innerHeight - 88;
};
export const shelfMax = () => Math.max(SHELF_MIN, Math.round(canvasHeight() * SHELF_SHARE));
const gripMax = () => Math.max(SHELF_MIN, Math.round(canvasHeight() * SHELF_GRIP_SHARE));
/** Null means "whatever opening a category asks for"; a number is his choice. */
export let shelfTall: number | null = (() => {
  try { const v = Number(typeof window === "undefined" ? NaN : window.localStorage.getItem(SHELF_KEY)); return Number.isFinite(v) && v >= SHELF_MIN ? v : null; } catch { return null; }
})();
/** The wheel grows the shelf to a third; the grip (`by: "grip"`) to most of the canvas, and is remembered. */
export function setShelfTall(px: number | null, by: "wheel" | "grip" = "wheel") {
  const cap = by === "grip" ? gripMax() : Math.max(shelfMax(), by === "wheel" && shelfTall != null && px != null && px < shelfTall ? shelfTall : 0);
  const next = px === null ? null : Math.max(SHELF_MIN, Math.min(cap, Math.round(px)));
  if (shelfTall === next) return;
  shelfTall = next;
  if (by === "grip") { try { if (next == null) window.localStorage.removeItem(SHELF_KEY); else window.localStorage.setItem(SHELF_KEY, String(next)); } catch { /* kept for the tab */ } }
  shelfWatchers.forEach((w) => w());
}
/*
 * FOLDED TO A STRIP, AND REMEMBERED.
 *
 * The shelf was always there, 248px of it, about a fifth of the screen
 * whether or not anything was being added. Folded, it is a thin strip that
 * says where it went and opens again with one press, and the choice is kept
 * in this browser across reloads, because it is about how this person likes
 * to work rather than about the site.
 */
const SHUT_KEY = "builder.shelf.folded";
/* Folded until someone opens it (J, 2026-10-05): the thirteen category
   icons were a row of the screen nobody was using; one "+ Add" stands in. */
let shelfFolded = (() => {
  try { return typeof window !== "undefined" && window.localStorage.getItem(SHUT_KEY) !== "0"; } catch { return true; }
})();
export function setShelfFolded(v: boolean) {
  if (shelfFolded === v) return;
  shelfFolded = v;
  try { window.localStorage.setItem(SHUT_KEY, v ? "1" : "0"); } catch { /* a private window keeps it for the tab */ }
  shelfWatchers.forEach((w) => w());
}
/** True while the shelf is folded down to its strip. */
export function useShelfFolded(): boolean {
  return React.useSyncExternalStore(
    (w) => { shelfWatchers.add(w); return () => { shelfWatchers.delete(w); }; },
    () => shelfFolded,
    () => false,
  );
}

/** The height he has set the shelf to, or null while he has not said. */
export function useShelfTall(): number | null {
  return React.useSyncExternalStore(
    (w) => { shelfWatchers.add(w); return () => { shelfWatchers.delete(w); }; },
    () => shelfTall,
    () => null,
  );
}
