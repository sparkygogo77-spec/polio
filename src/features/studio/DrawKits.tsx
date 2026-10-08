"use client";
/**
 * Drawing with a site's style: the kit in hand, and where kits come from.
 *
 * The space tool (S) draws a closed line. With a kit picked, the line comes
 * out as a part wearing it (`WornShape.tsx`); with Plain, it is a space as
 * it always was. The picker lives in the tool's own options on the bar
 * (`toolOptions.tsx`), shown only while the tool is in hand:
 *
 *   · this site's kits first, read off its own parts (`styleKits.ts`);
 *   · then every other site in Builds, each under its name;
 *   · then Plain.
 *
 * Each kit is shown wearing itself on a small pill, not named alone: what you
 * are choosing is shown (docs/DESIGN.md). The choice, and whether rough
 * shapes snap clean, are this browser's, like the ink colour; the kit itself
 * is copied onto every shape drawn with it, so nothing depends on the board
 * it came from staying open.
 */
import { useLearned } from "./library/useLearned";
import * as React from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist } from "zustand/middleware";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Popover } from "@/core/ui/popover";
import { docOfStored, useBuilds } from "@/features/builds/store";
import { useStudio, useSteady, type StudioNode } from "./board/store";
import { kitsFromDoc, motionsFromDoc, PLAIN_BAR, siteBar, type BoardMotion, type KitDoc, type StyleKit } from "./look";
import { WornShape } from "./WornShape";
import { colourChoices, combine, piecesOf, toBox, wordsColour, type Worn } from "./wornShape";
import { DEFAULT_OFFSITE, explainLink, offsiteRules } from "./parts/offsite";
import { editablesOf, WORN_WHATS, writeField } from "./partOptions";
import { openSection } from "./PartTreePanel";
import { put } from "./pictures";
import { PartFields } from "./PartFields";

/* ------------------------------------------------------------------ */
/* The kit in hand                                                      */
/* ------------------------------------------------------------------ */

interface DrawKitState {
  /** The kit the next shape wears, or null for Plain (a space, as before). */
  kit: StyleKit | null;
  /** Snap a rough circle, triangle, box or star to a clean one. The raw line is kept either way. */
  snap: boolean;
  setKit: (kit: StyleKit | null) => void;
  setSnap: (on: boolean) => void;
}

export const useDrawKit = create<DrawKitState>()(
  persist(
    (set) => ({
      kit: null,
      snap: true,
      setKit: (kit) => set({ kit }),
      setSnap: (snap) => set({ snap }),
    }),
    { name: "builder.drawKit", version: 1 },
  ),
);

/* ------------------------------------------------------------------ */
/* Kits on every board                                                  */
/* ------------------------------------------------------------------ */

type Doc = { nodes?: StudioNode[]; look?: { palette?: Record<string, string>; keyframes?: KitDoc["keyframes"] }; brief?: { name?: string }; behaviours?: KitDoc["behaviours"] };

/** A board as the kit reader takes it: its roles resolve the colours a landed board tied to them. */
export function kitDocOf(doc: Doc | null | undefined, fallbackName?: string): KitDoc | null {
  if (!doc?.nodes?.length) return null;
  const host = doc.nodes.find((n) => n.from?.host)?.from?.host ?? null;
  return {
    nodes: doc.nodes as unknown as KitDoc["nodes"],
    palette: doc.look?.palette ?? null,
    name: doc.brief?.name?.trim() || fallbackName || null,
    host,
    keyframes: doc.look?.keyframes ?? null,
    behaviours: (doc as { behaviours?: KitDoc["behaviours"] }).behaviours ?? null,
  };
}

const others = new Map<string, { at: number; kits: StyleKit[]; motions: BoardMotion[]; name: string }>();

