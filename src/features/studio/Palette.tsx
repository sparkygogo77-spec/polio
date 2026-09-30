"use client";
/**
 * The parts shelf, under the board.
 *
 * You walk in from the top: a row of planets, one per category. Pick one and
 * it becomes a crumb with its sub-groups beside it, each with its own moon in
 * the same line-art; pick one of those and the list gets out of the way,
 * leaving the parts themselves.
 *
 * The parts are grouped by what they are for (the sub-groups), each card
 * the same shape: the thing on the site's own page, its name, one line of
 * what it does, and whether it works now or needs building.
 *
 * Nothing here is interactive — every preview is `inert` — so a part only
 * comes alive once it is on the board. Drag it straight out, or click it to
 * open its detail card, where Add to page puts it on the page.
 *
 * The cards themselves, their words and badges, the detail card and the
 * whole-site switches are `ShelfCards.tsx` and `shelfFacts.ts`; this file is
 * the shelf they stand in.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { ChevronDown, ChevronUp, EyeOff, RotateCcw, Search, Sparkles, X } from "lucide-react";
import {
  CATEGORIES, SUBGROUPS, allCategories, getFeature, searchFeatures, type CategoryDef,
  type CategoryId, type FeatureDef,
} from "./catalog";
import { useStudio, type StudioNode } from "./store";
import { plain } from "./parts/spans";
import { WorkShelf } from "./WorkShelf";
import { planetOf } from "./planets";
import { moonFor } from "./moons";
import { shapeOf } from "./showcase";
import { switchOf, type SiteWords } from "./shelfFacts";
import { PartDetail, SeeMotionTab, ShelfCard, useSiteWords } from "./ShelfCards";
import { css, parseColor } from "./look";
import { resolvePalette } from "./parts/theme";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { SCREEN, screenFace } from "@/core/ui/void";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/tooltip";

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
function RemovedCard({ feature, width }: { feature: FeatureDef; width: number }) {
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
const OPEN_AT_MOST = 1;

/** The narrowest a card on the shelf is drawn: wide enough for its preview to be read and its one line to fit on two. */
const CARD_MIN = 232;

/**
 * The planets, full size and shrunk to a rail.
 *
 * Closed, they are the shelf: big lit discs with their names and their counts
 * under them, which is the way in. Open, they are navigation past the thing
 * you are actually looking at, so they give the room back — half the disc, no
 * name, no count, the tooltip still carrying both. The mark stays the same
 * drawing at both sizes.
 */
