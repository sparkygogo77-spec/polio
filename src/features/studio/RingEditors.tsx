"use client";
/**
 * What goes on the ring.
 *
 * One shell (`RingConsole`) and one body per choice. The shell draws the
 * annulus around the green level and hangs the title and the way back off it;
 * a body fills the two bands — choices on the outer one, continuous controls
 * on the inner one, each an arc you drag along.
 *
 * A few of the choices are text — a name, a prompt, a list of contents — and
 * there is no honest way to bend a text field round a curve. Those get
 * `RingPlate`: a flat panel *inscribed in* the ring, sharing its fill and its
 * edge, sitting in the band rather than floating over it. It is the one place
 * a rectangle is allowed, and it is still part of the ring.
 */
import * as React from "react";
import { Check, ImagePlus, Trash2, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { imageFrom, readImage } from "./ImageIntake";
import {
  css as oklchCss, newLayer, parseColor, textureCss, TEXTURE_KINDS, ROLES, ROLE_LABEL,
  type Palette, type RoleId, type TextureLayer,
} from "./look";
import { useStudio } from "./store";
import {
  ArcButton, ArcChips, ArcLabel, ArcSlider, bandsFrom, CONSOLE_HUE, litEdge, onCircle,
  RingPlate, spun, type ArcItem, type RingSpan,
} from "./RingConsole";

export { bandsFrom, CONSOLE_HUE, litEdge };

/** A slice of the ring, as a fraction of the whole span. */
const cut = (span: RingSpan, a: number, b: number): [number, number] => {
  const w = span.to - span.from;
  return [span.from + w * a, span.from + w * b];
};

/* ------------------------------------------------------------------ */
/* The shell                                                           */
/* ------------------------------------------------------------------ */

export function RingConsole({
  span, title, onBack, onGrip, children,
}: {
  span: RingSpan;
  title: string;
  onBack: () => void;
  /** Press the bare ring and drag to shove the whole menu clear of the part. */
  onGrip?: (e: React.PointerEvent) => void;
  children: React.ReactNode;
}) {
  // The title sits on the outside of the outer band at the middle of the
  // sweep; the way back sits on the seam where the ring meets the green.
  const mid = (span.from + span.to) / 2;
  const back = spun(onCircle(span.from + 0.012, span.bands.b1 + 22), span.spin);
  return (
    <>
      <RingPlate span={span} onGrip={onGrip} />
      <ArcLabel span={span} at={mid} radius={span.bands.b1 + 26} width={150}>
        {title}
      </ArcLabel>
      {children}
      <button
        type="button"
        aria-label="Back to the menu"
        onClick={() => { play("close"); onBack(); }}
        className="pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
        style={{
          left: back[0],
          top: back[1],
          background: `oklch(0.62 0.21 ${CONSOLE_HUE})`,
          color: "oklch(0.99 0.02 20)",
          boxShadow: litEdge(CONSOLE_HUE),
        }}
      >
        <X className="size-3.5" />
      </button>
    </>
  );
}

/**
 * The one rectangle, and it is inside the ring.
 *
 * Inscribed in the band opposite the green level, wearing the ring's own fill
 * and edge. For a name or a paragraph there is nothing else honest to do: a
 * word bent round a curve is a logo, and a text field bent round one is not a
 * text field at all.
 */
export function RingPlateBox({ span, children }: { span: RingSpan; children: React.ReactNode }) {
  const mid = (span.from + span.to) / 2;
  const at = spun(onCircle(mid, (span.bands.a0 + span.bands.b1) / 2), span.spin);
  return (
    <div
      data-ring-plate-box=""
      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-xl p-2.5"
      style={{
        left: at[0],
        top: at[1],
        width: 210,
        background: "oklch(0.33 0.02 20)",
        border: `1px solid oklch(0.5 0.16 ${CONSOLE_HUE})`,
        boxShadow: litEdge(CONSOLE_HUE),
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hue                                                                 */
/* ------------------------------------------------------------------ */

/** Below this a colour is a grey wearing a hue, which is what read as broken. */
const LIVE = 0.14;

export function HueRing({
  span, colour, palette, onChange,
}: {
  span: RingSpan;
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

  const [roleArc, hueArc, lightArc, chromaArc] = [
    cut(span, 0, 0.3),
    cut(span, 0.32, 0.64),
    cut(span, 0.66, 0.82),
    cut(span, 0.84, 1),
  ];
  const { a0, a1, b0, b1 } = span.bands;

  return (
    <>
      {/* what to set it to: the site again, or one of the six */}
      <ArcChips
        span={span}
        radius={b1 - 16}
        value={named ? current : current ? null : ""}
        onPick={(id) => set(id === "" ? null : id)}
        items={[
          { id: "", label: "Follow the site", style: { background: "oklch(0.3 0.03 20)" }, glyph: <X className="size-3.5" style={{ color: "oklch(0.95 0.03 20)" }} /> },
          ...ROLES.map((r): ArcItem => ({
            id: r,
            label: `Use the site's ${ROLE_LABEL[r].toLowerCase()}`,
            style: { background: palette[r] },
            glyph: current === r ? <Check className="size-3.5" style={{ color: "oklch(0.99 0 0)", mixBlendMode: "difference" }} /> : undefined,
          })),
        ]}
      />

      {/* which of this part's six you are painting */}
      <ArcChips
        span={{ ...span, from: roleArc[0], to: roleArc[1] }}
        radius={a0 + 12}
        size={20}
        value={role}
        onPick={(id) => setRole(id as RoleId)}
        items={ROLES.map((r): ArcItem => ({
          id: r,
          label: `${ROLE_LABEL[r]} on this part`,
          style: { background: colour?.[r] && !(ROLES as readonly string[]).includes(colour[r]!) ? colour[r]! : palette[(colour?.[r] as RoleId) ?? r] ?? palette[r] },
        }))}
      />
      <ArcLabel span={span} at={(roleArc[0] + roleArc[1]) / 2} radius={a0 - 20} width={92}>
        {ROLE_LABEL[role]}
      </ArcLabel>

      <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
        {/* the spectrum, bent round the band */}
        <ArcSlider
          span={span}
          from={hueArc[0]}
          to={hueArc[1]}
          rIn={a0}
          rOut={a1}
          label="Hue"
          value={((c.h % 360) + 360) % 360 / 360}
          colourAt={(f) => oklchCss({ l: 0.7, c: 0.19, h: f * 360 })}
          onChange={(f) => set(oklchCss({ ...c, c: Math.max(c.c, LIVE), h: f * 360 }))}
        />
        <ArcSlider
          span={span}
          from={lightArc[0]}
          to={lightArc[1]}
          rIn={a0}
          rOut={a1}
          label="Lightness"
          value={(c.l - 0.08) / 0.9}
          colourAt={(f) => oklchCss({ ...c, l: 0.08 + f * 0.9 })}
          onChange={(f) => set(oklchCss({ ...c, l: 0.08 + f * 0.9 }))}
        />
        <ArcSlider
          span={span}
          from={chromaArc[0]}
          to={chromaArc[1]}
          rIn={a0}
          rOut={a1}
          label="Strength"
          value={Math.min(1, c.c / 0.32)}
          colourAt={(f) => oklchCss({ ...c, c: f * 0.32 })}
          onChange={(f) => set(oklchCss({ ...c, c: f * 0.32 }))}
        />
      </svg>
      <ArcLabel span={span} at={(hueArc[0] + hueArc[1]) / 2} radius={a0 - 20} width={80}>Colour</ArcLabel>
      <ArcLabel span={span} at={(lightArc[0] + lightArc[1]) / 2} radius={a0 - 20} width={64}>Light</ArcLabel>
      <ArcLabel span={span} at={(chromaArc[0] + chromaArc[1]) / 2} radius={a0 - 20} width={72}>Strength</ArcLabel>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Texture                                                             */
/* ------------------------------------------------------------------ */

export function TextureRing({
  span, value, layers, palette, onChange,
}: {
  span: RingSpan;
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
  const { a0, a1, b0, b1 } = span.bands;
  const [addArc, dropArc] = [cut(span, 0, 0.5), cut(span, 0.52, 1)];
  const wearing = value && value !== "none";

  return (
    <>
      <ArcChips
        span={span}
        radius={(b0 + b1) / 2}
        value={value ?? "site"}
        onPick={(id) => onChange(id === "site" ? null : id)}
        items={[
          { id: "site", label: "Follow the site", style: { background: "oklch(0.34 0.03 20)" }, glyph: <span className="text-[8px] font-bold" style={{ color: "oklch(0.95 0.03 20)" }}>SITE</span> },
          { id: "none", label: "No texture", style: { background: "oklch(0.24 0.02 20)" }, glyph: <X className="size-3.5" style={{ color: "oklch(0.9 0.03 20)" }} /> },
          ...layers.map((l, i): ArcItem => ({
            id: l.id,
            label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`,
            style: tile(l),
          })),
        ]}
      />
      <svg
        width={1}
        height={1}
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
        onDrop={(e) => {
          const f = imageFrom(e.dataTransfer);
          if (!f) return;
          e.preventDefault();
          void readImage(f).then(take);
        }}
      >
        <ArcButton
          span={span}
          from={addArc[0]}
          to={addArc[1]}
          rIn={a0}
          rOut={a1}
          label="Add a picture"
          icon={<ImagePlus className="size-3" />}
          onClick={() => file.current?.click()}
        />
        <ArcButton
          span={span}
          from={dropArc[0]}
          to={dropArc[1]}
          rIn={a0}
          rOut={a1}
          label={wearing ? "Take it off the site" : "Nothing to remove"}
          icon={<Trash2 className="size-3" />}
          onClick={() => {
            if (!wearing) return;
            play("deny");
            useStudio.getState().removeTexture(value);
            onChange(null);
          }}
        />
      </svg>
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
      <ArcLabel span={span} at={(span.from + span.to) / 2} radius={a0 - 26} width={180}>
        A picture you add joins the site&apos;s stack
      </ArcLabel>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Aura                                                                */
/* ------------------------------------------------------------------ */

export function AuraRing({
  span, value, palette, onChange,
}: {
  span: RingSpan;
  value: string | null;
  palette: Palette;
  onChange: (next: string | null) => void;
}) {
  const { a0, b0, b1 } = span.bands;
  return (
    <>
      <ArcChips
        span={span}
        radius={(b0 + b1) / 2}
        size={34}
        value={value ?? ""}
        onPick={(id) => onChange(id || null)}
        items={[
          { id: "", label: "No aura", style: { background: "oklch(0.26 0.02 20)" }, glyph: <X className="size-4" style={{ color: "oklch(0.92 0.03 20)" }} /> },
          ...ROLES.map((r): ArcItem => ({
            id: r,
            label: `${ROLE_LABEL[r]} aura`,
            // The chip wears the thing it sets: a ring and a glow, not a fill.
            style: {
              background: "oklch(0.24 0.02 20)",
              border: `2px solid ${palette[r]}`,
              boxShadow: `0 0 10px ${palette[r]}, inset 0 0 6px ${palette[r]}`,
            },
          })),
        ]}
      />
      <ArcLabel span={span} at={(span.from + span.to) / 2} radius={a0 - 26} width={200}>
        A hairline and a wide soft glow in that role&apos;s colour
      </ArcLabel>
    </>
  );
}
