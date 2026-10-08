"use client";
/**
 * Frame from a picture: drop a picture of a box, drag its four lines to where
 * the corners end, and the part wears it at any size (`frame.ts`).
 */
import * as React from "react";
import { Button } from "@/core/ui/button";
import { Segmented } from "@/core/ui/segmented";
import { Slider } from "@/core/ui/slider";
import { play } from "@/core/audio/engine";
import { useStudio, type StudioNode } from "../store";
import { ImageWell } from "../ImageIntake";
import { MAX_SLICE, frameSides, isFrame, newFrame, type PictureFrame } from "../frame";

/** A picture's own size, once the browser has opened it. */
function sizeOf(src: string): Promise<{ w: number; h: number }> {
  return new Promise((done, fail) => {
    const img = new Image();
    img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => fail(new Error("This browser cannot open that picture."));
    img.src = src;
  });
}

const SIDES = ["top", "right", "bottom", "left"] as const;

/** The picture with its four cut lines; drag a line to move it. */
function SlicePicker({ frame, onChange }: { frame: PictureFrame; onChange: (slice: PictureFrame["slice"]) => void }) {
  const box = React.useRef<HTMLDivElement>(null);
  const held = React.useRef<number | null>(null);
  const { w, h } = frame.size;
  const at = (side: number, e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const fx = ((e.clientX - r.left) / r.width) * 100, fy = ((e.clientY - r.top) / r.height) * 100;
    const v = [fy, 100 - fx, 100 - fy, fx][side]!;
    const next = [...frame.slice] as PictureFrame["slice"];
    next[side] = Math.round(Math.max(0, Math.min(MAX_SLICE, v)) * 10) / 10;
    onChange(next);
  };
  const [t, r, b, l] = frame.slice;
  const line = (side: number, style: React.CSSProperties, across: boolean) => (
    <div key={side} data-frame-line={SIDES[side]} aria-label={`Where the ${SIDES[side]} corners end`} role="slider" aria-valuenow={frame.slice[side]}
      className="absolute touch-none"
      style={{ ...style, ...(across ? { left: 0, right: 0, height: 12, marginTop: -6, cursor: "ns-resize" } : { top: 0, bottom: 0, width: 12, marginLeft: -6, cursor: "ew-resize" }) }}
      onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); held.current = side; }}
      onPointerMove={(e) => { if (held.current === side) at(side, e); }}
      onPointerUp={() => { held.current = null; play("confirm"); }}>
      <div className="absolute border-accent" style={across ? { left: 0, right: 0, top: 5, borderTopWidth: 2, borderTopStyle: "dashed" } : { top: 0, bottom: 0, left: 5, borderLeftWidth: 2, borderLeftStyle: "dashed" }} />
    </div>
  );
  return (
    <div ref={box} data-frame-picker="" className="relative mx-auto max-w-full select-none overflow-hidden rounded-sm border border-border"
      style={{ aspectRatio: `${w} / ${h}`, maxHeight: 220, backgroundImage: `url(${frame.src})`, backgroundSize: "100% 100%", backgroundColor: "rgb(0 0 0 / 0.35)" }}>
      {line(0, { top: `${t}%` }, true)}
      {line(2, { top: `${100 - b}%` }, true)}
      {line(3, { left: `${l}%` }, false)}
      {line(1, { left: `${100 - r}%` }, false)}
    </div>
  );
}

/** This part's frame from a picture, or a place to drop one. */
export function FrameField({ node }: { node: StudioNode }) {
  const frame = isFrame(node.art?.frame) ? node.art!.frame : null;
  const [error, setError] = React.useState<string | null>(null);
  const set = (next: PictureFrame | null) => {
    const art = { ...(node.art ?? {}) };
    if (next) art.frame = next; else delete art.frame;
    useStudio.getState().updateNode(node.id, { art: Object.keys(art).length ? art : null });
  };
  const take = async (src: string) => {
    try {
      const { w, h } = await sizeOf(src);
      setError(null);
      set(frame ? { ...frame, src, size: { w, h } } : newFrame(src, w, h));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const heading = <span className="mb-1 block text-small font-medium uppercase tracking-wider text-fg-faint">Frame from a picture</span>;
  if (!frame) {
    return (
      <div data-part-frame="">
        {heading}
        <ImageWell label="picture of a box" onImage={(src) => void take(src)} />
        <span className="mt-1 block text-small text-fg-muted">Its corners stay as drawn; its edges stretch to any size.</span>
        {error ? <p className="text-small text-danger">{error}</p> : null}
      </div>
    );
  }
  const [t, r, b, l] = frameSides(frame);
  return (
    <div data-part-frame="on" className="space-y-1.5">
      {heading}
      <SlicePicker frame={frame} onChange={(slice) => set({ ...frame, slice })} />
      <p className="text-small text-fg-muted">Drag the lines to where the corners end. Drawn {t} / {r} / {b} / {l} px thick.</p>
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-small text-fg-muted">Size</span>
        <Slider value={[Math.round(frame.scale * 100)]} min={5} max={200} step={1} aria-label="Frame size"
          onValueChange={(v) => set({ ...frame, scale: (v[0] ?? 50) / 100 })} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Segmented size="xs" value={frame.repeat === "stretch" ? "stretch" : "repeat"} onChange={(v) => set({ ...frame, repeat: v === "stretch" ? "stretch" : "round" })}
          options={[{ value: "stretch", label: "stretch edges" }, { value: "repeat", label: "repeat edges" }]} />
        <label className="flex items-center gap-1 text-small text-fg-muted">
          <input type="checkbox" checked={frame.fill} onChange={(e) => set({ ...frame, fill: e.target.checked })} aria-label="Fill the middle" />
          fill the middle
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        <ImageWell compact className="w-16" src={frame.src} label="picture" onImage={(src) => void take(src)} />
        <Button size="xs" variant="outline" onClick={() => set(null)}>Remove frame</Button>
      </div>
      {error ? <p className="text-small text-danger">{error}</p> : null}
    </div>
  );
}
