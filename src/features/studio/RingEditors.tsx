"use client";
/**
 * The editor, as three more quadrants.
 *
 * Pick a green choice and the three quadrants the green level is not using
 * become the editor — each one a slab like Delete, cut with the same `piece()`
 * as the rest of the wheel, in the console's own red. Not a ring outside the
 * wheel, not a box beside it: more of the same object, filled in. The green
 * stays up, so you can see which choice you are inside and step sideways.
 *
 * What goes on a slab is built from `RingConsole.tsx`: chips along an arc, a
 * slider bent round the band, a sector cut out as a button, a caption glued
 * to a spot. All of it sits in the same rotated group as the slab, so it turns
 * with the wheel and never trails it.
 *
 * A few choices are text, and there is no honest way to bend a text field
 * round a curve. Those get `PlateQuad`: a flat plate inscribed in the first
 * slab, wearing the slab's own colour. The one rectangle, and it is inside a
 * quadrant.
 */
import * as React from "react";
import { Check, ImagePlus, Trash2, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { readImage } from "./ImageIntake";
import {
  css as oklchCss, newLayer, parseColor, textureCss, TEXTURE_KINDS, ROLES, ROLE_LABEL,
  type Palette, type RoleId, type TextureLayer,
} from "./look";
import { useStudio } from "./store";
import { middleOf, onCircle, piece, type Rings, type Shape } from "./menuGeometry";
import { ArcChips, ArcSlider, Caption, CONSOLE_HUE, Glued, SectorButton, type ArcItem, type Slab } from "./RingConsole";

/** The quadrants the console has been given, clockwise from the green. */
export interface ConsoleSpan {
  quads: [number, number][];
  rings: Rings;
  shape: Shape;
  spin: number;
}

const face = (lit: boolean) => `oklch(${lit ? 0.5 : 0.44} ${lit ? 0.15 : 0.13} ${CONSOLE_HUE})`;
const rim = `oklch(0.28 0.1 ${CONSOLE_HUE})`;

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
  span, onGrip, onBack, children,
}: {
  span: ConsoleSpan;
  onGrip?: (e: React.PointerEvent) => void;
  onBack: () => void;
  children: (slabs: Slab[]) => React.ReactNode;
}) {
  const { quads, rings, shape, spin } = span;
  const slabs: Slab[] = quads.map(([from, to]) => ({ from, to, rings, shape, spin }));
  // The way back sits on the seam between the last slab and the green.
  const last = quads[quads.length - 1]!;
  const backAt = onCircle(last[1] - 0.012, rings.reach + 18);
  return (
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <g transform={`rotate(${(spin * 360).toFixed(2)})`}>
        {slabs.map((s, i) => {
          const d = piece(s.from, s.to, rings.hole, "edge", shape, rings);
          return (
            <g key={i} data-console-slab={i}>
              <path
                d={d}
                onPointerDown={onGrip}
                className="pointer-events-auto cursor-grab active:cursor-grabbing"
                fill={rim}
                stroke={rim}
                strokeWidth={2 * 5 + 2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={d}
                className="pointer-events-none"
                fill={face(false)}
                stroke={face(false)}
                strokeWidth={2 * 5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          );
        })}
        {children(slabs)}
        <Glued at={backAt} spin={spin} w={28} h={28}>
          <button
            type="button"
            aria-label="Back to the menu"
            onClick={() => { play("close"); onBack(); }}
            className="pointer-events-auto flex size-6 items-center justify-center rounded-full"
            style={{ background: `oklch(0.66 0.21 ${CONSOLE_HUE})`, color: "oklch(0.99 0.02 20)", boxShadow: "0 2px 5px oklch(0 0 0 / 0.5)" }}
          >
            <X className="size-3.5" />
          </button>
        </Glued>
      </g>
    </svg>
  );
}

/**
 * Where a slab's main row of chips goes. Far enough out that a second row,
 * one chip further in, still clears the caption engraved by the hole; near
 * enough in that the chips at the ends of the row stay inside the square.
 */
const chipsAt = (s: Slab) => s.rings.mid + (s.rings.reach - s.rings.mid) * 0.56;
/** The middle of a whole quadrant, for a button that is the whole quadrant. */
const centreOf = (s: Slab, rIn: number, rOut: number | "edge") => middleOf(s.from, s.to, rIn, rOut, s.shape, s.rings, 0.5);

/* ------------------------------------------------------------------ */
/* Hue                                                                 */
/* ------------------------------------------------------------------ */

/** Below this a colour is a grey wearing a hue, which is what read as broken. */
const LIVE = 0.14;

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
  const named = current && (ROLES as readonly string[]).includes(current);
  const set = (value: string | null) => {
    const next: Record<string, string> = { ...(colour ?? {}) };
    if (value === null) delete next[role];
    else next[role] = value;
    onChange(Object.values(next).some(Boolean) ? next : null);
  };
  const shown = current && !named ? current : palette[role];
  const c = parseColor(shown) ?? { l: 0.7, c: 0.18, h: 265 };

  const [spec, targets, roles] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, mid, reach } = spec.rings;
  // The arcs sit a little inside the slab's own seams.
  const pad = 0.012;
  const sFrom = spec.from + pad;
  const sTo = spec.to - pad;
  const half = (sFrom + sTo) / 2;

  const targetItems: ArcItem[] = [
    { id: "", label: "Follow the site", style: { background: "oklch(0.3 0.05 20)" }, glyph: <X className="size-3.5" style={{ color: "oklch(0.95 0.03 20)" }} /> },
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
    style: { background: colour?.[r] && !(ROLES as readonly string[]).includes(colour[r]!) ? colour[r]! : palette[(colour?.[r] as RoleId) ?? r] ?? palette[r] },
  }));
  const sharing = slabs.length < 3;

  return (
    <>
      {/* the spectrum slab: hue on the inner band, light and strength outside */}
      <ArcSlider
        slab={spec}
        from={sFrom}
        to={sTo}
        rIn={hole + 12}
        rOut={mid - 8}
        label="Hue"
        value={(((c.h % 360) + 360) % 360) / 360}
        colourAt={(f) => oklchCss({ l: 0.7, c: 0.19, h: f * 360 })}
        onChange={(f) => set(oklchCss({ ...c, c: Math.max(c.c, LIVE), h: f * 360 }))}
      />
      <ArcSlider
        slab={spec}
        from={sFrom}
        to={half - 0.006}
        rIn={mid + 4}
        rOut={reach - 10}
        label="Lightness"
        value={(c.l - 0.08) / 0.9}
        colourAt={(f) => oklchCss({ ...c, l: 0.08 + f * 0.9 })}
        onChange={(f) => set(oklchCss({ ...c, l: 0.08 + f * 0.9 }))}
      />
      <ArcSlider
        slab={spec}
        from={half + 0.006}
        to={sTo}
        rIn={mid + 4}
        rOut={reach - 10}
        label="Strength"
        value={Math.min(1, c.c / 0.32)}
        colourAt={(f) => oklchCss({ ...c, c: f * 0.32 })}
        onChange={(f) => set(oklchCss({ ...c, c: f * 0.32 }))}
      />
      <Glued at={[0, 0]} spin={spec.spin} w={64} h={22}>
        <span
          className="rounded-full px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider"
          style={{ background: "oklch(0.22 0.04 20 / 0.9)", color: "oklch(0.96 0.04 20)", boxShadow: "0 1px 3px oklch(0 0 0 / 0.5)" }}
        >
          {ROLE_LABEL[role]}
        </span>
      </Glued>

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
  const wearing = value && value !== "none";
  const [pick, add, drop] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, mid } = pick.rings;
  const sharing = slabs.length < 3;
  const addD = sharing ? piece(add.from, add.to, hole, mid, add.shape, add.rings) : piece(add.from, add.to, hole, "edge", add.shape, add.rings);
  const dropD = sharing ? piece(drop.from, drop.to, mid, "edge", drop.shape, drop.rings) : piece(drop.from, drop.to, hole, "edge", drop.shape, drop.rings);
  const addAt = sharing ? centreOf(add, hole, mid) : centreOf(add, hole, "edge");
  const dropAt = sharing ? centreOf(drop, mid, "edge") : centreOf(drop, hole, "edge");

  return (
    <>
      <ArcChips
        slab={pick}
        radius={chipsAt(pick)}
        value={value ?? "site"}
        onPick={(id) => onChange(id === "site" ? null : id)}
        items={[
          { id: "site", label: "Follow the site", style: { background: "oklch(0.34 0.05 20)" }, glyph: <span className="text-[7px] font-bold" style={{ color: "oklch(0.95 0.03 20)" }}>SITE</span> },
          { id: "none", label: "No texture", style: { background: "oklch(0.24 0.03 20)" }, glyph: <X className="size-3.5" style={{ color: "oklch(0.9 0.03 20)" }} /> },
          ...layers.map((l, i): ArcItem => ({
            id: l.id,
            label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`,
            style: tile(l),
          })),
        ]}
      />
      <Caption slab={pick}>{layers.length ? "Site stack" : "No site stack"}</Caption>

      <SectorButton d={addD} at={addAt} spin={add.spin} label="Add a picture" icon={<ImagePlus className="size-3.5" />} onClick={() => file.current?.click()} />
      <SectorButton
        d={dropD}
        at={dropAt}
        spin={drop.spin}
        label={wearing ? "Take it off the site" : "Nothing to remove"}
        icon={<Trash2 className="size-3.5" />}
        disabled={!wearing}
        onClick={() => {
          if (!wearing) return;
          play("deny");
          useStudio.getState().removeTexture(value);
          onChange(null);
        }}
      />
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

export function AuraQuads({
  slabs, value, palette, onChange,
}: {
  slabs: Slab[];
  value: string | null;
  palette: Palette;
  onChange: (next: string | null) => void;
}) {
  const [pick, none, show] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? null];
  const { hole } = pick.rings;
  const glow = value ? palette[value as RoleId] : null;
  return (
    <>
      <ArcChips
        slab={pick}
        radius={chipsAt(pick)}
        size={30}
        value={value ?? ""}
        onPick={(id) => onChange(id || null)}
        items={ROLES.map((r): ArcItem => ({
          id: r,
          label: `${ROLE_LABEL[r]} aura`,
          // The chip wears the thing it sets: a ring and a glow, not a fill.
          style: {
            background: "oklch(0.24 0.03 20)",
            border: `2px solid ${palette[r]}`,
            boxShadow: `0 0 10px ${palette[r]}, inset 0 0 6px ${palette[r]}`,
          },
        }))}
      />
      <Caption slab={pick}>Glow colour</Caption>
      <SectorButton
        d={piece(none.from, none.to, hole, "edge", none.shape, none.rings)}
        at={centreOf(none, hole, "edge")}
        spin={none.spin}
        label="No aura"
        icon={<X className="size-3.5" />}
        on={!value}
        onClick={() => onChange(null)}
      />
      {show ? (
        <>
          {/* the third slab wears the aura itself, so you see it before you commit */}
          <path
            d={piece(show.from, show.to, hole, "edge", show.shape, show.rings)}
            className="pointer-events-none"
            fill="none"
            stroke={glow ?? "oklch(0.5 0.05 20)"}
            strokeWidth={glow ? 6 : 2}
            strokeLinejoin="round"
            strokeOpacity={glow ? 0.9 : 0.5}
            style={{ filter: glow ? `drop-shadow(0 0 12px ${glow})` : undefined, transition: "stroke 160ms ease-out" }}
          />
          <Caption slab={show}>{glow ? "Like this" : "Nothing yet"}</Caption>
        </>
      ) : null}
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
    <Glued at={at} spin={s.spin} w={w + 32} h={w + 4} className="flex h-full w-full items-center justify-center">
      <div data-ring-plate-box="" className="pointer-events-auto w-full rounded-lg p-2" style={{ background: `oklch(0.34 0.06 ${CONSOLE_HUE})`, boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.14), inset 0 -1px 0 oklch(0 0 0 / 0.3)" }}>
        {children}
      </div>
    </Glued>
  );
}
