"use client";
import * as React from "react";
import { Clapperboard, FlaskConical, Image as ImageIcon, Layers, Palette as PaletteIcon, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";

/**
 * The side panel's tabs: one set, in one order, always all five.
 *
 * They used to appear and disappear with the selection — Element, Format and
 * Pages only while something was held — which meant the strip you were
 * reaching for was a different strip depending on what you had just clicked.
 */
/*
 * A HUE EACH, because a strip of six identical marks is a strip of no marks.
 *
 * Measured on the deploy: all six read at chroma 0.016 or 0.008 on hue 288 —
 * the void the panels are built from — so the icon was doing no work and the
 * one visible label was carrying the whole strip. That is the same fault the
 * settings groups had, and it takes the same fix: the mark says which panel
 * this is.
 *
 * The hues are not invented where the app already has one. Motion is 170,
 * which is the Motion category's own hue in the parts catalogue; Pages sits
 * beside Navigation at 230. Element, Format, Look and Draw take the rest of
 * the wheel, none closer than 30 degrees to a neighbour — the spacing rule
 * the twelve categories were re-cut to obey, because below about 20 the
 * difference is not one a person can see.
 */
export const SIDE_TABS = [
  { value: "inspector", label: "Element", icon: <Sparkles />, hue: 265 },
  { value: "format", label: "Format", icon: <Settings2 />, hue: 200 },
  { value: "pages", label: "Pages", icon: <Layers />, hue: 230 },
  { value: "look", label: "Look", icon: <PaletteIcon />, hue: 320 },
  { value: "motion", label: "Motion", icon: <Clapperboard />, hue: 170 },
  /* The drawing tool on a tab of its own (PicturesPanel.tsx). It spent a while
     folded at the foot of each part's Element panel, where with nothing picked
     it could not be found at all; his words: "give the ai image generator its
     own section/display panel option". 50 is the one gap left on the wheel. */
  { value: "pictures", label: "Pictures", icon: <ImageIcon />, hue: 50 },
  /* TEMPORARY. The Lab: five experiments on the page's layout (lab/). J asked
     for new test features behind one side panel option (2026-10-10). Take the
     tab out by deleting this line, its branch in StudioPage.tsx and lab/. */
  { value: "lab", label: "Lab", icon: <FlaskConical />, hue: 110 },
] as const;

/*
 * One side, two shapes.
 *
 * Wide, the panel is the column it always was. Below 768 px it is a sheet
 * over the foot of the board, because a phone has no room for a column
 * and used to get nothing at all: no Element, no Look, no Pages. Same
 * element, same tabs, same hooks; only where it stands changes.
 */
export const SHEET = "relative flex flex-col border-border bg-panel/95 fixed inset-x-0 bottom-0 z-40 max-h-[62dvh] border-t shadow-pop md:relative md:inset-auto md:z-auto md:max-h-none md:w-[300px] md:shrink-0 md:border-t-0 md:border-r md:bg-panel/50 md:shadow-none";

/*
 * THE PANEL'S WIDTH IS THE PERSON'S.
 *
 * It was 228px on every screen: on a 1992px monitor a column of squeezed
 * words beside a board with room to spare. Its edge drags now, from 228 to
 * about half the window, and the width is kept in this browser (it is how
 * this person likes their screen, not something about the site). The
 * content reflows: every panel in it is a flex column, and at a width with
 * room the tabs say all their names.
 */
export const SIDE_MIN = 228;
/* Where it starts: wide enough for a name, a value and a Change on one line. */
export const SIDE_DEFAULT = 300;
export const SIDE_KEY = "builder.sidePanelWidth";
export const sideMax = () => Math.max(SIDE_MIN, Math.round((typeof window === "undefined" ? 1440 : window.innerWidth) * 0.5));
export const clampSide = (w: number) => Math.round(Math.min(sideMax(), Math.max(SIDE_MIN, w)));

export function useSideWidth(): [number, (w: number) => void] {
  const [w, setW] = React.useState(SIDE_DEFAULT);
  React.useEffect(() => {
    try {
      const kept = Number(localStorage.getItem(SIDE_KEY));
      if (Number.isFinite(kept) && kept > 0) setW(clampSide(kept));
    } catch { /* storage refused: the default stands */ }
    const fit = () => setW((was) => clampSide(was));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const set = React.useCallback((next: number) => {
    const v = clampSide(next);
    setW(v);
    try { localStorage.setItem(SIDE_KEY, String(v)); } catch { /* kept for this visit only */ }
  }, []);
  return [w, set];
}

/** The panel's edge, to drag. Arrow keys move it too; a double press puts it back to the narrowest. */
export function SideEdge({ width, onWidth }: { width: number; onWidth: (w: number) => void }) {
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef<{ x: number; w: number } | null>(null);
  const frame = React.useRef(0);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Side panel width"
      aria-valuenow={width}
      aria-valuemin={SIDE_MIN}
      aria-valuemax={sideMax()}
      tabIndex={0}
      data-side-edge=""
      title="Drag to widen the panel. Double press to put it back."
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: width };
        setDragging(true);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        /* One width per frame, however fast the hand moves: the board refits behind it. */
        const next = start.current.w + e.clientX - start.current.x;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => onWidth(next));
      }}
      onPointerUp={(e) => {
        start.current = null;
        setDragging(false);
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already let go */ }
      }}
      onDoubleClick={() => onWidth(SIDE_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onWidth(width + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 64 : 16));
        }
      }}
      className={cn(
        "absolute inset-y-0 -right-1 z-20 hidden w-2 cursor-col-resize touch-none md:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors hover:after:bg-accent focus-visible:after:bg-accent focus-visible:outline-none",
        dragging && "after:bg-accent",
      )}
    />
  );
}

/** The sheet's own way out, drawn only while it is a sheet. */
export function SheetHandle({ narrow, onClose }: { narrow: boolean; onClose: () => void }) {
  if (!narrow) return null;
  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-2">
      <span className="h-1 w-8 rounded-full bg-border" aria-hidden />
      <Button variant="ghost" size="xs" data-side-sheet-close="" aria-label="Close the side panel" onClick={onClose}>Close</Button>
    </div>
  );
}
