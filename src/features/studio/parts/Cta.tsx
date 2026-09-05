"use client";
/**
 * Buttons that do one thing: go where their link points, or say they did.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { items, radiusFor } from "./theme";
import { opt, type PartProps } from "./types";

export function Cta({ id, content, options, theme: t, mode, link, onNavigate, emit }: PartProps) {
  const label = items(content, [id === "follow" ? "Follow" : id === "quick-action" ? "Buy now" : "Get started"])[0]!;
  const variant = opt(options, "variant", "solid");
  const size = opt(options, "size", "medium");
  const [done, setDone] = React.useState(false);
  const [following, setFollowing] = React.useState(false);

  const onClick = () => {
    if (id === "follow") {
      setFollowing((v) => !v);
      emit?.({ type: "toast", text: following ? "Unfollowed" : "Following", level: "success" });
      return;
    }
    if (link) {
      onNavigate?.(link);
      return;
    }
    if (mode === "live") {
      setDone(true);
      window.setTimeout(() => setDone(false), 1200);
    }
    emit?.({ type: id === "quick-action" ? "success" : "toast", text: label });
  };

  const outline = variant === "outline";
  const ghost = variant === "ghost";
  const text = id === "follow" && following ? "Following ✓" : done ? "Done ✓" : label;
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={id === "follow" ? following : undefined}
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          fontWeight: 700, fontFamily: t.bodyFamily, fontSize: t.fontPx * (size === "large" ? 1.15 : size === "small" ? 0.85 : 1), whiteSpace: "nowrap",
          background: outline ? "transparent" : ghost ? `${t.accent}22` : following ? t.surface : t.accent,
          color: outline || ghost || following ? t.accent : t.accentText,
          border: outline || following ? `2px solid ${t.accent}` : "2px solid transparent",
          borderRadius: radiusFor(opt(options, "shape", "rounded"), t) || Math.min(t.radius, 14),
          transition: "transform 120ms ease, background 160ms ease",
        }}
      >
        {text}
      </button>
    </Fill>
  );
}
