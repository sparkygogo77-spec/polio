"use client";
import { useCallback, useEffect, useRef } from "react";
import { getSetting } from "@/core/settings/store";

type Direction = "up" | "down" | "neutral";

/**
 * Flash an element's background when a value changes. Uses the Web Animations
 * API so every change restarts the flash even mid-animation.
 *
 *   const ref = useFlashOnChange(marketCap);
 *   <span ref={ref}>{fmtUsd(marketCap)}</span>
 */
export function useFlashOnChange<T>(
  value: T,
  opts: { compare?: (prev: T, next: T) => Direction; disabled?: boolean } = {},
) {
  const el = useRef<HTMLElement | null>(null);
  const prev = useRef<T>(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      prev.current = value;
      return;
    }
    if (Object.is(prev.current, value)) return;
    const dir = opts.compare ? opts.compare(prev.current, value) : defaultCompare(prev.current, value);
    prev.current = value;
    if (opts.disabled || !el.current) return;
    if (!getSetting<boolean>("effects.flash") || getSetting<string>("effects.motion") === "off") return;
    flashElement(el.current, dir);
  }, [value, opts.compare, opts.disabled]);

  return useCallback((node: HTMLElement | null) => {
    el.current = node;
  }, []);
}

function defaultCompare(a: unknown, b: unknown): Direction {
  if (typeof a === "number" && typeof b === "number") return b > a ? "up" : b < a ? "down" : "neutral";
  return "neutral";
}

/** Imperative flash for non-hook call sites (row insert, list updates). */
export function flashElement(node: HTMLElement, dir: Direction = "neutral", durationMs?: number) {
  const dur = durationMs ?? getSetting<number>("effects.flashDurationMs");
  const color =
    dir === "up" ? "var(--flash-up)" : dir === "down" ? "var(--flash-down)" : "var(--flash-neutral)";
  try {
    node.animate(
      [
        { backgroundColor: color, color: dir === "neutral" ? "inherit" : dir === "up" ? "var(--up)" : "var(--down)" },
        { backgroundColor: "transparent", color: "inherit" },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  } catch {
    /* older browsers */
  }
}
