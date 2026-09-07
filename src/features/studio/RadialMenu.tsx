"use client";
/**
 * The part menu, cut into panes around the pointer.
 *
 * Right-click a part and a pane of glass breaks around where you clicked: nine
 * pieces surrounding the point, every seam wobbly, every piece a different
 * size because they run out to the edge of a square rather than a circle — the
 * ones on the corners are big, the ones on the flats are small, the way glass
 * actually breaks. Each is outlined in its own neon colour and empty in the
 * middle.
 *
 * A circle of clear space is left in the centre, and the pointer's red dot
 * sits in it: every pane's inner edge is an arc bowed away from the cursor, so
 * the thing you just right-clicked is never under the menu.
 *
 * Picking a pane fills it with hatching in its own colour, the way you would
 * scribble the chosen one in. Three panes do their one thing and close. The
 * other six break a second, smaller cluster across the pointer from the pane
 * you picked — all one green, its marks drawn in white line — holding that
 * group's choices, with a hairline of control hung under it.
 *
 * Every pane is one SVG path: out along a seam, round the outside, back down
 * the next seam, home along the arc. Each run is bowed by a seeded amount, so
 * the geometry is the hit area and the whole thing looks cut rather than
 * computed. The seed is the pane's index, so it breaks the same way every time.
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

/**
 * The panes surround the pointer.
 *
 * The pointer's red dot is the middle of the thing, and a circle of clear
 * space is left around it — every pane's inner edge is an arc bowed away from
 * the cursor, so the point you clicked is never covered and you can always see
 * what you right-clicked on. Outwards, the panes run to the edge of a rough
 * square rather than a circle, which is what makes them uneven: the ones on
 * the corners are big, the ones on the flats are small, exactly as a pane of
 * glass breaks.
 */

/** Clear space kept around the pointer, in px. */
const HOLE = 40;
/** Half the width of the square the panes break out to. */
const REACH = 132;
/** The second slab is smaller and sits clear of the first. */
const HOLE2 = 22;
const REACH2 = 78;

/**
 * Where the seams fall, as turns round the circle.
 *
 * Uneven on purpose, and they do not start at a right angle: a mosaic whose
 * seams line up with the screen reads as a grid.
 */
const SEAMS = [0.02, 0.13, 0.26, 0.36, 0.5, 0.6, 0.72, 0.85, 0.93];

