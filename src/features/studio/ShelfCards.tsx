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
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { ArrowUpRight, Check, CornerDownRight, Plus, X } from "lucide-react";
import { getFeature, categoryOf, type FeatureDef } from "./catalog";
import { useStudio } from "./store";
import { PartPreview } from "./PartPreview";
import { MotionDemo, hasDemo } from "./MotionDemo";
import { shapeOf } from "./showcase";
import { planetOf } from "./planets";
import { themeFrom } from "./blocks";
import { getWork, usesOf, withWork, type Work } from "./library/works";
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

export function useSiteTheme() {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  return React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
}

/** The parts on the open page that are this catalogue part, or carry this working feature. */
export function useUsedBy(kind: "part" | "work", id: string): string[] {
  const key = useStudio((s) => s.nodes
    .filter((n) => n.pageId === s.activePageId && (kind === "part" ? n.featureId === id : usesOf(n.work).some((u) => u.id === id && !u.off)))
    .map((n) => n.id).join(","));
  return React.useMemo(() => (key ? key.split(",") : []), [key]);
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

const STATUS_HUE: Record<Status, number> = { works: 150, idea: 75 };

export function StatusBadge({ status }: { status: Status }) {
  const hue = STATUS_HUE[status];
  return (
    <span
      data-status-badge={status}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-fine font-medium"
      style={{ background: `oklch(0.78 0.14 ${hue} / 0.16)`, color: `oklch(0.86 0.13 ${hue})`, boxShadow: `inset 0 0 0 1px oklch(0.78 0.14 ${hue} / 0.45)` }}
    >
      {status === "works" ? <Check className="size-3" /> : <CornerDownRight className="size-3" />}
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

/** "On this page: 3 parts", which jumps to them. */
function UsedLine({ ids, what }: { ids: string[]; what?: string }) {
  if (!ids.length) return null;
  return (
    <button
      type="button"
      data-used-on-page={ids.length}
      onClick={(e) => { e.stopPropagation(); play("select"); jumpTo(ids); }}
      className="tactile inline-flex items-center gap-1 self-start rounded-sm text-fine font-medium text-accent hover:underline"
    >
      On this page: {ids.length === 1 ? (what ?? "1 part") : `${ids.length} parts`}
      <ArrowUpRight className="size-3" />
    </button>
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
      /* A thin strip is drawn narrower still, so the words on it are big enough to read. */
      drawWidth={shapeOf(feature) === "strip" ? 720 : 960}
      content={feature.preset?.content ? undefined : exampleContent(feature, words)}
    />
  );
}

export const ShelfCard = React.memo(function ShelfCard({ feature, width, words, onRemove }: {
  feature: FeatureDef; width: number; words: SiteWords; onRemove?: () => void;
}) {
  const { awake, wake, rest, shown } = useWake();
  const used = useUsedBy("part", feature.basedOn ? "" : feature.id);
  const sw = switchOf(feature.id);
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
        </div>
        {sw ? <SwitchRow featureId={feature.id} compact /> : <UsedLine ids={used} />}
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
export function WorkShelfCard({ work, width, words, picture }: { work: Work; width: number; words: SiteWords; picture?: (w: number, h: number) => React.ReactNode }) {
  const m = work.manifest;
  const { awake, wake, rest, shown } = useWake();
  const used = useUsedBy("work", m.id);
  const t = useSiteTheme();
  const need = WORK_NEED[m.needs] ?? null;
  const open = () => { play("select"); openDetail({ kind: "work", id: m.id }); };
  const inner = Math.max(120, Math.round(width) - 2);
  return (
    <div
      data-shelf-card={`work:${m.id}`}
      data-work-card={m.id}
      data-status="works"
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-panel transition-colors hover:border-fg-faint"
      style={{ width }}
      ref={shown}
      onPointerEnter={wake}
      onPointerLeave={rest}
      onClick={open}
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
          <StatusBadge status="works" />
          {need ? <NeedBadge need={need} /> : null}
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
      {o.kind === "part" ? <PartBody id={o.id} add={add} /> : <WorkBody id={o.id} add={add} />}
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

function PartBody({ id, add }: { id: string; add: (featureId: string) => string }) {
  const feature = getFeature(id);
  const words = useSiteWords();
  const used = useUsedBy("part", feature?.basedOn ? "" : id);
  const pageName = useStudio((s) => s.pages.find((p) => p.id === s.activePageId)?.name ?? "this page");
  if (!feature) return null;
  const sw = switchOf(id);
  const status = sw ? switchStatus(id) : statusOf(feature);
  const needs = needsOf(feature);
  return (
    <Shell
      title={feature.name}
      category={feature.category}
      attr={{ "data-part-detail": id }}
      preview={<Played>{(on) => <ThingPreview feature={feature} width={440} height={280} words={words} playing={on} />}</Played>}
    >
      <Row title="What it does">
        <p className="text-plain text-fg">{feature.explain ?? doesOf(feature)}</p>
      </Row>
      <Row title="On your site">
        <p className="text-small text-fg-muted">
          {sw
            ? "A setting for the whole site: every page gets it, and nothing is placed on a page."
            : `Added at the foot of ${pageName}, ${footprintOf(feature).toLowerCase()}. It usually sits: ${whereOf(feature).toLowerCase()}. Drag its card onto the board to put it anywhere.`}
        </p>
        {feature.category === "motion" ? <SeeMotionTab className="self-start" /> : null}
      </Row>
      <Row title="Works now, or needs building">
        <div className="flex items-start gap-2 text-small text-fg-muted"><StatusBadge status={status} /><span>{STATUS_MEANS[status]}</span></div>
      </Row>
      <NeedsRow needs={needs} />
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {sw ? <div className="min-w-[260px] flex-1"><SwitchRow featureId={id} /></div> : (
          <button
            type="button"
            data-add-to-page={id}
            onClick={() => addAndShow(id, add)}
            className="tactile flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-small font-medium text-accent-fg"
          >
            <Plus className="size-3.5" /> Add to page
          </button>
        )}
        <UsedLine ids={used} />
      </div>
    </Shell>
  );
}

function WorkBody({ id, add }: { id: string; add: (featureId: string) => string }) {
  const work = getWork(id);
  const words = useSiteWords();
  const t = useSiteTheme();
  const used = useUsedBy("work", id);
  const picked = useStudio(useShallow((s) => (s.selection.length === 1 ? s.nodes.find((n) => n.id === s.selection[0]) ?? null : null)));
  if (!work) return null;
  const m = work.manifest;
  const need = WORK_NEED[m.needs] ?? null;
  const onPicked = () => {
    if (!picked) return;
    useStudio.getState().updateNode(picked.id, { work: withWork(picked.work, { id, inputs: {} }) });
    play("confirm");
    openDetail(null);
    jumpTo([picked.id]);
  };
  const onNew = () => {
    const at = add("prose");
    useStudio.getState().updateNode(at, { content: m.look.sample, work: { id, inputs: {} }, w: 240, h: 40 });
    openDetail(null);
    jumpTo([at]);
  };
  return (
    <Shell
      title={m.name}
      category={m.category}
      attr={{ "data-part-detail": `work:${id}` }}
      preview={<Played>{(on) => <WorkPreview work={work} t={t} words={words} width={440} height={280} playing={on} />}</Played>}
    >
      <Row title="What it does">
        <p className="text-plain text-fg">{m.blurb}</p>
        {work.from ? <p className="text-fine text-fg-faint">Taken from {work.from}.</p> : null}
      </Row>
      <Row title="On your site">
        <p className="text-small text-fg-muted">
          It has no look of its own: it goes onto a part and that part keeps its look. {picked ? `The picked part, “${picked.label}”, can take it.` : "Pick a part on the board first to put it there, or add it on a new line of text."}
        </p>
        {m.category === "motion" ? <SeeMotionTab className="self-start" /> : null}
      </Row>
      <Row title="Works now, or needs building">
        <div className="flex items-start gap-2 text-small text-fg-muted"><StatusBadge status="works" /><span>Runs on the published site as it is.</span></div>
      </Row>
      <NeedsRow needs={need ? [need] : []} />
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {picked ? (
          <button type="button" data-work-put={id} onClick={onPicked} className="tactile flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-small font-medium text-accent-fg">
            <Check className="size-3.5" /> Put on “{picked.label}”
          </button>
        ) : null}
        <button
          type="button"
          data-add-to-page={`work:${id}`}
          onClick={onNew}
          className={cn("tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-small font-medium", picked ? "text-fg-muted hover:text-fg" : "bg-accent text-accent-fg")}
          style={picked ? { boxShadow: "inset 0 0 0 1px var(--border)" } : undefined}
        >
          <Plus className="size-3.5" /> Add to page
        </button>
        <UsedLine ids={used} />
      </div>
    </Shell>
  );
}
