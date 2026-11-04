/**
 * THE PICKED PART'S TOOLBAR: a small card just above it.
 *
 * The design canvas's floating bar (J, 2026-11-03), with the few things a
 * picked part is most often asked for, every one of them a thing the Builder
 * already does: Looks (the wheel opened straight onto its Looks, as the
 * wheel's own Looks piece opens it), Duplicate and Delete (the wheel's, one
 * step of undo each), and Step out (Escape: the part that holds this one).
 * No new control: each button is a door to one that exists.
 *
 * Above the part; below it when there is no room above; kept inside the
 * board's pane at every edge. Clear of the part's name chip, and never under
 * the pointer: a bar that came up under the hand took the hover off the part
 * being pressed. It comes up once the press is let go, and is hidden while
 * the wheel is open, while words are being typed, and when more or less than
 * one part is picked. Drawn in the void the wheel's own
 * menus are cut from (`core/ui/void.ts`), first-level blue keys, Delete red.
 * `tests/builder-select.mjs`.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { Copy, CornerLeftUp, Palette, Trash2 } from "lucide-react";
import { VOID } from "@/core/ui/void";
import { play } from "@/core/audio/engine";
import { useStudio } from "./store";
import { closeRadial, openRadial, useRadialOpen } from "../RadialMenu";
import { useEditingWords } from "../WordsInPlace";
import { climbSpot, stepOutOf } from "./selectTools";

const GAP = 8;
/* Where the pointer is, read when the bar is placed: one passive listener for the whole app, which only writes two numbers. */
let hand: { x: number; y: number } | null = null;
if (typeof window !== "undefined") for (const t of ["pointermove", "pointerdown"]) window.addEventListener(t, (e) => { hand = { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY }; }, { passive: true, capture: true });
const EDGE = 6;
const BLUE = "oklch(0.8 0.16 205)";
const RED = "oklch(0.7 0.2 27)";

type Doing = "looks" | "duplicate" | "delete" | "out";
const KEYS: { id: Doing; label: string; Icon: typeof Copy; hue: string }[] = [
  { id: "looks", label: "Looks", Icon: Palette, hue: BLUE },
  { id: "duplicate", label: "Duplicate", Icon: Copy, hue: BLUE },
  { id: "out", label: "Step out to what holds it (Esc)", Icon: CornerLeftUp, hue: BLUE },
  { id: "delete", label: "Delete", Icon: Trash2, hue: RED },
];

/** What a key does, on the one part picked. */
function act(doing: Doing, id: string, at: { x: number; y: number }) {
  const s = useStudio.getState();
  if (doing === "looks") { openRadial(id, at.x, at.y, null, "look"); play("select"); return; }
  if (doing === "duplicate") { s.duplicateNodes([id]); play("confirm"); closeRadial(); return; }
  if (doing === "delete") { s.removeNodes([id]); play("deny"); closeRadial(); return; }
  const part = s.nodes.find((n) => n.id === id);
  const up = part ? stepOutOf(s.nodes, part) : null;
  if (up) s.setSelection([up.id]);
  else s.clearSelection();
  climbSpot(up?.id ?? null);
  play("tap");
}

