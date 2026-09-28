"use client";
/**
 * The features a part carries, in the Element panel: each one's name, a
 * switch, its inputs (the fine ones under More), and a way to take it off.
 * The switch keeps a feature and its settings and stops it running: the
 * features an import attached from what the captured page's script did
 * (`library/captured.ts`) are switched off here, one by one. The wheel's
 * Say plate (`SayBox.tsx`) edits the same thing; this is the panel's
 * convenience copy of it, and like it, shows nothing on a part with no
 * feature.
 */
import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Segmented } from "@/core/ui/segmented";
import { Switch } from "@/core/ui/switch";
import { Tooltip } from "@/core/ui/tooltip";
import { useStudio, type StudioNode } from "./store";
import { getWork, inputsOf, usesOf, withInput, withoutWork, withSwitch, type WorkInput } from "./library/works";

export function WorkFields({ node }: { node: StudioNode }) {
  const uses = usesOf(node.work).filter((u) => getWork(u.id));
  if (!uses.length) return null;
  const update = (work: StudioNode["work"]) => useStudio.getState().updateNode(node.id, { work });
  return (
    <div data-work-fields={node.id} className="space-y-2">
      <span className="block text-small font-medium uppercase tracking-wider text-fg-faint">Working</span>
      {uses.map((use) => {
        const m = getWork(use.id)!.manifest;
        const v = inputsOf(m, use.inputs);
        const field = (i: WorkInput) => (
          <label key={i.id} className="flex flex-col gap-0.5">
            <span className="text-fine text-fg-faint">{i.label}</span>
            {i.kind === "one" ? (
              <Segmented
                size="xs"
                aria-label={i.label}
                value={v[i.id] ?? ""}
                onChange={(x) => update(withInput(node.work, use.id, i.id, x))}
                options={(i.values ?? []).map((x) => ({ value: x, label: x }))}
              />
            ) : (
              <Input
                inputSize="sm"
                type={i.kind === "number" ? "number" : "text"}
                aria-label={i.label}
                value={v[i.id] ?? ""}
                placeholder={i.placeholder ?? i.label}
                onChange={(e) => update(withInput(node.work, use.id, i.id, e.target.value))}
              />
            )}
          </label>
        );
        const more = m.inputs.filter((i) => i.advanced);
        return (
          <div key={use.id} data-work-field={use.id} data-work-on={use.off ? "off" : "on"} className="space-y-1.5 rounded-md border border-border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-small font-medium ${use.off ? "text-fg-faint" : "text-fg"}`}>⚡ {m.name}</span>
              <span className="flex shrink-0 items-center gap-1">
                <Tooltip content={use.off ? `Switch ${m.name} on` : `Switch ${m.name} off (kept, with its settings)`}>
                  <Switch size="sm" data-work-switch={use.id} aria-label={`${m.name} on`} checked={!use.off} onCheckedChange={(on) => update(withSwitch(node.work, use.id, on))} />
                </Tooltip>
                <Tooltip content={`Take ${m.name} off this part`}>
                  <Button variant="ghost" size="iconXs" aria-label={`Take ${m.name} off`} onClick={() => update(withoutWork(node.work, use.id))}>
                    <X />
                  </Button>
                </Tooltip>
              </span>
            </div>
            {m.inputs.filter((i) => !i.advanced).map(field)}
            {more.length ? (
              <details data-work-more={use.id}>
                <summary className="cursor-pointer text-fine text-fg-faint">More</summary>
                <div className="mt-1.5 space-y-1.5">{more.map(field)}</div>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
