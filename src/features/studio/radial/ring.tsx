"use client";
import * as React from "react";
import { Wand2 } from "lucide-react";
import { useStudio, type StudioNode } from "../board/store";
import { PREVIEW } from "../colourMenu";
import {
EDGE, joinFor, ROUND, SWELL,
type Pt, type Shape
} from "../menuGeometry";
import { AnimQuads, AuraQuads, BehaviourQuads, EdgeQuads, FontQuads, HueQuads, TextureQuads } from "../RingEditors";
import { tallyColours } from "../look";
import { PlateEditor } from "../PlateEditors";
import { SayPlate } from "../SayBox";
import { type Slab } from "../RingConsole";
import { overrideTheme, resolvePalette, themeFrom } from "../shelf/run";
import { auraStyle, lands, parseColor, textureCss, type Palette, type RoleId, type TextureLayer } from "../look";
import { PULL_LOCK, Pull, GREEN, CRIMSON, ANIM_SLAB, motionOptions } from "./choices";
import { applyToSelection } from "./selectionEdit";

/**
 * The line of the gesture, drawn *under* the wheel so it runs beneath the
 * pieces rather than across their faces.
 *
 * The handle runs to your hand, red on the red side of the middle and green
 * on the green, fading up as it lengthens. Reaching either end takes it away.
 */
export function PullLine({ pull }: { pull: Pull }) {
  const ax = pull.axis;
  if (!ax || pull.stage !== "pull") return null;
  const red: Pt = [ax[0] * PULL_LOCK, ax[1] * PULL_LOCK];
  const green: Pt = [-ax[0] * PULL_LOCK, -ax[1] * PULL_LOCK];
  const toGreen = pull.dx * ax[0] + pull.dy * ax[1] < 0;
  const hue = toGreen ? GREEN : CRIMSON;
  return (
    // Drawn from the hand's press, which near an edge is not the menu's middle.
    <svg width={1} height={1} className="pointer-events-none absolute overflow-visible" style={{ left: pull.ox, top: pull.oy }}>
      {/* the track, end to end */}
      <line
        x1={red[0]} y1={red[1]} x2={green[0]} y2={green[1]}
        stroke="oklch(0.72 0.02 260)"
        strokeOpacity={0.3}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="3 7"
      />
      <line
        data-pull-line=""
        x1={0} y1={0} x2={pull.dx} y2={pull.dy}
        stroke={`oklch(0.74 0.2 ${hue})`}
        strokeOpacity={Math.max(0.08, pull.grip)}
        strokeWidth={3 + pull.grip}
        strokeLinecap="round"
        strokeDasharray={pull.grip >= 1 ? undefined : "7 6"}
      />
      <circle cx={pull.dx} cy={pull.dy} r={4 + pull.grip * 3} fill={`oklch(0.8 0.2 ${hue})`} fillOpacity={Math.max(0.2, pull.grip)} />
    </svg>
  );
}

/**
 * The two ends of the line, drawn *over* the wheel: the line can run under a
 * piece, but the ring you are reaching for cannot, or you would be reaching
 * for something you cannot see. The red ring is at the end you pulled toward
 * and the green ring at the other. The green one stays while you turn, so you
 * can see what you are turning about; the red one goes with the line.
 */
