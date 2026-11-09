"use client";
/**
 * THE LOOKS POP-UPS: A SLAB'S CONTROLS BESIDE THE HAND.
 *
 * Press Edge, Texture, Aura or Hue on the wheel and its controls open in a
 * pop-up beside the wheel instead of the three slabs. On the square menu the
 * pop-up is the tag (J's pick A); on the round wheel it is the ring (design C):
 * the same controls on a slab of a ring round the wheel, at the slab's angle.
 * Which one is `popupShape` (`popupPlace.ts`), and where it stands is there too.
 *
 * No new values. Edge: corners go through the Page look's Corners slot
 * (`LookFields.tsx`), the edge is the wheel's own `node.edge`. Hue: the part's
 * own `colour` per role. Aura: `aura`, `auraSize`, `auraStyle`. Texture: the
 * part's `texture` and the site's layers, through the store's own texture
 * actions. Every write to a part goes through `applyToSelection`. A drag is one
 * undo step (`startGesture`..`endGesture`), a key press or a typed number is
 * one each. Esc closes the smaller one first, then this; a press outside closes
 * it. `tests/wheel-popups.mjs`, `tests/wheel-ring.mjs`.
 */
import * as React from "react";
import { Activity, Blend, CircleDot, Grid2x2, ImagePlus, Layers, MoveRight, Scan, Shuffle, Sparkles, SquareRoundCorner, Slash } from "lucide-react";
import { play } from "@/core/audio/engine";
import { SCREEN, VOID } from "@/core/ui/void";
import { endGesture, gestureFrame, inGesture, startGesture, useStudio, type StudioNode } from "../board/store";
import {
  auraColour, auraStyle, AURA_STYLES, css as oklchCss, newLayer, parseColor, reiterate, ROLES, ROLE_LABEL, tallyColours, textureCss, TEXTURE_KINDS,
  type AuraStyle, type Palette, type RoleId, type TextureLayer,
} from "../look";
import { LOOK_SLOTS } from "../LookFields";
import { PICKED, keyOf } from "../RingConsole";
import { readShadow, writeShadow, type ShadowKind } from "../RingEditors";
import { readPicture, refusal } from "../ImageIntake";
import {
  arcPath, frameStyle, placeBeside, placePopup, placeRing, placeRingBeside, RIM, RING_FACE, ringGlow, ringStyle, TITLE,
  type Arc, type Box, type Placed, type PopupShape,
} from "./popupPlace";
import { applyToSelection } from "./selectionEdit";

/** The green choices that open a pop-up instead of the slabs. */
export const POPUP_IDS = ["edge", "texture", "aura", "hue"] as const;
export type PopupId = (typeof POPUP_IDS)[number];
export const isPopup = (id: string | null | undefined): id is PopupId => !!id && (POPUP_IDS as readonly string[]).includes(id);

const FIELD: React.CSSProperties = { background: VOID.well, color: SCREEN.ink, boxShadow: `inset 0 0 0 1px ${VOID.rim}`, borderRadius: 9, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 11, fontWeight: 600 };

/**
 * Keys stay in the pop-up, or an arrow on a slider nudges the part too. Undo
 * and redo are the exception: on a slider, a key or a swatch they are the board's.
 */
const keepKeys = (e: React.KeyboardEvent) => {
  if (e.key === "Escape") return;
  e.stopPropagation();
  /* Anywhere but a field being typed in (a slider, a key, a swatch): the board's undo. */
  const t = e.target as HTMLInputElement;
  const typing = t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "range");
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || typing) return;
  e.preventDefault();
  const s = useStudio.getState();
  if (e.shiftKey) s.redo(); else s.undo();
};

const fresh = (id: string) => useStudio.getState().nodes.find((n) => n.id === id);

/** A write to the picked parts, the latest values of this part read at the moment it lands. */
const writer = (id: string) => (patch: (n: StudioNode) => Partial<StudioNode>) => {
  const n = fresh(id);
  if (n) applyToSelection(n, patch(n));
};

