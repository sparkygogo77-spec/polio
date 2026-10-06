"use client";
/**
 * The cards on the parts shelf, and the detail card one opens.
 *
 * HIS WALK-THROUGH, and what each answer is:
 *
 *   · "They don't show well what they offer or what each element does."
 *     Every card says in one line what it does, under its name, always
 *     (`doesOf`); a hover tooltip that covered the row above is gone.
 *   · Two kinds of thing looked the same. Every card wears a badge: Works
 *     now, or Idea, needs building, and what it needs where that is true: a
 *     key, a backend, money (`shelfFacts.ts`).
 *   · "Dark boxes with the same red glow", cropped, empty, dark on dark.
 *     The preview is the thing itself on the open site's own page colour,
 *     in its colours and faces, fitted whole into its box, with the site's
 *     own words; a motion is shown on a small page of the site doing its
 *     one thing (`MotionDemo.tsx`). No fire.
 *   · One click put a part at the foot of the page and said nothing: 259
 *     parts became 260 and nobody saw where. A click opens the detail card
 *     now; "Add to page" there adds it, picks it, outlines it and scrolls
 *     the board to it. Dragging a card onto the board still places it at
 *     once, where it was let go.
 *   · Whole-site features looked like things to place. They are switches
 *     ("Turn on for this site") with their state (`switchOf`).
 *   · Nothing said what was already in use. A card used on the open page
 *     says so, and the line jumps to those parts.
 */
import { useLearned } from "./library/useLearned";
import { learnedVersions } from "./library/learned";
import * as React from "react";
import { endTry, pickedPart, startTry, tryProps, type Trying } from "./tryLook";
import { useShallow } from "zustand/react/shallow";
import { ArrowUpRight, Check, ChevronDown, CornerDownRight, KeyRound, MousePointerClick, Plus, StickyNote, X } from "lucide-react";
import { getFeature, categoryOf, type FeatureDef } from "./catalog";
import { useHeldStudio, useStudio, type StudioNode } from "./store";
import { PartPreview } from "./PartPreview";
import { MotionDemo, hasDemo } from "./MotionDemo";
import { shapeOf } from "./showcase";
import { planetOf } from "./planets";
import { themeFrom } from "./blocks";
import { resolvePalette, type Theme } from "./parts/theme";
import { parseColor } from "./look";
import { paintedPalette, readableTheme } from "./shelfTheme";
import { getWork, inputsOf, usesOf, withWork, type Work } from "./library/works";
import { siteVersions, type SiteVersion } from "./library/siteVersions";
import { usedByPart, type Use } from "./library/usedBy";
import { partName } from "./partNames";
import { VARIANTS, itemOf, publishOf } from "./shelfPlan";
import { isWorkKey, workIdOf } from "./shelfGroups";
import {
  NEED_LABEL, NEED_MEANS, STATUS_LABEL, STATUS_MEANS, doesOf, exampleContent, footprintOf, formatSwitchOn,
  needsOf, siteWordsOf, statusOf, switchOf, switchStatus, whereOf, type Need, type SiteWords, type Status,
} from "./shelfFacts";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";

/* ------------------------------------------------------------------ */
/* Which card is open                                                  */
/* ------------------------------------------------------------------ */

export type Opened = { kind: "part"; id: string } | { kind: "work"; id: string } | null;
let opened: Opened = null;
const openWatchers = new Set<() => void>();
/** Open a card's detail, or close it with null. */
export function openDetail(o: Opened) {
  opened = o;
  openWatchers.forEach((w) => w());
}
function useOpened(): Opened {
  return React.useSyncExternalStore(
    (w) => { openWatchers.add(w); return () => { openWatchers.delete(w); }; },
    () => opened,
    () => null,
  );
}

/* ------------------------------------------------------------------ */
/* The open site: its words, its theme, what it already uses           */
/* ------------------------------------------------------------------ */

/**
 * The open site's words. Read through a string so the shelf redraws when
 * the words change, not on every drag of every part.
 */
export function useSiteWords(): SiteWords {
  const key = useStudio((s) => {
    const nodes = s.nodes.filter((n) => n.pageId === s.activePageId);
    return JSON.stringify(siteWordsOf(s.brief.name, nodes.map((n) => ({ featureId: n.featureId, content: n.content })), s.pages.map((p) => p.name)));
  });
  return React.useMemo(() => JSON.parse(key) as SiteWords, [key]);
}

/**
 * The theme the shelf's previews are drawn in: the site's, in the colours
 * its page actually paints most when it was captured, with every pair of
 * words and ground held readable (`shelfTheme.ts`).
 *
 * Recounted when the page, its number of parts or the site's colours
 * change, never on a drag: the painted count walks the whole page.
 */
