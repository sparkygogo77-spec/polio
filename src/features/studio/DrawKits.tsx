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
import { persist } from "zustand/middleware";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Popover } from "@/core/ui/popover";
import { docOfStored, useBuilds } from "@/features/builds/store";
import { useStudio, type StudioNode } from "./store";
import { kitsFromDoc, motionsFromDoc, PLAIN_BAR, siteBar, type BoardMotion, type KitDoc, type StyleKit } from "./styleKits";
import { WornShape } from "./WornShape";
import { colourChoices, toBox, wordsColour, type Worn } from "./wornShape";
import { DEFAULT_OFFSITE, linkAllowed, offsiteRules } from "./parts/offsite";
import { put } from "./pictures";

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
  const nodes = useStudio((s) => s.nodes);
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

const WHATS: { id: NonNullable<Worn["what"]>; label: string; means: string }[] = [
  { id: "button", label: "Button", means: "Pressable, and leads somewhere." },
  { id: "frame", label: "Picture frame", means: "A picture shows inside the outline." },
  { id: "decoration", label: "Decoration", means: "Something to look at; it does nothing when pressed." },
  { id: "section", label: "Section", means: "A place on the page that holds other parts." },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-border pt-2">
      <div className="text-small font-medium uppercase tracking-wider text-fg-faint">{title}</div>
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, step, onChange, says }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; says: string }) {
  return (
    <label className="flex items-center gap-2 text-small text-fg-muted">
      <span className="w-14 shrink-0">{label}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <span className="w-12 shrink-0 text-right tabular-nums text-fg">{says}</span>
    </label>
  );
}

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

/**
 * The popover beside a drawn shape while it is picked. Its own for now; the
 * part panel's Look and Motion sections take these over when that panel lands.
 */
export function WornPopover() {
  const selection = useStudio((s) => s.selection);
  const id = selection.length === 1 ? selection[0]! : null;
  const node = useStudio((s) => (id ? s.nodes.find((n) => n.id === id) : undefined));
  const [hidden, setHidden] = React.useState<string | null>(null);
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const worn = node?.worn ?? null;
  /* Closed, it stays closed until the shape is picked again (every pick is a new selection). */
  React.useEffect(() => setHidden(null), [selection]);
  React.useEffect(() => {
    if (!node?.worn) return;
    let raf = 0;
    const place = () => {
      const el = document.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const x = r.right + 332 < window.innerWidth ? r.right + 16 : Math.max(8, r.left - 332);
        const y = Math.max(56, Math.min(window.innerHeight - 420, r.top));
        setAt((p) => (p && Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1 ? p : { x, y }));
      }
      raf = window.setTimeout(place, 200) as unknown as number;
    };
    place();
    return () => window.clearTimeout(raf);
  }, [node?.id, !!node?.worn]);
  if (!node || !worn || hidden === node.id || !at) return null;
  return <WornPanel key={node.id} node={node} worn={worn} at={at} onClose={() => { play("close"); setHidden(node.id); }} />;
}