export function PullEnds({ pull }: { pull: Pull }) {
  const ax = pull.axis;
  if (!ax || pull.stage === "moving") return null;
  const turning = pull.stage === "turning";
  const red: Pt = [ax[0] * PULL_LOCK, ax[1] * PULL_LOCK];
  const green: Pt = [-ax[0] * PULL_LOCK, -ax[1] * PULL_LOCK];
  return (
    <svg width={1} height={1} className="pointer-events-none absolute overflow-visible" style={{ left: pull.ox, top: pull.oy }}>
      {turning ? null : (
        <circle
          data-pull-move=""
          cx={red[0]} cy={red[1]} r={10}
          fill="none"
          stroke={`oklch(0.7 0.22 ${CRIMSON})`}
          strokeWidth={3}
          strokeDasharray="5 4"
        />
      )}
      <circle
        data-pull-target=""
        cx={green[0]} cy={green[1]} r={turning ? 8 : 10}
        fill={turning ? `oklch(0.78 0.2 ${GREEN})` : "none"}
        stroke={`oklch(0.78 0.2 ${GREEN})`}
        strokeWidth={3}
        strokeDasharray={turning ? undefined : "5 4"}
        style={{ filter: turning ? `drop-shadow(0 0 5px oklch(0.78 0.2 ${GREEN}))` : undefined }}
      >
        {turning ? null : <animate attributeName="r" values="10;13;10" dur="1.1s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Drawing the pieces                                                  */
/* ------------------------------------------------------------------ */

export interface RingPiece {
  id: string;
  label: string;
  icon: typeof Wand2;
  hue: number;
  d: string;
  at: Pt;
  on?: boolean;
  /** A band too narrow for a word: icon only, the word on the tooltip. */
  compact?: boolean;
  /** Something small that shows what the piece is *about*, instead of its icon. */
  preview?: React.ReactNode;
  /** A colour to glow in — the piece wears the aura it would set. */
  glow?: string | null;
  /**
   * What this piece is *wearing*: the look it would open, painted on it.
   *
   * `d` is the piece cut a shade larger than the face it is drawn on, so the
   * fill reaches almost the whole way out and leaves the piece's own colour as
   * a line round it. `ink` is the colour its icon and word are drawn in, picked
   * from the fill so they read on it whatever it is.
   */
  wear?: { d: string; css: React.CSSProperties; ink: string } | null;
  /** Nothing to do right now: drawn dimmer, still there. */
  dim?: boolean;
  onPick: () => void;
}

/** One flat colour, and a darker line round it. */
export const LIGHT_INK = "oklch(0.99 0 0)";
export const DARK_INK = "oklch(0.15 0.02 0)";

/**
 * Which ink reads on a given fill.
 *
 * Not `mix-blend-mode: difference`, and not a computed complement, though both
 * were on the table: each of them lands on the fill itself at mid grey — the
 * difference of 0.5 with 0.5 is 0, and the complement of a neutral is the same
 * neutral — so on exactly the fills where legibility is hardest they vanish.
 * Lightness decides instead, which cannot fail, and a shadow the other way up
 * carries the glyph over a texture that is light in one place and dark in the
 * next.
 */
export function inkOn(colour: string): string {
  const c = parseColor(colour);
  return !c || c.l > 0.62 ? DARK_INK : LIGHT_INK;
}

export const face = (hue: number, lit: boolean) => `oklch(${lit ? 0.74 : 0.66} ${lit ? 0.17 : 0.155} ${hue})`;
export const rim = (hue: number, lit: boolean) => `oklch(${lit ? 0.38 : 0.44} ${lit ? 0.16 : 0.14} ${hue})`;

/**
 * A slab of one colour with a darker line round it.
 *
 * The rounded corners are the stroke: the path is drawn inset by `ROUND` and
 * grown back with a round-joined stroke of its own colour. That is also what
 * makes the swell work — a hovered piece just strokes wider, taking a couple
 * of pixels back out of the seam it was given.
 *
 * The word is a `foreignObject` inside the same rotated group as the slab,
 * turned back upright. It used to be positioned HTML with a transition on
 * `left`/`top`, which is why every word trailed its button round a turn — it
 * was chasing a number the slab had already reached. Now it *is* part of the
 * slab, and the only thing that eases is the hover nudge.
 */
export function Ring({ pieces, green, spin, shape }: { pieces: RingPiece[]; green?: boolean; spin: number; shape: Shape }) {
  const [hot, setHot] = React.useState<string | null>(null);
  const clipId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const nudge = (at: Pt, lit: boolean): Pt => {
    if (!lit) return [0, 0];
    const len = Math.max(1, Math.hypot(at[0], at[1]));
    return [(at[0] / len) * 1.5, (at[1] / len) * 1.5];
  };
  return (
    // The svg itself takes no presses: its one-pixel box sits exactly on the
    // middle of the wheel, and it was the one pixel the middle button could
    // not be pressed on.
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <g transform={`rotate(${(spin * 360).toFixed(2)})`}>
        {pieces.map((p) => {
          const lit = hot === p.id || p.on;
          /*
           * A piece wearing a look keeps its own colours under the hand.
           *
           * Every other piece answers a hover by going a brighter blue, which
           * is right for a blue button and wrong for this one: Looks *is* the
           * part's colour or texture, and a blue wash over it under the hand
           * says the button is blue after all. So the swell stays — the piece
           * still lifts toward the pointer, which is the feedback that matters
           * — and the paint underneath does not move.
           */
          const tint = p.wear ? false : lit;
          const faceW = 2 * (ROUND + (lit ? SWELL : 0));
          const n = nudge(p.at, !!lit);
          const Icon = p.icon;
          const wide = p.compact ? 30 : 96;
          return (
            <g
              key={p.id}
              style={{ transform: `translate(${n[0]}px, ${n[1]}px)`, transition: "transform 130ms ease-out", opacity: p.dim ? 0.45 : 1 }}
            >
              <path
                role="button"
                tabIndex={0}
                aria-label={p.label}
                aria-pressed={p.on}
                data-shard={p.id}
                d={p.d}
                onClick={p.onPick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onPick(); } }}
                onPointerEnter={() => setHot(p.id)}
                onPointerLeave={() => setHot((h) => (h === p.id ? null : h))}
                className="pointer-events-auto cursor-pointer outline-none"
                fill={rim(p.hue, !!tint)}
                stroke={rim(p.hue, !!tint)}
                strokeWidth={faceW + EDGE * 2}
                strokeLinejoin={joinFor(shape)}
                strokeMiterlimit={2}
                strokeLinecap={joinFor(shape) === "miter" ? "butt" : "round"}
                style={{
                  transition: "stroke-width 130ms ease-out, fill 130ms ease-out, stroke 130ms ease-out, filter 130ms ease-out",
                  // The Aura piece wears the aura it would set. A worn piece
                  // under the hand catches a little more light along its edge
                  // — a brighten, not a colour — since it has given up the
                  // tint every other piece uses to say it is hovered.
                  filter: p.glow ? `drop-shadow(0 0 7px ${p.glow}) drop-shadow(0 0 2px ${p.glow})` : undefined,
                }}
              />
              <path
                d={p.d}
                className="pointer-events-none"
                fill={face(p.hue, !!tint)}
                stroke={face(p.hue, !!tint)}
                strokeWidth={faceW}
                strokeLinejoin={joinFor(shape)}
                strokeMiterlimit={2}
                strokeLinecap={joinFor(shape) === "miter" ? "butt" : "round"}
                style={{
                  transition: "stroke-width 130ms ease-out, fill 130ms ease-out, stroke 130ms ease-out, filter 130ms ease-out",
                  // A worn piece has given up the tint every other piece uses
                  // to say it is under the hand, so its edge catches a little
                  // more light instead: the same colour, brighter, which is a
                  // rim brighten and not a colour swap. The face itself is
                  // covered by what the piece is wearing, so this shows only
                  // where the piece meets the board.
                  filter: p.wear && lit ? "brightness(1.18)" : undefined,
                }}
              />
              {p.wear ? (
                <>
                  <defs>
                    <clipPath id={`${clipId}-${p.id}`}>
                      <path d={p.wear.d} />
                    </clipPath>
                  </defs>
                  {/* The look itself, cut to the shape of the piece. A texture
                      is CSS, gradients, a tiled picture, and no SVG fill
                      takes CSS, so it is an HTML box clipped to the path. */}
                  <foreignObject
                    x={-260}
                    y={-260}
                    width={520}
                    height={520}
                    clipPath={`url(#${clipId}-${p.id})`}
                    className="pointer-events-none"
                  >
                    <div data-worn={p.id} style={{ width: "100%", height: "100%", ...p.wear.css }} />
                  </foreignObject>
                </>
              ) : null}
              <foreignObject x={p.at[0] - wide / 2} y={p.at[1] - 18} width={wide} height={36} className="pointer-events-none overflow-visible">
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[8.5px] font-semibold leading-tight tracking-tight"
                  title={p.label}
                  style={{
                    transform: `rotate(${(-spin * 360).toFixed(2)}deg)`,
                    transformOrigin: "center",
                    // On a piece wearing a look, the ink is picked from what it
                    // is wearing, and the shadow behind it is the other way up,
                    // so the word survives a busy texture as well as a flat
                    // colour.
                    color: p.wear ? p.wear.ink : "oklch(0.99 0 0)",
                    textShadow: p.wear
                      ? `0 1px 2px ${p.wear.ink === LIGHT_INK ? "oklch(0 0 0 / 0.75)" : "oklch(1 0 0 / 0.7)"}`
                      : `0 1px 2px oklch(0.25 0.08 ${p.hue} / 0.75)`,
                  }}
                >
                  {p.preview ?? <Icon className={p.compact ? "size-[17px]" : "size-[14px]"} strokeWidth={green ? 1.9 : 2.1} />}
                  {p.compact ? null : <span className="whitespace-nowrap">{p.label}</span>}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* What the Looks pieces show                                          */
/* ------------------------------------------------------------------ */

/**
 * The green Looks pieces show what they would change, not a symbol for it.
 *
 * Hue is a strip of the part's own six roles as it is painted right now;
 * Texture is the tile it is wearing (or a plain square when it follows the
 * site); Aura is left to the piece itself, which glows in the colour it has.
 * Small — they have to be — but a swatch the size of a fingernail says more
 * than a palette icon ever did.
 */
export function HueSwatch({ node, palette }: { node: StudioNode; palette: Palette }) {
  const t = overrideTheme(themeFrom(useStudio.getState().format), node.colour ?? {}, palette);
  const roles: RoleId[] = ["bg", "surface", "accent", "highlight", "text"];
  return (
    <span
      data-preview-badge=""
      className="flex overflow-hidden"
      style={{ height: PREVIEW.size, width: PREVIEW.wide, borderRadius: PREVIEW.radius, outline: "1px solid oklch(0 0 0 / 0.45)" }}
    >
      {roles.map((r) => <span key={r} className="flex-1" style={{ background: t[r] }} />)}
    </span>
  );
}

/**
 * A hatch, for a tile with no texture on it yet.
 *
 * A flat square of the surface colour is what the tile used to show when a part
 * follows the site and the site has no texture — which is a swatch of nothing,
 * on a button whose whole job is to say what texture this is. A fine diagonal
 * hatch says "texture, none set" in the space a fingernail has, and it cannot
 * be mistaken for a colour.
 */
export const HATCH: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(45deg, oklch(1 0 0 / 0.22) 0 1px, transparent 1px 4px)",
  backgroundSize: "6px 6px",
};

/**
 * What a Texture tile wears: the tile itself, over the whole face.
 *
 * Following the site means wearing what the site puts on its surfaces, and
 * wearing nothing at all means the hatch — a swatch of the surface colour is a
 * swatch of nothing on a button whose whole job is to say what texture this is.
 */
export function textureWear(d: string, node: StudioNode, palette: Palette, layers: TextureLayer[]): RingPiece["wear"] {
  const own = node.texture && node.texture !== "none" ? layers.find((l) => l.id === node.texture) : null;
  const site = !node.texture ? layers.filter((l) => l.on && lands(l, "surfaces")) : [];
  const tile = own ? [{ ...own, on: true }] : site;
  const base = node.texture === "none" ? "oklch(0.3 0.03 148)" : palette.surface;
  return {
    d,
    css: tile.length
      ? { ...textureCss(tile, palette, base), backgroundSize: "22px 22px" }
      : { background: base, ...HATCH },
    ink: inkOn(base),
  };
}

/** The aura this part is wearing, on a block wearing it the way the part does. */
export function AuraSwatch({ node, palette }: { node: StudioNode; palette: Palette }) {
  const worn = auraStyle(node.aura, palette, node.auraSize, node.auraStyle);
  return (
    <span
      data-aura-swatch=""
      data-preview-badge=""
      className="block"
      style={{ width: PREVIEW.size, height: PREVIEW.size, borderRadius: PREVIEW.radius, background: palette.surface, outline: `1px solid ${worn ? "transparent" : "oklch(1 0 0 / 0.45)"}`, ...((worn ?? {}) as React.CSSProperties) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* The one editor a green choice asked for                             */
/* ------------------------------------------------------------------ */

/* An edit on the wheel is an edit to the selection (`selectionEdit.ts`). */
export { MERGED, applyToSelection } from "./selectionEdit";

export function Editor({ which, node, slabs, onMore }: { which: string; node: StudioNode; slabs: Slab[]; onMore: () => void }) {
  const format = useStudio((st) => st.format);
  const look = useStudio((st) => st.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const update = (patch: Partial<StudioNode>) => applyToSelection(node, patch);
  const siteColours = React.useMemo(() => {
    if (which !== "edge") return [];
    const t = tallyColours(useStudio.getState().nodes, palette);
    return [...new Set([...t.byUse.border, ...t.byUse.shadow, ...t.all].map((c) => c.value))];
  }, [which, palette]);

  // The three that are about looks are drawn on the slabs themselves.
  if (which === "edge") {
    return <EdgeQuads slabs={slabs} edge={node.edge ?? null} palette={palette} siteColours={siteColours} onChange={(edge) => update({ edge })} />;
  }
  if (which === "hue") {
    return <HueQuads slabs={slabs} colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />;
  }
  if (which === "texture") {
    return (
      <TextureQuads
        slabs={slabs}
        value={node.texture}
        layers={look.texture ?? []}
        palette={palette}
        onChange={(texture) => update({ texture })}
      />
    );
  }
  if (which === "aura") {
    return <AuraQuads slabs={slabs} node={node} palette={palette} onChange={(patch) => update(patch)} />;
  }
  // The three animation choices open the same three slabs, with the chosen
  // one lit: how it comes in, how fast, and the rest.
  if (which in ANIM_SLAB) {
    return <AnimQuads slabs={slabs} node={node} focus={which as keyof typeof ANIM_SLAB} onChange={(patch) => update(patch)} />;
  }
  // The part's own motion options, one per slab.
  if (which === "behaviour") {
    return (
      <BehaviourQuads
        slabs={slabs}
        options={motionOptions(node)}
        values={node.options}
        onChange={(id, value) => update({ options: { ...node.options, [id]: value } })}
      />
    );
  }
  // Its type: the sliders together on two slabs, the families on the third.
  if (which === "font") {
    return <FontQuads slabs={slabs} font={node.font} onChange={(font) => update({ font })} />;
  }
  // Everything else is words and lists, and there is no honest way to bend a
  // text field round a curve. They go on a plate, in the slab opposite the
  // green — cut square for it whatever the wheel's shape is.
  const plate = slabs.find((s) => Math.abs(((s.from % 1) + 1) % 1 - 0.25) < 0.001) ?? slabs[0]!;
  if (which === "say") return <SayPlate node={node} plate={plate} onMore={onMore} />;
  return <PlateEditor which={which} node={node} plate={plate} spare={slabs.filter((s) => s !== plate)} />;
}