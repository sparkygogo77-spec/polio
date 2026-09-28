"use client";
/**
 * The editor, as three more quadrants.
 *
 * Pick a green choice and the three quadrants the green level is not using
 * become the editor — each one a slab like Delete, cut with the same `piece()`
 * as the rest of the wheel, a shade smaller so the aura round each has a gap
 * to be seen in. Not a ring outside the wheel, not a box beside it: more of
 * the same object, filled in. The green stays up, so you can see which choice
 * you are inside and step sideways; the way back is the button in the middle.
 *
 * What goes on a slab is built from `RingConsole.tsx`: chips along an arc or
 * packed into the square, a slider bent round the band, a sector cut out as a
 * button, a caption engraved along the inner curve. All of it sits in the
 * same rotated group as the slab, so it turns with the wheel and never trails.
 *
 * A few choices are text, and there is no honest way to bend a text field
 * round a curve. Those get `PlateQuad`: a flat plate inscribed in the first
 * slab, wearing the slab's own colour. The one rectangle, and it is inside a
 * quadrant.
 */
import * as React from "react";
import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ban, Blend, Check, CircleDot, Expand, FlipVertical2, Focus, ImagePlus, MoveRight, Play, Shuffle, Sparkles, Spline, Zap } from "lucide-react";
import { play } from "@/core/audio/engine";
import { readPicture, refusal } from "./ImageIntake";
import {
  ANIM_EASE, auraColour, auraStyle, AURA_STYLES, css as oklchCss, DELAY_MS, delayMs, ENTRANCE_MS, entranceCss, newLayer, parseColor, sliderFromSpeed, speedFromSlider, speedK, speedWord, textureCss,
  reiterate, TEXTURE_KINDS, ROLES, ROLE_LABEL,
  type AnimEase, type AuraStyle, type Palette, type RoleId, type TextureLayer,
} from "./look";
import { useStudio, type StudioNode } from "./store";
import { FAMILY, type NodeFont } from "./parts/theme";
import type { FeatureOption } from "./catalog";
import { joinFor, middleOf, onCircle, piece, slabFar, slabRadius, SLAB_PAD, type Rings, type Shape } from "./menuGeometry";
import {
  ArcChips, ArcSlider, ArcStepper, Caption, CONSOLE, GridChips, Glued, keyOf, ScreenFace, SCREEN_KEY, RUN_END, SectorButton, SHRINK, SLAB_AURA, slabMiddle, spotOn, straightBands,
  type ArcItem, type Slab, type StepItem,
} from "./RingConsole";
import { emptyChip, inheritChip } from "./colourMenu";

/** The quadrants the console has been given, clockwise from the green. */
export interface ConsoleSpan {
  quads: [number, number][];
  rings: Rings;
  shape: Shape;
  spin: number;
  /** A shape per quadrant, when one of them has to differ (the plate's is always square). */
  shapes?: Shape[];
  /** The one slab to draw a shade brighter: the one the green choice is about. */
  lit?: number;
}

/* ------------------------------------------------------------------ */
/* The shell                                                           */
/* ------------------------------------------------------------------ */

/**
 * The slabs, and whatever the editor puts on them.
 *
 * One SVG, one rotated group. The slabs are drawn the way the wheel's own
 * pieces are — a wide round-joined stroke in the rim colour under a narrower
 * one in the face colour, which is what curves the corners — and the bare
 * slab is the handle the whole menu is shoved aside by.
 */
export function QuadrantConsole({
  span, onGrip, children,
}: {
  span: ConsoleSpan;
  onGrip?: (e: React.PointerEvent) => void;
  children: (slabs: Slab[]) => React.ReactNode;
}) {
  const { quads, rings, shape, spin, shapes, lit } = span;
  const slabs: Slab[] = quads.map(([from, to], i) => ({ from, to, rings, shape: shapes?.[i] ?? shape, spin }));
  return (
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <g transform={`rotate(${(spin * 360).toFixed(2)})`}>
        {slabs.map((s, i) => {
          const d = piece(s.from, s.to, rings.hole, "edge", s.shape, rings, SHRINK);
          const face = lit === i ? CONSOLE.faceLit : CONSOLE.face;
          return (
            <g key={i} data-console-slab={i}>
              <path
                d={d}
                onPointerDown={onGrip}
                className="pointer-events-auto cursor-grab active:cursor-grabbing"
                fill={CONSOLE.rim}
                stroke={CONSOLE.rim}
                strokeWidth={2 * 5 + 2.5}
                strokeLinejoin={joinFor(s.shape)}
                strokeMiterlimit={2}
                strokeLinecap={s.shape === "square" ? "butt" : "round"}
                style={{ filter: SLAB_AURA }}
              />
              <path
                d={d}
                className="pointer-events-none"
                fill={face}
                stroke={face}
                strokeWidth={2 * 5}
                strokeLinejoin={joinFor(s.shape)}
                strokeMiterlimit={2}
                strokeLinecap={s.shape === "square" ? "butt" : "round"}
                style={{ transition: "fill 160ms ease-out, stroke 160ms ease-out" }}
              />
            </g>
          );
        })}
        {children(slabs)}
      </g>
    </svg>
  );
}

/**
 * Where a slab's main row of chips goes. Far enough out that a second row,
 * one chip further in, still clears the caption engraved by the hole; near
 * enough in that the chips at the ends of the row stay inside the slab.
 */
