"use client";
/**
 * HOVER, in a part's side panel (J, 2026-10-23): the look a captured or set
 * hover gives the part, edited in place. Its fill and its words' colour, each
 * a swatch, and how far it lifts, a slider. Each change is one step of undo
 * (`HandColour`, `HandRange`) and is drawn by the part's own hover rule, the
 * same stylesheet on the board and the published page (`hoverLook.ts`).
 */
import * as React from "react";
import { useStudio, type StudioNode } from "../../board/store";
import { HandColour, HandRange } from "../../HandSlider";
import { hoverFill, hoverLift, hoverWords, pickerHex, readColour, withHoverFill, withHoverLift, withHoverWords } from "../../hoverLook";

function Swatch({ label, value, onPick, tag }: { label: string; value: string | null; onPick: (hex: string) => void; tag: string }) {
  const c = readColour(value);
  return (
    <div className="flex items-center justify-between gap-2" data-hover-row={tag}>
      <span className="text-plain text-fg">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="num text-fine text-fg-faint">{c ? (c.a < 0.999 ? `${pickerHex(c)} · ${Math.round(c.a * 100)}%` : pickerHex(c)) : "none"}</span>
        <HandColour aria-label={`${label} under the pointer`} data-hover-colour={tag} className="tactile h-6 w-8 cursor-pointer rounded-sm border border-border bg-transparent p-0" value={pickerHex(c)} onPick={onPick} />
      </span>
    </div>
  );
}

export function HoverField({ node }: { node: StudioNode }) {
  const m = node.motion;
  const set = (motion: StudioNode["motion"]) => useStudio.getState().updateNode(node.id, { motion });
  const lift = hoverLift(m);
  const words = hoverWords(m);
  return (
    <div className="space-y-2" data-hover-field="">
      <p className="text-small leading-snug text-fg-muted">How it looks under the pointer, on the board and the published page.</p>
      <Swatch label="Fill" tag="fill" value={hoverFill(m)} onPick={(hex) => set(withHoverFill(useStudio.getState().nodes.find((n) => n.id === node.id)?.motion ?? m, hex))} />
      {words ? <Swatch label="Words" tag="words" value={words} onPick={(hex) => set(withHoverWords(useStudio.getState().nodes.find((n) => n.id === node.id)?.motion ?? m, hex))} /> : null}
      <div className="space-y-1" data-hover-row="lift">
        <div className="flex items-center justify-between">
          <span className="text-plain text-fg">Lift</span>
          <span className="num text-fine text-fg-faint" data-hover-lift-says="">{lift ? `${Math.abs(Math.round(lift * 10) / 10)} px ${lift > 0 ? "up" : "down"}` : "none"}</span>
        </div>
        <HandRange aria-label="Lift under the pointer" data-hover-lift="" min={0} max={16} step={1} value={Math.max(0, Math.round(lift))} className="w-full"
          onChange={(v) => set(withHoverLift(useStudio.getState().nodes.find((n) => n.id === node.id)?.motion ?? m, v))} />
      </div>
    </div>
  );
}
