"use client";
/**
 * The companion: the same page as a phone or tablet, parked wherever you want.
 *
 * The board is the desktop view, so this window never shows desktop — its job
 * is to tell you what the narrow version of what you are building looks like,
 * at the same time, without taking the board away. Drag it by its bar so it is
 * never over the part you are working on, and tap a part inside it to select
 * that part on the board.
 */
import * as React from "react";
import { Eye, GripHorizontal, Maximize2, Minimize2, Smartphone, Tablet } from "lucide-react";
import { activePage, useStudio } from "./store";
import { DEVICE_WIDTH } from "./live/layout";
import { LiveSite } from "./live/LiveSite";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

const SIZES = { s: 200, m: 260, l: 330 } as const;

export function PreviewWindow() {
  const [size, setSize] = React.useState<keyof typeof SIZES>("m");
  const [drag, setDrag] = React.useState<{ dx: number; dy: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const shapes = useStudio((s) => s.shapes);
  const siteName = useStudio((s) => s.brief.name);
  const frameWidth = useStudio((s) => s.frameWidth);
  const activeId = useStudio((s) => s.activePageId);
  const page = useStudio(activePage);
  // A document that arrived without one (a published site, a thread the
  // board stood back on) leaves this null; the window simply is not there.
  const companion = useStudio((s) => s.companion);
  const { device, x, y, open } = companion ?? { device: "phone" as const, x: 0, y: 0, open: false };
  const set = useStudio((s) => s.setCompanion);

  const pageNodes = React.useMemo(() => nodes.filter((n) => n.pageId === activeId), [nodes, activeId]);
  const width = DEVICE_WIDTH[device];
  const boxW = SIZES[size];
  const scale = boxW / width;

  /*
   * ABOVE THE BAND AT THE COLUMN'S FOOT, NEVER OVER IT.
   *
   * The window is kept from the column's bottom corner, and the band at the
   * foot (the shelf, or the backend with its prompt box and Send key) stands
   * over the bottom of the column: at the backend's height the window sat on
   * the Send key and nothing could press it (`tests/backend-surface.mjs`).
   * So its foot is lifted clear of whatever band is standing there, measured
   * as it changes, and the offset the hand gave it is kept for when the band
   * is lower again.
   */
  const [lift, setLift] = React.useState(0);
  React.useEffect(() => {
    const parent = ref.current?.offsetParent as HTMLElement | null;
    if (!parent) return;
    let band: HTMLElement | null = null;
    /* One probe for the life of the window: put in once, so the watch on the column below never sees it come and go. */
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;left:0;top:0;width:0;visibility:hidden;pointer-events:none";
    parent.appendChild(probe);
    const ro = new ResizeObserver(() => measure());
    const measure = () => {
      const now = parent.querySelector<HTMLElement>("[data-studio-band][data-band-over]");
      if (now !== band) { if (band) ro.unobserve(band); band = now; if (band) ro.observe(band); }
      if (!band) { setLift(0); return; }
      const p = parent.getBoundingClientRect();
      const b = band.getBoundingClientRect();
      /*
       * J: "the preview box must not resize or move when the shelf area
       * grows", and the shelf is to scroll "clear of the preview box". A band
       * that grows says how tall it opens to (`data-band-reach`, a CSS length),
       * and the window stands above that from the start: still while a
       * category opens, and never over the cards. Grown past it by hand, the
       * band's own height wins. Read through a hidden probe, so the length is
       * resolved by the browser exactly as the band's own height is.
       */
      const reach = band.dataset.bandReach;
      let tall = b.height;
      if (reach) {
        probe.style.height = reach;
        tall = Math.max(tall, probe.getBoundingClientRect().height);
      }
      setLift(Math.max(0, Math.round(p.bottom - (b.bottom - tall))));
    };
    measure();
    /* A band comes and goes with the view: looked for again, once a frame at most. */
    let queued = 0;
    const soon = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; measure(); }); };
    const mo = new MutationObserver(soon);
    mo.observe(parent, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-band-over"] });
    ro.observe(parent);
    return () => { mo.disconnect(); ro.disconnect(); cancelAnimationFrame(queued); probe.remove(); };
  }, []);

  /* ------------------------------------------------------------- dragging */
  React.useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const parent = ref.current?.offsetParent as HTMLElement | null;
      if (!parent) return;
      const box = ref.current!.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      // Store the offset from whichever edges it is nearest, so it stays put on resize.
      const left = e.clientX - drag.dx - p.left;
      const top = e.clientY - drag.dy - p.top;
      set({
        x: Math.round(Math.max(-p.width + 60, Math.min(-8, left - p.width + box.width))),
        y: Math.round(Math.max(-p.height + 60, Math.min(-8, top - p.height + box.height))),
      });
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, set]);

  /* Tapping a part in the companion selects it on the board. */
  const onPick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest?.("[data-live-node]") as HTMLElement | null;
    const id = el?.dataset.liveNode;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    play("select");
    useStudio.getState().setSelection([id]);
  };

  return (
    <div
      ref={ref}
      data-preview-window=""
      className="absolute z-20 flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-panel"
      style={{ right: -x, bottom: Math.max(-y, lift + 8), width: open ? boxW : 132 }}
    >
      <header
        className="flex h-7 shrink-0 cursor-grab items-center gap-1 border-b border-border px-1.5 active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const box = ref.current!.getBoundingClientRect();
          setDrag({ dx: e.clientX - box.left, dy: e.clientY - box.top });
        }}
      >
        <GripHorizontal className="size-3 shrink-0 text-fg-faint" />
        <span className="min-w-0 flex-1 truncate text-small font-medium text-fg">
          {open ? `${device === "phone" ? "Phone" : "Tablet"} · ${page.name}` : "Phone"}
        </span>
        {open ? (
          <>
            <Tooltip content={device === "phone" ? "Show as a tablet" : "Show as a phone"}>
              <Button variant="ghost" size="iconXs" aria-label="Companion device" onClick={() => { play("select"); set({ device: device === "phone" ? "tablet" : "phone" }); }}>
                {device === "phone" ? <Tablet /> : <Smartphone />}
              </Button>
            </Tooltip>
            <Tooltip content="Size">
              <button type="button" aria-label="Companion size" onClick={() => { play("select"); setSize(size === "s" ? "m" : size === "m" ? "l" : "s"); }} className="tactile rounded-sm px-1 text-small uppercase text-fg-muted hover:bg-hover hover:text-fg">
                {size}
              </button>
            </Tooltip>
          </>
        ) : (
          <Eye className="size-3 text-accent" />
        )}
        <Tooltip content={open ? "Collapse" : "Expand"}>
          <Button variant="ghost" size="iconXs" aria-label="Toggle companion" onClick={() => set({ open: !open })}>
            {open ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </Tooltip>
      </header>

      {open ? (
        <div data-live-scroller="" className={cn("relative overflow-y-auto", size === "l" ? "max-h-[54vh]" : "max-h-[40vh]")} onClickCapture={onPick}>
          {pageNodes.length ? (
            /* Drawn at the device's width and zoomed to the window: the box is as
               tall as the page really draws, where it was sized from a guess
               that came to 51,343px on a captured page and showed nothing. */
            <div data-companion-page="" style={{ width: boxW, position: "relative", overflow: "hidden" }}>
              <div style={{ width, zoom: scale }}>
                <LiveSite pages={pages} nodes={nodes} pageId={activeId} device={device} frameWidth={frameWidth} format={format}
            look={look} siteName={siteName} shapes={shapes} />
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-small text-fg-muted">The narrow version of this page appears here.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
