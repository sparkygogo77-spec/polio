"use client";
/**
 * The third level of the part menu: a console, not a text box.
 *
 * The first two levels are geometry — arcs you throw the pointer at. The third
 * used to be a small panel with a `<select>` in it, which broke the spell
 * completely: two levels of drawn shapes and then a form. This is the same
 * object continued. The choices ride an **arc** across the top, curving the
 * same way the menu behind it curves; the colour comes off a **spectrum**
 * rather than out of a list; and the buttons sit under the arc where the
 * second level's outer ring would have been.
 *
 * Everything here is one grey slab with a red aura round it and edges that
 * catch the light — a lighter line along the top inside edge, a darker one
 * along the bottom — so a chip reads as a thing with a thickness. The amount
 * is deliberately small: a shade either way, not a bevel.
 */
import * as React from "react";
import { Check, ImagePlus, Trash2, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { imageFrom, readImage, usePasteImage } from "./ImageIntake";
import {
  css as oklchCss, newLayer, parseColor, textureCss, TEXTURE_KINDS, ROLES, ROLE_LABEL,
  type Palette, type RoleId, type TextureLayer,
} from "./look";
import { useStudio } from "./store";

/** The console's own hue. Red, and nothing else on the menu is red by then. */
export const CONSOLE_HUE = 18;

/* ------------------------------------------------------------------ */
/* The shell                                                           */
/* ------------------------------------------------------------------ */

/**
 * A lit edge, in the amount the reader asked for: a shade, not a bevel.
 *
 * Which way it leans depends on the family — red wants the extra weight
 * underneath, green wants the light on top, blue wants the weight underneath
 * again — because the same pair of white and black lines reads differently
 * against a warm face and a cool one.
 */
export function litEdge(hue: number, strong = false): string {
  const warm = hue < 60 || hue > 320;
  const green = hue > 100 && hue < 190;
  const top = green ? 0.34 : warm ? 0.2 : 0.22;
  const bottom = green ? 0.16 : warm ? 0.3 : 0.28;
  const k = strong ? 1.35 : 1;
  return [
    `inset 0 1px 0 oklch(1 0 0 / ${(top * k).toFixed(3)})`,
    `inset 0 -1px 0 oklch(0 0 0 / ${(bottom * k).toFixed(3)})`,
    `inset 1px 0 0 oklch(1 0 0 / ${(top * k * 0.35).toFixed(3)})`,
    `inset -1px 0 0 oklch(0 0 0 / ${(bottom * k * 0.4).toFixed(3)})`,
  ].join(", ");
}

export function Console({
  title, onBack, onGrip, children,
}: {
  title: string;
  onBack: () => void;
  /**
   * The console stands where the wheel stood, so it covers the part it is
   * editing. Its head is the handle you move it clear by — the head only, or
   * dragging the spectrum would drag the whole console with it.
   */
  onGrip?: (e: React.PointerEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          data-console-grip=""
          onPointerDown={onGrip}
          className="flex-1 cursor-grab select-none text-[11px] font-semibold uppercase tracking-[0.14em] active:cursor-grabbing"
          style={{ color: "oklch(0.97 0.05 20)" }}
        >
          {title}
        </span>
        <button
          type="button"
          aria-label="Back to the menu"
          onClick={onBack}
          className="flex size-6 items-center justify-center rounded-full"
          style={{ background: `oklch(0.62 0.21 ${CONSOLE_HUE})`, color: "oklch(0.99 0.02 20)", boxShadow: litEdge(CONSOLE_HUE) }}
        >
          <X className="size-3.5" />
        </button>
      </div>
      {children}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The arc of choices                                                  */
/* ------------------------------------------------------------------ */

export interface ArcItem {
  id: string;
  /** What the chip is filled with — a colour, a compiled texture, anything. */
  style: React.CSSProperties;
  label: string;
  /** Drawn over the fill: a mark for "none", a tick for the one in use. */
  glyph?: React.ReactNode;
}

/**
 * The choices, laid along an arc.
 *
 * A straight row of swatches under a curved menu looks like a different
 * program. Bowing them — and turning each chip to face out of the curve —
 * keeps the console part of the same object, and it is why the saved colours
 * and the saved textures share one rail: whatever this level is picking from,
 * it is picked from up there.
 */
export function ArcRail({
  items, value, onPick, size = 30,
}: {
  items: ArcItem[];
  value: string | null;
  onPick: (id: string) => void;
  size?: number;
}) {
  const n = Math.max(1, items.length);
  // A rainbow, not a ramp: highest in the middle, falling away at both ends,
  // with each chip turned to face out of the curve. Fewer chips get a tighter
  // spread so a pair still reads as an arc rather than as a row.
  const spread = Math.min(46, 9 * n);
  const bow = 22;
  return (
    <div data-arc-rail="" className="relative mb-2 flex w-full justify-center" style={{ height: size + bow + 10 }}>
      {items.map((item, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const deg = t * spread;
        const on = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={on}
            data-arc-chip={item.id}
            title={item.label}
            onClick={() => { play("select"); onPick(item.id); }}
            className="absolute flex items-center justify-center rounded-[7px] transition-transform"
            style={{
              width: size,
              height: size,
              left: `calc(50% + ${(t * Math.min(n * (size + 7), 300)).toFixed(1)}px)`,
              top: bow * (2 * t) ** 2 + (on ? 0 : 4),
              transform: `translateX(-50%) rotate(${deg.toFixed(1)}deg) scale(${on ? 1.16 : 1})`,
              ...item.style,
              boxShadow: `${litEdge(CONSOLE_HUE, on)}, 0 2px 5px oklch(0 0 0 / 0.4)`,
              outline: on ? "2px solid oklch(0.98 0.05 20)" : "1px solid oklch(0.28 0.04 20)",
              outlineOffset: on ? 1 : 0,
            }}
          >
            {item.glyph}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The spectrum                                                        */
/* ------------------------------------------------------------------ */

const HUE_BAR = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) => oklchCss({ l: 0.7, c: 0.19, h: i * 30 })).join(", ")})`;

/**
 * The colour picker: a spectrum with a line on it.
 *
 * The white line is where you are; the row of dots under it is the same
 * spectrum in steps, so a colour can be *hit* rather than hunted for. The
 * lightness bar under that is the second axis, because a hue on its own is
 * not a colour and every list of six swatches eventually runs out.
 */
export function Spectrum({
  value, onChange, label = "Colour",
}: {
  value: string;
  onChange: (colour: string) => void;
  label?: string;
}) {
  const parsed = parseColor(value) ?? { l: 0.7, c: 0.18, h: 265 };
  const pick = (clientX: number, el: HTMLElement, apply: (f: number) => void) => {
    const r = el.getBoundingClientRect();
    apply(Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))));
  };
  const drag = (e: React.PointerEvent<HTMLDivElement>, apply: (f: number) => void) => {
    const el = e.currentTarget;
    pick(e.clientX, el, apply);
    const move = (m: PointerEvent) => pick(m.clientX, el, apply);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  /*
   * Picking off the bar gives you the colour on the bar.
   *
   * The hue slider used to change only the hue, so hitting the orange end of
   * the spectrum while the current colour was a near-grey background handed
   * back another near-grey — the right hue at a chroma of 0.01, which is to
   * say no colour at all, and the control read as broken. A hue pick lifts a
   * washed-out colour far enough to be the thing you just clicked; the bar
   * under it is there to take it back down again.
   */
  const LIVE = 0.14;
  const setHue = (f: number) => onChange(oklchCss({ ...parsed, c: Math.max(parsed.c, LIVE), h: f * 360 }));
  const setLight = (f: number) => onChange(oklchCss({ ...parsed, l: 0.08 + f * 0.9 }));
  const setChroma = (f: number) => onChange(oklchCss({ ...parsed, c: f * 0.32 }));

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "oklch(0.9 0.05 20)" }}>{label}</span>
        <span
          className="size-4 rounded-[4px]"
          style={{ background: value, boxShadow: litEdge(CONSOLE_HUE), outline: "1px solid oklch(0.3 0.04 20)" }}
        />
      </div>
      {/* the spectrum, and the white line that says where on it you are */}
      <div
        data-spectrum=""
        role="slider"
        tabIndex={0}
        aria-label={`${label} hue`}
        aria-valuenow={Math.round(parsed.h)}
        aria-valuemin={0}
        aria-valuemax={360}
        onPointerDown={(e) => drag(e, setHue)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setHue((((parsed.h + 355) % 360) / 360));
          if (e.key === "ArrowRight") setHue((((parsed.h + 5) % 360) / 360));
        }}
        className="relative h-4 cursor-pointer rounded-full"
        style={{ background: HUE_BAR, boxShadow: litEdge(CONSOLE_HUE) }}
      >
        <span
          className="pointer-events-none absolute top-[-2px] h-[20px] w-[3px] rounded-full bg-white"
          style={{ left: `calc(${((parsed.h % 360) / 360) * 100}% - 1.5px)`, boxShadow: "0 0 0 1px oklch(0 0 0 / 0.5)" }}
        />
      </div>
      {/* the same spectrum in steps, so a colour can be hit rather than hunted */}
      <div className="mt-1 flex justify-between">
        {Array.from({ length: 12 }, (_, i) => {
          const h = i * 30;
          // How far apart two hues are on a wheel that wraps: the short way
          // round, never the long one.
          const raw = Math.abs(parsed.h - h) % 360;
          const near = Math.min(raw, 360 - raw) < 16;
          return (
            <button
              key={h}
              type="button"
              aria-label={`Hue ${h}`}
              onClick={() => { play("tap"); onChange(oklchCss({ ...parsed, c: Math.max(parsed.c, LIVE), h })); }}
              className="size-[9px] rounded-full transition-transform"
              style={{
                background: oklchCss({ l: Math.max(0.35, Math.min(0.85, parsed.l)), c: Math.max(LIVE, parsed.c), h }),
                transform: near ? "scale(1.5)" : undefined,
                outline: near ? "1px solid oklch(0.98 0.03 20)" : "none",
              }}
            />
          );
        })}
      </div>
      {/* how light it is: a hue on its own is not a colour */}
      <div
        data-lightness=""
        role="slider"
        tabIndex={0}
        aria-label={`${label} lightness`}
        aria-valuenow={Math.round(parsed.l * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={(e) => drag(e, setLight)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(oklchCss({ ...parsed, l: Math.max(0.04, parsed.l - 0.04) }));
          if (e.key === "ArrowRight") onChange(oklchCss({ ...parsed, l: Math.min(0.99, parsed.l + 0.04) }));
        }}
        className="relative mt-1.5 h-3 cursor-pointer rounded-full"
        style={{
          background: `linear-gradient(90deg, ${oklchCss({ ...parsed, l: 0.08 })}, ${oklchCss({ ...parsed, l: 0.53 })}, ${oklchCss({ ...parsed, l: 0.98 })})`,
          boxShadow: litEdge(CONSOLE_HUE),
        }}
      >
        <span
          className="pointer-events-none absolute top-[-2px] h-4 w-[3px] rounded-full bg-white"
          style={{ left: `calc(${(((parsed.l - 0.08) / 0.9) * 100).toFixed(1)}% - 1.5px)`, boxShadow: "0 0 0 1px oklch(0 0 0 / 0.5)" }}
        />
      </div>
      {/* and how much of it there is: grey at one end, as far as the screen
          goes at the other */}
      <div
        data-chroma=""
        role="slider"
        tabIndex={0}
        aria-label={`${label} strength`}
        aria-valuenow={Math.round((parsed.c / 0.32) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={(e) => drag(e, setChroma)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(oklchCss({ ...parsed, c: Math.max(0, parsed.c - 0.02) }));
          if (e.key === "ArrowRight") onChange(oklchCss({ ...parsed, c: Math.min(0.32, parsed.c + 0.02) }));
        }}
        className="relative mt-1.5 h-3 cursor-pointer rounded-full"
        style={{
          background: `linear-gradient(90deg, ${oklchCss({ ...parsed, c: 0 })}, ${oklchCss({ ...parsed, c: 0.32 })})`,
          boxShadow: litEdge(CONSOLE_HUE),
        }}
      >
        <span
          className="pointer-events-none absolute top-[-2px] h-4 w-[3px] rounded-full bg-white"
          style={{ left: `calc(${Math.min(100, (parsed.c / 0.32) * 100).toFixed(1)}% - 1.5px)`, boxShadow: "0 0 0 1px oklch(0 0 0 / 0.5)" }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The buttons under the arc                                           */
/* ------------------------------------------------------------------ */

export function ConsoleButtons({
  options, value, onPick,
}: {
  options: { id: string; label: string }[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-label={o.label}
            aria-pressed={on}
            data-console-button={o.id}
            onClick={() => { play("select"); onPick(o.id); }}
            className="flex-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold"
            style={{
              background: on ? `oklch(0.68 0.2 ${CONSOLE_HUE})` : "oklch(0.36 0.04 20)",
              color: on ? "oklch(0.16 0.05 20)" : "oklch(0.94 0.03 20)",
              boxShadow: litEdge(CONSOLE_HUE, on),
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hue                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Which of the part's six roles you are painting, what to paint it, and the
 * spectrum to paint it from.
 *
 * The rail carries the site's own six colours: naming one keeps the part
 * inside the palette, which is the right answer nine times in ten and is why
 * they come first. The spectrum underneath is the tenth.
 */
export function HueConsole({
  colour, palette, onChange,
}: {
  colour: Record<string, string> | null;
  palette: Palette;
  onChange: (next: Record<string, string> | null) => void;
}) {
  const [role, setRole] = React.useState<RoleId>("bg");
  const current = colour?.[role] ?? "";
  const set = (value: string | null) => {
    const next: Record<string, string> = { ...(colour ?? {}) };
    if (value === null) delete next[role];
    else next[role] = value;
    onChange(Object.values(next).some(Boolean) ? next : null);
  };
  const shown = current && !(ROLES as readonly string[]).includes(current) ? current : palette[role];

  return (
    <>
      <ArcRail
        items={[
          { id: "", label: "Follow the site", style: { background: "oklch(0.3 0.03 20)" }, glyph: <X className="size-3.5" style={{ color: "oklch(0.95 0.03 20)" }} /> },
          ...ROLES.map((r) => ({
            id: r,
            label: `Use the site's ${ROLE_LABEL[r].toLowerCase()}`,
            style: { background: palette[r] },
            glyph: current === r ? <Check className="size-3.5" style={{ color: "oklch(0.99 0 0)", mixBlendMode: "difference" as const }} /> : undefined,
          })),
        ]}
        value={current && (ROLES as readonly string[]).includes(current) ? current : current ? null : ""}
        onPick={(id) => set(id === "" ? null : id)}
      />
      <div className="mb-2">
        <div className="mb-1 text-[9px] uppercase tracking-wider" style={{ color: "oklch(0.9 0.05 20)" }}>
          Painting
        </div>
        <div className="grid grid-cols-6 gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              aria-label={`${ROLE_LABEL[r]} on this part`}
              aria-pressed={role === r}
              title={ROLE_LABEL[r]}
              onClick={() => { play("select"); setRole(r); }}
              className="relative h-6 rounded-[5px]"
              style={{
                background: colour?.[r] && !(ROLES as readonly string[]).includes(colour[r]!) ? colour[r] : palette[(colour?.[r] as RoleId) ?? r] ?? palette[r],
                boxShadow: litEdge(CONSOLE_HUE, role === r),
                outline: role === r ? "2px solid oklch(0.98 0.05 20)" : "1px solid oklch(0.3 0.04 20)",
              }}
            >
              {colour?.[r] ? <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full" style={{ background: "oklch(0.98 0.05 20)" }} /> : null}
            </button>
          ))}
        </div>
      </div>
      <Spectrum value={shown} onChange={(v) => set(v)} label={ROLE_LABEL[role]} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Texture                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every texture the site has, along the arc, plus a well to drop a new one in.
 *
 * A dropped picture becomes a layer on the site's own stack, so it lands in
 * the rail beside the rest and every other part can wear it too. That is the
 * "saved" section: there is no separate library, the site's stack *is* the
 * library.
 */
