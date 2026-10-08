"use client";
/**
 * Make all like this: every part of the picked part's kind on the site (its
 * buttons, cards, panels, badges, headings; `partKind.ts`) restyled to its
 * look, in one undo step.
 *
 * Before anything changes it says how many parts it would reach, and
 * pointing at the button outlines them on the board (`pointAt`). The facets
 * it carries are chosen with a key each (every facet but motion to start);
 * Keep each part's own colour carries the rest of the look and leaves each
 * part its own fill, outline colour and glow colour.
 */
import * as React from "react";
import { Copy as CopyIcon } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Switch } from "@/core/ui/switch";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useHeldStudio, useStudio, useSteady, type StudioNode } from "./board/store";
import { FACET_WORDS, lookHas, lookOf, lookPatch } from "./look/parts";
import { tryProps } from "./tryLook";
import { kindKey, kindWord, kindWords } from "./partKind";
import { makeAllLike, makeAllReach, useMakeAll } from "./look/ui";
import { pointAt } from "./SiteColours";

export function MakeAllLike({ node }: { node: StudioNode }) {
  const nodes = useSteady(useHeldStudio((s) => s.nodes));
  const chosen = useMakeAll((s) => s.chosen);
  const keepColour = useMakeAll((s) => s.keepColour);
  const [said, setSaid] = React.useState<string | null>(null);
  React.useEffect(() => setSaid(null), [node.id]);
  React.useEffect(() => () => pointAt(null), []);

  const key = kindKey(node as never);
  const words = kindWords(key);
  const has = React.useMemo(() => lookHas(lookOf(node as never)), [node]);
  const on = has.filter((f) => chosen.includes(f));
  const reach = React.useMemo(() => makeAllReach(node, on, { keepColour }, nodes), [node, nodes, on.join(","), keepColour]);

  return (
    <div data-make-all="" data-make-all-kind={key} className="space-y-1.5">
      {has.length ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="What to carry">
          {has.map((f) => {
            const pressed = chosen.includes(f);
            return (
              <button key={f} type="button" data-make-all-facet={f} aria-pressed={pressed}
                onClick={() => { useMakeAll.getState().toggle(f); play("tick"); }}
                className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", pressed ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted line-through")}>
                {FACET_WORDS[f]}
              </button>
            );
          })}
        </div>
      ) : null}
      <label className="flex items-center justify-between gap-2 text-small text-fg-muted">
        <span>Keep each part&apos;s own colour</span>
        <Switch size="sm" aria-label="Keep each part's own colour" data-make-all-keep-colour="" checked={keepColour}
          onCheckedChange={(v) => { useMakeAll.getState().setKeepColour(v); play(v ? "toggleOn" : "toggleOff"); }} />
      </label>
      <Button size="sm" variant="outline" className="w-full" data-make-all-button="" data-make-all-count={reach.length} disabled={!reach.length || !on.length}
        {...(() => {
          /* Pointed at, every part it reaches is outlined and wears the look on the board (tryLook.ts); the click restyles them. */
          const t = tryProps(() => {
            const look = lookOf(node as never);
            return { patches: Object.fromEntries(reach.map((id) => { const n = nodes.find((x) => x.id === id)!; return [id, lookPatch(n as never, look, on, { keepColour })]; })), what: `${words} like this` };
          }, () => {
            pointAt(null);
            const n = makeAllLike(node, on, { keepColour });
            play(n ? "confirm" : "deny");
            setSaid(n ? `Restyled ${n} ${kindWord(key, n)}, in one step.` : "Nothing to change.");
          });
          return { ...t, onPointerEnter: () => { pointAt(reach); t.onPointerEnter(); }, onPointerLeave: () => { pointAt(null); t.onPointerLeave(); }, onFocus: () => { pointAt(reach); t.onFocus(); }, onBlur: () => { pointAt(null); t.onBlur(); } };
        })()}>
        <CopyIcon /> {reach.length ? `Make ${reach.length} ${kindWord(key, reach.length)} like this` : `Every one of the ${words} looks like this`}
      </Button>
      {said ? (
        <div className="flex items-center gap-2 text-small text-fg-muted" data-make-all-said="">
          <span>{said}</span>
          {said.startsWith("Restyled") ? (
            <button type="button" className="tactile underline" onClick={() => { useStudio.getState().undo(); setSaid(null); play("close"); }}>Undo</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
