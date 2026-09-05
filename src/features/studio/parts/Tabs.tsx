"use client";
/**
 * Tabs. Labels from content ("Overview, Details, Reviews"); a label written
 * as "Reviews: what people said" also sets that panel's text.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { cardStyle, items, titled } from "./theme";
import { opt, type PartProps } from "./types";

export function Tabs({ id, content, options, theme: t }: PartProps) {
  const tabs = items(content, ["Overview", "Details", "Reviews"]).map(titled);
  const style = opt(options, "style", "underline");
  const [active, setActive] = React.useState(0);
  const idx = Math.min(active, tabs.length - 1);
  const uid = React.useId();

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    setActive(next);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column" }}>
      <div
        role="tablist"
        aria-label="Tabs"
        style={{
          display: "flex", gap: style === "segmented" ? 2 : t.fontPx * 0.4, alignItems: "stretch",
          padding: style === "segmented" ? 3 : 0, background: style === "segmented" ? t.surface : "transparent",
          border: style === "segmented" ? `1px solid ${t.line}` : "none", borderRadius: style === "segmented" ? t.radius : 0,
          borderBottom: style === "underline" ? `1px solid ${t.line}` : undefined,
          alignSelf: style === "segmented" || style === "pill" ? "flex-start" : "stretch",
        }}
      >
        {tabs.map((tab, i) => {
          const on = i === idx;
          return (
            <button
              key={tab.title + i}
              type="button"
              role="tab"
              id={`${uid}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${uid}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onKey}
              style={{
                cursor: "pointer", background: "transparent", font: "inherit",
                padding: `${t.fontPx * 0.55}px ${t.fontPx * 0.9}px`, fontSize: t.fontPx * 0.95, fontWeight: on ? 600 : 500, whiteSpace: "nowrap",
                color: on ? (style === "pill" ? t.accentText : t.text) : t.muted,
                backgroundColor: on && style === "pill" ? t.accent : on && style === "segmented" ? t.bg : "transparent",
                borderRadius: style === "pill" ? 999 : style === "segmented" ? Math.max(0, t.radius - 2) : 0,
                border: style === "boxed" ? `1px solid ${on ? t.line : "transparent"}` : "none",
                borderBottom: style === "underline" ? `2px solid ${on ? t.accent : "transparent"}` : style === "boxed" ? `1px solid ${on ? t.line : "transparent"}` : "none",
                marginBottom: style === "underline" ? -1 : 0,
              }}
            >
              {tab.title}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${idx}`}
        style={{ flex: 1, minHeight: 0, marginTop: t.fontPx * 0.6, ...cardStyle(t), padding: t.fontPx, color: t.muted, fontSize: t.fontPx * 0.9, overflow: "auto" }}
      >
        {tabs[idx]?.body ?? `${tabs[idx]?.title} content`}
      </div>
    </Fill>
  );
}
