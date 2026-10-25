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
import { resolvePart, type NodeLink, type PartEvent, type PartMode, type PartTour, type Theme } from "./shelf/ui";
import { EMBED_SANDBOX, embedSrc, hasMotion, motionClass } from "./shelf";
import { livingLayered } from "./living";
import { applyBand, applyCaptured, applyEdge, applyFont, applyLayout, applyPad, applyText, boxPicture, boxStyle, filmPic, hasBox, liftTheme, overrideTheme, type NodeText } from "./shelf/run";
import { stillCutOf } from "./pageClip";
import { lands, textureCss, type Light, type Palette, type TextureLayer, driftKeyframes } from "./look";
import { WornTexture } from "./WornTexture";
import { frameDoc, hasBody } from "./snippet";
import { paintRoles, roleVars } from "./bodyPaint";
import type { StudioNode } from "./board/store";
import { usesOf } from "./shelf";
import { pushedOnPress } from "./send-out/motionCss";
import { usePicture, type Picture } from "./pictures";
import { CrateOn } from "./crateLayer";
import { WornShape } from "./WornShape";
import { hasLetters, isSpans, plain, spansOf } from "./shelf";
import type { NodeMedia } from "./shelf";
import type { NodeWorld } from "./shelf/ui";
import { exactBox } from "./exactBox";
import { SvgArt, svgMarkupOf } from "./board/themeDraw";
import { useResolved } from "./system/draw";

export { items, themeFrom, type Theme } from "./shelf/run";

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
  /**
   * Where this part's picture is to be pointed at, when the caller knows
   * better than the browser does.
   *
   * The board and the preview leave it alone and the bytes are found in this
   * browser's file storage. The publish passes the path the file will have
   * in the repository, because the page it is writing will be read from
   * there and there is no browser storage on the other end.
   */
  pictureAt?: (pic: Picture) => string | undefined;
  /**
   * A page of the site, drawn small: what a cube's surface stands on.
   *
   * The renderer is the site's, so it cannot be imported here without
   * turning the layering upside down — `LiveSite` draws blocks, not the
   * other way about. So it is handed in, and a board that has no way to
   * draw a page simply does not pass one.
   */
  surface?: (pageId: string, box: { w: number; h: number }) => React.ReactNode;
  /** Another part of the page drawn live into a box: a "What's new" step's preview. Handed in, as `surface` is. */
  partView?: (nodeId: string, box: { w: number; h: number }) => React.ReactNode;
  /** The name its motion box wears, when it is not the part's own: a part drawn again in a preview (`copyMotion`). */
  motionId?: string;
  /** Other parts sit in this one: it is a panel, and wears the texture laid on panels rather than on fields (`owner.ts#holderIds`). */
  holder?: boolean;
}

/*
 * WORDS THEIR OWN BOX CENTRES ARE CENTRED.
 *
 * A page can centre a line two ways: `text-align`, or a flex box that puts
 * its one child in the middle. The capture keeps both, as `text.align` and
 * as `layout`, and only the first reached the words. Measured on sink's
 * home page: "No PnL data available for the selected period" carried
 * `layout {display: flex, direction: row, justify: center}` and no
 * alignment, and drew 510px left of its centre, under a line that said
 * centre and drew centred.
 *
 * So for the parts that are words, horizontal centring by the box counts
 * as centring the words: justify centre on a row, align centre on a column.
 * Anything the node says itself wins. Across sink's nine pages this is nine
 * parts, and eight of them (the buttons) already said centre.
 */
const WORDS = new Set(["prose", "value-prop", "cta-primary"]);
function wordsSet(node: StudioNode): NodeText | null | undefined {
  const set = pageWrapped(node) ? { ...node.text, wrap: "wrap" } as NodeText : node.text;
  if (set?.align || !WORDS.has(node.featureId)) return set;
  const l = node.layout;
  const centres = !!l && l.display === "flex" && ((l.direction ?? "row") === "row" ? l.justify === "center" : l.align === "center");
  return centres ? { ...set, align: "center" } : set;
}

