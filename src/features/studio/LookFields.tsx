"use client";

/**
 * THE PAGE LOOK: A SLOT FOR EVERYTHING ELSE A PART WEARS.
 *
 * What a brought-in page paints that the builder's colour, edge, font and
 * corner fields do not name (PST's TV: gradients, the dotted page, the
 * speaker's stripes, stacked and inset shadows, turned rods and slanted
 * feet, the static's filter, glowing words, the antennas' sway, a button
 * that sinks when pressed). Each is a slot: it comes in from the capture
 * (`pageParts.ts`), shows here as the CSS it is, is edited as that CSS, and
 * goes back out through the style layer (`styleLayer.ts#artCss`,
 * `#statesCss`), so a changed slot is a declaration in the repository's
 * own stylesheet. Empty is none.
 *
 * The same fields in the Inspector's Page look and on the wheel's Edit
 * plate: the wheel is the whole editor (docs/DESIGN.md).
 */
import * as React from "react";
import { Input } from "@/core/ui/input";
import { useStudio, type StudioNode } from "./board/store";
import { artCss, statesCss } from "./send-out";
import type { NodeArt } from "./shelf/run";
import type { MotionAnimation, MotionState, MotionTransition } from "./shelf";

/** Commas and spaces outside brackets: `a(1, 2) b, c` is two items, the first of two words. */
const commas = (v: string) => v.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
const words = (v: string) => v.match(/(?:[^\s(]+\([^)]*\)[^\s]*|[^\s]+)/g) ?? [];
const TIME = /^-?[\d.]+m?s$/;

/** `pulse 2s ease-in-out 0s infinite alternate both`, read as its parts in any order CSS allows. */
export function readAnimations(v: string): MotionAnimation[] {
  return commas(v).flatMap((item) => {
    const a: MotionAnimation = { name: "" };
    for (const w of words(item)) {
      if (TIME.test(w)) { if (!a.duration) a.duration = w; else a.delay = w; }
      else if (/^(infinite|[\d.]+)$/.test(w)) a.iterations = w;
      else if (/^(normal|reverse|alternate|alternate-reverse)$/.test(w)) a.direction = w;
      else if (/^(none|forwards|backwards|both)$/.test(w)) a.fill = w;
      else if (/^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$|^(cubic-bezier|steps|linear)\(/.test(w)) a.timing = w;
      else if (!a.name) a.name = w;
    }
    return a.name ? [a] : [];
  });
}

/** `transform 120ms ease 0s, box-shadow 160ms`. */
export function readTransitions(v: string): MotionTransition[] {
  return commas(v).flatMap((item) => {
    const t: MotionTransition = { property: "" };
    for (const w of words(item)) {
      if (TIME.test(w)) { if (!t.duration) t.duration = w; else t.delay = w; }
      else if (!t.property) t.property = w;
      else t.timing = w;
    }
    return t.property ? [t] : [];
  });
}

interface Slot { prop: string; label: string; get: (n: StudioNode) => string; set: (n: StudioNode, v: string) => Partial<StudioNode> }

const artWith = (n: StudioNode, patch: Partial<NodeArt>): Partial<StudioNode> => {
  const next = { ...(n.art ?? {}), ...patch } as Record<string, unknown>;
  for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
  return { art: Object.keys(next).length ? (next as NodeArt) : null };
};
const art = (prop: string, label: string, key: keyof NodeArt): Slot => ({ prop, label, get: (n) => artCss(n)[prop] ?? "", set: (n, v) => artWith(n, { [key]: v || undefined }) });
const option = (prop: string, label: string, key: "backgroundOptions" | "maskOptions", i: number): Slot => ({
  prop, label,
  get: (n) => artCss(n)[prop] ?? "",
  set: (n, v) => { const o = [...(n.art?.[key] ?? ["auto", "0% 0%", "repeat"])]; o[i] = v || (i === 0 ? "auto" : i === 1 ? "0% 0%" : "repeat"); return artWith(n, { [key]: o }); },
});
const motionWith = (n: StudioNode, patch: Record<string, unknown>): Partial<StudioNode> => {
  const next = { ...(n.motion ?? {}), ...patch } as Record<string, unknown>;
  for (const k of Object.keys(next)) if (next[k] === undefined || (Array.isArray(next[k]) && !(next[k] as unknown[]).length)) delete next[k];
  return { motion: Object.keys(next).length ? (next as StudioNode["motion"]) : null };
};
const state = (pseudo: string, label: string, list: "hover" | "active" | "focus"): Slot => ({
  prop: `:${pseudo}`, label,
  get: (n) => statesCss(n)[pseudo] ?? "",
  set: (n, v) => {
    const style = Object.fromEntries(v.split(/;(?![^(]*\))/).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }).filter(([k, x]) => k && x));
    /* Its own rules for this state give way to the one written here; an ancestor's stay. */
    const kept = (n.motion?.[list] ?? []).filter((r: MotionState) => r.self === false || (r.state || "hover") !== pseudo);
    return motionWith(n, { [list]: Object.keys(style).length ? [...kept, { self: true, state: pseudo, style }] : kept });
  },
});

