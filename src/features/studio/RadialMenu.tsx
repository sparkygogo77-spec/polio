"use client";
/**
 * The part menu, cut into panes.
 *
 * Not a ring. Right-click a part and a slab of glass lands beside the pointer,
 * already broken into nine panes — a hand-cut mosaic, every seam wobbly,
 * every pane a different size, each outlined in its own neon colour and empty
 * in the middle. The pointer sits at one corner of the slab and the slab grows
 * away from it, so nothing you just clicked is under your hand.
 *
 * Picking a pane fills it with hatching in its own colour, the way you would
 * scribble the chosen one in. Three panes do their one thing and close.
 * The other six throw a second slab across the pointer — the same cut glass in
 * green — holding that group's choices, with the one control they need docked
 * under it.
 *
 * Everything is one SVG path per pane, drawn edge by edge with a seeded
 * wobble, so the geometry is the hit area and the whole thing looks drawn
 * rather than computed. The seed is the pane's index, so it wobbles the same
 * way every time you open it.
 */
import * as React from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Copy, Grid2x2, Link2, ListTree, Lock, Move,
  Palette as PaletteIcon, Play, Sparkles, Trash2, Unlock, Wand2, X,
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

/* ------------------------------------------------------------------ */
/* The cut glass                                                       */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

/** The slab, in px. Nine panes fit in this at a readable size. */
const SLAB = { w: 288, h: 246 };
/** The second slab is smaller: it holds a handful of choices, not nine. */
const SLAB2 = { w: 250, h: 128 };

/**
 * Where the seams run, as fractions of the slab.
 *
 * Deliberately uneven, row by row and column by column: a pane the same size
 * as its neighbour reads as a grid, and this is meant to read as a pane of
 * glass somebody dropped. Four rows of four points bound nine quads.
 */
const SEAM_X: number[][] = [
  [0, 0.30, 0.64, 1],
  [0, 0.38, 0.70, 1],
  [0, 0.26, 0.58, 1],
  [0, 0.34, 0.66, 1],
];
const SEAM_Y: number[][] = [
  [0, 0.03, 0, 0.04],
  [0.28, 0.34, 0.29, 0.35],
  [0.64, 0.59, 0.67, 0.61],
  [1, 0.97, 1, 0.98],
];

/** The four corners of pane (row, col), in fractions. */
function pane(row: number, col: number): Pt[] {
  const at = (r: number, c: number): Pt => [SEAM_X[r]![c]!, SEAM_Y[r]![c]!];
  return [at(row, col), at(row, col + 1), at(row + 1, col + 1), at(row + 1, col)];
}

/** The nine panes, in reading order. */
const PANES: Pt[][] = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => pane(r, c)));

/**
 * A second slab, cut into `n` panes across one row — the seams slanted, so it
 * is the same broken glass as the first and not a row of buttons.
 */
function strip(n: number): Pt[][] {
  const top = [0, ...Array.from({ length: n - 1 }, (_, i) => (i + 1) / n + (i % 2 ? 0.06 : -0.05)), 1];
  const bot = [0, ...Array.from({ length: n - 1 }, (_, i) => (i + 1) / n + (i % 2 ? -0.055 : 0.05)), 1];
  const ty = (i: number) => (i % 2 ? 0.1 : 0);
  const by = (i: number) => (i % 2 ? 0.92 : 1);
  return Array.from({ length: n }, (_, i): Pt[] => [
    [top[i]!, ty(i)],
    [top[i + 1]!, ty(i + 1)],
    [bot[i + 1]!, by(i + 1)],
    [bot[i]!, by(i)],
  ]);
}

