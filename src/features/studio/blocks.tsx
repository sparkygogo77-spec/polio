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
import { textureCss, type Light, type Palette, type TextureLayer, driftKeyframes } from "./look";
import { frameDoc, hasBody } from "./snippet";
import { paintRoles, roleVars } from "./bodyPaint";
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
  /** Which piece of the part the board is pointing at, and the mark to draw it in. */
  pick?: { id: string; colour: string } | null;
}

export function Block({ node, t: siteTheme, mode = "board", size, onNavigate, emit, palette, light, page, layers, pick }: BlockProps) {
  const def = resolvePart(node.featureId);
  // A part can repaint any of the six roles for itself, and set its own type;
  // everything else follows the site.
  const painted = applyFont(node.colour && palette ? overrideTheme(siteTheme, node.colour, palette) : siteTheme, node.font);
  // …and wear one texture layer of its own, or none, whatever the site does.
  const worn = node.texture && node.texture !== "none" ? layers?.find((l) => l.id === node.texture) : undefined;
  const dressed = React.useMemo(() => {
    if (!node.texture) return painted;
    if (node.texture === "none") return { ...painted, surfacePaint: undefined };
    if (!worn || !palette) return painted;
    return { ...painted, surfacePaint: textureCss([{ ...worn, on: true }], palette, painted.surface) };
  }, [node.texture, worn, palette, painted]);
  /*
   * The keyframes the worn layer's drift names. The paint above names
   * `tex-drift-<hash of this one layer>`, and the only keyframes on the page
   * were the site stack's, hashed over every layer that is on: the two
   * agreed only when the stack was exactly this layer, so a part's drift
   * was a name with nothing behind it. One set per worn layer, beside it.
   */
  const drift = worn && palette ? driftKeyframes([{ ...worn, on: true }], palette) : null;
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
  /*
   * A part that draws the drawing itself is not stood in for by a body.
   *
   * The coded body exists because there was no part for what was drawn.
   * Once the drawing has taken a role that *is* a part — an icon draws its
   * own paths — the body would cover the part with a picture of it, which
   * is exactly the cutout this whole line of work is getting away from.
   * The body is kept on the node, so changing the role back brings it
   * straight back.
   */
  if (hasBody(node.code) && !DRAWS_ITSELF.has(node.featureId)) {
    const body = <CodedBody node={node} t={t} mode={mode} size={size} />;
    return node.outline ? <Cut node={node}>{body}</Cut> : body;
  }
  if (!def) return <Unknown node={node} t={t} />;
  const P = def.component;
  const part = (
    <>
    {drift ? <style data-part-drift={drift.name}>{drift.css}</style> : null}
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
      cube={node.cube}
      pick={pick ?? null}
      mesh={node.mesh}
      vector={node.vector}
      onNavigate={onNavigate}
      emit={emit}
    />
    </>
  );
  /*
   * A part that does not read its own link is the link, whole.
   *
   * "Links to" was offered on thirty parts and read by sixteen; on the
   * rest the link was set, written into the brief, and went nowhere live
   * (inventory B24). A grid's cards navigate by their own titles, and its
   * own link is where the whole grid points, so the press is taken here,
   * before the card sees it, and goes there. Live only: the board is a
   * layout surface.
   */
  const whole = mode === "live" && def.linkWhole && node.link && onNavigate ? node.link : null;
  const linked = whole ? (
    <div
      data-link-whole={whole.kind}
      role="link"
      tabIndex={0}
      aria-label={`Go to ${whole.target}`}
      style={{ width: "100%", height: "100%", cursor: "pointer" }}
      onClickCapture={(e) => { e.stopPropagation(); onNavigate?.(whole); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onNavigate?.(whole); } }}
    >
      {part}
    </div>
  ) : part;
  /*
   * A part is a box unless the author said otherwise — drew a line round
   * it, or picked a shape. Then it is cut to that shape here rather than in
   * the part, because every one of the two hundred and twenty-six would
   * otherwise have to know how to be round.
   *
   * Two ways, and the exact one wins. `outline` is the line as it was
   * actually drawn, kept in the part's own box, so a helix or a star crops
   * the part to a helix or a star; `shape` is the five shapes worth naming,
   * and is what a part gets when someone picks one from a menu.
   */
  if (node.outline) return <Cut node={node}>{linked}</Cut>;
  if (!node.shape || node.shape === "box") return linked;
  return (
    <div
      data-shape={node.shape}
      style={{
        width: "100%", height: "100%", overflow: "hidden",
        borderRadius: node.shape === "rounded" ? Math.min(28, Math.min(size?.w ?? node.w, size?.h ?? node.h) / 6) : "50%",
      }}
    >
      {linked}
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
  /*
   * The body answers the palette.
   *
   * What came back from the renderer or the writer has its colours baked in,
   * so a drawn part ignored every colour role: change the accent and nothing
   * happened. `paintRoles` hands each baked colour to the role it stands in
   * for and leaves the original as the fallback, and the frame declares the
   * roles from the theme this part is standing in — so it repaints whenever
   * the palette changes, not only at the moment it was made. What is stored
   * is untouched; this is a reading of it.
   */
  /*
   * Which of its own colours the part has set, the one a person means by
   * "the colour" first: a one-ink body follows the first of these
   * (`paintRoles`), so a drawn line answers the wheel whichever slab was
   * turned, and reads as before when none was. Never the ground: a line
   * that took its own background's colour would vanish into it.
   */
  const own = React.useMemo(
    () => (["accent", "text", "muted"] as const).filter((r) => !!node.colour?.[r]),
    [node.colour],
  );
  const doc = React.useMemo(
    () => frameDoc(paintRoles(node.code!.html, { prefer: own }), {
      colour: t.text,
      font: t.bodyFamily,
      roles: roleVars({ bg: t.bg, text: t.text, accent: t.accent, muted: t.muted }),
    }),
    [node.code, own, t.text, t.bodyFamily, t.bg, t.accent, t.muted],
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
/** Parts that render the drawing themselves, so a coded body must not stand in. */
const DRAWS_ITSELF = new Set(["drawn-icon"]);

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
