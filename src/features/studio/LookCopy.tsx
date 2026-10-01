"use client";
/**
 * Copy look / Paste look, in the part panel's Look section and for several
 * picked parts at once. The same hand as the wheel's tray (`partLookApply.ts`):
 * copy here, paste there, or the other way round.
 *
 * What is pasted is chosen with a key for each facet the copied look has
 * (Fill, Outline, Shadow, Light, Corners, Font, Hover and press, Motion), all
 * on until switched off; the choice is remembered. One paste is one undo
 * step, on one part or every picked one.
 */
import * as React from "react";
import { ClipboardPaste, Pipette } from "lucide-react";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useStudio, type StudioNode } from "./store";
import { FACET_WORDS, lookDiffers, lookHas, lookOf } from "./partLook";
import { pasteLook, useLookClip } from "./partLookApply";

export function LookCopy({ node, targets }: { node: StudioNode | null; targets: string[] }) {
  const look = useLookClip((s) => s.look);
  const chosen = useLookClip((s) => s.chosen);
  const nodes = useStudio((s) => s.nodes);
  const [said, setSaid] = React.useState<string | null>(null);
  React.useEffect(() => setSaid(null), [targets.join(",")]);

  const has = look ? lookHas(look) : [];
  const on = has.filter((f) => chosen.includes(f));
  const reach = look ? targets.filter((id) => id !== look.from.id).filter((id) => { const n = nodes.find((x) => x.id === id); return !!n && lookDiffers(n as never, look, on).length > 0; }) : [];
  const own = !!look && !!node && look.from.id === node.id && targets.length === 1;

  return (
    <div data-look-copy="" className="space-y-1.5">
      <div className="flex gap-1.5">
        {node ? (
          <Button size="sm" variant="outline" className="flex-1" data-look-copy-button=""
            onClick={() => { useLookClip.getState().copy(lookOf(node as never)); setSaid(null); play("copy"); }}>
            <Pipette /> Copy look
          </Button>
        ) : null}
        <Button size="sm" variant={look ? "primary" : "outline"} className="flex-1" data-look-paste-button="" disabled={!look || !reach.length}
          onClick={() => {
            if (!look) return;
            const n = pasteLook(reach, look, on);
            play(n ? "confirm" : "deny");
            setSaid(n ? `Restyled ${n} part${n === 1 ? "" : "s"}, in one step.` : "Nothing to change.");
          }}>
          <ClipboardPaste /> Paste look{reach.length > 1 ? ` on ${reach.length}` : ""}
        </Button>
      </div>
      {look ? (
        <div className="space-y-1">
          <div className="truncate text-small text-fg-muted" data-look-from="">
            {own ? "This part's look is held." : `Copied from “${look.from.name}”.`}{!own && look && !reach.length && on.length ? " These already wear it." : ""}
          </div>
          {has.length ? (
            <div className="flex flex-wrap gap-1" role="group" aria-label="What to paste">
              {has.map((f) => {
                const pressed = chosen.includes(f);
                return (
                  <button key={f} type="button" data-look-facet={f} aria-pressed={pressed}
                    onClick={() => { useLookClip.getState().toggle(f); play("tick"); }}
                    className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", pressed ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted line-through")}>
                    {FACET_WORDS[f]}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-small text-fg-muted">That part wears nothing of its own to paste.</div>
          )}
        </div>
      ) : null}
      {said ? (
        <div className="flex items-center gap-2 text-small text-fg-muted" data-look-said="">
          <span>{said}</span>
          {said.startsWith("Restyled") ? (
            <button type="button" className="tactile underline" onClick={() => { useStudio.getState().undo(); setSaid(null); play("close"); }}>Undo</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
