"use client";
/**
 * The part menu, as a wheel.
 *
 * A part has a lot you can change, and a twenty-item list buries all of it.
 * Instead: six wedges, grouped by what you are actually trying to do. The
 * wheel opens as a half circle facing away from whichever screen edge you
 * clicked near, so it never opens off-screen, and each wedge opens one small
 * panel with only that group's controls.
 */
import * as React from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Copy, Link2, ListTree, Lock, Move, Palette as PaletteIcon,
  Trash2, Unlock, Wand2, X,
} from "lucide-react";
import { getFeature } from "./catalog";
import { isLinkable } from "./parts";
import { HUES, useStudio, type StudioNode } from "./store";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Select } from "@/core/ui/select";
import { Segmented } from "@/core/ui/segmented";

/* ------------------------------------------------------------------ */
/* Opening it                                                          */
/* ------------------------------------------------------------------ */

type Open = { nodeId: string; x: number; y: number } | null;
let current: Open = null;
const listeners = new Set<(v: Open) => void>();

export function openRadial(nodeId: string, x: number, y: number) {
  current = { nodeId, x, y };
  listeners.forEach((l) => l(current));
}
export function closeRadial() {
  current = null;
  listeners.forEach((l) => l(null));
}
function useRadial(): Open {
  const [v, setV] = React.useState<Open>(current);
  React.useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

/* ------------------------------------------------------------------ */
/* The wheel                                                           */
/* ------------------------------------------------------------------ */

type WedgeId = "contents" | "size" | "look" | "wiring" | "prompt" | "more";

const WEDGES: { id: WedgeId; label: string; icon: typeof Wand2 }[] = [
  { id: "contents", label: "Contents", icon: ListTree },
  { id: "size", label: "Size & place", icon: Move },
  { id: "look", label: "Look", icon: PaletteIcon },
  { id: "wiring", label: "Links & data", icon: Link2 },
  { id: "prompt", label: "Prompt", icon: Wand2 },
  { id: "more", label: "More", icon: Copy },
];

// Six labelled wedges need roughly 6 × 78px of arc, so the radius follows from
// that rather than being picked by eye.
const R = 132;
const SPREAD = 210;

export function RadialMenu() {
  const open = useRadial();
  const [wedge, setWedge] = React.useState<WedgeId | null>(null);
  const nodes = useStudio((s) => s.nodes);
  const node = open ? nodes.find((n) => n.id === open.nodeId) : undefined;

  React.useEffect(() => {
    if (!open) setWedge(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRadial();
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-radial]")) closeRadial();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  if (!open || !node) return null;

  // Face the wheel away from the nearest edges, so it always has room.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = open.x < vw / 2;
  const top = open.y < vh / 2;
  // Centre of the arc, in degrees, 0 = right.
  const facing = left ? (top ? 45 : -45) : top ? 135 : -135;

  return (
    <div data-radial className="pointer-events-none fixed inset-0 z-50">
      <div className="absolute" style={{ left: open.x, top: open.y }}>
        {/* the hub */}
        <button
          type="button"
          aria-label="Close the wheel"
          onClick={closeRadial}
          className="pointer-events-auto absolute -left-4 -top-4 flex size-8 items-center justify-center rounded-full border border-border bg-panel text-fg-muted shadow-panel hover:text-fg"
        >
          <X className="size-3.5" />
        </button>

        {WEDGES.map((w, i) => {
          const a = ((facing - SPREAD / 2 + (SPREAD / (WEDGES.length - 1)) * i) * Math.PI) / 180;
          const Icon = w.icon;
          const on = wedge === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                play("select");
                setWedge(on ? null : w.id);
              }}
              aria-pressed={on}
              className={cn(
                "pointer-events-auto absolute flex w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] shadow-panel transition-colors",
                on ? "border-accent bg-accent-soft text-fg" : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg",
              )}
              style={{ left: Math.cos(a) * R, top: -Math.sin(a) * R }}
            >
              <Icon className="size-4" />
              {w.label}
            </button>
          );
        })}

        {wedge ? (
          <div
            className="pointer-events-auto absolute w-64 rounded-lg border border-border bg-panel p-2.5 shadow-panel"
            style={{
              left: left ? R + 56 : -R - 56 - 256,
              top: top ? 8 : -8,
              transform: top ? undefined : "translateY(-100%)",
            }}
          >
            <Panel wedge={wedge} node={node} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One group's controls                                                */
/* ------------------------------------------------------------------ */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 flex flex-col gap-1 last:mb-0">
      <span className="text-[10px] uppercase tracking-wider text-fg-faint">{label}</span>
      {children}
    </label>
  );
}

function Panel({ wedge, node }: { wedge: WedgeId; node: StudioNode }) {
  const feature = getFeature(node.featureId);
  const frameWidth = useStudio((s) => s.frameWidth);
  const pages = useStudio((s) => s.pages);
  const s = () => useStudio.getState();
  const update = (patch: Partial<StudioNode>) => s().updateNode(node.id, patch);

  if (wedge === "contents") {
    return (
      <>
        <Row label="Name">
          <Input value={node.label} aria-label="Name" onChange={(e) => update({ label: e.target.value })} />
        </Row>
        {feature?.content ? (
          <Row label={feature.content.label}>
            <Textarea autoGrow rows={3} value={node.content} aria-label={feature.content.label} placeholder={feature.content.placeholder} onChange={(e) => update({ content: e.target.value })} />
          </Row>
        ) : (
          <p className="text-[11px] text-fg-muted">This part has nothing to list inside it.</p>
        )}
      </>
    );
  }

  if (wedge === "size") {
    return (
      <>
        <div className="mb-2 grid grid-cols-4 gap-1">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-0.5">
              <span className="text-[9px] uppercase text-fg-faint">{k === "w" ? "Width" : k === "h" ? "Height" : k}</span>
              <Input
                type="number"
                inputSize="sm"
                className="px-1"
                value={String(Math.round(node[k]))}
                aria-label={k === "w" ? "Width" : k === "h" ? "Height" : k.toUpperCase()}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) update({ [k]: k === "w" ? Math.max(40, v) : k === "h" ? Math.max(24, v) : v } as Partial<StudioNode>);
                }}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-1">
          <Button size="xs" variant="outline" className="flex-1" onClick={() => update({ x: 0, w: frameWidth })}>Full width</Button>
          <Button size="xs" variant="outline" aria-label="Flush left" onClick={() => update({ x: 0 })}><AlignLeft /></Button>
          <Button size="xs" variant="outline" aria-label="Centre" onClick={() => update({ x: Math.round((frameWidth - node.w) / 2) })}><AlignCenter /></Button>
          <Button size="xs" variant="outline" aria-label="Flush right" onClick={() => update({ x: frameWidth - node.w })}><AlignRight /></Button>
        </div>
        <div className="mt-2 text-[10px] text-fg-faint">{Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}% of the frame</div>
      </>
    );
  }

  if (wedge === "look") {
    return (
      <>
        {feature?.options?.length ? (
          feature.options.map((opt) => (
            <Row key={opt.id} label={opt.label}>
              <Select
                value={node.options[opt.id] ?? opt.values[0]!}
                onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
                options={opt.values.map((v) => ({ value: v, label: v }))}
                aria-label={opt.label}
              />
            </Row>
          ))
        ) : (
          <p className="mb-2 text-[11px] text-fg-muted">No options on this part yet.</p>
        )}
        <Row label="Colour">
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => update({ hue: null })} className={cn("tactile size-5 rounded-sm border text-[9px]", node.hue === null ? "border-fg" : "border-border")}>A</button>
            {HUES.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={`Hue ${h}`}
                onClick={() => update({ hue: h })}
                className={cn("tactile size-5 rounded-sm border", node.hue === h ? "border-fg" : "border-transparent")}
                style={{ background: `oklch(0.72 0.16 ${h})` }}
              />
            ))}
          </div>
        </Row>
      </>
    );
  }

  if (wedge === "wiring") {
    const link = node.link;
    return (
      <>
        {isLinkable(node.featureId) ? (
          <Row label="Links to">
            <Select
              value={!link ? "none" : link.kind === "page" ? `page:${link.target}` : "url"}
              onChange={(v) => update({ link: v === "none" ? null : v === "url" ? { kind: "url", target: "https://" } : { kind: "page", target: v.slice(5) } })}
              options={[{ value: "none", label: "Nowhere" }, ...pages.map((p) => ({ value: `page:${p.id}`, label: p.name })), { value: "url", label: "Web address…" }]}
              aria-label="Links to"
            />
          </Row>
        ) : null}
        <Row label="Data">
          <Textarea autoGrow rows={3} value={node.data} aria-label="Data" placeholder="What it shows or does" onChange={(e) => update({ data: e.target.value })} />
        </Row>
      </>
    );
  }

  if (wedge === "prompt") {
    return (
      <>
        <Row label="Prompt for this element">
          <Textarea autoGrow rows={4} value={node.prompt} aria-label="Element prompt" placeholder={feature?.hint ?? "Specific to this placement…"} onChange={(e) => update({ prompt: e.target.value })} />
        </Row>
        <Row label="Priority">
          <Segmented
            size="xs"
            value={node.priority}
            onChange={(v) => update({ priority: v as "must" })}
            options={[{ value: "must", label: "Must" }, { value: "nice", label: "Nice" }, { value: "idea", label: "Idea" }]}
            aria-label="Priority"
          />
        </Row>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="xs" variant="outline" onClick={() => { s().duplicateNodes([node.id]); closeRadial(); }}>
        <Copy />
        Duplicate
      </Button>
      <Button size="xs" variant="outline" onClick={() => update({ locked: !node.locked })}>
        {node.locked ? <Unlock /> : <Lock />}
        {node.locked ? "Unlock" : "Lock in place"}
      </Button>
      <Button size="xs" variant="danger" onClick={() => { s().removeNodes([node.id]); closeRadial(); }}>
        <Trash2 />
        Delete
      </Button>
    </div>
  );
}
