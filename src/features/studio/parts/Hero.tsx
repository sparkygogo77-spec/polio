"use client";
/**
 * First-screen parts: heroes, the one-line pitch, and the trust strip.
 */
import * as React from "react";
import { Btn, Fill, Placeholder, useTicker } from "./primitives";
import { items, type Theme } from "./theme";
import type { PartProps } from "./types";

export function Hero({ id, content, theme: t, mode, link, onNavigate, emit, w }: PartProps) {
  const lines = items(content, ["Say the one thing this site does", "in a single line people remember."]);
  const typing = id === "hero-typewriter";
  const [phrase, setPhrase] = React.useState(0);
  useTicker(mode, 2200, () => setPhrase((p) => (p + 1) % Math.max(1, lines.length)), typing && lines.length > 1);

  const visualLabel = id === "hero-3d" ? "3D object" : id === "hero-video" ? "video" : "visual";
  const split = (id === "hero-split" || id === "hero-3d") && w >= 720;
  const headline = typing ? lines[phrase % lines.length]! : lines[0]!;
  const subline = typing ? null : lines[1];

  const background =
    id === "hero-gradient"
      ? `radial-gradient(90% 90% at 20% 20%, ${t.accent}40, transparent 65%), ${t.bg}`
      : id === "hero-video"
        ? `linear-gradient(160deg, ${t.muted}33, ${t.bg})`
        : id === "hero-particles"
          ? `radial-gradient(60% 60% at 70% 30%, ${t.accent}22, transparent 70%), ${t.bg}`
          : t.bg;

  return (
    <Fill
      t={t}
      data-part={id}
      style={{
        display: "flex", alignItems: "center", gap: t.fontPx * 2.5,
        padding: `${t.fontPx * 2}px ${t.fontPx * (w < 560 ? 1.2 : 3)}px`,
        background, textAlign: split ? "left" : t.textAlign === "justify" ? "left" : t.textAlign,
      }}
    >
      <div style={{ flex: split ? 1 : undefined, maxWidth: split ? undefined : t.measurePx * 1.2, marginInline: split ? 0 : "auto", display: "flex", flexDirection: "column", gap: t.fontPx, alignItems: split ? "flex-start" : t.textAlign === "center" ? "center" : "flex-start", minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * (w < 560 ? 2 : 3), lineHeight: 1.05, letterSpacing: -1 }}>
          {headline}
          {typing ? <Caret t={t} mode={mode} /> : null}
        </h1>
        {subline ? <p style={{ margin: 0, color: t.muted, fontSize: t.fontPx * 1.15, maxWidth: t.measurePx }}>{subline}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          <Btn t={t} label="Get started" onClick={() => (link ? onNavigate?.(link) : emit?.({ type: "toast", text: "Get started" }))} />
          <Btn t={t} label="Learn more" primary={false} onClick={() => emit?.({ type: "toast", text: "Learn more" })} />
        </div>
      </div>
      {split ? <div style={{ flex: 1, height: "100%" }}><Placeholder t={t} label={visualLabel} /></div> : null}
      {id === "hero-scroll-cue" ? <span style={{ position: "absolute", bottom: t.fontPx, left: "50%", transform: "translateX(-50%)", color: t.muted, fontSize: t.fontPx * 0.85 }}>↓ scroll</span> : null}
    </Fill>
  );
}

function Caret({ t, mode }: { t: Theme; mode: PartProps["mode"] }) {
  const [on, setOn] = React.useState(true);
  useTicker(mode, 520, () => setOn((v) => !v));
  return <span style={{ color: t.accent, opacity: on ? 1 : 0.15 }}>|</span>;
}

/** The one sentence a site is about. */
export function ValueProp({ id, content, theme: t }: PartProps) {
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: t.textAlign === "center" ? "center" : "flex-start", padding: t.fontPx * 0.5 }}>
      <p style={{ margin: 0, fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.6, lineHeight: 1.2, maxWidth: t.measurePx, textAlign: t.textAlign === "justify" ? "left" : t.textAlign }}>
        {items(content, ["One sentence that says what this is and who it's for."])[0]}
      </p>
    </Fill>
  );
}

/** Logos, numbers, badges — the strip under the fold. */
export function ProofStrip({ id, content, theme: t }: PartProps) {
  const names = items(content, id === "trust-badges" ? ["Secure", "Guaranteed", "Supported"] : ["Acme", "Globex", "Initech", "Umbrella", "Hooli"]);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 16, color: t.muted, fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.05, opacity: 0.75, flexWrap: "wrap", padding: `0 ${t.fontPx}px` }}>
      {names.map((n, i) => <span key={n + i}>{n}</span>)}
    </Fill>
  );
}
