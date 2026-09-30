"use client";
/**
 * Motion parts are behaviours, not boxes: they change how the whole page
 * moves. So instead of a nameless chip, each one draws a small scene of what
 * it actually does — held on its first frame on the board, running in the
 * preview — with one line saying it in words. `live/behaviours.ts` turns the
 * ones that can be run for real into effects on the live site.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { cardStyle, items, type Theme, ghostStyle, tint } from "./theme";
import { opt, type PartProps } from "./types";

/** What each motion does, in one line, for anyone who has not met the name. */
const NOTE: Record<string, string> = {
  "scroll-snap": "Each section clicks into place instead of stopping half way.",
  parallax: "Background layers move slower than the front, so the page feels deep.",
  "reveal-on-scroll": "Things fade or slide in as they come into view, one after another.",
  "sticky-story": "A visual stays pinned while the words scroll past it.",
  "horizontal-scroll": "One section runs sideways while the page scrolls down.",
  "scroll-progress": "A bar along the edge shows how far through the page you are.",
  "scroll-video": "Scrolling scrubs an animation, frame by frame, instead of playing it.",
  "infinite-scroll": "More loads as you reach the bottom, so there is no next page.",
  "smooth-scroll": "Scrolling glides to a stop rather than jumping.",
  "cursor-effects": "The pointer becomes something of your own, a dot, a trail, a spotlight.",
  "hover-tilt": "Cards lean toward the pointer as it passes over them.",
  "page-load": "A short opening sequence the first time the page paints.",
  "morph-transition": "One element flies and changes shape into another between views.",
  confetti: "A burst when something goes right.",
  physics: "Things move as if they had weight, they swing, settle and bounce.",
};

function Stage({ t, children }: { t: Theme; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", borderRadius: Math.min(t.radius, 8), background: `${tint(t.muted, 0.071)}`, border: `1px solid ${t.line}` }}>
      {children}
    </div>
  );
}

const block = (t: Theme, extra?: React.CSSProperties): React.CSSProperties => ({
  borderRadius: 3, background: `${tint(t.accent, 0.4)}`, ...extra,
});

