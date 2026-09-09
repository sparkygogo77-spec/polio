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
import { Wand2, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { getFeature } from "./catalog";
import { isLinkable } from "./parts";
import { useStudio, type StudioNode } from "./store";
import { onCircle } from "./menuGeometry";
import { Caption, CONSOLE, CONSOLE_HUE, Glued, litEdge, PICKED, SectorButton, SHRINK, type Slab } from "./RingConsole";
import { centreOf, wholeOf } from "./RingEditors";
import { GLYPHS } from "./Inspector";

/* ------------------------------------------------------------------ */
/* The pieces                                                          */
/* ------------------------------------------------------------------ */

/** A small box that is one value of one setting. Lit when it is the one. */
export function Tick({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      data-tick=""
      onClick={() => { play(on ? "close" : "select"); onClick(); }}
      className="pointer-events-auto flex h-[20px] min-w-[20px] items-center justify-center whitespace-nowrap rounded-[4px] px-1.5 text-[8.5px] font-semibold leading-none"
      style={{
        background: on ? CONSOLE.on : "oklch(0.26 0.008 260)",
        color: on ? "oklch(0.16 0.04 27)" : CONSOLE.text,
        boxShadow: on ? PICKED : `${litEdge(CONSOLE_HUE)}, 0 1px 2px oklch(0 0 0 / 0.4)`,
        outline: on ? "none" : `1px solid ${CONSOLE.ink}`,
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
      {label ? <span className="text-[7.5px] font-semibold uppercase tracking-wider" style={{ color: CONSOLE.muted }}>{label}</span> : null}
      {children}
    </div>
  );
}

/**
 * The plate: a square inscribed in the square slab.
 *
 * Its near corner clears the hole and its far corner clears the slab's edge,
 * which at rest is a square a hundred pixels on a side. Turned, an upright
 * square has to be smaller to stay inside a tilted one — by the sum of the
 * turn's cosine and sine, which is what a tilted square's shadow on an axis
 * is — so it shrinks as the wheel turns and grows back as it comes round.
 */
export function PlateQuad({ slab, title, children }: { slab: Slab; title?: string; children: React.ReactNode }) {
  const { spin } = slab;
  const { hole, reach } = slab.rings;
  const near = hole - 6;
  const size0 = reach - SHRINK - 5 - near;
  const a = spin * Math.PI * 2;
  const k = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a));
  const size = Math.round(size0 / k);
  const at = onCircle((slab.from + slab.to) / 2, (near + size0 / 2) * Math.SQRT2);
  return (
    <Glued at={at} spin={spin} w={size} h={size} className="flex h-full w-full">
      <div
        data-ring-plate-box=""
        className="pointer-events-auto flex h-full w-full flex-col gap-1.5 overflow-y-auto rounded-md p-1.5"
        style={{ background: CONSOLE.well, boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.12), inset 0 -1px 0 oklch(0 0 0 / 0.3)", scrollbarWidth: "thin" }}
      >
        {title ? <span className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: CONSOLE.text }}>{title}</span> : null}
        {children}
      </div>
    </Glued>
  );
}

const field = "min-h-0 w-full text-[10px] leading-snug";

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

  if (which === "name") {
    return (
      <PlateQuad slab={plate} title="Name">
        <Input value={node.label} aria-label="Name" inputSize="sm" className={field} onChange={(e) => update({ label: e.target.value })} />
      </PlateQuad>
    );
  }

  if (which === "words") {
    return (
      <PlateQuad slab={plate} title="This part's prompt">
        <Textarea rows={5} value={node.prompt} aria-label="Element prompt" className={`${field} flex-1 resize-none`} placeholder={feature?.hint ?? "Specific to this placement…"} onChange={(e) => update({ prompt: e.target.value })} />
      </PlateQuad>
    );
  }

  if (which === "contents") {
    const beside = spare[1] ?? spare[0];
    return (
      <>
        <PlateQuad slab={plate} title={feature?.content?.label ?? "Contents"}>
          {feature?.content ? (
            <Textarea rows={5} value={node.content} aria-label={feature.content.label} className={`${field} flex-1 resize-none`} placeholder={feature.content.placeholder} onChange={(e) => update({ content: e.target.value })} />
          ) : (
            <p className="text-[9px]" style={{ color: CONSOLE.muted }}>This part has nothing to list inside it.</p>
          )}
        </PlateQuad>
        {/*
          Make it a prompt: the place for turning what is listed here into a
          prompt that reads the rest of the site and fills the contents in to
          match. The slab is cut and wired; what it does is not, yet.
        */}
        {beside ? (
          <>
            <SectorButton d={wholeOf(beside)} at={centreOf(beside, beside.rings.hole, "edge")} spin={beside.spin} label="Make it a prompt" icon={<Wand2 className="size-3.5" />} onClick={() => play("tap")} />
            <Caption slab={beside}>Soon</Caption>
          </>
        ) : null}
      </>
    );
  }

  if (which === "data") {
    return (
      <PlateQuad slab={plate} title="Data">
        <Textarea rows={5} value={node.data} aria-label="Data" className={`${field} flex-1 resize-none`} placeholder="What it shows or does" onChange={(e) => update({ data: e.target.value })} />
      </PlateQuad>
    );
  }

  if (which === "links") {
    const link = node.link;
    if (!isLinkable(node.featureId)) {
      return (
        <PlateQuad slab={plate} title="Links">
          <p className="text-[9px]" style={{ color: CONSOLE.muted }}>This part does not send anyone anywhere.</p>
        </PlateQuad>
      );
    }
    const current = !link ? "none" : link.kind === "page" ? `page:${link.target}` : "url";
    return (
      <PlateQuad slab={plate} title="Links to">
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
    const opts = feature?.options ?? [];
    return (
      <PlateQuad slab={plate} title="Options">
        {opts.length === 0 ? <p className="text-[9px]" style={{ color: CONSOLE.muted }}>This part has nothing to set.</p> : null}
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

  if (which === "glyph") {
    return (
      <PlateQuad slab={plate} title="Glyph on the board">
        <div className="flex flex-wrap gap-1">
          <Tick on={node.glyph === null} onClick={() => update({ glyph: null })} title="No glyph"><X className="size-3" /></Tick>
          {GLYPHS.map((g) => <Tick key={g} on={node.glyph === g} onClick={() => update({ glyph: g })} title={`Glyph ${g}`}>{g}</Tick>)}
        </div>
      </PlateQuad>
    );
  }

  return (
    <PlateQuad slab={plate} title={which}>
      <p className="text-[9px]" style={{ color: CONSOLE.muted }}>Nothing to set here.</p>
    </PlateQuad>
  );
}
