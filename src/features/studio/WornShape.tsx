"use client";
/**
 * A drawn shape wearing a style kit, drawn as one SVG.
 *
 * A part cut to a drawn line with `clip-path` loses everything outside the
 * line, and a kit's shadow is outside it. So a worn shape is not cut: it is
 * drawn, layer over layer, in the part's own pixels (`wornShape.ts` says why
 * each layer is where it is):
 *
 *   1. the kit's shadows, each the outline moved by its offset, spread by a
 *      stroke of its own colour and softened by a blur when the page's was;
 *   2. the outline filled (flat, or the kit's gradient);
 *   3. a picture, whenever one has been put in it, clipped to the outline
 *      (any drawn shape is a mask: the kit's border and shadow stay round it);
 *   4. the lighting bar and the shade, each the outline less itself moved,
 *      clipped inside the outline, so the light follows the edge;
 *   5. the rim, and the border, traced on the outline, inside it;
 *   6. the words, in the kit's type, in the middle of the shape's area.
 *
 * A shape joined from two, or with one cut out of it, is several closed
 * rings filled even-odd, so a hole is a hole and every layer above follows
 * its edge. "Words along a path" draws only the words, laid along the line
 * (or the outline), lettered in the kit's fill and outlined in its border.
 *
 * Its motion and its answer to the hand are a stylesheet in its own markup
 * (`wornCss`), so the published page carries them with nothing of the
 * Builder's. The board draws it still, as it draws every part; the Preview
 * and the published page play it.
 */
import * as React from "react";
import type { StudioNode } from "./board/store";
import type { NodeLink, PartMode } from "./parts/types";
import { plain } from "./parts/spans";
import { bandOffset, centreOf, fillOf, glossFrame, pathInk, pathWordsSize, wordsColour, wordsGuide, wornCss, wornPath, type Worn } from "./wornShape";
import type { KitBand, KitFill } from "./styleKits";

const safeId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);

function Gradient({ id, fill }: { id: string; fill: KitFill }) {
  const stops = fill.stops ?? [];
  const at = (i: number) => stops[i]?.at ?? (stops.length > 1 ? i / (stops.length - 1) : 0);
  const children = stops.map((s, i) => <stop key={i} offset={at(i)} stopColor={s.colour} />);
  if (fill.kind === "radial") {
    const [cx, cy] = fill.at ?? [0.5, 0.5];
    return <radialGradient id={id} cx={cx} cy={cy} r={0.75} fx={cx} fy={cy}>{children}</radialGradient>;
  }
  const a = ((fill.angle ?? 180) * Math.PI) / 180;
  const sx = Math.sin(a) / 2, sy = -Math.cos(a) / 2;
  return <linearGradient id={id} x1={0.5 - sx} y1={0.5 - sy} x2={0.5 + sx} y2={0.5 + sy}>{children}</linearGradient>;
}

/** A band of light or shade, as an inset shadow paints one: the outline, less itself moved, inside it. */
function Band({ id, d, band, off, w, h, clip, kind }: { id: string; d: string; band: KitBand; off: [number, number]; w: number; h: number; clip: string; kind: "bar" | "shade" }) {
  const pad = Math.max(w, h);
  return (
    <g data-worn-band={kind} data-offset={`${off[0]},${off[1]}`} data-opacity={band.opacity} clipPath={`url(#${clip})`}>
      <mask id={id} maskUnits="userSpaceOnUse" x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2}>
        <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} fill="white" />
        <path d={d} fillRule="evenodd" transform={`translate(${off[0]} ${off[1]})`} fill="black" {...(band.blur > 0 ? { filter: `url(#${id}-soft)` } : {})} />
        {band.blur > 0 ? <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={band.blur / 2} /></filter> : null}
      </mask>
      <rect x={0} y={0} width={w} height={h} fill={band.colour} fillOpacity={band.opacity} mask={`url(#${id})`} />
    </g>
  );
}

/**
 * A strip of light laid inside the outline (a page's `::before` gloss): a
 * rectangle in the frame of the shape's long axis, cut to the outline pulled
 * in by `ends`, so it follows the edge and never touches it.
 */
function Gloss({ id, d, band, px, w, h, clip }: { id: string; d: string; band: KitBand; px: [number, number][]; w: number; h: number; clip: string }) {
  const g = glossFrame(band, px);
  const pad = Math.max(w, h);
  return (
    <g data-worn-band="bar" data-gloss="" data-normal={`${g.n[0].toFixed(2)},${g.n[1].toFixed(2)}`} data-opacity={band.opacity} clipPath={`url(#${clip})`}>
      <mask id={id} maskUnits="userSpaceOnUse" x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2}>
        <path d={d} fillRule="evenodd" fill="white" stroke="black" strokeWidth={g.ends * 2} strokeLinejoin="round" />
      </mask>
      <g mask={`url(#${id})`}>
        <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={g.rx} fill={band.colour} fillOpacity={band.opacity} transform={`matrix(${g.u[0]} ${g.u[1]} ${g.n[0]} ${g.n[1]} 0 0)`} />
      </g>
    </g>
  );
}

