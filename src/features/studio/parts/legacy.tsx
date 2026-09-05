"use client";
/**
 * Parts that do not have their own archetype yet. Every Stage 3 step moves
 * ids out of here into `parts/<Archetype>.tsx`; delete this file when empty.
 * The final branch is the labelled-box fallback, marked `data-part-fallback`.
 */
import * as React from "react";
import { getFeature, type CategoryId } from "../catalog";
import type { StudioNode } from "../store";
import { Btn, Fill, Placeholder } from "./primitives";
import { items, type Theme } from "./theme";

export function LegacyBlock({ node, t }: { node: StudioNode; t: Theme }) {
  const feature = getFeature(node.featureId);
  const cat: CategoryId = feature?.category ?? "structure";
  const id = node.featureId;
  const o = node.options;
  const c = node.content ?? "";
  const card: React.CSSProperties = { background: t.surface, border: `1px solid ${t.line}`, borderRadius: t.radius };

  /* ---------- navigation ---------- */
  /* ---------- first screen ---------- */
  /* ---------- text ---------- */
  /* ---------- media ---------- */
  /* ---------- data ---------- */
  if (cat === "data") {
    if (id === "data-table" || id === "leaderboard") {
      const cols = items(c, ["Name", "Status", "Amount", "Updated"]);
      return (
        <Fill t={t} style={{ ...card, display: "flex", flexDirection: "column", fontSize: t.fontPx * 0.9 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: `${t.fontPx * 0.5}px ${t.fontPx}px`, borderBottom: `1px solid ${t.line}`, color: t.muted, fontWeight: 600, fontSize: t.fontPx * 0.8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {cols.map((h) => <span key={h}>{h}</span>)}
          </div>
          {[0, 1, 2, 3, 4].map((r) => (
            <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: `${t.fontPx * 0.5}px ${t.fontPx}px`, borderBottom: `1px solid ${t.line}` }}>
              {cols.map((h, i) => <span key={h} style={{ color: i === 0 ? t.text : t.muted }}>{i === 0 ? `Row ${r + 1}` : "—"}</span>)}
            </div>
          ))}
        </Fill>
      );
    }
    if (id === "stat-tiles") {
      const tiles = items(c, ["Users", "Revenue", "Uptime", "Orders"]);
      return (
        <Fill t={t} style={{ display: "grid", gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: t.fontPx * 0.6 }}>
          {tiles.map((label) => (
            <div key={label} style={{ ...card, padding: t.fontPx, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: t.muted, fontSize: t.fontPx * 0.8 }}>{label}</span>
              <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.8 }}>1,234</span>
              <span style={{ color: t.accent, fontSize: t.fontPx * 0.8 }}>▲ 12%</span>
            </div>
          ))}
        </Fill>
      );
    }
    const bars = [0.4, 0.75, 0.55, 0.95, 0.6, 0.8, 0.5, 0.7];
    return (
      <Fill t={t} style={{ ...card, padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.6 }}>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{items(c, ["Chart title"])[0]}</span>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6 }}>
          {bars.map((b, i) => <div key={i} style={{ flex: 1, height: `${b * 100}%`, background: i % 2 ? `${t.accent}88` : t.accent, borderRadius: 3 }} />)}
        </div>
      </Fill>
    );
  }

  /* ---------- forms ---------- */
  /* ---------- shop ---------- */
  if (id === "pricing-table") {
    const tiers = items(c, ["Free", "Pro", "Team"]);
    return (
      <Fill t={t} style={{ display: "grid", gridTemplateColumns: `repeat(${tiers.length}, 1fr)`, gap: t.fontPx }}>
        {tiers.map((name, i) => {
          const hot = i === Math.min(1, tiers.length - 1);
          return (
            <div key={name} style={{ ...card, border: `1px solid ${hot ? t.accent : t.line}`, padding: t.fontPx * 1.2, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
              <span style={{ fontWeight: 700, fontFamily: t.headingFamily }}>{name}</span>
              <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 2 }}>${i * 12}<span style={{ fontSize: t.fontPx * 0.8, color: t.muted, fontWeight: 400 }}>/mo</span></span>
              {[0, 1, 2].map((k) => <span key={k} style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>✓ Feature {k + 1}</span>)}
              <span style={{ marginTop: "auto", display: "flex" }}><Btn t={t} label="Choose" primary={hot} /></span>
            </div>
          );
        })}
      </Fill>
    );
  }
  if (cat === "commerce" || id === "card-grid" || id === "bento-grid" || id === "masonry" || id === "blog-index") {
    const n = Number(o.columns) || 3;
    const names = items(c, Array.from({ length: n * 2 }, (_, i) => `Item ${i + 1}`));
    return (
      <Fill t={t} style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: t.fontPx * 0.8, gridAutoRows: "1fr" }}>
        {names.slice(0, n * 2).map((name, i) => (
          <div key={name + i} style={{ ...card, padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 6, gridColumn: id === "bento-grid" && i % 5 === 0 ? "span 2" : undefined }}>
            <div style={{ flex: 1, minHeight: t.fontPx * 3 }}><Placeholder t={t} /></div>
            <span style={{ fontWeight: 600, fontSize: t.fontPx * 0.95 }}>{name}</span>
            {cat === "commerce" ? <span style={{ color: t.accent, fontSize: t.fontPx * 0.9 }}>$24</span> : <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>Short description</span>}
          </div>
        ))}
      </Fill>
    );
  }

  /* ---------- social / ai ---------- */
  if (id === "ai-chat" || id === "chat" || id === "ai-prompt-box") {
    return (
      <Fill t={t} style={{ ...card, display: "flex", flexDirection: "column", gap: t.fontPx * 0.6, padding: t.fontPx }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ alignSelf: "flex-start", maxWidth: "70%", padding: `${t.fontPx * 0.5}px ${t.fontPx * 0.8}px`, background: `${t.muted}2a`, borderRadius: 14, fontSize: t.fontPx * 0.9 }}>{items(c, ["How can I help?"])[0]}</span>
          <span style={{ alignSelf: "flex-end", maxWidth: "70%", padding: `${t.fontPx * 0.5}px ${t.fontPx * 0.8}px`, background: t.accent, color: t.accentText, borderRadius: 14, fontSize: t.fontPx * 0.9 }}>Show me around.</span>
        </div>
        <div style={{ height: t.fontPx * 2.6, border: `1px solid ${t.line}`, borderRadius: 999, display: "flex", alignItems: "center", padding: `0 ${t.fontPx}px`, color: t.muted, fontSize: t.fontPx * 0.9 }}>{o.placeholder || "Type a message…"}</div>
      </Fill>
    );
  }
  if (cat === "social") {
    return (
      <Fill t={t} style={{ display: "flex", flexDirection: "column", gap: t.fontPx * 0.8 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ ...card, padding: t.fontPx, display: "flex", gap: 10 }}>
            <span style={{ width: t.fontPx * 2.2, height: t.fontPx * 2.2, borderRadius: 999, background: `${t.accent}55`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: t.fontPx * 0.95 }}>{items(c, ["Someone", "Someone else"])[i] ?? "Someone"}</div>
              <div style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>A short comment that fits on one or two lines.</div>
            </div>
          </div>
        ))}
      </Fill>
    );
  }

  /* ---------- layout ---------- */
  if (id === "footer") {
    const cols = items(c, ["Product", "Company", "Resources", "Legal"]);
    return (
      <Fill t={t} style={{ borderTop: `1px solid ${t.line}`, display: "grid", gridTemplateColumns: `2fr repeat(${cols.length}, 1fr)`, gap: t.fontPx * 2, padding: `${t.fontPx * 2}px ${t.fontPx * 3}px`, fontSize: t.fontPx * 0.9 }}>
        <div style={{ fontWeight: 800, fontFamily: t.headingFamily }}>Logo<div style={{ color: t.muted, fontWeight: 400, marginTop: 6 }}>© {new Date().getFullYear()}</div></div>
        {cols.map((col) => (
          <div key={col} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>{col}</span>
            {[0, 1, 2].map((k) => <span key={k} style={{ color: t.muted }}>Link {k + 1}</span>)}
          </div>
        ))}
      </Fill>
    );
  }
  /* ---------- motion / interaction / under the hood: behaviour badges ---------- */
  if (cat === "motion" || cat === "interact" || cat === "platform" || cat === "power" || cat === "ai") {
    return (
      <Fill t={t} data-part={id} style={{ ...card, borderStyle: "dashed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: t.fontPx, color: t.muted, fontSize: t.fontPx * 0.9, textAlign: "center" }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: t.accent, flexShrink: 0 }} />
        <span><strong style={{ color: t.text }}>{feature?.name}</strong>{c ? ` — ${c}` : ""}</span>
      </Fill>
    );
  }

  /* ---------- notes & wildcards ---------- */
  return (
    <Fill t={t} data-part={id} data-part-fallback="" style={{ ...card, borderStyle: "dashed", padding: t.fontPx, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontWeight: 700, fontFamily: t.headingFamily }}>{node.label}</span>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>{c || node.prompt || feature?.blurb}</span>
    </Fill>
  );
}