/** Kits and motions of the site that is open, and of every other site in Builds (read once per save). */
export function useBoardKits(active: boolean): { here: StyleKit[]; hereMotions: BoardMotion[]; elsewhere: { site: string; kits: StyleKit[] }[]; motions: BoardMotion[] } {
  const nodes = useSteady(useStudio((s) => s.nodes));
  const look = useStudio((s) => s.look);
  const brief = useStudio((s) => s.brief);
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const here = React.useMemo(() => {
    if (!active) return { kits: [] as StyleKit[], motions: [] as BoardMotion[] };
    const name = projects.find((p) => p.id === activeId)?.name;
    const doc = kitDocOf({ nodes, look: look as Doc["look"], brief }, name);
    return doc ? { kits: kitsFromDoc(doc), motions: motionsFromDoc(doc) } : { kits: [], motions: [] };
  }, [active, nodes, look, brief, projects, activeId]);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!active) return;
    let alive = true;
    for (const p of projects) {
      if (p.id === activeId) continue;
      const had = others.get(p.id);
      if (had && had.at === p.updatedAt) continue;
      void docOfStored(p.id).then((doc) => {
        const kd = kitDocOf(doc as Doc | null, p.name);
        others.set(p.id, { at: p.updatedAt, kits: kd ? kitsFromDoc(kd) : [], motions: kd ? motionsFromDoc(kd) : [], name: p.name });
        if (alive) bump();
      });
    }
    return () => { alive = false; };
  }, [active, projects, activeId]);
  const fromBoards = projects
    .filter((p) => p.id !== activeId)
    .map((p) => others.get(p.id))
    .filter((o): o is NonNullable<typeof o> => !!o && o.kits.length > 0)
    .map((o) => ({ site: o.kits[0]?.site || o.name, kits: o.kits, host: o.kits[0]?.host ?? null }));
  /*
   * And every site the learned library holds whose board is not here any
   * more (`library/learned.ts`): what an import taught stays when the board
   * it came in on is removed. A site already read off a board is not given twice.
   */
  const lib = useLearned((s) => s.lib);
  const hereHost = here.kits[0]?.host ?? null;
  const seen = new Set([hereHost, ...fromBoards.map((b) => b.host)].filter(Boolean));
  const learnedSites = Object.values(lib.sites).filter((l) => !seen.has(l.host));
  const elsewhere = [
    ...fromBoards.map(({ site, kits }) => ({ site, kits })),
    ...learnedSites.filter((l) => l.kits.length).map((l) => ({ site: l.name, kits: l.kits })),
  ];
  const motions = [
    ...here.motions,
    ...projects.filter((p) => p.id !== activeId).flatMap((p) => others.get(p.id)?.motions ?? []),
    ...learnedSites.flatMap((l) => l.motions),
  ];
  return { here: here.kits, hereMotions: here.motions, elsewhere, motions };
}

/** The lighting bar a kit without one can borrow: its own site's, else any site's. */
export function barFor(kit: StyleKit, all: readonly StyleKit[]): StyleKit["bar"] {
  return kit.bar ?? kit.siteBar ?? siteBar(all.filter((k) => k.site === kit.site)) ?? siteBar(all);
}

/* ------------------------------------------------------------------ */
/* A kit, shown wearing itself                                          */
/* ------------------------------------------------------------------ */

const PILL: [number, number][] = [[0.12, 0], [0.88, 0], [1, 0.5], [0.88, 1], [0.12, 1], [0, 0.5]];

