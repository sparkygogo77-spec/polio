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
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ban, Blend, Check, CircleDot, Expand, FlipVertical2, Focus, ImagePlus, MoveRight, Play, Shuffle, Sparkles, Spline, X, Zap,
} from "lucide-react";
import { play } from "@/core/audio/engine";
import { readImage } from "./ImageIntake";
import {
  ANIM_EASE, auraColour, auraStyle, AURA_STYLES, css as oklchCss, DELAY_MS, delayMs, ENTRANCE_MS, entranceCss, newLayer, parseColor, sliderFromSpeed, speedFromSlider, speedK, speedWord, textureCss,
  TEXTURE_KINDS, ROLES, ROLE_LABEL,
  type AnimEase, type AuraStyle, type Palette, type RoleId, type TextureLayer,
} from "./look";
import { useStudio, type StudioNode } from "./store";
import { FAMILY, type NodeFont } from "./parts/theme";
import type { FeatureOption } from "./catalog";
import { middleOf, onCircle, piece, type Rings, type Shape } from "./menuGeometry";
import {
  ArcChips, ArcSlider, ArcStepper, Caption, CONSOLE, GridChips, Glued, phosphorAt, ScreenFace, SCREEN_KEY, SectorButton, SHRINK, SLAB_AURA,
  type ArcItem, type Slab, type StepItem,
} from "./RingConsole";

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
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: SLAB_AURA }}
              />
              <path
                d={d}
                className="pointer-events-none"
                fill={face}
                stroke={face}
                strokeWidth={2 * 5}
                strokeLinejoin="round"
                strokeLinecap="round"
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
export const chipsAt = (s: Slab) => s.rings.mid + (s.rings.reach - s.rings.mid) * 0.56;
/** The middle of a whole quadrant, for a button that is the whole quadrant. */
export const centreOf = (s: Slab, rIn: number, rOut: number | "edge") => middleOf(s.from, s.to, rIn, rOut, s.shape, s.rings, 0.5);
/** A whole quadrant, cut as the console cuts its slabs. */
export const wholeOf = (s: Slab) => piece(s.from, s.to, s.rings.hole, "edge", s.shape, s.rings, SHRINK);

/* ------------------------------------------------------------------ */
/* The spectrum, on one slab                                           */
/* ------------------------------------------------------------------ */

/** Below this a colour is a grey wearing a hue, which is what read as broken. */
const LIVE = 0.14;

