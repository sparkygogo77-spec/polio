"use client";

/**
 * Saved palettes: the site's six colours kept under a name and put back with
 * one press.
 *
 * HIS WORDS: "i also should be able to save color palletes". Saving takes
 * the six roles as they stand now, resolved, so a palette saved off a theme
 * that derived its colours comes back the same even after the theme moves.
 * Putting one back is the same write the colour picker makes (`setLook`),
 * so it is one undo, and on a site brought in the parts tied to a role
 * repaint with it exactly as they do when a role is picked by hand.
 *
 * Kept with the site (`Look.palettes`), so it travels with the document.
 */
import * as React from "react";
import { Check, Trash2 } from "lucide-react";
import { ROLES, ROLE_LABEL, type Palette, type SavedPalette } from "./";
import { useStudio } from "../board/store";
import { resolvePalette } from "../shelf/run";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { cn } from "@/core/lib/cn";

const same = (a: Palette, b: Partial<Palette>) => ROLES.every((r) => (a[r] ?? "").replace(/\s+/g, "").toLowerCase() === (b[r] ?? "").replace(/\s+/g, "").toLowerCase());

/** Six chips in a row: the palette at a glance. */
function Chips({ colours }: { colours: Palette }) {
  return (
    <span aria-hidden className="flex h-5 w-24 shrink-0 overflow-hidden rounded border border-border">
      {ROLES.map((r) => <span key={r} className="h-full flex-1" style={{ background: colours[r] }} title={ROLE_LABEL[r]} />)}
    </span>
  );
}

export function SavedPalettes() {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const now = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const saved = look.palettes ?? [];
  const [naming, setNaming] = React.useState<string | null>(null);

  const save = () => {
    const name = (naming ?? "").trim() || `Palette ${saved.length + 1}`;
    const entry: SavedPalette = { id: `pal_${Math.random().toString(36).slice(2, 8)}`, name, colours: { ...now } };
    play("confirm");
    useStudio.getState().setLook({ palettes: [...saved, entry] });
    setNaming(null);
  };
  const apply = (p: SavedPalette) => {
    play("select");
    useStudio.getState().setLook({ palette: { ...p.colours } });
  };
  const remove = (id: string) => {
    play("close");
    useStudio.getState().setLook({ palettes: saved.filter((p) => p.id !== id) });
  };

  return (
    <section data-saved-palettes="" className="space-y-2 border-t border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 data-look-heading className="text-plain font-semibold text-fg">Saved palettes</h3>
        {naming === null ? (
          <Button data-palette-save="" size="xs" variant="outline" onClick={() => { play("open"); setNaming(""); }}>
            Save these colours
          </Button>
        ) : null}
      </div>

      {naming !== null ? (
        <form
          data-palette-naming=""
          className="flex items-center gap-1.5"
          onSubmit={(e) => { e.preventDefault(); save(); }}
        >
          <Chips colours={now} />
          <Input
            autoFocus
            value={naming}
            placeholder={`Palette ${saved.length + 1}`}
            aria-label="Palette name"
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setNaming(null); }}
            className="h-7 min-w-0 flex-1"
          />
          <Button type="submit" size="xs">Save</Button>
        </form>
      ) : null}

      {saved.length ? (
        <ul className="space-y-1">
          {saved.map((p) => {
            const worn = same(now, p.colours);
            return (
              <li key={p.id} data-saved-palette={p.id} className={cn("flex items-center gap-1.5 rounded-md border p-1", worn ? "border-accent/60" : "border-border")}>
                <button
                  type="button"
                  aria-label={`Use ${p.name}`}
                  onClick={() => apply(p)}
                  className="tactile flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-hover"
                >
                  <Chips colours={p.colours} />
                  <span className="min-w-0 flex-1 truncate text-small text-fg">{p.name}</span>
                  {worn ? <Check aria-label="In use" className="size-3.5 shrink-0 text-accent" /> : null}
                </button>
                <Button variant="ghost" size="iconXs" aria-label={`Delete ${p.name}`} onClick={() => remove(p.id)}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : naming === null ? (
        <p className="text-small leading-snug text-fg-faint">Keep the colours you have now, and put them back later.</p>
      ) : null}
    </section>
  );
}