export const chipsAt = (s: Slab) =>
  s.shape === "square"
    // Square: the middle of the box. The radius that reads as "well out along
    // the band" on a ring is most of the way to the far edge of a box, which
    // put every grid of chips down at the bottom of its panel.
    ? slabRadius((SLAB_PAD + slabFar(s.rings)) / 2, s.rings)
    : s.rings.mid + (s.rings.reach - s.rings.mid) * 0.56;
/** The middle of a whole quadrant, for a button that is the whole quadrant. */
/**
 * The middle of a piece, for the word that names it.
 *
 * A whole square quadrant has a middle of its own — the middle of the box —
 * and halfway along the diagonal is not it: the diagonal runs out to a corner,
 * so it lands the word a good way past centre, toward the one part of the slab
 * that is furthest from everything else on it.
 */
export const centreOf = (s: Slab, rIn: number, rOut: number | "edge") =>
  s.shape === "square" && rOut === "edge" && rIn <= s.rings.hole
    ? slabMiddle(s)
    : middleOf(s.from, s.to, rIn, rOut, s.shape, s.rings, 0.5);
/**
 * The slabs a slider is handed, as they are: the slider pulls its own ends in
 * by a number of pixels now, which is the only way an end lands the same
 * distance from the slab's seam at the inner radius and the outer one. Adding
 * an angle here on top of that just made the run short and left the gap a
 * different width at each end of it.
 */
export const runOf = (s: Slab) => ({ from: s.from, to: s.to });

/**
 * A slab cut into `n` runs, one above another.
 *
 * Square, they are straight bands across the box; round, arcs on the slab's
 * own rings. Either way each one is the full width of the slab, because the
 * longer a run is the finer a hand can be with it, and a setting that is one
 * number deserves the whole width rather than half of it.
 */
export function stackedRuns(slab: Slab, n: number, gap = 8): { rIn: number; rOut: number }[] {
  if (slab.shape === "square") return straightBands(slab.rings, n, gap, slab.from);
  // Round, the runs start well clear of the caption engraved along the inner
  // arc — which sits further out on the lower half of the wheel, where the
  // letters hang from the line instead of standing on it.
  const lo = slab.rings.hole + 30;
  const hi = slab.rings.reach - 9;
  const h = (hi - lo - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ rIn: lo + i * (h + gap), rOut: lo + i * (h + gap) + h }));
}

/** A whole quadrant, cut as the console cuts its slabs. */
export const wholeOf = (s: Slab) => piece(s.from, s.to, s.rings.hole, "edge", s.shape, s.rings, SHRINK);

/* ------------------------------------------------------------------ */
/* The spectrum, on one slab                                           */
/* ------------------------------------------------------------------ */

/** Below this a colour is a grey wearing a hue, which is what read as broken. */
const LIVE = 0.14;

/**
 * The whole of a colour, off three runs on one slab. The Hue editor and the
 * Aura editor draw the same one, so a hand that has learned it once has
 * learned it twice.
 *
 * Round, they are arcs: hue on the inner band, lightness and strength sharing
 * the outer one, half a quadrant each. Square, they are three straight bands
 * stacked up the box, and each one runs the *full* width — which is the point
 * of the square. Sharing a band side by side would have halved lightness and
 * strength for no reason, and colour is the one thing on the wheel where the
 * length of the run is the amount of control you have.
 */
export function SpectrumSlab({
  slab, colour, onChange, onCommit, caption,
}: {
  slab: Slab;
  colour: { l: number; c: number; h: number };
  onChange: (next: string) => void;
  onCommit?: () => void;
  caption?: React.ReactNode;
}) {
  const { hole, mid, reach } = slab.rings;
  const c = colour;
  // The runs are handed the slab's own turns and pull their ends in by a
  // number of pixels, so both of them land the same distance from the slab's
  // seam at every radius. A fixed angle instead — which is what was here —
  // is a wedge: right at one radius, over the edge at a smaller one, short of
  // it at a larger one.
  const sFrom = slab.from;
  const sTo = slab.to;
  const half = (sFrom + sTo) / 2;
  /** Where two runs meet halfway along a band, they leave less room than an edge does. */
  const JOIN = 5;
  const square = slab.shape === "square";
  const bands = square ? straightBands(slab.rings, 3, 8, slab.from) : null;
  /** The band a run rides: one of the three straight ones, or the arc it was written for. */
  const on = (i: number, rIn: number, rOut: number) => bands?.[i] ?? { rIn, rOut };
  /** How far it runs: the whole width of the box, or the stretch of arc it was given. */
  const run = (from: number, to: number) => (square ? { from: sFrom, to: sTo } : { from, to });
  return (
    <>
      <ArcSlider
        slab={slab}
        {...run(sFrom, sTo)}
        {...on(0, hole + 24, mid - 2)}
        label="Hue"
        value={(((c.h % 360) + 360) % 360) / 360}
        colourAt={(f) => oklchCss({ l: 0.7, c: 0.19, h: f * 360 })}
        onChange={(f) => onChange(oklchCss({ ...c, c: Math.max(c.c, LIVE), h: f * 360 }))}
        onCommit={onCommit}
      />
      <ArcSlider
        slab={slab}
        {...run(sFrom, half)}
        {...on(1, mid + 6, reach - 9)}
        ends={[RUN_END, JOIN]}
        label="Lightness"
        value={(c.l - 0.08) / 0.9}
        colourAt={(f) => oklchCss({ ...c, l: 0.08 + f * 0.9 })}
        onChange={(f) => onChange(oklchCss({ ...c, l: 0.08 + f * 0.9 }))}
        onCommit={onCommit}
      />
      <ArcSlider
        slab={slab}
        {...run(half, sTo)}
        {...on(2, mid + 6, reach - 9)}
        ends={[JOIN, RUN_END]}
        label="Strength"
        value={Math.min(1, c.c / 0.32)}
        colourAt={(f) => oklchCss({ ...c, c: f * 0.32 })}
        onChange={(f) => onChange(oklchCss({ ...c, c: f * 0.32 }))}
        onCommit={onCommit}
      />
      {caption ? <Caption slab={slab}>{caption}</Caption> : null}
    </>
  );
}

