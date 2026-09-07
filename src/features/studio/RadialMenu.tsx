"use client";
/**
 * The part menu, as a wheel of shards.
 *
 * Right-click a part and the ring opens around the point you clicked: nine
 * shards cut out of a disc, each in its own neon colour so you learn them by
 * where they are and what colour they are rather than by reading them. Three
 * of them do their one thing and close — duplicate, lock, delete. The other
 * six open a second panel, in green, on the *opposite* side of the centre from
 * the shard you picked: the ring stays visible, your hand is out of the way of
 * the controls, and the two levels never sit on top of each other.
 *
 * The geometry is real geometry — annulus sectors with straight edges, drawn
 * as SVG polygons — so the hit area is the shape you can see, corner to
 * corner, rather than a rectangle pretending to be a wedge.
 */
import * as React from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Copy, Link2, ListTree, Lock, Move, Palette as PaletteIcon,
  Play, Trash2, Unlock, Wand2, X,
} from "lucide-react";
import { getFeature } from "./catalog";
import { isLinkable } from "./parts";
import { useStudio, type StudioNode } from "./store";
import { ColourOverride } from "./ColourOverride";
import { resolvePalette } from "./parts/theme";
import { ROLES, ROLE_LABEL, TEXTURE_KINDS, type RoleId } from "./look";
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
/* What is on the ring                                                 */
/* ------------------------------------------------------------------ */

type ShardId = "size" | "look" | "wiring" | "prompt" | "anim" | "contents" | "duplicate" | "lock" | "delete";

interface Shard {
  id: ShardId;
  label: string;
  icon: typeof Wand2;
  /** Its own neon hue. No two are near each other on the wheel or on the ring. */
  hue: number;
  /** An action fires and closes; a group opens the green panel opposite it. */
  kind: "action" | "group";
}

const SHARDS: Shard[] = [
  { id: "size", label: "Size", icon: Move, hue: 205, kind: "group" },
  { id: "look", label: "Looks", icon: PaletteIcon, hue: 320, kind: "group" },
  { id: "wiring", label: "Links", icon: Link2, hue: 268, kind: "group" },
  { id: "prompt", label: "Prompt", icon: Wand2, hue: 55, kind: "group" },
  { id: "anim", label: "Animation", icon: Play, hue: 172, kind: "group" },
  { id: "contents", label: "Contents", icon: ListTree, hue: 232, kind: "group" },
  { id: "duplicate", label: "Duplicate", icon: Copy, hue: 25, kind: "action" },
  { id: "lock", label: "Lock", icon: Lock, hue: 90, kind: "action" },
  { id: "delete", label: "Delete", icon: Trash2, hue: 8, kind: "action" },
];

/** How a part arrives on the page. The values are CSS animation names. */
export const ENTRANCES: { value: string; label: string }[] = [
  { value: "", label: "No entrance" },
  { value: "el-fade", label: "Fade in" },
  { value: "el-rise", label: "Rise" },
  { value: "el-drop", label: "Drop" },
  { value: "el-left", label: "In from the left" },
  { value: "el-right", label: "In from the right" },
  { value: "el-grow", label: "Grow" },
  { value: "el-blur", label: "Come into focus" },
  { value: "el-flip", label: "Tip up" },
];

const IN = 46;
const OUT = 118;
const GAP = 2.6;

/** One shard, as the polygon it looks like. */
function shardPath(i: number, n: number): string {
  const step = 360 / n;
  const a0 = ((-90 + i * step + GAP) * Math.PI) / 180;
  const a1 = ((-90 + (i + 1) * step - GAP) * Math.PI) / 180;
  // Straight edges, not arcs: the shape is cut, not curved.
  const p = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  const mid = (a0 + a1) / 2;
  return [p(IN, a0), p(OUT, a0), p(OUT * 1.04, mid), p(OUT, a1), p(IN, a1), p(IN * 0.98, mid)].join(" ");
}

/** The middle of a shard, in px from the centre. */
function shardCentre(i: number, n: number, r = (IN + OUT) / 2): { x: number; y: number; angle: number } {
  const step = 360 / n;
  const deg = -90 + i * step + step / 2;
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, angle: deg };
}

/* ------------------------------------------------------------------ */
/* The wheel                                                           */
/* ------------------------------------------------------------------ */