function WornPanel({ node, worn, at, onClose }: { node: StudioNode; worn: Worn; at: { x: number; y: number }; onClose: () => void }) {
  const { here, elsewhere, motions } = useBoardKits(true);
  const palette = useStudio((s) => s.look.palette) as Record<string, string | undefined>;
  const pages = useStudio((s) => s.pages);
  const offsiteText = useStudio((s) => String(s.format?.["links.offsite"] ?? DEFAULT_OFFSITE));
  const [peek, setPeek] = React.useState<StyleKit | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [address, setAddress] = React.useState(node.link?.kind === "url" ? node.link.target : "");
  const all = React.useMemo(() => [...here, ...elsewhere.flatMap((o) => o.kits)], [here, elsewhere]);
  const set = (patch: Partial<Worn>, more?: Partial<StudioNode>) => useStudio.getState().updateNode(node.id, { worn: { ...worn, ...patch }, ...more });
  const shown: Worn = peek ? { ...worn, kit: peek, bar: peek.bar ?? (worn.bar ? barFor(peek, all) : null) } : worn;
  const ink = wordsColour(shown);
  const colours = colourChoices(palette, worn.kit);
  const rules = React.useMemo(() => offsiteRules(offsiteText), [offsiteText]);
  const ratio = node.w / Math.max(1, node.h);
  const sw = Math.min(260, ratio >= 1 ? 260 : Math.round(150 * ratio)), sh = Math.round(sw / ratio);
  const words = typeof node.content === "string" ? node.content : "";
  const motion = worn.motion;
  const choose = (m: BoardMotion | null) => set({ motion: m ? { id: m.id, name: m.name, frames: m.frames, duration: m.duration, timing: m.timing, speed: motion?.speed ?? 1, strength: motion?.strength ?? 1, size: m.size } : null });
  return (
    <div
      data-worn-panel={node.id}
      role="dialog"
      aria-label={`${worn.kit.name} shape`}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-[65] flex bg-panel w-[316px] flex-col gap-2 overflow-y-auto rounded-md border border-border p-3 text-xs text-fg shadow-pop"
      style={{ left: at.x, top: at.y, maxHeight: `calc(100vh - ${Math.round(at.y) + 8}px)` }}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-small font-medium">{peek ? `Trying ${peek.name}` : worn.kit.name}</span>
        <button type="button" aria-label="Close the shape's options" onClick={onClose} className="tactile rounded-sm px-1.5 text-fg-muted hover:text-fg">Close</button>
      </div>
      {/* The shape as it will be seen, playing: the board holds every part still. */}
      <div data-worn-preview="" className="flex items-center justify-center rounded-md bg-bg p-3" style={{ minHeight: sh + 24 }}>
        <KitSample kit={shown.kit} worn={shown} w={sw} h={sh} pts={worn.pts} words={words} live />
      </div>

      <Section title="What is this?">
        <div className="flex flex-wrap gap-1">
          {WHATS.map((w) => (
            <button key={w.id} type="button" data-worn-what-choice={w.id} aria-pressed={worn.what === w.id} title={w.means} onClick={() => { play("select"); set({ what: w.id }, w.id === "button" ? {} : { link: null }); }} className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", worn.what === w.id ? "border-accent bg-accent-soft" : "border-border text-fg-muted hover:text-fg")}>{w.label}</button>
          ))}
        </div>
        {worn.what === "button" ? (
          <div className="flex flex-col gap-1">
            <span className="text-small text-fg-muted">Where does it lead?</span>
            <div className="flex flex-wrap gap-1">
              {pages.map((p) => (
                <button key={p.id} type="button" data-worn-link-page={p.id} aria-pressed={node.link?.kind === "page" && node.link.target === p.id} onClick={() => useStudio.getState().updateNode(node.id, { link: { kind: "page", target: p.id } })} className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", node.link?.kind === "page" && node.link.target === p.id ? "border-accent bg-accent-soft" : "border-border")}>{p.name}</button>
              ))}
            </div>
            <input
              data-worn-link-address=""
              value={address}
              placeholder="or a web address, https://…"
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => { const a = address.trim(); if (/^https?:\/\//i.test(a)) useStudio.getState().updateNode(node.id, { link: { kind: "url", target: a } }); }}
              className="rounded-sm border border-border bg-bg px-1.5 py-0.5"
            />
            {node.link?.kind === "url" ? (
              <span data-worn-link-allowed={linkAllowed(node.link.target, rules) ? "yes" : "no"} className="text-small text-fg-muted">
                {linkAllowed(node.link.target, rules) ? "This address is on the site's list of places links may go." : "This address is not on the site's list of places links may go, so the button stays but goes nowhere. The list is under Format, Pages and navigation."}
              </span>
            ) : null}
          </div>
        ) : null}
        {worn.what === "frame" ? (
          <label className="text-small text-fg-muted">
            Picture: <input type="file" accept="image/*" data-worn-picture-input="" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const pic = await put(f, { name: f.name }); useStudio.getState().updateNode(node.id, { picture: pic }); }} />
          </label>
        ) : null}
      </Section>

      <Section title="Words">
        <input data-worn-words-input="" value={words} placeholder="Words on it (optional)" onChange={(e) => useStudio.getState().updateNode(node.id, { content: e.target.value })} className="rounded-sm border border-border bg-bg px-1.5 py-0.5" />
      </Section>

      <Section title="Colour">
        <div className="flex flex-wrap gap-1">
          <button type="button" data-worn-colour="kit" aria-pressed={!worn.fill} onClick={() => set({ fill: null })} className={cn("tactile rounded-sm border px-1.5 text-small", !worn.fill ? "border-accent" : "border-border")}>The style's own</button>
          {colours.map((c) => (
            <button key={c} type="button" data-worn-colour={c} aria-label={`Colour ${c}`} aria-pressed={worn.fill === c} onClick={() => { play("select"); set({ fill: c }); }} className={cn("tactile size-5 rounded-sm border", worn.fill === c ? "border-fg" : "border-border")} style={{ background: c }} />
          ))}
        </div>
        {ink.swapped ? <span data-worn-contrast="" className="text-small text-fg-muted">The words change colour on this fill so they can still be read.</span> : null}
      </Section>

      <Section title="Style">
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
        <label className="flex items-center gap-1.5 text-small text-fg-muted">
          <input type="checkbox" data-worn-bar-toggle="" checked={!!worn.bar} onChange={(e) => set({ bar: e.target.checked ? barFor(worn.kit, all) ?? PLAIN_BAR : null })} />
          Lighting bar {worn.bar && !worn.kit.bar ? "(borrowed from the site)" : ""}
        </label>
      </Section>

      <Section title="Motion">
        <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
          <button type="button" data-worn-motion="none" aria-pressed={!motion} onClick={() => choose(null)} className={cn("tactile rounded-sm border px-1.5 py-0.5 text-left text-small", !motion ? "border-accent" : "border-transparent hover:border-border")}>Still</button>
          {motions.map((m) => (
            <button key={m.id} type="button" data-worn-motion={m.id} data-worn-motion-name={m.name} aria-pressed={motion?.id === m.id} onClick={() => { play("select"); choose(m); }} className={cn("tactile flex items-center gap-2 rounded-sm border px-1 text-left", motion?.id === m.id ? "border-accent" : "border-transparent hover:border-border")}>
              <KitSample kit={worn.kit} worn={{ ...worn, motion: { id: m.id, name: m.name, frames: m.frames, duration: m.duration, timing: m.timing, speed: 1, strength: 1, size: m.size } }} w={ratio >= 34 / 24 ? 34 : Math.max(10, Math.round(24 * ratio))} h={ratio >= 34 / 24 ? Math.max(10, Math.round(34 / ratio)) : 24} pts={worn.pts} live />
              <span className="min-w-0 flex-1 truncate text-small">{m.name}</span>
              <span className="shrink-0 text-small text-fg-faint">{m.site}</span>
            </button>
          ))}
        </div>
        {motion ? (
          <>
            <Slider label="Speed" value={motion.speed} min={0.25} max={3} step={0.05} onChange={(v) => set({ motion: { ...motion, speed: v } })} says={`${motion.speed.toFixed(2)}×`} />
            <Slider label="Strength" value={motion.strength} min={0} max={2} step={0.05} onChange={(v) => set({ motion: { ...motion, strength: v } })} says={`${Math.round(motion.strength * 100)}%`} />
          </>
        ) : null}
        <label className="flex items-center gap-1.5 text-small text-fg-muted"><input type="checkbox" data-worn-hover="" checked={worn.hover} onChange={(e) => set({ hover: e.target.checked })} /> Lift under the hand {worn.kit.hover ? "(as the site's parts do)" : ""}</label>
        <label className="flex items-center gap-1.5 text-small text-fg-muted"><input type="checkbox" data-worn-press="" checked={worn.press} onChange={(e) => set({ press: e.target.checked })} /> Squash when pressed {worn.kit.press ? "(as the site's parts do)" : ""}</label>
      </Section>

      <Section title="Shape">
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
      </Section>
    </div>
  );
}

