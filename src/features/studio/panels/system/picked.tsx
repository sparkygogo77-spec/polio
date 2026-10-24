"use client";
/**
 * THE PICKED PART: which of its fields point at which token, and "Change
 * just this one" for each.
 *
 * The proposal puts that choice on the part ("Button / primary … Change just
 * this one"). The Element panel is another lane's, so it is here, under the
 * System, for the one part picked on the board. Pressing it lets the field
 * go of its token (`unlinkPart`): the part keeps the value it shows, as its
 * own, and the next token change passes it by. Nothing moves.
 */
import * as React from "react";
import { Unlink } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { useStudio } from "../../board/store";
import { unlinkPart } from "../../system/api";
import { tokenById, type FieldPath, type System } from "../../system/model";

/** A field in a person's words. */
export function fieldWord(f: string): string {
  const FIXED: Record<string, string> = {
    "colour.bg": "Fill", "colour.surface": "Surface", "colour.text": "Words", "colour.muted": "Quiet words", "colour.accent": "Accent", "colour.highlight": "Highlight",
    "edge.colour": "Outline", "edge.shadow": "Shadow", radius: "Corners", "pad.top": "Padding top", "pad.right": "Padding right", "pad.bottom": "Padding bottom",
    "pad.left": "Padding left", "layout.gap": "Gap", "font.px": "Text size", "font.stack": "Face",
  };
  const m = /^motion\.transition\.(\d+)\.(duration|timing)$/.exec(f);
  if (m) return `Motion ${Number(m[1]) + 1} ${m[2] === "duration" ? "duration" : "easing"}`;
  return FIXED[f] ?? f;
}

export function PickedPart({ system }: { system: System }) {
  const id = useStudio((s) => (s.selection.length === 1 ? s.selection[0]! : null));
  const node = useStudio((s) => (id ? s.nodes.find((n) => n.id === id) ?? null : null));
  if (!node) return null;
  const links = Object.entries(node.sys?.s === system.id ? node.sys?.f ?? {} : {}) as [FieldPath, string][];
  const c = node.sys?.s === system.id ? node.sys?.c : null;
  const comp = c ? system.components.find((x) => x.id === c.component) : null;
  const variant = comp?.variants.find((v) => v.id === c?.variant);
  if (!links.length && !comp) return <p data-picked-part="" className="text-small text-fg-faint">The picked part points at no token.</p>;
  return (
    <div data-picked-part={node.id} className="space-y-0.5">
      {comp ? <p data-picked-instance="" className="text-small text-fg">{comp.name}{variant ? ` / ${variant.name}` : ""}</p> : null}
      {links.map(([field, tid]) => {
        const t = tokenById(system, tid);
        return (
          <div key={field} data-picked-field={field} className="flex items-center gap-1.5">
            <span className="w-24 shrink-0 truncate text-small text-fg-muted">{fieldWord(field)}</span>
            <span className="min-w-0 flex-1 truncate text-small text-fg">{t?.name ?? "a token no longer here"}</span>
            <Button size="xs" variant="ghost" data-just-this-one={field} title="This part keeps the value it shows, as its own"
              onClick={() => { const r = unlinkPart(node.id, field); play("ok" in r && r.ok === false ? "deny" : "confirm"); }}>
              <Unlink /> Change just this one
            </Button>
          </div>
        );
      })}
    </div>
  );
}
