"use client";
/**
 * Look: colour and texture, in one column.
 *
 * Six named roles every part reads, a mixer that works the way a colour picker
 * should (drag the field, spin the hue, type a hex, pull a colour off the
 * screen), and generators that build a whole palette from one seed. Under it, a
 * stack of texture layers — each a generator with a handful of numbers, all
 * compiling to plain CSS so it costs nothing and tiles for ever.
 */
import * as React from "react";
import { ChevronDown, ChevronUp, Copy, Layers2, Pipette, Shuffle, Trash2 } from "lucide-react";
import {
  contrast, css, HARMONIES, harmonise, newLayer, parseColor, ROLES, ROLE_LABEL,
  TEXTURE_KINDS, TEXTURE_TARGETS, textureCss, toHex, lands, type BlendMode, type Harmony,
  type Oklch, type Palette, type RoleId, type TextureKind, type TextureLayer, type TextureTarget,
} from "./look";
import { flattenLayers } from "./texture";
import { CropPicker } from "./CropPicker";
import { Spectrum } from "./MenuConsole";
import { CHIP, emptyFill } from "./colourMenu";
import { resolvePalette } from "./parts/theme";
import { ImageWell, imageFrom, readImage, usePasteImage } from "./ImageIntake";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Tooltip } from "@/core/ui/tooltip";

/* ------------------------------------------------------------------ */
/* The mixer                                                           */
/* ------------------------------------------------------------------ */