/**
 * Hue on the inner band, lightness and strength split across the outer one:
 * the whole of a colour, off three arcs on one slab. The Hue editor and the
 * Aura editor draw the same one, so a hand that has learned it once has
 * learned it twice.
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
  // The arcs sit a little inside the slab's own seams.
  const pad = 0.012;
  const sFrom = slab.from + pad;
  const sTo = slab.to - pad;
  const half = (sFrom + sTo) / 2;
  return (
    <>
      <ArcSlider
        slab={slab}
        from={sFrom}
        to={sTo}
        rIn={hole + 18}
        rOut={mid - 6}
        label="Hue"
        value={(((c.h % 360) + 360) % 360) / 360}
        colourAt={(f) => oklchCss({ l: 0.7, c: 0.19, h: f * 360 })}
        onChange={(f) => onChange(oklchCss({ ...c, c: Math.max(c.c, LIVE), h: f * 360 }))}
        onCommit={onCommit}
      />
      <ArcSlider
        slab={slab}
        from={sFrom}
        to={half - 0.006}
        rIn={mid + 4}
        rOut={reach - 12}
        label="Lightness"
        value={(c.l - 0.08) / 0.9}
        colourAt={(f) => oklchCss({ ...c, l: 0.08 + f * 0.9 })}
        onChange={(f) => onChange(oklchCss({ ...c, l: 0.08 + f * 0.9 }))}
        onCommit={onCommit}
      />
      <ArcSlider
        slab={slab}
        from={half + 0.006}
        to={sTo}
        rIn={mid + 4}
        rOut={reach - 12}
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
    { id: "", label: "Follow the site", style: { background: CONSOLE.well }, glyph: <X className="size-3.5" style={{ color: CONSOLE.text }} /> },
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
      <ArcChips slab={targets} items={targetItems} radius={sharing ? reach - 24 : chipsAt(targets)} size={sharing ? 22 : 26}
        value={named ? current : current ? null : ""} onPick={(id) => set(id === "" ? null : id)} />
      {sharing ? null : <Caption slab={targets}>Set it to</Caption>}

      {/* which of this part's six you are painting */}
      <ArcChips slab={roles} items={roleItems} radius={sharing ? mid - 10 : chipsAt(roles)} size={sharing ? 20 : 24}
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
  const take = (src: string) => {
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
          { id: "none", label: "No texture", style: { background: CONSOLE.box }, glyph: <X className="size-3.5" style={{ color: CONSOLE.text }} /> },
          ...layers.map((l, i): ArcItem => ({
            id: l.id,
            label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`,
            style: tile(l),
          })),
        ]}
      />
      <Caption slab={pick}>{layers.length ? "Site stack" : "No site stack"}</Caption>

      <SectorButton d={addD} at={addAt} spin={add.spin} label="Add a picture" icon={<ImagePlus className="size-3.5" />} onClick={() => file.current?.click()} />
      {/*
        Reiterate: the place for a button that takes the texture this part is
        wearing and changes *one* thing about it at random — the scale, the
        grain, the colour, the bleed — so you can wander through variations
        without setting anything. The slab is here and wired; what it does
        when pressed is not, yet.
      */}
      <SectorButton
        d={againD}
        at={againAt}
        spin={again.spin}
        label="Reiterate"
        icon={<Shuffle className="size-3.5" />}
        onClick={() => play("tap")}
      />
      {sharing ? null : <Caption slab={again}>Random · soon</Caption>}
      <Glued at={[0, 0]} spin={0} w={1} h={1}>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Add a texture"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readImage(f).then(take);
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
    { id: "", label: "No aura", style: { background: CONSOLE.well }, glyph: <X className="size-3" style={{ color: CONSOLE.text }} /> },
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
  const blockAt = onCircle((sample.from + sample.to) / 2, mid - 2);

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
      <ArcChips slab={sample} items={styleItems} radius={hole + 18} size={18} value={style} onPick={(id) => onChange({ auraStyle: id as AuraStyle })} />
      <ArcSlider
        slab={sample}
        from={sample.from + 0.014}
        to={sample.to - 0.014}
        rIn={reach - SHRINK - 24}
        rOut={reach - SHRINK - 10}
        label="Aura size"
        value={(size - AURA_SIZE[0]) / (AURA_SIZE[1] - AURA_SIZE[0])}
        colourAt={(f) => `oklch(${(0.3 + f * 0.5).toFixed(3)} 0.02 285)`}
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
/** The kinds of entrance, as keys on the screen: an icon each, the word on the tooltip. */
const ENTRANCE_TYPES: ArcItem[] = [
  { id: "", label: "No entrance", style: SCREEN_KEY, glyph: <Ban className="size-3" /> },
  { id: "el-fade", label: "Fade in", style: SCREEN_KEY, glyph: <Blend className="size-3" /> },
  { id: "slide", label: "Slide in", style: SCREEN_KEY, glyph: <MoveRight className="size-3" /> },
  { id: "el-grow", label: "Grow", style: SCREEN_KEY, glyph: <Expand className="size-3" /> },
  { id: "el-blur", label: "Come into focus", style: SCREEN_KEY, glyph: <Focus className="size-3" /> },
  { id: "el-flip", label: "Tip up", style: SCREEN_KEY, glyph: <FlipVertical2 className="size-3" /> },
];
const EASE_GLYPH: Record<AnimEase, React.ReactNode> = {
  smooth: <Spline className="size-3" />,
  snappy: <Zap className="size-3" />,
  bouncy: <Activity className="size-3" />,
};

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
const PAD = 0.014;

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
      <ArcChips slab={entrance} tone="screen" items={ENTRANCE_TYPES} radius={chipsAt(entrance)} size={24} value={type}
        onPick={(id) => onChange({ anim: id === "" ? null : id === "slide" ? (SLIDE_IDS.has(anim) ? anim : "el-rise") : id })} />
      <ArcChips
        slab={entrance}
        tone="screen"
        items={SLIDES.map((s) => ({ id: s.id, label: s.label, style: SCREEN_KEY, glyph: s.glyph }))}
        radius={hole + 24}
        size={18}
        value={SLIDE_IDS.has(anim) ? anim : null}
        onPick={(id) => onChange({ anim: id })}
      />

      {/* how fast: one slider, read out under it */}
      <ArcSlider slab={speed} tone="screen" live={false} from={speed.from + PAD} to={speed.to - PAD} {...bandOf(speed)} label="Speed"
        value={sliderFromSpeed(k)} colourAt={phosphorAt} onChange={(f) => onChange({ animSpeed: speedFromSlider(f) })} />
      <Caption slab={speed}>{`Speed · ${speedWord(k)}`}</Caption>

      {/* the rest: the wait as a slider, the easing as keys */}
      <ArcSlider slab={extras} tone="screen" live={false} from={extras.from + PAD} to={extras.to - PAD} {...bandOf(extras)} label="Delay"
        value={wait / DELAY_MS} colourAt={phosphorAt} onChange={(f) => onChange({ animDelay: Math.round((f * DELAY_MS) / 10) * 10 })} />
      <ArcChips slab={extras} tone="screen" items={ANIM_EASE.map((e) => ({ id: e.id, label: `${e.label} easing`, style: SCREEN_KEY, glyph: EASE_GLYPH[e.id] }))}
        radius={chipsAt(extras)} size={24} value={node.animEase ?? "smooth"} onPick={(id) => onChange({ animEase: id as AnimEase })} />
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
  const families: StepItem[] = [
    { id: "", label: "Site's type" },
    ...Object.keys(FAMILY).map((k): StepItem => ({ id: k, label: k, style: { fontFamily: FAMILY[k], textTransform: "none", fontSize: 10 } })),
  ];
  void reach;
  return (
    <>
      <ScreenFace slab={a} />
      <ScreenFace slab={b} />
      <ScreenFace slab={fam} />
      <ArcSlider slab={a} tone="screen" from={a.from + PAD} to={a.to - PAD} {...inner} label="Size" value={(size - 0.6) / 1.4} colourAt={phosphorAt}
        onChange={(f) => set({ size: Math.round((0.6 + f * 1.4) * 100) / 100 })} />
      <ArcSlider slab={a} tone="screen" from={a.from + PAD} to={a.to - PAD} {...outer} label="Weight" value={(weight - 300) / 500} colourAt={phosphorAt}
        onChange={(f) => set({ weight: Math.round((300 + f * 500) / 100) * 100 })} />
      <Caption slab={a}>{`${Math.round(size * 100)}% · w${weight}`}</Caption>
      <ArcSlider slab={b} tone="screen" from={b.from + PAD} to={b.to - PAD} {...inner} label="Letter spacing" value={(spacing + 0.05) / 0.35} colourAt={phosphorAt}
        onChange={(f) => set({ spacing: Math.round((-0.05 + f * 0.35) * 1000) / 1000 })} />
      <ArcSlider slab={b} tone="screen" from={b.from + PAD} to={b.to - PAD} {...outer} label="Line height" value={(leading - 1) / 1} colourAt={phosphorAt}
        onChange={(f) => set({ leading: Math.round((1 + f) * 100) / 100 })} />
      <Caption slab={b}>{`${spacing}em · ${leading}`}</Caption>
      <ArcStepper slab={fam} radius={chipsAt(fam) - 4} items={families} value={font?.family ?? ""} label="Family"
        onChange={(id) => set({ family: id || undefined })} />
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
