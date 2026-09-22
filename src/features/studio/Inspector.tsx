"use client";
/**
 * The per-element prompt panel — the point of the whole exercise. Whatever is
 * selected gets its own instructions, and those instructions travel with its
 * position on the canvas into the brief.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { AlignCenter, AlignLeft, AlignRight, Box, Brush, ClipboardPaste, Frame, Grid2x2, Group, Layers, Lightbulb, Link2, Lock, MousePointerClick, Paintbrush, Palette as PaletteIcon, Pencil, Play, Scissors, SlidersHorizontal, Sparkles, SunDim, Trash2, Type, Unlock, Wand2 } from "lucide-react";
import { getFeature, categoryOf, type FeatureOption } from "./catalog";
import { isLinkable } from "./parts";
import { lands, speedWord, type Look } from "./look";
import type { FormatValues } from "./format";
import { BACKGROUND_ID, heldBackground, HUES, NODE_SHAPES, pageGroups, pageNodes, pageShapes, activePage, useStudio , type StudioNode } from "./store";
import { drop as dropPicture, put as putPicture, usePicture } from "./pictures";
import { RENDER_COST } from "./renderer";
import { rendererHeader } from "./agent";
import { ColourOverride } from "./ColourOverride";
import { AuditPanel, AuditReadout } from "./AuditPanel";
import { CUBE_SIDES, emptyFace, written } from "./parts/cubeFaces";
import { makeSolid, showCube, showSolid, solidModel } from "./solidRun";
import { rendererReady } from "./agent";
import { useKeys } from "@/features/keys/store";
import { ROLE_MEANS, ROLES, simplify, weigh, type VectorRole } from "./vector";
import { resolvePalette } from "./parts/theme";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Segmented } from "@/core/ui/segmented";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Badge } from "@/core/ui/badge";
import { EmptyState } from "@/core/ui/empty-state";
import { Tooltip } from "@/core/ui/tooltip";
import { VirtualList } from "@/core/ui/virtual-list";
import { linkReason } from "./links";

export const GLYPHS = ["✦", "◆", "▲", "●", "✱", "❖", "☾", "⚡", "🌀", "🔮", "🧩", "🎛", "🪄", "🛰", "🧪", "🎚"];

/**
 * A set option: every preset on offer as a chip, the ones that are on filled
 * in. Click to add, click to take away — which is what "these social links,
 * not those" wants to be, and what a dropdown can never say.
 */
export /**
 * A range option: one slider and the number it is on.
 *
 * How big, how far over, what colour, how much glow — none of those is a
 * short list of names, and a list of five sizes is a list of five
 * compromises. The value is stored as a string like every other option, so
 * nothing downstream has to know this control exists.
 */
function OptionRange({ option, value, onChange }: { option: FeatureOption; value: string | undefined; onChange: (v: string) => void }) {
  const r = option.range ?? { min: 0, max: 100, step: 1 };
  const fallback = Number.parseFloat(option.values[0] ?? "0") || 0;
  const at = Number.parseFloat(value ?? "");
  const now = Number.isFinite(at) ? Math.max(r.min, Math.min(r.max, at)) : fallback;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-plain text-fg">{option.label}</span>
        <span className="num text-plain text-fg-muted">{now}{r.unit ?? ""}</span>
      </div>
      <Slider
        min={r.min}
        max={r.max}
        step={r.step ?? 1}
        value={[now]}
        aria-label={option.label}
        onValueChange={([v]) => onChange(String(v ?? fallback))}
      />
    </div>
  );
}