/** The scene for one id. Every animation is named `mo-*` in globals.css. */
function Scene({ id, t, options }: { id: string; t: Theme; options: Record<string, string> }) {
  const loop = (name: string, secs: number, easing = "ease-in-out") => ({ animation: `${name} ${secs}s ${easing} infinite` });

  switch (id) {
    case "scroll-snap": {
      const sideways = opt(options, "axis", "vertical") === "horizontal";
      return (
        <Stage t={t}>
          <div style={{ position: "absolute", inset: 4, ...(sideways ? loop("mo-slide-x", 6) : loop("mo-snap", 6)), display: "flex", flexDirection: sideways ? "row" : "column", gap: 4, height: sideways ? "auto" : "300%", width: sideways ? "300%" : "auto" }}>
            {[0, 1, 2].map((i) => <span key={i} style={block(t, { flex: 1, opacity: i === 0 ? 1 : 0.5 })} />)}
          </div>
          <span style={{ position: "absolute", right: 5, top: "50%", width: 3, height: 14, marginTop: -7, borderRadius: 999, background: t.highlight }} />
        </Stage>
      );
    }
    case "parallax":
      return (
        <Stage t={t}>
          {[0.35, 0.6, 1].map((depth, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${8 + i * 26}%`, height: "26%", ...block(t, { opacity: 0.25 + depth * 0.5, background: i === 2 ? t.accent : `${tint(t.accent, 0.333)}` }), animation: `mo-drift ${5 / depth}s ease-in-out infinite alternate` }} />
          ))}
        </Stage>
      );
    case "reveal-on-scroll":
      return (
        <Stage t={t}>
          <div style={{ position: "absolute", inset: 6, display: "flex", flexDirection: "column", gap: 5, justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ height: 8, ...block(t, { width: `${88 - i * 16}%` }), animation: `mo-rise 2.6s ease-out ${i * 0.22}s infinite` }} />
            ))}
          </div>
        </Stage>
      );
    case "sticky-story":
      return (
        <Stage t={t}>
          <span style={{ position: "absolute", left: 6, top: "50%", marginTop: -14, width: 28, height: 28, ...block(t, { background: t.accent, borderRadius: 5 }) }} />
          <div style={{ position: "absolute", left: 42, right: 6, top: 0, display: "flex", flexDirection: "column", gap: 5, ...loop("mo-drift", 4, "linear") }}>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ height: 6, ...block(t, { opacity: 0.45, width: i % 2 ? "70%" : "92%" }) }} />)}
          </div>
        </Stage>
      );
    case "horizontal-scroll":
      return (
        <Stage t={t}>
          <div style={{ position: "absolute", top: 8, bottom: 8, left: 6, display: "flex", gap: 5, ...loop("mo-slide-x", 5, "ease-in-out") }}>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 34, ...block(t, { opacity: i === 0 ? 1 : 0.5 }) }} />)}
          </div>
          <span style={{ position: "absolute", left: 6, right: 6, bottom: 3, height: 2, borderRadius: 999, background: `${tint(t.muted, 0.267)}` }} />
        </Stage>
      );
    case "scroll-progress":
      return (
        <Stage t={t}>
          <span style={{ position: "absolute", left: 0, top: 0, height: 4, background: t.accent, ...loop("mo-fill", 3, "linear") }} />
          <div style={{ position: "absolute", inset: "16% 8% 8%", display: "flex", flexDirection: "column", gap: 4 }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ height: 5, ...block(t, { opacity: 0.35 }) }} />)}
          </div>
        </Stage>
      );
    case "scroll-video":
      return (
        <Stage t={t}>
          <div style={{ position: "absolute", inset: 6, display: "flex", width: "400%", ...loop("mo-frames", 3.2, "steps(1, end)") }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ width: "25%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 20 + i * 8, height: 20 + i * 4, borderRadius: 4 + i * 6, background: t.accent, opacity: 0.85 }} />
              </span>
            ))}
          </div>
        </Stage>
      );
    case "infinite-scroll":
      return (
        <Stage t={t}>
          <div style={{ position: "absolute", inset: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ height: 8, ...block(t, { opacity: 0.5 }) }} />)}
            <span style={{ alignSelf: "center", marginTop: 4, width: 12, height: 12, borderRadius: 999, border: `2px solid ${t.line}`, borderTopColor: t.accent, ...loop("mo-spin", 0.9, "linear") }} />
          </div>
        </Stage>
      );
    case "smooth-scroll":
      return (
        <Stage t={t}>
          <span style={{ position: "absolute", left: "50%", top: 8, bottom: 8, width: 2, marginLeft: -1, borderRadius: 999, background: `${tint(t.muted, 0.267)}` }} />
          <span style={{ position: "absolute", left: "50%", top: 8, width: 10, height: 10, marginLeft: -5, borderRadius: 999, background: t.accent, "--mo-travel": "38px", ...loop("mo-ease-down", 3) } as React.CSSProperties} />
        </Stage>
      );
    case "cursor-effects": {
      const style = opt(options, "style", "dot");
      return (
        <Stage t={t}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ position: "absolute", width: style === "spotlight" ? 34 : 10 - i * 2, height: style === "spotlight" ? 34 : 10 - i * 2, borderRadius: 999, background: style === "spotlight" ? `radial-gradient(circle, ${tint(t.accent, 0.333)}, transparent 70%)` : t.accent, opacity: 1 - i * 0.3, animation: `mo-trail 3.4s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
        </Stage>
      );
    }
    case "hover-tilt":
      return (
        <Stage t={t}>
          <span style={{ position: "absolute", inset: "18%", borderRadius: 6, background: `linear-gradient(140deg, ${t.accent}, ${t.highlight})`, boxShadow: `0 8px 18px ${t.light ? "oklch(0 0 0 / .18)" : "oklch(0 0 0 / .45)"}`, ...loop("mo-tilt", 3.6) }} />
        </Stage>
      );
    case "page-load":
      return (
        <Stage t={t}>
          <div style={{ position: "absolute", inset: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ height: 10, ...block(t, { background: t.accent }) }} />
            {[0, 1].map((i) => <span key={i} style={{ height: 6, ...block(t, { opacity: 0.4 }) }} />)}
          </div>
          <span style={{ position: "absolute", inset: 0, background: t.surface, ...loop("mo-wipe", 3, "cubic-bezier(0.7, 0, 0.2, 1)") }} />
        </Stage>
      );
    case "morph-transition":
      return (
        <Stage t={t}>
          <span style={{ position: "absolute", left: 10, top: "50%", width: 22, height: 22, marginTop: -11, background: t.accent, "--mo-travel": "44px", ...loop("mo-morph", 3) } as React.CSSProperties} />
          <span style={{ position: "absolute", right: 10, top: "50%", width: 22, height: 22, marginTop: -11, borderRadius: 999, border: `1px dashed ${t.line}` }} />
        </Stage>
      );
    case "confetti":
      return (
        <Stage t={t}>
          {Array.from({ length: 10 }, (_, i) => {
            const angle = (i / 10) * Math.PI * 2;
            return (
              <span
                key={i}
                style={{
                  position: "absolute", left: "50%", top: "50%", width: 5, height: 5, borderRadius: 1,
                  background: i % 2 ? t.accent : t.highlight,
                  "--mo-x": `${Math.cos(angle) * 34}px`, "--mo-y": `${Math.sin(angle) * 26}px`,
                  animation: `mo-burst 1.8s ease-out ${(i % 4) * 0.1}s infinite`,
                } as React.CSSProperties}
              />
            );
          })}
        </Stage>
      );
    case "physics":
      return (
        <Stage t={t}>
          <span style={{ position: "absolute", left: 6, right: 6, bottom: 8, height: 2, borderRadius: 999, background: `${tint(t.muted, 0.267)}` }} />
          {[0, 1].map((i) => (
            <span key={i} style={{ position: "absolute", left: `${28 + i * 30}%`, bottom: 10, width: 14, height: 14, borderRadius: 999, background: i ? t.highlight : t.accent, "--mo-travel": i ? "-22px" : "-34px", animation: `mo-bounce ${1.1 + i * 0.35}s infinite` } as React.CSSProperties} />
          ))}
        </Stage>
      );
    default:
      return (
        <Stage t={t}>
          <span style={{ position: "absolute", inset: "30%", borderRadius: 5, background: `${tint(t.accent, 0.333)}`, ...loop("mo-press", 2.4) }} />
        </Stage>
      );
  }
}

/**
 * A motion part on the board: name, a scene showing the effect, and the note.
 * In the live preview these are not laid out at all — `LiveShell` runs them.
 */
export function MotionPart({ id, label, content, options, theme: t, h }: PartProps) {
  const typed = items(content, []).join(", ");
  const tight = h < 96;
  return (
    <Fill
      t={t}
      data-part={id}
      data-behaviour=""
      style={{ ...ghostStyle(t), padding: t.fontPx * 0.5, display: "flex", flexDirection: "column", gap: t.fontPx * 0.35, overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: t.accent, flexShrink: 0 }} />
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</strong>
        <span style={{ marginLeft: "auto", color: t.muted, fontSize: t.fontPx * 0.62, whiteSpace: "nowrap" }}>whole page</span>
      </div>
      {tight ? null : <Scene id={id} t={t} options={options} />}
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.72, lineHeight: 1.35, flexShrink: 0 }}>
        {typed || NOTE[id] || "Applies to the whole page."}
      </span>
    </Fill>
  );
}