const PLANET_DISC = { open: 30, shut: 52 } as const;
const PLANET_MARK = { open: 22, shut: 38 } as const;
/* Open, a cell is as wide as its name: the rail shrinks the disc, never the word (`tests/shelf-cards.mjs`). */
const PLANET_CELL = { open: 72, shut: 86 } as const;

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
let shelfOpen = false;
const shelfWatchers = new Set<() => void>();
function setShelfOpen(v: boolean) {
  if (shelfOpen === v) return;
  shelfOpen = v;
  /* Closing gives the room back. Opening does not take a remembered height
     with it, because the last thing he stretched the shelf to is about the
     category he was reading then, not this one. */
  if (!v) shelfTall = null;
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
const SHELF_MIN = 132;
/*
 * A THIRD OF THE CANVAS, AT MOST.
 *
 * It was 72% of the window, and opening a category took half the canvas
 * before anyone asked for more: the page being built is the subject and the
 * shelf is where you reach. So however it is grown, with the wheel or the
 * grip on its top edge, the shelf stops at about a third of the canvas's
 * height (`tests/shelf-strip.mjs`).
 */
export const SHELF_SHARE = 0.34;
const canvasHeight = () => {
  if (typeof window === "undefined") return 812;
  const pane = document.querySelector<HTMLElement>("[data-studio-pane]");
  return pane?.clientHeight || window.innerHeight - 88;
};
const shelfMax = () => Math.max(SHELF_MIN, Math.round(canvasHeight() * SHELF_SHARE));
/** Null means "whatever opening a category asks for"; a number is his choice. */
let shelfTall: number | null = null;
function setShelfTall(px: number | null) {
  const next = px === null ? null : Math.max(SHELF_MIN, Math.min(shelfMax(), Math.round(px)));
  if (shelfTall === next) return;
  shelfTall = next;
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
let shelfFolded = (() => {
  try { return typeof window !== "undefined" && window.localStorage.getItem(SHUT_KEY) === "1"; } catch { return false; }
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

export function Palette() {
  const folded = useShelfFolded();
  if (folded) return <ShelfStrip />;
  return <OpenShelf />;
}

/** The shelf folded away: one strip, and the way back. */
function ShelfStrip() {
  return (
    <div data-drawer="" data-shelf-folded="" className="flex h-full items-center gap-2 border-t border-border bg-panel/50 px-3">
      <button
        type="button"
        onClick={() => { play("select"); setShelfFolded(false); }}
        aria-label="Open the parts shelf"
        className="tactile flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-small text-fg-muted hover:bg-hover hover:text-fg"
      >
        <ChevronUp className="size-3.5" />
        Parts shelf
      </button>
    </div>
  );
}

function OpenShelf() {
  const [query, setQuery] = React.useState("");
  /*
   * Which category is open. One at a time, and it may be none.
   *
   * It used to be one `cat`, and choosing it took the whole shelf: the row of
   * planets vanished and was replaced by that category's parts, so there was
   * no way back except back. Then it was two stacked under a row of planets
   * that stayed put, which is the right shape and the wrong number — see
   * `OPEN_AT_MOST`. It is one now, and the planets neither vanish nor stay
   * full size: they shrink to a rail, so the category that opens is already
   * on screen and nothing has to scroll to show it.
   *
   * Still an array rather than `CategoryId | null` because everything that
   * reads it — the lit state, the stacking, the section list — reads it as a
   * set, and a set of one is the same code as a set of two.
   */
  const [open, setOpen] = React.useState<CategoryId[]>([]);
  /* The band outside needs to know, and a state set during render is not a
     thing to notify from — so it is told after the paint that follows. */
  React.useEffect(() => { setShelfOpen(open.length > 0); }, [open]);
  React.useEffect(() => () => setShelfOpen(false), []);
  const [showRemoved, setShowRemoved] = React.useState(false);
  /*
   * ESCAPE PUTS THE OPEN CATEGORY AWAY.
   *
   * It did nothing here. The board's own Escape steps out of a picked part,
   * so the shelf answers first only when it was the last thing touched, or
   * when the board has nothing picked to step out of. Escape in the search
   * clears it first. Listened to in the capture phase so it is asked before
   * the board, and it says it took the key (`preventDefault`).
   */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const touched = React.useRef(false);
  React.useEffect(() => {
    const down = (e: PointerEvent) => { touched.current = !!rootRef.current?.contains(e.target as Node); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("[data-radial], [data-words-in-place]")) return;
      const t = e.target as HTMLElement | null;
      const inShelf = !!t && !!rootRef.current?.contains(t);
      if (inShelf && t instanceof HTMLInputElement && t.value) return;   // the field's own: clears it
      const s = useStudio.getState();
      const boardIdle = !s.selection.length && s.tool === "select";
      if (!shelfOpen || !(inShelf || touched.current || boardIdle)) return;
      e.preventDefault();
      play("close");
      setOpen([]);
      if (inShelf) t?.blur();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", down, true); window.removeEventListener("keydown", key, true); };
  }, []);
  const toggleCat = React.useCallback((id: CategoryId) => {
    play("select");
    setOpen((was) => (was.includes(id) ? was.filter((c) => c !== id) : [...was, id].slice(-OPEN_AT_MOST)));
  }, []);
  /* Another panel asking for a category (the Motion tab's link to the shelf's Motion). Opens it; never closes it. */
  React.useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id !== "string") return;
      setQuery("");
      setOpen([id]);
    };
    window.addEventListener("studio:shelf", go);
    return () => window.removeEventListener("studio:shelf", go);
  }, []);

  /* Full discs, or the rail. One reading, so the cell, the disc and the mark
     can never disagree about which of the two the row is in. */
  const anyOpen = open.length > 0;
  const cell = anyOpen ? PLANET_CELL.open : PLANET_CELL.shut;
  const disc = anyOpen ? PLANET_DISC.open : PLANET_DISC.shut;
  const mark = anyOpen ? PLANET_MARK.open : PLANET_MARK.shut;

  const hidden = useStudio(useShallow((s) => s.hiddenFeatures));
  const hiddenSet = React.useMemo(() => new Set(hidden), [hidden]);
  const searching = query.trim().length > 0;
  /*
   * The repositories connected to this site. Their elements are in the
   * catalogue already — the store put them there — so this is subscribed
   * to for one reason: so the shelf redraws when one arrives or leaves.
   */
  const brought = useStudio(useShallow((s) => s.brought));

  const all = React.useMemo(() => searchFeatures(query), [query, brought]);
  const live = React.useMemo(() => all.filter((f) => !hiddenSet.has(f.id)), [all, hiddenSet]);

  const shelf = React.useMemo(() => allCategories(), [brought]);
  const categories = React.useMemo(
    () => shelf.filter((c) => live.some((f) => f.category === c.id)),
    [live, shelf],
  );
  const removed = showRemoved ? all.filter((f) => hiddenSet.has(f.id)) : [];

  /* Searching is the one view that is not the accordion: a name typed in
     crosses every category, so the results are one flat list — grouped the
     same way an open category is, by size and shape. */
  /* Searching crosses every category, so the results are grouped by the category each belongs to: by purpose, like an open one. */
  const found = React.useMemo(
    () => (searching ? shelf.map((category) => ({ category, items: live.filter((f) => f.category === category.id) })).filter((g) => g.items.length) : []),
    [searching, live, shelf],
  );
  const words = useSiteWords();
  const removeCard = React.useCallback((id: string) => { play("deny"); useStudio.getState().hideFeature(id); }, []);
  /* What is already on this page answers first (`onThisPage`). */
  const pageNodes = useStudio(useShallow((s) => s.nodes.filter((n) => n.pageId === s.activePageId)));
  const here = React.useMemo(() => (searching ? onThisPage(pageNodes, query) : []), [searching, pageNodes, query]);

  // One measurement for the shelf: previews are real components, so they need
  // a pixel width, and three columns of it is what a page's middle looks like.
  const shelfRef = React.useRef<HTMLDivElement>(null);
  /*
   * The wheel over the shelf: first the divider, then the list.
   *
   * Attached by hand rather than with `onWheel`, because taking the gesture
   * means `preventDefault` and React's wheel handler is passive — a passive
   * listener that calls it is ignored with a warning, so the page would have
   * scrolled underneath anyway.
   *
   * The rule in one line: the wheel resizes while resizing is possible in
   * the direction it is going, and scrolls otherwise. Going down that means
   * grow until the cap and then scroll; going up it means scroll to the top
   * and then shrink. So a long scroll up always ends with the categories
   * back down, which is the thing he could not do.
   */
  React.useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    /*
     * ONE GESTURE DOES ONE JOB, which is what the first version got wrong.
     *
     * Measured: scrolling up took the shelf 648 → 168 and then stuck there,
     * 36px short of the floor, no matter how long the scroll went on. The
     * reason is that shrinking the shelf makes its own content scrollable
     * again — the cards reflow into a shorter box — so `scrollTop` lifted
     * off zero, the "have the cards reached their top" test started saying
     * no, and the wheel handed itself back to the list. It converged on the
     * height where the content exactly fills, and "it stays up no matter
     * what" was still true at the bottom of the travel.
     *
     * So a gesture latches. The first notch decides whether this scroll is a
     * resize or a scroll, and the rest of it does that one thing until the
     * hand stops for a moment. A long scroll up now runs the shelf all the
     * way down to `SHELF_MIN`, and a scroll that began in the card list goes
     * on scrolling the card list.
     */
    let mode: "resize" | "list" | null = null;
    let last = 0;

    const onWheel = (e: WheelEvent) => {
      if (!shelfOpen) { mode = null; return; }      // shut, it is a row of planets
      /* What is ASKED FOR and what is DRAWN are not the same number once the
         shelf is near its floor, and the difference is the signal used below. */
      const now = Math.round(el.getBoundingClientRect().height);
      const down = e.deltaY > 0;
      /* A pause ends the gesture: 220ms is longer than the gap between
         notches of one flick and shorter than a person changing their mind. */
      if (e.timeStamp - last > 220) mode = null;
      last = e.timeStamp;
      if (mode === null) {
        const canGrow = down && now < shelfMax();
        const canShrink = !down && el.scrollTop <= 0 && now > SHELF_MIN;
        mode = canGrow || canShrink ? "resize" : "list";
      }
      if (mode === "list") return;                  // the cards have it
      if (down && now >= shelfMax()) { mode = "list"; return; }
      /*
       * THE BOTTOM OF THE TRAVEL PUTS THE CATEGORIES AWAY.
       *
       * `SHELF_MIN` is a number and the shelf has a floor of its own that is
       * higher: the search screen, the rail of planets and the open
       * category's header come to 168px at 1440×900, and the band cannot be
       * drawn shorter than the things inside it. So a scroll up ran out at
       * 168 and "it stays up no matter what" was still true down there.
       *
       * Reaching the floor closes the open category instead, which is what
       * "force the categories back down" actually means: the shelf goes back
       * to being the row of planets it is when nothing is open. The last
       * notch of the gesture does something rather than nothing.
       */
      /*
       * WHERE THE BOTTOM OF THE TRAVEL IS, said plainly because it is not
       * where the constant says. `SHELF_MIN` is 132 and the shelf has a
       * floor of its own that is higher: the search screen, the rail of
       * planets and the open category's header come to 171px at 1440×900,
       * and the band cannot be drawn shorter than what is inside it. So a
       * long scroll up ends at 171, not 132.
       *
       * That is still the whole of what he asked for — the preview goes from
       * 252px of the window to 729 — but it is not the same as the
       * categories going away. The X on the category's header is what does
       * that, and a wheel gesture that closed the category at the floor was
       * tried here and did not fire reliably, so it is not pretended at.
       */
      e.preventDefault();
      setShelfTall(now + e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const [shelfW, setShelfW] = React.useState(900);
  React.useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const measure = () => setShelfW(Math.max(320, el.clientWidth - 24));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // How wide a part is drawn: as much of the shelf as it would take of a page.
  // Full-width parts get the row to themselves; the rest sit two, three or
  // four across with a thin gap, because a preview you cannot read is not a
  // preview. The height cap follows, so a wide part is also a tall one.
  const GAP = 10;
  /*
   * ONE SLOT WIDTH PER GROUP, chosen so the group's tallest card fits the cap.
   *
   * The old rule sized every card on its own: a span decided how many would
   * go across, a cap decided how tall the card could be, and a card too tall
   * for the cap was narrowed inside its slot until it fitted. The narrowing
   * is where the wasted space came from — a full-width part drawn at 630 of
   * an 1188 slot leaves 558 of that row bare, and nothing can fill it,
   * because the slot is still a whole row wide.
   *
   * So the cap decides the COLUMN COUNT now, not the card's width. Start at
   * the count the shape asks for, and while the group's tallest natural
   * preview is over the cap, put one more across — a narrower slot makes
   * every card in the group shorter in proportion, and they all stay exactly
   * their slot. A row is therefore always full, and a group tiles.
   *
   * Six across is the floor: past that a preview is a thumbnail of a
   * thumbnail, and an unreadable preview is worse than a scroll.
   */
  /*
   * ONE CARD WIDTH FOR THE WHOLE SHELF, and a wide part takes two.
   *
   * Cards used to be sized from the part's footprint, grouped by it, and a
   * group of full-width parts was a row of 1188px boxes each showing a
   * sliver. The owner chooses by purpose, so the groups are purpose and
   * every card is the same shape: a preview the thing is fitted whole into,
   * its name, one line of what it does, and its badges. Something as wide
   * as the page gets two columns, so a header can still be read as one.
   */
  const layout = React.useMemo(() => {
    const per = Math.max(2, Math.floor((shelfW + GAP) / (CARD_MIN + GAP)));
    const width = Math.floor((shelfW - GAP * (per - 1)) / per);
    return { per, width, wide: width * 2 + GAP };
  }, [shelfW]);
  const widthOf = React.useCallback(
    (f: FeatureDef) => (layout.per >= 4 && !switchOf(f.id) && (shapeOf(f) === "strip" || shapeOf(f) === "block") ? layout.wide : layout.width),
    [layout],
  );

  /*
   * THE FIELD THE PREVIEWS FLOAT ON IS THE BUILDER'S, NOT THE SITE'S.
   *
   * This was the site's SURFACE role, dimmed and spun half a turn round the
   * wheel, on the reasoning that a surface-coloured part would then separate
   * from it without needing a border. What that actually did was paint the
   * Builder's own furniture out of his site's palette: the shelf is the
   * Builder, not the page, and a role is about the page.
   *
   * MEASURED, the same shelf with nothing else changed. Set Surface to a
   * blue at hue 263.6 and the band came out at hue 83.6, which is gold; set
   * it to a grey and the band came out at hue 180. That is his report
   * exactly, and the half-turn is the whole of the mechanism — a complement
   * is by definition the one colour furthest from what he chose, so the
   * better he picked, the louder the shelf shouted back at him.
   *
   * The reason it was derived does not survive either. Every preview already
   * carries `border-border/70` of its own — the Builder's border, not the
   * site's — so a part the colour of its own surface separates from this
   * field whatever colour the field is. The tint was buying something that
   * was already paid for.
   *
   * So: the void the rest of the chrome is built from, and no site role
   * read here at all. `--bg` rather than the drawer's own `--panel`, so the
   * field still sits a shade under the band it is set into and the shelf
   * keeps its depth.
   */
  const behind = "var(--bg)";

  return (
    <div ref={rootRef} data-drawer="" className="relative flex h-full flex-col border-t border-border bg-panel/50">
      <ShelfGrip />
      {/*
        The search, across the whole shelf and on a screen of its own.
        
        It was a hundred and sixty pixels of dark box at the end of a dark
        row, which is how you build a search field nobody can find. Anywhere
        words are typed in this app is a screen — teal glass, scanlines,
        phosphor lettering, the same as the command palette's field — so this
        is the one colour on the shelf that is not the shelf, and it is as
        wide as the thing it searches.
      */}
      <div data-parts-search="" className="flex shrink-0 items-center gap-1 px-2 pt-2">
        <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5" style={{ ...screenFace, color: SCREEN.ink }}>
          <Search className="size-4 shrink-0" style={{ color: SCREEN.dim }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search parts"
            placeholder="Search parts…"
            onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); e.stopPropagation(); setQuery(""); } }}
            className="min-w-0 flex-1 bg-transparent font-mono text-large tracking-tight outline-none placeholder:opacity-45"
            style={{ color: SCREEN.ink }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear the search"
              className="tactile shrink-0 rounded-sm p-0.5"
              style={{ color: SCREEN.dim }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {/* Room for the fold key, which is drawn here but comes last in the shelf's order (below). */}
        <span aria-hidden className="w-7 shrink-0" />
      </div>

      {/* --------------------------------------- only what is not a category */}
      <div className={cn("flex shrink-0 items-center gap-2 px-3", hidden.length ? "border-b border-border py-1.5" : "h-0 overflow-hidden")}>
        <span className="ml-auto" />
        {hidden.length ? (
          <button
            type="button"
            onClick={() => { play("select"); setShowRemoved((v) => !v); }}
            aria-pressed={showRemoved}
            className="tactile flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5 text-small text-fg-muted hover:bg-hover hover:text-fg"
          >
            <EyeOff className="size-3" />
            {hidden.length} removed
          </button>
        ) : null}
      </div>

      {/* ------------------------------------------------ the parts */}
      <div data-parts-field="" className="relative min-h-0 flex-1" style={{ background: behind }}>
        {/*
          One scroller for the whole shelf, and nothing inside it scrolls.

          Not a correction of a nested scroller — there never was one, and an
          earlier version of this comment said there was. What there was: a
          fixed crumb row with a 173px box of cards scrolling beneath it, so
          the elements moved while the header sat still and the thing read as
          a box scrolling inside a box. The planets, the open categories and
          their parts are all in this one flow now, and a section's header
          pins with `sticky` rather than being a separate fixed row, so one
          wheel moves everything and the pointer never has to be anywhere in
          particular.
        */}
        <div ref={shelfRef} data-shelf=""
          /* `overscroll-y-contain` so the wheel stops here. Without it the
             gesture chained: eight notches over an open category took the
             shelf to its end and then carried the site up behind it, the
             pane going 261 to 635 under a pointer that never left the
             shelf. Two scroll regions that never push each other is the
             rule; this is the half of it the shelf owns. */
          className="no-bars relative z-[1] h-full overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {searching ? (
          found.length || here.length ? (
            <div className="relative z-[1] px-3 py-3">
              {here.length ? <OnThisPage hits={here} /> : null}
              {found.length && here.length ? (
                <div data-shelf-results="" className="mb-2 mt-1 text-small font-medium text-fg-muted">Add from the shelf</div>
              ) : null}
              {found.map(({ category, items }) => (
                <Band key={category.id} title={category.label} hue={category.hue}>
                  <div className="flex flex-wrap items-stretch" style={{ gap: GAP }}>
                    {items.map((f) => <ShelfCard key={f.id} feature={f} width={widthOf(f)} words={words} onRemove={() => removeCard(f.id)} />)}
                  </div>
                </Band>
              ))}
              <div className="h-10" />
            </div>
          ) : (
            <div className="relative z-[1] flex h-full items-center justify-center px-6 text-center text-plain text-fg-muted">
              Nothing by that name. Drop a <span className="text-accent">&nbsp;New idea&nbsp;</span> and describe it.
            </div>
          )
        ) : (
          <>
            {/*
              The planets stay put.

              Choosing one used to remove them all, which is what made this a
              drill-down rather than a shelf. They are the way in and they are
              also the way to the *second* thing you want to look at, so they
              do not go anywhere; the one you have open is simply lit.
            */}
            <div
              data-planets={anyOpen ? "rail" : "full"}
              className={cn(
                "relative z-[1] flex flex-wrap justify-center px-4 transition-[padding] duration-200",
                anyOpen ? "gap-x-1.5 gap-y-1 py-1.5" : "gap-x-3 gap-y-2 py-3",
              )}
            >
              {[...categories].map((c) => {
                const isOpen = open.includes(c.id);
                return (
                  <Tooltip key={c.id} content={c.blurb} side="top">
                    <button
                      type="button"
                      data-category={c.id}
                      aria-expanded={isOpen}
                      aria-label={c.label}
                      onClick={() => toggleCat(c.id)}
                      className="group/cat tactile flex shrink-0 flex-col items-center gap-1 transition-[width] duration-200"
                      style={{ color: `oklch(0.84 0.13 ${c.hue})`, minWidth: cell, maxWidth: 104 }}
                    >
                      <span
                        className="flex items-center justify-center rounded-full transition-[box-shadow,transform,width,height] duration-200 group-hover/cat:-translate-y-0.5 group-hover/cat:shadow-[var(--lit)]"
                        style={{
                          width: disc,
                          height: disc,
                          // The disc carries the colour, so it has to have
                          // some: at a chroma of 0.045 every one of these was
                          // black with a rumour of a hue in it, and the row
                          // read as thirteen identical circles.
                          background: `oklch(0.22 0.1 ${c.hue} / ${isOpen ? 0.85 : 0.6})`,
                          // Under the hand it lifts and its rim brightens; open,
                          // it stays lit. It does not change colour: the colour
                          // is what says which kind of part this is.
                          boxShadow: isOpen
                            ? `inset 0 0 0 1.5px oklch(0.8 0.17 ${c.hue}), 0 3px 12px oklch(0.5 0.14 ${c.hue} / 0.4)`
                            : `inset 0 0 0 1px oklch(0.62 0.14 ${c.hue} / 0.42), 0 1px 0 oklch(0 0 0 / 0.5)`,
                          "--lit": `inset 0 0 0 1.5px oklch(0.78 0.16 ${c.hue} / 0.85), 0 3px 12px oklch(0.5 0.14 ${c.hue} / 0.35)`,
                        } as React.CSSProperties}
                      >
                        {React.createElement(planetOf(c.id), { size: mark })}
                      </span>
                      {/* HIS REPORT: once a category opened the row was icons
                          with no names. The rail gives back the disc's size
                          and the count, never the name. */}
                      <span data-category-name="" className={cn("text-center leading-tight", anyOpen ? "text-fine" : "text-small")}>{c.label}</span>
                      {anyOpen ? null : <span className="num text-fine text-fg-faint">{live.filter((f) => f.category === c.id).length}</span>}
                    </button>
                  </Tooltip>
                );
              })}
              {/*
                And one that is not a kind of part: something the library does
                not have, which you describe yourself. Same shape as the rest,
                drawn in a dashed rim so it reads as an opening rather than a
                thing.
              */}
              <Tooltip content="Something the library has not got: describe it and place it" side="top">
                <button
                  type="button"
                  data-category="custom-idea"
                  aria-label="New idea"
                  /*
                   * CARRIED LIKE EVERY OTHER PART, because it is one.
                   *
                   * Every tile on the shelf can be dragged onto the board and
                   * let go where it is wanted. This one could only be pressed,
                   * and a press puts a part at the foot of whatever is already
                   * on the page — so the one part whose whole point is that
                   * you are describing something new was also the one part you
                   * could not put anywhere in particular. It carries the same
                   * payload a tile carries, so the board needs nothing new to
                   * receive it.
                   */
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-studio-feature", "custom-idea");
                    e.dataTransfer.effectAllowed = "copy";
                    play("tap");
                  }}
                  onClick={() => addFeatureToCanvas("custom-idea")}
                  className="group/cat tactile flex shrink-0 cursor-grab flex-col items-center gap-1 text-accent transition-[width] duration-200 active:cursor-grabbing"
                  style={{ minWidth: cell, maxWidth: 104 }}
                >
                  <span
                    className="flex items-center justify-center rounded-full border border-dashed border-accent/55 transition-[box-shadow,transform,width,height] duration-200 group-hover/cat:-translate-y-0.5 group-hover/cat:shadow-[0_3px_12px_var(--accent-soft)]"
                    style={{ width: disc, height: disc, background: "oklch(0.2 0.04 265 / 0.45)" }}
                  >
                    <Sparkles style={{ width: mark * 0.8, height: mark * 0.8 }} />
                  </span>
                  <span className={cn("text-center leading-tight", anyOpen ? "text-fine" : "text-small")}>New idea</span>
                  {anyOpen ? null : <span className="num text-fine text-fg-faint">yours</span>}
                </button>
              </Tooltip>
            </div>

            {/* The open ones, stacked, in the catalogue's order so that
                opening a second never shuffles the first out from under the
                pointer. */}
            {shelf.filter((c) => open.includes(c.id)).map((c) => (
              <CategorySection
                key={c.id}
                category={c}
                live={live}
                widthOf={widthOf}
                cardWidth={layout.width}
                words={words}
                onRemove={removeCard}
                gap={GAP}
                onClose={() => toggleCat(c.id)}
              />
            ))}

            {removed.length ? (
              <div className="relative z-[1] px-3 pb-3">
                <Band title="Removed">
                  <div className="flex flex-wrap items-start" style={{ gap: GAP }}>
                    {removed.map((f) => <RemovedCard key={f.id} feature={f} width={layout.width} />)}
                  </div>
                </Band>
              </div>
            ) : null}

            {open.length || removed.length ? <div className="h-10" /> : null}
          </>
        )}
        </div>
      </div>
      <PartDetail add={addFeatureToCanvas} />
      {/* The fold key: at the search row's end on screen, last in the order,
          so the shelf's first control is still its first category. */}
      <div className="absolute right-2 top-2 z-[3]">
        <Tooltip content="Fold the shelf down to a strip" side="top">
          <button
            type="button"
            onClick={() => { play("select"); setShelfFolded(true); }}
            aria-label="Fold the parts shelf away"
            className="tactile rounded-sm p-1 text-fg-muted hover:bg-hover hover:text-fg"
          >
            <ChevronDown className="size-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * One open category, stacked under the planets.
 *
 * Its own header so you can tell where one ends and the next begins, its
 * sub-groups as a filter rather than a second drill level, and its parts in
 * the flow — no scroller of its own, so the shelf's single scroller is the
 * only thing the wheel talks to.
 */
