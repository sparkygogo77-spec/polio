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
import { Activity, Check, CircleDot, ImagePlus, Shuffle, Sparkles, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { readImage } from "./ImageIntake";
import {
  auraColour, auraStyle, AURA_STYLES, css as oklchCss, newLayer, parseColor, textureCss, TEXTURE_KINDS, ROLES, ROLE_LABEL,
  type AuraStyle, type Palette, type RoleId, type TextureLayer,
} from "./look";
import { useStudio, type StudioNode } from "./store";
import { middleOf, onCircle, piece, type Rings, type Shape } from "./menuGeometry";
import {
  ArcChips, ArcSlider, Caption, CONSOLE, GridChips, Glued, SectorButton, SHRINK, SLAB_AURA, type ArcItem, type Slab,
} from "./RingConsole";

/** The quadrants the console has been given, clockwise from the green. */
export interface ConsoleSpan {
  quads: [number, number][];
  rings: Rings;
  shape: Shape;
  spin: number;
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
  const { quads, rings, shape, spin } = span;
  const slabs: Slab[] = quads.map(([from, to]) => ({ from, to, rings, shape, spin }));
  return (
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <g transform={`rotate(${(spin * 360).toFixed(2)})`}>
        {slabs.map((s, i) => {
          const d = piece(s.from, s.to, rings.hole, "edge", shape, rings, SHRINK);
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
                fill={CONSOLE.face}
                stroke={CONSOLE.face}
                strokeWidth={2 * 5}
                strokeLinejoin="round"
                strokeLinecap="round"
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
const chipsAt = (s: Slab) => s.rings.mid + (s.rings.reach - s.rings.mid) * 0.56;
/** The middle of a whole quadrant, for a button that is the whole quadrant. */
const centreOf = (s: Slab, rIn: number, rOut: number | "edge") => middleOf(s.from, s.to, rIn, rOut, s.shape, s.rings, 0.5);
/** A whole quadrant, cut as the console cuts its slabs. */
const wholeOf = (s: Slab) => piece(s.from, s.to, s.rings.hole, "edge", s.shape, s.rings, SHRINK);

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
function SpectrumSlab({
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
          { id: "none", label: "No texture", style: { background: "oklch(0.24 0.008 260)" }, glyph: <X className="size-3.5" style={{ color: CONSOLE.text }} /> },
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
const SIZES: { id: string; label: string; k: number }[] = [
  { id: "s", label: "Small aura", k: 0.6 },
  { id: "m", label: "Medium aura", k: 1 },
  { id: "l", label: "Large aura", k: 1.5 },
  { id: "xl", label: "Huge aura", k: 2.2 },
];

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
    style: { background: "oklch(0.24 0.008 260)", color: CONSOLE.text, ...(auraStyle(colour ?? palette.accent, palette, 0.45, s.id) ?? {}) } as React.CSSProperties,
    glyph: STYLE_GLYPH[s.id],
  }));
  const sizeItems: ArcItem[] = SIZES.map((s) => ({
    id: s.id,
    label: s.label,
    style: { background: "oklch(0.24 0.008 260)", color: CONSOLE.text },
    glyph: <span className="text-[8px] font-bold">{s.id.toUpperCase()}</span>,
  }));
  const sizeId = SIZES.reduce((best, s) => (Math.abs(s.k - size) < Math.abs(best.k - size) ? s : best), SIZES[1]!).id;
  // Three bands on the sample slab: the styles by the hole, the block in the
  // middle of the band, the four sizes along the outer edge — four, so none
  // of them sits on the diagonal where the block's corner is.
  const { reach } = sample.rings;
  const blockAt = onCircle((sample.from + sample.to) / 2, mid + 4);

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
      <ArcChips slab={sample} items={sizeItems} radius={reach - SHRINK - 14} size={18} value={sizeId} onPick={(id) => onChange({ auraSize: SIZES.find((s) => s.id === id)?.k ?? 1 })} />
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
/* The one rectangle                                                   */
/* ------------------------------------------------------------------ */

/**
 * A plate inscribed in the first slab, for the editors that are really text.
 *
 * Sized to the square the quadrant encloses and counter-rotated so the words
 * stay upright; it moves with the slab because it is drawn inside it.
 */
export function PlateQuad({ slabs, children }: { slabs: Slab[]; children: React.ReactNode }) {
  const s = slabs[0]!;
  const { hole, reach } = s.rings;
  // The square the quadrant encloses, less the hole's corner and the edge.
  const w = reach - hole - 4;
  const at = onCircle((s.from + s.to) / 2, (hole + reach) / 2 + 12);
  return (
    <Glued at={at} spin={s.spin} w={w + 26} h={w - 2} className="flex h-full w-full items-center justify-center">
      <div data-ring-plate-box="" className="pointer-events-auto w-full rounded-lg p-2" style={{ background: CONSOLE.well, boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.12), inset 0 -1px 0 oklch(0 0 0 / 0.3)" }}>
        {children}
      </div>
    </Glued>
  );
}