/*
 * WORDS THE PAGE SET ON TWO ROWS WRAP ON THE BOARD TOO. A paragraph held
 * to one line is chosen by its height against two of its own lines
 * (`parts/Text.tsx`), and that is the board's type, not the page's: a
 * bigger size or leading in the look, or a box's padding, put PST's
 * "Escrow balance (available to stake or withdraw): - SOL", two rows on the
 * page, under that mark, so it was set on one row and ran out of the
 * Balance panel (J, 2026-10-10). The capture recorded what the page drew
 * (`source.was`): a paragraph it set on two rows or more is never one line.
 * `tests/line-owned.mjs`.
 */
function pageWrapped(node: StudioNode): boolean {
  if (node.featureId !== "prose" || (node.text?.wrap && node.text.wrap !== "nowrap")) return false;
  const was = node.source?.was;
  /* A line set at `normal` is about 1.2 of its size, as a browser draws it. */
  const lh = (was?.fontSize ?? 0) * (was?.lineHeight === "normal" ? 1.2 : was?.lineHeight ?? 0);
  if (!was?.box || !(lh > 0)) return false;
  const pad = was.pad ? was.pad[0] + was.pad[2] : 0;
  const edge = 2 * (was.borderWidth ?? 0);
  return (was.box.h - pad - edge) / lh >= 1.9;
}

/**
 * A running line told where to sit in its band: the marquee's "Centre in its
 * band" and "Text size" (library/behaviours.ts), read wherever the part is
 * drawn, so the board, the Preview and the published page agree. Null when
 * the part runs no marquee, or its switch is off.
 */
function bandOf(node: StudioNode): { middle: boolean; size: number | null } | null {
  const use = usesOf((node as { work?: Parameters<typeof usesOf>[0] }).work).find((u) => u.id === "marquee" && !u.off);
  if (!use) return null;
  const size = Number(use.inputs?.size);
  const middle = use.inputs?.middle === "yes";
  return middle || (Number.isFinite(size) && size > 0) ? { middle, size: Number.isFinite(size) && size > 0 ? size : null } : null;
}

/**
 * A PART'S WINDOW DOES NOT TURN WITH THE PART. The capture cuts a part to the
 * box it hangs out of (`art.clipPath`); written on the box that also runs the
 * part's own animation, the cut turned with it (trumpmorty.fun's spinning
 * planet showed a straight diagonal edge). A part with an animation of its own
 * wears the cut on a still box round it; a still one keeps it on its own box,
 * where sink works it out in the part's turned frame. `tests/clip-stays.mjs`.
 */
function stillCut(node: StudioNode): string | null {
  const cut = node.art?.clipPath;
  /* Moved by its own translation, it keeps only the sides the capture cut (`pageClip.ts#stillCutOf`). */
  return cut && node.motion?.animation?.length ? stillCutOf(cut, node.art) ?? null : null;
}
function StillCut({ node, children }: { node: StudioNode; children: React.ReactNode }) {
  const cut = stillCut(node);
  if (!cut) return <>{children}</>;
  return <div data-still-cut="" style={{ width: "100%", flex: "1 0 auto", display: "flex", flexDirection: "column", clipPath: cut }}>{children}</div>;
}

/** A style wearing the `background` shorthand and a background longhand at once (`boxCss` in `Block`). */
const mixesBackground = (css: React.CSSProperties | undefined): boolean =>
  !!css && css.background !== undefined && Object.keys(css).some((k) => /^background[A-Z]/.test(k) && css[k as keyof React.CSSProperties] !== undefined);

