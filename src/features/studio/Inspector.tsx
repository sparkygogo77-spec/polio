"use client";
/**
 * The per-element prompt panel — the point of the whole exercise. Whatever is
 * selected gets its own instructions, and those instructions travel with its
 * position on the canvas into the brief.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { Group, Layers, Lightbulb, Lock, MousePointerClick, Palette as PaletteIcon, Trash2, Unlock } from "lucide-react";
import { getFeature, categoryOf } from "./catalog";
import { HUES, pageGroups, pageNodes, pageShapes, activePage, useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Segmented } from "@/core/ui/segmented";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Badge } from "@/core/ui/badge";
import { EmptyState } from "@/core/ui/empty-state";
import { Tooltip } from "@/core/ui/tooltip";

const GLYPHS = ["✦", "◆", "▲", "●", "✱", "❖", "☾", "⚡", "🌀", "🔮", "🧩", "🎛", "🪄", "🛰", "🧪", "🎚"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-fg-faint">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10px] text-fg-muted">{hint}</span> : null}
    </label>
  );
}

function HuePicker({ value, onChange }: { value: number | null; onChange: (h: number | null) => void }) {
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

  const selNodes = nodes.filter((n) => selection.includes(n.id));
  const selShapes = shapes.filter((s) => selection.includes(s.id));
  const store = useStudio.getState;

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
              placeholder="e.g. The whole page is one continuous scroll; nothing is clickable until the reader reaches the bottom."
              value={page.prompt}
              onChange={(e) => useStudio.getState().updatePage(page.id, { prompt: e.target.value })}
            />
          </Field>
          <div className="mt-4">
            <EmptyState
              icon={MousePointerClick}
              title="Select something to prompt it"
              body="Click an element on the canvas, or drag a box around several. Every element, group, region and arrow gets its own instructions."
            />
          </div>
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
          <Field label="Name">
            <Input
              value={shape.label}
              placeholder={shape.kind === "frame" ? "e.g. Above the fold" : "e.g. opens on click"}
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
              placeholder={shape.kind === "arrow" ? "e.g. clicking the card expands it into this panel" : "Describe what this means…"}
              onChange={(e) => useStudio.getState().updateShape(shape.id, { prompt: e.target.value })}
            />
          </Field>
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
          <Field label="Colour all">
            <HuePicker value={selNodes[0]!.hue} onChange={(h) => useStudio.getState().updateNodes(selNodes.map((n) => n.id), { hue: h })} />
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Field label="Name">
          <Input value={node.label} onChange={(e) => update({ label: e.target.value })} />
        </Field>

        <Field
          label="Prompt for this element"
          hint="Specific to this placement. Mention neighbours by name and the builder will honour the relationship."
        >
          <Textarea
            autoGrow
            rows={5}
            value={node.prompt}
            placeholder={feature?.hint ?? `e.g. ${feature?.name ?? "This"} sits tight against the element on its left and shares its colour.`}
            onChange={(e) => update({ prompt: e.target.value })}
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
            {feature.options.map((opt) => (
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
            ))}
          </div>
        ) : null}

        <Field label="Colour">
          <HuePicker value={node.hue} onChange={(h) => update({ hue: h })} />
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
          Position: row order is set by where it sits on the canvas — {Math.round(node.x)}, {Math.round(node.y)}
        </div>
      </div>
    </div>
  );
}
