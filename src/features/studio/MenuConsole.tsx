"use client";
/**
 * The flat colour picker.
 *
 * The part menu's own picker is bent round a ring now (`RingEditors.tsx`);
 * this is the straight one, for the texture panel on the left, where a layer
 * gets a colour of its own off the same three axes — hue, lightness, strength.
 * The white line is where you are; the row of dots under it is the same
 * spectrum in steps, so a colour can be *hit* rather than hunted for.
 */
import * as React from "react";
import { play } from "@/core/audio/engine";
import { css as oklchCss, parseColor } from "./look";
import { CONSOLE_HUE, litEdge } from "./RingConsole";
import { PREVIEW } from "./colourMenu";

const HUE_BAR = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) => oklchCss({ l: 0.7, c: 0.19, h: i * 30 })).join(", ")})`;

export function Spectrum({
  value, onChange, label = "Colour",
}: {
  value: string;
  onChange: (colour: string) => void;
  label?: string;
}) {
  const parsed = parseColor(value) ?? { l: 0.7, c: 0.18, h: 265 };
  const pick = (clientX: number, el: HTMLElement, apply: (f: number) => void) => {
    const r = el.getBoundingClientRect();
    apply(Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))));
  };
  const drag = (e: React.PointerEvent<HTMLDivElement>, apply: (f: number) => void) => {
    const el = e.currentTarget;
    pick(e.clientX, el, apply);
    const move = (m: PointerEvent) => pick(m.clientX, el, apply);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  /*
   * Picking off the bar gives you the colour on the bar.
   *
   * The hue slider used to change only the hue, so hitting the orange end of
   * the spectrum while the current colour was a near-grey background handed
   * back another near-grey — the right hue at a chroma of 0.01, which is to
   * say no colour at all, and the control read as broken. A hue pick lifts a
   * washed-out colour far enough to be the thing you just clicked; the bar
   * under it is there to take it back down again.
   */
  const LIVE = 0.14;
  const setHue = (f: number) => onChange(oklchCss({ ...parsed, c: Math.max(parsed.c, LIVE), h: f * 360 }));
  const setLight = (f: number) => onChange(oklchCss({ ...parsed, l: 0.08 + f * 0.9 }));
  const setChroma = (f: number) => onChange(oklchCss({ ...parsed, c: f * 0.32 }));

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "oklch(0.9 0.05 20)" }}>{label}</span>
        {/* What the colour is right now. A badge, not a chip: it is read,
            not picked, so it takes `PREVIEW` like the wheel's three. */}
        <span
          style={{ width: PREVIEW.size, height: PREVIEW.size, borderRadius: PREVIEW.radius, background: value, boxShadow: litEdge(CONSOLE_HUE), outline: "1px solid oklch(0.3 0.04 20)" }}
        />
      </div>
      {/* the spectrum, and the white line that says where on it you are */}
      <div
        data-spectrum=""
        role="slider"
        tabIndex={0}
        aria-label={`${label} hue`}
        aria-valuenow={Math.round(parsed.h)}
        aria-valuemin={0}
        aria-valuemax={360}
        onPointerDown={(e) => drag(e, setHue)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setHue((((parsed.h + 355) % 360) / 360));
          if (e.key === "ArrowRight") setHue((((parsed.h + 5) % 360) / 360));
        }}
        className="relative h-4 cursor-pointer rounded-full"
        style={{ background: HUE_BAR, boxShadow: litEdge(CONSOLE_HUE) }}
      >
        <span
          className="pointer-events-none absolute top-[-2px] h-[20px] w-[3px] rounded-full bg-white"
          style={{ left: `calc(${((parsed.h % 360) / 360) * 100}% - 1.5px)`, boxShadow: "0 0 0 1px oklch(0 0 0 / 0.5)" }}
        />
      </div>
      {/*
        The same spectrum in steps, so a colour can be hit rather than hunted.
        These are deliberately not chips, and the reason is a measurement: the
        panel gives this row 203px, and twelve chips at `CHIP.near` need 240
        before any gap at all — 37px more than there is. They are a band
        sampled into twelve places to press, not a menu of twelve colours, so
        they keep a size of their own and the size is stated here.
      */}
      <div className="mt-1 flex justify-between">
        {Array.from({ length: 12 }, (_, i) => {
          const h = i * 30;
          // How far apart two hues are on a wheel that wraps: the short way
          // round, never the long one.
          const raw = Math.abs(parsed.h - h) % 360;
          const near = Math.min(raw, 360 - raw) < 16;
          return (
            <button
              key={h}
              type="button"
              aria-label={`Hue ${h}`}
              onClick={() => { play("tap"); onChange(oklchCss({ ...parsed, c: Math.max(parsed.c, LIVE), h })); }}
              className="size-[9px] rounded-full transition-transform"
              style={{
                background: oklchCss({ l: Math.max(0.35, Math.min(0.85, parsed.l)), c: Math.max(LIVE, parsed.c), h }),
                transform: near ? "scale(1.5)" : undefined,
                outline: near ? "1px solid oklch(0.98 0.03 20)" : "none",
              }}
            />
          );
        })}
      </div>
      {/* how light it is: a hue on its own is not a colour */}
      <div
        data-lightness=""
        role="slider"
        tabIndex={0}
        aria-label={`${label} lightness`}
        aria-valuenow={Math.round(parsed.l * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={(e) => drag(e, setLight)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(oklchCss({ ...parsed, l: Math.max(0.04, parsed.l - 0.04) }));
          if (e.key === "ArrowRight") onChange(oklchCss({ ...parsed, l: Math.min(0.99, parsed.l + 0.04) }));
        }}
        className="relative mt-1.5 h-3 cursor-pointer rounded-full"
        style={{
          background: `linear-gradient(90deg, ${oklchCss({ ...parsed, l: 0.08 })}, ${oklchCss({ ...parsed, l: 0.53 })}, ${oklchCss({ ...parsed, l: 0.98 })})`,
          boxShadow: litEdge(CONSOLE_HUE),
        }}
      >
        <span
          className="pointer-events-none absolute top-[-2px] h-4 w-[3px] rounded-full bg-white"
          style={{ left: `calc(${(((parsed.l - 0.08) / 0.9) * 100).toFixed(1)}% - 1.5px)`, boxShadow: "0 0 0 1px oklch(0 0 0 / 0.5)" }}
        />
      </div>
      {/* and how much of it there is: grey at one end, as far as the screen
          goes at the other */}
      <div
        data-chroma=""
        role="slider"
        tabIndex={0}
        aria-label={`${label} strength`}
        aria-valuenow={Math.round((parsed.c / 0.32) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={(e) => drag(e, setChroma)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(oklchCss({ ...parsed, c: Math.max(0, parsed.c - 0.02) }));
          if (e.key === "ArrowRight") onChange(oklchCss({ ...parsed, c: Math.min(0.32, parsed.c + 0.02) }));
        }}
        className="relative mt-1.5 h-3 cursor-pointer rounded-full"
        style={{
          background: `linear-gradient(90deg, ${oklchCss({ ...parsed, c: 0 })}, ${oklchCss({ ...parsed, c: 0.32 })})`,
          boxShadow: litEdge(CONSOLE_HUE),
        }}
      >
        <span
          className="pointer-events-none absolute top-[-2px] h-4 w-[3px] rounded-full bg-white"
          style={{ left: `calc(${Math.min(100, (parsed.c / 0.32) * 100).toFixed(1)}% - 1.5px)`, boxShadow: "0 0 0 1px oklch(0 0 0 / 0.5)" }}
        />
      </div>
    </div>
  );
}
