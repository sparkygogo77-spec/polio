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
 * so a library of 230 live previews costs about what a list of icons did.
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

/**
 * A preview that can be woken for one pass.
 *
 * HIS WORDS: "in the list of parts, when i hover something that is supposed
 * to have either a unique animation or style, on hover start the animation
 * once and forget it when i stop hovering."
 *
 * The shelf draws every part in `board` mode, which by the parts contract
 * means the initial state and no timers — the right default for 230 tiles on
 * one screen, and the reason nothing on the shelf ever moves. `play` puts
 * this one tile into `live` mode, where a part is itself: whatever entrance
 * it has runs, and whatever it does under a pointer it does.
 *
 * Once, and forgotten. The card drops `play` back to false on its own after
 * the pass and the instant the pointer leaves, and the `key` below remounts
 * the part on every change — so it always starts from the beginning and is
 * always left at rest, never halfway through.
 */
export function PartPreview({ feature, width, height, round, play }: { feature: FeatureDef; width: number; height: number; round?: boolean; play?: boolean }) {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const site = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
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
      /* A part a repository brought is a preset of a real one: the real
         one draws, wearing what was measured off the page it came from. */
      featureId: feature.basedOn ?? feature.id,
      label: feature.name,
      prompt: "",
      content: feature.preset?.content ?? previewContent(feature) ?? "",
      data: "",
      x: 0,
      y: 0,
      w: pw,
      h: ph,
      groupId: null,
      options: feature.preset?.options ?? {},
      priority: "must",
      custom: false,
      glyph: null,
      hue: null,
      locked: false,
      link: null,
      colour: (feature.preset?.colour ?? null) as StudioNode["colour"],
      font: (feature.preset?.font ?? null) as StudioNode["font"],
      anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null, role: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
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
        {/* Remounted when `play` turns over, so the pass starts at zero
            rather than resuming wherever the last one stopped. */}
        <Block key={play ? "live" : "rest"} node={node} t={theme} mode={play ? "live" : "board"} />
      </div>
    </div>
  );
}
