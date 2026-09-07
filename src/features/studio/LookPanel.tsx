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
import { ChevronDown, ChevronUp, Copy, Pipette, Plus, Shuffle, Trash2 } from "lucide-react";
import {
  affects, contrast, css, HARMONIES, harmonise, newLayer, parseColor, ROLES, ROLE_LABEL,
  TEXTURE_KINDS, TEXTURE_TARGETS, textureCss, toHex, shiftHue, type BlendMode, type Harmony,
  type Oklch, type Palette, type RoleId, type TextureKind, type TextureLayer, type TextureTarget,
} from "./look";
import { treatImage, treatmentKey } from "./texture";
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
    <section className="space-y-2 border-b border-border p-3">
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
          <Tooltip key={r} content={`${ROLE_LABEL[r]} — ${resolved[r]}`}>
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

function Swatch({ layer, palette }: { layer: TextureLayer; palette: Palette }) {
  // The real compositor, on one layer, so the chip cannot drift from the page.
  const style = textureCss([{ ...layer, on: true }], palette, palette.bg);
  return <div className="size-9 shrink-0 rounded-md border border-border" style={style} />;
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

/**
 * Cooks a picture layer whenever anything that changes the tile changes.
 * Renders nothing — it just keeps `layer.baked` honest.
 */
function Baker({ layer, tint }: { layer: TextureLayer; tint: string }) {
  const done = React.useRef<string | null>(null);
  const treatment = React.useMemo(
    () => ({
      cutout: !!layer.cutout,
      tolerance: layer.tolerance ?? 0.35,
      pattern: !!layer.pattern,
      contrast: layer.contrast,
      tint,
      angle: layer.angle,
      hue: layer.hue ?? 0,
      alpha: layer.opacity,
    }),
    [layer.cutout, layer.tolerance, layer.pattern, layer.contrast, tint, layer.angle, layer.hue, layer.opacity],
  );

  React.useEffect(() => {
    const src = layer.src;
    if (!src) return;
    const key = `${src.length}:${treatmentKey(treatment)}`;
    if (done.current === key) return;
    let live = true;
    // Debounced, because these all sit under sliders.
    const id = window.setTimeout(() => {
      void treatImage(src, treatment)
        .then((baked) => {
          if (!live) return;
          done.current = key;
          useStudio.getState().updateTexture(layer.id, { baked });
        })
        .catch(() => {
          /* an unreadable picture just stays as it came */
        });
    }, 120);
    return () => { live = false; window.clearTimeout(id); };
  }, [layer.id, layer.src, treatment]);

  return null;
}

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

  return (
    <section
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
          const can = affects(layer.kind);
          // A picture only takes the palette colour once it is a pattern.
          const tintable = !picture || !!layer.pattern;
          return (
            <div key={layer.id} className={cn("rounded-md border", open ? "border-accent/60 bg-elevated/60" : "border-border")}>
              {picture && layer.src ? <Baker layer={layer} tint={shiftHue(palette[layer.role], layer.hue ?? 0)} /> : null}
              <div className="flex items-center gap-2 p-1.5">
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

                  {picture ? (
                    <>
                      <ImageWell
                        src={layer.src}
                        onImage={(src) => takeImage(src, layer.id)}
                        onClear={layer.src ? () => s().updateTexture(layer.id, { src: undefined, baked: undefined }) : undefined}
                      />
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
                      {layer.cutout ? (
                        <Row label="How much goes" value={`${Math.round((layer.tolerance ?? 0.35) * 100)}%`}>
                          <Slider
                            value={[Math.round((layer.tolerance ?? 0.35) * 100)]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(v) => s().updateTexture(layer.id, { tolerance: (v[0] ?? 35) / 100 })}
                          />
                        </Row>
                      ) : null}
                      <Row label="Weave" value={(layer.weave ?? 0) < 0.02 ? "tiled" : (layer.weave ?? 0) > 0.98 ? "one picture" : `${Math.round((layer.weave ?? 0) * 100)}%`}>
                        <Slider
                          value={[Math.round((layer.weave ?? 0) * 100)]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(v) => s().updateTexture(layer.id, { weave: (v[0] ?? 0) / 100 })}
                        />
                      </Row>
                    </>
                  ) : null}

                  <Select
                    value={layer.target ?? "page"}
                    onChange={(v) => s().updateTexture(layer.id, { target: v as TextureTarget })}
                    options={TEXTURE_TARGETS}
                    aria-label="Where this layer lands"
                    className="w-full"
                  />
                  <p className="text-[10px] leading-snug text-fg-faint">
                    {WHERE_HINT[layer.target ?? "page"]}
                  </p>
                  <Row label="Hue" value={(layer.hue ?? 0) === 0 ? `${ROLE_LABEL[layer.role]} as is` : `${(layer.hue ?? 0) > 0 ? "+" : ""}${Math.round(layer.hue ?? 0)}°`}>
                    <Slider
                      value={[layer.hue ?? 0]}
                      min={-180}
                      max={180}
                      step={1}
                      onValueChange={(v) => s().updateTexture(layer.id, { hue: v[0] ?? 0 })}
                    />
                  </Row>
                  <Row label={picture ? "Size" : "Scale"} value={`${layer.scale}px`}>
                    <Slider value={[layer.scale]} min={2} max={400} step={1} onValueChange={(v) => s().updateTexture(layer.id, { scale: v[0] ?? 24 })} />
                  </Row>
                  {can.angle ? (
                    <Row label="Angle" value={`${layer.angle}°`}>
                      <Slider value={[layer.angle]} min={0} max={180} step={1} onValueChange={(v) => s().updateTexture(layer.id, { angle: v[0] ?? 45 })} />
                    </Row>
                  ) : null}
                  <Row label="How solid" value={layer.opacity < 0.005 ? "invisible" : `${Math.round(layer.opacity * 100)}%`}>
                    <Slider value={[Math.round(layer.opacity * 100)]} min={0} max={100} step={1} onValueChange={(v) => s().updateTexture(layer.id, { opacity: (v[0] ?? 14) / 100 })} />
                  </Row>
                  <p className="text-[10px] leading-snug text-fg-faint">
                    Turn it down to see the layer underneath — two textures stack, and so does a texture over a colour.
                  </p>
                  {can.contrast && (!picture || layer.pattern) ? (
                    <Row label={picture ? "How much survives" : "Contrast"} value={layer.contrast.toFixed(2)}>
                      <Slider value={[Math.round(layer.contrast * 100)]} min={0} max={100} step={1} onValueChange={(v) => s().updateTexture(layer.id, { contrast: (v[0] ?? 50) / 100 })} />
                    </Row>
                  ) : null}
                  <Select
                    value={layer.blend}
                    onChange={(v) => s().updateTexture(layer.id, { blend: v as BlendMode })}
                    options={BLENDS}
                    aria-label="Blend"
                  />
                  <p className="text-[10px] leading-snug text-fg-faint">
                    {picture
                      ? layer.pattern
                        ? "Painted in the palette, so it scales against the background colour instead of covering it."
                        : "The picture as it came. Turn on painting to make the colour roles and the background apply."
                      : kind?.hint}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="xs" className="w-full" onClick={() => { play("confirm"); s().addTexture(newLayer()); }}>
        <Plus />
        Add a layer
      </Button>
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
  over: "Washed across the finished page, content included. Best kept faint — a grain, a fog, a scan line.",
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
  const pad = React.useRef<HTMLDivElement>(null);

  const place = (e: React.PointerEvent) => {
    const el = pad.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    set({
      on: true,
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
  };

  return (
    <section className="border-t border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-fg">Light &amp; depth</h3>
        <Toggle
          label=""
          hint=""
          checked={light.on}
          onChange={(v) => { play(v ? "confirm" : "close"); set({ on: v }); }}
        />
      </div>

      <div
        ref={pad}
        data-light-pad=""
        role="application"
        aria-label="Where the light is"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); place(e); }}
        onPointerMove={(e) => { if (e.buttons) place(e); }}
        className="relative mb-2 h-24 w-full cursor-crosshair rounded-md border border-border bg-bg"
        style={{
          backgroundImage: light.on
            ? `radial-gradient(120px 90px at ${light.x * 100}% ${light.y * 100}%, oklch(0.95 0.06 ${Math.round(light.warmth)} / 0.5), transparent 70%)`
            : undefined,
        }}
      >
        {/* the page, so you can see where the lamp is in relation to it */}
        <span aria-hidden className="pointer-events-none absolute inset-x-6 inset-y-3 rounded-sm border border-dashed border-border-strong/70" />
        <span
          aria-hidden
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{
            left: `${light.x * 100}%`,
            top: `${light.y * 100}%`,
            borderColor: light.on ? `oklch(0.9 0.13 ${Math.round(light.warmth)})` : "var(--border-strong)",
            background: light.on ? `oklch(0.95 0.1 ${Math.round(light.warmth)} / 0.7)` : "transparent",
            boxShadow: light.on ? `0 0 10px 2px oklch(0.9 0.14 ${Math.round(light.warmth)} / 0.55)` : undefined,
          }}
        />
      </div>

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