export function Block({ node: given, t: siteTheme, mode = "board", size, onNavigate, emit, palette, light, page, layers, pick, pictureAt, surface, partView, motionId, holder }: BlockProps) {
  /* A field pointing at a System token draws the token's value (system/draw.ts). */
  const node = useResolved(given);
  const def = resolvePart(node.featureId);
  /*
   * The picture, resolved once for the part. The hook runs for every part
   * whether or not it holds one — hooks cannot be conditional — and hands
   * back nothing when there is nothing to hand back.
   */
  const found = usePicture(node.picture ?? null);
  const picture = node.picture
    ? { pic: filmPic(node) ?? node.picture, src: pictureAt ? pictureAt(node.picture) : found.src }
    : null;
  /* A captured video's own file, found as a picture is (tests/video-part.mjs). */
  const mediaNode = (node as { media?: NodeMedia | null }).media ?? null;
  const mediaFound = usePicture(mediaNode?.file ?? null);
  const media = mediaNode ? { ...mediaNode, local: mediaNode.file ? (pictureAt ? pictureAt(mediaNode.file) : mediaFound.src) : undefined } : null;
  // A part can repaint any of the six roles for itself, set its own type and
  // say how its words sit; everything else follows the site.
  //
  // Each of these records what the node SAID as well as applying it, because
  // a part cannot otherwise tell his choice from the site's default and so
  // cannot honour one without overruling the other. `applyEdge` paints
  // nothing at all — the edge is the box wrapper's below — it only carries
  // the fact, so a part that draws its own edge can stand aside for his.
  // See `NodeSaid` in `parts/theme.ts`.
  const band = bandOf(node);
  const painted = applyBand(applyCaptured(applyLayout(applyEdge(applyPad(applyText(applyFont(node.colour && palette ? overrideTheme(siteTheme, node.colour, palette) : siteTheme, node.font, { captured: !!node.from?.selector?.trim() }), wordsSet(node)), node.pad), node.edge), node.layout), { from: node.from, h: size?.h ?? node.h, font: node.font, pad: node.pad }), band);
  // …and wear one texture layer of its own, or none, whatever the site does.
  const worn = node.texture && node.texture !== "none" ? layers?.find((l) => l.id === node.texture) : undefined;
  const dressed = React.useMemo(() => {
    if (!node.texture) return holder && painted.panelPaint !== painted.surfacePaint ? { ...painted, surfacePaint: painted.panelPaint } : painted;
    if (node.texture === "none") return { ...painted, surfacePaint: undefined };
    if (!worn || !palette) return painted;
    return { ...painted, surfacePaint: textureCss([{ ...worn, on: true }], palette, painted.surface) };
  }, [node.texture, worn, palette, painted, holder]);
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
   * A shape drawn wearing a style kit draws itself whole: its shadow is
   * outside its line, so it is never cut to it (`WornShape.tsx`). After every
   * hook above, so a part that gains or loses the record keeps its hooks.
   */
  if (node.worn) return <WornShape node={node} mode={mode} size={size} picture={picture?.src} onNavigate={onNavigate} />;
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
  /*
   * AND A PICTURE BEATS A DRAWN BODY.
   *
   * Somebody who puts a picture on a part has said what they want. A drawn
   * body is what the part does when nobody has said anything — a
   * placeholder with good manners, not a choice. So the picture wins, and
   * because the body is still on the node, taking the picture away brings
   * it straight back rather than leaving a hole.
   */
  if (hasBody(node.code) && !DRAWS_ITSELF.has(node.featureId) && !node.picture) {
    const body = <CodedBody node={node} t={t} mode={mode} size={size} />;
    return node.outline ? <Cut node={node}>{body}</Cut> : body;
  }
  if (!def) return <Unknown node={node} t={t} />;
  const P = def.component;
  /* A drawing the page wrote inline (a dial's ticks, curved labels, hands): drawn as the svg it was, not as a flat picture of it (`board/themeDraw.tsx`). */
  const svgArt = svgMarkupOf(node);
  /* A face's axes the page set (`font.variation`) are drawn on the box, so a part with them has one. */
  const boxed = hasBox(node) || !!svgArt || (typeof node.font?.variation === "string" && !!node.font.variation.trim());
  /*
   * A BOX IS FILLED TO ITS EDGE.
   *
   * The box round a part draws the node's padding and edge, and the node's
   * own ground (`ownBackground`, else the floor under a textured page) was
   * painted by the part INSIDE that padding. His wallet button came out as a
   * green edge, 16px of the page, and a green block the size of its words;
   * his stat cards and panels, whose box part holds nothing, came out as an
   * outline round a fill 0px tall, because a part with no words has no
   * height inside a box that takes its height from what it holds. So the
   * box paints the ground, edge to edge, and the part inside it paints none
   * of its own. A part that draws its own surface (a card) still does; a
   * node with no box is untouched, its part filling it exactly as before.
   * `tests/box-fill.mjs` holds it in pixels.
   */
  const ground = boxed && !node.picture?.seeThrough ? (t.ownBackground ?? t.partGround) : undefined;
  /* A captured part with words of its own (a remote key, a stat tile's label): they may overflow the box the capture measured by a hair of face or rounding, never be cut by it (`tests/button-words-whole.mjs`). */
  const wordsOwn = !!node.from?.selector?.trim() && !node.picture && plain(node.content).trim() !== "";
  const inner = boxed ? { ...t, ownBackground: undefined, partGround: undefined } : t;
  /* A layer worn by a boxed part brought in is painted by the box (below), not by the part. */
  const boxWorn = boxed && !!worn && !!palette && !!node.from?.selector?.trim();
  /*
   * A FRAME OF ANOTHER PAGE (sink `node.embed`: trumpmorty.fun's DEX Screener
   * chart). Live, the frame itself, filling the box, in a sandbox; on the
   * board, a still naming where it comes from, since the board is a layout
   * surface and another site running inside it is not something to lay out.
   */
  const frameSrc = embedSrc(node.embed);
  const embedded = node.embed ? (
    mode === "live" && frameSrc ? (
      <iframe
        src={frameSrc}
        title={node.embed.title || node.label}
        sandbox={typeof node.embed.sandbox === "string" ? node.embed.sandbox : EMBED_SANDBOX}
        {...(node.embed.allow ? { allow: node.embed.allow } : {})}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ display: "block", width: "100%", height: size?.h ?? node.h, border: 0 }}
      />
    ) : (
      <div data-embed-still="" style={{ width: "100%", height: size?.h ?? node.h, display: "flex", alignItems: "center", justifyContent: "center", background: t.surface, color: t.muted, fontFamily: t.bodyFamily, fontSize: 13 }}>
        embed · {(() => { try { return new URL(node.embed.src).hostname; } catch { return "no address"; } })()}
      </div>
    )
  ) : null;
  /*
   * The box's own style. A ground (the `background` shorthand) and a
   * picture (`backgroundImage`, its size and place) can be worn together;
   * when the ground goes and the picture stays (a picture found see-through
   * a moment after it lands), React clears the shorthand after leaving the
   * longhands alone, and the browser drops the picture with it. trumpmorty's
   * footer band stayed bare until the site was opened again. A box that mixes
   * the two is drawn as its own element, so going in or out of the mix
   * draws it afresh rather than diffing one into the other.
   */
  const boxCss: React.CSSProperties | undefined = !boxed ? undefined : { width: "100%", height: "auto", flex: "1 0 auto", ...(exactBox(node) ? { flex: "1 1 0%", minHeight: 0 } : null), boxSizing: "border-box", overflow: hasLetters(node.content) || wordsOwn ? "visible" : "hidden", ...(ground ? { background: ground } : null), ...boxStyle(node, t, palette), ...(node.featureId === "box" && !livingLayered(node.art?.live) ? boxPicture(picture, node.art) : null), ...(stillCut(node) ? { clipPath: undefined } : null), ...(band?.middle ? { paddingTop: 0, paddingBottom: 0, display: "flex", flexDirection: "column" } : null), ...(boxWorn || svgArt ? { position: "relative" as const, isolation: "isolate" as const } : null), ...(svgArt ? { backgroundImage: undefined } : null), ...(typeof node.font?.variation === "string" && node.font.variation.trim() ? { fontVariationSettings: node.font.variation } : null) };
  const drawn = embedded ?? (
    <P
      id={node.featureId}
      label={node.label}
      /* The plain string, exactly as every part has always had it, and the
         runs beside it for the parts that draw a sentence. See
         `parts/spans.ts`: a plain string stays valid for ever. */
      content={plain(node.content)}
      spans={isSpans(node.content) ? spansOf(node.content) : undefined}
      options={node.options ?? {}}
      w={size?.w ?? node.w}
      h={size?.h ?? node.h}
      link={node.link ?? null}
      theme={inner}
      mode={mode}
      cube={node.cube}
      /* A box inside a box of its own: the outer one paints the picture, padding and all. */
      picture={boxed && node.featureId === "box" ? null : picture}
      media={media}
      world={(node as { world?: NodeWorld | null }).world ?? null}
      pick={pick ?? null}
      mesh={node.mesh}
      vector={node.vector}
      surface={surface}
      tour={(node as { tour?: PartTour | null }).tour ?? null}
      partView={partView}
      onNavigate={onNavigate}
      emit={emit}
      hooks={node.hooks ?? null}
    />
  );
  const part = (
    <>
    {drift ? <style data-part-drift={drift.name}>{drift.css}</style> : null}
    {/*
      Which of the two he is looking at, said quietly and only where he is
      building. A part that has both a picture and a drawn body shows the
      picture; without a word for it, the only way to know whose the thing
      on screen is would be to take the picture off and watch. Never on the
      live site: a visitor is not building anything.
    */}
    {mode === "board" && node.picture && hasBody(node.code) ? (
      <span
        data-shows="picture"
        aria-hidden
        style={{
          position: "absolute", left: 6, bottom: 6, zIndex: 3, pointerEvents: "none",
          padding: "1px 6px", borderRadius: 999, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
          background: "oklch(0.18 0.02 265 / 0.72)", color: "oklch(0.86 0.02 265)",
        }}
      >
        your picture
      </span>
    ) : null}
    {/*
      The box round the part, when the node says how it is laid out, padded,
      edged or set. A captured page is mostly boxes and these are what a box
      has. Only then: a node that says nothing gets the part alone, exactly
      as before, so nothing already on a board moves by a pixel.
    */}
    {boxed ? (
      // The box grows with what it holds, like the part inside it.
      // `height: 100%` here was the second clamp on a captured page, and the
      // one that actually hid the words, because a captured node is exactly
      // the node that has a box. It grows by being a flex child that may
      // not shrink, never by a percentage of its parent: `min-height: 100%`
      // inside a parent whose own height is its content is a cycle, and the
      // page never settles — `plain-box` could not even take a screenshot.
      // See `parts/primitives.tsx`.
      <StillCut node={node}>
      <div data-part-box="" key={mixesBackground(boxCss) ? "mixed" : "plain"} className={hasMotion(node) ? motionClass(motionId ?? node.id) ?? undefined : undefined} style={boxCss}>
        {/*
          A TEXTURE A BOXED PART WEARS, over the fill its box paints and under
          everything the part draws. A part brought in paints its fill on the
          box (its own colour, its gradient, its picture) and no part inside
          it reads `surfacePaint`, so a texture given to one from the Colours
          preview reached nothing (owner: "the textures also never came up").
          One layer behind the content (z-index -1 in the box's own stacking
          context) leaves the fill under it and the words over it.
        */}
        {/* The page's own texture worn by a part is the page's, seen through it: laid where the page is, so the bands never seam (`WornTexture.tsx`). */}
        {svgArt ? <SvgArt markup={svgArt} /> : null}
        {boxWorn ? <WornTexture id={worn!.id} page={lands(worn!, "page")} paint={textureCss([{ ...worn!, on: true }], palette!, "transparent")} /> : null}
        {drawn}
      </div>
      </StillCut>
    ) : drawn}
    {/* A crate put on this part plays over it, as its picture, wherever the part is drawn (crateLayer.tsx). */}
    <CrateOn nodeId={node.id} w={node.w} h={node.h} />
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
  /* A part given Push on press and a place to go is the link, whole, like a grid (J, 2026-10-10). */
  const whole = mode === "live" && (def.linkWhole || (!def.linkable && pushedOnPress(node.work))) && node.link && onNavigate ? node.link : null;
  const linked = whole ? (
    <div
      data-link-whole={whole.kind}
      role="link"
      tabIndex={0}
      aria-label={`Go to ${whole.target}`}
      /* The whole box, not only as tall as the cards: the live page gives a
         part a minimum height in a flex box, where a percentage height
         resolves to its content and a press under the last card went
         nowhere (`tests/links-go.mjs`). Stretched and grown, it fills. */
      style={{ width: "100%", height: "100%", flex: "1 1 auto", alignSelf: "stretch", display: "flex", flexDirection: "column", cursor: "pointer" }}
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
  /*
   * Grown and stretched, never only `height: 100%`: on the board a part has
   * a minimum height in a flex column, where a percentage height resolves
   * to the content. A circle with no words (PST's duel circles) was as tall
   * as its edge, a flat line, everywhere (J, 2026-10-06;
   * `tests/shape-fills.mjs`).
   */
  return (
    <div
      data-shape={node.shape}
      style={{
        width: "100%", height: "100%", flex: "1 1 auto", alignSelf: "stretch", display: "flex", flexDirection: "column", overflow: "hidden",
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
      style={{ width: "100%", height: "100%", flex: "1 1 auto", alignSelf: "stretch", display: "flex", flexDirection: "column", overflow: "hidden", clipPath: `url(#${id})`, WebkitClipPath: `url(#${id})` } as React.CSSProperties}
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
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>{plain(node.content) || node.prompt || node.featureId}</span>
    </div>
  );
}
