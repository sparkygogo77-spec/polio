"use client";
/**
 * Bring a part from another site: pick one of your other sites, then one
 * of its buttons, cards, panels, badges or headings (one row for each look
 * it has, with how many parts wear it), and Place puts it where you are
 * looking on the open page, restyled to this site (remix.ts), in one undo
 * step. Keep the original look brings it as it was, with its faces; With
 * what is inside it brings the words and pictures drawn in it too, held
 * together as a group.
 *
 * From your other boards, from every site the learned library holds (its
 * style kits, placed as a new part of their kind, and its motions, put on
 * the picked part as the shelf puts them), and from the components you
 * saved (`library/components.ts`).
 *
 * Opened from the wheel's tray (`openRemix`). Escape closes it.
 */
import * as React from "react";
import { Shuffle, X } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Switch } from "@/core/ui/switch";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useBuilds, docOfStored } from "@/features/builds/store";
import { useStudio, type StudioNode } from "./board/store";
import type { CarriedFont } from "./look";
import { kindKey, kindWord } from "./partKind";
import { lookOf, lookPatch } from "./look/parts";
import { kitsFromDoc } from "./look";
import { kitDocOf } from "./DrawKits";
import { componentOf, fontsFor, remixParts, remixPatch, restyleFor, siteLookOf, type SiteLook } from "./remix";
import { useLearned } from "./library/useLearned";
import { learnedVersions, type LearnedVersion } from "./library/learned";
import type { SavedComponent } from "./library/components";
import { lookOfKit } from "./look/parts";
import { KIT_FACETS, KitSwatch } from "./KitStyles";
import { putSiteVersion } from "./ShelfCards";
import type { StyleKit } from "./look";
import { visibleMiddle } from "./Palette";
import { wordsOf } from "./partNames";

let open = false;
const listeners = new Set<() => void>();
const changed = () => { for (const l of listeners) l(); };
export function openRemix() { open = true; play("open"); changed(); }
function useOpen() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { listeners.add(bump); return () => { listeners.delete(bump); }; }, []);
  return open;
}

type Doc = { nodes?: StudioNode[]; look?: { fonts?: CarriedFont[]; palette?: Record<string, string> }; brief?: { name?: string } };
/** The kinds worth bringing, in the order they are offered. */
const KINDS = ["button", "card", "panel", "badge", "heading"] as const;
type Kind = (typeof KINDS)[number] | "motions";
const kindOfKey = (k: string) => (k === "button" ? "button" : k.split(":")[0]!);
const MOST = 40;

/** The site that is open, read for parts landing on it. */
export function hereLook(): SiteLook {
  const s = useStudio.getState();
  const doc = kitDocOf({ nodes: s.nodes, look: s.look as never, brief: s.brief });
  return siteLookOf(s.nodes, doc ? kitsFromDoc(doc) : []);
}

/** Where a brought part lands: where the person is looking, else under the page's foot. */
function landing(): { x: number; y: number } {
  const mid = visibleMiddle();
  if (mid) return mid;
  const s = useStudio.getState();
  const foot = s.nodes.filter((n) => n.pageId === s.activePageId).reduce((m, n) => Math.max(m, n.y + n.h), 0);
  return { x: s.frameWidth / 2, y: foot + 24 };
}

/** Place a part of another site's board on the open page: its component when `whole`, restyled to this site unless `kept`. One undo step. */
export function placeRemix(source: Doc, site: string, part: StudioNode, opts: { kept: boolean; whole: boolean }): string[] {
  const parts = componentOf(source.nodes ?? [], part, opts.whole);
  const at = landing();
  const lead = { x: at.x - part.w / 2, y: at.y - part.h / 2 };
  const st = useStudio.getState();
  const placed = remixParts(parts, { site }, hereLook(), opts.kept, lead, st.frameWidth);
  const words = wordsOf(part) || kindWord(kindKey(part as never), 1);
  return st.placeNodes(placed, { group: `${words} from ${site}`, fonts: opts.kept ? fontsFor(parts, source.look?.fonts) : [] });
}