export function RadialMenu() {
  const open = useRadial();
  const [picked, setPicked] = React.useState<ShardId | null>(null);
  const nodes = useStudio((s) => s.nodes);
  const node = open ? nodes.find((n) => n.id === open.nodeId) : undefined;

  React.useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (picked ? setPicked(null) : closeRadial());
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      // A select inside the panel opens its list in a portal, which is not a
      // descendant of the wheel — closing on it would shut the wheel the
      // moment you picked an option.
      if (el.closest?.("[data-radial], [data-radix-popper-content-wrapper], [role='listbox'], [role='option']")) return;
      closeRadial();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, picked]);

  if (!open || !node) return null;

  const s = () => useStudio.getState();
  const choose = (w: Shard) => {
    if (w.kind === "action") return fire(w.id);
    play("select");
    setPicked((p) => (p === w.id ? null : w.id));
  };
  const fire = (id: ShardId) => {
    if (id === "duplicate") { s().duplicateNodes([node.id]); play("confirm"); closeRadial(); }
    if (id === "lock") { s().updateNode(node.id, { locked: !node.locked }); play(node.locked ? "confirm" : "close"); closeRadial(); }
    if (id === "delete") { s().removeNodes([node.id]); play("deny"); closeRadial(); }
  };

  // Keep the whole ring on screen; the panel is placed from the centre after.
  const pad = OUT + 24;
  const cx = Math.max(pad, Math.min(window.innerWidth - pad, open.x));
  const cy = Math.max(pad, Math.min(window.innerHeight - pad, open.y));

  const index = picked ? SHARDS.findIndex((w) => w.id === picked) : -1;
  // The green panel goes opposite the shard you chose: away from your hand,
  // and never over the ring.
  const away = index >= 0 ? shardCentre(index, SHARDS.length, OUT + 40) : null;
  const panelAt = away ? { x: -away.x, y: -away.y } : null;

  return (
    // Above the top bar and the status bar: a wheel opened near an edge used to
    // have its top shards behind the chrome, unreachable.
    <div data-radial className="pointer-events-none fixed inset-0 z-[68]">
      <div className="absolute" style={{ left: cx, top: cy }}>
        <svg className="absolute overflow-visible" width={1} height={1}>
          {SHARDS.map((w, i) => {
            const on = picked === w.id;
            const locked = w.id === "lock" && node.locked;
            return (
              <polygon
                key={w.id}
                role="button"
                tabIndex={0}
                aria-label={locked ? "Unlock" : w.label}
                aria-pressed={on}
                data-shard={w.id}
                points={shardPath(i, SHARDS.length)}
                onClick={() => choose(w)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(w); } }}
                className="pointer-events-auto cursor-pointer outline-none"
                fill={`oklch(0.62 0.2 ${w.hue} / ${on ? 0.34 : 0.13})`}
                stroke={`oklch(${on ? 0.9 : 0.78} 0.21 ${w.hue})`}
                strokeWidth={on ? 1.8 : 1.1}
                style={{ filter: on ? `drop-shadow(0 0 8px oklch(0.8 0.2 ${w.hue} / 0.75))` : undefined }}
              />
            );
          })}
        </svg>

        {SHARDS.map((w, i) => {
          const c = shardCentre(i, SHARDS.length);
          const Icon = w.icon;
          const on = picked === w.id;
          const locked = w.id === "lock" && node.locked;
          return (
            <span
              key={w.id}
              aria-hidden
              className="pointer-events-none absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[9.5px] font-medium leading-tight"
              style={{ left: c.x, top: c.y, color: `oklch(${on ? 0.95 : 0.86} 0.16 ${w.hue})` }}
            >
              {locked ? <Unlock className="size-4" /> : <Icon className="size-4" />}
              <span className="whitespace-nowrap">{locked ? "Unlock" : w.label}</span>
            </span>
          );
        })}

        {/* the hub closes it */}
        <button
          type="button"
          aria-label="Close the wheel"
          onClick={closeRadial}
          className="pointer-events-auto absolute -left-4 -top-4 flex size-8 items-center justify-center rounded-full border border-border bg-panel text-fg-muted shadow-panel hover:text-fg"
        >
          <X className="size-3.5" />
        </button>

        {picked && panelAt ? (
          <div
            data-radial-panel={picked}
            className="pointer-events-auto absolute w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg p-2.5"
            style={{
              left: panelAt.x,
              top: panelAt.y,
              background: "oklch(0.18 0.03 150 / 0.96)",
              border: "1px solid oklch(0.82 0.2 150)",
              boxShadow: "0 0 18px oklch(0.7 0.2 150 / 0.35), 0 12px 40px oklch(0 0 0 / 0.5)",
            }}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "oklch(0.9 0.17 150)" }}>
                {SHARDS[index]?.label}
              </span>
              <button
                type="button"
                aria-label="Back to the wheel"
                onClick={() => { play("close"); setPicked(null); }}
                className="text-[10px]"
                style={{ color: "oklch(0.8 0.14 150)" }}
              >
                <X className="size-3" />
              </button>
            </div>
            <Panel shard={picked} node={node} />
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

