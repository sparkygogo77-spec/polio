"use client";
/**
 * The editors that are really words and lists, on a plate.
 *
 * Name, contents, the part's own prompt, its data, its links, its options
 * and its glyph: none of them bends round a curve honestly, so they go on a
 * flat plate — the one rectangle on the wheel. The plate sits in the slab
 * **opposite the green**, and that slab is cut square whatever the wheel's
 * shape is, so the plate always has a square to sit in.
 *
 * What is on the plate is not a form. A setting with a handful of values is
 * a row of small boxes, one of them lit; a set is the same boxes switched on
 * and off; only the things that are genuinely typed — a name, a prompt, an
 * address — are typed into.
 */
import * as React from "react";
import { Info, RotateCcw, Wand2, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { getFeature, MOTION_OPTION_IDS } from "./catalog";
import { isLinkable } from "./parts";
import { useStudio, type StudioNode } from "./store";
import { spun } from "./menuGeometry";
import { Caption, CONSOLE, Glued, PICKED, SCREEN, SectorButton, SHRINK, type Slab } from "./RingConsole";
import { centreOf, wholeOf } from "./RingEditors";

/* ------------------------------------------------------------------ */
/* The pieces                                                          */
/* ------------------------------------------------------------------ */

/**
 * The screen's colours live with the console now (`SCREEN` in
 * `RingConsole.tsx`): the plate is one screen among several, and the
 * animation and font slabs are painted as screens too.
 */
export { SCREEN } from "./RingConsole";
/** The classes a typed field wears on the screen. */
export const SCREEN_FIELD = "border-[oklch(0.36_0.07_195)] bg-[oklch(0.1_0.03_200/0.75)] font-mono text-[oklch(0.88_0.09_175)] placeholder:text-[oklch(0.5_0.05_185)] focus-visible:ring-[oklch(0.6_0.1_185)]";

/** A small box that is one value of one setting. Lit when it is the one. */
export function Tick({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      data-tick=""
      onClick={() => { play(on ? "close" : "select"); onClick(); }}
      className="pointer-events-auto flex h-[20px] min-w-[20px] items-center justify-center whitespace-nowrap rounded-[3px] px-1.5 text-[8.5px] font-semibold leading-none"
      style={{
        // A key on the screen: dark teal glass, phosphor lettering, red when it is the one.
        background: on ? CONSOLE.on : SCREEN.key,
        color: on ? "oklch(0.16 0.04 27)" : SCREEN.ink,
        boxShadow: on ? PICKED : `inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.5)`,
        outline: on ? "none" : `1px solid ${SCREEN.line}`,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </button>
  );
}

/** One setting: its name over its boxes. */
function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="font-mono text-[7.5px] font-semibold uppercase tracking-wider" style={{ color: SCREEN.dim }}>{label}</span> : null}
      {children}
    </div>
  );
}

/** A key on the rail beside the screen: round, small, in the screen's colours. */
export function RailButton({ label, onClick, on, children }: { label: string; onClick: () => void; on?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-rail-button={label}
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={() => { play("tap"); onClick(); }}
      className="pointer-events-auto flex size-[20px] items-center justify-center rounded-full"
      style={{
        background: on ? CONSOLE.on : SCREEN.key,
        color: on ? "oklch(0.16 0.04 27)" : SCREEN.ink,
        outline: on ? "none" : `1px solid ${SCREEN.line}`,
        boxShadow: on ? PICKED : "inset 0 1px 0 oklch(1 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.5)",
      }}
    >
      {children}
    </button>
  );
}

/**
 * The plate: the whole square slab, laid out round the hole.
 *
 * The slab is a square with the hole cut out of its near corner. The screen
 * takes the far corner — from the hole's tangents out to the slab's edges,
 * the biggest square there is — and the two strips the hole leaves are used:
 * the strip **along the top** beside the hole carries the title and the
 * part's name, above the screen rather than on it; the strip **down the near
 * side** under the hole is the rail, for the information key and whatever
 * else an editor puts there.
 *
 * Which corner the hole is in depends on where the slab is pointing once the
 * wheel's turn is added, so the layout mirrors to keep the hole in its
 * corner. Between the four upright positions the box shrinks by the sum of
 * the turn's cosine and sine — what a tilted square's shadow on an axis is —
 * so an upright box stays inside a tilted slab.
 */
