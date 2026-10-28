"use client";
/**
 * What's new, on the real controls.
 *
 * Each new control on screen gets an accent outline, and one small tip says
 * what the first of them is: "New: … · 1 of N", with Next, Dismiss and
 * Don't show again. Both are fixed layers drawn over the app, so nothing on
 * the board moves; the outlines take no presses, and the tip is placed clear
 * of the part picked on the board.
 *
 * A control that is not on screen is skipped quietly. Its entry waits, and
 * is shown when its panel opens (the screen is looked at again every
 * moment while a run is on).
 *
 * Mounted once, in the shell (`AppShell`), beside the tour.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { VOID } from "@/core/ui/void";
import { useStudio } from "@/features/studio/board/store";
import { onScreen, WHATS_NEW } from "./registry";
import { autoAllowed, useWhatsNew } from "./store";

const TIP_W = 300;
const TIP_H = 92;
const GAP = 10;
const LOOK_MS = 500;

interface Lit { id: string; text: string; box: DOMRect }

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Where the picked part is drawn on the board, if anything is picked. */
function pickedBoxes(): DOMRect[] {
  const ids = (useStudio.getState() as { selection?: string[] }).selection ?? [];
  const out: DOMRect[] = [];
  for (const id of ids) {
    try {
      const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (el) out.push(el.getBoundingClientRect());
    } catch { /* not drawn */ }
  }
  return out;
}

/** Beside the control (below, above, right, left), clear of the picked part; the first that fits. */
function placeTip(box: DOMRect, avoid: DOMRect[]): { x: number; y: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clamp = (x: number, y: number) => ({ x: Math.max(8, Math.min(vw - TIP_W - 8, x)), y: Math.max(8, Math.min(vh - TIP_H - 8, y)) });
  const tries = [
    clamp(box.left, box.bottom + GAP),
    clamp(box.left, box.top - GAP - TIP_H),
    clamp(box.right + GAP, box.top),
    clamp(box.left - GAP - TIP_W, box.top),
    clamp(8, vh - TIP_H - 8),
    clamp(vw - TIP_W - 8, vh - TIP_H - 8),
  ];
  const clear = (p: { x: number; y: number }) => {
    const r = new DOMRect(p.x, p.y, TIP_W, TIP_H);
    return !overlaps(r, box) && avoid.every((a) => !overlaps(r, a));
  };
  return tries.find(clear) ?? tries.find((p) => avoid.every((a) => !overlaps(new DOMRect(p.x, p.y, TIP_W, TIP_H), a))) ?? tries[0]!;
}

export function WhatsNew() {
  const path = usePathname() ?? "";
  const queue = useWhatsNew((s) => s.queue);
  const done = useWhatsNew((s) => s.done);
  const [lit, setLit] = React.useState<Lit[]>([]);
  const [avoid, setAvoid] = React.useState<DOMRect[]>([]);

  /* The first open of the Builder on this browser after an update: whatever it has not seen. */
  const builder = path.startsWith("/builder");
  React.useEffect(() => {
    if (!builder || !autoAllowed()) return;
    const t = window.setTimeout(() => useWhatsNew.getState().startNew(), 1500);
    return () => window.clearTimeout(t);
  }, [builder]);

  /* While a run is on, look at the screen again and again: a panel that opens brings its entries. */
  React.useEffect(() => {
    if (!queue.length) { setLit([]); return; }
    const look = () => {
      const now: Lit[] = [];
      for (const e of WHATS_NEW) {
        if (!queue.includes(e.id) || done.includes(e.id)) continue;
        const el = onScreen(e);
        if (el) now.push({ id: e.id, text: e.text, box: el.getBoundingClientRect() });
      }
      setLit((was) => (JSON.stringify(was) === JSON.stringify(now) ? was : now));
      setAvoid(pickedBoxes());
    };
    look();
    const t = window.setInterval(look, LOOK_MS);
    window.addEventListener("scroll", look, true);
    window.addEventListener("resize", look);
    return () => { window.clearInterval(t); window.removeEventListener("scroll", look, true); window.removeEventListener("resize", look); };
  }, [queue, done]);

  const now = lit[0];
  if (!queue.length || !now || typeof document === "undefined") return null;
  const at = placeTip(now.box, avoid);
  const k = done.length + 1;
  const n = done.length + lit.length;
  const s = useWhatsNew.getState();
  const btn = "tactile rounded px-1.5 py-0.5 font-medium";

  return createPortal(
    <>
      {lit.map((l, i) => (
        <div
          key={l.id}
          data-whatsnew-ring={l.id}
          aria-hidden
          className="pointer-events-none fixed z-[95] rounded-md"
          style={{
            left: l.box.left - 3, top: l.box.top - 3, width: l.box.width + 6, height: l.box.height + 6,
            outline: `2px solid var(--accent)`,
            boxShadow: i === 0 ? "0 0 0 4px color-mix(in oklch, var(--accent) 30%, transparent)" : undefined,
            opacity: i === 0 ? 1 : 0.6,
          }}
        />
      ))}
      <div
        data-whatsnew-tip={now.id}
        role="status"
        className="fixed z-[96] flex flex-col gap-1.5 rounded-md border p-2 text-small"
        style={{ left: at.x, top: at.y, width: TIP_W, background: VOID.face, borderColor: VOID.rim, color: VOID.text, boxShadow: VOID.drop, pointerEvents: "auto" }}
      >
        <span data-whatsnew-text="">New: {now.text} · {k} of {n}</span>
        <span className="flex items-center gap-1">
          <button type="button" data-whatsnew-next="" className={btn} style={{ background: "var(--accent)", color: "var(--accent-fg)" }} onClick={() => s.next(now.id)}>
            {lit.length > 1 ? "Next" : "Done"}
          </button>
          <button type="button" data-whatsnew-dismiss="" className={btn} style={{ color: VOID.text }} onClick={() => s.dismiss(lit.map((l) => l.id))}>
            Dismiss
          </button>
          <span className="flex-1" />
          <button type="button" data-whatsnew-never="" className={btn} style={{ color: VOID.muted }} onClick={() => s.never()}>
            Don&apos;t show again
          </button>
        </span>
      </div>
    </>,
    document.body,
  );
}