/** Deterministic noise, so a pane breaks the same way every time. */
function noise(seed: number): () => number {
  let t = seed * 1831565813 + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** The point on a square of half-width `half` in the direction `turn`. */
function onSquare(turn: number, half: number): [number, number] {
  const a = turn * Math.PI * 2 - Math.PI / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const reach = 1 / Math.max(Math.abs(c), Math.abs(s));
  return [c * half * reach, s * half * reach];
}

const onCircle = (turn: number, r: number): [number, number] => {
  const a = turn * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

/**
 * One pane: out along a seam, round the outside of the square, back down the
 * next seam, and home along an arc that curves away from the pointer.
 *
 * Every straight run is drawn as a bowed quadratic with a seeded offset, so
 * the whole thing looks cut by hand rather than swept by a compass.
 */
function cutPane(from: number, to: number, hole: number, reach: number, seed: number, bow = 4.5): string {
  const rand = noise(seed);
  const p = (v: [number, number]) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;
  /** A wobbled line from a to b. */
  const wob = (a: [number, number], b: [number, number]) => {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const off = rand() * bow;
    return ` Q ${(mx + (-dy / len) * off).toFixed(1)} ${(my + (dx / len) * off).toFixed(1)} ${p(b)}`;
  };

  const span = (to - from + 1) % 1 || 1;
  const startIn = onCircle(from, hole);
  let d = `M ${p(startIn)}`;
  // Out along the first seam.
  d += wob(startIn, onSquare(from, reach));
  // Round the outside. Four samples, so a pane that turns a corner of the
  // square actually turns it instead of cutting it off.
  let prev = onSquare(from, reach);
  for (let i = 1; i <= 4; i++) {
    const next = onSquare(from + (span * i) / 4, reach);
    d += wob(prev, next);
    prev = next;
  }
  // Back down the next seam.
  const endIn = onCircle(to, hole);
  d += wob(prev, endIn);
  // And home along the hole, bowed away from the pointer.
  d += ` A ${hole} ${hole} 0 0 0 ${p(startIn)} Z`;
  return d;
}

/** Where a pane's icon and word sit: mid-turn, between the hole and the edge. */
function paneCentre(from: number, to: number, hole: number, reach: number): { x: number; y: number } {
  const span = (to - from + 1) % 1 || 1;
  const mid = from + span / 2;
  const out = onSquare(mid, reach);
  const inn = onCircle(mid, hole);
  return { x: (out[0] + inn[0]) / 2, y: (out[1] + inn[1]) / 2 };
}

/** The `n` seams of a small slab, spread unevenly over one turn. */
function seamsFor(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i / n + (i % 2 ? 0.035 : -0.03) + 1) % 1);
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
    The pointer is the middle of it. The panes are kept on screen by moving
    the whole thing, never by rearranging it, so the shape you learn is the
    shape you always get.
  */
  const edge = (REACH + REACH2) * 1.42 + REACH2 + 60;
  const px = Math.max(edge, Math.min(window.innerWidth - edge, open.x));
  const py = Math.max(edge, Math.min(window.innerHeight - edge, open.y));

  const index = picked ? SHARDS.findIndex((w) => w.id === picked) : -1;
  const chosen = index >= 0 ? SHARDS[index] : null;
  // The green cluster lands across the pointer from the pane you picked.
  const turn = index >= 0 ? (SEAMS[index]! + ((SEAMS[(index + 1) % SEAMS.length]! - SEAMS[index]! + 1) % 1) / 2) : 0;
  // Far enough out that the two clusters never touch: both reach to the
  // corner of a square, which is √2 further than the flat.
  const away = onSquare((turn + 0.5) % 1, (REACH + REACH2) * 1.42 + 14);
  const subs = chosen ? subPanes(chosen.id, node) : [];

  return (
    // Above the top bar and the status bar: a menu opened near an edge used to
    // have panes behind the chrome, unreachable.
    <div data-radial className="pointer-events-none fixed inset-0 z-[68]">
      <div className="absolute" style={{ left: px, top: py }}>
        <Cluster
          hole={HOLE}
          reach={REACH}
          seams={SEAMS}
          at={{ x: 0, y: 0 }}
          items={SHARDS.map((w) => ({
            id: w.id,
            label: w.id === "lock" && node.locked ? "Unlock" : w.label,
            icon: w.id === "lock" && node.locked ? Unlock : w.icon,
            hue: w.hue,
            on: picked === w.id,
            onPick: () => choose(w),
          }))}
        />

        {/* the cursor itself, in the clear circle the panes leave for it */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-[3px] -top-[3px] size-1.5 rounded-full"
          style={{ background: "oklch(0.72 0.22 28)", boxShadow: "0 0 8px 2px oklch(0.7 0.22 28 / 0.7)" }}
        />

        {chosen ? (
          <div data-radial-panel={chosen.id} className="pointer-events-auto absolute" style={{ left: 0, top: 0 }}>
            <Cluster
              green
              hole={HOLE2}
              reach={REACH2}
              seams={seamsFor(Math.max(2, subs.length))}
              at={{ x: away[0], y: away[1] }}
              items={subs.map((sub) => ({
                id: sub.id,
                label: sub.label,
                icon: sub.icon,
                hue: 150,
                on: sub.id === subPick,
                onPick: () => { play("select"); sub.act ? sub.act() : setSubPick(sub.id); },
              }))}
            />
            {/* One line of control, hung under the green glass — a hairline,
                not a card: the panes are the menu, this is only the value. */}
            <div
              data-radial-strip=""
              className="absolute w-[224px] -translate-x-1/2 rounded-md px-2 py-1.5"
              style={{
                left: away[0],
                top: away[1] + REACH2 + 14,
                background: "oklch(0.13 0.02 150 / 0.82)",
                border: "1px solid oklch(0.78 0.19 150 / 0.55)",
                boxShadow: "0 0 14px oklch(0.7 0.2 150 / 0.22)",
              }}
            >
              <Panel shard={chosen.id} node={node} focus={subPick} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One cluster of cut glass                                            */
/* ------------------------------------------------------------------ */

interface ClusterItem {
  id: string;
  label: string;
  icon: typeof Wand2;
  hue: number;
  on: boolean;
  onPick: () => void;
}

function Cluster({
  hole, reach, seams, items, at, green,
}: {
  hole: number;
  reach: number;
  seams: number[];
  items: ClusterItem[];
  at: { x: number; y: number };
  /** The second level is all one green, with its marks drawn in white line. */
  green?: boolean;
}) {
  const shown = items.slice(0, seams.length);
  return (
    <div className="absolute" style={{ left: at.x, top: at.y }}>
      <svg
        width={1}
        height={1}
        className="absolute left-0 top-0 overflow-visible"
        style={{ filter: "drop-shadow(0 8px 26px oklch(0 0 0 / 0.6))" }}
      >
        <defs>
          {shown.map((it) =>
            it.on ? (
              // The chosen pane is scribbled in, the way you would mark it.
              <pattern key={it.id} id={`hatch-${it.id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
                <line x1="0" y1="0" x2="0" y2="7" stroke={`oklch(0.8 0.2 ${green ? 150 : it.hue})`} strokeWidth="2.2" />
              </pattern>
            ) : null,
          )}
        </defs>
        {shown.map((it, i) => {
          const stroke = green ? "oklch(0.84 0.2 150)" : `oklch(${it.on ? 0.92 : 0.8} 0.21 ${it.hue})`;
          return (
            <path
              key={it.id}
              role="button"
              tabIndex={0}
              aria-label={it.label}
              aria-pressed={it.on}
              data-shard={it.id}
              d={cutPane(seams[i]!, seams[(i + 1) % seams.length]!, hole, reach, i + 1 + (green ? 90 : 0))}
              onClick={it.onPick}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); it.onPick(); } }}
              className="pointer-events-auto cursor-pointer outline-none"
              fill={it.on ? `url(#hatch-${it.id})` : "oklch(0.13 0.02 265 / 0.9)"}
              stroke={stroke}
              strokeWidth={it.on ? 2.4 : 1.6}
              strokeLinejoin="round"
              style={{ filter: it.on ? `drop-shadow(0 0 7px ${stroke})` : undefined }}
            />
          );
        })}
      </svg>
      {shown.map((it, i) => {
        const c = paneCentre(seams[i]!, seams[(i + 1) % seams.length]!, hole, reach);
        const Icon = it.icon;
        return (
          <span
            key={it.id}
            aria-hidden
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[9px] font-medium leading-tight"
            style={{
              left: c.x,
              top: c.y,
              // Level two is one green; its marks are white line, so the
              // colour says "second level" and the drawing says which one.
              color: green ? "oklch(0.99 0 0)" : `oklch(${it.on ? 0.96 : 0.88} 0.15 ${it.hue})`,
            }}
          >
            <Icon className="size-4" strokeWidth={green ? 1.5 : 2} />
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
