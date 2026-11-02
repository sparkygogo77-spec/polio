"use client";
/**
 * THE EDGE POP-UP: A SLAB'S CONTROLS BESIDE THE HAND.
 *
 * Press Edge on the wheel and a small rounded pop-up leaves the wheel along
 * that slab's angle, with four icon keys (corners, border, shadow, spacing)
 * and the one control the lit key is about. Per corner and per side open in a
 * smaller pop-up beside it. No new values: corners go through the Page look's
 * Corners slot (`LookFields.tsx`), the edge is the wheel's own `node.edge`, and
 * every write goes through `applyToSelection`. A drag is one undo step
 * (`startGesture`..`endGesture`), a key press or a typed number is one each.
 * Esc closes the smaller one first, then this; a press outside closes it.
 * `tests/wheel-popups.mjs`.
 */
import * as React from "react";
import { Blend, Grid2x2, Layers, MoveRight, Scan, Sparkles, SquareRoundCorner, Slash } from "lucide-react";
import { play } from "@/core/audio/engine";
import { SCREEN, VOID } from "@/core/ui/void";
import { endGesture, gestureFrame, inGesture, startGesture, useStudio, type StudioNode } from "../board/store";
import { ROLES, ROLE_LABEL, tallyColours, type Palette, type RoleId } from "../look";
import { LOOK_SLOTS } from "../LookFields";
import { PICKED, keyOf } from "../RingConsole";
import { readShadow, writeShadow, type ShadowKind } from "../RingEditors";
import { placeBeside, placePopup, type Box, type Placed } from "./popupPlace";
import { applyToSelection } from "./selectionEdit";

/* The look in one place. */
const RIM = "oklch(0.72 0.19 148)";
const RIM_SMALL = "oklch(0.72 0.17 205)";
const FACE = `repeating-linear-gradient(0deg, oklch(0 0 0 / 0.2) 0 1px, transparent 1px 3px), linear-gradient(160deg, oklch(0.25 0.09 300), oklch(0.16 0.05 288))`;
const popStyle = (rim: string, w: number): React.CSSProperties => ({
  width: w, padding: 12, borderRadius: 16, border: `1.5px solid ${rim}`, background: FACE, color: VOID.text,
  boxShadow: `0 0 14px color-mix(in oklch, ${rim} 35%, transparent), 0 14px 34px oklch(0 0 0 / 0.55)`,
});
const FIELD: React.CSSProperties = { background: VOID.well, color: SCREEN.ink, boxShadow: `inset 0 0 0 1px ${VOID.rim}`, borderRadius: 9, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 11, fontWeight: 600 };

/**
 * Keys stay in the pop-up, or an arrow on a slider nudges the part too. Undo
 * and redo are the exception: on a slider they are the board's, not the input's.
 */
const keepKeys = (e: React.KeyboardEvent) => {
  if (e.key === "Escape") return;
  e.stopPropagation();
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || (e.target as HTMLInputElement).type !== "range") return;
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
function Slide({ label, value, max, unit = "px", onChange }: { label: string; value: number; max: number; unit?: string; onChange: (v: number) => void }) {
  const down = React.useRef(false);
  const up = React.useCallback(() => { if (down.current) { down.current = false; endGesture(); } }, []);
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
        <span style={{ fontFamily: FIELD.fontFamily, fontWeight: 600 }}>{value} {unit}</span>
      </span>
      <input
        type="range" min={0} max={Math.max(max, value)} step={1} value={value} aria-label={label}
        className="mt-1 block w-full cursor-pointer" style={{ accentColor: SCREEN.ink, height: 14 }}
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
function Key({ i, label, on, onPress, children, size = 30 }: { i: number; label: string; on?: boolean; onPress: () => void; children: React.ReactNode; size?: number }) {
  return (
    <button
      type="button" aria-label={label} aria-pressed={!!on} title={label} data-popup-key={label}
      onClick={() => { play("tap"); onPress(); }}
      className="tactile inline-flex shrink-0 items-center justify-center"
      style={{ ...keyOf(i), width: size, height: size, borderRadius: 9, boxShadow: on ? PICKED : undefined }}
    >
      {children}
    </button>
  );
}

function Swatches({ items, value, onPick }: { items: { id: string; label: string; colour: string | null }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((c) => (
        <button
          key={c.id || "none"} type="button" aria-label={c.label} title={c.label} data-popup-swatch={c.label}
          onClick={() => { play("tap"); onPick(c.id); }}
          className="tactile inline-flex size-5 items-center justify-center rounded-md"
          style={{ background: c.colour ?? VOID.box, outline: `1px solid ${VOID.rim}`, boxShadow: value === c.id ? PICKED : undefined, color: VOID.text }}
        >
          {c.colour ? null : <Slash className="size-3" />}
        </button>
      ))}
    </div>
  );
}

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

