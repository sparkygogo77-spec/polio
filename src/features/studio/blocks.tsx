"use client";
/**
 * How each part LOOKS, at real size, from its options and contents.
 *
 * The board and the preview both draw parts with these blocks, so what you see
 * on the board is what the page will be shaped like. Every block fills the box
 * it is given, reads the part's options (shape, style, columns…) and its
 * contents (tab labels, links, placeholder text), and wears the Format theme.
 *
 * Fidelity is deliberately "honest wireframe": real proportions, real labels,
 * real structure, no final art.
 */
import * as React from "react";
import { getFeature, type CategoryId } from "./catalog";
import type { FormatValues } from "./format";
import type { StudioNode } from "./store";

/* ------------------------------------------------------------------ */
/* Theme from the Format panel                                         */
/* ------------------------------------------------------------------ */

export interface Theme {
  bg: string;
  surface: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  radius: number;
  light: boolean;
  backdrop: string;
  /** Body size in px from the type settings. */
  fontPx: number;
  lineHeight: number;
  measurePx: number;
  textAlign: "left" | "center" | "justify";
  boxStyle: string;
  boxPad: number;
  headingFamily: string;
  bodyFamily: string;
}

const FAMILY: Record<string, string> = {
  "geometric sans": "'Avenir Next', 'Futura', 'Century Gothic', ui-sans-serif, sans-serif",
  "grotesque sans": "'Helvetica Neue', Inter, Arial, ui-sans-serif, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "'Impact', 'Arial Black', ui-sans-serif, sans-serif",
  condensed: "'Arial Narrow', 'Roboto Condensed', ui-sans-serif, sans-serif",
  monospace: "ui-monospace, 'SF Mono', Menlo, monospace",
  handwritten: "'Segoe Print', 'Comic Sans MS', cursive",
  "system sans": "ui-sans-serif, system-ui, sans-serif",
  "humanist sans": "'Segoe UI', 'Trebuchet MS', ui-sans-serif, sans-serif",
};