/** A small shape wearing a kit (or a worn record), drawn by the renderer the page uses. */
export function KitSample({ kit, worn, w = 64, h = 28, words, pts, live }: { kit: StyleKit; worn?: Partial<Worn>; w?: number; h?: number; words?: string; pts?: [number, number][]; live?: boolean }) {
  const node = React.useMemo(() => ({
    id: `sample-${kit.id}-${w}x${h}-${worn?.motion?.id ?? ""}`, pageId: "", featureId: "box", label: kit.name, prompt: "", content: words ?? "", x: 0, y: 0, w, h,
    worn: { pts: pts ?? PILL, smooth: !pts, snap: null, raw: null, kit: { ...kit, radius: Math.min(kit.radius, h / 2) }, fill: null, bar: kit.bar, motion: null, hover: false, press: false, what: null, ...worn },
  }) as unknown as StudioNode, [kit, worn, w, h, words, pts]);
  return (
    <span className="pointer-events-none relative inline-block shrink-0" style={{ width: w + 6, height: h + 6 }} aria-hidden>
      <WornShape node={node} mode={live ? "live" : "board"} size={{ w, h }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The picker, on the tool's own options                                */
/* ------------------------------------------------------------------ */

function KitRow({ kit, picked, onPick }: { kit: StyleKit; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      data-kit-choice={kit.id}
      data-kit-name={kit.name}
      aria-pressed={picked}
      onClick={onPick}
      title={`${kit.name}: read off ${kit.count} ${kit.count === 1 ? "part" : "parts"} on ${kit.site}`}
      className={cn("tactile flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left", picked ? "border-accent bg-accent-soft" : "border-transparent hover:border-border")}
    >
      <KitSample kit={kit} w={54} h={24} />
      <span className="min-w-0 flex-1 truncate text-small text-fg">{kit.name}</span>
    </button>
  );
}

export function KitPicker({ compact }: { compact?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const kit = useDrawKit((s) => s.kit);
  const snap = useDrawKit((s) => s.snap);
  const { here, elsewhere } = useBoardKits(open);
  const pick = (k: StyleKit | null) => { play("select"); useDrawKit.getState().setKit(k); setOpen(false); };
  return (
    <div data-kit-picker="" className={cn("flex items-center gap-1", compact ? "" : "rounded-md border border-border bg-elevated px-1 py-0.5")}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        className="w-80"
        title="Draw wearing a style"
        content={
          <div data-kit-list="" className="flex flex-col gap-2">
            <p className="text-small text-fg-muted">A closed shape you draw comes out wearing the style: its shadow, lighting bar, border, corners, lettering and how it answers the hand. Colour and motion are chosen after.</p>
            <section>
              <div className="mb-1 text-small font-medium text-fg-faint">This site</div>
              {here.length ? here.map((k) => <KitRow key={k.id} kit={k} picked={kit?.id === k.id} onPick={() => pick(k)} />) : <p className="text-small text-fg-faint">No styled buttons, cards or panels on this site yet.</p>}
            </section>
            {elsewhere.map((o) => (
              <section key={o.site}>
                <div className="mb-1 text-small font-medium text-fg-faint">{o.site}</div>
                {o.kits.map((k) => <KitRow key={k.id} kit={k} picked={kit?.id === k.id} onPick={() => pick(k)} />)}
              </section>
            ))}
            <button type="button" data-kit-choice="plain" aria-pressed={!kit} onClick={() => pick(null)} className={cn("tactile w-full rounded-md border px-2 py-1 text-left text-small", !kit ? "border-accent bg-accent-soft" : "border-transparent hover:border-border")}>
              Plain: a space, as before
            </button>
          </div>
        }
      >
        <button type="button" data-kit-picked={kit?.id ?? "plain"} className="tactile flex items-center gap-1.5 rounded-sm px-1 py-px text-small text-fg" title="The style a drawn shape wears. Press to choose.">
          {kit ? <KitSample kit={kit} w={30} h={14} /> : null}
          <span className="max-w-[160px] truncate">{kit ? kit.name : "Plain"}</span>
        </button>
      </Popover>
      <span className="mx-0.5 h-3.5 w-px bg-border" />
      <label className="flex cursor-pointer items-center gap-1 text-small text-fg-muted" title="Snap a rough circle, triangle, box or star to a clean one. Undo in the shape's own panel brings the line back as drawn.">
        <input type="checkbox" data-kit-snap="" checked={snap} onChange={(e) => { play(e.target.checked ? "toggleOn" : "toggleOff"); useDrawKit.getState().setSnap(e.target.checked); }} />
        Snap
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* After drawing: the shape's own popover                               */
/* ------------------------------------------------------------------ */




/** Drag the outline's points; a double press on a point takes it away. In the popover, at a size a hand can hit. */
function PointEditor({ worn, aspect, onChange }: { worn: Worn; aspect: number; onChange: (pts: [number, number][]) => void }) {
  const W = 240, H = Math.max(80, Math.min(240, Math.round(W / Math.max(0.3, aspect))));
  const [pts, setPts] = React.useState(worn.pts);
  React.useEffect(() => setPts(worn.pts), [worn.pts]);
  const drag = React.useRef<number | null>(null);
  const svg = React.useRef<SVGSVGElement>(null);
  const at = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return [+(((e.clientX - r.left) / r.width - 0.1) / 0.8).toFixed(4), +(((e.clientY - r.top) / r.height - 0.1) / 0.8).toFixed(4)];
  };
  const toPx = ([x, y]: [number, number]) => [(0.1 + x * 0.8) * W, (0.1 + y * 0.8) * H] as const;
  return (
    <svg
      ref={svg}
      data-point-editor=""
      width={W}
      height={H}
      className="touch-none rounded-md border border-border bg-bg"
      onPointerMove={(e) => { if (drag.current === null) return; const next = pts.slice(); next[drag.current] = at(e); setPts(next); }}
      onPointerUp={() => { if (drag.current !== null) { drag.current = null; onChange(pts); } }}
    >
      <polygon points={pts.map((p) => toPx(p).join(",")).join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.5} />
      {pts.map((p, i) => {
        const [x, y] = toPx(p);
        return (
          <circle
            key={i}
            data-point={i}
            cx={x}
            cy={y}
            r={6}
            className="cursor-grab fill-accent"
            onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId); drag.current = i; }}
            onDoubleClick={() => { if (pts.length <= 3) return; const next = pts.filter((_, k) => k !== i); setPts(next); onChange(next); }}
          />
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* In the part panel: Content, Look and Motion for a drawn shape        */
/* ------------------------------------------------------------------ */

/**
 * The part panel's own fields for a drawn shape. The plain ones (what it is,
 * its lighting bar, speed, strength, hover, press) are Lane I's options data
 * (`partOptions.ts`, source "worn") drawn by `PartFields`; what needs a
 * picture to choose (colour, style, motion) or a hand (points) is here.
 */
function useWorn(node: StudioNode) {
  const worn = node.worn as Worn;
  const set = (patch: Partial<Worn>, more?: Partial<StudioNode>) => useStudio.getState().updateNode(node.id, { worn: { ...worn, ...patch }, ...more });
  return { worn, set };
}

const Sub = ({ children }: { children: React.ReactNode }) => <div className="text-small text-fg-muted">{children}</div>;

/** Its words, in the Content section (words along a path are asked for at the top, with the rest of what they need). */
export function WornWords({ node }: { node: StudioNode }) {
  const words = typeof node.content === "string" ? node.content : "";
  if (node.worn?.what === "path") return null;
  return (
    <label className="flex flex-col gap-1 text-small text-fg-muted">
      <span>Words on it</span>
      <input data-worn-words-input="" value={words} placeholder="Optional" onChange={(e) => useStudio.getState().updateNode(node.id, { content: e.target.value })} className="rounded-sm border border-border bg-bg px-2 py-1 text-fg" />
    </label>
  );
}

/** The Look section of a drawn shape. */
export function WornLook({ node }: { node: StudioNode }) {
  const { worn, set } = useWorn(node);
  const { here, elsewhere } = useBoardKits(true);
  const palette = useStudio((s) => s.look.palette) as Record<string, string | undefined>;
  const [peek, setPeek] = React.useState<StyleKit | null>(null);
  const [editing, setEditing] = React.useState(false);
  const all = React.useMemo(() => {
    const list = [...here, ...elsewhere.flatMap((o) => o.kits)];
    return list.some((k) => k.id === worn.kit.id) ? list : [worn.kit, ...list];
  }, [here, elsewhere, worn.kit]);
  const shown: Worn = peek ? { ...worn, kit: peek, bar: peek.bar ?? (worn.bar ? barFor(peek, all) : null) } : worn;
  const ink = wordsColour(shown);
  const colours = colourChoices(palette, worn.kit);
  const ratio = node.w / Math.max(1, node.h);
  const sw = Math.min(220, ratio >= 1 ? 220 : Math.round(130 * ratio)), sh = Math.round(sw / ratio);
  const words = typeof node.content === "string" ? node.content : "";
  return (
    <div data-worn-look={node.id} className="flex flex-col gap-2">
      {/* The shape as it will be seen, playing: the board holds every part still. */}
      <div data-worn-preview="" className="flex flex-col items-center justify-center gap-1 rounded-md bg-bg p-3" style={{ minHeight: sh + 24 }}>
        <KitSample kit={shown.kit} worn={shown} w={sw} h={sh} pts={worn.pts} words={words} live />
        <span className="text-fine text-fg-faint">{peek ? `Trying ${peek.name}` : worn.kit.name}</span>
      </div>
      <PartFields node={node} section="look" only={WORN_ONLY} except={ASKED_ABOVE} />
      <Sub>Colour</Sub>
      <div className="flex flex-wrap gap-1">
        <button type="button" data-worn-colour="kit" aria-pressed={!worn.fill} onClick={() => set({ fill: null })} className={cn("tactile rounded-sm border px-1.5 text-small", !worn.fill ? "border-accent" : "border-border")}>The style&apos;s own</button>
        {colours.map((c) => (
          <button key={c} type="button" data-worn-colour={c} aria-label={`Colour ${c}`} aria-pressed={worn.fill === c} onClick={() => { play("select"); set({ fill: c }); }} className={cn("tactile size-5 rounded-sm border", worn.fill === c ? "border-fg" : "border-border")} style={{ background: c }} />
        ))}
      </div>
      {ink.swapped ? <span data-worn-contrast="" className="text-small text-fg-muted">The words change colour on this fill so they can still be read.</span> : null}

      <Sub>Style</Sub>
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto" onPointerLeave={() => setPeek(null)}>
        {all.map((k) => (
          <button
            key={k.id}
            type="button"
            data-worn-kit-choice={k.id}
            aria-pressed={worn.kit.id === k.id}
            onPointerEnter={() => setPeek(k)}
            onFocus={() => setPeek(k)}
            onClick={() => { play("select"); setPeek(null); set({ kit: k, bar: k.bar ?? (worn.bar ? barFor(k, all) : null), hover: !!k.hover || worn.hover, press: !!k.press || worn.press }); }}
            className={cn("tactile flex items-center gap-2 rounded-sm border px-1 text-left", worn.kit.id === k.id ? "border-accent" : "border-transparent hover:border-border")}
          >
            <KitSample kit={k} w={40} h={18} />
            <span className="truncate text-small">{k.name}</span>
          </button>
        ))}
      </div>
      {worn.bar && !worn.kit.bar ? <span className="text-fine text-fg-faint">The lighting bar is borrowed from the site.</span> : null}

      <Sub>Shape</Sub>
      {worn.poly?.length || worn.open ? (
        <span data-worn-made="" className="text-small text-fg-faint">
          {worn.open ? "An open line, as drawn. Draw it again to change the line." : (() => { const p = piecesOf(worn); return `Made by joining or cutting shapes: ${p.pieces} piece${p.pieces === 1 ? "" : "s"}${p.holes ? ` and ${p.holes} hole${p.holes === 1 ? "" : "s"}` : ""}. Undo takes it back to the two shapes.`; })()}
        </span>
      ) : <>
      {worn.snap && worn.raw ? (
        <button type="button" data-worn-unsnap="" onClick={() => { play("tap"); const r = worn.raw!; set({ pts: r.pts, smooth: true, snap: null, raw: null, snapBack: { pts: worn.pts, smooth: worn.smooth, snap: worn.snap, box: { x: node.x, y: node.y, w: node.w, h: node.h } } }, { x: r.box.x, y: r.box.y, w: r.box.w, h: r.box.h }); }} className="tactile rounded-sm border border-border px-1.5 py-0.5 text-left text-small">
          Snapped to a {worn.snap}. Undo: back to the line as drawn
        </button>
      ) : worn.snapBack ? (
        <button type="button" data-worn-resnap="" onClick={() => { play("tap"); const b = worn.snapBack!; set({ pts: b.pts, smooth: b.smooth, snap: b.snap, raw: { pts: worn.pts, box: { x: node.x, y: node.y, w: node.w, h: node.h } }, snapBack: null }, b.box); }} className="tactile rounded-sm border border-border px-1.5 py-0.5 text-left text-small">
          Snap it clean again
        </button>
      ) : <span className="text-small text-fg-faint">The line as drawn, smoothed.</span>}
      <button type="button" data-worn-edit-points="" aria-pressed={editing} onClick={() => setEditing((v) => !v)} className="tactile self-start rounded-sm border border-border px-1.5 py-0.5 text-small">{editing ? "Done editing points" : "Edit points"}</button>
      {editing ? (
        <>
          <PointEditor worn={worn} aspect={ratio} onChange={(pts) => {
            // Points dragged past the box grow it, so the outline is always the box's.
            const px = pts.map(([x, y]) => [node.x + x * node.w, node.y + y * node.h] as [number, number]);
            const b = toBox(px);
            set({ pts: b.pts, smooth: worn.smooth, snap: null, raw: null, snapBack: null }, { x: b.box.x, y: b.box.y, w: b.box.w, h: b.box.h });
          }} />
          <span className="text-small text-fg-faint">Drag a point to move it; press one twice to take it away.</span>
        </>
      ) : null}
      </>}
    </div>
  );
}

/** The Motion section of a drawn shape: every board's captured motions, each played on this outline. */
export function WornMotion({ node }: { node: StudioNode }) {
  const { worn, set } = useWorn(node);
  const { motions } = useBoardKits(true);
  const ratio = node.w / Math.max(1, node.h);
  const motion = worn.motion;
  const choose = (m: BoardMotion | null) => set({ motion: m ? { id: m.id, name: m.name, frames: m.frames, duration: m.duration, timing: m.timing, speed: motion?.speed ?? 1, strength: motion?.strength ?? 1, size: m.size } : null });
  return (
    <div data-worn-motions={node.id} className="flex flex-col gap-2">
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        <button type="button" data-worn-motion="none" aria-pressed={!motion} onClick={() => choose(null)} className={cn("tactile rounded-sm border px-1.5 py-0.5 text-left text-small", !motion ? "border-accent" : "border-transparent hover:border-border")}>Still</button>
        {motions.map((m) => (
          <button key={m.id} type="button" data-worn-motion={m.id} data-worn-motion-name={m.name} aria-pressed={motion?.id === m.id} onClick={() => { play("select"); choose(m); }} className={cn("tactile flex items-center gap-2 rounded-sm border px-1 text-left", motion?.id === m.id ? "border-accent" : "border-transparent hover:border-border")}>
            <KitSample kit={worn.kit} worn={{ ...worn, motion: { id: m.id, name: m.name, frames: m.frames, duration: m.duration, timing: m.timing, speed: 1, strength: 1, size: m.size } }} w={ratio >= 34 / 24 ? 34 : Math.max(10, Math.round(24 * ratio))} h={ratio >= 34 / 24 ? Math.max(10, Math.round(34 / ratio)) : 24} pts={worn.pts} live />
            <span className="min-w-0 flex-1 truncate text-small">{m.name}</span>
            <span className="shrink-0 text-small text-fg-faint">{m.site}</span>
          </button>
        ))}
      </div>
      <PartFields node={node} section="motion" only={WORN_ONLY} />
    </div>
  );
}

const WORN_ONLY = ["worn"] as const;
const ASKED_ABOVE = ["worn:what", "worn:size", "worn:start", "worn:flip"] as const;
const PATH_FIELDS = ["worn:size", "worn:start", "worn:flip"] as const;

/** Faces any visitor's machine has, for words along a path when the site's own are not wanted. */
const PLAIN_FACES: { name: string; stack: string }[] = [
  { name: "Plain", stack: "system-ui, -apple-system, \"Segoe UI\", sans-serif" },
  { name: "Book", stack: "Georgia, \"Times New Roman\", serif" },
  { name: "Typewriter", stack: "ui-monospace, Menlo, Consolas, monospace" },
];

/**
 * WHAT IS THIS? The first thing a drawn shape's panel asks, until it is
 * answered, and the first thing it shows after: one question, five
 * answers, and under the answer the options that answer needs, open.
 *
 *   · Button: where it leads, as the site's link rules allow (a page or a
 *     section of the site; an address off it only when the site's list
 *     says so, with the reason given in words);
 *   · Picture frame: a picture to put in it (or drop one on the shape);
 *   · Section: it goes behind the parts on it;
 *   · Decoration: its motion opens, since that is what a decoration is for;
 *   · Words along a path: the words, their font, size and where they start.
 */
export function WhatIsThis({ node }: { node: StudioNode }) {
  const worn = node.worn as Worn;
  const field = React.useMemo(() => editablesOf(node).find((f) => f.id === "worn:what"), [node]);
  const choose = (id: NonNullable<Worn["what"]>) => {
    if (!field) return;
    const patch = writeField(node, field, id);
    if (!patch) return;
    play("select");
    const st = useStudio.getState();
    st.commit();
    useStudio.setState((s) => {
      const nodes = s.nodes.map((n) => (n.id === node.id ? ({ ...n, ...patch } as StudioNode) : n));
      if (id !== "section") return { nodes };
      // A section holds the parts on it, so it goes behind every other part of its page.
      const me = nodes.find((n) => n.id === node.id)!;
      return { nodes: [me, ...nodes.filter((n) => n.id !== node.id)] };
    });
    if (id === "decoration") openSection("motion");
    if (id === "section") openSection("look");
  };
  const asked = !worn.what;
  /* The kind the style was read off, offered first: a kit taken from buttons suggests Button, from cards or panels Section. */
  const suggested: Worn["what"] = worn.open ? "path" : worn.kit.role === "button" ? "button" : worn.kit.role === "card" || worn.kit.role === "panel" ? "section" : "decoration";
  return (
    <div data-what-is-this={worn.what ?? "unanswered"} className={cn("mx-3 mt-3 flex flex-col gap-2 rounded-md border p-2", asked ? "border-accent bg-accent-soft" : "border-border")}>
      <div className="text-plain font-semibold text-fg">What is this?</div>
      {asked ? <div className="text-small text-fg-muted">Choose one, and its options open here.</div> : null}
      <div role="radiogroup" aria-label="What is this?" data-field="worn:what" className="flex flex-wrap gap-1">
        {WORN_WHATS.map((w) => (
          <button
            key={w.id}
            type="button"
            role="radio"
            data-worn-what-choice={w.id}
            data-value={w.label}
            data-suggested={asked && suggested === w.id ? "" : undefined}
            aria-checked={worn.what === w.id}
            title={w.means}
            onClick={() => choose(w.id)}
            className={cn("tactile rounded-sm border px-2 py-1 text-small", worn.what === w.id ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg")}
          >
            {w.label}{asked && suggested === w.id ? <span className="text-fine text-fg-muted"> · suggested</span> : null}
          </button>
        ))}
      </div>
      {worn.what ? <div className="text-small text-fg-muted">{WORN_WHATS.find((w) => w.id === worn.what)?.means}{worn.open && worn.what !== "path" ? " The line is closed back to where it began." : ""}</div> : null}
      {worn.what === "button" ? <LeadsTo node={node} /> : null}
      {worn.what === "frame" ? <FramePicture node={node} /> : null}
      {worn.what === "path" ? <PathWordsFields node={node} /> : null}
    </div>
  );
}

/** Where a drawn button leads: a page or a section of the site, or an address the site's list allows, with why when it does not. */
function LeadsTo({ node }: { node: StudioNode }) {
  const pages = useStudio((s) => s.pages);
  const sectionNodes = useStudio(useShallow((s) => s.nodes.filter((n) => n.pageId === node.pageId && n.id !== node.id && n.worn?.what === "section")));
  const sections = sectionNodes.map((n) => ({ id: n.id, label: n.label }));
  const offsiteText = useStudio((s) => String(s.format?.["links.offsite"] ?? DEFAULT_OFFSITE));
  const rules = React.useMemo(() => offsiteRules(offsiteText), [offsiteText]);
  const [address, setAddress] = React.useState(node.link?.kind === "url" ? node.link.target : "");
  const typed = address.trim();
  const said = typed ? explainLink(/^[a-z][a-z0-9+.-]*:/i.test(typed) || typed.startsWith("//") ? typed : `https://${typed}`, rules) : null;
  const link = (l: StudioNode["link"]) => { play("select"); useStudio.getState().updateNode(node.id, { link: l }); };
  const on = (kind: string, target: string) => node.link?.kind === kind && node.link.target === target;
  return (
    <div data-worn-leads="" className="flex flex-col gap-1">
      <Sub>Where does it lead?</Sub>
      <div className="flex flex-wrap gap-1">
        {pages.map((p) => (
          <button key={p.id} type="button" data-worn-link-page={p.id} aria-pressed={on("page", p.id)} onClick={() => link({ kind: "page", target: p.id })} className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", on("page", p.id) ? "border-accent bg-accent-soft" : "border-border")}>{p.name}</button>
        ))}
        {sections.map((n) => (
          <button key={n.id} type="button" data-worn-link-node={n.id} aria-pressed={on("node", n.id)} onClick={() => link({ kind: "node", target: n.id })} className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", on("node", n.id) ? "border-accent bg-accent-soft" : "border-border")}>{n.label || "Section"}</button>
        ))}
      </div>
      <input
        data-worn-link-address=""
        value={address}
        aria-label="Or a web address"
        placeholder="or a web address, https://…"
        onChange={(e) => setAddress(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
        onBlur={() => {
          if (!typed) return;
          const href = /^[a-z][a-z0-9+.-]*:/i.test(typed) || typed.startsWith("//") ? typed : `https://${typed}`;
          // Only an allowed address is kept: a refused one would leave a button that goes nowhere.
          if (said?.allowed) link({ kind: "url", target: href });
          else play("deny");
        }}
        className="rounded-sm border border-border bg-bg px-1.5 py-0.5"
      />
      {said ? (
        <span data-worn-link-allowed={said.allowed ? "yes" : "no"} className={cn("text-small", said.allowed ? "text-fg-muted" : "text-fg")}>{said.why}</span>
      ) : node.link ? (
        <span data-worn-link-now="" className="text-small text-fg-muted">
          Leads to {node.link.kind === "page" ? pages.find((p) => p.id === node.link!.target)?.name ?? "a page" : node.link.kind === "node" ? sections.find((n) => n.id === node.link!.target)?.label ?? "a part of this page" : node.link.target}.
        </span>
      ) : <span className="text-small text-fg-faint">A page or a section of this site is always allowed; an address elsewhere only when the site&apos;s list says so.</span>}
    </div>
  );
}

/** The picture a frame holds: chosen here, or dropped on the shape. */
function FramePicture({ node }: { node: StudioNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-small text-fg-muted">
        Picture: <input type="file" accept="image/*" data-worn-picture-input="" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const pic = await put(f, { name: f.name }); useStudio.getState().updateNode(node.id, { picture: pic }); }} />
      </label>
      <span className="text-small text-fg-faint">{node.picture ? "It is clipped to the outline; the style's border and shadow stay round it." : "Or drop a picture onto the shape on the board."}</span>
      {node.picture ? <button type="button" data-worn-picture-remove="" onClick={() => useStudio.getState().updateNode(node.id, { picture: null })} className="tactile self-start rounded-sm border border-border px-1.5 py-0.5 text-small">Take the picture out</button> : null}
    </div>
  );
}

/** Words along a path: the words, a face, and how they sit on the line. */
function PathWordsFields({ node }: { node: StudioNode }) {
  const worn = node.worn as Worn;
  const { here } = useBoardKits(true);
  const carried = useStudio(useShallow((s) => (s.look.fonts ?? []).map((f) => f.family)));
  const words = typeof node.content === "string" ? node.content : "";
  const faces = React.useMemo(() => {
    const out: { name: string; stack: string | null }[] = [{ name: `${worn.kit.text?.face ?? "The style's own"}`, stack: null }];
    const add = (name: string, stack: string) => { if (stack && !out.some((o) => o.stack === stack || o.name === name)) out.push({ name, stack }); };
    for (const f of carried) add(f, `"${f}", sans-serif`);
    for (const k of here) if (k.text?.stack && k.text.face) add(k.text.face, k.text.stack);
    for (const f of PLAIN_FACES) add(f.name, f.stack);
    return out.slice(0, 10);
  }, [worn.kit.text, carried, here]);
  const font = worn.pathWords?.font ?? null;
  return (
    <div data-worn-path-fields="" className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-small text-fg-muted">
        <span>The words</span>
        <input data-worn-path-words-input="" value={words} onChange={(e) => useStudio.getState().updateNode(node.id, { content: e.target.value })} className="rounded-sm border border-border bg-bg px-2 py-1 text-fg" />
      </label>
      <Sub>Font</Sub>
      <div className="flex flex-wrap gap-1">
        {faces.map((f) => (
          <button
            key={f.stack ?? "kit"}
            type="button"
            data-worn-font={f.stack ?? "kit"}
            aria-pressed={font === f.stack}
            onClick={() => { play("select"); useStudio.getState().updateNode(node.id, { worn: { ...worn, pathWords: { ...(worn.pathWords ?? { size: null, font: null, start: 0, flip: false }), font: f.stack } } }); }}
            className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", font === f.stack ? "border-accent bg-accent-soft" : "border-border")}
            style={{ fontFamily: f.stack ?? worn.kit.text?.stack ?? undefined }}
          >
            {f.name}
          </button>
        ))}
      </div>
      <PartFields node={node} only={WORN_ONLY} ids={PATH_FIELDS} />
    </div>
  );
}

/**
 * JOIN OR CUT two drawn shapes, picked together. Join makes one shape of
 * everything either covers; cut takes the upper one (the one drawn later,
 * in front) out of the lower one. The lower one's style is kept, and its
 * shadow, lighting bar and border follow the new outline. One undo takes
 * it back to the two shapes.
 */
export function JoinOrCut({ ids }: { ids: string[] }) {
  const pair = useStudio(useShallow((s) => s.nodes.filter((n) => ids.includes(n.id) && n.worn && !n.worn.open && n.worn.what !== "path")));
  if (ids.length !== 2 || pair.length !== 2) return null;
  const [under, over] = pair as [StudioNode, StudioNode];
  const run = (how: "join" | "cut") => {
    const got = combine({ worn: under.worn!, box: under }, { worn: over.worn!, box: over }, how);
    if (!got) { play("deny"); return; }
    play("confirm");
    const st = useStudio.getState();
    st.commit();
    useStudio.setState((s) => ({
      nodes: s.nodes.filter((n) => n.id !== over.id).map((n) => (n.id === under.id ? { ...n, worn: got.worn, x: got.box.x, y: got.box.y, w: got.box.w, h: got.box.h, byHand: true, label: how === "join" ? `${under.worn!.kit.name} shape, joined` : `${under.worn!.kit.name} shape, cut` } : n)),
      selection: [under.id],
    }));
  };
  return (
    <div data-join-or-cut="" className="flex flex-col gap-1 rounded-md border border-border p-2">
      <div className="text-small font-medium text-fg">Two drawn shapes</div>
      <div className="flex gap-1">
        <button type="button" data-worn-join="" onClick={() => run("join")} className="tactile flex-1 rounded-sm border border-border px-2 py-1 text-small">Join them</button>
        <button type="button" data-worn-cut="" onClick={() => run("cut")} className="tactile flex-1 rounded-sm border border-border px-2 py-1 text-small">Cut the front one out</button>
      </div>
      <span className="text-small text-fg-faint">The back one&apos;s style is kept; its shadow, lighting bar and border follow the new edge.</span>
    </div>
  );
}
