"use client";
/**
 * A part, drawn small.
 *
 * The library used to show an icon, which told you the category and nothing
 * else — a "Tile grid" icon and a "Card grid" icon look the same. This renders
 * the actual part instead, at the size it would really be on a page and then
 * scaled down to fit, wearing the site's own theme so the library looks like
 * the thing you are building. It only ever shrinks: a header drawn at 1440 and
 * scaled to 0.6 reads as a header, the same part magnified would read as a
 * giant word.
 *
 * A preview shows the *surface*, never the page: a shelf full of page
 * backgrounds is a shelf of identical rectangles, and what you are choosing
 * between is the part, not the ground it happens to be standing on. So the
 * page background and any texture aimed at it are swapped out for the surface
 * colour before the part is drawn.
 *
 * Off-screen tiles skip their layout and paint entirely (`content-visibility`),
 * so a library of 218 live previews costs about what a list of icons did.
 */
import * as React from "react";
import { Block, themeFrom } from "./blocks";
import type { FeatureDef } from "./catalog";
import { useStudio, type StudioNode } from "./store";
import { previewContent } from "./showcase";

/** The size a part is drawn at before it is scaled down. Its own, within reason. */
export function previewSize(feature: FeatureDef): { w: number; h: number } {
  return {
    w: Math.max(320, Math.min(1440, feature.w ?? 420)),
    h: Math.max(40, Math.min(900, feature.h ?? 88)),
  };
}

/** How tall the preview comes out at a given width, keeping the part's shape. */
export function previewHeight(feature: FeatureDef, width: number): number {
  const { w, h } = previewSize(feature);
  return Math.max(36, Math.round(h * (width / w)));
}

export function PartPreview({ feature, width, height, round }: { feature: FeatureDef; width: number; height: number; round?: boolean }) {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const site = React.useMemo(() => themeFrom(format, look), [format, look]);
  // Everything the part would paint as "the page" becomes the surface instead.
  const theme = React.useMemo(
    () => ({ ...site, bg: site.surface, backdrop: site.surface, surfaceStyle: undefined, partGround: undefined, overlayStyle: undefined }),
    [site],
  );

  const { w: pw, h: ph } = previewSize(feature);
  // Fit, never crop. Most parts are wide and short, so the width decides; a
  // tall one shrinks rather than showing its top half, which for anything
  // vertically centred is a box of empty space.
  const scale = Math.min(width / pw, height / ph);

  const node = React.useMemo<StudioNode>(
    () => ({
      id: `preview_${feature.id}`,
      pageId: "",
      featureId: feature.id,
      label: feature.name,
      prompt: "",
      content: previewContent(feature) ?? "",
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
      link: null, colour: null, anim: null, aura: null, texture: null,
    }),
    [feature, feature.id, feature.name, pw, ph],
  );

  return (
    <div
      aria-hidden
      inert
      className={round ? "pointer-events-none overflow-hidden rounded-full" : "pointer-events-none overflow-hidden rounded-sm border border-border/70"}
      style={{ width, height, background: theme.surface, contentVisibility: "auto", containIntrinsicSize: `${width}px ${height}px` }}
    >
      <div style={{ width: pw, height: ph, transform: `scale(${scale})`, transformOrigin: "0 0", marginLeft: Math.max(0, (width - pw * scale) / 2) }}>
        <Block node={node} t={theme} mode="board" />
      </div>
    </div>
  );
}
