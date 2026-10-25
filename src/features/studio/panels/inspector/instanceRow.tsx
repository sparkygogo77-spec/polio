"use client";
/**
 * THE INSTANCE ROW: the picked part is one of a component's, and says so
 * (proposal (c), approved by J: "The Element panel says 'Button / primary'
 * and offers 'Edit the component' or 'Change just this one' … 'Reset to the
 * component' removes the override").
 *
 *   Button / primary              fill is its own
 *   [Edit the component] [Change just this one] [Reset]
 *
 *   · Edit the component: the System tab's editor, on this variant. A change
 *     there reaches every instance, in one undo step (`system/bind.ts`).
 *   · Change just this one: this part holds its look as its own, so a change
 *     to the component passes it by, and the fields below change only it.
 *     A field changed here by hand is its own already, without the press.
 *   · Reset: it wears its variant again and holds nothing of its own.
 *
 * A layer picked on its own (the words in a button) speaks for its
 * component's host. Nothing shows for a part that is no instance.
 */
import { Blocks, Pencil, RotateCcw } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { useStudio } from "../../board/store";
import { resolvePalette } from "../../shelf/run";
import { holdOwnPart, resetPart, useSiteSystem } from "../../system/api";
import { instanceOf, overridesOf } from "../../system/bind";
import type { LookSlot } from "../../system/model";
import { openComponent } from "../system/open";

const SLOT_WORD: Record<LookSlot, string> = { fill: "fill", words: "words", outline: "outline", shadow: "shadow", radius: "corners", face: "face", size: "text size" };

export function InstanceRow({ nodeId }: { nodeId: string }) {
  const { system } = useSiteSystem();
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  if (!system) return null;
  const palette = resolvePalette(format, look) as Record<string, string>;
  const it = instanceOf(nodes, system, nodeId, palette);
  if (!it) return null;
  const own = overridesOf(nodes, system, nodeId, palette);
  const held = !!nodes.find((n) => n.id === it.host)?.sys?.c?.own?.length;
  const name = `${it.component.name} / ${it.variant.name}`;
  return (
    <div data-instance-row={it.host} data-instance-of={`${it.component.id}/${it.variant.id}`} className="space-y-1 rounded-md border border-border px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <Blocks className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
        <span data-instance-name="" className="min-w-0 flex-1 truncate text-small font-semibold text-fg" title={name}>{name}</span>
        {own.length ? (
          <span data-instance-own={own.join(" ")} className="shrink-0 truncate text-small text-fg-muted" title="Changes to the component pass these by">
            {held ? "its own look" : `${own.map((s) => SLOT_WORD[s]).join(", ")} ${own.length === 1 ? "is" : "are"} its own`}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="xs" variant="outline" data-instance-edit="" title="Change the component: every one of these follows"
          onClick={() => { play("open"); openComponent(it.component.id, it.variant.id); }}>
          <Pencil /> Edit the component
        </Button>
        <Button size="xs" variant="ghost" data-instance-own-look="" aria-pressed={held} disabled={held}
          title={held ? "This one keeps its own look until Reset" : "This one keeps its own look: changes to the component pass it by"}
          onClick={() => { const r = holdOwnPart(it.host); play("ok" in r && r.ok === false ? "deny" : "confirm"); }}>
          Change just this one
        </Button>
        <Button size="xs" variant="ghost" data-instance-reset="" disabled={!own.length}
          title={own.length ? "Wear the component's look again" : "It already wears the component's look"}
          onClick={() => { const r = resetPart(it.host); play("ok" in r && r.ok === false ? "deny" : "confirm"); }}>
          <RotateCcw /> Reset
        </Button>
      </div>
    </div>
  );
}