/** The layer: the wheel's middle and the slab's angle are all it knows of the wheel. */
export function WheelPopup({ node, palette, cx, cy, angle, reach, onClose }: {
  node: StudioNode; palette: Palette; cx: number; cy: number; angle: number; reach: number; onClose: () => void;
}) {
  const [section, setSection] = React.useState<Section>("corners");
  const [small, setSmall] = React.useState<"corners" | "sides" | null>(null);
  const big = React.useRef<HTMLDivElement>(null);
  const little = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState<Placed | null>(null);
  const [atSmall, setAtSmall] = React.useState<Placed | null>(null);
  const write = React.useMemo(() => writer(node.id), [node.id]);

  /* It is measured where it stands, and stood again when it changes size or the wheel is carried. */
  React.useLayoutEffect(() => {
    const el = big.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = placePopup(cx, cy, angle, reach, r.width, r.height, window.innerWidth, window.innerHeight);
    setAt(p);
    const sm = little.current;
    if (sm) {
      const s = sm.getBoundingClientRect();
      const parent: Box = { x: p.x, y: p.y, w: r.width, h: r.height };
      setAtSmall(placeBeside(parent, cx, cy, s.width, s.height, window.innerWidth, window.innerHeight));
    } else setAtSmall(null);
  }, [cx, cy, angle, reach, section, small]);

  /* Esc takes the smaller one first; the wheel's own Esc then closes this one. A press outside closes it. */
  const smallOpen = React.useRef(small);
  smallOpen.current = small;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && smallOpen.current) { e.stopImmediatePropagation(); setSmall(null); }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      if ((e.target as HTMLElement).closest?.("[data-wheel-popup]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown, true); };
  }, [onClose]);

  const edge = node.edge ?? null;
  const width = edge && edge.style !== "none" ? edge.width ?? 1 : 0;
  const sh = readShadow(edge?.shadow);
  const inkOf = (v: string | undefined | null) => (v && (ROLES as readonly string[]).includes(v) ? palette[v as RoleId] : v) || null;
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

  const stand = (p: Placed | null): React.CSSProperties => (p ? { left: p.x, top: p.y } : { left: 0, top: 0, visibility: "hidden" });
  return (
    <>
      <div
        ref={big} data-wheel-popup="edge" data-flip-x={at?.flipX ? "" : undefined} data-flip-y={at?.flipY ? "" : undefined}
        className="pointer-events-auto fixed z-[2] text-[12px]" style={{ ...popStyle(RIM, 238), ...stand(at) }}
        onKeyDown={keepKeys}
      >
        <div className="mb-2 font-mono text-[13px] font-bold" style={{ color: "oklch(0.88 0.2 148)" }}>Edge</div>
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
      </div>

      {small ? (
        <div
          ref={little} data-wheel-popup={small} data-flip-x={atSmall?.flipX ? "" : undefined} data-flip-y={atSmall?.flipY ? "" : undefined}
          className="pointer-events-auto fixed z-[3] text-[12px]" style={{ ...popStyle(RIM_SMALL, 164), padding: 10, ...stand(atSmall) }}
          onKeyDown={keepKeys}
        >
          <div className="mb-1.5 font-mono text-[12px] font-bold" style={{ color: "oklch(0.85 0.14 205)" }}>{small === "corners" ? "Each corner" : "Each side"}</div>
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
        </div>
      ) : null}
    </>
  );
}