function Panel({ shard, node }: { shard: ShardId; node: StudioNode }) {
  const feature = getFeature(node.featureId);
  const frameWidth = useStudio((s) => s.frameWidth);
  const pages = useStudio((s) => s.pages);
  const format = useStudio((st) => st.format);
  const look = useStudio((st) => st.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const s = () => useStudio.getState();
  const update = (patch: Partial<StudioNode>) => s().updateNode(node.id, patch);

  if (shard === "contents") {
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

  if (shard === "size") {
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
        <Row label="Align">
          <div className="flex gap-1">
            <Button size="xs" variant="outline" aria-label="Flush left" className="flex-1" onClick={() => update({ x: 0 })}><AlignLeft /></Button>
            <Button size="xs" variant="outline" aria-label="Centre" className="flex-1" onClick={() => update({ x: Math.round((frameWidth - node.w) / 2) })}><AlignCenter /></Button>
            <Button size="xs" variant="outline" aria-label="Flush right" className="flex-1" onClick={() => update({ x: frameWidth - node.w })}><AlignRight /></Button>
          </div>
        </Row>
        <Button size="xs" variant="outline" className="w-full" onClick={() => update({ x: 0, w: frameWidth })}>Full width</Button>
        <div className="mt-2 text-[10px] text-fg-faint">{Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}% of the frame</div>
      </>
    );
  }

  if (shard === "look") {
    const layers = look.texture ?? [];
    return (
      <>
        <Row label="Hue">
          <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />
        </Row>
        <Row label="Texture">
          <Select
            value={node.texture ?? "site"}
            onChange={(v) => update({ texture: v === "site" ? null : v })}
            options={[
              { value: "site", label: "Follow the site" },
              { value: "none", label: "No texture" },
              ...layers.map((l, i) => ({
                value: l.id,
                label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`,
              })),
            ]}
            aria-label="Texture on this part"
          />
        </Row>
        <Row label="Border accent / aura">
          <Select
            value={node.aura ?? ""}
            onChange={(v) => update({ aura: v || null })}
            options={[{ value: "", label: "None" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
            aria-label="Aura"
          />
        </Row>
        {feature?.options?.length ? (
          feature.options.slice(0, 2).map((opt) => (
            <Row key={opt.id} label={opt.label}>
              <Select
                value={node.options[opt.id] ?? opt.values[0]!}
                onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
                options={opt.values.map((v) => ({ value: v, label: v }))}
                aria-label={opt.label}
              />
            </Row>
          ))
        ) : null}
      </>
    );
  }

  if (shard === "anim") {
    return (
      <>
        <Row label="How it arrives">
          <Select
            value={node.anim ?? ""}
            onChange={(v) => update({ anim: v || null })}
            options={ENTRANCES}
            aria-label="How it arrives"
          />
        </Row>
        <p className="text-[10px] leading-snug text-fg-faint">
          Plays on the live site and in the preview. The board draws the part where it ends up, so
          laying the page out never turns into watching it.
        </p>
      </>
    );
  }

  if (shard === "wiring") {
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
        {link?.kind === "url" ? (
          <Row label="Web address">
            <Input value={link.target} aria-label="Web address" onChange={(e) => update({ link: { kind: "url", target: e.target.value } })} />
          </Row>
        ) : null}
        <Row label="Data">
          <Textarea autoGrow rows={3} value={node.data} aria-label="Data" placeholder="What it shows or does" onChange={(e) => update({ data: e.target.value })} />
        </Row>
      </>
    );
  }

  // prompt
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
