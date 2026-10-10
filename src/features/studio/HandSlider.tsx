"use client";
/*
 * THE SIDE PANEL'S SLIDERS, SCRUBBERS AND COLOUR PICKERS: PREVIEW LIVE, SAVE ON RELEASE.
 *
 * Each move of the hand reaches the board at most once a frame; nothing is
 * saved, no undo step is taken past the first and the side panels stand still
 * until the hand comes up (`board/store/gesture.ts`). The control itself
 * follows the hand from its own value meanwhile, so a panel that stands still
 * does not hold its thumb back. Same props as `@/core/ui/slider` and
 * `<input type="color">`, so swapping one in changes nothing else.
 */
import * as React from "react";
import { Slider as CoreSlider, type SliderProps } from "@/core/ui/slider";
import { endGesture, gestureFrame, inGesture } from "./board/store";

export function Slider({ value, onValueChange, onValueCommit, onPointerDown, ...props }: SliderProps) {
  const [held, setHeld] = React.useState<number[] | null>(null);
  const mine = React.useRef(false);
  React.useEffect(() => () => { if (mine.current && inGesture()) endGesture(); }, []);
  /* The hand comes up anywhere. Radix commits only when the value ended away from where the drag began: a drag let
     go where it began left its gesture open, the side panel standing still, and the Colours preview showing a glow
     the board had lost (J, 2026-10-10). After any commit has run, end what is still open. */
  const release = React.useCallback(() => {
    setTimeout(() => {
      if (!mine.current) return;
      mine.current = false;
      if (inGesture()) endGesture();
      setHeld(null);
    }, 0);
  }, []);
  return (
    <CoreSlider
      {...props}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        const up = () => { window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true); release(); };
        window.addEventListener("pointerup", up, true);
        window.addEventListener("pointercancel", up, true);
      }}
      value={held ?? value}
      onValueChange={(v) => {
        setHeld(v);
        mine.current = true;
        gestureFrame(() => onValueChange?.(v));
      }}
      onValueCommit={(v) => {
        /* A key press commits before it changes (Radix), so the change's gesture would outlive the press:
           end it once this press is done, the change included, so each press is one undo step. */
        queueMicrotask(() => {
          if (mine.current) endGesture();
          mine.current = false;
          setHeld(null);
        });
        onValueCommit?.(v);
      }}
    />
  );
}

type ColourProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  /** Each colour the hand passes through, at most once a frame. */
  onPick: (hex: string) => void;
  /** The hand came up: the picker closed or the colour was settled. */
  onSettle?: () => void;
};

/**
 * `<input type="color">`: the browser sends a colour on every move inside its
 * picker and one `change` when the picker is closed, which is the release.
 */
export function HandColour({ onPick, onSettle, onBlur, value, ...props }: ColourProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  /* The colour under the hand: the panel stands still, and a controlled input would be put back to its value. */
  const [held, setHeld] = React.useState<string | null>(null);
  const mine = React.useRef(false);
  const settle = React.useRef(() => {});
  settle.current = () => {
    if (!mine.current) return;
    mine.current = false;
    endGesture();
    setHeld(null);
    onSettle?.();
  };
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => settle.current();
    el.addEventListener("change", done);
    return () => { el.removeEventListener("change", done); done(); };
  }, []);
  return (
    <input
      {...props}
      ref={ref}
      type="color"
      {...(value === undefined ? {} : { value: held ?? value })}
      onChange={(e) => { const hex = e.target.value; setHeld(hex); mine.current = true; gestureFrame(() => onPick(hex)); }}
      onBlur={(e) => { settle.current(); onBlur?.(e); }}
    />
  );
}
