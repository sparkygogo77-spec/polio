"use client";
/**
 * Tier B and C parts.
 *
 * Tier B is a behaviour, not a box: page transitions, back-to-top, scroll
 * effects. It has no place in the layout, so it draws as a chip that says what
 * it does and where it applies; `live/` runs the actual effect (Stage 3d).
 *
 * Tier C is something a browser cannot really do — spam protection, payments,
 * sign-in. It shows a truthful working mock so the flow can be walked through,
 * and the blueprint tells the generator what to wire up for real.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { cardStyle, items, ghostStyle} from "./theme";
import type { PartProps } from "./types";

/** A behaviour that applies to the whole page rather than sitting in it. */
export function Behaviour({ id, label, content, theme: t }: PartProps) {
  const note = content.trim();
  return (
    <Fill
      t={t}
      data-part={id}
      data-behaviour=""
      style={{ ...ghostStyle(t), display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: t.fontPx, color: t.muted, fontSize: t.fontPx * 0.9, textAlign: "center" }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: t.accent, flexShrink: 0 }} />
      <span>
        <strong style={{ color: t.text }}>{label}</strong>
        {note ? `, ${note}` : ""}
        <span style={{ display: "block", fontSize: t.fontPx * 0.75, opacity: 0.75 }}>applies to the whole page</span>
      </span>
    </Fill>
  );
}

/** Spam protection: a real checkbox that verifies, standing in for the service. */
export function Captcha({ id, content, theme: t, emit }: PartProps) {
  const [state, setState] = React.useState<"idle" | "checking" | "done">("idle");
  const label = items(content, ["I'm not a robot"])[0]!;
  const check = () => {
    if (state !== "idle") return;
    setState("checking");
    window.setTimeout(() => {
      setState("done");
      emit?.({ type: "toast", text: "Verified", level: "success" });
    }, 700);
  };
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", alignItems: "center", gap: t.fontPx * 0.7, padding: t.fontPx * 0.8 }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={state === "done"}
        aria-label={label}
        onClick={check}
        style={{
          width: t.fontPx * 1.5, height: t.fontPx * 1.5, flexShrink: 0, cursor: state === "idle" ? "pointer" : "default",
          borderRadius: Math.min(t.radius, 6), border: `2px solid ${state === "done" ? t.accent : t.line}`,
          background: state === "done" ? t.accent : "transparent", color: t.accentText,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: t.fontPx * 0.9, lineHeight: 1,
        }}
      >
        {state === "done" ? "✓" : state === "checking" ? "…" : ""}
      </button>
      <span style={{ flex: 1, fontSize: t.fontPx * 0.92 }}>{state === "done" ? "Verified" : label}</span>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.7, textAlign: "right", lineHeight: 1.2 }}>
        spam
        <br />
        protection
      </span>
    </Fill>
  );
}
