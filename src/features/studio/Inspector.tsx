"use client";
/**
 * The per-element prompt panel — the point of the whole exercise. Whatever is
 * selected gets its own instructions, and those instructions travel with its
 * position on the canvas into the brief.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlignCenter, AlignLeft, AlignRight, Box, Brush, ClipboardPaste, Grid2x2, Group, Layers, Lightbulb, Link2, Lock, MousePointerClick, Paintbrush, Palette as PaletteIcon, Play,
  Scissors, SlidersHorizontal, Sparkles, SunDim, Trash2, Type, Unlock, Wand2,
} from "lucide-react";
import { getFeature, categoryOf, type FeatureOption } from "./catalog";
import { isLinkable } from "./parts";
import { lands, speedWord, type Look } from "./look";
import type { FormatValues } from "./format";
import { BACKGROUND_ID, heldBackground, HUES, NODE_SHAPES, pageGroups, pageNodes, pageShapes, activePage, useStudio , type StudioNode } from "./store";
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
import { Switch } from "@/core/ui/switch";
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
        <span className="text-[11px] text-fg">{option.label}</span>
        <span className="num text-[11px] text-fg-muted">{now}{r.unit ?? ""}</span>
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
        <span className="text-[11px] text-fg">{option.label}</span>
        <span className="num text-[10px] text-fg-faint">{on.size} on</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {option.values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={on.has(v)}
            onClick={() => { play(on.has(v) ? "close" : "select"); toggle(v); }}
            className={cn(
              "tactile rounded-full border px-2 py-0.5 text-[10px]",
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
        <span key={i} data-design="" className="flex h-5 items-center gap-1 rounded-[4px] bg-elevated pl-0.5 pr-1.5 text-[10px] text-fg" style={{ border: "1px solid var(--border)" }}>
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
function BackgroundInspector() {
  const look = useStudio((s) => s.look);
  const format = useStudio((s) => s.format);
  const s = useStudio.getState;
  const fill = String(format["palette.background"] ?? "flat");
  const layers = (look.texture ?? []).filter((l) => lands(l, "page"));
  const held = heldBackground();
  return (
    <div className="flex h-full min-h-0 flex-col" data-background-inspector="">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Layers className="size-3.5 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-fg">Background</div>
          <div className="text-[10px] text-fg-muted">The page behind every part</div>
        </div>
        <Tooltip content="Cut the background" shortcut="mod+x">
          <Button variant="ghost" size="iconXs" aria-label="Cut the background" onClick={() => s().cutBackground()}>
            <Scissors />
          </Button>
        </Tooltip>
      </div>
      <Designs items={backgroundDesigns(look, format)} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Not a Field: a <label> round a radio group names its first radio after the field. */}
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Fill</div>
          <Segmented
            size="xs"
            aria-label="Background fill"
            value={fill}
            onChange={(v) => s().setFormat("palette.background", v)}
            options={[
              { value: "flat", label: "flat" },
              { value: "subtle gradient", label: "gradient" },
              { value: "grid", label: "grid" },
              { value: "mesh gradient", label: "mesh" },
            ]}
          />
          <p className="mt-1 text-[10px] text-fg-muted">What the page is painted with before any texture.</p>
        </div>
        <Field label="Texture on the page" hint="Layers from the Looks stack that land behind the page.">
          {layers.length === 0 ? (
            <p className="text-[10px] text-fg-muted">None. Add one under Looks › Texture and it shows up here.</p>
          ) : (
            layers.map((l) => (
              <label key={l.id} className="flex items-center justify-between gap-2 py-0.5 text-[11px] text-fg">
                <span className="truncate">{l.kind} · {l.role}</span>
                <Switch
                  size="sm"
                  checked={l.on}
                  aria-label={`Texture ${l.kind}`}
                  onCheckedChange={(on) => s().setLook({ texture: (look.texture ?? []).map((x) => (x.id === l.id ? { ...x, on } : x)) })}
                />
              </label>
            ))
          )}
        </Field>
        {held ? (
          <Button size="xs" variant="ghost" className="mt-2" onClick={() => s().pasteBackground()}>
            <ClipboardPaste />
            Put the cut background back
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-fg-faint">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] text-fg-muted">{hint}</span> : null}
    </label>
  );
}

