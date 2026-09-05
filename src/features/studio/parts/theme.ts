/**
 * The theme a part wears, derived from the Format panel.
 *
 * Only `themeFrom` knows about the Builder's format ids; a generated site can
 * hand parts a `Theme` object built any other way.
 */
import type * as React from "react";
import type { FormatValues } from "../format";

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

export const FAMILY: Record<string, string> = {
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

/** "a, b, c" → ["a","b","c"], with a fallback list when nothing is typed. */
export function items(content: string, fallback: string[]): string[] {
  const list = content.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

/** "Title: body" → { title, body }. Body is null when no colon was typed. */
export function titled(item: string): { title: string; body: string | null } {
  const i = item.indexOf(":");
  if (i <= 0) return { title: item.trim(), body: null };
  return { title: item.slice(0, i).trim(), body: item.slice(i + 1).trim() || null };
}

export function radiusFor(shape: string | undefined, t: Theme): number {
  if (shape === "pill") return 999;
  if (shape === "square") return 0;
  if (shape === "underlined") return 0;
  return t.radius;
}

export function boxStyles(t: Theme): React.CSSProperties {
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

/** The surface-card look every boxed part shares. */
export function cardStyle(t: Theme): React.CSSProperties {
  return { background: t.surface, border: `1px solid ${t.line}`, borderRadius: t.radius };
}