export function useSiteTheme(): Theme {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const pageKey = useStudio((s) => `${s.activePageId}:${s.nodes.length}`);
  return React.useMemo(() => shelfThemeOf(useStudio.getState(), format, look, siteName), [format, look, siteName, pageKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The shelf's theme for a document: pure but for `themeFrom`, so a check can call it with a document of its own. */
export function shelfThemeOf(
  s: { nodes: readonly StudioNode[]; activePageId: string },
  format: Parameters<typeof themeFrom>[0],
  look: Parameters<typeof themeFrom>[1],
  siteName: string,
): Theme {
  let t = themeFrom(format, look, siteName);
  const captured = s.nodes.some((n) => !!n.from) || !!(look as { paletteFrom?: unknown } | undefined)?.paletteFrom;
  let colours: string[] = [];
  if (captured) {
    const declared = resolvePalette(format, look);
    const onPage = s.nodes.filter((n) => n.pageId === s.activePageId);
    const painted = paintedPalette(onPage.length ? onPage : s.nodes, declared, declared.bg);
    if (painted) {
      const light = (parseColor(painted.bg)?.l ?? 0) >= 0.6;
      const { fills: _f, words: _w, ...roles } = painted;
      void _f; void _w;
      t = themeFrom({ ...format, "palette.mode": light ? "light" : "dark" }, { ...(look ?? {}), palette: roles } as Parameters<typeof themeFrom>[1], siteName);
      colours = [...painted.fills.slice(0, 8).map((f) => f.colour), ...painted.words.slice(0, 8).map((w) => w.colour)];
    }
  }
  /* A preview shows the thing on the site's page, not the site's textures over it: they are drawn in colours no pair was checked against. */
  const r = readableTheme({ ...t, surfaceStyle: undefined, surfacePaint: undefined, overlayStyle: undefined, partGround: undefined }, colours);
  return { ...r, backdrop: r.bg };
}

/**
 * The parts on the open page that are this shelf item in any of its
 * versions: the parts it stands for, or a library feature that is one of
 * its versions, carried by a part.
 */
export function useUsedByItem(item: string, opts: { notSelf?: boolean } = {}): string[] {
  const plan = VARIANTS[item];
  /* A whole-site switch's own parts are the switch, said by the switch; what is counted is the parts using its other versions. */
  const keys = (plan ? [item, ...plan.more.map((m) => m.key)] : [item]).filter((k) => !(opts.notSelf && k === item));
  const partIds = new Set(keys.filter((k) => !isWorkKey(k)));
  const workIds = new Set(keys.filter(isWorkKey).map(workIdOf));
  const key = useStudio((s) => s.nodes
    .filter((n) => n.pageId === s.activePageId && (partIds.has(n.featureId) || usesOf(n.work).some((u) => workIds.has(u.id) && !u.off)))
    .map((n) => n.id).join(","));
  return React.useMemo(() => (key ? key.split(",") : []), [key]);
}

/** The parts on the open page that are this catalogue part, or carry this working feature. */
export function useUsedBy(kind: "part" | "work", id: string): string[] {
  const key = useStudio((s) => s.nodes
    .filter((n) => n.pageId === s.activePageId && (kind === "part" ? n.featureId === id : usesOf(n.work).some((u) => u.id === id && !u.off)))
    .map((n) => n.id).join(","));
  return React.useMemo(() => (key ? key.split(",") : []), [key]);
}

/**
 * What the open site's capture brought that the shelf offers again: its own
 * versions of shelf items (`library/siteVersions.ts`), filed under the item
 * each is a version of.
 */
export function useSiteVersions(): Map<string, SiteVersion[]> {
  /* Held still while a part is under the hand (`store/heldView.ts`): the Effects section reads this on every move otherwise. */
  const nodes = useHeldStudio((s) => s.nodes);
  const keyframes = useHeldStudio((s) => (s.look as { keyframes?: unknown }).keyframes);
  const name = useHeldStudio((s) => s.brief.name);
  /* And every other site's, from the learned library (`library/learned.ts`): builder-wide, so they are on every board. */
  const lib = useLearned((s) => s.lib);
  return React.useMemo(() => {
    const by = new Map<string, SiteVersion[]>();
    const frames = Array.isArray(keyframes) ? (keyframes as Parameters<typeof siteVersions>[1]) : [];
    const here = siteVersions(nodes, frames, name);
    for (const v of here) by.set(v.item, [...(by.get(v.item) ?? []), v]);
    const open = here[0]?.host ?? nodes.find((n) => n.from?.host)?.from?.host ?? null;
    for (const [item, list] of learnedVersions(lib, open)) {
      for (const v of list) by.set(item, [...(by.get(item) ?? []), { item, take: v.take, label: v.label, host: v.host, parts: [], frames: v.frames } as SiteVersion]);
    }
    return by;
  }, [nodes, keyframes, name, lib]);
}

/** An item's versions: its own, the near-copies it stands for, and the open site's. */
export interface Version { id: string; key: string; label: string; site?: SiteVersion }
export function versionsOf(item: string, site: Map<string, SiteVersion[]>): Version[] {
  const plan = VARIANTS[item];
  const own: Version[] = plan ? [{ id: item, key: item, label: plan.self }, ...plan.more.map((m) => ({ id: m.key, key: m.key, label: m.label }))] : [{ id: item, key: item, label: "" }];
  const theirs = (site.get(item) ?? []).map((v) => ({
    id: `site:${v.host}`,
    key: v.take.kind === "work" ? `work:${v.take.id}` : item,
    label: v.label,
    site: v,
  }));
  return [...own, ...theirs];
}

/** "3 versions", and "From example.com" when the open site brought its own. */
function VersionsLine({ count, hosts }: { count: number; hosts: string[] }) {
  if (count < 2 && !hosts.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {count >= 2 ? <span data-versions={count} className="whitespace-nowrap rounded-full px-1.5 py-px text-fine text-fg-muted" style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}>{count} versions</span> : null}
      {hosts.map((h) => (
        <span key={h} data-from-site={h} className="whitespace-nowrap rounded-full px-1.5 py-px text-fine font-medium" style={{ background: "oklch(0.78 0.14 150 / 0.14)", color: "oklch(0.86 0.13 150)" }}>From {h}</span>
      ))}
    </span>
  );
}

/** A whole-site switch's state: on everywhere, on some pages, or off. */
export function useSwitch(featureId: string): { on: boolean; some: number; of: number; toggle: () => void } | null {
  const sw = switchOf(featureId);
  const state = useStudio((s) => {
    if (!sw) return "";
    if (sw.kind === "format") return formatSwitchOn(sw, s.format[sw.key]) ? "1/1" : "0/1";
    const withIt = s.pages.filter((p) => s.nodes.some((n) => n.pageId === p.id && n.featureId === featureId)).length;
    return `${withIt}/${s.pages.length}`;
  });
  if (!sw) return null;
  const [some, of] = state.split("/").map(Number) as [number, number];
  const on = of > 0 && some === of;
  return { on, some, of, toggle: () => setSwitch(featureId, !on) };
}

/** Turn a whole-site feature on or off. On for a motion is one of its parts on every page. */
export function setSwitch(featureId: string, on: boolean) {
  const sw = switchOf(featureId);
  if (!sw) return;
  const st = useStudio.getState();
  play(on ? "confirm" : "close");
  if (sw.kind === "format") { st.setFormat(sw.key, on ? sw.on : sw.off); return; }
  /* The Format field that says the same thing follows, so the brief and the shelf agree. */
  if (sw.mirror) st.setFormat(sw.mirror.key, on ? sw.mirror.on : sw.mirror.off);
  if (!on) { st.removeNodes(st.nodes.filter((n) => n.featureId === featureId).map((n) => n.id)); return; }
  const f = getFeature(featureId);
  for (const p of st.pages) {
    const now = useStudio.getState();
    if (now.nodes.some((n) => n.pageId === p.id && n.featureId === featureId)) continue;
    const onPage = now.nodes.filter((n) => n.pageId === p.id);
    const bottom = onPage.reduce((m, n) => Math.max(m, n.y + n.h), 0);
    const w = Math.min(f?.w ?? 420, now.frameWidth);
    now.addNode(featureId, w >= now.frameWidth ? 0 : Math.round((now.frameWidth - w) / 2), onPage.length ? bottom + 24 : 0, { pageId: p.id, w, h: f?.h ?? 64 });
  }
}

/**
 * Pick these parts, scroll the board to the first and outline them for a
 * moment. The board is scrolled by hand rather than with `scrollIntoView`,
 * which would scroll every ancestor and take the shelf with it.
 */
export function jumpTo(ids: string[]) {
  if (!ids.length) return;
  useStudio.getState().setSelection(ids);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const first = document.querySelector(`[data-node-id="${CSS.escape(ids[0]!)}"]`);
    const pane = first?.closest("[data-studio-pane]");
    if (first instanceof HTMLElement && pane instanceof HTMLElement) {
      const r = first.getBoundingClientRect();
      const p = pane.getBoundingClientRect();
      pane.scrollTo({ top: pane.scrollTop + (r.top - p.top) - Math.max(24, (p.height - r.height) / 2), behavior: "smooth" });
    }
    for (const id of ids.slice(0, 40)) {
      const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (!(el instanceof HTMLElement)) continue;
      el.setAttribute("data-just-shown", "");
      el.animate(
        [{ outline: "3px solid oklch(0.8 0.17 150)", outlineOffset: "3px" }, { outline: "3px solid oklch(0.8 0.17 150 / 0)", outlineOffset: "12px" }],
        { duration: 1400, easing: "ease-out" },
      ).onfinish = () => el.removeAttribute("data-just-shown");
    }
  }));
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

