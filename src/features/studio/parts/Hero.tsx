"use client";
/**
 * First-screen parts: heroes, the one-line pitch, and the trust strip.
 */
import * as React from "react";
import { Btn, Fill, PictureSlot, useTicker } from "./primitives";
import { items, type Theme } from "./theme";
import { opt, type PartProps } from "./types";
import { splitTurn } from "./turn";
import { Runs } from "./Runs";

export function Hero({ id, content, theme: t, mode, link, onNavigate, emit, w, picture }: PartProps) {
  const typing = id === "hero-typewriter";
  // The typewriter cycles phrases; every other hero is a headline plus a subline.
  const lines = items(content, typing ? ["Design faster", "Ship sooner", "Sleep better"] : ["Say the one thing this site does", "in a single line people remember."]);
  const [phrase, setPhrase] = React.useState(0);
  useTicker(mode, 2200, () => setPhrase((p) => (p + 1) % Math.max(1, lines.length)), typing && lines.length > 1);

  const visualLabel = id === "hero-3d" ? "3D object" : id === "hero-video" ? "video" : "visual";
  const split = (id === "hero-split" || id === "hero-3d") && w >= 720;
  const headline = typing ? lines[phrase % lines.length]! : lines[0]!;
  // Every line after the first: a third line typed used to be dropped.
  const subline = typing || lines.length < 2 ? null : lines.slice(1).join(" ");

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
        <h1 dir="auto" style={{ margin: 0, fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * (w < 560 ? 2 : 3), lineHeight: 1.05, letterSpacing: -1 }}>
          {headline}
          {typing ? <Caret t={t} mode={mode} /> : null}
        </h1>
        {subline ? <p dir="auto" style={{ margin: 0, color: t.muted, fontSize: t.fontPx * 1.15, maxWidth: t.measurePx }}>{subline}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          <Btn t={t} label="Get started" onClick={() => (link ? onNavigate?.(link) : emit?.({ type: "toast", text: "Get started" }))} />
          <Btn t={t} label="Learn more" primary={false} onClick={() => emit?.({ type: "toast", text: "Learn more" })} />
        </div>
      </div>
      {split ? <div style={{ flex: 1, height: "100%" }}><PictureSlot t={t} pic={picture?.pic} src={picture?.src} label={visualLabel} mode={mode} /></div> : null}
      {id === "hero-scroll-cue" ? <span style={{ position: "absolute", bottom: t.fontPx, left: "50%", transform: "translateX(-50%)", color: t.muted, fontSize: t.fontPx * 0.85 }}>↓ scroll</span> : null}
    </Fill>
  );
}

function Caret({ t, mode }: { t: Theme; mode: PartProps["mode"] }) {
  const [on, setOn] = React.useState(true);
  useTicker(mode, 520, () => setOn((v) => !v));
  return <span style={{ color: t.accent, opacity: on ? 1 : 0.15 }}>|</span>;
}

/**
 * The one sentence a site is about — and, when it is asked for, the turn at
 * the end of it.
 *
 * A headline of two sentences that changes colour on the second ("Not a
 * trend. **A transmission.**"), or one whose last word carries the accent
 * ("Power in the **dark.**"), is the commonest thing a display line does,
 * and it could not be said here at all: the part drew one colour and the
 * only way to get the turn was two parts butted together, which wraps
 * wrongly the moment anything changes width.
 */
export function ValueProp({ id, content, spans, options, h, theme: t, mode, onNavigate }: PartProps) {
  const line = items(content, ["One sentence that says what this is and who it's for."])[0]!;
  // A captured box one line tall holds one line. The capture rounds a width
  // down, so a heading as wide as its words ("PnL Over Time", 156.03 in a
  // box of 156) wrapped by a hair and doubled; `Text` holds prose the same way,
  // and like it counts a box within a pixel of two lines (a height the
  // capture rounded to whole pixels) as two.
  const lh = t.captured ? t.lineHeight : 1.2;
  const oneLine = !!t.captured && h > 0 && h < 2 * t.fontPx * 1.6 * lh - 1;
  const turn = opt(options, "turn", "none");
  const parts = splitTurn(line, turn);
  const tone = turn === "last word muted" || turn === "second sentence muted" ? t.muted : t.accent;
  return (
    /* Captured, the box is his heading's own and it had no padding and its
       own leading (`applyCaptured`): padded, a heading as wide as its words
       wrapped, and the page under it moved (tests/captured-words.mjs). */
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: t.textAlign === "center" ? "center" : "flex-start", padding: t.tight || t.captured ? 0 : t.fontPx * 0.5 }}>
      <p dir="auto" style={{ margin: 0, fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.6, lineHeight: lh, maxWidth: t.measurePx, whiteSpace: oneLine ? "nowrap" : undefined, textAlign: t.textAlign === "justify" ? "left" : t.textAlign }}>
        {/* Runs of their own (a captured title's letters, a sentence in two inks) are drawn as they are; the turn is for a plain line. */}
        {spans?.length && turn === "none" ? <Runs spans={spans} t={t} mode={mode} onNavigate={onNavigate} /> : (
          <>
            {parts.head}
            {parts.tail ? <span style={{ color: tone }}>{parts.tail}</span> : null}
          </>
        )}
      </p>
    </Fill>
  );
}

/** Where the line turns: one rule, in `turn.ts`, that the call to action shares. */
export { splitTurn };

/** Logos, numbers, badges — the strip under the fold. */
export function ProofStrip({ id, content, theme: t }: PartProps) {
  const names = items(content, id === "trust-badges" ? ["Secure", "Guaranteed", "Supported"] : ["Acme", "Globex", "Initech", "Umbrella", "Hooli"]);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 16, color: t.muted, fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.05, opacity: 0.75, flexWrap: "wrap", padding: `0 ${t.fontPx}px` }}>
      {names.map((n, i) => <span key={n + i}>{n}</span>)}
    </Fill>
  );
}
