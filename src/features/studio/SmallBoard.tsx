"use client";
/**
 * THE BOARD ON A TABLET AND ON A PHONE.
 *
 * Tablet and Phone used to narrow the frame the desktop's boxes stand in, so
 * a phone showed the left 390px of the desktop and cut the rest off. Now the
 * board shows the page as a tablet or a phone is served it: the plan
 * (`live/small.ts`) drawn by the renderer the published page uses
 * (`live/smallCss.ts`, through `LiveSite`).
 *
 * A press on a part picks it, and the bar above the page says what it does
 * at this width: shown or hidden, as wide as the page, moved earlier or
 * later, smaller or bigger, or back to what was worked out. A rule set here
 * is this width's alone: the desktop and the other width keep theirs. What
 * is hidden here is listed under the bar, so it can be brought back.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { ArrowDown, ArrowUp, Eye, EyeOff, Minus, MoveHorizontal, Plus, RotateCcw } from "lucide-react";
import { useStudio, activePage, type StudioNode } from "./board/store";
import { LiveSite } from "./live/LiveSite";
import { SMALL_WIDTH, type SmallDevice } from "./live/small";
import { planFor } from "./live/smallRules";
import { resolvePart } from "./parts";
import { partName } from "./partNames";
import { getFeature } from "./catalog";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";

const featureName = (id: string) => getFeature(id)?.name;

export function SmallBoard({ device }: { device: SmallDevice }) {
  const page = useStudio(activePage);
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const shapes = useStudio((s) => s.shapes);
  const frameWidth = useStudio((s) => s.frameWidth);
  const selection = useStudio(useShallow((s) => s.selection));
  const width = SMALL_WIDTH[device];
  const onPage = React.useMemo(() => nodes.filter((n) => n.pageId === page.id), [nodes, page.id]);
  const plan = React.useMemo(() => planFor(onPage.filter((n) => resolvePart(n.featureId)?.tier !== "B"), device, frameWidth), [onPage, device, frameWidth]);
  const picked = selection.length === 1 ? onPage.find((n) => n.id === selection[0]) ?? null : null;
  const where = device === "phone" ? "phone" : "tablet";

  /* As wide as the device, zoomed down only when the board has less room than that. */
  const ref = React.useRef<HTMLDivElement>(null);
  const [room, setRoom] = React.useState(width + 48);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(el.clientWidth));
    ro.observe(el);
    setRoom(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const zoom = Math.min(1, Math.max(0.3, (room - 48) / width));

  /* A press picks the part it lands on; nothing on the page is pressed for real here. */
  const pick = (e: React.MouseEvent) => {
    /* The Menu's key opens the Menu here too, so its links can be pressed and set. */
    if ((e.target as HTMLElement).closest?.(".sm-menu-button")) return;
    const el = (e.target as HTMLElement).closest?.("[data-live-node]") as HTMLElement | null;
    e.preventDefault();
    e.stopPropagation();
    const s = useStudio.getState();
    if (!el?.dataset.liveNode) { s.clearSelection(); return; }
    play("select");
    s.setSelection([el.dataset.liveNode]);
  };

  const rule = picked?.small?.[device] ?? {};
  const set = (patch: Parameters<ReturnType<typeof useStudio.getState>["setSmallRule"]>[2]) => {
    if (!picked) return;
    play("tap");
    useStudio.getState().setSmallRule(picked.id, device, patch);
  };
  const hiddenNodes = plan.hidden.map((id) => onPage.find((n) => n.id === id)).filter((n): n is StudioNode => !!n);
  const [listOpen, setListOpen] = React.useState(false);

  return (
    <div ref={ref} data-small-board={device} className="relative flex w-full flex-col items-center gap-3 px-6 pb-12 pt-4">
      {/* The bar: what the picked part does at this width. */}
      <div data-small-bar="" className="sticky top-2 z-20 flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-panel/95 px-2 py-1.5 text-small shadow-panel backdrop-blur">
        <span className="px-1 font-medium text-fg">On {where}</span>
        {picked ? (
          <>
            <span data-small-bar-name="" className="max-w-[200px] truncate px-1 text-fg-muted">{partName(picked, onPage, featureName)}</span>
            <BarKey label={rule.show === "hide" ? `Show on ${where}` : `Hide on ${where}`} on={rule.show === "hide"} onClick={() => set({ show: rule.show === "hide" ? undefined : "hide" })}>{rule.show === "hide" ? <EyeOff /> : <Eye />}</BarKey>
            <BarKey label="As wide as the page" on={!!rule.full} onClick={() => set({ full: rule.full ? undefined : true })}><MoveHorizontal /></BarKey>
            <BarKey label="Move up" onClick={() => set({ order: (rule.order ?? 0) - 1 })}><ArrowUp /></BarKey>
            <BarKey label="Move down" onClick={() => set({ order: (rule.order ?? 0) + 1 })}><ArrowDown /></BarKey>
            <BarKey label="Smaller" onClick={() => set({ size: Math.max(0.5, Math.round(((rule.size ?? 1) - 0.1) * 10) / 10) })}><Minus /></BarKey>
            <span data-small-size="" className="num w-9 text-center text-fg-muted">{Math.round((rule.size ?? 1) * 100)}%</span>
            <BarKey label="Bigger" onClick={() => set({ size: Math.min(1.5, Math.round(((rule.size ?? 1) + 0.1) * 10) / 10) })}><Plus /></BarKey>
            <BarKey label={`Back to the worked-out ${where} layout`} onClick={() => set(null)}><RotateCcw /></BarKey>
          </>
        ) : (
          <span className="px-1 text-fg-muted">press a part to change it here; the desktop is not changed</span>
        )}
        {hiddenNodes.length ? (
          <button type="button" data-small-hidden-toggle="" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} className="tactile ml-1 rounded-md border border-border px-2 py-0.5 text-fg-muted hover:text-fg">
            {hiddenNodes.length} hidden here
          </button>
        ) : null}
      </div>
      {listOpen && hiddenNodes.length ? (
        <div data-small-hidden-list="" className="z-20 flex max-h-48 w-[min(100%,420px)] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-panel p-2 text-small">
          {hiddenNodes.map((n) => (
            <div key={n.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-fg">{partName(n, onPage, featureName)}</span>
              <button type="button" className="tactile rounded-md border border-border px-2 py-0.5 text-fg-muted hover:text-fg" onClick={() => { play("tap"); useStudio.getState().setSmallRule(n.id, device, { show: "show" }); useStudio.getState().setSelection([n.id]); }}>
                Show on {where}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {/* The page, as the device is served it. */}
      <div data-small-frame={device} className="relative rounded-[3px] shadow-[0_20px_60px_oklch(0_0_0/0.45)]" style={{ width, zoom }} onClickCapture={pick}>
        <style>{picked ? `[data-small-frame] [data-live-node="${CSS.escape(picked.id)}"]{outline:2px solid var(--accent);outline-offset:1px}` : ""}</style>
        <LiveSite pages={pages} nodes={nodes} pageId={page.id} device={device} frameWidth={frameWidth} format={format} look={look} siteName={siteName} shapes={shapes} />
      </div>
    </div>
  );
}

function BarKey({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={cn("tactile inline-flex size-7 items-center justify-center rounded-md [&_svg]:size-3.5", on ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover hover:text-fg")}
    >
      {children}
    </button>
  );
}
