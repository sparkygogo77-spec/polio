"use client";
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { getSetting } from "@/core/settings/store";
import { useFlashOnChange } from "@/core/feedback/useFlashOnChange";

export interface NumberTickerProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  format?: (n: number) => string;
  /** ms to tween between values. */
  duration?: number;
  /** Flash background on change. */
  flash?: boolean;
  /** Colour the text by direction of the last change. */
  colorize?: boolean;
}

/** Animated number that tweens toward new values and flashes on change. */
export function NumberTicker({ value, format = (n) => n.toFixed(0), duration = 380, flash = true, colorize, className, ...props }: NumberTickerProps) {
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);
  const raf = React.useRef<number | null>(null);
  const flashRef = useFlashOnChange(value, { disabled: !flash });
  const [dir, setDir] = React.useState<"up" | "down" | null>(null);

  React.useEffect(() => {
    const start = from.current;
    const delta = value - start;
    if (delta === 0) return;
    setDir(delta > 0 ? "up" : "down");
    const motionOff = getSetting<string>("effects.motion") === "off";
    if (motionOff || duration <= 0) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = start + delta * eased;
      setShown(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, duration]);

  return (
    <span
      ref={flashRef}
      className={cn("num inline-block rounded-xs px-0.5 -mx-0.5", colorize && dir === "up" && "text-up", colorize && dir === "down" && "text-down", className)}
      {...props}
    >
      {format(shown)}
    </span>
  );
}