export function PickBar({ dragging, pane }: { dragging: boolean; pane: () => HTMLElement | null }) {
  const one = useStudio((s) => (s.mode === "design" && s.tool === "select" && s.selection.length === 1 && s.nodes.some((n) => n.id === s.selection[0] && n.pageId === s.activePageId) ? s.selection[0]! : null));
  const wheel = useRadialOpen();
  const typing = useEditingWords();
  const show = !!one && !dragging && !wheel && !typing;
  const bar = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState<{ left: number; top: number; below: boolean } | null>(null);

  React.useLayoutEffect(() => {
    if (!show || !one) { setAt(null); return; }
    let frame = 0;
    const place = () => {
      frame = 0;
      const part = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(one)}"]`);
      const me = bar.current;
      if (!part || !me) { setAt(null); return; }
      const r = part.getBoundingClientRect();
      const w = me.offsetWidth || 160, h = me.offsetHeight || 34;
      const p = pane()?.getBoundingClientRect();
      const box = { left: Math.max(0, p?.left ?? 0) + EDGE, top: Math.max(0, p?.top ?? 0) + EDGE, right: Math.min(window.innerWidth, p?.right ?? window.innerWidth) - EDGE, bottom: Math.min(window.innerHeight, p?.bottom ?? window.innerHeight) - EDGE };
      /* The part scrolled out of the pane: no bar hanging at the edge for a part nobody can see. */
      if (r.bottom < box.top || r.top > box.bottom || r.right < box.left || r.left > box.right) { setAt(null); return; }
      /* Clear of what the part already wears over its top edge (its name chip, its decision badge): above them where they meet. */
      const worn = [part.querySelector<HTMLElement>("[data-part-tag]")?.parentElement, part.querySelector<HTMLElement>(`[data-decide-for="${CSS.escape(one)}"]`)]
        .map((el) => el?.getBoundingClientRect()).filter((b): b is DOMRect => !!b && b.width > 0 && b.bottom <= r.top + 2);
      const clampX = (x: number) => Math.max(box.left, Math.min(x, box.right - w));
      const right = clampX(r.right - w), leftAligned = clampX(r.left);
      const aboveAt = (x: number) => { let y = r.top - GAP - h; for (const b of worn.sort((a, z) => z.top - a.top)) if (x < b.right && x + w > b.left && y < b.bottom && y + h > b.top) y = b.top - GAP / 2 - h; return y; };
      const fits = (x: number, y: number) => y >= box.top && y + h <= box.bottom && !(hand && hand.x >= x - 2 && hand.x <= x + w + 2 && hand.y >= y - 2 && hand.y <= y + h + 2);
      /* Above, right-aligned; then left-aligned; then below; and for a part taller than the pane, at the pane's top, wherever the hand is not. */
      const tries: [number, number, boolean][] = [[right, aboveAt(right), false], [leftAligned, aboveAt(leftAligned), false], [right, r.bottom + GAP, true], [leftAligned, r.bottom + GAP, true], [right, box.top, false], [leftAligned, box.top, false], [clampX(r.left - w - GAP), box.top, false]];
      const [left, top, below] = tries.find(([x, y]) => fits(x, y)) ?? tries[4]!;
      setAt((was) => (was && Math.abs(was.left - left) < 0.5 && Math.abs(was.top - top) < 0.5 && was.below === below ? was : { left, top, below }));
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(place); };
    place();
    /* Read again when anything could have moved it: an edit, a zoom or pan, a scroll of the pane, the window. */
    const off = useStudio.subscribe(soon);
    window.addEventListener("scroll", soon, true);
    window.addEventListener("resize", soon);
    return () => { off(); window.removeEventListener("scroll", soon, true); window.removeEventListener("resize", soon); if (frame) cancelAnimationFrame(frame); };
  }, [show, one, pane]);

  if (!show || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={bar}
      data-pick-bar={one}
      data-pick-bar-below={at?.below ? "" : undefined}
      role="toolbar"
      aria-label="Picked part"
      /* A press here is the bar's, not the board's: the portal still bubbles through the board in React. */
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-40 flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ left: at?.left ?? -9999, top: at?.top ?? -9999, visibility: at ? "visible" : "hidden", background: VOID.face, boxShadow: `inset 0 0 0 1px ${VOID.rim}, 0 6px 18px oklch(0 0 0 / 0.45)` }}
    >
      {KEYS.map(({ id, label, Icon, hue }) => (
        <button
          key={id}
          type="button"
          data-pick-bar-do={id}
          title={label}
          aria-label={label}
          className="grid size-7 place-items-center rounded-md transition-colors"
          style={{ color: hue }}
          onMouseEnter={(e) => { e.currentTarget.style.background = VOID.faceLit; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            act(id, one!, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }}
        >
          <Icon className="size-4" strokeWidth={2} />
        </button>
      ))}
    </div>,
    document.body,
  );
}