/** Where a part can come from: another board, a site the learned library holds, or the components you saved. */
type Source = { kind: "board"; id: string; name: string } | { kind: "learned"; host: string; name: string } | { kind: "saved"; name: string };
const sourceKey = (s: Source) => (s.kind === "board" ? `board:${s.id}` : s.kind === "learned" ? `learned:${s.host}` : "saved");

/** The sources on offer: your other boards, then every learned site no board here already is, then your saved components. */
function useSources(): Source[] {
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const lib = useLearned((s) => s.lib);
  const nodes = useStudio((s) => s.nodes);
  return React.useMemo(() => {
    const boards: Source[] = projects.filter((p) => p.id !== activeId).map((p) => ({ kind: "board", id: p.id, name: p.name }));
    /* A learned site is offered unless it is the open board's own, or a board already offered by its name (a board's id is its name in Builds until renamed). */
    const hereHost = nodes.find((n) => n.from?.host)?.from?.host ?? null;
    const boardNames = new Set(projects.map((p) => p.name.toLowerCase()));
    const learned: Source[] = Object.values(lib.sites)
      .filter((l) => l.host !== hereHost && !boardNames.has(l.host.toLowerCase()) && !boardNames.has(l.name.toLowerCase()) && (l.kits.length || l.versions.length))
      .map((l) => ({ kind: "learned", host: l.host, name: l.name }));
    const saved: Source[] = lib.components?.length ? [{ kind: "saved", name: "Saved components" }] : [];
    return [...boards, ...learned, ...saved];
  }, [projects, activeId, lib, nodes]);
}

/** What one row offers: a part of a board, a learned kit, a learned motion, or a saved component. */
type Row =
  | { kind: "part"; key: string; part: StudioNode; count: number }
  | { kind: "kit"; key: string; kit: StyleKit; count: number }
  | { kind: "motion"; key: string; version: LearnedVersion & { host: string } }
  | { kind: "saved"; key: string; component: SavedComponent };

/** The feature a kit's kind is drawn as, a new part wearing it. */
const KIT_PART: Record<string, { featureId: string; words: string }> = { button: { featureId: "cta-primary", words: "Button" }, badge: { featureId: "prose", words: "Badge" }, card: { featureId: "box", words: "" }, panel: { featureId: "box", words: "" } };

/** A learned kit put on the open page as a new part of its kind, in the kit or in this site's look. One undo step. */
export function placeKit(kit: StyleKit, site: string, kept: boolean): string[] {
  const st = useStudio.getState();
  const make = KIT_PART[kit.role] ?? KIT_PART.card!;
  const at = landing();
  const w = Math.min(st.frameWidth, Math.max(40, Math.round(kit.size.w))), h = Math.max(20, Math.round(kit.size.h));
  const base = { id: "kit", featureId: make.featureId, x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h, content: make.words, colour: null, font: null, edge: null, radius: null } as unknown as StudioNode;
  const worn = { ...base, ...lookPatch(base as never, lookOfKit(kit, { button: make.featureId === "cta-primary" }), KIT_FACETS) } as StudioNode;
  const remix = { site, part: `kit:${kit.id}`, original: lookOf(worn as never), kept };
  const look = kept ? lookPatch(worn as never, remix.original, KIT_FACETS) : restyleFor(worn, hereLook());
  const id = st.addNode(make.featureId, base.x, base.y, { w, h, content: make.words, ...look, remix } as Partial<StudioNode>);
  return [id];
}

/** A saved component placed on the open page, restyled to this site unless kept. One undo step. */
export function placeSaved(c: SavedComponent, kept: boolean): string[] {
  const st = useStudio.getState();
  const at = landing();
  const parts = c.nodes.map((n) => ({ ...n, pageId: "saved" })) as unknown as StudioNode[];
  const placed = remixParts(parts, { site: c.site ?? "your saved components" }, hereLook(), kept, { x: at.x - c.w / 2, y: at.y - c.h / 2 }, st.frameWidth);
  return st.placeNodes(placed, { group: c.name, fonts: c.fonts as unknown as CarriedFont[], keyframes: c.frames as never });
}

