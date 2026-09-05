"use client";
/**
 * The always-on preview.
 *
 * It renders the current page as an actual miniature web page — real blocks in
 * real reading order, wearing the colour, radius, width and type settings from
 * the Format panel — so moving something on the board immediately shows what it
 * does to the page.
 *
 * Deliberately wireframe fidelity: shape, order and proportion are honest, the
 * art is not. It answers "does this layout work", not "is this finished".
 */
import * as React from "react";
import { Eye, Maximize2, Minimize2, Monitor, Smartphone } from "lucide-react";
import { categoryOf, getFeature, type CategoryId } from "./catalog";
import type { FormatValues } from "./format";
import { toRows } from "./spec";
import { activePage, pageNodes, useStudio, type StudioNode } from "./store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

/* ------------------------------------------------------------------ */
/* Theme derived from the Format panel                                 */
/* ------------------------------------------------------------------ */

interface Theme {
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
  /** Body size relative to 16px — drives every bar height. */
  scale: number;
  /** Gap between text lines, from the line-height setting. */
  lineGap: number;
  /** Max text column width in preview px, from the measure setting. */
  measure: number;
  align: "flex-start" | "center" | "stretch";
  textAlign: "left" | "center" | "justify";
  boxStyle: string;
  boxPad: number;
}

function themeFrom(format: FormatValues): Theme {
  const hue = Number(format["palette.accentHue"] ?? 265);
  const mode = String(format["palette.mode"] ?? "dark");
  const light = mode === "light" || mode === "both";
  const radius = Number(format["layout.radius"] ?? 10);
  const background = String(format["palette.background"] ?? "flat");

  const bg = light ? `oklch(0.97 0.008 ${hue})` : `oklch(0.16 0.012 ${hue})`;
  const backdrop =
    background === "subtle gradient" || background === "mesh gradient"
      ? `radial-gradient(120% 80% at 20% 0%, oklch(0.7 0.14 ${hue} / 0.22), transparent 70%), ${bg}`
      : background === "grid"
        ? `linear-gradient(${light ? "oklch(0 0 0 / .05)" : "oklch(1 0 0 / .05)"} 1px, transparent 1px), linear-gradient(90deg, ${light ? "oklch(0 0 0 / .05)" : "oklch(1 0 0 / .05)"} 1px, transparent 1px), ${bg}`
        : bg;

  const baseSize = Number(format["type.baseSize"] ?? 16);
  const scale = baseSize / 16;
  const lineHeight = Number(format["type.lineHeight"] ?? 1.55);
  const align = String(format["type.align"] ?? "left");

  return {
    scale,
    lineGap: Math.max(2, Math.round(lineHeight * 3.2 * scale)),
    measure: Math.round(Number(format["type.measure"] ?? 66) * 3.4),
    align: align === "center" ? "center" : "stretch",
    textAlign: align === "center" ? "center" : align === "justified" ? "justify" : "left",
    boxStyle: String(format["type.textBox"] ?? "plain"),
    boxPad: Math.max(4, Math.round(Number(format["type.boxPadding"] ?? 16) / 2.4)),
    bg,
    backdrop,
    surface: light ? `oklch(1 0 0)` : `oklch(0.21 0.014 ${hue})`,
    line: light ? `oklch(0.88 0.01 ${hue})` : `oklch(0.3 0.016 ${hue})`,
    text: light ? `oklch(0.25 0.02 ${hue})` : `oklch(0.92 0.012 ${hue})`,
    muted: light ? `oklch(0.62 0.015 ${hue})` : `oklch(0.62 0.018 ${hue})`,
    accent: light ? `oklch(0.55 0.18 ${hue})` : `oklch(0.75 0.17 ${hue})`,
    accentText: light ? `oklch(0.99 0.01 ${hue})` : `oklch(0.16 0.03 ${hue})`,
    radius,
    light,
  };
}