const STATUS_HUE: Record<Status, number> = { works: 150, build: 75, service: 250, note: 300 };

export function StatusBadge({ status }: { status: Status }) {
  const hue = STATUS_HUE[status];
  return (
    <span
      data-status-badge={status}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-fine font-medium"
      style={{ background: `oklch(0.78 0.14 ${hue} / 0.16)`, color: `oklch(0.86 0.13 ${hue})`, boxShadow: `inset 0 0 0 1px oklch(0.78 0.14 ${hue} / 0.45)` }}
    >
      {status === "works" ? <Check className="size-3" /> : status === "note" ? <StickyNote className="size-3" /> : status === "service" ? <KeyRound className="size-3" /> : <CornerDownRight className="size-3" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function NeedBadge({ need }: { need: Need }) {
  return (
    <span data-need-badge={need} className="whitespace-nowrap rounded-full px-1.5 py-px text-fine text-fg-muted" style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}>
      {NEED_LABEL[need]}
    </span>
  );
}

/**
 * "On this page: 3 parts". Pressed, it picks them all and brings the first
 * into view; its arrow opens the list of them by name, each a link to that
 * one part (R14: the count links to the parts using it).
 */
function UsedLine({ ids, what }: { ids: string[]; what?: string }) {
  const [open, setOpen] = React.useState(false);
  const names = useStudio(useShallow((s) => {
    if (!open || !ids.length) return [] as string[];
    const page = s.nodes.filter((n) => n.pageId === s.activePageId);
    return ids.map((id) => {
      const n = page.find((x) => x.id === id);
      return n ? partName(n, page, (f) => getFeature(f)?.name) : id;
    });
  }));
  if (!ids.length) return null;
  return (
    <div className="flex flex-col gap-0.5 self-start" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          data-used-on-page={ids.length}
          onClick={() => { play("select"); jumpTo(ids); }}
          className="tactile inline-flex items-center gap-1 rounded-sm text-fine font-medium text-accent hover:underline"
        >
          On this page: {ids.length === 1 ? (what ?? "1 part") : `${ids.length} parts`}
          <ArrowUpRight className="size-3" />
        </button>
        <button
          type="button"
          data-used-list-toggle=""
          aria-expanded={open}
          aria-label={open ? "Hide which parts" : "Show which parts"}
          onClick={() => { play("tap"); setOpen((v) => !v); }}
          className="tactile rounded-sm p-0.5 text-fg-muted hover:text-fg"
        >
          <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        </button>
      </span>
      {open ? (
        <ul data-used-list="" className="flex max-h-28 flex-col gap-0.5 overflow-y-auto pl-1">
          {ids.map((id, i) => (
            <li key={id}>
              <button
                type="button"
                data-used-part={id}
                onClick={() => { play("select"); jumpTo([id]); }}
                className="tactile max-w-full truncate text-left text-fine text-fg-muted hover:text-accent hover:underline"
              >
                {names[i] ?? id}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What the picked part uses (R14)                                     */
/* ------------------------------------------------------------------ */

/** The shelf items the one picked part uses, or none when zero or several parts are picked. */
export function usePickedUses(): { id: string; name: string; uses: Use[] } | null {
  const key = useStudio((s) => {
    if (s.selection.length !== 1) return "";
    const n = s.nodes.find((x) => x.id === s.selection[0]);
    if (!n) return "";
    const frames = (s.look as { keyframes?: unknown }).keyframes;
    const uses = usedByPart(n, Array.isArray(frames) ? (frames as Parameters<typeof usedByPart>[1]) : []);
    return JSON.stringify({ id: n.id, uses });
  });
  /* The name is read when the pick changes, not on every frame of a drag. */
  return React.useMemo(() => {
    if (!key) return null;
    const { id, uses } = JSON.parse(key) as { id: string; uses: Use[] };
    const s = useStudio.getState();
    const n = s.nodes.find((x) => x.id === id);
    const name = n ? partName(n, s.nodes.filter((x) => x.pageId === n.pageId), (f) => getFeature(f)?.name) : id;
    return { id, name, uses };
  }, [key]);
}

/** Whether the picked part uses this shelf item. */
function usePickedUsesItem(item: string): boolean {
  return useStudio((s) => {
    if (s.selection.length !== 1 || !item) return false;
    const n = s.nodes.find((x) => x.id === s.selection[0]);
    if (!n) return false;
    const frames = (s.look as { keyframes?: unknown }).keyframes;
    return usedByPart(n, Array.isArray(frames) ? (frames as Parameters<typeof usedByPart>[1]) : []).some((u) => u.item === item);
  });
}

const VIA: Record<Use["via"], string> = { is: "is this", carries: "carries it", captured: "from its page" };

/** The mark on a card the picked part uses. */
function PickedMark() {
  return (
    <span data-used-by-picked="" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-fine font-medium" style={{ background: "oklch(0.78 0.14 150 / 0.2)", color: "oklch(0.88 0.12 150)" }}>
      <MousePointerClick className="size-3" /> This part
    </span>
  );
}

/**
 * The strip at the top of the shelf while one part is picked: every shelf
 * item that part uses, what it is, what it carries, what its page gave it.
 * A press opens that card at the version the part uses.
 */
export function UsedByPicked() {
  const picked = usePickedUses();
  if (!picked || !picked.uses.length) return null;
  return (
    <div data-used-by-part={picked.id} className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-1.5 text-fine" style={{ background: "oklch(0.2 0.03 150 / 0.55)", boxShadow: "inset 0 -1px 0 var(--border)" }}>
      <span className="font-medium text-fg">Used by this part</span>
      <span className="max-w-48 truncate text-fg-muted">({picked.name})</span>
      {picked.uses.map((u) => {
        const isWork = isWorkKey(u.item);
        const name = isWork ? getWork(workIdOf(u.item))?.manifest.name : getFeature(u.item)?.name;
        const c = categoryOf(isWork ? getWork(workIdOf(u.item))?.manifest.category ?? "" : getFeature(u.item)?.category ?? "");
        return (
          <button
            key={u.item}
            type="button"
            data-used-item={u.item}
            data-via={u.via}
            onClick={() => { play("select"); openDetail(isWorkKey(u.version) ? { kind: "work", id: workIdOf(u.version) } : { kind: "part", id: u.version }); }}
            className="tactile inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
            style={{ background: `oklch(0.72 0.15 ${c.hue} / 0.16)`, color: `oklch(0.86 0.12 ${c.hue})`, boxShadow: `inset 0 0 0 1px oklch(0.72 0.15 ${c.hue} / 0.4)` }}
          >
            {React.createElement(planetOf(c.id), { size: 11 })}
            {name}{u.label && u.version !== u.item ? `: ${u.label}` : ""}
            <span className="opacity-60">{VIA[u.via]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The switch a whole-site feature wears in place of an add. */
function SwitchRow({ featureId, compact }: { featureId: string; compact?: boolean }) {
  const sw = useSwitch(featureId);
  if (!sw) return null;
  const state = sw.on ? "On" : sw.some ? `On for ${sw.some} of ${sw.of} pages` : "Off";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={sw.on}
      data-site-switch={featureId}
      data-on={sw.on ? "1" : "0"}
      onClick={(e) => { e.stopPropagation(); sw.toggle(); }}
      className={cn("tactile flex items-center gap-2 self-stretch rounded-md px-2 text-left text-fine", compact ? "py-1" : "py-1.5 text-small")}
      style={{ background: sw.on ? "oklch(0.78 0.14 150 / 0.14)" : "oklch(1 0 0 / 0.04)", boxShadow: "inset 0 0 0 1px var(--border)" }}
    >
      <span
        aria-hidden
        className="relative inline-block h-3.5 w-6 shrink-0 rounded-full transition-colors"
        style={{ background: sw.on ? "oklch(0.72 0.16 150)" : "oklch(0.4 0.02 270)" }}
      >
        <span className="absolute top-0.5 size-2.5 rounded-full bg-white transition-[left]" style={{ left: sw.on ? 12 : 2 }} />
      </span>
      <span className="flex-1 text-fg">{sw.on ? "On for this site" : "Turn on for this site"}</span>
      <span className="text-fg-faint">{state}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* One card                                                            */
/* ------------------------------------------------------------------ */

const PLAY_MS = 1600;
export const PREVIEW_H = 124;

/** One pass of a card's preview under the hand, forgotten on the way out. */
function useWake() {
  const [awake, setAwake] = React.useState(false);
  const stop = React.useRef<number | null>(null);
  React.useEffect(() => () => { if (stop.current) window.clearTimeout(stop.current); }, []);
  const wake = React.useCallback(() => {
    if (stop.current) window.clearTimeout(stop.current);
    setAwake(true);
    stop.current = window.setTimeout(() => setAwake(false), PLAY_MS);
  }, []);
  const rest = () => {
    if (stop.current) { window.clearTimeout(stop.current); stop.current = null; }
    setAwake(false);
  };
  /*
   * ONCE WHEN SHOWN, as well as under the hand. A still frame of an effect
   * is a guess at the effect; the first time a card comes into view it plays
   * its one pass, so what it does is seen before anybody thinks to hover.
   */
  const seen = React.useRef(false);
  const shown = React.useCallback((el: HTMLElement | null) => {
    if (!el || seen.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting) || seen.current) return;
      seen.current = true;
      io.disconnect();
      wake();
    }, { threshold: 0.5 });
    io.observe(el);
  }, [wake]);
  return { awake, wake, rest, shown };
}

/** A big preview that plays once as it is shown and again under the hand: the detail card's picture. */
function Played({ children }: { children: (playing: boolean) => React.ReactNode }) {
  const { awake, wake, shown } = useWake();
  return <div ref={shown} data-played={awake ? "1" : "0"} onPointerEnter={wake}>{children(awake)}</div>;
}

/** Parts that are made from something of the owner's, and what each becomes once it has it. */
const FROM_YOURS: Record<string, string> = {
  "mesh-3d": "Draw a shape on the board and it becomes a solid you can turn.",
};

/** The thing itself, fitted whole into a box, on the site's page. */
export function ThingPreview({ feature, width, height, words, playing, loop }: {
  feature: FeatureDef; width: number; height: number; words: SiteWords; playing?: boolean; loop?: boolean;
}) {
  const t = useSiteTheme();
  const id = feature.basedOn ?? feature.id;
  if (hasDemo(id) && (feature.category === "motion" || switchOf(id))) {
    return <MotionDemo id={id} t={t} words={words} width={width} height={height} play={playing} loop={loop} />;
  }
  const yours = FROM_YOURS[id];
  if (yours) {
    /* A part made from something of his draws nothing until it has it: say what it becomes, on his page, rather than show an empty box. */
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 text-center" style={{ width, height, background: t.bg }}>
        <span className="text-[26px] leading-none" style={{ color: t.accent }}>✎ → ◆</span>
        <span className="text-small" style={{ color: t.text, fontFamily: t.bodyFamily }}>{yours}</span>
      </div>
    );
  }
  return (
    <PartPreview
      feature={feature}
      width={width}
      height={height}
      play={playing || loop}
      ground="page"
      theme={t}
      /* A thin strip is drawn narrower still, so the words on it are big enough to read. */
      drawWidth={shapeOf(feature) === "strip" ? 720 : 960}
      content={feature.preset?.content ? undefined : exampleContent(feature, words)}
    />
  );
}

export const ShelfCard = React.memo(function ShelfCard({ feature, width, words, onRemove, versions = 1, hosts = [] }: {
  feature: FeatureDef; width: number; words: SiteWords; onRemove?: () => void;
  /** How many versions the item offers, its own included. */
  versions?: number;
  /** Sites whose own version of it the open board carries. */
  hosts?: string[];
}) {
  const { awake, wake, rest, shown } = useWake();
  const sw = switchOf(feature.id);
  const used = useUsedByItem(feature.basedOn ? "" : feature.id, { notSelf: !!sw });
  const pickedUses = usePickedUsesItem(feature.basedOn ? "" : feature.id);
  const status = sw ? switchStatus(feature.id) : statusOf(feature);
  const needs = needsOf(feature);
  const open = () => { play("select"); openDetail({ kind: "part", id: feature.id }); };
  const inner = Math.max(120, Math.round(width) - 2);
  return (
    <div
      /* The card is what a person right-clicks on the shelf, so it carries the
         shelf's scope (AGENTS.md: ctxProps on anything right-clickable); the
         card that came before this one did, and its menu went with it. */
      {...ctxProps("studio-palette", feature.id, feature)}
      data-shelf-card={feature.id}
      data-status={status}
      data-site-wide={sw ? "1" : undefined}
      className="group relative flex flex-col overflow-hidden rounded-md border border-border bg-panel transition-colors hover:border-fg-faint"
      style={{ width }}
      ref={shown}
      onPointerEnter={wake}
      onPointerLeave={rest}
    >
      <div
        role="button"
        tabIndex={0}
        draggable
        aria-label={`${feature.name}: see what it does`}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-studio-feature", feature.id);
          e.dataTransfer.effectAllowed = "copy";
          play("tap");
        }}
        onClick={open}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
        /* Named, so a check can ask each tile what it is showing. */
        data-tile={feature.id}
        className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ThingPreview feature={feature} width={inner} height={PREVIEW_H} words={words} playing={awake} />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-1.5">
        <div className="flex items-baseline gap-2">
          <button type="button" onClick={open} className="min-w-0 flex-1 truncate text-left text-small font-medium text-fg">{feature.name}</button>
          <span data-footprint="" className="shrink-0 text-fine text-fg-faint">{sw ? "Whole site" : footprintOf(feature)}</span>
        </div>
        <p data-card-does="" className="line-clamp-2 text-fine leading-snug text-fg-muted">{doesOf(feature)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
          <StatusBadge status={status} />
          {needs.map((n) => <NeedBadge key={n} need={n} />)}
          <VersionsLine count={versions} hosts={hosts} />
          {pickedUses ? <PickedMark /> : null}
        </div>
        {sw ? <SwitchRow featureId={feature.id} compact /> : null}
        <UsedLine ids={used} />
      </div>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${feature.name} from the library`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="tactile absolute right-1 top-1 hidden rounded-sm bg-panel/90 p-0.5 text-fg-faint hover:text-fg group-hover:block"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* A working feature's card                                            */
/* ------------------------------------------------------------------ */

const WORK_NEED: Record<string, Need | null> = { none: null, wallet: "wallet", backend: "backend", key: "key" };

/** A working feature, taken from one of his sites: the same card, with its own preview. */
export function WorkShelfCard({ work, width, words, picture, versions = 1, hosts = [] }: {
  work: Work; width: number; words: SiteWords; picture?: (w: number, h: number) => React.ReactNode; versions?: number; hosts?: string[];
}) {
  const m = work.manifest;
  const { awake, wake, rest, shown } = useWake();
  const used = useUsedByItem(`work:${m.id}`);
  const pickedUses = usePickedUsesItem(`work:${m.id}`);
  const t = useSiteTheme();
  const need = WORK_NEED[m.needs] ?? null;
  const open = () => { play("select"); openDetail({ kind: "work", id: m.id }); };
  const inner = Math.max(120, Math.round(width) - 2);
  return (
    <div
      data-shelf-card={`work:${m.id}`}
      data-work-card={m.id}
      data-status={statusOf(`work:${m.id}`, m.needs)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-panel transition-colors hover:border-fg-faint"
      style={{ width }}
      ref={shown}
      /* Pointing at it with a part picked plays it on that part (tryLook.ts); leaving takes it off. */
      onPointerEnter={() => { wake(); startTry(tryWork(m.id)); }}
      onPointerLeave={() => { rest(); endTry(); }}
      onClick={() => { endTry(); open(); }}
    >
      <button type="button" aria-label={`${m.name}: see what it does`} className="block text-left">
        {picture ? picture(inner, PREVIEW_H) : <WorkPreview work={work} t={t} words={words} width={inner} height={PREVIEW_H} playing={awake} />}
      </button>
      <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-1.5">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-left text-small font-medium text-fg">{m.name}</span>
          {work.from ? <span className="shrink-0 text-fine text-fg-faint">from {work.from.split("/")[1]}</span> : null}
        </div>
        <p data-card-does="" className="line-clamp-2 text-fine leading-snug text-fg-muted">{m.blurb}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
          <StatusBadge status={statusOf(`work:${m.id}`, m.needs)} />
          {need ? <NeedBadge need={need} /> : null}
          <VersionsLine count={versions} hosts={hosts} />
          {pickedUses ? <PickedMark /> : null}
        </div>
        <UsedLine ids={used} />
      </div>
    </div>
  );
}

function WorkPreview({ work, t, words, width, height, playing, loop }: {
  work: Work; t: ReturnType<typeof themeFrom>; words: SiteWords; width: number; height: number; playing?: boolean; loop?: boolean;
}) {
  /* Every working feature is shown doing its job to a piece of the open site; one this file has no scene for is shown on a card of the site, named. */
  return <MotionDemo id={work.manifest.id} label={work.manifest.name} t={t} words={words} width={width} height={height} play={playing} loop={loop} />;
}

/* ------------------------------------------------------------------ */
/* The detail card                                                     */
/* ------------------------------------------------------------------ */

/** Add a part to the open page, then pick it, outline it and bring it into view. */
export function addAndShow(featureId: string, add: (id: string) => string) {
  const id = add(featureId);
  openDetail(null);
  jumpTo([id]);
  return id;
}

export function PartDetail({ add }: { add: (featureId: string) => string }) {
  const o = useOpened();
  React.useEffect(() => {
    if (!o) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      openDetail(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [o]);
  if (!o) return null;
  return (
    <div data-part-detail-backdrop="" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) openDetail(null); }}>
      <ItemBody key={`${o.kind}:${o.id}`} start={o.kind === "work" ? `work:${o.id}` : o.id} add={add} />
    </div>
  );
}

function Shell({ title, category, attr, children, preview }: { title: string; category: string; attr: Record<string, string>; children: React.ReactNode; preview: React.ReactNode }) {
  const c = categoryOf(category);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      {...attr}
      className="flex max-h-[88vh] w-[min(900px,96vw)] flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-small" style={{ color: `oklch(0.84 0.13 ${c.hue})` }}>
          {React.createElement(planetOf(c.id), { size: 14 })}
          {c.label}
        </span>
        <span className="text-fg-faint">/</span>
        <h2 className="min-w-0 flex-1 truncate text-large font-semibold text-fg">{title}</h2>
        <button type="button" aria-label="Close" onClick={() => { play("close"); openDetail(null); }} className="tactile rounded-sm p-1 text-fg-muted hover:bg-hover hover:text-fg">
          <X className="size-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row">
        <div className="shrink-0 overflow-hidden rounded-md border border-border" style={{ width: 440, maxWidth: "100%" }}>{preview}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-fine uppercase tracking-wider text-fg-faint">{title}</h3>
      {children}
    </section>
  );
}

function NeedsRow({ needs }: { needs: Need[] }) {
  return (
    <Row title="What it needs">
      {needs.length ? (
        <ul className="flex flex-col gap-1">
          {needs.map((n) => <li key={n} className="flex items-start gap-2 text-small text-fg-muted"><NeedBadge need={n} /><span>{NEED_MEANS[n]}</span></li>)}
        </ul>
      ) : <p className="text-small text-fg-muted">Nothing else: no key, no backend, nothing to pay for.</p>}
    </Row>
  );
}

/** A link from the shelf's Motion category to the side panel's Motion tab. */
export function SeeMotionTab({ className }: { className?: string }) {
  return (
    <button
      type="button"
      data-see-motion-tab=""
      onClick={() => { play("select"); window.dispatchEvent(new CustomEvent("studio:panel", { detail: "motion" })); }}
      className={cn("tactile inline-flex items-center gap-1 rounded-sm text-small font-medium text-accent hover:underline", className)}
    >
      See on this page <ArrowUpRight className="size-3" />
    </button>
  );
}

/**
 * The way back the other way: the side panel's Motion tab opening the
 * shelf's Motion category. The shelf listens for `studio:shelf`.
 */
export function SeeOnShelf({ category, children }: { category: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-see-on-shelf={category}
      onClick={() => { play("select"); window.dispatchEvent(new CustomEvent("studio:shelf", { detail: category })); }}
      className="tactile inline-flex items-center gap-1 rounded-sm text-fine font-medium text-accent hover:underline"
    >
      {children} <ArrowUpRight className="size-3" />
    </button>
  );
}

/** A library feature played on the picked part while it is pointed at (tryLook.ts); nothing when no part is picked. */
function tryWork(id: string, inputs: Record<string, string> = {}): Trying | null {
  const picked = pickedPart();
  const w = getWork(id);
  return picked && w ? { patches: {}, play: { part: picked.id, feature: id, inputs: inputsOf(w.manifest, inputs) }, what: w.manifest.name } : null;
}

/**
 * Put a library feature on the picked part, or on a new line of text when
 * nothing is picked. It has no look of its own: the part keeps its look.
 */
function putWork(id: string, inputs: Record<string, string>, add: (featureId: string) => string) {
  const st = useStudio.getState();
  const picked = st.selection.length === 1 ? st.nodes.find((n) => n.id === st.selection[0]) ?? null : null;
  if (picked) {
    st.updateNode(picked.id, { work: withWork(picked.work, { id, inputs }) });
    play("confirm");
    openDetail(null);
    jumpTo([picked.id]);
    return;
  }
  const at = add("prose");
  useStudio.getState().updateNode(at, { content: getWork(id)?.manifest.look.sample ?? "", work: { id, inputs }, w: 240, h: 40 });
  openDetail(null);
  jumpTo([at]);
}

/** Put a site's own version on the picked part, or on a new part when nothing is picked. */
export function putSiteVersion(v: SiteVersion, add: (featureId: string) => string) {
  const take = v.take;
  if (take.kind === "work") { putWork(take.id, take.inputs, add); return; }
  const st = useStudio.getState();
  const picked = st.selection.length === 1 ? st.nodes.find((n) => n.id === st.selection[0]) ?? null : null;
  const target = picked?.id ?? add(take.kind === "embed" ? "box" : "prose");
  const node = useStudio.getState().nodes.find((n) => n.id === target);
  if (take.kind === "motion") {
    /* A version learned from another site carries the keyframes it names: they join this board's, so it moves here too. */
    const carried = (v as SiteVersion & { frames?: { name: string }[] }).frames ?? [];
    if (carried.length) {
      const look = useStudio.getState().look as { keyframes?: { name: string }[] };
      const had = new Set((look.keyframes ?? []).map((k) => k.name));
      const add = carried.filter((k) => !had.has(k.name));
      if (add.length) useStudio.setState({ look: { ...useStudio.getState().look, keyframes: [...(look.keyframes ?? []), ...add] } as never });
    }
    const before = (node?.motion ?? {}) as Record<string, unknown>;
    useStudio.getState().updateNode(target, { motion: { ...before, ...take.motion } as StudioNode["motion"] });
  } else {
    useStudio.getState().updateNode(target, { embed: take.embed as unknown as StudioNode["embed"] });
  }
  play("confirm");
  openDetail(null);
  jumpTo([target]);
}

/**
 * One detail card for any shelf item, with its versions.
 *
 * The versions are the near-copies the item stands for (`shelfPlan.ts`)
 * and the open site's own (`library/siteVersions.ts`). Picking one shows
 * it, says what it does and whether it works published, and is what Add
 * puts on the page.
 */
function ItemBody({ start, add }: { start: string; add: (featureId: string) => string }) {
  const item = itemOf(start) ?? start;
  const site = useSiteVersions();
  const versions = React.useMemo(() => versionsOf(item, site), [item, site]);
  const [pick, setPick] = React.useState(() => (versions.some((v) => v.id === start) ? start : versions[0]!.id));
  const v = versions.find((x) => x.id === pick) ?? versions[0]!;
  const words = useSiteWords();
  const t = useSiteTheme();
  const pageName = useStudio((s) => s.pages.find((p) => p.id === s.activePageId)?.name ?? "this page");
  const picked = useStudio(useShallow((s) => (s.selection.length === 1 ? s.nodes.find((n) => n.id === s.selection[0]) ?? null : null)));
  const isWork = isWorkKey(v.key);
  const work = isWork ? getWork(workIdOf(v.key)) : undefined;
  const feature = isWork ? undefined : getFeature(v.key);
  const head = isWorkKey(item) ? getWork(workIdOf(item))?.manifest : getFeature(item);
  const used = useUsedBy(isWork ? "work" : "part", isWork ? workIdOf(v.key) : feature?.basedOn ? "" : v.key);
  if (!head || (!work && !feature)) return null;
  const title = "name" in head ? head.name : "";
  const category = "category" in head ? head.category : "";
  const sw = !isWork && !v.site ? switchOf(v.key) : null;
  const needs: Need[] = work ? (WORK_NEED[work.manifest.needs] ? [WORK_NEED[work.manifest.needs]!] : []) : needsOf(feature!);
  const status: Status = work ? statusOf(`work:${work.manifest.id}`, work.manifest.needs) : statusOf(feature!);
  const does = work ? work.manifest.blurb : feature!.explain ?? doesOf(feature!);
  const p = publishOf(v.key);
  const addKey = isWork ? v.key : v.key;
  const onAdd = () => {
    if (v.site) { putSiteVersion(v.site, add); return; }
    if (work) { putWork(work.manifest.id, {}, add); return; }
    addAndShow(v.key, add);
  };
  const preview = (w: number, h: number, on: boolean) => (work
    ? <WorkPreview work={work} t={t} words={words} width={w} height={h} playing={on} />
    : <ThingPreview feature={feature!} width={w} height={h} words={words} playing={on} />);
  return (
    <Shell
      title={title}
      category={category}
      attr={{ "data-part-detail": start, "data-item": item }}
      preview={<Played>{(on) => preview(440, 280, on)}</Played>}
    >
      {versions.length > 1 ? (
        <Row title="Versions">
          <div data-versions-row="" className="flex flex-wrap gap-1.5">
            {versions.map((x) => {
              const on = x.id === v.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  data-version={x.id}
                  aria-pressed={on}
                  onClick={() => { play("select"); setPick(x.id); }}
                  className="tactile rounded-full px-2.5 py-1 text-small font-medium"
                  style={{
                    background: on ? "oklch(0.78 0.14 150 / 0.22)" : "oklch(1 0 0 / 0.04)",
                    color: on ? "oklch(0.9 0.1 150)" : undefined,
                    boxShadow: `inset 0 0 0 1px ${on ? "oklch(0.78 0.14 150 / 0.6)" : "var(--border)"}`,
                  }}
                >
                  {x.label || title}
                </button>
              );
            })}
          </div>
        </Row>
      ) : null}
      <Row title="What it does">
        <p className="text-plain text-fg">{does}</p>
        {v.site ? <p data-site-version="" className="text-fine text-fg-muted">The version {v.site.host} uses, with the settings measured on its page: {v.site.parts.length} part{v.site.parts.length === 1 ? "" : "s"} there carry it.</p> : null}
        {work?.from ? <p className="text-fine text-fg-faint">Taken from {work.from}.</p> : null}
      </Row>
      <Row title="On your site">
        <p className="text-small text-fg-muted">
          {sw
            ? "A setting for the whole site: every page gets it, and nothing is placed on a page."
            : work || v.site
              ? `It goes onto a part and that part keeps its look. ${picked ? `The picked part, “${picked.label}”, can take it.` : "Pick a part on the board first to put it there, or add it on a new part."}`
              : `Added at the foot of ${pageName}, ${footprintOf(feature!).toLowerCase()}. It usually sits: ${whereOf(feature!).toLowerCase()}. Drag its card onto the board to put it anywhere.`}
        </p>
        {category === "motion" ? <SeeMotionTab className="self-start" /> : null}
      </Row>
      <Row title="When published">
        <div className="flex items-start gap-2 text-small text-fg-muted">
          <StatusBadge status={v.site ? "works" : status} />
          <span>{v.site ? "Runs on the published site, as it ran on the site it came from." : p.kind === "still" && status === "build" ? `The published site shows it still: it waits on ${p.waits}, which a build makes real.` : STATUS_MEANS[v.site ? "works" : status]}</span>
        </div>
      </Row>
      <NeedsRow needs={needs} />
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {sw ? <div className="min-w-[260px] flex-1"><SwitchRow featureId={v.key} /></div> : (
          <button
            type="button"
            data-add-to-page={v.site ? `site:${v.site.host}` : addKey}
            data-work-put={work && picked && !v.site ? work.manifest.id : undefined}
            {...tryProps(() => (picked ? (v.site?.take.kind === "work" ? tryWork(v.site.take.id, v.site.take.inputs) : work ? tryWork(work.manifest.id) : null) : null), onAdd)}
            className="tactile flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-small font-medium text-accent-fg"
          >
            {(work || v.site) && picked ? <><Check className="size-3.5" /> Put on “{picked.label}”</> : <><Plus className="size-3.5" /> Add to page</>}
          </button>
        )}
        <UsedLine ids={used} />
      </div>
    </Shell>
  );
}
