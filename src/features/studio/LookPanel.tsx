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
  contrast, css, HARMONIES, harmonise, layerCss, newLayer, parseColor, ROLES, ROLE_LABEL,
  TEXTURE_KINDS, toHex, withAlpha, type BlendMode, type Harmony, type Oklch, type RoleId, type TextureKind,
} from "./look";
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

function Swatch({ layer, palette }: { layer: ReturnType<typeof newLayer>; palette: Record<RoleId, string> }) {
  const built = layerCss(layer, withAlpha(palette[layer.role], layer.opacity));
  return (
    <div
      className="size-9 shrink-0 rounded-md border border-border"
      style={{
        backgroundColor: palette.bg,
        backgroundImage: built?.image,
        backgroundSize: built?.size === "auto" ? undefined : built?.size,
        backgroundBlendMode: layer.blend,
      }}
    />
  );
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
      s().updateTexture(target, { src, kind: "image" });
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
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-fg">Texture</h3>
        <Select
          className="w-28"
          value={look.target}
          onChange={(v) => s().setLook({ target: v as "page" })}
          options={[
            { value: "page", label: "On the page" },
            { value: "surfaces", label: "On surfaces" },
            { value: "both", label: "Both" },
          ]}
          aria-label="Where the texture goes"
        />
      </div>

      {look.texture.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-[10px] leading-snug text-fg-muted">
          Stack layers to build a surface. Everything here is plain CSS, so it tiles for ever and costs nothing to load.
        </p>
      ) : null}

      <div className="space-y-1">
        {look.texture.map((layer, i) => {
          const open = openId === layer.id;
          const kind = TEXTURE_KINDS.find((k) => k.id === layer.kind);
          return (
            <div key={layer.id} className={cn("rounded-md border", open ? "border-accent/60 bg-elevated/60" : "border-border")}>
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
                    {ROLE_LABEL[layer.role]} · {layer.scale}px · {Math.round(layer.opacity * 100)}%
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
                      onChange={(v) => s().updateTexture(layer.id, { kind: v as TextureKind })}
                      options={TEXTURE_KINDS.map((k) => ({ value: k.id, label: k.label }))}
                      aria-label="Texture kind"
                    />
                    <Select
                      value={layer.role}
                      onChange={(v) => s().updateTexture(layer.id, { role: v as RoleId })}
                      options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                      aria-label="Texture colour"
                    />
                  </div>
                  {layer.kind === "image" ? (
                    <ImageWell
                      src={layer.src}
                      onImage={(src) => takeImage(src, layer.id)}
                      onClear={layer.src ? () => s().updateTexture(layer.id, { src: undefined }) : undefined}
                    />
                  ) : null}
                  <Row label="Scale" value={`${layer.scale}px`}>
                    <Slider value={[layer.scale]} min={2} max={400} step={1} onValueChange={(v) => s().updateTexture(layer.id, { scale: v[0] ?? 24 })} />
                  </Row>
                  <Row label="Angle" value={`${layer.angle}°`}>
                    <Slider value={[layer.angle]} min={0} max={180} step={1} onValueChange={(v) => s().updateTexture(layer.id, { angle: v[0] ?? 45 })} />
                  </Row>
                  <Row label="Opacity" value={`${Math.round(layer.opacity * 100)}%`}>
                    <Slider value={[Math.round(layer.opacity * 100)]} min={0} max={100} step={1} onValueChange={(v) => s().updateTexture(layer.id, { opacity: (v[0] ?? 14) / 100 })} />
                  </Row>
                  <Row label="Contrast" value={layer.contrast.toFixed(2)}>
                    <Slider value={[Math.round(layer.contrast * 100)]} min={0} max={100} step={1} onValueChange={(v) => s().updateTexture(layer.id, { contrast: (v[0] ?? 50) / 100 })} />
                  </Row>
                  <Select
                    value={layer.blend}
                    onChange={(v) => s().updateTexture(layer.id, { blend: v as BlendMode })}
                    options={["normal", "multiply", "screen", "overlay", "soft-light", "difference"].map((b) => ({ value: b, label: b }))}
                    aria-label="Blend"
                  />
                  <p className="text-[10px] leading-snug text-fg-faint">{kind?.hint}</p>
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

export function LookPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <ColourSection />
      <TextureSection />
    </div>
  );
}