export function PlateQuad({
  slab, title, sub, side, lead, children,
}: {
  slab: Slab;
  title?: string;
  /** Under the title: usually the part's name. */
  sub?: string;
  /** What goes on the rail. */
  side?: React.ReactNode;
  /** The first thing on the screen, before the editor's own contents. */
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { spin, from, to } = slab;
  const { hole, reach } = slab.rings;
  const S = reach - SHRINK - 6;
  const a = spin * Math.PI * 2;
  const k = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a));
  // Where the slab points on screen decides which corner of the upright box the hole is in.
  const facing = ((((from + to) / 2 + spin) % 1) + 1) % 1;
  const top = facing >= 0.25 && facing < 0.75;
  const left = facing < 0.5;
  // The box is the slab's own square, worked out for the quadrant that starts straight up and turned to this one.
  const at = spun([S / 2 + 3, -(S / 2 + 3)], from);
  const H = hole + 2;
  const screen: React.CSSProperties = { position: "absolute", [top ? "top" : "bottom"]: H, [left ? "left" : "right"]: H, width: S - H, height: S - H };
  const head: React.CSSProperties = { position: "absolute", [top ? "top" : "bottom"]: 2, [left ? "left" : "right"]: H + 2, width: S - H - 2, height: H - 4 };
  const rail: React.CSSProperties = { position: "absolute", [top ? "top" : "bottom"]: H + 2, [left ? "left" : "right"]: 2, width: H - 4, height: S - H - 2 };
  return (
    <Glued at={at} spin={spin} w={S} h={S} className="relative h-full w-full">
      <div className="absolute inset-0" style={{ transform: `scale(${(1 / k).toFixed(4)})`, transformOrigin: "center" }}>
        <div data-ring-plate-head="" style={head} className={cn("flex flex-col justify-end gap-px pb-1", left ? "items-start" : "items-end")}>
          {title ? (
            <span className="whitespace-nowrap font-mono text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: SCREEN.ink, textShadow: `0 0 6px ${SCREEN.ink}` }}>
              ▮ {title}
            </span>
          ) : null}
          {sub ? (
            <span className="max-w-full truncate font-mono text-[7px] uppercase tracking-wider" style={{ color: CONSOLE.muted }}>
              {sub}
            </span>
          ) : null}
        </div>
        <div data-ring-plate-rail="" style={rail} className={cn("flex flex-col gap-1 pt-0.5", left ? "items-start pl-0.5" : "items-end pr-0.5")}>
          {side}
        </div>
        <div
          data-ring-plate-box=""
          className="pointer-events-auto flex flex-col gap-1.5 overflow-y-auto rounded-[5px] p-1.5"
          style={{
            ...screen,
            backgroundImage: `${SCREEN.scan}, ${SCREEN.dots}, ${SCREEN.glass}`,
            backgroundSize: "auto, 3px 3px, auto",
            color: SCREEN.ink,
            boxShadow: [
              `inset 0 0 0 1px ${SCREEN.line}`,
              "inset 0 2px 9px oklch(0 0 0 / 0.75)",
              "inset 0 0 24px oklch(0.55 0.12 190 / 0.16)",
              `0 0 0 2px ${CONSOLE.rim}`,
              "0 1px 0 3px oklch(0.5 0.08 290 / 0.35)",
            ].join(", "),
            scrollbarWidth: "thin",
          }}
        >
          {lead}
          {children}
        </div>
      </div>
    </Glued>
  );
}

const field = `min-h-0 w-full text-[10px] leading-snug ${SCREEN_FIELD}`;

/* ------------------------------------------------------------------ */
/* The editors                                                         */
/* ------------------------------------------------------------------ */

/**
 * `plate` is the square slab opposite the green; `spare` is the other one or
 * two, for the odd whole-slab button an editor wants beside its plate.
 */