function CategorySection({
  category, live, widthOf, cardWidth, words, onRemove, gap, onClose,
}: {
  category: CategoryDef;
  live: FeatureDef[];
  widthOf: (f: FeatureDef) => number;
  cardWidth: number;
  words: SiteWords;
  onRemove: (id: string) => void;
  gap: number;
  onClose: () => void;
}) {
  const [sub, setSub] = React.useState<string | null>(null);
  /*
   * PRESSING A CATEGORY DOES NOT SCROLL ANYTHING. It opens the category.
   *
   * This used to scroll the shelf to bring the opening section to the top,
   * and before that it called `scrollIntoView`, which scrolls every
   * scrollable ancestor and so took the pane with it — the site jumping
   * upward on its own the moment a planet was pressed. Scrolling the shelf
   * by hand fixed the pane and left the complaint: the view still moved when
   * all that was asked for was for a category to open.
   *
   * The reason it moved was real, and it is fixed at the cause rather than
   * papered over. The planets filled the shelf's box on their own, so a
   * section opening underneath them opened off the bottom and a planet
   * looked like a dead button. With one category open at a time the planets
   * shrink to a rail (`PLANET_DISC` in this file), which frees enough of the
   * strip that the section's header is on screen the moment it opens. So
   * there is nothing to scroll to, and nothing scrolls.
   *
   * The wheel still works, and the person still drives it. That is the
   * whole of it: the shelf moves when it is pushed, never on its own.
   */
  const subs = React.useMemo(
    () => (SUBGROUPS[category.id] ?? []).filter((g) => g.ids.some((id) => live.some((f) => f.id === id))),
    [category.id, live],
  );
  const shown = React.useMemo(() => {
    /* A category the catalogue wrote has sub-groups, and they are the
       reading order. A category a repository brought has none — its parts
       are whatever that page turned out to be made of — so it shows all of
       them, in the order the page had them. */
    if (!subs.length) return live.filter((f) => f.category === category.id);
    const group = subs.find((g) => g.id === sub);
    const ids = group ? group.ids : subs.flatMap((g) => g.ids);
    return ids.map((id) => live.find((f) => f.id === id)).filter((f): f is FeatureDef => !!f);
  }, [live, sub, subs, category.id]);
  /*
   * GROUPED BY PURPOSE. The sub-groups are what the parts are for, so they
   * are the groups; footprint was the grouping ("Full width, shallow", "A
   * quarter each") and it answered a question nobody choosing a part asks.
   * It is a small tag on each card now.
   */
  const groups = React.useMemo(() => {
    const byId = new Map(shown.map((f) => [f.id, f]));
    if (!subs.length) return [{ id: category.id, label: category.label, items: shown }];
    return subs
      .filter((g) => !sub || g.id === sub)
      .map((g) => ({ id: g.id, label: g.label, items: g.ids.map((id) => byId.get(id)).filter((f): f is FeatureDef => !!f) }))
      .filter((g) => g.items.length);
  }, [shown, subs, sub, category.id, category.label]);

  return (
    <section data-category-open={category.id} className="relative z-[1] border-t border-border/70">
      <div
        className="sticky top-0 z-[2] flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm"
        style={{ background: `oklch(0.16 0.03 ${category.hue} / 0.9)` }}
      >
        <span className="flex items-center gap-1.5 text-plain font-medium" style={{ color: `oklch(0.86 0.12 ${category.hue})` }}>
          {React.createElement(planetOf(category.id), { size: 14 })}
          {category.label}
        </span>
        {/* Beside the name it closes, not at the far end of the row. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${category.label}`}
          className="tactile shrink-0 rounded-sm p-0.5 text-fg-muted hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
        <div className="hide-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {subs.map((g) => {
            const on = sub === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => { play("select"); setSub(on ? null : g.id); }}
                aria-pressed={on}
                className="tactile flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-small font-medium"
                style={{
                  background: on ? `oklch(0.78 0.17 ${category.hue})` : `oklch(0.72 0.15 ${category.hue} / 0.16)`,
                  color: on ? "oklch(0.16 0.04 0)" : `oklch(0.86 0.12 ${category.hue})`,
                  boxShadow: `inset 0 0 0 1px oklch(0.72 0.15 ${category.hue} / 0.4)`,
                }}
              >
                {React.createElement(moonFor(g.id), { size: 12 })}
                <span className="whitespace-nowrap">{g.label}</span>
                <span className="num text-fine opacity-60">{g.ids.filter((id) => live.some((f) => f.id === id)).length}</span>
              </button>
            );
          })}
        </div>
        {category.id === "motion" ? <SeeMotionTab className="shrink-0 text-fine" /> : null}
      </div>
      <div className="px-3 py-2">
        <WorkShelf category={category} width={cardWidth} words={words} gap={gap} />
        {groups.map((g) => (
          <Band key={g.id} title={g.label} hue={category.hue} mark={subs.length ? moonFor(g.id) : undefined}>
            {/* Stretched to the row, so every card in a row ends on one line. */}
            <div className="flex flex-wrap items-stretch" style={{ gap }}>
              {g.items.map((f) => <ShelfCard key={f.id} feature={f} width={widthOf(f)} words={words} onRemove={() => onRemove(f.id)} />)}
            </div>
          </Band>
        ))}
      </div>
    </section>
  );
}

