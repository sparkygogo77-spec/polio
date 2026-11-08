"use client";
/**
 * "LIKE ONE OF MY SITES": the System of a board the owner made before, worn
 * by this one (handovers/audits/tidy-and-picker.md §4, J 2026-11-08: 4a).
 *
 * The owner knows his sites by what they look like, so the picker is a
 * grid of pictures (the Builds card's own, `thumbs.tsx`), not a list of
 * names: what you are choosing is shown, not named (docs/DESIGN.md). Press
 * one and its System is read off its saved document the way Take from this
 * site reads the open one (`readBoardSystem`): the dialog says what was
 * found, how many values here already match a token, and that nothing on
 * the board moves. "Take it" is one undo step. Then the dialog offers Tidy,
 * because a System taken from a site is exact (sol face: 35 text sizes) and
 * tidying it is the next thing a person wants; colours are never folded.
 *
 * A site too big for the mirror that was never opened in this browser has
 * no document to read: the take is refused in words ("open it once from
 * Builds"); a large site kept only in IndexedDB has no picture here but reads.
 */
import * as React from "react";
import { LayoutGrid, Shrink } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { docOf, shapeOf, useBuilds } from "@/features/builds/store";
import { SiteThumb, ThumbMaker } from "@/features/builds/thumbs";
import { readBoardSystem, takeFromBoard, type BoardAnswer, type Refused } from "../../system/api";
import type { System } from "../../system/model";
import { TIDY_KINDS, type TidyKind } from "../../system/tidy";
import { foundLine } from "./take";
import { TidyDialog } from "./tidy";

const n = (x: number) => x.toLocaleString();
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;

/** One board as a key: its picture, its name, what is on it. */
function BoardTile({ id, name, picked, onPick }: { id: string; name: string; picked: boolean; onPick: () => void }) {
  /* `docOf` reads the small mirror: a large site leaves only a pointer there, so it has no picture here, but a press still reads it whole from IndexedDB (`readBoardSystem`). */
  const doc = React.useMemo(() => docOf(id), [id]);
  const shape = React.useMemo(() => shapeOf(id), [id]);
  const large = !doc && shape.parts > 0;
  return (
    <button
      type="button"
      data-like-board={id}
      data-like-picked={picked ? "" : undefined}
      aria-pressed={picked}
      onClick={() => { play("select"); onPick(); }}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-md border text-left transition-colors",
        picked ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border bg-elevated/40 hover:border-fg-faint",
      )}
    >
      <span className="relative block aspect-[15/7] w-full overflow-hidden border-b border-border bg-elevated/40">
        {large
          ? <span className="grid size-full place-items-center px-2 text-center text-small text-fg-faint">a large site: no picture here, press to read it</span>
          : <SiteThumb id={id} doc={doc} />}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5 px-2 py-1">
        <span className={cn("min-w-0 flex-1 truncate text-xs", picked ? "text-fg" : "text-fg-muted group-hover:text-fg")}>{name}</span>
        <span className="shrink-0 tabular-nums text-small text-fg-faint">{shape.parts ? plural(shape.parts, "part") : "empty"}</span>
      </span>
    </button>
  );
}

