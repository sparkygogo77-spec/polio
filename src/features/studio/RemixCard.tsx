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
 * Opened from the page's wheel tray (`openRemix`). Escape closes it.
 */
import * as React from "react";
import { Shuffle, X } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Switch } from "@/core/ui/switch";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useBuilds, docOfStored } from "@/features/builds/store";
import { useStudio, type StudioNode } from "./store";
import type { CarriedFont } from "./fonts";
import { kindKey, kindWord } from "./partKind";
import { lookOf } from "./partLook";
import { kitsFromDoc } from "./styleKits";
import { kitDocOf } from "./DrawKits";
import { componentOf, fontsFor, remixParts, remixPatch, siteLookOf, type SiteLook } from "./remix";
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

export function RemixCard() {
  const isOpen = useOpen();
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const others = projects.filter((p) => p.id !== activeId);
  const [siteId, setSiteId] = React.useState<string | null>(null);
  const [doc, setDoc] = React.useState<Doc | null>(null);
  const [kind, setKind] = React.useState<(typeof KINDS)[number]>("button");
  const [kept, setKept] = React.useState(false);
  const [whole, setWhole] = React.useState(true);
  const [said, setSaid] = React.useState<string | null>(null);

  React.useEffect(() => { if (isOpen && !siteId && others[0]) setSiteId(others[0].id); }, [isOpen, siteId, others]);
  React.useEffect(() => {
    if (!siteId) return;
    let live = true;
    setDoc(null);
    void docOfStored(siteId).then((d) => { if (live) setDoc((d as Doc) ?? { nodes: [] }); });
    return () => { live = false; };
  }, [siteId]);
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); open = false; changed(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen]);

  /* One row per look of the chosen kind, most worn first. */
  const rows = React.useMemo(() => {
    const out = new Map<string, { part: StudioNode; count: number }>();
    for (const n of doc?.nodes ?? []) {
      const k = kindKey(n as never);
      if (kindOfKey(k) !== kind || (k === "button" && kind !== "button")) continue;
      const l = lookOf(n as never, ["fill", "outline", "shadow", "corners", "font"]);
      const key = JSON.stringify(l.facets);
      const had = out.get(key);
      if (had) had.count++; else out.set(key, { part: n, count: 1 });
    }
    return [...out.values()].sort((a, b) => b.count - a.count).slice(0, MOST);
  }, [doc, kind]);

  if (!isOpen) return null;
  const close = () => { open = false; play("close"); changed(); };
  const siteName = others.find((p) => p.id === siteId)?.name ?? "another site";
  return (
    <div data-remix-card="" role="dialog" aria-label="Bring a part from another site" className="fixed bottom-24 left-1/2 z-[70] flex max-h-[70vh] w-[min(520px,94vw)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-border bg-panel p-3 shadow-2xl">
      <div className="flex items-center gap-2">
        <Shuffle className="size-4 text-fg-muted" />
        <div className="flex-1 text-plain font-semibold text-fg">Bring a part from another site</div>
        <button type="button" aria-label="Close" onClick={close} className="tactile rounded-sm p-0.5 text-fg-muted hover:text-fg"><X className="size-4" /></button>
      </div>
      {!others.length ? <div className="text-small text-fg-muted">Your other sites show here once you have more than one.</div> : (
        <>
          <div className="flex flex-wrap gap-1" role="group" aria-label="From which site">
            {others.map((p) => (
              <button key={p.id} type="button" data-remix-site={p.id} aria-pressed={p.id === siteId} onClick={() => { play("select"); setSiteId(p.id); setSaid(null); }}
                className={cn("tactile rounded-sm border px-2 py-0.5 text-small", p.id === siteId ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted")}>{p.name}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Which kind">
            {KINDS.map((k) => (
              <button key={k} type="button" data-remix-kind={k} aria-pressed={k === kind} onClick={() => { play("tick"); setKind(k); }}
                className={cn("tactile rounded-sm border px-2 py-0.5 text-small", k === kind ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted")}>{kindWord(k, 2)[0]!.toUpperCase() + kindWord(k, 2).slice(1)}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-fg-muted">
            <label className="flex items-center gap-2">Keep the original look <Switch size="sm" aria-label="Keep the original look" data-remix-keep="" checked={kept} onCheckedChange={(v) => { setKept(v); play(v ? "toggleOn" : "toggleOff"); }} /></label>
            <label className="flex items-center gap-2">With what is inside it <Switch size="sm" aria-label="With what is inside it" data-remix-whole="" checked={whole} onCheckedChange={(v) => { setWhole(v); play(v ? "toggleOn" : "toggleOff"); }} /></label>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto" data-remix-rows={rows.length}>
            {!doc ? <div className="text-small text-fg-muted">Reading {siteName}…</div> : !rows.length ? <div className="text-small text-fg-muted">{siteName} has no {kindWord(kind, 2)}.</div> : rows.map(({ part, count }) => (
              <div key={part.id} data-remix-row={part.id} className="flex items-center gap-2 rounded-sm border border-border p-1.5">
                <PartChip part={part} />
                <span className="min-w-0 flex-1 truncate text-small text-fg-muted">{count > 1 ? `${count} like it` : "one of its own"}</span>
                <Button size="sm" variant="outline" data-remix-place={part.id} onClick={() => {
                  const ids = placeRemix(doc, siteName, part, { kept, whole });
                  play(ids.length ? "confirm" : "deny");
                  setSaid(ids.length ? `Placed ${ids.length === 1 ? "it" : `it and ${ids.length - 1} inside it`}, ${kept ? "as it was" : "in this site's look"}, in one step.` : null);
                }}>Place</Button>
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
    <span className="flex h-7 max-w-[180px] shrink-0 items-center overflow-hidden whitespace-nowrap px-2 text-[11px]" style={{
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
