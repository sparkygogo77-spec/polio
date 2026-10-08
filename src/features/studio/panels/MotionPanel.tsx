"use client";
/**
 * The Motion tab: every moving part on the page, and the crates.
 *
 * MOVING PARTS. Everything on the current page that moves, grouped by kind
 * (`motionInventory.ts`): reveals on scroll, parts that follow the pointer or
 * tilt, what happens on hover and on press, loops and blinks, ribbons,
 * canvas effects, crates worn as pictures and the page-wide behaviours. Each
 * row has the part's plain name; pressing it selects the part and brings it
 * into view on the board. Beside it, play (the one movement, run on the board
 * at its real strength), off and on, and how fast where the kind has a
 * number for it. Each change is one undo step and is written where the
 * preview and the export already read it (`motionWrite.ts`).
 *
 * THE CRATE — frame interpolation. Five sleeves. Drop a picture in each, and
 * the Builder fills in every frame between them: it holds each keyframe for a
 * beat, then eases from one to the next across the gap, mixing the two in
 * OKLab (`oklab.ts`) so a middle is as bright as its ends. You can scrub it,
 * play it, take it away as a sprite sheet or a WebM, and put it on a part,
 * where it plays as that part's picture on the board, in the preview and on
 * the published site (`crateLayer.tsx`). The panel is 228 px wide, so a
 * crate is a card here and opens in a wide editor of its own.
 *
 * It is still a dissolve, and it says so. A dissolve is exactly right for a
 * fade, a colour turn, a light coming up; it is not what a shape morphing
 * along its shortest path looks like. So the editor writes the brief
 * (`motionBrief`) that tells a generator what the in-betweens ought to be, on
 * the identical timing, and it goes into the blueprint.
 */
import { SeeOnShelf } from "../ShelfCards";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ChevronLeft, ChevronRight, ClipboardCopy, Crosshair, Download, Eye, Film, Globe, Hand, Maximize2, MousePointer2, Pause, Play, Plus, Pointer,
  Power, Repeat, Rotate3d, Sparkles, Trash2, Waves, X,
} from "lucide-react";
import { BACKGROUND_ID, useStudio } from "../board/store";
import {
  filled, gapCount, gapLabel, LOOP_NAME, motionBrief, planFrames, playOrder, sleeveOf, SLEEVES, totalFrames,
  type MotionAsset, type MotionEase, type MotionLoop,
} from "../motion";
import { bunches, byKind, movingParts, partName, summarise, type MoveBunch, type MoveRow } from "../motionInventory";
import { setRowOn, setRowSpeed, setRowsOn, setRowsSpeed } from "../motionWrite";
import { VirtualList } from "@/core/ui/virtual-list";
import { fit, loadImage, tweenPixels, type Fitted } from "../crateDraw";
import { runWorks } from "../live/runWorks";
import { AMBIENT } from "../shelf";
import { ImageWell } from "../ImageIntake";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";

/** The widest or tallest sprite sheet drawn: inside every browser's canvas. */
const SHEET_MAX = 16384;

/* ------------------------------------------------------------------ */
/* The tab                                                             */
/* ------------------------------------------------------------------ */

/** A crate whose editor stepped aside for Pick on the board, to open again when the tab comes back. */
let comeBack: string | null = null;
let cratesKept = false;