export function RemixCard() {
  const isOpen = useOpen();
  const sources = useSources();
  const lib = useLearned((s) => s.lib);
  const picked = useStudio((s) => (s.selection.length === 1 ? s.nodes.find((n) => n.id === s.selection[0]) ?? null : null));
  const [key, setKey] = React.useState<string | null>(null);
  const source = sources.find((s) => sourceKey(s) === key) ?? null;
  const [doc, setDoc] = React.useState<Doc | null>(null);
  const [kind, setKind] = React.useState<Kind>("button");
  const [kept, setKept] = React.useState(false);
  const [whole, setWhole] = React.useState(true);
  const [said, setSaid] = React.useState<string | null>(null);

  React.useEffect(() => { if (isOpen && !source && sources[0]) setKey(sourceKey(sources[0])); }, [isOpen, source, sources]);
  React.useEffect(() => {
    if (source?.kind !== "board") { setDoc(null); return; }
    let live = true;
    setDoc(null);
    void docOfStored(source.id).then((d) => { if (live) setDoc((d as Doc) ?? { nodes: [] }); });
    return () => { live = false; };
  }, [source?.kind === "board" ? source.id : null]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); open = false; changed(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen]);

  const kinds: readonly Kind[] = source?.kind === "learned" ? ["button", "card", "panel", "badge", "motions"] : source?.kind === "saved" ? [] : KINDS;
  React.useEffect(() => { if (kinds.length && !kinds.includes(kind)) setKind(kinds[0]!); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  /* One row per look of the chosen kind, most worn first; a learned site's kits and motions; the saved components. */
  const rows = React.useMemo((): Row[] => {
    if (!source) return [];
    if (source.kind === "saved") return (lib.components ?? []).slice().sort((a, b) => b.at - a.at).map((c) => ({ kind: "saved", key: c.id, component: c }));
    if (source.kind === "learned") {
      const site = lib.sites[source.host];
      if (!site) return [];
      if (kind === "motions") return (learnedVersions(lib, null).size ? [...learnedVersions(lib, null).values()].flat() : []).filter((v) => v.host === source.host && (v.take.kind === "motion" || v.take.kind === "work")).slice(0, MOST).map((v, i) => ({ kind: "motion", key: `${v.item}:${i}`, version: v }));
      return site.kits.filter((k) => k.role === kind).sort((a, b) => b.count - a.count).slice(0, MOST).map((k) => ({ kind: "kit", key: k.id, kit: k, count: k.count }));
    }
    const out = new Map<string, { part: StudioNode; count: number }>();
    for (const n of doc?.nodes ?? []) {
      const k = kindKey(n as never);
      if (kindOfKey(k) !== kind || (k === "button" && kind !== "button")) continue;
      const l = lookOf(n as never, ["fill", "outline", "shadow", "corners", "font"]);
      const sig = JSON.stringify(l.facets);
      const had = out.get(sig);
      if (had) had.count++; else out.set(sig, { part: n, count: 1 });
    }
    return [...out.values()].sort((a, b) => b.count - a.count).slice(0, MOST).map((r) => ({ kind: "part", key: r.part.id, ...r }));
  }, [source, doc, kind, lib]);

  if (!isOpen) return null;
  const close = () => { open = false; play("close"); changed(); };
  const name = source?.name ?? "another site";
  const done = (ids: string[], what: string) => { play(ids.length ? "confirm" : "deny"); setSaid(ids.length ? what : null); };
  const loading = source?.kind === "board" && !doc;
  return (
    <div data-remix-card="" role="dialog" aria-label="Bring a part from another site" className="fixed bottom-24 left-1/2 z-[70] flex max-h-[70vh] w-[min(520px,94vw)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-border bg-panel p-3 shadow-2xl">
      <div className="flex items-center gap-2">
        <Shuffle className="size-4 text-fg-muted" />
        <div className="flex-1 text-plain font-semibold text-fg">Bring a part from another site</div>
        <button type="button" aria-label="Close" onClick={close} className="tactile rounded-sm p-0.5 text-fg-muted hover:text-fg"><X className="size-4" /></button>
      </div>
      {!sources.length ? <div className="text-small text-fg-muted">Your other sites, and every site you import, show here.</div> : (
        <>
          <div className="flex flex-wrap gap-1" role="group" aria-label="From where">
            {sources.map((s) => (
              <button key={sourceKey(s)} type="button" data-remix-site={s.kind === "board" ? s.id : s.kind === "learned" ? s.host : "saved"} data-remix-source={s.kind} aria-pressed={sourceKey(s) === key}
                onClick={() => { play("select"); setKey(sourceKey(s)); setSaid(null); }}
                className={cn("tactile rounded-sm border px-2 py-0.5 text-small", sourceKey(s) === key ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted")}>
                {s.name}{s.kind === "learned" ? <span className="ml-1 text-fine text-fg-faint">learned</span> : null}
              </button>
            ))}
          </div>
          {kinds.length ? (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Which kind">
              {kinds.map((k) => (
                <button key={k} type="button" data-remix-kind={k} aria-pressed={k === kind} onClick={() => { play("tick"); setKind(k); }}
                  className={cn("tactile rounded-sm border px-2 py-0.5 text-small", k === kind ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted")}>{k === "motions" ? "Motions" : kindWord(k, 2)[0]!.toUpperCase() + kindWord(k, 2).slice(1)}</button>
              ))}
            </div>
          ) : null}
          {kind !== "motions" || source?.kind !== "learned" ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-fg-muted">
              <label className="flex items-center gap-2">Keep the original look <Switch size="sm" aria-label="Keep the original look" data-remix-keep="" checked={kept} onCheckedChange={(v) => { setKept(v); play(v ? "toggleOn" : "toggleOff"); }} /></label>
              {source?.kind === "board" ? <label className="flex items-center gap-2">With what is inside it <Switch size="sm" aria-label="With what is inside it" data-remix-whole="" checked={whole} onCheckedChange={(v) => { setWhole(v); play(v ? "toggleOn" : "toggleOff"); }} /></label> : null}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto" data-remix-rows={rows.length}>
            {loading ? <div className="text-small text-fg-muted">Reading {name}…</div> : !rows.length ? <div className="text-small text-fg-muted">{name} has none of these.</div> : rows.map((r) => (
              <div key={r.key} data-remix-row={r.kind === "part" ? r.part.id : r.key} data-remix-row-kind={r.kind} className="flex items-center gap-2 rounded-sm border border-border p-1.5">
                {r.kind === "part" ? <PartChip part={r.part} /> : r.kind === "kit" ? <KitSwatch kit={r.kit} /> : r.kind === "saved" ? <span className="max-w-[180px] truncate text-small text-fg">{r.component.name}</span> : <span className="max-w-[200px] truncate text-small text-fg">{r.version.label}</span>}
                <span className="min-w-0 flex-1 truncate text-small text-fg-muted">
                  {r.kind === "part" || r.kind === "kit" ? (r.count > 1 ? `${r.count} like it` : "one of its own") : r.kind === "saved" ? `${r.component.nodes.length} part${r.component.nodes.length === 1 ? "" : "s"}${r.component.site ? `, from ${r.component.site}` : ""}` : r.version.take.kind === "work" ? "a feature, as that site set it" : "its own motion"}
                </span>
                {r.kind === "motion" ? (
                  <Button size="sm" variant="outline" data-remix-put={r.key} disabled={!picked}
                    onClick={() => { putSiteVersion({ item: r.version.item, take: r.version.take, label: r.version.label, host: r.version.host, parts: [], frames: r.version.frames } as never, (f) => useStudio.getState().addNode(f, 40, 40)); done([picked!.id], `Put on “${picked ? (wordsOf(picked) || picked.label) : ""}”, in one step.`); }}>
                    {picked ? "Put on the picked part" : "Pick a part first"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" data-remix-place={r.kind === "part" ? r.part.id : r.key} onClick={() => {
                    if (r.kind === "part") { const ids = placeRemix(doc!, name, r.part, { kept, whole }); done(ids, `Placed ${ids.length === 1 ? "it" : `it and ${ids.length - 1} inside it`}, ${kept ? "as it was" : "in this site's look"}, in one step.`); }
                    else if (r.kind === "kit") { const ids = placeKit(r.kit, name, kept); done(ids, `Placed a ${KIT_PART[r.kit.role]?.featureId === "cta-primary" ? "button" : r.kit.role} ${kept ? `in ${name}'s style` : "in this site's look"}, in one step.`); }
                    else { const ids = placeSaved(r.component, kept); done(ids, `Placed ${r.component.name}, ${kept ? "as it was saved" : "in this site's look"}, in one step.`); }
                  }}>Place</Button>
                )}
              </div>
            ))}
          </div>
          {said ? (
            <div className="flex items-center gap-2 text-small text-fg-muted" data-remix-said="">
              <span>{said}</span>
              <button type="button" className="tactile underline" onClick={() => { useStudio.getState().undo(); setSaid(null); play("close"); }}>Undo</button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** A part drawn small, as it looks on its own site: its words in its colours, edge, corners and face. */
function PartChip({ part }: { part: StudioNode }) {
  const c = (part.colour ?? {}) as Record<string, string>;
  const css = (v?: string) => (v && /^(#|rgb|oklch|hsl)/.test(v) ? v : undefined);
  const e = part.edge;
  const words = wordsOf(part).slice(0, 18) || "Aa";
  return (
    <span className="flex h-7 max-w-[180px] shrink-0 items-center overflow-hidden whitespace-nowrap px-2 text-plain" style={{
      background: css(c.bg) ?? css(c.accent) ?? css(c.surface),
      color: css(c.text),
      border: e && (e.width ?? 0) > 0 ? `${Math.min(3, e.width ?? 1)}px ${e.style ?? "solid"} ${css(e.colour) ?? "currentColor"}` : undefined,
      borderRadius: Math.min(14, part.radius ?? 0),
      boxShadow: e?.shadow ? e.shadow.replace(/(-?\d+(\.\d+)?)px/g, (_, n) => `${Math.round(Number(n) / 3)}px`) : undefined,
      fontFamily: part.font?.stack ?? (part.font?.face ? `'${part.font.face}'` : undefined),
      fontWeight: part.font?.weight,
    }}>{words}</span>
  );
}

/**
 * For parts brought from another site, in the Look section (one part) or
 * the panel for several (a component brought whole is picked as one): wear
 * the look they had there, or this site's. One undo step each way.
 */
export function RemixKept({ nodes }: { nodes: StudioNode[] }) {
  const mine = nodes.filter((n) => n.remix);
  if (!mine.length) return null;
  const kept = mine.every((n) => n.remix!.kept);
  const sites = [...new Set(mine.map((n) => n.remix!.site))].join(", ");
  return (
    <label className="flex items-center justify-between gap-2 text-small text-fg-muted" data-remix-from={sites}>
      <span>From {sites}: keep {mine.length === 1 ? "its" : "their"} original look</span>
      <Switch size="sm" aria-label="Keep the original look" data-remix-kept="" checked={kept}
        onCheckedChange={(v) => {
          const look = hereLook();
          const patches = new Map(mine.map((n) => [n.id, remixPatch(n, look, v)]));
          useStudio.getState().patchNodes(mine.map((n) => n.id), (n) => patches.get(n.id) ?? {});
          play(v ? "toggleOn" : "toggleOff");
        }} />
    </label>
  );
}