/* ------------------------------------------------------------------ */
/* Block archetypes                                                    */
/* ------------------------------------------------------------------ */

const Bar = ({ w, h = 6, t, r = 3 }: { w: string | number; h?: number; t: string; r?: number }) => (
  <div style={{ width: w, height: h, background: t, borderRadius: r, flexShrink: 0 }} />
);

function Lines({ n, t, widths }: { n: number; t: Theme; widths?: string[] }) {
  const w = widths ?? ["100%", "92%", "84%", "70%", "60%"];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: t.lineGap,
        maxWidth: t.measure,
        marginInline: t.textAlign === "center" ? "auto" : undefined,
        alignItems: t.textAlign === "center" ? "center" : "stretch",
      }}
    >
      {Array.from({ length: n }, (_, i) => (
        <Bar key={i} w={t.textAlign === "justify" ? "100%" : w[i % w.length]!} h={Math.max(3, Math.round(4 * t.scale))} t={t.muted} r={2} />
      ))}
    </div>
  );
}

/** How a block of text is framed, from the Text box style option. */
function boxStyles(t: Theme): React.CSSProperties {
  const base: React.CSSProperties = { borderRadius: t.radius, padding: t.boxPad };
  switch (t.boxStyle) {
    case "bordered":
      return { ...base, border: `1px solid ${t.line}` };
    case "filled":
      return { ...base, background: t.surface };
    case "card":
      return { ...base, background: t.surface, border: `1px solid ${t.line}`, boxShadow: `0 2px 6px ${t.light ? "oklch(0 0 0 / .07)" : "oklch(0 0 0 / .35)"}` };
    case "underlined":
      return { ...base, borderBottom: `2px solid ${t.line}`, borderRadius: 0 };
    case "quoted":
      return { ...base, borderLeft: `3px solid ${t.accent}`, borderRadius: 0 };
    case "inset shadow":
      return { ...base, background: t.surface, boxShadow: `inset 0 2px 6px ${t.light ? "oklch(0 0 0 / .08)" : "oklch(0 0 0 / .4)"}` };
    default:
      return { ...base, padding: 0 };
  }
}