export function LikeDialog({ open, onOpenChange, system, onTidy }: { open: boolean; onOpenChange: (v: boolean) => void; system: System | null; onTidy: () => void }) {
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const boards = React.useMemo(() => projects.filter((p) => p.id !== activeId), [projects, activeId]);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [dry, setDry] = React.useState<BoardAnswer | Refused | null>(null);
  const [taken, setTaken] = React.useState<BoardAnswer | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (!open) { setPicked(null); setDry(null); setTaken(null); setBusy(false); } }, [open]);
  /* The read is of a saved document (IndexedDB for a large site), so it is awaited; a later pick wins over an earlier read still on its way. */
  React.useEffect(() => {
    if (!picked) { setDry(null); return; }
    let alive = true;
    setDry(null);
    void readBoardSystem(picked).then((r) => { if (alive) setDry(r); });
    return () => { alive = false; };
  }, [picked]);
  const take = async () => {
    if (!picked || busy) return;
    setBusy(true);
    const r = await takeFromBoard(picked);
    setBusy(false);
    if (!r.ok) { setDry(r); play("deny"); return; }
    play("confirm");
    setTaken(r);
  };
  const name = picked ? boards.find((b) => b.id === picked)?.name ?? "that site" : null;
  const foldable = !!system && TIDY_KINDS.some((k: TidyKind) => (k === "type" ? system.tokens.type.steps : system.tokens[k]).length > 1);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={taken ? `This site now wears the System of “${taken.system.name}”` : "Like one of my sites"}
      description={taken ? undefined : "Take the System of a site you made before: its colours, type, space, corners and motion. Nothing on the board moves."}
      footer={taken ? (
        <>
          <Button variant="ghost" size="sm" data-like-leave="" onClick={() => onOpenChange(false)}>Leave it as it is</Button>
          <Button variant="primary" size="sm" data-like-tidy="" disabled={!foldable} onClick={() => { play("open"); onOpenChange(false); onTidy(); }}>
            <Shrink /> Tidy it
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" data-like-confirm="" disabled={!dry?.ok || busy} loading={busy} onClick={() => void take()}>Take it</Button>
        </>
      )}
    >
      {taken ? (
        <div data-like-taken="" className="space-y-2 text-xs text-fg">
          <p>It has {foundLine(taken).slice(0, 5).join(", ")}: exact, as the site wore them.</p>
          <p className="text-fg-muted">Tidy folds the text sizes, space steps and corners onto a clean scale, never moving one more than an eighth. Colours stay exactly as they are. You see what would move first.</p>
        </div>
      ) : (
        <div className="space-y-2 text-xs text-fg">
          {open ? <ThumbMaker /> : null}
          {boards.length ? (
            <div data-like-boards="" className="grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
              {boards.map((b) => <BoardTile key={b.id} id={b.id} name={b.name} picked={b.id === picked} onPick={() => setPicked(b.id)} />)}
            </div>
          ) : (
            <p data-like-none="" className="text-fg-muted">This is your only site. Make another, or bring one in, and it will be here.</p>
          )}
          <div data-like-report="" className="min-h-[3.5rem] space-y-1">
            {!picked ? <p className="text-fg-muted">Press a site to read its System.</p>
              : !dry ? <p className="text-fg-muted">Reading “{name}”…</p>
              : !dry.ok ? <p className="text-down">{dry.says}</p>
              : (
                <>
                  <p><span className="text-fg-muted">Found </span>{foundLine(dry).join("  ")}</p>
                  <p data-like-linked={dry.here.linked} data-like-oneoffs={dry.here.oneOffs}>
                    {dry.here.linked + dry.here.oneOffs === 0
                      ? "This site is blank: it will wear the System whole."
                      : <>{plural(dry.here.linked, "value")} here already match its tokens and will point at them. {n(dry.here.oneOffs)} keep their own.</>}
                  </p>
                  <p className="text-fg-muted">Its six colours become this site’s. Nothing on the board moves; one undo takes it back.</p>
                </>
              )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** The bar's button: opens the picker. Nothing to pick from until there is a second site. */
export function LikeButton({ system }: { system: System | null }) {
  const [open, setOpen] = React.useState(false);
  const [tidying, setTidying] = React.useState(false);
  const others = useBuilds((s) => s.projects.filter((p) => p.id !== s.activeId).length);
  return (
    <>
      <Button size="xs" variant="outline" data-like-open="" disabled={!others} title={others ? "Take the System of one of your other sites: its colours, type, space and corners. Nothing on the board moves." : "Make or bring in another site first."} onClick={() => { play("open"); setOpen(true); }}>
        <LayoutGrid /> Like one of my sites
      </Button>
      <LikeDialog open={open} onOpenChange={setOpen} system={system} onTidy={() => setTidying(true)} />
      <TidyDialog open={tidying} onOpenChange={setTidying} system={system} />
    </>
  );
}