export function PlateEditor({ which, node, plate, spare }: { which: string; node: StudioNode; plate: Slab; spare: Slab[] }) {
  const feature = getFeature(node.featureId);
  const pages = useStudio((s) => s.pages);
  const update = (patch: Partial<StudioNode>) => useStudio.getState().updateNode(node.id, patch);
  const [info, setInfo] = React.useState(false);
  const about = feature?.explain ?? feature?.blurb ?? null;
  // What every plate shares: the part's name over the screen, and the rail
  // down its side — an information key, and whatever else an editor adds.
  const rail = (
    <RailButton label={info ? "Hide what this part is" : "What is this part?"} on={info} onClick={() => setInfo((v) => !v)}>
      <Info className="size-3" />
    </RailButton>
  );
  const common = {
    slab: plate,
    sub: feature?.name ?? node.label,
    side: rail,
    lead: info && about ? <p className="text-[8.5px] leading-snug" style={{ color: SCREEN.dim }}>{about}</p> : null,
  };

  if (which === "name") {
    return (
      <PlateQuad {...common} title="Name">
        <Input value={node.label} aria-label="Name" inputSize="sm" className={field} onChange={(e) => update({ label: e.target.value })} />
      </PlateQuad>
    );
  }

  if (which === "words") {
    return (
      <PlateQuad {...common} title="This part's prompt">
        <Textarea rows={5} value={node.prompt} aria-label="Element prompt" className={`${field} flex-1 resize-none`} placeholder={feature?.hint ?? "Specific to this placement…"} onChange={(e) => update({ prompt: e.target.value })} />
      </PlateQuad>
    );
  }

  if (which === "contents") {
    const beside = spare[1] ?? spare[0];
    return (
      <>
        <PlateQuad {...common} title={feature?.content?.label ?? "Contents"}>
          {feature?.content ? (
            <Textarea rows={5} value={node.content} aria-label={feature.content.label} className={`${field} flex-1 resize-none`} placeholder={feature.content.placeholder} onChange={(e) => update({ content: e.target.value })} />
          ) : (
            <p className="text-[9px]" style={{ color: SCREEN.dim }}>This part has nothing to list inside it.</p>
          )}
        </PlateQuad>
        {/*
          Make it a prompt: the place for turning what is listed here into a
          prompt that reads the rest of the site and fills the contents in to
          match. The slab is cut and wired; what it does is not, yet.
        */}
        {beside ? (
          <>
            <SectorButton d={wholeOf(beside)} at={centreOf(beside, beside.rings.hole, "edge")} spin={beside.spin} shape={beside.shape} label="Make it a prompt" icon={<Wand2 className="size-3.5" />} onClick={() => play("tap")} />
            <Caption slab={beside}>Soon</Caption>
          </>
        ) : null}
      </>
    );
  }

  if (which === "data") {
    return (
      <PlateQuad {...common} title="Data">
        <Textarea rows={5} value={node.data} aria-label="Data" className={`${field} flex-1 resize-none`} placeholder="What it shows or does" onChange={(e) => update({ data: e.target.value })} />
      </PlateQuad>
    );
  }

  if (which === "links") {
    const link = node.link;
    if (!isLinkable(node.featureId)) {
      return (
        <PlateQuad {...common} title="Links">
          <p className="text-[9px]" style={{ color: SCREEN.dim }}>This part does not send anyone anywhere.</p>
        </PlateQuad>
      );
    }
    const current = !link ? "none" : link.kind === "page" ? `page:${link.target}` : "url";
    return (
      <PlateQuad {...common} title="Links to">
        <div className="flex flex-wrap gap-1">
          <Tick on={current === "none"} onClick={() => update({ link: null })}>Nowhere</Tick>
          {pages.map((p) => (
            <Tick key={p.id} on={current === `page:${p.id}`} onClick={() => update({ link: { kind: "page", target: p.id } })}>{p.name}</Tick>
          ))}
          <Tick on={current === "url"} onClick={() => update({ link: { kind: "url", target: link?.kind === "url" ? link.target : "https://" } })}>Web address</Tick>
        </div>
        {link?.kind === "url" ? (
          <Input value={link.target} aria-label="Web address" inputSize="sm" className={field} onChange={(e) => update({ link: { kind: "url", target: e.target.value } })} />
        ) : null}
      </PlateQuad>
    );
  }

  if (which === "options") {
    const opts = (feature?.options ?? []).filter((o) => !MOTION_OPTION_IDS.has(o.id));
    return (
      <PlateQuad
        {...common}
        title="Options"
        side={
          <>
            {rail}
            <RailButton label="Reset the options" onClick={() => update({ options: {} })}><RotateCcw className="size-3" /></RailButton>
          </>
        }
      >
        {opts.length === 0 ? <p className="text-[9px]" style={{ color: SCREEN.dim }}>This part has nothing to set.</p> : null}
        {opts.map((opt) => {
          if (opt.kind === "set") {
            const raw = node.options[opt.id];
            const on = new Set((raw === undefined ? opt.preset ?? "" : raw).split(",").map((s) => s.trim()).filter(Boolean));
            const toggle = (v: string) => {
              const next = new Set(on);
              if (next.has(v)) next.delete(v);
              else next.add(v);
              update({ options: { ...node.options, [opt.id]: opt.values.filter((x) => next.has(x)).join(", ") } });
            };
            return (
              <Row key={opt.id} label={`${opt.label} · ${on.size} on`}>
                <div className="flex flex-wrap gap-1">
                  {opt.values.map((v) => <Tick key={v} on={on.has(v)} onClick={() => toggle(v)}>{v}</Tick>)}
                </div>
              </Row>
            );
          }
          if (opt.kind === "range") {
            const r = opt.range ?? { min: 0, max: 100, step: 1 };
            const fallback = Number.parseFloat(opt.values[0] ?? "0") || 0;
            const at = Number.parseFloat(node.options[opt.id] ?? "");
            const now = Number.isFinite(at) ? Math.max(r.min, Math.min(r.max, at)) : fallback;
            return (
              <Row key={opt.id} label={`${opt.label} · ${now}${r.unit ?? ""}`}>
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step ?? 1}
                  value={now}
                  aria-label={opt.label}
                  onChange={(e) => update({ options: { ...node.options, [opt.id]: e.target.value } })}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  style={{ background: `linear-gradient(to right, ${SCREEN.ink} ${((now - r.min) / Math.max(1e-6, r.max - r.min)) * 100}%, ${SCREEN.key} 0%)` }}
                />
              </Row>
            );
          }
          const value = node.options[opt.id] ?? opt.values[0]!;
          return (
            <Row key={opt.id} label={opt.label}>
              <div className="flex flex-wrap gap-1">
                {opt.values.map((v) => <Tick key={v} on={value === v} onClick={() => update({ options: { ...node.options, [opt.id]: v } })}>{v}</Tick>)}
              </div>
            </Row>
          );
        })}
      </PlateQuad>
    );
  }

  return (
    <PlateQuad {...common} title={which}>
      <p className="text-[9px]" style={{ color: SCREEN.dim }}>Nothing to set here.</p>
    </PlateQuad>
  );
}