/** Lightness × chroma as a draggable field, with a hue strip under it. */
function Mixer({ value, onChange }: { value: Oklch; onChange: (c: Oklch) => void }) {
  const field = React.useRef<HTMLDivElement>(null);
  const drag = (e: React.PointerEvent) => {
    const r = field.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    onChange({ ...value, c: x * 0.32, l: 1 - y });
  };

  // The field is drawn from the live hue, so it always shows what you can reach.
  const stops: string[] = [];
  for (let i = 0; i <= 6; i++) stops.push(css({ l: value.l, c: (i / 6) * 0.32, h: value.h }));

  return (
    <div className="space-y-1.5">
      <div
        ref={field}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag(e); }}
        onPointerMove={(e) => e.buttons === 1 && drag(e)}
        className="relative h-24 w-full cursor-crosshair rounded-md border border-border"
        style={{
          background: `linear-gradient(to top, oklch(0 0 ${value.h}), transparent 50%, oklch(1 0 ${value.h})), linear-gradient(to right, ${stops.join(", ")})`,
        }}
        role="slider"
        aria-label="Lightness and chroma"
        aria-valuetext={`lightness ${Math.round(value.l * 100)}, chroma ${value.c.toFixed(2)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.05 : 0.01;
          if (e.key === "ArrowUp") onChange({ ...value, l: Math.min(1, value.l + step) });
          if (e.key === "ArrowDown") onChange({ ...value, l: Math.max(0, value.l - step) });
          if (e.key === "ArrowRight") onChange({ ...value, c: Math.min(0.37, value.c + step) });
          if (e.key === "ArrowLeft") onChange({ ...value, c: Math.max(0, value.c - step) });
        }}
      >
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
          style={{ left: `${(value.c / 0.32) * 100}%`, top: `${(1 - value.l) * 100}%`, background: css(value) }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        step={1}
        value={Math.round(value.h)}
        aria-label="Hue"
        onChange={(e) => onChange({ ...value, h: Number(e.target.value) })}
        className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
        style={{
          background: `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => css({ l: 0.7, c: 0.16, h: i * 30 })).join(", ")})`,
        }}
      />
    </div>
  );
}

function ContrastBadge({ a, b, label }: { a: string; b: string; label: string }) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const ratio = contrast(ca, cb);
  const ok = ratio >= 4.5;
  const large = ratio >= 3;
  return (
    <Tooltip content={ok ? "Readable at any size" : large ? "Only readable at large sizes" : "Too close to read"}>
      <span className={cn("num rounded-sm px-1 py-0.5 text-[9px]", ok ? "bg-accent-soft text-accent" : large ? "text-fg-muted" : "text-[oklch(0.7_0.19_25)]")}>
        {label} {ratio.toFixed(1)}
      </span>
    </Tooltip>
  );
}

function ColourSection() {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const resolved = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const [role, setRole] = React.useState<RoleId>("accent");
  const [harmony, setHarmony] = React.useState<Harmony>("analogous");
  // The server cannot know whether this browser has an eyedropper, so decide after mount.
  const [canPick, setCanPick] = React.useState(false);
  React.useEffect(() => setCanPick("EyeDropper" in window), []);

  const current = parseColor(resolved[role]) ?? { l: 0.7, c: 0.15, h: 265 };
  const setRoleColour = (c: Oklch) =>
    useStudio.getState().setLook({ palette: { ...look.palette, [role]: css(c) } });

  const generate = () => {
    play("confirm");
    const light = String(format["palette.mode"] ?? "dark") === "light";
    useStudio.getState().setLook({ palette: harmonise(current, harmony, light) });
  };

  const pick = async () => {
    const EyeDropper = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropper) return;
    try {
      const { sRGBHex } = await new EyeDropper().open();
      const c = parseColor(sRGBHex);
      if (c) setRoleColour(c);
    } catch {
      /* cancelled */
    }
  };

  return (
    <section data-look-colour="" className="space-y-2 border-b border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-fg">Colour</h3>
        {look.palette && Object.keys(look.palette).length ? (
          <button type="button" onClick={() => useStudio.getState().setLook({ palette: {} })} className="text-[10px] text-fg-muted hover:text-fg">
            Reset
          </button>
        ) : null}
      </div>

      {/* Six roles. Everything the site draws reads one of these. */}
      <div className="grid grid-cols-6 gap-1">
        {ROLES.map((r) => (
          <Tooltip key={r} content={`${ROLE_LABEL[r]}, ${resolved[r]}`}>
            <button
              type="button"
              aria-label={ROLE_LABEL[r]}
              aria-pressed={role === r}
              onClick={() => { play("select"); setRole(r); }}
              className={cn("h-9 rounded-md border-2 transition-colors", role === r ? "border-accent" : "border-border hover:border-border-strong")}
              style={{ background: resolved[r] }}
            />
          </Tooltip>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-fg-muted">
        <span>{ROLE_LABEL[role]}</span>
        <span className="flex gap-1">
          <ContrastBadge a={resolved.text} b={resolved.bg} label="text" />
          <ContrastBadge a={resolved.accent} b={resolved.bg} label="accent" />
        </span>
      </div>

      <Mixer value={current} onChange={setRoleColour} />

      <div className="flex items-center gap-1">
        <Input
          inputSize="sm"
          className="min-w-0 flex-1"
          value={toHex(current)}
          aria-label={`${ROLE_LABEL[role]} colour`}
          onChange={(e) => {
            const c = parseColor(e.target.value);
            if (c) setRoleColour(c);
          }}
        />
        {canPick ? (
          <Tooltip content="Pick a colour from anywhere on screen">
            <Button variant="outline" size="iconXs" aria-label="Pick a colour" onClick={pick}>
              <Pipette />
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip content="Copy this colour">
          <Button variant="ghost" size="iconXs" aria-label="Copy colour" onClick={() => void navigator.clipboard?.writeText(css(current))}>
            <Copy />
          </Button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1">
        <Select
          className="min-w-0 flex-1"
          value={harmony}
          onChange={(v) => setHarmony(v as Harmony)}
          options={HARMONIES.map((h) => ({ value: h.id, label: h.label }))}
          aria-label="Harmony"
        />
        <Tooltip content={HARMONIES.find((h) => h.id === harmony)?.hint ?? ""}>
          <Button variant="outline" size="xs" onClick={generate}>
            <Shuffle />
            Build palette
          </Button>
        </Tooltip>
      </div>
      <p className="text-[10px] leading-snug text-fg-faint">
        Builds all six roles from {ROLE_LABEL[role].toLowerCase()}. Every part reads these, and any one element can override a role.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The texture stack                                                   */
/* ------------------------------------------------------------------ */

/**
 * A checkerboard, so a hole in a layer looks like a hole.
 *
 * Every swatch used to be painted over the page's background colour, which
 * meant a layer at 20% and a solid chip of tinted background looked the same
 * and you could not tell, from the panel, which of your layers was see-through
 * and which was a lid.
 */
/*
 * This was the one place that had already found the answer, and it is the
 * one the console's five "nothing" chips were given. It moves the other way
 * now: the chequer comes from `colourMenu` so there is one of it, at the
 * same 10px pitch this chose. The two greys are fixed rather than theme
 * variables, because the same chequer has to read as transparent on the
 * near-black console as well as on this panel.
 */
const CHECKS: React.CSSProperties = emptyFill();

function Swatch({ layer, palette }: { layer: TextureLayer; palette: Palette }) {
  // The real compositor, on one layer, over nothing — so the chip shows the
  // layer itself rather than the layer plus a ground it may not have.
  const style = textureCss([{ ...layer, on: true }], palette, "transparent");
  return (
    <div
      className="shrink-0 overflow-hidden border border-border"
      style={{ width: CHIP.far, height: CHIP.far, borderRadius: CHIP.radius.square, ...CHECKS }}
    >
      <div className="size-full" style={style} />
    </div>
  );
}

/**
 * The stack as the page will actually paint it.
 *
 * A column of chips tells you what each layer is and nothing about what they
 * do together, which is the only question worth asking once there is more than
 * one of them. This is the same compositor on the same layers, grouped the way
 * the page groups them — so a layer quietly covering the one beneath it shows
 * up here, in the panel, instead of as a mystery on the board.
 */
function StackPreview({ layers, palette }: { layers: TextureLayer[]; palette: Palette }) {
  const on = layers.filter((l) => l.on);
  const groups = [
    { key: "page" as const, label: "Background", base: palette.bg },
    { key: "surfaces" as const, label: "Surfaces", base: palette.surface },
    { key: "over" as const, label: "Over it all", base: "transparent" },
  ];
  const shown = groups
    .map((g) => ({ ...g, list: on.filter((l) => lands(l, g.key)) }))
    .filter((g) => g.list.length > 0);
  if (!shown.length) return null;
  return (
    <div data-look-stack="" className="space-y-1">
      {shown.map((g) => (
        <div key={g.key} className="flex items-center gap-2">
          <span className="w-[62px] shrink-0 truncate text-[9px] text-fg-muted">{g.label}</span>
          <div className="h-6 min-w-0 flex-1 overflow-hidden rounded border border-border" style={CHECKS}>
            <div className="size-full" style={textureCss(g.list, palette, g.base)} />
          </div>
          <span className="w-10 shrink-0 text-right text-[9px] tabular-nums text-fg-faint">
            {g.list.length} up
          </span>
        </div>
      ))}
    </div>
  );
}

/** Blend modes, named for what they look like rather than for the maths. */
const BLENDS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Darken" },
  { value: "screen", label: "Lighten" },
  { value: "overlay", label: "Punch" },
  { value: "soft-light", label: "Soft" },
  { value: "difference", label: "Invert" },
];

function TextureSection() {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const s = () => useStudio.getState();

  /**
   * An image dropped or pasted anywhere on this section becomes a texture:
   * it replaces the open image layer if there is one, and otherwise arrives
   * as a new layer, so there is nothing to set up before dropping.
   */
  const takeImage = (src: string, id?: string) => {
    const layers = useStudio.getState().look.texture;
    const target = id ?? (openId && layers.find((l) => l.id === openId && l.kind === "image") ? openId : null);
    if (target) {
      s().updateTexture(target, { src, baked: undefined, kind: "image" });
      return;
    }
    const layer = { ...newLayer("image"), src };
    s().addTexture(layer);
    setOpenId(layer.id);
  };
  const [dropping, setDropping] = React.useState(false);
  usePasteImage(true, (src) => takeImage(src));

  /**
   * Bake a layer and the one under it into one picture, in that order. It is
   * painted exactly as the page paints it — same gradients, same blend — and
   * comes back as a tile, so the pair stops being two things you have to keep
   * in your head.
   */
  const [merging, setMerging] = React.useState<string | null>(null);
  const merge = async (id: string) => {
    const layers = useStudio.getState().look.texture;
    const i = layers.findIndex((l) => l.id === id);
    const top = layers[i];
    const under = layers[i + 1];
    if (!top || !under) return;
    setMerging(id);
    const css = textureCss([{ ...top, on: true }, { ...under, on: true }], palette, "transparent");
    const src = await flattenLayers(css);
    setMerging(null);
    if (!src) return;
    play("confirm");
    s().mergeTexture(id, src);
    setOpenId(null);
  };

  return (
    <section
      data-look-texture=""
      className={cn("space-y-2 p-3 transition-colors", dropping && "bg-accent/10")}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        const file = imageFrom(e.dataTransfer);
        setDropping(false);
        if (!file) return;
        e.preventDefault();
        void readImage(file).then((src) => takeImage(src));
      }}
    >
      <h3 className="text-[11px] font-semibold text-fg">Texture</h3>

      <StackPreview layers={look.texture} palette={palette} />

      {look.texture.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-[10px] leading-snug text-fg-muted">
          Drop a picture here, or stack a layer. A picture is turned into a pattern you can paint in any
          palette colour, so the background colour always shows through it.
        </p>
      ) : null}

      <div className="space-y-1">
        {look.texture.map((layer, i) => {
          const open = openId === layer.id;
          const kind = TEXTURE_KINDS.find((k) => k.id === layer.kind);
          const picture = layer.kind === "image";
          // A picture only takes the palette colour once it is a pattern.
          const tintable = !picture || !!layer.pattern;
          return (
            <div key={layer.id} className={cn("rounded-md border", open ? "border-accent/60 bg-elevated/60" : "border-border")}>
              <div className="flex items-center gap-1.5 p-1.5">
                <input
                  type="checkbox"
                  checked={layer.on}
                  aria-label={`${kind?.label} on`}
                  onChange={(e) => s().updateTexture(layer.id, { on: e.target.checked })}
                  style={{ accentColor: "var(--accent)" }}
                />
                <Swatch layer={layer} palette={palette} />
                <button type="button" onClick={() => setOpenId(open ? null : layer.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[11px] text-fg">{kind?.label}</span>
                  <span className="block truncate text-[9px] text-fg-muted">
                    {tintable ? ROLE_LABEL[layer.role] : "own colours"} · {WHERE_SHORT[layer.target ?? "page"]} · {Math.round(layer.opacity * 100)}% solid
                  </span>
                </button>
                <Button variant="ghost" size="iconXs" aria-label="Move up" disabled={i === 0} onClick={() => s().moveTexture(layer.id, -1)}>
                  <ChevronUp />
                </Button>
                <Button variant="ghost" size="iconXs" aria-label="Move down" disabled={i === look.texture.length - 1} onClick={() => s().moveTexture(layer.id, 1)}>
                  <ChevronDown />
                </Button>
                <Button variant="ghost" size="iconXs" aria-label="Remove layer" onClick={() => s().removeTexture(layer.id)}>
                  <Trash2 />
                </Button>
              </div>

              {open ? (
                <div className="space-y-2 border-t border-border p-2">
                  <div className="grid grid-cols-2 gap-1">
                    <Select
                      value={layer.kind}
                      onChange={(v) => s().updateTexture(layer.id, { kind: v as TextureKind, baked: undefined })}
                      options={TEXTURE_KINDS.map((k) => ({ value: k.id, label: k.label }))}
                      aria-label="Texture kind"
                    />
                    <Select
                      value={layer.role}
                      onChange={(v) => s().updateTexture(layer.id, { role: v as RoleId })}
                      options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                      aria-label="Texture colour"
                      disabled={!tintable}
                    />
                  </div>

                  {/*
                    The same seven controls, in the same order, on every layer,
                    whatever kind it is. They used to come and go depending on
                    what the kind could use, which meant the panel was a
                    different shape every time you opened one and you could
                    never learn where anything was. Every kind takes all of
                    them now, see `layerCss`.
                  */}
                  <Select
                    value={layer.target ?? "page"}
                    onChange={(v) => s().updateTexture(layer.id, { target: v as TextureTarget })}
                    options={TEXTURE_TARGETS}
                    aria-label="Where this layer lands"
                    className="w-full"
                  />
                  <p className="text-[10px] leading-snug text-fg-faint">{WHERE_HINT[layer.target ?? "page"]}</p>

                  <Row label="How solid" value={layer.opacity < 0.005 ? "invisible" : `${Math.round(layer.opacity * 100)}%`}>
                    <Slider value={[Math.round(layer.opacity * 100)]} min={0} max={100} step={1} onValueChange={(v) => s().updateTexture(layer.id, { opacity: (v[0] ?? 14) / 100 })} aria-label="How solid" />
                  </Row>
                  {/*
                    A colour of this layer's own, off the spectrum.

                    Six palette roles is the right answer for a texture meant
                    to follow the site, and the wrong answer for the thing
                    people reach for first, a flat ground in a colour they
                    already have in mind, which could not be said at all.
                  */}
                  {tintable ? (
                    <div className="rounded-md border border-border p-2">
                      <Spectrum
                        value={layer.colour ?? palette[layer.role]}
                        onChange={(colour) => s().updateTexture(layer.id, { colour })}
                        label="This layer's colour"
                      />
                      {layer.colour ? (
                        <Button
                          variant="outline"
                          size="xs"
                          className="w-full"
                          onClick={() => s().updateTexture(layer.id, { colour: undefined })}
                        >
                          Back to {ROLE_LABEL[layer.role].toLowerCase()}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  <Row label={picture ? "Tile size" : "Scale"} value={`${layer.scale}px`}>
                    <Slider value={[layer.scale]} min={2} max={400} step={1} onValueChange={(v) => s().updateTexture(layer.id, { scale: v[0] ?? 24 })} aria-label="Scale" />
                  </Row>
                  <Row label="Angle" value={`${layer.angle}°`}>
                    <Slider value={[layer.angle]} min={0} max={360} step={1} onValueChange={(v) => s().updateTexture(layer.id, { angle: v[0] ?? 45 })} aria-label="Angle" />
                  </Row>
                  {/*
                    Drift: the same idea as the clouds behind the add disc,
                    tiles of noise laid over each other and moved at different
                    speeds. Every cycle carries a layer a whole number of its
                    own tiles along its own angle, so there is no seam where
                    the loop comes round. A stack at different speeds reads as
                    weather rather than as one thing sliding.
                  */}
                  <Row label="Drift" value={(layer.drift ?? 0) < 0.02 ? "still" : `${Math.round((layer.drift ?? 0) * 100)}%`}>
                    <Slider
                      value={[Math.round((layer.drift ?? 0) * 100)]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(v) => s().updateTexture(layer.id, { drift: (v[0] ?? 0) / 100 })}
                    />
                  </Row>
                  <Row label={layer.kind === "flat" ? "Fade" : picture ? "How much survives" : "Contrast"} value={`${Math.round(layer.contrast * 100)}%`}>
                    <Slider value={[Math.round(layer.contrast * 100)]} min={0} max={100} step={1} onValueChange={(v) => s().updateTexture(layer.id, { contrast: (v[0] ?? 50) / 100 })} aria-label="Contrast" />
                  </Row>
                  <Row label="Hue" value={(layer.hue ?? 0) === 0 ? `${ROLE_LABEL[layer.role]} as is` : `${(layer.hue ?? 0) > 0 ? "+" : ""}${Math.round(layer.hue ?? 0)}°`}>
                    <Slider value={[layer.hue ?? 0]} min={-180} max={180} step={1} onValueChange={(v) => s().updateTexture(layer.id, { hue: v[0] ?? 0 })} aria-label="Layer hue" />
                  </Row>
                  <Select
                    value={layer.blend}
                    onChange={(v) => s().updateTexture(layer.id, { blend: v as BlendMode })}
                    options={BLENDS}
                    aria-label="Blend"
                  />
                  <p className="text-[10px] leading-snug text-fg-faint">
                    {layer.kind === "flat"
                      ? "A flat colour. Solid at 0% fade, that is the static background, and it fades away along the angle as you turn it up."
                      : kind?.hint}
                  </p>

                  {i < look.texture.length - 1 ? (
                    <Button
                      variant="outline"
                      size="xs"
                      className="w-full"
                      disabled={merging === layer.id}
                      onClick={() => void merge(layer.id)}
                    >
                      <Layers2 />
                      {merging === layer.id ? "Merging…" : "Merge into the layer below"}
                    </Button>
                  ) : null}

                  {picture ? (
                    <div className="space-y-2 rounded-md border border-border p-2">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">This picture</div>
                      <ImageWell
                        src={layer.src}
                        onImage={(src) => takeImage(src, layer.id)}
                        onClear={layer.src ? () => s().updateTexture(layer.id, { src: undefined, baked: undefined, crop: undefined }) : undefined}
                      />
                      {layer.src ? (
                        <>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">Where the texture is in it</div>
                          <CropPicker
                            src={layer.src}
                            crop={layer.crop}
                            onChange={(crop) => s().updateTexture(layer.id, { crop })}
                          />
                        </>
                      ) : null}
                      <Toggle
                        label="Paint it in the palette"
                        hint="Keeps the shape, drops the picture's own colours, so the background shows through."
                        checked={!!layer.pattern}
                        onChange={(v) => s().updateTexture(layer.id, { pattern: v })}
                      />
                      <Toggle
                        label="Cut out the background"
                        hint="Keys out whatever colour the edges are sitting on."
                        checked={!!layer.cutout}
                        onChange={(v) => s().updateTexture(layer.id, { cutout: v })}
                      />
                      <Row label="How much goes" value={`${Math.round((layer.tolerance ?? 0.35) * 100)}%`}>
                        <Slider
                          value={[Math.round((layer.tolerance ?? 0.35) * 100)]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(v) => s().updateTexture(layer.id, { tolerance: (v[0] ?? 35) / 100 })}
                        />
                      </Row>
                      <Row label="Bleed" value={(layer.weave ?? 0) < 0.02 ? "hard edges" : (layer.weave ?? 0) > 0.98 ? "one picture" : `${Math.round((layer.weave ?? 0) * 100)}%`}>
                        <Slider
                          value={[Math.round((layer.weave ?? 0) * 100)]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(v) => s().updateTexture(layer.id, { weave: (v[0] ?? 0) / 100 })}
                        />
                      </Row>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1">
        {(["flat", "noise", "stripes", "dots", "grid", "mesh"] as TextureKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { play("confirm"); const l = newLayer(k); s().addTexture(l); setOpenId(l.id); }}
            className="tactile rounded-full border border-border px-2 py-0.5 text-[10px] text-fg-muted hover:border-accent hover:text-fg"
          >
            + {TEXTURE_KINDS.find((x) => x.id === k)?.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-fg-faint">
        Layers stack top to bottom, the first is nearest you. Turn one down to see through it, or
        merge it into the one below to bake the pair into a single picture.
      </p>
    </section>
  );
}

const WHERE_SHORT: Record<TextureTarget, string> = {
  page: "background",
  surfaces: "surfaces",
  both: "background + surfaces",
  over: "over all",
};

const WHERE_HINT: Record<TextureTarget, string> = {
  page: "The background and nothing else. Every section, bar and card stays its own opaque colour over it, so it shows in the margins and the gaps.",
  surfaces: "The cards, bars and panels themselves. The page keeps its flat colour.",
  both: "The background and the surfaces, each painted separately, so the two read as different materials.",
  over: "Washed across the finished page, content included. Best kept faint, a grain, a fog, a scan line.",
};

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
        style={{ accentColor: "var(--accent)" }}
      />
      <span className="min-w-0">
        <span className="block text-[10px] text-fg">{label}</span>
        <span className="block text-[9px] leading-snug text-fg-faint">{hint}</span>
      </span>
    </label>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center justify-between text-[10px] text-fg-muted">
        {label}
        <span className="num text-fg-faint">{value}</span>
      </span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The lamp.
 *
 * Drag it around the little page below and every surface on the board relights
 * itself: shadows swing round to point away from it, and the face turned
 * toward it picks up a warm edge. One light for the whole site, because that
 * is what a room has, and because a page whose shadows disagree with each
 * other looks wrong in a way nobody can name.
 */
function LightSection() {
  const light = useStudio((st) => st.look.light);
  const s = () => useStudio.getState();
  const set = (patch: Partial<typeof light>) => s().setLook({ light: { ...useStudio.getState().look.light, ...patch } });

  return (
    <section data-look-light="" className="border-t border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-fg">Light &amp; depth</h3>
        <Toggle
          label=""
          hint=""
          checked={light.on}
          onChange={(v) => { play(v ? "confirm" : "close"); set({ on: v }); }}
        />
      </div>

      {/*
        Where the lamp is, by pointing at it.
        
        There was a thumbnail of the page here with a dot to drag around, which
        is a map of the thing rather than the thing: a lamp two hundred pixels
        wide, read at a glance, told you roughly where the light was and never
        exactly. The button hands the board itself over instead, the workspace
        goes dark but the page, the pointer becomes the light, and you put it
        where you can see it landing.
      */}
      <button
        type="button"
        data-place-light=""
        onClick={() => { play("confirm"); useStudio.getState().setPlacingLight(true); }}
        className="tactile mb-2 flex w-full items-center gap-2 rounded-md border border-border bg-elevated px-2 py-1.5 text-left hover:bg-hover"
      >
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 38% 34%, oklch(1 0.05 ${Math.round(light.warmth)}), oklch(0.86 0.17 ${Math.round(light.warmth)}))`,
            boxShadow: `0 0 8px 2px oklch(0.9 0.16 ${Math.round(light.warmth)} / ${light.on ? 0.6 : 0.15})`,
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-fg">Place the light</span>
          <span className="block truncate text-[10px] text-fg-faint">
            {light.on ? `On the page at ${Math.round(light.x * 100)}%, ${Math.round(light.y * 100)}%` : "Off, pointing at a place turns it on"}
          </span>
        </span>
      </button>

      <Row label="How high it hangs" value={light.height > 0.75 ? "overhead" : light.height > 0.4 ? "at an angle" : "low, raking"}>
        <Slider value={[Math.round(light.height * 100)]} min={0} max={100} step={1} onValueChange={(v) => set({ height: (v[0] ?? 55) / 100 })} />
      </Row>
      <Row label="How far things stand off" value={`${light.lift}px`}>
        <Slider value={[light.lift]} min={0} max={40} step={1} onValueChange={(v) => set({ lift: v[0] ?? 10 })} />
      </Row>
      <Row label="Shadow strength" value={`${Math.round(light.strength * 100)}%`}>
        <Slider value={[Math.round(light.strength * 100)]} min={0} max={100} step={1} onValueChange={(v) => set({ strength: (v[0] ?? 45) / 100 })} />
      </Row>
      <Row label="Warmth" value={`${Math.round(light.warmth)}°`}>
        <Slider value={[Math.round(light.warmth)]} min={0} max={360} step={1} onValueChange={(v) => set({ warmth: v[0] ?? 80 })} />
      </Row>
      {/*
        Kept apart from the rest on purpose. The lamp throws shadows whether or
        not any of its light lands on the background, and wanting the first
        almost never means wanting the second: a warm pool under a palette
        someone chose is the quickest way to make that palette look wrong.
      */}
      <Row label="Light on the page" value={(light.wash ?? 0) > 0.005 ? `${Math.round((light.wash ?? 0) * 100)}%` : "none"}>
        <Slider value={[Math.round((light.wash ?? 0) * 100)]} min={0} max={100} step={1} onValueChange={(v) => set({ wash: (v[0] ?? 0) / 100 })} />
      </Row>
      <p className="text-[10px] leading-snug text-fg-faint">
        Every surface works out its own shadow from where it stands relative to the lamp, so a card on
        the left throws left and one underneath throws almost nothing. The blueprint says where the
        light is, not what each shadow was.
      </p>
    </section>
  );
}

export function LookPanel() {
  return (
    <div data-look-panel="" className="flex h-full min-h-0 flex-col overflow-y-auto">
      <ColourSection />
      <LightSection />
      <TextureSection />
    </div>
  );
}