function OptionSet({ option, value, onChange }: { option: FeatureOption; value?: string; onChange: (v: string) => void }) {
  const on = React.useMemo(
    () => new Set((value === undefined ? option.preset ?? "" : value).split(",").map((s) => s.trim()).filter(Boolean)),
    [value, option.preset],
  );
  const toggle = (name: string) => {
    const next = new Set(on);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    // Keep the shelf order rather than the click order, so the row is stable.
    onChange(option.values.filter((v) => next.has(v)).join(", "));
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-plain text-fg">{option.label}</span>
        <span className="num text-small text-fg-faint">{on.size} on</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {option.values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={on.has(v)}
            onClick={() => { play(on.has(v) ? "close" : "select"); toggle(v); }}
            className={cn(
              "tactile rounded-full border px-2 py-0.5 text-small",
              on.has(v) ? "border-accent/60 bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * What has been set on a thing, as a row of coloured keys.
 *
 * Every design decision the wheel writes — an entrance, an aura, a font, a
 * colour, a texture, a link, the options, a drawing; the page's fill, veil,
 * colour and layers — is tracked here where it can be seen, each marked
 * with an icon in its own colour, so nothing set on the board is invisible
 * in the panel.
 */
interface Design { icon: React.ReactNode; label: string; hue: number }
function Designs({ items }: { items: Design[] }) {
  if (!items.length) return null;
  return (
    <div data-designs="" className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
      {items.map((it, i) => (
        <span key={i} data-design="" className="flex h-5 items-center gap-1 rounded-[4px] bg-elevated pl-0.5 pr-1.5 text-small text-fg" style={{ border: "1px solid var(--border)" }}>
          <span className="flex size-4 items-center justify-center rounded-[3px] [&_svg]:size-2.5" style={{ background: `oklch(0.66 0.17 ${it.hue})`, color: "oklch(0.99 0 0)" }}>
            {it.icon}
          </span>
          {it.label}
        </span>
      ))}
    </div>
  );
}
function nodeDesigns(n: StudioNode): Design[] {
  const out: Design[] = [];
  if (n.anim) out.push({ icon: <Play />, label: `${n.anim.replace(/^el-/, "")} · ${speedWord(n.animSpeed)}`, hue: 205 });
  if (n.aura) out.push({ icon: <Sparkles />, label: `aura · ${n.auraStyle}`, hue: 330 });
  if (n.font) out.push({ icon: <Type />, label: n.font.face ?? n.font.family ?? "type", hue: 62 });
  if (n.colour && Object.keys(n.colour).length) out.push({ icon: <PaletteIcon />, label: "colour", hue: 150 });
  if (n.texture) out.push({ icon: <Grid2x2 />, label: n.texture === "none" ? "no texture" : "texture", hue: 278 });
  if (n.link) out.push({ icon: <Link2 />, label: `links to a ${n.link.kind}`, hue: 22 });
  const opts = Object.keys(n.options ?? {}).length;
  if (opts) out.push({ icon: <SlidersHorizontal />, label: `${opts} option${opts === 1 ? "" : "s"}`, hue: 100 });
  if (n.sketch?.strokes.length) out.push({ icon: <Brush />, label: "drawn", hue: 245 });
  if (n.kind === "cube") out.push({ icon: <Box />, label: "a box, made a cube", hue: 190 });
  if (n.prompt.trim()) out.push({ icon: <Wand2 />, label: "words", hue: 350 });
  return out;
}
function backgroundDesigns(look: Look, format: FormatValues): Design[] {
  const out: Design[] = [];
  const fill = String(format["palette.background"] ?? "flat");
  if (fill !== "flat") out.push({ icon: <Paintbrush />, label: fill, hue: 205 });
  if (look.veil && look.veil > 0.005) out.push({ icon: <SunDim />, label: `veil ${Math.round(look.veil * 100)}%`, hue: 278 });
  if (look.palette.bg) out.push({ icon: <PaletteIcon />, label: "page colour", hue: 150 });
  const layers = (look.texture ?? []).filter((l) => l.on && lands(l, "page")).length;
  if (layers) out.push({ icon: <Layers />, label: `${layers} texture${layers === 1 ? "" : "s"}`, hue: 330 });
  return out;
}

/**
 * The background, picked: what the page is painted with before any part.
 *
 * The fill is the format's own background choice; the layers are the ones
 * in the Looks stack that land on the page, switched here without leaving
 * the board. Cut strips it bare and holds it; put back restores it.
 */
export function BackgroundInspector() {
  const look = useStudio((s) => s.look);
  const format = useStudio((s) => s.format);
  const s = useStudio.getState;
  const fill = String(format["palette.background"] ?? "flat");
  const layers = (look.texture ?? []).filter((l) => lands(l, "page"));
  const held = heldBackground();
  /*
   * A SECTION OF A COLUMN, NOT A PANEL OF ITS OWN.
   *
   * This kept the shape it was born with, back when it WAS the whole of the
   * Element tab: `h-full` on the outside and `flex-1 overflow-y-auto` on the
   * body, which is how you fill a panel. Dropped into the Look column, which
   * is itself a flex column that scrolls, `h-full` had nothing to measure
   * against and the block collapsed — MEASURED at a 227px panel, 9px tall,
   * from y 119 to y 128, with its own contents running on to y 156. So the
   * Background heading was painted at 127 and the Colour heading at 140, two
   * headings sharing a band, and the line "The page behind every part" ran
   * straight through the row of swatches below it.
   *
   * It is not a margin that was wrong; it was the box. A section takes its
   * own height and the column stacks it and does the scrolling, which is
   * what every other section in this panel already does.
   */
  return (
    <section className="border-b border-border" data-background-inspector="">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Layers className="size-3.5 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <div data-look-heading className="text-plain font-semibold text-fg">Background</div>
          <div className="text-small text-fg-muted">The page behind every part</div>
        </div>
        <Tooltip content="Cut the background" shortcut="mod+x">
          <Button variant="ghost" size="iconXs" aria-label="Cut the background" onClick={() => s().cutBackground()}>
            <Scissors />
          </Button>
        </Tooltip>
      </div>
      <Designs items={backgroundDesigns(look, format)} />
      {/*
        ONE PLACE PAINTS THE PAGE, and it is the stack at the foot of this
        panel. His words: the fill options "may be redundant against the
        Texture section at the bottom; merge them in some way rather than
        leaving two places that paint the page."

        What stood here was both halves of the redundancy. The Fill control
        was one of the two places, and under it sat a list of the very same
        page layers the Texture section lists, with a switch each — a second
        remote for a control three inches further down. Both are gone: the
        fill is the bottom row of the stack now, where the page's own order
        puts it, and the layers are switched where they are built.

        What stays here is what is only here: what the page is wearing, at a
        glance, and cut and put back.
      */}
      <div className="p-3">
        <p className="text-small leading-snug text-fg-muted">
          {fill === "flat" ? "Painted flat" : `Painted with a ${fill}`}
          {layers.length ? `, under ${layers.length} texture${layers.length === 1 ? "" : "s"}` : ""}
          . The fill and the layers are one stack, at the foot of this panel.
        </p>
        {held ? (
          <Button size="xs" variant="ghost" className="mt-2" onClick={() => s().pasteBackground()}>
            <ClipboardPaste />
            Put the cut background back
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The picture a part holds: choose one, see it, take it away.
 *
 * WHERE THE BYTES ARE, because it changes what he should expect. Not in the
 * document: a photograph inlined there would share the browser's small
 * storage with his board, his builds and his keys, and take all of them with
 * it when it overflowed. They are in this browser's file storage while he
 * works, and in the repository once he publishes — and the line under the
 * picture says which of those is true right now, because a picture that has
 * only ever been here exists in one place and he is the only one who can
 * know that.
 */

/* ------------------------------------------------------------------ */
/* The row of six                                                      */
/* ------------------------------------------------------------------ */

/**
 * WHAT ELEMENT IS BUILT AGAINST: the wheel, not a form.
 *
 * His complaint was "this element tab does not make sense", and the panel it
 * was said about held 27 labelled fields in a column — the most generic thing
 * a panel can be, and the same thing he meant by "the side panel left side is
 * extremely generic". The wheel is the benchmark he set: everything reachable
 * fast, the most used nearest, colour doing real work, and a control showing
 * what it does rather than naming it.
 *
 * So the panel is a row of six marks and one open field. The order is how
 * often he reaches for them, which he gave himself: prompt, looks, link,
 * size, motion, delete.
 *
 * ON THE COLOURS, because copying the wheel literally would have been wrong.
 * The wheel is one flat blue for all seven pieces on purpose — DESIGN.md:
 * "so the wheel reads as one object" — with red kept for Delete alone. Six
 * blue marks in a row would read as one object too, and this row is not one
 * object: it is six different places to go. So it takes the wheel's RULE
 * rather than its literal hue — colour means where this goes, red is still
 * only Delete — and each mark wears the hue of the thing it opens, the same
 * hues the side-panel tabs use, so the app says one thing twice.
 *
 * EVERY MARK WEARS ITS STATE, which is the "shows what it does" half:
 *
 *   prompt   lit once there are words in it, so an unwritten part says so
 *   looks    painted in the part's OWN colour, so it is a swatch, not a word
 *   link     dim when it points nowhere, lit when it does
 *   size     carries the part's width as a fraction of the frame
 *   motion   plays the part's entrance once when the pointer touches it
 *   delete   the one red thing, as on the wheel
 */
type MarkId = "prompt" | "looks" | "link" | "size" | "motion" | "delete";

const MARK_HUE: Record<Exclude<MarkId, "looks">, number> = {
  /* The wheel's own Write hue. */
  prompt: 258,
  /* Where a thing goes — the hue Pages and Navigation already use. */
  link: 230,
  /* Layout, which is Format's hue. */
  size: 200,
  /* Motion's own hue, in the catalogue and in the tab strip. */
  motion: 170,
  /* The wheel's red, reserved for this and nothing else. */
  delete: 18,
};

function Mark({
  id, label, hue, on, lit, note, icon, onPress, onTouch,
}: {
  id: MarkId; label: string; hue: number; on: boolean; lit: boolean;
  note?: string; icon: React.ReactNode; onPress: () => void; onTouch?: () => void;
}) {
  return (
    <Tooltip content={note ? `${label} — ${note}` : label} side="bottom">
      <button
        type="button"
        data-mark={id}
        data-on={on ? "1" : undefined}
        data-lit={lit ? "1" : undefined}
        aria-label={label}
        aria-pressed={on}
        onClick={onPress}
        onPointerEnter={onTouch}
        className="tactile flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-sm py-1 transition-[background,box-shadow] duration-150"
        style={{
          /* Never drab, on or off: the hue is what the mark IS, so it only
             ever stands back, it does not drain away. A mark with nothing in
             it yet is the same colour at lower light, not grey. */
          color: `oklch(${lit ? 0.84 : 0.66} ${lit ? 0.16 : 0.09} ${hue})`,
          background: on ? `oklch(0.7 0.15 ${hue} / 0.18)` : undefined,
          boxShadow: on ? `inset 0 0 0 1px oklch(0.75 0.15 ${hue} / 0.5)` : undefined,
        }}
      >
        <span className="flex size-4 items-center justify-center">{icon}</span>
        <span className="num text-[8px] leading-none opacity-80">{note ?? "\u00a0"}</span>
      </button>
    </Tooltip>
  );
}

function PictureField({ node }: { node: StudioNode }) {
  const pic = node.picture ?? null;
  const { src, looked } = usePicture(pic);
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [want, setWant] = React.useState("");
  const [drawn, setDrawn] = React.useState<string | null>(null);
  const file = React.useRef<HTMLInputElement>(null);

  /**
   * Draw one with his own key.
   *
   * The same renderer that draws a part's body, asked for a picture instead,
   * and what comes back lands exactly where an uploaded one lands: a file in
   * this browser's storage, a path on the part, and the same publish. What
   * it really cost comes back with it and is said, because the guess before
   * the press was a guess.
   */
  const draw = async () => {
    const say = want.trim();
    if (!say) return;
    setBusy(true);
    setDrawn(null);
    try {
      const res = await fetch("/api/studio/image", {
        method: "POST",
        headers: { "content-type": "application/json", ...rendererHeader() },
        body: JSON.stringify({ kind: "raster", prompt: say, label: node.label, w: Math.round(node.w), h: Math.round(node.h) }),
      });
      const r = (await res.json()) as { ok?: boolean; image?: string; cost?: number | null; message?: string };
      if (!r.ok || !r.image) {
        setDrawn(r.message ?? "The renderer could not draw it.");
        return;
      }
      const blob = await (await fetch(r.image)).blob();
      const made = await putPicture(blob, { alt: say, from: "drawn" });
      const had = node.picture;
      useStudio.getState().updateNode(node.id, { picture: made });
      if (had) void dropPicture(had);
      setDrawn(typeof r.cost === "number" ? `Drawn. It cost $${r.cost.toFixed(2)}.` : "Drawn. The renderer reported no price for it.");
      setAsking(false);
      setWant("");
    } catch (err) {
      setDrawn(err instanceof Error ? err.message : "The renderer could not be reached.");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const made = await putPicture(f, { alt: f.name.replace(/\.[a-z0-9]+$/i, ""), from: "upload" });
      const had = node.picture;
      useStudio.getState().updateNode(node.id, { picture: made });
      // The one it replaced is nobody's now.
      if (had) void dropPicture(had);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    const had = node.picture;
    useStudio.getState().updateNode(node.id, { picture: null });
    if (had) void dropPicture(had);
  };

  return (
    <Field label="Picture" hint="Kept as a file, not inside the document, so a big one cannot take the board down with it.">
      <div className="space-y-2">
        {pic ? (
          <div className="overflow-hidden rounded-md border border-border bg-elevated">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={pic.alt} className="block max-h-32 w-full object-cover" />
            ) : looked ? (
              <div className="p-3 text-plain leading-relaxed text-warn">
                This picture is not in this browser any more. Choose it again to put it back.
              </div>
            ) : (
              <div className="p-3 text-plain text-fg-muted">Looking for it…</div>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }}
          />
          <Button variant="outline" size="xs" disabled={busy} onClick={() => file.current?.click()}>
            {pic ? "Choose another" : "Choose a picture"}
          </Button>
          <Button variant="ghost" size="xs" disabled={busy} onClick={() => setAsking((v) => !v)}>
            <Sparkles className="size-3" /> Draw one
          </Button>
          {pic ? <Button variant="ghost" size="xs" onClick={clear}>Remove</Button> : null}
        </div>
        {asking ? (
          <div className="space-y-2 rounded-md border border-border bg-elevated/50 p-2">
            <Input
              inputSize="sm"
              autoFocus
              value={want}
              placeholder="what the picture should be"
              onChange={(e) => setWant(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && want.trim()) void draw(); }}
            />
            {/*
              The price before the press, not after it. It is his key and his
              money, and the rate is the renderer's published one; what it
              actually cost comes back with the picture and replaces this.
            */}
            <p className="text-small leading-relaxed text-fg-muted">
              Drawn with your own Replicate key, about <span className="num text-fg">${RENDER_COST.raster.toFixed(2)}</span> a
              go at the model&rsquo;s published rate. It lands as a file on this part, the same as one you chose yourself.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="xs" disabled={busy || !want.trim()} loading={busy} onClick={() => void draw()}>
                Draw it
              </Button>
              <Button variant="ghost" size="xs" disabled={busy} onClick={() => setAsking(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}
        {/* What it really cost, said after, and outside the box that closes
            when it worked — it was set and then hidden with the asking. */}
        {drawn ? <p className="text-small leading-relaxed text-fg-muted">{drawn}</p> : null}
        {pic ? (
          <p className="text-small leading-relaxed text-fg-muted">
            {pic.published
              ? <>Published with the site, at <code className="text-fg">{pic.path}</code>.</>
              : <>This picture is in this browser only. It goes up with the site the next time you publish, as <code className="text-fg">{pic.path}</code>.</>}
            {pic.bytes ? ` ${pic.bytes < 1024 * 1024 ? `${Math.round(pic.bytes / 1024)} KB` : `${(pic.bytes / 1024 / 1024).toFixed(1)} MB`}${pic.w ? `, ${pic.w}×${pic.h}` : ""}.` : ""}
          </p>
        ) : null}
      </div>
    </Field>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-small font-medium uppercase tracking-wider text-fg-faint">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-small text-fg-muted">{hint}</span> : null}
    </label>
  );
}

export function HuePicker({ value, onChange }: { value: number | null; onChange: (h: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn("tactile size-5 rounded-sm border text-fine text-fg-faint", value === null ? "border-accent" : "border-border")}
        title="Category colour"
      >
        A
      </button>
      {HUES.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(h)}
          className={cn("tactile size-5 rounded-sm border", value === h ? "border-fg" : "border-transparent")}
          style={{ background: `oklch(0.72 0.16 ${h})` }}
          title={`Hue ${h}`}
        />
      ))}
    </div>
  );
}

/**
 * The elements on this page, as a roll you can pick from.
 *
 * It is here because the Element tab has to say something about elements
 * when none is picked, and the truest thing it can say is which ones there
 * are. Pressing a row picks that part, which fills this same panel with its
 * editor, so the roll is a way INTO the tab rather than a second screen
 * beside it.
 *
 * Virtualised because a page has no ceiling on parts, and a list in this
 * panel that is fine at nine rows and stutters at three hundred is the kind
 * of thing nobody finds until a real site is on the board.
 */
function ElementRoll({ nodes }: { nodes: StudioNode[] }) {
  return (
    <VirtualList
      items={nodes}
      getKey={(n) => n.id}
      estimateSize={34}
      className="px-2 py-1"
      empty={
        <p className="px-4 text-center text-plain text-fg-muted">
          Nothing on this page yet. Open the parts drawer under the board, place a part, then pick it to say what it should be.
        </p>
      }
      renderItem={(n) => {
        const feature = getFeature(n.featureId);
        const cat = feature ? categoryOf(feature.category) : null;
        const hue = n.hue ?? cat?.hue ?? 265;
        return (
          <Button
            variant="ghost"
            size="sm"
            data-element-row=""
            className="h-8 w-full justify-start gap-2 px-2"
            onClick={() => useStudio.getState().setSelection([n.id])}
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-sm"
              style={{ background: `oklch(0.7 0.14 ${hue} / 0.16)`, color: `oklch(0.8 0.15 ${hue})` }}
            >
              {n.glyph ? <span className="text-small">{n.glyph}</span> : feature ? <feature.icon className="size-3" /> : <Frame className="size-3" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-left text-plain text-fg">{n.label}</span>
            {n.prompt.trim() ? (
              <Wand2 className="size-3 shrink-0 text-fg-faint" aria-label="has words" />
            ) : null}
          </Button>
        );
      }}
    />
  );
}

export function Inspector() {
  const selection = useStudio((s) => s.selection);
  const nodes = useStudio(useShallow(pageNodes));
  const shapes = useStudio(useShallow(pageShapes));
  const groups = useStudio(useShallow(pageGroups));
  const page = useStudio(activePage);
  const frameWidth = useStudio((s) => s.frameWidth);
  /* Which mark is open. None is the resting state, and the prompt is
     always there under it — see the row below. */
  const [mark, setMark] = React.useState<MarkId | null>(null);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);

  const selNodes = nodes.filter((n) => selection.includes(n.id));
  const selShapes = shapes.filter((s) => selection.includes(s.id));
  const store = useStudio.getState;

  /*
   * THE BACKGROUND HAS LEFT THIS PANEL, by his ruling and for the reason he
   * gave: the page's fill and the textures on it are the SITE's look, not
   * this element's, and having them here was the one thing in Element that
   * genuinely belonged in Looks. They are a section of the Look panel now.
   *
   * Picking the background still has to answer for itself rather than read
   * as an empty panel, so it says where its controls went — and the way it
   * says so is a button that takes you there, not a sentence telling you to
   * go yourself.
   *
   * WHAT IT MAY NOT DO IS BE THE WHOLE PANEL, which is the fault he read as
   * this tab having nothing in it. A press on the page is how most people
   * arrive here, and what they arrived at was a tab called Element saying
   * one sentence about the page's fill and offering to send them somewhere
   * else. A tab named for a thing leads with that thing: the elements on
   * this page, each one a press away from its own editor, and the signpost
   * folded to a line at the foot where a signpost belongs.
   */
  if (selection.includes(BACKGROUND_ID)) {
    return (
      <div className="flex h-full min-h-0 flex-col" data-page-picked="">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{page.name}</div>
          <div className="text-small text-fg-muted">
            {nodes.length ? `${nodes.length} element${nodes.length === 1 ? "" : "s"} on this page. Pick one to prompt it.` : "The page itself is picked."}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ElementRoll nodes={nodes} />
        </div>
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-sm"
            style={{ background: "oklch(0.7 0.15 320 / 0.18)", color: "oklch(0.84 0.16 320)" }}
          >
            <PaletteIcon className="size-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-small text-fg-muted">The page&rsquo;s fill and its textures are the site&rsquo;s look.</p>
          <Button
            size="xs"
            variant="outline"
            data-to-looks=""
            onClick={() => window.dispatchEvent(new CustomEvent("studio:panel", { detail: "look" }))}
          >
            Open Looks
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- nothing picked */
  if (selNodes.length === 0 && selShapes.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{page.name}</div>
          <div className="text-small text-fg-muted">Page-level prompt</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <Field label="This page should…" hint="Applies to everything on this page.">
            <Textarea
              autoGrow
              rows={4}
              aria-label="Page prompt"
              placeholder="e.g. The whole page is one continuous scroll; nothing is clickable until the reader reaches the bottom."
              value={page.prompt}
              onChange={(e) => useStudio.getState().updatePage(page.id, { prompt: e.target.value })}
            />
          </Field>
          <Field label="Where it would go">
            <AuditReadout
              subject="a part made from these words"
              planned={{ label: page.name, prompt: page.prompt, featureId: "custom-idea", w: 1440, h: 800, role: null, outline: null, content: "" }}
            />
          </Field>
          {/*
            The "select something to prompt it" block stood here and told the
            reader what they were already doing. A prompt lives on the element
            and in the trail, where it can be read against what it produced;
            a panel that nags about the absence of a selection is not a place
            prompts live.
          */}
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- shape picked */
  if (selShapes.length === 1 && selNodes.length === 0) {
    const shape = selShapes[0]!;
    const kindLabel = shape.kind === "frame" ? "Region" : shape.kind === "arrow" ? "Connection" : "Sketch";
    const fromNode = nodes.find((n) => n.id === shape.fromNodeId);
    const toNode = nodes.find((n) => n.id === shape.toNodeId);
    /*
     * What the chain already says.
     *
     * A chain between two parts wears its reason on the board and carries it
     * into the blueprint whether or not anybody names it, so the Name box
     * shows that reason as its placeholder: what is in the field is what the
     * chain says, and typing over it says something else instead.
     */
    const derived = shape.kind === "arrow" && fromNode && toNode ? linkReason(fromNode, toNode, shape.relation ?? "flow") : "";
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="size-2 rounded-full" style={{ background: `oklch(0.75 0.16 ${shape.hue})` }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-plain font-semibold text-fg">{shape.label || kindLabel}</div>
            <div className="text-small text-fg-muted">
              {kindLabel}
              {fromNode && toNode ? ` · ${fromNode.label} → ${toNode.label}` : ""}
            </div>
          </div>
          <Button variant="ghost" size="iconXs" aria-label="Delete" onClick={() => useStudio.getState().removeShapes([shape.id])}>
            <Trash2 />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <Field label="Name" hint={derived ? "The chain says this by itself, from what the two parts already say. Write here to say it differently." : undefined}>
            <Input
              value={shape.label}
              placeholder={derived || (shape.kind === "frame" ? "e.g. Above the fold" : "e.g. opens on click")}
              onChange={(e) => useStudio.getState().updateShape(shape.id, { label: e.target.value })}
            />
          </Field>
          <Field
            label="Prompt"
            hint={
              shape.kind === "frame"
                ? "Applies to everything inside this region."
                : shape.kind === "arrow"
                  ? "Describes the relationship between the two elements."
                  : "What this drawing represents."
            }
          >
            <Textarea
              autoGrow
              rows={4}
              value={shape.prompt}
              aria-label="Drawing prompt"
              placeholder={shape.kind === "arrow" ? "e.g. clicking the card expands it into this panel" : "Describe what this means…"}
              onChange={(e) => useStudio.getState().updateShape(shape.id, { prompt: e.target.value })}
            />
          </Field>
          {shape.kind === "pen" ? (
            <Field label="Where it would go">
              <AuditReadout
                subject="this drawing"
                planned={{ label: shape.label, prompt: shape.prompt, featureId: "custom-idea", w: 320, h: 200, role: null, outline: null, content: "" }}
              />
            </Field>
          ) : null}
          {shape.kind === "arrow" ? (
            <Field
              label="Carries data"
              hint="A data wire means the part it points at reads from the part it starts on. Turning this on writes that into the target's data box."
            >
              <Segmented
                size="xs"
                value={shape.relation === "data" ? "data" : "flow"}
                onChange={(v) => useStudio.getState().setShapeRelation(shape.id, v as "data")}
                options={[
                  { value: "flow", label: "Relationship" },
                  { value: "data", label: "Data" },
                ]}
                aria-label="Carries data"
              />
            </Field>
          ) : null}
          <Field label="Colour">
            <HuePicker value={shape.hue} onChange={(h) => useStudio.getState().updateShape(shape.id, { hue: h ?? 265 })} />
          </Field>
          {shape.kind === "pen" ? (
            <Field label="Stroke width">
              <Slider
                value={[shape.width]}
                min={1}
                max={12}
                step={1}
                onValueChange={(v) => useStudio.getState().updateShape(shape.id, { width: v[0] ?? 3 })}
                readout={(n) => `${n}px`}
              />
            </Field>
          ) : null}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- multi-selection */
  if (selNodes.length > 1) {
    const groupIds = new Set(selNodes.map((n) => n.groupId).filter(Boolean));
    const sharedGroup = groupIds.size === 1 ? groups.find((g) => g.id === [...groupIds][0]) : null;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="text-plain font-semibold text-fg">{selNodes.length} elements selected</div>
          <div className="truncate text-small text-fg-muted">{selNodes.map((n) => n.label).join(", ")}</div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {sharedGroup ? (
            <>
              <Field label="Group name">
                <Input value={sharedGroup.label} onChange={(e) => useStudio.getState().updateGroup(sharedGroup.id, { label: e.target.value })} />
              </Field>
              <Field label="Group prompt" hint="Covers all members and how they relate to each other.">
                <Textarea
                  autoGrow
                  rows={4}
                  value={sharedGroup.prompt}
                  aria-label="Group prompt"
              placeholder="e.g. These three share one card shell and animate in together."
                  onChange={(e) => useStudio.getState().updateGroup(sharedGroup.id, { prompt: e.target.value })}
                />
              </Field>
              <Button variant="outline" size="sm" className="w-full" onClick={() => useStudio.getState().ungroup(sharedGroup.id)}>
                Ungroup
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" className="w-full" onClick={() => useStudio.getState().groupSelection()}>
              <Group />
              Group these {selNodes.length}
            </Button>
          )}

          <Field label="Set priority for all">
            <Segmented
              size="xs"
              value={selNodes[0]!.priority}
              onChange={(v) => useStudio.getState().updateNodes(selNodes.map((n) => n.id), { priority: v as "must" })}
              options={[
                { value: "must", label: "Must" },
                { value: "nice", label: "Nice" },
                { value: "idea", label: "Idea" },
              ]}
            />
          </Field>
          <Field label="Colour all" hint="Applies to every part selected.">
            <ColourOverride
              colour={selNodes[0]!.colour}
              palette={palette}
              onChange={(colour) => useStudio.getState().updateNodes(selNodes.map((n) => n.id), { colour })}
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => useStudio.getState().duplicateNodes(selNodes.map((n) => n.id))}>
              Duplicate
            </Button>
            <Button variant="danger" size="sm" className="flex-1" onClick={() => useStudio.getState().removeNodes(selNodes.map((n) => n.id))}>
              <Trash2 />
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- single node */
  const node = selNodes[0]!;
  const feature = getFeature(node.featureId);
  const cat = feature ? categoryOf(feature.category) : null;
  const group = groups.find((g) => g.id === node.groupId);
  const update = (patch: Parameters<ReturnType<typeof store>["updateNode"]>[1]) => useStudio.getState().updateNode(node.id, patch);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {feature ? (
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-sm"
            style={{ background: `oklch(0.7 0.14 ${node.hue ?? cat?.hue ?? 265} / 0.16)`, color: `oklch(0.8 0.15 ${node.hue ?? cat?.hue ?? 265})` }}
          >
            {node.glyph ? <span className="text-xs">{node.glyph}</span> : <feature.icon className="size-3.5" />}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-plain font-semibold text-fg">{node.label}</div>
          <div className="truncate text-small text-fg-muted">{cat?.label ?? "Custom"}</div>
        </div>
        <Tooltip content={node.locked ? "Unlock" : "Lock position"}>
          <Button variant="ghost" size="iconXs" aria-label="Lock" onClick={() => update({ locked: !node.locked })}>
            {node.locked ? <Lock /> : <Unlock />}
          </Button>
        </Tooltip>
        <Button variant="ghost" size="iconXs" aria-label="Delete" onClick={() => useStudio.getState().removeNodes([node.id])}>
          <Trash2 />
        </Button>
      </div>

      <Designs items={nodeDesigns(node)} />

      {/* The six. Pressing one opens it and closes whatever was open, so the
          panel is never a column of everything at once — which is what it
          was. Pressing the open one again closes it, leaving the prompt. */}
      <div className="flex shrink-0 items-stretch gap-0.5 border-b border-border px-1.5 pb-1.5">
        <Mark
          id="prompt" label="Prompt" hue={MARK_HUE.prompt} icon={<Pencil className="size-4" />}
          on={mark === "prompt"} lit={node.prompt.trim().length > 0}
          note={node.prompt.trim() ? "written" : undefined}
          onPress={() => setMark((m) => (m === "prompt" ? null : "prompt"))}
        />
        <Mark
          id="looks" label="Looks"
          /* The part's own colour when it has one — the mark IS the swatch.
             With none set it takes the category's hue, which is what the
             part is actually drawn in, so it is never a colour that lies. */
          hue={node.hue ?? cat?.hue ?? 320}
          icon={<PaletteIcon className="size-4" />}
          on={mark === "looks"} lit={node.hue != null || node.colour != null}
          note={node.hue != null || node.colour != null ? "set" : undefined}
          onPress={() => setMark((m) => (m === "looks" ? null : "looks"))}
        />
        <Mark
          id="link" label="Link" hue={MARK_HUE.link} icon={<Link2 className="size-4" />}
          on={mark === "link"} lit={!!node.link}
          note={node.link ? (node.link.kind === "url" ? "web" : node.link.kind) : undefined}
          onPress={() => setMark((m) => (m === "link" ? null : "link"))}
        />
        <Mark
          id="size" label="Size" hue={MARK_HUE.size} icon={<Frame className="size-4" />}
          on={mark === "size"} lit
          note={`${Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}%`}
          onPress={() => setMark((m) => (m === "size" ? null : "size"))}
        />
        <Mark
          id="motion" label="Motion" hue={MARK_HUE.motion} icon={<Play className="size-4" />}
          on={mark === "motion"} lit={!!node.anim}
          note={node.anim ? String(node.anim) : undefined}
          onPress={() => setMark((m) => (m === "motion" ? null : "motion"))}
          /* Touching it plays the part's entrance once on the board, which is
             the only honest way to show what an entrance is. */
          onTouch={() => { if (node.anim) window.dispatchEvent(new CustomEvent("studio:replay", { detail: node.id })); }}
        />
        <Mark
          id="delete" label="Delete" hue={MARK_HUE.delete} icon={<Trash2 className="size-4" />}
          on={false} lit
          onPress={() => useStudio.getState().removeNodes([node.id])}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {/*
          THE PROMPT IS THE ONE THING ALWAYS OPEN. It is what he reaches for
          every time, and every other control on this panel is one press away
          behind its own mark.
        */}
        <Field
          label="Prompt for this element"
          hint="Specific to this placement. Mention neighbours by name and the builder will honour the relationship."
        >
          <Textarea
            autoGrow
            rows={5}
            aria-label="Element prompt"
            value={node.prompt}
            placeholder={feature?.hint ?? `e.g. ${feature?.name ?? "This"} sits tight against the element on its left and shares its colour.`}
            onChange={(e) => update({ prompt: e.target.value })}
          />
        </Field>

        {/* The words stay fields, by his ruling: the part is not edited in
            place. Name and contents are what the board draws, so they sit
            with the prompt rather than behind a mark. */}
        <Field label="Name">
          <Input value={node.label} onChange={(e) => update({ label: e.target.value })} />
        </Field>
        <PictureField node={node} />

        {feature?.content ? (
          <Field label={feature.content.label} hint="Comma-separated. The board draws exactly this.">
            <Textarea
              autoGrow
              rows={2}
              aria-label={feature.content.label}
              value={node.content}
              placeholder={feature.content.placeholder}
              onChange={(e) => update({ content: e.target.value })}
            />
          </Field>
        ) : null}

        {mark === "size" ? (
        <div className="rounded-md border border-border p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-small font-medium uppercase tracking-wider text-fg-faint">Size & position</span>
            <span className="num text-small text-fg-faint">{Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}% of frame</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-0.5">
                <span className="text-fine uppercase text-fg-faint">{k === "w" ? "Width" : k === "h" ? "Height" : k.toUpperCase()}</span>
                <Input
                  type="number"
                  inputSize="sm"
                  className="px-1"
                  value={String(Math.round(node[k]))}
                  aria-label={k === "w" ? "Width" : k === "h" ? "Height" : k.toUpperCase()}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    update({ [k]: k === "w" ? Math.max(40, v) : k === "h" ? Math.max(24, v) : v } as Partial<typeof node>);
                  }}
                />
              </label>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1">
            <Tooltip content="Span the whole frame">
              <Button size="xs" variant="outline" className="flex-1" onClick={() => update({ x: 0, w: frameWidth })}>Full width</Button>
            </Tooltip>
            <Tooltip content="Flush left in the frame">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Flush left" onClick={() => update({ x: 0 })}><AlignLeft /></Button>
            </Tooltip>
            <Tooltip content="Centre in the frame">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Centre" onClick={() => update({ x: Math.round((frameWidth - node.w) / 2) })}><AlignCenter /></Button>
            </Tooltip>
            <Tooltip content="Flush right in the frame">
              <Button size="xs" variant="outline" className="flex-1" aria-label="Flush right" onClick={() => update({ x: frameWidth - node.w })}><AlignRight /></Button>
            </Tooltip>
          </div>
        </div>
        ) : null}

        {/*
          Under the prompt, not beside it: what the words are handed to. The
          panel had four prompt boxes and nothing about the model any of them
          reached, which is the half `AuditPanel` adds. It writes `node.plan`,
          the field create space's right panel edits, through the one writer
          both use.
        */}
        <Field label="Where it goes" hint="The route's own choice unless you say otherwise. Every option below is the model's own.">
          <AuditPanel node={node} />
        </Field>

        {mark === "looks" ? (
        <Field label="Shape" hint="What the part is cut to. A circle drawn round it on the board sets this.">
          <Segmented
            size="xs"
            value={node.shape ?? "box"}
            onChange={(v) => update({ shape: v === "box" ? null : (v as "circle") })}
            options={NODE_SHAPES.map((v) => ({ value: v, label: v }))}
          />
        </Field>

        ) : null}
        {mark === "looks" ? (
        <Field label="Priority">
          <Segmented
            size="xs"
            value={node.priority}
            onChange={(v) => update({ priority: v as "must" })}
            options={[
              { value: "must", label: "Must have" },
              { value: "nice", label: "Nice" },
              { value: "idea", label: "Idea" },
            ]}
          />
        </Field>
        ) : null}

        {feature?.options?.length ? (
          <div className="space-y-2 rounded-md border border-border p-2">
            <div className="text-small font-medium uppercase tracking-wider text-fg-faint">Options</div>
            {feature.options.map((opt) =>
              opt.kind === "set" ? (
                <OptionSet
                  key={opt.id}
                  option={opt}
                  value={node.options[opt.id]}
                  onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
                />
              ) : opt.kind === "range" ? (
                <OptionRange
                  key={opt.id}
                  option={opt}
                  value={node.options[opt.id]}
                  onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
                />
              ) : (
                <div key={opt.id} className="flex items-center justify-between gap-2">
                  <span className="text-plain text-fg">{opt.label}</span>
                  <Select
                    className="w-32"
                    value={node.options[opt.id] ?? opt.values[0]!}
                    onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
                    options={opt.values.map((v) => ({ value: v, label: v }))}
                    aria-label={opt.label}
                  />
                </div>
              ),
            )}
          </div>
        ) : null}

        <Field
          label="Data"
          hint="What this shows or does, in your words, the values and actions the backend has to provide. Wires pointing at this part fill it in."
        >
          <Textarea
            autoGrow
            rows={2}
            aria-label="Data"
            value={node.data}
            placeholder="e.g. live coin price, trader P&L, time left, or: join duel"
            onChange={(e) => update({ data: e.target.value })}
          />
        </Field>

        {node.vector ? <Role node={node} /> : null}

        {node.featureId === "cube-3d" || (node.featureId === "mesh-3d" && node.cube) ? <Faces node={node} palette={palette} /> : null}
        {node.featureId === "cube-3d" || (node.featureId === "mesh-3d" && node.cube) ? <Solid node={node} palette={palette} /> : null}

        {mark === "link" && isLinkable(node.featureId) ? <LinkField node={node} /> : null}
        {mark === "link" && !isLinkable(node.featureId) ? (
          <p className="text-small text-fg-muted">This part does not send anyone anywhere, so it has nothing to point at.</p>
        ) : null}

        {mark === "looks" ? (
        <>
        <Field label="Colour" hint="This part only. Naming a role keeps it inside the site's palette.">
          <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />
        </Field>

        <Field label="Glyph" hint="Give a new idea its own mark so you can spot it on the canvas.">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => update({ glyph: null })}
              className={cn("tactile size-6 rounded-sm border text-small", node.glyph === null ? "border-accent" : "border-border")}
            >
              <PaletteIcon className="mx-auto size-3" />
            </button>
            {GLYPHS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update({ glyph: g })}
                className={cn("tactile size-6 rounded-sm border text-xs", node.glyph === g ? "border-accent" : "border-border")}
              >
                {g}
              </button>
            ))}
          </div>
        </Field>
        </>
        ) : null}

        {group ? (
          <div className="rounded-md border border-border p-2">
            <div className="mb-1 flex items-center gap-1.5 text-small uppercase tracking-wider text-fg-faint">
              <Layers className="size-3" />
              In group
            </div>
            <div className="mb-1.5 text-plain font-medium text-fg">{group.label}</div>
            <Textarea
              autoGrow
              rows={2}
              value={group.prompt}
              placeholder="Prompt for the whole group…"
              onChange={(e) => useStudio.getState().updateGroup(group.id, { prompt: e.target.value })}
            />
          </div>
        ) : null}

        {feature ? (
          <div className="rounded-md border border-border bg-elevated/50 p-2">
            <div className="mb-1 flex items-center gap-1.5 text-small uppercase tracking-wider text-fg-faint">
              <Lightbulb className="size-3" />
              What this usually means
            </div>
            <p className="text-plain leading-relaxed text-fg-muted">{feature.blurb}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge size="sm" variant="outline">{feature.id}</Badge>
              <Badge size="sm">{cat?.label}</Badge>
            </div>
          </div>
        ) : null}

        <div className="text-small text-fg-faint">
          Row order comes from where it sits in the frame. Width and height are built exactly, not reflowed.
        </div>
      </div>
    </div>
  );
}

/** Where a part sends people. Pages by name, or a web address. */
/**
 * The six faces of a cube, listed.
 *
 * A cube is the first part whose content is not one field, and the reason
 * it is here rather than in the part is that a part is a component a
 * generated site ships: it draws what it is given and never edits the
 * document. So the editing lives in the panel, all six faces at once,
 * because "which side is that on" is the only question anyone has, and
 * every change is one write to the node.
 */
/**
 * What a drawing is for, asked rather than guessed.
 *
 * A traced drawing is a shape with no purpose yet. The words choose a role
 * when they say one — "a bird icon" is an icon — and when they say nothing
 * this asks, with all three offered and none of them preselected. A bird
 * that quietly became an icon when it was meant to be a frame is worse
 * than a bird with no role yet, so nothing is chosen on the author's
 * behalf and the panel says so in as many words.
 */
function Role({ node }: { node: StudioNode }) {
  const set = (role: VectorRole | null) => {
    play(role ? "confirm" : "close");
    useStudio.getState().updateNode(node.id, {
      role,
      // An icon is a part of its own; the other two are what the part it
      // is already does, so only this one changes what it is.
      ...(role === "icon" && node.featureId !== "drawn-icon" ? { featureId: "drawn-icon", outline: null, shape: null } : {}),
    });
  };
  const kept = simplify(node.vector!, 6);
  return (
    <Field
      label="What the drawing is for"
      hint={node.role
        ? ROLE_MEANS[node.role]
        : "Nothing has been chosen, and nothing will be chosen for you. Pick one."}
    >
      <div className="flex flex-col gap-1.5" data-role-picker="">
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              data-role={r}
              aria-pressed={node.role === r}
              onClick={() => set(node.role === r ? null : r)}
              className={cn("tactile rounded-md border px-2 py-1 text-small capitalize", node.role === r ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-fine leading-snug text-fg-faint">
          {weigh(node.vector!).paths} paths traced, {kept.paths.length} kept for an icon. Drop an icon onto a button and the
          button wears it.
        </p>
      </div>
    </Field>
  );
}

/** The colours a face may be: the site's, or one of the roles it already has. */
const FACE_COLOURS = [
  { id: "", label: "site" },
  { id: "surface", label: "surface" },
  { id: "bg", label: "background" },
  { id: "accent", label: "accent" },
  { id: "highlight", label: "highlight" },
  { id: "muted", label: "muted" },
] as const;

function Faces({ node, palette }: { node: StudioNode; palette: Record<string, string> | null }) {
  const set = useStudio((s) => s.setCubeFace);
  /*
   * Every page but the one the cube is standing on. A surface showing the
   * page it is part of is a mirror, so it is not offered — the cube would
   * draw nothing there and the face would fall back to its words, which
   * looks like a bug rather than a rule.
   */
  const pages = useStudio((s) => s.pages);
  const sites = React.useMemo(() => pages.filter((p) => p.id !== node.pageId), [pages, node.pageId]);
  const picked = useStudio((s) => (s.pickedFace?.nodeId === node.id ? s.pickedFace.side : null));
  const faces = React.useMemo(() => CUBE_SIDES.map((_, i) => node.cube?.faces?.[i] ?? emptyFace()), [node.cube]);
  const filled = written(node.cube);
  /*
   * A face picked on the board is the one the panel is about: its card
   * comes into view and its heading takes the keys, so "pick a face and
   * give it words" is one press and then typing.
   */
  const cards = React.useRef<Record<string, HTMLDivElement | null>>({});
  const was = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!picked || picked === was.current) { was.current = picked; return; }
    was.current = picked;
    const card = cards.current[picked];
    if (!card) return;
    // Picked from the board: bring the card in and hand it the keys. Picked
    // from inside the card, the keys are already where they belong.
    if (card.contains(document.activeElement)) return;
    card.scrollIntoView({ block: "nearest" });
    const input = card.querySelector("input") as HTMLInputElement | null;
    input?.focus({ preventScroll: true });
  }, [picked]);
  return (
    <Field
      label="Faces"
      hint={`${filled} of six written. A face left blank stays blank: nothing is invented for it. Press a face on the cube, or its name here, to pick it. A face given a page becomes that page — the page's own parts on the side of the box, and a press goes there.`}
    >
      <div className="flex flex-col gap-2" data-face-list="">
        {CUBE_SIDES.map((side, i) => {
          const face = faces[i]!;
          const bare = !face.heading.trim() && !face.body.trim() && !face.pageId;
          const on = picked === side;
          return (
            <div
              key={side}
              ref={(el) => { cards.current[side] = el; }}
              data-cube-face={side}
              data-face-picked={on ? "" : undefined}
              className={cn("rounded-md border bg-elevated/40 p-2", on ? "border-accent" : "border-border")}
              // Typing on a face is pointing at it; a press on one of its
              // buttons is not, so the card does not move under the press.
              onFocusCapture={(e) => { if (!on && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) useStudio.getState().pickFace(node.id, side); }}
            >
              <div className="mb-1 flex items-center gap-2">
                <button
                  type="button"
                  data-pick-face={side}
                  aria-pressed={on}
                  aria-label={`Pick the ${side} face`}
                  onClick={() => { play(on ? "close" : "tap"); useStudio.getState().pickFace(node.id, on ? null : side); }}
                  className={cn("tactile rounded-sm px-1 text-small uppercase tracking-[0.14em]", on ? "text-fg" : "text-fg-faint hover:text-fg")}
                >
                  {side}
                </button>
                {bare ? <span className="text-fine text-fg-faint">empty</span> : null}
                {on ? <span className="text-fine text-accent">picked</span> : null}
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Clear the ${side} face`}
                  disabled={bare && !face.colour && !(face.prompt ?? "").trim() && !face.pageId}
                  onClick={() => set(node.id, i, null)}
                  className="tactile rounded-sm border border-border px-1.5 py-0.5 text-fine text-fg-muted disabled:opacity-40 hover:text-fg"
                >
                  clear
                </button>
              </div>
              <Input
                inputSize="sm"
                aria-label={`${side} heading`}
                value={face.heading}
                placeholder="Heading"
                onChange={(e) => set(node.id, i, { heading: e.target.value })}
              />
              <Textarea
                autoGrow
                rows={1}
                className="mt-1"
                aria-label={`${side} body`}
                value={face.body}
                placeholder="A line or two"
                onChange={(e) => set(node.id, i, { body: e.target.value })}
              />
              {/* The face's own prompt, exactly as any part has one: what
                  this side is for, for whoever builds the site. */}
              <Textarea
                autoGrow
                rows={1}
                className="mt-1"
                aria-label={`${side} prompt`}
                data-face-prompt={side}
                value={face.prompt ?? ""}
                placeholder="What this face is for"
                onChange={(e) => set(node.id, i, { prompt: e.target.value })}
              />
              {/* A surface is a page. Given one, this side stops being a
                  card with words on it and becomes that page, drawn at the
                  face's size; its heading and body wait behind it and come
                  back the moment the page is taken off. */}
              {sites.length ? (
                <div className="mt-1 flex flex-wrap items-center gap-1" data-face-pages={side}>
                  <span className="text-fine uppercase tracking-[0.14em] text-fg-faint">page</span>
                  <button
                    type="button"
                    data-pick-page="none"
                    aria-pressed={!face.pageId}
                    onClick={() => { play("close"); set(node.id, i, { pageId: null }); }}
                    className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", !face.pageId ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
                  >
                    none
                  </button>
                  {sites.map((p) => {
                    const on = face.pageId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-pick-page={p.id}
                        aria-pressed={on}
                        onClick={() => { play(on ? "close" : "confirm"); set(node.id, i, { pageId: on ? null : p.id }); }}
                        className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", on ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {face.pageId ? (
                <p className="mt-1 text-fine leading-snug text-fg-faint">
                  This side is the page. Its heading and body are kept and come back when the page is taken off.
                </p>
              ) : null}
              {/* One colour, named as a role, so a face stays inside the
                  site's palette rather than becoming a colour nobody can
                  find again. */}
              <div className="mt-1 flex flex-wrap gap-1">
                {FACE_COLOURS.map((role) => {
                  const is = (face.colour || "") === role.id;
                  return (
                    <button
                      key={role.id || "site"}
                      type="button"
                      aria-label={`${side} face, ${role.label}`}
                      aria-pressed={is}
                      onClick={() => set(node.id, i, { colour: role.id })}
                      className={cn("tactile rounded-sm border px-1.5 py-0.5 text-fine", is ? "border-accent text-fg" : "border-border text-fg-faint hover:text-fg")}
                      style={role.id && palette?.[role.id] ? { boxShadow: `inset 3px 0 0 ${palette[role.id]}` } : undefined}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
}

/**
 * Does this browser, or the server, hold a Replicate token?
 *
 * Asked once, and again whenever the keys panel changes: the control it lights
 * is the one control on this panel that spends money.
 */
function useRendererReady(): boolean | null {
  const [ready, setReady] = React.useState<boolean | null>(null);
  const unlocked = useKeys((s) => s.unlocked);
  const held = useKeys((s) => !!s.values.REPLICATE_API_TOKEN);
  React.useEffect(() => {
    let live = true;
    void rendererReady(true).then((v) => { if (live) setReady(v); });
    return () => { live = false; };
  }, [unlocked, held]);
  return ready;
}

/**
 * The model road, behind the table.
 *
 * The cube needs no key and is the whole thing. This card is the road past
 * it: the same two-axis table that routes every picture routes a box to
 * the one model that returns a solid, and the button is lit the moment a
 * token is present. Without one it says what would light it, and nothing
 * on the cube is missing.
 */
function Solid({ node, palette }: { node: StudioNode; palette: Record<string, string> | null }) {
  const ready = useRendererReady();
  const model = React.useMemo(() => solidModel(), []);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const isMesh = node.featureId === "mesh-3d";
  const go = async () => {
    play("confirm");
    setSaid(null);
    const r = await makeSolid(node.id, palette ?? {}, { onStep: setBusy });
    setBusy(null);
    setSaid(r.message);
    play(r.ok ? "confirm" : "deny");
  };
  return (
    <Field
      label="As a solid"
      hint={model ? `Routed to ${model.name} the moment a Replicate token is present: the four sides go up as pictures and a mesh comes back.` : "No model in the table returns a solid yet."}
    >
      <div className="flex flex-col gap-1.5" data-solid-card="" data-solid-ready={ready === null ? "asking" : ready ? "yes" : "no"} data-solid-model={model?.slug ?? ""}>
        {isMesh ? (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" data-solid-back="" onClick={() => { play("tap"); showCube(node.id); }}>Back to the cube</Button>
          </div>
        ) : ready ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" data-solid-make="" disabled={!!busy || !model} onClick={() => void go()}>{busy ?? "Make it a solid"}</Button>
            {node.mesh?.glb ? <Button size="sm" variant="outline" data-solid-show="" onClick={() => { play("tap"); showSolid(node.id); }}>Show the solid made before</Button> : null}
          </div>
        ) : (
          <p className="text-small leading-snug text-fg-muted" data-solid-needs="">
            {ready === null ? "Checking for a Replicate token…" : "No Replicate token yet. Paste one under Keys (⌘⇧K) and this lights up. Until then the cube is the whole thing: it turns, it takes words on every face, and nothing is missing from it."}
          </p>
        )}
        {said ? <p className="text-small leading-snug text-fg-faint" data-solid-said="">{said}</p> : null}
      </div>
    </Field>
  );
}

function LinkField({ node }: { node: StudioNode }) {
  const pages = useStudio((s) => s.pages);
  // A link drawn as an arrow points at another part; it is named here by
  // that part's name, where before no UI showed it at all.
  const other = useStudio((s) => (node.link?.kind === "node" ? s.nodes.find((n) => n.id === node.link!.target) ?? null : null));
  const link = node.link;
  const value = !link ? "none" : link.kind === "page" ? `page:${link.target}` : link.kind === "url" ? "url" : "node";
  const set = (l: StudioNode["link"]) => useStudio.getState().updateNode(node.id, { link: l });
  return (
    <Field label="Links to" hint="Where this sends people in the live preview and the finished site.">
      <div data-link-field="">
      <Select
        value={value}
        onChange={(v) => (v === "none" ? set(null) : v === "url" ? set({ kind: "url", target: link?.kind === "url" ? link.target : "https://" }) : v === "node" ? undefined : set({ kind: "page", target: v.slice(5) }))}
        options={[
          { value: "none", label: "Nowhere" },
          ...pages.map((p) => ({ value: `page:${p.id}`, label: `${p.name}  ${p.path}` })),
          { value: "url", label: "Web address…" },
          ...(link?.kind === "node" ? [{ value: "node", label: `The part ${other?.label ?? link.target}, on this page` }] : []),
        ]}
        aria-label="Links to"
      />
      {link?.kind === "node" ? (
        <p className="mt-1 text-small leading-snug text-fg-faint" data-link-node="">
          Drawn as an arrow to the part {other?.label ?? link.target}: pressing this scrolls to it. Pick a page or an address above to send people elsewhere.
        </p>
      ) : null}
      </div>
      {link?.kind === "url" ? (
        <Input className="mt-1.5" value={link.target} placeholder="https://" aria-label="Web address" onChange={(e) => set({ kind: "url", target: e.target.value })} />
      ) : null}
      {!link ? <WorkField node={node} /> : null}
    </Field>
  );
}

/**
 * The other thing a button that points nowhere can be: one that DOES something.
 *
 * HIS WORDS: "a drawn button if not linked to something should offer options
 * of a web link, prompt for backend to fill in, like a button i draw, I can
 * title it 'buy' and then i say 'swap route aggregator through jupiter or
 * specific exchange or platform via trading wallet' and it builds the backend
 * required to make it work where this exact button is."
 *
 * So the two are offered together, and only while it points nowhere: once it
 * sends people somewhere, asking what it should do instead is asking a
 * question he has already answered.
 *
 * What he writes goes on the part's own `data`, which is the field this app
 * already defines as "what it shows or does — the values and actions the
 * backend must provide". It is not a note about the button: it is the work,
 * and it is sited at the button because it lives on it, which is what the
 * backend surface reads when it builds.
 */
function WorkField({ node }: { node: StudioNode }) {
  const says = node.data ?? "";
  return (
    <div className="mt-2 border-t border-border pt-2">
      <p className="mb-1 text-small leading-snug text-fg-muted">
        Or say what it should <em>do</em>, and the backend for it is built here, on this button.
      </p>
      <Textarea
        data-backend-ask=""
        rows={3}
        value={says}
        aria-label="What this button should do"
        placeholder={"swap route aggregator through jupiter or specific exchange or platform via trading wallet"}
        onChange={(e) => useStudio.getState().updateNode(node.id, { data: e.target.value })}
      />
      {says.trim() ? (
        <p data-backend-sited="" className="mt-1 text-small leading-snug text-fg-faint">
          The backend builds this where this button is.
        </p>
      ) : null}
    </div>
  );
}