export function themeFrom(format: FormatValues): Theme {
  const hue = Number(format["palette.accentHue"] ?? 265);
  const mode = String(format["palette.mode"] ?? "dark");
  const light = mode === "light" || mode === "both";
  const radius = Number(format["layout.radius"] ?? 10);
  const background = String(format["palette.background"] ?? "flat");
  const bg = light ? `oklch(0.975 0.006 ${hue})` : `oklch(0.17 0.01 ${hue})`;
  const backdrop =
    background === "subtle gradient" || background === "mesh gradient"
      ? `radial-gradient(120% 80% at 20% 0%, oklch(0.7 0.14 ${hue} / 0.2), transparent 70%), ${bg}`
      : background === "grid"
        ? `linear-gradient(${light ? "oklch(0 0 0 / .05)" : "oklch(1 0 0 / .05)"} 1px, transparent 1px), linear-gradient(90deg, ${light ? "oklch(0 0 0 / .05)" : "oklch(1 0 0 / .05)"} 1px, transparent 1px), ${bg}`
        : bg;
  const align = String(format["type.align"] ?? "left");
  return {
    bg,
    backdrop,
    surface: light ? "oklch(1 0 0)" : `oklch(0.22 0.012 ${hue})`,
    line: light ? `oklch(0.88 0.01 ${hue})` : `oklch(0.31 0.014 ${hue})`,
    text: light ? `oklch(0.25 0.02 ${hue})` : `oklch(0.93 0.01 ${hue})`,
    muted: light ? `oklch(0.6 0.015 ${hue})` : `oklch(0.64 0.016 ${hue})`,
    accent: light ? `oklch(0.55 0.16 ${hue})` : `oklch(0.75 0.15 ${hue})`,
    accentText: light ? `oklch(0.99 0.01 ${hue})` : `oklch(0.16 0.03 ${hue})`,
    radius,
    light,
    fontPx: Number(format["type.baseSize"] ?? 16),
    lineHeight: Number(format["type.lineHeight"] ?? 1.55),
    measurePx: Math.round(Number(format["type.measure"] ?? 66) * 8.2),
    textAlign: align === "center" ? "center" : align === "justified" ? "justify" : "left",
    boxStyle: String(format["type.textBox"] ?? "plain"),
    boxPad: Number(format["type.boxPadding"] ?? 16),
    headingFamily: FAMILY[String(format["type.headingFamily"] ?? "geometric sans")] ?? FAMILY["geometric sans"]!,
    bodyFamily: FAMILY[String(format["type.bodyFamily"] ?? "system sans")] ?? FAMILY["system sans"]!,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** "a, b, c" → ["a","b","c"], with a fallback list when nothing is typed. */
export function items(content: string, fallback: string[]): string[] {
  const list = content.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

function radiusFor(shape: string | undefined, t: Theme): number {
  if (shape === "pill") return 999;
  if (shape === "square") return 0;
  if (shape === "underlined") return 0;
  return t.radius;
}

function boxStyles(t: Theme): React.CSSProperties {
  const base: React.CSSProperties = { borderRadius: t.radius, padding: t.boxPad };
  switch (t.boxStyle) {
    case "bordered": return { ...base, border: `1px solid ${t.line}` };
    case "filled": return { ...base, background: t.surface };
    case "card": return { ...base, background: t.surface, border: `1px solid ${t.line}`, boxShadow: `0 4px 14px ${t.light ? "oklch(0 0 0 / .08)" : "oklch(0 0 0 / .35)"}` };
    case "underlined": return { ...base, borderBottom: `2px solid ${t.line}`, borderRadius: 0 };
    case "quoted": return { ...base, borderLeft: `4px solid ${t.accent}`, borderRadius: 0 };
    case "inset shadow": return { ...base, background: t.surface, boxShadow: `inset 0 2px 8px ${t.light ? "oklch(0 0 0 / .08)" : "oklch(0 0 0 / .4)"}` };
    default: return { ...base, padding: 0 };
  }
}

const Btn = ({ t, label, primary = true, shape }: { t: Theme; label: string; primary?: boolean; shape?: string }) => (
  <span
    style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap",
      padding: `${Math.round(t.fontPx * 0.55)}px ${Math.round(t.fontPx * 1.1)}px`,
      fontSize: t.fontPx * 0.92, fontWeight: 600, fontFamily: t.bodyFamily,
      borderRadius: radiusFor(shape, t) || Math.min(t.radius, 12),
      background: primary ? t.accent : "transparent", color: primary ? t.accentText : t.text,
      border: primary ? "1px solid transparent" : `1px solid ${t.line}`,
    }}
  >
    {label}
  </span>
);

const Placeholder = ({ t, label }: { t: Theme; label?: string }) => (
  <div
    style={{
      width: "100%", height: "100%", minHeight: 24, borderRadius: Math.min(t.radius, 10),
      background: `linear-gradient(140deg, ${t.accent}2a, ${t.muted}1f)`, border: `1px solid ${t.line}`,
      display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.75,
    }}
  >
    {label}
  </div>
);

function Fill({ t, children, style }: { t: Theme; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: "100%", height: "100%", overflow: "hidden", boxSizing: "border-box",
        color: t.text, fontFamily: t.bodyFamily, fontSize: t.fontPx, lineHeight: t.lineHeight,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

export function Block({ node, t }: { node: StudioNode; t: Theme }) {
  const feature = getFeature(node.featureId);
  const cat: CategoryId = feature?.category ?? "structure";
  const id = node.featureId;
  const o = node.options;
  const c = node.content ?? "";
  const card: React.CSSProperties = { background: t.surface, border: `1px solid ${t.line}`, borderRadius: t.radius };

  /* ---------- navigation ---------- */
  if (id === "sticky-header" || id === "mega-menu" || id === "mobile-nav" || id === "home-anchor") {
    const links = items(c, ["Home", "Work", "About", "Contact"]);
    return (
      <Fill t={t} style={{ ...card, borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", display: "flex", alignItems: "center", gap: t.fontPx * 1.6, padding: `0 ${t.fontPx * 1.5}px` }}>
        <span style={{ fontWeight: 800, fontFamily: t.headingFamily, letterSpacing: -0.3 }}>{items(c, [""])[0] && o.brand ? o.brand : "Logo"}</span>
        <span style={{ flex: 1 }} />
        {links.map((l) => (
          <span key={l} style={{ color: t.muted, fontSize: t.fontPx * 0.95 }}>{l}</span>
        ))}
        {o.button !== "no" ? <Btn t={t} label={o.buttonLabel || "Get started"} /> : null}
      </Fill>
    );
  }

  if (id === "search-nav" || id === "search-autocomplete" || id === "ai-search") {
    const scope = items(c, ["everything"]);
    const shape = o.shape ?? "rounded";
    const withButton = o.button === "yes";
    return (
      <Fill t={t} style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
        <div
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10, padding: `0 ${t.fontPx}px`,
            background: shape === "underlined" ? "transparent" : t.surface, color: t.muted,
            border: shape === "underlined" ? "none" : `1px solid ${t.line}`,
            borderBottom: `${shape === "underlined" ? 2 : 1}px solid ${shape === "underlined" ? t.accent : t.line}`,
            borderRadius: radiusFor(shape, t),
          }}
        >
          <span style={{ width: t.fontPx, height: t.fontPx, borderRadius: 999, border: `2px solid ${t.muted}`, position: "relative", flexShrink: 0 }}>
            <span style={{ position: "absolute", right: -4, bottom: -4, width: 6, height: 2, background: t.muted, transform: "rotate(45deg)" }} />
          </span>
          <span style={{ fontSize: t.fontPx * 0.95, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {o.placeholder || `Search ${scope.join(", ")}…`}
          </span>
        </div>
        {withButton ? <Btn t={t} label="Search" shape={shape} /> : null}
      </Fill>
    );
  }

  if (id === "breadcrumbs") {
    const trail = items(c, ["Home", "Section", "Page"]);
    return (
      <Fill t={t} style={{ display: "flex", alignItems: "center", gap: 8, color: t.muted, fontSize: t.fontPx * 0.9 }}>
        {trail.map((x, i) => (
          <React.Fragment key={x + i}>
            {i > 0 ? <span style={{ opacity: 0.6 }}>/</span> : null}
            <span style={{ color: i === trail.length - 1 ? t.text : t.muted }}>{x}</span>
          </React.Fragment>
        ))}
      </Fill>
    );
  }

  if (id === "tabs-panel") {
    const tabs = items(c, ["Overview", "Details", "Reviews"]);
    const style = o.style ?? "underline";
    const active = 0;
    return (
      <Fill t={t} style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex", gap: style === "segmented" ? 2 : t.fontPx * 0.4, alignItems: "stretch",
            padding: style === "segmented" ? 3 : 0, background: style === "segmented" ? t.surface : "transparent",
            border: style === "segmented" ? `1px solid ${t.line}` : "none", borderRadius: style === "segmented" ? t.radius : 0,
            borderBottom: style === "underline" ? `1px solid ${t.line}` : undefined, alignSelf: style === "segmented" || style === "pill" ? "flex-start" : "stretch",
          }}
        >
          {tabs.map((label, i) => {
            const on = i === active;
            return (
              <span
                key={label + i}
                style={{
                  padding: `${t.fontPx * 0.55}px ${t.fontPx * 0.9}px`, fontSize: t.fontPx * 0.95, fontWeight: on ? 600 : 500, whiteSpace: "nowrap",
                  color: on ? (style === "pill" ? t.accentText : t.text) : t.muted,
                  background: on && style === "pill" ? t.accent : on && style === "segmented" ? t.bg : "transparent",
                  borderRadius: style === "pill" ? 999 : style === "segmented" ? t.radius - 2 : 0,
                  borderBottom: style === "underline" ? `2px solid ${on ? t.accent : "transparent"}` : undefined,
                  border: style === "boxed" ? `1px solid ${on ? t.line : "transparent"}` : undefined,
                  marginBottom: style === "underline" ? -1 : 0,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
        <div style={{ flex: 1, minHeight: 0, marginTop: t.fontPx * 0.6, ...card, padding: t.fontPx, color: t.muted, fontSize: t.fontPx * 0.9 }}>
          {o.panel || `${tabs[active]} content`}
        </div>
      </Fill>
    );
  }

  if (id === "drawer" || id === "modal") {
    return (
      <Fill t={t} style={{ ...card, boxShadow: `0 16px 40px ${t.light ? "oklch(0 0 0 / .18)" : "oklch(0 0 0 / .55)"}`, display: "flex", flexDirection: "column", gap: t.fontPx * 0.8, padding: t.fontPx * 1.2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontFamily: t.headingFamily }}>
          <span>{items(c, [id === "modal" ? "Popup title" : "Panel title"])[0]}</span>
          <span style={{ color: t.muted }}>✕</span>
        </div>
        <div style={{ flex: 1, color: t.muted, fontSize: t.fontPx * 0.92 }}>{o.body || "What this contains goes here."}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn t={t} label="Cancel" primary={false} />
          <Btn t={t} label={o.action || "Confirm"} />
        </div>
      </Fill>
    );
  }

  /* ---------- first screen ---------- */
  if (cat === "hero" && (id === "hero-split" || id === "hero-video" || id === "hero-gradient" || id === "hero-typewriter" || id === "hero-particles" || id === "hero-3d")) {
    const lines = items(c, ["Say the one thing this site does", "in a single line people remember."]);
    const visualLabel = id === "hero-3d" ? "3D object" : "visual";
    const split = id === "hero-split" || id === "hero-3d";
    return (
      <Fill t={t} style={{ display: "flex", alignItems: "center", gap: t.fontPx * 2.5, padding: `${t.fontPx * 2}px ${t.fontPx * 3}px`, background: id === "hero-gradient" ? `radial-gradient(90% 90% at 20% 20%, ${t.accent}40, transparent 65%), ${t.bg}` : id === "hero-video" ? `linear-gradient(160deg, ${t.muted}33, ${t.bg})` : t.bg, textAlign: split ? "left" : t.textAlign === "justify" ? "left" : t.textAlign }}>
        <div style={{ flex: split ? 1 : undefined, maxWidth: split ? undefined : t.measurePx * 1.2, marginInline: split ? 0 : "auto", display: "flex", flexDirection: "column", gap: t.fontPx, alignItems: split ? "flex-start" : t.textAlign === "center" ? "center" : "flex-start" }}>
          <div style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 3, lineHeight: 1.05, letterSpacing: -1 }}>
            {lines[0]}
            {id === "hero-typewriter" ? <span style={{ color: t.accent }}>|</span> : null}
          </div>
          {lines[1] ? <div style={{ color: t.muted, fontSize: t.fontPx * 1.15, maxWidth: t.measurePx }}>{lines[1]}</div> : null}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn t={t} label={o.cta || "Get started"} />
            <Btn t={t} label={o.cta2 || "Learn more"} primary={false} />
          </div>
        </div>
        {split ? <div style={{ flex: 1, height: "100%" }}><Placeholder t={t} label={visualLabel} /></div> : null}
      </Fill>
    );
  }

  if (id === "value-prop" || id === "gimmick") {
    return (
      <Fill t={t} style={{ display: "flex", alignItems: "center", justifyContent: t.textAlign === "center" ? "center" : "flex-start" }}>
        <div style={{ fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.6, lineHeight: 1.2, maxWidth: t.measurePx, textAlign: t.textAlign === "justify" ? "left" : t.textAlign }}>
          {items(c, ["One sentence that says what this is and who it's for."])[0]}
        </div>
      </Fill>
    );
  }

  if (id === "cta-primary" || id === "quick-action" || id === "follow") {
    return (
      <Fill t={t} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ display: "flex", width: "100%", height: "100%" }}>
          <span
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontFamily: t.bodyFamily,
              fontSize: t.fontPx * (o.size === "large" ? 1.15 : o.size === "small" ? 0.85 : 1), whiteSpace: "nowrap",
              background: o.variant === "outline" ? "transparent" : o.variant === "ghost" ? `${t.accent}22` : t.accent,
              color: o.variant === "outline" || o.variant === "ghost" ? t.accent : t.accentText,
              border: o.variant === "outline" ? `2px solid ${t.accent}` : "2px solid transparent",
              borderRadius: radiusFor(o.shape, t) || Math.min(t.radius, 14),
            }}
          >
            {items(c, ["Get started"])[0]}
          </span>
        </span>
      </Fill>
    );
  }

  if (id === "social-proof-strip" || id === "logo-cloud") {
    const names = items(c, ["Acme", "Globex", "Initech", "Umbrella", "Hooli"]);
    return (
      <Fill t={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 16, color: t.muted, fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.05, opacity: 0.75 }}>
        {names.map((n) => <span key={n}>{n}</span>)}
      </Fill>
    );
  }

  /* ---------- text ---------- */
  if (cat === "content" && id !== "faq" && id !== "changelog" && id !== "blog-index" && id !== "docs" && id !== "code-block" && id !== "marquee" && id !== "callout") {
    const paras = items(c, [
      "Write the real words here and the board will set them. Line length, size and spacing follow the Format panel, so this block is an honest picture of the reading experience.",
      "A second paragraph shows the rhythm between blocks.",
    ]);
    const heading = o.heading || (id === "pull-quote" ? "" : "Section heading");
    return (
      <Fill t={t} style={{ ...boxStyles(t), display: "flex", flexDirection: "column", gap: t.fontPx * 0.8, textAlign: t.textAlign }}>
        {heading ? <div style={{ fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.75, lineHeight: 1.15, letterSpacing: -0.3 }}>{heading}</div> : null}
        {paras.map((p, i) => (
          <p key={i} style={{ margin: 0, maxWidth: t.measurePx, marginInline: t.textAlign === "center" ? "auto" : 0, color: id === "pull-quote" ? t.text : t.muted, fontSize: id === "pull-quote" ? t.fontPx * 1.5 : t.fontPx, fontStyle: id === "pull-quote" ? "italic" : "normal", fontFamily: id === "pull-quote" ? t.headingFamily : t.bodyFamily }}>
            {id === "drop-cap" && i === 0 ? <span style={{ float: "left", fontSize: t.fontPx * 3.2, lineHeight: 0.8, paddingRight: 6, fontFamily: t.headingFamily, fontWeight: 700, color: t.accent }}>{p.charAt(0)}</span> : null}
            {id === "drop-cap" && i === 0 ? p.slice(1) : p}
          </p>
        ))}
      </Fill>
    );
  }

  if (id === "faq" || id === "accordion") {
    const qs = items(c, ["How does it work?", "What does it cost?", "Can I cancel?"]);
    return (
      <Fill t={t} style={{ display: "flex", flexDirection: "column" }}>
        {qs.map((q, i) => (
          <div key={q + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${t.fontPx * 0.8}px 0`, borderBottom: `1px solid ${t.line}`, fontWeight: 500 }}>
            <span>{q}</span>
            <span style={{ color: t.muted }}>{i === 0 ? "−" : "+"}</span>
          </div>
        ))}
      </Fill>
    );
  }

  if (id === "marquee") {
    const words = items(c, ["Ships fast", "Reads well", "Feels right"]);
    return (
      <Fill t={t} style={{ display: "flex", alignItems: "center", gap: 32, whiteSpace: "nowrap", fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.1, color: t.muted, borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }}>
        {[...words, ...words, ...words].map((w, i) => <span key={i}>{w} <span style={{ color: t.accent }}>✦</span></span>)}
      </Fill>
    );
  }

  if (id === "code-block") {
    return (
      <Fill t={t} style={{ ...card, background: t.light ? "oklch(0.2 0.01 260)" : "oklch(0.12 0.01 260)", color: "oklch(0.85 0.02 260)", fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.85, padding: t.fontPx, whiteSpace: "pre" }}>
        {c || "const site = build(blueprint);\nsite.deploy();"}
      </Fill>
    );
  }

  if (id === "callout") {
    return (
      <Fill t={t} style={{ ...card, borderLeft: `4px solid ${t.accent}`, padding: t.fontPx, display: "flex", gap: 10, alignItems: "flex-start", fontSize: t.fontPx * 0.95 }}>
        <span style={{ color: t.accent, fontWeight: 700 }}>ⓘ</span>
        <span style={{ color: t.muted }}>{items(c, ["A note the reader should not miss."])[0]}</span>
      </Fill>
    );
  }

  /* ---------- media ---------- */
  if (cat === "media") {
    const cols = Number(o.columns) || (id === "gallery" ? 3 : id === "carousel" ? 1 : 2);
    const n = id === "video-player" || id === "map-embed" || id === "3d-viewer" || id === "audio-player" ? 1 : cols * (id === "gallery" ? 2 : 1);
    return (
      <Fill t={t} style={{ display: "grid", gridTemplateColumns: `repeat(${n === 1 ? 1 : cols}, 1fr)`, gap: t.fontPx * 0.6 }}>
        {Array.from({ length: n }, (_, i) => <Placeholder key={i} t={t} label={id === "video-player" ? "▶ video" : id === "map-embed" ? "map" : id === "audio-player" ? "audio" : id === "3d-viewer" ? "3D" : ""} />)}
      </Fill>
    );
  }

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
  if (cat === "forms") {
    const fields = items(c, id === "newsletter" ? ["Email"] : ["Name", "Email", "Message"]);
    const inline = id === "newsletter";
    return (
      <Fill t={t} style={{ display: "flex", flexDirection: inline ? "row" : "column", gap: t.fontPx * 0.7, alignItems: inline ? "stretch" : "stretch" }}>
        {fields.map((f) => (
          <label key={f} style={{ display: "flex", flexDirection: "column", gap: 4, flex: inline ? 1 : undefined, fontSize: t.fontPx * 0.85, color: t.muted }}>
            {!inline ? f : null}
            <span style={{ height: f.toLowerCase() === "message" ? t.fontPx * 5 : t.fontPx * 2.6, border: `1px solid ${t.line}`, borderRadius: radiusFor(o.shape, t) || Math.min(t.radius, 8), background: t.surface, padding: `0 ${t.fontPx * 0.7}px`, display: "flex", alignItems: "center", color: t.muted }}>
              {inline ? f : ""}
            </span>
          </label>
        ))}
        <div style={{ alignSelf: inline ? "stretch" : "flex-start", display: "flex" }}><Btn t={t} label={o.submit || (inline ? "Subscribe" : "Send")} shape={o.shape} /></div>
      </Fill>
    );
  }

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
  if (id === "split-screen" || id === "sidebar-layout") {
    return (
      <Fill t={t} style={{ display: "flex", gap: t.fontPx }}>
        <div style={{ width: id === "sidebar-layout" ? "26%" : "50%", ...card, padding: t.fontPx, display: "flex", flexDirection: "column", gap: 8, color: t.muted, fontSize: t.fontPx * 0.9 }}>
          {items(c, ["Section one", "Section two", "Section three"]).map((x) => <span key={x}>{x}</span>)}
        </div>
        <div style={{ flex: 1, ...card, padding: t.fontPx, color: t.muted }}>Main content</div>
      </Fill>
    );
  }
  if (id === "section-stack" || id === "holy-grail" || id === "scan-region") {
    const secs = items(c, ["Intro", "Details", "Proof", "Call to action"]);
    return (
      <Fill t={t} style={{ display: "flex", flexDirection: "column", gap: t.fontPx * 0.5 }}>
        {secs.map((s) => (
          <div key={s} style={{ flex: 1, ...card, borderStyle: "dashed", display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.9 }}>{s}</div>
        ))}
      </Fill>
    );
  }

  /* ---------- motion / interaction / under the hood: behaviour badges ---------- */
  if (cat === "motion" || cat === "interact" || cat === "platform" || cat === "power" || cat === "ai") {
    return (
      <Fill t={t} style={{ ...card, borderStyle: "dashed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: t.fontPx, color: t.muted, fontSize: t.fontPx * 0.9, textAlign: "center" }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: t.accent, flexShrink: 0 }} />
        <span><strong style={{ color: t.text }}>{feature?.name}</strong>{c ? ` — ${c}` : ""}</span>
      </Fill>
    );
  }

  /* ---------- notes & wildcards ---------- */
  return (
    <Fill t={t} style={{ ...card, borderStyle: "dashed", padding: t.fontPx, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontWeight: 700, fontFamily: t.headingFamily }}>{node.label}</span>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>{c || node.prompt || feature?.blurb}</span>
    </Fill>
  );
}