/** One placed element, drawn as the kind of block its category implies. */
function Block({ node, t }: { node: StudioNode; t: Theme }) {
  const feature = getFeature(node.featureId);
  const cat: CategoryId = feature?.category ?? "structure";
  const id = node.featureId;
  const card = { background: t.surface, border: `1px solid ${t.line}`, borderRadius: t.radius };

  // A few ids deserve their own shape; everything else falls back to its category.
  if (id === "sticky-header" || id === "mega-menu" || cat === "nav") {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, padding: "7px 9px" }}>
        <Bar w={22} h={8} t={t.accent} r={2} />
        <div style={{ flex: 1 }} />
        {[0, 1, 2].map((i) => (
          <Bar key={i} w={16} h={5} t={t.muted} r={2} />
        ))}
      </div>
    );
  }

  if (cat === "hero") {
    return (
      <div style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 7 }}>
        <Bar w="72%" h={Math.round(13 * t.scale)} t={t.text} r={4} />
        <Bar w="52%" h={Math.round(13 * t.scale)} t={t.text} r={4} />
        <Bar w="88%" h={5} t={t.muted} r={2} />
        <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
          <div style={{ width: 46, height: 15, background: t.accent, borderRadius: Math.min(t.radius, 8) }} />
          <div style={{ width: 40, height: 15, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 8) }} />
        </div>
      </div>
    );
  }

  if (cat === "media") {
    return (
      <div style={{ ...card, padding: 8, display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 40,
              borderRadius: Math.min(t.radius, 8),
              background: `linear-gradient(140deg, ${t.accent}33, ${t.muted}22)`,
              border: `1px solid ${t.line}`,
            }}
          />
        ))}
      </div>
    );
  }

  if (cat === "data") {
    const bars = [0.4, 0.75, 0.55, 0.95, 0.6, 0.8];
    return (
      <div style={{ ...card, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
        <Bar w="40%" h={5} t={t.muted} r={2} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 34 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, height: `${b * 100}%`, background: i % 2 ? `${t.accent}88` : t.accent, borderRadius: 2 }} />
          ))}
        </div>
      </div>
    );
  }

  if (cat === "forms") {
    return (
      <div style={{ ...card, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <Bar w="34%" h={5} t={t.muted} r={2} />
        {[0, 1].map((i) => (
          <div key={i} style={{ height: 14, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 6) }} />
        ))}
        <div style={{ width: 52, height: 15, background: t.accent, borderRadius: Math.min(t.radius, 8), marginTop: 2 }} />
      </div>
    );
  }

  if (cat === "commerce") {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...card, flex: 1, padding: 7, display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ height: 22, background: `${t.accent}22`, borderRadius: 4 }} />
            <Bar w="70%" h={4} t={t.text} r={2} />
            <Bar w="40%" h={4} t={t.accent} r={2} />
          </div>
        ))}
      </div>
    );
  }

  if (cat === "social") {
    return (
      <div style={{ ...card, padding: 9, display: "flex", gap: 7, alignItems: "flex-start" }}>
        <div style={{ width: 20, height: 20, borderRadius: 999, background: `${t.accent}55`, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Bar w="45%" h={5} t={t.text} r={2} />
          <div style={{ height: 5 }} />
          <Lines n={2} t={t} />
        </div>
      </div>
    );
  }

  if (cat === "ai") {
    return (
      <div style={{ ...card, padding: 9, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ alignSelf: "flex-start", width: "62%", height: 16, background: `${t.muted}33`, borderRadius: 8 }} />
        <div style={{ alignSelf: "flex-end", width: "48%", height: 16, background: t.accent, borderRadius: 8 }} />
      </div>
    );
  }

  if (cat === "interact" || cat === "platform") {
    return (
      <div style={{ ...card, padding: 9, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[46, 34, 40].map((w, i) => (
          <div key={i} style={{ width: w, height: 14, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 7), background: i === 0 ? t.accent : "transparent" }} />
        ))}
      </div>
    );
  }

  if (cat === "power") {
    return (
      <div style={{ ...card, padding: 7, display: "flex", flexDirection: "column", gap: 3 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <Bar w={28} h={4} t={t.text} r={1} />
            <div style={{ flex: 1 }} />
            <Bar w={18} h={4} t={i % 2 ? t.accent : t.muted} r={1} />
          </div>
        ))}
      </div>
    );
  }

  if (cat === "motion") {
    return (
      <div style={{ ...card, padding: 10, borderStyle: "dashed", display: "flex", flexDirection: "column", gap: 6 }}>
        <Bar w="55%" h={6} t={t.muted} r={2} />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {[0.35, 0.6, 0.85].map((o, i) => (
            <div key={i} style={{ flex: 1, height: 12, background: t.accent, opacity: o, borderRadius: 3 }} />
          ))}
        </div>
      </div>
    );
  }

  // structure + content
  if (id === "bento-grid" || id === "card-grid" || id === "masonry") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[34, 22, 22, 22, 34, 22].map((h, i) => (
          <div key={i} style={{ ...card, height: h }} />
        ))}
      </div>
    );
  }

  if (id === "split-screen" || id === "sidebar-layout") {
    return (
      <div style={{ display: "flex", gap: 6, height: 54 }}>
        <div style={{ ...card, width: "38%" }} />
        <div style={{ ...card, flex: 1, padding: 9 }}>
          <Lines n={4} t={t} />
        </div>
      </div>
    );
  }

  if (cat === "content") {
    return (
      <div style={{ ...boxStyles(t), display: "flex", flexDirection: "column", gap: t.lineGap + 2, alignItems: t.textAlign === "center" ? "center" : "stretch" }}>
        <Bar w="58%" h={Math.round(8 * t.scale)} t={t.text} r={3} />
        <Lines n={4} t={t} />
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: 10, display: "flex", flexDirection: "column", gap: t.lineGap }}>
      <Bar w="46%" h={Math.round(6 * t.scale)} t={t.text} r={3} />
      <Lines n={3} t={t} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export function SitePreview({ device }: { device: "desktop" | "phone" }) {
  const nodes = useStudio(useShallow(pageNodes));
  const format = useStudio((s) => s.format);
  const t = React.useMemo(() => themeFrom(format), [format]);
  const rows = React.useMemo(() => toRows(nodes), [nodes]);

  const width = String(format["layout.width"] ?? "readable");
  const gap = Math.max(6, Math.round(Number(format["layout.gap"] ?? 24) / 2.4));
  const inset = device === "phone" ? 10 : width === "full bleed" ? 8 : width === "narrow" ? 34 : width === "wide" ? 14 : 22;

  if (!nodes.length) {
    return (
      <div style={{ background: t.backdrop, backgroundSize: "16px 16px", color: t.muted }} className="flex h-full items-center justify-center p-4 text-center text-[10px]">
        Place something on the board and it appears here.
      </div>
    );
  }

  return (
    <div style={{ background: t.backdrop, backgroundSize: "16px 16px", minHeight: "100%" }}>
      <div style={{ padding: `${gap}px ${inset}px`, display: "flex", flexDirection: "column", gap }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap, alignItems: "stretch" }}>
            {row.map((node) => (
              <div key={node.id} style={{ flex: row.length > 1 ? node.w : 1, minWidth: 0 }}>
                <Block node={node} t={t} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The pinned window                                                   */
/* ------------------------------------------------------------------ */

const SIZES = { s: 200, m: 280, l: 380 } as const;

export function PreviewWindow() {
  const [size, setSize] = React.useState<keyof typeof SIZES>("m");
  const [device, setDevice] = React.useState<"desktop" | "phone">("desktop");
  const [open, setOpen] = React.useState(true);
  const page = useStudio(activePage);
  const count = useStudio((s) => s.nodes.filter((n) => n.pageId === s.activePageId).length);

  const w = SIZES[size];

  return (
    <div
      className="absolute bottom-3 right-3 z-20 flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-panel"
      style={{ width: open ? w : 148 }}
    >
      <header className="flex h-7 shrink-0 items-center gap-1 border-b border-border px-1.5">
        <Eye className="size-3 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-fg">
          {open ? `${page.name} · ${count}` : "Preview"}
        </span>
        {open ? (
          <>
            <Tooltip content={device === "desktop" ? "Phone width" : "Desktop width"}>
              <Button
                variant="ghost"
                size="iconXs"
                aria-label="Toggle device width"
                onClick={() => setDevice(device === "desktop" ? "phone" : "desktop")}
              >
                {device === "desktop" ? <Smartphone /> : <Monitor />}
              </Button>
            </Tooltip>
            <Tooltip content="Size">
              <button
                type="button"
                aria-label="Preview size"
                onClick={() => {
                  play("select");
                  setSize(size === "s" ? "m" : size === "m" ? "l" : "s");
                }}
                className="tactile rounded-sm px-1 text-[10px] uppercase text-fg-muted hover:bg-hover hover:text-fg"
              >
                {size}
              </button>
            </Tooltip>
          </>
        ) : null}
        <Tooltip content={open ? "Collapse" : "Expand"}>
          <Button variant="ghost" size="iconXs" aria-label="Toggle preview" onClick={() => setOpen(!open)}>
            {open ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </Tooltip>
      </header>

      {open ? (
        <div className={cn("overflow-y-auto", size === "l" ? "max-h-[52vh]" : "max-h-[38vh]")}>
          <div style={{ width: device === "phone" ? Math.round(w * 0.56) : "100%", margin: "0 auto" }}>
            <SitePreview device={device} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