export const LOOK_SLOTS: readonly Slot[] = [
  art("background-image", "Gradient or pattern", "background"),
  option("background-size", "Pattern size", "backgroundOptions", 0),
  option("background-position", "Pattern place", "backgroundOptions", 1),
  option("background-repeat", "Pattern repeat", "backgroundOptions", 2),
  { prop: "box-shadow", label: "Shadows", get: (n) => n.edge?.shadow ?? "", set: (n, v) => ({ edge: { ...(n.edge ?? { width: 0, style: "none" }), shadow: v || undefined } }) },
  {
    prop: "border-radius", label: "Corners",
    get: (n) => artCss(n)["border-radius"] ?? (n.radius ? `${n.radius}px` : ""),
    set: (_n, v) => {
      const r = (v.split("/")[0] ?? "").match(/[\d.]+/g)?.map(Number) ?? [];
      const four = r.length === 1 ? [r[0]!, r[0]!, r[0]!, r[0]!] : r.length === 2 ? [r[0]!, r[1]!, r[0]!, r[1]!] : r.length === 3 ? [r[0]!, r[1]!, r[2]!, r[1]!] : r.slice(0, 4);
      return four.length === 4 && new Set(four).size > 1 ? { radii: four, radiiY: null, radius: null } : { radius: four[0] ?? null, radii: null, radiiY: null };
    },
  },
  art("transform", "Turn, slant or scale", "transform"),
  art("transform-origin", "Turn point", "origin"),
  art("filter", "Filter", "filter"),
  art("backdrop-filter", "Backdrop", "backdrop"),
  art("mix-blend-mode", "Blend", "blend"),
  art("clip-path", "Clip", "clipPath"),
  art("mask-image", "Mask", "mask"),
  option("mask-size", "Mask size", "maskOptions", 0),
  art("text-shadow", "Text glow", "textShadow"),
  {
    prop: "-webkit-text-stroke", label: "Text outline",
    get: (n) => artCss(n)["-webkit-text-stroke"] ?? "",
    set: (n, v) => { const w = parseFloat(v); const colour = v.replace(/^\s*[\d.]+px\s*/, "").trim(); return artWith(n, { textStroke: w > 0 ? { w, color: colour || "currentColor" } : undefined }); },
  },
  art("paint-order", "Paint order", "paintOrder"),
  { prop: "opacity", label: "See-through", get: (n) => (typeof n.opacity === "number" && n.opacity < 1 ? String(n.opacity) : ""), set: (_n, v) => { const o = parseFloat(v); return { opacity: Number.isFinite(o) && o >= 0 && o < 1 ? o : null }; } },
  { prop: "animation", label: "Animation", get: (n) => artCss(n).animation ?? "", set: (n, v) => motionWith(n, { animation: readAnimations(v) }) },
  { prop: "transition", label: "Easing", get: (n) => artCss(n).transition ?? "", set: (n, v) => motionWith(n, { transition: readTransitions(v) }) },
  state("hover", "Pointed at", "hover"),
  state("active", "Pressed", "active"),
  state("focus-visible", "Keyboard focus", "focus"),
];

/** How many slots this part fills. */
export function lookCount(n: StudioNode): number {
  return LOOK_SLOTS.filter((s) => s.get(n).trim()).length;
}

/**
 * The slots, the filled ones first. A field holds its text while it is
 * being typed and writes the part when it is left or Enter is pressed, so a
 * half-written gradient never reaches the board.
 */
export function LookFields({ node, inputClass }: { node: StudioNode; inputClass?: string }) {
  const filled = LOOK_SLOTS.filter((s) => s.get(node).trim());
  const empty = LOOK_SLOTS.filter((s) => !s.get(node).trim());
  return (
    <div className="space-y-1.5" data-look-fields="">
      {[...filled, ...empty].map((s) => (
        <LookField key={s.prop} node={node} slot={s} inputClass={inputClass} />
      ))}
    </div>
  );
}

function LookField({ node, slot, inputClass }: { node: StudioNode; slot: Slot; inputClass?: string }) {
  const value = slot.get(node);
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  const write = () => {
    if (text.trim() === value.trim()) return;
    const now = useStudio.getState().nodes.find((n) => n.id === node.id);
    if (now) useStudio.getState().updateNode(node.id, slot.set(now, text.trim()));
  };
  return (
    <label className="block" data-look-slot={slot.prop}>
      <span className="text-small text-fg-muted">{slot.label} <span className="text-fg-faint">{slot.prop}</span></span>
      <Input
        value={text}
        inputSize="sm"
        className={inputClass}
        placeholder="none"
        aria-label={slot.label}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={write}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); write(); } }}
      />
    </label>
  );
}