const isRole = (v: string) => (ROLES as readonly string[]).includes(v);

/* ------------------------------------------------------------------ */
/* Hue                                                                 */
/* ------------------------------------------------------------------ */

export function HueQuads({
  slabs, colour, palette, onChange,
}: {
  slabs: Slab[];
  colour: Record<string, string> | null;
  palette: Palette;
  onChange: (next: Record<string, string> | null) => void;
}) {
  const [role, setRole] = React.useState<RoleId>("bg");
  const current = colour?.[role] ?? "";
  const named = current && isRole(current);
  const set = (value: string | null) => {
    const next: Record<string, string> = { ...(colour ?? {}) };
    if (value === null) delete next[role];
    else next[role] = value;
    onChange(Object.values(next).some(Boolean) ? next : null);
  };
  const shown = current && !named ? current : palette[role];
  const c = parseColor(shown) ?? { l: 0.7, c: 0.18, h: 265 };

  const [spec, targets, roles] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { mid, reach } = spec.rings;

  const targetItems: ArcItem[] = [
    // Not empty: the part has this colour, it just came from the site. The
    // chip wears it, with a folded corner to say so.
    inheritChip("Follow the site", palette[role]),
    ...ROLES.map((r): ArcItem => ({
      id: r,
      label: `Use the site's ${ROLE_LABEL[r].toLowerCase()}`,
      style: { background: palette[r] },
      glyph: current === r ? <Check className="size-3.5" style={{ color: "oklch(0.99 0 0)", mixBlendMode: "difference" }} /> : undefined,
    })),
  ];
  const roleItems: ArcItem[] = ROLES.map((r) => ({
    id: r,
    label: `${ROLE_LABEL[r]} on this part`,
    style: { background: colour?.[r] && !isRole(colour[r]!) ? colour[r]! : palette[(colour?.[r] as RoleId) ?? r] ?? palette[r] },
  }));
  const sharing = slabs.length < 3;

  return (
    <>
      <SpectrumSlab
        slab={spec}
        colour={c}
        onChange={set}
        // A colour chosen here is worth having again elsewhere.
        onCommit={() => { const v = colour?.[role]; if (v && !isRole(v)) useStudio.getState().rememberColour(v); }}
        caption={ROLE_LABEL[role]}
      />

      {/* what to set it to */}
      {/* No size: `sharing` was this row's own way of saying "there is less
          room here", which is the question `chipSize` answers from the radius
          it is already given. */}
      <ArcChips slab={targets} items={targetItems} radius={sharing ? reach - 24 : chipsAt(targets)}
        value={named ? current : current ? null : ""} onPick={(id) => set(id === "" ? null : id)} />
      {sharing ? null : <Caption slab={targets}>Set it to</Caption>}

      {/* which of this part's six you are painting */}
      <ArcChips slab={roles} items={roleItems} radius={sharing ? mid - 10 : chipsAt(roles)}
        value={role} onPick={(id) => setRole(id as RoleId)} />
      {sharing ? null : <Caption slab={roles}>Painting</Caption>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Texture                                                             */
/* ------------------------------------------------------------------ */

export function TextureQuads({
  slabs, value, layers, palette, onChange,
}: {
  slabs: Slab[];
  value: string | null;
  layers: TextureLayer[];
  palette: Palette;
  onChange: (next: string | null) => void;
}) {
  const file = React.useRef<HTMLInputElement>(null);
  /* What the last picture door said: a refusal, or a note on what was kept. */
  const [said, setSaid] = React.useState<string | null>(null);
  const take = (src: string, note?: string) => {
    setSaid(note ?? null);
    const layer = { ...newLayer("image"), src, target: "surfaces" as const };
    useStudio.getState().addTexture(layer);
    play("confirm");
    onChange(layer.id);
  };
  const tile = (l: TextureLayer): React.CSSProperties => {
    const css = textureCss([{ ...l, on: true }], palette, palette.surface);
    return { ...css, backgroundSize: css.backgroundSize ?? "cover" };
  };
  const [pick, add, again] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  /** The layer this part is wearing, when it is wearing one of its own. */
  const current = layers.find((l) => l.id === value) ?? null;
  const { hole, mid } = pick.rings;
  const sharing = slabs.length < 3;
  const addD = sharing ? piece(add.from, add.to, hole, mid, add.shape, add.rings, SHRINK) : wholeOf(add);
  const againD = sharing ? piece(again.from, again.to, mid, "edge", again.shape, again.rings, SHRINK) : wholeOf(again);
  const addAt = sharing ? centreOf(add, hole, mid) : centreOf(add, hole, "edge");
  const againAt = sharing ? centreOf(again, mid, "edge") : centreOf(again, hole, "edge");

  return (
    <>
      <ArcChips
        slab={pick}
        radius={chipsAt(pick)}
        value={value ?? "site"}
        onPick={(id) => onChange(id === "site" ? null : id)}
        items={[
          { id: "site", label: "Follow the site", style: { background: CONSOLE.well }, glyph: <span className="text-[7px] font-bold" style={{ color: CONSOLE.text }}>SITE</span> },
          emptyChip("No texture", "none"),
          ...layers.map((l, i): ArcItem => ({
            id: l.id,
            label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`,
            style: tile(l),
          })),
        ]}
      />
      <Caption slab={pick}>{layers.length ? "Site stack" : "No site stack"}</Caption>

      <SectorButton d={addD} at={addAt} spin={add.spin} shape={add.shape} label="Add a picture" icon={<ImagePlus className="size-3.5" />} onClick={() => file.current?.click()} />
      {/*
        Reiterate takes the texture this part is wearing and changes *one*
        thing about it at random, the scale, the grain, the colour, the bleed,
        whether it drifts. One thing, because a re-roll that changes everything
        gives you a different texture each press and teaches you nothing: a
        step sideways lets you see what moved and keep pressing while it is
        interesting. There is nothing to re-roll until a layer is picked.
      */}
      <SectorButton
        d={againD}
        at={againAt}
        spin={again.spin} shape={again.shape}
        label="Reiterate"
        icon={<Shuffle className="size-3.5" />}
        disabled={!current}
        onClick={() => {
          if (!current) return;
          useStudio.getState().updateTexture(current.id, reiterate(current));
        }}
      />
      {/* And what a re-roll can land on: the drift, on the band under it. */}
      {sharing ? null : (
        <ArcSlider
          slab={again}
          {...runOf(again)}
          rIn={hole + 16}
          rOut={mid - 8}
          label="Drift"
          value={current?.drift ?? 0}
          live={false}
          onChange={(f) => { if (current) useStudio.getState().updateTexture(current.id, { drift: f }); }}
        />
      )}
      {sharing ? null : <Caption slab={again}>{said ? said : current ? `Drift · ${(current.drift ?? 0) < 0.02 ? "still" : `${Math.round((current.drift ?? 0) * 100)}%`}` : "Pick a layer first"}</Caption>}
      <Glued at={[0, 0]} spin={0} w={1} h={1}>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Add a texture"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readPicture(f).then((p) => take(p.src, p.note)).catch((err: unknown) => { play("deny"); setSaid(refusal(err)); });
            e.target.value = "";
          }}
        />
      </Glued>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Aura                                                                */
/* ------------------------------------------------------------------ */

const STYLE_GLYPH: Record<AuraStyle, React.ReactNode> = {
  glow: <Sparkles className="size-3" />,
  ring: <CircleDot className="size-3" />,
  pulse: <Activity className="size-3" />,
};
/** How far the aura's size slider runs: from tight to huge, as a multiple of the usual reach. */
const AURA_SIZE: [number, number] = [0.5, 2.2];

/**
 * Three slabs: the colour boxes, the spectrum, and the sample.
 *
 * The boxes are a grid, not an arc — an X for no aura at all, then the
 * colours picked lately off any spectrum, then the site's six roles, nearest
 * the pointer first. The box *is* the colour; the one that is picked wears
 * the console's small red aura, so the colour never has to fight a glow of
 * its own to be read.
 *
 * The sample slab is where the aura is *seen*: one block wearing exactly
 * what the part wears, and beside it the styles — a soft glow, a hard ring, a
 * pulse — each chip wearing its own, and three sizes. Nothing else on the
 * menu changes colour; the green Aura piece and this block are the two things
 * that show the aura, so they are the two things that swap.
 */
export function AuraQuads({
  slabs, node, palette, onChange,
}: {
  slabs: Slab[];
  node: Pick<StudioNode, "aura" | "auraSize" | "auraStyle">;
  palette: Palette;
  onChange: (patch: Partial<Pick<StudioNode, "aura" | "auraSize" | "auraStyle">>) => void;
}) {
  const recent = useStudio((s) => s.recentColours);
  const [boxes, spec, sample] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, mid } = sample.rings;
  const value = node.aura;
  const size = node.auraSize ?? 1;
  const style = node.auraStyle ?? "glow";
  const colour = auraColour(value, palette);
  const c = parseColor(colour ?? palette.accent) ?? { l: 0.7, c: 0.18, h: 265 };

  const items: ArcItem[] = [
    emptyChip("No aura"),
    ...recent.map((col): ArcItem => ({ id: col, label: `Recent colour ${col}`, style: { background: col } })),
    ...ROLES.map((r): ArcItem => ({ id: r, label: `${ROLE_LABEL[r]} aura`, style: { background: palette[r] } })),
  ];
  const styleItems: ArcItem[] = AURA_STYLES.map((s) => ({
    id: s.id,
    label: s.label,
    // Each style chip wears its own style, in the colour that is set.
    style: { background: CONSOLE.box, color: CONSOLE.text, ...(auraStyle(colour ?? palette.accent, palette, 0.45, s.id) ?? {}) } as React.CSSProperties,
    glyph: STYLE_GLYPH[s.id],
  }));
  // Three bands on the sample slab: the styles by the hole, the block in the
  // middle of the band, and the size as a slider along the outer edge.
  const { reach } = sample.rings;
  const blockAt = spotOn(sample, 0.5, mid - 2);

  return (
    <>
      <GridChips slab={boxes} items={items} value={value ?? ""} onPick={(id) => onChange({ aura: id || null })} />

      <SpectrumSlab
        slab={spec}
        colour={c}
        onChange={(next) => onChange({ aura: next })}
        onCommit={() => { if (value && !isRole(value)) useStudio.getState().rememberColour(value); }}
        caption="Aura colour"
      />

      {/* the sample: what the part wears, and the ways to wear it */}
      <ArcChips slab={sample} items={styleItems} radius={hole + 18} value={style} onPick={(id) => onChange({ auraStyle: id as AuraStyle })} />
      <ArcSlider
        slab={sample}
        {...runOf(sample)}
        rIn={reach - SHRINK - 24}
        rOut={reach - SHRINK - 10}
        label="Aura size"
        value={(size - AURA_SIZE[0]) / (AURA_SIZE[1] - AURA_SIZE[0])}
        onChange={(f) => onChange({ auraSize: Math.round((AURA_SIZE[0] + f * (AURA_SIZE[1] - AURA_SIZE[0])) * 20) / 20 })}
      />
      <Glued at={blockAt} spin={sample.spin} w={44} h={44}>
        <div
          data-aura-sample=""
          title={colour ? "What the part wears" : "No aura yet"}
          className="flex size-[32px] items-center justify-center rounded-[7px]"
          style={{
            background: palette.surface,
            outline: colour ? undefined : `1px dashed ${CONSOLE.muted}`,
            transition: "box-shadow 160ms ease-out",
            ...((auraStyle(value, palette, size, style) ?? {}) as React.CSSProperties),
          }}
        >
          <Sparkles className="size-3" style={{ color: colour ?? CONSOLE.muted }} />
        </div>
      </Glued>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Animation                                                           */
/* ------------------------------------------------------------------ */

/** The slide entrances, by where they come from. */
const SLIDES: { id: string; label: string; glyph: React.ReactNode }[] = [
  { id: "el-rise", label: "From below", glyph: <ArrowUp className="size-3" /> },
  { id: "el-drop", label: "From above", glyph: <ArrowDown className="size-3" /> },
  { id: "el-left", label: "From the left", glyph: <ArrowRight className="size-3" /> },
  { id: "el-right", label: "From the right", glyph: <ArrowLeft className="size-3" /> },
];
const SLIDE_IDS = new Set(SLIDES.map((s) => s.id));
/** The kinds of entrance, as keys on the screen: an icon each in its own colour, the word on the tooltip. */
const ENTRANCE_TYPES: ArcItem[] = [
  { id: "", label: "No entrance", style: SCREEN_KEY, glyph: <Ban className="size-3" /> },
  { id: "el-fade", label: "Fade in", style: keyOf(0), glyph: <Blend className="size-3" /> },
  { id: "slide", label: "Slide in", style: keyOf(1), glyph: <MoveRight className="size-3" /> },
  { id: "el-grow", label: "Grow", style: keyOf(2), glyph: <Expand className="size-3" /> },
  { id: "el-blur", label: "Come into focus", style: keyOf(3), glyph: <Focus className="size-3" /> },
  { id: "el-flip", label: "Tip up", style: keyOf(4), glyph: <FlipVertical2 className="size-3" /> },
];
const EASE_GLYPH: Record<AnimEase, React.ReactNode> = {
  smooth: <Spline className="size-3" />,
  snappy: <Zap className="size-3" />,
  bouncy: <Activity className="size-3" />,
};
const EASE_KEY: Record<AnimEase, React.CSSProperties> = { smooth: keyOf(5), snappy: keyOf(6), bouncy: keyOf(7) };

/**
 * The entrance, shown by a slab.
 *
 * A ghost of the slab — its own shape, its own grey — arrives the way the
 * part will: same entrance, speed, delay and easing. Then it dissolves, and
 * the controls are there underneath as they were. It runs every time any of
 * the four changes, and again from the small ▶ by the hole. It plays on the
 * slab the motion comes *across*: bottom-left for anything that arrives from
 * below or the left (and everything that does not move), top-right for what
 * drops in or comes from the right.
 */
function Ghost({ slab, node, run }: { slab: Slab; node: Pick<StudioNode, "anim" | "animSpeed" | "animDelay" | "animEase">; run: number }) {
  const css = entranceCss(node.anim, node.animSpeed, node.animDelay, node.animEase);
  if (!css) return null;
  // How long the arrival takes, so the ghost leaves just after it lands.
  const gone = Math.round(ENTRANCE_MS * speedK(node.animSpeed) + delayMs(node.animDelay) + 120);
  // The ghost is the screen's own glass, a shade up, arriving.
  const glass = "oklch(0.26 0.06 195)";
  return (
    <path
      key={run}
      data-anim-ghost={node.anim ?? ""}
      d={wholeOf(slab)}
      className="pointer-events-none"
      fill={glass}
      stroke={glass}
      strokeWidth={2 * 5}
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{
        transformBox: "fill-box",
        transformOrigin: "center",
        animation: `${css}, ghost-out 320ms ease-out ${gone}ms forwards`,
      }}
    />
  );
}

/** Where a screen's slider band runs: across the slab's middle radius. */
const bandOf = (s: Slab) => ({ rIn: s.rings.mid - 6, rOut: s.rings.mid + 12 });
/** A hair in from each seam, so a slider's ends are not on the corner. */

/**
 * Three screens: speed (top-right), the entrance itself (bottom-right), and
 * the rest (bottom-left). Speed is **one slider**. The entrance screen holds
 * the kinds as keys — icons, not words — on its outer band and a four-way
 * pad for the slides on its inner one; picking Slide with no direction set
 * means from below. The third screen is the wait, as a slider, and the
 * easing as three keys. The caption under each slider reads the value out.
 * One of the slabs is the demo slab and plays the ghost; its replay sits in
 * its outer corner.
 */
export function AnimQuads({
  slabs, node, focus, onChange,
}: {
  slabs: Slab[];
  node: Pick<StudioNode, "anim" | "animSpeed" | "animDelay" | "animEase">;
  focus: "entrance" | "speed" | "extras";
  onChange: (patch: Partial<Pick<StudioNode, "anim" | "animSpeed" | "animDelay" | "animEase">>) => void;
}) {
  const [speed, entrance, extras] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, reach } = entrance.rings;
  const anim = node.anim ?? "";
  const type = SLIDE_IDS.has(anim) ? "slide" : anim;
  const fromTopRight = anim === "el-drop" || anim === "el-right";
  const demo = fromTopRight ? speed : extras;
  const k = speedK(node.animSpeed);
  const wait = delayMs(node.animDelay);
  const [run, setRun] = React.useState(0);
  React.useEffect(() => { setRun((n) => n + 1); }, [node.anim, node.animSpeed, node.animDelay, node.animEase]);
  void focus;
  // The replay sits in the demo slab's far corner on a square wheel — past
  // the keys' arc, where the corner is empty — and by the leading seam on a
  // round one, which has no corner.
  const replayAt = demo.shape === "round" ? onCircle(demo.from + 0.03, reach - SHRINK - 30) : onCircle((demo.from + demo.to) / 2, reach + 6);

  return (
    <>
      <ScreenFace slab={speed} />
      <ScreenFace slab={entrance} />
      <ScreenFace slab={extras} />

      {/* how it comes in: the kinds, and where a slide comes from */}
      <ArcChips slab={entrance} tone="screen" items={ENTRANCE_TYPES} radius={chipsAt(entrance)} value={type}
        onPick={(id) => onChange({ anim: id === "" ? null : id === "slide" ? (SLIDE_IDS.has(anim) ? anim : "el-rise") : id })} />
      <ArcChips
        slab={entrance}
        tone="screen"
        items={SLIDES.map((s, i) => ({ id: s.id, label: s.label, style: keyOf(8 + i), glyph: s.glyph }))}
        radius={hole + 24}
        value={SLIDE_IDS.has(anim) ? anim : null}
        onPick={(id) => onChange({ anim: id })}
      />

      {/* how fast: one slider, read out under it */}
      <ArcSlider slab={speed} tone="screen" live={false} {...runOf(speed)} {...bandOf(speed)} label="Speed"
        value={sliderFromSpeed(k)} onChange={(f) => onChange({ animSpeed: speedFromSlider(f) })} />
      <Caption slab={speed}>{`Speed · ${speedWord(k)}`}</Caption>

      {/* the rest: the wait as a slider, the easing as keys */}
      <ArcSlider slab={extras} tone="screen" live={false} {...runOf(extras)} {...bandOf(extras)} label="Delay"
        value={wait / DELAY_MS} onChange={(f) => onChange({ animDelay: Math.round((f * DELAY_MS) / 10) * 10 })} />
      <ArcChips slab={extras} tone="screen" items={ANIM_EASE.map((e) => ({ id: e.id, label: `${e.label} easing`, style: EASE_KEY[e.id], glyph: EASE_GLYPH[e.id] }))}
        radius={chipsAt(extras)} value={node.animEase ?? "smooth"} onPick={(id) => onChange({ animEase: id as AnimEase })} />
      <Caption slab={extras}>{`Delay · ${wait ? `${wait} ms` : "none"}`}</Caption>

      {/* the demo, and the way to see it again */}
      <Ghost slab={demo} node={node} run={run} />
      <Glued at={replayAt} spin={demo.spin} w={26} h={26}>
        <button
          type="button"
          data-anim-preview={node.anim ?? ""}
          aria-label="Replay the entrance"
          title={node.anim ? "See it again" : "No entrance yet"}
          onClick={() => { play("tap"); setRun((n) => n + 1); }}
          className="pointer-events-auto flex size-[18px] items-center justify-center rounded-[4px]"
          style={{
            background: node.anim ? CONSOLE.on : CONSOLE.box,
            color: node.anim ? "oklch(0.16 0.04 27)" : CONSOLE.muted,
            boxShadow: "0 1px 3px oklch(0 0 0 / 0.5)",
            outline: node.anim ? undefined : `1px dashed ${CONSOLE.muted}`,
          }}
        >
          <Play className="size-2.5" />
        </button>
      </Glued>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Font                                                                */
/* ------------------------------------------------------------------ */

/**
 * A part's own type: three screens. Size and weight share the first (the
 * inner and outer arcs), spacing and leading the next; the family is a
 * readout with arrows on the third, set in its own face, with "the site's"
 * as the first stop. Every value is relative to the site's where it can be,
 * so the part stays a shade larger when the site's type changes.
 */
export function FontQuads({
  slabs, font, onChange,
}: {
  slabs: Slab[];
  font: NodeFont | null;
  onChange: (next: NodeFont | null) => void;
}) {
  const [a, b, fam] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, mid, reach } = a.rings;
  const set = (patch: Partial<NodeFont>) => onChange({ ...(font ?? {}), ...patch });
  // Two bands: one just past the caption, one just past the middle.
  const inner = { rIn: hole + 32, rOut: mid - 4 };
  const outer = { rIn: mid + 6, rOut: mid + 22 };
  const size = font?.size ?? 1;
  const weight = font?.weight ?? 400;
  const spacing = font?.spacing ?? 0;
  const leading = font?.leading ?? 1.55;
  /* The faces the site carries come first, each set in itself, so a part
     can be put in the page's own face or taken out of it: a carried face
     is named on the part, never welded to it. */
  const carried = useStudio((s) => s.look.fonts);
  const faces = [...new Set((carried ?? []).map((f) => f.family))];
  const families: StepItem[] = [
    { id: "", label: "Site's type" },
    ...faces.map((name): StepItem => ({ id: `face:${name}`, label: name, style: { fontFamily: `"${name}"`, textTransform: "none", fontSize: 10 } })),
    ...Object.keys(FAMILY).map((k): StepItem => ({ id: k, label: k, style: { fontFamily: FAMILY[k], textTransform: "none", fontSize: 10 } })),
  ];
  const facing = font?.face && faces.includes(font.face) ? `face:${font.face}` : (font?.family ?? "");
  void reach;
  return (
    <>
      <ScreenFace slab={a} />
      <ScreenFace slab={b} />
      <ScreenFace slab={fam} />
      <ArcSlider slab={a} tone="screen" {...runOf(a)} {...inner} label="Size" value={(size - 0.6) / 1.4}
        onChange={(f) => set({ size: Math.round((0.6 + f * 1.4) * 100) / 100 })} />
      <ArcSlider slab={a} tone="screen" {...runOf(a)} {...outer} label="Weight" value={(weight - 300) / 500}
        onChange={(f) => set({ weight: Math.round((300 + f * 500) / 100) * 100 })} />
      <Caption slab={a}>{`${Math.round(size * 100)}% · w${weight}`}</Caption>
      <ArcSlider slab={b} tone="screen" {...runOf(b)} {...inner} label="Letter spacing" value={(spacing + 0.05) / 0.35}
        onChange={(f) => set({ spacing: Math.round((-0.05 + f * 0.35) * 1000) / 1000 })} />
      <ArcSlider slab={b} tone="screen" {...runOf(b)} {...outer} label="Line height" value={(leading - 1) / 1}
        onChange={(f) => set({ leading: Math.round((1 + f) * 100) / 100 })} />
      <Caption slab={b}>{`${spacing}em · ${leading}`}</Caption>
      <ArcStepper slab={fam} radius={chipsAt(fam) - 4} items={families} value={facing} label="Family"
        onChange={(id) => (id.startsWith("face:") ? set({ face: id.slice(5) }) : set({ family: id || undefined, face: undefined }))} />
      <Caption slab={fam}>Family</Caption>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Behaviour: the part's own motion options                            */
/* ------------------------------------------------------------------ */

/**
 * The options a part offers that are about how it moves — a top bar's speed
 * and what it does on scroll, a carousel's autoplay — one option per screen
 * as a readout with arrows, captioned with the option's name. Everything
 * else a part offers is under Edit; these are here because they are
 * animation.
 */
export function BehaviourQuads({
  slabs, options, values, onChange,
}: {
  slabs: Slab[];
  options: FeatureOption[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <>
      {slabs.map((slab, i) => <ScreenFace key={i} slab={slab} />)}
      {options.slice(0, slabs.length).map((opt, i) => {
        const slab = slabs[i]!;
        const current = values[opt.id] ?? opt.values[0]!;
        return (
          <React.Fragment key={opt.id}>
            <ArcStepper slab={slab} radius={chipsAt(slab) - 4} items={opt.values.map((v) => ({ id: v, label: v }))} value={current} label={opt.label}
              onChange={(v) => onChange(opt.id, v)} />
            <Caption slab={slab}>{opt.label}</Caption>
          </React.Fragment>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Edge: the border and the shadow                                     */
/* ------------------------------------------------------------------ */

/**
 * How a shadow falls, as keys: a hard offset (the cartoon drop), soft, and a
 * glow. No shadow at all is the colour grid's own empty chip ("No shadow",
 * `colourMenu`) while the shadow is being painted, not a key of its own here.
 */
export type ShadowKind = "none" | "hard" | "soft" | "glow";
const SHADOW_KEYS: ArcItem[] = [
  { id: "hard", label: "Hard offset", style: keyOf(0), glyph: <MoveRight className="size-3" /> },
  { id: "soft", label: "Soft", style: keyOf(1), glyph: <Blend className="size-3" /> },
  { id: "glow", label: "Glow", style: keyOf(2), glyph: <Sparkles className="size-3" /> },
];

/** The first layer of a box-shadow, read as the four kinds. A shadow list is read by its first layer. */
export function readShadow(css: string | null | undefined): { kind: ShadowKind; size: number; colour: string | null } {
  const s = String(css ?? "").trim();
  if (!s || s === "none") return { kind: "none", size: 6, colour: null };
  const first = s.split(/,(?![^(]*\))/)[0]!;
  const fn = /[a-z-]+\([^)]*\)|#[0-9a-f]{3,8}\b/i;
  const colour = first.match(fn)?.[0] ?? null;
  const n = [...first.replace(fn, "").matchAll(/-?\d+(?:\.\d+)?(?=px|\b)/g)].map((m) => Number(m[0]));
  const [x = 0, y = 0, blur = 0] = n;
  if (!blur && (x || y)) return { kind: "hard", size: Math.max(Math.abs(x), Math.abs(y)), colour };
  if (!x && !y) return { kind: "glow", size: Math.round(blur / 2), colour };
  return { kind: "soft", size: Math.abs(y) || Math.round(blur / 2), colour };
}
export function writeShadow(kind: ShadowKind, size: number, colour: string): string | undefined {
  const n = Math.max(1, Math.round(size));
  if (kind === "hard") return `${colour} ${n}px ${n}px 0px 0px`;
  if (kind === "soft") return `${colour} 0px ${n}px ${n * 2}px 0px`;
  if (kind === "glow") return `${colour} 0px 0px ${n * 2}px 0px`;
  return undefined;
}

/**
 * A part's edge: its border's colour and width, and the shadow it throws.
 * The colour boxes paint one or the other — the key by the hole says which —
 * and carry the site's own colours first (the ones its parts wear on their
 * borders and shadows, `siteColours.ts`), so a captured part is recoloured
 * in its own site's ink rather than a guess. Width and shadow size are
 * sliders on a screen; how the shadow falls is four keys.
 */
export function EdgeQuads({
  slabs, edge, palette, siteColours, onChange,
}: {
  slabs: Slab[];
  edge: { width?: number; style?: string; colour?: string; shadow?: string } | null;
  palette: Palette;
  /** The site's colours, most worn first. */
  siteColours: string[];
  onChange: (next: { width?: number; style?: "solid" | "dashed" | "dotted" | "double" | "none"; colour?: string; shadow?: string } | null) => void;
}) {
  const recent = useStudio((s) => s.recentColours);
  const [paint, setPaint] = React.useState<"border" | "shadow">("border");
  const [boxes, dials, keys] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, mid } = dials.rings;
  const width = edge && edge.style !== "none" ? edge.width ?? 1 : 0;
  const sh = readShadow(edge?.shadow);
  const inkOf = (v: string | undefined | null) => (v && isRole(v) ? palette[v as RoleId] : v) || null;
  const borderColour = inkOf(edge?.colour) ?? palette.text;
  const shadowColour = sh.colour ?? borderColour;
  const set = (patch: Partial<NonNullable<typeof edge>>) => {
    const next = { ...(edge ?? {}), ...patch } as NonNullable<typeof edge>;
    if (!next.shadow) delete next.shadow;
    const drawn = (next.width ?? 0) > 0 && next.style !== "none";
    onChange(drawn || next.shadow ? (next as Parameters<typeof onChange>[0]) : null);
  };
  const items: ArcItem[] = [
    emptyChip(paint === "border" ? "No border" : "No shadow"),
    ...[...new Set([...siteColours.slice(0, 10), ...recent])].map((col): ArcItem => ({ id: col, label: `Colour ${col}`, style: { background: col } })),
    ...ROLES.map((r): ArcItem => ({ id: r, label: `The site's ${ROLE_LABEL[r].toLowerCase()}`, style: { background: palette[r] } })),
  ];
  const pick = (id: string) => {
    if (paint === "border") {
      if (!id) set({ width: 0, style: "none" });
      else set({ colour: id, width: width || 2, style: edge?.style && edge.style !== "none" ? (edge.style as "solid") : "solid" });
    } else {
      if (!id) set({ shadow: undefined });
      else set({ shadow: writeShadow(sh.kind === "none" ? "hard" : sh.kind, sh.size, inkOf(id) ?? id) });
    }
  };
  const inner = { rIn: hole + 32, rOut: mid - 4 };
  const outer = { rIn: mid + 6, rOut: mid + 22 };
  return (
    <>
      <GridChips slab={boxes} items={items} value={paint === "border" ? (width ? edge?.colour ?? "" : "") : (sh.kind === "none" ? "" : sh.colour ?? "")} onPick={pick} />
      <ScreenFace slab={dials} />
      <ArcSlider slab={dials} tone="screen" {...runOf(dials)} {...inner} label="Border width" value={Math.min(1, width / 12)}
        onChange={(f) => { const w = Math.min(12, Math.ceil(f * 12 - 0.001)); set(w ? { width: w, style: edge?.style && edge.style !== "none" ? (edge.style as "solid") : "solid", colour: edge?.colour ?? borderColour } : { width: 0, style: "none" }); }} />
      <ArcSlider slab={dials} tone="screen" {...runOf(dials)} {...outer} label="Shadow size" value={Math.min(1, sh.size / 24)}
        onChange={(f) => set({ shadow: writeShadow(sh.kind === "none" ? "hard" : sh.kind, Math.max(1, Math.min(24, Math.ceil(f * 24 - 0.001))), shadowColour) })} />
      <Caption slab={dials}>{`${width}px border · ${sh.kind === "none" ? "no shadow" : `${sh.size}px ${sh.kind}`}`}</Caption>
      <ArcChips slab={keys} items={SHADOW_KEYS} radius={chipsAt(keys)} value={sh.kind}
        onPick={(id) => set({ shadow: writeShadow(id as ShadowKind, sh.size, shadowColour) })} />
      <ArcChips slab={keys} items={[
        { id: "border", label: "Paint the border", style: { background: CONSOLE.box, outline: `2px solid ${borderColour}`, outlineOffset: -4 } },
        { id: "shadow", label: "Paint the shadow", style: { background: CONSOLE.box, boxShadow: `3px 3px 0 ${shadowColour}` } },
      ]} radius={hole + 18} value={paint} onPick={(id) => setPaint(id as "border" | "shadow")} />
    </>
  );
}