/** A slider the hand drags as one undo step; arrow keys are a step each. */
function Slide({ label, value, max, min = 0, unit = "px", onChange, onEnd, track }: {
  label: string; value: number; max: number; min?: number; unit?: string; onChange: (v: number) => void;
  /** Once the hand comes up. */
  onEnd?: () => void;
  /** A colour run behind the slider, for the colour sliders. */
  track?: string;
}) {
  const down = React.useRef(false);
  const end = React.useRef(onEnd);
  end.current = onEnd;
  const up = React.useCallback(() => { if (down.current) { down.current = false; endGesture(); end.current?.(); } }, []);
  /* The hand comes up wherever it has got to. Closing mid-drag still ends the drag. */
  React.useEffect(() => {
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); up(); };
  }, [up]);
  return (
    <label className="mt-2 block" data-popup-slider={label}>
      <span className="flex items-baseline justify-between text-[10.5px]" style={{ color: VOID.text }}>
        {label}
        <span style={{ fontFamily: FIELD.fontFamily, fontWeight: 600 }}>{value}{unit ? ` ${unit}` : ""}</span>
      </span>
      <input
        type="range" min={Math.min(min, value)} max={Math.max(max, value)} step={1} value={value} aria-label={label}
        className="mt-1 block w-full cursor-pointer" style={{ accentColor: SCREEN.ink, height: 14, ...(track ? { background: track, borderRadius: 7 } : {}) }}
        onPointerDown={() => { down.current = true; startGesture(); }}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (down.current || inGesture()) gestureFrame(() => onChange(v));
          else onChange(v);
        }}
      />
    </label>
  );
}

/** A number in a small field: one undo when it is typed. */
function Num({ label, value, glyph, onChange }: { label: string; value: number; glyph?: React.ReactNode; onChange: (v: number) => void }) {
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => setText(String(value)), [value]);
  const write = () => { const v = Number(text); if (Number.isFinite(v) && v >= 0 && v !== value) onChange(Math.round(v)); else setText(String(value)); };
  return (
    <label className="flex items-center gap-1 px-1.5 py-1" style={FIELD} title={label}>
      {glyph}
      <input
        aria-label={label} inputMode="numeric" value={text} className="w-full min-w-0 bg-transparent outline-none" spellCheck={false}
        onChange={(e) => setText(e.target.value)} onBlur={write}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      />
    </label>
  );
}

/** An icon key in its own colour, lit with the one mark a picked thing wears. */
function Key({ i, label, on, onPress, children, size = 30, disabled }: { i: number; label: string; on?: boolean; onPress: () => void; children: React.ReactNode; size?: number; disabled?: boolean }) {
  return (
    <button
      type="button" aria-label={label} aria-pressed={!!on} title={label} data-popup-key={label} disabled={disabled}
      onClick={() => { play("tap"); onPress(); }}
      className="tactile inline-flex shrink-0 items-center justify-center disabled:opacity-40"
      style={{ ...keyOf(i), width: size, height: size, borderRadius: 9, boxShadow: on ? PICKED : undefined }}
    >
      {children}
    </button>
  );
}

/** Small boxes that are each a choice: a colour, or (for textures) a tile. */
function Swatches({ items, value, onPick }: { items: { id: string; label: string; colour: string | null; style?: React.CSSProperties; glyph?: React.ReactNode }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((c) => (
        <button
          key={c.id || "none"} type="button" aria-label={c.label} title={c.label} data-popup-swatch={c.label}
          onClick={() => { play("tap"); onPick(c.id); }}
          className="tactile inline-flex size-5 items-center justify-center rounded-md"
          style={{ background: c.colour ?? VOID.box, outline: `1px solid ${VOID.rim}`, boxShadow: value === c.id ? PICKED : undefined, color: VOID.text, ...c.style }}
        >
          {c.glyph ?? (c.colour || c.style ? null : <Slash className="size-3" />)}
        </button>
      ))}
    </div>
  );
}

/** A note in the pop-up's own small type. */
const Say = ({ children }: { children: React.ReactNode }) => <div className="mt-1.5 text-[10.5px]" style={{ color: SCREEN.dim }}>{children}</div>;

