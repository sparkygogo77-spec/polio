"use client";
/**
 * A part, drawn small.
 *
 * The library used to show an icon, which told you the category and nothing
 * else — a "Tile grid" icon and a "Card grid" icon look the same. This renders
 * the actual part instead, at a narrow width so its shape still reads once it
 * is scaled down, wearing the site's own theme so the library looks like the
 * thing you are building.
 *
 * Off-screen tiles skip their layout and paint entirely (`content-visibility`),
 * so a library of 218 live previews costs about what a list of icons did.
 */
import * as React from "react";
import { Block, themeFrom } from "./blocks";
import type { FeatureDef } from "./catalog";
import { useStudio, type StudioNode } from "./store";

/** Wide enough that a nav bar still reads as a nav bar, narrow enough to shrink well. */
const PREVIEW_W = 420;

export function PartPreview({ feature, width, height, round }: { feature: FeatureDef; width: number; height: number; round?: boolean }) {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const theme = React.useMemo(() => themeFrom(format, look), [format, look]);

  const w = feature.w ?? PREVIEW_W;
  const h = feature.h ?? 88;
  // Keep the part's own proportions, but never so tall that one tile is a page.
  const pw = PREVIEW_W;
  const ph = Math.max(40, Math.min(260, Math.round(h * (pw / w))));
  const scale = width / pw;

  const node = React.useMemo<StudioNode>(
    () => ({
      id: `preview_${feature.id}`,
      pageId: "",
      featureId: feature.id,
      label: feature.name,
      prompt: "",
      content: "",
      data: "",
      x: 0,
      y: 0,
      w: pw,
      h: ph,
      groupId: null,
      options: {},
      priority: "must",
      custom: false,
      glyph: null,
      hue: null,
      locked: false,
      link: null, colour: null,
    }),
    [feature.id, feature.name, pw, ph],
  );

  return (
    <div
      aria-hidden
      inert
      className={round ? "pointer-events-none overflow-hidden rounded-full" : "pointer-events-none overflow-hidden rounded-sm border border-border/70"}
      style={{ width, height, background: theme.bg, contentVisibility: "auto", containIntrinsicSize: `${width}px ${height}px` }}
    >
      <div style={{ width: pw, height: ph, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <Block node={node} t={theme} mode="board" />
      </div>
    </div>
  );
}
