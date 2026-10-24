"use client";
import * as React from "react";
import { SitePreview } from "../SitePreview";
import { wipeAt } from "./model";
import { useInnerWidth } from "./scrollLock";
import type { Side } from "./ComparePage";

/**
 * The slider: B over A in one pane, A to the left of the handle and B to the
 * right. Dragging it, or the arrow keys when it has focus, moves the wipe.
 * One pane scrolls both layers, so they cannot drift apart.
 */
export function Wipe({ a, b }: { a: Side; b: Side }) {
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  const [scroll, setScroll] = React.useState<HTMLDivElement | null>(null);
  const [at, setAt] = React.useState(50);
  const width = useInnerWidth(scroll);
  const move = (x: number) => { if (box) setAt(wipeAt(x, box.getBoundingClientRect().left, width)); };
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e.clientX);
  };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") setAt((v) => Math.max(0, v - step));
    else if (e.key === "ArrowRight") setAt((v) => Math.min(100, v + step));
    else if (e.key === "Home") setAt(0);
    else if (e.key === "End") setAt(100);
    else return;
    e.preventDefault();
  };
  return (
    <div data-compare-stage="slider" className="mt-4">
      <div className="mb-1.5 flex justify-between text-plain font-medium text-fg-muted">
        <span data-compare-name="a" className="truncate">{a.name}</span>
        <span data-compare-name="b" className="truncate text-right">{b.name}</span>
      </div>
      <div ref={setBox} className="relative rounded-md border border-border">
        <div ref={setScroll} data-compare-scroll="" className="h-[76vh] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
          {width > 0 ? (
            <div className="relative" style={{ width }}>
              <div data-compare-pane="a" data-site-id={a.id}>
                <SitePreview doc={a.doc} width={width} height={width} whole />
              </div>
              {/* B is clipped from the handle rightwards, so it shows to the right of it and A shows to the left. */}
              <div data-compare-pane="b" data-site-id={b.id} className="absolute left-0 top-0" style={{ width, clipPath: `inset(0 0 0 ${at}%)` }}>
                <SitePreview doc={b.doc} width={width} height={width} whole />
              </div>
            </div>
          ) : null}
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Wipe between A and B"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(at)}
          data-compare-handle=""
          data-compare-wipe={at.toFixed(1)}
          onPointerDown={drag}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e.clientX); }}
          onKeyDown={key}
          className="absolute inset-y-0 z-10 w-4 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:[&>span]:bg-accent-strong"
          style={{ left: `${at}%` }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_0_1px_var(--accent-soft)]" />
          <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent bg-panel" />
        </div>
      </div>
    </div>
  );
}