export function TextureConsole({
  value, layers, palette, onChange,
}: {
  value: string | null;
  layers: TextureLayer[];
  palette: Palette;
  onChange: (next: string | null) => void;
}) {
  const [dropping, setDropping] = React.useState(false);
  const take = (src: string) => {
    const layer = { ...newLayer("image"), src, target: "surfaces" as const };
    useStudio.getState().addTexture(layer);
    play("confirm");
    onChange(layer.id);
  };
  usePasteImage(true, take);

  const tile = (l: TextureLayer): React.CSSProperties => {
    const css = textureCss([{ ...l, on: true }], palette, palette.surface);
    return { ...css, backgroundSize: css.backgroundSize ?? "cover" };
  };

  return (
    <>
      <ArcRail
        items={[
          { id: "site", label: "Follow the site", style: { background: "oklch(0.34 0.03 20)" }, glyph: <span className="text-[8px] font-bold" style={{ color: "oklch(0.95 0.03 20)" }}>SITE</span> },
          { id: "none", label: "No texture", style: { background: "oklch(0.24 0.02 20)" }, glyph: <X className="size-3.5" style={{ color: "oklch(0.9 0.03 20)" }} /> },
          ...layers.map((l, i) => ({
            id: l.id,
            label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`,
            style: tile(l),
          })),
        ]}
        value={value ?? "site"}
        onPick={(id) => onChange(id === "site" ? null : id)}
      />

      {/* the well: a picture dropped here joins the site's stack */}
      <label
        data-texture-well=""
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          const file = imageFrom(e.dataTransfer);
          setDropping(false);
          if (!file) return;
          e.preventDefault();
          void readImage(file).then(take);
        }}
        className={cn("mb-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-[10px]")}
        style={{
          borderColor: dropping ? "oklch(0.85 0.16 20)" : "oklch(0.5 0.1 20)",
          background: dropping ? "oklch(0.4 0.1 20)" : "oklch(0.3 0.03 20)",
          color: "oklch(0.93 0.03 20)",
          boxShadow: litEdge(CONSOLE_HUE),
        }}
      >
        <ImagePlus className="size-3.5" />
        Drop or choose a picture — it joins the saved row
        <input
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Add a texture"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readImage(file).then(take);
            e.target.value = "";
          }}
        />
      </label>

      {value && value !== "none" ? (
        <button
          type="button"
          aria-label="Remove this texture from the site"
          onClick={() => { play("deny"); useStudio.getState().removeTexture(value); onChange(null); }}
          className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-[10px] font-semibold"
          style={{ background: "oklch(0.36 0.04 20)", color: "oklch(0.94 0.03 20)", boxShadow: litEdge(CONSOLE_HUE) }}
        >
          <Trash2 className="size-3" />
          Take it off the site
        </button>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Aura                                                                */
/* ------------------------------------------------------------------ */

/** The glow round a part's edge: none, or one of the six, shown glowing. */
export function AuraConsole({
  value, palette, onChange,
}: {
  value: string | null;
  palette: Palette;
  onChange: (next: string | null) => void;
}) {
  return (
    <>
      <ArcRail
        size={34}
        items={[
          { id: "", label: "No aura", style: { background: "oklch(0.26 0.02 20)" }, glyph: <X className="size-4" style={{ color: "oklch(0.92 0.03 20)" }} /> },
          ...ROLES.map((r) => ({
            id: r,
            label: `${ROLE_LABEL[r]} aura`,
            style: {
              background: "oklch(0.24 0.02 20)",
              // The chip wears the thing it sets: a ring and a glow, not a fill.
              border: `2px solid ${palette[r]}`,
              boxShadow: `0 0 10px ${palette[r]}, inset 0 0 6px ${palette[r]}`,
            } as React.CSSProperties,
          })),
        ]}
        value={value ?? ""}
        onPick={(id) => onChange(id || null)}
      />
      <p className="text-[10px] leading-snug" style={{ color: "oklch(0.9 0.05 20)" }}>
        A hairline and a wide soft glow in that role&apos;s colour, round this part only. It follows the
        palette, so a later change to the palette carries through.
      </p>
    </>
  );
}
