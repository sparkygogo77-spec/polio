"use client";
/**
 * Small building blocks parts are made of. No Radix, no core imports — see
 * types.ts for why.
 */
import * as React from "react";
import type { PartMode } from "./types";
import { radiusFor, withAlpha, type Theme } from "./theme";

/** Fills the part's box and sets the type. `overflow` is visible for parts that open things. */
export function Fill({
  t, children, style, overflow = "hidden", ref, ...rest
}: { t: Theme; children: React.ReactNode; style?: React.CSSProperties; overflow?: "hidden" | "visible"; ref?: React.Ref<HTMLDivElement> } & Omit<React.HTMLAttributes<HTMLDivElement>, "style">) {
  return (
    <div
      ref={ref}
      {...rest}
      style={{
        width: "100%", height: "100%", overflow, boxSizing: "border-box", position: "relative",
        color: t.text, fontFamily: t.bodyFamily, fontSize: t.fontPx, lineHeight: t.lineHeight,
        fontWeight: t.fontWeight, letterSpacing: t.letterSpacing,
        // The part's own background if it was given one, otherwise the floor
        // that keeps a page texture behind the site rather than through it.
        // Either way a part that paints its own box (see `cardStyle`) wins,
        // because its `style` lands after this one.
        background: t.ownBackground ?? t.partGround,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Btn({
  t, label, primary = true, shape, onClick, style, ...rest
}: { t: Theme; label: React.ReactNode; primary?: boolean; shape?: string; onClick?: () => void; style?: React.CSSProperties } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style" | "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", cursor: "pointer",
        padding: `${Math.round(t.fontPx * 0.55)}px ${Math.round(t.fontPx * 1.1)}px`,
        fontSize: t.fontPx * 0.92, fontWeight: 600, fontFamily: t.bodyFamily, lineHeight: 1.2,
        borderRadius: radiusFor(shape, t) || Math.min(t.radius, 12),
        // The secondary button is where the highlight role lives. It used to
        // be a transparent box with a hairline, which meant `highlight` was
        // set on eight parts out of seventy and changing it on the other
        // sixty-two did nothing you could see.
        background: primary ? (t.sheen ? `${t.sheen}, ${t.accent}` : t.accent) : withAlpha(t.highlight, 0.18),
        color: primary ? t.accentText : t.text,
        border: primary ? "1px solid transparent" : `1px solid ${withAlpha(t.highlight, 0.85)}`,
        // Under a light a button is a thing standing on the page, not a
        // rectangle printed on it.
        ...(t.shadow ? { boxShadow: t.shadow } : {}),
        ...style,
      }}
    >
      {label}
    </button>
  );
}

/**
 * The empty slot a part leaves for something it does not have.
 *
 * The label on it is a note to whoever is building — "visual", "video",
 * "view 2" — and it is for the board only. It went out on his published
 * site: the word `visual` was in the delivered HTML, once, where a picture
 * should have been. A word like that is the Builder talking to itself in
 * front of a visitor, so live mode draws the slot and says nothing in it.
 */
export function Placeholder({ t, label, mode = "board" }: { t: Theme; label?: string; mode?: PartMode }) {
  return (
    <div
      style={{
        width: "100%", height: "100%", minHeight: 24, borderRadius: Math.min(t.radius, 10),
        background: `linear-gradient(140deg, ${withAlpha(t.accent, 0.17)}, ${withAlpha(t.highlight, 0.13)})`,
        border: `1px solid ${t.line}`,
        display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.75,
      }}
    >
      {mode === "board" ? label : null}
    </div>
  );
}

/** A repeating timer that only runs in live mode. */
export function useTicker(mode: PartMode, ms: number, tick: () => void, enabled = true) {
  const ref = React.useRef(tick);
  ref.current = tick;
  React.useEffect(() => {
    if (mode !== "live" || !enabled) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [mode, ms, enabled]);
}

/** Shared focus ring that reads on any theme. */
export function focusRing(t: Theme): string {
  return `0 0 0 2px ${t.bg}, 0 0 0 4px ${t.accent}`;
}