export function MotionPanel() {
  const assets = useStudio(useShallow((s) => s.motion));
  const [editing, setEditing] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!comeBack) return;
    const id = comeBack;
    comeBack = null;
    setEditing(id);
  }, []);
  /* A crate waiting for a part to be pressed on the board. */
  const [picking, setPicking] = React.useState<string | null>(null);
  const open = assets.find((a) => a.id === editing) ?? null;
  /* Frame interpolation is its own folded section at the foot; opened once, it stays open for the visit. */
  const [cratesOpen, setCratesOpen] = React.useState(() => cratesKept);
  React.useEffect(() => { cratesKept = cratesOpen; }, [cratesOpen]);

  /* PICK ON THE BOARD: the editor steps aside, the next part pressed wears the crate, and the editor comes back. */
  React.useEffect(() => {
    if (!picking) return;
    /* Nothing selected to start with, so pressing the part that was already selected still counts. */
    useStudio.getState().setSelection([]);
    const was = "";
    let done = false;
    const off = useStudio.subscribe((s) => {
      const ids = s.selection;
      if (done || ids.join(",") === was || ids.length !== 1 || ids[0] === BACKGROUND_ID) return;
      /* Once: attaching writes the store, and this listener hears that write too. */
      done = true;
      off();
      useStudio.getState().attachMotion(picking, ids[0]!);
      play("confirm");
      setPicking(null);
      /*
       * The part is chosen on the press, and pressing a part opens its
       * Element panel, which takes this tab away with the editor in it. So
       * once the press is over the Motion tab is asked back, and the crate's
       * editor opens with it (`comeBack`, read as the tab mounts).
       */
      comeBack = picking;
      let back = false;
      const reopen = () => {
        if (back) return;
        back = true;
        window.removeEventListener("pointerup", later);
        setTimeout(() => {
          const id = comeBack;
          useStudio.getState().want({ panel: "motion" });
          setEditing(id);
          /* The tab never went (or came back already): nothing is left waiting for the next one. */
          setTimeout(() => { if (comeBack === id) comeBack = null; }, 500);
        }, 0);
      };
      const later = () => reopen();
      window.addEventListener("pointerup", later, { once: true });
      setTimeout(reopen, 600);
    });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setEditing(picking); setPicking(null); } };
    window.addEventListener("keydown", esc);
    return () => { off(); window.removeEventListener("keydown", esc); };
  }, [picking]);

  return (
    <div data-motion-panel="" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
      {/* The shelf's Motion category and this tab point at each other (`ShelfCards.tsx`). */}
      <SeeOnShelf category="motion">See every motion on the shelf</SeeOnShelf>
      <MovingParts />

      <details data-motion-crates="" className="group rounded-md border border-border" open={cratesOpen || !!picking} onToggle={(e) => { const now = (e.currentTarget as HTMLDetailsElement).open; if (now !== cratesOpen) { play(now ? "open" : "close"); setCratesOpen(now); } }}>
        <summary className="tactile flex h-8 cursor-pointer list-none items-center gap-2 px-2 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 shrink-0 text-fg-faint transition-transform group-open:rotate-90" />
          <Film className="size-3.5 shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1 truncate text-small font-semibold uppercase tracking-[0.08em] text-fg">Frame interpolation</span>
          <span className="num shrink-0 text-fine text-fg-faint">{assets.length ? `${assets.length} crate${assets.length === 1 ? "" : "s"}` : "none yet"}</span>
        </summary>
      <section className="space-y-2 border-t border-border p-2">
        <div className="flex items-center justify-end">
          <Button
            size="xs"
            variant="outline"
            onClick={() => { play("confirm"); const id = useStudio.getState().addMotion(); setEditing(id); }}
          >
            <Plus />
            Crate
          </Button>
        </div>
        <p data-motion-reach="" className="text-fine leading-snug text-fg-faint">
          A crate plays in its editor, goes into the blueprint as a brief, and, put on a part, plays as that
          part&apos;s picture on the board, in the preview and on the published page.
        </p>
        {picking ? (
          <div data-crate-picking="" className="flex items-center gap-1 rounded-md border border-accent/60 bg-accent-soft p-1.5 text-small text-accent">
            <Crosshair className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 leading-snug">Press a part on the board to put the crate on it.</span>
            <Button size="iconXs" variant="ghost" aria-label="Stop picking" onClick={() => { setEditing(picking); setPicking(null); }}>
              <X />
            </Button>
          </div>
        ) : null}
        {assets.length ? (
          assets.map((a) => <CrateCard key={a.id} asset={a} onOpen={() => setEditing(a.id)} />)
        ) : (
          <p className="rounded-md border border-dashed border-border p-3 text-small leading-snug text-fg-muted">
            A crate holds five keyframes. Drop a picture in each sleeve and the Builder works out every
            frame in between, 45 of them in a second and a half, which you can scrub, play, take away as a
            sprite sheet, or put on a part to play as its picture.
          </p>
        )}
      </section>
      </details>

      <Dialog
        open={!!open}
        onOpenChange={(v) => { if (!v) setEditing(null); }}
        title={open ? `Crate: ${open.name}` : "Crate"}
        description="Five sleeves, every frame between them worked out, on the timing you set."
        size="lg"
        className="max-h-[92vh] overflow-y-auto"
      >
        {open ? <CrateEditor key={open.id} asset={open} onPick={() => { setPicking(open.id); setEditing(null); }} /> : null}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Moving parts                                                        */
/* ------------------------------------------------------------------ */

/** Selects the part and brings it into view on the board. */
function goTo(nodeId: string) {
  const s = useStudio.getState();
  if (s.mode !== "design") s.setMode("design");
  s.setSelection([nodeId]);
  requestAnimationFrame(() => {
    document.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}

/** Restarts every CSS animation on and inside an element: a captured part's own, or a crate's strip. */
function restart(el: Element | null) {
  for (const a of el?.getAnimations?.({ subtree: true }) ?? []) { a.cancel(); a.play(); }
}

/**
 * Plays one row on the board. A library feature is run once, on the part's
 * drawn layer, at its real strength, and put back after a few seconds; what
 * already moves by itself on the board (a spin, a float, the dust) is left
 * playing. A captured animation or a crate starts again from its first frame.
 * A page-wide behaviour only happens on a page, so the preview is opened.
 */
function playRow(row: MoveRow): string | null {
  const s = useStudio.getState();
  goTo(row.nodeId);
  const box = document.querySelector(`[data-node-id="${CSS.escape(row.nodeId)}"]`);
  if (row.source === "work" && row.workId) {
    if ((AMBIENT as readonly string[]).includes(row.workId)) return "It already plays on the board.";
    const stop = runWorks(document.body, s.nodes.filter((n) => n.id === row.nodeId), { board: true, only: { part: row.nodeId, feature: row.workId } });
    setTimeout(stop, 4000);
    return row.kind === "follow" || row.kind === "tilt" || row.kind === "hover"
      ? "Playing for four seconds: move the pointer over it."
      : row.kind === "press" ? "Playing for four seconds: press it on the board." : null;
  }
  if (row.source === "captured" || row.source === "crate") {
    restart(box?.querySelector(row.source === "crate" ? ".crate-play" : ".mo") ?? null);
    return row.kind === "hover" || row.kind === "press" ? "It moves under the pointer: try it in Preview." : null;
  }
  s.setMode("preview");
  return "It runs across the whole page, so Preview is open.";
}

function MovingParts() {
  const nodes = useStudio((s) => s.nodes);
  const crates = useStudio((s) => s.motion);
  const pageId = useStudio((s) => s.activePageId);
  const selection = useStudio(useShallow((s) => s.selection));
  const rows = React.useMemo(() => movingParts(nodes, crates, pageId), [nodes, crates, pageId]);
  const groups = React.useMemo(() => byKind(rows), [rows]);
  const [note, setNote] = React.useState<{ key: string; says: string } | null>(null);
  const parts = React.useMemo(() => new Set(rows.map((r) => r.nodeId)).size, [rows]);

  const rowView = (r: MoveRow) => (
    <MoveRowView
      key={r.key}
      row={r}
      selected={selection.includes(r.nodeId)}
      note={note?.key === r.key ? note.says : null}
      onNote={(says) => setNote(says ? { key: r.key, says } : null)}
    />
  );

  return (
    <section data-moving-parts="" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-plain font-semibold text-fg">Moving parts on this page</span>
        <span className="num text-small text-fg-faint" title={`${rows.length} movements on ${parts} parts`}>{parts}</span>
      </div>
      {!rows.length ? (
        <p className="rounded-md border border-dashed border-border p-2 text-small leading-snug text-fg-muted">
          Nothing on this page moves yet. A part moves when it carries a movement from the library (reveal on
          scroll, tilt, spin and the rest), when it was captured moving, or when it wears a crate.
        </p>
      ) : (
        groups.map((g) => <KindBlock key={g.kind} kind={g.kind} name={g.name} rows={g.rows} rowView={rowView} />)
      )}
    </section>
  );
}

/** Each kind's mark, so the list of kinds reads at a glance. */
const KIND_MARK: Record<string, React.ComponentType<{ className?: string }>> = {
  reveal: Eye, follow: MousePointer2, tilt: Rotate3d, hover: Hand, press: Pointer, loop: Repeat, ribbon: Waves, canvas: Sparkles, crate: Film, page: Globe,
};

/** Many rows, drawn only where they are seen once there are more than a screenful. */
function Rows<T>({ items, keyOf, view }: { items: T[]; keyOf: (t: T) => string; view: (t: T) => React.ReactNode }) {
  if (items.length <= 30) return <div className="space-y-1">{items.map((t) => <React.Fragment key={keyOf(t)}>{view(t)}</React.Fragment>)}</div>;
  return <VirtualList items={items} getKey={keyOf} renderItem={(t) => <div className="pb-1">{view(t)}</div>} estimateSize={64} className="h-80" />;
}

/**
 * A line that stands for many: how many parts, how fast, and the controls
 * that change all of them at once, one undo step however many there are.
 * `title` says what they are; the chevron opens them.
 */
function FoldLine({ rows, title, open, onOpen, level, kind }: { rows: MoveRow[]; title: string; open: boolean; onOpen: () => void; level: "kind" | "bunch"; kind?: string }) {
  const Mark = kind ? KIND_MARK[kind] : undefined;
  const sum = summarise(rows);
  const sp = sum.speed;
  const [drag, setDrag] = React.useState<number | null>(null);
  const shown = drag ?? (typeof sp?.value === "number" ? sp.value : 0);
  const pace = sp ? (sp.mixed && drag === null ? `${speedText(sp.low, sp.unit).replace(/ .*/, "")} to ${speedText(sp.high, sp.unit)}` : speedText(shown, sp.unit)) : null;
  const count = `${sum.parts} part${sum.parts === 1 ? "" : "s"}`;
  const all = sum.parts === 1 ? "it" : `all ${sum.parts}`;
  return (
    <div
      data-move-fold={level}
      data-move-off={sum.allOff ? "" : undefined}
      className={cn("space-y-1 rounded-md border", level === "kind" ? "border-border bg-elevated/40 px-1 py-0.5" : "border-border/70 p-1", sum.allOff && "opacity-60")}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-move-open=""
          aria-expanded={open}
          onClick={() => { play("tap"); onOpen(); }}
          className="tactile flex min-h-6 min-w-0 flex-1 items-center gap-1 rounded-sm px-0.5 text-left hover:bg-hover"
        >
          <ChevronRight className={cn("size-4 shrink-0 text-fg-faint transition-transform", open && "rotate-90")} />
          {Mark ? <Mark className="size-3.5 shrink-0 text-fg-muted" /> : null}
          {level === "kind" ? (
            /* One compact row for a kind: its mark, its name, how many, and the one switch. */
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span data-move-title="" className="min-w-0 flex-1 truncate text-small font-medium text-fg">{title}</span>
              <span data-move-says="" className="num shrink-0 text-fine text-fg-faint" title={[count, pace, sum.allOff ? "all turned off" : sum.anyOff ? "some turned off" : null].filter(Boolean).join(" · ")}>
                {sum.allOff ? "off · " : ""}{count}
              </span>
            </span>
          ) : (
            <span className="min-w-0">
              <span data-move-title="" className="block truncate text-small text-fg">{title}</span>
              <span data-move-says="" className="block truncate text-fine text-fg-faint">
                {[count, pace, sum.allOff ? "all turned off" : sum.anyOff ? "some turned off" : null].filter(Boolean).join(" · ")}
              </span>
            </span>
          )}
        </button>
        <Button
          size="iconXs"
          variant="ghost"
          aria-pressed={!sum.allOff}
          aria-label={sum.allOff ? `Turn on ${all}: ${title}` : `Turn off ${all}: ${title}`}
          className={sum.allOff ? "text-fg-faint" : "text-accent"}
          onClick={() => { play("tap"); setRowsOn(rows, sum.allOff); }}
        >
          <Power />
        </Button>
      </div>
      {sp && !sum.allOff && (level === "bunch" || open) ? (
        <div className="space-y-0.5 px-1" data-move-speed-all="">
          <div className="flex items-baseline justify-between gap-1 text-fine">
            <span className="text-fg-muted">{sp.label}, for {all}</span>
            <span className="num truncate text-fg-faint">{pace}</span>
          </div>
          <Slider
            value={[shown]}
            min={sp.min}
            max={sp.max}
            step={sp.step}
            onValueChange={(v) => setDrag(v[0] ?? shown)}
            onValueCommit={(v) => { setDrag(null); setRowsSpeed(rows, v[0] ?? shown); }}
            aria-label={`${sp.label}, for ${all}: ${title}`}
          />
        </div>
      ) : null}
    </div>
  );
}

/** One kind: folded to its line first; opened, its bunches of alike parts, and a part on its own as a row. */
function KindBlock({ kind, name, rows, rowView }: { kind: string; name: string; rows: MoveRow[]; rowView: (r: MoveRow) => React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const groups = React.useMemo(() => bunches(rows), [rows]);
  return (
    <div data-move-kind={kind} className="space-y-1">
      <FoldLine rows={rows} title={name} open={open} onOpen={() => setOpen((v) => !v)} level="kind" kind={kind} />
      {open ? (
        <div className="space-y-1 border-l border-border pl-1.5" data-move-list="">
          <Rows items={groups} keyOf={(b) => b.key} view={(b) => (b.rows.length === 1 ? rowView(b.rows[0]!) : <BunchBlock bunch={b} rowView={rowView} />)} />
        </div>
      ) : null}
    </div>
  );
}

/** Parts that move the same way in the same section: one line, opened to the parts. */
function BunchBlock({ bunch, rowView }: { bunch: MoveBunch; rowView: (r: MoveRow) => React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  /* Under its kind's own line, so the kind is not said again: where they are, which is what tells bunches apart. */
  const what = bunch.rows[0]!.what;
  const title = bunch.section ? `In “${bunch.section}”` : `${what}, set alike`;
  return (
    <div data-move-bunch={bunch.key} className="space-y-1">
      <FoldLine rows={bunch.rows} title={title} open={open} onOpen={() => setOpen((v) => !v)} level="bunch" />
      {open ? <div className="border-l border-border pl-1.5"><Rows items={bunch.rows} keyOf={(r) => r.key} view={rowView} /></div> : null}
    </div>
  );
}

/** A speed as words, its unit spelled out: the panel is read, not decoded. */
const UNIT_WORDS: Record<string, string> = { ms: "milliseconds", s: "seconds", "px/s": "pixels a second", "px/frame": "pixels a frame", "×": "times as fast" };
function speedText(v: number | string, unit: string): string {
  if (typeof v === "string") return v;
  const n = Math.round(v * 100) / 100;
  return `${n} ${UNIT_WORDS[unit] ?? unit}`;
}

export function MoveRowView({ row, selected, here, note, onNote }: { row: MoveRow; selected: boolean; here?: boolean; note: string | null; onNote: (says: string | null) => void }) {
  const sp = row.speed;
  /* The slider follows the hand from here; the part is written once, where the hand lets go: one undo step. */
  const [drag, setDrag] = React.useState<number | null>(null);
  const shown = drag ?? (typeof sp?.value === "number" ? sp.value : 0);
  return (
    <div
      data-move-row={row.key}
      data-move-off={row.off ? "" : undefined}
      data-move-selected={selected ? "" : undefined}
      className={cn("space-y-1 rounded-md border p-1", selected ? "border-accent/60 bg-accent-soft/40" : "border-border", row.off && "opacity-60")}
    >
      <div className="flex items-center gap-1">
        {/* In the part's own panel the part is already picked: the row says what moves, it is not a way to it. */}
        {here ? (
          <span className="min-h-6 min-w-0 flex-1 px-1">
            <span className="block truncate text-small text-fg">{row.what}{row.off ? ", turned off" : ""}</span>
          </span>
        ) : (
          <button
            type="button"
            data-move-go=""
            onClick={() => { play("tap"); goTo(row.nodeId); }}
            className="tactile min-h-6 min-w-0 flex-1 rounded-sm px-1 text-left hover:bg-hover"
            title="Select it and show it on the board"
          >
            <span className="block truncate text-small text-fg">{row.name}</span>
            <span className="block truncate text-fine text-fg-faint">{row.what}{row.off ? ", turned off" : ""}</span>
          </button>
        )}
        <Button
          size="iconXs"
          variant="ghost"
          aria-label={`Play ${row.what} on ${row.name}`}
          disabled={row.off}
          onClick={() => onNote(playRow(row))}
        >
          <Play />
        </Button>
        <Button
          size="iconXs"
          variant="ghost"
          aria-pressed={!row.off}
          aria-label={row.off ? `Turn on ${row.what} on ${row.name}` : `Turn off ${row.what} on ${row.name}`}
          className={row.off ? "text-fg-faint" : "text-accent"}
          onClick={() => { play("tap"); setRowOn(row, row.off); }}
        >
          <Power />
        </Button>
      </div>
      {sp && !row.off ? (
        sp.unit === "pick" ? (
          <Segmented
            size="xs"
            className="w-full [&>*]:flex-1"
            value={String(sp.value)}
            onChange={(v) => setRowSpeed(row, v)}
            options={(sp.choices ?? []).map((c) => ({ value: c, label: c }))}
            aria-label={`${sp.label} of ${row.name}`}
          />
        ) : (
          <div className="space-y-0.5 px-1" data-move-speed="">
            <div className="flex items-baseline justify-between gap-1 text-fine">
              <span className="text-fg-muted">{sp.label}</span>
              <span className="num truncate text-fg-faint">{speedText(shown, sp.unit)}</span>
            </div>
            <Slider
              value={[shown]}
              min={sp.min}
              max={sp.max}
              step={sp.step}
              onValueChange={(v) => setDrag(v[0] ?? shown)}
              onValueCommit={(v) => { setDrag(null); setRowSpeed(row, v[0] ?? shown); }}
              aria-label={`${sp.label} of ${row.what} on ${row.name}`}
            />
          </div>
        )
      ) : null}
      {note ? <p className="px-1 text-fine leading-snug text-fg-muted">{note}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A crate, as a card in the narrow panel                              */
/* ------------------------------------------------------------------ */

function CrateCard({ asset, onOpen }: { asset: MotionAsset; onOpen: () => void }) {
  const wearer = useStudio((s) => (asset.part ? s.nodes.find((n) => n.id === asset.part) : undefined));
  const nodes = useStudio((s) => s.nodes);
  const first = filled(asset)[0]?.src ?? null;
  return (
    <div data-crate-card={asset.id} className="space-y-1.5 rounded-md border border-border p-1.5">
      <div className="flex items-center gap-1.5">
        <div className="h-9 w-14 shrink-0 overflow-hidden rounded-sm border border-border bg-elevated">
          {first ? <img src={first} alt="" className="h-full w-full object-contain" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-small text-fg">{asset.name}</div>
          <div data-crate-worn="" className="truncate text-fine text-fg-faint">
            {wearer ? `On ${partName(wearer, nodes.filter((n) => n.pageId === wearer.pageId))}${asset.off ? ", turned off" : ""}` : "Not on a part yet"}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <Button size="xs" variant="outline" className="flex-1" onClick={onOpen}>
          <Maximize2 />
          Open editor
        </Button>
        <Button size="iconXs" variant="ghost" aria-label={`Remove ${asset.name}`} onClick={() => useStudio.getState().removeMotion(asset.id)}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One crate, in its wide editor                                       */
/* ------------------------------------------------------------------ */

/** Every keyframe fitted into the editor's frame once, as pixels and OKLab. */
function useFitted(asset: MotionAsset, w: number, h: number): (Fitted | null)[] {
  const keys = React.useMemo(() => filled(asset), [asset]);
  const srcs = keys.map((k) => k.src).join("\n");
  const [out, setOut] = React.useState<(Fitted | null)[]>([]);
  React.useEffect(() => {
    let live = true;
    const list = srcs ? srcs.split("\n") : [];
    void Promise.all(list.map((src) => loadImage(src))).then((imgs) => {
      if (live) setOut(imgs.map((img) => (img ? fit(img, w, h) : null)));
    });
    return () => { live = false; };
  }, [srcs, w, h]);
  return out;
}

function CrateEditor({ asset, onPick }: { asset: MotionAsset; onPick: () => void }) {
  const s = () => useStudio.getState();
  const W = 264;
  const H = 148;
  const fitted = useFitted(asset, W, H);
  const keys = React.useMemo(() => filled(asset), [asset]);
  const plan = React.useMemo(() => playOrder(asset, planFrames(asset)), [asset]);
  const ready = keys.length >= 2;

  const [at, setAt] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [note, setNote] = React.useState<string | null>(null);

  // Keep the cursor inside the sequence when the plan gets shorter.
  React.useEffect(() => { setAt((n) => (plan.length ? Math.min(n, plan.length - 1) : 0)); }, [plan.length]);

  /* ------------------------------------------------------------ drawing */
  const paint = React.useCallback((index: number) => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    const step = plan[index];
    if (!step) return;
    // The in-between: the two keyframes it sits between, mixed in OKLab.
    // At t = 0 that is the keyframe itself, exactly.
    const img = ctx.createImageData(el.width, el.height);
    if (tweenPixels(step, fitted, img.data)) ctx.putImageData(img, 0, 0);
  }, [fitted, plan]);

  React.useEffect(() => { paint(at); }, [paint, at]);

  /* ---------------------------------------------------------- playback */
  React.useEffect(() => {
    if (!playing || !ready || !plan.length) return;
    let raf = 0;
    let last = performance.now();
    let owed = 0;
    let cursor = at;
    const step = 1000 / Math.max(1, asset.fps);
    /* Time is kept, not repaints counted. Stepping one frame whenever a whole
       step had passed since the last one lost the remainder every time: at
       60 Hz a 33 ms step took three repaints, so "30 fps" played 20 and a
       1.5 s crate ran for 2.3 s. What is owed carries over, and a slow
       repaint catches up by more than one frame. "Once" stops on its end. */
    const tick = (now: number) => {
      owed += now - last;
      last = now;
      const due = Math.floor(owed / step);
      if (due > 0) {
        owed -= due * step;
        if (asset.loop === "once" && cursor + due >= plan.length - 1) { setAt(plan.length - 1); setPlaying(false); return; }
        cursor = (cursor + due) % plan.length;
        setAt(cursor);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `at` is deliberately not a dependency: it would restart the loop every
    // frame. Playback picks up wherever the scrubber left it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, ready, plan.length, asset.fps, asset.loop]);

  /* ------------------------------------------------------------ taking it away */
  const sheet = async () => {
    const el = canvas.current;
    if (!el || !plan.length) return;
    const w = el.width;
    const h = el.height;
    /* One row while it fits, then rows. A row of 264px frames passes a
       browser's widest canvas at a few hundred frames (Chromium 65,535px,
       Firefox 32,767px), and a canvas that size hands back no picture at all
       — six seconds at 60 fps downloaded nothing and said nothing. 16,384 a
       side is inside every browser. */
    const cols = Math.max(1, Math.min(plan.length, Math.floor(SHEET_MAX / w)));
    const rows = Math.ceil(plan.length / cols);
    const out = document.createElement("canvas");
    out.width = w * cols;
    out.height = h * rows;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    for (let i = 0; i < plan.length; i++) {
      paint(i);
      ctx.drawImage(el, (i % cols) * w, Math.floor(i / cols) * h);
    }
    paint(at);
    out.toBlob((blob) => {
      if (!blob) { setNote("The browser would not make a picture that large."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${asset.name.replace(/\s+/g, "-").toLowerCase()}-sprite.png`;
      a.click();
      URL.revokeObjectURL(url);
      setNote(rows === 1 ? `${plan.length} frames, one row.` : `${plan.length} frames, ${cols} across in ${rows} rows.`);
    }, "image/png");
  };

  const webm = async () => {
    const el = canvas.current;
    if (!el || !plan.length || typeof MediaRecorder === "undefined") return;
    setNote("Recording…");
    const stream = el.captureStream(asset.fps);
    const type = ["video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
    rec.start();
    // Walk the sequence in real time so the recording is the sequence.
    for (let i = 0; i < plan.length; i++) {
      paint(i);
      await new Promise((r) => setTimeout(r, 1000 / asset.fps));
    }
    rec.stop();
    await done;
    paint(at);
    const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${asset.name.replace(/\s+/g, "-").toLowerCase()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    setNote(`${(blob.size / 1024).toFixed(0)} KB of WebM.`);
  };

  const wearer = useStudio((st) => (asset.part ? st.nodes.find((n) => n.id === asset.part) : undefined));
  const copyBrief = async () => {
    const el = canvas.current;
    try {
      await navigator.clipboard.writeText(motionBrief(asset, el ? { w: el.width, h: el.height } : undefined, wearer ? partName(wearer, useStudio.getState().nodes.filter((n) => n.pageId === wearer.pageId)) : null));
      setNote("The brief is on the clipboard.");
      play("confirm");
    } catch {
      setNote("Could not reach the clipboard.");
    }
  };

  const gaps = gapCount(asset);
  const step = plan[at];

  return (
    <div data-crate-editor={asset.id} className="space-y-3">
      <div className="flex items-center gap-1">
        <Input
          inputSize="sm"
          value={asset.name}
          onChange={(e) => s().updateMotion(asset.id, { name: e.target.value })}
          aria-label="Crate name"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          {/* ------------------------------------------------------ the sleeves */}
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: SLEEVES }, (_, i) => (
              <Sleeve key={i} asset={asset} at={i} live={keys.some((k) => k.at === i)} />
            ))}
          </div>

          {/* ------------------------------------------------------ the result */}
          <div className="space-y-1 rounded-md border border-border bg-elevated/50 p-1.5">
            <canvas
              ref={canvas}
              width={W}
              height={H}
              data-motion-canvas=""
              className="w-full rounded-sm"
              style={{ background: "var(--bg)", imageRendering: "auto" }}
            />
            {ready ? (
              <>
                <div className="flex items-center gap-1.5" data-crate-scrub="">
                  <Button
                    size="iconXs"
                    variant="ghost"
                    aria-label={playing ? "Pause" : "Play the sequence"}
                    onClick={() => { play("tap"); if (!playing && asset.loop === "once" && at >= plan.length - 1) setAt(0); setPlaying((v) => !v); }}
                  >
                    {playing ? <Pause /> : <Play />}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <Slider
                      value={[at]}
                      min={0}
                      max={Math.max(0, plan.length - 1)}
                      step={1}
                      onValueChange={(v) => { setPlaying(false); setAt(v[0] ?? 0); }}
                      aria-label="Scrub the sequence"
                    />
                  </div>
                  <span data-crate-counter="" className="num shrink-0 text-small text-fg-muted">
                    {at + 1}/{plan.length}
                  </span>
                </div>
                <p data-crate-where="" className="text-fine leading-snug text-fg-faint">
                  {step?.holding
                    ? `Holding sleeve ${sleeveOf(asset, step.from ?? 0)}`
                    : `Between sleeves ${sleeveOf(asset, step?.from ?? 0)} and ${sleeveOf(asset, step?.to ?? 0)}, ${Math.round((step?.t ?? 0) * 100)}% across`}
                  {" · "}
                  {totalFrames(asset)} frames at {asset.fps} frames a second
                </p>
              </>
            ) : (
              <p className="p-1 text-small leading-snug text-fg-muted">
                Two sleeves filled and it starts moving.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {/* ------------------------------------------------------ the timing */}
          <Row label="Length" value={`${asset.duration.toFixed(1)} seconds`}>
            <Slider
              value={[Math.round(asset.duration * 10)]}
              min={4}
              max={60}
              step={1}
              onValueChange={(v) => s().updateMotion(asset.id, { duration: (v[0] ?? 15) / 10 })}
              aria-label="Length"
            />
          </Row>
          <Row label="Frames a second">
            <Segmented
              className="w-full [&>*]:flex-1"
              size="md"
              value={String(asset.fps)}
              onChange={(v) => s().updateMotion(asset.id, { fps: Number(v) })}
              options={[{ value: "30", label: "30 a second" }, { value: "60", label: "60 a second" }]}
              aria-label="Frames a second"
            />
          </Row>
          <Row label="Plays">
            <Select
              className="w-full"
              value={asset.loop}
              onChange={(v) => s().updateMotion(asset.id, { loop: v as MotionLoop })}
              options={(Object.keys(LOOP_NAME) as MotionLoop[]).map((k) => ({ value: k, label: LOOP_NAME[k] }))}
              aria-label="Plays"
            />
          </Row>
          <Row label="Hold each keyframe" value={`${asset.hold} frames`}>
            <Slider
              value={[asset.hold]}
              min={0}
              max={8}
              step={1}
              onValueChange={(v) => s().updateMotion(asset.id, { hold: v[0] ?? 2 })}
              aria-label="Hold each keyframe"
            />
          </Row>
          <Select
            className="w-full"
            value={asset.ease}
            onChange={(v) => s().updateMotion(asset.id, { ease: v as MotionEase })}
            options={[{ value: "ease", label: "Ease in and out of each gap" }, { value: "linear", label: "Even pace, no easing" }]}
            aria-label="Easing"
          />

          {/* --------------------------------------------------------- the gaps */}
          {gaps > 0 ? (
            <div className="space-y-1 rounded-md border border-border p-1.5" data-crate-gaps="">
              <div className="text-small font-medium uppercase tracking-wider text-fg-faint">Gaps</div>
              <p className="text-fine leading-snug text-fg-faint">
                How long each one takes, next to the others, named by the sleeves at its two ends. Turn one
                up and the motion lingers there.
              </p>
              {Array.from({ length: gaps }, (_, i) => (
                <Row key={i} label={`Sleeve ${gapLabel(asset, i)}`} value={`×${(asset.gaps[i] ?? 1).toFixed(1)}`}>
                  <Slider
                    value={[Math.round((asset.gaps[i] ?? 1) * 10)]}
                    min={2}
                    max={40}
                    step={1}
                    onValueChange={(v) => {
                      const gapsNext = [...asset.gaps];
                      gapsNext[i] = (v[0] ?? 10) / 10;
                      s().updateMotion(asset.id, { gaps: gapsNext });
                    }}
                    aria-label={`Gap from sleeve ${gapLabel(asset, i)}`}
                  />
                </Row>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------------ the part that wears it */}
      <WornBy asset={asset} onPick={onPick} />

      {/* -------------------------------------------------- taking it away */}
      <div className="flex flex-wrap gap-1">
        <Tooltip content="Every frame in one PNG (Portable Network Graphics) picture: one row, or rows of frames left to right when one row would be too wide." side="top">
          <Button size="xs" variant="outline" disabled={!ready} onClick={() => void sheet()}>
            <Download />
            Sprite sheet
          </Button>
        </Tooltip>
        <Tooltip content="The sequence, recorded from the canvas at its own frame rate." side="top">
          <Button size="xs" variant="outline" disabled={!ready} onClick={() => void webm()}>
            <Film />
            WebM
          </Button>
        </Tooltip>
        <Tooltip content="What a generator needs to render these in-betweens properly, on this exact timing." side="top">
          <Button size="xs" variant="outline" onClick={() => void copyBrief()}>
            <ClipboardCopy />
            Brief
          </Button>
        </Tooltip>
        <Button size="xs" variant="ghost" className="ml-auto" aria-label="Remove this crate" onClick={() => s().removeMotion(asset.id)}>
          <Trash2 />
          Remove
        </Button>
      </div>
      {note ? <p className="text-fine text-fg-muted">{note}</p> : null}
      <p className="text-fine leading-snug text-fg-faint">
        The Builder mixes your keyframes in OKLab, a colour space where equal steps look equal, so a middle is
        as bright as its ends. That is exactly right for a fade or a colour turn, and a floor for anything that
        has to morph: the brief carries the timing over to whoever renders those frames properly.
      </p>
    </div>
  );
}

/** Which part wears the crate: picked on the board, or found by name. */
function WornBy({ asset, onPick }: { asset: MotionAsset; onPick: () => void }) {
  const pageId = useStudio((s) => s.activePageId);
  const nodes = useStudio((s) => s.nodes);
  const wearer = asset.part ? nodes.find((n) => n.id === asset.part) : undefined;
  const [find, setFind] = React.useState("");
  const onPage = React.useMemo(() => nodes.filter((n) => n.pageId === pageId), [nodes, pageId]);
  /* The side panel's names, worked out once for the page: never "div · 2 inside". */
  const names = React.useMemo(() => new Map(onPage.map((n) => [n.id, partName(n, onPage)])), [onPage]);
  const nameOf = (n: { id: string }) => names.get(n.id) ?? "";
  const q = find.trim().toLowerCase();
  const found = React.useMemo(() => (q ? onPage.filter((n) => (names.get(n.id) ?? "").toLowerCase().includes(q)) : onPage), [onPage, names, q]);
  const matches = found.slice(0, 40);
  const more = found.length - matches.length;
  const put = (id: string | null) => { play("confirm"); useStudio.getState().attachMotion(asset.id, id); };
  return (
    <div data-crate-wear="" className="space-y-1.5 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-small font-medium text-fg">Put it on a part</span>
        <Button size="xs" variant="outline" onClick={onPick}>
          <Crosshair />
          Pick on the board
        </Button>
      </div>
      <p data-crate-worn="" className="text-fine leading-snug text-fg-muted">
        {wearer
          ? `Plays as the picture of ${nameOf(wearer) || partName(wearer)}, on the board, in the preview and on the published page${asset.off ? ", once it is turned back on in the list above" : ""}.`
          : "Not on a part yet. Put it on one and it plays as that part's picture, on the board, in the preview and on the published page."}
      </p>
      {wearer ? (
        <Button size="xs" variant="ghost" onClick={() => put(null)}>
          <X />
          Take it off {nameOf(wearer) || partName(wearer)}
        </Button>
      ) : null}
      <Input inputSize="sm" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a part on this page by name" aria-label="Find a part by name" />
      <div className="max-h-40 overflow-y-auto rounded-sm border border-border" role="listbox" aria-label="Parts on this page">
        {matches.map((n) => (
          <button
            key={n.id}
            type="button"
            role="option"
            aria-selected={n.id === asset.part}
            data-crate-part={n.id}
            onClick={() => put(n.id)}
            className={cn("tactile flex min-h-7 w-full items-center px-2 text-left text-small hover:bg-hover", n.id === asset.part ? "bg-accent-soft text-accent" : "text-fg")}
          >
            <span className="truncate">{nameOf(n)}</span>
          </button>
        ))}
        {!matches.length ? <p className="p-2 text-fine text-fg-faint">No part by that name on this page.</p> : null}
      </div>
      {more > 0 ? <p className="text-fine text-fg-faint">{more} more: type to narrow the list.</p> : null}
    </div>
  );
}

/** One sleeve: a picture, or a place for one; its buttons are 24 px and always there. */
function Sleeve({ asset, at, live }: { asset: MotionAsset; at: number; live: boolean }) {
  const s = () => useStudio.getState();
  return (
    <div className="space-y-1" data-sleeve={at + 1}>
      <ImageWell
        compact
        src={asset.frames[at]}
        label={`sleeve ${at + 1}`}
        onImage={(src) => s().setMotionFrame(asset.id, at, src)}
      />
      <div className={cn("num text-center text-small", live ? "text-accent" : "text-fg-faint")}>{at + 1}</div>
      <div className="flex flex-wrap justify-center gap-0.5">
        <Button size="iconXs" variant="ghost" aria-label={`Move sleeve ${at + 1} earlier`} disabled={at === 0} onClick={() => s().moveMotionFrame(asset.id, at, -1)}>
          <ChevronLeft />
        </Button>
        <Button size="iconXs" variant="ghost" aria-label={`Move sleeve ${at + 1} later`} disabled={at === SLEEVES - 1} onClick={() => s().moveMotionFrame(asset.id, at, 1)}>
          <ChevronRight />
        </Button>
        {asset.frames[at] ? (
          <Button size="iconXs" variant="ghost" aria-label={`Empty sleeve ${at + 1}`} onClick={() => s().setMotionFrame(asset.id, at, null)}>
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-small text-fg-muted">{label}</span>
        {value ? <span className="num text-small text-fg-faint">{value}</span> : null}
      </div>
      {children}
    </div>
  );
}