function Band({ title, children, hue, mark }: { title: string; children: React.ReactNode; hue?: number; mark?: (p: { size?: number }) => React.ReactNode }) {
  return (
    <section data-shelf-group={title} className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        {mark ? <span className="shrink-0" style={{ color: hue != null ? `oklch(0.84 0.13 ${hue})` : undefined }}>{React.createElement(mark, { size: 14 })}</span> : null}
        <span className="shrink-0 text-small font-medium" style={{ color: hue != null ? `oklch(0.86 0.1 ${hue})` : undefined }}>{title}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The grip on the shelf's top edge                                     */
/* ------------------------------------------------------------------ */

/**
 * Drag the shelf's top edge to make it taller or shorter, up to a third of
 * the canvas (`shelfMax`). The wheel over the shelf still does the same.
 */
function ShelfGrip() {
  const start = React.useRef<{ y: number; h: number } | null>(null);
  return (
    <div
      data-shelf-grip=""
      role="separator"
      aria-orientation="horizontal"
      aria-label="Drag to make the shelf taller or shorter"
      className="absolute inset-x-0 -top-1 z-[3] h-2 cursor-row-resize touch-none hover:bg-accent/30"
      onPointerDown={(e) => {
        const band = (e.currentTarget.closest("[data-studio-band]") as HTMLElement | null) ?? e.currentTarget.parentElement;
        if (!band) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { y: e.clientY, h: band.getBoundingClientRect().height };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        setShelfTall(s.h - (e.clientY - s.y));
      }}
      onPointerUp={() => { start.current = null; }}
      onPointerCancel={() => { start.current = null; }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Search: what is on this page first                                   */
/* ------------------------------------------------------------------ */

/**
 * The parts of this page that answer a search, best first.
 *
 * "Search parts" searched the catalogue alone, so typing "copy" with a COPY
 * button on the page found nothing on the page. A part answers by its
 * words, its name or its kind; words that start with what was typed come
 * before words that merely contain it.
 */
export function onThisPage(nodes: readonly StudioNode[], query: string): StudioNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { n: StudioNode; score: number }[] = [];
  for (const n of nodes) {
    const words = plain(n.content).toLowerCase();
    const name = (n.label ?? "").toLowerCase();
    const kind = `${getFeature(n.featureId)?.name ?? ""} ${n.featureId}`.toLowerCase();
    const at = (text: string) => { const i = text.indexOf(q); return i < 0 ? -1 : i === 0 || /\W/.test(text[i - 1]!) ? 0 : 1; };
    const w = at(words), l = at(name), k = at(kind);
    const score = w === 0 ? 0 : l === 0 ? 1 : w === 1 ? 2 : l === 1 ? 3 : k >= 0 ? 4 : -1;
    if (score >= 0) scored.push({ n, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.n.y - b.n.y || a.n.x - b.n.x).map((x) => x.n);
}

/** Pick a part and bring it into view on the board. */
export function goToPart(id: string) {
  const s = useStudio.getState();
  s.setSelection([id]);
  s.want({ panel: "inspector", id });
  play("select");
  const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
  const pane = document.querySelector<HTMLElement>("[data-studio-pane]");
  if (!el || !pane) return;
  const r = el.getBoundingClientRect();
  const p = pane.getBoundingClientRect();
  const band = document.querySelector<HTMLElement>("[data-studio-band]")?.getBoundingClientRect();
  const seen = band && band.top > p.top ? band.top - p.top : p.height;
  /* Its top a third of the way down what is not under the shelf. */
  pane.scrollTop += r.top - p.top - Math.max(24, Math.min(seen / 3, seen - r.height - 24));
  /* Across is the board's pan. */
  if (r.right < p.left || r.left > p.right) {
    const { pan } = useStudio.getState();
    useStudio.getState().setPan({ x: pan.x + (p.left + p.width / 2) - (r.left + r.width / 2), y: pan.y });
  }
}

const ON_PAGE_MAX = 40;

function OnThisPage({ hits }: { hits: StudioNode[] }) {
  const shown = hits.slice(0, ON_PAGE_MAX);
  return (
    <section data-page-results="" className="mb-4">
      <div className="mb-2 text-small font-medium text-fg-muted">On this page</div>
      <div className="flex flex-col gap-0.5">
        {shown.map((n) => {
          const words = plain(n.content).replace(/\s+/g, " ").trim();
          const kind = getFeature(n.featureId)?.name ?? "Part";
          return (
            <button
              key={n.id}
              type="button"
              data-page-hit={n.id}
              onClick={() => goToPart(n.id)}
              className="tactile flex min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left text-small hover:bg-hover"
            >
              <span className="shrink-0 rounded-xs border border-border px-1 text-fine text-fg-faint">{kind}</span>
              <span className="shrink-0 font-medium text-fg">{n.label}</span>
              {words && words !== n.label ? <span className="min-w-0 truncate text-fg-muted">{words}</span> : null}
            </button>
          );
        })}
      </div>
      {hits.length > shown.length ? (
        <div className="mt-1 px-2 text-fine text-fg-faint">and {hits.length - shown.length} more; type more to narrow it</div>
      ) : null}
    </section>
  );
}
