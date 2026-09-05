"use client";
/**
 * Search box. What it searches over is the content ("episodes, characters");
 * in live mode typing filters exactly that list and shows the hits.
 */
import * as React from "react";
import { Btn, Fill } from "./primitives";
import { items, radiusFor } from "./theme";
import { opt, type PartProps } from "./types";

export function SearchBox({ id, content, options, theme: t, mode, onNavigate, emit }: PartProps) {
  const scope = items(content, ["everything"]);
  const shape = opt(options, "shape", "rounded");
  const withButton = opt(options, "button", "no") === "yes";
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const query = q.trim().toLowerCase();
  const hits = query ? scope.filter((s) => s.toLowerCase().includes(query)) : [];
  const showList = mode === "live" && open && query.length > 0;
  const listId = React.useId();

  const choose = (hit: string) => {
    setQ(hit);
    setOpen(false);
    if (onNavigate) onNavigate({ kind: "page", target: hit });
    else emit?.({ type: "toast", text: `Opening ${hit}` });
  };

  return (
    <Fill t={t} data-part={id} overflow="visible" style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
      <div
        style={{
          flex: 1, display: "flex", alignItems: "center", gap: 10, padding: `0 ${t.fontPx}px`, position: "relative",
          background: shape === "underlined" ? "transparent" : t.surface, color: t.muted,
          border: shape === "underlined" ? "none" : `1px solid ${t.line}`,
          borderBottom: `${shape === "underlined" ? 2 : 1}px solid ${shape === "underlined" ? t.accent : t.line}`,
          borderRadius: radiusFor(shape, t),
        }}
      >
        <span aria-hidden style={{ width: t.fontPx, height: t.fontPx, borderRadius: 999, border: `2px solid ${t.muted}`, position: "relative", flexShrink: 0 }}>
          <span style={{ position: "absolute", right: -4, bottom: -4, width: 6, height: 2, background: t.muted, transform: "rotate(45deg)" }} />
        </span>
        <input
          type="search"
          role="searchbox"
          aria-label={`Search ${scope.join(", ")}`}
          aria-expanded={showList}
          aria-controls={listId}
          placeholder={`Search ${scope.join(", ")}…`}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) choose(hits[0]); if (e.key === "Escape") setOpen(false); }}
          style={{
            flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: t.text,
            font: "inherit", fontSize: t.fontPx * 0.95, padding: 0,
          }}
        />
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            style={{
              position: "absolute", left: -1, right: -1, top: "calc(100% + 6px)", zIndex: 20, margin: 0, padding: 4, listStyle: "none",
              background: t.surface, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 12),
              boxShadow: `0 12px 30px ${t.light ? "oklch(0 0 0 / .14)" : "oklch(0 0 0 / .5)"}`, maxHeight: 220, overflow: "auto",
            }}
          >
            {hits.length ? (
              hits.map((h) => (
                <li key={h} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(h)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: t.text, font: "inherit", fontSize: t.fontPx * 0.92, padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.7}px`, borderRadius: Math.max(0, t.radius - 4) }}
                  >
                    {h}
                  </button>
                </li>
              ))
            ) : (
              <li role="option" aria-selected={false} style={{ padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.7}px`, color: t.muted, fontSize: t.fontPx * 0.9 }}>
                No results in {scope.join(", ")}
              </li>
            )}
          </ul>
        ) : null}
      </div>
      {withButton ? <Btn t={t} label="Search" shape={shape} onClick={() => hits[0] && choose(hits[0])} /> : null}
    </Fill>
  );
}
