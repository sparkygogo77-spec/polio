"use client";
/**
 * Buttons that do one thing: go where their link points, or say they did.
 */
import * as React from "react";
import { Btn, Fill } from "./primitives";
import { splitTurn } from "./Hero";
import { cardStyle, items, radiusFor, titled } from "./theme";
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

/**
 * The invitation: the panel a page ends on.
 *
 * A bordered box a shade off the page, holding a small label, a headline
 * that turns colour on its last line, and one button out to the right. It
 * was being drawn with a region — a dashed box with its name printed in the
 * middle — because there was no part for it, and a region is a note to the
 * builder rather than a thing on the page.
 *
 * Its three parts are typed as keyed items ("label: Join the transmission,
 * heading: Stay in the loop., button: Follow on X"), and positionally when
 * they are not keyed, so it can be filled in either way.
 */
export function InvitePanel({ id, content, options, theme: t, mode, link, onNavigate, emit }: PartProps) {
  const typed = items(content, ["Join the transmission", "Stay in the loop.", "Follow on X"]).map(titled);
  const keyed = (key: string) => typed.find((x) => x.body && x.title.toLowerCase() === key)?.body ?? null;
  const loose = typed.filter((x) => !x.body).map((x) => x.title);
  const label = keyed("label") ?? keyed("eyebrow") ?? loose[0] ?? "";
  const heading = keyed("heading") ?? keyed("headline") ?? loose[1] ?? "Stay in the loop.";
  const button = keyed("button") ?? keyed("cta") ?? loose[2] ?? "Follow on X";
  // The same turn the headline part uses, so "last word" means the same
  // thing in both and a one-sentence heading can still turn at its end.
  const turn = opt(options, "turn", "last word accent");
  const split = splitTurn(heading, turn);
  const [done, setDone] = React.useState(false);

  return (
    <Fill
      t={t}
      data-part={id}
      style={{
        ...cardStyle(t),
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: t.fontPx * 2,
        padding: `${t.fontPx * 1.8}px ${t.fontPx * 2}px`,
        borderRadius: radiusFor(opt(options, "shape", "rounded"), t) || Math.min(t.radius * 2, 28),
      }}
    >
      <div style={{ minWidth: 0 }}>
        {label ? (
          <p style={{ margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: Math.max(9, t.fontPx * 0.72), letterSpacing: "0.22em", textTransform: "uppercase", color: t.accent }}>
            {label}
          </p>
        ) : null}
        <p style={{ margin: `${t.fontPx * 0.5}px 0 0`, fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 2.4, lineHeight: 1.06, letterSpacing: -0.5 }}>
          {split.head}
          {split.tail ? <span style={{ color: turn.endsWith("muted") ? t.muted : t.accent }}>{split.tail}</span> : null}
        </p>
      </div>
      <Btn
        t={t}
        primary={opt(options, "variant", "outline") === "solid"}
        shape="pill"
        label={done ? "Done \u2713" : button}
        onClick={() => {
          if (link) { onNavigate?.(link); return; }
          if (mode === "live") { setDone(true); window.setTimeout(() => setDone(false), 1200); }
          emit?.({ type: "toast", text: button });
        }}
        style={{ flex: "none", fontSize: t.fontPx * 0.85, textTransform: "uppercase", letterSpacing: "0.12em" }}
      />
    </Fill>
  );
}