/** Deterministic noise, so a pane wobbles the same way every time. */
function noise(seed: number): () => number {
  let t = seed * 1831565813 + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/**
 * One pane as a path, drawn edge by edge with a bowed middle — the line a
 * hand makes, not the one a compass does.
 */
function cutPath(points: Pt[], box: { w: number; h: number }, seed: number, bow = 3.2): string {
  const rand = noise(seed);
  const px = points.map(([x, y]): Pt => [x * box.w, y * box.h]);
  let d = `M ${px[0]![0].toFixed(1)} ${px[0]![1].toFixed(1)}`;
  for (let i = 0; i < px.length; i++) {
    const a = px[i]!;
    const b = px[(i + 1) % px.length]!;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    // Push the middle of the edge off to one side, along its normal.
    const off = rand() * bow;
    d += ` Q ${(mx + (-dy / len) * off).toFixed(1)} ${(my + (dx / len) * off).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** The middle of a pane, for the icon and the word that sit in it. */
function centre(points: Pt[], box: { w: number; h: number }): { x: number; y: number } {
  const x = points.reduce((n, p) => n + p[0], 0) / points.length;
  const y = points.reduce((n, p) => n + p[1], 0) / points.length;
  return { x: x * box.w, y: y * box.h };
}

/* ------------------------------------------------------------------ */
/* The wheel                                                           */
/* ------------------------------------------------------------------ */

export function RadialMenu() {
  const open = useRadial();
  const [picked, setPicked] = React.useState<ShardId | null>(null);
  /** Which pane of the green glass is showing its control in the strip. */
  const [subPick, setSubPick] = React.useState<string | null>(null);
  const nodes = useStudio((s) => s.nodes);
  const node = open ? nodes.find((n) => n.id === open.nodeId) : undefined;

  React.useEffect(() => {
    if (!open) { setPicked(null); setSubPick(null); }
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
    setSubPick(null);
    setPicked((p) => (p === w.id ? null : w.id));
  };
  const fire = (id: ShardId) => {
    if (id === "duplicate") { s().duplicateNodes([node.id]); play("confirm"); closeRadial(); }
    if (id === "lock") { s().updateNode(node.id, { locked: !node.locked }); play(node.locked ? "confirm" : "close"); closeRadial(); }
    if (id === "delete") { s().removeNodes([node.id]); play("deny"); closeRadial(); }
  };

  /*
    The pointer sits at a corner of the slab and the slab grows away from it —
    up and left by default, flipped when that would run off the screen. The
    green slab is thrown the other way across the pointer, so the two never
    overlap and the first one stays readable while you work in the second.
  */
  // Both slabs have to fit: the first grows one way from the pointer and the
  // second the other, so the pointer is kept a slab's width from either edge.
  const margin = 16;
  const px = Math.max(SLAB2.w + margin, Math.min(window.innerWidth - SLAB2.w - margin, open.x));
  const py = Math.max(SLAB2.h + 96 + margin, Math.min(window.innerHeight - SLAB2.h - 96 - margin, open.y));
  const room = { right: window.innerWidth - px, bottom: window.innerHeight - py };
  const flipX = room.right > SLAB.w + 40 && px < SLAB.w + 40;
  const flipY = room.bottom > SLAB.h + 40 && py < SLAB.h + 40;
  const slabAt = {
    x: flipX ? 12 : -SLAB.w - 12,
    y: flipY ? 12 : -SLAB.h - 12,
  };
  const slab2At = {
    x: flipX ? -SLAB2.w - 16 : 16,
    y: flipY ? -SLAB2.h - 16 : 16,
  };

  const index = picked ? SHARDS.findIndex((w) => w.id === picked) : -1;
  const chosen = index >= 0 ? SHARDS[index] : null;

  return (
    // Above the top bar and the status bar: a slab opened near an edge used to
    // have panes behind the chrome, unreachable.
    <div data-radial className="pointer-events-none fixed inset-0 z-[68]">
      <div className="absolute" style={{ left: px, top: py }}>
        {/* the pointer's own mark, at the corner the glass grew from */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-[3px] -top-[3px] size-1.5 rounded-full"
          style={{ background: "oklch(0.72 0.22 28)", boxShadow: "0 0 8px 2px oklch(0.7 0.22 28 / 0.7)" }}
        />

        <Slab
          box={SLAB}
          at={slabAt}
          panes={PANES}
          items={SHARDS.map((w) => ({
            id: w.id,
            label: w.id === "lock" && node.locked ? "Unlock" : w.label,
            icon: w.id === "lock" && node.locked ? Unlock : w.icon,
            hue: w.hue,
            on: picked === w.id,
            onPick: () => choose(w),
          }))}
        />

        {chosen ? (
          <div
            data-radial-panel={chosen.id}
            className="pointer-events-auto absolute"
            style={{ left: slab2At.x, top: slab2At.y, width: SLAB2.w }}
          >
            <Slab
              box={SLAB2}
              at={{ x: 0, y: 0 }}
              green
              panes={strip(Math.max(2, subPanes(chosen.id, node).length))}
              items={subPanes(chosen.id, node).map((sub) => ({
                id: sub.id,
                label: sub.label,
                icon: sub.icon,
                hue: 150,
                on: sub.id === subPick,
                onPick: () => { play("select"); sub.act ? sub.act() : setSubPick(sub.id); },
              }))}
            />
            {/* the one control the chosen pane needs, docked under the glass */}
            <div
              // The slab is absolutely positioned and takes no room in the
              // flow, so the strip is pushed clear of it by hand.
              style={{ marginTop: SLAB2.h + 6 }}
            >
            <div
              data-radial-strip=""
              style={{
                background: "oklch(0.16 0.03 150 / 0.96)",
                border: "1px solid oklch(0.7 0.18 150 / 0.8)",
                borderRadius: 6,
                padding: 8,
                boxShadow: "0 0 16px oklch(0.7 0.2 150 / 0.28), 0 12px 34px oklch(0 0 0 / 0.5)",
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "oklch(0.88 0.16 150)" }}>
                  {chosen.label}
                </span>
                <button
                  type="button"
                  aria-label="Back to the wheel"
                  onClick={() => { play("close"); setPicked(null); }}
                  style={{ color: "oklch(0.8 0.14 150)" }}
                >
                  <X className="size-3" />
                </button>
              </div>
              <Panel shard={chosen.id} node={node} focus={subPick} />
            </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One slab of cut glass                                               */
/* ------------------------------------------------------------------ */

interface SlabItem {
  id: string;
  label: string;
  icon: typeof Wand2;
  hue: number;
  on: boolean;
  onPick: () => void;
}

function Slab({
  box, at, panes, items, green,
}: {
  box: { w: number; h: number };
  at: { x: number; y: number };
  panes: Pt[][];
  items: SlabItem[];
  green?: boolean;
}) {
  const shown = items.slice(0, panes.length);
  return (
    <div className="absolute" style={{ left: at.x, top: at.y, width: box.w, height: box.h }}>
      <svg
        width={box.w}
        height={box.h}
        className="absolute left-0 top-0 overflow-visible"
        style={{ filter: "drop-shadow(0 10px 30px oklch(0 0 0 / 0.55))" }}
      >
        <defs>
          {shown.map((it, i) =>
            it.on ? (
              // The chosen pane is scribbled in, the way you would mark it.
              <pattern key={it.id} id={`hatch-${it.id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
                <line x1="0" y1="0" x2="0" y2="7" stroke={`oklch(0.78 0.21 ${green ? 350 : it.hue})`} strokeWidth="2.2" />
              </pattern>
            ) : null,
          )}
        </defs>
        {shown.map((it, i) => (
          <path
            key={it.id}
            role="button"
            tabIndex={0}
            aria-label={it.label}
            aria-pressed={it.on}
            data-shard={it.id}
            d={cutPath(panes[i]!, box, i + 1 + (green ? 90 : 0))}
            onClick={it.onPick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); it.onPick(); } }}
            className="pointer-events-auto cursor-pointer outline-none"
            fill={it.on ? `url(#hatch-${it.id})` : "oklch(0.14 0.02 265 / 0.88)"}
            stroke={`oklch(${it.on ? 0.92 : 0.8} 0.21 ${it.hue})`}
            strokeWidth={it.on ? 2.4 : 1.6}
            strokeLinejoin="round"
            style={{ filter: it.on ? `drop-shadow(0 0 7px oklch(0.82 0.2 ${it.hue} / 0.8))` : undefined }}
          />
        ))}
      </svg>
      {shown.map((it, i) => {
        const c = centre(panes[i]!, box);
        const Icon = it.icon;
        return (
          <span
            key={it.id}
            aria-hidden
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[9.5px] font-medium leading-tight"
            style={{ left: c.x, top: c.y, color: `oklch(${it.on ? 0.96 : 0.88} 0.15 ${it.hue})` }}
          >
            <Icon className="size-4" />
            <span className="whitespace-nowrap">{it.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What the green glass holds                                          */
/* ------------------------------------------------------------------ */

interface SubPane {
  id: string;
  label: string;
  icon: typeof Wand2;
  /** An immediate action; without one, the pane picks what the strip shows. */
  act?: () => void;
}

function subPanes(shard: ShardId, node: StudioNode): SubPane[] {
  const s = () => useStudio.getState();
  const update = (patch: Partial<StudioNode>) => s().updateNode(node.id, patch);
  const fw = () => s().frameWidth;
  switch (shard) {
    case "look":
      return [
        { id: "hue", label: "Hue", icon: PaletteIcon },
        { id: "texture", label: "Texture", icon: Grid2x2 },
        { id: "aura", label: "Aura", icon: Sparkles },
      ];
    case "size":
      return [
        { id: "left", label: "Left", icon: AlignLeft, act: () => update({ x: 0 }) },
        { id: "middle", label: "Middle", icon: AlignCenter, act: () => update({ x: Math.round((fw() - node.w) / 2) }) },
        { id: "right", label: "Right", icon: AlignRight, act: () => update({ x: fw() - node.w }) },
        { id: "full", label: "Full width", icon: Move, act: () => update({ x: 0, w: fw() }) },
      ];
    case "anim":
      return [
        { id: "el-fade", label: "Fade", icon: Play, act: () => update({ anim: "el-fade" }) },
        { id: "el-rise", label: "Rise", icon: Play, act: () => update({ anim: "el-rise" }) },
        { id: "el-grow", label: "Grow", icon: Play, act: () => update({ anim: "el-grow" }) },
        { id: "none", label: "None", icon: X, act: () => update({ anim: null }) },
      ];
    case "wiring":
      return [
        { id: "link", label: "Goes to", icon: Link2 },
        { id: "data", label: "Shows", icon: ListTree },
      ];
    case "prompt":
      return [
        { id: "must", label: "Must", icon: Wand2, act: () => update({ priority: "must" }) },
        { id: "nice", label: "Nice", icon: Wand2, act: () => update({ priority: "nice" }) },
        { id: "idea", label: "Idea", icon: Wand2, act: () => update({ priority: "idea" }) },
      ];
    default:
      return [
        { id: "name", label: "Name", icon: ListTree },
        { id: "holds", label: "Holds", icon: ListTree },
      ];
  }
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

function Panel({ shard, node, focus }: { shard: ShardId; node: StudioNode; focus: string | null }) {
  const feature = getFeature(node.featureId);
  const frameWidth = useStudio((s) => s.frameWidth);
  const pages = useStudio((s) => s.pages);
  const format = useStudio((st) => st.format);
  const look = useStudio((st) => st.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const s = () => useStudio.getState();
  const update = (patch: Partial<StudioNode>) => s().updateNode(node.id, patch);

  if (shard === "contents") {
    return focus === "holds" && feature?.content ? (
      <Row label={feature.content.label}>
        <Textarea autoGrow rows={3} value={node.content} aria-label={feature.content.label} placeholder={feature.content.placeholder} onChange={(e) => update({ content: e.target.value })} />
      </Row>
    ) : (
      <Row label="Name">
        <Input value={node.label} aria-label="Name" onChange={(e) => update({ label: e.target.value })} />
      </Row>
    );
  }

  if (shard === "size") {
    return (
      <>
        <div className="grid grid-cols-4 gap-1">
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
        <div className="mt-1 text-[9px] text-fg-faint">{Math.round((Math.min(node.w, frameWidth) / frameWidth) * 100)}% of the frame</div>
      </>
    );
  }

  if (shard === "look") {
    const layers = look.texture ?? [];
    if (focus === "texture") {
      return (
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
      );
    }
    if (focus === "aura") {
      return (
        <Row label="Border accent / aura">
          <Select
            value={node.aura ?? ""}
            onChange={(v) => update({ aura: v || null })}
            options={[{ value: "", label: "None" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
            aria-label="Aura colour"
          />
        </Row>
      );
    }
    return (
      <Row label="Hue">
        <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />
      </Row>
    );
  }

  if (shard === "anim") {
    return (
      <Row label="How it arrives">
        <Select
          value={node.anim ?? ""}
          onChange={(v) => update({ anim: v || null })}
          options={ENTRANCES}
          aria-label="How it arrives"
        />
      </Row>
    );
  }

  if (shard === "wiring") {
    const link = node.link;
    if (focus === "data") {
      return (
        <Row label="Data">
          <Textarea autoGrow rows={3} value={node.data} aria-label="Data" placeholder="What it shows or does" onChange={(e) => update({ data: e.target.value })} />
        </Row>
      );
    }
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
        ) : (
          <p className="text-[10px] text-fg-muted">This part does not send anyone anywhere.</p>
        )}
        {link?.kind === "url" ? (
          <Row label="Web address">
            <Input value={link.target} aria-label="Web address" onChange={(e) => update({ link: { kind: "url", target: e.target.value } })} />
          </Row>
        ) : null}
      </>
    );
  }

  // prompt — the priority is on the glass, so only the words are left here
  return (
    <Row label="Prompt for this element">
      <Textarea autoGrow rows={3} value={node.prompt} aria-label="Element prompt" placeholder={feature?.hint ?? "Specific to this placement…"} onChange={(e) => update({ prompt: e.target.value })} />
    </Row>
  );
}
