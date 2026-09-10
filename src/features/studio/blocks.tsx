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
import { frameDoc, hasBody } from "./snippet";
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
  /*
   * A body written for this part stands in for the part. The drawing asked
   * for something no entry in the library is — a helix of sentences — and
   * Claude wrote it; the catalog entry underneath is only what it was
   * before, and drawing both would be drawing two things.
   */
  if (hasBody(node.code)) {
    const body = <CodedBody node={node} t={t} mode={mode} size={size} />;
    return node.outline ? <Cut node={node}>{body}</Cut> : body;
  }
  if (!def) return <Unknown node={node} t={t} />;
  const P = def.component;
  const part = (
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
  /*
   * A part is a box unless the author said otherwise — drew a line round
   * it, or picked a shape. Then it is cut to that shape here rather than in
   * the part, because every one of the two hundred and twenty-five would
   * otherwise have to know how to be round.
   *
   * Two ways, and the exact one wins. `outline` is the line as it was
   * actually drawn, kept in the part's own box, so a helix or a star crops
   * the part to a helix or a star; `shape` is the five shapes worth naming,
   * and is what a part gets when someone picks one from a menu.
   */
  if (node.outline) return <Cut node={node}>{part}</Cut>;
  if (!node.shape || node.shape === "box") return part;
  return (
    <div
      data-shape={node.shape}
      style={{
        width: "100%", height: "100%", overflow: "hidden",
        borderRadius: node.shape === "rounded" ? Math.min(28, Math.min(size?.w ?? node.w, size?.h ?? node.h) / 6) : "50%",
      }}
    >
      {part}
    </div>
  );
}

/**
 * A part whose body was written for it.
 *
 * In a frame with no permissions at all — `sandbox=""` is no scripts, no
 * same-origin, no forms, no navigation — and a content policy inside it
 * that allows inline styles and data: images and nothing else
 * (`snippet.ts`). The code is already cleaned before it is stored, so this
 * is the third lock rather than the first.
 *
 * It takes no presses on the board: a part is dragged and selected there,
 * and a frame that swallowed the pointer would be a part you cannot pick
 * up. On the live site it takes them like anything else — though with no
 * scripts, all that means is `:hover`.
 */
function CodedBody({ node, t, mode, size }: { node: StudioNode; t: Theme; mode: PartMode; size?: { w: number; h: number } }) {
  const doc = React.useMemo(
    () => frameDoc(node.code!.html, { colour: t.text, font: t.bodyFamily }),
    [node.code, t.text, t.bodyFamily],
  );
  return (
    <iframe
      data-coded-body={node.id}
      title={node.label}
      srcDoc={doc}
      sandbox=""
      referrerPolicy="no-referrer"
      loading="lazy"
      scrolling="no"
      width={size?.w ?? node.w}
      height={size?.h ?? node.h}
      style={{
        width: "100%", height: "100%", display: "block", border: "none", background: "transparent",
        pointerEvents: mode === "live" ? "auto" : "none",
      }}
    />
  );
}

/**
 * The part, cropped to the line that was drawn round it.
 *
 * `clipPath: url(#…)` against an inline `clipPath` in `objectBoundingBox`
 * units: the path is 0..1 in each axis, so it stretches with the part and
 * needs no recomputing when the part is resized. An open line was walked
 * into a closed band before it got here (`outlinePath`), so there is one
 * mechanism rather than a clip and a mask — browsers agree about clipping
 * an HTML element and do not agree about masking one.
 */
function Cut({ node, children }: { node: StudioNode; children: React.ReactNode }) {
  const id = `cut-${node.id}`;
  return (
    <div
      data-shape={node.outline!.closed ? "outline" : "stroke"}
      data-outline-points={node.outline!.points}
      style={{ width: "100%", height: "100%", overflow: "hidden", clipPath: `url(#${id})`, WebkitClipPath: `url(#${id})` } as React.CSSProperties}
    >
      <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
        <defs>
          <clipPath id={id} clipPathUnits="objectBoundingBox">
            <path d={node.outline!.cut} />
          </clipPath>
        </defs>
      </svg>
      {children}
    </div>
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
