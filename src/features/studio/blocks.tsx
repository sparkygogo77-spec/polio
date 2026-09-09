"use client";
/**
 * How each part looks and behaves, at real size, from its options and contents.
 *
 * The board and the live preview both draw parts through `Block`, so what you
 * see on the board is what the page will be. `Block` is only a dispatcher: the
 * parts themselves live in `parts/` (see `parts/types.ts` for the contract).
 * Every catalog id resolves to a real component; the labelled box below is the
 * last resort for an id that was removed from the registry.
 */
import * as React from "react";
import { resolvePart, type NodeLink, type PartEvent, type PartMode, type Theme } from "./parts";
import { applyFont, liftTheme, overrideTheme } from "./parts/theme";
import { textureCss, type Light, type Palette, type TextureLayer } from "./look";
import type { StudioNode } from "./store";

export { items, themeFrom, type Theme } from "./parts/theme";

export interface BlockProps {
  node: StudioNode;
  t: Theme;
  /** "board": initial state, held still, inert. "live": fully interactive. */
  mode?: PartMode;
  /** The box actually given to the part; defaults to the node's own size. */
  size?: { w: number; h: number };
  onNavigate?: (link: NodeLink) => void;
  emit?: (e: PartEvent) => void;
  /** The site's six roles, so a part that repaints itself can name one. */
  palette?: Palette;
  /** The page's lamp, and how big the page is, so the part can be lit by it. */
  light?: Light;
  page?: { w: number; h: number };
  /** The site's texture stack, so a part can wear one layer of it on its own. */
  layers?: TextureLayer[];
}

export function Block({ node, t: siteTheme, mode = "board", size, onNavigate, emit, palette, light, page, layers }: BlockProps) {
  const def = resolvePart(node.featureId);
  // A part can repaint any of the six roles for itself, and set its own type;
  // everything else follows the site.
  const painted = applyFont(node.colour && palette ? overrideTheme(siteTheme, node.colour, palette) : siteTheme, node.font);
  // …and wear one texture layer of its own, or none, whatever the site does.
  const dressed = React.useMemo(() => {
    if (!node.texture) return painted;
    if (node.texture === "none") return { ...painted, surfacePaint: undefined };
    const layer = layers?.find((l) => l.id === node.texture);
    if (!layer || !palette) return painted;
    return { ...painted, surfacePaint: textureCss([{ ...layer, on: true }], palette, painted.surface) };
  }, [node.texture, layers, palette, painted]);
  // Then it is put where it stands under the page's light, so its shadow
  // points the right way. No light, no change.
  const t = light?.on && page
    ? liftTheme(dressed, light, (node.x + (size?.w ?? node.w) / 2) / Math.max(1, page.w), (node.y + (size?.h ?? node.h) / 2) / Math.max(1, page.h))
    : dressed;
  if (!def) return <Unknown node={node} t={t} />;
  const P = def.component;
  return (
    <P
      id={node.featureId}
      label={node.label}
      content={node.content ?? ""}
      options={node.options}
      w={size?.w ?? node.w}
      h={size?.h ?? node.h}
      link={node.link ?? null}
      theme={t}
      mode={mode}
      onNavigate={onNavigate}
      emit={emit}
    />
  );
}

/** An id with no part behind it — only reachable if the registry loses one. */
function Unknown({ node, t }: { node: StudioNode; t: Theme }) {
  return (
    <div
      data-part={node.featureId}
      data-part-fallback=""
      style={{
        width: "100%", height: "100%", boxSizing: "border-box", overflow: "hidden",
        background: t.surface, border: `1px dashed ${t.line}`, borderRadius: t.radius,
        padding: t.fontPx, display: "flex", flexDirection: "column", gap: 6,
        color: t.text, fontFamily: t.bodyFamily, fontSize: t.fontPx,
      }}
    >
      <span style={{ fontWeight: 700, fontFamily: t.headingFamily }}>{node.label}</span>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>{node.content || node.prompt || node.featureId}</span>
    </div>
  );
}