export function WornShape({ node, mode, size, picture, onNavigate }: { node: StudioNode; mode: PartMode; size?: { w: number; h: number }; picture?: string; onNavigate?: (link: NodeLink) => void }) {
  const worn = node.worn as Worn;
  const w = Math.max(1, size?.w ?? node.w), h = Math.max(1, size?.h ?? node.h);
  const id = safeId(node.id);
  const d = React.useMemo(() => wornPath(worn, w, h), [worn, w, h]);
  const px = React.useMemo(() => worn.pts.map(([x, y]) => [x * w, y * h] as [number, number]), [worn.pts, w, h]);
  const css = React.useMemo(() => wornCss(id, worn, w, h, { still: mode === "board" }), [id, worn, w, h, mode]);
  const kit = worn.kit;
  const fill = fillOf(worn);
  const words = plain(node.content).trim();
  const ink = wordsColour(worn);
  const [cx, cy] = centreOf(worn.pts);
  const clip = `wk-${id}-clip`;
  const bar = worn.bar;
  const barOff = bar && bar.kind !== "gloss" ? bandOffset(bar, kit.size, px) : null;
  const shade = kit.shade;
  const shadeOff = shade ? bandOffset(shade, kit.size, px) : null;
  const t = kit.text;
  const fontPx = Math.max(10, Math.min(t?.px ?? 18, h * 0.42, (w * 1.6) / Math.max(4, words.length)));
  const pressable = worn.what === "button";
  const link = pressable && mode === "live" && node.link && onNavigate ? node.link : null;
  const shadows = [...kit.shadows].reverse();

  if (worn.what === "path") return <PathWordsShape worn={worn} w={w} h={h} id={id} css={css} words={words} />;

  return (
    <div
      data-worn={kit.id}
      data-worn-kit={kit.name}
      data-worn-snap={worn.snap ?? "none"}
      data-worn-what={worn.what ?? "none"}
      className={`wk-${id}`}
      role={pressable ? "button" : undefined}
      tabIndex={pressable && mode === "live" ? 0 : undefined}
      onClick={link ? (e) => { e.stopPropagation(); onNavigate?.(link); } : undefined}
      style={{ position: "relative", width: w, height: h, cursor: pressable && mode === "live" ? "pointer" : undefined, flex: "0 0 auto" }}
    >
      {css ? <style data-worn-css="">{css}</style> : null}
      <div className="wk-move" style={{ position: "absolute", inset: 0 }}>
        <div className="wk-lift" style={{ position: "absolute", inset: 0 }}>
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", display: "block" }} aria-hidden={!pressable || undefined}>
            <defs>
              <clipPath id={clip}><path d={d} clipRule="evenodd" /></clipPath>
              {fill.kind === "linear" || fill.kind === "radial" ? <Gradient id={`wk-${id}-fill`} fill={fill} /> : null}
              {shadows.map((s, i) => (s.blur > 0 ? <filter key={i} id={`wk-${id}-blur${i}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={s.blur / 2} /></filter> : null))}
            </defs>
            <g className="wk-shadow" data-worn-shadow={shadows.length}>
              {shadows.map((s, i) => (
                <path
                  key={i}
                  data-worn-shadow-at={`${s.dx},${s.dy}`}
                  d={d}
                  fillRule="evenodd"
                  transform={`translate(${s.dx} ${s.dy})`}
                  fill={s.colour}
                  stroke={s.spread > 0 ? s.colour : "none"}
                  strokeWidth={s.spread > 0 ? s.spread * 2 : undefined}
                  strokeLinejoin="round"
                  filter={s.blur > 0 ? `url(#wk-${id}-blur${i})` : undefined}
                />
              ))}
            </g>
            <path data-worn-body="" d={d} fillRule="evenodd" fill={fill.kind === "none" ? "none" : fill.kind === "solid" ? fill.colour : `url(#wk-${id}-fill)`} />
            {picture ? (
              <image data-worn-picture="" href={picture} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
            ) : null}
            {bar?.kind === "gloss" ? <Gloss id={`wk-${id}-bar`} d={d} band={bar} px={px} w={w} h={h} clip={clip} /> : null}
            {bar && barOff ? <Band id={`wk-${id}-bar`} d={d} band={bar} off={barOff} w={w} h={h} clip={clip} kind="bar" /> : null}
            {shade && shadeOff ? <Band id={`wk-${id}-shade`} d={d} band={shade} off={shadeOff} w={w} h={h} clip={clip} kind="shade" /> : null}
            {kit.rim ? <path d={d} fill="none" stroke={kit.rim.colour} strokeOpacity={kit.rim.opacity} strokeWidth={kit.rim.width * 2} clipPath={`url(#${clip})`} /> : null}
            {kit.border ? (
              <path
                data-worn-border=""
                d={d}
                fill="none"
                stroke={kit.border.colour}
                strokeWidth={kit.border.width * 2}
                strokeLinejoin="round"
                strokeDasharray={kit.border.style === "dashed" ? `${kit.border.width * 3} ${kit.border.width * 2}` : kit.border.style === "dotted" ? `0 ${kit.border.width * 2}` : undefined}
                strokeLinecap={kit.border.style === "dotted" ? "round" : undefined}
                clipPath={`url(#${clip})`}
              />
            ) : null}
          </svg>
          {words ? (
            <div
              data-worn-words=""
              style={{
                position: "absolute", left: `${cx * 100}%`, top: `${cy * 100}%`, transform: "translate(-50%, -50%)",
                maxWidth: w * 0.8, textAlign: "center", lineHeight: 1.1, pointerEvents: "none", whiteSpace: "pre-wrap",
                color: ink.colour, fontFamily: t?.stack ?? (t?.face ? `"${t.face}", sans-serif` : undefined), fontWeight: t?.weight,
                fontSize: fontPx, textTransform: (t?.transform as React.CSSProperties["textTransform"]) ?? undefined,
                ...(t?.stroke ? { WebkitTextStroke: `${t.stroke.w}px ${t.stroke.colour}`, paintOrder: "stroke fill" } : null),
                ...(t?.shadow ? { textShadow: t.shadow } : null),
              } as React.CSSProperties}
            >
              {words}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Words along a path: the words laid on the drawn line (or round the
 * outline), lettered in the kit's fill with its border round each letter
 * and its first shadow under them, so they wear the kit the shape did. The
 * line itself is not drawn; it is where the words go.
 */
function PathWordsShape({ worn, w, h, id, css, words }: { worn: Worn; w: number; h: number; id: string; css: string; words: string }) {
  const guide = React.useMemo(() => wordsGuide(worn, w, h), [worn, w, h]);
  const kit = worn.kit;
  const ink = pathInk(worn);
  const size = pathWordsSize(worn, w, h, words);
  const pw = worn.pathWords;
  const s0 = kit.shadows[0];
  const font = pw?.font ?? kit.text?.stack ?? (kit.text?.face ? `"${kit.text.face}", sans-serif` : "sans-serif");
  const guideId = `wk-${id}-line`;
  return (
    <div
      data-worn={kit.id}
      data-worn-kit={kit.name}
      data-worn-snap={worn.snap ?? "none"}
      data-worn-what="path"
      data-worn-path-words={words}
      className={`wk-${id}`}
      style={{ position: "relative", width: w, height: h, flex: "0 0 auto" }}
    >
      {css ? <style data-worn-css="">{css}</style> : null}
      <div className="wk-move" style={{ position: "absolute", inset: 0 }}>
        <div className="wk-lift" style={{ position: "absolute", inset: 0 }}>
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", display: "block" }} role="img" aria-label={words || undefined}>
            <defs>
              <path id={guideId} d={guide} fill="none" />
              {ink.fill.kind === "linear" || ink.fill.kind === "radial" ? <Gradient id={`wk-${id}-fill`} fill={ink.fill} /> : null}
              {s0 ? <filter id={`wk-${id}-drop`} x="-20%" y="-50%" width="140%" height="200%"><feDropShadow dx={s0.dx} dy={s0.dy} stdDeviation={s0.blur / 2} floodColor={s0.colour} floodOpacity={1} /></filter> : null}
            </defs>
            <text
              data-worn-text-path=""
              fontFamily={font}
              fontSize={size}
              fontWeight={kit.text?.weight}
              fill={ink.fill.kind === "solid" ? ink.fill.colour : `url(#wk-${id}-fill)`}
              stroke={ink.stroke?.colour}
              strokeWidth={ink.stroke ? ink.stroke.width : undefined}
              strokeLinejoin="round"
              paintOrder="stroke fill"
              filter={s0 ? `url(#wk-${id}-drop)` : undefined}
              style={{ textTransform: (kit.text?.transform as React.CSSProperties["textTransform"]) ?? undefined }}
              dominantBaseline="middle"
            >
              <textPath href={`#${guideId}`} startOffset={`${pw?.start ?? 0}%`}>{words || " "}</textPath>
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
