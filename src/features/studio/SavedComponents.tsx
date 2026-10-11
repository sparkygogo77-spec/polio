"use client";
/**
 * SAVED COMPONENTS on the shelf: each in the category it was saved to
 * ("Media › TV screen"), placed on any board whole, with every part, its
 * effects and their settings, the keyframes its motion names and the fonts
 * its words are set in (`library/components.ts`).
 */
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { uid } from "@/core/lib/ids";
import { useStudio, type StudioNode } from "./board/store";
import { placeComponent, shelfCategoryOf, type SavedComponent } from "./shelf";
import { useLearned } from "./shelf/ui";
import { jumpTo } from "./ShelfCards";
import { Button } from "@/core/ui/button";
import { play } from "@/core/audio/engine";

/** Put a saved component on the open board: below what is there, at the left, unless a place is given. Returns its parts' new ids. */
export function putComponent(c: SavedComponent, at?: { x: number; y: number }): string[] {
  const s = useStudio.getState();
  const pageId = s.activePageId;
  const here = s.nodes.filter((n) => n.pageId === pageId);
  const where = at ?? { x: 40, y: here.reduce((m, n) => Math.max(m, n.y + n.h), 0) + 40 };
  const parts = placeComponent(c, where, pageId, () => uid("n")) as unknown as StudioNode[];
  s.commit();
  const look = s.look as { keyframes?: { name: string }[]; fonts?: { family: string }[] };
  const hadK = new Set((look.keyframes ?? []).map((k) => k.name));
  const hadF = new Set((look.fonts ?? []).map((f) => f.family));
  const keyframes = [...(look.keyframes ?? []), ...c.frames.filter((k) => !hadK.has(k.name))];
  const fonts = [...(look.fonts ?? []), ...c.fonts.filter((f) => !hadF.has(f.family))];
  useStudio.setState((st) => ({
    nodes: [...st.nodes, ...parts],
    selection: [parts[0]!.id],
    look: { ...st.look, ...(c.frames.length ? { keyframes } : {}), ...(c.fonts.length ? { fonts } : {}) } as typeof st.look,
  }));
  play("confirm");
  return parts.map((p) => p.id);
}

/** The components saved to this shelf category, as a band of cards. */
export function SavedComponentsBand({ category, hue }: { category: string; hue: number }) {
  const all = useLearned((s) => s.lib.components);
  const list = React.useMemo(() => (all ?? []).filter((c) => shelfCategoryOf(c.category) === category).sort((a, b) => b.at - a.at), [all, category]);
  if (!list.length) return null;
  return (
    <section data-saved-components={category} className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-small font-medium" style={{ color: `oklch(0.86 0.1 ${hue})` }}>Saved components</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => (
          <div key={c.id} data-saved-component={c.id} className="flex w-[200px] flex-col gap-1 rounded-md border border-border bg-surface p-2">
            <span className="truncate text-small font-medium text-fg">{c.name}</span>
            <span className="truncate text-fine text-fg-faint">{c.kind} · {c.nodes.length} {c.nodes.length === 1 ? "part" : "parts"}{c.site ? ` · from ${c.site}` : ""}</span>
            <div className="flex items-center gap-1">
              <Button size="xs" variant="outline" data-saved-component-add={c.id} onClick={() => jumpTo(putComponent(c).slice(0, 1))}>
                <Plus className="mr-1 size-3" />Add
              </Button>
              <Button size="xs" variant="ghost" aria-label={`Take ${c.name} off the shelf`} onClick={() => useLearned.getState().removeComponent(c.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