/* ------------------------------------------------------------------ */
/* The shell: where it stands, what it wears, how it goes away          */
/* ------------------------------------------------------------------ */

interface Wheel { cx: number; cy: number; angle: number; reach: number; top: number }

/** The slab of ring behind a ring pop-up's controls. */
function RingFrame({ arc, which, id }: { arc: Arc; which: "main" | "small"; id: string }) {
  const g = `${id}-face`, l = `${id}-lines`;
  return (
    <svg className="pointer-events-none fixed left-0 top-0 z-[1] h-screen w-screen overflow-visible" style={{ filter: ringGlow(which) }} aria-hidden>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={RING_FACE.from} /><stop offset="1" stopColor={RING_FACE.to} /></linearGradient>
        <pattern id={l} width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill={RING_FACE.line} /></pattern>
      </defs>
      <g data-wheel-popup-frame={which} data-ring-cx={arc.cx.toFixed(1)} data-ring-cy={arc.cy.toFixed(1)} data-ring-in={arc.rIn.toFixed(1)} data-ring-out={arc.rOut.toFixed(1)} style={{ pointerEvents: "auto" }}>
        <path d={arcPath(arc)} fill={`url(#${g})`} />
        <path d={arcPath(arc)} fill={`url(#${l})`} stroke={RIM[which]} strokeWidth={1.5} strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function PopupShell({ which, shape, wheel, title, small, onCloseSmall, onClose, children }: {
  which: PopupId; shape: PopupShape; wheel: Wheel; title: string;
  /** The smaller pop-up, when one is open. */
  small: { id: string; title: string; body: React.ReactNode } | null;
  onCloseSmall: () => void; onClose: () => void; children: React.ReactNode;
}) {
  const big = React.useRef<HTMLDivElement>(null);
  const little = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState<(Placed & { arc?: Arc }) | null>(null);
  const [atSmall, setAtSmall] = React.useState<(Placed & { arc?: Arc }) | null>(null);
  const frameId = React.useId().replace(/:/g, "");
  const { cx, cy, angle, reach, top } = wheel;
  const ring = shape === "ring";
  const smallId = small?.id ?? null;

  /* It is measured where it stands, and stood again when it changes size or the wheel is carried. */
  React.useLayoutEffect(() => {
    const el = big.current;
    if (!el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      const w = { cx, cy, reach, top };
      const winW = window.innerWidth, winH = window.innerHeight;
      const p = ring ? placeRing(w, angle, r.width, r.height, winW, winH) : placePopup(w, angle, r.width, r.height, winW, winH);
      setAt(p);
      const sm = little.current;
      if (sm) {
        const s = sm.getBoundingClientRect();
        const parent: Box = { x: p.x, y: p.y, w: r.width, h: r.height };
        setAtSmall(ring && "arc" in p ? placeRingBeside((p as { arc: Arc }).arc, s.width, s.height, winW, winH) : placeBeside(parent, w, s.width, s.height, winW, winH));
      } else setAtSmall(null);
    };
    place();
    /* A section with more in it, or fewer, is stood again. */
    const watch = new ResizeObserver(place);
    watch.observe(el);
    if (little.current) watch.observe(little.current);
    return () => watch.disconnect();
  }, [cx, cy, angle, reach, top, ring, smallId]);

  /* Esc takes the smaller one first; the wheel's own Esc then closes this one. A press outside closes it. */
  const smallOpen = React.useRef(!!small);
  smallOpen.current = !!small;
  const closeSmall = React.useRef(onCloseSmall);
  closeSmall.current = onCloseSmall;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && smallOpen.current) { e.stopImmediatePropagation(); closeSmall.current(); }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      if ((e.target as Element).closest?.("[data-wheel-popup], [data-wheel-popup-frame]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown, true); };
  }, [onClose]);

  const stand = (p: Placed | null): React.CSSProperties => (p ? { left: p.x, top: p.y } : { left: 0, top: 0, visibility: "hidden" });
  const dress = (size: "main" | "small", w: number) => (ring ? ringStyle(size, w) : frameStyle(size, w));
  return (
    <>
      {ring && at?.arc ? <RingFrame arc={at.arc} which="main" id={`${frameId}m`} /> : null}
      <div
        ref={big} data-wheel-popup={which} data-popup-shape={shape} data-flip-x={at?.flipX ? "" : undefined} data-flip-y={at?.flipY ? "" : undefined}
        className="pointer-events-auto fixed z-[2] text-[12px]" style={{ ...dress("main", 238), ...stand(at) }}
        onKeyDown={keepKeys}
      >
        <div className="mb-2 font-mono text-[13px] font-bold" style={{ color: TITLE.main }}>{title}</div>
        {children}
      </div>

      {small ? (
        <>
          {ring && atSmall?.arc ? <RingFrame arc={atSmall.arc} which="small" id={`${frameId}s`} /> : null}
          <div
            ref={little} data-wheel-popup={small.id} data-popup-shape={shape} data-flip-x={atSmall?.flipX ? "" : undefined} data-flip-y={atSmall?.flipY ? "" : undefined}
            className="pointer-events-auto fixed z-[3] text-[12px]" style={{ ...dress("small", 164), ...stand(atSmall) }}
            onKeyDown={keepKeys}
          >
            <div className="mb-1.5 font-mono text-[12px] font-bold" style={{ color: TITLE.small }}>{small.title}</div>
            {small.body}
          </div>
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Edge                                                                */
/* ------------------------------------------------------------------ */

const SHADOWS: { id: ShadowKind; label: string; icon: React.ReactNode }[] = [
  { id: "hard", label: "Hard offset", icon: <MoveRight className="size-3.5" /> },
  { id: "soft", label: "Soft", icon: <Blend className="size-3.5" /> },
  { id: "glow", label: "Glow", icon: <Sparkles className="size-3.5" /> },
];

type Section = "corners" | "border" | "shadow" | "spacing";
const CORNER_NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"] as const;
const SIDES = ["top", "right", "bottom", "left"] as const;
const cornersSlot = LOOK_SLOTS.find((s) => s.prop === "border-radius")!;

const fourCorners = (n: StudioNode & { radii?: readonly number[] | null }): number[] =>
  Array.isArray(n.radii) && n.radii.length === 4 ? [...n.radii] : [n.radius ?? 0, n.radius ?? 0, n.radius ?? 0, n.radius ?? 0];

const isRole = (v: string | null | undefined) => !!v && (ROLES as readonly string[]).includes(v);

interface BodyProps { node: StudioNode; palette: Palette; shape: PopupShape; wheel: Wheel; onClose: () => void }

function EdgePopup({ node, palette, shape, wheel, onClose }: BodyProps) {
  const [section, setSection] = React.useState<Section>("corners");
  const [small, setSmall] = React.useState<"corners" | "sides" | null>(null);
  const write = React.useMemo(() => writer(node.id), [node.id]);

  const edge = node.edge ?? null;
  const width = edge && edge.style !== "none" ? edge.width ?? 1 : 0;
  const sh = readShadow(edge?.shadow);
  const inkOf = (v: string | undefined | null) => (v && isRole(v) ? palette[v as RoleId] : v) || null;
  const borderColour = inkOf(edge?.colour) ?? palette.text;
  const shadowColour = sh.colour ?? borderColour;
  const lineStyle = edge?.style && edge.style !== "none" ? edge.style : "solid";
  /* An edge with no line and no shadow is no edge at all. */
  const setEdge = (patch: Partial<NonNullable<StudioNode["edge"]>>) => write((n) => {
    const next = { ...(n.edge ?? {}), ...patch } as NonNullable<StudioNode["edge"]>;
    if (!next.shadow) delete next.shadow;
    return { edge: ((next.width ?? 0) > 0 && next.style !== "none") || next.shadow ? next : null };
  });

  const recent = useStudio((s) => s.recentColours);
  const siteColours = React.useMemo(() => {
    const t = tallyColours(useStudio.getState().nodes, palette);
    return [...new Set([...t.byUse.border, ...t.byUse.shadow, ...t.all].map((c) => c.value))];
  }, [palette]);
  const colours = (none: string) => [
    { id: "", label: none, colour: null },
    ...[...new Set([...siteColours.slice(0, 6), ...recent.slice(0, 4)])].map((c) => ({ id: c, label: `Colour ${c}`, colour: c })),
    ...ROLES.map((r) => ({ id: r as string, label: `The site's ${ROLE_LABEL[r].toLowerCase()}`, colour: palette[r] as string })),
  ];

  const corners = fourCorners(node);
  const setCorners = (four: number[]) => write((n) => cornersSlot.set(n, four.map((r) => `${r}px`).join(" ")));
  const pad = { top: node.pad?.top ?? 0, right: node.pad?.right ?? 0, bottom: node.pad?.bottom ?? 0, left: node.pad?.left ?? 0 };
  const setPad = (next: typeof pad) => write(() => ({ pad: next }));
  const hasGap = node.layout?.display === "flex" || node.layout?.display === "grid";

  const smallBody = small ? (
    <div className="grid grid-cols-2 gap-1.5">
      {small === "corners"
        ? [0, 1, 3, 2].map((i) => (
          <Num key={i} label={CORNER_NAMES[i]!} value={corners[i] ?? 0} glyph={<SquareRoundCorner className="size-3 shrink-0" style={{ transform: `rotate(${[270, 0, 90, 180][i]}deg)` }} />}
            onChange={(v) => setCorners(corners.map((c, k) => (k === i ? v : c)))} />
        ))
        : SIDES.map((side) => (
          <Num key={side} label={`Padding ${side}`} value={pad[side]} glyph={<span className="capitalize" style={{ color: SCREEN.dim }}>{side[0]}</span>}
            onChange={(v) => setPad({ ...pad, [side]: v })} />
        ))}
    </div>
  ) : null;

  return (
    <PopupShell
      which="edge" shape={shape} wheel={wheel} title="Edge" onClose={onClose} onCloseSmall={() => setSmall(null)}
      small={small ? { id: small, title: small === "corners" ? "Each corner" : "Each side", body: smallBody } : null}
    >
      <div className="flex gap-1.5">
        <Key i={0} label="Corners" on={section === "corners"} onPress={() => { setSection("corners"); setSmall(null); }}><SquareRoundCorner className="size-4" /></Key>
        <Key i={1} label="Border" on={section === "border"} onPress={() => { setSection("border"); setSmall(null); }}><Scan className="size-4" /></Key>
        <Key i={2} label="Shadow" on={section === "shadow"} onPress={() => { setSection("shadow"); setSmall(null); }}><Layers className="size-4" /></Key>
        <Key i={3} label="Spacing" on={section === "spacing"} onPress={() => { setSection("spacing"); setSmall(null); }}><Grid2x2 className="size-4" /></Key>
      </div>

      {section === "corners" ? (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1"><Slide label="Corners" value={Math.max(...corners)} max={64} onChange={(v) => setCorners([v, v, v, v])} /></div>
          <Key i={4} size={24} label="Each corner" on={small === "corners"} onPress={() => setSmall(small === "corners" ? null : "corners")}><SquareRoundCorner className="size-3.5" /></Key>
        </div>
      ) : null}

      {section === "border" ? (
        <>
          <Slide label="Border width" value={width} max={12} onChange={(w) => setEdge(w ? { width: w, style: lineStyle, colour: edge?.colour ?? borderColour } : { width: 0, style: "none" })} />
          <Swatches items={colours("No border")} value={width ? edge?.colour ?? "" : ""} onPick={(id) => setEdge(id ? { colour: id, width: width || 2, style: lineStyle } : { width: 0, style: "none" })} />
        </>
      ) : null}

      {section === "shadow" ? (
        <>
          <div className="mt-2 flex gap-1.5">
            {SHADOWS.map((k, i) => <Key key={k.id} i={i + 5} size={24} label={k.label} on={sh.kind === k.id} onPress={() => setEdge({ shadow: writeShadow(k.id, sh.size, shadowColour) })}>{k.icon}</Key>)}
          </div>
          <Slide label="Shadow size" value={sh.kind === "none" ? 0 : sh.size} max={24} onChange={(v) => setEdge({ shadow: v ? writeShadow(sh.kind === "none" ? "hard" : sh.kind, v, shadowColour) : undefined })} />
          <Swatches items={colours("No shadow")} value={sh.kind === "none" ? "" : sh.colour ?? ""} onPick={(id) => setEdge({ shadow: id ? writeShadow(sh.kind === "none" ? "hard" : sh.kind, sh.size, inkOf(id) ?? id) : undefined })} />
        </>
      ) : null}

      {section === "spacing" ? (
        <>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1"><Slide label="Padding" value={Math.max(pad.top, pad.right, pad.bottom, pad.left)} max={96} onChange={(v) => setPad({ top: v, right: v, bottom: v, left: v })} /></div>
            <Key i={4} size={24} label="Each side" on={small === "sides"} onPress={() => setSmall(small === "sides" ? null : "sides")}><Grid2x2 className="size-3.5" /></Key>
          </div>
          {hasGap ? <Slide label="Gap" value={node.layout?.gap ?? 0} max={96} onChange={(v) => write((n) => ({ layout: { ...(n.layout ?? {}), gap: v } }))} /> : null}
        </>
      ) : null}
    </PopupShell>
  );
}

/* ------------------------------------------------------------------ */
/* Colour: the three runs Hue and Aura share (`SpectrumSlab`)          */
/* ------------------------------------------------------------------ */

/** Below this strength a hue run would move nothing, so a hue drag lifts it this far (as the slabs do). */
const LIVE = 0.14;
const runOf = (at: (f: number) => string) => `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(at).join(", ")})`;

function Spectrum({ colour, onChange, onEnd }: { colour: { l: number; c: number; h: number }; onChange: (next: string) => void; onEnd?: () => void }) {
  const c = colour;
  const hue = Math.round((((c.h % 360) + 360) % 360));
  return (
    <>
      <Slide label="Hue" unit="°" value={hue} max={360} onEnd={onEnd} track={runOf((f) => oklchCss({ l: 0.7, c: 0.19, h: f * 360 }))}
        onChange={(v) => onChange(oklchCss({ ...c, c: Math.max(c.c, LIVE), h: v }))} />
      <Slide label="Lightness" unit="%" value={Math.round(c.l * 100)} min={8} max={98} onEnd={onEnd} track={runOf((f) => oklchCss({ ...c, l: 0.08 + f * 0.9 }))}
        onChange={(v) => onChange(oklchCss({ ...c, l: v / 100 }))} />
      <Slide label="Strength" unit="" value={Math.round(c.c * 100)} max={32} onEnd={onEnd} track={runOf((f) => oklchCss({ ...c, c: f * 0.32 }))}
        onChange={(v) => onChange(oklchCss({ ...c, c: v / 100 }))} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hue                                                                 */
/* ------------------------------------------------------------------ */

/** The part's own colours, one role at a time, as the Hue slabs do (`HueQuads`). */
function HuePopup({ node, palette, shape, wheel, onClose }: BodyProps) {
  const [role, setRole] = React.useState<RoleId>("bg");
  const write = React.useMemo(() => writer(node.id), [node.id]);
  const colour = node.colour ?? null;
  const current = colour?.[role] ?? "";
  const named = isRole(current);
  const set = (value: string | null) => write((n) => {
    const next: Record<string, string> = { ...(n.colour ?? {}) };
    if (value === null) delete next[role];
    else next[role] = value;
    return { colour: Object.values(next).some(Boolean) ? next : null };
  });
  const shown = current && !named ? current : palette[role];
  const c = parseColor(shown) ?? { l: 0.7, c: 0.18, h: 265 };
  const remember = () => { const v = fresh(node.id)?.colour?.[role]; if (v && !isRole(v)) useStudio.getState().rememberColour(v); };

  return (
    <PopupShell which="hue" shape={shape} wheel={wheel} title="Hue" onClose={onClose} onCloseSmall={() => {}} small={null}>
      <Say>Painting</Say>
      <Swatches
        value={role} onPick={(id) => setRole(id as RoleId)}
        items={ROLES.map((r) => ({ id: r, label: `${ROLE_LABEL[r]} on this part`, colour: (colour?.[r] && !isRole(colour[r]) ? colour[r]! : palette[(colour?.[r] as RoleId) ?? r] ?? palette[r]) as string }))}
      />
      <Say>{ROLE_LABEL[role]}: set it to</Say>
      <Swatches
        value={named ? current : current ? "~" : ""} onPick={(id) => set(id === "" ? null : id)}
        items={[
          { id: "", label: "Follow the site", colour: palette[role] as string, glyph: <span className="text-[7px] font-bold" style={{ color: VOID.text, mixBlendMode: "difference" }}>SITE</span> },
          ...ROLES.map((r) => ({ id: r as string, label: `Use the site's ${ROLE_LABEL[r].toLowerCase()}`, colour: palette[r] as string })),
        ]}
      />
      <Spectrum colour={c} onChange={set} onEnd={remember} />
    </PopupShell>
  );
}

/* ------------------------------------------------------------------ */
/* Aura                                                                */
/* ------------------------------------------------------------------ */

const STYLE_GLYPH: Record<AuraStyle, React.ReactNode> = {
  glow: <Sparkles className="size-3.5" />,
  ring: <CircleDot className="size-3.5" />,
  pulse: <Activity className="size-3.5" />,
};
/** How far the size runs, as a multiple of the usual reach (the slabs' `AURA_SIZE`). */
const AURA_SIZE: [number, number] = [0.5, 2.2];

/** The glow round a part: its colour, how it is worn and how far it reaches, as the Aura slabs do (`AuraQuads`). */
function AuraPopup({ node, palette, shape, wheel, onClose }: BodyProps) {
  const write = React.useMemo(() => writer(node.id), [node.id]);
  const recent = useStudio((s) => s.recentColours);
  const value = node.aura ?? null;
  const size = node.auraSize ?? 1;
  const style = node.auraStyle ?? "glow";
  const colour = auraColour(value, palette);
  const c = parseColor(colour ?? palette.accent) ?? { l: 0.7, c: 0.18, h: 265 };
  const set = (patch: Partial<Pick<StudioNode, "aura" | "auraSize" | "auraStyle">>) => write(() => patch);
  const remember = () => { const v = fresh(node.id)?.aura; if (v && !isRole(v)) useStudio.getState().rememberColour(v); };

  return (
    <PopupShell which="aura" shape={shape} wheel={wheel} title="Aura" onClose={onClose} onCloseSmall={() => {}} small={null}>
      <div className="flex items-center gap-1.5">
        {AURA_STYLES.map((s, i) => <Key key={s.id} i={i} label={s.label} on={!!value && style === s.id} onPress={() => set(value ? { auraStyle: s.id } : { auraStyle: s.id, aura: "accent" })}>{STYLE_GLYPH[s.id]}</Key>)}
        <div
          data-aura-sample="" title={colour ? "What the part wears" : "No aura yet"}
          className="ml-auto flex size-[30px] items-center justify-center rounded-[7px]"
          style={{ background: palette.surface, outline: colour ? undefined : `1px dashed ${SCREEN.dim}`, transition: "box-shadow 160ms ease-out", ...((auraStyle(value, palette, Math.min(size, 1), style) ?? {}) as React.CSSProperties) }}
        >
          <Sparkles className="size-3" style={{ color: colour ?? SCREEN.dim }} />
        </div>
      </div>
      <Swatches
        value={value ?? ""} onPick={(id) => set({ aura: id || null })}
        items={[
          { id: "", label: "No aura", colour: null },
          ...recent.slice(0, 5).map((col) => ({ id: col, label: `Recent colour ${col}`, colour: col })),
          ...ROLES.map((r) => ({ id: r as string, label: `${ROLE_LABEL[r]} aura`, colour: palette[r] as string })),
        ]}
      />
      <Slide label="Aura size" unit="%" value={Math.round(size * 100)} min={AURA_SIZE[0] * 100} max={AURA_SIZE[1] * 100}
        onChange={(v) => set({ auraSize: Math.round((v / 100) * 20) / 20 })} />
      <Spectrum colour={c} onChange={(next) => set({ aura: next })} onEnd={remember} />
    </PopupShell>
  );
}

/* ------------------------------------------------------------------ */
/* Texture                                                             */
/* ------------------------------------------------------------------ */

/** Which of the site's texture layers the part wears, a picture of its own, a re-roll and the drift, as the Texture slabs do (`TextureQuads`). */
function TexturePopup({ node, palette, shape, wheel, onClose }: BodyProps) {
  const write = React.useMemo(() => writer(node.id), [node.id]);
  const layers = useStudio((s) => s.look.texture ?? []);
  const file = React.useRef<HTMLInputElement>(null);
  /* What the last picture door said: a refusal, or a note on what was kept. */
  const [said, setSaid] = React.useState<string | null>(null);
  const value = node.texture ?? null;
  const current = layers.find((l) => l.id === value) ?? null;
  const set = (texture: string | null) => write(() => ({ texture }));
  const take = (src: string, note?: string) => {
    setSaid(note ?? null);
    const layer = { ...newLayer("image"), src, target: "surfaces" as const };
    useStudio.getState().addTexture(layer);
    play("confirm");
    set(layer.id);
  };
  const tile = (l: TextureLayer): React.CSSProperties => {
    const css = textureCss([{ ...l, on: true }], palette, palette.surface);
    return { ...css, backgroundSize: css.backgroundSize ?? "cover" } as React.CSSProperties;
  };

  return (
    <PopupShell which="texture" shape={shape} wheel={wheel} title="Texture" onClose={onClose} onCloseSmall={() => {}} small={null}>
      <div className="flex gap-1.5">
        <Key i={0} label="Add a picture" onPress={() => file.current?.click()}><ImagePlus className="size-4" /></Key>
        <Key i={1} label="Reiterate" disabled={!current} onPress={() => { if (current) useStudio.getState().updateTexture(current.id, reiterate(current)); }}><Shuffle className="size-4" /></Key>
      </div>
      <Say>{layers.length ? "Site stack" : "No site stack"}</Say>
      <Swatches
        value={value ?? "site"} onPick={(id) => set(id === "site" ? null : id)}
        items={[
          { id: "site", label: "Follow the site", colour: VOID.well, glyph: <span className="text-[7px] font-bold" style={{ color: VOID.text }}>SITE</span> },
          { id: "none", label: "No texture", colour: null },
          ...layers.map((l, i) => ({ id: l.id, label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`, colour: null, style: tile(l) })),
        ]}
      />
      {current ? (
        <Slide label="Drift" unit="%" value={Math.round((current.drift ?? 0) * 100)} max={100}
          onChange={(v) => useStudio.getState().updateTexture(current.id, { drift: v / 100 })} />
      ) : <Say>Pick a layer to re-roll or drift it</Say>}
      {said ? <Say>{said}</Say> : null}
      <input
        ref={file} type="file" accept="image/*" className="hidden" aria-label="Add a texture"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void readPicture(f).then((p) => take(p.src, p.note)).catch((err: unknown) => { play("deny"); setSaid(refusal(err)); });
          e.target.value = "";
        }}
      />
    </PopupShell>
  );
}

/* ------------------------------------------------------------------ */
/* The layer                                                           */
/* ------------------------------------------------------------------ */

/** The layer: the wheel's middle, the slab's angle and the wheel's shape are all it knows of the wheel. */
export function WheelPopup({ which, shape, node, palette, cx, cy, angle, reach, top, onClose }: {
  which: PopupId; shape: PopupShape; node: StudioNode; palette: Palette; cx: number; cy: number; angle: number;
  /** How far the wheel runs out from its middle, on its flats. */
  reach: number;
  /** The top of the green menu it came from, which the tag stays level with. */
  top: number; onClose: () => void;
}) {
  const props: BodyProps = { node, palette, shape, wheel: { cx, cy, angle, reach, top }, onClose };
  if (which === "hue") return <HuePopup {...props} />;
  if (which === "aura") return <AuraPopup {...props} />;
  if (which === "texture") return <TexturePopup {...props} />;
  return <EdgePopup {...props} />;
}