export function HuePicker({ value, onChange }: { value: number | null; onChange: (h: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn("tactile size-5 rounded-sm border text-[9px] text-fg-faint", value === null ? "border-accent" : "border-border")}
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

export function Inspector() {
  const selection = useStudio((s) => s.selection);
  const nodes = useStudio(useShallow(pageNodes));
  const shapes = useStudio(useShallow(pageShapes));
  const groups = useStudio(useShallow(pageGroups));
  const page = useStudio(activePage);
  const frameWidth = useStudio((s) => s.frameWidth);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);

  const selNodes = nodes.filter((n) => selection.includes(n.id));
  const selShapes = shapes.filter((s) => selection.includes(s.id));
  const store = useStudio.getState;

  /* ----------------------------------------------------- the background */
  if (selection.includes(BACKGROUND_ID)) return <BackgroundInspector />;

  /* ------------------------------------------------------- nothing picked */
  if (selNodes.length === 0 && selShapes.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 py-2">
          <div className="text-[11px] font-semibold text-fg">{page.name}</div>
          <div className="text-[10px] text-fg-muted">Page-level prompt</div>
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
            <div className="truncate text-[11px] font-semibold text-fg">{shape.label || kindLabel}</div>
            <div className="text-[10px] text-fg-muted">
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
          <div className="text-[11px] font-semibold text-fg">{selNodes.length} elements selected</div>
          <div className="truncate text-[10px] text-fg-muted">{selNodes.map((n) => n.label).join(", ")}</div>
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
          <div className="truncate text-[11px] font-semibold text-fg">{node.label}</div>
          <div className="truncate text-[10px] text-fg-muted">{cat?.label ?? "Custom"}</div>
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
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Field label="Name">
          <Input value={node.label} onChange={(e) => update({ label: e.target.value })} />
        </Field>

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

        <div className="rounded-md border border-border p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">Size & position</span>
            <span className="num text-[10px] text-fg-faint">{Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}% of frame</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase text-fg-faint">{k === "w" ? "Width" : k === "h" ? "Height" : k.toUpperCase()}</span>
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

        <Field label="Shape" hint="What the part is cut to. A circle drawn round it on the board sets this.">
          <Segmented
            size="xs"
            value={node.shape ?? "box"}
            onChange={(v) => update({ shape: v === "box" ? null : (v as "circle") })}
            options={NODE_SHAPES.map((v) => ({ value: v, label: v }))}
          />
        </Field>

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

        {feature?.options?.length ? (
          <div className="space-y-2 rounded-md border border-border p-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">Options</div>
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
                  <span className="text-[11px] text-fg">{opt.label}</span>
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

        {isLinkable(node.featureId) ? <LinkField node={node} /> : null}

        <Field label="Colour" hint="This part only. Naming a role keeps it inside the site's palette.">
          <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />
        </Field>

        <Field label="Glyph" hint="Give a new idea its own mark so you can spot it on the canvas.">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => update({ glyph: null })}
              className={cn("tactile size-6 rounded-sm border text-[10px]", node.glyph === null ? "border-accent" : "border-border")}
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

        {group ? (
          <div className="rounded-md border border-border p-2">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-faint">
              <Layers className="size-3" />
              In group
            </div>
            <div className="mb-1.5 text-[11px] font-medium text-fg">{group.label}</div>
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
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-faint">
              <Lightbulb className="size-3" />
              What this usually means
            </div>
            <p className="text-[11px] leading-relaxed text-fg-muted">{feature.blurb}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge size="sm" variant="outline">{feature.id}</Badge>
              <Badge size="sm">{cat?.label}</Badge>
            </div>
          </div>
        ) : null}

        <div className="text-[10px] text-fg-faint">
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
              className={cn("tactile rounded-md border px-2 py-1 text-[10px] capitalize", node.role === r ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg")}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-[9px] leading-snug text-fg-faint">
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
      hint={`${filled} of six written. A face left blank stays blank: nothing is invented for it. Press a face on the cube, or its name here, to pick it.`}
    >
      <div className="flex flex-col gap-2" data-face-list="">
        {CUBE_SIDES.map((side, i) => {
          const face = faces[i]!;
          const bare = !face.heading.trim() && !face.body.trim();
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
                  className={cn("tactile rounded-sm px-1 text-[10px] uppercase tracking-[0.14em]", on ? "text-fg" : "text-fg-faint hover:text-fg")}
                >
                  {side}
                </button>
                {bare ? <span className="text-[9px] text-fg-faint">empty</span> : null}
                {on ? <span className="text-[9px] text-accent">picked</span> : null}
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Clear the ${side} face`}
                  disabled={bare && !face.colour && !(face.prompt ?? "").trim()}
                  onClick={() => set(node.id, i, null)}
                  className="tactile rounded-sm border border-border px-1.5 py-0.5 text-[9px] text-fg-muted disabled:opacity-40 hover:text-fg"
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
                      className={cn("tactile rounded-sm border px-1.5 py-0.5 text-[9px]", is ? "border-accent text-fg" : "border-border text-fg-faint hover:text-fg")}
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
          <p className="text-[10px] leading-snug text-fg-muted" data-solid-needs="">
            {ready === null ? "Checking for a Replicate token…" : "No Replicate token yet. Paste one under Keys (⌘⇧K) and this lights up. Until then the cube is the whole thing: it turns, it takes words on every face, and nothing is missing from it."}
          </p>
        )}
        {said ? <p className="text-[10px] leading-snug text-fg-faint" data-solid-said="">{said}</p> : null}
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
        <p className="mt-1 text-[10px] leading-snug text-fg-faint" data-link-node="">
          Drawn as an arrow to the part {other?.label ?? link.target}: pressing this scrolls to it. Pick a page or an address above to send people elsewhere.
        </p>
      ) : null}
      </div>
      {link?.kind === "url" ? (
        <Input className="mt-1.5" value={link.target} placeholder="https://" aria-label="Web address" onChange={(e) => set({ kind: "url", target: e.target.value })} />
      ) : null}
    </Field>
  );
}
